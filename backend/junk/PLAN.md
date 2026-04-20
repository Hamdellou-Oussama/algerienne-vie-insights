# PLAN.md

## Purpose

This file is the execution plan for building and validating a rigorous actuarial preprocessing and algorithm test suite for the hackathon provisioning system.

Primary objective:

- make preprocessing auditable, deterministic, and aggressively validated before trusting any downstream reserve calculations
- then implement and verify every algorithm needed for the target provisions without unverified assumptions

This plan is written so a fresh LLM session can continue from zero context.

## Mandatory Startup Protocol

At the start of the session:

1. Read [AGENTS.md](/home/maab/Documents/openData/AGENTS.md).
2. Read the latest file in `docs/session_logs/`.
3. Confirm the active module before writing code.

For the next implementation session, the active module is:

- `Data preprocessing + actuarial algorithm validation harness`

## Non-Negotiable Rules

- `data/` is read-only. Never modify raw files.
- Use only Python in `/home/maab/Documents/openData/.venv/bin/python`.
- Treat `HACKATHON_FOUNDATION_COMPLETE.md` as source-controlled guidance with strict source labeling:
  - `FACT` sections are implementation-grade unless contradicted by the raw data.
  - `SUGGESTED-NOT FINAL` sections are not business truth. They may guide structure, but not formulas or assumptions unless validated.
- No hardcoded legislative constants. The PE `72%` coefficient and similar parameters must be configurable.
- Every cleaning rule, transformation, and calculation must be logged and traceable.
- Never claim preprocessing is "done" or "correct" while open data ambiguities or mentor questions remain unresolved.

## Current Repo Reality As Of 2026-04-18

Raw workbooks currently present:

- `data/level 01-level2-ÉCHANTILLON DATA PPNA.xlsx`
- `data/level 01-DATA SAP groupe.xlsx`
- `data/level 01-ÉCHANTILLON DATA PE.xlsx`

Observed facts from inspection:

- There is currently no dedicated IBNR triangle workbook in `data/`.
- PPNA sample contains mixed date representations and many non-positive premiums.
- SAP sample contains statuses `SAP`, `REGLE`, `REJET`, and at least a few missing birth dates.
- PE sample contains many blank `NB d'année contrat` values.
- Some workbook output tabs are only partially populated.
- SAP workbook contains an internal contradiction:
  - `ETAT SORTIE ATTENDU` references `SAP GROUPE (2)!AB1`, which is `2025-06-30`
  - `RECAP` says `SAP au 31/12/2025`
- PE workbook output tab uses a `PPNA` header label in `OBJECTIF PE`; this appears to be a workbook artifact and must not be treated as business truth.

Initial anomaly profile already visible:

- PPNA:
  - `21266` non-empty rows in ` PRODUCTION`
  - `1382` negative `Prime nette`
  - `2267` zero `Prime nette`
  - `18401` rows where date fields are strings rather than Excel datetimes
- SAP:
  - `234` claim rows in `SAP GROUPE (2)`
  - status distribution: `SAP=174`, `REGLE=34`, `REJET=26`
  - `4` missing insured birth dates
  - `4` missing beneficiary birth dates
- PE:
  - `125` rows in `PE`
  - `124` blank `NB d'année contrat`
  - `20` negative `Résultat technique`
  - `29` positive `Provision d'égalisation`

Implication:

- preprocessing must be dataset-specific, not generic
- production validation for IBNR is currently blocked by missing real triangle data

## Success Definition

The project is only considered complete when all of the following are true:

- raw workbook structure is fully inventoried and documented
- every imported field has a typed schema, cleaning policy, and anomaly policy
- every preprocessing transformation is reproducible and logged
- no silent coercions or silent imputations exist
- every implemented actuarial formula is tied to a `FACT` source or explicit mentor confirmation
- every algorithm has at least one deterministic verification path
- unresolved assumptions are tracked in an assumption registry and are visible in outputs
- all open mentor blockers are either resolved or explicitly marked as preventing production sign-off

## Deliverables To Build

Minimum required deliverables:

- `src/` preprocessing package with dataset-specific loaders
- `src/` actuarial modules, one file per provision or method
- config files for legislative and preprocessing parameters
- assumption registry
- cleaning report generator
- dataset inventory report
- automated test suite
- reproducible validation command(s)
- session log for each coding session

Recommended file structure:

