import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  Scale,
  ChevronRight,
  FileWarning,
  Shield,
  Coins,
  Award,
  BookOpen,
  Settings,
  ShieldCheck,
  Download,
  LogOut,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useRole } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { useAuth } from "@/lib/api/auth";

interface NavItem {
  to: string;
  label: string;
  sublabel?: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  group: string;
}

const NAV: NavItem[] = [
  {
    to: "/app",
    label: "Tableau de bord",
    sublabel: "Vue globale",
    icon: LayoutDashboard,
    group: "Pilotage",
  },

  {
    to: "/app/ppna",
    label: "PPNA",
    sublabel: "Primes Non Acquises",
    icon: Coins,
    group: "Provisions techniques",
  },
  {
    to: "/app/pe",
    label: "PE",
    sublabel: "Provision d'Égalisation",
    icon: Shield,
    group: "Provisions techniques",
  },
  {
    to: "/app/sap",
    label: "SAP",
    sublabel: "Sinistres À Payer",
    icon: FileWarning,
    group: "Provisions techniques",
  },
  {
    to: "/app/ibnr",
    label: "IBNR",
    sublabel: "Réservation IBNR",
    icon: TrendingUp,
    roles: ["admin", "actuaire", "auditeur"],
    group: "Provisions techniques",
  },
  {
    to: "/app/pb",
    label: "PB",
    sublabel: "Participation aux Bénéfices",
    icon: Award,
    group: "Provisions techniques",
  },

  {
    to: "/app/balance",
    label: "Bilan des sinistres",
    sublabel: "Archivage & impression",
    icon: Scale,
    group: "Bilan & Rapports",
  },

  {
    to: "/app/audit",
    label: "Audit & traçabilité",
    icon: ShieldCheck,
    roles: ["admin", "actuaire", "auditeur"],
    group: "Gouvernance",
  },
  {
    to: "/app/exports",
    label: "Exports & rapports",
    icon: Download,
    group: "Gouvernance",
  },
  {
    to: "/app/parametres",
    label: "Paramètres",
    icon: Settings,
    roles: ["admin", "actuaire"],
    group: "Gouvernance",
  },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { role, info } = useRole();
  const { user, logout } = useAuth();
  const visible = NAV.filter((n) => !n.roles || n.roles.includes(role));
  const groups = Array.from(new Set(visible.map((n) => n.group)));

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      {/* ── Logo header ───────────────────────────────────── */}
      <Link
        to="/"
        className="flex items-center justify-center h-[5rem] border-b border-sidebar-border relative overflow-hidden group"
      >
        {/* Radial gold glow */}
        <div
          className="absolute inset-0 opacity-[0.10] pointer-events-none transition-opacity duration-500 group-hover:opacity-[0.18]"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, var(--gold) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 bg-white/96 rounded-xl p-2 shadow-md ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105">
          <img src={logo} alt="L'Algérienne Vie" className="h-10 w-auto" />
        </div>
      </Link>

      {/* Gold separator */}
      <div className="h-[2px] opacity-70" style={{ background: "var(--gradient-gold)" }} />

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
        {groups.map((g) => (
          <div key={g}>
            <div className="px-3 mb-1.5 text-[9px] font-bold tracking-[0.28em] uppercase text-sidebar-foreground/30 select-none">
              {g}
            </div>

            <div className="space-y-0.5">
              {visible
                .filter((n) => n.group === g)
                .map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group/link relative flex items-center gap-3 px-3 py-[9px] rounded-lg text-sm transition-all duration-200
                      ${
                        active
                          ? "text-sidebar-foreground"
                          : "text-sidebar-foreground/50 hover:text-sidebar-foreground/85 hover:bg-sidebar-accent/30"
                      }`}
                      style={
                        active
                          ? {
                              background:
                                "linear-gradient(90deg, var(--sidebar-accent) 0%, oklch(0.24 0.07 260 / 0.55) 100%)",
                            }
                          : undefined
                      }
                    >
                      {/* Active indicator — 4px gold bar */}
                      {active && (
                        <motion.span
                          layoutId="nav-indicator"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[4px] rounded-r-full"
                          style={{ background: "var(--gradient-gold)" }}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                        />
                      )}

                      <Icon
                        className={`h-[15px] w-[15px] flex-shrink-0 transition-colors ${
                          active ? "text-gold" : "group-hover/link:text-sidebar-foreground/75"
                        }`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-[13px] leading-tight">
                          {item.label}
                        </div>
                        {item.sublabel && (
                          <div
                            className={`text-[10px] truncate leading-tight mt-0.5 ${active ? "text-sidebar-foreground/45" : "text-sidebar-foreground/25"}`}
                          >
                            {item.sublabel}
                          </div>
                        )}
                      </div>

                      {active && <ChevronRight className="h-3 w-3 text-gold/60 flex-shrink-0" />}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom status ─────────────────────────────────── */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="bg-sidebar-accent/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-[9.5px] tracking-[0.16em] uppercase text-sidebar-foreground/35 font-semibold">
              {user ? user.username : "Inventaire clôturé"}
            </span>
          </div>
          <div className="text-sm text-sidebar-foreground font-semibold">
            {user ? user.role : "31 décembre 2024"}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-[9.5px] text-sidebar-foreground/30 font-medium">
              v2.4.1 · ACAPS conforme
            </div>
            <div className="text-[9.5px] text-gold/55 font-semibold truncate max-w-[5.5rem] text-right">
              {info.label}
            </div>
          </div>
        </div>
        {user && (
          <button
            onClick={() => void logout()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Se déconnecter
          </button>
        )}
      </div>
    </aside>
  );
}
