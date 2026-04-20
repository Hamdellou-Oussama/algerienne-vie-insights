# Backend Implementation Report

## Purpose

This document is the implementation reference for the backend teammate responsible for the actuarial provisioning platform.

It describes, in one place:
- the raw datasets currently in scope
- the canonical preprocessing rules
- the exact formulas to implement
- the Excel cells and workbook logic to trust
- the edge cases to preserve
- the current assumptions and blockers

This report is intended to be followed directly during backend implementation.

## Scope

Covered modules:
- `PPNA` = Unearned Premium Reserve / Provision pour Primes Non Acquises
- `PE` = Equalization Provision / Provision d'Égalisation
- `SAP` = workbook-driven claim reserve logic / logique de provision sinistre pilotée par le classeur

Not yet covered for production validation:
- `IBNR` = Incurred But Not Reported / Sinistres Non Déclarés
- `PSAP` = Provision pour Sinistres À Payer

## Source of Truth

Primary sources:
- `data/level 01-level2-ÉCHANTILLON DATA PPNA.xlsx`
- `data/level 01-ÉCHANTILLON DATA PE.xlsx`
- `data/level 01-DATA SAP groupe.xlsx`
- `SAP_FORMULA.md` for the corrected mentor SAP rule

Supporting code references:
- [src/preprocessing/schema_registry.py](/home/maab/Documents/openData/src/preprocessing/schema_registry.py)
- [src/preprocessing/base.py](/home/maab/Documents/openData/src/preprocessing/base.py)
- [src/provisions/ppna.py](/home/maab/Documents/openData/src/provisions/ppna.py)
- [src/provisions/pe.py](/home/maab/Documents/openData/src/provisions/pe.py)
- [src/provisions/sap.py](/home/maab/Documents/openData/src/provisions/sap.py)

Important rule:
- raw files under `data/` are read-only
- backend logic must follow workbook-backed formulas where they exist

## High-Level Backend Architecture

The backend flow is:

1. Read raw Excel workbook.
2. Normalize each row into a canonical schema.
3. Preserve raw value lineage for every normalized field.
4. Run module calculation on canonical rows.
5. Produce:
   - row-level audit output
   - aggregated totals
   - per-network and per-product breakdowns
6. Reconcile module outputs to Excel formulas where possible.
7. Emit reports:
   - cleaning report
   - assumption registry
   - reconciliation report
   - consolidated audit summary

Module separation:
- preprocessing modules load and normalize data
- provision modules calculate
- reporting modules reconcile and summarize
- orchestration modules run the end-to-end package

## Preprocessing Design

### Generic preprocessing rules

Implemented in [src/preprocessing/base.py](/home/maab/Documents/openData/src/preprocessing/base.py).

Per field, preprocessing does all of the following:
- read the raw formula workbook and the value workbook
- normalize values according to declared type
- keep both raw and normalized values
- record a lineage record for every field
- emit structured cleaning events
- detect duplicate business keys

Normalization by type:
- `DATE` -> ISO 8601 date string
- `DECIMAL` -> float
- `INTEGER` -> int
- `CATEGORY` -> normalized category string
- `STRING` -> stripped string

Severity logic:
- required missing/unparseable fields -> `ERROR`
- normalized string/date/number coercion -> `INFO` or `WARNING`
- category outside vocabulary -> `WARNING`

### Canonical dataset contracts

Defined in [src/preprocessing/schema_registry.py](/home/maab/Documents/openData/src/preprocessing/schema_registry.py).

#### PPNA contract

Workbook:
- `level 01-level2-ÉCHANTILLON DATA PPNA.xlsx`

Sheet:
- ` PRODUCTION`

Relevant raw fields:
- `Réseau`
- `produit`
- `Type`
- `N° POLICE/AVENANT`
- `N° POLICE`
- `ASSURES`
- `souscription`
- `Effet`
- `Échéance`
- `Prime nette`

Canonical names:
- `network`
- `product`
- `transaction_type`
- `policy_endorsement_id`
- `policy_id`
- `insured_id`
- `subscription_date`
- `effect_date`
- `expiry_date`
- `net_premium`

#### SAP contract

Workbook:
- `level 01-DATA SAP groupe.xlsx`

Sheet:
- `SAP GROUPE (2)`

Relevant raw fields:
- `Réseau`
- `Agence`
- `PRODUITS`
- `N° Police `
- `N°adhésion`
- `N° Sinistre`
- `Montant sinistre déclaré`
- `Date de déclaration`
- `Date de survenance du sinistre `
- `Statut`
- `Date de notification reglement /REJET`
- `Montant réglé`
- `Ecart  reglement`
- `sap au 30/06/2025`

