"""Unit tests for assumption registry generation."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from src.reporting.assumptions import generate_assumption_registry


class AssumptionRegistryTests(unittest.TestCase):
    """Unit tests for assumption registry artifacts."""

    def test_registry_includes_expected_assumptions(self) -> None:
        """Registry should include current active and needs_review assumptions."""

        with tempfile.TemporaryDirectory() as tmpdir:
            result = generate_assumption_registry(Path(tmpdir))
            entries = {entry["assumption_name"]: entry for entry in result["payload"]["entries"]}
            self.assertIn("ppna_day_count_basis", entries)
            self.assertEqual(entries["ppna_day_count_basis"]["status"], "active")
            self.assertIn("ibnr_method_chain_ladder_volume_weighted", entries)
            self.assertEqual(entries["ibnr_method_chain_ladder_volume_weighted"]["status"], "active")
            self.assertIn("ibnr_product_segmentation_mode", entries)
            self.assertEqual(entries["ibnr_product_segmentation_mode"]["status"], "active")
            self.assertIn("ibnr_closing_year", entries)
            self.assertEqual(entries["ibnr_closing_year"]["current_value"], 2025)
            self.assertEqual(entries["pe_positive_result_coefficient"]["current_value"], 0.72)
            self.assertTrue(Path(result["json_path"]).exists())
            self.assertTrue(Path(result["markdown_path"]).exists())


if __name__ == "__main__":
    unittest.main()
