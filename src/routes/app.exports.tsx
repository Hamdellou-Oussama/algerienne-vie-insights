import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import { FileText, Download, Eye, FileSpreadsheet, FileImage } from "lucide-react";
import logo from "@/assets/logo.png";
import { kpis, fmtMDA } from "@/lib/mockData";

export const Route = createFileRoute("/app/exports")({
  head: () => ({ meta: [{ title: "Exports & rapports — L'Algérienne Vie" }] }),
  component: ExportsPage,
});

const REPORTS = [
  { name: "Bilan technique T4-2024", date: "18/12/2024", format: "PDF", size: "2.4 Mo", status: "ready" },
  { name: "Triangulation toutes branches", date: "16/12/2024", format: "XLSX", size: "847 Ko", status: "ready" },
  { name: "Synthèse IBNR — comparaison méthodes", date: "15/12/2024", format: "PDF", size: "1.8 Mo", status: "ready" },
  { name: "Liste des dossiers ouverts", date: "12/12/2024", format: "CSV", size: "312 Ko", status: "ready" },
  { name: "Rapport trimestriel ACAPS", date: "10/12/2024", format: "PDF", size: "5.1 Mo", status: "ready" },
];

function ExportsPage() {
  return (
    <>
      <Topbar title="Exports & rapports" subtitle="Documents officiels à l'image de L'Algérienne Vie" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionCard
              title="Aperçu du rapport"
              description="Bilan technique T4-2024 · prévisualisation"
              action={
                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-1.5 text-xs bg-card border border-border px-3 py-1.5 rounded-md hover:border-gold/40">
                    <FileSpreadsheet className="h-3 w-3" /> Excel
                  </button>
                  <button className="inline-flex items-center gap-1.5 text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant">
                    <Download className="h-3 w-3" /> PDF
                  </button>
                </div>
              }
            >
              {/* Mock branded report preview */}
              <div className="bg-white border border-border rounded-md p-8 shadow-soft" style={{ aspectRatio: "0.77" }}>
                <div className="flex items-center justify-between mb-6 pb-5 border-b-2 border-gold">
                  <img src={logo} alt="" className="h-12" />
                  <div className="text-right">
                    <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Rapport technique</div>
                    <div className="font-display text-foreground">Inventaire au 31/12/2024</div>
                  </div>
                </div>
                <h2 className="font-display text-2xl text-foreground mb-4">Bilan technique trimestriel</h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Synthèse des provisions techniques de L'Algérienne Vie au titre du quatrième trimestre 2024,
                  conforme aux exigences réglementaires de l'ACAPS.
                </p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    ["Provisions techniques", fmtMDA(kpis.totalReserves)],
                    ["PPNA", fmtMDA(kpis.ppna)],
                    ["PSAP", fmtMDA(kpis.psap)],
                    ["IBNR", fmtMDA(kpis.ibnr)],
                  ].map(([k, v]) => (
                    <div key={k} className="border-l-2 border-gold pl-3">
                      <div className="text-[10px] tracking-wide uppercase text-muted-foreground">{k}</div>
                      <div className="font-display text-lg text-foreground">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground border-t border-border pt-4">
                  <strong className="text-foreground">L'Algérienne Vie</strong> · 06 rue ... Alger ·
                  Document généré automatiquement · Page 1 / 24
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Sections à inclure" description="Personnalisez votre rapport">
            <div className="space-y-2.5">
              {[
                "Synthèse exécutive",
                "Détail des provisions",
                "Triangulation",
                "Comparaison méthodes IBNR",
                "Bilan technique",
                "Décomposition par branche",
                "Décomposition par segment",
                "Audit des hypothèses",
                "Annexes réglementaires",
              ].map((s, i) => (
                <label key={s} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-md hover:bg-muted cursor-pointer">
                  <input type="checkbox" defaultChecked={i < 7} className="accent-gold" />
                  <span className="text-sm text-foreground">{s}</span>
                </label>
              ))}
            </div>
            <button className="w-full mt-5 bg-gradient-gold text-primary py-2.5 rounded-md text-sm font-semibold shadow-gold hover:shadow-elegant transition-all">
              Générer le rapport
            </button>
          </SectionCard>
        </div>

        <SectionCard title="Rapports générés" description="Historique des exports">
          <div className="space-y-2">
            {REPORTS.map((r) => (
              <div key={r.name} className="flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors">
                <div className="h-9 w-9 rounded-md bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  {r.format === "PDF" ? <FileText className="h-4 w-4 text-gold" /> :
                   r.format === "XLSX" ? <FileSpreadsheet className="h-4 w-4 text-gold" /> :
                   <FileImage className="h-4 w-4 text-gold" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.date} · {r.format} · {r.size}</div>
                </div>
                <Badge variant="success">Disponible</Badge>
                <button className="h-8 w-8 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Eye className="h-4 w-4" />
                </button>
                <button className="h-8 w-8 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
