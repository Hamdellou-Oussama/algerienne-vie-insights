# PLAN-IBNR.md

Implementation plan for the IBNR (Incurred But Not Reported) provision module.
Target implementer: Sonnet, following the same layering used for PPNA, PE, and SAP.

---

## 1. Scope

Build the first IBNR engine: a volume-weighted **Chain Ladder** computed from a claim-level
dataset, with full traceability.

In scope for this first slice:
- dataset contract + loader + anomaly metrics for `level 02-ÉCHANTILLON DATA IBNR.xlsx`
- triangle construction from claim-level rows
- Chain Ladder development factors, projection, ultimate, and reserve
- reconciliation against the workbook `calcule IBNR` sheet, row-by-row
- assumption registry entries + unit + integration tests
- wiring into `run_preprocessing`, `run_audit`, and `run_reconciliation`

Out of scope for this slice (keep the module extensible but do not implement yet):
- Bornhuetter-Ferguson, Loss Ratio, Mack, Bootstrap, Munich Chain Ladder
- paid vs incurred dual triangles
- cross-product segmentation (single-LoB triangle; see §3.4)

---

## 2. Source Workbook Reality

Workbook: `data/level 02-ÉCHANTILLON DATA IBNR.xlsx`. Two sheets:

### 2.1 `base ADE` (raw claim-level data)

- 596 claim rows (rows 2..597), 13 columns, header row 1.
- Header row contains trailing spaces in several labels — preserve them in the contract.

| Col | Raw label                | Canonical name         | Type     | Notes |
| --- | ------------------------ | ---------------------- | -------- | ----- |
| A   | `N° SINISTRE`            | `claim_id`             | STRING   | unique |
| B   | `Produit ` (trailing ws) | `product`              | CATEGORY | values observed: `IMMO`, `CONSO`, `Conso`, `conso`, `WARDA`, `AC-ELITE` |
| C   | `N°Adhesion ` (trail ws) | `adhesion_id`          | INTEGER  | |
| D   | `Date de sous`           | `subscription_date`    | DATE     | |
| E   | `Année de souscription`  | `subscription_year`    | INTEGER  | |
| F   | `Date effet ` (trail ws) | `effect_date`          | DATE     | |
| G   | `Date Échéance`          | `expiry_date`          | DATE     | |
| H   | `Date du Sinistre`       | `occurrence_date`      | DATE     | |
| I   | `Année de sinistre`      | `occurrence_year`      | INTEGER  | used in triangle |
| J   | `Date de déclaration`    | `declaration_date`     | DATE     | |
| K   | `Année de déclaration`   | `declaration_year`     | INTEGER  | cell is `=YEAR(J)` formula — read cached value |
| L   | `le montant de sinistre` | `claim_amount`         | DECIMAL  | used in triangle |
| M   | `colonne  mois IBNR`     | `development_lag_years`| INTEGER  | cell is `=K - I` formula (despite the "mois" label it is years); read cached value |

Profile observed on raw sample:
- Products distribution: `CONSO=279`, `IMMO=248`, `Conso=63`, `conso=1`, `WARDA=3`, `AC-ELITE=2`
- Occurrence years 2018..2025 ; declaration years 2018..2025
- Development lag distribution: `0=457`, `1=114`, `2=17`, `3=8` (max visible lag = 3)
- No missing claim amounts, no missing occurrence or declaration dates in the sample
- **Label normalization needed**: `Conso/conso` → `CONSO` (preserve raw label in lineage)

### 2.2 `calcule IBNR` (actuarial worksheet — ground truth for reconciliation)

Three stacked tables:

**Block A — pivot (rows 3–13)** — sum of `le montant de sinistre` grouped by `(Année de sinistre, Année de déclaration)` over all 596 rows. Row 13 + col J are totals.

**Block B — incremental development triangle (rows 15–20)** — restricted to occurrence years 2022..2025 and development years 0..3. Cells reference the pivot via `GETPIVOTDATA`. Unknown cells are literal `'?'` strings.

**Block C — cumulative triangle + factors + projection (rows 23–37)**:

