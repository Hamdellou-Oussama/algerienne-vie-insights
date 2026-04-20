import { Link, createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { Calculator, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboardSummary, useRun } from "@/lib/api/queries";
import type { Domain } from "@/lib/api/types";
import { downloadRunArtifactToXlsx } from "@/lib/download";

export const Route = createFileRoute("/app/provisions")({
  head: () => ({ meta: [{ title: "Modules de provisionnement — L'Algérienne Vie" }] }),
  component: ProvisionsPage,
});

const fmtMDA = (valueInDa: number) =>
  (valueInDa / 1_000_000).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " M DA";

interface ProvisionModule {
  key: Domain;
  name: string;
  full: string;
  formula: string;
  inputs: string[];
  value: number;
  badge: "validé" | "en cours" | "à démarrer";
  runId: string | null;
  parameters: Record<string, unknown>;
}

const MODULE_METADATA: Record<
  Domain,
  Omit<ProvisionModule, "value" | "badge" | "runId" | "parameters">
> = {
  ppna: {
    key: "ppna",
    name: "PPNA",
    full: "Provision pour Primes Non Acquises",
    formula:
      "contract_days = (echeance - effet) + 1 ; remaining_days = IF(cloture<effet OR cloture>echeance, 0, echeance-cloture) ; PPNA = net_premium * remaining_days / contract_days",
    inputs: ["net_premium", "effect_date", "expiry_date", "closing_date"],
  },
  sap: {
    key: "sap",
    name: "SAP",
    full: "Provision pour Sinistres À Payer",
    formula:
      "if closing_date < declaration_date => 0 ; if declaration_date < closing_date < settlement_notification_date => declared_amount ; else: status REJET => 0, status SAP => declared_amount, otherwise max(0, declared_amount - paid_amount)",
    inputs: [
      "declaration_date",
      "settlement_notification_date",
      "declared_amount",
      "paid_amount",
      "status",
      "closing_date",
    ],
  },
  ibnr: {
    key: "ibnr",
    name: "IBNR",
    full: "Incurred But Not Reported",
    formula:
      "F[j] = SUM(C[i,j]) / SUM(C[i,j-1]) ; projection C[i,j] = F[j] * C[i,j-1] ; reserve_i = ultimate_i - diagonal_i ; IBNR = SUM(reserve_i)",
    inputs: [
      "occurrence_year",
      "declaration_year",
      "claim_amount",
      "closing_year",
      "occurrence_year_window",
    ],
  },
  pe: {
    key: "pe",
    name: "PE",
    full: "Provision d'Égalisation",
    formula:
      "historical_average = (claims_charge_n1 + claims_charge_n2 + claims_charge_n3) / 3 ; component_pos = max(0, technical_result) * positive_result_coefficient ; component_hist = historical_average * historical_average_coefficient ; PE = technical_result>0 ? min(component_pos, component_hist) : 0",
    inputs: [
      "technical_result",
      "claims_charge_n1",
      "claims_charge_n2",
      "claims_charge_n3",
      "positive_result_coefficient",
      "historical_average_coefficient",
    ],
  },
  pb: {
    key: "pb",
    name: "PB",
    full: "Participation aux Bénéfices",
    formula:
      "total_credit = premiums_n + rec_opening + sap_opening ; management_fee_amount = management_fee_rate * premiums_n ; total_debit = claims_paid_n + prec_closing + sap_closing + management_fee_amount + prior_debit_carryover ; credit_balance = total_credit - total_debit ; PB = (loss_ratio<=threshold AND credit_balance>0) ? pb_rate*credit_balance : 0",
    inputs: [
      "premiums_n",
      "rec_opening",
      "sap_opening",
      "claims_paid_n",
      "prec_closing",
      "sap_closing",
      "management_fee_rate",
      "prior_debit_carryover",
      "loss_ratio",
      "loss_ratio_threshold",
      "pb_rate",
    ],
  },
};

function ProvisionsPage() {
  const summaryQuery = useDashboardSummary();
  const runIds = {
    ppna: summaryQuery.data?.domains?.ppna?.run_id ?? null,
    sap: summaryQuery.data?.domains?.sap?.run_id ?? null,
    pe: summaryQuery.data?.domains?.pe?.run_id ?? null,
    pb: summaryQuery.data?.domains?.pb?.run_id ?? null,
    ibnr: summaryQuery.data?.domains?.ibnr?.run_id ?? null,
  };

  const ppnaRun = useRun("ppna", runIds.ppna);
  const sapRun = useRun("sap", runIds.sap);
  const peRun = useRun("pe", runIds.pe);
  const pbRun = useRun("pb", runIds.pb);
  const ibnrRun = useRun("ibnr", runIds.ibnr);

  const modules = useMemo<ProvisionModule[]>(() => {
    const runDataByDomain = {
      ppna: ppnaRun.data,
      sap: sapRun.data,
      pe: peRun.data,
      pb: pbRun.data,
      ibnr: ibnrRun.data,
    } as const;

    return (["ppna", "sap", "ibnr", "pe", "pb"] as Domain[]).map((domain) => {
      const metadata = MODULE_METADATA[domain];
      const slot = summaryQuery.data?.domains?.[domain];
      const run = runDataByDomain[domain];
      return {
        ...metadata,
        value: slot?.total ?? 0,
        badge: slot ? "validé" : "à démarrer",
        runId: slot?.run_id ?? null,
        parameters: (run?.parameters ?? {}) as Record<string, unknown>,
      };
    });
  }, [summaryQuery.data?.domains, ibnrRun.data, pbRun.data, peRun.data, ppnaRun.data, sapRun.data]);

  const [active, setActive] = useState<Domain>("ppna");
  const m = modules.find((item) => item.key === active) ?? modules[0];
  const [isExporting, setIsExporting] = useState(false);

  const total = modules.reduce((sum, module) => sum + module.value, 0);
  const hasAnyRun = modules.some((module) => module.runId);

  const onExportModule = async () => {
    if (!m?.runId) return;
    try {
      setIsExporting(true);
      await downloadRunArtifactToXlsx(m.key, m.runId, "result.json");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      window.alert(`Export impossible: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Topbar
        title="Modules de provisionnement"
        subtitle="Sept modules techniques · formules, hypothèses, sorties"
      />
      <div className="p-6 lg:p-8 space-y-6">
        {!hasAnyRun && !summaryQuery.isLoading && (
          <SectionCard
            title="Aucun run disponible"
            description="Lancez les calculs backend pour alimenter cette vue"
          >
            <p className="text-sm text-muted-foreground">
              Les montants et paramètres affichés ici proviennent exclusivement des runs backend.
            </p>
            <Link
              to="/app/import"
              className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
            >
              Aller à l'import des documents
            </Link>
          </SectionCard>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="PPNA"
            value={fmtMDA(modules.find((x) => x.key === "ppna")?.value ?? 0)}
            accent="primary"
            icon={<Calculator className="h-4 w-4" />}
          />
          <KpiCard
            label="SAP"
            value={fmtMDA(modules.find((x) => x.key === "sap")?.value ?? 0)}
            icon={<Calculator className="h-4 w-4" />}
          />
          <KpiCard
            label="IBNR"
            value={fmtMDA(modules.find((x) => x.key === "ibnr")?.value ?? 0)}
            accent="gold"
            icon={<Calculator className="h-4 w-4" />}
          />
          <KpiCard
            label="PE + PB"
            value={fmtMDA(
              (modules.find((x) => x.key === "pe")?.value ?? 0) +
                (modules.find((x) => x.key === "pb")?.value ?? 0),
            )}
            icon={<Calculator className="h-4 w-4" />}
          />
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Tabs */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-soft">
              {modules.map((mod) => (
                <button
                  key={mod.key}
                  onClick={() => setActive(mod.key)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors ${
                    active === mod.key ? "bg-primary/5 border-l-2 border-l-gold" : "hover:bg-muted"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{mod.name}</div>
                  <div className="text-[11px] text-muted-foreground">{mod.full}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-9 space-y-6">
            <SectionCard
              title={`${m.name} · ${m.full}`}
              description="Formule backend, entrées requises et sortie courante"
              action={
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      m.badge === "validé" ? "success" : m.badge === "en cours" ? "warning" : "info"
                    }
                  >
                    {m.badge}
                  </Badge>
                  <button
                    onClick={onExportModule}
                    disabled={!m?.runId || isExporting}
                    className="inline-flex items-center gap-1.5 text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Download className="h-3 w-3" />
                    {isExporting ? "Export XLSX..." : "Export XLSX"}
                  </button>
                </div>
              }
            >
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div>
                    <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                      Formule
                    </div>
                    <div className="bg-primary/5 border border-primary/10 rounded-md p-4 font-mono text-sm text-primary leading-relaxed">
                      {m.formula}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                      Entrées requises
                    </div>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {m.inputs.map((inp) => (
                        <li
                          key={inp}
                          className="flex items-center gap-2 text-sm text-foreground bg-muted/40 rounded-md px-3 py-2"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {inp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="bg-gradient-primary text-white rounded-md p-5 flex flex-col justify-between">
                  <div className="text-[10px] tracking-[0.22em] uppercase text-gold mb-2">
                    Sortie T4-2024
                  </div>
                  <div>
                    <div className="font-display text-4xl">{fmtMDA(m.value)}</div>
                    <div className="text-xs text-white/60 mt-2">
                      Run: {m.runId ?? "non disponible"}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/20 pt-3">
                    <div className="text-[10px] tracking-[0.18em] uppercase text-white/70 mb-1">
                      Paramètres
                    </div>
                    <div className="text-[11px] text-white/80 break-words">
                      {Object.keys(m.parameters).length === 0
                        ? "(paramètres par défaut)"
                        : JSON.stringify(m.parameters)}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Contribution par module"
              description="Part de chaque module dans le total backend"
            >
              <div className="space-y-3">
                {modules.map((module) => {
                  const share = total > 0 ? module.value / total : 0;
                  return (
                    <div key={module.key}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-foreground">{module.name}</span>
                        <span className="font-medium text-foreground">
                          {fmtMDA(module.value)}{" "}
                          <span className="text-muted-foreground text-xs ml-1">
                            ({(share * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-gold rounded-full"
                          style={{ width: `${Math.max(share * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </>
  );
}
