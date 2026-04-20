import type { IbnrMethodComparisonPayload, IbnrMethodComparisonRow } from "./types";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asRecords(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asRecord(item)).filter((item): item is UnknownRecord => item !== null);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toLabel(value: unknown, fallback = "N/A"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PpnaRowView {
  sourceRow: number;
  network: string;
  product: string;
  netPremium: number;
  ppnaAmount: number;
  unearnedRatio: number;
}

export interface PpnaSummary {
  rows: PpnaRowView[];
  byProduit: Array<{ name: string; ppna: number; primes: number }>;
  byReseau: Array<{ name: string; ppna: number }>;
  totalPPNA: number;
  totalPrimes: number;
  tauxMoyenNA: number;
}

export function toPpnaSummary(raw: unknown): PpnaSummary {
  const rows = asRecords(raw).map((row) => ({
    sourceRow: toNumber(row.source_row_number),
    network: toLabel(row.network),
    product: toLabel(row.product),
    netPremium: toNumber(row.net_premium),
    ppnaAmount: toNumber(row.ppna_amount),
    unearnedRatio: toNumber(row.unearned_ratio),
  }));

  const byProduitMap = new Map<string, { ppna: number; primes: number }>();
  const byReseauMap = new Map<string, { ppna: number }>();

  for (const row of rows) {
    const produit = byProduitMap.get(row.product) ?? { ppna: 0, primes: 0 };
    produit.ppna += row.ppnaAmount;
    produit.primes += row.netPremium;
    byProduitMap.set(row.product, produit);

    const reseau = byReseauMap.get(row.network) ?? { ppna: 0 };
    reseau.ppna += row.ppnaAmount;
    byReseauMap.set(row.network, reseau);
  }

  const byProduit = Array.from(byProduitMap.entries())
    .map(([name, value]) => ({ name, ppna: round2(value.ppna), primes: round2(value.primes) }))
    .sort((a, b) => b.ppna - a.ppna);

  const byReseau = Array.from(byReseauMap.entries())
    .map(([name, value]) => ({ name, ppna: round2(value.ppna) }))
    .sort((a, b) => b.ppna - a.ppna);

  const totalPPNA = rows.reduce((sum, row) => sum + row.ppnaAmount, 0);
  const totalPrimes = rows.reduce((sum, row) => sum + row.netPremium, 0);

  return {
    rows,
    byProduit,
    byReseau,
    totalPPNA,
    totalPrimes,
    tauxMoyenNA: totalPrimes > 0 ? (totalPPNA / totalPrimes) * 100 : 0,
  };
}

export interface SapRowView {
  sourceRow: number;
  claimId: string;
  status: string;
  network: string;
  product: string;
  declarationDate: string;
  settlementNotificationDate: string;
  declaredAmount: number;
  paidAmount: number;
  sapAmount: number;
}

export interface SapSummary {
  rows: SapRowView[];
  byStatut: Array<{ statut: string; count: number; montant: number }>;
  byProduit: Array<{ name: string; count: number; montant: number }>;
  byReseau: Array<{ name: string; count: number; montant: number }>;
  montantTotal: number;
  montantSAP: number;
}

export function toSapSummary(raw: unknown): SapSummary {
  const rows = asRecords(raw).map((row) => ({
    sourceRow: toNumber(row.source_row_number),
    claimId: toLabel(row.claim_id, `row-${toNumber(row.source_row_number)}`),
    status: toLabel(row.status),
    network: toLabel(row.network),
    product: toLabel(row.product),
    declarationDate: toLabel(row.declaration_date, "—"),
    settlementNotificationDate: toLabel(row.settlement_notification_date, "—"),
    declaredAmount: toNumber(row.declared_amount),
    paidAmount: toNumber(row.paid_amount),
    sapAmount: toNumber(row.sap_amount),
  }));

  const statusMap = new Map<string, { count: number; montant: number }>();
  const productMap = new Map<string, { count: number; montant: number }>();
  const networkMap = new Map<string, { count: number; montant: number }>();

  for (const row of rows) {
    const status = statusMap.get(row.status) ?? { count: 0, montant: 0 };
    status.count += 1;
    status.montant += row.sapAmount;
    statusMap.set(row.status, status);

    const product = productMap.get(row.product) ?? { count: 0, montant: 0 };
    product.count += 1;
    product.montant += row.sapAmount;
    productMap.set(row.product, product);

    const network = networkMap.get(row.network) ?? { count: 0, montant: 0 };
    network.count += 1;
    network.montant += row.sapAmount;
    networkMap.set(row.network, network);
  }

  const byStatut = Array.from(statusMap.entries())
    .map(([statut, value]) => ({ statut, count: value.count, montant: round2(value.montant) }))
    .sort((a, b) => b.count - a.count);

  const byProduit = Array.from(productMap.entries())
    .map(([name, value]) => ({ name, count: value.count, montant: round2(value.montant) }))
    .sort((a, b) => b.montant - a.montant);

  const byReseau = Array.from(networkMap.entries())
    .map(([name, value]) => ({ name, count: value.count, montant: round2(value.montant) }))
    .sort((a, b) => b.montant - a.montant);

  const montantTotal = rows.reduce((sum, row) => sum + row.sapAmount, 0);

  return {
    rows,
    byStatut,
    byProduit,
    byReseau,
    montantTotal,
    montantSAP: montantTotal,
  };
}

export interface PeYearView {
  annee: string;
  pe: number;
  technicalResult: number;
  historicalAverage: number;
  count: number;
}

export interface PeSummary {
  rows: PeYearView[];
  totalPE: number;
  dernierExercice: string;
  averagePerYear: number;
}

export function toPeSummary(raw: unknown): PeSummary {
  const grouped = new Map<string, PeYearView>();

  for (const row of asRecords(raw)) {
    const year = String(toNumber(row.fiscal_year));
    const pe = toNumber(row.equalization_provision);
    const technical = toNumber(row.technical_result);
    const historical = toNumber(row.historical_average);

    const current = grouped.get(year) ?? {
      annee: year,
      pe: 0,
      technicalResult: 0,
      historicalAverage: 0,
      count: 0,
    };

    current.pe += pe;
    current.technicalResult += technical;
    current.historicalAverage += historical;
    current.count += 1;
    grouped.set(year, current);
  }

  const rows = Array.from(grouped.values())
    .map((item) => ({
      ...item,
      pe: round2(item.pe),
      technicalResult: round2(item.technicalResult),
      historicalAverage: round2(item.historicalAverage),
    }))
    .sort((a, b) => Number(a.annee) - Number(b.annee));

  const totalPE = rows.reduce((sum, row) => sum + row.pe, 0);

  return {
    rows,
    totalPE,
    dernierExercice: rows.length > 0 ? rows[rows.length - 1].annee : "—",
    averagePerYear: rows.length > 0 ? totalPE / rows.length : 0,
  };
}

export interface PbRowView {
  sourceRow: number;
  channel: string;
  policyId: string;
  pbAmount: number;
  eligible: boolean;
  lossRatio: number;
  creditBalance: number;
  zeroReason: string;
}

export interface PbSummary {
  rows: PbRowView[];
  byChannel: Array<{ name: string; pb: number; count: number; eligible: number }>;
  eligibility: Array<{ name: string; pb: number; count: number }>;
  totalPB: number;
  totalEligible: number;
  tauxMoyen: number;
}

export function toPbSummary(raw: unknown): PbSummary {
  const rows = asRecords(raw).map((row) => ({
    sourceRow: toNumber(row.source_row_number),
    channel: toLabel(row.channel),
    policyId: toLabel(row.policy_id),
    pbAmount: toNumber(row.participation_beneficiaire),
    eligible: Boolean(row.pb_eligible),
    lossRatio: toNumber(row.loss_ratio),
    creditBalance: toNumber(row.credit_balance),
    zeroReason: toLabel(row.zero_reason, "none"),
  }));

  const channelMap = new Map<string, { pb: number; count: number; eligible: number }>();
  for (const row of rows) {
    const current = channelMap.get(row.channel) ?? { pb: 0, count: 0, eligible: 0 };
    current.pb += row.pbAmount;
    current.count += 1;
    current.eligible += row.eligible ? 1 : 0;
    channelMap.set(row.channel, current);
  }

  const byChannel = Array.from(channelMap.entries())
    .map(([name, value]) => ({
      name,
      pb: round2(value.pb),
      count: value.count,
      eligible: value.eligible,
    }))
    .sort((a, b) => b.pb - a.pb);

  const eligibility = [
    {
      name: "Eligible",
      pb: round2(rows.filter((row) => row.eligible).reduce((sum, row) => sum + row.pbAmount, 0)),
      count: rows.filter((row) => row.eligible).length,
    },
    {
      name: "Non eligible",
      pb: round2(rows.filter((row) => !row.eligible).reduce((sum, row) => sum + row.pbAmount, 0)),
      count: rows.filter((row) => !row.eligible).length,
    },
  ];

  const totalPB = rows.reduce((sum, row) => sum + row.pbAmount, 0);
  const totalEligible = rows.filter((row) => row.eligible).length;

  return {
    rows,
    byChannel,
    eligibility,
    totalPB,
    totalEligible,
    tauxMoyen: totalEligible > 0 ? totalPB / totalEligible : 0,
  };
}

export interface IbnrYearRow {
  occurrenceYear: number;
  diagonal: number;
  ultimate: number;
  reserve: number;
  lastKnownDevelopmentYear: number;
}

export interface IbnrSummary {
  segmented: boolean;
  segments: Array<{ name: string; rows: IbnrYearRow[]; totalIbnr: number; totalUltimate: number }>;
  mergedRows: IbnrYearRow[];
  totalIbnr: number;
  totalUltimate: number;
}

function parseIbnrArray(raw: unknown): IbnrYearRow[] {
  return asRecords(raw)
    .map((row) => ({
      occurrenceYear: toNumber(row.occurrence_year),
      diagonal: toNumber(row.diagonal_cumulative),
      ultimate: toNumber(row.ultimate),
      reserve: toNumber(row.reserve),
      lastKnownDevelopmentYear: toNumber(row.last_known_development_year),
    }))
    .filter((row) => row.occurrenceYear > 0)
    .sort((a, b) => a.occurrenceYear - b.occurrenceYear);
}

export function toIbnrSummary(raw: unknown): IbnrSummary {
  const asObj = asRecord(raw);

  if (Array.isArray(raw)) {
    const rows = parseIbnrArray(raw);
    const totalIbnr = rows.reduce((sum, row) => sum + row.reserve, 0);
    const totalUltimate = rows.reduce((sum, row) => sum + row.ultimate, 0);

    return {
      segmented: false,
      segments: [{ name: "global", rows, totalIbnr, totalUltimate }],
      mergedRows: rows,
      totalIbnr,
      totalUltimate,
    };
  }

  if (!asObj) {
    return {
      segmented: false,
      segments: [],
      mergedRows: [],
      totalIbnr: 0,
      totalUltimate: 0,
    };
  }

  const segments = Object.entries(asObj)
    .map(([name, value]) => {
      const rows = parseIbnrArray(value);
      const totalIbnr = rows.reduce((sum, row) => sum + row.reserve, 0);
      const totalUltimate = rows.reduce((sum, row) => sum + row.ultimate, 0);
      return { name, rows, totalIbnr, totalUltimate };
    })
    .filter((segment) => segment.rows.length > 0);

  const mergedMap = new Map<number, IbnrYearRow>();
  for (const segment of segments) {
    for (const row of segment.rows) {
      const current = mergedMap.get(row.occurrenceYear) ?? {
        occurrenceYear: row.occurrenceYear,
        diagonal: 0,
        ultimate: 0,
        reserve: 0,
        lastKnownDevelopmentYear: row.lastKnownDevelopmentYear,
      };
      current.diagonal += row.diagonal;
      current.ultimate += row.ultimate;
      current.reserve += row.reserve;
      current.lastKnownDevelopmentYear = Math.max(
        current.lastKnownDevelopmentYear,
        row.lastKnownDevelopmentYear,
      );
      mergedMap.set(row.occurrenceYear, current);
    }
  }

  const mergedRows = Array.from(mergedMap.values()).sort(
    (a, b) => a.occurrenceYear - b.occurrenceYear,
  );
  const totalIbnr = mergedRows.reduce((sum, row) => sum + row.reserve, 0);
  const totalUltimate = mergedRows.reduce((sum, row) => sum + row.ultimate, 0);

  return {
    segmented: true,
    segments,
    mergedRows,
    totalIbnr,
    totalUltimate,
  };
}

export interface IbnrMethodComparisonSummary {
  chainLadderTotal: number;
  methodRange: number;
  rows: IbnrMethodComparisonRow[];
}

export function toIbnrMethodComparison(rawResultPayload: unknown): IbnrMethodComparisonSummary {
  const resultRecord = asRecord(rawResultPayload);
  const methodComparison = asRecord(resultRecord?.method_comparison);
  if (!methodComparison) {
    return {
      chainLadderTotal: 0,
      methodRange: 0,
      rows: [],
    };
  }

  const rows: IbnrMethodComparisonRow[] = asRecords(methodComparison.comparison_rows).map(
    (row) => ({
      method: toLabel(row.method),
      total_ibnr: toNumber(row.total_ibnr),
      difference_vs_chain_ladder: toNumber(row.difference_vs_chain_ladder),
      pct_difference_vs_chain_ladder: toNumber(row.pct_difference_vs_chain_ladder),
      se_or_p95: row.se_or_p95 == null ? null : toNumber(row.se_or_p95),
    }),
  );

  const normalized: IbnrMethodComparisonPayload = {
    chain_ladder_total: toNumber(methodComparison.chain_ladder_total),
    method_range: toNumber(methodComparison.method_range),
    comparison_rows: rows,
  };

  return {
    chainLadderTotal: normalized.chain_ladder_total,
    methodRange: normalized.method_range,
    rows: normalized.comparison_rows,
  };
}
