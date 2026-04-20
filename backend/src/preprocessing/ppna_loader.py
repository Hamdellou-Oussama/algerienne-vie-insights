"""PPNA dataset loader and anomaly summarizer."""

from __future__ import annotations

from pathlib import Path

from src.domain.enums import RuleCategory, Severity
from src.domain.types import CleaningEvent, DatasetResult
from src.preprocessing.base import BaseDatasetLoader
from src.preprocessing.schema_registry import get_dataset_contract


class PPNALoader(BaseDatasetLoader):
    """Loader for the PPNA production sheet."""

    def __init__(self, workbook_path: Path | None = None) -> None:
        """Initialize the PPNA loader with its contract."""

        super().__init__(get_dataset_contract("ppna", workbook_path=workbook_path))

    def _duplicate_key(self, row: dict[str, object]) -> tuple[object, ...] | None:
        """Return the PPNA business duplicate key."""

        return (
            row.get("network"),
            row.get("product"),
            row.get("policy_endorsement_id"),
            row.get("policy_id"),
            row.get("insured_id"),
            row.get("effect_date"),
            row.get("expiry_date"),
            row.get("net_premium"),
        )

    def _build_metrics(self, result: DatasetResult) -> dict[str, object]:
        """Compute PPNA-specific anomaly counters."""

        negative_premium_rows = 0
        zero_premium_rows = 0
        string_date_rows = 0

        for row in result.rows:
            raw = row["_raw_values"]
            if isinstance(row["net_premium"], float) and row["net_premium"] < 0:
                negative_premium_rows += 1
                result.events.append(
                    CleaningEvent(
                        dataset_name=result.dataset_name,
                        row_number=row["_source_row_number"],
                        field_name="net_premium",
                        category=RuleCategory.RANGE_VALIDATION,
                        severity=Severity.WARNING,
                        message="Negative premium retained and flagged for business review.",
                        raw_value=raw["net_premium"],
                        normalized_value=row["net_premium"],
                    )
                )
            if row["net_premium"] == 0:
                zero_premium_rows += 1
                result.events.append(
                    CleaningEvent(
                        dataset_name=result.dataset_name,
                        row_number=row["_source_row_number"],
                        field_name="net_premium",
                        category=RuleCategory.BUSINESS_RULE_VALIDATION,
                        severity=Severity.WARNING,
                        message="Zero premium retained for explicit PPNA treatment.",
                        raw_value=raw["net_premium"],
                        normalized_value=row["net_premium"],
                    )
                )
            if any(isinstance(raw[field], str) for field in ("subscription_date", "effect_date", "expiry_date")):
                string_date_rows += 1

        return {
            "row_count": len(result.rows),
            "negative_premium_rows": negative_premium_rows,
            "zero_premium_rows": zero_premium_rows,
            "string_date_rows": string_date_rows,
            "event_count": len(result.events),
            "lineage_count": len(result.lineage),
        }
