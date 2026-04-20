"""PPNA provision engine."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import logging
from typing import Any, Mapping, Sequence

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class PPNAAuditRow:
    """Audit detail for one PPNA input row."""

    source_row_number: int
    network: str | None
    product: str | None
    policy_id: str | None
    insured_id: str | None
    effect_date: str
    expiry_date: str
    net_premium: float
    contract_days: int
    remaining_days: int
    unearned_ratio: float
    ppna_amount: float
    inclusion_reason: str


@dataclass(frozen=True)
class PPNAResult:
    """Aggregated PPNA output with traceability."""

    closing_date: str
    total_amount: float
    by_network_product: dict[tuple[str | None, str | None], float]
    row_results: list[PPNAAuditRow]
    parameters: dict[str, Any]


def _parse_iso_date(value: Any, field_name: str) -> date:
    """Parse a canonical ISO date string into a date."""

    try:
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


def calculate_ppna_for_row(row: Mapping[str, Any], closing_date: date) -> PPNAAuditRow:
    """Calculate PPNA for one canonical input row using workbook-validated prorata temporis."""

    try:
        effect_date = _parse_iso_date(row["effect_date"], "effect_date")
        expiry_date = _parse_iso_date(row["expiry_date"], "expiry_date")
        net_premium = _coerce_float(row["net_premium"], "net_premium")
        if expiry_date < effect_date:
            raise ValueError(
                f"Expiry date {expiry_date.isoformat()} must not be before effect date {effect_date.isoformat()}."
            )

        # Match the workbook's production-sheet formulas:
        # - nb de jours contrat  = DATEDIF(Effet, Échéance, "d") + 1
        # - nb de jours non aquise = IF(OR(Date_cloture < Effet, Date_cloture > Échéance), 0, Échéance - Date_cloture)
        contract_days = (expiry_date - effect_date).days + 1
        if closing_date < effect_date:
            remaining_days = 0
            inclusion_reason = "closing_date_before_effet"
        elif closing_date > expiry_date:
            remaining_days = 0
            inclusion_reason = "closing_date_after_echeance"
        else:
            remaining_days = (expiry_date - closing_date).days
            inclusion_reason = "within_coverage_window"
        unearned_ratio = remaining_days / contract_days
        ppna_amount = net_premium * unearned_ratio

        audit_row = PPNAAuditRow(
            source_row_number=int(row["_source_row_number"]),
            network=row.get("network"),
            product=row.get("product"),
            policy_id=row.get("policy_id"),
            insured_id=row.get("insured_id"),
            effect_date=effect_date.isoformat(),
            expiry_date=expiry_date.isoformat(),
            net_premium=net_premium,
            contract_days=contract_days,
            remaining_days=remaining_days,
            unearned_ratio=unearned_ratio,
            ppna_amount=ppna_amount,
            inclusion_reason=inclusion_reason,
        )
        LOGGER.debug("Calculated PPNA row=%s amount=%s", audit_row.source_row_number, audit_row.ppna_amount)
        return audit_row
    except KeyError as exc:
        LOGGER.error("Missing required PPNA field: %s", exc)
        raise ValueError(f"Missing required PPNA field: {exc}") from exc
    except Exception as exc:
        LOGGER.error("Failed to calculate PPNA for row %r: %s", row.get('_source_row_number'), exc)
        raise


def calculate_ppna(rows: Sequence[Mapping[str, Any]], closing_date: date) -> PPNAResult:
    """Calculate PPNA across canonical PPNA rows for a user-provided closing date."""

    try:
        LOGGER.info("Starting PPNA calculation for %s rows at %s", len(rows), closing_date.isoformat())
        row_results: list[PPNAAuditRow] = []
        by_network_product: dict[tuple[str | None, str | None], float] = {}

        for row in rows:
            audit_row = calculate_ppna_for_row(row, closing_date)
            row_results.append(audit_row)
            bucket = (audit_row.network, audit_row.product)
            by_network_product[bucket] = by_network_product.get(bucket, 0.0) + audit_row.ppna_amount

        total_amount = sum(item.ppna_amount for item in row_results)
        LOGGER.info("Finished PPNA calculation total=%s", total_amount)
        return PPNAResult(
            closing_date=closing_date.isoformat(),
            total_amount=total_amount,
            by_network_product=by_network_product,
            row_results=row_results,
            parameters={
                "method": "prorata_temporis",
                "contract_day_formula": 'DATEDIF("Effet","Échéance","d")+1',
                "remaining_day_formula": 'IF(OR(Date_cloture<"Effet",Date_cloture>"Échéance"),0,"Échéance"-Date_cloture)',
            },
        )
    except Exception as exc:
        LOGGER.error("PPNA calculation failed: %s", exc)
        raise
