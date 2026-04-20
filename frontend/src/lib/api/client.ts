import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from "./tokens";
import type { TokenEnvelope } from "./types";

const DEFAULT_API_BASE_URL = "/api/v1";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const API_BASE_URL: string = trimTrailingSlash(
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL,
);

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

interface RequestOptions {
  method?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  rawBody?: BodyInit | null;
  headers?: Record<string, string>;
  auth?: boolean;
  signal?: AbortSignal;
  responseType?: "auto" | "json" | "blob";
}

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const env = (await res.json()) as TokenEnvelope;
    storeTokens(env);
    return env.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  let url: URL;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    url = new URL(path);
  } else if (API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")) {
    url = new URL(`${API_BASE_URL}${path}`);
  } else {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    url = new URL(`${API_BASE_URL}${path}`, origin);
  }

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    query,
    body,
    rawBody,
    headers = {},
    auth = true,
    signal,
    responseType = "auto",
  } = opts;
  const url = buildUrl(path, query);

  const doFetch = async (token: string | null): Promise<Response> => {
    const finalHeaders: Record<string, string> = { ...headers };
    if (auth && token) finalHeaders["Authorization"] = `Bearer ${token}`;
    let finalBody: BodyInit | null | undefined = rawBody;
    if (body !== undefined && rawBody === undefined) {
      finalHeaders["Content-Type"] = finalHeaders["Content-Type"] ?? "application/json";
      finalBody = JSON.stringify(body);
    }
    return fetch(url, { method, headers: finalHeaders, body: finalBody, signal });
  };

  const token = auth ? getAccessToken() : null;
  let res = await doFetch(token);

  if (res.status === 401 && auth) {
    refreshInFlight = refreshInFlight ?? performRefresh();
    const newToken = await refreshInFlight;
    refreshInFlight = null;
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      detail = typeof data?.detail === "string" ? data.detail : JSON.stringify(data);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  if (responseType === "blob") return (await res.blob()) as unknown as T;
  if (responseType === "json") return (await res.json()) as T;

  const ctype = res.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) return (await res.json()) as T;
  // fallback: return blob for binary
  return (await res.blob()) as unknown as T;
}

export async function apiFetchBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  return apiFetch<Blob>(path, { ...opts, responseType: "blob" });
}
