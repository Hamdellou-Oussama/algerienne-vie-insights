"""SAP dataset loader and anomaly summarizer."""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from src.domain.enums import RuleCategory, Severity
from src.domain.types import CleaningEvent, DatasetResult
from src.preprocessing.base import BaseDatasetLoader
from src.preprocessing.schema_registry import get_dataset_contract


class SAPLoader(BaseDatasetLoader):
    """Loader for the SAP workbook claim sheet."""

    def __init__(self, workbook_path: Path | None = None) -> None:
        """Initialize the SAP loader with its contract."""

        super().__init__(get_dataset_contract("sap", workbook_path=workbook_path))

    def _duplicate_key(self, row: dict[str, object]) -> tuple[object, ...] | None:
        """Return the SAP business duplicate key."""

        return (
            row.get("claim_id"),
            row.get("adhesion_id"),
            row.get("declaration_date"),
            row.get("sap_closing_amount"),
        )

    def _build_metrics(self, result: DatasetResult) -> dict[str, object]:
        """Compute SAP-specific anomaly counters."""

        status_counts = Counter()
        missing_insured_birth_date = 0
        missing_beneficiary_birth_date = 0

        for row in result.rows:
            status = row.get("status")
            if status is not None:
                status_counts[str(status).upper()] += 1
            if row.get("insured_birth_date") is None:
                missing_insured_birth_date += 1
                result.events.append(
                    CleaningEvent(
                        dataset_name=result.dataset_name,
                        row_number=row["_source_row_number"],
                        field_name="insured_birth_date",
                        category=RuleCategory.MANUAL_REVIEW_REQUIRED,
                        severity=Severity.WARNING,
                        message="Missing insured birth date retained for quality reporting.",
                        raw_value=row["_raw_values"]["insured_birth_date"],
                        normalized_value=None,
                    )
                )
            if row.get("beneficiary_birth_date") is None:
                missing_beneficiary_birth_date += 1
                result.events.append(
                    CleaningEvent(
                        dataset_name=result.dataset_name,
                        row_number=row["_source_row_number"],
                        field_name="beneficiary_birth_date",
                        category=RuleCategory.MANUAL_REVIEW_REQUIRED,
                        severity=Severity.WARNING,
                        message="Missing beneficiary birth date retained for quality reporting.",
                        raw_value=row["_raw_values"]["beneficiary_birth_date"],
                        normalized_value=None,
                    )
                )

        return {
            "row_count": len(result.rows),
            "status_counts": dict(status_counts),
            "missing_insured_birth_date_rows": missing_insured_birth_date,
            "missing_beneficiary_birth_date_rows": missing_beneficiary_birth_date,
            "event_count": len(result.events),
            "lineage_count": len(result.lineage),
        }
