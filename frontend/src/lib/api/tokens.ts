import type { TokenEnvelope } from "./types";

const ACCESS_KEY = "lav.access_token";
const REFRESH_KEY = "lav.refresh_token";
const USER_KEY = "lav.user";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): TokenEnvelope["user"] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TokenEnvelope["user"];
  } catch {
    return null;
  }
}

export function storeTokens(env: TokenEnvelope): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, env.access_token);
  window.localStorage.setItem(REFRESH_KEY, env.refresh_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(env.user));
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}
