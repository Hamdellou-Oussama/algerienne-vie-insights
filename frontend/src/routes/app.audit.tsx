import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge, SectionCard } from "@/components/ui/kpi-card";
import { Download, Filter, ShieldCheck, GitBranch } from "lucide-react";
import { useAuditEvents, useDomainRuns } from "@/lib/api/queries";
import type { Domain } from "@/lib/api/types";

export const Route = createFileRoute("/app/audit")({
  head: () => ({ meta: [{ title: "Audit & traçabilité — L'Algérienne Vie" }] }),
  component: AuditPage,
});

const DOMAINS: Domain[] = ["ppna", "sap", "pe", "pb", "ibnr"];

function toDisplayDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditPage() {
  const eventsQuery = useAuditEvents(200);

  const ppnaRuns = useDomainRuns("ppna", 10);
  const sapRuns = useDomainRuns("sap", 10);
  const peRuns = useDomainRuns("pe", 10);
  const pbRuns = useDomainRuns("pb", 10);
  const ibnrRuns = useDomainRuns("ibnr", 10);

  const allRuns = useMemo(() => {
    const rows = [
      ...(ppnaRuns.data ?? []).map((run) => ({ ...run, domain: "ppna" as Domain })),
      ...(sapRuns.data ?? []).map((run) => ({ ...run, domain: "sap" as Domain })),
      ...(peRuns.data ?? []).map((run) => ({ ...run, domain: "pe" as Domain })),
      ...(pbRuns.data ?? []).map((run) => ({ ...run, domain: "pb" as Domain })),
      ...(ibnrRuns.data ?? []).map((run) => ({ ...run, domain: "ibnr" as Domain })),
    ];
    return rows.sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? "")).slice(0, 30);
  }, [ibnrRuns.data, pbRuns.data, peRuns.data, ppnaRuns.data, sapRuns.data]);

  const auditEvents = (eventsQuery.data ?? []).map((event) => ({
    id: event.event_id,
    date: toDisplayDate(event.occurred_at),
    user: event.actor_user_id,
    role: "—",
    action: event.action.replace(/_/g, " "),
    target: `${event.target_type}: ${event.target_id}`,
    status:
      event.action.startsWith("finish") || event.action.startsWith("create")
        ? "validé"
        : event.action.startsWith("fail")
          ? "en erreur"
          : "en cours",
  }));

  const totalEvents = auditEvents.length;
  const validations = auditEvents.filter((event) => event.status === "validé").length;
  const runCount = allRuns.length;

  return (
    <>
      <Topbar
        title="Audit & traçabilité"
        subtitle="Historique complet des calculs, hypothèses et validations"
      />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid lg:grid-cols-3 gap-5">
          {[
            {
              l: "Événements journalisés",
              v: new Intl.NumberFormat("fr-FR").format(totalEvents),
              h: "Toutes opérations confondues",
            },
            {
              l: "Validations",
              v: new Intl.NumberFormat("fr-FR").format(validations),
              h: "Runs terminés et actions certifiées",
            },
            {
              l: "Runs visibles",
              v: new Intl.NumberFormat("fr-FR").format(runCount),
              h: "Historique consolidé des domaines",
              g: true,
            },
          ].map((card) => (
            <div
              key={card.l}
              className={`p-5 rounded-lg border shadow-soft ${
                card.g
                  ? "bg-gradient-primary text-white border-transparent"
                  : "bg-card border-border"
              }`}
            >
              <div
                className={`text-[10px] tracking-[0.18em] uppercase mb-2 ${
                  card.g ? "text-gold" : "text-muted-foreground"
                }`}
              >
                {card.l}
              </div>
              <div className={`font-display text-3xl ${card.g ? "text-white" : "text-foreground"}`}>
                {card.v}
              </div>
              <div className={`text-xs mt-1 ${card.g ? "text-white/60" : "text-muted-foreground"}`}>
                {card.h}
              </div>
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
              {auditEvents.map((event) => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[18px] top-1.5 h-3 w-3 rounded-full bg-gold ring-4 ring-background" />
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {event.date}
                    </span>
                    <Badge
                      variant={
                        event.status === "validé"
                          ? "success"
                          : event.status === "en erreur"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {event.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-foreground">
                    <strong>{event.user}</strong>{" "}
                    <span className="text-muted-foreground">({event.role})</span> — {event.action}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Cible : {event.target}</div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Versions des calculs"
          description="Historique des runs backend"
          action={
            <Badge variant="info">
              <GitBranch className="h-3 w-3" /> {allRuns.length} runs
            </Badge>
          }
        >
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left font-medium px-6 py-2">Run</th>
                  <th className="text-left font-medium px-6 py-2">Domaine</th>
                  <th className="text-left font-medium px-6 py-2">Démarrage</th>
                  <th className="text-left font-medium px-6 py-2">Fin</th>
                  <th className="text-left font-medium px-6 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {allRuns.map((run) => (
                  <tr
                    key={run.run_id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-6 py-3 font-mono text-xs text-foreground">{run.run_id}</td>
                    <td className="px-6 py-3 text-foreground uppercase">{run.domain}</td>
                    <td className="px-6 py-3 text-muted-foreground text-xs">
                      {toDisplayDate(run.started_at)}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground text-xs">
                      {run.finished_at ? toDisplayDate(run.finished_at) : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          run.status === "succeeded"
                            ? "success"
                            : run.status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {run.status}
                      </Badge>
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
            <div className="font-display text-lg">Traçabilité backend active</div>
            <div className="text-sm text-white/70">
              Les opérations affichées sont issues des événements d'audit et des runs de calcul
              backend.
            </div>
          </div>
          <button className="bg-gradient-gold text-primary px-4 py-2 rounded-md text-sm font-semibold shadow-gold">
            Télécharger le journal
          </button>
        </div>
      </div>
    </>
  );
}
