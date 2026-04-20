"""Unit tests for normalization helpers."""

from __future__ import annotations

from datetime import datetime
import unittest

from src.preprocessing.normalizers import normalize_category, normalize_date, normalize_decimal


class NormalizerTests(unittest.TestCase):
    """Unit tests for date, numeric, and category normalization."""

    def test_normalize_date_from_datetime(self) -> None:
        """Datetime values should normalize to ISO dates."""

        value, rule = normalize_date(datetime(2025, 6, 30))
        self.assertEqual(value, "2025-06-30")
        self.assertEqual(rule, "datetime_to_iso")

    def test_normalize_date_from_string(self) -> None:
        """String dates should normalize to ISO dates."""

        value, rule = normalize_date("31/12/2025")
        self.assertEqual(value, "2025-12-31")
        self.assertEqual(rule, "string_to_iso")

    def test_normalize_decimal_from_string(self) -> None:
        """String numerics should coerce to floats."""

        value, rule = normalize_decimal("72,5")
        self.assertEqual(value, 72.5)
        self.assertEqual(rule, "string_to_decimal")

    def test_normalize_category(self) -> None:
        """Categories should normalize whitespace and case."""

        value, rule = normalize_category("  Prévoyance  ")
        self.assertEqual(value, "prévoyance")
        self.assertEqual(rule, "category_casefold")


if __name__ == "__main__":
    unittest.main()
