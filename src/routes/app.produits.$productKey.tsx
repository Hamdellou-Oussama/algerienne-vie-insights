import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { products, fmtMDA, fmtPct, premiumsClaimsTrend, segments } from "@/lib/mockData";
import type { ProductKey } from "@/lib/mockData";
import { ChevronLeft, FileText, Layers, ShieldAlert, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";

export const Route = createFileRoute("/app/produits/$productKey")({
  head: ({ params }) => {
    const p = products.find((x) => x.key === params.productKey);
    return { meta: [{ title: `${p?.shortName ?? "Produit"} — L'Algérienne Vie` }] };
  },
  component: ProductDetail,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <h1 className="font-display text-2xl mb-2">Produit introuvable</h1>
      <Link to="/app/produits" className="text-primary">Retour aux produits</Link>
    </div>
  ),
});

function ProductDetail() {
  const { productKey } = Route.useParams() as { productKey: ProductKey };
  const product = products.find((p) => p.key === productKey);
  if (!product) throw notFound();
  const Icon = product.icon;

  // Synthetic per-product trend
  const trend = premiumsClaimsTrend.map((d, i) => ({
    month: d.month,
    primes: Math.round(d.primes * (product.premiumsMDA / 5500) * (1 + Math.sin(i) * 0.05)),
    sinistres: Math.round(d.sinistres * (product.claimsMDA / 3000) * (1 + Math.cos(i) * 0.06)),
  }));

  const ratio = [{ name: "S/P", value: product.lossRatio * 100, fill: product.lossRatio < 0.6 ? "var(--success)" : product.lossRatio < 0.85 ? "var(--gold)" : "var(--destructive)" }];

  // Segment breakdown (synthetic)
  const segBreakdown = segments.map((s, i) => ({
    name: s.name,
    contracts: Math.round(product.contracts * (i === 0 ? 0.65 : i === 1 ? 0.22 : 0.13)),
  }));

  return (
    <>
      <Topbar title={product.name} subtitle={`Branche ${product.family} · vue produit dédiée`} />
      <div className="p-6 lg:p-8 space-y-6">
        <Link to="/app/produits" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Toutes les branches
        </Link>

        <div className="bg-gradient-primary text-white rounded-lg p-6 lg:p-8 flex items-start gap-5 shadow-elegant">
          <div className="h-16 w-16 rounded-md bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
            <Icon className="h-7 w-7 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] tracking-[0.22em] uppercase text-gold mb-1">{product.family}</div>
            <h2 className="font-display text-2xl mb-1">{product.shortName}</h2>
            <p className="text-white/70 text-sm max-w-2xl">{product.description}</p>
          </div>
          <Badge variant="gold">Actif</Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Contrats actifs" value={product.contracts.toLocaleString("fr-FR")} hint={product.family} icon={<FileText className="h-4 w-4" />} accent="primary" />
          <KpiCard label="Primes 2024" value={fmtMDA(product.premiumsMDA)} trend={product.trend} icon={<Layers className="h-4 w-4" />} />
          <KpiCard label="Sinistres" value={fmtMDA(product.claimsMDA)} hint={`S/P ${fmtPct(product.lossRatio)}`} icon={<ShieldAlert className="h-4 w-4" />} accent="gold" />
          <KpiCard label="Réserves techniques" value={fmtMDA(product.reservesMDA)} hint="PSAP + IBNR + autres" icon={<TrendingUp className="h-4 w-4" />} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard className="lg:col-span-2" title="Primes vs sinistres" description="Vue mensuelle 2024">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="pp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="ss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="primes" stroke="var(--chart-1)" fill="url(#pp)" strokeWidth={2} name="Primes" />
                <Area type="monotone" dataKey="sinistres" stroke="var(--gold)" fill="url(#ss)" strokeWidth={2} name="Sinistres" />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Loss ratio" description="Cible technique < 85%">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart innerRadius="65%" outerRadius="100%" data={ratio} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-center -mt-32 mb-12 pointer-events-none">
              <div className="font-display text-4xl text-foreground">{fmtPct(product.lossRatio)}</div>
              <div className="text-xs text-muted-foreground tracking-wide uppercase mt-1">S / P</div>
            </div>
          </SectionCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <SectionCard title="Répartition par segment client" description="Particuliers · Professionnels · Entreprises">
            <div className="space-y-4">
              {segBreakdown.map((s, i) => {
                const max = Math.max(...segBreakdown.map((x) => x.contracts));
                const w = (s.contracts / max) * 100;
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-foreground font-medium">{s.name}</span>
                      <span className="text-muted-foreground">{s.contracts.toLocaleString("fr-FR")} contrats</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-gold rounded-full transition-all" style={{ width: `${w}%`, opacity: 1 - i * 0.2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Indicateurs techniques" description="Hypothèses et ratios produit">
            <dl className="divide-y divide-border">
              {[
                ["Loss ratio (S/P)", fmtPct(product.lossRatio)],
                ["Évolution annuelle", `${product.trend >= 0 ? "+" : ""}${product.trend.toFixed(1)}%`],
                ["Prime moyenne", fmtMDA(product.premiumsMDA / product.contracts * 1000)],
                ["Réserve / contrat", fmtMDA(product.reservesMDA / product.contracts * 1000)],
                ["Méthode IBNR retenue", product.family === "Vie & Prévoyance" ? "Mack" : "Chain Ladder"],
                ["Statut validation", "✓ Validé T4-2024"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-3 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
