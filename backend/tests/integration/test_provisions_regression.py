"""Integration tests for PPNA, PE, and SAP provision engines."""

from __future__ import annotations

from datetime import date
import unittest

from src.preprocessing.pe_loader import PELoader
from src.preprocessing.ppna_loader import PPNALoader
from src.preprocessing.sap_loader import SAPLoader
from src.provisions.pe import calculate_pe
from src.provisions.ppna import calculate_ppna
from src.provisions.sap import calculate_sap


class ProvisionRegressionTests(unittest.TestCase):
    """Regression coverage for provision engines against sample workbooks."""

    @classmethod
    def setUpClass(cls) -> None:
        """Load canonical datasets once for provision regressions."""

        cls.ppna_rows = PPNALoader().load().rows
        cls.pe_rows = PELoader().load().rows
        cls.sap_rows = SAPLoader().load().rows

    def test_ppna_sample_regression(self) -> None:
        """PPNA should produce a stable aggregate for the sample workbook."""

        result = calculate_ppna(self.ppna_rows, closing_date=date(2025, 5, 31))
        self.assertAlmostEqual(result.total_amount, 3901156.363858455, places=6)

    def test_pe_sample_regression(self) -> None:
        """PE should reproduce the sample workbook aggregate under configured coefficients."""

        result = calculate_pe(self.pe_rows)
        self.assertAlmostEqual(result.total_amount, 93561414.06179482, places=4)
        self.assertAlmostEqual(result.by_network_product[("r1", "ade")], 9547142.216, places=4)

    def test_sap_sample_regression(self) -> None:
        """SAP should reproduce the workbook aggregation at the workbook closing date."""

        result = calculate_sap(self.sap_rows, closing_date=date(2025, 3, 31))
        self.assertAlmostEqual(result.total_amount, 157200000.0, places=4)
        self.assertAlmostEqual(result.by_network_product[("direct", "prevoyance")], 157200000.0, places=4)


if __name__ == "__main__":
    unittest.main()