Canonical names:
- `network`
- `agency`
- `product`
- `policy_id`
- `adhesion_id`
- `claim_id`
- `declared_amount`
- `declaration_date`
- `occurrence_date`
- `status`
- `settlement_notification_date`
- `paid_amount`
- `settlement_gap`
- `sap_closing_amount`

#### PE contract

Workbook:
- `level 01-ÉCHANTILLON DATA PE.xlsx`

Sheet:
- `PE`

Relevant raw fields:
- `Réseau`
- `Produit`
- `Années d'exercice`
- `Garantie`
- `Les primes émises_garantie Décès 2022`
- `(REC/Provisions Mathématiques)_Décès au 01/01/2022`
- `Provisions pour SAP AU 01/01/2022`
- `TOTAL  CREDIT`
- `Les sinistres payés_Décès de l'éxercice 2022`
- `(REC/Provisions Mathématiques)_Décès au 31/12/2022`
- `Provisions pour SAP au 31/12/2022`
- `Report du solde Débiteur eventuel des exercices anterieurs `
- `TOTAL DEBIT`
- `Résultat technique`
- `Charge sinistre (N)`
- `Charge sinistre (N-1)`
- `Charge sinistre (N-2)`
- `Charge sinistre (N-3)`
- `NB d'année contrat`
- `MOYENNE`
- `Provision d'égalisation`

Canonical names:
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
- `contract_year_count`
- `historical_average_claims_charge`
- `equalization_provision`

## Data Quality Findings

### PPNA

Current observed profile:
- `21,266` rows
- `18,401` rows with string dates
- `1,382` rows with negative `Prime nette`
- `2,267` rows with zero `Prime nette`

Handling:
- string dates are normalized to ISO dates
- negative and zero premiums are retained
- rows are not dropped only because they are loss-making or unusual

### SAP

Current observed profile:
- `234` rows
- status distribution:
  - `SAP = 174`
  - `REGLE = 34`
  - `REJET = 26`
- `4` missing `Date de Naissance adhérent`
- `4` missing `Date de Naissance bénéficiaire`
- many rows with blank `Montant réglé`
- many rows with blank `Date de notification reglement /REJET`

Handling:
- missing birth dates are retained and flagged
- blank `Montant réglé` is treated as `0.0` in SAP calculation when needed for workbook compatibility
- blank `Date de notification reglement /REJET` is not imputed

### PE

Current observed profile:
- `125` rows
- `124` blank `NB d'année contrat`
- `20` rows with negative `Résultat technique`
- `29` rows with positive `Provision d'égalisation`

Handling:
- `NB d'année contrat` is retained as metadata
- PE calculation does not depend on `NB d'année contrat`

## Module Specification

## 1. PPNA

### Concept

English:
- Unearned Premium Reserve

French:
- Provision pour Primes Non Acquises

### Authoritative workbook cells

Workbook:
- `level 01-level2-ÉCHANTILLON DATA PPNA.xlsx`

Authoritative cells:
- ` PRODUCTION!P1` = closing date / date de clôture
- ` PRODUCTION!K:K` = `nb de jours non aquise`
- ` PRODUCTION!L:L` = `nb de jours contrat`
- ` PRODUCTION!M:M` = `%`
- ` PRODUCTION!N:N` = `Prime non acquise`
- ` PRODUCTION!Q3` = workbook PPNA total

Non-authoritative display sheet:
- `ETAT DE SORTIE`

Important:
- `ETAT DE SORTIE` is only a summary template
- PPNA reconciliation must use the ` PRODUCTION` sheet formulas, not `ETAT DE SORTIE`

### Exact workbook formulas

Examples from the workbook:

```text
K2 = IF(OR($P$1<H2,$P$1>I2),0,I2-$P$1)
L2 = DATEDIF(H2,I2,"d")+1
M2 = K2/L2
N2 = J2*M2
Q3 = SUM(N2:N21267)
```

Field meanings:
- `H` = `Effet`
- `I` = `Échéance`
- `J` = `Prime nette`
- `P1` = closing date / date de clôture

### Backend formula to implement

For each row:

```text
contract_days = (Échéance - Effet).days + 1

if closing_date < Effet:
    remaining_days = 0
elif closing_date > Échéance:
    remaining_days = 0
else:
    remaining_days = (Échéance - closing_date).days

unearned_ratio = remaining_days / contract_days
PPNA_row = Prime nette × unearned_ratio
```