- rows 25–28: cumulative `C[i][j] = C[i][j-1] + I[i][j]`, unknowns = `'?'`
- row 29: development factors
  `F[j] = SUM(C[i][j] for i where i+j ≤ 2025) / SUM(C[i][j-1] for same i)`
  Verified cached values (must be hit exactly by the engine):
  - `F[1] = 1.3348571029010912`
  - `F[2] = 1.0203875341571986`
  - `F[3] = 1.0674101418275637`
- rows 33–36: completed cumulative triangle. Known cells copied from rows 25–28; unknown cells projected by `C[i][j] = F[j] × C[i][j-1]`.
- col G: `diagonal element G[i] = C[i][2025 - i]` (latest known cumulative)
- col H: `ultimate U[i] = C[i][last_dev_year = 3]`
- col I: `reserve tardive R[i] = U[i] - G[i]`
- cell I37: `IBNR 2025 = SUM(R[i]) = 135_205_244.46977875` (reconciliation target)

Occurrence-year reserves to match:
- 2022 → 0
- 2023 → 11_859_432.866376191
- 2024 → 30_506_322.710742295
- 2025 → 92_839_488.89266026

The workbook uses **all products** in the pivot (IMMO + CONSO + WARDA + AC-ELITE). Keep that as the default in the engine so reconciliation matches; flag the hard rule ("do not mix heterogeneous products in the same Chain Ladder triangle") as an open mentor question (§12).

---

## 3. Actuarial Method — Chain Ladder (exact formulas)

### 3.1 Triangle construction

