import type { Domain, IbnrMethod } from "@/lib/api/types";

export const IBNR_METHOD_STORAGE_KEY = "lav.ibnr.selected_method";
const RUN_PARAMETERS_STORAGE_KEY = "lav.run_parameters.v1";

export const IBNR_METHOD_OPTIONS: Array<{ value: IbnrMethod; label: string }> = [
  { value: "chain_ladder", label: "Chain Ladder" },
  { value: "mack_chain_ladder", label: "Mack Chain Ladder" },
  { value: "bornhuetter_ferguson", label: "Bornhuetter-Ferguson" },
  { value: "benktander_k2", label: "Benktander k=2" },
  { value: "bootstrap_odp", label: "Bootstrap ODP" },
];

const DOMAINS: Domain[] = ["ppna", "sap", "pe", "pb", "ibnr"];

type DomainParametersStore = Partial<Record<Domain, Record<string, unknown>>>;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function compactParameters(parameters: Record<string, unknown>): Record<string, unknown> {
  const compacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (value == null) {
      continue;
    }
    if (typeof value === "string" && value.trim().length === 0) {
      continue;
    }
    compacted[key] = value;
  }

  return compacted;
}

function readStore(): DomainParametersStore {
  if (!canUseStorage()) {
    return {};
  }

  const raw = window.localStorage.getItem(RUN_PARAMETERS_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    const normalized: DomainParametersStore = {};
    for (const domain of DOMAINS) {
      const value = parsed[domain];
      if (isRecord(value)) {
        normalized[domain] = compactParameters(value);
      }
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeStore(store: DomainParametersStore): void {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(RUN_PARAMETERS_STORAGE_KEY, JSON.stringify(store));
}

export function getAllRunParameters(): Record<Domain, Record<string, unknown>> {
  const store = readStore();
  return {
    ppna: { ...(store.ppna ?? {}) },
    sap: { ...(store.sap ?? {}) },
    pe: { ...(store.pe ?? {}) },
    pb: { ...(store.pb ?? {}) },
    ibnr: { ...(store.ibnr ?? {}) },
  };
}

export function getRunParametersForDomain(domain: Domain): Record<string, unknown> {
  const store = readStore();
  return { ...(store[domain] ?? {}) };
}

export function setRunParametersForDomain(domain: Domain, parameters: Record<string, unknown>): void {
  const store = readStore();
  store[domain] = compactParameters(parameters);
  writeStore(store);
}

export function getStoredIbnrMethod(): string {
  const storedIbnr = getRunParametersForDomain("ibnr");
  const storedMethod = storedIbnr.selected_method;
  if (typeof storedMethod === "string" && storedMethod.trim().length > 0) {
    return storedMethod;
  }

  if (!canUseStorage()) {
    return "chain_ladder";
  }

  return window.localStorage.getItem(IBNR_METHOD_STORAGE_KEY) ?? "chain_ladder";
}

export function setStoredIbnrMethod(method: string): void {
  const ibnrParameters = getRunParametersForDomain("ibnr");
  setRunParametersForDomain("ibnr", {
    ...ibnrParameters,
    selected_method: method,
  });

  if (canUseStorage()) {
    window.localStorage.setItem(IBNR_METHOD_STORAGE_KEY, method);
  }
}
