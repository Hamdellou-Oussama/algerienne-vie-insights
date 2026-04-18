import { createFileRoute, Link } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { motion } from "framer-motion";
import {
  Wallet, ShieldAlert, Activity, Layers, AlertCircle, ArrowUpRight,
  CheckCircle2, FileWarning, Clock, Users, TrendingUp as TrendingUpIcon,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";
import {
  kpis, reserveTimeline, premiumsClaimsTrend, products, segments,
  fmtMDA, fmtPct, fmtNum, auditEvents,
} from "@/lib/mockData";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord global — L'Algérienne Vie" }] }),
  component: GlobalDashboard,
});

const COLORS = ["var(--chart-3)", "var(--chart-1)", "var(--gold)", "var(--chart-4)"];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-elegant p-3 text-xs min-w-[160px]">
      <div className="font-semibold text-foreground mb-2">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium text-foreground">{Number(p.value).toLocaleString("fr-FR")} M DA</span>
        </div>
      ))}
    </div>
  );
};

function GlobalDashboard() {
  const { info } = useRole();

  const composition = [
    { name: "PPNA", value: kpis.ppna },
    { name: "PSAP", value: kpis.psap },
    { name: "IBNR", value: kpis.ibnr },
    { name: "PRC",  value: kpis.prc },
  ];

  // Statuts réels dérivés des fichiers disponibles
  const validationRows = [
    { l: "SAP prévoyance",  v: 100, s: "chargé"    },  // FILE 1 importé
    { l: "PPNA AVA/IA",     v: 100, s: "chargé"    },  // FILE 2 importé
    { l: "PE 2022",         v: 100, s: "chargé"    },  // FILE 3 importé
    { l: "Triangle IBNR",   v: 100, s: "chargé"    },  // FILE 4 importé
    { l: "Calcul IBNR",     v: 0,   s: "à démarrer" }, // traitement non démarré
  ];

  const alerts = [
    { i: AlertCircle,  v: "danger"  as const, t: "Date échéance anomale (ADE)",  d: "1 contrat avec date 0027 détectée — FILE 4." },
    { i: FileWarning,  v: "warning" as const, t: "IBNR non calculé",             d: "Triangle chargé — calcul chaîne-ladder à démarrer." },
    { i: Clock,        v: "info"    as const, t: "Bilan sinistres vide",          d: "Fichier level3-Bilan sinistres.xlsx à renseigner." },
    { i: CheckCircle2, v: "success" as const, t: "SAP prévoyance 30/06/2025",    d: "234 sinistres chargés, 174 en cours (SAP = 33,6 M DA)." },
  ];

  const alertBorder: Record<string, string> = {
    danger:  "border-l-destructive/60",
    warning: "border-l-warning/80",
    info:    "border-l-primary/50",
    success: "border-l-success/60",
  };

  const alertIcon: Record<string, string> = {
    danger:  "text-destructive",
    warning: "text-gold-deep",
    success: "text-success",
    info:    "text-primary",
  };

  return (
    <>
      <Topbar
        title={`Bonjour, ${info.user.split(" ")[1] ?? info.user}`}
        subtitle={`Cockpit ${info.label} · clôture technique au 31 décembre 2024`}
      />

      {/* ── Hero stats banner ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-hero px-6 lg:px-8 py-5 border-b border-primary/30"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
          {[
            { label: "Contrats actifs",     value: fmtNum(kpis.contratsActifs), icon: Users },
            { label: "Primes acquises",      value: fmtMDA(kpis.primesAcquises), icon: TrendingUpIcon },
            { label: "Sinistres ouverts",    value: fmtNum(kpis.claimsOpen),     icon: FileWarning },
            { label: "SAP prévoyance",       value: fmtMDA(kpis.psap),           icon: Wallet },
          ].map(({ label, value, icon: HeroIcon }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/8 group/stat"
            >
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover/stat:bg-white/18 group-hover/stat:scale-105">
                <HeroIcon className="h-4 w-4 text-gold" />
              </div>
              <div>
                <div className="text-[11px] text-white/50 uppercase tracking-[0.14em] font-medium">{label}</div>
                <div className="text-white text-base font-semibold leading-tight tabular-nums">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="p-6 lg:p-8 space-y-6">

        {/* ── KPI cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Provisions techniques"
            value={fmtMDA(kpis.totalReserves)}
            hint="Total agrégé"
            trend={6.4}
            icon={<Wallet className="h-4 w-4" />}
            accent="primary"
            delay={0}
          />
          <KpiCard
            label="PPNA"
            value={fmtMDA(kpis.ppna)}
            hint="Primes non acquises"
            trend={3.2}
            icon={<Layers className="h-4 w-4" />}
            delay={0.06}
          />
          <KpiCard
            label="PSAP + IBNR"
            value={fmtMDA(kpis.psap + kpis.ibnr)}
            hint="Sinistres à payer"
            trend={5.8}
            icon={<ShieldAlert className="h-4 w-4" />}
            accent="gold"
            delay={0.12}
          />
          <KpiCard
            label="Ratio combiné"
            value={fmtPct(kpis.ratioCombine)}
            hint="Cible < 95 %"
            trend={-1.4}
            icon={<Activity className="h-4 w-4" />}
            delay={0.18}
          />
        </div>

        {/* ── Area chart + Pie ────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Évolution des provisions techniques"
            description="Composition trimestrielle des réserves (M DA)"
            action={
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" /> Validé T4-2024
              </Badge>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={reserveTimeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  {composition.map((c, i) => (
                    <linearGradient key={c.name} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS[i]} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="PPNA" stackId="1" stroke={COLORS[0]} fill="url(#g0)" strokeWidth={2} />
                <Area type="monotone" dataKey="PSAP" stackId="1" stroke={COLORS[1]} fill="url(#g1)" strokeWidth={2} />
                <Area type="monotone" dataKey="IBNR" stackId="1" stroke={COLORS[2]} fill="url(#g2)" strokeWidth={2} />
                <Area type="monotone" dataKey="PRC"  stackId="1" stroke={COLORS[3]} fill="url(#g3)" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Composition T4-2024" description="Répartition des provisions">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={composition}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {composition.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => `${Number(v).toLocaleString("fr-FR")} M DA`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
              {composition.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                  <span className="text-muted-foreground truncate">{c.name}</span>
                  <span className="ml-auto font-semibold text-foreground tabular-nums">{fmtMDA(c.value)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Bar chart + Validation progress ─────────────────────── */}
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
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [`${Number(v).toLocaleString("fr-FR")} M DA`, name === "primes" ? "Primes" : "Sinistres"]}
                />
                <Bar dataKey="primes"    fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Primes" />
                <Bar dataKey="sinistres" fill="var(--gold)"    radius={[4, 4, 0, 0]} name="Sinistres" />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Statut de validation" description="Avancement des calculs T4-2024">
            <div className="space-y-5">
              {validationRows.map((row) => (
                <div key={row.l}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-foreground">{row.l}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{row.v}%</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        row.v === 100
                          ? "bg-success/10 text-success"
                          : row.v >= 70
                          ? "bg-warning/15 text-gold-deep"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {row.s}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${row.v}%` }}
                      transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          row.v === 100 ? "var(--success)"
                          : row.v >= 70 ? "var(--gold)"
                          : "var(--muted-foreground)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Products + Alerts ───────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Performance par branche"
            description="Vue rapide des six gammes — accédez au détail produit"
            action={
              <Link
                to="/app/produits"
                className="text-xs text-primary hover:text-gold-deep inline-flex items-center gap-1 font-semibold"
              >
                Tout voir <ArrowUpRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="space-y-1.5">
              {products.map((p) => {
                const Icon = p.icon;
                const lossColor =
                  p.lossRatio < 0.5 ? "var(--success)"
                  : p.lossRatio < 0.65 ? "var(--gold)"
                  : "var(--destructive)";
                return (
                  <Link
                    key={p.key}
                    to="/app/produits/$productKey"
                    params={{ productKey: p.key }}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                      <Icon className="h-4 w-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{p.shortName}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {p.contracts.toLocaleString("fr-FR")} contrats
                      </div>
                    </div>
                    {/* mini loss ratio bar */}
                    <div className="hidden sm:flex flex-col items-end gap-1 w-28 flex-shrink-0">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] text-muted-foreground">S/P</span>
                        <span className="text-[11px] font-medium" style={{ color: lossColor }}>
                          {fmtPct(p.lossRatio)}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(p.lossRatio * 100, 100)}%`, background: lossColor }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <div className="text-sm font-bold text-foreground tabular-nums">{fmtMDA(p.reservesMDA)}</div>
                      <div className={`text-[11px] font-medium ${p.trend >= 0 ? "text-success" : "text-destructive"}`}>
                        {p.trend >= 0 ? "+" : ""}{p.trend.toFixed(1)}%
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Alertes actives" description="Points d'attention immédiats">
            <div className="space-y-2.5">
              {alerts.map((a, i) => {
                const Icon = a.i;
                return (
                  <div
                    key={i}
                    className={`flex gap-3 p-3 bg-muted/40 rounded-lg border border-transparent border-l-2 ${alertBorder[a.v]} hover:bg-muted/80 hover:shadow-sm hover:-translate-y-px transition-all duration-150 cursor-pointer`}
                  >
                    <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${alertIcon[a.v]}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground leading-snug">{a.t}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{a.d}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Segments mini summary */}
            <div className="mt-5 pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">
                Portefeuille par segment
              </div>
              <div className="space-y-2.5">
                {segments.map((s) => (
                  <div key={s.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">{s.name}</span>
                      <span className="text-muted-foreground tabular-nums">{fmtPct(s.share, 0)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${s.share * 100}%` }}
                        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Activity table ──────────────────────────────────────── */}
        <SectionCard
          title="Activité récente"
          description="Dernières opérations sur la plateforme"
          action={
            <Link
              to="/app/audit"
              className="text-xs text-primary hover:text-gold-deep inline-flex items-center gap-1 font-semibold"
            >
              Audit complet <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-[10.5px] tracking-[0.12em] uppercase text-muted-foreground">
                  <th className="text-left font-semibold px-6 py-2.5">Date</th>
                  <th className="text-left font-semibold px-6 py-2.5">Utilisateur</th>
                  <th className="text-left font-semibold px-6 py-2.5">Action</th>
                  <th className="text-left font-semibold px-6 py-2.5 hidden md:table-cell">Cible</th>
                  <th className="text-left font-semibold px-6 py-2.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.slice(0, 5).map((e, idx) => (
                  <tr
                    key={e.id}
                    className={`border-t border-border hover:bg-muted/30 transition-colors ${idx === 0 ? "border-t-0" : ""}`}
                  >
                    <td className="px-6 py-3 text-muted-foreground text-xs tabular-nums whitespace-nowrap">{e.date}</td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-foreground text-sm">{e.user}</div>
                      <div className="text-[11px] text-muted-foreground">{e.role}</div>
                    </td>
                    <td className="px-6 py-3 text-foreground text-sm">{e.action}</td>
                    <td className="px-6 py-3 text-muted-foreground text-sm hidden md:table-cell">{e.target}</td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          e.status === "validé" ? "success"
                          : e.status === "en cours" ? "warning"
                          : "info"
                        }
                      >
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
