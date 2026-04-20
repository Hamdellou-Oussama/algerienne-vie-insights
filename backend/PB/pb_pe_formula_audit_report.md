# PB and PE Formula Audit (Professional)

## Scope

This audit is fully contained in one folder:

- analysis_assets/pb_pe_audit/

Inputs:

- EIC-provisionnement 170426.pdf
- data/level 01-ÉCHANTILLON  DATA PE.xlsx

Execution script:

- 00_run_pb_pe_audit.py

## 1) PB calculation logic identified from EIC-provisionnement 170426

PB-related extracted lines (from pb_rules_summary.json):

- Provision PB = Participation aux bénéfices due mais non encore versée
- PB = Résultat distribuable × Taux de participation (α)
- Ratio S/P = Sinistres / Primes
- PB uniquement si Ratio S/P < seuil (ex : 85%)
- PB = (200 000+100 000) × 85% = 255 000

Interpretation used for validation context:

- PB is tied to distributable technical result.
- PB is conditional and constrained by technical criteria.
- The PE workbook operationalizes this with a bounded rule in column U.

## 2) Full formula extraction from PE workbook with feature names

Script:

- 02_extract_pe_formulas.py

Outputs:

- pe_formulas_detailed.json
- pe_formulas_detailed.csv
- pe_pb_formulas_only.csv
- pe_formula_inventory_stats.json

Extraction statistics:

- Total formulas extracted: 751
- PB-focused formulas: 126
- Sheet: PE

Main formula families detected (Excel style):

- H[row] = SUM(E[row]:G[row])
- M[row] = SUM(I[row]:L[row])
- N[row] = H[row] - M[row]
- O[row] = K[row] + I[row] - G[row]
- T[row] = AVERAGE(P[row]:R[row])
- Special case: T4 = SUM(P4:R4)/S4
- U[row] = IF(N[row]<0,0,MIN(72%*N[row],15%*T[row]))
- U2 = SUM(U4:U128)

Feature mapping examples:

- U4 target feature: Provision d'égalisation
- U4 formula: =IF(N4<0,0,MIN(72%*N4,15%*T4))
- U4 references: N4:Résultat technique, T4:MOYENNE

- H4 target feature: TOTAL  CREDIT
- H4 formula: =SUM(E4:G4)
- H4 references:
  E4: Les primes émises_garantie Décès 2022
  F4: (REC/Provisions Mathématiques)_Décès au 01/01/2022
  G4: Provisions pour SAP AU 01/01/2022

- M4 target feature: TOTAL DEBIT
- M4 formula: =SUM(I4:L4)
- M4 references:
  I4: Les sinistres payés_Décès de l'éxercice 2022
  J4: (REC/Provisions Mathématiques)_Décès au 31/12/2022
  K4: Provisions pour SAP au 31/12/2022
  L4: Report du solde Débiteur eventuel des exercices anterieurs

## 3) Professional test suite and comparison

Script:

- 03_test_pe_formulas_professional.py

Test coverage:

- credit_total: H = SUM(E:G)
- debit_total: M = SUM(I:L)
- technical_result: N = H - M
- claim_charge: O = K + I - G
- moving_average: T = AVERAGE(P:R) or SUM(P:R)/S
- pb_formula: U = IF(N<0,0,MIN(72%*N,15%*T))
- pb_total: U2 = SUM(U4:U128)
- pb_non_negative: U >= 0
- pb_branch_if_n_negative: If N<0 then U=0

Validation outputs:

- pe_formula_test_checks.csv
- pe_formula_test_mismatches.csv
- pe_formula_test_summary.json

Final test results:

- total_checks: 1001
- total_mismatches: 0
- overall_pass_rate: 1.0
- pb_total_expected_u2: 93561414.06179482
- pb_total_actual_u2: 93561414.06179482
- pb_total_diff: 0.0

Per-test status:

- claim_charge: 125/125 pass
- credit_total: 125/125 pass
- debit_total: 125/125 pass
- moving_average: 125/125 pass
- pb_branch_if_n_negative: 125/125 pass
- pb_formula: 125/125 pass
- pb_non_negative: 125/125 pass
- pb_total: 1/1 pass
- technical_result: 125/125 pass

## 4) Folder deliverables

All deliverables are in analysis_assets/pb_pe_audit/:

- 00_run_pb_pe_audit.py
- 01_extract_eic_pb_rules.py
- 02_extract_pe_formulas.py
- 03_test_pe_formulas_professional.py
- eic_provisionnement_text.txt
- pb_rules_hits.json
- pb_rules_summary.json
- pe_formulas_detailed.json
- pe_formulas_detailed.csv
- pe_pb_formulas_only.csv
- pe_formula_inventory_stats.json
- pe_formula_test_checks.csv
- pe_formula_test_mismatches.csv
- pe_formula_test_summary.json
- pb_pe_audit_run_log.json
- pb_pe_formula_audit_report.md
