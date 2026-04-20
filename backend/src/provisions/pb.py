"""Participation Bénéficiaire (PB) provision engine."""

from __future__ import annotations

import argparse
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from src.config import load_yaml_config

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class PBRowAudit:
    """Audit detail for one PB contract row."""

    source_row_number: int
    client_code: str | None
    channel: str | None
    policy_id: str | None
    premiums_n: float
    rec_opening: float
    sap_opening: float
    total_credit: float
    claims_paid_n: float
    prec_closing: float
    sap_closing: float
    management_fee_rate: float
    management_fee_amount: float
    prior_debit_carryover: float
    total_debit: float
    credit_balance: float
    loss_ratio: float
    loss_ratio_threshold: float
    effective_loss_ratio_threshold: float
    pb_eligible: bool
    eligibility_reason: str
    pb_rate: float
    effective_pb_rate: float
    participation_beneficiaire: float
    zero_reason: str | None  # "ineligible_loss_ratio" | "non_positive_balance" | None


@dataclass(frozen=True)
class PBResult:
    """Aggregated PB output with traceability."""

    total_amount: float
    by_channel: dict[str | None, float]
    row_results: list[PBRowAudit]
    parameters: dict[str, Any]


def _load_config() -> dict[str, Any]:
    """Load PB legislative defaults from config."""
    config = load_yaml_config("src/config/legislative.yaml")
    try:
        pb_cfg = config["pb"]
        return {
            "default_loss_ratio_threshold": float(pb_cfg["default_loss_ratio_threshold"]),
            "default_pb_rate": float(pb_cfg["default_pb_rate"]),
            "allow_row_level_override": bool(pb_cfg.get("allow_row_level_override", True)),
        }
    except Exception as exc:
        LOGGER.error("Failed to load PB config: %s", exc)
        raise ValueError("PB legislative config is missing or invalid.") from exc


def _to_float(row: Mapping[str, Any], field_name: str, nullable: bool = False) -> float:
    """Read a canonical numeric field as float, treating None as 0.0 when nullable."""
    try:
        value = row.get(field_name)
        if value is None:
            if nullable:
                return 0.0
            raise ValueError(f"{field_name} is missing.")
        return float(value)
    except Exception as exc:
        LOGGER.error("Failed to read PB field %s=%r: %s", field_name, row.get(field_name), exc)
        raise ValueError(f"Invalid PB field {field_name}: {row.get(field_name)!r}") from exc


def calculate_pb_for_row(
    row: Mapping[str, Any],
    default_loss_ratio_threshold: float,
    default_pb_rate: float,
    *,
    allow_row_level_override: bool = True,
) -> PBRowAudit:
    """Calculate PB for one canonical row.

    Per-contract threshold and rate from the row take precedence over config defaults.
    """
    try:
        premiums_n = _to_float(row, "premiums_n")
        rec_opening = _to_float(row, "rec_opening", nullable=True)
        sap_opening = _to_float(row, "sap_opening", nullable=True)
        claims_paid_n = _to_float(row, "claims_paid_n")
        prec_closing = _to_float(row, "prec_closing", nullable=True)
        sap_closing = _to_float(row, "sap_closing", nullable=True)
        management_fee_rate = _to_float(row, "management_fee_rate")
        prior_debit_carryover = _to_float(row, "prior_debit_carryover", nullable=True)
        loss_ratio = _to_float(row, "loss_ratio")

        # Per-contract override is explicitly controllable at run level.
        row_threshold = row.get("loss_ratio_threshold") if allow_row_level_override else None
        loss_ratio_threshold = float(row_threshold) if row_threshold is not None else default_loss_ratio_threshold

        row_rate = row.get("pb_rate") if allow_row_level_override else None
        pb_rate = float(row_rate) if row_rate is not None else default_pb_rate

        total_credit = premiums_n + rec_opening + sap_opening
        management_fee_amount = management_fee_rate * premiums_n
        total_debit = claims_paid_n + prec_closing + sap_closing + management_fee_amount + prior_debit_carryover
        credit_balance = total_credit - total_debit

        pb_eligible = loss_ratio <= loss_ratio_threshold
        eligibility_reason = "eligible_loss_ratio" if pb_eligible else "loss_ratio_above_threshold"

        if not pb_eligible:
            participation_beneficiaire = 0.0
            zero_reason: str | None = "ineligible_loss_ratio"
        elif credit_balance <= 0.0:
            participation_beneficiaire = 0.0
            zero_reason = "non_positive_balance"
        else:
            participation_beneficiaire = pb_rate * credit_balance
            zero_reason = None

        audit = PBRowAudit(
            source_row_number=int(row["_source_row_number"]),
            client_code=row.get("client_code"),
            channel=row.get("channel"),
            policy_id=row.get("policy_id"),
            premiums_n=premiums_n,
            rec_opening=rec_opening,
            sap_opening=sap_opening,
            total_credit=total_credit,
            claims_paid_n=claims_paid_n,
            prec_closing=prec_closing,
            sap_closing=sap_closing,
            management_fee_rate=management_fee_rate,
            management_fee_amount=management_fee_amount,
            prior_debit_carryover=prior_debit_carryover,
            total_debit=total_debit,
            credit_balance=credit_balance,
            loss_ratio=loss_ratio,
            loss_ratio_threshold=loss_ratio_threshold,
            effective_loss_ratio_threshold=loss_ratio_threshold,
            pb_eligible=pb_eligible,
            eligibility_reason=eligibility_reason,
            pb_rate=pb_rate,
            effective_pb_rate=pb_rate,
            participation_beneficiaire=participation_beneficiaire,
            zero_reason=zero_reason,
        )
        LOGGER.debug(
            "PB row=%s client=%s eligible=%s pb=%.2f reason=%s",
            audit.source_row_number,
            audit.client_code,
            audit.pb_eligible,
            audit.participation_beneficiaire,
            audit.zero_reason,
        )
        return audit

    except KeyError as exc:
        LOGGER.error("Missing required PB field: %s", exc)
        raise ValueError(f"Missing required PB field: {exc}") from exc
    except Exception as exc:
        LOGGER.error("Failed to calculate PB for row %r: %s", row.get("_source_row_number"), exc)
        raise


