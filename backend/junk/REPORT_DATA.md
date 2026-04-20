# REPORT_DATA.md

## 1) Document purpose

This document is the **frontend implementation contract** for the current backend in `/home/maab/Documents/openData`.

It explains:

- exactly what data uploads are expected (based on current Excel samples)
- what calculations are currently available in backend
- which parameters/configs should be user-settable from frontend, with defaults and placement recommendations
- suggested visualizations (including formulas to display in the UI)

> Important: current backend computes from uploaded/raw data and formulas; it does **not** use workbook “ground truth totals” as primary computation inputs.

---

## 2) Current backend execution surface (important for frontend wiring)

### 2.1 Current state

There is currently **no HTTP API layer** (no FastAPI/Flask/Streamlit/Dash backend service exposed in `src/`).

Backend runs as Python orchestration/modules:

- `src/orchestration/run_audit.py` (end-to-end processing + summaries)
- `src/provisions/*.py` (calculation engines)
- `src/preprocessing/*.py` (load, normalize, lineage, cleaning events)
- `src/reporting/reconciliation.py` and `src/reporting/assumptions.py` (validation/audit artifacts)

### 2.2 Frontend integration implication

Frontend devs should plan one of these integration modes:

1. **Preferred now (fastest):** read generated artifacts from `docs/validation_reports/*.json`.
2. **Near-term:** thin API wrapper around existing orchestrator/functions.

This report is written so either mode can use the same data contracts.

---

## 3) Upload data contract (current expected files)

For now assume users upload the same workbook structures as current samples.

## 3.1 Required uploads

1. **PPNA workbook**

   - file pattern: `level 01-level2-ÉCHANTILLON DATA PPNA.xlsx`
   - authoritative sheet: ` PRODUCTION`
   - header row: `1`
   - data starts at row: `2`
2. **SAP workbook**

   - file pattern: `level 01-DATA SAP groupe.xlsx`
   - authoritative sheet: `SAP GROUPE (2)`
   - header row: `2`
   - data starts at row: `3`
3. **PE workbook**

   - file pattern: `level 01-ÉCHANTILLON DATA PE.xlsx`
   - authoritative sheet: `PE`
   - header row: `3`
   - data starts at row: `4`
4. **IBNR workbook**

   - file pattern: `level 02-ÉCHANTILLON DATA IBNR.xlsx`
   - authoritative sheet: `base ADE`
   - header row: `1`
   - data starts at row: `2`

## 3.2 Canonical fields expected by backend (normalized names)

### PPNA canonical fields

- `network`
- `product`
- `transaction_type`
- `policy_endorsement_id`
- `policy_id`
- `insured_id`
- `subscription_date` (ISO date)
- `effect_date` (ISO date)
- `expiry_date` (ISO date)
- `net_premium` (float)

### SAP canonical fields

- `network`
- `agency`
- `product`
- `policy_id`
- `policy_effect_date`
- `policy_expiry_date`
- `adhesion_id`
- `insured_name`
- `insured_birth_date` (nullable)
- `adhesion_date`
- `client_code`
- `client_name`
- `business_type`
- `beneficiary_name`
- `relationship`
- `beneficiary_gender`
- `beneficiary_birth_date` (nullable)
- `claim_id`
- `guarantee`
- `declared_amount`
- `declaration_date`
- `occurrence_year`
- `occurrence_date`
- `status` (`sap`/`regle`/`rejet` normalized)
- `settlement_notification_date` (nullable)
- `paid_amount`
- `settlement_gap`
- `sap_closing_amount`

### PE canonical fields

- `network`
- `product`
- `fiscal_year`
- `guarantee`
- `emitted_premiums`
- `opening_rec_math_provision`
- `opening_sap`
- `total_credit`
- `paid_claims`
- `closing_rec_math_provision`
- `closing_sap`
- `historical_debit_carry_forward`
- `total_debit`
- `technical_result`
- `claims_charge_n`
- `claims_charge_n1`
- `claims_charge_n2`
- `claims_charge_n3`
- `contract_year_count` (nullable, informational)
- `historical_average_claims_charge`
- `equalization_provision`

### IBNR canonical fields

