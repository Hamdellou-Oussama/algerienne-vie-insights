import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock, AlertCircle, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";
import { useAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

type Mode = "login" | "bootstrap";

export function LoginGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, login, bootstrap } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error) setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, username, password]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  if (isAuthenticated) return <>{children}</>;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "bootstrap") {
        await bootstrap(username.trim(), password);
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && mode === "bootstrap") {
          setError("Un administrateur existe déjà. Connectez-vous.");
          setMode("login");
        } else if (err.status === 401) {
          setError("Identifiants incorrects.");
        } else if (err.status === 403) {
          setError("Compte suspendu.");
        } else {
          setError(err.detail || "Erreur serveur.");
        }
      } else {
        setError("Impossible de joindre le serveur.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-hero overflow-hidden flex items-center justify-center px-4">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gold/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] rounded-full bg-primary-glow/30 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-6">
          <img
            src={logo}
            alt="L'Algérienne Vie"
            className="h-12 w-auto bg-white/95 rounded-md p-1.5 mb-4"
          />
          <div className="font-display text-2xl text-white">L'Algérienne Vie</div>
          <div className="text-[11px] tracking-[0.22em] uppercase text-gold mt-1">
            Plateforme technique
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/15 rounded-xl p-7 shadow-elegant">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-md bg-gold-soft text-gold-deep flex items-center justify-center">
              {mode === "bootstrap" ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="font-display text-lg text-white">
                {mode === "bootstrap" ? "Initialiser l'administrateur" : "Connexion"}
              </div>
              <div className="text-[11px] text-white/60">
                {mode === "bootstrap"
                  ? "Création du premier compte admin"
                  : "Accès restreint · bilan technique"}
              </div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] tracking-[0.14em] uppercase text-white/60 font-medium">
                Identifiant
              </label>
              <input
                autoFocus
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/60 focus:bg-white/15 transition-colors"
                placeholder="admin"
                required
                minLength={1}
              />
            </div>
            <div>
              <label className="text-[11px] tracking-[0.14em] uppercase text-white/60 font-medium">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/60 focus:bg-white/15 transition-colors"
                placeholder="••••••••"
                required
                minLength={1}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-gradient-gold text-primary px-4 py-2.5 rounded-md text-sm font-semibold shadow-gold hover:shadow-elegant transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Connexion en cours…"
                : mode === "bootstrap"
                  ? "Créer l'administrateur"
                  : "Se connecter"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-white/60 text-center">
            {mode === "login" ? (
              <>
                Première installation ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("bootstrap")}
                  className="text-gold hover:text-gold-soft underline-offset-2 hover:underline"
                >
                  Initialiser l'admin
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-gold hover:text-gold-soft underline-offset-2 hover:underline"
                >
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 text-center text-[10px] tracking-[0.18em] uppercase text-white/40">
          Conforme ACAPS · bilan technique
        </div>
      </motion.div>
    </div>
  );
}
