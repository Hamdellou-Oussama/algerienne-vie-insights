"""Bootstrap ODP IBNR distribution estimation layered on an existing IBNRResult."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import numpy as np

from src.config import load_yaml_config
from src.provisions.ibnr import IBNRResult

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class BootstrapResult:
    """Bootstrap ODP stochastic IBNR distribution."""

    method: str
    n_sim: int
    random_seed: int
    mean_total_ibnr: float
    std_total_ibnr: float
    percentiles: dict[int, float]
    chain_ladder_total: float
    parameters: dict[str, Any]
    simulated_totals: list[float]


def _load_bootstrap_config() -> dict[str, Any]:
    config = load_yaml_config("src/config/legislative.yaml")
    return config["ibnr"]["bootstrap_odp"]


def calculate_bootstrap(
    ibnr_result: IBNRResult,
    config: dict[str, Any] | None = None,
) -> BootstrapResult:
    """Simulate IBNR distribution via Pearson residual resampling (ODP approximation).

    Re-estimates CL factors on each pseudo-dataset to propagate parameter uncertainty.
    """

    LOGGER.info("Starting Bootstrap ODP simulation.")
    if config is None:
        config = _load_bootstrap_config()

    n_sim = int(config.get("n_sim", 1000))
    seed = int(config.get("random_seed", 42))
    percentile_levels: list[int] = list(config.get("percentiles", [50, 75, 90, 95, 99]))

    closing_year = ibnr_result.closing_year
    dev_max = ibnr_result.max_development_year
    occurrence_years = sorted({c.occurrence_year for c in ibnr_result.triangle_cells})
    min_occ = min(occurrence_years)

    # Build observed incremental and projected cumulative as 2-D arrays indexed by (occ, dev).
    cell_map: dict[tuple[int, int], Any] = {
        (c.occurrence_year, c.development_year): c
        for c in ibnr_result.triangle_cells
    }

    n_ay = len(occurrence_years)
    n_dev = dev_max + 1
    ay_idx = {ay: i for i, ay in enumerate(occurrence_years)}

    inc_obs = np.full((n_ay, n_dev), np.nan)
    fitted_cum = np.full((n_ay, n_dev), np.nan)
    observed_mask = np.zeros((n_ay, n_dev), dtype=bool)

    for (ay, d), cell in cell_map.items():
        i, j = ay_idx[ay], d
        fitted_cum[i, j] = cell.cumulative_amount
        if cell.is_known and not cell.is_projected:
            observed_mask[i, j] = True
            inc_obs[i, j] = cell.incremental_amount

    # Fitted incremental (from projected cumulative).
    fitted_inc = np.zeros_like(fitted_cum)
    for j in range(n_dev):
        if j == 0:
            fitted_inc[:, j] = fitted_cum[:, j]
        else:
            fitted_inc[:, j] = fitted_cum[:, j] - fitted_cum[:, j - 1]

    # Pearson residuals on observed cells.
    safe_fitted = np.where(fitted_inc > 0, fitted_inc, 1e-9)
    resid = np.where(observed_mask, (inc_obs - fitted_inc) / np.sqrt(safe_fitted), np.nan)
    resid_vals = resid[np.isfinite(resid)]
    LOGGER.debug("Bootstrap: %s finite residuals, n_sim=%s", len(resid_vals), n_sim)

    if len(resid_vals) == 0:
        raise ValueError("No finite Pearson residuals; cannot run Bootstrap simulation.")

    rng = np.random.default_rng(seed)
    n_obs_cells = int(observed_mask.sum())
    totals: list[float] = []

    for sim_idx in range(n_sim):
        sampled = rng.choice(resid_vals, size=n_obs_cells, replace=True)
        pseudo_inc = inc_obs.copy()
        k = 0
        for i in range(n_ay):
            for j in range(n_dev):
                if observed_mask[i, j]:
                    mu = float(fitted_inc[i, j])
                    pseudo_inc[i, j] = max(0.0, mu + sampled[k] * np.sqrt(max(mu, 1e-9)))
                    k += 1

        # Rebuild pseudo cumulative from pseudo incremental (observed cells only).
        pseudo_cum = np.full((n_ay, n_dev), np.nan)
        for i in range(n_ay):
            running = 0.0
            for j in range(n_dev):
                if observed_mask[i, j]:
                    running += float(pseudo_inc[i, j])
                    pseudo_cum[i, j] = running
                else:
                    break

        # Re-estimate CL factors on pseudo data using same volume-weighted formula.
        sim_factors: dict[int, float] = {}
        for j in range(1, n_dev):
            valid_mask = np.isfinite(pseudo_cum[:, j]) & np.isfinite(pseudo_cum[:, j - 1])
            if not valid_mask.any():
                sim_factors[j] = ibnr_result.development_factors[j - 1].factor if j - 1 < len(ibnr_result.development_factors) else 1.0
                continue
            num = float(pseudo_cum[valid_mask, j].sum())
            den = float(pseudo_cum[valid_mask, j - 1].sum())
            sim_factors[j] = (num / den) if den != 0 else 1.0

        # Project and compute total IBNR for this simulation.
        proj_cum = pseudo_cum.copy()
        for i in range(n_ay):
            for j in range(1, n_dev):
                if not np.isfinite(proj_cum[i, j]):
                    prev = proj_cum[i, j - 1]
                    proj_cum[i, j] = float(prev) * sim_factors.get(j, 1.0) if np.isfinite(prev) else np.nan

        total_sim = 0.0
        for i, ay in enumerate(occurrence_years):
            d_obs = closing_year - ay
            diag = pseudo_cum[i, d_obs] if np.isfinite(pseudo_cum[i, d_obs]) else 0.0
            ult = proj_cum[i, dev_max] if np.isfinite(proj_cum[i, dev_max]) else diag
            total_sim += max(0.0, float(ult) - float(diag))
        totals.append(total_sim)

    arr = np.array(totals)
    pct_values = {p: float(np.percentile(arr, p)) for p in percentile_levels}
    LOGGER.info(
        "Bootstrap done: mean=%.2f std=%.2f p95=%.2f",
        float(arr.mean()), float(arr.std(ddof=1)), pct_values.get(95, float("nan")),
    )

    return BootstrapResult(
        method="bootstrap_odp",
        n_sim=n_sim,
        random_seed=seed,
        mean_total_ibnr=float(arr.mean()),
        std_total_ibnr=float(arr.std(ddof=1)),
        percentiles=pct_values,
        chain_ladder_total=ibnr_result.total_ibnr,
        parameters={
            "closing_year": closing_year,
            "dev_max": dev_max,
            "n_obs_cells": n_obs_cells,
            "n_residuals": len(resid_vals),
        },
        simulated_totals=totals,
    )