```text
src/
  config/
    legislative.yaml
    preprocessing.yaml
  domain/
    types.py
    enums.py
  preprocessing/
    workbook_inventory.py
    schema_registry.py
    lineage.py
    cleaning_report.py
    validators.py
    normalizers.py
    ppna_loader.py
    sap_loader.py
    pe_loader.py
    triangle_loader.py
  provisions/
    ppna.py
    psap.py
    sap.py
    pe.py
    ibnr_chain_ladder.py
    ibnr_bornhuetter_ferguson.py
    ibnr_loss_ratio.py
    ibnr_mack.py
    ibnr_bootstrap.py
    ibnr_munich.py
  orchestration/
    run_preprocessing.py
    run_validation_suite.py
  reporting/
    audit_export.py
    excel_export.py
tests/
  unit/
  integration/
  regression/
  property/
docs/
  session_logs/
  mentor_questions/
  data_inventory/
  validation_reports/
```

Notes:

- `triangle_loader.py` should exist, but must not invent production triangles.
- If no real IBNR dataset exists yet, use it only for synthetic and literature-backed test fixtures.

## Phase 0 — Fact Lock And Scope Lock

Before coding anything substantial:

1. Re-read the `FACT` sections relevant to:
   - PPNA
   - PSAP
   - SAP identity
   - PE
   - IBNR methods
2. Build a machine-readable algorithm registry with columns:
   - `algorithm_name`
   - `provision`
   - `formula_source`
   - `source_type` (`FACT`, `MENTOR`, `SUGGESTED`, `INFERRED`)
   - `production_dataset_available`
   - `implementation_status`
   - `verification_status`
   - `open_question`
3. Mark every `SUGGESTED-NOT FINAL` item as non-authoritative until verified.

Acceptance criteria:

- no formula enters implementation without a source label
- all current blockers are visible before writing core logic

## Phase 1 — Full Raw Data Inventory

Goal:

- reverse-engineer each workbook before writing the cleaning pipeline

Tasks:

1. Inventory every workbook, sheet, row count, column count, merged cell region, formula region, and visible output sheet.
2. Capture header rows exactly as they appear, including accents, spacing, and punctuation.
3. Produce per-sheet field dictionaries:
   - raw column label
   - canonical field name
   - inferred type
   - nullable or required
   - business meaning
   - example values
4. Record workbook-specific anomalies:
   - mixed string and datetime cells
   - mixed numeric and text cells
   - blank critical IDs
   - negative amounts
   - duplicate identifiers
   - unexpected categorical values
   - contradictory output tabs or dates
5. Compute raw file hashes so every downstream result can reference an immutable input version.

Required artifact:

- `docs/data_inventory/raw_workbook_inventory.md`

Acceptance criteria:

- every field in every active raw sheet is documented
- every expected output tab is catalogued as either `usable ground truth`, `partial ground truth`, or `non-authoritative template`

## Phase 2 — Dataset Contracts

Create explicit schema contracts for each current workbook.

### 2.1 PPNA Contract

Primary sheet:

- ` PRODUCTION`

Known fields to model:

- network
- product
- transaction type
- endorsement or policy identifiers
- insured identifier
- subscription date
- effect date
- expiry date
- net premium

Non-trivial issues already known:

- dates are mixed between true Excel datetimes and string dates
- negative premiums exist and may be legitimate for cancellations or endorsements
- zero premiums exist and require explicit handling

Required preprocessing decisions:

- exact date parsing convention
- day-count convention for PPNA
- handling of cancellations and negative premium rows
- deduplication key and duplicate policy logic

### 2.2 SAP Contract

Primary sheet:

- `SAP GROUPE (2)`

Known fields to model:

- network and agency
- product
- policy and adhesion IDs
- insured and beneficiary descriptors
- claim ID
- guarantee
- declared amount
- declaration date
- occurrence year
- occurrence date
- status
- settlement date
- paid amount
- payment gap
- SAP value at closing date

Non-trivial issues already known:

- output sheet date contradiction
- unclear business meaning of status `SAP`
- current workbook appears to contain direct SAP values, but foundation says `SAP = PSAP + IBNR`

Required preprocessing decisions:

- whether the file is a direct target dataset for SAP only
- whether claim rows represent settled, rejected, outstanding, or mixed cases
- whether missing birth dates matter for calculations or only for data quality reporting

### 2.3 PE Contract

Primary sheet:

- `PE`

Known fields to model:

