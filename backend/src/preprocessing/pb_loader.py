"""PB (Participation Bénéficiaire) dataset loader."""

from __future__ import annotations

from pathlib import Path

from src.domain.enums import RuleCategory, Severity
from src.domain.types import CleaningEvent, DatasetResult
from src.preprocessing.base import BaseDatasetLoader
from src.preprocessing.schema_registry import get_dataset_contract


class PBLoader(BaseDatasetLoader):
    """Loader for the PB workbook (ÉCHANTILLON DATA PB)."""

    def __init__(self, workbook_path: Path | None = None) -> None:
        super().__init__(get_dataset_contract("pb", workbook_path=workbook_path))

    def _duplicate_key(self, row: dict) -> tuple | None:
        return (row.get("client_code"), row.get("policy_id"))

    def _build_metrics(self, result: DatasetResult) -> dict:
        ineligible_loss_ratio_rows = 0
        non_positive_credit_balance_rows = 0
        positive_pb_rows = 0

        for row in result.rows:
            sp = row.get("loss_ratio")
            threshold = row.get("loss_ratio_threshold")
            balance = row.get("credit_balance_wb")
            pb = row.get("participation_beneficiaire_wb")

            if isinstance(sp, float) and isinstance(threshold, float) and sp > threshold:
                ineligible_loss_ratio_rows += 1
                result.events.append(
                    CleaningEvent(
                        dataset_name=result.dataset_name,
                        row_number=row["_source_row_number"],
                        field_name="loss_ratio",
                        category=RuleCategory.BUSINESS_RULE_VALIDATION,
                        severity=Severity.INFO,
                        message=f"S/P={sp} exceeds threshold={threshold}; contract ineligible for PB.",
                        raw_value=row["_raw_values"]["loss_ratio"],
                        normalized_value=sp,
                    )
                )

            if isinstance(balance, float) and balance <= 0:
                non_positive_credit_balance_rows += 1

            if isinstance(pb, float) and pb > 0:
                positive_pb_rows += 1

        return {
            "row_count": len(result.rows),
            "ineligible_loss_ratio_rows": ineligible_loss_ratio_rows,
            "non_positive_credit_balance_rows": non_positive_credit_balance_rows,
            "positive_pb_rows": positive_pb_rows,
            "event_count": len(result.events),
            "lineage_count": len(result.lineage),
        }