- `claim_id`
- `product`
- `adhesion_id`
- `subscription_date`
- `subscription_year`
- `effect_date`
- `expiry_date`
- `occurrence_date`
- `occurrence_year`
- `declaration_date`
- `declaration_year`
- `claim_amount`
- `development_lag_years` (nullable/informational)

## 3.3 Frontend upload validations to implement

- validate workbook + sheet names before submitting
- validate minimum required headers exist
- detect and display row counts
- display non-blocking quality warnings (do not auto-drop rows)

Data quality stats currently tracked by backend (for UI badges):

- PPNA: `negative_premium_rows`, `zero_premium_rows`, `string_date_rows`
- SAP: missing birthdates, status distribution
- PE: blank contract-year count, negative technical result count
- IBNR: product distribution, occurrence-year distribution, lag issues

---

## 4) Calculations currently available in backend

All modules below are implemented and reconciled (`matched`) against workbook references in current sample runs.

### 4.1 PPNA (Provision pour Primes Non Acquises)

**Row formula currently implemented** (workbook-aligned):

$$
\text{contract\_days} = (\text{expiry\_date} - \text{effect\_date}) + 1
$$

$$
\text{remaining\_days}=
\begin{cases}
0 & \text{if } closing\_date < effect\_date \\
0 & \text{if } closing\_date > expiry\_date \\
expiry\_date - closing\_date & \text{otherwise}
\end{cases}
$$

$$
\text{unearned\_ratio} = \frac{\text{remaining\_days}}{\text{contract\_days}},
\quad
\text{PPNA}_{row} = \text{net\_premium} \times \text{unearned\_ratio}
$$

**Outputs:**

- `closing_date`
- `total_amount`
- `by_network_product`
- `row_results[]` (full row-level audit)
- `parameters` (method/formula metadata)

### 4.2 PE (Provision d'Égalisation)

$$
\text{historical\_average} = \frac{\text{claims\_charge\_n1} + \text{claims\_charge\_n2} + \text{claims\_charge\_n3}}{3}
$$

$$
\text{positive\_component} = \max(0, \text{technical\_result}) \times c_{pos}
$$

$$
\text{historical\_component} = \text{historical\_average} \times c_{hist}
$$

$$
\text{PE}_{row}=
\begin{cases}
0 & \text{if } technical\_result \le 0 \\
\min(\text{positive\_component},\ \text{historical\_component}) & \text{if } technical\_result > 0
\end{cases}
$$

with defaults:

- $c_{pos}=0.72$
- $c_{hist}=0.15$

**Outputs:** total, breakdown, row audit, parameters.

### 4.3 SAP (mentor/workbook corrected rule)

For each claim row:

$$
\text{SAP}_{row}=
\begin{cases}
0 & \text{if } D < declaration\_date \\
declared\_amount & \text{if } declaration\_date < D < settlement\_notification\_date \\
0 & \text{if status=REJET} \\
declared\_amount & \text{if status=SAP} \\
\max(0, declared\_amount - paid\_amount) & \text{otherwise (e.g. REGLE)}
\end{cases}
$$

where $D$ is SAP closing date.

Special handling:

- blank `paid_amount` treated as `0.0`
- blank settlement notification can still flow to status branch

**Outputs:** total, breakdown, row audit, parameters.

### 4.4 IBNR base method: Chain Ladder (volume-weighted)

1) Build incremental/cumulative triangle by occurrence year and development year.
2) Development factors:

$$
F_j = \frac{\sum_i C_{i,j}}{\sum_i C_{i,j-1}}
$$

3) Project cumulative:

$$
\hat{C}_{i,j} = F_j \times \hat{C}_{i,j-1}
$$

4) By occurrence year:

$$
Reserve_i = Ultimate_i - Diagonal_i
$$

5) Portfolio total:

$$
IBNR_{total} = \sum_i Reserve_i
$$

**Outputs:**

- triangle cells (known + projected)
- development factors
- by occurrence year audits
- excluded rows
- total IBNR

### 4.5 IBNR additional methods already implemented

- **Mack CL uncertainty layer**
  - returns `sigma2_by_dev`, AY MSE/SE/CV, `total_se_naive`
- **Bornhuetter-Ferguson**
  - prior currently from mature AY ratio (`needs_review` assumption)
- **Benktander**
  - iterative blend, default `k=2`
- **Bootstrap ODP**
  - residual resampling simulation (`n_sim`, `seed`, percentiles)

