import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, BarChart3, FileCheck2, Lock } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "L'Algérienne Vie — Plateforme de provisionnement technique" },
      {
        name: "description",
        content:
          "Pilotage actuariel et opérationnel des modules PPNA, SAP, IBNR, PE et PB avec traçabilité backend.",
      },
    ],
  }),
  component: Landing,
});

const modules = [
  {
    name: "PPNA",
    description: "Provision pour Primes Non Acquises calculée côté backend.",
  },
  {
    name: "SAP",
    description:
      "Provision pour Sinistres À Payer selon les règles déclarées dans le moteur backend.",
  },
  {
    name: "IBNR",
    description: "Réservation Chain Ladder et comparaison de méthodes à partir des runs backend.",
  },
  {
    name: "PE",
    description:
      "Provision d'Égalisation avec coefficients réglementaires chargés depuis la configuration.",
  },
  {
    name: "PB",
    description:
      "Participation aux Bénéfices calculée contrat par contrat selon les paramètres du workbook.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10 h-20">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="L'Algérienne Vie"
              className="h-11 w-auto bg-white/95 rounded-md p-1"
            />
            <div className="leading-tight hidden sm:block">
              <div className="font-display text-base text-white">L'Algérienne</div>
              <div className="text-[10px] tracking-[0.22em] uppercase text-gold">Vie</div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/80">
            <a href="#modules" className="hover:text-gold transition-colors">
              Modules
            </a>
            <a href="#capacites" className="hover:text-gold transition-colors">
              Capacités
            </a>
            <a href="#conformite" className="hover:text-gold transition-colors">
              Conformité
            </a>
          </nav>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-4 py-2 rounded-md text-sm font-semibold shadow-gold hover:shadow-elegant transition-all"
          >
            Accéder à la plateforme <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative bg-gradient-hero text-white pt-32 pb-32 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[500px] h-[500px] rounded-full bg-primary-glow/30 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] tracking-[0.18em] uppercase text-gold mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Source de vérité backend
            </div>
            <h1 className="font-display text-5xl lg:text-6xl leading-[1.05] mb-6">
              Plateforme actuarielle
              <span className="block text-gold">connectée au calcul réel.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed mb-10">
              Les vues frontend sont alimentées par les runs backend et leurs artefacts, avec
              traçabilité complète des paramètres, événements d'audit et sorties par module.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/app"
                className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-6 py-3 rounded-md font-semibold shadow-gold hover:shadow-elegant transition-all"
              >
                Ouvrir le cockpit <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/app/import"
                className="inline-flex items-center gap-2 border border-white/25 text-white px-6 py-3 rounded-md font-medium hover:bg-white/5 transition-colors"
              >
                Importer les fichiers sources
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/15 rounded-xl p-6 shadow-elegant">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] tracking-[0.22em] uppercase text-gold">
                  Modules actifs
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Backend-first
                </span>
              </div>
              <div className="space-y-3">
                {modules.map((module, index) => (
                  <div
                    key={module.name}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{module.name}</span>
                      <span className="text-[11px] text-white/70">module {index + 1}</span>
                    </div>
                    <p className="text-xs text-white/70 mt-1">{module.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="modules" className="py-24 bg-gradient-subtle">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="max-w-2xl mb-12">
            <div className="text-[10px] tracking-[0.22em] uppercase text-gold-deep mb-3">
              Modules
            </div>
            <h2 className="font-display text-4xl text-foreground mb-4">Provisionnement backend</h2>
            <p className="text-muted-foreground">
              Chaque module expose ses résultats via API et alimente directement les pages métier.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((module, index) => (
              <motion.div
                key={module.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="group bg-card border border-border rounded-lg p-6 shadow-soft hover:shadow-elegant hover:border-gold/40 transition-all"
              >
                <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">
                  {module.name}
                </div>
                <h3 className="font-display text-lg text-foreground mb-2">{module.name}</h3>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="capacites" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="text-[10px] tracking-[0.22em] uppercase text-gold-deep mb-3">
                Capacités
              </div>
              <h2 className="font-display text-4xl text-foreground mb-5">
                Une plateforme traçable de bout en bout.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Calcul, audit, exports et visualisations sont alignés sur les mêmes sorties backend.
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
                {
                  i: BarChart3,
                  t: "Méthodes IBNR comparées",
                  d: "Chain Ladder, Mack, BF, Benktander, Bootstrap.",
                },
                {
                  i: ShieldCheck,
                  t: "Conformité réglementaire",
                  d: "Règles explicites et reporting reproductible.",
                },
                {
                  i: FileCheck2,
                  t: "Audit horodaté",
                  d: "Actions, paramètres et sorties historisés.",
                },
                { i: Lock, t: "Gestion des rôles", d: "Accès différenciés ADMIN, HR, VIEWER." },
              ].map((capability, index) => {
                const Icon = capability.i;
                return (
                  <motion.div
                    key={capability.t}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.07 }}
                    className="bg-card border border-border rounded-lg p-5 shadow-soft"
                  >
                    <div className="h-9 w-9 rounded-md bg-gold-soft text-gold-deep flex items-center justify-center mb-3">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-foreground mb-1">{capability.t}</div>
                    <div className="text-sm text-muted-foreground">{capability.d}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="conformite" className="py-20 bg-gradient-primary text-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 text-center">
          <h2 className="font-display text-4xl mb-4">Prêt à explorer la plateforme ?</h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">
            Connectez-vous au cockpit pour lancer les calculs et consulter les résultats backend en
            temps réel.
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
        © 2024 L'Algérienne Vie — Plateforme de provisionnement technique
      </footer>
    </div>
  );
}
