import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { kpis, fmtMDA, fmtPct } from "@/lib/mockData";
import { Scale, CheckCircle2, FileCheck2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

export const Route = createFileRoute("/app/balance")({
  head: () => ({ meta: [{ title: "Synthèse technique — L'Algérienne Vie" }] }),
  component: BalancePage,
});

function BalancePage() {
  const provisions = [
    { name: "PPNA", value: kpis.ppna, fill: "var(--chart-3)" },
    { name: "PSAP", value: kpis.psap, fill: "var(--chart-1)" },
    { name: "IBNR", value: kpis.ibnr, fill: "var(--gold)" },
    { name: "PRC",  value: kpis.prc,  fill: "var(--chart-4)" },
    { name: "Égalisation", value: 612, fill: "var(--chart-5)" },
    { name: "Particip. Bénéf.", value: 384, fill: "var(--chart-2)" },
    { name: "Frais Gestion", value: 218, fill: "var(--muted-foreground)" },
  ];

  const total = provisions.reduce((s, p) => s + p.value, 0);
  const actif = total + kpis.fondsPropres;

  return (
    <>
      <Topbar title="Synthèse technique & bilan" subtitle="Vue actif / passif et cohérence des provisions" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total actif" value={fmtMDA(actif)} accent="primary" icon={<Scale className="h-4 w-4" />} />
          <KpiCard label="Provisions techniques" value={fmtMDA(total)} icon={<Scale className="h-4 w-4" />} />
          <KpiCard label="Fonds propres" value={fmtMDA(kpis.fondsPropres)} accent="gold" />
          <KpiCard label="Couverture" value={fmtPct(actif / total)} hint="Actif / Provisions" icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <SectionCard title="Bilan technique" description="Actif vs passif au 31/12/2024">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3 pb-2 border-b border-border">Actif</div>
                <div className="space-y-2.5">
                  {[
                    ["Placements obligataires", actif * 0.62],
                    ["Placements actions", actif * 0.18],
                    ["Immobilier", actif * 0.08],
                    ["Trésorerie", actif * 0.07],
                    ["Créances", actif * 0.05],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{k as string}</span>
                      <span className="font-medium text-foreground">{fmtMDA(v as number)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 pt-3 border-t border-border">
                  <span className="font-display text-foreground">Total actif</span>
                  <span className="font-display text-foreground">{fmtMDA(actif)}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3 pb-2 border-b border-border">Passif</div>
                <div className="space-y-2.5">
                  {provisions.slice(0, 5).map((p) => (
                    <div key={p.name} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="font-medium text-foreground">{fmtMDA(p.value)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Autres provisions</span>
                    <span className="font-medium text-foreground">{fmtMDA(provisions.slice(5).reduce((s, p) => s + p.value, 0))}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Fonds propres</span>
                    <span className="font-medium text-gold-deep">{fmtMDA(kpis.fondsPropres)}</span>
                  </div>
                </div>
                <div className="flex justify-between mt-4 pt-3 border-t border-border">
                  <span className="font-display text-foreground">Total passif</span>
                  <span className="font-display text-foreground">{fmtMDA(actif)}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2 bg-success/5 border border-success/20 rounded-md p-3">
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
              <span className="text-sm text-foreground">Bilan équilibré · cohérence vérifiée à 100%.</span>
            </div>
          </SectionCard>

          <SectionCard title="Décomposition des provisions" description="Tous modules confondus">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={provisions} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmtMDA(v)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {provisions.map((p, i) => <Cell key={i} fill={p.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        <SectionCard
          title="Snapshots validés"
          description="Versions certifiées de la synthèse technique"
          action={<Badge variant="success"><FileCheck2 className="h-3 w-3" /> 4 snapshots</Badge>}
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {["T1-2024", "T2-2024", "T3-2024", "T4-2024"].map((q, i) => (
              <div key={q} className={`p-4 rounded-md border ${i === 3 ? "bg-gold-soft/40 border-gold/40" : "bg-muted/40 border-border"}`}>
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">Inventaire</div>
                <div className="font-display text-xl text-foreground mt-1">{q}</div>
                <div className="mt-2">
                  {i === 3
                    ? <Badge variant="gold">À valider</Badge>
                    : <Badge variant="success">Certifié</Badge>}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
