import { Link, createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard } from "@/components/ui/kpi-card";
import { useMemo } from "react";
import { Users } from "lucide-react";
import { useDashboardSummary, useRunRows } from "@/lib/api/queries";
import { toPbSummary, toPpnaSummary, toSapSummary } from "@/lib/api/runRows";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export const Route = createFileRoute("/app/segments")({
  head: () => ({ meta: [{ title: "Segments clients — L'Algérienne Vie" }] }),
  component: SegmentsPage,
});

const fmtMDA = (valueInDa: number) =>
  (valueInDa / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " M DA";

const fmtPct = (value: number) => `${(value * 100).toFixed(1)} %`;

function SegmentsPage() {
  const summaryQuery = useDashboardSummary();

  const runIds = {
    ppna: summaryQuery.data?.domains?.ppna?.run_id ?? null,
    sap: summaryQuery.data?.domains?.sap?.run_id ?? null,
    pb: summaryQuery.data?.domains?.pb?.run_id ?? null,
  };

  const ppnaRows = useRunRows<unknown[]>("ppna", runIds.ppna);
  const sapRows = useRunRows<unknown[]>("sap", runIds.sap);
  const pbRows = useRunRows<unknown[]>("pb", runIds.pb);

  const segments = useMemo(() => {
    const ppna = toPpnaSummary(ppnaRows.data);
    const sap = toSapSummary(sapRows.data);
    const pb = toPbSummary(pbRows.data);

    const map = new Map<
      string,
      { name: string; ppna: number; sap: number; pb: number; dossiers: number; contracts: number }
    >();

    for (const row of ppna.byReseau) {
      const current = map.get(row.name) ?? {
        name: row.name,
        ppna: 0,
        sap: 0,
        pb: 0,
        dossiers: 0,
        contracts: 0,
      };
      current.ppna += row.ppna;
      map.set(row.name, current);
    }

    for (const row of sap.byReseau) {
      const current = map.get(row.name) ?? {
        name: row.name,
        ppna: 0,
        sap: 0,
        pb: 0,
        dossiers: 0,
        contracts: 0,
      };
      current.sap += row.montant;
      current.dossiers += row.count;
      map.set(row.name, current);
    }

    for (const row of pb.byChannel) {
      const current = map.get(row.name) ?? {
        name: row.name,
        ppna: 0,
        sap: 0,
        pb: 0,
        dossiers: 0,
        contracts: 0,
      };
      current.pb += row.pb;
      current.contracts += row.count;
      map.set(row.name, current);
    }

    const rows = Array.from(map.values())
      .map((item) => ({
        ...item,
        total: item.ppna + item.sap + item.pb,
      }))
      .sort((a, b) => b.total - a.total);

    const totalAmount = rows.reduce((sum, row) => sum + row.total, 0);

    return {
      rows,
      totalAmount,
      totalDossiers: rows.reduce((sum, row) => sum + row.dossiers, 0),
      totalContracts: rows.reduce((sum, row) => sum + row.contracts, 0),
    };
  }, [pbRows.data, ppnaRows.data, sapRows.data]);

  const isLoading =
    summaryQuery.isLoading || ppnaRows.isLoading || sapRows.isLoading || pbRows.isLoading;
  const hasRows = segments.rows.length > 0;

  const chartData = segments.rows.map((row) => ({
    segment: row.name,
    PPNA: +(row.ppna / 1_000_000).toFixed(3),
    SAP: +(row.sap / 1_000_000).toFixed(3),
    PB: +(row.pb / 1_000_000).toFixed(3),
  }));

  return (
    <>
      <Topbar title="Segments clients" subtitle="Agrégation backend par réseau et canal" />
      <div className="p-6 lg:p-8 space-y-6">
        {!summaryQuery.data && !summaryQuery.isLoading && (
          <SectionCard
            title="Aucun run disponible"
            description="Lancez des runs PPNA, SAP ou PB pour alimenter les segments"
          >
            <p className="text-sm text-muted-foreground">
              Cette vue ne contient aucune donnée mock; elle dépend uniquement des résultats
              backend.
            </p>
            <Link
              to="/app/import"
              className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
            >
              Aller à l'import des documents
            </Link>
          </SectionCard>
        )}

        {isLoading && (
          <SectionCard title="Chargement" description="Agrégation des segments en cours">
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        )}

        {!isLoading && hasRows && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Segments"
                value={segments.rows.length.toString()}
                icon={<Users className="h-4 w-4" />}
                accent="primary"
              />
              <KpiCard label="Montant total" value={fmtMDA(segments.totalAmount)} />
              <KpiCard
                label="Dossiers SAP"
                value={segments.totalDossiers.toLocaleString("fr-FR")}
              />
              <KpiCard
                label="Contrats PB"
                value={segments.totalContracts.toLocaleString("fr-FR")}
                accent="gold"
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              {segments.rows.map((segment) => {
                const share = segments.totalAmount > 0 ? segment.total / segments.totalAmount : 0;
                return (
                  <div
                    key={segment.name}
                    className="bg-card border border-border rounded-lg p-6 shadow-soft"
                  >
                    <div className="flex items-center gap-4 mb-5">
                      <div className="h-12 w-12 rounded-md bg-gradient-primary flex items-center justify-center">
                        <Users className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <div className="font-display text-xl text-foreground">{segment.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtPct(share)} du portefeuille
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                      <div>
                        <div className="text-[10px] tracking-wide uppercase text-muted-foreground">
                          Dossiers
                        </div>
                        <div className="font-display text-lg text-foreground mt-0.5">
                          {segment.dossiers.toLocaleString("fr-FR")}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] tracking-wide uppercase text-muted-foreground">
                          Montant
                        </div>
                        <div className="font-display text-lg text-foreground mt-0.5">
                          {fmtMDA(segment.total)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <SectionCard
              title="Ventilation par segment"
              description="Montants (M DA) par module PPNA / SAP / PB"
            >
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="segment"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    angle={-15}
                    textAnchor="end"
                    height={70}
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
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="PPNA" stackId="a" fill="var(--chart-1)" />
                  <Bar dataKey="SAP" stackId="a" fill="var(--gold)" />
                  <Bar dataKey="PB" stackId="a" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </>
        )}
      </div>
    </>
  );
}
