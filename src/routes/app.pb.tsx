import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { FileUploadZone, FileInfoBar } from "@/components/ui/file-upload-zone";
import { Award, Download } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/app/pb")({
  head: () => ({ meta: [{ title: "PB — Participation aux Bénéfices · L'Algérienne Vie" }] }),
  component: PbPage,
});

interface PbData {
  byProduit: { name: string; pb: number; eligible: number }[];
  byAnnee: { annee: string; pb: number }[];
  totalPB: number;
  totalEligible: number;
  tauxMoyen: number;
  sheetName: string;
  rowCount: number;
}

const PB_KEYWORDS = ["pb", "participation", "bénéfices", "benefices", "participation aux bénéfices", "intéressement", "dividende"];
const ELIGIBLE_KEYWORDS = ["eligible", "éligible", "bénéficiaire", "beneficiaire", "contrat", "nombre"];
const PRODUCT_KEYWORDS = ["produit", "branche", "garantie", "libelle", "designation", "contrat"];
const YEAR_KEYWORDS = ["année", "annee", "exercice", "period", "year", "an", "date"];

function findColumn(headers: string[], keywords: string[]): string | undefined {
  const lc = headers.map((h) => String(h).toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lc.findIndex((h) => h.includes(kw));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function parsePB(buffer: ArrayBuffer): PbData {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName =
    wb.SheetNames.find((s) =>
      s.toLowerCase().includes("pb") ||
      s.toLowerCase().includes("participation") ||
      s.toLowerCase().includes("bénéfice")
    ) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  let rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  if (rows.length > 0) {
    const firstKey = Object.keys(rows[0])[0];
    if (firstKey.startsWith("__EMPTY") || firstKey.startsWith("Unnamed")) {
      rows = XLSX.utils.sheet_to_json(ws, { defval: null, range: 1 });
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const pbCol = findColumn(headers, PB_KEYWORDS);
  const eligibleCol = findColumn(headers, ELIGIBLE_KEYWORDS);
  const produitCol = findColumn(headers, PRODUCT_KEYWORDS);
  const anneeCol = findColumn(headers, YEAR_KEYWORDS);

  const numericCols = headers.filter((h) =>
    rows.some((r) => typeof r[h] === "number" && (r[h] as number) !== 0)
  );
  const actualPBCol = pbCol ?? numericCols[numericCols.length - 1];

  const validRows = rows.filter((r) => {
    if (!actualPBCol) return false;
    const v = r[actualPBCol];
    return typeof v === "number" && !isNaN(v) && v !== 0;
  });

  // Group by produit
  const produitMap = new Map<string, { pb: number; eligible: number }>();
  for (const r of validRows) {
    const p = produitCol ? String(r[produitCol] ?? "Global").trim() : "Global";
    const pb = actualPBCol ? (Number(r[actualPBCol]) || 0) : 0;
    const elig = eligibleCol ? (Number(r[eligibleCol]) || 0) : 0;
    const prev = produitMap.get(p) ?? { pb: 0, eligible: 0 };
    produitMap.set(p, { pb: prev.pb + pb, eligible: prev.eligible + elig });
  }
  const byProduit = Array.from(produitMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .filter((p) => p.name && p.name !== "null" && p.name !== "undefined")
    .slice(0, 10);

  // Group by année
  const anneeMap = new Map<string, { pb: number }>();
  for (const r of validRows) {
    const y = anneeCol ? String(r[anneeCol] ?? "").trim() : "";
    if (!y) continue;
    const pb = actualPBCol ? (Number(r[actualPBCol]) || 0) : 0;
    const prev = anneeMap.get(y) ?? { pb: 0 };
    anneeMap.set(y, { pb: prev.pb + pb });
  }
  const byAnnee = Array.from(anneeMap.entries())
    .map(([annee, v]) => ({ annee, ...v }))
    .filter((a) => a.annee && a.annee !== "null" && a.annee !== "undefined")
    .slice(0, 10);

  const totalPB = byProduit.reduce((s, p) => s + p.pb, 0) || validRows.reduce((s, r) => s + (Number(r[actualPBCol!]) || 0), 0);
  const totalEligible = byProduit.reduce((s, p) => s + p.eligible, 0);
  const tauxMoyen = totalEligible > 0 ? (totalPB / totalEligible) : 0;

  return {
    byProduit,
    byAnnee,
    totalPB,
    totalEligible,
    tauxMoyen,
    sheetName,
    rowCount: validRows.length,
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
];

function PbPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<PbData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((buffer: ArrayBuffer, f: File) => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const parsed = parsePB(buffer);
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
        title="Participation aux Bénéfices"
        subtitle="PB · Pipeline d'analyse · Redistribution des résultats"
      />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
              <Award className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Participation aux Bénéfices (PB)</div>
              <div className="text-xs text-muted-foreground">
                Montants attribués aux assurés sur les résultats techniques et financiers
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
            title="Charger le fichier PB"
            description="Importez le fichier Excel de Participation aux Bénéfices pour analyser la redistribution"
            loading={loading}
            error={error}
          />
        )}

        {data && file && (
          <>
            <FileInfoBar file={file} rowCount={data.rowCount} sheetName={data.sheetName} onReset={reset} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="PB Total"
                value={fmtM(data.totalPB)}
                hint="redistribué"
                icon={<Award className="h-4 w-4" />}
                accent="primary"
                delay={0}
              />
              <KpiCard
                label="PB moyen"
                value={data.tauxMoyen > 0 ? fmtM(data.tauxMoyen) : "—"}
                hint="par bénéficiaire"
                accent="gold"
                delay={0.05}
              />
              <KpiCard
                label="Bénéficiaires"
                value={data.totalEligible > 0 ? data.totalEligible.toLocaleString("fr-FR") : "—"}
                hint="contrats éligibles"
                delay={0.1}
              />
              <KpiCard
                label="Produits"
                value={data.byProduit.length.toString()}
                hint="branches concernées"
                delay={0.15}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* PB par produit */}
              <SectionCard
                title="PB par produit"
                description="Montants en M DA"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.byProduit.map((p) => ({
                      name: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
                      pb: +(p.pb / 1_000_000).toFixed(3),
                    }))}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" M" />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={120} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR") + " M DA", "PB"]}
                    />
                    <Bar dataKey="pb" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Pie chart */}
              <SectionCard
                title="Répartition par produit"
                description="Part relative de chaque produit"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data.byProduit.map((p) => ({ name: p.name, value: Math.abs(p.pb) }))}
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
                      formatter={(v: unknown) => [fmtM(Number(v)), "PB"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </SectionCard>

              {data.byAnnee.length > 1 && (
                <SectionCard
                  className="lg:col-span-2"
                  title="PB par exercice"
                  description="Évolution annuelle — M DA"
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.byAnnee.map((a) => ({
                        annee: a.annee,
                        pb: +(a.pb / 1_000_000).toFixed(3),
                      }))}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="annee" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" M" />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR") + " M DA", "PB"]}
                      />
                      <Bar dataKey="pb" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}
            </div>

            {/* Summary table */}
            <SectionCard
              title="Détail par produit"
              action={<Badge variant="gold">{data.byProduit.length} produits</Badge>}
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-6 py-2">Produit</th>
                      <th className="text-right font-medium px-6 py-2">PB (M DA)</th>
                      {data.byProduit.some((p) => p.eligible > 0) && (
                        <th className="text-right font-medium px-6 py-2">Bénéficiaires</th>
                      )}
                      {data.byProduit.some((p) => p.eligible > 0) && (
                        <th className="text-right font-medium px-6 py-2">PB moyen (DA)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byProduit.map((p, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-2.5 font-medium text-foreground">{p.name}</td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground font-semibold">
                          {fmtM(p.pb)}
                        </td>
                        {data.byProduit.some((p2) => p2.eligible > 0) && (
                          <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                            {p.eligible > 0 ? p.eligible.toLocaleString("fr-FR") : "—"}
                          </td>
                        )}
                        {data.byProduit.some((p2) => p2.eligible > 0) && (
                          <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                            {p.eligible > 0
                              ? Math.round(p.pb / p.eligible).toLocaleString("fr-FR")
                              : "—"}
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="px-6 py-2.5 text-foreground">Total</td>
                      <td className="px-6 py-2.5 text-right font-mono text-gold-deep">{fmtM(data.totalPB)}</td>
                      {data.byProduit.some((p) => p.eligible > 0) && (
                        <td className="px-6 py-2.5 text-right font-mono text-foreground">
                          {data.totalEligible.toLocaleString("fr-FR")}
                        </td>
                      )}
                      {data.byProduit.some((p) => p.eligible > 0) && (
                        <td className="px-6 py-2.5 text-right font-mono text-foreground">
                          {data.totalEligible > 0
                            ? Math.round(data.totalPB / data.totalEligible).toLocaleString("fr-FR")
                            : "—"}
                        </td>
                      )}
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
