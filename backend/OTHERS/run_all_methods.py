from __future__ import annotations

from pathlib import Path
import subprocess
import sys
import json

METHOD_SCRIPTS = [
    "method_chain_ladder.py",
    "method_mack_chain_ladder.py",
    "method_bornhuetter_ferguson.py",
    "method_benktander.py",
    "method_bootstrap_odp.py",
    "method_cape_cod.py",
    "method_munich_chain_ladder.py",
    "method_glm_reserving.py",
]


def main() -> None:
    here = Path(__file__).resolve().parent
    out_dir = here / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for script in METHOD_SCRIPTS:
        cmd = [sys.executable, str(here / script)]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        results.append(
            {
                "script": script,
                "returncode": proc.returncode,
                "stdout": proc.stdout[-4000:],
                "stderr": proc.stderr[-4000:],
                "status": "ok" if proc.returncode == 0 else "failed",
            }
        )
        print(f"[{script}] -> returncode={proc.returncode}")

    with open(out_dir / "run_all_methods_log.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Build compact comparison from summaries when present.
    comparison = []
    summary_files = sorted(out_dir.glob("*_summary.json"))
    for sf in summary_files:
        try:
            payload = json.loads(sf.read_text(encoding="utf-8"))
            row = {"summary_file": sf.name}
            row.update(payload)
            comparison.append(row)
        except Exception:
            continue

    with open(out_dir / "methods_comparison.json", "w", encoding="utf-8") as f:
        json.dump(comparison, f, indent=2)

    print("Wrote:", out_dir / "run_all_methods_log.json")
    print("Wrote:", out_dir / "methods_comparison.json")


if __name__ == "__main__":
    main()
