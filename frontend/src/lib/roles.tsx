import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Crown, Calculator, FileSpreadsheet, Eye } from "lucide-react";
import { useAuth } from "./api/auth";
import type { BackendRole } from "./api/types";

export type Role = "admin" | "actuaire" | "sinistres" | "auditeur";

export interface RoleInfo {
  key: Role;
  label: string;
  user: string;
  icon: typeof Crown;
  description: string;
}

export const ROLES: Record<Role, RoleInfo> = {
  admin: {
    key: "admin",
    label: "Direction",
    user: "M. Hadj",
    icon: Crown,
    description: "Vue exécutive · validation · audit global",
  },
  actuaire: {
    key: "actuaire",
    label: "Actuaire",
    user: "S. Boukerma",
    icon: Calculator,
    description: "Méthodes · triangulation · IBNR · hypothèses",
  },
  sinistres: {
    key: "sinistres",
    label: "Sinistres",
    user: "K. Lounis",
    icon: FileSpreadsheet,
    description: "Dossiers · PSAP · règlements",
  },
  auditeur: {
    key: "auditeur",
    label: "Auditeur",
    user: "F. Mansouri",
    icon: Eye,
    description: "Lecture seule · traçabilité · exports validés",
  },
};

// Map backend roles onto the existing UI roles (keeps the visual role selector working).
const BACKEND_TO_UI: Record<BackendRole, Role> = {
  ADMIN: "admin",
  HR: "actuaire",
  VIEWER: "auditeur",
};

interface Ctx {
  role: Role;
  setRole: (r: Role) => void;
  info: RoleInfo;
  can: (action: "edit" | "validate" | "export" | "import" | "viewAudit") => boolean;
}

const RoleContext = createContext<Ctx | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [manualRole, setManualRole] = useState<Role | null>(null);

  const role: Role = useMemo(() => {
    if (manualRole) return manualRole;
    if (auth?.user) return BACKEND_TO_UI[auth.user.role] ?? "auditeur";
    return "admin";
  }, [manualRole, auth?.user]);

  const info: RoleInfo = useMemo(() => {
    const base = ROLES[role];
    if (auth?.user && !manualRole) {
      return { ...base, user: auth.user.username };
    }
    return base;
  }, [role, auth?.user, manualRole]);

  const can = (action: Parameters<Ctx["can"]>[0]) => {
    const matrix: Record<Role, Record<typeof action, boolean>> = {
      admin: { edit: true, validate: true, export: true, import: true, viewAudit: true },
      actuaire: { edit: true, validate: false, export: true, import: true, viewAudit: true },
      sinistres: { edit: true, validate: false, export: true, import: false, viewAudit: false },
      auditeur: { edit: false, validate: false, export: true, import: false, viewAudit: true },
    };
    return matrix[role][action];
  };

  return (
    <RoleContext.Provider value={{ role, setRole: setManualRole, info, can }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
