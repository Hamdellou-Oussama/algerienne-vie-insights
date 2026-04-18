import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import { Settings, Save } from "lucide-react";

export const Route = createFileRoute("/app/parametres")({
  head: () => ({ meta: [{ title: "Paramètres & hypothèses — L'Algérienne Vie" }] }),
  component: ParametersPage,
});

function Field({ label, value, hint, suffix }: { label: string; value: string; hint?: string; suffix?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
      <div className="flex">
        <input
          defaultValue={value}
          className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold"
        />
        {suffix && (
          <span className="inline-flex items-center px-3 bg-muted border border-l-0 border-border rounded-r-md text-xs text-muted-foreground -ml-px">
            {suffix}
          </span>
        )}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ParametersPage() {
  return (
    <>
      <Topbar title="Paramètres & hypothèses" subtitle="Configuration globale, méthodes par défaut et préférences" />
      <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
        <SectionCard title="Organisation" description="Identité de la compagnie et inventaire courant">
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Raison sociale" value="L'Algérienne Vie" />
            <Field label="Code ACAPS" value="ALG-VIE-2024" />
            <Field label="Date d'inventaire" value="31/12/2024" />
            <Field label="Exercice comptable" value="2024" />
            <Field label="Devise" value="DZD — Dinar Algérien" />
            <Field label="Échelle d'affichage" value="Millions (M)" />
          </div>
        </SectionCard>

        <SectionCard title="Hypothèses actuarielles" description="Valeurs par défaut utilisées dans les calculs">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Field label="Loss ratio cible — Vie" value="55" suffix="%" />
            <Field label="Loss ratio cible — Non-Vie" value="68" suffix="%" />
            <Field label="Taux technique" value="2.50" suffix="%" />
            <Field label="Tail factor" value="1.000" />
            <Field label="Seuil alerte écart méthodes" value="5.0" suffix="%" />
            <Field label="Table de mortalité" value="TV 88-90" hint="Table réglementaire algérienne" />
          </div>
        </SectionCard>

        <SectionCard title="Méthodes par défaut" description="Choix actuariel par branche">
          <div className="space-y-3">
            {[
              ["Prévoyance & Santé", "Mack"],
              ["Voyage & Assistance", "Chain Ladder"],
              ["Accidents Corporels", "Chain Ladder"],
              ["Temporaire Décès", "Mack"],
              ["Emprunteur", "Bornhuetter-Ferguson"],
              ["Warda", "Loss Ratio"],
            ].map(([branche, methode]) => (
              <div key={branche} className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                <span className="text-sm text-foreground font-medium">{branche}</span>
                <select defaultValue={methode} className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground">
                  {["Chain Ladder", "Bornhuetter-Ferguson", "Loss Ratio", "Mack", "Munich Chain Ladder", "Bootstrap"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Préférences interface" description="Affichage et notifications">
          <div className="space-y-3">
            {[
              ["Notifications de validation", true],
              ["Alertes écart entre méthodes", true],
              ["Récap quotidien par e-mail", false],
              ["Affichage en mode dense", false],
            ].map(([k, v]) => (
              <label key={k as string} className="flex items-center justify-between p-3 bg-muted/40 rounded-md cursor-pointer">
                <span className="text-sm text-foreground">{k as string}</span>
                <input type="checkbox" defaultChecked={v as boolean} className="accent-gold h-4 w-4" />
              </label>
            ))}
          </div>
        </SectionCard>

        <div className="flex items-center justify-between bg-gradient-primary text-white rounded-lg p-5 shadow-elegant">
          <div>
            <div className="font-display text-lg">Modifications non sauvegardées</div>
            <div className="text-sm text-white/70">Les changements seront appliqués au prochain calcul.</div>
          </div>
          <button className="inline-flex items-center gap-2 bg-gradient-gold text-primary px-5 py-2.5 rounded-md font-semibold shadow-gold">
            <Save className="h-4 w-4" /> Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}
