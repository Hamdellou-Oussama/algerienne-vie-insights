import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { claims, products, fmtDZD } from "@/lib/mockData";
import type { ClaimStatus } from "@/lib/mockData";
import { FileText, Search, Filter, Download, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/app/sinistres")({
  head: () => ({ meta: [{ title: "Sinistres & Dossiers — L'Algérienne Vie" }] }),
  component: SinistresPage,
});

const STATUS_LABELS: Record<ClaimStatus, { l: string; v: "info" | "warning" | "success" | "danger" | "default" }> = {
  open: { l: "Ouvert", v: "info" },
  in_review: { l: "En instruction", v: "warning" },
  closed: { l: "Clôturé", v: "default" },
  paid: { l: "Réglé", v: "success" },
  litigation: { l: "Contentieux", v: "danger" },
};

function SinistresPage() {
  const [filter, setFilter] = useState<"all" | ClaimStatus>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return claims.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (productFilter !== "all" && c.product !== productFilter) return false;
      if (query && !c.id.toLowerCase().includes(query.toLowerCase()) && !c.insured.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [filter, productFilter, query]);

  const totals = {
    open: claims.filter((c) => c.status === "open" || c.status === "in_review").length,
    paid: claims.filter((c) => c.status === "paid").reduce((s, c) => s + c.paid, 0),
    reserve: claims.reduce((s, c) => s + c.reserve, 0),
    litigation: claims.filter((c) => c.status === "litigation").length,
  };

  return (
    <>
      <Topbar title="Sinistres & Dossiers" subtitle={`${claims.length} dossiers actifs · réserves dossier-par-dossier`} />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Dossiers ouverts" value={totals.open.toString()} hint="Ouverts + en instruction" icon={<FileText className="h-4 w-4" />} accent="primary" />
          <KpiCard label="Réglés (montant)" value={fmtDZD(totals.paid)} icon={<FileText className="h-4 w-4" />} />
          <KpiCard label="Réserves PSAP" value={fmtDZD(totals.reserve)} accent="gold" icon={<FileText className="h-4 w-4" />} />
          <KpiCard label="Contentieux" value={totals.litigation.toString()} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <SectionCard title="Liste des dossiers" description="Filtrez par statut, branche, recherche libre">
          <div className="flex flex-wrap items-center gap-3 mb-5 -mt-2">
            <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-md border border-border min-w-[260px]">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Numéro de dossier, assuré…"
                className="bg-transparent outline-none text-sm flex-1 text-foreground"
              />
            </div>
            <select
              value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
            >
              <option value="all">Tous les statuts</option>
              {(Object.keys(STATUS_LABELS) as ClaimStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s].l}</option>
              ))}
            </select>
            <select
              value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
              className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground"
            >
              <option value="all">Toutes branches</option>
              {products.map((p) => <option key={p.key} value={p.key}>{p.shortName}</option>)}
            </select>
            <button className="ml-auto inline-flex items-center gap-1.5 text-sm bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant">
              <Download className="h-3.5 w-3.5" /> Exporter ({filtered.length})
            </button>
          </div>

          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left font-medium px-6 py-2">Dossier</th>
                  <th className="text-left font-medium px-6 py-2">Date</th>
                  <th className="text-left font-medium px-6 py-2">Assuré</th>
                  <th className="text-left font-medium px-6 py-2">Branche</th>
                  <th className="text-right font-medium px-6 py-2">Déclaré</th>
                  <th className="text-right font-medium px-6 py-2">Payé</th>
                  <th className="text-right font-medium px-6 py-2">Réserve</th>
                  <th className="text-center font-medium px-6 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 25).map((c) => {
                  const product = products.find((p) => p.key === c.product)!;
                  const st = STATUS_LABELS[c.status];
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 font-mono text-xs text-foreground">{c.id}</td>
                      <td className="px-6 py-3 text-muted-foreground text-xs">{c.date}</td>
                      <td className="px-6 py-3 text-foreground">{c.insured}</td>
                      <td className="px-6 py-3 text-muted-foreground text-xs">{product.shortName}</td>
                      <td className="px-6 py-3 text-right font-mono text-foreground">{fmtDZD(c.declared)}</td>
                      <td className="px-6 py-3 text-right font-mono text-foreground">{fmtDZD(c.paid)}</td>
                      <td className="px-6 py-3 text-right font-mono font-semibold text-gold-deep">{fmtDZD(c.reserve)}</td>
                      <td className="px-6 py-3 text-center"><Badge variant={st.v}>{st.l}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 25 && (
            <div className="text-center text-xs text-muted-foreground mt-4">
              Affichage de 25 sur {filtered.length} dossiers
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
