export type BackendRole = "ADMIN" | "HR" | "VIEWER";
export type BackendStatus = "ACTIVE" | "SUSPENDED";
export type Domain = "ppna" | "sap" | "pe" | "pb" | "ibnr";

export interface TokenUser {
  user_id: string;
  username: string;
  role: BackendRole;
  status: BackendStatus;
}

export interface TokenEnvelope {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: TokenUser;
}

export interface SessionUser {
  session_id: string;
  user_id: string;
  username: string;
  role: BackendRole;
  status: BackendStatus;
}

export interface UserAccount {
  user_id: string;
  username: string;
  role: BackendRole;
  status: BackendStatus;
  created_at: string;
  created_by: string;
}

export interface DocumentSummary {
  document_id: string;
  domain: Domain;
  original_filename: string;
  created_at: string;
  created_by: string;
  current_version_id: string;
  status: string;
  sha256?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  downloads?: { xlsx: string; csv: string; txt: string };
}

export interface DocumentVersion {
  version_id: string;
  document_id: string;
  sha256: string;
  mime_type: string;
  size_bytes: number;
  storage_path_xlsx: string;
  storage_path_csv: string;
  storage_path_txt: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface UploadResponse {
  document_id: string;
  version_id: string;
  domain: Domain;
  original_filename: string;
  sha256: string;
  downloads: { xlsx: string; csv: string; txt: string };
}

export interface Run {
  run_id: string;
  domain: Domain;
  document_version_id: string;
  parameters: Record<string, unknown>;
  status: "succeeded" | "failed" | "running";
  started_at: string;
  finished_at: string | null;
  started_by: string;
  error_message: string | null;
  artifacts: Record<string, string>;
}

export interface DashboardSummary {
  domains: Record<Domain, { run_id: string; finished_at: string; total: number } | undefined>;
  grand_total: number;
  completed_domains: number;
  expected_domains: number;
}

export interface DashboardAlert {
  type: string;
  domain?: Domain;
  count?: number;
  message: string;
}

export interface DashboardAlertsResponse {
  alerts: DashboardAlert[];
}

export interface TimelineEvent {
  event_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  occurred_at: string;
}

export interface DashboardTimelineResponse {
  events: TimelineEvent[];
}

export interface DashboardCompletion {
  domains: Record<Domain, { completed: boolean }>;
}

export interface BilanCurrent {
  generated_at: string;
  totals: Partial<Record<Domain, number>>;
  grand_total: number;
  source_runs: Partial<Record<Domain, string>>;
}

export interface BilanSnapshot extends BilanCurrent {
  snapshot_id: string;
  created_at: string;
  created_by: string;
  level3?: BilanLevel3 | null;
}

export interface BilanLevel3Year {
  exercice: number;
  en_cours_nbre: number;
  en_cours_montant: number;
  repris_nbre: number;
  repris_montant: number;
  declares_nbre: number;
  declares_montant: number;
  reglements_nbre: number;
  reglements_montant: number;
  rejet_nbre: number;
  rejet_montant: number;
  reevaluation_pos: number;
  reevaluation_neg: number;
  reserves_nbre: number;
  reserves_montant: number;
  reserves_montant_old_signed?: number;
  reserves_montant_delta_new_minus_old_signed?: number;
  verif_diff: number;
  verif_ok: boolean;
}

export interface BilanReserveTotalsComparison {
  total_reserves_new: number;
  total_reserves_old_signed: number;
  delta_new_minus_old_signed: number;
}

export interface BilanReserveDeltaByYear {
  exercice: number;
  delta_new_minus_old_signed: number;
}

export interface BilanLevel3 {
  generated_at: string;
  scope_mode: string;
  sap_method?: string;
  sap_legacy_reference_method?: string;
  years: BilanLevel3Year[];
  total_reserves: number;
  reserve_totals_comparison?: BilanReserveTotalsComparison;
  reserves_delta_by_year?: BilanReserveDeltaByYear[];
  all_years_balanced: boolean;
  source: string;
}

export type IbnrMethod =
  | "chain_ladder"
  | "mack_chain_ladder"
  | "bornhuetter_ferguson"
  | "benktander_k2"
  | "bootstrap_odp";

export interface IbnrMethodComparisonRow {
  method: IbnrMethod | string;
  total_ibnr: number;
  difference_vs_chain_ladder: number;
  pct_difference_vs_chain_ladder: number;
  se_or_p95: number | null;
}

export interface IbnrMethodComparisonPayload {
  chain_ladder_total: number;
  method_range: number;
  comparison_rows: IbnrMethodComparisonRow[];
}

export interface AuditEvent {
  event_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  occurred_at: string;
  ip_address?: string;
  user_agent?: string;
  payload_json?: string;
  payload?: Record<string, unknown>;
  previous_event_hash?: string | null;
  event_hash?: string;
}
