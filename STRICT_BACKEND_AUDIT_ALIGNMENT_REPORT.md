# Strict Backend Audit and Alignment Report

Date: 2026-04-19
Scope: Backend actuarial alignment and frontend-backend traceability for SAP, PB, bilan deltas, upload reliability, and IBNR method comparison rendering.

---

## 1) SAP Alignment (Final Rule)

Backend source:
- backend/src/provisions/sap.py

Implemented row rule:
1. If closing_date < declaration_date -> SAP = 0
2. Else if declaration_date < closing_date < settlement_notification_date -> SAP = declared_amount
3. Else:
- status REJET -> SAP = 0
- status SAP -> SAP = declared_amount
- otherwise -> SAP = max(0, declared_amount - paid_amount)

Status:
- Strictly aligned to clipped outstanding behavior (no negative SAP in final non-REJET branch).
- Dataset rule text in code updated to match implementation.

Unit coverage:
- backend/tests/unit/test_sap.py validates branch behavior and no-negative aggregate guarantees.

---

## 2) PB Alignment and Control Layer

Backend sources:
- backend/src/provisions/pb.py
- backend/src/backend/services.py

Implemented formula path:
- total_credit = premiums_n + rec_opening + sap_opening
- management_fee_amount = management_fee_rate * premiums_n
- total_debit = claims_paid_n + prec_closing + sap_closing + management_fee_amount + prior_debit_carryover
- credit_balance = total_credit - total_debit
- pb_eligible = (loss_ratio <= threshold)
- PB = 0 if ineligible or credit_balance <= 0
- PB = pb_rate * credit_balance otherwise

Implemented transparency fields:
- effective_loss_ratio_threshold
- effective_pb_rate
- eligibility_reason
- zero_reason

Implemented run-level control:
- allow_row_level_override is accepted in run parameters and propagated to PB calculator.
- When disabled, row-level pb_rate and threshold do not override defaults.

Implemented control validation:
- If allow_row_level_override=false and default_pb_rate=0, then total PB must be 0.
- Enforced in backend/src/backend/services.py (_validate_pb_zero_rate_control).

Implemented PB audit artifact:
- pb_audit.json generated for PB runs.
- Contains row-level stored vs recomputed PB delta and effective parameter traces.
- Exposed in run artifacts.

Unit/API coverage:
- backend/tests/unit/test_pb.py validates effective fields and override-disable control behavior.
- backend/tests/api/test_backend_api.py validates PB artifact matrix including pb_audit.json.

---

## 3) Level3 Bilan Delta Reporting

Backend source:
- backend/src/backend/services.py (compute_level3_bilan)

Implemented outputs:
- years[].reserves_montant_old_signed
- years[].reserves_montant_delta_new_minus_old_signed
- reserve_totals_comparison:
- total_reserves_new
- total_reserves_old_signed
- delta_new_minus_old_signed
- reserves_delta_by_year[] with per-year new-vs-old signed delta

Status:
- Bilan response now exposes old-vs-new reserve impact in totals and by year.
- Existing balance checks remain in place.

---

## 4) Upload/Run Reliability and Artifact Matrix

API test source:
- backend/tests/api/test_backend_api.py

Implemented reliability checks:
- Domain matrix coverage: ppna, sap, pe, pb, ibnr
- For each domain:
- upload workbook
- verify xlsx/csv/txt document downloads
- create run
- verify rows endpoint
- verify artifacts: result.json, rows.json, cleaning_report.json, cleaning_report.md
- verify pb_audit.json for PB domain
- repeat upload-version and run cycles

Status:
- Multi-domain upload/run/artifact validation implemented and passing.

---

## 5) Frontend Traceability (IBNR + Import/Run Wiring)

Frontend sources:
- frontend/src/routes/app.ibnr.tsx
- frontend/src/routes/app.import.tsx
- frontend/src/components/DomainRunBanner.tsx
- frontend/src/lib/api/runRows.ts
- frontend/src/lib/api/types.ts

Implemented frontend behavior:
- IBNR page reads backend result artifact and parses method_comparison.
- Method selector added with localStorage persistence.
- Method comparison table rendered from backend payload.
- Selected method total drives headline IBNR KPI on the page.
- Import page adds IBNR selected_method in run parameters.
- Domain run relaunch banner passes selected_method for ibnr reruns.
- Hardcoded import-page validation mock table removed.

Status:
- Frontend IBNR comparison rendering is now backend-driven.

---

## 6) Validation Evidence (Executed)

Backend (targeted modified scope):
- Command: cd backend ; ../.venv/Scripts/python.exe -m pytest tests/unit/test_sap.py tests/unit/test_pb.py tests/integration/test_pb_workbook.py tests/api/test_backend_api.py --tb=short
- Result: 31 passed

Backend (full suite from workspace root):
- Command: $env:PYTHONPATH = "backend"; .venv/Scripts/python.exe -m pytest backend/tests -q --tb=no
- Result: 126 passed, 10 subtests passed

PB workbook integration isolation (root-run reproducibility):
- Command: $env:PYTHONPATH = "backend"; .venv/Scripts/python.exe -m pytest backend/tests/integration/test_pb_workbook.py -q -vv --maxfail=1 --tb=long
- Result: 10 passed, 5 subtests passed

Frontend validation:
- VS Code diagnostics on modified files: no errors in
- frontend/src/routes/app.ibnr.tsx
- frontend/src/routes/app.import.tsx
- frontend/src/components/DomainRunBanner.tsx
- frontend/src/lib/api/runRows.ts
- frontend/src/lib/api/types.ts
- Full frontend workspace lint/build currently fails due pre-existing unrelated debt outside this strict audit scope:
- lint: 213 errors, 5 warnings
- build: TS errors in legacy/non-audited files (example paths include src/components/KPICard.tsx and src/hooks/useMetrics.ts)

---

## 7) Final Status

Backend strict audit alignment: COMPLETE
- SAP clipped rule, PB control+auditability, bilan delta outputs, and upload artifact reliability are implemented and validated.

Frontend strict backend-traceability scope: COMPLETE for audited changes
- IBNR method comparison UI and selected_method run propagation are implemented.

Repo-wide frontend quality gate: BLOCKED by pre-existing unrelated issues
- Not introduced by audited backend alignment changes.
