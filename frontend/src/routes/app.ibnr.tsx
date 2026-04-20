import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { DomainRunBanner } from "@/components/DomainRunBanner";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { downloadRunArtifact, getRun as getRunEndpoint } from "@/lib/api/endpoints";
import {
  useCreateRun,
  useDashboardSummary,
  useRun,
  useRunRows,
  useUploadDocument,
} from "@/lib/api/queries";
import { toIbnrMethodComparison, toIbnrSummary } from "@/lib/api/runRows";
import { downloadRunArtifactToXlsx } from "@/lib/download";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import type { Domain, Run } from "@/lib/api/types";
import { getRunParametersForDomain, getStoredIbnrMethod, setStoredIbnrMethod } from "@/lib/runParameters";
import { Calculator, Download, Info, Loader2, TrendingUp, UploadCloud } from "lucide-react";
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
  Legend,
} from "recharts";

export const Route = createFileRoute("/app/ibnr")({
  head: () => ({ meta: [{ title: "Atelier IBNR — L'Algérienne Vie" }] }),
  component: IbnrWorkspace,
});

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " M DA";

const fmtSignedM = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} M DA`;

const fmtPct = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const METHOD_LABELS: Record<string, string> = {
  chain_ladder: "Chain Ladder",
  mack_chain_ladder: "Mack Chain Ladder",
  bornhuetter_ferguson: "Bornhuetter-Ferguson",
  benktander_k2: "Benktander k=2",
  bootstrap_odp: "Bootstrap ODP",
};

const METHOD_METRIC_LABEL: Record<string, string> = {
  chain_ladder: "—",
  mack_chain_ladder: "SE",
  bornhuetter_ferguson: "—",
  benktander_k2: "—",
  bootstrap_odp: "P95",
};

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

function IbnrWorkspace() {
  const { user } = useAuth();
  const canImportAndRun = user?.role === "ADMIN" || user?.role === "HR";

  const summaryQuery = useDashboardSummary();
  const runId = summaryQuery.data?.domains?.ibnr?.run_id ?? null;
  const runQuery = useRun("ibnr", runId);
  const rowsQuery = useRunRows<unknown>("ibnr", runId);
  const uploadMut = useUploadDocument();
  const createRunMut = useCreateRun();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const runResultQuery = useQuery({
    queryKey: ["ibnr", "run-result", runId ?? "none"],
    enabled: Boolean(runId),
    retry: false,
    queryFn: async () => {
      const artifact = await downloadRunArtifact("ibnr", runId as string, "result.json");
      try {
        return JSON.parse(await artifact.text()) as unknown;
      } catch {
        return null;
      }
    },
  });

  const summary = useMemo(() => toIbnrSummary(rowsQuery.data), [rowsQuery.data]);
  const methodComparison = useMemo(
    () => toIbnrMethodComparison(runResultQuery.data),
    [runResultQuery.data],
  );
  const [selectedMethod, setSelectedMethod] = useState<string>(() => getStoredIbnrMethod());

  useEffect(() => {
    setStoredIbnrMethod(selectedMethod);
  }, [selectedMethod]);

  useEffect(() => {
    if (methodComparison.rows.length === 0) {
      return;
    }
    const availableMethods = new Set(methodComparison.rows.map((row) => row.method));
    if (availableMethods.has(selectedMethod)) {
      return;
    }
    if (availableMethods.has("chain_ladder")) {
      setSelectedMethod("chain_ladder");
      return;
    }
    setSelectedMethod(methodComparison.rows[0].method);
  }, [methodComparison.rows, selectedMethod]);

  const selectedMethodRow = useMemo(() => {
    return (
      methodComparison.rows.find((row) => row.method === selectedMethod) ??
      methodComparison.rows.find((row) => row.method === "chain_ladder") ??
      null
    );
  }, [methodComparison.rows, selectedMethod]);

  const selectedMethodTotalIbnr = selectedMethodRow?.total_ibnr ?? summary.totalIbnr;
  const activeMethodLabel =
    METHOD_LABELS[selectedMethodRow?.method ?? "chain_ladder"] ?? selectedMethod;

  const isLoading =
    summaryQuery.isLoading ||
    (Boolean(runId) && (rowsQuery.isLoading || runQuery.isLoading || runResultQuery.isLoading));
  const hasRows = summary.mergedRows.length > 0;
  const hasMethodComparison = methodComparison.rows.length > 0;
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
      await downloadRunArtifactToXlsx("ibnr", runId, "result.json");
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

      const uploadRes = await uploadMut.mutateAsync({ domain: "ibnr", file });
      const baseParameters = getRunParametersForDomain("ibnr");
      let run = await createRunMut.mutateAsync({
        domain: "ibnr",
        payload: {
          document_id: uploadRes.document_id,
          parameters: { ...baseParameters, selected_method: selectedMethod },
        },
      });

      if (run.status === "running") {
        run = await waitForRunCompletion("ibnr", run.run_id);
      }

      if (run.status !== "succeeded") {
        throw new Error(run.error_message ?? `Calcul ${run.status}`);
      }

      await downloadRunArtifactToXlsx("ibnr", run.run_id, "result.json");
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

  const perYearData = summary.mergedRows.map((row) => ({
    year: String(row.occurrenceYear),
    reserve: +(row.reserve / 1_000_000).toFixed(3),
    ultimate: +(row.ultimate / 1_000_000).toFixed(3),
    diagonal: +(row.diagonal / 1_000_000).toFixed(3),
  }));

  const segmentData = summary.segments.map((segment) => ({
    segment: segment.name,
    ibnr: +(segment.totalIbnr / 1_000_000).toFixed(3),
    ultimate: +(segment.totalUltimate / 1_000_000).toFixed(3),
    years: segment.rows.length,
  }));

  return (
    <>
      <Topbar
        title="Atelier IBNR"
        subtitle="Calcul backend Chain Ladder · visualisation frontend"
      />
      <DomainRunBanner domain="ibnr" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
              <TrendingUp className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Réservation IBNR</div>
              <div className="text-xs text-muted-foreground">
                Analyse basée uniquement sur les sorties calculées par le backend
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
                <Download className="h-3.5 w-3.5" />
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
            title="Aucun run IBNR disponible"
            description="Importez un document IBNR puis lancez le calcul backend"
          >
            <p className="text-sm text-muted-foreground">
              Cette page n'exécute aucun calcul local et affiche uniquement les réserves produites
              côté backend.
            </p>
            <div className="mt-4">
              <Link to="/app/import" className="text-sm text-primary underline underline-offset-4">
                Aller à l'import des documents
              </Link>
            </div>
          </SectionCard>
        )}

        {runId && (rowsQuery.isError || runQuery.isError) && (
          <SectionCard
            title="Erreur de chargement"
            description="Impossible de récupérer les résultats backend IBNR"
          >
            <p className="text-sm text-danger-foreground">
              {rowsQuery.error instanceof Error
                ? rowsQuery.error.message
                : runQuery.error instanceof Error
                  ? runQuery.error.message
                  : "Erreur inconnue"}
            </p>
          </SectionCard>
        )}

        {isLoading && (
          <SectionCard
            title="Chargement"
            description="Récupération des sorties IBNR depuis le backend"
          >
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        )}

        {runId && hasRows && !isLoading && !rowsQuery.isError && !runQuery.isError && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="IBNR total"
                value={fmtM(selectedMethodTotalIbnr)}
                hint={hasMethodComparison ? "méthode sélectionnée" : "réserve calculée"}
                icon={<Calculator className="h-4 w-4" />}
                accent="gold"
              />
              <KpiCard
                label="Charge ultime"
                value={fmtM(summary.totalUltimate)}
                hint="toutes années"
                icon={<Calculator className="h-4 w-4" />}
              />
              <KpiCard
                label="Années d'origine"
                value={summary.mergedRows.length.toString()}
                hint="périmètre analysé"
              />
              <KpiCard
                label="Segments"
                value={summary.segments.length.toString()}
                hint={summary.segmented ? "calcul segmenté" : "calcul global"}
                accent="primary"
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <SectionCard
                className="lg:col-span-2"
                title="IBNR par année d'origine"
                description="Réserves en M DA"
              >
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={perYearData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="year"
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
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: unknown) => [
                        Number(v).toLocaleString("fr-FR") + " M DA",
                        "IBNR",
                      ]}
                    />
                    <Bar dataKey="reserve" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="Sortie technique" description="Synthèse du run backend">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                      IBNR
                    </div>
                    <div className="font-display text-3xl text-foreground">
                      {fmtM(summary.totalIbnr)}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                      Ultime estimé
                    </div>
                    <div className="font-display text-2xl text-foreground">
                      {fmtM(summary.totalUltimate)}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 flex items-start gap-2 bg-gold-soft/40 rounded-md p-3">
                    <Info className="h-4 w-4 text-gold-deep shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground w-full space-y-2">
                      <div>
                        Méthode active: <strong>{activeMethodLabel}</strong>
                      </div>
                      {hasMethodComparison && (
                        <>
                          <label
                            htmlFor="ibnr-method"
                            className="block text-[11px] text-muted-foreground"
                          >
                            Méthode de visualisation
                          </label>
                          <select
                            id="ibnr-method"
                            value={selectedMethod}
                            onChange={(event) => setSelectedMethod(event.target.value)}
                            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                          >
                            {methodComparison.rows.map((row) => (
                              <option key={row.method} value={row.method}>
                                {METHOD_LABELS[row.method] ?? row.method}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Diagonal vs Ultime"
              description="Comparaison cumulative par année d'origine"
            >
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={perYearData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="year"
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
                      name === "ultimate" ? "Ultime" : "Diagonal",
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="ultimate"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--chart-1)", r: 4 }}
                    name="Ultime"
                  />
                  <Line
                    type="monotone"
                    dataKey="diagonal"
                    stroke="var(--chart-3)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--chart-3)", r: 4 }}
                    name="Diagonal"
                  />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>

            {hasMethodComparison && (
              <SectionCard
                title="Comparaison des méthodes IBNR"
                description="Valeurs issues du payload method_comparison calculé côté backend"
              >
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                        <th className="text-left font-medium px-6 py-2">Méthode</th>
                        <th className="text-right font-medium px-6 py-2">IBNR (M DA)</th>
                        <th className="text-right font-medium px-6 py-2">Écart vs CL (M DA)</th>
                        <th className="text-right font-medium px-6 py-2">Écart % vs CL</th>
                        <th className="text-right font-medium px-6 py-2">SE/P95 (M DA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {methodComparison.rows.map((row) => {
                        const selected = row.method === selectedMethod;
                        return (
                          <tr
                            key={row.method}
                            className={`border-b border-border last:border-0 ${selected ? "bg-gold-soft/30" : "hover:bg-muted/30"}`}
                          >
                            <td className="px-6 py-2.5 text-foreground">
                              <div className="flex items-center gap-2">
                                {METHOD_LABELS[row.method] ?? row.method}
                                {selected && <Badge variant="gold">actif</Badge>}
                              </div>
                            </td>
                            <td className="px-6 py-2.5 text-right font-mono text-foreground">
                              {fmtM(row.total_ibnr)}
                            </td>
                            <td className="px-6 py-2.5 text-right font-mono text-foreground">
                              {fmtSignedM(row.difference_vs_chain_ladder)}
                            </td>
                            <td className="px-6 py-2.5 text-right font-mono text-foreground">
                              {fmtPct(row.pct_difference_vs_chain_ladder)}
                            </td>
                            <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                              {row.se_or_p95 == null
                                ? "—"
                                : `${METHOD_METRIC_LABEL[row.method] === "—" ? "" : `${METHOD_METRIC_LABEL[row.method]}: `}${fmtM(row.se_or_p95)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {summary.segmented && segmentData.length > 0 && (
              <SectionCard
                title="Comparaison par segment"
                description="IBNR et ultime backend par segment"
                action={<Badge variant="info">{segmentData.length} segments</Badge>}
              >
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={segmentData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="segment"
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
                        name === "ibnr" ? "IBNR" : "Ultime",
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ibnr" fill="var(--gold)" radius={[4, 4, 0, 0]} name="IBNR" />
                    <Bar
                      dataKey="ultimate"
                      fill="var(--chart-1)"
                      radius={[4, 4, 0, 0]}
                      name="Ultime"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            )}

            <SectionCard
              title="Tableau par année d'origine"
              description="Détails du run IBNR backend"
              action={<Badge variant="gold">{summary.mergedRows.length} lignes</Badge>}
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-6 py-2">Année</th>
                      <th className="text-right font-medium px-6 py-2">Diagonal (M DA)</th>
                      <th className="text-right font-medium px-6 py-2">Ultime (M DA)</th>
                      <th className="text-right font-medium px-6 py-2">IBNR (M DA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.mergedRows.map((row) => (
                      <tr
                        key={row.occurrenceYear}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-6 py-2.5 font-medium text-foreground">
                          {row.occurrenceYear}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {fmtM(row.diagonal)}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground">
                          {fmtM(row.ultimate)}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground font-semibold">
                          {fmtM(row.reserve)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="px-6 py-2.5 text-foreground">Total</td>
                      <td className="px-6 py-2.5 text-right font-mono text-foreground">
                        {fmtM(summary.mergedRows.reduce((sum, row) => sum + row.diagonal, 0))}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-foreground">
                        {fmtM(summary.totalUltimate)}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-gold-deep">
                        {fmtM(summary.totalIbnr)}
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
