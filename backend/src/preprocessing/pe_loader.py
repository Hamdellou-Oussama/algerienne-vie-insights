"""PE dataset loader and anomaly summarizer."""

from __future__ import annotations

from pathlib import Path

from src.domain.enums import RuleCategory, Severity
from src.domain.types import CleaningEvent, DatasetResult
from src.preprocessing.base import BaseDatasetLoader
from src.preprocessing.schema_registry import get_dataset_contract


class PELoader(BaseDatasetLoader):
    """Loader for the PE workbook."""

    def __init__(self, workbook_path: Path | None = None) -> None:
        """Initialize the PE loader with its contract."""

        super().__init__(get_dataset_contract("pe", workbook_path=workbook_path))

    def _duplicate_key(self, row: dict[str, object]) -> tuple[object, ...] | None:
        """Return the PE business duplicate key."""

        return (
            row.get("network"),
            row.get("product"),
            row.get("fiscal_year"),
            row.get("guarantee"),
        )

    def _build_metrics(self, result: DatasetResult) -> dict[str, object]:
        """Compute PE-specific anomaly counters."""

        blank_contract_year_count_rows = 0
        negative_technical_result_rows = 0
        positive_equalization_provision_rows = 0

        for row in result.rows:
            if row.get("contract_year_count") is None:
                blank_contract_year_count_rows += 1
                result.events.append(
                    CleaningEvent(
                        dataset_name=result.dataset_name,
                        row_number=row["_source_row_number"],
                        field_name="contract_year_count",
                        category=RuleCategory.BUSINESS_RULE_VALIDATION,
                        severity=Severity.WARNING,
                        message="Contract-year count missing; workbook formula helper treated as optional metadata.",
                        raw_value=row["_raw_values"]["contract_year_count"],
                        normalized_value=None,
                    )
                )
            technical_result = row.get("technical_result")
            if isinstance(technical_result, float) and technical_result < 0:
                negative_technical_result_rows += 1
            provision = row.get("equalization_provision")
            if isinstance(provision, float) and provision > 0:
                positive_equalization_provision_rows += 1

        return {
            "row_count": len(result.rows),
            "blank_contract_year_count_rows": blank_contract_year_count_rows,
            "negative_technical_result_rows": negative_technical_result_rows,
            "positive_equalization_provision_rows": positive_equalization_provision_rows,
            "event_count": len(result.events),
            "lineage_count": len(result.lineage),
        }
