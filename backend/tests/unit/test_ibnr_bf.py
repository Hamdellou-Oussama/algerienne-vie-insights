"""Unit tests for Bornhuetter-Ferguson IBNR method."""

from __future__ import annotations

import unittest

from src.provisions.ibnr import (
    IBNRDevelopmentFactor,
    IBNROccurrenceYearAudit,
    IBNRResult,
    IBNRTriangleCell,
)
from src.provisions.ibnr_bf import calculate_bf


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
    """3x3 triangle: occ 2021..2023, closing 2023, dev_max=2."""
    cells = [
        _cell(2021, 0, 100, 100), _cell(2021, 1, 50, 150), _cell(2021, 2, 30, 180),
        _cell(2022, 0, 80, 80), _cell(2022, 1, 40, 120),
        _cell(2023, 0, 60, 60),
        _cell(2022, 2, 24, 144, known=False),
        _cell(2023, 1, 45, 105, known=False),
        _cell(2023, 2, 21, 126, known=False),
    ]
    # F[1] = (150+120)/(100+80) = 1.5; F[2] = (180+144)/(150+120) = 1.2
    factors = [_factor(1, 270, 180), _factor(2, 324, 270)]
    occ = [_audit(2021, 180, 180), _audit(2022, 120, 144), _audit(2023, 60, 126)]
    total = sum(a.reserve for a in occ)
    return IBNRResult(
        closing_year=2023,
        occurrence_year_window=(2021, 2023),
        max_development_year=2,
        method="chain_ladder_volume_weighted",
        total_ibnr=total,
        triangle_cells=cells,
        development_factors=factors,
        by_occurrence_year=occ,
        parameters={},
        excluded_rows=[],
    )


class BFCalculationTests(unittest.TestCase):

    def test_fully_developed_ay_has_zero_ibnr(self):
        result = _make_result()
        cfg = {"prior_basis": "mature_ay_ratio", "mature_ay": 2021, "enabled": True}
        bf = calculate_bf(result, cfg)
        detail_2021 = next(d for d in bf.by_occurrence_year if d.occurrence_year == 2021)
        # AY 2021 is fully developed (d_obs=2 == dev_max=2) → q=1 → ibnr_bf=0
        self.assertAlmostEqual(detail_2021.ibnr_bf, 0.0, places=6)

    def test_bf_ibnr_equals_one_minus_q_times_prior(self):
        result = _make_result()
        cfg = {"prior_basis": "mature_ay_ratio", "mature_ay": 2021, "enabled": True}
        bf = calculate_bf(result, cfg)
        for detail in bf.by_occurrence_year:
            expected = (1.0 - detail.q_percent_reported) * detail.prior_ultimate
            self.assertAlmostEqual(detail.ibnr_bf, expected, places=6)

    def test_bf_prior_mature_ratio_uses_config_mature_ay(self):
        result = _make_result()
        # mature_ay=2021: ratio = ult(2021)/dev0(2021) = 180/100 = 1.8
        cfg = {"prior_basis": "mature_ay_ratio", "mature_ay": 2021, "enabled": True}
        bf = calculate_bf(result, cfg)
        detail_2023 = next(d for d in bf.by_occurrence_year if d.occurrence_year == 2023)
        # prior = dev0(2023) * 1.8 = 60 * 1.8 = 108
        self.assertAlmostEqual(detail_2023.prior_ultimate, 60.0 * (180.0 / 100.0), places=6)

    def test_bf_fixed_elr_raises_without_exposure(self):
        result = _make_result()
        cfg = {"prior_basis": "fixed_elr", "prior_elr": 0.65, "enabled": True}
        with self.assertRaises(ValueError):
            calculate_bf(result, cfg)

    def test_total_bf_is_sum_of_ay_ibnrs(self):
        result = _make_result()
        cfg = {"prior_basis": "mature_ay_ratio", "mature_ay": 2021, "enabled": True}
        bf = calculate_bf(result, cfg)
        self.assertAlmostEqual(bf.total_ibnr_bf, sum(d.ibnr_bf for d in bf.by_occurrence_year), places=6)


if __name__ == "__main__":
    unittest.main()
