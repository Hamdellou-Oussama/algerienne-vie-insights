# Consolidated Audit Summary

## Provision Totals
- ppna: `{'closing_date': '2025-05-31', 'total_amount': 3901156.363858455, 'row_count': 21266}`
- pe: `{'total_amount': 93561414.06179482, 'row_count': 125}`
- sap: `{'closing_date': '2025-03-31', 'total_amount': 157200000.0, 'row_count': 234}`
- ibnr: `{'closing_year': 2025, 'total_ibnr': 135205244.46977875, 'triangle_shape': '4x4', 'row_count': 451, 'mode': 'mixed_all_products', 'by_product': None, 'method_comparison': {'chain_ladder': 135205244.46977875, 'mack_se': 18225115.23915274, 'bf_total': 127822067.27802864, 'benktander_total': 133533122.17820469, 'bootstrap_mean': 135205244.46977875, 'bootstrap_p95': 135205244.4697789, 'method_range': 7383177.191750109}}`

## Blockers
- assumption::ibnr_mack_variance_process_only::needs_review
- assumption::ibnr_mack_se_correlation_ignored::needs_review
- assumption::ibnr_bf_prior_basis_mature_ratio::needs_review
- assumption::ibnr_bootstrap_odp_residual::needs_review

## Artifacts
- preprocessing_summary: `/home/maab/Documents/openData/docs/validation_reports/preprocessing_summary.json`
- provision_summary_json: `/home/maab/Documents/openData/docs/validation_reports/provision_summary.json`
- provision_summary_markdown: `/home/maab/Documents/openData/docs/validation_reports/provision_summary.md`
- reconciliation_report_json: `/home/maab/Documents/openData/docs/validation_reports/reconciliation_report.json`
- reconciliation_report_markdown: `/home/maab/Documents/openData/docs/validation_reports/reconciliation_report.md`
- assumption_registry_json: `/home/maab/Documents/openData/docs/validation_reports/assumption_registry.json`
- assumption_registry_markdown: `/home/maab/Documents/openData/docs/validation_reports/assumption_registry.md`
