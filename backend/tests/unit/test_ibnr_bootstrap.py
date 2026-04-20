"""Unit tests for Bootstrap ODP IBNR distribution estimation."""

from __future__ import annotations

import unittest

from src.provisions.ibnr import (
    IBNRDevelopmentFactor,
    IBNROccurrenceYearAudit,
    IBNRResult,
    IBNRTriangleCell,
)
from src.provisions.ibnr_bootstrap import calculate_bootstrap


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
    """Consistent triangle: F[1]=1.25, F[2]=1.2.

    AY2021: all dev years observed (LDF1=1.5, LDF2=1.2).
    AY2022: dev0..1 observed, dev2 projected (100→120).
    AY2023: dev0 observed, dev1..2 projected (60→75→90).
    All known-cell incrementals match their cumulative differences exactly so
    Pearson residuals are all zero and bootstrap reproduces CL total exactly.
    """
    cells = [
        _cell(2021, 0, 100, 100), _cell(2021, 1, 50, 150), _cell(2021, 2, 30, 180),
        _cell(2022, 0, 100, 100), _cell(2022, 1, 0, 100),
        _cell(2023, 0, 60, 60),
        _cell(2022, 2, 20, 120, known=False),
        _cell(2023, 1, 15, 75, known=False),
        _cell(2023, 2, 15, 90, known=False),
    ]
    factors = [_factor(1, 250, 200), _factor(2, 180, 150)]
    occ = [_audit(2021, 180, 180), _audit(2022, 100, 120), _audit(2023, 60, 90)]
    total = sum(a.reserve for a in occ)
    return IBNRResult(
        closing_year=2023, occurrence_year_window=(2021, 2023), max_development_year=2,
        method="chain_ladder_volume_weighted", total_ibnr=total,
        triangle_cells=cells, development_factors=factors, by_occurrence_year=occ,
        parameters={}, excluded_rows=[],
    )


class BootstrapTests(unittest.TestCase):

    def _cfg(self, seed=42, n_sim=200):
        return {"n_sim": n_sim, "random_seed": seed, "percentiles": [50, 75, 90, 95, 99]}

    def test_bootstrap_reproducible(self):
        result = _make_result()
        b1 = calculate_bootstrap(result, self._cfg(seed=7))
        b2 = calculate_bootstrap(result, self._cfg(seed=7))
        self.assertAlmostEqual(b1.mean_total_ibnr, b2.mean_total_ibnr, places=10)

    def test_bootstrap_mean_equals_cl_when_residuals_zero(self):
        # With all Pearson residuals=0, bootstrap exactly reproduces CL total every sim.
        result = _make_result()
        boot = calculate_bootstrap(result, {"n_sim": 100, "random_seed": 42, "percentiles": [95]})
        self.assertAlmostEqual(boot.mean_total_ibnr, result.total_ibnr, places=4)

    def test_bootstrap_std_zero_when_residuals_zero(self):
        result = _make_result()
        boot = calculate_bootstrap(result, {"n_sim": 50, "random_seed": 42, "percentiles": [95]})
        self.assertAlmostEqual(boot.std_total_ibnr, 0.0, places=4)

    def test_bootstrap_percentile_ordering(self):
        result = _make_result()
        boot = calculate_bootstrap(result, self._cfg())
        pct = boot.percentiles
        self.assertLessEqual(pct[50], pct[75])
        self.assertLessEqual(pct[75], pct[90])
        self.assertLessEqual(pct[90], pct[95])
        self.assertLessEqual(pct[95], pct[99])

    def test_bootstrap_simulated_totals_length(self):
        result = _make_result()
        boot = calculate_bootstrap(result, self._cfg(n_sim=150))
        self.assertEqual(len(boot.simulated_totals), 150)


if __name__ == "__main__":
    unittest.main()
