# PLAN-OTHERS.md — Bonus IBNR Methods (Stochastic & Alternative)

Target implementer: Sonnet.  
Context: Chain Ladder is already fully wired in `src/provisions/ibnr.py` and reconciled to the
workbook. These four bonus methods all consume the *output* of the Chain Ladder engine — they
never re-read raw data. They add actuarial richness (uncertainty, sensitivity, stochastic
distribution) that stands out on the Innovation and Actuarial Accuracy scoring axes.

---

## 1. Scope

### 1.1 Methods INCLUDED (all four run on the current dataset)

| Method | What it adds | Source file in OTHERS/ |
|---|---|---|
| Mack Chain Ladder | Process variance (σ², MSE, SE, CV) per AY; same point estimate as CL | `method_mack_chain_ladder.py` |
| Bornhuetter-Ferguson | Prior-anchored alternative reserve; stabilises thin data; 127.8 M vs 135.2 M CL | `method_bornhuetter_ferguson.py` |
| Benktander k=2 | Credibility blend between BF and CL; sits at 133.5 M | `method_benktander.py` |
| Bootstrap ODP | Stochastic distribution of total IBNR (p50 / p75 / p90 / p95 / p99) | `method_bootstrap_odp.py` |

### 1.2 Methods EXCLUDED (data not available)

| Method | Why dropped |
|---|---|
| Cape Cod | Requires exposure/premium by accident-year (`config_cape_cod_exposure.csv`) — not present in `base ADE` |
| Munich Chain Ladder | Requires paired paid *and* incurred triangles; `base ADE` has one amount basis only |
| GLM Reserving | Requires richer covariates/exposure and model specification beyond the current triangle |

---

## 2. Architecture

All four methods are **post-processing layers** on top of `IBNRResult`. They never touch the
workbook or claim rows. The calling sequence is:

```
IBNRLoader.load()
    ↓ rows
calculate_ibnr(rows, closing_year=…)   →   IBNRResult  (already implemented)
    ↓ IBNRResult
calculate_mack(ibnr_result)             →   MackResult
calculate_bf(ibnr_result, config)       →   BFResult
calculate_benktander(ibnr_result, …)    →   BenktanderResult
calculate_bootstrap(ibnr_result, …)     →   BootstrapResult
    ↓ all four
build_method_comparison(…)              →   MethodComparisonSummary
```

**One file per method** (`src/provisions/ibnr_mack.py`, `ibnr_bf.py`, `ibnr_benktander.py`,
`ibnr_bootstrap.py`).  A thin aggregator `src/provisions/ibnr_comparison.py` collects all four
into `MethodComparisonSummary`.

Rules:
- All input comes from `IBNRResult` fields (`triangle_cells`, `development_factors`,
  `by_occurrence_year`, `closing_year`, `occurrence_year_window`).
- No file I/O in any method module (pure functions only).
- All constants read from `legislative.yaml` via `load_yaml_config`; no hardcoding.
- Logging via `logging` module following the existing pattern.

---

## 3. Configuration additions

Add the following block to `src/config/legislative.yaml` under the existing `ibnr:` section:

```yaml
ibnr:
  # … existing keys …

  # --- Additional methods ---
  mack:
    enabled: true

  bornhuetter_ferguson:
    enabled: true
    # Prior basis: "mature_ay_ratio" uses the fully-developed AY's ULT/dev0 factor.
    # Admin may override with a fixed ELR (expected loss ratio) by setting prior_elr.
    prior_basis: "mature_ay_ratio"      # or "fixed_elr"
    prior_elr: null                     # e.g. 0.65  — only used when prior_basis = "fixed_elr"
    mature_ay: 2022                     # which AY is treated as fully developed for ratio

  benktander:
    enabled: true
    k: 2                                # number of Benktander iterations (usually 1 or 2)

  bootstrap_odp:
    enabled: true
    n_sim: 1000
    random_seed: 42
    percentiles: [50, 75, 90, 95, 99]  # VaR percentiles to report
```

---

## 4. Method 1 — Mack Chain Ladder (`src/provisions/ibnr_mack.py`)

### 4.1 What it produces

For each accident year (AY): σ² (process variance parameter), MSE (mean-squared error of the
reserve), SE = √MSE, and CV = SE / reserve. Total portfolio-level naïve SE (root-sum-of-squares).

