"""Bornhuetter-Ferguson IBNR method layered on an existing IBNRResult."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from src.config import load_yaml_config
from src.provisions.ibnr import IBNRResult

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class BFAYDetail:
    """BF reserve detail for one accident year."""

    occurrence_year: int
    reported_diagonal: float
    q_percent_reported: float
    prior_ultimate: float
    ultimate_bf: float
    ibnr_bf: float
    ibnr_chain_ladder: float


@dataclass(frozen=True)
class BFResult:
    """Bornhuetter-Ferguson IBNR result."""

    method: str
    prior_basis: str
    total_ibnr_bf: float
    total_ibnr_chain_ladder: float
    difference_vs_chain_ladder: float
    by_occurrence_year: list[BFAYDetail]
    parameters: dict[str, Any]


def _load_bf_config() -> dict[str, Any]:
    config = load_yaml_config("src/config/legislative.yaml")
    return config["ibnr"]["bornhuetter_ferguson"]


def _compute_cdf_factors(
    occurrence_years: list[int],
    closing_year: int,
    dev_max: int,
    factors: dict[int, float],
) -> dict[int, float]:
    """CDF from last-observed dev to ultimate for each AY."""

    cdf: dict[int, float] = {}
    for ay in occurrence_years:
        d_obs = closing_year - ay
        product = 1.0
        for j in range(d_obs + 1, dev_max + 1):
            product *= factors[j]
        cdf[ay] = product
    return cdf


def _derive_prior_ultimates(
    ibnr_result: IBNRResult,
    occurrence_years: list[int],
    config: dict[str, Any],
) -> tuple[dict[int, float], str]:
    """Return (prior_ult_by_ay, description_string)."""

    prior_basis = config.get("prior_basis", "mature_ay_ratio")

    if prior_basis == "fixed_elr":
        raise ValueError(
            "BF fixed_elr mode requires exposure by AY; not available in base ADE. "
            "Set prior_basis: mature_ay_ratio in legislative.yaml."
        )

    # mature_ay_ratio: ULT(mature_ay) / C[mature_ay][0]
    mature_ay = int(config.get("mature_ay", 2022))

    dev0_by_ay: dict[int, float] = {
        c.occurrence_year: c.cumulative_amount
        for c in ibnr_result.triangle_cells
        if c.development_year == 0 and c.is_known
    }
    ult_by_ay: dict[int, float] = {
        a.occurrence_year: a.ultimate
        for a in ibnr_result.by_occurrence_year
    }

    if mature_ay not in dev0_by_ay or mature_ay not in ult_by_ay:
        # Fall back to the most developed available AY in this triangle.
        available = sorted(
            (ay for ay in occurrence_years if ay in dev0_by_ay and dev0_by_ay[ay] != 0.0),
        )
        if not available:
            raise ValueError("BF: no AY with non-zero dev0 found; cannot derive prior ultimates.")
        mature_ay = available[0]
        LOGGER.warning("BF mature_ay not in triangle; falling back to AY %s.", mature_ay)

    if dev0_by_ay.get(mature_ay, 0.0) == 0.0:
        available = sorted(
            ay for ay in occurrence_years if ay in dev0_by_ay and dev0_by_ay[ay] != 0.0
        )
        if not available:
            raise ValueError("BF: no AY with non-zero dev0 found; cannot derive prior ultimates.")
        mature_ay = available[0]
        LOGGER.warning("BF mature_ay dev0=0; falling back to AY %s.", mature_ay)

    ratio = ult_by_ay[mature_ay] / dev0_by_ay[mature_ay]
    LOGGER.debug("BF prior ratio (ULT/dev0) for AY %s = %.6f", mature_ay, ratio)

    prior_ult = {ay: dev0_by_ay[ay] * ratio for ay in occurrence_years if ay in dev0_by_ay}
    description = f"mature_ay_ratio: AY {mature_ay} ULT/dev0 = {ratio:.6f}"
    return prior_ult, description


def calculate_bf(
    ibnr_result: IBNRResult,
    config: dict[str, Any] | None = None,
) -> BFResult:
    """Compute Bornhuetter-Ferguson reserves from an existing IBNRResult.

    Uses CL factors for percent-reported q and a prior ultimate derived from
    the mature AY's ULT/dev0 ratio (configurable via legislative.yaml).
    """

    LOGGER.info("Starting Bornhuetter-Ferguson calculation.")
    if config is None:
        config = _load_bf_config()

    dev_max = ibnr_result.max_development_year
    closing_year = ibnr_result.closing_year
    occurrence_years = sorted({a.occurrence_year for a in ibnr_result.by_occurrence_year})
    factors: dict[int, float] = {f.development_year: f.factor for f in ibnr_result.development_factors}

    cdf = _compute_cdf_factors(occurrence_years, closing_year, dev_max, factors)
    prior_ult, prior_description = _derive_prior_ultimates(ibnr_result, occurrence_years, config)

    diag_by_ay: dict[int, float] = {a.occurrence_year: a.diagonal_cumulative for a in ibnr_result.by_occurrence_year}
    cl_ibnr_by_ay: dict[int, float] = {a.occurrence_year: a.reserve for a in ibnr_result.by_occurrence_year}

    details: list[BFAYDetail] = []
    for ay in occurrence_years:
        g = diag_by_ay[ay]
        c = cdf[ay]
        q = 1.0 / c if c != 0 else 1.0
        p_ult = prior_ult.get(ay, g)
        ibnr_bf = (1.0 - q) * p_ult
        ult_bf = g + ibnr_bf
        details.append(BFAYDetail(
            occurrence_year=ay,
            reported_diagonal=g,
            q_percent_reported=q,
            prior_ultimate=p_ult,
            ultimate_bf=ult_bf,
            ibnr_bf=ibnr_bf,
            ibnr_chain_ladder=cl_ibnr_by_ay[ay],
        ))
        LOGGER.debug("BF AY %s: q=%.4f prior=%.2f ibnr_bf=%.2f ibnr_cl=%.2f", ay, q, p_ult, ibnr_bf, cl_ibnr_by_ay[ay])

    total_bf = sum(d.ibnr_bf for d in details)
    total_cl = ibnr_result.total_ibnr
    LOGGER.info("BF done: total_ibnr_bf=%.2f total_ibnr_cl=%.2f diff=%.2f", total_bf, total_cl, total_bf - total_cl)

    return BFResult(
        method="bornhuetter_ferguson",
        prior_basis=prior_description,
        total_ibnr_bf=total_bf,
        total_ibnr_chain_ladder=total_cl,
        difference_vs_chain_ladder=total_bf - total_cl,
        by_occurrence_year=details,
        parameters={
            "closing_year": closing_year,
            "dev_max": dev_max,
            "prior_basis": config.get("prior_basis"),
            "mature_ay": config.get("mature_ay"),
        },
    )