- network
- product
- fiscal year
- guarantee
- emitted premiums
- opening REC or mathematical provisions
- opening SAP
- total credit
- paid claims
- closing REC or mathematical provisions
- closing SAP
- historical debit carry-forward
- total debit
- technical result
- claims charges for N, N-1, N-2, N-3
- contract-year count
- average historical claims charge
- equalization provision

Non-trivial issues already known:

- almost all `NB d'année contrat` values are blank
- one row uses `ADE`, most use `prévoyance`
- output tab label inconsistency exists

Required preprocessing decisions:

- whether blank `NB d'année contrat` is informational only or calculation-relevant
- whether `MOYENNE` should be trusted as input, recomputed, or both

### 2.4 IBNR Contract

Current status:

- no real IBNR production dataset is present in `data/`

Rule:

- do not fabricate production triangles
- do build the triangle schema and validation framework
- use synthetic and literature-backed fixtures until real data arrives

Acceptance criteria:

- each dataset has a typed contract and a documented anomaly policy
- every nullable field has an explicit reason for being nullable

## Phase 3 — Preprocessing Architecture

Build preprocessing as a deterministic pipeline with full lineage.

Core requirements:

- raw workbook read layer
- canonical schema mapping layer
- validation layer
- normalization layer
- anomaly classification layer
- cleaning report layer
- lineage layer

Every transformed row must retain:

- workbook name
- sheet name
- original row number
- original column label
- original value
- normalized value
- rule applied
- severity

Implement rule categories:

- `type_coercion`
- `date_normalization`
- `categorical_normalization`
- `duplicate_detection`
- `range_validation`
- `business_rule_validation`
- `manual_review_required`

Never:

- drop rows silently
- overwrite raw values without lineage
- clamp or impute without recording rationale

Acceptance criteria:

- one command can run preprocessing for all active datasets
- one command can emit a cleaning report and structured anomaly log

## Phase 4 — Cleaning Policy By Error Type

For each field, define one of:

- `reject`
- `coerce`
- `impute_with_rule`
- `retain_and_flag`
- `manual_review`

Required policies:

### Missing values

- classify by field criticality
- critical IDs and dates cannot be silently imputed
- missing informational fields may be retained with warning if not used in formulas

### Date normalization

- normalize to ISO 8601 in canonical outputs
- preserve raw source value separately
- test mixed Excel serials, Python datetimes, and string date formats
- record ambiguous parses as `manual_review_required`

### Numeric coercion

- support integer, decimal, and string-encoded numeric fields
- reject or flag locale issues explicitly
- preserve sign

### Negative values

- do not globally reject negatives
- classify by business context:
  - likely valid for PPNA cancellation or endorsement rows
  - likely invalid for impossible claim amounts unless explicitly justified

### Duplicates

- define dataset-specific duplicate keys
- detect both exact duplicates and business duplicates
- do not deduplicate until the rule is justified and logged

### Categorical normalization

- build controlled dictionaries for product, network, guarantee, and status fields
- preserve raw label and canonical label
- accent and case normalization must not destroy auditability

Acceptance criteria:

- every field has a policy
- every policy is test-covered

## Phase 5 — Verification Strategy For Preprocessing

Preprocessing must be verified with multiple independent methods.

### 5.1 Unit Tests

Create tests for:

- date parsing
- numeric coercion
- duplicate detection
- categorical normalization
- anomaly severity assignment
- lineage generation

### 5.2 Regression Tests On Raw Samples

For each workbook:

- run preprocessing against the exact sample file
- assert stable row counts before and after each transformation stage
- assert anomaly counts are reproducible
- assert no row disappears without explicit rule output

### 5.3 Adversarial Synthetic Tests

Create synthetic fixtures containing:

- mixed date formats
- malformed numeric strings
- duplicate rows
- contradictory statuses
- negative and zero amounts
- missing critical identifiers
- product label variants

### 5.4 Property Tests

Add property-style checks where appropriate:

- normalization is deterministic
- applying preprocessing twice yields the same canonical result
- lineage row counts are monotonic with respect to transformations
- canonical categories belong to controlled vocabularies

### 5.5 Workbook Reconciliation

Use embedded workbook outputs where possible:

- SAP workbook total can be reconciled directly because `ETAT SORTIE ATTENDU` contains formulas
- PPNA and PE output tabs currently look like templates only; treat them as layout hints, not final truth, until mentor confirmation or regenerated Excel formulas exist

Acceptance criteria:

