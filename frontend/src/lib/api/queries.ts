import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./endpoints";
import type { Domain } from "./types";

export const qk = {
  me: ["auth", "me"] as const,
  users: ["users"] as const,
  dashboardSummary: ["dashboard", "summary"] as const,
  dashboardAlerts: ["dashboard", "alerts"] as const,
  dashboardTimeline: ["dashboard", "timeline"] as const,
  dashboardCompletion: ["dashboard", "completion"] as const,
  bilanCurrent: ["bilan", "current"] as const,
  bilanHistory: ["bilan", "history"] as const,
  bilanLevel3: ["bilan", "level3"] as const,
  audit: (limit: number) => ["audit", limit] as const,
  domainDocs: (d: Domain) => [d, "documents"] as const,
  documentVersions: (documentId: string) => ["documents", documentId, "versions"] as const,
  domainRuns: (d: Domain, limit: number, offset: number, status?: string) =>
    [d, "runs", limit, offset, status ?? "all"] as const,
  run: (d: Domain, id: string) => [d, "run", id] as const,
  runRows: (d: Domain, id: string) => [d, "run", id, "rows"] as const,
};

const enabledOnAuth = () =>
  typeof window !== "undefined" && !!window.localStorage.getItem("lav.access_token");

export const useMe = () =>
  useQuery({ queryKey: qk.me, queryFn: api.me, enabled: enabledOnAuth(), retry: false });

export const useDashboardSummary = () =>
  useQuery({
    queryKey: qk.dashboardSummary,
    queryFn: api.getDashboardSummary,
    enabled: enabledOnAuth(),
  });

export const useDashboardAlerts = () =>
  useQuery({
    queryKey: qk.dashboardAlerts,
    queryFn: api.getDashboardAlerts,
    enabled: enabledOnAuth(),
  });

export const useDashboardTimeline = () =>
  useQuery({
    queryKey: qk.dashboardTimeline,
    queryFn: api.getDashboardTimeline,
    enabled: enabledOnAuth(),
  });

export const useDashboardCompletion = () =>
  useQuery({
    queryKey: qk.dashboardCompletion,
    queryFn: api.getDashboardCompletion,
    enabled: enabledOnAuth(),
  });

export const useBilanCurrent = () =>
  useQuery({ queryKey: qk.bilanCurrent, queryFn: api.getBilanCurrent, enabled: enabledOnAuth() });

export const useBilanHistory = () =>
  useQuery({ queryKey: qk.bilanHistory, queryFn: api.getBilanHistory, enabled: enabledOnAuth() });

export const useBilanLevel3 = () =>
  useQuery({ queryKey: qk.bilanLevel3, queryFn: api.getBilanLevel3, enabled: enabledOnAuth() });

export const useAuditEvents = (limit = 100) =>
  useQuery({
    queryKey: qk.audit(limit),
    queryFn: () => api.listAuditEvents(limit),
    enabled: enabledOnAuth(),
  });

export const useDomainDocuments = (domain: Domain) =>
  useQuery({
    queryKey: qk.domainDocs(domain),
    queryFn: () => api.listDomainDocuments(domain),
    enabled: enabledOnAuth(),
  });

export const useDocumentVersions = (documentId: string | null | undefined) =>
  useQuery({
    queryKey: qk.documentVersions(documentId ?? ""),
    queryFn: () => api.listDocumentVersions(documentId as string),
    enabled: enabledOnAuth() && !!documentId,
  });

export const useDomainRuns = (
  domain: Domain,
  limit = 20,
  offset = 0,
  status?: "succeeded" | "failed" | "running",
) =>
  useQuery({
    queryKey: qk.domainRuns(domain, limit, offset, status),
    queryFn: () => api.listRuns(domain, limit, offset, status),
    enabled: enabledOnAuth(),
  });

export const useRun = (domain: Domain, runId: string | null | undefined) =>
  useQuery({
    queryKey: qk.run(domain, runId ?? ""),
    queryFn: () => api.getRun(domain, runId as string),
    enabled: enabledOnAuth() && !!runId,
  });

export const useRunRows = <T = unknown>(domain: Domain, runId: string | null | undefined) =>
  useQuery<T>({
    queryKey: qk.runRows(domain, runId ?? ""),
    queryFn: () => api.getRunRows<T>(domain, runId as string),
    enabled: enabledOnAuth() && !!runId,
  });

export const useUsers = () =>
  useQuery({ queryKey: qk.users, queryFn: api.listUsers, enabled: enabledOnAuth() });

export const useUploadDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domain,
      file,
      documentId,
    }: {
      domain: Domain;
      file: File;
      documentId?: string;
    }) => api.uploadDocument(domain, file, documentId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.domainDocs(vars.domain) });
    },
  });
};

export const useCreateRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      domain,
      payload,
    }: {
      domain: Domain;
      payload: { document_id?: string; version_id?: string; parameters?: Record<string, unknown> };
    }) => api.createRun(domain, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [vars.domain] });
      qc.invalidateQueries({ queryKey: qk.dashboardSummary });
      qc.invalidateQueries({ queryKey: qk.dashboardCompletion });
      qc.invalidateQueries({ queryKey: qk.bilanCurrent });
    },
  });
};

export const useCreateBilanSnapshot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBilanSnapshot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.bilanCurrent });
      qc.invalidateQueries({ queryKey: qk.bilanHistory });
    },
  });
};
