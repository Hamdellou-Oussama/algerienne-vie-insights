# Level3 Bilan Rules

## 1) Data sources

- Main workbook: data/level3-Bilan sinistres (2).xlsx
- SAP formula source workbook: data/level 01-DATA SAP groupe (2).xlsx
- Main data sheet: SAP GROUPE (2)

## 2) Exercise year rule

- N is the row exercise year.
- No hardcoded year is used for section logic.

## 3) SAP method rule

Selected SAP method is workbook AC logic (Method B), not old shortcut.

AC logic pattern:

- IF(ref < U, 0, IF(AND(ref > U, ref < Y), T, IF(X = "REJET", 0, T - Z)))

Where:

- ref: valuation date
- U: declaration date
- Y: notification date
- X: status
- T: declared amount
- Z: paid amount

## 4) Entrant and sortant SAP

For year N:

- Entrant SAP uses ref = 31/12/(N-1)
- Sortant SAP uses ref = 31/12/N

Option A carry-forward:

- Entrant(N) = Sortant(N-1)

## 5) Section rules

- En cours au 01/01/N:
  - nbre: unique dossiers with SAP(ref=31/12/N-1) > 0
  - montant: sum SAP(ref=31/12/N-1)
- Repris en N:
  - status REPRIS and notification year = N
  - amount uses declared amount
- Declares en N:
  - declaration year = N
  - amount uses declared amount
- Reglements en N:
  - status REGLE and notification year = N
  - amount uses paid amount (Montant regle)
- C/SS (rejets) en N:
  - status REJET and notification year = N only
  - non-cumulative
  - amount uses declared amount
- Reevaluation:
  - fixed to zero for this dataset
- Reserves au 31/12/N:
  - nbre: unique dossiers with SAP(ref=31/12/N) > 0
  - montant: sum SAP(ref=31/12/N)

## 6) Scope mode

Current mode is portfolio scope:

- each year N aggregates all dossiers in the portfolio.

## 7) Balance check

Each year checks:

- entrant + repris + declares - reglements - rejets + reevaluation = sortant

Tolerance:

- absolute difference <= 1e-6
