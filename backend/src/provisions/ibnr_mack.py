"""Mack Chain Ladder uncertainty layer over an existing IBNRResult."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any

from src.provisions.ibnr import IBNRResult

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class MackAYDetail:
    """Mack process-variance metrics for one accident year."""

    occurrence_year: int
    ibnr_chain_ladder: float
    sigma2: float
    mse: float
    se: float
    cv: float


@dataclass(frozen=True)
class MackResult:
    """Mack Chain Ladder uncertainty metrics."""

    method: str
    sigma2_by_dev: dict[int, float]
    total_ibnr: float
    total_se_naive: float
    by_occurrence_year: list[MackAYDetail]
    parameters: dict[str, Any]


def _build_cumulative_map(ibnr_result: IBNRResult) -> dict[tuple[int, int], float]:
    return {
        (c.occurrence_year, c.development_year): c.cumulative_amount
        for c in ibnr_result.triangle_cells
        if c.is_known and not c.is_projected
    }


def _estimate_sigma2(
    cumulative: dict[tuple[int, int], float],
    factors: dict[int, float],
    occurrence_years: list[int],
    dev_max: int,
) -> dict[int, float]:
    """Estimate Mack process-variance parameter σ²[j] for each dev transition j."""

    sigma2: dict[int, float] = {}
    for j in range(1, dev_max + 1):
        ays = [
            ay for ay in occurrence_years
            if (ay, j) in cumulative and (ay, j - 1) in cumulative
        ]
        if len(ays) <= 1:
            sigma2[j] = float("nan")
            LOGGER.debug("σ²[%s]: insufficient AYs (%s), set to nan.", j, len(ays))
            continue
        ays = [ay for ay in ays if float(cumulative[(ay, j - 1)]) != 0.0]
        if len(ays) <= 1:
            sigma2[j] = float("nan")
            LOGGER.debug("σ²[%s]: insufficient non-zero AYs after filtering, set to nan.", j)
            continue
        vals = [
            float(cumulative[(ay, j - 1)]) * (float(cumulative[(ay, j)]) / float(cumulative[(ay, j - 1)]) - factors[j]) ** 2
            for ay in ays
        ]
        sigma2[j] = sum(vals) / (len(ays) - 1)
        LOGGER.debug("σ²[%s] = %.6f  (n=%s)", j, sigma2[j], len(ays))
    return sigma2


def _mack_mse(
    occurrence_year: int,
    closing_year: int,
    dev_max: int,
    cumulative: dict[tuple[int, int], float],
    factors: dict[int, float],
    sigma2: dict[int, float],
) -> float:
    """Approximate Mack process-variance MSE for one AY's reserve."""

    d_obs = closing_year - occurrence_year
    if d_obs >= dev_max:
        return 0.0

    c_obs = cumulative.get((occurrence_year, d_obs))
    if c_obs is None or c_obs == 0.0:
        return 0.0

    mse = 0.0
    for j in range(d_obs + 1, dev_max + 1):
        if math.isnan(sigma2.get(j, float("nan"))):
            continue
        prod_tail = 1.0
        for k in range(j, dev_max + 1):
            prod_tail *= factors[k]
        mse += (prod_tail ** 2) * sigma2[j] / c_obs

    return float((c_obs ** 2) * mse)


def calculate_mack(ibnr_result: IBNRResult) -> MackResult:
    """Compute Mack Chain Ladder uncertainty metrics from an existing IBNRResult.

    Point-estimate IBNR is identical to CL. Adds σ², MSE, SE, CV per AY and
    a naïve portfolio-level SE (root-sum-of-squares, no correlation correction).
    """

    LOGGER.info("Starting Mack Chain Ladder uncertainty estimation.")

    cumulative = _build_cumulative_map(ibnr_result)
    dev_max = ibnr_result.max_development_year
    closing_year = ibnr_result.closing_year
    occurrence_years = sorted({c.occurrence_year for c in ibnr_result.triangle_cells if c.is_known})
    factors: dict[int, float] = {f.development_year: f.factor for f in ibnr_result.development_factors}

    sigma2 = _estimate_sigma2(cumulative, factors, occurrence_years, dev_max)

    details: list[MackAYDetail] = []
    sum_se2 = 0.0
    for occ_audit in ibnr_result.by_occurrence_year:
        ay = occ_audit.occurrence_year
        mse = _mack_mse(ay, closing_year, dev_max, cumulative, factors, sigma2)
        se = math.sqrt(mse) if mse > 0 else 0.0
        ibnr_cl = occ_audit.reserve
        cv = (se / ibnr_cl) if ibnr_cl != 0 else float("nan")
        d_obs = closing_year - ay
        s2 = sigma2.get(max(d_obs + 1, 1), float("nan"))
        details.append(MackAYDetail(
            occurrence_year=ay,
            ibnr_chain_ladder=ibnr_cl,
            sigma2=s2,
            mse=mse,
            se=se,
            cv=cv,
        ))
        sum_se2 += se ** 2
        LOGGER.debug("Mack AY %s: mse=%.2f se=%.2f cv=%.4f", ay, mse, se, cv)

    total_se_naive = math.sqrt(sum_se2)
    LOGGER.info(
        "Mack done: total_ibnr=%.2f total_se_naive=%.2f",
        ibnr_result.total_ibnr, total_se_naive,
    )

    return MackResult(
        method="mack_chain_ladder",
        sigma2_by_dev=sigma2,
        total_ibnr=ibnr_result.total_ibnr,
        total_se_naive=total_se_naive,
        by_occurrence_year=details,
        parameters={
            "closing_year": closing_year,
            "dev_max": dev_max,
            "occurrence_years": occurrence_years,
        },
    )
