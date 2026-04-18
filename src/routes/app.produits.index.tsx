import { createFileRoute, Link } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/kpi-card";
import { products, fmtMDA, fmtPct, segments } from "@/lib/mockData";
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/app/produits/")({
  head: () => ({ meta: [{ title: "Branches & Produits — L'Algérienne Vie" }] }),
  component: ProductsIndex,
});

function ProductsIndex() {
  const families = Array.from(new Set(products.map((p) => p.family)));

  return (
    <>
      <Topbar
        title="Branches & Produits"
        subtitle="Six gammes de protection · indicateurs et accès aux portefeuilles"
      />
      <div className="p-6 lg:p-8 space-y-6">
        {/* Family filter chips */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">Toutes ({products.length})</Badge>
          {families.map((f) => (
            <Badge key={f} variant="default">{f}</Badge>
          ))}
        </div>

        {/* Product grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {products.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.key}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <Link
                  to="/app/produits/$productKey"
                  params={{ productKey: p.key }}
                  className="block bg-card border border-border rounded-lg p-6 shadow-soft hover:shadow-elegant hover:border-gold/40 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-md bg-gradient-primary flex items-center justify-center shadow-sm">
                      <Icon className="h-5 w-5 text-gold" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-gold-deep transition-colors" />
                  </div>
                  <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-1">{p.family}</div>
                  <h3 className="font-display text-xl text-foreground mb-2">{p.shortName}</h3>
                  <p className="text-sm text-muted-foreground mb-5 line-clamp-2">{p.description}</p>
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                    <Stat label="Contrats" value={p.contracts.toLocaleString("fr-FR")} />
                    <Stat label="Primes" value={fmtMDA(p.premiumsMDA)} />
                    <Stat label="S/P" value={fmtPct(p.lossRatio)} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Réserves: <span className="font-semibold text-foreground">{fmtMDA(p.reservesMDA)}</span></span>
                    <span className={`inline-flex items-center gap-1 font-medium ${p.trend >= 0 ? "text-success" : "text-destructive"}`}>
                      {p.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {p.trend >= 0 ? "+" : ""}{p.trend.toFixed(1)}%
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
                  const ps = products.filter((p) => p.family === f);
                  const c = ps.reduce((s, p) => s + p.contracts, 0);
                  const pr = ps.reduce((s, p) => s + p.premiumsMDA, 0);
                  const cl = ps.reduce((s, p) => s + p.claimsMDA, 0);
                  const re = ps.reduce((s, p) => s + p.reservesMDA, 0);
                  return (
                    <tr key={f} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium text-foreground">{f}</td>
                      <td className="px-6 py-3 text-right text-foreground">{c.toLocaleString("fr-FR")}</td>
                      <td className="px-6 py-3 text-right text-foreground">{fmtMDA(pr)}</td>
                      <td className="px-6 py-3 text-right text-foreground">{fmtMDA(cl)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-foreground">{fmtMDA(re)}</td>
                      <td className="px-6 py-3 text-right text-foreground">{fmtPct(cl / pr)}</td>
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
