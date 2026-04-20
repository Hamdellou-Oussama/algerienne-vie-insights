"""SAP provision engine using dataset-driven workbook logic."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import logging
from typing import Any, Mapping, Sequence

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class SAPRowAudit:
    """Audit detail for one SAP claim row."""

    source_row_number: int
    network: str | None
    product: str | None
    claim_id: str | None
    status: str | None
    declaration_date: str
    settlement_notification_date: str | None
    declared_amount: float
    paid_amount: float
    sap_amount: float
    inclusion_reason: str


@dataclass(frozen=True)
class SAPResult:
    """Aggregated SAP output with traceability."""

    closing_date: str
    total_amount: float
    by_network_product: dict[tuple[str | None, str | None], float]
    row_results: list[SAPRowAudit]
    parameters: dict[str, Any]


def _parse_iso_date(value: Any, field_name: str, nullable: bool = False) -> date | None:
    """Parse a canonical ISO date string into a date."""

    try:
        if value is None and nullable:
            return None
        if not isinstance(value, str):
            raise TypeError(f"{field_name} must be an ISO date string, got {type(value).__name__}.")
        return date.fromisoformat(value)
    except Exception as exc:
        LOGGER.error("Failed to parse %s=%r: %s", field_name, value, exc)
        raise ValueError(f"Invalid {field_name}: {value!r}") from exc


def _coerce_float(value: Any, field_name: str) -> float:
    """Coerce a canonical numeric field to float."""

    try:
        if value is None:
            raise ValueError(f"{field_name} is missing.")
        return float(value)
    except Exception as exc:
        LOGGER.error("Failed to parse %s=%r: %s", field_name, value, exc)
        raise ValueError(f"Invalid {field_name}: {value!r}") from exc


def _coerce_optional_float(value: Any, field_name: str, default: float = 0.0) -> float:
    """Coerce an optional numeric field to float, using a workbook-compatible default."""

    if value is None:
        LOGGER.debug("%s is missing; defaulting to %s for workbook-compatible SAP handling.", field_name, default)
        return default
    return _coerce_float(value, field_name)


def calculate_sap_for_row(row: Mapping[str, Any], closing_date: date) -> SAPRowAudit:
    """Calculate SAP for one canonical claim row using strict workbook AC rule logic."""

    try:
        declaration_date = _parse_iso_date(row["declaration_date"], "declaration_date")
        settlement_notification_date = _parse_iso_date(
            row.get("settlement_notification_date"),
            "settlement_notification_date",
            nullable=True,
        )
        declared_amount = _coerce_float(row["declared_amount"], "declared_amount")
        paid_amount = _coerce_optional_float(row.get("paid_amount"), "paid_amount")
        status = str(row.get("status") or "").strip().upper()

        if closing_date < declaration_date:
            sap_amount = 0.0
            inclusion_reason = "closing_date_before_declaration"
        elif settlement_notification_date is not None and declaration_date < closing_date < settlement_notification_date:
            sap_amount = declared_amount
            inclusion_reason = "between_declaration_and_notification"
        else:
            if status == "REJET":
                sap_amount = 0.0
                inclusion_reason = "status_rejet"
            elif status == "SAP":
                sap_amount = declared_amount
                inclusion_reason = "status_sap"
            else:
                sap_amount = max(0.0, declared_amount - paid_amount)
                inclusion_reason = "status_non_rejet_clipped_outstanding_amount"

        audit_row = SAPRowAudit(
            source_row_number=int(row["_source_row_number"]),
            network=row.get("network"),
            product=row.get("product"),
            claim_id=row.get("claim_id"),
            status=status or None,
            declaration_date=declaration_date.isoformat(),
            settlement_notification_date=(
                settlement_notification_date.isoformat() if settlement_notification_date is not None else None
            ),
            declared_amount=declared_amount,
            paid_amount=paid_amount,
            sap_amount=sap_amount,
            inclusion_reason=inclusion_reason,
        )
        LOGGER.debug("Calculated SAP row=%s amount=%s", audit_row.source_row_number, audit_row.sap_amount)
        return audit_row
    except KeyError as exc:
        LOGGER.error("Missing required SAP field: %s", exc)
        raise ValueError(f"Missing required SAP field: {exc}") from exc
    except Exception as exc:
        LOGGER.error("Failed to calculate SAP for row %r: %s", row.get('_source_row_number'), exc)
        raise


def calculate_sap(rows: Sequence[Mapping[str, Any]], closing_date: date) -> SAPResult:
    """Calculate SAP across canonical claim rows for a user-provided closing date."""

    try:
        LOGGER.info("Starting SAP calculation for %s rows at %s", len(rows), closing_date.isoformat())
        row_results: list[SAPRowAudit] = []
        by_network_product: dict[tuple[str | None, str | None], float] = {}
        for row in rows:
            audit_row = calculate_sap_for_row(row, closing_date)
            row_results.append(audit_row)
            bucket = (audit_row.network, audit_row.product)
            by_network_product[bucket] = by_network_product.get(bucket, 0.0) + audit_row.sap_amount

        total_amount = sum(item.sap_amount for item in row_results)
        LOGGER.info("Finished SAP calculation total=%s", total_amount)
        return SAPResult(
            closing_date=closing_date.isoformat(),
            total_amount=total_amount,
            by_network_product=by_network_product,
            row_results=row_results,
            parameters={
                "dataset_rule": (
                    'if Date de clôture < "Date de déclaration" then 0; '
                    'if "Date de déclaration" < Date de clôture < "Date de notification reglement /REJET" then '
                    '"Montant sinistre déclaré"; else status REJET => 0, status SAP => "Montant sinistre déclaré", '
                    'otherwise max(0, "Montant sinistre déclaré" - "Montant réglé")'
                )
            },
        )
    except Exception as exc:
        LOGGER.error("SAP calculation failed: %s", exc)
        raise
