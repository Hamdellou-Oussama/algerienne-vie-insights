import type { QueryClient } from "@tanstack/react-query";

import { clearTokens } from "@/lib/api/tokens";

export function resetFrontendState(queryClient: QueryClient): void {
  queryClient.clear();
  clearTokens();

  if (typeof window === "undefined") return;

  // Keep the reset scoped to this app by clearing only namespaced local keys.
  const keys = Object.keys(window.localStorage).filter((key) => key.startsWith("lav."));
  keys.forEach((key) => window.localStorage.removeItem(key));

  window.sessionStorage.clear();
}
