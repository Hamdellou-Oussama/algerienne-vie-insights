# PLAN-PB.md — Participation Bénéficiaire (PB) Provision

Target implementer: **Sonnet**.
Context: IBNR, SAP, PE, PPNA are already wired. This plan adds **PB — Participation
Bénéficiaire** (profit-sharing provision) as a first-class module, mirroring the existing
SAP/PE architecture.

1. PB provision module (new)

### 1.1 Data source

`data/ÉCHANTILLON DATA PB (1).xlsx`, sheet `BASE`, header row 5, data starts row 6.
Sample has 5 rows (rows 6–10). Production file may be larger — loader must detect by first
empty `Client` cell.

### 1.2 Workbook column map (verified from inspection)

| Col | Header (raw)                                      | Canonical field                | Role                    |
| --- | ------------------------------------------------- | ------------------------------ | ----------------------- |
| A   | Client                                            | `client_code`                | input                   |
| B   | Canal                                             | `channel`                    | input                   |
| C   | N° Police                                        | `policy_id`                  | input                   |
| D   | Date d'effet                                      | `effect_date`                | input                   |
| E   | Date d'échéance                                 | `expiry_date`                | input                   |
| F   | Date Souscription                                 | `subscription_date`          | input                   |
| G   | Primes de l'exercice N                            | `premiums_n`                 | input                   |
| H   | REC au 01/01/N                                    | `rec_opening`                | input                   |
| I   | Provisions pour SAP AU 01/01/N                    | `sap_opening`                | input                   |
| J   | TOTAL CREDIT                                      | `total_credit`               | derived                 |
| K   | Les sinistres payés de l'exercice N              | `claims_paid_n`              | input                   |
| L   | Provisions pour risques en cours au 31/12/N       | `prec_closing`               | input                   |
| M   | Provisions pour SAP au 31/12/N                    | `sap_closing`                | input                   |
| N   | % frais de gestion                                | `management_fee_rate`        | input                   |
| O   | Les frais de gestion X% des primes nettes         | `management_fee_amount`      | derived                 |
| P   | Report du solde Débiteur éventuel               | `prior_debit_carryover`      | input                   |
| Q   | TOTAL DEBIT                                       | `total_debit`                | derived                 |
| R   | Solde Créditeur                                  | `credit_balance`             | derived                 |
| S   | S/P au 31-12-2022                                 | `loss_ratio`                 | input                   |
| T   | Condition de PB S/P <=                            | `loss_ratio_threshold`       | input / config default  |
| U   | bénéficier au PN                                | `pb_eligible` (OUI/NON)      | derived                 |
| V   | taux pb                                           | `pb_rate`                    | input / config default  |
| W   | Participation aux bénéfices du solde créditeur | `participation_beneficiaire` | derived (the PB itself) |

### 1.3 Formulas (verified by reading the live workbook)

Per row:

```
total_credit           = premiums_n + rec_opening + sap_opening
management_fee_amount  = management_fee_rate * premiums_n
total_debit            = claims_paid_n + prec_closing + sap_closing
                         + management_fee_amount + prior_debit_carryover
credit_balance         = total_credit - total_debit
pb_eligible            = (loss_ratio <= loss_ratio_threshold)      # "OUI" / "NON"
pb                     = pb_rate * credit_balance
                         if (pb_eligible and credit_balance > 0)
                         else 0.0
```

Aggregate:

```
total_pb = sum(pb for all rows)
```

### 1.4 Files to create

```
src/preprocessing/pb_loader.py           # analogue of pe_loader.py / sap_loader.py
src/provisions/pb.py                     # calculate_pb_for_row + calculate_pb
tests/unit/test_pb.py                    # row-level formula tests (pure, no I/O)
tests/integration/test_pb_workbook.py    # replay full workbook, reconcile W column
src/config/legislative.yaml              # add a `pb:` block (see §1.7)
src/preprocessing/schema_registry.py     # add `_pb_contract`
src/domain/enums.py                      # no change expected — reuse existing enums
```

### 1.5 `src/provisions/pb.py` — required shape

Mirror the structure of `src/provisions/pe.py`:

```python
@dataclass(frozen=True)
class PBRowAudit:
    source_row_number: int
    client_code: str | None
    channel: str | None
    policy_id: str | None
    premiums_n: float
    total_credit: float
    total_debit: float
    management_fee_rate: float
    management_fee_amount: float
    credit_balance: float
    loss_ratio: float
    loss_ratio_threshold: float
    pb_eligible: bool
    pb_rate: float
    participation_beneficiaire: float
    zero_reason: str | None   # "ineligible_loss_ratio" | "non_positive_balance" | None

@dataclass(frozen=True)
class PBResult:
    total_amount: float
    by_channel: dict[str | None, float]
    row_results: list[PBRowAudit]
    parameters: dict[str, float]
```

Functions:

- `calculate_pb_for_row(row, default_loss_ratio_threshold, default_pb_rate) -> PBRowAudit`
- `calculate_pb(rows, default_loss_ratio_threshold=None, default_pb_rate=None) -> PBResult`