### 4.6 Current sample outputs (latest audit)

- PPNA total: `3,901,156.363858455`
- PE total: `93,561,414.06179482`
- SAP total: `157,200,000.0`
- IBNR CL total: `135,205,244.46977875`
- IBNR method comparison also available:
  - `mack_se`, `bf_total`, `benktander_total`, `bootstrap_mean`, `bootstrap_p95`, `method_range`

---

## 5) What frontend should make settable (full parameter matrix)

Below is the recommended **frontend control surface** with source and defaults.

## 5.1 User-level controls (main calculation screen)

1. **PPNA closing date**

   - key: `ppna.closing_date`
   - current source: workbook ` PRODUCTION!P1`
   - recommended frontend default: prefill from workbook, user-editable
2. **SAP closing date**

   - key: `sap.closing_date`
   - current source: workbook `SAP GROUPE (2)!AC2`
   - recommended frontend default: prefill from workbook, user-editable
3. **PE coefficients**

   - keys:
     - `pe.positive_result_coefficient` (default `0.72`)
     - `pe.historical_average_coefficient` (default `0.15`)
   - source file today: `src/config/legislative.yaml`
   - **must** be editable from admin/front (legislative requirement)
4. **IBNR segmentation mode**

   - key: `ibnr.segment_by_product` (boolean)
   - default now: `false` (mixed mode, workbook-compatible)
   - `true` => homogeneous triangles per product
5. **IBNR closing year**

   - key: `ibnr.closing_year`
   - default now: `2025`
6. **IBNR occurrence window size**

   - key: `ibnr.occurrence_year_window_size`
   - default now: `4`

## 5.2 Method toggles (IBNR comparison tab)

- `ibnr.mack.enabled` (default `true`)
- `ibnr.bornhuetter_ferguson.enabled` (default `true`)
- `ibnr.benktander.enabled` (default `true`)
- `ibnr.bootstrap_odp.enabled` (default `true`)

## 5.3 Method parameters (advanced panel)

- BF:

  - `ibnr.bornhuetter_ferguson.prior_basis` (default `mature_ay_ratio`)
  - `ibnr.bornhuetter_ferguson.mature_ay` (default `2022`)
  - `ibnr.bornhuetter_ferguson.prior_elr` (currently `null`, not used unless model expanded)
- Benktander:

  - `ibnr.benktander.k` (default `2`)
- Bootstrap:

  - `ibnr.bootstrap_odp.n_sim` (default `1000`)
  - `ibnr.bootstrap_odp.random_seed` (default `42`)
  - `ibnr.bootstrap_odp.percentiles` (default `[50,75,90,95,99]`)

## 5.4 Preprocessing/admin settings (optional, admin-only)

Source: `src/config/preprocessing.yaml`

- workbook path per module
- sheet name per module
- header/data start rows

These should be exposed only in an **Admin / Data Source Mapping** page, not regular business user UI.

---

## 7) Suggested frontend visualizations (comprehensive)

## 7.1 Executive overview page

1. **KPI cards**

   - PPNA total
   - PE total
   - SAP total
   - IBNR total
   - grand total reserves
2. **Provision composition donut**

   - slices: PPNA/PE/SAP/IBNR
3. **Reconciliation health badge row**

   - module statuses (`matched` / `needs_review`)
4. **Assumption risk counters**

   - active / needs_review counts

## 7.2 Data quality & ingestion page

1. **Upload checklist + parser status** per workbook
2. **Row counts and anomaly counters** per dataset
3. **Cleaning events severity distribution** (DEBUG/INFO/WARNING/ERROR)
4. **Top anomalies table** with drill-down rows
5. **Lineage explorer** (raw value -> normalized value -> rule applied)

## 7.3 PPNA page

1. **Formula panel** showing PPNA equations
2. **Waterfall**: net premium -> ratio -> PPNA totals
3. **Histogram** of unearned ratios
4. **Stacked bar** by network/product
5. **Table** of row-level PPNA audit (`ppna_amount`, `remaining_days`, reason)

## 7.4 PE page

1. **Formula panel** with min-cap logic
2. **Scatter**: technical_result vs equalization_provision
3. **Bar chart** comparing:
   - positive_result_component
   - historical_average_component
   - chosen PE
4. **Heatmap** by network/product/fiscal_year
5. **Rows with technical_result <= 0** highlighted (PE=0 branch)

