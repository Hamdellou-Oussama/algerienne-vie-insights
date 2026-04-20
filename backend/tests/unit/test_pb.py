"""Unit tests for the PB provision engine."""

from __future__ import annotations

import unittest

from src.provisions.pb import calculate_pb, calculate_pb_for_row


def _row(**kwargs) -> dict:
    base = {
        "_source_row_number": 1,
        "client_code": "C1",
        "channel": "R1",
        "policy_id": "POL001",
        "premiums_n": 100_000.0,
        "rec_opening": 0.0,
        "sap_opening": 5_000.0,
        "claims_paid_n": 40_000.0,
        "prec_closing": 0.0,
        "sap_closing": 5_000.0,
        "management_fee_rate": 0.25,
        "prior_debit_carryover": 0.0,
        "loss_ratio": 0.4,
        "loss_ratio_threshold": 0.85,
        "pb_rate": 0.5,
    }
    base.update(kwargs)
    return base


class PBRowTests(unittest.TestCase):

    def test_zero_when_loss_ratio_exceeds_threshold(self) -> None:
        """S/P > threshold must set pb=0 and zero_reason=ineligible_loss_ratio."""
        row = _row(loss_ratio=0.9, loss_ratio_threshold=0.85)
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.5)
        self.assertEqual(result.participation_beneficiaire, 0.0)
        self.assertFalse(result.pb_eligible)
        self.assertEqual(result.eligibility_reason, "loss_ratio_above_threshold")
        self.assertEqual(result.zero_reason, "ineligible_loss_ratio")

    def test_zero_when_credit_balance_non_positive(self) -> None:
        """Eligible contract with negative balance must set pb=0 and zero_reason=non_positive_balance."""
        # claims_paid so large that balance < 0
        row = _row(claims_paid_n=200_000.0)
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.5)
        self.assertTrue(result.pb_eligible)
        self.assertEqual(result.eligibility_reason, "eligible_loss_ratio")
        self.assertLessEqual(result.credit_balance, 0.0)
        self.assertEqual(result.participation_beneficiaire, 0.0)
        self.assertEqual(result.zero_reason, "non_positive_balance")

    def test_pb_equals_rate_times_balance_when_eligible_and_positive(self) -> None:
        """Happy path: pb = pb_rate * credit_balance."""
        row = _row()
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.5)
        # total_credit = 100000 + 0 + 5000 = 105000
        # management_fee = 0.25 * 100000 = 25000
        # total_debit = 40000 + 0 + 5000 + 25000 + 0 = 70000
        # credit_balance = 105000 - 70000 = 35000
        # pb = 0.5 * 35000 = 17500
        self.assertTrue(result.pb_eligible)
        self.assertAlmostEqual(result.credit_balance, 35_000.0)
        self.assertAlmostEqual(result.participation_beneficiaire, 17_500.0)
        self.assertIsNone(result.zero_reason)

    def test_row_level_threshold_overrides_default(self) -> None:
        """Per-contract threshold takes precedence over the config default."""
        # Row threshold=0.5, loss_ratio=0.6 → ineligible despite default=0.85
        row = _row(loss_ratio=0.6, loss_ratio_threshold=0.5)
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.5)
        self.assertFalse(result.pb_eligible)
        self.assertEqual(result.effective_loss_ratio_threshold, 0.5)
        self.assertEqual(result.loss_ratio_threshold, 0.5)
        self.assertEqual(result.participation_beneficiaire, 0.0)
        self.assertEqual(result.zero_reason, "ineligible_loss_ratio")

    def test_row_level_rate_overrides_default(self) -> None:
        """Per-contract pb_rate takes precedence over the config default."""
        row = _row(pb_rate=0.3)
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.0)
        # credit_balance = 35000 (same as happy path)
        self.assertAlmostEqual(result.effective_pb_rate, 0.3)
        self.assertAlmostEqual(result.pb_rate, 0.3)
        self.assertAlmostEqual(result.participation_beneficiaire, 35_000.0 * 0.3)

    def test_disable_row_level_overrides_uses_defaults(self) -> None:
        """When overrides are disabled, row threshold/rate must not be used."""

        row = _row(loss_ratio=0.6, loss_ratio_threshold=0.5, pb_rate=0.9)
        result = calculate_pb_for_row(
            row,
            default_loss_ratio_threshold=0.85,
            default_pb_rate=0.1,
            allow_row_level_override=False,
        )
        self.assertTrue(result.pb_eligible)
        self.assertAlmostEqual(result.effective_loss_ratio_threshold, 0.85)
        self.assertAlmostEqual(result.effective_pb_rate, 0.1)

    def test_total_zero_when_overrides_disabled_and_default_rate_zero(self) -> None:
        """Control rule: disabled overrides + default rate 0 must produce total PB=0."""

        rows = [
            _row(_source_row_number=1, pb_rate=0.5),
            _row(_source_row_number=2, pb_rate=0.3, policy_id="POL002"),
        ]
        result = calculate_pb(
            rows,
            default_loss_ratio_threshold=0.85,
            default_pb_rate=0.0,
            allow_row_level_override=False,
        )
        self.assertAlmostEqual(result.total_amount, 0.0)
        self.assertTrue(all(item.effective_pb_rate == 0.0 for item in result.row_results))

    def test_management_fee_computed_on_premiums(self) -> None:
        """management_fee_amount = management_fee_rate * premiums_n."""
        row = _row(premiums_n=200_000.0, management_fee_rate=0.1)
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.5)
        self.assertAlmostEqual(result.management_fee_amount, 20_000.0)

    def test_credit_balance_equals_credit_minus_debit(self) -> None:
        """credit_balance = total_credit - total_debit."""
        row = _row(premiums_n=60_000.0, rec_opening=1_000.0, sap_opening=2_000.0,
                   claims_paid_n=10_000.0, prec_closing=500.0, sap_closing=500.0,
                   management_fee_rate=0.1, prior_debit_carryover=300.0)
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.5)
        expected_credit = 60_000.0 + 1_000.0 + 2_000.0  # 63000
        expected_fee = 0.1 * 60_000.0  # 6000
        expected_debit = 10_000.0 + 500.0 + 500.0 + 6_000.0 + 300.0  # 17300
        self.assertAlmostEqual(result.total_credit, expected_credit)
        self.assertAlmostEqual(result.total_debit, expected_debit)
        self.assertAlmostEqual(result.credit_balance, expected_credit - expected_debit)

    def test_nullable_fields_treated_as_zero(self) -> None:
        """rec_opening, prec_closing, prior_debit_carryover absent → treated as 0."""
        row = _row()
        row.pop("rec_opening", None)
        row["rec_opening"] = None
        row["prec_closing"] = None
        row["prior_debit_carryover"] = None
        result = calculate_pb_for_row(row, default_loss_ratio_threshold=0.85, default_pb_rate=0.5)
        self.assertEqual(result.rec_opening, 0.0)
        self.assertEqual(result.prec_closing, 0.0)
        self.assertEqual(result.prior_debit_carryover, 0.0)


if __name__ == "__main__":
    unittest.main()
