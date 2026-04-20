# Team and Mentor Review Report

## Scope / Périmètre

This report summarizes what is currently implemented and validated for the hackathon actuarial provisioning platform.

Implemented and audited modules:

- Unearned Premium Reserve / Provision pour Primes Non Acquises (`PPNA`)
- Equalization Provision / Provision d'Égalisation (`PE`)
- SAP workbook-driven reserve logic / logique de provision pilotée par le classeur `SAP`

Not yet production-validated:

- Incurred But Not Reported / Sinistres Non Déclarés (`IBNR`)

Current objective:

- document the exact formulas used
- explain edge-case handling
- make ambiguities explicit
- show the current data-quality issues and how they are handled
- highlight what is already reconciled to Excel and what is not

## Executive Summary / Résumé Exécutif

- `PE` is strongly validated: Python matches workbook formula-backed values exactly, row by row and in total.
- `SAP` is strongly validated against workbook reality: Python matches the workbook formula logic exactly, row by row and in total.
- `PPNA` is implemented and tested, but the current sample workbook does not provide formula-backed output ground truth, so PPNA cannot yet be reconciled against Excel expected results from this sample.
- Preprocessing is rigorous and traceable: every dataset is normalized, logged, and summarized with anomaly counts.
- The main remaining business-review issue is the SAP workbook rule that blank notification dates currently lead to zero reserve.
- `IBNR` remains blocked until the real triangle dataset is provided.

## Current Validation Status / Statut de Validation

| Module | English Name                        | French Name                          | Status                                    | Evidence                                                          |
| ------ | ----------------------------------- | ------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------- |
| PPNA   | Unearned Premium Reserve            | Provision pour Primes Non Acquises   | Implemented, tested, not Excel-reconciled | Workbook output sheet is a template with no formulas              |
| PE     | Equalization Provision              | Provision d'Égalisation             | Implemented, tested, Excel-reconciled     | Exact row-level and total match to formula-backed workbook values |
| SAP    | Workbook-driven claim reserve logic | Logique SAP pilotée par le classeur | Implemented, tested, Excel-reconciled     | Exact row-level and total match to workbook formulas              |
| IBNR   | Incurred But Not Reported           | Sinistres Non Déclarés             | Blocked                                   | Real triangle dataset not yet available                           |

Current audited totals on the provided samples:

- `PPNA`: `7,921,399.820644373` at closing date / date de clôture `2025-12-31`
- `PE`: `93,561,414.06179482`
- `SAP`: `33,600,000.0` at closing date / date de clôture `2025-06-30`

## Formulae Used / Formules Utilisées

### 1. PPNA / Provision pour Primes Non Acquises

Concept:

- English: Unearned Premium Reserve
- French: Provision pour Primes Non Acquises

Implemented formula:

```text
PPNA_row = Net Premium / Prime nette × Remaining Coverage Days / Jours restants
           ---------------------------------------------------------------
             Contract Days / Jours de contrat
```

Operational form:

```text
contract_days = expiry_date - effect_date
remaining_days = clamp(expiry_date - closing_date, 0, contract_days)
ppna_amount = net_premium × remaining_days / contract_days
```

Current implementation choices:

- basis / base de calcul: actual calendar days / jours calendaires réels
- closing date / date de clôture: user-provided, not hardcoded
- leap year / année bissextile: supported, including February 29 / 29 février

Important note:

- the current sample workbook does not provide formula-backed PPNA output cells, so this formula is implemented and tested, but not yet reconciled to workbook ground truth.

### 2. PE / Provision d'Égalisation

Concept:

- English: Equalization Provision
- French: Provision d'Égalisation

Official formula implemented:

```text
If / Si RT_N <= 0:
    PE = 0
Else / Sinon:
    PE_N = min(72% × RT_N^+ ; 15% × average(A1, A2, A3))
```

With:

- `RT_N^+` = positive technical result / résultat technique positif
- `A1` = claims charge for year N-1 / charge sinistre année N-1
- `A2` = claims charge for year N-2 / charge sinistre année N-2
- `A3` = claims charge for year N-3 / charge sinistre année N-3

Workbook evidence:

- `H4 = SUM(E4:G4)`
- `M4 = SUM(I4:L4)`
- `N4 = H4-M4`
- `T4 = (SUM(P4:R4)/S4)`
- `U4 = IF(N4<0,0,MIN(72%*N4,15%*T4))`

Important implementation note:

- the Python engine recomputes the historical average from `A1`, `A2`, and `A3`
- `NB d'année contrat` is treated as workbook helper metadata, not as a required actuarial input
- PE coefficients are configurable in `src/config/legislative.yaml`

### 3. SAP Workbook Logic / Logique SAP du Classeur

Concept:

- English: claim reserve logic as encoded in the sample workbook
- French: logique de provision sinistre telle qu'encodée dans le classeur échantillon

Important warning:

- the French source material uses `SAP` inconsistently
- for this module, we intentionally follow dataset reality / réalité du dataset rather than forcing a theoretical decomposition

Workbook row formula:

```text
=IF($AB$1<W3,0,IF($AB$1>Y3,0,T3))
```

Interpreted as:

```text
If closing_date < occurrence_date:
    SAP = 0
Else if closing_date > settlement_notification_date:
    SAP = 0
Else:
    SAP = declared_amount
```

Meaning of fields:

- `AB1`: closing date / date de clôture
- `W`: occurrence date / date de survenance
- `Y`: settlement notification date / date de notification règlement / rejet
- `T`: declared amount / montant sinistre déclaré

