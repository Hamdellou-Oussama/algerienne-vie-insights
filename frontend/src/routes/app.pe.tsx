import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { DomainRunBanner } from "@/components/DomainRunBanner";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { getRun as getRunEndpoint } from "@/lib/api/endpoints";
import {
  useCreateRun,
  useDashboardSummary,
  useRunRows,
  useUploadDocument,
} from "@/lib/api/queries";
import { toPeSummary } from "@/lib/api/runRows";
import { downloadRunArtifactToXlsx } from "@/lib/download";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import type { Domain, Run } from "@/lib/api/types";
import { getRunParametersForDomain } from "@/lib/runParameters";
import { Shield, Download, Info, Loader2, UploadCloud } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/app/pe")({
  head: () => ({ meta: [{ title: "PE — Provision d'Égalisation · L'Algérienne Vie" }] }),
  component: PePage,
});

interface PeData {
  rows: {
    annee: string;
    pe: number;
    technicalResult: number;
    historicalAverage: number;
    count: number;
  }[];
  totalPE: number;
  dernierExercice: string;
  averagePerYear: number;
}

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " M DA";

async function waitForRunCompletion(domain: Domain, runId: string): Promise<Run> {
  const maxAttempts = 40;
  const delayMs = 1500;

  let current = await getRunEndpoint(domain, runId);
  let attempts = 0;

  while (current.status === "running" && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    current = await getRunEndpoint(domain, runId);
    attempts += 1;
  }

  return current;
}