Inputs: list of claims with `(occurrence_year, declaration_year, claim_amount)`, plus configured
`closing_year` (valuation year) and `occurrence_year_window` (default `closing_year-3 .. closing_year`
to reproduce the workbook's 4×4 triangle).

Steps:
1. Filter claims to rows with `occurrence_year ∈ window` and `declaration_year ≤ closing_year`.
2. For each claim compute `development_year = declaration_year − occurrence_year`. Reject any row
   with `development_year < 0` (declared before occurrence — data error).
3. `I[i][j] = Σ claim_amount` grouped by `(i = occurrence_year, j = development_year)` for
   `0 ≤ j ≤ closing_year − min(window)`.
4. `C[i][j] = Σ_{k ≤ j} I[i][k]` (cumulative).

`C[i][j]` is **known** iff `i + j ≤ closing_year` (upper-left triangle including the diagonal).

### 3.2 Development factors (volume-weighted)

For each `j ∈ 1 .. J_max`:
```
F[j] = Σ_{i : i+j ≤ closing_year} C[i][j]  /  Σ_{i : i+j ≤ closing_year} C[i][j-1]
```
Denominator zero ⇒ raise `ValueError` with row context (degenerate triangle).

### 3.3 Projection

For each unknown cell (`i + j > closing_year`):
```
C[i][j] = F[j] × C[i][j-1]
```
Iterate in increasing `j`, since each column depends on the previous one.

### 3.4 Diagonal, ultimate, reserve

For each occurrence year `i`:
- `G[i] = C[i][closing_year − i]` (latest known cumulative)
- `U[i] = C[i][J_max]` (last development column after projection)
- `R[i] = U[i] − G[i]` (IBNR per occurrence year)

Total IBNR at valuation = `Σ R[i]`.

**Edge cases the engine must handle**:
- when `closing_year − i ≥ J_max`, the row is fully developed, `R[i] = 0`
- when `closing_year − i < 0`, the occurrence year is in the future — reject with clear error
- when a claim has `declaration_year > closing_year`, drop silently only if expected by the
  caller; otherwise emit a `CleaningEvent` and exclude

### 3.5 Segmentation rule (AGENTS.md / foundation-level hard rule)

> Do not mix heterogeneous products in the same Chain Ladder triangle.

Design decision: the engine takes an **iterable of claim rows already scoped to a single LoB**.
The default orchestrator call passes all rows (to match the workbook). Also expose a
`segment_by` optional parameter to run the method once per product and return a dict of
`IBNRResult` keyed by product. Flag the single-bucket default as a mentor-blocked assumption in the
registry.

---

## 4. Dataset Contract — `ibnr`

Add to `src/preprocessing/schema_registry.py` a new `_ibnr_contract()` builder and register
it in `get_dataset_contracts()` under key `"ibnr"`.

```python
FieldContract("N° SINISTRE", "claim_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Claim identifier.")
FieldContract("Produit ", "product", DataType.CATEGORY, False, CleaningPolicy.COERCE,
              "Product label within ADE line of business.",
              controlled_vocabulary=("immo", "conso", "warda", "ac-elite"))
FieldContract("N°Adhesion ", "adhesion_id", DataType.INTEGER, False, CleaningPolicy.COERCE, "Adhesion identifier.")
FieldContract("Date de sous", "subscription_date", DataType.DATE, False, CleaningPolicy.COERCE, "Subscription date.")
FieldContract("Année de souscription", "subscription_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Subscription year.")
FieldContract("Date effet ", "effect_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy effect date.")
FieldContract("Date Échéance", "expiry_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy expiry date.")
FieldContract("Date du Sinistre", "occurrence_date", DataType.DATE, False, CleaningPolicy.COERCE, "Occurrence date.")
FieldContract("Année de sinistre", "occurrence_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Occurrence year, used as triangle row.")
FieldContract("Date de déclaration", "declaration_date", DataType.DATE, False, CleaningPolicy.COERCE, "Declaration date.")
FieldContract("Année de déclaration", "declaration_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Declaration year, used as triangle column.")
FieldContract("le montant de sinistre", "claim_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Claim amount, additive into triangle cells.")
FieldContract("colonne  mois IBNR", "development_lag_years", DataType.INTEGER, True, CleaningPolicy.RETAIN_AND_FLAG,
              "Workbook-derived development lag in years (=declaration_year - occurrence_year). Informational.")
```

Workbook contract block:
- `workbook_path = DATA_DIR / "level 02-ÉCHANTILLON DATA IBNR.xlsx"`
- `sheet_name = "base ADE"`
- `header_row = 1`, `data_start_row = 2`
- `output_sheet_name = "calcule IBNR"`
- `uses_data_only_values = True` (cells K and M are formulas, use cached values)

---

## 5. Loader — `src/preprocessing/ibnr_loader.py`

Mirror `sap_loader.py` / `pe_loader.py`:

```python
class IBNRLoader(BaseDatasetLoader):
    def __init__(self) -> None:
        super().__init__(get_dataset_contracts()["ibnr"])

    def _duplicate_key(self, row):
        return (row.get("claim_id"),)  # claim_id must be unique across the base

    def _build_metrics(self, result):
        # count:
        # - rows per product (raw and normalized)
        # - rows per occurrence_year
        # - rows per (occurrence_year, declaration_year)
        # - rows where declaration_year < occurrence_year  (ERROR severity)
        # - rows where declaration_year > inferred closing_year  (WARNING)
        # - rows where development_lag_years != declaration_year - occurrence_year  (WARNING)
        # Emit CleaningEvent for each anomaly row with appropriate category:
        # BUSINESS_RULE_VALIDATION for impossible lag, RANGE_VALIDATION for out-of-window.
```

Categorical normalization is already handled by the base class when `CleaningPolicy.COERCE` is set
on a CATEGORY field — ensure `Conso`, `conso`, `CONSO` all collapse to the canonical `conso`
(lowercased). Keep raw label in lineage.

---

## 6. Provision Engine — `src/provisions/ibnr.py`

Follow the dataclass-audit pattern used in `pe.py` and `sap.py`.

### 6.1 Types

```python
@dataclass(frozen=True)
class IBNRTriangleCell:
    occurrence_year: int
    development_year: int
    incremental_amount: float
    cumulative_amount: float
    is_known: bool          # True iff occurrence_year + development_year <= closing_year
    is_projected: bool      # True iff filled via F[j] * C[i][j-1]
    source_claim_count: int # number of raw rows aggregated into this cell

@dataclass(frozen=True)
class IBNRDevelopmentFactor:
    development_year: int              # j >= 1
    numerator: float                   # Σ C[i][j] over valid i
    denominator: float                 # Σ C[i][j-1] over same i
    factor: float                      # numerator / denominator
    contributing_occurrence_years: tuple[int, ...]

@dataclass(frozen=True)
class IBNROccurrenceYearAudit:
    occurrence_year: int
    diagonal_cumulative: float         # G[i]
    ultimate: float                    # U[i]
    reserve: float                     # R[i] = U[i] - G[i]
    last_known_development_year: int   # closing_year - i

@dataclass(frozen=True)
class IBNRResult:
    closing_year: int
    occurrence_year_window: tuple[int, int]     # (min, max) inclusive
    max_development_year: int
    method: str                                 # "chain_ladder_volume_weighted"
    total_ibnr: float
    triangle_cells: list[IBNRTriangleCell]
    development_factors: list[IBNRDevelopmentFactor]
    by_occurrence_year: list[IBNROccurrenceYearAudit]
    parameters: dict[str, Any]                  # includes product filter + segment key if any
    excluded_rows: list[dict[str, Any]]         # rows dropped with reason
```

### 6.2 Public functions

```python
def build_triangle(rows, closing_year, occurrence_year_window) -> (triangle_cells, excluded_rows)
def compute_development_factors(triangle_cells, closing_year) -> list[IBNRDevelopmentFactor]
def project_triangle(triangle_cells, factors, closing_year) -> list[IBNRTriangleCell]
def calculate_ibnr(rows, *, closing_year, occurrence_year_window=None, segment_by=None) -> IBNRResult | dict[str, IBNRResult]
```

`closing_year` is **required** (no default). When `occurrence_year_window is None`, default to
`(closing_year - 3, closing_year)` to mirror the workbook; allow override from UI/admin.

All functions must:
- use `logging` at `INFO`/`DEBUG` following the existing pattern
- raise `ValueError` on invalid inputs with the offending row number
- be pure (no file I/O; reconciliation reads the workbook separately)

### 6.3 Row contract

Each input row is a mapping with at minimum: `_source_row_number`, `occurrence_year`,
`declaration_year`, `claim_amount`. Optional: `product` (for `segment_by`).

---

## 7. Configuration

Add to `src/config/legislative.yaml`:

```yaml
ibnr:
  default_method: "chain_ladder_volume_weighted"
  # triangle scope defaults; orchestrator may override per run
  occurrence_year_window_size: 4     # produces a 4x4 triangle by default
  closing_year: 2025                 # sample workbook valuation year; admin-configurable in UI
  segment_by_product: false          # default false to match workbook reconciliation
```

No hardcoding in code — the engine reads these via the existing `load_yaml_config` helper (same
pattern as PE coefficients in `src/provisions/pe.py`).

---

## 8. Orchestration Wiring

### 8.1 `src/orchestration/run_preprocessing.py`

- import and add `"ibnr": IBNRLoader().load()` to the `results` dict
- inventory file should pick it up automatically via `inventory_all_workbooks`

### 8.2 `src/orchestration/run_audit.py`

- add `ibnr_result = calculate_ibnr(IBNRLoader().load().rows, closing_year=<from config>)`
- extend `provision_summary["ibnr"] = {closing_year, total_ibnr, triangle_shape, row_count}`
- include IBNR artifacts in `summary["artifact_paths"]`

### 8.3 `src/reporting/reconciliation.py`

Add `_reconcile_ibnr()` returning a `ReconciliationModuleResult`:

- load `calcule IBNR` sheet with both `data_only=True` (values) and `data_only=False` (formulas)
- read **cached** values (match tolerance `1e-6`):
  - `C29`, `D29`, `E29` → compare against `F[1]`, `F[2]`, `F[3]`
  - `G33..G36`, `H33..H36`, `I33..I36` → compare against `by_occurrence_year` diagonal/ultimate/reserve
  - `I37` → compare against `total_ibnr` (target: `135_205_244.46977875`)
- read the formula in e.g. `C29`, `E34`, `C36`, `I33` and store them in `evidence.formula_examples`
- compute `row_match_count` across the 16 cumulative-triangle cells (rows 33..36 × dev 0..3) and
  `row_mismatch_count`
- status `"matched"` iff total matches within tolerance AND `row_mismatch_count == 0`

Append the result to the `ReconciliationReport.modules` list in `run_reconciliation`.

---

## 9. Reporting

### 9.1 Assumption registry (`src/reporting/assumptions.py`)

Replace the existing `ibnr_production_validation_blocked` entry — or flip it to `"active"` and
add these entries:

- `ibnr_method_chain_ladder_volume_weighted` — `active`, `FACT`/`WORKBOOK_FORMULA`, cites
  `calcule IBNR!C29:E29`
- `ibnr_occurrence_year_window` — `active`, `DATASET_RULE`, default `(closing_year-3, closing_year)`
  to reproduce workbook 4×4 triangle
- `ibnr_closing_year` — `active`, `CONFIG`, `src/config/legislative.yaml -> ibnr.closing_year`
- `ibnr_product_segmentation_pending` — `needs_review`, `MENTOR`, default path runs one triangle
  over all ADE products to match workbook; segmented path available via `segment_by="product"`
- `ibnr_product_label_normalization_conso` — `active`, `DATASET_RULE`, collapses
  `Conso/conso/CONSO` to canonical `conso`

Keep the existing status-tracking logic so blockers are surfaced in `audit_summary.md`.

### 9.2 Audit export

No new export work required for this slice — the `IBNRResult` dataclasses already provide
per-cell, per-factor, per-occurrence-year traceability that the existing audit writer can
serialize.

---

## 10. Tests

### 10.1 `tests/unit/test_ibnr.py`

- `test_build_triangle_basic` — three synthetic claims across two occurrence years, assert
  correct `I[i][j]`, `C[i][j]`, and the `is_known` flags
- `test_development_factor_volume_weighted` — hand-coded 3×3 triangle with known `F[j]`
- `test_projection_uses_factor_chain` — assert `C[i][j] = F[j] × C[i][j-1]` for unknown cells
- `test_ultimate_equals_diagonal_when_fully_developed` — `R = 0` when row has all known cells
- `test_rejects_declaration_before_occurrence` — expect `ValueError`
- `test_rejects_future_occurrence_year` — expect `ValueError`
- `test_zero_denominator_raises` — column with only zero prior cumulatives
- `test_product_normalization_is_applied_when_segmenting` — `Conso/conso/CONSO` collapse into one bucket

### 10.2 `tests/integration/test_ibnr_workbook.py`

Load the real workbook through `IBNRLoader` and `calculate_ibnr`; assert:
- total IBNR matches `135_205_244.46977875` within `1e-6`
- per-year reserves match the four targets in §2.2
- the three development factors match `1.3348571029010912 / 1.0203875341571986 / 1.0674101418275637`
- all 16 cumulative cells (rows 33..36) match workbook cached values

### 10.3 `tests/integration/test_preprocessing_regression.py`

Extend the existing regression to lock IBNR metrics:
- `row_count == 596`
- `missing_claim_amount == 0`
- product histogram (post-normalization) matches `{"conso": 343, "immo": 248, "warda": 3, "ac-elite": 2}`
- lag histogram matches `{0: 457, 1: 114, 2: 17, 3: 8}`

### 10.4 `tests/integration/test_reporting_reconciliation.py`

Assert `_reconcile_ibnr()` returns `status == "matched"` and
`python_total ≈ excel_total` within tolerance.

---

## 11. Implementation Order (do not parallelize)

1. Add IBNR field contract + loader + register in `get_dataset_contracts()`
2. Add IBNR section to `legislative.yaml`
3. Implement `src/provisions/ibnr.py` pure-math layer + unit tests (§10.1) — must pass before
   touching orchestration
4. Wire into `run_preprocessing.py`; extend regression test (§10.3)
5. Integration test against the real workbook (§10.2) — must pass before wiring reconciliation
6. Implement `_reconcile_ibnr()` in `reconciliation.py`; extend `test_reporting_reconciliation.py`
7. Wire into `run_audit.py` and update assumption registry (§9.1)
8. Run `python -m src.orchestration.run_audit`; inspect `docs/validation_reports/*` for the
   new IBNR entries; confirm `audit_summary.md` lists no new blockers beyond the single
   product-segmentation `needs_review` flag
9. Write a session log under `docs/session_logs/YYYY-MM-DD_HH:MM:SS.md` with totals + open
   questions

After each step run `python -m src.orchestration.run_validation_suite` and do not advance until
green.

---

## 12. Mentor Questions To Raise

Use the AGENTS.md format.

### Q1 — Product segmentation for Chain Ladder triangle

> **Context:** We are implementing Chain Ladder against the provided `base ADE` sample. The workbook
> pivot and all downstream factors mix products `IMMO`, `CONSO`, `WARDA`, and `AC-ELITE` in a
> single triangle.
> **Ambiguity:** Foundation guidance says "do not mix heterogeneous products in the same Chain
> Ladder triangle," but the sample workbook does exactly that.
> **Your current assumption:** Default behavior matches the workbook (single triangle across all
> ADE products) to preserve reconciliation; a `segment_by="product"` path is also available and
> the `ibnr_product_segmentation_pending` assumption is flagged `needs_review`.
> **Question:** For production, should the engine segment by product (and if so, which granularity
> — `IMMO` / `CONSO` / `WARDA` / `AC-ELITE` separately, or a coarser LoB grouping), or is the
> combined ADE triangle the expected convention?

### Q2 — Occurrence-year window for the triangle

> **Context:** The raw `base ADE` sheet contains occurrence years 2018..2025, but the workbook
> builds only a 4×4 triangle over occurrence years 2022..2025.
> **Ambiguity:** Unclear whether earlier occurrence years (2018..2021) are considered fully
> developed (implicit reserve = 0) or deliberately excluded for another reason.
> **Your current assumption:** Default window is `(closing_year - 3, closing_year)` to match the
> workbook; older years are treated as fully developed with reserve 0.
> **Question:** Is this the intended policy, or should we extend the triangle (e.g. 6×6 or full
> history) for production runs?

### Q3 — Closing date / valuation date granularity

> **Context:** The workbook uses occurrence and declaration **years** as triangle axes, implying
> the valuation date is a full calendar year (2025-12-31).
> **Ambiguity:** The dashboard needs to support arbitrary closing dates (per the SAP Q3 ruling).
> **Your current assumption:** The IBNR triangle is annual — the UI will expose only
> `closing_year`; an arbitrary `closing_date` from other modules will be rounded down to
> `closing_date.year` for IBNR.
> **Question:** Is annual granularity acceptable for IBNR, or must we support quarterly /
> monthly development triangles for production?

---

## 13. Acceptance Criteria

IBNR module is considered "verified for current known data and assumptions" when:

- `IBNRLoader` loads all 596 rows, with normalized products and zero hidden drops
- `calculate_ibnr(...)` on the full `base ADE` sample returns `total_ibnr ≈ 135_205_244.46977875`
- all four per-year reserves match workbook targets within `1e-6`
- `_reconcile_ibnr()` returns `status == "matched"` with zero row mismatches
- assumption registry lists IBNR entries and the product-segmentation flag is visible in the
  audit summary
- unit + integration tests in §10 pass under `run_validation_suite`
- no hardcoded `closing_year`, `window_size`, or coefficients anywhere outside `legislative.yaml`
- session log captures residual blockers (Q1–Q3) and current totals

## 14. Do Not

- Do not invent synthetic production rows to "fill" the triangle
- Do not silently drop claims with `declaration_year > closing_year` — flag and exclude
  with a `CleaningEvent`
- Do not deduplicate by anything other than `claim_id` without logging
- Do not touch or modify files under `data/`
- Do not claim "100% correct" — use the phrasing from `PLAN.md` §11
