"""Integration tests for reconciliation and consolidated audit artifacts."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from src.orchestration.run_audit import run_audit
from src.reporting.reconciliation import run_reconciliation


class ReportingIntegrationTests(unittest.TestCase):
    """Integration tests for reporting and audit artifact generation."""

    def test_reconciliation_artifacts_capture_expected_statuses(self) -> None:
        """Reconciliation output should reflect the corrected workbook-backed cases."""

        with tempfile.TemporaryDirectory() as tmpdir:
            result = run_reconciliation(Path(tmpdir))
            modules = {module["module_name"]: module for module in result["payload"]["modules"]}
            self.assertEqual(modules["sap"]["status"], "matched")
            self.assertEqual(modules["pe"]["status"], "matched")
            self.assertEqual(modules["ppna"]["status"], "matched")
            self.assertEqual(modules["ibnr"]["status"], "matched")
            self.assertEqual(modules["sap"]["evidence"]["blank_notification_rows"], 171)
            self.assertEqual(modules["sap"]["evidence"]["blank_notification_by_status"]["SAP"], 171)
            self.assertAlmostEqual(modules["ibnr"]["python_total"], 135_205_244.46977875, places=6)
            self.assertAlmostEqual(modules["ibnr"]["difference"], 0.0, places=6)
            self.assertTrue(Path(result["json_path"]).exists())
            self.assertTrue(Path(result["markdown_path"]).exists())

    def test_consolidated_audit_run_outputs_stable_summary(self) -> None:
        """Consolidated audit run should emit stable high-level outputs on sample data."""

        with tempfile.TemporaryDirectory() as tmpdir:
            docs_root = Path(tmpdir)
            summary = run_audit(output_root=docs_root)
            self.assertAlmostEqual(summary["provision_totals"]["ppna"]["total_amount"], 3901156.363858455, places=6)
            self.assertAlmostEqual(summary["provision_totals"]["pe"]["total_amount"], 93561414.06179482, places=4)
            self.assertAlmostEqual(summary["provision_totals"]["sap"]["total_amount"], 157200000.0, places=4)
            self.assertNotIn("needs_review", [b.split("::")[-1] for b in summary["blockers_summary"] if "ibnr_product_segmentation" in b])
            summary_path = docs_root / "validation_reports" / "audit_summary.json"
            self.assertTrue(summary_path.exists())
            payload = json.loads(summary_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["reconciliation_summary"]["matched"], 4)
            self.assertAlmostEqual(summary["provision_totals"]["ibnr"]["total_ibnr"], 135_205_244.46977875, places=6)


if __name__ == "__main__":
    unittest.main()
