import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import { FileText, Download, Eye, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboardSummary } from "@/lib/api/queries";
import { downloadRunArtifactToFile, downloadRunArtifactToXlsx } from "@/lib/download";
import type { Domain } from "@/lib/api/types";

export const Route = createFileRoute("/app/exports")({
  head: () => ({ meta: [{ title: "Exports & rapports — L'Algérienne Vie" }] }),
  component: ExportsPage,
});

const DOMAINS: Domain[] = ["ppna", "sap", "pe", "pb", "ibnr"];

const fmtMDA = (valueInDa: number) =>
  (valueInDa / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " M DA";

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

function ExportsPage() {
  const summaryQuery = useDashboardSummary();
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const latestRuns = useMemo(() => {
    return DOMAINS.map((domain) => {
      const slot = summaryQuery.data?.domains?.[domain];
      if (!slot) return null;
      return {
        domain,
        runId: slot.run_id,
        finishedAt: slot.finished_at,
        total: slot.total,
      };
    }).filter(
      (item): item is { domain: Domain; runId: string; finishedAt: string; total: number } =>
        item !== null,
    );
  }, [summaryQuery.data?.domains]);

  const missingDomains = DOMAINS.filter((domain) => !summaryQuery.data?.domains?.[domain]);

  const onDownload = async (
    domain: Domain,
    runId: string,
    artifactName: string,
    mode: "raw" | "xlsx" = "raw",
  ) => {
    const key = `${domain}:${runId}:${artifactName}:${mode}`;
    try {
      setDownloadingKey(key);
      if (mode === "xlsx") {
        await downloadRunArtifactToXlsx(domain, runId, artifactName);
        return;
      }
      await downloadRunArtifactToFile(domain, runId, artifactName);
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <>
      <Topbar title="Exports & rapports" subtitle="Artefacts réels des runs backend" />
      <div className="p-6 lg:p-8 space-y-6">
        <SectionCard title="Résumé exportable" description="Derniers runs réussis par domaine">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {DOMAINS.map((domain) => {
              const slot = summaryQuery.data?.domains?.[domain];
              return (
                <div key={domain} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                  <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                    {domain}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {slot ? fmtMDA(slot.total) : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {slot ? `Run ${slot.run_id}` : "Aucun run"}
                  </div>
                </div>
              );
            })}
          </div>

          {missingDomains.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Domaines sans run réussi: {missingDomains.join(", ")}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Artefacts disponibles"
          description="Téléchargement direct depuis le backend (JSON ou XLSX)"
        >
          <div className="space-y-2">
            {latestRuns.map((run) => (
              <div
                key={run.runId}
                className="flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors"
              >
                <div className="h-9 w-9 rounded-md bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    Domaine {run.domain.toUpperCase()} · Run {run.runId}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {toDisplayDate(run.finishedAt)} · Total {fmtMDA(run.total)}
                  </div>
                </div>
                <Badge variant="success">Disponible</Badge>
                <button className="h-8 w-8 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDownload(run.domain, run.runId, "result.json")}
                  className="h-8 w-8 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  disabled={downloadingKey === `${run.domain}:${run.runId}:result.json:raw`}
                  title="Télécharger result.json"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDownload(run.domain, run.runId, "rows.json", "xlsx")}
                  className="h-8 w-8 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  disabled={downloadingKey === `${run.domain}:${run.runId}:rows.json:xlsx`}
                  title="Télécharger rows.xlsx"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </button>
              </div>
            ))}

            {latestRuns.length === 0 && !summaryQuery.isLoading && (
              <div className="rounded-md border border-border px-3 py-3 text-sm text-muted-foreground">
                Aucun artefact disponible: aucun run réussi n'a encore été trouvé.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
