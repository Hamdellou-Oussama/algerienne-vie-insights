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

    # Build percent reported q from Chain-Ladder CDF.
    q = {}
    for ay in [2022, 2023, 2024, 2025]:
        d_obs = 2025 - ay
        cdf = 1.0
        for d in range(d_obs + 1, 4):
            cdf *= cl.factors[d]
        q[ay] = 1.0 / cdf

    # Prior ultimate: same mature-ratio prior used for BF.
    ratio = cl.ultimate[2022] / float(cl.cumulative_observed.loc[2022, 0])
    prior = {ay: float(cl.cumulative_observed.loc[ay, 0]) * ratio for ay in [2022, 2023, 2024, 2025]}

    # Benktander k=2: U1 = R + (1-q)*prior ; U2 = R + (1-q)*U1
    rows = []
    for ay in [2022, 2023, 2024, 2025]:
        R = cl.diagonal[ay]
        U1 = R + (1.0 - q[ay]) * prior[ay]
        U2 = R + (1.0 - q[ay]) * U1
        ibnr_bk = U2 - R
        rows.append(
            {
                "AY": ay,
                "reported_diag": R,
                "q_percent_reported": q[ay],
                "prior_ultimate": prior[ay],
                "ultimate_benktander_k2": U2,
                "ibnr_benktander_k2": ibnr_bk,
                "ibnr_chain_ladder": cl.ibnr[ay],
            }
        )

    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "benktander_results.csv", index=False)

    payload = {
        "method": "Benktander k=2",
        "total_ibnr_benktander": float(df["ibnr_benktander_k2"].sum()),
        "total_ibnr_chain_ladder": float(df["ibnr_chain_ladder"].sum()),
        "difference_vs_chain_ladder": float(df["ibnr_benktander_k2"].sum() - df["ibnr_chain_ladder"].sum()),
    }
    with open(out_dir / "benktander_summary.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("[Benktander] total IBNR:", f"{df['ibnr_benktander_k2'].sum():,.2f}")
    print("[Benktander] chain ladder total IBNR:", f"{df['ibnr_chain_ladder'].sum():,.2f}")


if __name__ == "__main__":
    main()
