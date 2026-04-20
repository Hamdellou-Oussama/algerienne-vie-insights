"""IBNR provision engine using volume-weighted Chain Ladder."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Any, Mapping, Sequence

from src.config import load_yaml_config

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class IBNRTriangleCell:
    """Single cell in the IBNR development triangle."""

    occurrence_year: int
    development_year: int
    incremental_amount: float
    cumulative_amount: float
    is_known: bool
    is_projected: bool
    source_claim_count: int


@dataclass(frozen=True)
class IBNRDevelopmentFactor:
    """Volume-weighted development factor for one development period."""

    development_year: int
    numerator: float
    denominator: float
    factor: float
    contributing_occurrence_years: tuple[int, ...]


@dataclass(frozen=True)
class IBNROccurrenceYearAudit:
    """Chain Ladder audit for one occurrence year."""

    occurrence_year: int
    diagonal_cumulative: float
    ultimate: float
    reserve: float
    last_known_development_year: int


@dataclass(frozen=True)
class IBNRResult:
    """Full IBNR result with traceability for Chain Ladder."""

    closing_year: int
    occurrence_year_window: tuple[int, int]
    max_development_year: int
    method: str
    total_ibnr: float
    triangle_cells: list[IBNRTriangleCell]
    development_factors: list[IBNRDevelopmentFactor]
    by_occurrence_year: list[IBNROccurrenceYearAudit]
    parameters: dict[str, Any]
    excluded_rows: list[dict[str, Any]]


def _load_config() -> dict[str, Any]:
    """Load IBNR configuration from legislative.yaml."""

    config = load_yaml_config("src/config/legislative.yaml")
    try:
        return config["ibnr"]
    except KeyError as exc:
        LOGGER.error("Missing ibnr section in legislative.yaml: %s", exc)
        raise ValueError("IBNR configuration section missing from legislative.yaml.") from exc


def _coerce_int(value: Any, field_name: str) -> int:
    """Coerce to int or raise a clear error."""

    try:
        if value is None:
            raise ValueError(f"{field_name} is missing.")
        return int(value)
    except Exception as exc:
        LOGGER.error("Failed to parse %s=%r: %s", field_name, value, exc)
        raise ValueError(f"Invalid {field_name}: {value!r}") from exc


def _coerce_float(value: Any, field_name: str) -> float:
    """Coerce to float or raise a clear error."""

    try:
        if value is None:
            raise ValueError(f"{field_name} is missing.")
        return float(value)
    except Exception as exc:
        LOGGER.error("Failed to parse %s=%r: %s", field_name, value, exc)
        raise ValueError(f"Invalid {field_name}: {value!r}") from exc


def build_triangle(
    rows: Sequence[Mapping[str, Any]],
    closing_year: int,
    occurrence_year_window: tuple[int, int],
) -> tuple[list[IBNRTriangleCell], list[dict[str, Any]]]:
    """Aggregate claim rows into an incremental and cumulative development triangle.

    Returns (triangle_cells, excluded_rows). All cells with is_known=True are
    from observed data; is_projected=False. Unknown cells are not created here
    — projection fills them later.
    """

    min_occ, max_occ = occurrence_year_window
    max_dev = closing_year - min_occ

    incremental: dict[tuple[int, int], float] = {}
    claim_counts: dict[tuple[int, int], int] = {}
    excluded_rows: list[dict[str, Any]] = []

    for row in rows:
        source_row = int(row.get("_source_row_number", -1))
        occurrence_year = _coerce_int(row["occurrence_year"], "occurrence_year")
        declaration_year = _coerce_int(row["declaration_year"], "declaration_year")
        claim_amount = _coerce_float(row["claim_amount"], "claim_amount")

        dev_year = declaration_year - occurrence_year

        if dev_year < 0:
            LOGGER.warning(
                "Row %s excluded: declaration_year=%s < occurrence_year=%s (impossible lag).",
                source_row, declaration_year, occurrence_year,
            )
            excluded_rows.append({
                "source_row_number": source_row,
                "reason": "declaration_year_before_occurrence_year",
                "occurrence_year": occurrence_year,
                "declaration_year": declaration_year,
                "claim_amount": claim_amount,
            })
            continue

        if occurrence_year < min_occ or occurrence_year > max_occ:
            LOGGER.debug("Row %s outside occurrence window (%s..%s): occ=%s.", source_row, min_occ, max_occ, occurrence_year)
            excluded_rows.append({
                "source_row_number": source_row,
                "reason": "occurrence_year_outside_window",
                "occurrence_year": occurrence_year,
                "declaration_year": declaration_year,
                "claim_amount": claim_amount,
            })
            continue

        if declaration_year > closing_year:
            LOGGER.warning(
                "Row %s excluded: declaration_year=%s > closing_year=%s.",
                source_row, declaration_year, closing_year,
            )
            excluded_rows.append({
                "source_row_number": source_row,
                "reason": "declaration_year_after_closing_year",
                "occurrence_year": occurrence_year,
                "declaration_year": declaration_year,
                "claim_amount": claim_amount,
            })
            continue

        key = (occurrence_year, dev_year)
        incremental[key] = incremental.get(key, 0.0) + claim_amount
        claim_counts[key] = claim_counts.get(key, 0) + 1

    cells: list[IBNRTriangleCell] = []
    for occ in range(min_occ, max_occ + 1):
        cumulative = 0.0
        for dev in range(0, max_dev + 1):
            key = (occ, dev)
            is_known = (occ + dev) <= closing_year
            if not is_known:
                break
            incr = incremental.get(key, 0.0)
            cumulative += incr
            cells.append(IBNRTriangleCell(
                occurrence_year=occ,
                development_year=dev,
                incremental_amount=incr,
                cumulative_amount=cumulative,
                is_known=True,
                is_projected=False,
                source_claim_count=claim_counts.get(key, 0),
            ))

    LOGGER.info(
        "Built triangle: %s cells across %s occurrence years, %s rows excluded.",
        len(cells), max_occ - min_occ + 1, len(excluded_rows),
    )
    return cells, excluded_rows


def compute_development_factors(
    cells: list[IBNRTriangleCell],
    closing_year: int,
) -> list[IBNRDevelopmentFactor]:
    """Compute volume-weighted development factors from known triangle cells.

    F[j] = Σ C[i][j] / Σ C[i][j-1] over all i where i+j <= closing_year.
    """

    cumulative: dict[tuple[int, int], float] = {
        (c.occurrence_year, c.development_year): c.cumulative_amount
        for c in cells if c.is_known and not c.is_projected
    }

    dev_years = sorted({c.development_year for c in cells if c.is_known})
    occurrence_years = sorted({c.occurrence_year for c in cells if c.is_known})
    max_dev = max(dev_years) if dev_years else 0

    factors: list[IBNRDevelopmentFactor] = []
    for j in range(1, max_dev + 1):
        valid_occ = [i for i in occurrence_years if i + j <= closing_year and (i, j - 1) in cumulative]
        if not valid_occ:
            LOGGER.debug("No contributing rows for factor F[%s].", j)
            continue
        numerator = sum(cumulative[(i, j)] for i in valid_occ if (i, j) in cumulative)
        denominator = sum(cumulative[(i, j - 1)] for i in valid_occ)
        if denominator == 0.0:
            LOGGER.warning(
                "Zero denominator for F[%s] (occ years %s): no observed development in column %s. "
                "Defaulting to factor=1.0 (fully developed assumption).",
                j, valid_occ, j - 1,
            )
            factor = 1.0
        else:
            factor = numerator / denominator
        factors.append(IBNRDevelopmentFactor(
            development_year=j,
            numerator=numerator,
            denominator=denominator,
            factor=factor,
            contributing_occurrence_years=tuple(valid_occ),
        ))
        LOGGER.debug("F[%s] = %.10f (n=%s, d=%s)", j, factor, numerator, denominator)

    LOGGER.info("Computed %s development factors.", len(factors))
    return factors


def project_triangle(
    cells: list[IBNRTriangleCell],
    factors: list[IBNRDevelopmentFactor],
    closing_year: int,
    max_development_year: int,
) -> list[IBNRTriangleCell]:
    """Fill unknown triangle cells by applying factors iteratively.

    Returns the full list (known + projected cells).
    """

    factor_map: dict[int, float] = {f.development_year: f.factor for f in factors}
    cumulative: dict[tuple[int, int], float] = {
        (c.occurrence_year, c.development_year): c.cumulative_amount for c in cells
    }
    occurrence_years = sorted({c.occurrence_year for c in cells})

    projected: list[IBNRTriangleCell] = list(cells)

    for occ in occurrence_years:
        for dev in range(1, max_development_year + 1):
            key = (occ, dev)
            if key in cumulative:
                continue
            prev_key = (occ, dev - 1)
            if prev_key not in cumulative:
                LOGGER.error("Cannot project (%s, %s): prior cell (%s, %s) missing.", occ, dev, occ, dev - 1)
                raise ValueError(f"Cannot project cell ({occ}, {dev}): prior cumulative is missing.")
            if dev not in factor_map:
                LOGGER.error("No factor F[%s] available for projection.", dev)
                raise ValueError(f"No development factor F[{dev}] available.")
            prev_cumul = cumulative[prev_key]
            proj_cumul = factor_map[dev] * prev_cumul
            proj_incr = proj_cumul - prev_cumul
            cumulative[key] = proj_cumul
            projected.append(IBNRTriangleCell(
                occurrence_year=occ,
                development_year=dev,
                incremental_amount=proj_incr,
                cumulative_amount=proj_cumul,
                is_known=False,
                is_projected=True,
                source_claim_count=0,
            ))
            LOGGER.debug("Projected C[%s][%s] = %.6f via F[%s]=%.10f.", occ, dev, proj_cumul, dev, factor_map[dev])

    return projected


def _compute_occurrence_year_results(
    all_cells: list[IBNRTriangleCell],
    closing_year: int,
    max_development_year: int,
) -> list[IBNROccurrenceYearAudit]:
    """Derive diagonal, ultimate and reserve per occurrence year."""

    cumulative: dict[tuple[int, int], float] = {
        (c.occurrence_year, c.development_year): c.cumulative_amount for c in all_cells
    }
    occurrence_years = sorted({c.occurrence_year for c in all_cells})
    results: list[IBNROccurrenceYearAudit] = []

    for occ in occurrence_years:
        last_known_dev = closing_year - occ
        diagonal_key = (occ, last_known_dev)
        ultimate_key = (occ, max_development_year)
        if diagonal_key not in cumulative:
            raise ValueError(f"Missing diagonal cell ({occ}, {last_known_dev}) after projection.")
        if ultimate_key not in cumulative:
            raise ValueError(f"Missing ultimate cell ({occ}, {max_development_year}) after projection.")
        diagonal = cumulative[diagonal_key]
        ultimate = cumulative[ultimate_key]
        reserve = ultimate - diagonal
        results.append(IBNROccurrenceYearAudit(
            occurrence_year=occ,
            diagonal_cumulative=diagonal,
            ultimate=ultimate,
            reserve=reserve,
            last_known_development_year=last_known_dev,
        ))
        LOGGER.debug("Occ %s: G=%.2f U=%.2f R=%.2f", occ, diagonal, ultimate, reserve)

    return results


def calculate_ibnr(
    rows: Sequence[Mapping[str, Any]],
    *,
    closing_year: int | None = None,
    occurrence_year_window: tuple[int, int] | None = None,
    segment_by: str | None = None,
) -> IBNRResult | dict[str, IBNRResult]:
    """Calculate IBNR using volume-weighted Chain Ladder.

    When segment_by is provided, partition rows by that field and return a dict
    of IBNRResult keyed by segment value. Otherwise return a single IBNRResult
    across all rows.
    """

    ibnr_config = _load_config()

    if closing_year is None:
        closing_year = int(ibnr_config["closing_year"])

    window_size = int(ibnr_config["occurrence_year_window_size"])
    if occurrence_year_window is None:
        occurrence_year_window = (closing_year - window_size + 1, closing_year)

    LOGGER.info(
        "Starting IBNR Chain Ladder: closing_year=%s window=%s rows=%s segment_by=%s",
        closing_year, occurrence_year_window, len(rows), segment_by,
    )

    if segment_by is not None:
        from collections import defaultdict
        buckets: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
        for row in rows:
            key = str(row.get(segment_by) or "unknown")
            buckets[key].append(row)
        return {
            key: _run_chain_ladder(bucket_rows, closing_year, occurrence_year_window)
            for key, bucket_rows in sorted(buckets.items())
        }

    return _run_chain_ladder(list(rows), closing_year, occurrence_year_window)


def _run_chain_ladder(
    rows: list[Mapping[str, Any]],
    closing_year: int,
    occurrence_year_window: tuple[int, int],
) -> IBNRResult:
    """Execute Chain Ladder for a single homogeneous group of rows."""

    min_occ, max_occ = occurrence_year_window
    max_development_year = closing_year - min_occ

    cells, excluded_rows = build_triangle(rows, closing_year, occurrence_year_window)
    factors = compute_development_factors(cells, closing_year)
    all_cells = project_triangle(cells, factors, closing_year, max_development_year)
    occ_results = _compute_occurrence_year_results(all_cells, closing_year, max_development_year)

    total_ibnr = sum(o.reserve for o in occ_results)
    LOGGER.info("Finished IBNR Chain Ladder: total_ibnr=%.6f", total_ibnr)

    return IBNRResult(
        closing_year=closing_year,
        occurrence_year_window=occurrence_year_window,
        max_development_year=max_development_year,
        method="chain_ladder_volume_weighted",
        total_ibnr=total_ibnr,
        triangle_cells=all_cells,
        development_factors=factors,
        by_occurrence_year=occ_results,
        parameters={
            "closing_year": closing_year,
            "occurrence_year_window": list(occurrence_year_window),
            "max_development_year": max_development_year,
        },
        excluded_rows=excluded_rows,
    )
