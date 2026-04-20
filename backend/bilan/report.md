# Level3 Bilan Audit Report

## Final status

- Pipeline status: PASS
- Script run: successful
- SAP formula reproduction: 234/234 rows matched
- Bilan tests: 12/12 passed

## Main fixes applied

1. Corrected SAP Method B implementation in comparison logic.
2. Switched bilan computation to dynamic year-end valuation:
   - opening at 31/12/N-1
   - closing at 31/12/N
3. Enforced year assignment rules:
   - declarations by declaration year
   - reglements/rejets by notification year
4. Added stronger tests for:
   - Option A carry-forward
   - SAP method drift
   - section year logic

## SAP method decision

Selected:

- Method B (workbook AC logic)

Rejected:

- Method A old shortcut (if REJET then 0 else max(T-Z,0))

Quantified impact:

- Method B total: 157,200,000
- Method A total: 563,400,000
- Gap (A - B): 406,200,000
- Mismatch rows: 189 / 234

## AB vs AC note

- Workbook ETAT SORTIE ATTENDU references AB aggregation.
- AB and AC represent different formula behaviors.
- Bilan reserve engine uses AC logic.
- AB remains diagnostic only.

## Current bilan output

- 2023: entrant 0.0, sortant 1,200,000.0, verif_ok True
- 2024: entrant 1,200,000.0, sortant 6,000,000.0, verif_ok True
- 2025: entrant 6,000,000.0, sortant 560,900,000.0, verif_ok True
- 2026: entrant 560,900,000.0, sortant 560,900,000.0, verif_ok True

## Remaining business point

Only one interpretation point remains for business confirmation:

- keep portfolio scope (current), or
- switch to survenance-year scoped rows.

## How to run from this folder

Run:

- python run_pipeline.py

This will execute the full audit chain and copy all key outputs into:

- final_delivery/outputs/
