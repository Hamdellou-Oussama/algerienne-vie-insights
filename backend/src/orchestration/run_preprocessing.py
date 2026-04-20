"""Run preprocessing, workbook inventory, and cleaning report generation."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from src.preprocessing.cleaning_report import write_cleaning_report
from src.preprocessing.ibnr_loader import IBNRLoader
from src.preprocessing.pb_loader import PBLoader
from src.preprocessing.pe_loader import PELoader
from src.preprocessing.ppna_loader import PPNALoader
from src.preprocessing.sap_loader import SAPLoader
from src.preprocessing.workbook_inventory import inventory_all_workbooks, write_inventory_report

LOGGER = logging.getLogger(__name__)
ROOT = Path(__file__).resolve().parents[2]


def configure_logging() -> None:
    """Configure standard logging for orchestration commands."""

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def run_preprocessing(output_root: Path | None = None) -> dict[str, object]:
    """Run all active dataset preprocessors and write reports."""

    docs_root = output_root if output_root is not None else ROOT / "docs"
    inventories = inventory_all_workbooks()
    inventory_path = write_inventory_report(docs_root / "data_inventory" / "raw_workbook_inventory.md", inventories)

    results = {
        "ppna": PPNALoader().load(),
        "sap": SAPLoader().load(),
        "pe": PELoader().load(),
        "pb": PBLoader().load(),
        "ibnr": IBNRLoader().load(),
    }
    cleaning_markdown_path, cleaning_json_path = write_cleaning_report(results, docs_root / "validation_reports")

    summary = {
        "inventory_report": str(inventory_path),
        "cleaning_report_markdown": str(cleaning_markdown_path),
        "cleaning_report_json": str(cleaning_json_path),
        "dataset_metrics": {name: result.metrics for name, result in results.items()},
    }
    summary_path = docs_root / "validation_reports" / "preprocessing_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    LOGGER.info("Wrote preprocessing summary to %s", summary_path)
    return summary


def main() -> None:
    """CLI entry point for preprocessing orchestration."""

    parser = argparse.ArgumentParser(description="Run preprocessing inventory and cleaning report generation.")
    parser.parse_args()
    configure_logging()
    summary = run_preprocessing()
    print(json.dumps(summary, indent=2, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
