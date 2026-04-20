"""Integration tests for PB provision against the real PB workbook."""

from __future__ import annotations

import unittest

import openpyxl

from src.preprocessing.pb_loader import PBLoader
from src.provisions.pb import calculate_pb

# Expected W column values read from workbook (data_only=True) at time of implementation.
# Row 6:  eligible (S=0.4 ≤ T=0.5), positive balance → PB = 0.5 * 21,972,636.43
# Row 7:  eligible (S=0.6 ≤ T=0.7), negative balance → PB = 0
# Row 8:  eligible (S=0.6 ≤ T=0.7), positive balance → PB = 0.27 * 6,678,213.63
# Row 9:  eligible (S=0.55 ≤ T=0.6), negative balance → PB = 0
# Row 10: eligible (S=0.55 ≤ T=1.6), positive balance → PB = 1.3 * 893,540.27
WORKBOOK_W = {
    6: 10_986_318.216600101,
    7: 0.0,
    8: 1_803_117.6813205478,
    9: 0.0,
    10: 1_161_602.3509999996,
}
WORKBOOK_TOTAL = 13_951_038.248920649

_SHEET = "BASE"
_TOL = 1e-4  # generous for floating-point accumulation across fee computation


class PBWorkbookIntegrationTests(unittest.TestCase):
    """Verify that the PB engine reproduces column W and total from the real workbook."""

    @classmethod
    def setUpClass(cls) -> None:
        loader = PBLoader()
        rows = loader.load().rows
        cls.result = calculate_pb(rows)
        cls.row_map = {r.source_row_number: r for r in cls.result.row_results}

        # Read W column directly for ground-truth comparison.
        wb = openpyxl.load_workbook(loader.contract.workbook_path, data_only=True)
        try:
            ws = wb[_SHEET]
            cls.wb_w = {r: (ws.cell(r, 23).value or 0.0) for r in range(6, 11)}
        finally:
            wb.close()

    def test_loader_returns_five_rows(self) -> None:
        self.assertEqual(len(self.result.row_results), 5)

    def test_total_pb_matches_workbook(self) -> None:
        """Engine total must match sum of workbook W column."""
        self.assertAlmostEqual(self.result.total_amount, WORKBOOK_TOTAL, delta=_TOL)

    def test_row6_eligible_positive_balance(self) -> None:
        row = self.row_map[6]
        self.assertTrue(row.pb_eligible)
        self.assertGreater(row.credit_balance, 0.0)
        self.assertAlmostEqual(row.participation_beneficiaire, WORKBOOK_W[6], delta=_TOL)

    def test_row7_negative_balance_gives_zero(self) -> None:
        row = self.row_map[7]
        self.assertLess(row.credit_balance, 0.0)
        self.assertEqual(row.participation_beneficiaire, 0.0)
        self.assertEqual(row.zero_reason, "non_positive_balance")

    def test_row8_eligible_positive_balance(self) -> None:
        row = self.row_map[8]
        self.assertTrue(row.pb_eligible)
        self.assertAlmostEqual(row.participation_beneficiaire, WORKBOOK_W[8], delta=_TOL)

    def test_row9_negative_balance_gives_zero(self) -> None:
        row = self.row_map[9]
        self.assertLess(row.credit_balance, 0.0)
        self.assertEqual(row.participation_beneficiaire, 0.0)
        self.assertEqual(row.zero_reason, "non_positive_balance")

    def test_row10_eligible_positive_balance(self) -> None:
        row = self.row_map[10]
        self.assertTrue(row.pb_eligible)
        self.assertAlmostEqual(row.participation_beneficiaire, WORKBOOK_W[10], delta=_TOL)

    def test_per_row_engine_vs_workbook_w(self) -> None:
        """Engine output must match workbook W column within tolerance for every row."""
        for row_num, wb_val in self.wb_w.items():
            with self.subTest(row=row_num):
                engine_val = self.row_map[row_num].participation_beneficiaire
                self.assertAlmostEqual(engine_val, wb_val, delta=_TOL,
                                       msg=f"Row {row_num}: engine={engine_val} wb={wb_val}")

    def test_by_channel_keys_present(self) -> None:
        """by_channel aggregation must include all five channels."""
        self.assertEqual(len(self.result.by_channel), 5)

    def test_loader_metrics(self) -> None:
        """Loader metrics must reflect correct ineligible and positive counts."""
        metrics = PBLoader().load().metrics
        # 5 rows, 0 are S/P-ineligible (all S ≤ T in the sample)
        self.assertEqual(metrics["row_count"], 5)
        self.assertEqual(metrics["ineligible_loss_ratio_rows"], 0)
        # 2 rows have non-positive credit balance (rows 7 and 9)
        self.assertEqual(metrics["non_positive_credit_balance_rows"], 2)
        # 3 rows have positive PB
        self.assertEqual(metrics["positive_pb_rows"], 3)


if __name__ == "__main__":
    unittest.main()