- preprocessing has unit, regression, adversarial, and reconciliation coverage
- no transformation is trusted from a single test type only

## Phase 6 — Algorithm Implementation Order

Implement in this order:

1. preprocessing core
2. PPNA
3. PE
4. PSAP
5. SAP
6. IBNR family
7. orchestrated end-to-end runs

Rationale:

- PPNA and PE have immediately available raw data
- PSAP formula is clear but raw dataset availability must be confirmed
- SAP currently has a workbook but needs semantic clarification
- IBNR family requires both generic engine work and a real data request

## Phase 7 — Algorithm Verification Framework

Every algorithm must pass all applicable layers below.

### 7.1 Formula Reproduction

For each method:

- encode the exact formula from `FACT`
- include docstring references to the source section
- verify on hand-worked micro examples

### 7.2 Deterministic Golden Tests

Where ground truth exists:

- compare against workbook totals
- compare against manual hand calculations stored in fixtures

### 7.3 Cross-Method Consistency Tests

Required examples:

- `SAP = PSAP + IBNR`
- Mack expected reserve should align with Chain Ladder reserve estimate on the same triangle
- Bornhuetter-Ferguson reserve should collapse appropriately in highly developed periods
- PE must be zero when `Résultat technique <= 0`

### 7.4 Sensitivity Tests

Perturb inputs slightly and verify:

- monotonicity where expected
- scale behavior where expected
- no unstable sign flips without explanation

### 7.5 Audit Tests

For each provision result:

- prove the exact source rows used
- prove the exact parameters used
- prove the exact intermediary values used

Acceptance criteria:

- no algorithm is marked verified from a single reconciled sample alone

## Phase 8 — Per-Algorithm Validation Requirements

### PPNA

Must verify:

- prorata temporis formula
- day-count convention
- policy boundary conditions
- treatment of negative and zero premium transactions
- aggregation by product and network

### PE

Must verify:

- trigger condition `RT_N > 0`
- formula `min(72% * RT_N+, 15% * average(A1, A2, A3))`
- configurable `72%` and `15%`
- historical charge inputs are recomputed from source fields where possible

### PSAP

Must verify:

- dossier-by-dossier reserve logic
- non-negative outstanding interpretation
- treatment of settled and rejected claims

### SAP

Must verify:

- whether current workbook is direct SAP or a proxy for PSAP-only outstanding
- identity consistency with PSAP and IBNR once those modules exist
- contradiction between workbook closing dates is resolved explicitly

### IBNR Family

Target methods:

- Chain Ladder
- Bornhuetter-Ferguson
- Loss Ratio
- Mack
- Bootstrap
- Munich Chain Ladder if both paid and incurred triangles are available

Must verify:

- triangle construction
- line-of-business segmentation
- cumulative versus incremental consistency
- factor estimation
- reserve totals
- uncertainty outputs where applicable

Hard rule from AGENTS and foundation:

- do not mix heterogeneous products in the same Chain Ladder triangle

## Phase 9 — Real-Data Gap Handling

Current blocker:

- no real IBNR triangle dataset is present

Required response:

1. Implement the generic triangle and method engines using synthetic and literature-backed fixtures.
2. Keep production IBNR validation status as `blocked`.
3. Ask mentors or organizers for:
   - real claims development data
   - segmentation guidance
   - expected valuation date
   - whether paid, incurred, and claim-count triangles are all required

Do not:

- invent production data
- extrapolate production conclusions from synthetic-only success

## Phase 10 — Mentor Questions To Raise Early

Use the AGENTS.md format exactly.

### Question 1 — Missing IBNR dataset

> **Context:** We are building a rigorous preprocessing and actuarial validation harness for all target provisions, including IBNR methods.
> **Ambiguity:** The current `data/` directory contains PPNA, SAP, and PE workbooks, but no real triangle dataset for IBNR.
> **Your current assumption:** We can implement and unit-test triangle methods on synthetic fixtures, but production validation is blocked.
> **Question:** Can you provide the real IBNR source data and specify the required segmentation basis for triangles by line of business?
>
> **ANSWER:** IBNR data file will be provided later, continue with assumption for now, flag it properly.

### Question 2 — SAP workbook meaning

