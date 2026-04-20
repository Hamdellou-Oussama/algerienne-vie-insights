# Backend Formula Registry (Source-of-Truth)

Date: 2026-04-19
Scope: PPNA, SAP, PE, PB, IBNR (Chain Ladder + Mack + BF + Benktander + Bootstrap), Level3 bilan method B.

This file documents formulas implemented in backend code only.
No frontend formula is used as a source.

## 1) PPNA (Prorata Temporis)
Source:
- backend/src/provisions/ppna.py
- function: calculate_ppna_for_row

Workbook-aligned formulas in code:
- Contract days:
  - contract_days = (expiry_date - effect_date).days + 1
  - workbook reference: DATEDIF(Effet, Echeance, "d") + 1
- Remaining days:
  - if closing_date < effect_date: remaining_days = 0
  - elif closing_date > expiry_date: remaining_days = 0
  - else: remaining_days = (expiry_date - closing_date).days
- Unearned ratio:
  - unearned_ratio = remaining_days / contract_days
- PPNA per row:
  - ppna_amount = net_premium * unearned_ratio
- Total PPNA:
  - total_amount = sum(ppna_amount over rows)

## 2) SAP (Sinistres A Payer)
Source:
- backend/src/provisions/sap.py
- function: calculate_sap_for_row

Piecewise rule implemented in code:
- If closing_date < declaration_date:
  - SAP = 0
- Else if settlement_notification_date is not null and declaration_date < closing_date < settlement_notification_date:
  - SAP = declared_amount
- Else:
  - if status == REJET: SAP = 0
  - elif status == SAP: SAP = declared_amount
  - else: SAP = max(0, declared_amount - paid_amount)

Total SAP:
- total_amount = sum(sap_amount over rows)

## 3) PE (Provision d Egalisation)
Source:
- backend/src/provisions/pe.py
- functions: calculate_pe_for_row, calculate_pe
- coefficients loaded from backend/src/config/legislative.yaml

Per row formulas:
- historical_average = (claims_charge_n1 + claims_charge_n2 + claims_charge_n3) / 3
- positive_result_component = max(0, technical_result) * positive_result_coefficient
- historical_average_component = historical_average * historical_average_coefficient
- if technical_result > 0:
  - equalization_provision = min(positive_result_component, historical_average_component)
- else:
  - equalization_provision = 0

Total PE:
- total_amount = sum(equalization_provision over rows)

## 4) PB (Participation Beneficiaire)
Source:
- backend/src/provisions/pb.py
- functions: calculate_pb_for_row, calculate_pb
- defaults loaded from backend/src/config/legislative.yaml
- run control and validation in backend/src/backend/services.py

Per row formulas:
- total_credit = premiums_n + rec_opening + sap_opening
- management_fee_amount = management_fee_rate * premiums_n
- total_debit = claims_paid_n + prec_closing + sap_closing + management_fee_amount + prior_debit_carryover
- credit_balance = total_credit - total_debit
- pb_eligible = (loss_ratio <= loss_ratio_threshold)

PB amount:
- if not pb_eligible: PB = 0
- elif credit_balance <= 0: PB = 0
- else: PB = pb_rate * credit_balance

Run-level override control:
- allow_row_level_override parameter controls whether per-row pb_rate and loss_ratio_threshold can override defaults
- when allow_row_level_override = false:
  - effective_loss_ratio_threshold = default_loss_ratio_threshold
  - effective_pb_rate = default_pb_rate

Control rule enforced in service layer:
- if allow_row_level_override = false and default_pb_rate = 0, then total PB must be 0

Row-level trace fields exposed by backend:
- effective_loss_ratio_threshold
- effective_pb_rate
- eligibility_reason
- zero_reason

Total PB:
- total_amount = sum(participation_beneficiaire over rows)

## 5) IBNR Chain Ladder (Volume Weighted)
Source:
- backend/src/provisions/ibnr.py
- functions: build_triangle, compute_development_factors, project_triangle, _compute_occurrence_year_results, _run_chain_ladder

Triangle construction:
- incremental C_inc(ay, dev) aggregated from claims by occurrence_year and declaration_year
- cumulative C(ay, dev) built along development years

Development factors (volume weighted):
- For development year j >= 1:
- F_j = sum_i C(i, j) / sum_i C(i, j-1)
- using valid AYs where cells exist at j and j-1

Projection:
- For unknown cells:
- C_proj(ay, j) = F_j * C_proj(ay, j-1)

Per AY reserve:
- diagonal = C(ay, last_known_dev)
- ultimate = C(ay, max_development_year)
- reserve_ay = ultimate - diagonal

Total IBNR Chain Ladder:
- total_ibnr = sum(reserve_ay)

