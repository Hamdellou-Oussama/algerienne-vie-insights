"""IBNR dataset loader and anomaly summarizer."""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from src.domain.enums import RuleCategory, Severity
from src.domain.types import CleaningEvent, DatasetResult
from src.preprocessing.base import BaseDatasetLoader
from src.preprocessing.schema_registry import get_dataset_contract


class IBNRLoader(BaseDatasetLoader):
    """Loader for the IBNR workbook claim sheet."""

    def __init__(self, workbook_path: Path | None = None) -> None:
        """Initialize the IBNR loader with its contract."""

        super().__init__(get_dataset_contract("ibnr", workbook_path=workbook_path))

    def _duplicate_key(self, row: dict[str, object]) -> tuple[object, ...] | None:
        """Return the IBNR business duplicate key."""

        return (row.get("claim_id"),)

    def _build_metrics(self, result: DatasetResult) -> dict[str, object]:
        """Compute IBNR-specific anomaly counters."""

        product_counts: Counter[str] = Counter()
        occurrence_year_counts: Counter[int] = Counter()
        impossible_lag_rows = 0
        lag_mismatch_rows = 0

        for row in result.rows:
            product = row.get("product")
            if product is not None:
                product_counts[str(product)] += 1
            occ = row.get("occurrence_year")
            if occ is not None:
                occurrence_year_counts[int(occ)] += 1

            occ_year = row.get("occurrence_year")
            decl_year = row.get("declaration_year")
            if occ_year is not None and decl_year is not None:
                computed_lag = int(decl_year) - int(occ_year)
                if computed_lag < 0:
                    impossible_lag_rows += 1
                    result.events.append(
                        CleaningEvent(
                            dataset_name=result.dataset_name,
                            row_number=row["_source_row_number"],
                            field_name="declaration_year",
                            category=RuleCategory.BUSINESS_RULE_VALIDATION,
                            severity=Severity.ERROR,
                            message=(
                                f"declaration_year={decl_year} < occurrence_year={occ_year}: "
                                "impossible development lag."
                            ),
                            raw_value=row["_raw_values"].get("declaration_year"),
                            normalized_value=decl_year,
                        )
                    )
                stored_lag = row.get("development_lag_years")
                if stored_lag is not None and int(stored_lag) != computed_lag:
                    lag_mismatch_rows += 1
                    result.events.append(
                        CleaningEvent(
                            dataset_name=result.dataset_name,
                            row_number=row["_source_row_number"],
                            field_name="development_lag_years",
                            category=RuleCategory.BUSINESS_RULE_VALIDATION,
                            severity=Severity.WARNING,
                            message=(
                                f"Stored development lag {stored_lag} != computed lag {computed_lag} "
                                f"(decl_year {decl_year} - occ_year {occ_year})."
                            ),
                            raw_value=row["_raw_values"].get("development_lag_years"),
                            normalized_value=computed_lag,
                        )
                    )

        return {
            "row_count": len(result.rows),
            "product_counts": dict(product_counts),
            "occurrence_year_counts": dict(sorted(occurrence_year_counts.items())),
            "impossible_lag_rows": impossible_lag_rows,
            "lag_mismatch_rows": lag_mismatch_rows,
            "event_count": len(result.events),
            "lineage_count": len(result.lineage),
        }