function PePage() {
  const { user } = useAuth();
  const canImportAndRun = user?.role === "ADMIN" || user?.role === "HR";

  const summaryQuery = useDashboardSummary();
  const runId = summaryQuery.data?.domains?.pe?.run_id ?? null;
  const rowsQuery = useRunRows<unknown[]>("pe", runId);
  const uploadMut = useUploadDocument();
  const createRunMut = useCreateRun();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const data: PeData = useMemo(() => {
    const summary = toPeSummary(rowsQuery.data);
    return {
      rows: summary.rows,
      totalPE: summary.totalPE,
      dernierExercice: summary.dernierExercice,
      averagePerYear: summary.averagePerYear,
    };
  }, [rowsQuery.data]);

  const isLoading = summaryQuery.isLoading || (Boolean(runId) && rowsQuery.isLoading);
  const hasRows = data.rows.length > 0;
  const [isExporting, setIsExporting] = useState(false);
  const [isUploadComputeRunning, setIsUploadComputeRunning] = useState(false);
  const [uploadComputeFeedback, setUploadComputeFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const onExport = async () => {
    if (!runId) return;
    try {
      setIsExporting(true);
      await downloadRunArtifactToXlsx("pe", runId, "rows.json");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      window.alert(`Export impossible: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const onUploadAndCompute = async (file: File) => {
    setUploadComputeFeedback(null);

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setUploadComputeFeedback({
        kind: "err",
        text: "Format non supporte. Veuillez choisir un fichier .xlsx.",
      });
      return;
    }

    if (!canImportAndRun) {
      setUploadComputeFeedback({
        kind: "err",
        text: "Seuls les profils ADMIN/HR peuvent importer et lancer un calcul.",
      });
      return;
    }

    try {
      setIsUploadComputeRunning(true);

      const uploadRes = await uploadMut.mutateAsync({ domain: "pe", file });
      const parameters = getRunParametersForDomain("pe");
      let run = await createRunMut.mutateAsync({
        domain: "pe",
        payload: {
          document_id: uploadRes.document_id,
          parameters,
        },
      });

      if (run.status === "running") {
        run = await waitForRunCompletion("pe", run.run_id);
      }

      if (run.status !== "succeeded") {
        throw new Error(run.error_message ?? `Calcul ${run.status}`);
      }

      await downloadRunArtifactToXlsx("pe", run.run_id, "rows.json");
      setUploadComputeFeedback({
        kind: "ok",
        text: `Nouveau calcul termine et XLSX telecharge (run ${run.run_id.slice(0, 12)}...).`,
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.detail
          : error instanceof Error
            ? error.message
            : "Erreur inconnue";
      setUploadComputeFeedback({ kind: "err", text: message });
    } finally {
      setIsUploadComputeRunning(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  };

  const isUploadComputeBusy =
    isUploadComputeRunning || uploadMut.isPending || createRunMut.isPending;

  const minPE = hasRows ? Math.min(...data.rows.map((row) => row.pe)) : 0;
  const maxPE = hasRows ? Math.max(...data.rows.map((row) => row.pe)) : 0;
  const variation =
    hasRows && data.rows.length >= 2
      ? ((data.rows[data.rows.length - 1].pe - data.rows[0].pe) / Math.abs(data.rows[0].pe || 1)) *
        100
      : 0;

  return (
    <>
      <Topbar
        title="Provision d'Égalisation"
        subtitle="PE · Pipeline d'analyse · Lissage des résultats techniques"
      />
      <DomainRunBanner domain="pe" />
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
          <div className="flex items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onUploadAndCompute(file);
                }
              }}
            />
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={isUploadComputeBusy || !canImportAndRun}
              className="flex items-center gap-2 text-xs bg-gradient-gold text-primary px-4 py-2 rounded-lg hover:shadow-elegant transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              title={
                canImportAndRun
                  ? "Importer un nouveau XLSX, calculer et telecharger un nouveau resultat"
                  : "Reserve aux profils ADMIN/HR"
              }
            >
              {isUploadComputeBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" />
              )}
              {isUploadComputeBusy ? "Import + Calcul..." : "Importer + Calculer XLSX"}
            </button>

            {runId && hasRows && (
              <button
                onClick={onExport}
                disabled={isExporting}
                className="flex items-center gap-2 text-xs bg-gradient-primary text-white px-4 py-2 rounded-lg hover:shadow-elegant transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5" />{" "}
                {isExporting ? "Export XLSX..." : "Export XLSX"}
              </button>
            )}
          </div>
        </div>

        {uploadComputeFeedback && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              uploadComputeFeedback.kind === "ok"
                ? "bg-success/10 border-success/30 text-success"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            {uploadComputeFeedback.text}
          </div>
        )}

        {!runId && (
          <SectionCard
            title="Aucun run PE disponible"
            description="Importez un document PE puis lancez le calcul backend"
          >
            <p className="text-sm text-muted-foreground">
              Cette page n'exécute plus de calcul local: les indicateurs viennent exclusivement du
              backend.
            </p>
            <div className="mt-4">
              <Link to="/app/import" className="text-sm text-primary underline underline-offset-4">
                Aller à l'import des documents
              </Link>
            </div>
          </SectionCard>
        )}

        {runId && rowsQuery.isError && (
          <SectionCard
            title="Erreur de chargement"
            description="Impossible de récupérer les résultats backend PE"
          >
            <p className="text-sm text-danger-foreground">
              {rowsQuery.error instanceof Error ? rowsQuery.error.message : "Erreur inconnue"}
            </p>
          </SectionCard>
        )}

        {isLoading && (
          <SectionCard
            title="Chargement"
            description="Récupération des résultats PE depuis le backend"
          >
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        )}

        {runId && hasRows && !rowsQuery.isError && !isLoading && (
          <>
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
                label="PE moyenne annuelle"
                value={fmtM(data.averagePerYear)}
                hint="moyenne par exercice"
                accent="gold"
                delay={0.05}
              />
              <KpiCard label="PE Minimale" value={fmtM(minPE)} hint="sur la période" delay={0.1} />
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
                      technicalResult: +(r.technicalResult / 1_000_000).toFixed(3),
                    }))}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="annee"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      unit=" M"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: unknown, name: unknown) => [
                        Number(v).toLocaleString("fr-FR") + " M DA",
                        name === "pe" ? "PE" : "Résultat technique",
                      ]}
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
                    <Line
                      type="monotone"
                      dataKey="technicalResult"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Résultat technique"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Key metrics */}
              <SectionCard title="Résumé technique" description="Indicateurs clés">
                <div className="space-y-5">
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">
                      PE au dernier exercice
                    </div>
                    <div className="text-2xl font-semibold text-foreground tabular-nums">
                      {fmtM(data.rows[data.rows.length - 1]?.pe ?? 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Exercice {data.dernierExercice}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">
                      PE Maximum
                    </div>
                    <div className="text-xl font-semibold text-foreground tabular-nums">
                      {fmtM(maxPE)}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 flex items-start gap-2 bg-gold-soft/40 rounded-lg p-3">
                    <Info className="h-4 w-4 text-gold-deep shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground">
                      La PE permet de lisser les résultats techniques en années de forte
                      sinistralité.
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
                  <XAxis
                    dataKey="annee"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    unit=" M"
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
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
                      <th className="text-right font-medium px-6 py-2">
                        Résultat technique (M DA)
                      </th>
                      <th className="text-right font-medium px-6 py-2">
                        Moyenne historique (M DA)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-6 py-2.5 font-medium text-foreground">{r.annee}</td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground font-semibold">
                          {fmtM(r.pe)}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {fmtM(r.technicalResult)}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {fmtM(r.historicalAverage)}
                        </td>
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
