import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { FileUploadZone, FileInfoBar } from "@/components/ui/file-upload-zone";
import { Shield, Download, Info } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/app/pe")({
  head: () => ({ meta: [{ title: "PE — Provision d'Égalisation · L'Algérienne Vie" }] }),
  component: PePage,
});

interface PeData {
  rows: { annee: string; pe: number; primes?: number; sinistres?: number }[];
  totalPE: number;
  dernierExercice: string;
  tauxPE: number;
  sheetName: string;
  rowCount: number;
}

const PE_KEYWORDS = ["pe ", "p.e", "égalisation", "egalisation", "provision d'égalisation", "provision egalisation"];
const YEAR_KEYWORDS = ["année", "annee", "exercice", "period", "year", "an"];
const PRIME_KEYWORDS = ["prime", "cotisation", "encaissement"];
const SINISTRE_KEYWORDS = ["sinistre", "prestation", "charge", "indemnite", "reglement"];

function findColumn(headers: string[], keywords: string[]): string | undefined {
  const lc = headers.map((h) => String(h).toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lc.findIndex((h) => h.includes(kw));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function parsePE(buffer: ArrayBuffer): PeData {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName =
    wb.SheetNames.find((s) =>
      s.toLowerCase().includes("pe") ||
      s.toLowerCase().includes("égali") ||
      s.toLowerCase().includes("egalisation")
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
  const peCol = findColumn(headers, PE_KEYWORDS);
  const yearCol = findColumn(headers, YEAR_KEYWORDS);
  const primeCol = findColumn(headers, PRIME_KEYWORDS);
  const sinistreCol = findColumn(headers, SINISTRE_KEYWORDS);

  // If no PE column, try to detect: look for last non-empty numeric column in header containing "total" or last column
  const numericCols = headers.filter((h) =>
    rows.some((r) => typeof r[h] === "number" && (r[h] as number) !== 0)
  );
  const actualPECol = peCol ?? numericCols[numericCols.length - 1];

  const validRows = rows.filter((r) => {
    if (!actualPECol) return false;
    const v = r[actualPECol];
    return typeof v === "number" && !isNaN(v) && v !== 0;
  });

  const dataRows = validRows.map((r) => ({
    annee: yearCol
      ? String(r[yearCol] ?? "").trim()
      : String(rows.indexOf(r) + 2018),
    pe: actualPECol ? (Number(r[actualPECol]) || 0) : 0,
    primes: primeCol ? (Number(r[primeCol]) || 0) : undefined,
    sinistres: sinistreCol ? (Number(r[sinistreCol]) || 0) : undefined,
  })).filter((r) => r.annee && r.annee !== "null" && r.annee !== "undefined");

  const totalPE = dataRows.reduce((s, r) => s + r.pe, 0);
  const dernierExercice = dataRows.length > 0 ? dataRows[dataRows.length - 1].annee : "—";
  const totalPrimes = dataRows.reduce((s, r) => s + (r.primes ?? 0), 0);
  const tauxPE = totalPrimes > 0 ? (totalPE / totalPrimes) * 100 : 0;

  return {
    rows: dataRows,
    totalPE,
    dernierExercice,
    tauxPE,
    sheetName,
    rowCount: validRows.length,
  };
}

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M DA";

function PePage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<PeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((buffer: ArrayBuffer, f: File) => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const parsed = parsePE(buffer);
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

  const minPE = data ? Math.min(...data.rows.map((r) => r.pe)) : 0;
  const maxPE = data ? Math.max(...data.rows.map((r) => r.pe)) : 0;
  const variation = data && data.rows.length >= 2
    ? ((data.rows[data.rows.length - 1].pe - data.rows[0].pe) / Math.abs(data.rows[0].pe || 1)) * 100
    : 0;

  return (
    <>
      <Topbar
        title="Provision d'Égalisation"
        subtitle="PE · Pipeline d'analyse · Lissage des résultats techniques"
      />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
              <Shield className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Provision d'Égalisation (PE)</div>
              <div className="text-xs text-muted-foreground">
                Provision destinée à compenser les fluctuations de sinistralité
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
            title="Charger le fichier PE"
            description="Importez le fichier Excel de Provision d'Égalisation pour analyser l'évolution et les montants"
            loading={loading}
            error={error}
          />
        )}

        {data && file && (
          <>
            <FileInfoBar file={file} rowCount={data.rowCount} sheetName={data.sheetName} onReset={reset} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="PE Totale"
                value={fmtM(data.totalPE)}
                hint={`Exercice ${data.dernierExercice}`}
                icon={<Shield className="h-4 w-4" />}
                accent="primary"
                delay={0}
              />
              <KpiCard
                label="Taux PE / Primes"
                value={data.tauxPE > 0 ? data.tauxPE.toFixed(2) + " %" : "—"}
                hint="charge relative"
                accent="gold"
                delay={0.05}
              />
              <KpiCard
                label="PE Minimale"
                value={fmtM(minPE)}
                hint="sur la période"
                delay={0.1}
              />
              <KpiCard
                label="Variation"
                value={`${variation >= 0 ? "+" : ""}${variation.toFixed(1)} %`}
                hint="depuis le début"
                trend={variation}
                delay={0.15}
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* PE Evolution */}
              <SectionCard
                className="lg:col-span-2"
                title="Évolution de la PE"
                description="Montants en M DA par exercice"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={data.rows.map((r) => ({
                      annee: r.annee,
                      pe: +(r.pe / 1_000_000).toFixed(3),
                      ...(r.primes !== undefined ? { primes: +(r.primes / 1_000_000).toFixed(3) } : {}),
                    }))}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="annee" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" M" />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString("fr-FR") + " M DA", name === "pe" ? "PE" : "Primes"]}
                    />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Line
                      type="monotone"
                      dataKey="pe"
                      stroke="var(--gold)"
                      strokeWidth={2.5}
                      dot={{ fill: "var(--gold)", r: 5 }}
                      name="PE"
                    />
                    {data.rows.some((r) => r.primes !== undefined) && (
                      <Line
                        type="monotone"
                        dataKey="primes"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                        name="Primes"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Key metrics */}
              <SectionCard title="Résumé technique" description="Indicateurs clés">
                <div className="space-y-5">
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">PE au dernier exercice</div>
                    <div className="text-2xl font-semibold text-foreground tabular-nums">
                      {fmtM(data.rows[data.rows.length - 1]?.pe ?? 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Exercice {data.dernierExercice}</div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">PE Maximum</div>
                    <div className="text-xl font-semibold text-foreground tabular-nums">{fmtM(maxPE)}</div>
                  </div>
                  <div className="border-t border-border pt-4 flex items-start gap-2 bg-gold-soft/40 rounded-lg p-3">
                    <Info className="h-4 w-4 text-gold-deep flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground">
                      La PE permet de lisser les résultats techniques en années de forte sinistralité.
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* PE bar chart */}
            <SectionCard
              title="PE par exercice"
              description="Vue histogramme — M DA"
              action={<Badge variant="gold">{data.rows.length} exercices</Badge>}
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={data.rows.map((r) => ({
                    annee: r.annee,
                    pe: +(r.pe / 1_000_000).toFixed(3),
                  }))}
                  margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="annee" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" M" />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR") + " M DA", "PE"]}
                  />
                  <Bar dataKey="pe" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Table */}
              <div className="overflow-x-auto -mx-6 mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-6 py-2">Exercice</th>
                      <th className="text-right font-medium px-6 py-2">PE (M DA)</th>
                      {data.rows.some((r) => r.primes !== undefined) && (
                        <th className="text-right font-medium px-6 py-2">Primes (M DA)</th>
                      )}
                      {data.rows.some((r) => r.sinistres !== undefined) && (
                        <th className="text-right font-medium px-6 py-2">Sinistres (M DA)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-2.5 font-medium text-foreground">{r.annee}</td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground font-semibold">
                          {fmtM(r.pe)}
                        </td>
                        {data.rows.some((r2) => r2.primes !== undefined) && (
                          <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                            {r.primes !== undefined ? fmtM(r.primes) : "—"}
                          </td>
                        )}
                        {data.rows.some((r2) => r2.sinistres !== undefined) && (
                          <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                            {r.sinistres !== undefined ? fmtM(r.sinistres) : "—"}
                          </td>
                        )}
                      </tr>
                    ))}
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