The point-estimate IBNR is identical to Chain Ladder — the value is the same `total_ibnr`
from `IBNRResult`. Mack adds the *uncertainty band* around it.

### 4.2 Types

```python
@dataclass(frozen=True)
class MackAYDetail:
    occurrence_year: int
    ibnr_chain_ladder: float   # from IBNRResult.by_occurrence_year
    sigma2: float              # process variance parameter for this dev transition
    mse: float                 # Mack MSE (may be nan for fully-developed AY)
    se: float                  # √mse
    cv: float                  # se / ibnr; nan when ibnr == 0

@dataclass(frozen=True)
class MackResult:
    method: str                # "mack_chain_ladder"
    sigma2_by_dev: dict[int, float]         # dev period → σ²
    total_ibnr: float                       # same as CL
    total_se_naive: float                   # √(Σ se²)
    by_occurrence_year: list[MackAYDetail]
    parameters: dict[str, Any]
```

### 4.3 Public function signature

```python
def calculate_mack(ibnr_result: IBNRResult) -> MackResult:
```

### 4.4 Algorithm (directly from `method_mack_chain_ladder.py`)

**Step 1 — Estimate σ² per development period j (j = 1, 2, 3):**

For development transition `j-1 → j`, collect the set of AYs `i` where both `C[i][j]` and
`C[i][j-1]` are known (i.e. `is_known=True` in both cells):

```
σ²[j] = Σᵢ  C[i][j-1] × (C[i][j]/C[i][j-1] − F[j])²  /  (|AYs| − 1)
```

If `|AYs| ≤ 1` for a given j: set `σ²[j] = nan` (insufficient data to estimate variance).

Source: `estimate_sigma2()` in `OTHERS/method_mack_chain_ladder.py` lines 12–27.

**Step 2 — MSE per AY:**

For AY `i`, let `d_obs = closing_year − i` (last observed dev). Iterate from `d_obs+1` to
`dev_max`:

```
MSE[i] = C[i][d_obs]²  ×  Σ_{j=d_obs+1}^{dev_max}  (∏_{k=j}^{dev_max} F[k])²  ×  σ²[j] / C[i][d_obs]
```

(Approximation: process variance only; estimation variance is ignored — flag this in the
assumption registry.)

If AY is fully developed (`d_obs ≥ dev_max`): `MSE[i] = 0`, `SE[i] = 0`, `CV = nan`.

Source: `mack_mse_for_ay()` in `OTHERS/method_mack_chain_ladder.py` lines 30–41.

**Step 3 — Portfolio SE:**

```
total_se_naive = √( Σᵢ SE[i]² )
```

(Naïve; no correlation correction — flag in assumption registry.)

### 4.5 Assumption registry entries to add

- `ibnr_mack_variance_process_only` — `needs_review`, `LLM_SUGGESTED`, estimation variance
  excluded from MSE; conservative simplification
- `ibnr_mack_se_correlation_ignored` — `needs_review`, `LLM_SUGGESTED`, total SE uses
  root-sum-of-squares without AY correlation

---

## 5. Method 2 — Bornhuetter-Ferguson (`src/provisions/ibnr_bf.py`)

### 5.1 What it produces

An alternative IBNR per AY using an *a-priori* (prior) ultimate as an anchor, blended with
observed data via the percent-reported factor `q`. Expected total ≈ 127.8 M.

### 5.2 Types

```python
@dataclass(frozen=True)
class BFAYDetail:
    occurrence_year: int
    reported_diagonal: float     # G[i] from IBNRResult
    q_percent_reported: float    # 1 / CDF-to-ultimate
    prior_ultimate: float        # a-priori ultimate
    ultimate_bf: float           # G[i] + (1 - q[i]) × prior_ult[i]
    ibnr_bf: float               # ultimate_bf − G[i]  =  (1 - q[i]) × prior_ult[i]
    ibnr_chain_ladder: float     # for comparison

@dataclass(frozen=True)
class BFResult:
    method: str                  # "bornhuetter_ferguson"
    prior_basis: str             # description of how prior was derived
    total_ibnr_bf: float
    total_ibnr_chain_ladder: float
    difference_vs_chain_ladder: float
    by_occurrence_year: list[BFAYDetail]
    parameters: dict[str, Any]
```

### 5.3 Public function signature

```python
def calculate_bf(ibnr_result: IBNRResult, config: dict[str, Any] | None = None) -> BFResult:
```

