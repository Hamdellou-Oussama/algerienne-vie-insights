import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import { triangleData, triangleOriginYears, developmentFactors, fmtMDA } from "@/lib/mockData";
import { useState } from "react";
import { Download, ToggleLeft, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/app/triangles")({
  head: () => ({ meta: [{ title: "Triangulation — L'Algérienne Vie" }] }),
  component: TrianglesPage,
});

function TrianglesPage() {
  const [cumulative, setCumulative] = useState(true);

  // Compute incremental view
  const data = cumulative
    ? triangleData
    : triangleData.map((row) =>
        row.map((v, j) => (v == null || j === 0 ? v : (row[j - 1] == null ? null : v - (row[j - 1] as number))))
      );

  const flat = data.flat().filter((v): v is number => typeof v === "number");
  const min = Math.min(...flat), max = Math.max(...flat);
  const colorFor = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return `oklch(${0.96 - t * 0.18} ${0.04 + t * 0.08} 75)`;
  };

  // Projected ultimates
  const ultimates = triangleData.map((row, i) => {
    const lastIdx = row.findIndex((v) => v == null);
    const known = lastIdx === -1 ? row[row.length - 1]! : row[lastIdx - 1]!;
    let proj = known;
    const start = lastIdx === -1 ? row.length - 1 : lastIdx - 1;
    for (let j = start; j < developmentFactors.length; j++) {
      proj *= developmentFactors[j];
    }
    return { year: triangleOriginYears[i], known, ultimate: Math.round(proj), ibnr: Math.round(proj - known) };
  });

  return (
    <>
      <Topbar title="Triangulation des sinistres" subtitle="Développement cumulé · base Chain Ladder" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="info">Branche : Toutes</Badge>
          <Badge variant="default">Devise : DZD (M)</Badge>
          <Badge variant="default">Année inventaire : 2024</Badge>
          <button
            onClick={() => setCumulative(!cumulative)}
            className="ml-auto inline-flex items-center gap-2 text-sm bg-card border border-border px-3 py-1.5 rounded-md hover:border-gold/40 transition-colors"
          >
            {cumulative ? <ToggleRight className="h-4 w-4 text-gold" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
            {cumulative ? "Cumulé" : "Incrémental"}
          </button>
          <button className="inline-flex items-center gap-2 text-sm bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant transition-all">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>

        <SectionCard title="Triangle de développement" description={`${cumulative ? "Cumulé" : "Incrémental"} · 7 années × 7 années de développement`}>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="text-xs border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-muted-foreground tracking-wider uppercase text-[10px] font-medium">Origine</th>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <th key={j} className="px-3 py-2 text-center text-muted-foreground tracking-wider uppercase text-[10px] font-medium min-w-[80px]">
                      Dév {j}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium text-foreground">{triangleOriginYears[i]}</td>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className="px-3 py-2 text-center rounded-md font-mono"
                        style={
                          v == null
                            ? { background: "var(--muted)", color: "var(--muted-foreground)", fontStyle: "italic" }
                            : { background: colorFor(v), color: "var(--foreground)" }
                        }
                      >
                        {v == null ? "—" : v.toLocaleString("fr-FR")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="px-3 pt-3 font-medium text-gold-deep">Facteurs</td>
                  {[null, ...developmentFactors].map((f, j) => (
                    <td key={j} className="px-3 pt-3 text-center font-mono text-gold-deep">
                      {f == null ? "—" : f.toFixed(3)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Projection des ultimes" description="Charge ultime estimée par année d'origine (méthode Chain Ladder)">
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left font-medium px-6 py-2">Année</th>
                  <th className="text-right font-medium px-6 py-2">Cumulé observé</th>
                  <th className="text-right font-medium px-6 py-2">Ultime projeté</th>
                  <th className="text-right font-medium px-6 py-2">IBNR</th>
                  <th className="text-right font-medium px-6 py-2">% IBNR</th>
                </tr>
              </thead>
              <tbody>
                {ultimates.map((u) => (
                  <tr key={u.year} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium text-foreground">{u.year}</td>
                    <td className="px-6 py-3 text-right font-mono text-foreground">{fmtMDA(u.known)}</td>
                    <td className="px-6 py-3 text-right font-mono font-semibold text-foreground">{fmtMDA(u.ultimate)}</td>
                    <td className="px-6 py-3 text-right font-mono text-gold-deep font-semibold">{fmtMDA(u.ibnr)}</td>
                    <td className="px-6 py-3 text-right text-muted-foreground">{((u.ibnr / u.ultimate) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
                <tr className="bg-primary/5 border-t-2 border-border">
                  <td className="px-6 py-3 font-display text-base text-foreground">Total</td>
                  <td className="px-6 py-3 text-right font-mono text-foreground">{fmtMDA(ultimates.reduce((s, u) => s + u.known, 0))}</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-foreground">{fmtMDA(ultimates.reduce((s, u) => s + u.ultimate, 0))}</td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-gold-deep">{fmtMDA(ultimates.reduce((s, u) => s + u.ibnr, 0))}</td>
                  <td className="px-6 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
