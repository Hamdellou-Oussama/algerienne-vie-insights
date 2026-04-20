import { useMemo, useState } from "react";
import { Play, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/lib/api/auth";
import { useCreateRun, useDashboardSummary, useDomainDocuments } from "@/lib/api/queries";
import type { Domain } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { getRunParametersForDomain, getStoredIbnrMethod } from "@/lib/runParameters";

const fmtMDA = (valueInDa: number) =>
  (valueInDa / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " M DA";

const LABEL: Record<Domain, string> = {
  ppna: "PPNA · Primes non acquises",
  sap: "SAP · Sinistres à payer",
  pe: "PE · Provision d'égalisation",
  pb: "PB · Participation bénéficiaire",
  ibnr: "IBNR · Triangles de développement",
};

export function DomainRunBanner({ domain }: { domain: Domain }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const summary = useDashboardSummary();
  const docs = useDomainDocuments(domain);
  const runMut = useCreateRun();

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const slot = summary.data?.domains?.[domain];
  const latestDoc = useMemo(() => (docs.data ?? [])[0], [docs.data]);

  const launch = async () => {
    if (!latestDoc) {
      setMsg({ kind: "err", text: "Aucun document disponible — importez d'abord un classeur." });
      return;
    }
    setMsg(null);
    try {
      const parameters = getRunParametersForDomain(domain);
      if (domain === "ibnr" && typeof parameters.selected_method !== "string") {
        parameters.selected_method = getStoredIbnrMethod();
      }
      const run = await runMut.mutateAsync({
        domain,
        payload: { document_id: latestDoc.document_id, parameters },
      });
      setMsg(
        run.status === "succeeded"
          ? { kind: "ok", text: `Calcul terminé · run ${run.run_id.slice(0, 12)}…` }
          : { kind: "err", text: `Calcul ${run.status}: ${run.error_message ?? "—"}` },
      );
    } catch (err) {
      setMsg({
        kind: "err",
        text: err instanceof ApiError ? err.detail : "Erreur lors du calcul",
      });
    }
  };

  const isLoading = summary.isLoading || docs.isLoading;

  return (
    <div className="mx-6 lg:mx-8 mt-4 rounded-lg border border-border bg-card/80 backdrop-blur-sm shadow-soft">
      <div className="flex flex-wrap items-center gap-4 px-5 py-3">
        <div className="h-9 w-9 rounded-md bg-gradient-primary flex items-center justify-center shadow-sm">
          <FileSpreadsheet className="h-4 w-4 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            État backend
          </div>
          <div className="text-sm font-semibold text-foreground truncate">{LABEL[domain]}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {isLoading
              ? "Chargement…"
              : slot
                ? `Dernier run : ${slot.run_id.slice(0, 12)}… · ${slot.finished_at?.slice(0, 16).replace("T", " ")}`
                : "Aucun run enregistré pour ce domaine."}
            {latestDoc ? ` · Document : ${latestDoc.original_filename}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {slot && (
            <div className="text-right">
              <div className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                Provision
              </div>
              <div className="font-display text-lg text-foreground tabular-nums">
                {fmtMDA(slot.total)}
              </div>
            </div>
          )}
          <button
            onClick={launch}
            disabled={!isAdmin || runMut.isPending || !latestDoc}
            className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-3.5 py-2 rounded-md text-xs font-semibold shadow-gold hover:shadow-elegant transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              !isAdmin
                ? "Réservé aux administrateurs"
                : !latestDoc
                  ? "Importez d'abord un classeur"
                  : "Relancer le calcul sur le dernier document"
            }
          >
            {runMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Relancer
          </button>
        </div>
      </div>
      {msg && (
        <div
          className={`px-5 pb-3 text-xs flex items-center gap-2 ${
            msg.kind === "ok" ? "text-success" : "text-destructive"
          }`}
        >
          {msg.kind === "ok" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {msg.text}
        </div>
      )}
    </div>
  );
}
