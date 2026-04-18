import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard } from "@/components/ui/kpi-card";
import { segments, products, fmtMDA, fmtPct } from "@/lib/mockData";
import { Users, Building2, Briefcase } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/app/segments")({
  head: () => ({ meta: [{ title: "Segments clients — L'Algérienne Vie" }] }),
  component: SegmentsPage,
});

const ICONS = { particuliers: Users, professionnels: Briefcase, entreprises: Building2 };

function SegmentsPage() {
  const segData = products.map((p) => ({
    branche: p.shortName,
    Particuliers: Math.round(p.premiumsMDA * (p.family === "Crédit" ? 0.4 : p.family === "Famille" ? 0.95 : 0.65)),
    Professionnels: Math.round(p.premiumsMDA * (p.family === "Crédit" ? 0.35 : 0.2)),
    Entreprises: Math.round(p.premiumsMDA * (p.family === "Crédit" ? 0.25 : p.family === "Famille" ? 0.05 : 0.15)),
  }));

  return (
    <>
      <Topbar title="Segments clients" subtitle="Particuliers · Professionnels · Entreprises" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid lg:grid-cols-3 gap-5">
          {segments.map((s) => {
            const Icon = ICONS[s.key];
            return (
              <div key={s.key} className="bg-card border border-border rounded-lg p-6 shadow-soft">
                <div className="flex items-center gap-4 mb-5">
                  <div className="h-12 w-12 rounded-md bg-gradient-primary flex items-center justify-center">
                    <Icon className="h-5 w-5 text-gold" />
                  </div>
                  <div>
                    <div className="font-display text-xl text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtPct(s.share)} du portefeuille</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div>
                    <div className="text-[10px] tracking-wide uppercase text-muted-foreground">Contrats</div>
                    <div className="font-display text-lg text-foreground mt-0.5">{s.contracts.toLocaleString("fr-FR")}</div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-wide uppercase text-muted-foreground">Primes</div>
                    <div className="font-display text-lg text-foreground mt-0.5">{fmtMDA(s.premiumsMDA)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <SectionCard title="Pénétration par branche et segment" description="Primes (M DA) par branche × segment client">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={segData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="branche" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} angle={-15} textAnchor="end" height={70} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Particuliers" stackId="a" fill="var(--chart-1)" />
              <Bar dataKey="Professionnels" stackId="a" fill="var(--gold)" />
              <Bar dataKey="Entreprises" stackId="a" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
    </>
  );
}
