import { Link, createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDashboardSummary, useRunRows } from "@/lib/api/queries";
import { toIbnrSummary } from "@/lib/api/runRows";
import { downloadRunArtifact } from "@/lib/api/endpoints";
import { downloadRunArtifactToXlsx } from "@/lib/download";
import { Download, ToggleLeft, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/app/triangles")({
  head: () => ({ meta: [{ title: "Triangulation — L'Algérienne Vie" }] }),
  component: TrianglesPage,
});

interface TriangleCellPayload {
  occurrence_year: number;
  development_year: number;
  incremental_amount: number;
  cumulative_amount: number;
}

interface DevelopmentFactorPayload {
  development_year: number;
  factor: number;
}

interface IbnrResultArtifact {
  triangle_cells?: TriangleCellPayload[];
  development_factors?: DevelopmentFactorPayload[];
}

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " M DA";

function TrianglesPage() {
  const summaryQuery = useDashboardSummary();
  const runId = summaryQuery.data?.domains?.ibnr?.run_id ?? null;
  const rowsQuery = useRunRows<unknown>("ibnr", runId);

  const artifactQuery = useQuery({
    queryKey: ["ibnr", "result-artifact", runId],
    enabled: Boolean(runId),
    queryFn: async () => {
      const blob = await downloadRunArtifact("ibnr", runId as string, "result.json");
      const text = await blob.text();
      return JSON.parse(text) as IbnrResultArtifact;
    },
  });

  const ibnrSummary = useMemo(() => toIbnrSummary(rowsQuery.data), [rowsQuery.data]);
  const [cumulative, setCumulative] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const triangleCells = useMemo(
    () => artifactQuery.data?.triangle_cells ?? [],
    [artifactQuery.data?.triangle_cells],
  );

  const occurrenceYears = useMemo(
    () =>
      Array.from(new Set(triangleCells.map((cell) => cell.occurrence_year))).sort((a, b) => a - b),
    [triangleCells],
  );

  const maxDevelopmentYear = useMemo(
    () => triangleCells.reduce((max, cell) => Math.max(max, cell.development_year), 0),
    [triangleCells],
  );

  const matrix = useMemo(() => {
    const cellMap = new Map<string, TriangleCellPayload>();
    for (const cell of triangleCells) {
      cellMap.set(`${cell.occurrence_year}-${cell.development_year}`, cell);
    }
    return occurrenceYears.map((year) => {
      const values: Array<number | null> = [];
      for (let dev = 0; dev <= maxDevelopmentYear; dev += 1) {
        const cell = cellMap.get(`${year}-${dev}`);
        if (!cell) {
          values.push(null);
          continue;
        }
        values.push(cumulative ? cell.cumulative_amount : cell.incremental_amount);
      }
      return values;
    });
  }, [cumulative, maxDevelopmentYear, occurrenceYears, triangleCells]);

  const flat = matrix.flat().filter((v): v is number => typeof v === "number");
  const min = flat.length > 0 ? Math.min(...flat) : 0;
  const max = flat.length > 0 ? Math.max(...flat) : 0;

  const colorFor = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return `oklch(${0.96 - t * 0.18} ${0.04 + t * 0.08} 75)`;
  };

  const factorMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const factor of artifactQuery.data?.development_factors ?? []) {
      map.set(factor.development_year, factor.factor);
    }
    return map;
  }, [artifactQuery.data?.development_factors]);

  const ultimates = ibnrSummary.mergedRows.map((row) => ({
    year: row.occurrenceYear,
    known: row.diagonal,
    ultimate: row.ultimate,
    ibnr: row.reserve,
  }));

  const isLoading =
    summaryQuery.isLoading || (Boolean(runId) && (rowsQuery.isLoading || artifactQuery.isLoading));
  const hasData = ultimates.length > 0;

  const onExport = async () => {
    if (!runId) return;
    try {
      setIsExporting(true);
      await downloadRunArtifactToXlsx("ibnr", runId, "result.json");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      window.alert(`Export impossible: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Topbar
        title="Triangulation des sinistres"
        subtitle="Développement cumulé · base Chain Ladder"
      />
      <div className="p-6 lg:p-8 space-y-6">
        {!runId && (
          <SectionCard
            title="Aucun run IBNR disponible"
            description="Importez un document IBNR puis lancez un calcul backend"
          >
            <p className="text-sm text-muted-foreground">
              Cette page n'utilise plus de triangle local: seules les données backend sont
              affichées.
            </p>
            <Link
              to="/app/import"
              className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
            >
              Aller à l'import des documents
            </Link>
          </SectionCard>
        )}

        {runId && (rowsQuery.isError || artifactQuery.isError) && (
          <SectionCard
            title="Erreur de chargement"
            description="Impossible de récupérer les résultats IBNR backend"
          >
            <p className="text-sm text-danger-foreground">
              {rowsQuery.error instanceof Error
                ? rowsQuery.error.message
                : artifactQuery.error instanceof Error
                  ? artifactQuery.error.message
                  : "Erreur inconnue"}
            </p>
          </SectionCard>
        )}

        {isLoading && (
          <SectionCard
            title="Chargement"
            description="Récupération du triangle depuis les artefacts backend"
          >
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        )}

        {runId && hasData && !rowsQuery.isError && !artifactQuery.isError && !isLoading && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="info">Branche : Toutes</Badge>
              <Badge variant="default">Devise : DZD (M)</Badge>
              <Badge variant="default">
                Année inventaire : {String(summaryQuery.data?.domains?.ibnr?.finished_at ?? "run")}
              </Badge>
              <button
                onClick={() => setCumulative(!cumulative)}
                className="ml-auto inline-flex items-center gap-2 text-sm bg-card border border-border px-3 py-1.5 rounded-md hover:border-gold/40 transition-colors"
              >
                {cumulative ? (
                  <ToggleRight className="h-4 w-4 text-gold" />
                ) : (
                  <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                )}
                {cumulative ? "Cumulé" : "Incrémental"}
              </button>
              <button
                onClick={onExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 text-sm bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" /> {isExporting ? "Export XLSX..." : "Export XLSX"}
              </button>
            </div>

            <SectionCard
              title="Triangle de développement"
              description={`${cumulative ? "Cumulé" : "Incrémental"} · ${occurrenceYears.length} années × ${maxDevelopmentYear + 1} développements`}
            >
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="text-xs border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-muted-foreground tracking-wider uppercase text-[10px] font-medium">
                        Origine
                      </th>
                      {Array.from({ length: maxDevelopmentYear + 1 }).map((_, j) => (
                        <th
                          key={j}
                          className="px-3 py-2 text-center text-muted-foreground tracking-wider uppercase text-[10px] font-medium min-w-[80px]"
                        >
                          Dév {j}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, i) => (
                      <tr key={occurrenceYears[i]}>
                        <td className="px-3 py-2 font-medium text-foreground">
                          {occurrenceYears[i]}
                        </td>
                        {row.map((v, j) => (
                          <td
                            key={j}
                            className="px-3 py-2 text-center rounded-md font-mono"
                            style={
                              v == null
                                ? {
                                    background: "var(--muted)",
                                    color: "var(--muted-foreground)",
                                    fontStyle: "italic",
                                  }
                                : { background: colorFor(v), color: "var(--foreground)" }
                            }
                          >
                            {v == null ? "—" : v.toLocaleString("fr-FR")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td className="px-3 pt-3 font-medium text-gold-deep">Facteurs</td>
                      {Array.from({ length: maxDevelopmentYear + 1 }).map((_, j) => {
                        const f = j === 0 ? null : (factorMap.get(j) ?? null);
                        return (
                          <td key={j} className="px-3 pt-3 text-center font-mono text-gold-deep">
                            {f == null ? "—" : f.toFixed(3)}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Projection des ultimes"
              description="Charge ultime estimée par année d'origine (méthode Chain Ladder)"
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                      <th className="text-left font-medium px-6 py-2">Année</th>
                      <th className="text-right font-medium px-6 py-2">Cumulé observé</th>
                      <th className="text-right font-medium px-6 py-2">Ultime projeté</th>
                      <th className="text-right font-medium px-6 py-2">IBNR</th>
                      <th className="text-right font-medium px-6 py-2">% IBNR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimates.map((u) => (
                      <tr
                        key={u.year}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-6 py-3 font-medium text-foreground">{u.year}</td>
                        <td className="px-6 py-3 text-right font-mono text-foreground">
                          {fmtM(u.known)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-semibold text-foreground">
                          {fmtM(u.ultimate)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gold-deep font-semibold">
                          {fmtM(u.ibnr)}
                        </td>
                        <td className="px-6 py-3 text-right text-muted-foreground">
                          {u.ultimate === 0 ? "—" : `${((u.ibnr / u.ultimate) * 100).toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5 border-t-2 border-border">
                      <td className="px-6 py-3 font-display text-base text-foreground">Total</td>
                      <td className="px-6 py-3 text-right font-mono text-foreground">
                        {fmtM(ultimates.reduce((s, u) => s + u.known, 0))}
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-bold text-foreground">
                        {fmtM(ultimates.reduce((s, u) => s + u.ultimate, 0))}
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-bold text-gold-deep">
                        {fmtM(ultimates.reduce((s, u) => s + u.ibnr, 0))}
                      </td>
                      <td className="px-6 py-3"></td>
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
