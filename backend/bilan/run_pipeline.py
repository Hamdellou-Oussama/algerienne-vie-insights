from __future__ import annotations

from pathlib import Path
import json
import shutil
import subprocess
import sys


SCRIPTS = [
    "01_extract_sap_formula_dictionary.py",
    "05_compare_sap_formula_vs_old_logic.py",
    "02_compute_bilan_from_sap.py",
    "03_test_bilan_implementation.py",
    "04_test_sap_formula_reproduction.py",
]

ARTIFACTS = [
    "bilan_2026_computed_from_sap.csv",
    "bilan_2026_summary.json",
    "bilan_2026_table.md",
    "bilan_tests_results.csv",
    "bilan_tests_summary.json",
    "sap_formula_dictionary.json",
    "sap_formula_repro_checks.csv",
    "sap_formula_repro_mismatches.csv",
    "sap_formula_repro_summary.json",
    "sap_formula_vs_old_logic_comparison.csv",
    "sap_formula_vs_old_logic_summary.json",
    "sap_formula_vs_old_logic_report.md",
    "rules_for_bilan.md",
    "level3_bilan_implementation_report.md",
    "run_log.json",
]


def main() -> None:
    audit_dir = Path(__file__).resolve().parents[1]
    delivery_dir = Path(__file__).resolve().parent

    log_rows = []
    has_error = False

    for script_name in SCRIPTS:
        cmd = [sys.executable, str(audit_dir / script_name)]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            has_error = True

        log_rows.append(
            {
                "script": script_name,
                "command": " ".join(cmd),
                "returncode": proc.returncode,
                "status": "ok" if proc.returncode == 0 else "failed",
                "stdout_tail": proc.stdout[-4000:],
                "stderr_tail": proc.stderr[-4000:],
            }
        )
        print(f"{script_name}: {proc.returncode}")

    output_dir = delivery_dir / "outputs"
    output_dir.mkdir(parents=True, exist_ok=True)

    copied = []
    missing = []
    for name in ARTIFACTS:
        src = audit_dir / name
        dst = output_dir / name
        if src.exists():
            shutil.copy2(src, dst)
            copied.append(name)
        else:
            missing.append(name)

    log_payload = {
        "runner": str(Path(__file__).name),
        "audit_dir": str(audit_dir),
        "delivery_dir": str(delivery_dir),
        "scripts": log_rows,
        "copied_artifacts": copied,
        "missing_artifacts": missing,
        "all_ok": not has_error,
    }

    out_log = delivery_dir / "run_log.json"
    out_log.write_text(json.dumps(log_payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote: {out_log}")
    print(f"Copied artifacts: {len(copied)}")
    if missing:
        print(f"Missing artifacts: {len(missing)}")

    if has_error:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
