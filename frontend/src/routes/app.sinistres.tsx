import { Link, createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { FileText, Search, Download, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboardSummary, useRunRows } from "@/lib/api/queries";
import { toSapSummary } from "@/lib/api/runRows";
import { downloadRecordsToXlsx } from "@/lib/download";

export const Route = createFileRoute("/app/sinistres")({
  head: () => ({ meta: [{ title: "Sinistres & Dossiers — L'Algérienne Vie" }] }),
  component: SinistresPage,
});

type StatusFilter = "all" | "SAP" | "REGLE" | "REJET" | "AUTRE";

const STATUS_LABELS: Record<
  StatusFilter,
  { label: string; badge: "info" | "warning" | "success" | "danger" | "default" }
> = {
  all: { label: "Tous les statuts", badge: "default" },
  SAP: { label: "SAP", badge: "info" },
  REGLE: { label: "Réglé", badge: "success" },
  REJET: { label: "Rejeté", badge: "danger" },
  AUTRE: { label: "Autre", badge: "warning" },
};

const fmtDZD = (v: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} DA`;

function normalizeStatus(raw: string): Exclude<StatusFilter, "all"> {
  const status = raw.trim().toUpperCase();
  if (status.includes("SAP")) return "SAP";
  if (status.includes("REGL")) return "REGLE";
  if (status.includes("REJET")) return "REJET";
  return "AUTRE";
}

function SinistresPage() {
  const summaryQuery = useDashboardSummary();
  const runId = summaryQuery.data?.domains?.sap?.run_id ?? null;
  const rowsQuery = useRunRows<unknown[]>("sap", runId);

  const parsed = useMemo(() => toSapSummary(rowsQuery.data), [rowsQuery.data]);
  const rows = parsed.rows;

  const [filter, setFilter] = useState<StatusFilter>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const products = useMemo(() => Array.from(new Set(rows.map((r) => r.product))).sort(), [rows]);
  const networks = useMemo(() => Array.from(new Set(rows.map((r) => r.network))).sort(), [rows]);

  const filtered = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return rows.filter((row) => {
      const normalizedStatus = normalizeStatus(row.status);
      if (filter !== "all" && normalizedStatus !== filter) return false;
      if (productFilter !== "all" && row.product !== productFilter) return false;
      if (networkFilter !== "all" && row.network !== networkFilter) return false;
      if (
        lowered &&
        !row.claimId.toLowerCase().includes(lowered) &&
        !row.product.toLowerCase().includes(lowered) &&
        !row.network.toLowerCase().includes(lowered)
      ) {
        return false;
      }
      return true;
    });
  }, [filter, networkFilter, productFilter, query, rows]);

  const totals = {
    open: rows.filter((row) => {
      const status = normalizeStatus(row.status);
      return status === "SAP" || status === "AUTRE";
    }).length,
    paid: rows.reduce((sum, row) => sum + row.paidAmount, 0),
    reserve: rows.reduce((sum, row) => sum + row.sapAmount, 0),
    rejected: rows.filter((row) => normalizeStatus(row.status) === "REJET").length,
  };

  const hasRows = rows.length > 0;
  const isLoading = summaryQuery.isLoading || (Boolean(runId) && rowsQuery.isLoading);

  const onExportFiltered = () => {
    const exportedRows = filtered.map((row) => ({
      claim_id: row.claimId,
      declaration_date: row.declarationDate,
      product: row.product,
      network: row.network,
      status: row.status,
      declared_amount: row.declaredAmount,
      paid_amount: row.paidAmount,
      sap_amount: row.sapAmount,
    }));

    const today = new Date().toISOString().slice(0, 10);
    downloadRecordsToXlsx(exportedRows, `sap-sinistres-${today}.xlsx`, "sinistres");
  };

  return (
    <>
      <Topbar
        title="Sinistres & Dossiers"
        subtitle={`${rows.length.toLocaleString("fr-FR")} dossiers backend · source SAP run`}
      />
      <div className="p-6 lg:p-8 space-y-6">
        {!runId && (
          <SectionCard
            title="Aucun run SAP disponible"
            description="Importez un document SAP puis lancez un calcul"
          >
            <p className="text-sm text-muted-foreground">
              Cette page affiche uniquement les dossiers issus des résultats backend (aucune donnée
              mock).
            </p>
            <Link
              to="/app/import"
              className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
            >
              Aller à l'import des documents
            </Link>
          </SectionCard>
        )}

        {runId && rowsQuery.isError && (
          <SectionCard
            title="Erreur de chargement"
            description="Impossible de récupérer les lignes SAP backend"
          >
            <p className="text-sm text-danger-foreground">
              {rowsQuery.error instanceof Error ? rowsQuery.error.message : "Erreur inconnue"}
            </p>
          </SectionCard>
        )}

        {isLoading && (
          <SectionCard
            title="Chargement"
            description="Récupération des dossiers sinistres depuis le backend"
          >
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        )}

        {runId && hasRows && !rowsQuery.isError && !isLoading && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Dossiers ouverts"
                value={totals.open.toString()}
                hint="Ouverts + en instruction"
                icon={<FileText className="h-4 w-4" />}
                accent="primary"
              />
              <KpiCard
                label="Réglés (montant)"
                value={fmtDZD(totals.paid)}
                icon={<FileText className="h-4 w-4" />}
              />
              <KpiCard
                label="Réserves PSAP"
                value={fmtDZD(totals.reserve)}
                accent="gold"
                icon={<FileText className="h-4 w-4" />}
              />
              <KpiCard
                label="Rejetés"
                value={totals.rejected.toString()}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
            </div>

            <SectionCard
              title="Liste des dossiers"
              description="Filtrez par statut, branche, recherche libre"
            >
              <div className="flex flex-wrap items-center gap-3 mb-5 -mt-2">
                <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md border border-border min-w-[260px]">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Numéro de dossier, assuré…"
                    className="bg-transparent outline-none text-sm flex-1 text-foreground"
                  />
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
                >
                  {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status].label}
                    </option>
                  ))}
                </select>
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="all">Toutes branches</option>
                  {products.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
                <select
                  value={networkFilter}
                  onChange={(e) => setNetworkFilter(e.target.value)}
                  className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
                >
                  <option value="all">Tous réseaux</option>
                  {networks.map((network) => (
                    <option key={network} value={network}>
                      {network}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onExportFiltered}
                  className="ml-auto inline-flex items-center gap-1.5 text-sm bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant"
                >
                  <Download className="h-3.5 w-3.5" /> Exporter XLSX ({filtered.length})
                </button>
              </div>

              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                      <th className="text-left font-medium px-6 py-2">Dossier</th>
                      <th className="text-left font-medium px-6 py-2">Date</th>
                      <th className="text-left font-medium px-6 py-2">Branche</th>
                      <th className="text-left font-medium px-6 py-2">Réseau</th>
                      <th className="text-right font-medium px-6 py-2">Déclaré</th>
                      <th className="text-right font-medium px-6 py-2">Payé</th>
                      <th className="text-right font-medium px-6 py-2">Réserve</th>
                      <th className="text-center font-medium px-6 py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 50).map((row) => {
                      const normalizedStatus = normalizeStatus(row.status);
                      const st = STATUS_LABELS[normalizedStatus];
                      return (
                        <tr
                          key={`${row.claimId}-${row.sourceRow}`}
                          className="border-b border-border last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-6 py-3 font-mono text-xs text-foreground">
                            {row.claimId}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground text-xs">
                            {row.declarationDate}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground text-xs">{row.product}</td>
                          <td className="px-6 py-3 text-muted-foreground text-xs">{row.network}</td>
                          <td className="px-6 py-3 text-right font-mono text-foreground">
                            {fmtDZD(row.declaredAmount)}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-foreground">
                            {fmtDZD(row.paidAmount)}
                          </td>
                          <td className="px-6 py-3 text-right font-mono font-semibold text-gold-deep">
                            {fmtDZD(row.sapAmount)}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <Badge variant={st.badge}>{st.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > 50 && (
                <div className="text-center text-xs text-muted-foreground mt-4">
                  Affichage de 50 sur {filtered.length} dossiers
                </div>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </>
  );
}