### Important implementation note

This is not the same as the earlier generic interpretation that gave full unearned premium before `Effet`.

For this workbook-backed implementation:
- before `Effet`, PPNA is `0`
- after `Échéance`, PPNA is `0`
- only dates inside the coverage window produce non-zero PPNA

This is the convention to preserve because it is the one validated against the current workbook.

### Edge cases

- `Échéance < Effet`:
  reject row as invalid
- `Échéance == Effet`:
  `contract_days = 1`
  `remaining_days = 0` on that date
  PPNA becomes `0`
- negative `Prime nette`:
  keep and calculate normally
- zero `Prime nette`:
  keep and calculate normally
- leap year:
  supported automatically through date arithmetic

### Expected sample result

At workbook closing date `2025-05-31` from ` PRODUCTION!P1`:
- total PPNA = `3,901,156.363858455`

## 2. PE

### Concept

English:
- Equalization Provision

French:
- Provision d'Égalisation

### Authoritative workbook cells

Workbook:
- `level 01-ÉCHANTILLON DATA PE.xlsx`

Authoritative cells:
- `PE!U4:U128` = row-level `Provision d'égalisation`
- formulas inside `PE`, not `OBJECTIF PE`

Examples:

```text
H4 = SUM(E4:G4)
M4 = SUM(I4:L4)
N4 = H4-M4
T4 = (SUM(P4:R4)/S4)
U4 = IF(N4<0,0,MIN(72%*N4,15%*T4))
```

### Exact formula to implement

For each row:

```text
technical_result = Résultat technique
historical_average = (Charge sinistre (N-1) + Charge sinistre (N-2) + Charge sinistre (N-3)) / 3
positive_result_component = max(0, technical_result) × 0.72
historical_average_component = historical_average × 0.15

if technical_result <= 0:
    PE = 0
else:
    PE = min(positive_result_component, historical_average_component)
```

### Parameterization

Do not hardcode:
- `0.72`
- `0.15`

Use:
- `src/config/legislative.yaml`

Current values:
- `pe.positive_result_coefficient = 0.72`
- `pe.historical_average_coefficient = 0.15`

### Edge cases

- `Résultat technique <= 0`:
  PE is `0`
- blank `NB d'année contrat`:
  ignore for actuarial calculation
- inconsistent `OBJECTIF PE` labels:
  ignore, do not use as source of truth

### Expected sample result

- total PE = `93,561,414.06179482`

## 3. SAP

### Concept

English:
- workbook-driven claim reserve logic

French:
- logique de provision sinistre pilotée par la formule du classeur

Important:
- do not use the old `AB` formula path as the current source of truth
- use the mentor rule from `SAP_FORMULA.md`
- use the updated workbook formula path in column `AC`

### Mentor formula

From `SAP_FORMULA.md`:

```text
Soit D date cloture SAP.

Si D < date Declaration => 0
Si date Declaration < D < date Reglement => Montant Sinistre
Si D > date Reglement:
    Rejet => 0
    Reglé => max(0, Montant - Réglé)
    SAP => Montant
```

### Authoritative workbook cells

Workbook:
- `level 01-DATA SAP groupe.xlsx`

Authoritative cells:
- `SAP GROUPE (2)!AC2` = corrected closing date / date de clôture
- `SAP GROUPE (2)!AC3:AC236` = corrected row-level formula
- `SAP GROUPE (2)!AG2` = corrected total

Legacy cells not to use as final truth:
- `AB1`
- `AB3:AB236`
- `ETAT SORTIE ATTENDU!E5`

These correspond to the older formula path.

### Exact corrected workbook formula

Example:

```text
AC3 = IF($AC$2<U3,0,IF(AND($AC$2>U3,$AC$2<Y3),T3,IF(X3="REJET",0,T3-Z3)))
```

Field meanings:
- `U` = `Date de déclaration`
- `Y` = `Date de notification reglement /REJET`
- `X` = `Statut`
- `T` = `Montant sinistre déclaré`
- `Z` = `Montant réglé`
- `AC2` = corrected closing date / date de clôture

### Backend rule to implement

For each row:

```text
if Date de clôture < Date de déclaration:
    SAP = 0

elif Date de notification reglement /REJET is not null
and Date de déclaration < Date de clôture < Date de notification reglement /REJET:
    SAP = Montant sinistre déclaré

else:
    if Statut == REJET:
        SAP = 0
    elif Statut == SAP:
        SAP = Montant sinistre déclaré
    else:
        SAP = max(0, Montant sinistre déclaré - Montant réglé)
```

