import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { ibnrByMethod, triangleOriginYears, fmtMDA, developmentFactors } from "@/lib/mockData";
import { useState, useCallback } from "react";
import { Calculator, Download, Info, GitCompare, TrendingUp, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { FileUploadZone, FileInfoBar } from "@/components/ui/file-upload-zone";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

export const Route = createFileRoute("/app/ibnr")({
  head: () => ({ meta: [{ title: "Atelier IBNR — L'Algérienne Vie" }] }),
  component: IbnrWorkspace,
});

interface TriangleData {
  originYears: number[];
  devPeriods: number[];
  triangle: (number | null)[][];
  factors: number[];
  ultimates: number[];
  ibnrByYear: number[];
  totalIbnr: number;
  rowCount: number;
  sheetName: string;
}

function computeChainLadder(triangle: (number | null)[][]): { factors: number[]; ultimates: number[]; ibnrByYear: number[] } {
  const n = triangle.length;
  const m = triangle[0]?.length ?? 0;
  const factors: number[] = [];

  for (let col = 0; col < m - 1; col++) {
    let num = 0, den = 0;
    for (let row = 0; row < n; row++) {
      const curr = triangle[row][col];
      const next = triangle[row][col + 1];
      if (curr !== null && curr > 0 && next !== null && next > 0) {
        num += next;
        den += curr;
      }
    }
    factors.push(den > 0 ? num / den : 1);
  }

  const completed = triangle.map((row) => [...row]);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < m; col++) {
      if (completed[row][col] === null || completed[row][col] === 0) {
        const prev = col > 0 ? completed[row][col - 1] : null;
        if (prev !== null && prev > 0 && factors[col - 1] !== undefined) {
          completed[row][col] = prev * factors[col - 1];
        }
      }
    }
  }

  const paid = triangle.map((row) => {
    let last = 0;
    for (const v of row) if (v !== null && v > 0) last = v;
    return last;
  });

  const ultimates = completed.map((row) => {
    const last = row[m - 1];
    return typeof last === "number" && last > 0 ? last : paid[row.indexOf(last)];
  });

  const ibnrByYear = ultimates.map((u, i) => Math.max(0, u - paid[i]));
  return { factors, ultimates, ibnrByYear };
}

function parseTriangle(buffer: ArrayBuffer): TriangleData {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];

  // Find rows that look like triangle data (lots of numbers)
  const numericRows = raw.filter((row) => {
    const nums = row.filter((v) => typeof v === "number" && v > 0);
    return nums.length >= 2;
  });

  if (numericRows.length === 0) {
    return {
      originYears: [], devPeriods: [], triangle: [],
      factors: [], ultimates: [], ibnrByYear: [],
      totalIbnr: 0, rowCount: 0, sheetName,
    };
  }

  // Extract first column as years, rest as development values
  const originYears: number[] = [];
  const triangleRows: (number | null)[][] = [];

  for (const row of numericRows) {
    const first = row[0];
    const year = typeof first === "number" && first > 1990 && first < 2100 ? first : undefined;
    if (year) originYears.push(year);
    const values = (year ? row.slice(1) : row).map((v) =>
      typeof v === "number" && v > 0 ? v : null
    );
    if (values.some((v) => v !== null)) {
      triangleRows.push(values);
    }
  }

  const maxCols = Math.max(...triangleRows.map((r) => r.length));
  const padded = triangleRows.map((r) => {
    while (r.length < maxCols) r.push(null);
    return r;
  });

  const devPeriods = Array.from({ length: maxCols }, (_, i) => i + 1);
  const { factors, ultimates, ibnrByYear } = computeChainLadder(padded);
  const totalIbnr = ibnrByYear.reduce((s, v) => s + v, 0);

  return {
    originYears,
    devPeriods,
    triangle: padded,
    factors,
    ultimates,
    ibnrByYear,
    totalIbnr,
    rowCount: triangleRows.length,
    sheetName,
  };
}