def calculate_pb(
    rows: Sequence[Mapping[str, Any]],
    default_loss_ratio_threshold: float | None = None,
    default_pb_rate: float | None = None,
    allow_row_level_override: bool | None = None,
) -> PBResult:
    """Calculate PB for all canonical rows."""
    try:
        cfg = _load_config()
        threshold = default_loss_ratio_threshold if default_loss_ratio_threshold is not None else cfg["default_loss_ratio_threshold"]
        rate = default_pb_rate if default_pb_rate is not None else cfg["default_pb_rate"]
        allow_override = (
            allow_row_level_override
            if allow_row_level_override is not None
            else bool(cfg.get("allow_row_level_override", True))
        )

        LOGGER.info("Starting PB calculation for %s rows", len(rows))
        row_results: list[PBRowAudit] = []
        by_channel: dict[str | None, float] = {}

        for row in rows:
            audit = calculate_pb_for_row(
                row,
                threshold,
                rate,
                allow_row_level_override=allow_override,
            )
            row_results.append(audit)
            by_channel[audit.channel] = by_channel.get(audit.channel, 0.0) + audit.participation_beneficiaire

        total_amount = sum(r.participation_beneficiaire for r in row_results)
        LOGGER.info("Finished PB calculation total=%.2f", total_amount)
        return PBResult(
            total_amount=total_amount,
            by_channel=by_channel,
            row_results=row_results,
            parameters={
                "default_loss_ratio_threshold": threshold,
                "default_pb_rate": rate,
                "allow_row_level_override": allow_override,
            },
        )
    except Exception as exc:
        LOGGER.error("PB calculation failed: %s", exc)
        raise


def _main() -> None:
    parser = argparse.ArgumentParser(description="Run PB provision calculation.")
    parser.add_argument("--workbook", type=Path, default=None, help="Override workbook path.")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    from src.preprocessing.pb_loader import PBLoader

    loader = PBLoader()
    if args.workbook:
        loader.contract = loader.contract.__class__(
            **{**loader.contract.__dict__, "workbook_path": args.workbook}
        )
    result_ds = loader.load()
    pb_result = calculate_pb(result_ds.rows)

    LOGGER.info("PB total provision: %.2f", pb_result.total_amount)
    for channel, amount in sorted(pb_result.by_channel.items()):
        LOGGER.info("  channel=%s  pb=%.2f", channel, amount)
    for row in pb_result.row_results:
        LOGGER.info(
            "  row=%s client=%s policy=%s pb=%.2f reason=%s",
            row.source_row_number,
            row.client_code,
            row.policy_id,
            row.participation_beneficiaire,
            row.zero_reason,
        )


if __name__ == "__main__":
    _main()
