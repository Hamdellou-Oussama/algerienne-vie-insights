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
import { toPbSummary } from "@/lib/api/runRows";
import { downloadRunArtifactToXlsx } from "@/lib/download";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import type { Domain, Run } from "@/lib/api/types";
import { getRunParametersForDomain } from "@/lib/runParameters";
import { Award, Download, Loader2, UploadCloud } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/app/pb")({
  head: () => ({ meta: [{ title: "PB — Participation aux Bénéfices · L'Algérienne Vie" }] }),
  component: PbPage,
});

interface PbData {
  byChannel: { name: string; pb: number; count: number; eligible: number }[];
  eligibility: { name: string; pb: number; count: number }[];
  totalPB: number;
  totalEligible: number;
  tauxMoyen: number;
}

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " M DA";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#6366f1",
  "#ec4899",
];

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

function PbPage() {
  const { user } = useAuth();
  const canImportAndRun = user?.role === "ADMIN" || user?.role === "HR";

  const summaryQuery = useDashboardSummary();
  const runId = summaryQuery.data?.domains?.pb?.run_id ?? null;
  const rowsQuery = useRunRows<unknown[]>("pb", runId);
  const uploadMut = useUploadDocument();
  const createRunMut = useCreateRun();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const data: PbData = useMemo(() => {
    const summary = toPbSummary(rowsQuery.data);
    return {
      byChannel: summary.byChannel,
      eligibility: summary.eligibility,
      totalPB: summary.totalPB,
      totalEligible: summary.totalEligible,
      tauxMoyen: summary.tauxMoyen,
    };
  }, [rowsQuery.data]);

  const isLoading = summaryQuery.isLoading || (Boolean(runId) && rowsQuery.isLoading);
  const hasRows = data.byChannel.length > 0;
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
      await downloadRunArtifactToXlsx("pb", runId, "rows.json");
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

      const uploadRes = await uploadMut.mutateAsync({ domain: "pb", file });
      const parameters = getRunParametersForDomain("pb");
      let run = await createRunMut.mutateAsync({
        domain: "pb",
        payload: {
          document_id: uploadRes.document_id,
          parameters,
        },
      });

      if (run.status === "running") {
        run = await waitForRunCompletion("pb", run.run_id);
      }

      if (run.status !== "succeeded") {
        throw new Error(run.error_message ?? `Calcul ${run.status}`);
      }

      await downloadRunArtifactToXlsx("pb", run.run_id, "rows.json");
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

  return (
    <>
      <Topbar
        title="Participation aux Bénéfices"
        subtitle="PB · Pipeline d'analyse · Redistribution des résultats"
      />
      <DomainRunBanner domain="pb" />
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
            title="Aucun run PB disponible"
            description="Importez un document PB puis lancez le calcul backend"
          >
            <p className="text-sm text-muted-foreground">
              Cette vue utilise uniquement les résultats calculés côté backend.
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
            description="Impossible de récupérer les résultats backend PB"
          >
            <p className="text-sm text-danger-foreground">
              {rowsQuery.error instanceof Error ? rowsQuery.error.message : "Erreur inconnue"}
            </p>
          </SectionCard>
        )}

        {isLoading && (
          <SectionCard
            title="Chargement"
            description="Récupération des résultats PB depuis le backend"
          >
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        )}

        {runId && hasRows && !rowsQuery.isError && !isLoading && (
          <>
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
                label="Canaux"
                value={data.byChannel.length.toString()}
                hint="distribution commerciale"
                delay={0.15}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* PB par canal */}
              <SectionCard title="PB par canal" description="Montants en M DA">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.byChannel.map((p) => ({
                      name: p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name,
                      pb: +(p.pb / 1_000_000).toFixed(3),
                    }))}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      unit=" M"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      width={120}
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
                        "PB",
                      ]}
                    />
                    <Bar dataKey="pb" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Pie chart */}
              <SectionCard
                title="Répartition par canal"
                description="Part relative de chaque canal"
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={data.byChannel.map((p) => ({ name: p.name, value: Math.abs(p.pb) }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      dataKey="value"
                      label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                      fontSize={10}
                    >
                      {data.byChannel.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v: unknown) => [fmtM(Number(v)), "PB"]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </SectionCard>

              {data.eligibility.length > 1 && (
                <SectionCard
                  className="lg:col-span-2"
                  title="PB par éligibilité"
                  description="Comparaison des montants PB"
                >
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={data.eligibility.map((item) => ({
                        type: item.name,
                        pb: +(item.pb / 1_000_000).toFixed(3),
                      }))}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="type"
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
                        formatter={(v: unknown) => [
                          Number(v).toLocaleString("fr-FR") + " M DA",
                          "PB",
                        ]}
                      />
                      <Bar dataKey="pb" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}
            </div>

            {/* Summary table */}
            <SectionCard
              title="Détail par canal"
              action={<Badge variant="gold">{data.byChannel.length} canaux</Badge>}
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-6 py-2">Canal</th>
                      <th className="text-right font-medium px-6 py-2">PB (M DA)</th>
                      <th className="text-right font-medium px-6 py-2">Contrats</th>
                      <th className="text-right font-medium px-6 py-2">Éligibles</th>
                      <th className="text-right font-medium px-6 py-2">PB moyen (DA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byChannel.map((p, i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-6 py-2.5 font-medium text-foreground">{p.name}</td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground font-semibold">
                          {fmtM(p.pb)}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {p.count.toLocaleString("fr-FR")}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {p.eligible.toLocaleString("fr-FR")}
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-muted-foreground">
                          {p.eligible > 0
                            ? Math.round(p.pb / p.eligible).toLocaleString("fr-FR")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="px-6 py-2.5 text-foreground">Total</td>
                      <td className="px-6 py-2.5 text-right font-mono text-gold-deep">
                        {fmtM(data.totalPB)}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-foreground">
                        {data.byChannel
                          .reduce((sum, channel) => sum + channel.count, 0)
                          .toLocaleString("fr-FR")}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-foreground">
                        {data.totalEligible.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-6 py-2.5 text-right font-mono text-foreground">
                        {data.totalEligible > 0
                          ? Math.round(data.totalPB / data.totalEligible).toLocaleString("fr-FR")
                          : "—"}
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
