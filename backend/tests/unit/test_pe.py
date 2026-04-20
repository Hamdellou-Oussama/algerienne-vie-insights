"""Unit tests for the PE provision engine."""

from __future__ import annotations

import unittest

from src.provisions.pe import calculate_pe_for_row


class PETests(unittest.TestCase):
    """Unit tests for PE trigger logic and configurable coefficients."""

    def test_zero_when_technical_result_is_not_positive(self) -> None:
        """PE should be zero when the technical result is non-positive."""

        result = calculate_pe_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "prevoyance",
                "fiscal_year": 2025,
                "technical_result": -1.0,
                "claims_charge_n1": 100.0,
                "claims_charge_n2": 200.0,
                "claims_charge_n3": 300.0,
            },
            positive_result_coefficient=0.72,
            historical_average_coefficient=0.15,
        )
        self.assertEqual(result.equalization_provision, 0.0)

    def test_min_branch_from_positive_result_component(self) -> None:
        """PE should use the positive-result branch when it is smaller."""

        result = calculate_pe_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "prevoyance",
                "fiscal_year": 2025,
                "technical_result": 100.0,
                "claims_charge_n1": 1000.0,
                "claims_charge_n2": 1000.0,
                "claims_charge_n3": 1000.0,
            },
            positive_result_coefficient=0.5,
            historical_average_coefficient=0.2,
        )
        self.assertEqual(result.positive_result_component, 50.0)
        self.assertEqual(result.historical_average_component, 200.0)
        self.assertEqual(result.equalization_provision, 50.0)

    def test_min_branch_from_historical_average_component(self) -> None:
        """PE should use the historical-average branch when it is smaller."""

        result = calculate_pe_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "prevoyance",
                "fiscal_year": 2025,
                "technical_result": 1000.0,
                "claims_charge_n1": 30.0,
                "claims_charge_n2": 30.0,
                "claims_charge_n3": 30.0,
            },
            positive_result_coefficient=0.72,
            historical_average_coefficient=0.15,
        )
        self.assertEqual(result.historical_average, 30.0)
        self.assertEqual(result.historical_average_component, 4.5)
        self.assertEqual(result.equalization_provision, 4.5)


if __name__ == "__main__":
    unittest.main()
