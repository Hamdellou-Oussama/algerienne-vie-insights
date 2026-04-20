import { createFileRoute, Link } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { motion } from "framer-motion";
import {
  Wallet,
  ShieldAlert,
  Activity,
  Layers,
  ArrowUpRight,
  CheckCircle2,
  FileWarning,
  Clock,
  Users,
  TrendingUp as TrendingUpIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useMemo } from "react";
import {
  useAuditEvents,
  useDashboardAlerts,
  useDashboardCompletion,
  useDashboardSummary,
  useRunRows,
} from "@/lib/api/queries";
import { toIbnrSummary, toPpnaSummary, toSapSummary } from "@/lib/api/runRows";
import { buildBackendProducts } from "@/lib/backendProducts";
import { useRole } from "@/lib/roles";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord global — L'Algérienne Vie" }] }),
  component: GlobalDashboard,
});

const COLORS = [
  "var(--chart-3)",
  "var(--chart-1)",
  "var(--gold)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const fmtMDA = (valueInDa: number) =>
  (valueInDa / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " M DA";

const fmtPct = (value: number) => `${(value * 100).toFixed(1)} %`;

const fmtNum = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-elegant p-3 text-xs min-w-[160px]">
      <div className="font-semibold text-foreground mb-2">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="font-medium text-foreground">
            {Number(p.value).toLocaleString("fr-FR")} M DA
          </span>
        </div>
      ))}
    </div>
  );
};

