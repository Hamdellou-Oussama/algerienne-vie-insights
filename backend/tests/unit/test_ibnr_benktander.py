"""Unit tests for the Benktander iterative IBNR method."""

from __future__ import annotations

import unittest

from src.provisions.ibnr import (
    IBNRDevelopmentFactor,
    IBNROccurrenceYearAudit,
    IBNRResult,
    IBNRTriangleCell,
)
from src.provisions.ibnr_bf import calculate_bf
from src.provisions.ibnr_benktander import calculate_benktander


def _cell(occ, dev, incr, cum, known=True):
    return IBNRTriangleCell(
        occurrence_year=occ, development_year=dev,
        incremental_amount=incr, cumulative_amount=cum,
        is_known=known, is_projected=not known, source_claim_count=1 if known else 0,
    )


def _factor(dev, num, den):
    return IBNRDevelopmentFactor(
        development_year=dev, numerator=num, denominator=den,
        factor=num / den, contributing_occurrence_years=(2021,),
    )


def _audit(occ, diag, ult, closing_year=2023):
    return IBNROccurrenceYearAudit(
        occurrence_year=occ, diagonal_cumulative=diag,
        ultimate=ult, reserve=ult - diag,
        last_known_development_year=closing_year - occ,
    )


def _make_result():
    cells = [
        _cell(2021, 0, 100, 100), _cell(2021, 1, 50, 150), _cell(2021, 2, 30, 180),
        _cell(2022, 0, 80, 80), _cell(2022, 1, 40, 120),
        _cell(2023, 0, 60, 60),
        _cell(2022, 2, 24, 144, known=False),
        _cell(2023, 1, 45, 105, known=False),
        _cell(2023, 2, 21, 126, known=False),
    ]
    factors = [_factor(1, 270, 180), _factor(2, 324, 270)]
    occ = [_audit(2021, 180, 180), _audit(2022, 120, 144), _audit(2023, 60, 126)]
    total = sum(a.reserve for a in occ)
    return IBNRResult(
        closing_year=2023, occurrence_year_window=(2021, 2023), max_development_year=2,
        method="chain_ladder_volume_weighted", total_ibnr=total,
        triangle_cells=cells, development_factors=factors, by_occurrence_year=occ,
        parameters={}, excluded_rows=[],
    )


class BenktanderTests(unittest.TestCase):

    def _bf_and_bk(self, k=2):
        result = _make_result()
        cfg_bf = {"prior_basis": "mature_ay_ratio", "mature_ay": 2021, "enabled": True}
        bf = calculate_bf(result, cfg_bf)
        cfg_bk = {"k": k, "enabled": True}
        bk = calculate_benktander(result, bf, cfg_bk)
        return result, bf, bk

    def test_benktander_k1_equals_bf(self):
        result, bf, _ = self._bf_and_bk(k=2)
        _, _, bk1 = self._bf_and_bk(k=1)
        for d_bf, d_bk in zip(bf.by_occurrence_year, bk1.by_occurrence_year):
            self.assertAlmostEqual(d_bk.ultimate_bk_k2, d_bf.ultimate_bf, places=6)

    def test_benktander_k2_between_bf_and_cl(self):
        result, bf, bk = self._bf_and_bk(k=2)
        for d_bk in bk.by_occurrence_year:
            d_bf = next(d for d in bf.by_occurrence_year if d.occurrence_year == d_bk.occurrence_year)
            ao = next(a for a in result.by_occurrence_year if a.occurrence_year == d_bk.occurrence_year)
            # ibnr_bk should be between ibnr_bf and ibnr_cl (inclusive)
            self.assertGreaterEqual(d_bk.ibnr_bk_k2, d_bf.ibnr_bf - 1e-9)
            self.assertLessEqual(d_bk.ibnr_bk_k2, ao.reserve + 1e-9)

    def test_benktander_fully_developed_zero(self):
        _, _, bk = self._bf_and_bk(k=2)
        detail_2021 = next(d for d in bk.by_occurrence_year if d.occurrence_year == 2021)
        self.assertAlmostEqual(detail_2021.ibnr_bk_k2, 0.0, places=6)

    def test_total_benktander_is_sum_of_ays(self):
        _, _, bk = self._bf_and_bk(k=2)
        self.assertAlmostEqual(bk.total_ibnr_benktander, sum(d.ibnr_bk_k2 for d in bk.by_occurrence_year), places=6)


if __name__ == "__main__":
    unittest.main()
