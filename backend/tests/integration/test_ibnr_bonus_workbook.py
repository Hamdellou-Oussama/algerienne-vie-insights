"""Integration tests for bonus IBNR methods against the real base ADE workbook."""

from __future__ import annotations

import unittest

from src.preprocessing.ibnr_loader import IBNRLoader
from src.provisions.ibnr import calculate_ibnr
from src.provisions.ibnr_benktander import calculate_benktander
from src.provisions.ibnr_bf import calculate_bf
from src.provisions.ibnr_bootstrap import calculate_bootstrap
from src.provisions.ibnr_comparison import build_method_comparison
from src.provisions.ibnr_mack import calculate_mack

CL_TOTAL = 135_205_244.46977875


def _load():
    rows = IBNRLoader().load().rows
    return calculate_ibnr(rows)


class MackWorkbookTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.ibnr = _load()
        cls.mack = calculate_mack(cls.ibnr)

    def test_mack_total_equals_cl(self):
        self.assertAlmostEqual(self.mack.total_ibnr, CL_TOTAL, delta=0.01)

    def test_mack_se_is_positive(self):
        self.assertGreater(self.mack.total_se_naive, 0.0)

    def test_mack_fully_developed_ay_has_zero_se(self):
        detail_2022 = next(d for d in self.mack.by_occurrence_year if d.occurrence_year == 2022)
        self.assertAlmostEqual(detail_2022.se, 0.0, places=2)


class BFWorkbookTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.ibnr = _load()
        cfg = {"prior_basis": "mature_ay_ratio", "mature_ay": 2022, "enabled": True}
        cls.bf = calculate_bf(cls.ibnr, cfg)

    def test_bf_total_in_expected_range(self):
        self.assertGreater(self.bf.total_ibnr_bf, 120_000_000)
        self.assertLess(self.bf.total_ibnr_bf, 135_000_000)

    def test_bf_total_less_than_cl(self):
        self.assertLess(self.bf.total_ibnr_bf, CL_TOTAL)

    def test_bf_all_ay_ibnr_nonnegative(self):
        for d in self.bf.by_occurrence_year:
            self.assertGreaterEqual(d.ibnr_bf, -1e-6)


class BenktanderWorkbookTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.ibnr = _load()
        bf_cfg = {"prior_basis": "mature_ay_ratio", "mature_ay": 2022, "enabled": True}
        cls.bf = calculate_bf(cls.ibnr, bf_cfg)
        cls.bk = calculate_benktander(cls.ibnr, cls.bf, {"k": 2, "enabled": True})

    def test_benktander_between_bf_and_cl(self):
        self.assertGreater(self.bk.total_ibnr_benktander, self.bf.total_ibnr_bf - 1e-6)
        self.assertLess(self.bk.total_ibnr_benktander, CL_TOTAL + 1e-6)

    def test_benktander_total_is_sum_of_ays(self):
        total = sum(d.ibnr_bk_k2 for d in self.bk.by_occurrence_year)
        self.assertAlmostEqual(self.bk.total_ibnr_benktander, total, places=4)


class BootstrapWorkbookTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.ibnr = _load()
        cls.boot = calculate_bootstrap(cls.ibnr, {"n_sim": 1000, "random_seed": 42, "percentiles": [50, 75, 90, 95, 99]})

    def test_bootstrap_mean_approx_cl(self):
        rel_err = abs(self.boot.mean_total_ibnr - CL_TOTAL) / CL_TOTAL
        self.assertLess(rel_err, 0.05)

    def test_bootstrap_p95_above_mean(self):
        self.assertGreater(self.boot.percentiles[95], self.boot.mean_total_ibnr)

    def test_bootstrap_percentile_ordering(self):
        p = self.boot.percentiles
        self.assertLessEqual(p[50], p[75])
        self.assertLessEqual(p[75], p[90])
        self.assertLessEqual(p[90], p[95])
        self.assertLessEqual(p[95], p[99])


class ComparisonWorkbookTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.ibnr = _load()
        mack = calculate_mack(cls.ibnr)
        bf_cfg = {"prior_basis": "mature_ay_ratio", "mature_ay": 2022, "enabled": True}
        bf = calculate_bf(cls.ibnr, bf_cfg)
        bk = calculate_benktander(cls.ibnr, bf, {"k": 2, "enabled": True})
        boot = calculate_bootstrap(cls.ibnr, {"n_sim": 1000, "random_seed": 42, "percentiles": [50, 75, 90, 95, 99]})
        cls.comparison = build_method_comparison(cls.ibnr, mack, bf, bk, boot)

    def test_comparison_has_five_rows(self):
        self.assertEqual(len(self.comparison.comparison_rows), 5)

    def test_comparison_rows_sorted_by_total(self):
        totals = [r.total_ibnr for r in self.comparison.comparison_rows]
        self.assertEqual(totals, sorted(totals))

    def test_method_range_positive(self):
        self.assertGreater(self.comparison.method_range, 0.0)


if __name__ == "__main__":
    unittest.main()
