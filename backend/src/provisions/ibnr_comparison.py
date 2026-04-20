"""Aggregator comparing all IBNR methods into a single MethodComparisonSummary."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from src.provisions.ibnr import IBNRResult
from src.provisions.ibnr_benktander import BenktanderResult
from src.provisions.ibnr_bf import BFResult
from src.provisions.ibnr_bootstrap import BootstrapResult
from src.provisions.ibnr_mack import MackResult

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class MethodComparisonRow:
    """Summary row for one IBNR method."""

    method: str
    total_ibnr: float
    difference_vs_chain_ladder: float
    pct_difference_vs_chain_ladder: float
    se_or_p95: float | None


@dataclass(frozen=True)
class MethodComparisonSummary:
    """All IBNR methods compared side by side."""

    chain_ladder_total: float
    mack: MackResult
    bf: BFResult
    benktander: BenktanderResult
    bootstrap: BootstrapResult
    comparison_rows: list[MethodComparisonRow]
    method_range: float
    parameters: dict[str, Any]


def build_method_comparison(
    ibnr_result: IBNRResult,
    mack: MackResult,
    bf: BFResult,
    benktander: BenktanderResult,
    bootstrap: BootstrapResult,
) -> MethodComparisonSummary:
    """Assemble a side-by-side comparison of all five IBNR method estimates."""

    cl_total = ibnr_result.total_ibnr

    def _pct(val: float) -> float:
        return (val - cl_total) / cl_total * 100.0 if cl_total != 0 else 0.0

    rows: list[MethodComparisonRow] = [
        MethodComparisonRow(
            method="chain_ladder",
            total_ibnr=cl_total,
            difference_vs_chain_ladder=0.0,
            pct_difference_vs_chain_ladder=0.0,
            se_or_p95=None,
        ),
        MethodComparisonRow(
            method="mack_chain_ladder",
            total_ibnr=mack.total_ibnr,
            difference_vs_chain_ladder=mack.total_ibnr - cl_total,
            pct_difference_vs_chain_ladder=_pct(mack.total_ibnr),
            se_or_p95=mack.total_se_naive,
        ),
        MethodComparisonRow(
            method="bornhuetter_ferguson",
            total_ibnr=bf.total_ibnr_bf,
            difference_vs_chain_ladder=bf.difference_vs_chain_ladder,
            pct_difference_vs_chain_ladder=_pct(bf.total_ibnr_bf),
            se_or_p95=None,
        ),
        MethodComparisonRow(
            method="benktander_k2",
            total_ibnr=benktander.total_ibnr_benktander,
            difference_vs_chain_ladder=benktander.difference_vs_chain_ladder,
            pct_difference_vs_chain_ladder=_pct(benktander.total_ibnr_benktander),
            se_or_p95=None,
        ),
        MethodComparisonRow(
            method="bootstrap_odp",
            total_ibnr=bootstrap.mean_total_ibnr,
            difference_vs_chain_ladder=bootstrap.mean_total_ibnr - cl_total,
            pct_difference_vs_chain_ladder=_pct(bootstrap.mean_total_ibnr),
            se_or_p95=bootstrap.percentiles.get(95),
        ),
    ]

    rows_sorted = sorted(rows, key=lambda r: r.total_ibnr)
    method_range = rows_sorted[-1].total_ibnr - rows_sorted[0].total_ibnr

    LOGGER.info(
        "Method comparison built: CL=%.2f BF=%.2f Bk=%.2f Boot_mean=%.2f range=%.2f",
        cl_total, bf.total_ibnr_bf, benktander.total_ibnr_benktander,
        bootstrap.mean_total_ibnr, method_range,
    )

    return MethodComparisonSummary(
        chain_ladder_total=cl_total,
        mack=mack,
        bf=bf,
        benktander=benktander,
        bootstrap=bootstrap,
        comparison_rows=rows_sorted,
        method_range=method_range,
        parameters={
            "closing_year": ibnr_result.closing_year,
            "method_count": len(rows),
        },
    )
