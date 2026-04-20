# Assumption Registry

## ppna_day_count_basis
- current_value: `DATEDIF("Effet","Échéance","d")+1 denominator with in-window remaining days only`
- source_type: `WORKBOOK_FORMULA`
- source_reference: `level 01-level2-ÉCHANTILLON DATA PPNA.xlsx " PRODUCTION"!K:N`
- status: `active`
- justification: PPNA now follows the workbook formulas for "nb de jours contrat" and "nb de jours non aquise".
- affected_modules: `['ppna', 'reconciliation', 'audit_run']`

## ppna_negative_and_zero_premiums_retained
- current_value: `True`
- source_type: `MENTOR`
- source_reference: `Phase 10 clarification for PPNA premium treatment`
- status: `active`
- justification: Negative and zero premiums are retained for actuarial treatment and auditability.
- affected_modules: `['preprocessing', 'ppna']`

## pe_positive_result_coefficient
- current_value: `0.72`
- source_type: `FACT`
- source_reference: `src/config/legislative.yaml -> pe.positive_result_coefficient`
- status: `active`
- justification: Legislative coefficient must be configurable and not hardcoded.
- affected_modules: `['pe', 'assumptions', 'audit_run']`

## pe_historical_average_coefficient
- current_value: `0.15`
- source_type: `FACT`
- source_reference: `src/config/legislative.yaml -> pe.historical_average_coefficient`
- status: `active`
- justification: Legislative coefficient must be configurable and not hardcoded.
- affected_modules: `['pe', 'assumptions', 'audit_run']`

## pe_ignores_contract_year_count_for_actuarial_logic
- current_value: `True`
- source_type: `MENTOR`
- source_reference: `Phase 10 clarification on NB d'année contrat`
- status: `active`
- justification: Contract-year count is treated as workbook helper metadata, not required actuarial input.
- affected_modules: `['pe', 'reconciliation']`

## sap_formula_uses_declaration_notification_status_and_paid_amount
- current_value: `if Date de clôture < "Date de déclaration" then 0; if "Date de déclaration" < Date de clôture < "Date de notification reglement /REJET" then "Montant sinistre déclaré"; else REJET=>0, SAP=>"Montant sinistre déclaré", REGLE=>max(0,"Montant sinistre déclaré"-"Montant réglé")`
- source_type: `WORKBOOK_FORMULA`
- source_reference: `SAP_FORMULA.md and level 01-DATA SAP groupe.xlsx "SAP GROUPE (2)"!AC3:AC236`
- status: `active`
- justification: SAP engine now follows the mentor-provided formula and the updated workbook formula path.
- affected_modules: `['sap', 'reconciliation', 'audit_run']`

## sap_blank_notification_falls_back_to_status_branch
- current_value: `True`
- source_type: `WORKBOOK_FORMULA`
- source_reference: `level 01-DATA SAP groupe.xlsx "SAP GROUPE (2)"!AC3:AC236 with blank Y rows`
- status: `active`
- justification: Rows with blank "Date de notification reglement /REJET" still evaluate through the status-based branch after "Date de déclaration".
- affected_modules: `['sap', 'reconciliation']`

## ppna_output_sheet_non_authoritative_template
- current_value: `True`
- source_type: `DATASET_RULE`
- source_reference: `level 01-level2-ÉCHANTILLON DATA PPNA.xlsx!ETAT DE SORTIE has no formulas`
- status: `active`
- justification: The "ETAT DE SORTIE" sheet is a display template only; PPNA reconciliation uses the formula-backed " PRODUCTION" sheet.
- affected_modules: `['ppna', 'reconciliation']`

## ibnr_method_chain_ladder_volume_weighted
- current_value: `chain_ladder_volume_weighted`
- source_type: `WORKBOOK_FORMULA`
- source_reference: `level 02-ÉCHANTILLON DATA IBNR.xlsx "calcule IBNR"!C29:E29 and rows 33..36`
- status: `active`
- justification: Volume-weighted Chain Ladder is the method implemented in the workbook. Factors and reserves verified cell-by-cell against cached values.
- affected_modules: `['ibnr', 'reconciliation', 'audit_run']`