Config is the `bornhuetter_ferguson` sub-dict from `legislative.yaml` (loaded inside if `None`).

### 5.4 Algorithm

**Step 1 — Percent reported q[i]:**

For each AY `i`, the CDF from the last observed development to ultimate is:

```
CDF[i] = ∏_{j = d_obs[i]+1}^{dev_max}  F[j]
q[i] = 1 / CDF[i]
```

where `d_obs[i] = closing_year − i`.  
If `d_obs[i] ≥ dev_max` (fully developed): `CDF = 1`, `q = 1`, `ibnr_bf = 0`.

**Step 2 — Prior ultimate:**

Two modes controlled by `prior_basis` in config:

- `"mature_ay_ratio"`: Use the configured `mature_ay` (default 2022). Compute:
  ```
  ratio = CL_ultimate[mature_ay] / C[mature_ay][0]   (cumulative dev-0 of mature AY)
  prior_ult[i] = C[i][0] × ratio
  ```
  (C[i][0] is the diagonal's earliest observed cumulative, i.e. `development_year=0` value.)
  
- `"fixed_elr"`: `prior_ult[i] = prior_elr × exposure[i]` — NOT applicable here (no exposure
  data). If this mode is selected but no exposure is present, raise `ValueError` with a clear
  message: "BF fixed_elr mode requires exposure by AY; not available in base ADE."

**Step 3 — BF ultimate and IBNR:**

```
ibnr_bf[i] = (1 - q[i]) × prior_ult[i]
ultimate_bf[i] = G[i] + ibnr_bf[i]
```

Source: `OTHERS/method_bornhuetter_ferguson.py` lines 11–45.

### 5.5 Reading `C[i][0]` from `IBNRResult`

From `ibnr_result.triangle_cells`, filter on `development_year == 0` and `is_known == True` for
each `occurrence_year`. Use `cell.cumulative_amount`.

### 5.6 Assumption registry entries

- `ibnr_bf_prior_basis` — `needs_review`, `LLM_SUGGESTED`, prior is `mature_ay_ratio` using AY
  2022; admin can override with `fixed_elr` in config once exposure data is available

---

## 6. Method 3 — Benktander k=2 (`src/provisions/ibnr_benktander.py`)

### 6.1 What it produces

A two-iteration credibility refinement of BF. Sits between BF (lower) and CL (higher).
Expected total ≈ 133.5 M.

### 6.2 Types

```python
@dataclass(frozen=True)
class BenktanderAYDetail:
    occurrence_year: int
    reported_diagonal: float
    q_percent_reported: float
    prior_ultimate: float
    ultimate_bk_k1: float       # first iteration (= BF ultimate)
    ultimate_bk_k2: float       # second iteration
    ibnr_bk_k2: float           # ultimate_bk_k2 − G[i]
    ibnr_chain_ladder: float

@dataclass(frozen=True)
class BenktanderResult:
    method: str                  # "benktander"
    k: int                       # number of iterations (from config, default 2)
    total_ibnr_benktander: float
    total_ibnr_chain_ladder: float
    difference_vs_chain_ladder: float
    by_occurrence_year: list[BenktanderAYDetail]
    parameters: dict[str, Any]
```

### 6.3 Public function signature

```python
def calculate_benktander(ibnr_result: IBNRResult, bf_result: BFResult, config: dict[str, Any] | None = None) -> BenktanderResult:
```

`bf_result` is passed in (already computed) to reuse `q` and `prior_ultimate`. No re-computation.

### 6.4 Algorithm

**Iteration formula** for `k` iterations starting from `U_0 = prior_ult[i]`:

```
U_1 = G[i] + (1 − q[i]) × U_0     ← same as BF ultimate
U_2 = G[i] + (1 − q[i]) × U_1     ← Benktander k=2
…
U_k = G[i] + (1 − q[i]) × U_{k−1}
```

`ibnr_bk = U_k − G[i]`

The config `k` parameter controls iterations (default 2). Store both `U_1` and `U_k` in the
detail dataclass for traceability.

Source: `OTHERS/method_benktander.py` lines 31–49.

---

## 7. Method 4 — Bootstrap ODP (`src/provisions/ibnr_bootstrap.py`)

### 7.1 What it produces

A simulated distribution of total IBNR via residual resampling. Each simulation re-estimates CL
factors on pseudo-data derived from Pearson residuals. Output: mean, std-dev, and a configurable
list of percentiles (p50 / p75 / p90 / p95 / p99).

### 7.2 Types

```python
@dataclass(frozen=True)
class BootstrapResult:
    method: str                    # "bootstrap_odp"
    n_sim: int
    random_seed: int
    mean_total_ibnr: float
    std_total_ibnr: float
    percentiles: dict[int, float]  # e.g. {50: …, 75: …, 90: …, 95: …, 99: …}
    chain_ladder_total: float      # for reference
    parameters: dict[str, Any]
    simulated_totals: list[float]  # full distribution (capped at n_sim entries, stored for chart)
```

### 7.3 Public function signature

```python
def calculate_bootstrap(ibnr_result: IBNRResult, config: dict[str, Any] | None = None) -> BootstrapResult:
```

### 7.4 Algorithm

**Step 1 — Build fitted incrementals from projected cumulative:**

From `ibnr_result.triangle_cells` reconstruct the incremental triangle `I_fitted[i][d]`:
```
I_fitted[i][0] = C_proj[i][0]
I_fitted[i][d] = C_proj[i][d] − C_proj[i][d-1]   for d ≥ 1
```
Both observed and projected cells use the fully projected cumulative triangle.

**Step 2 — Pearson residuals (observed cells only):**

For each cell `(i, d)` where `is_known=True`:
```
r[i][d] = (I_obs[i][d] − I_fitted[i][d]) / √max(I_fitted[i][d], 1e-9)
```
Collect all finite, non-nan residuals into a flat array `resid_vals`.

**Step 3 — Simulate `n_sim` resampled datasets:**

For each simulation:
1. Sample `len(resid_vals)` values with replacement from `resid_vals`.
2. Reconstruct pseudo-observed incremental cells:
   ```
   I_pseudo[i][d] = max(0,  I_fitted[i][d] + r_sampled × √max(I_fitted[i][d], 1e-9))
   ```
3. Rebuild cumulative pseudo-observed triangle from pseudo incremental.
4. Re-estimate CL factors on pseudo-observed using the same volume-weighted formula as the
   main engine (denominator-zero guard: skip that sim's contribution for that factor).
5. Project and compute `total_ibnr_sim = Σᵢ (U_sim[i] − G_pseudo[i])`.

**Step 4 — Summarise:**

Compute mean, std, and the configured percentiles from the `n_sim` simulated totals.

Source: `OTHERS/method_bootstrap_odp.py`.

**Important implementation note:** numpy and its RNG are allowed here. Use
`np.random.default_rng(seed)` for reproducibility. Import numpy inside the function if you want
to keep the module importable without numpy (but numpy is already in the venv — no need to guard).

### 7.5 Assumption registry entries

- `ibnr_bootstrap_prior_residuals_only` — `needs_review`, `LLM_SUGGESTED`, Bootstrap resamples
  Pearson residuals without process-noise simulation (no Poisson sampling stage) — this is an
  ODP approximation, not the full two-stage Bootstrap

---

## 8. Comparison Aggregator (`src/provisions/ibnr_comparison.py`)

### 8.1 Types

```python
@dataclass(frozen=True)
class MethodComparisonRow:
    method: str
    total_ibnr: float
    difference_vs_chain_ladder: float
    se_or_p95: float | None      # Mack SE for Mack; p95 for Bootstrap; None for BF/Benktander

@dataclass(frozen=True)
class MethodComparisonSummary:
    chain_ladder_total: float
    mack: MackResult
    bf: BFResult
    benktander: BenktanderResult
    bootstrap: BootstrapResult
    comparison_rows: list[MethodComparisonRow]   # one row per method, sorted by total_ibnr
```

### 8.2 Public function

```python
def build_method_comparison(
    ibnr_result: IBNRResult,
    mack: MackResult,
    bf: BFResult,
    benktander: BenktanderResult,
    bootstrap: BootstrapResult,
) -> MethodComparisonSummary:
```

Populates `comparison_rows` with one row per method. Also computes the *method range*:
`max(total_ibnr) − min(total_ibnr)` across all five methods (CL + 4 bonus) and stores it in
`parameters` for display.

---

## 9. Orchestration Wiring (`src/orchestration/run_audit.py`)

After the existing `ibnr_result = calculate_ibnr(...)` call, add:

```python
from src.provisions.ibnr_mack import calculate_mack
from src.provisions.ibnr_bf import calculate_bf
from src.provisions.ibnr_benktander import calculate_benktander
from src.provisions.ibnr_bootstrap import calculate_bootstrap
from src.provisions.ibnr_comparison import build_method_comparison

mack_result = calculate_mack(ibnr_result)
bf_result = calculate_bf(ibnr_result)
bk_result = calculate_benktander(ibnr_result, bf_result)
boot_result = calculate_bootstrap(ibnr_result)
comparison = build_method_comparison(ibnr_result, mack_result, bf_result, bk_result, boot_result)

summary["ibnr"]["method_comparison"] = {
    "chain_ladder":        ibnr_result.total_ibnr,
    "mack_se":             mack_result.total_se_naive,
    "bf_total":            bf_result.total_ibnr_bf,
    "benktander_total":    bk_result.total_ibnr_benktander,
    "bootstrap_p95":       boot_result.percentiles[95],
    "bootstrap_mean":      boot_result.mean_total_ibnr,
    "method_range":        comparison.comparison_rows[-1].total_ibnr - comparison.comparison_rows[0].total_ibnr,
}
```

Gate each method on `config["ibnr"][method_name]["enabled"]` so any method can be disabled
without code change.

---

## 10. Assumption Registry Additions (`src/reporting/assumptions.py`)

Add these entries (call `register_assumption` or the equivalent used in existing code):

| key | status | source | description |
|---|---|---|---|
| `ibnr_mack_variance_process_only` | `needs_review` | `LLM_SUGGESTED` | Mack MSE uses process variance only; estimation variance excluded |
| `ibnr_mack_se_correlation_ignored` | `needs_review` | `LLM_SUGGESTED` | Portfolio-level Mack SE is naïve root-sum-of-squares; AY correlations ignored |
| `ibnr_bf_prior_basis_mature_ratio` | `needs_review` | `LLM_SUGGESTED` | BF prior = ULT/dev0 of AY 2022 (most mature year); not actuary-validated |
| `ibnr_benktander_k2` | `active` | `LLM_SUGGESTED` | Benktander uses k=2 iterations; configurable via legislative.yaml |
| `ibnr_bootstrap_odp_residual` | `needs_review` | `LLM_SUGGESTED` | Bootstrap uses Pearson residual resampling (ODP approximation), not full two-stage |

---

## 11. Tests

### 11.1 `tests/unit/test_ibnr_mack.py`

- `test_sigma2_two_points` — 2 AYs for a dev transition → `σ²` computed manually, matches
- `test_mack_mse_fully_developed_ay` — AY where `d_obs ≥ dev_max` → `MSE = 0`, `SE = 0`
- `test_mack_mse_positive_for_immature_ay` — AY 2025 → `MSE > 0`, `SE > 0`
- `test_total_se_is_root_sum_squares` — assert `total_se_naive² ≈ Σ se[i]²`

### 11.2 `tests/unit/test_ibnr_bf.py`

- `test_bf_fully_developed_ay_has_zero_ibnr` — AY where q=1 → `ibnr_bf = 0`
- `test_bf_ibnr_equals_one_minus_q_times_prior` — formula check with hand values
- `test_bf_prior_mature_ratio_uses_config_mature_ay` — mature_ay=2022 produces known ratio
- `test_bf_fixed_elr_raises_without_exposure` — `prior_basis="fixed_elr"` with no exposure → `ValueError`

### 11.3 `tests/unit/test_ibnr_benktander.py`

- `test_benktander_k1_equals_bf` — one iteration must equal BF ultimate
- `test_benktander_k2_between_bf_and_cl` — `ibnr_bf ≤ ibnr_bk ≤ ibnr_cl` for all AYs
- `test_benktander_fully_developed_zero` — AY with zero reserve stays zero

### 11.4 `tests/unit/test_ibnr_bootstrap.py`

- `test_bootstrap_reproducible` — same seed → identical `mean_total_ibnr` on two calls
- `test_bootstrap_mean_close_to_cl` — mean within 5% of `ibnr_result.total_ibnr`
- `test_bootstrap_percentile_ordering` — `p50 ≤ p75 ≤ p90 ≤ p95 ≤ p99`
- `test_bootstrap_simulated_totals_length` — `len(simulated_totals) == n_sim`

### 11.5 `tests/integration/test_ibnr_bonus_workbook.py`

Load the real workbook, run `calculate_ibnr` → then run all four bonus methods:

- `test_mack_total_equals_cl` — `mack_result.total_ibnr ≈ 135_205_244.47` within `1e-2`
- `test_bf_total_approx` — `bf_result.total_ibnr_bf` is in `[125_000_000, 130_000_000]`
- `test_benktander_between_bf_and_cl` — `bf_result.total_ibnr_bf < bk_result.total_ibnr_benktander < ibnr_result.total_ibnr`
- `test_bootstrap_mean_approx_cl` — `|bootstrap.mean − 135_205_244.47| / 135_205_244.47 < 0.05`
- `test_comparison_has_five_rows` — `len(comparison.comparison_rows) == 5` (CL + 4)

---

## 12. UI Integration (bonus for Innovation + UI/UX scores)

Add a **"Methods Comparison"** tab (or expandable section) in the Streamlit/Dash dashboard.

### 12.1 Summary table

| Method | Total IBNR | vs. Chain Ladder | Risk metric |
|---|---|---|---|
| Chain Ladder | 135,205,244.47 | reference | — |
| Mack CL | 135,205,244.47 | 0 | SE = X |
| BF | 127,822,067.28 | −5.5% | — |
| Benktander k=2 | 133,533,122.18 | −1.2% | — |
| Bootstrap (mean) | ~135,205,244 | ~0% | p95 = Y |

Show the *method range* (max − min across all 5) as a sensitivity headline.

### 12.2 Bootstrap distribution chart

Bar chart (histogram) of `bootstrap.simulated_totals` with vertical lines marking CL total and
p95. Label axes. This is the "Innovation" differentiator.

### 12.3 Mack SE fan chart (optional but high-value)

For each AY: a bar (reserve point estimate) with error bars ± 1 Mack SE. Shows reserve
uncertainty per accident year.

---

## 13. Implementation Order

Run `python -m src.orchestration.run_validation_suite` after each numbered step; do not advance
until green.

1. Add config block to `legislative.yaml` (§3).
2. Implement `src/provisions/ibnr_mack.py` + unit tests `test_ibnr_mack.py`.
3. Implement `src/provisions/ibnr_bf.py` + unit tests `test_ibnr_bf.py`.
4. Implement `src/provisions/ibnr_benktander.py` + unit tests `test_ibnr_benktander.py`.
5. Implement `src/provisions/ibnr_bootstrap.py` + unit tests `test_ibnr_bootstrap.py`.
6. Implement `src/provisions/ibnr_comparison.py`.
7. Run integration tests `test_ibnr_bonus_workbook.py` against the real workbook.
8. Wire all four into `run_audit.py` (§9) + add assumption registry entries (§10).
9. Add UI "Methods Comparison" tab (§12.1 table required; §12.2 chart strongly recommended).
10. Write session log under `docs/session_logs/YYYY-MM-DD_HH:MM:SS.md`.

---

## 14. Do Not

- Do not re-read the workbook or run `IBNRLoader` inside any bonus method — consume `IBNRResult`
  only.
- Do not hardcode accident years `[2022, 2023, 2024, 2025]` — derive them from
  `ibnr_result.occurrence_year_window`.
- Do not claim BF or Benktander results as "correct" — flag them as `needs_review` in the
  assumption registry (prior not actuary-validated).
- Do not implement Cape Cod, Munich CL, or GLM — they are explicitly out of scope.
- Do not add Bootstrap simulation to any path that runs on startup by default; gate it behind
  `bootstrap_odp.enabled = true` in config (it adds ~1 s per run at n_sim=1000).

---

## 15. Acceptance Criteria

Bonus methods module is complete when:

- All four methods run without error on the real `base ADE` workbook data.
- Mack total IBNR matches CL within `1e-2`.
- BF total IBNR is in `[125_000_000, 130_000_000]`.
- Benktander total IBNR is strictly between BF and CL.
- Bootstrap mean is within 5% of CL total.
- `MethodComparisonSummary.comparison_rows` has exactly 5 entries (including CL as reference).
- All unit and integration tests in §11 pass under `run_validation_suite`.
- Five new assumption-registry entries visible in `audit_summary.md` (all `needs_review`).
- UI "Methods Comparison" tab is visible and shows the summary table from §12.1.
- No hardcoded `closing_year`, accident year list, `n_sim`, or `k` outside `legislative.yaml`.
