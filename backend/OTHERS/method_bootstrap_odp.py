from __future__ import annotations

from pathlib import Path
import json

import numpy as np
import pandas as pd

from common_triangle import build_chain_ladder_data, find_ibnr_workbook, to_cumulative_observed


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    workbook = find_ibnr_workbook(root)
    out_dir = Path(__file__).resolve().parent / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)

    cl = build_chain_ladder_data(workbook)
    inc = cl.incremental.copy()
    cum_obs = cl.cumulative_observed.copy()

    # Build fitted incremental from chain-ladder projected cumulative.
    proj_cum = cl.projected_cumulative.copy()
    fitted_inc = proj_cum.copy()
    for ay in fitted_inc.index:
        for d in fitted_inc.columns:
            if d == 0:
                fitted_inc.loc[ay, d] = proj_cum.loc[ay, d]
            else:
                fitted_inc.loc[ay, d] = proj_cum.loc[ay, d] - proj_cum.loc[ay, d - 1]

    # Pearson residuals on observed cells only.
    obs_mask = ~cum_obs.isna()
    inc_obs = inc.where(obs_mask)
    fitted_obs = fitted_inc.where(obs_mask)
    resid = (inc_obs - fitted_obs) / np.sqrt(fitted_obs.clip(lower=1e-9))
    resid_vals = resid.stack().dropna().values
    resid_vals = resid_vals[np.isfinite(resid_vals)]

    rng = np.random.default_rng(42)
    n_sim = 1000
    totals = []

    for _ in range(n_sim):
        # Resample residuals and rebuild pseudo incremental on observed cells.
        sampled = rng.choice(resid_vals, size=int(obs_mask.sum().sum()), replace=True)
        pseudo = inc.copy()
        k = 0
        for ay in inc.index:
            for d in inc.columns:
                if bool(obs_mask.loc[ay, d]):
                    mu = float(fitted_obs.loc[ay, d])
                    pseudo.loc[ay, d] = max(0.0, mu + sampled[k] * np.sqrt(max(mu, 1e-9)))
                    k += 1
                else:
                    pseudo.loc[ay, d] = np.nan

        # Re-estimate CL on pseudo data.
        pseudo_cum = to_cumulative_observed(pseudo)
        f1 = float(pseudo_cum.loc[[2022, 2023, 2024], 1].sum() / pseudo_cum.loc[[2022, 2023, 2024], 0].sum())
        f2 = float(pseudo_cum.loc[[2022, 2023], 2].sum() / pseudo_cum.loc[[2022, 2023], 1].sum())
        f3 = float(pseudo_cum.loc[[2022], 3].sum() / pseudo_cum.loc[[2022], 2].sum())
        factors = {1: f1, 2: f2, 3: f3}

        proj = pseudo_cum.copy()
        for ay in proj.index:
            for d in [1, 2, 3]:
                if pd.isna(proj.loc[ay, d]):
                    proj.loc[ay, d] = float(proj.loc[ay, d - 1]) * factors[d]

        total = 0.0
        for ay in [2022, 2023, 2024, 2025]:
            d_obs = 2025 - ay
            total += float(proj.loc[ay, 3] - pseudo_cum.loc[ay, d_obs])
        totals.append(total)

    s = pd.Series(totals)
    stats = {
        "method": "Bootstrap ODP-like (residual resampling)",
        "n_sim": n_sim,
        "mean_total_ibnr": float(s.mean()),
        "std_total_ibnr": float(s.std(ddof=1)),
        "p50": float(s.quantile(0.50)),
        "p75": float(s.quantile(0.75)),
        "p90": float(s.quantile(0.90)),
        "p95": float(s.quantile(0.95)),
        "p99": float(s.quantile(0.99)),
    }

    s.to_csv(out_dir / "bootstrap_total_ibnr_distribution.csv", index=False, header=["total_ibnr"])
    with open(out_dir / "bootstrap_summary.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    print("[Bootstrap] mean total IBNR:", f"{stats['mean_total_ibnr']:,.2f}")
    print("[Bootstrap] std total IBNR:", f"{stats['std_total_ibnr']:,.2f}")
    print("[Bootstrap] p95 total IBNR:", f"{stats['p95']:,.2f}")


if __name__ == "__main__":
    main()