## 7.5 SAP page

1. **Decision tree formula panel** (branch visualization)
2. **Status distribution chart** (`SAP`, `REGLE`, `REJET`)
3. **Timeline view** declaration -> notification -> closing date
4. **Outstanding amount chart** `declared - paid` for REGLE branch
5. **Claim-level audit table** with inclusion reason

## 7.6 IBNR page (core actuarial analytics)

1. **Triangle heatmap** (incremental and cumulative toggle)
2. **Development factor cards** (`F1`, `F2`, `F3`, ...)
3. **By occurrence year bars** (Diagonal, Ultimate, Reserve)
4. **Known vs projected triangle cells** visual distinction
5. **Excluded rows diagnostics** table (reasoned exclusions)

## 7.7 IBNR methods comparison page (innovation differentiator)

1. **Method comparison bar chart**
   - Chain Ladder, BF, Benktander, Bootstrap mean
2. **Range indicator** (`method_range`)
3. **Mack uncertainty panel**
   - total SE
   - AY-level CV bars
4. **Bootstrap distribution plot**
   - histogram/density of simulated totals
   - percentile markers (p50, p75, p90, p95, p99)
5. **Toggle chips** for enabled methods

## 7.8 Assumptions & governance page

1. **Assumption registry table**
   - name, value, source type, status, justification, affected modules
2. **Filters**
   - `active`, `needs_review`, `blocked`
3. **Highlight LLM-suggested assumptions pending mentor validation**

## 7.9 Reconciliation & audit page

1. **Per-module reconciliation cards**
   - python total vs excel total vs difference
2. **Row match gauges**
3. **Evidence viewer** (formula examples and key workbook cells)
4. **Mismatch sample table** (if any)

---

## 8) Formula snippets to embed in frontend UI

Use these in expandable “Formula” panels.

### PPNA

$$
PPNA_{row}=net\_premium\times\frac{remaining\_days}{contract\_days}
$$

with in-window remaining-days rule.

### PE

$$
PE=\begin{cases}
0 & technical\_result\le0\\
\min(0.72\cdot technical\_result,\ 0.15\cdot historical\_average) & technical\_result>0
\end{cases}
$$

(0.72 and 0.15 are frontend-settable coefficients.)

### SAP

Branching rule by closing date, declaration date, notification date, status and paid amount.

### IBNR Chain Ladder

$$
F_j=\frac{\sum_i C_{i,j}}{\sum_i C_{i,j-1}},\quad
\hat{C}_{i,j}=F_j\cdot\hat{C}_{i,j-1},\quad
Reserve_i=Ultimate_i-Diagonal_i
$$

---

## 9) LLM-optimized implementation checklist for frontend team

- [ ] Build upload wizard for 4 workbooks with sheet/header validation
- [ ] Build parameter panel from section 5 (with defaults prefilled)
- [ ] Run backend orchestration / consume JSON artifacts
- [ ] Render overview KPIs and provision composition
- [ ] Add module tabs: PPNA, PE, SAP, IBNR
- [ ] Add IBNR methods comparison and uncertainty visualizations
- [ ] Add assumptions registry and reconciliation pages
- [ ] Add formula panels in each module page
- [ ] Add anomaly and lineage drill-down components
- [ ] Add export buttons (JSON, CSV, PDF-ready tables)

---

## 10) Known caveats to display in UI

1. IBNR advanced methods include `needs_review` assumptions:

   - Mack process variance simplification
   - Mack portfolio correlation simplification
   - BF prior basis assumption
   - Bootstrap one-stage residual design
2. Current reference mode for reconciliation is IBNR mixed triangle (`segment_by_product=false`).
3. `ETAT DE SORTIE` (PPNA) and legacy SAP `AB` path are not authoritative computation sources.
4. Missing or unusual rows are retained for auditability (not silently dropped).

---

## 11) Recommended frontend page map (final)

1. `Dashboard`
2. `Upload & Validation`
3. `PPNA`
4. `PE`
5. `SAP`
6. `IBNR Chain Ladder`
7. `IBNR Method Comparison`
8. `Assumptions Registry`
9. `Reconciliation & Audit`
10. `Admin Settings` (config + coefficients + method toggles)

This page map directly matches current backend capabilities and audit outputs.
