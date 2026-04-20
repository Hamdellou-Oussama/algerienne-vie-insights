// Live data adapters built from backend API responses only.

import {
  useAuditEvents,
  useBilanCurrent,
  useDashboardAlerts,
  useDashboardCompletion,
  useDashboardSummary,
  useDashboardTimeline,
} from "./api/queries";
import type { AuditEvent, DashboardAlert, Domain } from "./api/types";

type LiveKpis = {
  ppna: number;
  psap: number;
  prc: number;
  ibnr: number;
  totalReserves: number;
};

function backendDomainToKpiKey(d: Domain): keyof LiveKpis | null {
  switch (d) {
    case "ppna":
      return "ppna";
    case "sap":
      return "psap";
    case "pe":
      return "prc";
    case "ibnr":
      return "ibnr";
    case "pb":
      return null;
  }
}

export function useLiveKpis() {
  const summary = useDashboardSummary();
  const bilan = useBilanCurrent();

  const next: LiveKpis = {
    ppna: 0,
    psap: 0,
    prc: 0,
    ibnr: 0,
    totalReserves: 0,
  };

  const domains = summary.data?.domains ?? {};
  (["ppna", "sap", "pe", "pb", "ibnr"] as Domain[]).forEach((d) => {
    const slot = domains[d];
    const key = backendDomainToKpiKey(d);
    if (!slot || !key) return;
    next[key] = slot.total / 1_000_000;
  });

  const totalReservesLive = bilan.data?.grand_total;
  if (typeof totalReservesLive === "number") {
    next.totalReserves = totalReservesLive / 1_000_000;
  } else {
    next.totalReserves = next.ppna + next.psap + next.prc + next.ibnr;
  }

  return {
    kpis: next,
    isLive: summary.isSuccess || bilan.isSuccess,
    isLoading: summary.isLoading || bilan.isLoading,
  };
}

export function useLiveAlerts() {
  const q = useDashboardAlerts();
  const palette: Record<
    string,
    { variant: "danger" | "warning" | "info" | "success"; title: string }
  > = {
    missing_run: { variant: "warning", title: "Calcul manquant" },
    assumption_review: { variant: "info", title: "Hypotheses a revoir" },
    data_anomaly: { variant: "danger", title: "Anomalie de donnee" },
    stale_run: { variant: "warning", title: "Run obsolete" },
    success: { variant: "success", title: "Valide" },
  };
  const alerts = (q.data?.alerts ?? []).map((a: DashboardAlert) => {
    const p = palette[a.type] ?? { variant: "info" as const, title: a.type };
    return {
      variant: p.variant,
      title: p.title + (a.domain ? ` · ${a.domain.toUpperCase()}` : ""),
      description: a.message,
    };
  });
  return { alerts, isLive: q.isSuccess && alerts.length > 0, query: q };
}

export function useLiveCompletion() {
  return useDashboardCompletion();
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    login: "Connexion",
    logout: "Deconnexion",
    bootstrap: "Initialisation admin",
    upload_document: "Import document",
    start_calculation_run: "Lancement calcul",
    finish_calculation_run: "Calcul termine",
    fail_calculation_run: "Echec calcul",
    create_bilan_snapshot: "Snapshot bilan",
    create_user: "Creation utilisateur",
    update_user_role: "Mise a jour role",
    update_user_status: "Mise a jour statut",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

function statusLabel(action: string): string {
  if (action.startsWith("create") || action === "upload_document") return "valide";
  if (action === "logout" || action === "login") return "consulte";
  if (action.startsWith("fail")) return "erreur";
  return "en cours";
}

export function useLiveAuditEvents(limit = 100) {
  const q = useAuditEvents(limit);
  const events = (q.data ?? []).map((e: AuditEvent, idx) => ({
    id: idx + 1,
    _raw: e,
    date: e.occurred_at?.replace("T", " ").slice(0, 16) ?? "",
    user: e.actor_user_id,
    role: "-",
    action: actionLabel(e.action),
    target: `${e.target_type}: ${e.target_id}`,
    status: statusLabel(e.action),
  }));
  return {
    events,
    isLive: q.isSuccess,
    query: q,
  };
}

export function useLiveTimeline() {
  return useDashboardTimeline();
}

export function useLiveReserveTimeline() {
  const { kpis, isLive } = useLiveKpis();
  if (!isLive) return [];
  return [
    {
      period: "Courant",
      PPNA: kpis.ppna,
      PSAP: kpis.psap,
      IBNR: kpis.ibnr,
      PRC: kpis.prc,
    },
  ];
}
