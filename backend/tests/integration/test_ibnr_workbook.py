"""Integration tests for IBNR Chain Ladder against the real workbook."""

from __future__ import annotations

import unittest

from src.preprocessing.ibnr_loader import IBNRLoader
from src.provisions.ibnr import calculate_ibnr


class IBNRWorkbookIntegrationTests(unittest.TestCase):
    """Verify Chain Ladder output against cached workbook values in calcule IBNR."""

    TOLERANCE = 1e-6

    @classmethod
    def setUpClass(cls) -> None:
        """Load and compute IBNR once for all assertions."""
        rows = IBNRLoader().load().rows
        cls.result = calculate_ibnr(rows)
        cls.occ_map = {r.occurrence_year: r for r in cls.result.by_occurrence_year}
        cls.factor_map = {f.development_year: f for f in cls.result.development_factors}

    def test_total_ibnr_matches_workbook(self) -> None:
        """Total IBNR must match calcule IBNR!I37 cached value."""
        self.assertAlmostEqual(
            self.result.total_ibnr,
            135_205_244.46977875,
            places=6,
        )

    def test_development_factor_f1(self) -> None:
        """F[1] must match calcule IBNR!C29 cached value 1.3348571029010912."""
        self.assertAlmostEqual(self.factor_map[1].factor, 1.3348571029010912, places=10)

    def test_development_factor_f2(self) -> None:
        """F[2] must match calcule IBNR!D29 cached value 1.0203875341571986."""
        self.assertAlmostEqual(self.factor_map[2].factor, 1.0203875341571986, places=10)

    def test_development_factor_f3(self) -> None:
        """F[3] must match calcule IBNR!E29 cached value 1.0674101418275637."""
        self.assertAlmostEqual(self.factor_map[3].factor, 1.0674101418275637, places=10)

    def test_reserve_2022_is_zero(self) -> None:
        """Occ year 2022 is fully developed — reserve must be 0 (calcule IBNR!I33=0)."""
        self.assertAlmostEqual(self.occ_map[2022].reserve, 0.0, places=6)

    def test_reserve_2023(self) -> None:
        """Occ year 2023 reserve must match calcule IBNR!I34."""
        self.assertAlmostEqual(self.occ_map[2023].reserve, 11_859_432.866376191, places=6)

    def test_reserve_2024(self) -> None:
        """Occ year 2024 reserve must match calcule IBNR!I35."""
        self.assertAlmostEqual(self.occ_map[2024].reserve, 30_506_322.710742295, places=6)

    def test_reserve_2025(self) -> None:
        """Occ year 2025 reserve must match calcule IBNR!I36."""
        self.assertAlmostEqual(self.occ_map[2025].reserve, 92_839_488.89266026, places=6)

    def test_diagonal_2022(self) -> None:
        """Occ 2022 diagonal must match calcule IBNR!G33."""
        self.assertAlmostEqual(self.occ_map[2022].diagonal_cumulative, 115_866_962.38348004, places=6)

    def test_diagonal_2023(self) -> None:
        """Occ 2023 diagonal must match calcule IBNR!G34."""
        self.assertAlmostEqual(self.occ_map[2023].diagonal_cumulative, 175_929_504.7429632, places=6)

    def test_diagonal_2024(self) -> None:
        """Occ 2024 diagonal must match calcule IBNR!G35."""
        self.assertAlmostEqual(self.occ_map[2024].diagonal_cumulative, 342_106_511.42809576, places=6)

    def test_diagonal_2025(self) -> None:
        """Occ 2025 diagonal must match calcule IBNR!G36."""
        self.assertAlmostEqual(self.occ_map[2025].diagonal_cumulative, 204_542_282.77804482, places=6)

    def test_ultimate_2022(self) -> None:
        """Occ 2022 ultimate must match calcule IBNR!H33."""
        self.assertAlmostEqual(self.occ_map[2022].ultimate, 115_866_962.38348004, places=6)

    def test_ultimate_2023(self) -> None:
        """Occ 2023 ultimate must match calcule IBNR!H34."""
        self.assertAlmostEqual(self.occ_map[2023].ultimate, 187_788_937.6093394, places=6)

    def test_ultimate_2024(self) -> None:
        """Occ 2024 ultimate must match calcule IBNR!H35."""
        self.assertAlmostEqual(self.occ_map[2024].ultimate, 372_612_834.13883805, places=6)

    def test_ultimate_2025(self) -> None:
        """Occ 2025 ultimate must match calcule IBNR!H36."""
        self.assertAlmostEqual(self.occ_map[2025].ultimate, 297_381_771.6707051, places=6)

    def test_result_has_four_occurrence_years(self) -> None:
        """Triangle must cover exactly the 4 occurrence years 2022..2025."""
        self.assertEqual(sorted(self.occ_map.keys()), [2022, 2023, 2024, 2025])

    def test_result_has_three_development_factors(self) -> None:
        """Chain Ladder must produce exactly 3 factors for a 4x4 triangle."""
        self.assertEqual(sorted(self.factor_map.keys()), [1, 2, 3])


class IBNRHomogeneousModeTests(unittest.TestCase):
    """Verify the homogeneous (per-product) segmentation path on the real dataset."""

    @classmethod
    def setUpClass(cls) -> None:
        rows = IBNRLoader().load().rows
        cls.results = calculate_ibnr(rows, segment_by="product")

    def test_returns_dict_keyed_by_normalized_product(self) -> None:
        """Homogeneous mode must return a dict; keys are normalized product labels."""
        self.assertIsInstance(self.results, dict)
        self.assertEqual(sorted(self.results.keys()), ["ac-elite", "conso", "immo", "warda"])

    def test_each_segment_has_positive_ibnr(self) -> None:
        """IMMO and CONSO must have positive reserves (they have the most claims)."""
        self.assertGreater(self.results["immo"].total_ibnr, 0.0)
        self.assertGreater(self.results["conso"].total_ibnr, 0.0)

    def test_sum_of_segments_differs_from_mixed_total(self) -> None:
        """Per-product totals should not equal the mixed total — different factors per segment."""
        rows = IBNRLoader().load().rows
        mixed = calculate_ibnr(rows)
        total_homogeneous = sum(r.total_ibnr for r in self.results.values())
        # The two methods will produce different totals due to different development factors
        self.assertNotAlmostEqual(total_homogeneous, mixed.total_ibnr, places=0)

    def test_each_segment_is_independent_ibnr_result(self) -> None:
        """Each segment must be a self-contained IBNRResult with consistent structure."""
        from src.provisions.ibnr import IBNRResult
        for product, result in self.results.items():
            self.assertIsInstance(result, IBNRResult)
            self.assertEqual(result.closing_year, 2025)
            self.assertEqual(result.method, "chain_ladder_volume_weighted")
            self.assertGreaterEqual(len(result.by_occurrence_year), 1, f"{product} has no occurrence years")


if __name__ == "__main__":
    unittest.main()
