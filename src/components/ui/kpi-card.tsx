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
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`relative bg-card border border-border rounded-lg p-5 shadow-soft overflow-hidden group hover:shadow-elegant transition-all ${
        accent === "gold" ? "border-gold/30" : ""
      }`}
    >
      {accent === "gold" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-gold" />
      )}
      {accent === "primary" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-primary" />
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="text-[11px] tracking-[0.14em] uppercase text-muted-foreground font-medium">
          {label}
        </div>
        {icon && (
          <div className={`h-8 w-8 rounded-md flex items-center justify-center ${
            accent === "gold" ? "bg-gold-soft text-gold-deep" :
            accent === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {icon}
          </div>
        )}
      </div>
      <div className="font-display text-3xl text-foreground tracking-tight">{value}</div>
      <div className="flex items-center gap-3 mt-2">
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${
            trend >= 0 ? "text-success" : "text-destructive"
          }`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function SectionCard({
  title, description, action, children, className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-lg shadow-soft ${className}`}>
      <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="font-display text-lg text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function Badge({
  variant = "default", children,
}: {
  variant?: "default" | "success" | "warning" | "danger" | "gold" | "info";
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/15 text-gold-deep border border-warning/30",
    danger: "bg-destructive/10 text-destructive border border-destructive/20",
    gold: "bg-gold-soft text-gold-deep border border-gold/30",
    info: "bg-primary/10 text-primary border border-primary/20",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${styles[variant]}`}>
      {children}
    </span>
  );
}
