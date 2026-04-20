from __future__ import annotations

from pathlib import Path
import json

import pandas as pd

from common_triangle import build_chain_ladder_data, find_ibnr_workbook


def selected_prior_ultimate(chain_ladder_ult: dict[int, float], dev0: dict[int, float]) -> dict[int, float]:
    # A-priori from mature-year ratio ULT/dev0 (here AY 2022 is fully developed in sample).
    mature_ay = 2022
    ratio = chain_ladder_ult[mature_ay] / dev0[mature_ay]
    return {ay: dev0[ay] * ratio for ay in dev0}


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    workbook = find_ibnr_workbook(root)
    out_dir = Path(__file__).resolve().parent / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    cl = build_chain_ladder_data(workbook)

    # Percent reported q by AY from Chain-Ladder CDF to ultimate.
    dev_max = 3
    q = {}
    dev_to_ult = {}
    for ay in [2022, 2023, 2024, 2025]:
        d_obs = 2025 - ay
        cdf = 1.0
        for d in range(d_obs + 1, dev_max + 1):
            cdf *= cl.factors[d]
        dev_to_ult[ay] = cdf
        q[ay] = 1.0 / cdf

    prior_ult = selected_prior_ultimate(cl.ultimate, {ay: float(cl.cumulative_observed.loc[ay, 0]) for ay in [2022, 2023, 2024, 2025]})

    bf_ult = {}
    bf_ibnr = {}
    for ay in [2022, 2023, 2024, 2025]:
        reported = cl.diagonal[ay]
        bf_ibnr[ay] = (1.0 - q[ay]) * prior_ult[ay]
        bf_ult[ay] = reported + bf_ibnr[ay]

    df = pd.DataFrame(
        {
            "AY": [2022, 2023, 2024, 2025],
            "reported_diag": [cl.diagonal[a] for a in [2022, 2023, 2024, 2025]],
            "q_percent_reported": [q[a] for a in [2022, 2023, 2024, 2025]],
            "prior_ultimate": [prior_ult[a] for a in [2022, 2023, 2024, 2025]],
            "ultimate_bf": [bf_ult[a] for a in [2022, 2023, 2024, 2025]],
            "ibnr_bf": [bf_ibnr[a] for a in [2022, 2023, 2024, 2025]],
            "ultimate_chain_ladder": [cl.ultimate[a] for a in [2022, 2023, 2024, 2025]],
            "ibnr_chain_ladder": [cl.ibnr[a] for a in [2022, 2023, 2024, 2025]],
        }
    )
    df.to_csv(out_dir / "bornhuetter_ferguson_results.csv", index=False)

    payload = {
        "method": "Bornhuetter-Ferguson",
        "prior_basis": "Mature AY ult/dev0 ratio from sample",
        "total_ibnr_bf": float(df["ibnr_bf"].sum()),
        "total_ibnr_chain_ladder": float(df["ibnr_chain_ladder"].sum()),
        "difference_vs_chain_ladder": float(df["ibnr_bf"].sum() - df["ibnr_chain_ladder"].sum()),
    }
    with open(out_dir / "bornhuetter_ferguson_summary.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("[BF] total IBNR:", f"{df['ibnr_bf'].sum():,.2f}")
    print("[BF] chain ladder total IBNR:", f"{df['ibnr_chain_ladder'].sum():,.2f}")


if __name__ == "__main__":
    main()
