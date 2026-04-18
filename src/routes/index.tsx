import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, BarChart3, FileCheck2, Lock } from "lucide-react";
import logo from "@/assets/logo.png";
import { products, kpis, fmtMDA } from "@/lib/mockData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "L'Algérienne Vie — Plateforme de provisionnement technique" },
      { name: "description", content: "Pilotage actuariel et opérationnel des branches Vie & Prévoyance — PPNA, PSAP, IBNR, PRC. Conforme ACAPS." },
      { property: "og:title", content: "L'Algérienne Vie — Plateforme technique" },
      { property: "og:description", content: "Provisionnement, triangulation, IBNR, synthèse technique." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10 h-20">
          <div className="flex items-center gap-3">
            <img src={logo} alt="L'Algérienne Vie" className="h-11 w-auto bg-white/95 rounded-md p-1" />
            <div className="leading-tight hidden sm:block">
              <div className="font-display text-base text-white">L'Algérienne</div>
              <div className="text-[10px] tracking-[0.22em] uppercase text-gold">Vie</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <a href="#produits" className="hover:text-gold transition-colors">Produits</a>
            <a href="#capacites" className="hover:text-gold transition-colors">Capacités</a>
            <a href="#conformite" className="hover:text-gold transition-colors">Conformité</a>
          </nav>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-4 py-2 rounded-md text-sm font-semibold shadow-gold hover:shadow-elegant transition-all"
          >
            Accéder à la plateforme <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-hero text-white pt-32 pb-32 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] rounded-full bg-primary-glow/30 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] tracking-[0.18em] uppercase text-gold mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Inventaire 31 décembre 2024
            </div>
            <h1 className="font-display text-5xl lg:text-6xl leading-[1.05] mb-6">
              La plateforme technique de
              <span className="block text-gold">L'Algérienne Vie.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed mb-10">
              Pilotage des provisions <strong className="text-white">PPNA, PSAP, IBNR et PRC</strong> sur l'ensemble
              de nos branches Vie, Prévoyance, Voyage, Accidents Corporels, Emprunteur et Warda — au service
              de nos particuliers, professionnels et entreprises.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/app"
                className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-6 py-3 rounded-md font-semibold shadow-gold hover:shadow-elegant transition-all"
              >
                Ouvrir le cockpit <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/app/ibnr"
                className="inline-flex items-center gap-2 border border-white/25 text-white px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors"
              >
                Voir l'atelier IBNR
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-14 pt-8 border-t border-white/10 max-w-2xl">
              <div>
                <div className="font-display text-3xl text-gold">{fmtMDA(kpis.totalReserves)}</div>
                <div className="text-xs text-white/60 mt-1 tracking-wide">Provisions techniques</div>
              </div>
              <div>
                <div className="font-display text-3xl text-gold">150 373</div>
                <div className="text-xs text-white/60 mt-1 tracking-wide">Contrats actifs</div>
              </div>
              <div>
                <div className="font-display text-3xl text-gold">6</div>
                <div className="text-xs text-white/60 mt-1 tracking-wide">Branches gérées</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/15 rounded-xl p-6 shadow-elegant">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] tracking-[0.22em] uppercase text-gold">Synthèse cockpit</div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Calculs validés
                </span>
              </div>
              <div className="space-y-4">
                {[
                  { l: "PPNA", v: kpis.ppna, c: "var(--chart-3)" },
                  { l: "PSAP", v: kpis.psap, c: "var(--chart-1)" },
                  { l: "IBNR", v: kpis.ibnr, c: "var(--gold)" },
                  { l: "PRC",  v: kpis.prc,  c: "var(--chart-4)" },
                ].map((row, i) => {
                  const max = kpis.psap;
                  const w = (row.v / max) * 100;
                  return (
                    <div key={row.l}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-white/70">{row.l}</span>
                        <span className="text-white font-medium">{fmtMDA(row.v)}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${w}%` }}
                          transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: row.c }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs text-white/60">Ratio combiné</span>
                <span className="font-display text-2xl text-gold">{(kpis.ratioCombine * 100).toFixed(1)}%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Products */}
      <section id="produits" className="py-24 bg-gradient-subtle">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mb-12">
            <div className="text-[10px] tracking-[0.22em] uppercase text-gold-deep mb-3">Nos branches</div>
            <h2 className="font-display text-4xl text-foreground mb-4">Six gammes de protection</h2>
            <p className="text-muted-foreground">
              Chaque produit dispose de ses propres KPIs, triangles de développement et hypothèses techniques.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p, i) => {
              const Icon = p.icon;
              return (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="group bg-card border border-border rounded-lg p-6 shadow-soft hover:shadow-elegant hover:border-gold/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-11 w-11 rounded-md bg-gradient-primary flex items-center justify-center shadow-sm">
                      <Icon className="h-5 w-5 text-gold" />
                    </div>
                    <span className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground">{p.family}</span>
                  </div>
                  <h3 className="font-display text-lg text-foreground mb-1">{p.shortName}</h3>
                  <p className="text-sm text-muted-foreground mb-5 line-clamp-2">{p.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <div className="text-[10px] tracking-wide uppercase text-muted-foreground">Contrats</div>
                      <div className="text-sm font-semibold text-foreground">{p.contracts.toLocaleString("fr-FR")}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] tracking-wide uppercase text-muted-foreground">Réserves</div>
                      <div className="text-sm font-semibold text-foreground">{fmtMDA(p.reservesMDA)}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section id="capacites" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="text-[10px] tracking-[0.22em] uppercase text-gold-deep mb-3">Capacités</div>
              <h2 className="font-display text-4xl text-foreground mb-5">
                Une plateforme actuariellement crédible.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Six méthodes de réservation IBNR, triangulation interactive, synthèse de bilan technique
                et traçabilité complète des hypothèses et calculs.
              </p>
              <Link
                to="/app"
                className="inline-flex items-center gap-2 text-primary font-semibold hover:text-gold-deep transition-colors"
              >
                Découvrir le cockpit <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
              {[
                { i: BarChart3, t: "6 méthodes IBNR", d: "Chain Ladder, BF, Mack, Munich CL, Bootstrap, Loss Ratio." },
                { i: ShieldCheck, t: "Conformité ACAPS", d: "Rapports normés, snapshots validés, traçabilité." },
                { i: FileCheck2, t: "Audit complet", d: "Toute hypothèse, version et calcul est traçable." },
                { i: Lock, t: "Rôles & permissions", d: "Direction, actuaires, sinistres, auditeurs." },
              ].map((c, i) => {
                const Icon = c.i;
                return (
                  <motion.div
                    key={c.t}
                    initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.07 }}
                    className="bg-card border border-border rounded-lg p-5 shadow-soft"
                  >
                    <div className="h-9 w-9 rounded-md bg-gold-soft text-gold-deep flex items-center justify-center mb-3">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-foreground mb-1">{c.t}</div>
                    <div className="text-sm text-muted-foreground">{c.d}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="conformite" className="py-20 bg-gradient-primary text-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="font-display text-4xl mb-4">
            Prêt à explorer la plateforme ?
          </h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Connectez-vous au cockpit pour visualiser l'ensemble des provisions techniques de l'inventaire en cours.
          </p>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-7 py-3.5 rounded-md font-semibold shadow-gold hover:shadow-elegant transition-all"
          >
            Accéder à la plateforme <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="bg-primary-deep text-white/50 py-8 text-center text-xs">
        © 2024 L'Algérienne Vie — Plateforme de provisionnement technique · Démo hackathon
      </footer>
    </div>
  );
}
