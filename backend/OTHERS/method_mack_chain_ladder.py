from __future__ import annotations

from pathlib import Path
import json

import numpy as np
import pandas as pd

from common_triangle import build_chain_ladder_data, find_ibnr_workbook


def estimate_sigma2(cum_obs: pd.DataFrame, factors: dict[int, float]) -> dict[int, float]:
    sigma2 = {}
    # dev transitions: 0->1, 1->2, 2->3 mapped as d=1..3
    for d in [1, 2, 3]:
        from_d = d - 1
        ays = [ay for ay in cum_obs.index if pd.notna(cum_obs.loc[ay, d]) and pd.notna(cum_obs.loc[ay, from_d])]
        if len(ays) <= 1:
            sigma2[d] = np.nan
            continue
        vals = []
        for ay in ays:
            c_prev = float(cum_obs.loc[ay, from_d])
            f_ij = float(cum_obs.loc[ay, d]) / c_prev
            vals.append(c_prev * (f_ij - factors[d]) ** 2)
        sigma2[d] = float(sum(vals) / (len(ays) - 1))
    return sigma2


def mack_mse_for_ay(ay: int, cum_obs: pd.DataFrame, factors: dict[int, float], sigma2: dict[int, float]) -> float:
    # Approximate Mack process variance for reserve from observed dev to ultimate.
    d_obs = 2025 - ay
    c_obs = float(cum_obs.loc[ay, d_obs])
    prod_tail = 1.0
    mse = 0.0
    for d in range(d_obs + 1, 4):
        prod_tail *= factors[d]
        if np.isnan(sigma2[d]):
            continue
        mse += (prod_tail ** 2) * sigma2[d] / c_obs
    return float((c_obs ** 2) * mse)


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    workbook = find_ibnr_workbook(root)
    out_dir = Path(__file__).resolve().parent / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    cl = build_chain_ladder_data(workbook)
    sigma2 = estimate_sigma2(cl.cumulative_observed, cl.factors)

    rows = []
    for ay in [2022, 2023, 2024, 2025]:
        mse = mack_mse_for_ay(ay, cl.cumulative_observed, cl.factors, sigma2)
        se = float(np.sqrt(mse)) if mse >= 0 else np.nan
        rows.append(
            {
                "AY": ay,
                "ibnr_chain_ladder": cl.ibnr[ay],
                "mack_mse": mse,
                "mack_se": se,
                "cv": se / cl.ibnr[ay] if cl.ibnr[ay] != 0 else np.nan,
            }
        )

    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "mack_chain_ladder_results.csv", index=False)

    payload = {
        "method": "Mack Chain Ladder",
        "sigma2": sigma2,
        "total_ibnr": float(df["ibnr_chain_ladder"].sum()),
        "total_mack_se_naive_root_sum_sq": float(np.sqrt((df["mack_se"].fillna(0.0) ** 2).sum())),
    }
    with open(out_dir / "mack_chain_ladder_summary.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print("[Mack] sigma2:", sigma2)
    print("[Mack] total IBNR:", f"{df['ibnr_chain_ladder'].sum():,.2f}")


if __name__ == "__main__":
    main()
