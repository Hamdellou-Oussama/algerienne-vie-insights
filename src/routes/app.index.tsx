import { createFileRoute, Link } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import {
  Wallet, ShieldAlert, Activity, Layers, AlertCircle, ArrowUpRight,
  CheckCircle2, FileWarning, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import {
  kpis, reserveTimeline, premiumsClaimsTrend, products, segments,
  fmtMDA, fmtPct, auditEvents,
} from "@/lib/mockData";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord global — L'Algérienne Vie" }] }),
  component: GlobalDashboard,
});

const COLORS = ["var(--chart-3)", "var(--chart-1)", "var(--gold)", "var(--chart-4)"];

function GlobalDashboard() {
  const { info } = useRole();

  const composition = [
    { name: "PPNA", value: kpis.ppna },
    { name: "PSAP", value: kpis.psap },
    { name: "IBNR", value: kpis.ibnr },
    { name: "PRC",  value: kpis.prc },
  ];

  return (
    <>
      <Topbar
        title={`Bonjour ${info.user.split(" ")[1] ?? info.user}`}
        subtitle={`Cockpit ${info.label} · clôture technique au 31 décembre 2024`}
      />
      <div className="p-6 lg:p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Provisions techniques" value={fmtMDA(kpis.totalReserves)} hint="Total agrégé" trend={6.4} icon={<Wallet className="h-4 w-4" />} accent="primary" delay={0} />
          <KpiCard label="PPNA" value={fmtMDA(kpis.ppna)} hint="Primes non acquises" trend={3.2} icon={<Layers className="h-4 w-4" />} delay={0.05} />
          <KpiCard label="PSAP + IBNR" value={fmtMDA(kpis.psap + kpis.ibnr)} hint="Sinistres à payer" trend={5.8} icon={<ShieldAlert className="h-4 w-4" />} accent="gold" delay={0.1} />
          <KpiCard label="Ratio combiné" value={fmtPct(kpis.ratioCombine)} hint="Cible < 95%" trend={-1.4} icon={<Activity className="h-4 w-4" />} delay={0.15} />
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Évolution des provisions techniques"
            description="Composition trimestrielle des réserves (M DA)"
            action={<Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Validé T4-2024</Badge>}
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={reserveTimeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  {composition.map((c, i) => (
                    <linearGradient key={c.name} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => `${v.toLocaleString("fr-FR")} M DA`}
                />
                <Area type="monotone" dataKey="PPNA" stackId="1" stroke={COLORS[0]} fill="url(#g0)" strokeWidth={2} />
                <Area type="monotone" dataKey="PSAP" stackId="1" stroke={COLORS[1]} fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="IBNR" stackId="1" stroke={COLORS[2]} fill="url(#g2)" strokeWidth={2} />
                <Area type="monotone" dataKey="PRC"  stackId="1" stroke={COLORS[3]} fill="url(#g3)" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Composition" description="Répartition T4-2024">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={composition} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {composition.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => `${v.toLocaleString("fr-FR")} M DA`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {composition.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="ml-auto font-medium text-foreground">{fmtMDA(c.value)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Primes acquises vs sinistres"
            description="Vue mensuelle 2024 (M DA)"
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={premiumsClaimsTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="primes" fill="var(--chart-1)" radius={[3, 3, 0, 0]} name="Primes" />
                <Bar dataKey="sinistres" fill="var(--gold)" radius={[3, 3, 0, 0]} name="Sinistres" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Statut de validation" description="Avancement des calculs T4-2024">
            <div className="space-y-4">
              {[
                { l: "PPNA", v: 100, s: "validé" },
                { l: "PSAP", v: 100, s: "validé" },
                { l: "IBNR", v: 92, s: "en cours" },
                { l: "PRC",  v: 78, s: "en cours" },
                { l: "Provision Égalisation", v: 45, s: "à démarrer" },
              ].map((row) => (
                <div key={row.l}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-foreground font-medium">{row.l}</span>
                    <span className="text-muted-foreground">{row.v}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${row.v}%`,
                        background: row.v === 100 ? "var(--success)" : row.v >= 70 ? "var(--gold)" : "var(--muted-foreground)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Products & alerts */}
        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Performance par branche"
            description="Vue rapide des six gammes — accédez au détail produit"
            action={<Link to="/app/produits" className="text-xs text-primary hover:text-gold-deep inline-flex items-center gap-1 font-medium">Tout voir <ArrowUpRight className="h-3 w-3" /></Link>}
          >
            <div className="space-y-2">
              {products.map((p) => {
                const Icon = p.icon;
                return (
                  <Link
                    key={p.key}
                    to="/app/produits/$productKey"
                    params={{ productKey: p.key }}
                    className="flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="h-9 w-9 rounded-md bg-gradient-primary flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{p.shortName}</div>
                      <div className="text-[11px] text-muted-foreground">{p.contracts.toLocaleString("fr-FR")} contrats · S/P {fmtPct(p.lossRatio)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold text-foreground">{fmtMDA(p.reservesMDA)}</div>
                      <div className={`text-[11px] ${p.trend >= 0 ? "text-success" : "text-destructive"}`}>
                        {p.trend >= 0 ? "+" : ""}{p.trend.toFixed(1)}%
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Alertes actives" description="Points d'attention">
            <div className="space-y-3">
              {[
                { i: AlertCircle, v: "danger" as const, t: "Triangle Emprunteur", d: "1 cellule manquante en 2023." },
                { i: FileWarning, v: "warning" as const, t: "Hypothèse Loss Ratio", d: "À mettre à jour — Prévoyance." },
                { i: Clock,       v: "info" as const,    t: "Validation PRC", d: "En attente de la direction." },
                { i: CheckCircle2, v: "success" as const, t: "Bilan T3-2024", d: "Certifié et archivé." },
              ].map((a, i) => {
                const Icon = a.i;
                return (
                  <div key={i} className="flex gap-3 p-3 bg-muted/50 rounded-md">
                    <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                      a.v === "danger" ? "text-destructive" :
                      a.v === "warning" ? "text-gold-deep" :
                      a.v === "success" ? "text-success" : "text-primary"
                    }`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{a.t}</div>
                      <div className="text-xs text-muted-foreground">{a.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Activity */}
        <SectionCard
          title="Activité récente"
          description="Dernières opérations sur la plateforme"
          action={<Link to="/app/audit" className="text-xs text-primary hover:text-gold-deep inline-flex items-center gap-1 font-medium">Audit complet <ArrowUpRight className="h-3 w-3" /></Link>}
        >
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-6 py-2">Date</th>
                  <th className="text-left font-medium px-6 py-2">Utilisateur</th>
                  <th className="text-left font-medium px-6 py-2">Action</th>
                  <th className="text-left font-medium px-6 py-2">Cible</th>
                  <th className="text-left font-medium px-6 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.slice(0, 5).map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-3 text-muted-foreground text-xs">{e.date}</td>
                    <td className="px-6 py-3 font-medium text-foreground">{e.user} <span className="text-xs text-muted-foreground">· {e.role}</span></td>
                    <td className="px-6 py-3 text-foreground">{e.action}</td>
                    <td className="px-6 py-3 text-muted-foreground">{e.target}</td>
                    <td className="px-6 py-3">
                      <Badge variant={e.status === "validé" ? "success" : e.status === "en cours" ? "warning" : "info"}>
                        {e.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