> **Context:** We are validating the SAP module against `level 01-DATA SAP groupe.xlsx`.
> **Ambiguity:** The foundation states `SAP = PSAP + IBNR`, but the workbook includes a direct `sap au 30/06/2025` column and statuses such as `SAP`, `REGLE`, and `REJET`.
> **Your current assumption:** This workbook is a direct target dataset for outstanding claim provisioning rather than a full decomposed `PSAP + IBNR` calculation dataset.
> **Question:** What is the exact business interpretation of this SAP workbook, and should it be treated as direct SAP ground truth or as an intermediate claim-level dataset?
>
> **ANSWER:** work with the formula/data from the dataset (this is a confusion because of the poor french translations which mix a bunch of things and call everything SAP)

### Question 3 — SAP closing date contradiction

> **Context:** We are reconciling workbook outputs for SAP.
> **Ambiguity:** `ETAT SORTIE ATTENDU` points to `2025-06-30`, while `RECAP` references `31/12/2025`.
> **Your current assumption:** The formal expected output for the provided sample is the formula-driven `ETAT SORTIE ATTENDU`, but this needs confirmation.
> **Question:** Which closing date is the correct target for validation in this sample workbook?
>
> **ANSWER:** we do not really care, in the actual dashboard, the user would have the option to choose the `date de cloture` freely (since it depends on the particular enterprise practices), so yeah, it should work for any day of the year. yes, including feb 29th.

### Question 4 — PPNA treatment of negative premiums and day count

> **Context:** We are designing a strict PPNA preprocessing and calculation module on the provided workbook.
> **Ambiguity:** The sample contains many negative and zero `Prime nette` rows, likely linked to endorsements or cancellations, and date fields are mixed-format.
> **Your current assumption:** Negative premiums are potentially valid business events and must not be dropped, but the exact PPNA treatment and day-count convention need confirmation.
> **Question:** What day-count convention and business treatment should be applied to negative or zero-premium endorsement and cancellation rows in PPNA?
>
> **ANSWER:** in PPNA, we do not consider "les sinistres", only "les primes", since a PPNA is part of an active and valid contract, the actuariat should handle it even when at a loss.

### Question 5 — PE input expectations

> **Context:** We are implementing the equalization provision with a full audit trail.
> **Ambiguity:** The `PE` workbook contains many blank `NB d'année contrat` values and a partially inconsistent output tab label.
> **Your current assumption:** The formula should rely on `Résultat technique` and historical claims charges from the factual formula, while blank `NB d'année contrat` is informational unless told otherwise.
> **Question:** Is `NB d'année contrat` required for the official PE calculation, or can it be treated as non-blocking metadata in this dataset?
> **ANSWER:** here is a reminder of the official PE formula:
>
> ```
> Provision d'Égalisation (PE) – Assurance Groupe
>
> SI Résultat technique $RT_N > 0$
>
> $$PE_N = \min (72\% \times RT_N^+ ; 15\% \times MOYENNE(A_1; A_2; A_3))$$
>
> **Avec :**
> * $A_1$ Charge sinistre années (N-1)
> * $A_2$ Charge sinistre années (N-2)
> * $A_3$ Charge sinistre années (N-3)
> ```

`NB d'année contrat` is just used in Excel to divide the values of the previous 3 columns (Charge sinistre (N-1), Charge sinistre (N-2), Charge sinistre (N-3)), and is safe to ignore/drop. DO READ EXCEL FORMULAE from now on.

## Phase 11 — Definition Of Done For "Preprocessing Is Trusted"

Preprocessing may only be called trusted when:

- every active raw workbook has a documented schema contract
- every active field has a cleaning policy
- every anomaly type has at least one automated test
- the cleaning report is generated automatically
- raw-to-canonical lineage is exportable
- all current contradictions are either resolved or explicitly flagged in outputs
- no unresolved blocker remains hidden

Do not use the phrase "100% correct" unless all blockers are closed.
Use:

- `verified for current known data and assumptions`
- `blocked pending mentor clarification`
- `synthetic-only validated`

## First Execution Slice For The Next LLM Session

The next session should do exactly this first:

1. Create the preprocessing scaffolding and typed schema registry.
2. Build raw workbook inventory extraction and save the report.
3. Implement PPNA, SAP, and PE dataset contracts.
4. Implement cleaning report and lineage structures.
5. Add regression tests that lock current anomaly counts.
6. Prepare the mentor questions above if answers are not already available.

Do not start IBNR production validation before step 6 is complete.

## Final Reminder

The target is not only to compute provisions.
The target is to prove that the system:

- read the raw data correctly
- cleaned it explicitly
- applied only justified assumptions
- produced traceable, reproducible, auditable actuarial results
