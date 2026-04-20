"""Unit tests for the PPNA provision engine."""

from __future__ import annotations

from datetime import date
import unittest

from src.provisions.ppna import calculate_ppna_for_row


class PPNATests(unittest.TestCase):
    """Unit tests for workbook-aligned PPNA date logic and boundary handling."""

    def test_zero_before_effect_date(self) -> None:
        """Closing before Effet should produce zero PPNA under workbook logic."""

        result = calculate_ppna_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "ia",
                "policy_id": "P1",
                "insured_id": "A1",
                "effect_date": "2025-02-01",
                "expiry_date": "2025-05-01",
                "net_premium": 174.0,
            },
            closing_date=date(2025, 1, 15),
        )
        self.assertEqual(result.remaining_days, 0)
        self.assertEqual(result.unearned_ratio, 0.0)
        self.assertEqual(result.ppna_amount, 0.0)

    def test_zero_after_expiry_date(self) -> None:
        """Closing on or after expiry should produce zero PPNA."""

        result = calculate_ppna_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "ia",
                "policy_id": "P1",
                "insured_id": "A1",
                "effect_date": "2025-02-01",
                "expiry_date": "2025-05-01",
                "net_premium": 174.0,
            },
            closing_date=date(2025, 5, 1),
        )
        self.assertEqual(result.remaining_days, 0)
        self.assertEqual(result.ppna_amount, 0.0)

    def test_leap_year_day_count(self) -> None:
        """Leap-year contracts should use inclusive contract days and workbook remaining days."""

        result = calculate_ppna_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "ia",
                "policy_id": "P1",
                "insured_id": "A1",
                "effect_date": "2024-02-01",
                "expiry_date": "2024-03-01",
                "net_premium": 290.0,
            },
            closing_date=date(2024, 2, 29),
        )
        self.assertEqual(result.contract_days, 30)
        self.assertEqual(result.remaining_days, 1)
        self.assertAlmostEqual(result.ppna_amount, 290.0 / 30.0)

    def test_same_day_contract_is_one_day_contract_with_zero_remaining(self) -> None:
        """Same-day Effet/Échéance should produce a one-day contract and zero remaining days."""

        result = calculate_ppna_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "ia",
                "policy_id": "P1",
                "insured_id": "A1",
                "effect_date": "2025-04-01",
                "expiry_date": "2025-04-01",
                "net_premium": 100.0,
            },
            closing_date=date(2025, 4, 1),
        )
        self.assertEqual(result.contract_days, 1)
        self.assertEqual(result.remaining_days, 0)
        self.assertEqual(result.ppna_amount, 0.0)

    def test_negative_premium_is_retained(self) -> None:
        """Negative premiums should be retained, not dropped."""

        result = calculate_ppna_for_row(
            {
                "_source_row_number": 1,
                "network": "r1",
                "product": "ia",
                "policy_id": "P1",
                "insured_id": "A1",
                "effect_date": "2025-01-01",
                "expiry_date": "2025-04-01",
                "net_premium": -90.0,
            },
            closing_date=date(2025, 2, 15),
        )
        self.assertLess(result.ppna_amount, 0)


if __name__ == "__main__":
    unittest.main()