This is not yet the same thing as a general industrial definition of `SAP = PSAP + IBNR`.
It is the exact operational rule encoded in the provided workbook.

## Edge Cases and How They Are Handled / Cas Limites et Traitement

### PPNA

- Negative premium / prime négative:
  retained and processed, not dropped
- Zero premium / prime nulle:
  retained and processed, usually contributes zero
- Closing date before effect date / date de clôture avant date d'effet:
  entire premium remains unearned
- Closing date on or after expiry / date de clôture à l'échéance ou après:
  PPNA becomes zero
- Zero-duration contract / contrat de durée nulle where `effect_date == expiry_date`:
  retained in audit output, PPNA forced to zero, anomaly logged
- Leap day / 29 février:
  explicitly supported and unit-tested

### PE

- Non-positive technical result / résultat technique non positif:
  PE forced to zero
- Very high technical result / résultat technique très élevé:
  capped by the historical average branch if smaller
- Missing `NB d'année contrat`:
  ignored for actuarial logic, kept as a data-quality note

### SAP

- Closing date before occurrence / date de clôture avant survenance:
  reserve is zero
- Closing date after notification / date de clôture après notification:
  reserve is zero
- Blank notification date / date de notification vide:
  reserve is zero because that is what the workbook formula currently does
- Status `SAP`, `REGLE`, `REJET`:
  preprocessing preserves the status values, but the implemented reserve rule is formula-driven, not status-driven

## Data Problems Found / Problèmes de Données Identifiés

### PPNA Data Quality

Observed on the current sample:

- `21,266` rows
- `18,401` rows with string-based dates instead of pure Excel datetimes
- `1,382` rows with negative premium / prime négative
- `2,267` rows with zero premium / prime nulle
- multiple zero-duration contracts / contrats de durée nulle

Handling:

- dates are normalized to ISO 8601
- negative and zero premiums are retained and flagged
- zero-duration rows are not dropped; they are logged and assigned zero PPNA
- all transformations are traceable through lineage records

### SAP Data Quality

Observed on the current sample:

- `234` rows
- status mix: `SAP = 174`, `REGLE = 34`, `REJET = 26`
- `4` missing insured birth dates / dates de naissance adhérent manquantes
- `4` missing beneficiary birth dates / dates de naissance bénéficiaire manquantes
- `171` rows with blank notification date / date de notification vide

Handling:

- missing birth dates are retained and flagged for quality reporting
- blank notification dates are not imputed
- reserve output follows workbook formula behavior exactly
- this behavior is explicitly listed as `needs_review` in the assumption registry

### PE Data Quality

Observed on the current sample:

- `125` rows
- `124` blank `NB d'année contrat`
- `20` rows with negative technical result / résultat technique négatif
- `29` rows with positive PE

Handling:

- `NB d'année contrat` is retained as metadata but excluded from actuarial logic
- PE is recomputed from the official formula inputs
- workbook template inconsistencies are ignored when formula-backed cells exist elsewhere

## Ambiguities and Active Assumptions / Ambiguïtés et Hypothèses Actives

Active assumptions:

- PPNA uses actual days / jours réels as its day-count basis
- negative and zero premiums are retained
- PE coefficients `72%` and `15%` are configurable
- PE ignores `NB d'année contrat` for the actuarial result
- SAP follows the workbook date-window formula exactly

Assumptions requiring review:

- blank SAP notification date implies zero reserve
- PPNA workbook output tab is non-authoritative because it has no formulas

Blocked assumption:

- IBNR production validation is blocked until real triangle data is provided

## What Is Proven vs Not Yet Proven / Ce Qui Est Prouvé vs Non Encore Prouvé

Proven:

- preprocessing is deterministic and auditable
- PE Python logic matches workbook formula results exactly
- SAP Python logic matches workbook formula results exactly
- PPNA logic is implemented and internally tested, including leap-year behavior

Not yet proven:

- PPNA equality to workbook ground truth on the current sample
- general business validity of the SAP blank-notification rule beyond this workbook
- production IBNR calculations

## Risk Assessment / Évaluation des Risques

Low risk:

- PE formula implementation
- preprocessing normalization mechanics

Medium risk:

- PPNA business convention risk because the output template cannot confirm expected workbook totals
- PPNA basis risk if a different day-count convention is later required

High review priority:

- SAP blank-notification behavior, because it affects `171` rows and a declared amount sum of `540,000,000`

## Recommended Team and Mentor Review Points / Points à Valider avec l'Équipe et les Mentors

1. Confirm whether PPNA should remain on actual calendar days / jours calendaires réels, or whether another convention is expected.
2. Confirm whether the workbook SAP rule for blank notification dates should remain the production rule, or be replaced by an explicit business override.
3. Provide the real IBNR triangle dataset so reserving methods can be validated.
4. Confirm whether any additional product segmentation / segmentation par produit is required before expanding to PSAP and IBNR.

## Current Bottom Line / Conclusion Actuelle

The platform now has a strong, auditable base for:

- preprocessing / prétraitement
- PPNA calculation / calcul de la PPNA
- PE calculation / calcul de la PE
- SAP workbook reconciliation / rapprochement SAP avec Excel

The biggest remaining technical gap is not formula coding. It is:

- missing IBNR data`
- unresolved PPNA workbook ground truth
- business sign-off on the SAP blank-notification rule

That means the next work should focus on:

- PSAP implementation
- synthetic IBNR harness until real data arrives
- UI surfaces for assumptions and auditability
- export-ready reporting for judges and mentors
