import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard } from "@/components/ui/kpi-card";
import type { Domain } from "@/lib/api/types";
import {
  IBNR_METHOD_OPTIONS,
  getAllRunParameters,
  setRunParametersForDomain,
  setStoredIbnrMethod,
} from "@/lib/runParameters";
import { Save, SlidersHorizontal } from "lucide-react";

export const Route = createFileRoute("/app/parametres")({
  head: () => ({ meta: [{ title: "Paramètres & hypothèses — L'Algérienne Vie" }] }),
  component: ParametersPage,
});

type ParametersByDomain = Record<Domain, Record<string, unknown>>;

interface ParametersFormState {
  ppnaClosingDate: string;
  sapClosingDate: string;
  pePositiveResultCoefficient: string;
  peHistoricalAverageCoefficient: string;
  pbDefaultLossRatioThreshold: string;
  pbDefaultPbRate: string;
  pbAllowRowLevelOverride: boolean;
  ibnrSelectedMethod: string;
  ibnrClosingYear: string;
  ibnrOccurrenceStart: string;
  ibnrOccurrenceEnd: string;
  ibnrSegmentByProduct: boolean;
}

function toStringValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function toBooleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function parseOptionalNumber(raw: string, fieldLabel: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} doit etre numerique.`);
  }
  return parsed;
}

function parseOptionalInteger(raw: string, fieldLabel: string): number | undefined {
  const parsed = parseOptionalNumber(raw, fieldLabel);
  if (parsed === undefined) {
    return undefined;
  }
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldLabel} doit etre un entier.`);
  }
  return parsed;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildInitialFormState(): ParametersFormState {
  const all = getAllRunParameters();
  const ibnrWindow = Array.isArray(all.ibnr.occurrence_year_window)
    ? all.ibnr.occurrence_year_window
    : [];
  const rawMethod = toStringValue(all.ibnr.selected_method);
  const method = IBNR_METHOD_OPTIONS.some((option) => option.value === rawMethod)
    ? rawMethod
    : "chain_ladder";

  return {
    ppnaClosingDate: toStringValue(all.ppna.closing_date),
    sapClosingDate: toStringValue(all.sap.closing_date),
    pePositiveResultCoefficient: toStringValue(all.pe.positive_result_coefficient),
    peHistoricalAverageCoefficient: toStringValue(all.pe.historical_average_coefficient),
    pbDefaultLossRatioThreshold: toStringValue(all.pb.default_loss_ratio_threshold),
    pbDefaultPbRate: toStringValue(all.pb.default_pb_rate),
    pbAllowRowLevelOverride: toBooleanValue(all.pb.allow_row_level_override, true),
    ibnrSelectedMethod: method,
    ibnrClosingYear: toStringValue(all.ibnr.closing_year),
    ibnrOccurrenceStart: toStringValue(ibnrWindow[0]),
    ibnrOccurrenceEnd: toStringValue(ibnrWindow[1]),
    ibnrSegmentByProduct: toBooleanValue(all.ibnr.segment_by_product, false),
  };
}

function formatParameters(parameters: Record<string, unknown>): string {
  return Object.keys(parameters).length === 0
    ? "(parametres par defaut)"
    : JSON.stringify(parameters, null, 2);
}

