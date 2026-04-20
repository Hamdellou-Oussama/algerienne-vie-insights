import type { IbnrSummary, PpnaSummary, SapSummary } from "@/lib/api/runRows";

export interface BackendProduct {
  name: string;
  slug: string;
  premiums: number;
  ppna: number;
  sap: number;
  ibnr: number;
  reserveTotal: number;
  claimCount: number;
  networks: string[];
}

export function slugifyProductName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildBackendProducts(
  ppna: PpnaSummary,
  sap: SapSummary,
  ibnr?: IbnrSummary,
): BackendProduct[] {
  const map = new Map<
    string,
    {
      name: string;
      premiums: number;
      ppna: number;
      sap: number;
      ibnr: number;
      claimCount: number;
      networks: Set<string>;
    }
  >();

  for (const row of ppna.byProduit) {
    if (row.name === "N/A") continue;
    const current = map.get(row.name) ?? {
      name: row.name,
      premiums: 0,
      ppna: 0,
      sap: 0,
      ibnr: 0,
      claimCount: 0,
      networks: new Set<string>(),
    };
    current.ppna += row.ppna;
    current.premiums += row.primes;
    map.set(row.name, current);
  }

  for (const row of sap.byProduit) {
    if (row.name === "N/A") continue;
    const current = map.get(row.name) ?? {
      name: row.name,
      premiums: 0,
      ppna: 0,
      sap: 0,
      ibnr: 0,
      claimCount: 0,
      networks: new Set<string>(),
    };
    current.sap += row.montant;
    current.claimCount += row.count;
    map.set(row.name, current);
  }

  for (const row of sap.rows) {
    if (row.product === "N/A") continue;
    const current = map.get(row.product) ?? {
      name: row.product,
      premiums: 0,
      ppna: 0,
      sap: 0,
      ibnr: 0,
      claimCount: 0,
      networks: new Set<string>(),
    };
    current.networks.add(row.network);
    map.set(row.product, current);
  }

  if (ibnr?.segmented) {
    for (const segment of ibnr.segments) {
      if (!map.has(segment.name)) continue;
      const current = map.get(segment.name)!;
      current.ibnr += segment.totalIbnr;
      map.set(segment.name, current);
    }
  }

  return Array.from(map.values())
    .map((product) => ({
      name: product.name,
      slug: slugifyProductName(product.name),
      premiums: product.premiums,
      ppna: product.ppna,
      sap: product.sap,
      ibnr: product.ibnr,
      reserveTotal: product.ppna + product.sap + product.ibnr,
      claimCount: product.claimCount,
      networks: Array.from(product.networks).sort(),
    }))
    .sort((a, b) => b.reserveTotal - a.reserveTotal);
}
