import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import { auditEvents } from "@/lib/mockData";
import { Download, Filter, ShieldCheck, GitBranch } from "lucide-react";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Audit & traçabilité — L'Algérienne Vie" }] }),
  component: AuditPage,
});

const VERSIONS = [
  { v: "v2.4.1", date: "18/12/2024 14:32", user: "S. Boukerma", change: "Recalcul IBNR Chain Ladder T4", delta: "+1.2%" },
  { v: "v2.4.0", date: "16/12/2024 17:05", user: "S. Boukerma", change: "Import triangulation 2024 complète", delta: "—" },
  { v: "v2.3.5", date: "10/12/2024 09:42", user: "M. Hadj", change: "Validation snapshot T3-2024", delta: "validé" },
  { v: "v2.3.4", date: "08/12/2024 11:15", user: "S. Boukerma", change: "Mise à jour table mortalité TV 88-90", delta: "+0.4%" },
  { v: "v2.3.3", date: "05/12/2024 16:22", user: "S. Boukerma", change: "Hypothèse loss ratio Emprunteur", delta: "-0.8%" },
];

function AuditPage() {
  return (
    <>
      <Topbar title="Audit & traçabilité" subtitle="Historique complet des calculs, hypothèses et validations" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid lg:grid-cols-3 gap-5">
          {[
            { l: "Événements 2024", v: "1 247", h: "Toutes opérations confondues" },
            { l: "Validations", v: "84", h: "Snapshots certifiés" },
            { l: "Conformité ACAPS", v: "100%", h: "Critères respectés", g: true },
          ].map((c) => (
            <div key={c.l} className={`p-5 rounded-lg border shadow-soft ${c.g ? "bg-gradient-primary text-white border-transparent" : "bg-card border-border"}`}>
              <div className={`text-[10px] tracking-[0.18em] uppercase mb-2 ${c.g ? "text-gold" : "text-muted-foreground"}`}>{c.l}</div>
              <div className={`font-display text-3xl ${c.g ? "text-white" : "text-foreground"}`}>{c.v}</div>
              <div className={`text-xs mt-1 ${c.g ? "text-white/60" : "text-muted-foreground"}`}>{c.h}</div>
            </div>
          ))}
        </div>

        <SectionCard
          title="Journal d'activité"
          description="Toutes les opérations sont datées, signées et auditables"
          action={
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-1.5 text-xs bg-card border border-border px-3 py-1.5 rounded-md hover:border-gold/40">
                <Filter className="h-3 w-3" /> Filtrer
              </button>
              <button className="inline-flex items-center gap-1.5 text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant">
                <Download className="h-3 w-3" /> Logs
              </button>
            </div>
          }
        >
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            <div className="space-y-5">
              {auditEvents.map((e) => (
                <div key={e.id} className="relative">
                  <div className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full bg-gold ring-4 ring-background" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                    <span className="text-[11px] text-muted-foreground font-mono">{e.date}</span>
                    <Badge variant={e.status === "validé" ? "success" : e.status === "en cours" ? "warning" : "info"}>{e.status}</Badge>
                  </div>
                  <div className="text-sm text-foreground">
                    <strong>{e.user}</strong> <span className="text-muted-foreground">({e.role})</span> — {e.action}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Cible : {e.target}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Versions des calculs" description="Comparez les écarts entre versions successives" action={<Badge variant="info"><GitBranch className="h-3 w-3" /> 5 versions</Badge>}>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left font-medium px-6 py-2">Version</th>
                  <th className="text-left font-medium px-6 py-2">Date</th>
                  <th className="text-left font-medium px-6 py-2">Utilisateur</th>
                  <th className="text-left font-medium px-6 py-2">Modification</th>
                  <th className="text-right font-medium px-6 py-2">Δ Provisions</th>
                </tr>
              </thead>
              <tbody>
                {VERSIONS.map((v) => (
                  <tr key={v.v} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-3 font-mono text-xs text-foreground">{v.v}</td>
                    <td className="px-6 py-3 text-muted-foreground text-xs">{v.date}</td>
                    <td className="px-6 py-3 text-foreground">{v.user}</td>
                    <td className="px-6 py-3 text-foreground">{v.change}</td>
                    <td className="px-6 py-3 text-right font-mono">
                      <span className={
                        v.delta.startsWith("+") ? "text-warning" :
                        v.delta.startsWith("-") ? "text-success" :
                        "text-muted-foreground"
                      }>{v.delta}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="bg-gradient-primary text-white rounded-lg p-6 flex items-center gap-5 shadow-elegant">
          <ShieldCheck className="h-10 w-10 text-gold flex-shrink-0" />
          <div className="flex-1">
            <div className="font-display text-lg">Certification ACAPS conforme</div>
            <div className="text-sm text-white/70">Tous les calculs intègrent une signature actuarielle vérifiable et un horodatage cryptographique.</div>
          </div>
          <button className="bg-gradient-gold text-primary px-4 py-2 rounded-md text-sm font-semibold shadow-gold">
            Télécharger le certificat
          </button>
        </div>
      </div>
    </>
  );
}
