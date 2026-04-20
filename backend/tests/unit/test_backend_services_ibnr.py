"""Unit tests for backend IBNR service serialization helpers."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from src.backend.services import _attach_ibnr_method_comparison
from src.provisions.ibnr import IBNRResult
from src.provisions.ibnr_comparison import MethodComparisonRow, MethodComparisonSummary


class BackendServicesIbnrTests(unittest.TestCase):
    """Validate IBNR-specific payload enrichment behavior."""

    @staticmethod
    def _minimal_ibnr_result() -> IBNRResult:
        return IBNRResult(
            closing_year=2025,
            occurrence_year_window=(2022, 2025),
            max_development_year=3,
            method="chain_ladder_volume_weighted",
            total_ibnr=12340000.0,
            triangle_cells=[],
            development_factors=[],
            by_occurrence_year=[],
            parameters={},
            excluded_rows=[],
        )

    @patch("src.backend.services.calculate_bootstrap")
    @patch("src.backend.services.calculate_benktander")
    @patch("src.backend.services.calculate_bf")
    @patch("src.backend.services.calculate_mack")
    @patch("src.backend.services.build_method_comparison")
    def test_attach_method_comparison_keeps_root_total_ibnr(
        self,
        mock_build_method_comparison,
        mock_calculate_mack,
        mock_calculate_bf,
        mock_calculate_benktander,
        mock_calculate_bootstrap,
    ) -> None:
        """The enriched payload includes method_comparison and preserves root total_ibnr."""

        comparison = MethodComparisonSummary(
            chain_ladder_total=12340000.0,
            mack={"total_ibnr": 12560000.0},
            bf={"total_ibnr_bf": 12100000.0},
            benktander={"total_ibnr_benktander": 12200000.0},
            bootstrap={"mean_total_ibnr": 12790000.0},
            comparison_rows=[
                MethodComparisonRow(
                    method="chain_ladder",
                    total_ibnr=12340000.0,
                    difference_vs_chain_ladder=0.0,
                    pct_difference_vs_chain_ladder=0.0,
                    se_or_p95=None,
                ),
            ],
            method_range=450000.0,
            parameters={"closing_year": 2025},
        )
        mock_build_method_comparison.return_value = comparison

        payload = {"total_ibnr": 12340000.0}
        result = _attach_ibnr_method_comparison(self._minimal_ibnr_result(), payload)

        self.assertEqual(result["total_ibnr"], 12340000.0)
        self.assertIn("method_comparison", result)
        self.assertIn("comparison_rows", result["method_comparison"])
        self.assertEqual(result["method_comparison"]["chain_ladder_total"], 12340000.0)
        mock_calculate_mack.assert_called_once()
        mock_calculate_bf.assert_called_once()
        mock_calculate_benktander.assert_called_once()
        mock_calculate_bootstrap.assert_called_once()
        mock_build_method_comparison.assert_called_once()


if __name__ == "__main__":
    unittest.main()
