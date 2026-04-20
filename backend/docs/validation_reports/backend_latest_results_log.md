# Backend Latest Results Log

Date generated: 2026-04-19
Source: backend/storage/runs/*/run_*/result.json and rows.json (latest folder by LastWriteTime per domain).

## 1) Latest run snapshot by domain

| Domain | Run ID | Run timestamp | Row count | Total amount (DA) |
|---|---|---|---:|---:|
| PPNA | run_81cc82f594fb429d8da499c8f2a20c75 | 2026-04-18 13:23:33 | 21266 | 3,901,156.3638584488 |
| SAP | run_1b76602147c34dbc9e219aeb4086c31e | 2026-04-18 13:16:33 | 234 | 157,200,000 |
| PE | run_fb59facc3e43478bba1671bdee5c25ef | 2026-04-18 13:16:35 | 125 | 93,561,414.061794817 |
| PB | run_2f01feca513d4a79a0a2b4f2b4d584bf | 2026-04-18 13:16:35 | 5 | 13,951,038.248920649 |
| IBNR | run_1673fd35654849fb919a0443c169210c | 2026-04-18 13:16:35 | 4 | 135,205,244.46977875 (Chain Ladder total reserve) |

## 2) Domain details

### PPNA
- Closing date: 2025-05-31
- Parameters:
  - method: prorata_temporis
  - contract_day_formula: DATEDIF("Effet","Echeance","d")+1
  - remaining_day_formula: IF(OR(Date_cloture<"Effet",Date_cloture>"Echeance"),0,"Echeance"-Date_cloture)
- Total from by_network_product buckets: 3,901,156.3638584497
- Top buckets:
  - ('r1','ava'): 1,306,152.0645576429
  - ('r2','ava'): 927,011.3379788280
  - ('r4','ia'): 728,823.6472975857
  - ('r5','ia'): 440,344.8057838660
  - ('r1','ia'): 410,749.6953855580

### SAP
- Closing date: 2025-03-31
- Total amount: 157,200,000
- Parameters rule:
  - if closing date < declaration date then 0
  - if declaration date < closing date < settlement notification date then declared amount
  - else REJET => 0, SAP => declared amount, otherwise max(0, declared - paid)
- Top bucket:
  - ('direct','prevoyance'): 157,200,000

### PE
- Parameters:
  - positive_result_coefficient: 0.72
  - historical_average_coefficient: 0.15
- Total amount: 93,561,414.061794817
- Total from by_network_product buckets: 93,561,414.061794832
- Top buckets:
  - ('c110','prevoyance'): 53,460,000
  - ('r1','ade'): 9,547,142.216
  - ('c73','prevoyance'): 7,937,499.9999999991
  - ('c104','prevoyance'): 5,685,000
  - ('c33','prevoyance'): 5,160,000

### PB
- Parameters:
  - default_loss_ratio_threshold: 0.85
  - default_pb_rate: 0.0
- Total amount: 13,951,038.248920649
- Total from by_channel: 13,951,038.248920647
- by_channel:
  - R1: 10,986,318.2166001
  - R3: 1,803,117.6813205481
  - R5: 1,161,602.3509999996
  - R2: 0
  - R4: 0

### IBNR
- Method: chain_ladder_volume_weighted
- Parameters:
  - closing_year: 2025
  - occurrence_year_window: [2022, 2025]
  - max_development_year: 3
- Total IBNR Chain Ladder: 135,205,244.46977875

by_occurrence_year:
- AY 2022: diagonal 115,866,962.38348004, ultimate 115,866,962.38348004, reserve 0.0
- AY 2023: diagonal 175,929,504.7429632, ultimate 187,788,937.6093394, reserve 11,859,432.866376191
- AY 2024: diagonal 342,106,511.42809576, ultimate 372,612,834.13883805, reserve 30,506,322.710742295
- AY 2025: diagonal 204,542,282.77804482, ultimate 297,381,771.6707051, reserve 92,839,488.89266026

IBNR method comparison (from same result artifact):
- Mack total IBNR: 135,205,244.46977875
- Mack total SE naive: 18,225,115.239152741
- BF total IBNR: 127,822,067.27802864
- Benktander total IBNR: 133,533,122.17820469
- Bootstrap mean total IBNR: 135,205,244.46977875
- Bootstrap p95: 135,205,244.4697789

## 3) Consistency checks

- PPNA: total_amount ~= sum(by_network_product) (difference only floating point rounding)
- PE: total_amount ~= sum(by_network_product) (difference only floating point rounding)
- PB: total_amount ~= sum(by_channel) (difference only floating point rounding)
- IBNR: total reserve equals sum(reserve by occurrence year)

## 4) Notes

- All values above were extracted from backend-generated artifacts only.
- No frontend mock data was used for this log.
