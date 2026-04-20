import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Play,
  Loader2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useDomainDocuments, useUploadDocument, useCreateRun } from "@/lib/api/queries";
import type { Domain, DocumentSummary, UploadResponse } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/api/auth";
import {
  IBNR_METHOD_OPTIONS,
  getRunParametersForDomain,
  getStoredIbnrMethod,
  setStoredIbnrMethod,
} from "@/lib/runParameters";

export const Route = createFileRoute("/app/import")({
  head: () => ({ meta: [{ title: "Import & validation — L'Algérienne Vie" }] }),
  component: ImportPage,
});

const DOMAINS: { key: Domain; label: string; hint: string }[] = [
  { key: "ppna", label: "PPNA", hint: "Primes non acquises" },
  { key: "sap", label: "SAP", hint: "Sinistres à payer" },
  { key: "pe", label: "PE", hint: "Provision d'égalisation" },
  { key: "pb", label: "PB", hint: "Participation bénéficiaire" },
  { key: "ibnr", label: "IBNR", hint: "Triangle de développement" },
];

function ImportPage() {
  const { user } = useAuth();
  const canImportAndRun = user?.role === "ADMIN" || user?.role === "HR";

  const [domain, setDomain] = useState<Domain>("ppna");
  const [drag, setDrag] = useState(false);
  const [selectedIbnrMethod, setSelectedIbnrMethod] = useState(() => getStoredIbnrMethod());
  const [lastUpload, setLastUpload] = useState<UploadResponse | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = useUploadDocument();
  const runMut = useCreateRun();
  const docs = useDomainDocuments(domain);

  const recentDocs = useMemo(() => (docs.data ?? []).slice(0, 8), [docs.data]);

  const handleFile = async (file: File) => {
    setFeedback(null);
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setFeedback({ kind: "err", msg: "Format non supporté — .xlsx uniquement." });
      return;
    }
    if (!canImportAndRun) {
      setFeedback({ kind: "err", msg: "Seuls les profils ADMIN/HR peuvent importer." });
      return;
    }
    try {
      const res = await upload.mutateAsync({ domain, file });
      setLastUpload(res);
      setFeedback({
        kind: "ok",
        msg: `Fichier importé (${res.original_filename}). Vous pouvez lancer le calcul.`,
      });
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Erreur d'import";
      setFeedback({ kind: "err", msg: detail });
    }
  };

  const launchRun = async () => {
    if (!lastUpload) return;
    setFeedback(null);
    try {
      const baseParameters = getRunParametersForDomain(domain);
      const parameters: Record<string, unknown> =
        domain === "ibnr"
          ? { ...baseParameters, selected_method: selectedIbnrMethod }
          : baseParameters;
      const run = await runMut.mutateAsync({
        domain,
        payload: { document_id: lastUpload.document_id, parameters },
      });
      setFeedback({
        kind: run.status === "succeeded" ? "ok" : "err",
        msg:
          run.status === "succeeded"
            ? `Calcul ${domain.toUpperCase()} terminé (run ${run.run_id.slice(0, 12)}…).`
            : `Calcul ${run.status}: ${run.error_message ?? "—"}`,
      });
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Erreur lors du calcul";
      setFeedback({ kind: "err", msg: detail });
    }
  };

  const busy = upload.isPending || runMut.isPending;

  return (
    <>
      <Topbar
        title="Import & validation des données"
        subtitle="Polices, primes, sinistres, triangulation"
      />
      <div className="p-6 lg:p-8 space-y-6">
        {!canImportAndRun && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-md text-xs text-gold-deep">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
            <span>
              Mode lecture seule — seuls les comptes <strong>ADMIN/HR</strong> peuvent importer un
              classeur et déclencher un calcul.
            </span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionCard
              title="Nouveau dépôt"
              description="Classeur XLSX — domaine actuariel au choix · mappage automatique"
              action={
                <div className="flex flex-wrap gap-1.5">
                  {DOMAINS.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setDomain(d.key)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                        domain === d.key
                          ? "bg-gradient-gold text-primary border-transparent shadow-gold"
                          : "bg-card text-muted-foreground border-border hover:border-gold/40"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleFile(f);
                }}
                className={`border-2 border-dashed rounded-lg py-14 text-center transition-all ${
                  drag ? "border-gold bg-gold-soft/40" : "border-border bg-muted/30"
                }`}
              >
                {busy ? (
                  <Loader2 className="h-10 w-10 mx-auto text-primary mb-3 animate-spin" />
                ) : (
                  <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                )}
                <div className="font-medium text-foreground mb-1">
                  {busy ? "Traitement en cours…" : "Glissez votre classeur ici"}
                </div>
                <div className="text-sm text-muted-foreground mb-4">
                  Domaine sélectionné :{" "}
                  <strong>{DOMAINS.find((d) => d.key === domain)?.label}</strong> —{" "}
                  {DOMAINS.find((d) => d.key === domain)?.hint}
                </div>
                {domain === "ibnr" && (
                  <div className="mx-auto max-w-sm mb-4 text-left">
                    <label
                      htmlFor="ibnr-method-import"
                      className="block text-xs text-muted-foreground mb-1"
                    >
                      Méthode IBNR à enregistrer dans le run
                    </label>
                    <select
                      id="ibnr-method-import"
                      value={selectedIbnrMethod}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSelectedIbnrMethod(value);
                        setStoredIbnrMethod(value);
                      }}
                      className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground"
                    >
                      {IBNR_METHOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={busy || !canImportAndRun}
                  className="bg-gradient-primary text-white px-5 py-2.5 rounded-md text-sm font-medium shadow-soft hover:shadow-elegant transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Sélectionner un .xlsx
                </button>
                <div className="text-xs text-muted-foreground mt-4">
                  XLSX uniquement · 15 Mo max
                </div>
              </div>

              {feedback && (
                <div
                  className={`mt-4 flex items-start gap-2 p-3 rounded-md text-xs border ${
                    feedback.kind === "ok"
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {feedback.kind === "ok" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  )}
                  <span>{feedback.msg}</span>
                </div>
              )}

              {lastUpload && (
                <div className="mt-4 flex items-center justify-between p-3 bg-muted/40 rounded-md">
                  <div className="text-xs">
                    <div className="font-semibold text-foreground">
                      {lastUpload.original_filename}
                    </div>
                    <div className="text-muted-foreground">
                      document {lastUpload.document_id.slice(0, 16)}… · version{" "}
                      {lastUpload.version_id.slice(0, 12)}…
                    </div>
                  </div>
                  <button
                    onClick={launchRun}
                    disabled={busy || !canImportAndRun}
                    className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-4 py-2 rounded-md text-xs font-semibold shadow-gold hover:shadow-elegant transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {runMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Lancer le calcul
                  </button>
                </div>
              )}

              <div className="grid sm:grid-cols-3 gap-3 mt-5">
                {[
                  { l: "Mappage auto", d: "Colonnes reconnues" },
                  { l: "Validation", d: "Dates, montants, codes" },
                  { l: "Historique", d: "Versions conservées" },
                ].map((c) => (
                  <div key={c.l} className="text-center p-3 bg-muted/40 rounded-md">
                    <div className="text-sm font-medium text-foreground">{c.l}</div>
                    <div className="text-xs text-muted-foreground">{c.d}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Score qualité" description="Dernier import">
            <div className="text-center py-2">
              <div className="font-display text-5xl text-success mb-2">
                {lastUpload ? "OK" : "—"}
              </div>
              <div className="text-sm text-muted-foreground">
                {lastUpload?.original_filename ?? "Aucun import récent"}
              </div>
            </div>
            <div className="space-y-2.5 mt-5">
              {[
                ["Domaine", (lastUpload?.domain ?? domain).toUpperCase()],
                ["SHA-256", lastUpload ? `${lastUpload.sha256.slice(0, 12)}…` : "—"],
                ["Document", lastUpload ? `${lastUpload.document_id.slice(0, 12)}…` : "—"],
                ["Version", lastUpload ? `${lastUpload.version_id.slice(0, 12)}…` : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground font-mono text-xs">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title={`Historique des imports · ${domain.toUpperCase()}`}
          description={`${recentDocs.length} derniers dépôts enregistrés côté backend`}
        >
          <div className="space-y-2">
            {recentDocs.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Aucun document importé pour ce domaine.
              </div>
            )}
            {recentDocs.map((f: DocumentSummary) => (
              <div
                key={f.document_id}
                className="flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors"
              >
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {f.original_filename}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {f.created_at?.replace("T", " ").slice(0, 16)} · document{" "}
                    {f.document_id.slice(0, 12)}…
                  </div>
                </div>
                <Badge variant={f.status === "ACTIVE" ? "success" : "info"}>{f.status}</Badge>
                <button className="h-8 w-8 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
