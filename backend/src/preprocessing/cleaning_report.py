"""Cleaning report generation utilities."""

from __future__ import annotations

from collections import Counter
import json
import logging
from pathlib import Path

from src.domain.types import DatasetResult

LOGGER = logging.getLogger(__name__)


def build_cleaning_summary(results: dict[str, DatasetResult]) -> dict[str, object]:
    """Build a structured cleaning summary across datasets."""

    datasets: dict[str, object] = {}
    for dataset_name, result in results.items():
        severity_counts = Counter(event.severity.value for event in result.events)
        category_counts = Counter(event.category.value for event in result.events)
        datasets[dataset_name] = {
            "row_count": len(result.rows),
            "lineage_count": len(result.lineage),
            "event_count": len(result.events),
            "severity_counts": dict(severity_counts),
            "category_counts": dict(category_counts),
            "metrics": result.metrics,
        }
    return {"datasets": datasets}


def write_cleaning_report(results: dict[str, DatasetResult], output_dir: Path) -> tuple[Path, Path]:
    """Write markdown and JSON cleaning summaries."""

    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        summary = build_cleaning_summary(results)
        markdown_path = output_dir / "cleaning_report.md"
        json_path = output_dir / "cleaning_report.json"

        lines = ["# Cleaning Report", ""]
        for dataset_name, payload in summary["datasets"].items():
            lines.append(f"## {dataset_name.upper()}")
            lines.append(f"- rows: {payload['row_count']}")
            lines.append(f"- lineage records: {payload['lineage_count']}")
            lines.append(f"- cleaning events: {payload['event_count']}")
            lines.append(f"- metrics: `{json.dumps(payload['metrics'], ensure_ascii=False, sort_keys=True)}`")
            lines.append("")

        markdown_path.write_text("\n".join(lines), encoding="utf-8")
        json_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        LOGGER.info("Wrote cleaning report to %s and %s", markdown_path, json_path)
        return markdown_path, json_path
    except Exception as exc:
        LOGGER.error("Failed to write cleaning report: %s", exc)
        raise