function ParametersPage() {
  const [form, setForm] = useState<ParametersFormState>(() => buildInitialFormState());
  const [savedParameters, setSavedParameters] = useState<ParametersByDomain>(() =>
    getAllRunParameters(),
  );
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const saveParameters = () => {
    setFeedback(null);

    try {
      const ppnaClosingDate = form.ppnaClosingDate.trim();
      const sapClosingDate = form.sapClosingDate.trim();
      if (ppnaClosingDate && !isIsoDate(ppnaClosingDate)) {
        throw new Error("PPNA - Date de cloture doit etre au format YYYY-MM-DD.");
      }
      if (sapClosingDate && !isIsoDate(sapClosingDate)) {
        throw new Error("SAP - Date de cloture doit etre au format YYYY-MM-DD.");
      }

      const pePositiveResultCoefficient = parseOptionalNumber(
        form.pePositiveResultCoefficient,
        "PE - Coefficient resultat positif",
      );
      const peHistoricalAverageCoefficient = parseOptionalNumber(
        form.peHistoricalAverageCoefficient,
        "PE - Coefficient moyenne historique",
      );
      const pbDefaultLossRatioThreshold = parseOptionalNumber(
        form.pbDefaultLossRatioThreshold,
        "PB - Seuil loss ratio",
      );
      const pbDefaultPbRate = parseOptionalNumber(form.pbDefaultPbRate, "PB - Taux PB");
      const ibnrClosingYear = parseOptionalInteger(form.ibnrClosingYear, "IBNR - Closing year");
      const ibnrOccurrenceStart = parseOptionalInteger(
        form.ibnrOccurrenceStart,
        "IBNR - Debut fenetre occurrence",
      );
      const ibnrOccurrenceEnd = parseOptionalInteger(
        form.ibnrOccurrenceEnd,
        "IBNR - Fin fenetre occurrence",
      );

      const onlyOneBoundProvided =
        (ibnrOccurrenceStart === undefined && ibnrOccurrenceEnd !== undefined) ||
        (ibnrOccurrenceStart !== undefined && ibnrOccurrenceEnd === undefined);
      if (onlyOneBoundProvided) {
        throw new Error(
          "IBNR - occurrence_year_window doit contenir debut et fin, ou rester vide.",
        );
      }
      if (
        ibnrOccurrenceStart !== undefined &&
        ibnrOccurrenceEnd !== undefined &&
        ibnrOccurrenceStart > ibnrOccurrenceEnd
      ) {
        throw new Error("IBNR - Debut de fenetre doit etre inferieur ou egal a la fin.");
      }

      const ppnaParameters: Record<string, unknown> = {};
      if (ppnaClosingDate) {
        ppnaParameters.closing_date = ppnaClosingDate;
      }

      const sapParameters: Record<string, unknown> = {};
      if (sapClosingDate) {
        sapParameters.closing_date = sapClosingDate;
      }

      const peParameters: Record<string, unknown> = {};
      if (pePositiveResultCoefficient !== undefined) {
        peParameters.positive_result_coefficient = pePositiveResultCoefficient;
      }
      if (peHistoricalAverageCoefficient !== undefined) {
        peParameters.historical_average_coefficient = peHistoricalAverageCoefficient;
      }

      const pbParameters: Record<string, unknown> = {
        allow_row_level_override: form.pbAllowRowLevelOverride,
      };
      if (pbDefaultLossRatioThreshold !== undefined) {
        pbParameters.default_loss_ratio_threshold = pbDefaultLossRatioThreshold;
      }
      if (pbDefaultPbRate !== undefined) {
        pbParameters.default_pb_rate = pbDefaultPbRate;
      }

      const ibnrParameters: Record<string, unknown> = {
        selected_method: form.ibnrSelectedMethod,
        segment_by_product: form.ibnrSegmentByProduct,
      };
      if (ibnrClosingYear !== undefined) {
        ibnrParameters.closing_year = ibnrClosingYear;
      }
      if (ibnrOccurrenceStart !== undefined && ibnrOccurrenceEnd !== undefined) {
        ibnrParameters.occurrence_year_window = [ibnrOccurrenceStart, ibnrOccurrenceEnd];
      }

      setRunParametersForDomain("ppna", ppnaParameters);
      setRunParametersForDomain("sap", sapParameters);
      setRunParametersForDomain("pe", peParameters);
      setRunParametersForDomain("pb", pbParameters);
      setRunParametersForDomain("ibnr", ibnrParameters);
      setStoredIbnrMethod(form.ibnrSelectedMethod);

      const snapshot = getAllRunParameters();
      setSavedParameters(snapshot);
      setFeedback({
        kind: "ok",
        text: "Parametres enregistres. Ils seront utilises au prochain calcul de chaque domaine.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de validation des parametres.";
      setFeedback({ kind: "err", text: message });
    }
  };

  return (
    <>
      <Topbar
        title="Paramètres & hypothèses"
        subtitle="Parametres persistants envoyes au backend lors des prochains runs"
      />
      <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
        <SectionCard
          title="Parametres backend actifs"
          description="Ces valeurs sont stockees localement puis injectees dans le payload parameters au lancement d'un run"
          action={<SlidersHorizontal className="h-4 w-4 text-muted-foreground" />}
        >
          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                PPNA - Date de cloture
              </label>
              <input
                value={form.ppnaClosingDate}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, ppnaClosingDate: event.target.value }))
                }
                placeholder="YYYY-MM-DD"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                SAP - Date de cloture
              </label>
              <input
                value={form.sapClosingDate}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, sapClosingDate: event.target.value }))
                }
                placeholder="YYYY-MM-DD"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="PE et PB"
          description="Parametres numeriques transmis au moteur de calcul"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                PE - Coefficient resultat positif
              </label>
              <input
                value={form.pePositiveResultCoefficient}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pePositiveResultCoefficient: event.target.value,
                  }))
                }
                placeholder="ex: 0.72"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                PE - Coefficient moyenne historique
              </label>
              <input
                value={form.peHistoricalAverageCoefficient}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    peHistoricalAverageCoefficient: event.target.value,
                  }))
                }
                placeholder="ex: 0.15"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                PB - Seuil loss ratio
              </label>
              <input
                value={form.pbDefaultLossRatioThreshold}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pbDefaultLossRatioThreshold: event.target.value,
                  }))
                }
                placeholder="ex: 0.85"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                PB - Taux PB par defaut
              </label>
              <input
                value={form.pbDefaultPbRate}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, pbDefaultPbRate: event.target.value }))
                }
                placeholder="ex: 0.00"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <label className="flex items-center justify-between p-3 bg-muted/40 rounded-md cursor-pointer sm:col-span-2 lg:col-span-1">
              <span className="text-sm text-foreground">PB - Autoriser override par ligne</span>
              <input
                type="checkbox"
                checked={form.pbAllowRowLevelOverride}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    pbAllowRowLevelOverride: event.target.checked,
                  }))
                }
                className="accent-gold h-4 w-4"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="IBNR" description="Parametres de pilotage et methode selectionnee">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Methode IBNR selectionnee
              </label>
              <select
                value={form.ibnrSelectedMethod}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, ibnrSelectedMethod: event.target.value }))
                }
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground"
              >
                {IBNR_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Closing year
              </label>
              <input
                value={form.ibnrClosingYear}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, ibnrClosingYear: event.target.value }))
                }
                placeholder="ex: 2025"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Fenetre occurrence - debut
              </label>
              <input
                value={form.ibnrOccurrenceStart}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    ibnrOccurrenceStart: event.target.value,
                  }))
                }
                placeholder="ex: 2022"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Fenetre occurrence - fin
              </label>
              <input
                value={form.ibnrOccurrenceEnd}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, ibnrOccurrenceEnd: event.target.value }))
                }
                placeholder="ex: 2025"
                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
              />
            </div>
            <label className="flex items-center justify-between p-3 bg-muted/40 rounded-md cursor-pointer sm:col-span-2 lg:col-span-1">
              <span className="text-sm text-foreground">Segmenter IBNR par produit</span>
              <input
                type="checkbox"
                checked={form.ibnrSegmentByProduct}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    ibnrSegmentByProduct: event.target.checked,
                  }))
                }
                className="accent-gold h-4 w-4"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard
          title="Parametres enregistres par domaine"
          description="Ce bloc montre exactement ce qui sera transmis dans parameters"
        >
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(["ppna", "sap", "pe", "pb", "ibnr"] as Domain[]).map((domain) => (
              <div key={domain} className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {domain}
                </div>
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words text-foreground">
                  {formatParameters(savedParameters[domain] ?? {})}
                </pre>
              </div>
            ))}
          </div>
        </SectionCard>

        {feedback && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              feedback.kind === "ok"
                ? "bg-success/10 border-success/30 text-success"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="flex items-center justify-between bg-gradient-primary text-white rounded-lg p-5 shadow-elegant">
          <div>
            <div className="font-display text-lg">Enregistrer les parametres backend</div>
            <div className="text-sm text-white/70">
              Les changements seront appliques automatiquement au prochain calcul.
            </div>
          </div>
          <button
            onClick={saveParameters}
            className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-5 py-2.5 rounded-md font-semibold shadow-gold"
          >
            <Save className="h-4 w-4" /> Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}