## 6) IBNR Mack Chain Ladder (Uncertainty)
Source:
- backend/src/provisions/ibnr_mack.py
- functions: _estimate_sigma2, _mack_mse, calculate_mack

Process variance estimate per development year j:
- sigma2_j = (1 / (n_j - 1)) * sum_i [ C(i, j-1) * (C(i, j)/C(i, j-1) - F_j)^2 ]

AY MSE approximation:
- MSE_ay accumulated over future development years using sigma2_j and tail products of F

Derived metrics:
- SE_ay = sqrt(MSE_ay)
- CV_ay = SE_ay / IBNR_chain_ladder_ay
- total_se_naive = sqrt(sum_ay(SE_ay^2))

Point estimate:
- total_ibnr (Mack) = total_ibnr (Chain Ladder)

## 7) IBNR Bornhuetter-Ferguson (BF)
Source:
- backend/src/provisions/ibnr_bf.py
- functions: _compute_cdf_factors, _derive_prior_ultimates, calculate_bf

Reported percentage:
- q_ay = 1 / CDF_ay
- CDF_ay = product of future development factors from observed dev to ultimate dev

Prior ultimate in current config (mature_ay_ratio):
- ratio = ULT(mature_ay) / dev0(mature_ay)
- prior_ultimate_ay = dev0(ay) * ratio

BF reserve and ultimate:
- ibnr_bf_ay = (1 - q_ay) * prior_ultimate_ay
- ultimate_bf_ay = diagonal_ay + ibnr_bf_ay

Total BF:
- total_ibnr_bf = sum(ibnr_bf_ay)

## 8) IBNR Benktander (iterative)
Source:
- backend/src/provisions/ibnr_benktander.py
- function: calculate_benktander

Iteration rule:
- U_1 = G + (1 - q) * prior_ultimate
- U_n = G + (1 - q) * U_(n-1)
- config k controls number of iterations (current k=2)

Reserve:
- ibnr_benktander_ay = U_k - G

Total Benktander:
- total_ibnr_benktander = sum(ibnr_benktander_ay)

## 9) IBNR Bootstrap ODP
Source:
- backend/src/provisions/ibnr_bootstrap.py
- function: calculate_bootstrap

Main steps in code:
- Build observed incremental and fitted incremental triangle
- Pearson residuals on observed cells:
  - r = (obs - fitted) / sqrt(fitted)
- Resample residuals with replacement
- Build pseudo incremental data and pseudo cumulative triangle
- Re-estimate development factors on each pseudo dataset
- Re-project to ultimate, compute total IBNR per simulation

Outputs:
- mean_total_ibnr, std_total_ibnr
- percentiles (50, 75, 90, 95, 99 by config)
- chain_ladder_total reference

## 10) Level3 Bilan (Method B workbook AC)
Source:
- backend/src/backend/services.py
- function: compute_level3_bilan

Annual decomposition (year N):
- En cours entrant: SAP at 31/12/(N-1) > 0
- Declares en N: declaration_year == N
- Reglements en N: status REGLE and notification_year == N
- Rejets en N: status REJET and notification_year == N
- Repris en N: status REPRIS and notification_year == N
- Reevaluation: fixed 0 in this dataset
- Reserves sortant: SAP at 31/12/N > 0

Balance check implemented:
- expected_sortant = entrant + repris + declares - reglements - rejets + reevaluation_pos - reevaluation_neg
- verif_diff = abs(expected_sortant - reserves_montant)
- verif_ok = verif_diff <= 1.0

Old-vs-new reserve comparison outputs:
- yearly fields:
  - reserves_montant_old_signed
  - reserves_montant_delta_new_minus_old_signed
- aggregate block:
  - reserve_totals_comparison.total_reserves_new
  - reserve_totals_comparison.total_reserves_old_signed
  - reserve_totals_comparison.delta_new_minus_old_signed
- per-year delta block:
  - reserves_delta_by_year[].delta_new_minus_old_signed

## 11) Config Parameters Used
Source:
- backend/src/config/legislative.yaml

Current values used by backend:
- PE:
  - positive_result_coefficient = 0.72
  - historical_average_coefficient = 0.15
- PB:
  - default_loss_ratio_threshold = 0.85
  - default_pb_rate = 0.0
  - allow_row_level_override = true
- IBNR:
  - closing_year = 2025
  - occurrence_year_window_size = 4
  - BF prior_basis = mature_ay_ratio, mature_ay = 2022
  - Benktander k = 2
  - Bootstrap n_sim = 1000, random_seed = 42

## 12) Run Artifacts (Relevant to Formula Audit)
Source:
- backend/src/backend/services.py (create_run)

Artifacts persisted for all domains:
- result.json
- rows.json
- cleaning_report.json
- cleaning_report.md

PB-specific formula drift artifact:
- pb_audit.json (stored vs recomputed PB per row, delta, effective parameters)
