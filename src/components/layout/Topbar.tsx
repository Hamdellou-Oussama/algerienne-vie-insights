import { useRole, ROLES, type Role } from "@/lib/roles";
import { Bell, Search, ChevronDown } from "lucide-react";
import { useState } from "react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { role, setRole, info } = useRole();
  const [open, setOpen] = useState(false);
  const Icon = info.icon;

  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-4 px-6 lg:px-8 h-20">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 bg-muted px-3 py-2 rounded-md border border-border w-72">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Rechercher contrats, sinistres…"
            className="bg-transparent outline-none text-sm flex-1 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <button className="relative h-10 w-10 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gold" />
        </button>

        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <div className="h-9 w-9 rounded-md bg-gradient-primary flex items-center justify-center shadow-sm">
              <Icon className="h-4 w-4 text-gold" />
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-sm font-medium text-foreground">{info.user}</div>
              <div className="text-[11px] text-muted-foreground">{info.label}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-elegant overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-border bg-muted/40">
                  <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
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
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors ${
                          active ? "bg-primary/5 text-foreground" : "hover:bg-muted"
                        }`}
                      >
                        <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                          active ? "bg-gradient-gold" : "bg-muted"
                        }`}>
                          <RIcon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground flex items-center gap-2">
                            {ri.label}
                            {active && <span className="text-[10px] text-gold-deep">● actif</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
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
    </header>
  );
}
