"""Equalization provision engine."""

from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Any, Mapping, Sequence

from src.config import load_yaml_config

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class PERowAudit:
    """Audit detail for one PE input row."""

    source_row_number: int
    network: str | None
    product: str | None
    fiscal_year: int
    technical_result: float
    claims_charge_n1: float
    claims_charge_n2: float
    claims_charge_n3: float
    historical_average: float
    positive_result_component: float
    historical_average_component: float
    equalization_provision: float


@dataclass(frozen=True)
class PEResult:
    """Aggregated PE output with traceability."""

    total_amount: float
    by_network_product: dict[tuple[str | None, str | None], float]
    row_results: list[PERowAudit]
    parameters: dict[str, float]


def _load_rates() -> tuple[float, float]:
    """Load PE legislative coefficients from config."""

    config = load_yaml_config("src/config/legislative.yaml")
    try:
        pe_config = config["pe"]
        return float(pe_config["positive_result_coefficient"]), float(pe_config["historical_average_coefficient"])
    except Exception as exc:
        LOGGER.error("Failed to load PE coefficients from config: %s", exc)
        raise ValueError("PE legislative coefficients are missing or invalid.") from exc


def _to_float(row: Mapping[str, Any], field_name: str) -> float:
    """Read a canonical numeric field as float."""

    try:
        value = row[field_name]
        if value is None:
            raise ValueError(f"{field_name} is missing.")
        return float(value)
    except Exception as exc:
        LOGGER.error("Failed to read PE field %s=%r: %s", field_name, row.get(field_name), exc)
        raise ValueError(f"Invalid PE field {field_name}: {row.get(field_name)!r}") from exc


def calculate_pe_for_row(
    row: Mapping[str, Any],
    positive_result_coefficient: float,
    historical_average_coefficient: float,
) -> PERowAudit:
    """Calculate PE for one canonical row."""

    try:
        technical_result = _to_float(row, "technical_result")
        claims_charge_n1 = _to_float(row, "claims_charge_n1")
        claims_charge_n2 = _to_float(row, "claims_charge_n2")
        claims_charge_n3 = _to_float(row, "claims_charge_n3")
        historical_average = (claims_charge_n1 + claims_charge_n2 + claims_charge_n3) / 3.0
        positive_result_component = max(0.0, technical_result) * positive_result_coefficient
        historical_average_component = historical_average * historical_average_coefficient
        equalization_provision = 0.0
        if technical_result > 0:
            equalization_provision = min(positive_result_component, historical_average_component)

        audit_row = PERowAudit(
            source_row_number=int(row["_source_row_number"]),
            network=row.get("network"),
            product=row.get("product"),
            fiscal_year=int(row["fiscal_year"]),
            technical_result=technical_result,
            claims_charge_n1=claims_charge_n1,
            claims_charge_n2=claims_charge_n2,
            claims_charge_n3=claims_charge_n3,
            historical_average=historical_average,
            positive_result_component=positive_result_component,
            historical_average_component=historical_average_component,
            equalization_provision=equalization_provision,
        )
        LOGGER.debug("Calculated PE row=%s amount=%s", audit_row.source_row_number, audit_row.equalization_provision)
        return audit_row
    except KeyError as exc:
        LOGGER.error("Missing required PE field: %s", exc)
        raise ValueError(f"Missing required PE field: {exc}") from exc
    except Exception as exc:
        LOGGER.error("Failed to calculate PE for row %r: %s", row.get('_source_row_number'), exc)
        raise


def calculate_pe(
    rows: Sequence[Mapping[str, Any]],
    positive_result_coefficient: float | None = None,
    historical_average_coefficient: float | None = None,
) -> PEResult:
    """Calculate equalization provision for canonical PE rows."""

    try:
        config_positive_result_coefficient, config_historical_average_coefficient = _load_rates()
        positive_result_coefficient = (
            config_positive_result_coefficient
            if positive_result_coefficient is None
            else positive_result_coefficient
        )
        historical_average_coefficient = (
            config_historical_average_coefficient
            if historical_average_coefficient is None
            else historical_average_coefficient
        )

        LOGGER.info("Starting PE calculation for %s rows", len(rows))
        row_results: list[PERowAudit] = []
        by_network_product: dict[tuple[str | None, str | None], float] = {}
        for row in rows:
            audit_row = calculate_pe_for_row(
                row,
                positive_result_coefficient=positive_result_coefficient,
                historical_average_coefficient=historical_average_coefficient,
            )
            row_results.append(audit_row)
            bucket = (audit_row.network, audit_row.product)
            by_network_product[bucket] = by_network_product.get(bucket, 0.0) + audit_row.equalization_provision

        total_amount = sum(item.equalization_provision for item in row_results)
        LOGGER.info("Finished PE calculation total=%s", total_amount)
        return PEResult(
            total_amount=total_amount,
            by_network_product=by_network_product,
            row_results=row_results,
            parameters={
                "positive_result_coefficient": positive_result_coefficient,
                "historical_average_coefficient": historical_average_coefficient,
            },
        )
    except Exception as exc:
        LOGGER.error("PE calculation failed: %s", exc)
        raise
