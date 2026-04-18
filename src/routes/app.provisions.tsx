import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { kpis, fmtMDA } from "@/lib/mockData";
import { Calculator, Download } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/provisions")({
  head: () => ({ meta: [{ title: "Modules de provisionnement — L'Algérienne Vie" }] }),
  component: ProvisionsPage,
});

const MODULES = [
  {
    key: "ppna", name: "PPNA",
    full: "Provision pour Primes Non Acquises",
    formula: "PPNA = Σ Pₙₑₜₜₑ × (Échéance − Date arrêtée) / (Échéance − Effet)",
    inputs: ["Prime nette", "Date d'effet", "Date d'échéance", "Date d'inventaire"],
    value: kpis.ppna, badge: "validé",
  },
  {
    key: "psap", name: "PSAP",
    full: "Provision pour Sinistres À Payer",
    formula: "PSAP = Σ (Coût estimé − Déjà payé)",
    inputs: ["Dossier sinistre", "Coût estimé", "Règlements partiels"],
    value: kpis.psap, badge: "validé",
  },
  {
    key: "ibnr", name: "IBNR",
    full: "Incurred But Not Reported",
    formula: "IBNR = S_ult − S_obs   (Chain Ladder, BF, Mack…)",
    inputs: ["Triangle de développement", "Méthode actuarielle", "Loss ratio a priori"],
    value: kpis.ibnr, badge: "en cours",
  },
  {
    key: "prc", name: "PRC",
    full: "Provision pour Risques Croissants",
    formula: "PRC = VAP_engagements_assureur − VAP_primes_assuré",
    inputs: ["Tables de mortalité", "Taux technique", "Cohorte d'assurés"],
    value: kpis.prc, badge: "en cours",
  },
  {
    key: "egal", name: "Provision d'Égalisation",
    full: "Lissage des branches volatiles",
    formula: "PE = Provision_n−1 + Dotation_n − Reprise_n",
    inputs: ["Résultats techniques annuels", "Plafond réglementaire"],
    value: 612, badge: "à démarrer",
  },
  {
    key: "pb", name: "Participation aux Bénéfices",
    full: "Distribution réglementaire aux assurés",
    formula: "PB = (Résultat technique + financier) × taux",
    inputs: ["Taux de participation", "Base de calcul", "Date d'attribution"],
    value: 384, badge: "validé",
  },
  {
    key: "fg", name: "Frais de Gestion",
    full: "Provision pour frais futurs",
    formula: "FG = Σ engagements × % frais",
    inputs: ["Coût moyen gestion", "Durée résiduelle"],
    value: 218, badge: "validé",
  },
];

function ProvisionsPage() {
  const [active, setActive] = useState(MODULES[0].key);
  const m = MODULES.find((x) => x.key === active)!;

  return (
    <>
      <Topbar title="Modules de provisionnement" subtitle="Sept modules techniques · formules, hypothèses, sorties" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="PPNA" value={fmtMDA(kpis.ppna)} accent="primary" icon={<Calculator className="h-4 w-4" />} />
          <KpiCard label="PSAP" value={fmtMDA(kpis.psap)} icon={<Calculator className="h-4 w-4" />} />
          <KpiCard label="IBNR" value={fmtMDA(kpis.ibnr)} accent="gold" icon={<Calculator className="h-4 w-4" />} />
          <KpiCard label="PRC" value={fmtMDA(kpis.prc)} icon={<Calculator className="h-4 w-4" />} />
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Tabs */}
          <div className="lg:col-span-3">
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-soft">
              {MODULES.map((mod) => (
                <button
                  key={mod.key}
                  onClick={() => setActive(mod.key)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors ${
                    active === mod.key ? "bg-primary/5 border-l-2 border-l-gold" : "hover:bg-muted"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{mod.name}</div>
                  <div className="text-[11px] text-muted-foreground">{mod.full}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-9 space-y-6">
            <SectionCard
              title={`${m.name} · ${m.full}`}
              description="Formule, entrées requises et sortie courante"
              action={
                <div className="flex items-center gap-2">
                  <Badge variant={m.badge === "validé" ? "success" : m.badge === "en cours" ? "warning" : "info"}>{m.badge}</Badge>
                  <button className="inline-flex items-center gap-1.5 text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-md hover:shadow-elegant">
                    <Download className="h-3 w-3" /> Export
                  </button>
                </div>
              }
            >
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div>
                    <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Formule</div>
                    <div className="bg-primary/5 border border-primary/10 rounded-md p-4 font-mono text-sm text-primary leading-relaxed">
                      {m.formula}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2">Entrées requises</div>
                    <ul className="grid sm:grid-cols-2 gap-2">
                      {m.inputs.map((inp) => (
                        <li key={inp} className="flex items-center gap-2 text-sm text-foreground bg-muted/40 rounded-md px-3 py-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-gold" /> {inp}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="bg-gradient-primary text-white rounded-md p-5 flex flex-col justify-between">
                  <div className="text-[10px] tracking-[0.22em] uppercase text-gold mb-2">Sortie T4-2024</div>
                  <div>
                    <div className="font-display text-4xl">{fmtMDA(m.value)}</div>
                    <div className="text-xs text-white/60 mt-2">Toutes branches confondues</div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Décomposition par branche" description="Contribution de chaque produit au module sélectionné">
              <div className="space-y-3">
                {[
                  { p: "Prévoyance & Santé", v: 0.28 },
                  { p: "Temporaire Décès", v: 0.24 },
                  { p: "Emprunteur", v: 0.21 },
                  { p: "Accidents Corporels", v: 0.14 },
                  { p: "Voyage & Assistance", v: 0.08 },
                  { p: "Warda", v: 0.05 },
                ].map((r) => (
                  <div key={r.p}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-foreground">{r.p}</span>
                      <span className="font-medium text-foreground">{fmtMDA(m.value * r.v)} <span className="text-muted-foreground text-xs ml-1">({(r.v * 100).toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-gold rounded-full" style={{ width: `${r.v * 100 / 0.28}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </>
  );
}
