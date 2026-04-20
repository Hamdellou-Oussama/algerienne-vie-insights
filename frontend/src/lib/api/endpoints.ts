import { apiFetch, apiFetchBlob } from "./client";
import type {
  AuditEvent,
  BilanCurrent,
  BilanLevel3,
  BilanSnapshot,
  DashboardAlertsResponse,
  DashboardCompletion,
  DashboardSummary,
  DashboardTimelineResponse,
  DocumentVersion,
  DocumentSummary,
  Domain,
  Run,
  TokenEnvelope,
  UploadResponse,
  UserAccount,
} from "./types";

// auth
export const bootstrap = (username: string, password: string) =>
  apiFetch<TokenEnvelope>("/auth/bootstrap", {
    method: "POST",
    body: { username, password },
    auth: false,
  });

export const login = (username: string, password: string) =>
  apiFetch<TokenEnvelope>("/auth/login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });

export const refresh = (refreshToken: string) =>
  apiFetch<TokenEnvelope>("/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
    auth: false,
  });

export const logout = () =>
  apiFetch<{ session_id: string; status: string }>("/auth/logout", { method: "POST" });

export const me = () =>
  apiFetch<{ session_id: string; user_id: string; username: string; role: string; status: string }>(
    "/auth/me",
  );

// users
export const listUsers = () => apiFetch<UserAccount[]>("/users");
export const createUser = (payload: {
  username: string;
  password: string;
  role: string;
  status?: string;
}) => apiFetch<UserAccount>("/users", { method: "POST", body: payload });
export const updateUserRole = (userId: string, role: string) =>
  apiFetch<{ user_id: string; role: string }>(`/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
export const updateUserStatus = (userId: string, status: string) =>
  apiFetch<{ user_id: string; status: string }>(`/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });

// documents
export const listDomainDocuments = (domain: Domain) =>
  apiFetch<DocumentSummary[]>(`/${domain}/documents`);
export const getDomainDocument = (domain: Domain, id: string) =>
  apiFetch<DocumentSummary>(`/${domain}/documents/${id}`);
export const searchDocuments = (q?: string, domain?: Domain) =>
  apiFetch<DocumentSummary[]>("/documents/search", { query: { q, domain } });

export const listDocumentVersions = (documentId: string) =>
  apiFetch<DocumentVersion[]>(`/documents/${documentId}/versions`);

export const downloadDomainDocument = (
  domain: Domain,
  documentId: string,
  fileFormat: "xlsx" | "csv" | "txt",
  versionId?: string,
) =>
  apiFetchBlob(`/${domain}/documents/${documentId}/download/${fileFormat}`, {
    query: { version_id: versionId },
  });

export const uploadDocument = async (
  domain: Domain,
  file: File,
  documentId?: string,
): Promise<UploadResponse> => {
  const buffer = await file.arrayBuffer();
  return apiFetch<UploadResponse>(`/${domain}/documents`, {
    method: "POST",
    query: { filename: file.name, document_id: documentId },
    rawBody: buffer,
    headers: { "Content-Type": "application/octet-stream" },
  });
};

// runs
export const createRun = (
  domain: Domain,
  payload: { document_id?: string; version_id?: string; parameters?: Record<string, unknown> },
) => apiFetch<Run>(`/${domain}/runs`, { method: "POST", body: { parameters: {}, ...payload } });

export const getRun = (domain: Domain, runId: string) => apiFetch<Run>(`/${domain}/runs/${runId}`);
export const getRunRows = <T = unknown>(domain: Domain, runId: string) =>
  apiFetch<T>(`/${domain}/runs/${runId}/rows`);
export const listRuns = (domain: Domain, limit = 20, offset = 0, status?: Run["status"]) =>
  apiFetch<Run[]>(`/${domain}/runs`, { query: { limit, offset, status } });
export const downloadRunArtifact = (domain: Domain, runId: string, artifactName: string) =>
  apiFetchBlob(`/${domain}/runs/${runId}/artifacts/${artifactName}`);

// dashboard / bilan / audit
export const getDashboardSummary = () => apiFetch<DashboardSummary>("/dashboard/summary");
export const getDashboardAlerts = () => apiFetch<DashboardAlertsResponse>("/dashboard/alerts");
export const getDashboardTimeline = () =>
  apiFetch<DashboardTimelineResponse>("/dashboard/timeline");
export const getDashboardCompletion = () => apiFetch<DashboardCompletion>("/dashboard/completion");
export const getBilanCurrent = () => apiFetch<BilanCurrent>("/bilan/current");
export const getBilanHistory = () => apiFetch<BilanSnapshot[]>("/bilan/history");
export const getBilanLevel3 = () => apiFetch<BilanLevel3>("/bilan");
export const createBilanSnapshot = () =>
  apiFetch<BilanSnapshot>("/bilan/snapshots", { method: "POST" });

export const listAuditEvents = (limit = 100) =>
  apiFetch<AuditEvent[]>("/audit/events", { query: { limit } });
export const getAuditEvent = (id: string) => apiFetch<AuditEvent>(`/audit/events/${id}`);

export const getHealth = () => apiFetch<{ status: string }>("/health", { auth: false });
