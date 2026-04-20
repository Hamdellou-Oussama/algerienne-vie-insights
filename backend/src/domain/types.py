"""Typed dataclasses for preprocessing contracts and outputs."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

from src.domain.enums import CleaningPolicy, DataType, RuleCategory, Severity


@dataclass(frozen=True)
class FieldContract:
    """Schema contract for a single raw field."""

    raw_label: str
    canonical_name: str
    data_type: DataType
    nullable: bool
    cleaning_policy: CleaningPolicy
    description: str
    examples: tuple[Any, ...] = ()
    controlled_vocabulary: tuple[str, ...] = ()


@dataclass(frozen=True)
class DatasetContract:
    """Dataset-level contract for workbook ingestion."""

    dataset_name: str
    workbook_path: Path
    sheet_name: str
    header_row: int
    data_start_row: int
    fields: tuple[FieldContract, ...]
    output_sheet_name: str | None = None
    uses_data_only_values: bool = False

    def with_workbook_path(self, workbook_path: Path) -> "DatasetContract":
        """Return a copy of the contract bound to another workbook path."""

        return replace(self, workbook_path=workbook_path)


@dataclass(frozen=True)
class LineageRecord:
    """Atomic raw-to-canonical transformation trace."""

    dataset_name: str
    workbook_name: str
    sheet_name: str
    row_number: int
    column_label: str
    raw_value: Any
    normalized_value: Any
    rule_applied: str
    severity: Severity


@dataclass(frozen=True)
class CleaningEvent:
    """Structured anomaly event for reporting and tests."""

    dataset_name: str
    row_number: int
    field_name: str
    category: RuleCategory
    severity: Severity
    message: str
    raw_value: Any
    normalized_value: Any


@dataclass
class DatasetResult:
    """Canonical dataset plus audit outputs."""

    dataset_name: str
    rows: list[dict[str, Any]] = field(default_factory=list)
    lineage: list[LineageRecord] = field(default_factory=list)
    events: list[CleaningEvent] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class InventorySheet:
    """Workbook sheet inventory snapshot."""

    sheet_name: str
    row_count: int
    column_count: int
    merged_ranges: tuple[str, ...]
    header_row: int
    header_values: tuple[str | None, ...]


@dataclass(frozen=True)
class WorkbookInventory:
    """Inventory output for a workbook."""

    workbook_name: str
    workbook_path: Path
    sha256: str
    sheets: tuple[InventorySheet, ...]
