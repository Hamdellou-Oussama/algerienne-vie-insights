import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Layers, Users, Upload, Grid3x3, Calculator,
  TrendingUp, FileText, Scale, ShieldCheck, Download, Settings,
  ChevronRight,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { useRole } from "@/lib/roles";
import type { Role } from "@/lib/roles";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  group: string;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Tableau de bord global", icon: LayoutDashboard, group: "Pilotage" },
  { to: "/app/produits", label: "Branches & Produits", icon: Layers, group: "Pilotage" },
  { to: "/app/segments", label: "Segments clients", icon: Users, group: "Pilotage" },

  { to: "/app/import", label: "Import & validation", icon: Upload, roles: ["admin", "actuaire"], group: "Données" },
  { to: "/app/triangles", label: "Triangulation", icon: Grid3x3, roles: ["admin", "actuaire"], group: "Données" },

  { to: "/app/provisions", label: "Modules de provisionnement", icon: Calculator, group: "Actuariat" },
  { to: "/app/ibnr", label: "Atelier IBNR", icon: TrendingUp, roles: ["admin", "actuaire", "auditeur"], group: "Actuariat" },

  { to: "/app/sinistres", label: "Sinistres & Dossiers", icon: FileText, group: "Opérations" },
  { to: "/app/balance", label: "Synthèse technique", icon: Scale, group: "Opérations" },

  { to: "/app/audit", label: "Audit & traçabilité", icon: ShieldCheck, roles: ["admin", "actuaire", "auditeur"], group: "Gouvernance" },
  { to: "/app/exports", label: "Exports & rapports", icon: Download, group: "Gouvernance" },
  { to: "/app/parametres", label: "Paramètres & hypothèses", icon: Settings, roles: ["admin", "actuaire"], group: "Gouvernance" },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { role } = useRole();
  const visible = NAV.filter((n) => !n.roles || n.roles.includes(role));
  const groups = Array.from(new Set(visible.map((n) => n.group)));

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <Link to="/" className="flex items-center gap-3 px-5 h-20 border-b border-sidebar-border">
        <img src={logo} alt="L'Algérienne Vie" className="h-10 w-auto bg-white/95 rounded-md p-1" />
        <div className="leading-tight">
          <div className="font-display text-base text-sidebar-foreground">L'Algérienne</div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-gold">Vie · Plateforme</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {groups.map((g) => (
          <div key={g}>
            <div className="px-3 mb-2 text-[10px] font-semibold tracking-[0.18em] uppercase text-sidebar-foreground/40">
              {g}
            </div>
            <div className="space-y-0.5">
              {visible.filter((n) => n.group === g).map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === "/app"
                    ? pathname === "/app"
                    : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all relative ${
                      active
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-indicator"
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-gold rounded-r"
                      />
                    )}
                    <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-gold" : ""}`} />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight className="h-3 w-3 text-gold" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="text-[10px] tracking-[0.18em] uppercase text-sidebar-foreground/40 mb-1">
          Inventaire
        </div>
        <div className="text-sm text-sidebar-foreground">31 décembre 2024</div>
        <div className="text-[11px] text-sidebar-foreground/50 mt-2">v2.4.1 · ACAPS conforme</div>
      </div>
    </aside>
  );
}
