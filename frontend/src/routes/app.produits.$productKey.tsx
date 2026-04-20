import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { useMemo } from "react";
import { useDashboardSummary, useRunRows } from "@/lib/api/queries";
import { toIbnrSummary, toPpnaSummary, toSapSummary } from "@/lib/api/runRows";
import { buildBackendProducts } from "@/lib/backendProducts";
import { ChevronLeft, FileText, Layers, ShieldAlert, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";

export const Route = createFileRoute("/app/produits/$productKey")({
  head: ({ params }) => {
    return { meta: [{ title: `${params.productKey} — L'Algérienne Vie` }] };
  },
  component: ProductDetail,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <h1 className="font-display text-2xl mb-2">Produit introuvable</h1>
      <Link to="/app/produits" className="text-primary">
        Retour aux produits
      </Link>
    </div>
  ),
});

const fmtMDA = (valueInDa: number) =>
  (valueInDa / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " M DA";

const fmtPct = (value: number) => `${(value * 100).toFixed(1)} %`;

function ProductDetail() {
  const { productKey } = Route.useParams();

  const summaryQuery = useDashboardSummary();
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
  const product = products.find((item) => item.slug === productKey);
  const isLoading =
    summaryQuery.isLoading || ppnaRows.isLoading || sapRows.isLoading || ibnrRows.isLoading;

  const productSapRows = useMemo(
    () => (product ? sap.rows.filter((row) => row.product === product.name) : []),
    [product, sap.rows],
  );

  const trend = useMemo(() => {
    const byYear = new Map<string, { declared: number; sap: number }>();
    for (const row of productSapRows) {
      const year = /^\d{4}/.test(row.declarationDate) ? row.declarationDate.slice(0, 4) : "N/A";
      const current = byYear.get(year) ?? { declared: 0, sap: 0 };
      current.declared += row.declaredAmount;
      current.sap += row.sapAmount;
      byYear.set(year, current);
    }
    return Array.from(byYear.entries())
      .map(([year, values]) => ({
        year,
        declared: +(values.declared / 1_000_000).toFixed(3),
        sap: +(values.sap / 1_000_000).toFixed(3),
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [productSapRows]);

  const networkBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of productSapRows) {
      map.set(row.network, (map.get(row.network) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, dossiers]) => ({ name, dossiers }))
      .sort((a, b) => b.dossiers - a.dossiers);
  }, [productSapRows]);

  if (isLoading && !product) {
    return (
      <>
        <Topbar title="Produit" subtitle="Chargement des agrégats backend" />
        <div className="p-6 lg:p-8">
          <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Chargement des données produit depuis le backend...
          </div>
        </div>
      </>
    );
  }

  if (!product) throw notFound();

  const lossRatio = product.premiums > 0 ? product.sap / product.premiums : 0;
  const ratio = [
    {
      name: "S/P",
      value: lossRatio * 100,
      fill:
        lossRatio < 0.6
          ? "var(--success)"
          : lossRatio < 0.85
            ? "var(--gold)"
            : "var(--destructive)",
    },
  ];

  return (
    <>
      <Topbar title={product.name} subtitle="Vue produit dérivée des runs backend" />
      <div className="p-6 lg:p-8 space-y-6">
        <Link
          to="/app/produits"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Toutes les branches
        </Link>

        <div className="bg-gradient-primary text-white rounded-lg p-6 lg:p-8 flex items-start gap-5 shadow-elegant">
          <div className="h-16 w-16 rounded-md bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
            <span className="font-display text-3xl text-gold">
              {product.name.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] tracking-[0.22em] uppercase text-gold mb-1">
              Backend aggregé
            </div>
            <h2 className="font-display text-2xl mb-1">{product.name}</h2>
            <p className="text-white/70 text-sm max-w-2xl">
              Données consolidées à partir des sorties PPNA / SAP / IBNR. Aucun modèle frontend
              local.
            </p>
          </div>
          <Badge variant="gold">Actif</Badge>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Dossiers SAP"
            value={product.claimCount.toLocaleString("fr-FR")}
            hint="Source SAP"
            icon={<FileText className="h-4 w-4" />}
            accent="primary"
          />
          <KpiCard
            label="Primes"
            value={fmtMDA(product.premiums)}
            icon={<Layers className="h-4 w-4" />}
          />
          <KpiCard
            label="SAP"
            value={fmtMDA(product.sap)}
            hint={`S/P ${fmtPct(lossRatio)}`}
            icon={<ShieldAlert className="h-4 w-4" />}
            accent="gold"
          />
          <KpiCard
            label="Réserves techniques"
            value={fmtMDA(product.reserveTotal)}
            hint="PPNA + SAP + IBNR"
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title="Déclaré vs SAP"
            description="Vue annuelle extraite des lignes SAP du produit"
          >
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
                <XAxis
                  dataKey="year"
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
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="declared"
                  stroke="var(--chart-1)"
                  fill="url(#pp)"
                  strokeWidth={2}
                  name="Déclaré"
                />
                <Area
                  type="monotone"
                  dataKey="sap"
                  stroke="var(--gold)"
                  fill="url(#ss)"
                  strokeWidth={2}
                  name="SAP"
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Loss ratio" description="Cible technique < 85%">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                innerRadius="65%"
                outerRadius="100%"
                data={ratio}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar background dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="text-center -mt-32 mb-12 pointer-events-none">
              <div className="font-display text-4xl text-foreground">{fmtPct(lossRatio)}</div>
              <div className="text-xs text-muted-foreground tracking-wide uppercase mt-1">
                S / P
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <SectionCard
            title="Répartition par réseau"
            description="Nombre de dossiers SAP par réseau"
          >
            <div className="space-y-4">
              {networkBreakdown.map((network, i) => {
                const max = Math.max(...networkBreakdown.map((x) => x.dossiers));
                const w = max > 0 ? (network.dossiers / max) * 100 : 0;
                return (
                  <div key={network.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-foreground font-medium">{network.name}</span>
                      <span className="text-muted-foreground">
                        {network.dossiers.toLocaleString("fr-FR")} dossiers
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-gold rounded-full transition-all"
                        style={{ width: `${w}%`, opacity: 1 - i * 0.2 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Indicateurs techniques" description="Hypothèses et ratios produit">
            <dl className="divide-y divide-border">
              {[
                ["Loss ratio (S/P)", fmtPct(lossRatio)],
                ["Primes", fmtMDA(product.premiums)],
                ["PPNA", fmtMDA(product.ppna)],
                ["SAP", fmtMDA(product.sap)],
                ["IBNR", fmtMDA(product.ibnr)],
                ["Réseaux observés", product.networks.length.toString()],
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
