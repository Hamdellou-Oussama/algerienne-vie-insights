import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { ibnrByMethod, triangleOriginYears, fmtMDA, developmentFactors } from "@/lib/mockData";
import { useState } from "react";
import { Calculator, Download, Info, GitCompare } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

export const Route = createFileRoute("/app/ibnr")({
  head: () => ({ meta: [{ title: "Atelier IBNR — L'Algérienne Vie" }] }),
  component: IbnrWorkspace,
});

const METHODS = [
  { key: "cl",   name: "Chain Ladder",         desc: "Méthode déterministe par facteurs de développement.", default: true },
  { key: "bf",   name: "Bornhuetter-Ferguson", desc: "Mélange ratio a priori et CL — adapté aux jeunes années." },
  { key: "lr",   name: "Loss Ratio",           desc: "S/P attendu × primes acquises." },
  { key: "mack", name: "Mack",                 desc: "CL stochastique avec écart-type." },
  { key: "mcl",  name: "Munich Chain Ladder",  desc: "Joint payés / encourus, corrige biais." },
  { key: "boot", name: "Bootstrap",            desc: "Réservation par rééchantillonnage — distribution complète." },
];

function IbnrWorkspace() {
  const [active, setActive] = useState("cl");
  const method = METHODS.find((m) => m.key === active)!;
  const result = ibnrByMethod[METHODS.findIndex((m) => m.key === active)];

  // IBNR per origin year (synthetic)
  const perYear = triangleOriginYears.slice(1).map((y, i) => ({
    year: String(y),
    ibnr: Math.round((50 + (i + 1) * (i + 1) * 60) * (1 + (METHODS.findIndex((m) => m.key === active)) * 0.01)),
  }));

  return (
    <>
      <Topbar title="Atelier IBNR" subtitle="Six méthodes de réservation · comparaison · sortie validée" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="IBNR retenu" value={fmtMDA(result.ibnr)} hint={method.name} icon={<Calculator className="h-4 w-4" />} accent="gold" />
          <KpiCard label="Charge ultime" value={fmtMDA(result.ultimate)} icon={<Calculator className="h-4 w-4" />} />
          <KpiCard label="Méthodes testées" value="6" hint="Comparaison disponible" />
          <KpiCard label="Écart vs CL" value={`${result.ecart >= 0 ? "+" : ""}${result.ecart.toFixed(1)}%`} accent="primary" />
        </div>

        {/* Method tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-md text-sm font-medium transition-all border ${
                active === m.key
                  ? "bg-gradient-primary text-white border-transparent shadow-soft"
                  : "bg-card text-muted-foreground border-border hover:border-gold/40 hover:text-foreground"
              }`}
            >
              {m.name}
              {m.default && active !== m.key && <span className="ml-2 text-[10px] text-gold-deep">★</span>}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <SectionCard
            className="lg:col-span-2"
            title={`Méthode : ${method.name}`}
            description={method.desc}
            action={
              <button className="inline-flex items-center gap-1.5 text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant">
                <Download className="h-3 w-3" /> Export résultats
              </button>
            }
          >
            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-muted/40 rounded-md p-4">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-2">Hypothèses</div>
                <ul className="space-y-1.5 text-sm text-foreground">
                  <li>• Pondération volume</li>
                  <li>• Tail factor : 1.000</li>
                  <li>• Développement complet à 7 ans</li>
                </ul>
              </div>
              <div className="bg-muted/40 rounded-md p-4">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-2">Facteurs de développement</div>
                <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                  {developmentFactors.map((f, i) => (
                    <div key={i} className="bg-card rounded px-2 py-1 text-center">
                      <span className="text-muted-foreground">f{i}-{i+1}</span>{" "}
                      <span className="text-foreground font-semibold">{f.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-2">IBNR par année d'origine (M DA)</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={perYear} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="year" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="ibnr" fill="var(--gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Sortie technique" description="Résumé chiffré de la méthode">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">IBNR</div>
                <div className="font-display text-3xl text-foreground">{fmtMDA(result.ibnr)}</div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">Ultime estimé</div>
                <div className="font-display text-2xl text-foreground">{fmtMDA(result.ultimate)}</div>
              </div>
              <div className="border-t border-border pt-4 flex items-start gap-2 bg-gold-soft/40 rounded-md p-3">
                <Info className="h-4 w-4 text-gold-deep flex-shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  La méthode <strong>{method.name}</strong> est {result.ecart >= 0 ? "supérieure" : "inférieure"} de
                  <strong> {Math.abs(result.ecart).toFixed(1)}%</strong> à la référence Chain Ladder.
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Comparison */}
        <SectionCard
          title="Comparaison des six méthodes"
          description="Évaluation côte à côte sur le périmètre courant"
          action={<Badge variant="info"><GitCompare className="h-3 w-3" /> Vue analytique</Badge>}
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ibnrByMethod} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="method" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} angle={-15} textAnchor="end" height={70} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ibnr" stroke="var(--gold)" strokeWidth={2.5} dot={{ fill: "var(--gold)", r: 5 }} name="IBNR (M DA)" />
              <Line type="monotone" dataKey="ultimate" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ fill: "var(--chart-1)", r: 5 }} name="Ultime (M DA)" />
            </LineChart>
          </ResponsiveContainer>

          <div className="overflow-x-auto -mx-6 mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-6 py-2">Méthode</th>
                  <th className="text-right font-medium px-6 py-2">IBNR</th>
                  <th className="text-right font-medium px-6 py-2">Ultime</th>
                  <th className="text-right font-medium px-6 py-2">Écart vs CL</th>
                  <th className="text-center font-medium px-6 py-2">Retenue</th>
                </tr>
              </thead>
              <tbody>
                {ibnrByMethod.map((m, i) => (
                  <tr key={m.method} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium text-foreground">{m.method}</td>
                    <td className="px-6 py-3 text-right font-mono text-foreground">{fmtMDA(m.ibnr)}</td>
                    <td className="px-6 py-3 text-right font-mono text-foreground">{fmtMDA(m.ultimate)}</td>
                    <td className={`px-6 py-3 text-right font-mono ${m.ecart > 1 ? "text-warning" : m.ecart < -1 ? "text-destructive" : "text-success"}`}>
                      {m.ecart >= 0 ? "+" : ""}{m.ecart.toFixed(1)}%
                    </td>
                    <td className="px-6 py-3 text-center">
                      {i === 0 ? <Badge variant="gold">★ Référence</Badge> : <span className="text-muted-foreground text-xs">—</span>}
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