### Critical implementation details

- use `Date de déclaration`, not `Date de survenance du sinistre `, for the corrected decision boundary
- use `Statut` after the notification-stage decision
- blank `Montant réglé` must behave as `0.0`
- blank `Date de notification reglement /REJET` does not force zero anymore under the corrected rule
- rows with `Statut = SAP` and blank `Montant réglé` are valid and should keep `Montant sinistre déclaré`

### Edge cases

- closing date before declaration:
  zero
- closing date between declaration and notification:
  full declared amount
- after notification and `Statut = REJET`:
  zero
- after notification and `Statut = SAP`:
  full declared amount
- after notification and `Statut = REGLE`:
  outstanding amount = `max(0, declared - paid)`
- blank `Montant réglé`:
  treat as `0.0`

### Expected sample result

At corrected workbook closing date `2025-03-31` from `SAP GROUPE (2)!AC2`:
- total SAP = `157,200,000.0`

## Reconciliation Rules

### PPNA reconciliation

Use:
- row-level comparison between Python `PPNA_row` and ` PRODUCTION!N`
- total comparison against ` PRODUCTION!Q3`

Do not use:
- `ETAT DE SORTIE` as authoritative result source

### PE reconciliation

Use:
- row-level comparison between Python `equalization_provision` and `PE!U`
- total comparison against the sum of workbook `U` values

### SAP reconciliation

Use:
- row-level comparison between Python SAP and `SAP GROUPE (2)!AC`
- total comparison against `SAP GROUPE (2)!AG2`

Do not use:
- legacy `AB` path as final reconciliation

## Audit Output Requirements

Each provision module must return:
- row-level audit rows
- aggregated total
- breakdown by `(network, product)`
- parameter dictionary describing the formula used

### PPNA audit row fields

- `source_row_number`
- `network`
- `product`
- `policy_id`
- `insured_id`
- `effect_date`
- `expiry_date`
- `net_premium`
- `contract_days`
- `remaining_days`
- `unearned_ratio`
- `ppna_amount`
- `inclusion_reason`

### PE audit row fields

- `source_row_number`
- `network`
- `product`
- `fiscal_year`
- `technical_result`
- `claims_charge_n1`
- `claims_charge_n2`
- `claims_charge_n3`
- `historical_average`
- `positive_result_component`
- `historical_average_component`
- `equalization_provision`

### SAP audit row fields

- `source_row_number`
- `network`
- `product`
- `claim_id`
- `status`
- `declaration_date`
- `settlement_notification_date`
- `declared_amount`
- `paid_amount`
- `sap_amount`
- `inclusion_reason`

## Assumptions To Freeze

These should be documented and not changed casually:

1. PPNA uses the workbook convention from ` PRODUCTION!K:N`, not a generic actuarial alternative.
2. Negative and zero `Prime nette` rows are retained.
3. PE coefficients are configurable and currently set to `0.72` and `0.15`.
4. `NB d'année contrat` is not required for PE actuarial logic.
5. SAP follows the mentor formula and the workbook `AC` path, not the legacy `AB` path.
6. Blank `Montant réglé` is interpreted as `0.0` for SAP compatibility.

## Current Blockers

Still blocked:
- real `IBNR` triangle dataset
- production-grade validation of `IBNR`
- production-grade `PSAP` module

Not blocked anymore:
- PPNA Excel validation on the current sample
- PE Excel validation on the current sample
- SAP Excel validation on the corrected workbook path

## Implementation Checklist

The backend teammate should follow this checklist:

1. Keep the schema contracts exactly aligned with workbook column names.
2. Preserve raw values and normalized values for every field.
3. Do not drop rows silently.
4. Implement PPNA from ` PRODUCTION!K:N` logic.
5. Implement PE from the official formula and configurable coefficients.
6. Implement SAP from `SAP_FORMULA.md` and workbook column `AC`.
7. Reconcile:
   - PPNA -> ` PRODUCTION!N` and `Q3`
   - PE -> `U`
   - SAP -> `AC` and `AG2`
8. Emit audit artifacts and assumptions.
9. Do not start treating `IBNR` as validated until real data arrives.

## Final Backend Verdict

For the current sample workbooks and current mentor clarifications:
- `PPNA` logic is defined and Excel-validatable
- `PE` logic is defined and Excel-validatable
- `SAP` logic is defined and Excel-validatable on the corrected workbook path

That is sufficient to proceed with backend implementation for these three modules.
