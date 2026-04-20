"""Lineage helpers for raw-to-canonical transformations."""

from __future__ import annotations

from src.domain.enums import Severity
from src.domain.types import LineageRecord


def build_lineage_record(
    dataset_name: str,
    workbook_name: str,
    sheet_name: str,
    row_number: int,
    column_label: str,
    raw_value: object,
    normalized_value: object,
    rule_applied: str,
    severity: Severity,
) -> LineageRecord:
    """Create a standardized lineage record."""

    return LineageRecord(
        dataset_name=dataset_name,
        workbook_name=workbook_name,
        sheet_name=sheet_name,
        row_number=row_number,
        column_label=column_label,
        raw_value=raw_value,
        normalized_value=normalized_value,
        rule_applied=rule_applied,
        severity=severity,
    )
