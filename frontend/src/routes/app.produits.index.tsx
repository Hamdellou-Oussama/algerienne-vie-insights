import { Link, createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/kpi-card";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useDashboardSummary, useRunRows } from "@/lib/api/queries";
import { toIbnrSummary, toPpnaSummary, toSapSummary } from "@/lib/api/runRows";
import { buildBackendProducts } from "@/lib/backendProducts";

export const Route = createFileRoute("/app/produits/")({
  head: () => ({ meta: [{ title: "Branches & Produits — L'Algérienne Vie" }] }),
  component: ProductsIndex,
});

const fmtMDA = (valueInDa: number) =>
  (valueInDa / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " M DA";

const fmtPct = (value: number) => `${(value * 100).toFixed(1)} %`;

function ProductsIndex() {
  const summaryQuery = useDashboardSummary();
  const runIds = {
    ppna: summaryQuery.data?.domains?.ppna?.run_id ?? null,
    sap: summaryQuery.data?.domains?.sap?.run_id ?? null,
    ibnr: summaryQuery.data?.domains?.ibnr?.run_id ?? null,
  };

  const ppnaRows = useRunRows<unknown[]>("ppna", runIds.ppna);
  const sapRows = useRunRows<unknown[]>("sap", runIds.sap);
  const ibnrRows = useRunRows<unknown>("ibnr", runIds.ibnr);

  const products = useMemo(() => {
    const ppna = toPpnaSummary(ppnaRows.data);
    const sap = toSapSummary(sapRows.data);
    const ibnr = toIbnrSummary(ibnrRows.data);
    return buildBackendProducts(ppna, sap, ibnr);
  }, [ibnrRows.data, ppnaRows.data, sapRows.data]);

  const families = ["Backend aggregé"];

  const totalPremiums = products.reduce((sum, product) => sum + product.premiums, 0);
  const totalSap = products.reduce((sum, product) => sum + product.sap, 0);
  const totalReserve = products.reduce((sum, product) => sum + product.reserveTotal, 0);

  const isLoading =
    summaryQuery.isLoading || ppnaRows.isLoading || sapRows.isLoading || ibnrRows.isLoading;

  return (
    <>
      <Topbar
        title="Branches & Produits"
        subtitle="Vue produits issue des runs backend PPNA/SAP/IBNR"
      />
      <div className="p-6 lg:p-8 space-y-6">
        {!isLoading && products.length === 0 && (
          <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Aucun produit calculé n'est disponible. Lancez les runs PPNA/SAP pour alimenter cette
            page.
          </div>
        )}

        {/* Family filter chips */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">Toutes ({products.length})</Badge>
          {families.map((f) => (
            <Badge key={f} variant="default">
              {f}
            </Badge>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {products.map((product, i) => {
            const lossRatio = product.premiums > 0 ? product.sap / product.premiums : 0;
            return (
              <motion.div
                key={product.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <Link
                  to="/app/produits/$productKey"
                  params={{ productKey: product.slug }}
                  className="block bg-card border border-border rounded-lg p-6 shadow-soft hover:shadow-elegant hover:border-gold/40 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-md bg-gradient-primary flex items-center justify-center shadow-sm">
                      <span className="text-lg font-display text-gold">
                        {product.name.slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-gold-deep transition-colors" />
                  </div>
                  <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
                    Backend aggregé
                  </div>
                  <h3 className="font-display text-xl text-foreground mb-2">{product.name}</h3>
                  <p className="text-sm text-muted-foreground mb-5 line-clamp-2">
                    Données consolidées à partir des lignes calculées PPNA / SAP / IBNR.
                  </p>
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                    <Stat label="Dossiers" value={product.claimCount.toLocaleString("fr-FR")} />
                    <Stat label="Primes" value={fmtMDA(product.premiums)} />
                    <Stat label="S/P" value={fmtPct(lossRatio)} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Réserves:{" "}
                      <span className="font-semibold text-foreground">
                        {fmtMDA(product.reserveTotal)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-foreground">
                      Réseaux: {product.networks.length}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Family summary */}
        <div className="bg-card border border-border rounded-lg shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-display text-lg text-foreground">Synthèse par famille</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left font-medium px-6 py-3">Famille</th>
                  <th className="text-right font-medium px-6 py-3">Contrats</th>
                  <th className="text-right font-medium px-6 py-3">Primes</th>
                  <th className="text-right font-medium px-6 py-3">Sinistres</th>
                  <th className="text-right font-medium px-6 py-3">Réserves</th>
                  <th className="text-right font-medium px-6 py-3">S/P moyen</th>
                </tr>
              </thead>
              <tbody>
                {families.map((f) => {
                  const c = products.reduce((sum, product) => sum + product.claimCount, 0);
                  return (
                    <tr key={f} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium text-foreground">{f}</td>
                      <td className="px-6 py-3 text-right text-foreground">
                        {c.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-6 py-3 text-right text-foreground">
                        {fmtMDA(totalPremiums)}
                      </td>
                      <td className="px-6 py-3 text-right text-foreground">{fmtMDA(totalSap)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-foreground">
                        {fmtMDA(totalReserve)}
                      </td>
                      <td className="px-6 py-3 text-right text-foreground">
                        {fmtPct(totalPremiums > 0 ? totalSap / totalPremiums : 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wide uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}