Behaviour:

- If the row carries `loss_ratio_threshold` / `pb_rate`, **use the row value** (per-contract
  override — the workbook has per-contract values in T and V).
- Otherwise fall back to config defaults from `legislative.yaml`.
- Record `zero_reason` so the audit row explains *why* PB is zero.

All logging, type hints, and exception patterns must follow the conventions in
`src/provisions/pe.py` and `CLAUDE.md` §Code Quality Standards.

### 1.6 `src/preprocessing/pb_loader.py` — required shape

Mirror `src/preprocessing/pe_loader.py`. Metrics to emit in `_build_metrics`:

- `row_count`
- `ineligible_loss_ratio_rows` — rows where `loss_ratio > loss_ratio_threshold`
- `non_positive_credit_balance_rows`
- `positive_pb_rows`
- `event_count`, `lineage_count`

Duplicate key: `(client_code, policy_id, fiscal_year)` — use fiscal year inferred from
the closing-date header (`31/12/N`) or `effect_date.year` if absent.

### 1.7 `src/config/legislative.yaml` — add:

```yaml
pb:
  default_loss_ratio_threshold: 0.85   # FACT per EIC PDF example; mentor-confirm
  default_pb_rate: 0.0                 # no default rate — must be set per contract
  allow_row_level_override: true       # sample workbook carries T and V per row
```

**Mentor question to flag in session log:**

> **Context:** implementing PB from `ÉCHANTILLON DATA PB (1).xlsx`.
> **Ambiguity:** the workbook stores per-contract `S/P threshold` (T) and `taux PB` (V).
> **Current assumption:** these are negotiated per contract and the loader should read them
> row-wise, falling back to `legislative.yaml` defaults only if missing.
> **Question:** is there a regulatory ceiling on `taux PB`, and is 0.85 a legal or purely
> commercial S/P threshold?

### 1.8 Unit tests (`tests/unit/test_pb.py`)

Mirror `tests/unit/test_pe.py` — pure row-level tests, no I/O. Cover:

1. `test_zero_when_loss_ratio_exceeds_threshold` — `S > T ⇒ pb = 0` and
   `zero_reason = "ineligible_loss_ratio"`.
2. `test_zero_when_credit_balance_non_positive` — eligible but `R ≤ 0 ⇒ pb = 0`,
   `zero_reason = "non_positive_balance"`.
3. `test_pb_equals_rate_times_balance_when_eligible_and_positive` — happy path.
4. `test_row_level_threshold_overrides_default` — row has `loss_ratio_threshold=0.5`,
   default 0.85, row loss_ratio 0.6 → ineligible.
5. `test_row_level_rate_overrides_default` — row `pb_rate=0.3`, default 0, positive balance
   → PB uses 0.3.
6. `test_management_fee_computed_on_primes` — `O = N*G`.
7. `test_credit_balance_equals_credit_minus_debit`.

### 1.9 Integration test (`tests/integration/test_pb_workbook.py`)

Replay the five sample rows from `data/ÉCHANTILLON DATA PB (1).xlsx` through the loader
and `calculate_pb`. For each row, assert the engine's `participation_beneficiaire` equals
the workbook's column W (`data_only=True`) within `abs_tol=1e-6`. Also reconcile aggregate
`total_pb` to `sum(W6:W10)`.

### 1.10 Orchestrator wiring

Do **not** wire PB into the main orchestrator in this PR unless the user asks — the other
provisions run on different sources and the orchestrator contract for multi-dataset runs is
still evolving. Keep PB as a standalone runnable module. Document how to invoke it:

```bash
python -m src.provisions.pb --workbook "data/ÉCHANTILLON DATA PB (1).xlsx"
```

(Add an `if __name__ == "__main__":` entry point matching the other provision modules.)

---

## 2. Deliverables checklist

- [ ] `tests/integration/test_pe_workbook.py` (Workstream A) — passes against real PE file.
- [ ] `src/preprocessing/pb_loader.py` with schema contract + metrics.
- [ ] `src/provisions/pb.py` with `PBRowAudit`, `PBResult`, `calculate_pb`.
- [ ] `src/config/legislative.yaml` extended with `pb:` block.
- [ ] `tests/unit/test_pb.py` — 7 cases above, all green.
- [ ] `tests/integration/test_pb_workbook.py` — 5 rows reconcile to W column.
- [ ] `docs/session_logs/YYYY-MM-DD.md` — note the PE vs PB folder mislabel, the mentor
  question on `pb_rate` / threshold source, and what was implemented.

## 3. Out of scope (explicitly)

- Segmentation by `network/product` — the PB workbook has no product/network split, only
  `Client` and `Canal` per contract. Do not invent one.
- UI wiring, report export sheets — add later, not in this PR.
- Life/non-life distinction — PB here is group life/accident PB only, per the data.
- Modifying `data/` or the `/PB` folder contents.
