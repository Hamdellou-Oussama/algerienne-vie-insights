import { useRole, ROLES, type Role } from "@/lib/roles";
import { Bell, Search, ChevronDown, Calendar } from "lucide-react";
import { useState } from "react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { role, setRole, info } = useRole();
  const [open, setOpen] = useState(false);
  const Icon = info.icon;

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-4 px-6 lg:px-8 h-[4.5rem]">

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[1.5rem] font-semibold text-foreground truncate leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5 tracking-wide">{subtitle}</p>
          )}
        </div>

        {/* Date pill */}
        <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-primary/65 bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10 font-medium">
          <Calendar className="h-3 w-3 text-gold" />
          <span className="capitalize">{today}</span>
        </div>

        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-muted/60 px-3.5 py-2 rounded-lg border border-primary/15 hover:border-gold/50 focus-within:border-gold/60 focus-within:bg-card transition-all w-72 shadow-xs">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            placeholder="Contrats, sinistres, branches…"
            className="bg-transparent outline-none text-sm flex-1 text-foreground placeholder:text-muted-foreground/55"
          />
        </div>

        {/* Notifications */}
        <button className="relative h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all border border-transparent hover:border-gold/25 hover:shadow-sm">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-[7px] w-[7px] rounded-full bg-gold ring-2 ring-card shadow-sm" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-muted transition-all border border-transparent hover:border-border hover:shadow-sm"
          >
            {/* Avatar — circular */}
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shadow-sm ring-2 ring-gold/20"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Icon className="h-4 w-4 text-gold" />
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-[13px] font-semibold text-foreground">{info.user}</div>
              <div className="text-[10px] text-muted-foreground font-medium">{info.label}</div>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-76 bg-card border border-border rounded-2xl shadow-elegant overflow-hidden z-50">
                {/* Dropdown header */}
                <div className="relative px-4 py-3.5 border-b border-border overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{ background: "var(--gradient-hero)" }}
                  />
                  <div className="relative text-[9.5px] tracking-[0.22em] uppercase text-muted-foreground font-bold">
                    Démo · sélectionner un rôle
                  </div>
                </div>

                <div className="p-1.5">
                  {(Object.keys(ROLES) as Role[]).map((r) => {
                    const ri = ROLES[r];
                    const RIcon = ri.icon;
                    const active = r === role;
                    return (
                      <button
                        key={r}
                        onClick={() => { setRole(r); setOpen(false); }}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                          active
                            ? "bg-primary/6 ring-1 ring-primary/10 text-foreground"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                            active ? "" : "bg-muted"
                          }`}
                          style={active ? { background: "var(--gradient-gold)" } : undefined}
                        >
                          <RIcon
                            className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-muted-foreground"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0 mt-0.5">
                          <div className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                            {ri.label}
                            {active && (
                              <span className="text-[9.5px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                actif
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {ri.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gold accent line — more visible */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
    </header>
  );
}
