"""Benktander iterative IBNR method layered on BFResult."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from src.config import load_yaml_config
from src.provisions.ibnr import IBNRResult
from src.provisions.ibnr_bf import BFResult

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class BenktanderAYDetail:
    """Benktander reserve detail for one accident year."""

    occurrence_year: int
    reported_diagonal: float
    q_percent_reported: float
    prior_ultimate: float
    ultimate_bk_k1: float
    ultimate_bk_k2: float
    ibnr_bk_k2: float
    ibnr_chain_ladder: float


@dataclass(frozen=True)
class BenktanderResult:
    """Benktander IBNR result."""

    method: str
    k: int
    total_ibnr_benktander: float
    total_ibnr_chain_ladder: float
    difference_vs_chain_ladder: float
    by_occurrence_year: list[BenktanderAYDetail]
    parameters: dict[str, Any]


def _load_benktander_config() -> dict[str, Any]:
    config = load_yaml_config("src/config/legislative.yaml")
    return config["ibnr"]["benktander"]


def calculate_benktander(
    ibnr_result: IBNRResult,
    bf_result: BFResult,
    config: dict[str, Any] | None = None,
) -> BenktanderResult:
    """Compute Benktander iterative reserves using BF q and prior from bf_result.

    Each iteration: U_{n} = G + (1 - q) * U_{n-1}, starting from prior_ultimate.
    Default k=2 iterations (configurable via legislative.yaml).
    """

    LOGGER.info("Starting Benktander calculation.")
    if config is None:
        config = _load_benktander_config()

    k = int(config.get("k", 2))
    cl_ibnr_by_ay: dict[int, float] = {a.occurrence_year: a.reserve for a in ibnr_result.by_occurrence_year}

    details: list[BenktanderAYDetail] = []
    for bf_detail in bf_result.by_occurrence_year:
        ay = bf_detail.occurrence_year
        g = bf_detail.reported_diagonal
        q = bf_detail.q_percent_reported
        u = bf_detail.prior_ultimate

        u1 = g + (1.0 - q) * u
        uk = u1
        for _ in range(1, k):
            uk = g + (1.0 - q) * uk

        ibnr_bk = uk - g
        details.append(BenktanderAYDetail(
            occurrence_year=ay,
            reported_diagonal=g,
            q_percent_reported=q,
            prior_ultimate=bf_detail.prior_ultimate,
            ultimate_bk_k1=u1,
            ultimate_bk_k2=uk,
            ibnr_bk_k2=ibnr_bk,
            ibnr_chain_ladder=cl_ibnr_by_ay.get(ay, 0.0),
        ))
        LOGGER.debug("Benktander AY %s k=%s: ibnr_bk=%.2f ibnr_cl=%.2f", ay, k, ibnr_bk, cl_ibnr_by_ay.get(ay, 0.0))

    total_bk = sum(d.ibnr_bk_k2 for d in details)
    total_cl = ibnr_result.total_ibnr
    LOGGER.info("Benktander done: total=%.2f cl=%.2f diff=%.2f", total_bk, total_cl, total_bk - total_cl)

    return BenktanderResult(
        method="benktander",
        k=k,
        total_ibnr_benktander=total_bk,
        total_ibnr_chain_ladder=total_cl,
        difference_vs_chain_ladder=total_bk - total_cl,
        by_occurrence_year=details,
        parameters={"k": k, "closing_year": ibnr_result.closing_year},
    )