## ibnr_occurrence_year_window
- current_value: `(closing_year - 3, closing_year)`
- source_type: `DATASET_RULE`
- source_reference: `level 02-ÉCHANTILLON DATA IBNR.xlsx "calcule IBNR" rows 15..20 (4-year triangle window)`
- status: `active`
- justification: Workbook restricts triangle to the 4 most recent occurrence years. Earlier years are treated as fully developed with reserve 0.
- affected_modules: `['ibnr']`

## ibnr_closing_year
- current_value: `2025`
- source_type: `CONFIG`
- source_reference: `src/config/legislative.yaml -> ibnr.closing_year`
- status: `active`
- justification: Valuation year 2025 matches the IBNR workbook sample. Configurable in legislative.yaml without code changes.
- affected_modules: `['ibnr', 'audit_run']`

## ibnr_product_segmentation_mode
- current_value: `user_selectable: mixed (workbook default) or homogeneous_by_product`
- source_type: `MENTOR`
- source_reference: `Session 2026-04-18 — both modes implemented; UI toggle via legislative.yaml segment_by_product`
- status: `active`
- justification: Two modes are available and user-selectable via the UI / legislative.yaml: (1) mixed — one triangle over all ADE products, matches workbook reference; (2) homogeneous_by_product — one independent triangle per product (IMMO, CONSO, WARDA, AC-ELITE), satisfying the actuarial rule of not mixing heterogeneous products. Reconciliation reference uses mixed mode. Set segment_by_product: true in legislative.yaml for homogeneous mode.
- affected_modules: `['ibnr', 'assumptions', 'audit_run']`

## ibnr_product_label_normalization
- current_value: `casefold — Conso/conso/CONSO → conso`
- source_type: `DATASET_RULE`
- source_reference: `level 02-ÉCHANTILLON DATA IBNR.xlsx "base ADE" col B product label variants`
- status: `active`
- justification: Product column contains mixed-case variants of the same label. BaseDatasetLoader category normalization collapses them to lowercase canonical form.
- affected_modules: `['ibnr', 'preprocessing']`

## ibnr_mack_variance_process_only
- current_value: `process variance only; estimation variance excluded`
- source_type: `LLM_SUGGESTED`
- source_reference: `PLAN-OTHERS.md §4.5; OTHERS/method_mack_chain_ladder.py`
- status: `needs_review`
- justification: Mack MSE calculation uses only process variance. Estimation variance is excluded as a conservative simplification. Full Mack formula would add a second term.
- affected_modules: `['ibnr_mack']`

## ibnr_mack_se_correlation_ignored
- current_value: `total_se = root-sum-of-squares(se per AY); AY correlations ignored`
- source_type: `LLM_SUGGESTED`
- source_reference: `PLAN-OTHERS.md §4.5`
- status: `needs_review`
- justification: Portfolio-level Mack SE is naïve root-sum-of-squares. Full Mack includes cross-AY covariance terms which are omitted here.
- affected_modules: `['ibnr_mack']`

## ibnr_bf_prior_basis_mature_ratio
- current_value: `prior = ULT/dev0 of most-mature AY (2022)`
- source_type: `LLM_SUGGESTED`
- source_reference: `PLAN-OTHERS.md §5.6; src/config/legislative.yaml -> ibnr.bornhuetter_ferguson.mature_ay`
- status: `needs_review`
- justification: BF prior ultimate is derived from the mature-year ULT/dev0 ratio. This is not actuary-validated; mentor review recommended before production use.
- affected_modules: `['ibnr_bf', 'ibnr_benktander']`

## ibnr_benktander_k2
- current_value: `k=2 Benktander iterations`
- source_type: `LLM_SUGGESTED`
- source_reference: `PLAN-OTHERS.md §6; src/config/legislative.yaml -> ibnr.benktander.k`
- status: `active`
- justification: Two Benktander iterations produce a credibility blend between BF and CL. k is configurable via legislative.yaml.
- affected_modules: `['ibnr_benktander']`

## ibnr_bootstrap_odp_residual
- current_value: `Pearson residual resampling without Poisson process-noise stage`
- source_type: `LLM_SUGGESTED`
- source_reference: `PLAN-OTHERS.md §7.5; OTHERS/method_bootstrap_odp.py`
- status: `needs_review`
- justification: Bootstrap uses ODP Pearson residual resampling only. Full two-stage Bootstrap would additionally sample from a Poisson distribution per cell.
- affected_modules: `['ibnr_bootstrap']`