const METHODS = [
  { key: "cl",   name: "Chain Ladder",         desc: "Méthode déterministe par facteurs de développement.", default: true },
  { key: "bf",   name: "Bornhuetter-Ferguson", desc: "Mélange ratio a priori et CL — adapté aux jeunes années." },
  { key: "lr",   name: "Loss Ratio",           desc: "S/P attendu × primes acquises." },
  { key: "mack", name: "Mack",                 desc: "CL stochastique avec écart-type." },
  { key: "mcl",  name: "Munich Chain Ladder",  desc: "Joint payés / encourus, corrige biais." },
  { key: "boot", name: "Bootstrap",            desc: "Réservation par rééchantillonnage — distribution complète." },
];

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M DA";

function IbnrWorkspace() {
  const [active, setActive] = useState("cl");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [triangleData, setTriangleData] = useState<TriangleData | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const method = METHODS.find((m) => m.key === active)!;
  const result = ibnrByMethod[METHODS.findIndex((m) => m.key === active)];

  const handleFile = useCallback((buffer: ArrayBuffer, f: File) => {
    setLoadingFile(true);
    setFileError(null);
    setTimeout(() => {
      try {
        const parsed = parseTriangle(buffer);
        setTriangleData(parsed);
        setUploadedFile(f);
      } catch (e) {
        setFileError("Impossible de lire ce fichier. Vérifiez le format Excel.");
        console.error(e);
      } finally {
        setLoadingFile(false);
      }
    }, 100);
  }, []);

  const resetFile = () => { setUploadedFile(null); setTriangleData(null); setFileError(null); };

  // Use uploaded triangle data if available, else use mock
  const useUploadedData = triangleData !== null && triangleData.rowCount > 0;
  const displayIbnr = useUploadedData ? triangleData!.totalIbnr : result.ibnr;
  const displayUltimate = useUploadedData ? triangleData!.ultimates.reduce((s, v) => s + v, 0) : result.ultimate;
  const displayEcart = useUploadedData ? 0 : result.ecart;

  const perYear = useUploadedData
    ? triangleData!.ibnrByYear.map((ibnr, i) => ({
        year: String(triangleData!.originYears[i] ?? i + 2018),
        ibnr: +(ibnr / 1_000_000).toFixed(2),
      }))
    : triangleOriginYears.slice(1).map((y, i) => ({
        year: String(y),
        ibnr: Math.round((50 + (i + 1) * (i + 1) * 60) * (1 + (METHODS.findIndex((m) => m.key === active)) * 0.01)),
      }));

  return (
    <>
      <Topbar title="Atelier IBNR" subtitle="Six méthodes de réservation · comparaison · sortie validée" />
      <div className="p-6 lg:p-8 space-y-6">

        {/* Upload zone */}
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
            <TrendingUp className="h-5 w-5 text-gold" />
          </div>
          <div>
            <div className="font-semibold text-foreground">Réservation IBNR</div>
            <div className="text-xs text-muted-foreground">
              {useUploadedData ? "Triangle chargé depuis fichier Excel" : "Données de démonstration · chargez votre fichier pour l'analyse réelle"}
            </div>
          </div>
          {useUploadedData && (
            <button
              onClick={resetFile}
              className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Changer le fichier
            </button>
          )}
        </div>

        {!uploadedFile ? (
          <FileUploadZone
            onFile={handleFile}
            title="Charger le triangle de développement"
            description="Importez votre fichier Excel contenant le triangle des sinistres cumulés pour calculer l'IBNR"
            loading={loadingFile}
            error={fileError}
          />
        ) : (
          <FileInfoBar
            file={uploadedFile}
            rowCount={triangleData?.rowCount ?? 0}
            sheetName={triangleData?.sheetName}
            onReset={resetFile}
          />
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="IBNR retenu"
            value={useUploadedData ? fmtM(displayIbnr) : fmtMDA(result.ibnr)}
            hint={method.name}
            icon={<Calculator className="h-4 w-4" />}
            accent="gold"
          />
          <KpiCard
            label="Charge ultime"
            value={useUploadedData ? fmtM(displayUltimate) : fmtMDA(result.ultimate)}
            icon={<Calculator className="h-4 w-4" />}
          />
          <KpiCard label="Méthodes testées" value="6" hint="Comparaison disponible" />
          <KpiCard
            label="Écart vs CL"
            value={`${displayEcart >= 0 ? "+" : ""}${displayEcart.toFixed(1)}%`}
            accent="primary"
          />
        </div>

        {/* Method tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-md text-sm font-medium transition-all border ${
                active === m.key
                  ? "bg-gradient-primary text-white border-transparent shadow-soft"
                  : "bg-card text-muted-foreground border-border hover:border-gold/40 hover:text-foreground"
              }`}
            >
              {m.name}
              {m.default && active !== m.key && <span className="ml-2 text-[10px] text-gold-deep">★</span>}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title={`Méthode : ${method.name}`}
            description={method.desc}
            action={
              <button className="inline-flex items-center gap-1.5 text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant">
                <Download className="h-3 w-3" /> Export résultats
              </button>
            }
          >
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-muted/40 rounded-md p-4">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-2">Hypothèses</div>
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li>• Pondération volume</li>
                  <li>• Tail factor : 1.000</li>
                  <li>• Développement complet à 7 ans</li>
                </ul>
              </div>
              <div className="bg-muted/40 rounded-md p-4">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-2">Facteurs de développement</div>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                  {(useUploadedData ? triangleData!.factors : developmentFactors).map((f, i) => (
                    <div key={i} className="bg-card rounded px-2 py-1 text-center">
                      <span className="text-muted-foreground">f{i}-{i+1}</span>{" "}
                      <span className="text-foreground font-semibold">{f.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-2">IBNR par année d'origine (M DA)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={perYear} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="ibnr" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Sortie technique" description="Résumé chiffré de la méthode">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">IBNR</div>
                <div className="font-display text-3xl text-foreground">{fmtMDA(result.ibnr)}</div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">Ultime estimé</div>
                <div className="font-display text-2xl text-foreground">{fmtMDA(result.ultimate)}</div>
              </div>
              <div className="border-t border-border pt-4 flex items-start gap-2 bg-gold-soft/40 rounded-md p-3">
                <Info className="h-4 w-4 text-gold-deep flex-shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  La méthode <strong>{method.name}</strong> est {result.ecart >= 0 ? "supérieure" : "inférieure"} de
                  <strong> {Math.abs(result.ecart).toFixed(1)}%</strong> à la référence Chain Ladder.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Triangle table (shown only when file is uploaded) ── */}
        {useUploadedData && triangleData!.triangle.length > 0 && (
          <SectionCard
            title="Triangle de développement"
            description="Valeurs observées (fond blanc) · Valeurs projetées Chain Ladder (fond bleu) · Montants en M DA"
            action={<Badge variant="info">Chain Ladder</Badge>}
          >
            <div className="overflow-x-auto -mx-6">
              <table className="min-w-full text-xs font-mono border-collapse">
                <thead>
                  <tr>
                    {/* Origin year header */}
                    <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left text-[10px] tracking-wider uppercase text-muted-foreground border-b border-r border-border font-semibold">
                      Année \ Dev
                    </th>
                    {triangleData!.devPeriods.map((p) => (
                      <th
                        key={p}
                        className="px-3 py-2 text-center text-[10px] tracking-wider uppercase text-muted-foreground border-b border-border min-w-[80px]"
                      >
                        {p}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-[10px] tracking-wider uppercase text-gold-deep border-b border-border min-w-[90px] bg-gold/5">
                      Ultime
                    </th>
                    <th className="px-3 py-2 text-center text-[10px] tracking-wider uppercase text-primary border-b border-border min-w-[90px] bg-primary/5">
                      IBNR
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {triangleData!.triangle.map((row, ri) => {
                    // Determine which cells are observed vs projected
                    // The last observed cell per row is the last non-null in the original triangle
                    let lastObserved = -1;
                    for (let ci = 0; ci < row.length; ci++) {
                      if (row[ci] !== null && row[ci]! > 0) lastObserved = ci;
                    }

                    return (
                      <tr key={ri} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        {/* Origin year */}
                        <td className="sticky left-0 z-10 bg-card px-4 py-1.5 font-semibold text-foreground border-r border-border text-[11px]">
                          {triangleData!.originYears[ri] ?? `Année ${ri + 1}`}
                        </td>

                        {row.map((val, ci) => {
                          const isObserved = ci <= lastObserved;
                          const isProjected = ci > lastObserved && val !== null && val! > 0;
                          const fmt = val === null || val === 0
                            ? "—"
                            : (val / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                          return (
                            <td
                              key={ci}
                              className={`px-3 py-1.5 text-right tabular-nums text-[11px] transition-colors
                                ${isObserved ? "text-foreground" : ""}
                                ${isProjected ? "text-blue-700 italic bg-blue-50/60" : ""}
                                ${!isObserved && !isProjected ? "text-muted-foreground/30" : ""}
                              `}
                            >
                              {fmt}
                            </td>
                          );
                        })}

                        {/* Ultimate */}
                        <td className="px-3 py-1.5 text-right tabular-nums text-[11px] font-semibold text-gold-deep bg-gold/5">
                          {triangleData!.ultimates[ri]
                            ? (triangleData!.ultimates[ri] / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : "—"}
                        </td>

                        {/* IBNR */}
                        <td className="px-3 py-1.5 text-right tabular-nums text-[11px] font-bold text-primary bg-primary/5">
                          {triangleData!.ibnrByYear[ri] > 0
                            ? (triangleData!.ibnrByYear[ri] / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── Development factors row ── */}
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2 text-[10px] tracking-wider uppercase font-bold text-muted-foreground border-r border-border">
                      Facteurs
                    </td>
                    {triangleData!.factors.map((f, i) => (
                      <td key={i} className="px-3 py-2 text-center tabular-nums text-[11px] font-semibold text-foreground">
                        {f.toFixed(4)}
                      </td>
                    ))}
                    {/* Extra cell for last dev period (no factor after last col) */}
                    {triangleData!.factors.length < triangleData!.devPeriods.length && (
                      <td className="px-3 py-2 text-center text-muted-foreground text-[11px]">1.000</td>
                    )}
                    {/* Ultimate total */}
                    <td className="px-3 py-2 text-right tabular-nums text-[11px] font-bold text-gold-deep bg-gold/5">
                      {(triangleData!.ultimates.reduce((s, v) => s + v, 0) / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {/* IBNR total */}
                    <td className="px-3 py-2 text-right tabular-nums text-[11px] font-bold text-primary bg-primary/5">
                      {(triangleData!.ibnrByYear.reduce((s, v) => s + v, 0) / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-8 bg-card border border-border rounded-sm" />
                Observé
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-8 bg-blue-50 border border-blue-200 rounded-sm" />
                Projeté (Chain Ladder)
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-8 bg-gold/10 border border-gold/30 rounded-sm" />
                Ultime estimé
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-8 bg-primary/10 border border-primary/20 rounded-sm" />
                IBNR
              </div>
            </div>
          </SectionCard>
        )}

        {/* Comparison */}
        <SectionCard
          title="Comparaison des six méthodes"
          description="Évaluation côte à côte sur le périmètre courant"
          action={<Badge variant="info"><GitCompare className="h-3 w-3" /> Vue analytique</Badge>}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ibnrByMethod} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="method" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} angle={-15} textAnchor="end" height={70} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ibnr" stroke="var(--gold)" strokeWidth={2.5} dot={{ fill: "var(--gold)", r: 5 }} name="IBNR (M DA)" />
              <Line type="monotone" dataKey="ultimate" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ fill: "var(--chart-1)", r: 5 }} name="Ultime (M DA)" />
            </LineChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto -mx-6 mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-6 py-2">Méthode</th>
                  <th className="text-right font-medium px-6 py-2">IBNR</th>
                  <th className="text-right font-medium px-6 py-2">Ultime</th>
                  <th className="text-right font-medium px-6 py-2">Écart vs CL</th>
                  <th className="text-center font-medium px-6 py-2">Retenue</th>
                </tr>
              </thead>
              <tbody>
                {ibnrByMethod.map((m, i) => (
                  <tr key={m.method} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium text-foreground">{m.method}</td>
                    <td className="px-6 py-3 text-right font-mono text-foreground">{fmtMDA(m.ibnr)}</td>
                    <td className="px-6 py-3 text-right font-mono text-foreground">{fmtMDA(m.ultimate)}</td>
                    <td className={`px-6 py-3 text-right font-mono ${m.ecart > 1 ? "text-warning" : m.ecart < -1 ? "text-destructive" : "text-success"}`}>
                      {m.ecart >= 0 ? "+" : ""}{m.ecart.toFixed(1)}%
                    </td>
                    <td className="px-6 py-3 text-center">
                      {i === 0 ? <Badge variant="gold">★ Référence</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
