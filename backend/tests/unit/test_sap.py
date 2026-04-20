"""Unit tests for the SAP provision engine."""

from __future__ import annotations

from datetime import date
import unittest

from src.provisions.sap import calculate_sap, calculate_sap_for_row


class SAPTests(unittest.TestCase):
    """Unit tests for mentor-aligned SAP logic."""

    def test_included_between_declaration_and_notification(self) -> None:
        """Declared amount should be retained between Date de déclaration and notification."""

        result = calculate_sap_for_row(
            {
                "_source_row_number": 1,
                "network": "direct",
                "product": "prevoyance",
                "claim_id": "C1",
                "status": "rejet",
                "declaration_date": "2025-01-09",
                "settlement_notification_date": "2025-07-13",
                "declared_amount": 1200000.0,
                "paid_amount": 0.0,
            },
            closing_date=date(2025, 3, 31),
        )
        self.assertEqual(result.sap_amount, 1200000.0)

    def test_excluded_when_closing_before_declaration(self) -> None:
        """Declared amount should be excluded before Date de déclaration."""

        result = calculate_sap_for_row(
            {
                "_source_row_number": 1,
                "network": "direct",
                "product": "prevoyance",
                "claim_id": "C1",
                "status": "sap",
                "declaration_date": "2025-01-09",
                "settlement_notification_date": "2025-07-13",
                "declared_amount": 1200000.0,
                "paid_amount": 0.0,
            },
            closing_date=date(2025, 1, 1),
        )
        self.assertEqual(result.sap_amount, 0.0)

    def test_status_regle_uses_declared_minus_paid_after_notification(self) -> None:
        """REGLE rows should use clipped outstanding amount after notification."""

        result = calculate_sap_for_row(
            {
                "_source_row_number": 1,
                "network": "direct",
                "product": "prevoyance",
                "claim_id": "C1",
                "status": "regle",
                "declaration_date": "2025-01-09",
                "settlement_notification_date": "2025-02-10",
                "declared_amount": 1200000.0,
                "paid_amount": 1000000.0,
            },
            closing_date=date(2025, 3, 31),
        )
        self.assertEqual(result.sap_amount, 200000.0)

    def test_status_sap_uses_declared_amount_after_notification(self) -> None:
        """SAP status rows should retain full declared amount outside the in-between window."""

        result = calculate_sap_for_row(
            {
                "_source_row_number": 11,
                "network": "direct",
                "product": "prevoyance",
                "claim_id": "C11",
                "status": "sap",
                "declaration_date": "2025-01-09",
                "settlement_notification_date": "2025-02-10",
                "declared_amount": 1200000.0,
                "paid_amount": 1000000.0,
            },
            closing_date=date(2025, 3, 31),
        )
        self.assertEqual(result.sap_amount, 1200000.0)

    def test_blank_notification_uses_signed_declared_minus_paid(self) -> None:
        """Blank notification dates should use clipped outstanding for non-REJET rows."""

        result = calculate_sap_for_row(
            {
                "_source_row_number": 1,
                "network": "direct",
                "product": "prevoyance",
                "claim_id": "C1",
                "status": "regle",
                "declaration_date": "2025-01-09",
                "settlement_notification_date": None,
                "declared_amount": 6000000.0,
                "paid_amount": 0.0,
            },
            closing_date=date(2025, 3, 31),
        )
        self.assertEqual(result.sap_amount, 6000000.0)

    def test_paid_exceeding_declared_is_clipped_to_zero(self) -> None:
        """Outstanding amount must be clipped to zero when paid exceeds declared."""

        result = calculate_sap_for_row(
            {
                "_source_row_number": 1,
                "network": "direct",
                "product": "prevoyance",
                "claim_id": "C1",
                "status": "regle",
                "declaration_date": "2025-01-09",
                "settlement_notification_date": "2025-02-10",
                "declared_amount": 1000000.0,
                "paid_amount": 1200000.0,
            },
            closing_date=date(2025, 3, 31),
        )
        self.assertEqual(result.sap_amount, 0.0)

    def test_calculate_sap_never_returns_negative_row_values(self) -> None:
        """Aggregate SAP output must contain no negative row amounts."""

        result = calculate_sap(
            [
                {
                    "_source_row_number": 21,
                    "network": "direct",
                    "product": "prevoyance",
                    "claim_id": "C21",
                    "status": "regle",
                    "declaration_date": "2025-01-09",
                    "settlement_notification_date": "2025-02-10",
                    "declared_amount": 1000000.0,
                    "paid_amount": 1200000.0,
                },
                {
                    "_source_row_number": 22,
                    "network": "direct",
                    "product": "prevoyance",
                    "claim_id": "C22",
                    "status": "rejet",
                    "declaration_date": "2025-01-09",
                    "settlement_notification_date": "2025-02-10",
                    "declared_amount": 500000.0,
                    "paid_amount": 0.0,
                },
            ],
            closing_date=date(2025, 3, 31),
        )

        self.assertTrue(result.row_results)
        self.assertTrue(all(item.sap_amount >= 0.0 for item in result.row_results))


if __name__ == "__main__":
    unittest.main()
