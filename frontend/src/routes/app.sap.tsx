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
import { toSapSummary } from "@/lib/api/runRows";
import { downloadRunArtifactToXlsx } from "@/lib/download";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import type { Domain, Run } from "@/lib/api/types";
import { getRunParametersForDomain } from "@/lib/runParameters";
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
import { FileWarning, Download, Loader2, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/app/sap")({
  head: () => ({ meta: [{ title: "SAP — Sinistres À Payer · L'Algérienne Vie" }] }),
  component: SapPage,
});

interface SapRow {
  statut: string;
  montant: number;
  produit?: string;
  reseau?: string;
  declaredAmount?: number;
  paidAmount?: number;
  date?: string;
  [key: string]: unknown;
}

interface SapData {
  rows: SapRow[];
  totalCount: number;
  byStatut: { statut: string; count: number; montant: number }[];
  byProduit: { name: string; count: number; montant: number }[];
  byReseau: { name: string; count: number; montant: number }[];
  montantTotal: number;
  montantSAP: number;
}

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " M DA";

const STATUT_COLORS: Record<string, string> = {
  SAP: "var(--chart-1)",
  "EN COURS": "var(--chart-1)",
  REGLE: "var(--success)",
  RÉGLÉ: "var(--success)",
  REJET: "var(--destructive)",
  REJETÉ: "var(--destructive)",
  "CLASSE SANS SUITE": "var(--chart-3)",
  CSS: "var(--chart-3)",
};

function getStatusColor(s: string) {
  return (
    STATUT_COLORS[s] ||
    STATUT_COLORS[Object.keys(STATUT_COLORS).find((k) => s.includes(k)) ?? ""] ||
    "var(--chart-4)"
  );
}

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

