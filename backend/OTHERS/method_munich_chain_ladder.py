from __future__ import annotations

from pathlib import Path
import json


def main() -> None:
    out_dir = Path(__file__).resolve().parent / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Munich Chain-Ladder requires at least paired paid and incurred triangles.
    payload = {
        "method": "Munich Chain Ladder",
        "status": "skipped",
        "reason": "Method requires paired paid and incurred triangles by AY/dev. Current base ADE provides one amount basis only.",
    }
    with open(out_dir / "munich_chain_ladder_summary.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("[Munich CL] SKIPPED - missing paired paid/incurred triangles")


if __name__ == "__main__":
    main()
