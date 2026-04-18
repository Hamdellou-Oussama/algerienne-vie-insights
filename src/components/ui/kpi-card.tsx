import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
  trend?: number;
  icon?: ReactNode;
  accent?: "default" | "gold" | "primary";
  delay?: number;
}

export function KpiCard({ label, value, hint, trend, icon, accent = "default", delay = 0 }: KpiProps) {
  const isPrimary = accent === "primary";
  const isGold = accent === "gold";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative rounded-2xl overflow-hidden group transition-all duration-300 hover:scale-[1.015] cursor-pointer
        ${isPrimary
          ? "shadow-elegant hover:shadow-lg"
          : isGold
          ? "bg-card shadow-lg border border-gold/25 hover:border-gold/50 hover:shadow-gold"
          : "bg-card border border-border shadow-soft hover:border-primary/30 hover:shadow-md"
        }`}
      style={isPrimary ? { background: "var(--gradient-hero)" } : undefined}
    >
      {/* ── Primary: decorative ring overlay ───────────────── */}
      {isPrimary && (
        <>
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/8 pointer-events-none" />
          <div className="absolute -right-4 -top-4 h-28 w-28 rounded-full border border-white/5 pointer-events-none" />
          <div className="absolute right-6 bottom-2 h-16 w-16 rounded-full border border-white/5 pointer-events-none" />
        </>
      )}

      {/* ── Gold: thick top accent bar ──────────────────────── */}
      {isGold && (
        <div className="absolute top-0 left-0 right-0 h-[4px] rounded-t-2xl" style={{ background: "var(--gradient-gold)" }} />
      )}

      {/* ── Default: navy left border accent ────────────────── */}
      {!isPrimary && !isGold && (
        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary/70 rounded-l-2xl" />
      )}

      <div className="relative p-6">
        {/* Label + Icon row */}
        <div className="flex items-start justify-between mb-5">
          <div
            className={`text-[10px] tracking-[0.20em] uppercase font-bold leading-relaxed max-w-[58%]
              ${isPrimary ? "text-white/55" : "text-muted-foreground"}`}
          >
            {label}
          </div>
          {icon && (
            <div
              className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md
                ${isPrimary
                  ? "bg-white/12 text-gold backdrop-blur-sm"
                  : isGold
                  ? "shadow-gold/30"
                  : "bg-primary/8 text-primary"
                }`}
              style={isGold ? { background: "var(--gradient-gold)" } : undefined}
            >
              <span className={`${isGold ? "text-white" : ""}`}>{icon}</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div
          className={`text-[1.6rem] font-semibold tracking-tight leading-none mb-4 tabular-nums
            ${isPrimary ? "text-white" : isGold ? "text-gold-deep" : "text-foreground"}`}
        >
          {value}
        </div>

        {/* Hint + Trend */}
        <div className="flex items-center gap-2 flex-wrap">
          {hint && (
            <span className={`text-xs ${isPrimary ? "text-white/45" : "text-muted-foreground"}`}>
              {hint}
            </span>
          )}
          {trend !== undefined && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ml-auto
                ${isPrimary
                  ? trend >= 0
                    ? "bg-white/12 text-emerald-300"
                    : "bg-white/12 text-red-300"
                  : trend >= 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-600 border border-red-200"
                }`}
            >
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-2xl shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-gold/30 group/section ${className}`}>
      {/* Header */}
      <div className="relative flex items-start justify-between gap-4 px-6 py-5 border-b border-border bg-card">
        {/* Gold left accent — expands on section hover */}
        <div
          className="absolute left-0 top-2 bottom-2 w-[3.5px] rounded-r-full transition-all duration-200 group-hover/section:top-0 group-hover/section:bottom-0 group-hover/section:w-[4px]"
          style={{ background: "var(--gradient-gold)" }}
        />
        <div className="min-w-0 pl-4">
          <h3 className="font-display text-[1.1rem] font-semibold text-foreground leading-tight">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0 pt-0.5">{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function Badge({
  variant = "default",
  children,
}: {
  variant?: "default" | "success" | "warning" | "danger" | "gold" | "info";
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    default: "bg-muted text-muted-foreground border border-border",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    danger:  "bg-red-50 text-red-600 border border-red-200",
    gold:    "bg-amber-50 text-amber-700 border border-amber-300",
    info:    "bg-blue-50 text-blue-700 border border-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
