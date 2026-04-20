"""Unit tests for the Mack Chain Ladder uncertainty layer."""

from __future__ import annotations

import math
import unittest

from src.provisions.ibnr import (
    IBNRDevelopmentFactor,
    IBNROccurrenceYearAudit,
    IBNRResult,
    IBNRTriangleCell,
)
from src.provisions.ibnr_mack import MackResult, calculate_mack


def _make_ibnr_result(cells, factors, occ_audits, closing_year=2023, window=(2021, 2023)) -> IBNRResult:
    return IBNRResult(
        closing_year=closing_year,
        occurrence_year_window=window,
        max_development_year=closing_year - window[0],
        method="chain_ladder_volume_weighted",
        total_ibnr=sum(a.reserve for a in occ_audits),
        triangle_cells=cells,
        development_factors=factors,
        by_occurrence_year=occ_audits,
        parameters={},
        excluded_rows=[],
    )


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


class MackSigma2Tests(unittest.TestCase):

    def _simple_result(self):
        # 3x3 triangle closing_year=2023, occ 2021..2023.
        # AY2021: f1=1.5, AY2022: f1=1.0 — asymmetric so σ²[1] > 0.
        # volume-weighted f1=(150+100)/(100+100)=1.25, f2=180/150=1.2 (AY2021 only).
        cells = [
            _cell(2021, 0, 100, 100), _cell(2021, 1, 50, 150), _cell(2021, 2, 30, 180),
            _cell(2022, 0, 100, 100), _cell(2022, 1, 0, 100),
            _cell(2023, 0, 60, 60),
            # projected: C[2022][2]=120, C[2023][1]=75, C[2023][2]=90
            _cell(2022, 2, 20, 120, known=False),
            _cell(2023, 1, 15, 75, known=False),
            _cell(2023, 2, 15, 90, known=False),
        ]
        factors = [_factor(1, 150 + 100, 100 + 100), _factor(2, 180, 150)]
        occ = [
            _audit(2021, 180, 180),
            _audit(2022, 100, 120),
            _audit(2023, 60, 90),
        ]
        return _make_ibnr_result(cells, factors, occ)

    def test_sigma2_two_points_dev1(self):
        result = self._simple_result()
        mack = calculate_mack(result)
        # dev 1 has 2 AYs with known C[·,1]: AY2021 and AY2022; len=2 so σ²[1] is computed
        self.assertIn(1, mack.sigma2_by_dev)
        self.assertTrue(math.isfinite(mack.sigma2_by_dev[1]))

    def test_mack_mse_fully_developed_ay(self):
        result = self._simple_result()
        mack = calculate_mack(result)
        # AY 2021 is fully developed (d_obs=2 == dev_max=2) → reserve=0, MSE=0
        detail_2021 = next(d for d in mack.by_occurrence_year if d.occurrence_year == 2021)
        self.assertAlmostEqual(detail_2021.mse, 0.0)
        self.assertAlmostEqual(detail_2021.se, 0.0)

    def test_mack_mse_positive_for_immature_ay(self):
        result = self._simple_result()
        mack = calculate_mack(result)
        # AY 2023 is immature; reserve > 0 so MSE should be > 0
        detail_2023 = next(d for d in mack.by_occurrence_year if d.occurrence_year == 2023)
        self.assertGreater(detail_2023.se, 0.0)

    def test_total_se_is_root_sum_squares(self):
        result = self._simple_result()
        mack = calculate_mack(result)
        expected_se2 = sum(d.se ** 2 for d in mack.by_occurrence_year)
        self.assertAlmostEqual(mack.total_se_naive ** 2, expected_se2, places=6)

    def test_mack_total_ibnr_equals_cl(self):
        result = self._simple_result()
        mack = calculate_mack(result)
        self.assertAlmostEqual(mack.total_ibnr, result.total_ibnr, places=6)


if __name__ == "__main__":
    unittest.main()