function GlobalDashboard() {
  const { info } = useRole();
  const summaryQuery = useDashboardSummary();
  const alertsQuery = useDashboardAlerts();
  const completionQuery = useDashboardCompletion();
  const auditQuery = useAuditEvents(20);

  const runIds = {
    ppna: summaryQuery.data?.domains?.ppna?.run_id ?? null,
    sap: summaryQuery.data?.domains?.sap?.run_id ?? null,
    ibnr: summaryQuery.data?.domains?.ibnr?.run_id ?? null,
  };

  const ppnaRows = useRunRows<unknown[]>("ppna", runIds.ppna);
  const sapRows = useRunRows<unknown[]>("sap", runIds.sap);
  const ibnrRows = useRunRows<unknown>("ibnr", runIds.ibnr);

  const ppna = useMemo(() => toPpnaSummary(ppnaRows.data), [ppnaRows.data]);
  const sap = useMemo(() => toSapSummary(sapRows.data), [sapRows.data]);
  const ibnr = useMemo(() => toIbnrSummary(ibnrRows.data), [ibnrRows.data]);
  const products = useMemo(() => buildBackendProducts(ppna, sap, ibnr), [ibnr, ppna, sap]);

  const totals = summaryQuery.data?.domains;
  const kpis = {
    ppna: totals?.ppna?.total ?? 0,
    sap: totals?.sap?.total ?? 0,
    pe: totals?.pe?.total ?? 0,
    pb: totals?.pb?.total ?? 0,
    ibnr: totals?.ibnr?.total ?? 0,
    totalReserves: summaryQuery.data?.grand_total ?? 0,
    contratsActifs: ppna.rows.length,
    primesAcquises: ppna.totalPrimes,
    claimsOpen: sap.rows.filter((row) => row.status.toUpperCase().includes("SAP")).length,
    ratioCombine: ppna.totalPrimes > 0 ? sap.montantSAP / ppna.totalPrimes : 0,
  };

  const composition = [
    { name: "PPNA", value: kpis.ppna / 1_000_000 },
    { name: "SAP", value: kpis.sap / 1_000_000 },
    { name: "IBNR", value: kpis.ibnr / 1_000_000 },
    { name: "PE", value: kpis.pe / 1_000_000 },
    { name: "PB", value: kpis.pb / 1_000_000 },
  ].filter((row) => row.value > 0);

  const validationRows = (
    Object.entries(completionQuery.data?.domains ?? {}) as Array<[string, { completed: boolean }]>
  ).map(([domain, state]) => ({
    l: domain.toUpperCase(),
    v: state.completed ? 100 : 0,
    s: state.completed ? "validé" : "à démarrer",
  }));

  const alerts = (alertsQuery.data?.alerts ?? []).map((alert) => {
    if (alert.type === "missing_run") {
      return {
        i: FileWarning,
        v: "warning" as const,
        t: `Run manquant · ${alert.domain?.toUpperCase() ?? "N/A"}`,
        d: alert.message,
      };
    }
    if (alert.type === "assumption_review") {
      return { i: Clock, v: "info" as const, t: "Hypothèses à revoir", d: alert.message };
    }
    return { i: CheckCircle2, v: "success" as const, t: alert.type, d: alert.message };
  });

  const productChart = products.slice(0, 8).map((product) => ({
    name: product.name,
    primes: +(product.premiums / 1_000_000).toFixed(3),
    sap: +(product.sap / 1_000_000).toFixed(3),
  }));

  const segmentSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of ppna.byReseau) {
      map.set(row.name, (map.get(row.name) ?? 0) + row.ppna);
    }
    for (const row of sap.byReseau) {
      map.set(row.name, (map.get(row.name) ?? 0) + row.montant);
    }
    const rows = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({ ...row, share: total > 0 ? row.value / total : 0 }));
  }, [ppna.byReseau, sap.byReseau]);

  const liveAudit = (auditQuery.data ?? []).map((event) => ({
    id: event.event_id,
    date: event.occurred_at?.replace("T", " ").slice(0, 16) ?? "",
    user: event.actor_user_id,
    role: "—",
    action: event.action.replace(/_/g, " "),
    target: `${event.target_type}: ${event.target_id}`,
    status: event.action.startsWith("finish")
      ? "validé"
      : event.action.startsWith("fail")
        ? "en erreur"
        : "en cours",
  }));

  const alertBorder: Record<string, string> = {
    danger: "border-l-destructive/60",
    warning: "border-l-warning/80",
    info: "border-l-primary/50",
    success: "border-l-success/60",
  };

  const alertIcon: Record<string, string> = {
    danger: "text-destructive",
    warning: "text-gold-deep",
    success: "text-success",
    info: "text-primary",
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
            { label: "Contrats actifs", value: fmtNum(kpis.contratsActifs), icon: Users },
            { label: "Primes acquises", value: fmtMDA(kpis.primesAcquises), icon: TrendingUpIcon },
            { label: "Sinistres ouverts", value: fmtNum(kpis.claimsOpen), icon: FileWarning },
            { label: "SAP", value: fmtMDA(kpis.sap), icon: Wallet },
          ].map(({ label, value, icon: HeroIcon }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/8 group/stat"
            >
              <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover/stat:bg-white/18 group-hover/stat:scale-105">
                <HeroIcon className="h-4 w-4 text-gold" />
              </div>
              <div>
                <div className="text-[11px] text-white/50 uppercase tracking-[0.14em] font-medium">
                  {label}
                </div>
                <div className="text-white text-base font-semibold leading-tight tabular-nums">
                  {value}
                </div>
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
            label="SAP + IBNR"
            value={fmtMDA(kpis.sap + kpis.ibnr)}
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

        {/* ── Composition + Pie ────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Primes vs SAP par produit"
            description="Comparaison backend par produit (M DA)"
            action={
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" /> Données backend
              </Badge>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={productChart} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
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
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="primes" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Primes" />
                <Bar dataKey="sap" fill="var(--gold)" radius={[4, 4, 0, 0]} name="SAP" />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Composition actuelle" description="Répartition des provisions (M DA)">
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
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => `${Number(v).toLocaleString("fr-FR")} M DA`}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-1">
              {composition.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: COLORS[i] }}
                  />
                  <span className="text-muted-foreground truncate">{c.name}</span>
                  <span className="ml-auto font-semibold text-foreground tabular-nums">
                    {c.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M DA
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Validation progress ─────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Performance par produit"
            description="Top produits selon réserves backend"
          >
            <div className="space-y-1.5">
              {products.slice(0, 8).map((product) => (
                <Link
                  key={product.slug}
                  to="/app/produits/$productKey"
                  params={{ productKey: product.slug }}
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                    <span className="text-sm font-display text-gold">
                      {product.name.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {product.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {product.claimCount.toLocaleString("fr-FR")} dossiers
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 w-28">
                    <div className="text-sm font-bold text-foreground tabular-nums">
                      {fmtMDA(product.reserveTotal)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      S/P {fmtPct(product.premiums > 0 ? product.sap / product.premiums : 0)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Statut de validation" description="Avancement des calculs T4-2024">
            <div className="space-y-5">
              {validationRows.map((row) => (
                <div key={row.l}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-foreground">{row.l}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">{row.v}%</span>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          row.v === 100
                            ? "bg-success/10 text-success"
                            : row.v >= 70
                              ? "bg-warning/15 text-gold-deep"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
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
                          row.v === 100
                            ? "var(--success)"
                            : row.v >= 70
                              ? "var(--gold)"
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
            description="Vue rapide basée sur les runs backend"
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
                const lossRatio = p.premiums > 0 ? p.sap / p.premiums : 0;
                const lossColor =
                  lossRatio < 0.5
                    ? "var(--success)"
                    : lossRatio < 0.65
                      ? "var(--gold)"
                      : "var(--destructive)";
                return (
                  <Link
                    key={p.slug}
                    to="/app/produits/$productKey"
                    params={{ productKey: p.slug }}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                      <span className="text-sm font-display text-gold">
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {p.claimCount.toLocaleString("fr-FR")} dossiers
                      </div>
                    </div>
                    {/* mini loss ratio bar */}
                    <div className="hidden sm:flex flex-col items-end gap-1 w-28 flex-shrink-0">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] text-muted-foreground">S/P</span>
                        <span className="text-[11px] font-medium" style={{ color: lossColor }}>
                          {fmtPct(lossRatio)}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(lossRatio * 100, 100)}%`,
                            background: lossColor,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {fmtMDA(p.reserveTotal)}
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
                      <div className="text-sm font-semibold text-foreground leading-snug">
                        {a.t}
                      </div>
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
                {segmentSummary.map((s) => (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium">{s.name}</span>
                      <span className="text-muted-foreground tabular-nums">{fmtPct(s.share)}</span>
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
                  <th className="text-left font-semibold px-6 py-2.5 hidden md:table-cell">
                    Cible
                  </th>
                  <th className="text-left font-semibold px-6 py-2.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {liveAudit.slice(0, 5).map((e, idx) => (
                  <tr
                    key={e.id}
                    className={`border-t border-border hover:bg-muted/30 transition-colors ${idx === 0 ? "border-t-0" : ""}`}
                  >
                    <td className="px-6 py-3 text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                      {e.date}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-foreground text-sm">{e.user}</div>
                      <div className="text-[11px] text-muted-foreground">{e.role}</div>
                    </td>
                    <td className="px-6 py-3 text-foreground text-sm">{e.action}</td>
                    <td className="px-6 py-3 text-muted-foreground text-sm hidden md:table-cell">
                      {e.target}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          e.status === "validé"
                            ? "success"
                            : e.status === "en erreur"
                              ? "danger"
                              : e.status === "en cours"
                                ? "warning"
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
