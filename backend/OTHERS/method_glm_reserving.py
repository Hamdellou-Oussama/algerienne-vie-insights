from __future__ import annotations

from pathlib import Path
import json


def main() -> None:
    out_dir = Path(__file__).resolve().parent / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    # GLM reserving generally needs richer structure (counts/exposure, calendar effects,
    # and potentially paid/incurred decomposition). Not available in current base ADE.
    payload = {
        "method": "GLM Reserving",
        "status": "skipped",
        "reason": "Requires richer covariates/exposure and model specification not present in current base ADE triangle.",
    }
    with open(out_dir / "glm_reserving_summary.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("[GLM] SKIPPED - missing covariates/exposure for model fitting")


if __name__ == "__main__":
    main()