function SapPage() {
  const { user } = useAuth();
  const canImportAndRun = user?.role === "ADMIN" || user?.role === "HR";

  const summaryQuery = useDashboardSummary();
  const runId = summaryQuery.data?.domains?.sap?.run_id ?? null;
  const rowsQuery = useRunRows<unknown[]>("sap", runId);
  const uploadMut = useUploadDocument();
  const createRunMut = useCreateRun();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const data: SapData = useMemo(() => {
    const summary = toSapSummary(rowsQuery.data);
    return {
      rows: summary.rows.map((row) => ({
        statut: row.status,
        montant: row.sapAmount,
        produit: row.product,
        reseau: row.network,
        declaredAmount: row.declaredAmount,
        paidAmount: row.paidAmount,
      })),
      totalCount: summary.rows.length,
      byStatut: summary.byStatut,
      byProduit: summary.byProduit,
      byReseau: summary.byReseau,
      montantTotal: summary.montantTotal,
      montantSAP: summary.montantSAP,
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
      await downloadRunArtifactToXlsx("sap", runId, "rows.json");
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

      const uploadRes = await uploadMut.mutateAsync({ domain: "sap", file });
      const parameters = getRunParametersForDomain("sap");
      let run = await createRunMut.mutateAsync({
        domain: "sap",
        payload: {
          document_id: uploadRes.document_id,
          parameters,
        },
      });

      if (run.status === "running") {
        run = await waitForRunCompletion("sap", run.run_id);
      }

      if (run.status !== "succeeded") {
        throw new Error(run.error_message ?? `Calcul ${run.status}`);
      }

      await downloadRunArtifactToXlsx("sap", run.run_id, "rows.json");
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

  const sapCount = data.byStatut.find((s) => s.statut.includes("SAP"))?.count ?? 0;
  const regleCount =
    data.byStatut.find((s) => s.statut.includes("REGL") || s.statut.includes("RÉGL"))?.count ?? 0;
  const rejetCount = data.byStatut.find((s) => s.statut.includes("REJET"))?.count ?? 0;

  return (
    <>
      <Topbar title="Sinistres À Payer" subtitle="SAP · Pipeline d'analyse · Provisionnement" />
      <DomainRunBanner domain="sap" />
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
              <FileWarning className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Sinistres À Payer (SAP)</div>
              <div className="text-xs text-muted-foreground">
                Provision pour sinistres survenus déclarés et en cours de règlement
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
            title="Aucun run SAP disponible"
            description="Importez un document SAP puis lancez le calcul backend"
          >
            <p className="text-sm text-muted-foreground">
              Cette page affiche uniquement les calculs produits par le backend.
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
            description="Impossible de récupérer les résultats backend SAP"
          >
            <p className="text-sm text-danger-foreground">
              {rowsQuery.error instanceof Error ? rowsQuery.error.message : "Erreur inconnue"}
            </p>
          </SectionCard>
        )}

        {isLoading && (
          <SectionCard
            title="Chargement"
            description="Récupération des résultats SAP depuis le backend"
          >
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        )}

        {runId && hasRows && !rowsQuery.isError && !isLoading && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total sinistres"
                value={data.totalCount.toLocaleString("fr-FR")}
                hint="dossiers identifiés"
                icon={<FileWarning className="h-4 w-4" />}
                accent="primary"
                delay={0}
              />
              <KpiCard
                label="SAP · En cours"
                value={
                  sapCount > 0
                    ? sapCount.toLocaleString("fr-FR")
                    : (data.byStatut[0]?.count?.toLocaleString("fr-FR") ?? "—")
                }
                hint={fmtM(data.montantSAP)}
                accent="gold"
                delay={0.05}
              />
              <KpiCard
                label="Réglés"
                value={regleCount.toLocaleString("fr-FR")}
                hint="dossiers clôturés"
                delay={0.1}
              />
              <KpiCard
                label="Rejetés / CSS"
                value={rejetCount.toLocaleString("fr-FR")}
                hint="classés sans suite"
                delay={0.15}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Statuts distribution */}
              <SectionCard title="Répartition par statut" description="Nombre de dossiers par état">
                {data.byStatut.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.byStatut.map((s) => ({ name: s.statut, value: s.count }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                        fontSize={11}
                      >
                        {data.byStatut.map((s, i) => (
                          <Cell key={s.statut} fill={getStatusColor(s.statut)} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR"), "Dossiers"]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    Aucune colonne de statut détectée
                  </div>
                )}
              </SectionCard>

              {/* Montants par statut */}
              <SectionCard title="Montants par statut" description="Provisions en M DA">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.byStatut.map((s) => ({
                      name: s.statut,
                      montant: +(s.montant / 1_000_000).toFixed(2),
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
                      width={80}
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
                        "Montant",
                      ]}
                    />
                    <Bar dataKey="montant" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Par produit */}
              {data.byProduit.some((p) => p.name && p.name !== "undefined") && (
                <SectionCard title="Répartition par produit" description="Nombre de dossiers">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.byProduit.filter(
                        (p) => p.name && p.name !== "undefined" && p.name !== "null",
                      )}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        angle={-20}
                        textAnchor="end"
                        height={50}
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
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--chart-1)"
                        radius={[4, 4, 0, 0]}
                        name="Dossiers"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}

              {/* Par réseau */}
              {data.byReseau.some((r) => r.name && r.name !== "undefined") && (
                <SectionCard title="Répartition par réseau" description="Nombre de dossiers">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.byReseau.filter(
                        (r) => r.name && r.name !== "undefined" && r.name !== "null",
                      )}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="var(--muted-foreground)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        angle={-20}
                        textAnchor="end"
                        height={50}
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
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--chart-3)"
                        radius={[4, 4, 0, 0]}
                        name="Dossiers"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}
            </div>

            {/* Data table */}
            <SectionCard
              title="Aperçu des dossiers"
              description={`${Math.min(data.rows.length, 100)} premiers enregistrements`}
              action={<Badge variant="info">{data.totalCount.toLocaleString("fr-FR")} total</Badge>}
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm min-w-150">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-6 py-2">Statut</th>
                      <th className="text-right font-medium px-6 py-2">Montant (DA)</th>
                      {data.rows[0]?.produit !== undefined && (
                        <th className="text-left font-medium px-6 py-2">Produit</th>
                      )}
                      {data.rows[0]?.reseau !== undefined && (
                        <th className="text-left font-medium px-6 py-2">Réseau</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.slice(0, 100).map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-6 py-2.5">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: getStatusColor(r.statut) + "22",
                              color: getStatusColor(r.statut),
                              border: `1px solid ${getStatusColor(r.statut)}44`,
                            }}
                          >
                            {r.statut}
                          </span>
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground">
                          {r.montant > 0 ? r.montant.toLocaleString("fr-FR") : "—"}
                        </td>
                        {data.rows[0]?.produit !== undefined && (
                          <td className="px-6 py-2.5 text-muted-foreground">{r.produit || "—"}</td>
                        )}
                        {data.rows[0]?.reseau !== undefined && (
                          <td className="px-6 py-2.5 text-muted-foreground">{r.reseau || "—"}</td>
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
