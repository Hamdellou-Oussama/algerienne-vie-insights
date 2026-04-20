"""Regression tests locking the current raw sample anomaly profile."""

from __future__ import annotations

import unittest

from src.preprocessing.ibnr_loader import IBNRLoader
from src.preprocessing.pb_loader import PBLoader
from src.preprocessing.pe_loader import PELoader
from src.preprocessing.ppna_loader import PPNALoader
from src.preprocessing.sap_loader import SAPLoader
from src.preprocessing.workbook_inventory import inventory_all_workbooks


class PreprocessingRegressionTests(unittest.TestCase):
    """Regression tests for workbook inventory and loader metrics."""

    @classmethod
    def setUpClass(cls) -> None:
        """Load datasets once for regression assertions."""

        cls.ppna = PPNALoader().load()
        cls.sap = SAPLoader().load()
        cls.pe = PELoader().load()
        cls.pb = PBLoader().load()
        cls.ibnr = IBNRLoader().load()

    def test_inventory_detects_known_workbooks(self) -> None:
        """Workbook inventory should include all current raw files."""

        names = {inventory.workbook_name for inventory in inventory_all_workbooks()}
        required = {
            "level 01-level2-ÉCHANTILLON DATA PPNA.xlsx",
            "level 01-DATA SAP groupe.xlsx",
            "level 01-ÉCHANTILLON DATA PE.xlsx",
            "ÉCHANTILLON DATA PB (1).xlsx",
            "level 02-ÉCHANTILLON DATA IBNR.xlsx",
            "level3-Bilan sinistres(2).xlsx",
        }
        missing = required - names
        self.assertFalse(missing, f"Missing workbooks in inventory: {sorted(missing)}")

    def test_ppna_anomaly_profile(self) -> None:
        """PPNA anomaly profile should remain stable for the sample workbook."""

        self.assertEqual(self.ppna.metrics["row_count"], 21266)
        self.assertEqual(self.ppna.metrics["negative_premium_rows"], 1382)
        self.assertEqual(self.ppna.metrics["zero_premium_rows"], 2267)
        self.assertEqual(self.ppna.metrics["string_date_rows"], 18401)

    def test_sap_anomaly_profile(self) -> None:
        """SAP anomaly profile should remain stable for the sample workbook."""

        self.assertEqual(self.sap.metrics["row_count"], 234)
        self.assertEqual(self.sap.metrics["status_counts"], {"SAP": 174, "REGLE": 34, "REJET": 26})
        self.assertEqual(self.sap.metrics["missing_insured_birth_date_rows"], 4)
        self.assertEqual(self.sap.metrics["missing_beneficiary_birth_date_rows"], 4)

    def test_pe_anomaly_profile(self) -> None:
        """PE anomaly profile should remain stable for the sample workbook."""

        self.assertEqual(self.pe.metrics["row_count"], 125)
        self.assertEqual(self.pe.metrics["blank_contract_year_count_rows"], 124)
        self.assertEqual(self.pe.metrics["negative_technical_result_rows"], 20)
        self.assertEqual(self.pe.metrics["positive_equalization_provision_rows"], 29)

    def test_ibnr_anomaly_profile(self) -> None:
        """IBNR anomaly profile should remain stable for the sample workbook."""

        self.assertEqual(self.ibnr.metrics["row_count"], 596)
        self.assertEqual(self.ibnr.metrics["product_counts"], {"immo": 248, "conso": 343, "warda": 3, "ac-elite": 2})
        self.assertEqual(self.ibnr.metrics["impossible_lag_rows"], 0)
        self.assertEqual(self.ibnr.metrics["lag_mismatch_rows"], 0)
        self.assertEqual(
            self.ibnr.metrics["occurrence_year_counts"],
            {2018: 8, 2019: 15, 2020: 48, 2021: 74, 2022: 80, 2023: 120, 2024: 132, 2025: 119},
        )

    def test_pb_anomaly_profile(self) -> None:
        """PB anomaly profile should remain stable for the sample workbook."""

        self.assertEqual(self.pb.metrics["row_count"], 5)
        self.assertEqual(self.pb.metrics["ineligible_loss_ratio_rows"], 0)
        self.assertEqual(self.pb.metrics["non_positive_credit_balance_rows"], 2)
        self.assertEqual(self.pb.metrics["positive_pb_rows"], 3)


if __name__ == "__main__":
    unittest.main()
