from __future__ import annotations

from pathlib import Path
import json

import pandas as pd

from common_triangle import build_chain_ladder_data, find_ibnr_workbook


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    workbook = find_ibnr_workbook(root)
    out_dir = Path(__file__).resolve().parent / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    cl = build_chain_ladder_data(workbook)

    # Cape Cod needs exposure/premium by AY; not present in base ADE directly.
    cfg_path = Path(__file__).resolve().parent / "config_cape_cod_exposure.csv"
    if not cfg_path.exists():
        payload = {
            "method": "Cape Cod",
            "status": "skipped",
            "reason": "Exposure/premium by AY not available in base ADE. Provide config_cape_cod_exposure.csv with AY,exposure columns.",
        }
        with open(out_dir / "cape_cod_summary.json", "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        print("[Cape Cod] SKIPPED - missing config_cape_cod_exposure.csv")
        return

    exp = pd.read_csv(cfg_path)
    exp = exp.set_index("AY")["exposure"].to_dict()

    # Percent unreported by AY from CL factors.
    unreported = {}
    for ay in [2022, 2023, 2024, 2025]:
        d_obs = 2025 - ay
        cdf = 1.0
        for d in range(d_obs + 1, 4):
            cdf *= cl.factors[d]
        unreported[ay] = 1.0 - (1.0 / cdf)

    # Cape Cod expected loss ratio estimate from observed reported and weighted reported proportion.
    num = sum(cl.diagonal[ay] for ay in [2022, 2023, 2024, 2025])
    den = sum(exp[ay] * (1.0 - unreported[ay]) for ay in [2022, 2023, 2024, 2025])
    elr = num / den if den != 0 else 0.0

    rows = []
    for ay in [2022, 2023, 2024, 2025]:
        ult = exp[ay] * elr
        ibnr = ult - cl.diagonal[ay]
        rows.append({"AY": ay, "exposure": exp[ay], "ultimate_cape_cod": ult, "ibnr_cape_cod": ibnr})

    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "cape_cod_results.csv", index=False)
    payload = {
        "method": "Cape Cod",
        "status": "ok",
        "elr": elr,
        "total_ibnr_cape_cod": float(df["ibnr_cape_cod"].sum()),
    }
    with open(out_dir / "cape_cod_summary.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("[Cape Cod] total IBNR:", f"{df['ibnr_cape_cod'].sum():,.2f}")


if __name__ == "__main__":
    main()
