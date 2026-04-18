import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { FileUploadZone, FileInfoBar } from "@/components/ui/file-upload-zone";
import { Coins, Download } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/app/ppna")({
  head: () => ({ meta: [{ title: "PPNA — Primes Non Acquises · L'Algérienne Vie" }] }),
  component: PpnaPage,
});

interface PpnaData {
  byProduit: { name: string; ppna: number; primes: number }[];
  byReseau: { name: string; ppna: number }[];
  totalPPNA: number;
  totalPrimes: number;
  tauxMoyenNA: number;
  rowCount: number;
  sheetName: string;
}

const PPNA_KEYWORDS = ["ppna", "primes non acquises", "non acquis", "provision prime", "réserve prime"];
const PRIME_KEYWORDS = ["prime", "cotisation", "encaissement", "primes acquises"];
const PRODUCT_KEYWORDS = ["produit", "branche", "garantie", "contrat", "libelle", "designation"];
const NETWORK_KEYWORDS = ["réseau", "reseau", "agence", "region", "direction", "r1", "r2", "r3", "r4", "r5", "r6", "délégation"];

function findColumn(headers: string[], keywords: string[]): string | undefined {
  const lc = headers.map((h) => String(h).toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lc.findIndex((h) => h.includes(kw));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function parsePPNA(buffer: ArrayBuffer): PpnaData {
  const wb = XLSX.read(buffer, { type: "array" });

  // Try to find the most relevant sheet (prefer ' PRODUCTION' or similar)
  const sheetName =
    wb.SheetNames.find((s) => s.toLowerCase().includes("product") || s.toLowerCase().includes("ppna")) ??
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  let rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  if (rows.length > 0) {
    const firstKey = Object.keys(rows[0])[0];
    if (firstKey.startsWith("__EMPTY") || firstKey.startsWith("Unnamed")) {
      rows = XLSX.utils.sheet_to_json(ws, { defval: null, range: 1 });
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const ppnaCol = findColumn(headers, PPNA_KEYWORDS);
  const primeCol = findColumn(headers, PRIME_KEYWORDS);
  const produitCol = findColumn(headers, PRODUCT_KEYWORDS);
  const reseauCol = findColumn(headers, NETWORK_KEYWORDS);

  // If no PPNA column found, use any numeric column
  const numericCols = headers.filter((h) => rows.some((r) => typeof r[h] === "number" && (r[h] as number) !== 0));
  const actualPpnaCol = ppnaCol ?? numericCols[numericCols.length - 1];
  const actualPrimeCol = primeCol ?? (numericCols.length > 1 ? numericCols[0] : undefined);

  const validRows = rows.filter((r) => {
    if (!actualPpnaCol) return false;
    const v = r[actualPpnaCol];
    return typeof v === "number" && !isNaN(v) && v !== 0;
  });

  // Group by produit
  const produitMap = new Map<string, { ppna: number; primes: number }>();
  for (const r of validRows) {
    const p = produitCol ? String(r[produitCol] ?? "Autre").trim() : "Global";
    const ppna = actualPpnaCol ? (Number(r[actualPpnaCol]) || 0) : 0;
    const prime = actualPrimeCol ? (Number(r[actualPrimeCol]) || 0) : 0;
    const prev = produitMap.get(p) ?? { ppna: 0, primes: 0 };
    produitMap.set(p, { ppna: prev.ppna + ppna, primes: prev.primes + prime });
  }
  const byProduit = Array.from(produitMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .filter((p) => p.name && p.name !== "null" && p.name !== "undefined")
    .slice(0, 12);

  // Group by réseau
  const reseauMap = new Map<string, { ppna: number }>();
  for (const r of validRows) {
    const net = reseauCol ? String(r[reseauCol] ?? "Autre").trim() : undefined;
    if (!net) continue;
    const ppna = actualPpnaCol ? (Number(r[actualPpnaCol]) || 0) : 0;
    const prev = reseauMap.get(net) ?? { ppna: 0 };
    reseauMap.set(net, { ppna: prev.ppna + ppna });
  }
  const byReseau = Array.from(reseauMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .filter((r) => r.name && r.name !== "null" && r.name !== "undefined")
    .slice(0, 10);

  const totalPPNA = byProduit.reduce((s, p) => s + p.ppna, 0);
  const totalPrimes = byProduit.reduce((s, p) => s + p.primes, 0);
  const tauxMoyenNA = totalPrimes > 0 ? (totalPPNA / totalPrimes) * 100 : 0;

  return {
    byProduit,
    byReseau,
    totalPPNA,
    totalPrimes,
    tauxMoyenNA,
    rowCount: validRows.length,
    sheetName,
  };
}

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M DA";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
];

function PpnaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<PpnaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((buffer: ArrayBuffer, f: File) => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const parsed = parsePPNA(buffer);
        setData(parsed);
        setFile(f);
      } catch (e) {
        setError("Impossible de lire ce fichier. Vérifiez le format Excel.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 100);
  }, []);

  const reset = () => { setFile(null); setData(null); setError(null); };

  return (
    <>
      <Topbar
        title="Primes Non Acquises"
        subtitle="PPNA · Pipeline d'analyse · Provision de fin d'exercice"
      />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
              <Coins className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Primes Non Acquises (PPNA)</div>
              <div className="text-xs text-muted-foreground">
                Fraction de prime non consommée à la date de clôture
              </div>
            </div>
          </div>
          {data && (
            <button className="flex items-center gap-2 text-xs bg-gradient-primary text-white px-4 py-2 rounded-lg hover:shadow-elegant transition-all">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          )}
        </div>

        {!data && (
          <FileUploadZone
            onFile={handleFile}
            title="Charger le fichier PPNA"
            description="Importez le fichier Excel PPNA pour analyser les primes non acquises par produit et réseau"
            loading={loading}
            error={error}
          />
        )}

        {data && file && (
          <>
            <FileInfoBar file={file} rowCount={data.rowCount} sheetName={data.sheetName} onReset={reset} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="PPNA Total"
                value={fmtM(data.totalPPNA)}
                hint="provisions calculées"
                icon={<Coins className="h-4 w-4" />}
                accent="primary"
                delay={0}
              />
              <KpiCard
                label="Primes émises"
                value={data.totalPrimes > 0 ? fmtM(data.totalPrimes) : "—"}
                hint="base de calcul"
                accent="gold"
                delay={0.05}
              />
              <KpiCard
                label="Taux moyen N/A"
                value={data.tauxMoyenNA > 0 ? data.tauxMoyenNA.toFixed(1) + " %" : "—"}
                hint="fraction non acquise"
                delay={0.1}
              />
              <KpiCard
                label="Produits"
                value={data.byProduit.length.toString()}
                hint="lignes analysées"
                delay={0.15}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <SectionCard
                title="PPNA par produit"
                description="Montants en M DA"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.byProduit.map((p) => ({
                      name: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
                      ppna: +(p.ppna / 1_000_000).toFixed(3),
                    }))}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" M" />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={120} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR") + " M DA", "PPNA"]}
                    />
                    <Bar dataKey="ppna" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard
                title="Répartition par produit"
                description="Part relative de chaque produit"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data.byProduit.map((p) => ({ name: p.name, value: Math.abs(p.ppna) }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      dataKey="value"
                      label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                      fontSize={10}
                    >
                      {data.byProduit.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown) => [fmtM(Number(v)), "PPNA"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </SectionCard>

              {data.byReseau.length > 0 && (
                <SectionCard
                  className="lg:col-span-2"
                  title="PPNA par réseau"
                  description="Montants en M DA"
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.byReseau.map((r) => ({
                        name: r.name,
                        ppna: +(r.ppna / 1_000_000).toFixed(3),
                      }))}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" M" />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR") + " M DA", "PPNA"]}
                      />
                      <Bar dataKey="ppna" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}
            </div>

            {/* Summary table */}
            <SectionCard
              title="Tableau de synthèse"
              description="PPNA par produit"
              action={<Badge variant="gold">{data.byProduit.length} produits</Badge>}
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-6 py-2">Produit</th>
                      <th className="text-right font-medium px-6 py-2">Primes émises</th>
                      <th className="text-right font-medium px-6 py-2">PPNA</th>
                      <th className="text-right font-medium px-6 py-2">Taux N/A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProduit.map((p, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-2.5 font-medium text-foreground">{p.name}</td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {p.primes > 0 ? fmtM(p.primes) : "—"}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground font-semibold">
                          {fmtM(p.ppna)}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {p.primes > 0 ? ((p.ppna / p.primes) * 100).toFixed(1) + " %" : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="px-6 py-2.5 text-foreground">Total</td>
                      <td className="px-6 py-2.5 text-right font-mono text-foreground">
                        {data.totalPrimes > 0 ? fmtM(data.totalPrimes) : "—"}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-gold-deep">
                        {fmtM(data.totalPPNA)}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-foreground">
                        {data.tauxMoyenNA > 0 ? data.tauxMoyenNA.toFixed(1) + " %" : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </>
  );
}
