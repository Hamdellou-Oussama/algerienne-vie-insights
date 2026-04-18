import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import { SectionCard, Badge } from "@/components/ui/kpi-card";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Eye } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/import")({
  head: () => ({ meta: [{ title: "Import & validation — L'Algérienne Vie" }] }),
  component: ImportPage,
});

const RECENT_IMPORTS = [
  { name: "contrats_emprunteur_T4-2024.xlsx", date: "18/12/2024 14:32", rows: 14267, status: "ok", quality: 98 },
  { name: "sinistres_prevoyance_2024.csv", date: "17/12/2024 10:15", rows: 4287, status: "warn", quality: 87 },
  { name: "triangulation_temporaire_deces.xlsx", date: "16/12/2024 17:08", rows: 56, status: "ok", quality: 100 },
  { name: "primes_voyage_T3-2024.csv", date: "12/12/2024 09:42", rows: 32104, status: "ok", quality: 95 },
];

const VALIDATION_ROWS = [
  { code: "POL-2024-04812", produit: "Prévoyance & Santé", segment: "Particuliers", prime: "84 200 DA", debut: "01/01/2024", fin: "31/12/2024", status: "ok" },
  { code: "POL-2024-04813", produit: "Emprunteur", segment: "Particuliers", prime: "—", debut: "15/02/2024", fin: "14/02/2034", status: "error" },
  { code: "POL-2024-04814", produit: "Voyage", segment: "Entreprises", prime: "12 500 DA", debut: "10/03/2024", fin: "10/03/2025", status: "ok" },
  { code: "POL-2024-04815", produit: "Warda", segment: "Particuliers", prime: "6 800 DA", debut: "05/04/2024", fin: "05/04/2025", status: "warn" },
  { code: "POL-2024-04816", produit: "Accidents Corp.", segment: "Professionnels", prime: "42 100 DA", debut: "12/05/2024", fin: "12/05/2025", status: "ok" },
];

function ImportPage() {
  const [drag, setDrag] = useState(false);
  return (
    <>
      <Topbar title="Import & validation des données" subtitle="Polices, primes, sinistres, triangulation" />
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionCard title="Nouveau dépôt" description="Glissez vos fichiers CSV ou Excel — mappage automatique des colonnes">
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); }}
                className={`border-2 border-dashed rounded-lg py-14 text-center transition-all ${
                  drag ? "border-gold bg-gold-soft/40" : "border-border bg-muted/30"
                }`}
              >
                <UploadCloud className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <div className="font-medium text-foreground mb-1">Glissez vos fichiers ici</div>
                <div className="text-sm text-muted-foreground mb-4">ou</div>
                <button className="bg-gradient-primary text-white px-5 py-2.5 rounded-md text-sm font-medium shadow-soft hover:shadow-elegant transition-all">
                  Sélectionner depuis l'ordinateur
                </button>
                <div className="text-xs text-muted-foreground mt-4">CSV, XLSX · max 50 Mo · UTF-8</div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-5">
                {[
                  { l: "Mappage auto", d: "Colonnes reconnues" },
                  { l: "Validation", d: "Dates, montants, codes" },
                  { l: "Historique", d: "Versions conservées" },
                ].map((c) => (
                  <div key={c.l} className="text-center p-3 bg-muted/40 rounded-md">
                    <div className="text-sm font-medium text-foreground">{c.l}</div>
                    <div className="text-xs text-muted-foreground">{c.d}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Score qualité" description="Dernier import">
            <div className="text-center py-2">
              <div className="font-display text-5xl text-success mb-2">98<span className="text-2xl">%</span></div>
              <div className="text-sm text-muted-foreground">contrats_emprunteur_T4-2024.xlsx</div>
            </div>
            <div className="space-y-2.5 mt-5">
              {[
                ["Lignes valides", "13 982"],
                ["Avertissements", "215"],
                ["Erreurs bloquantes", "70"],
                ["Doublons détectés", "12"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Aperçu de validation" description="Premières lignes du fichier en cours d'analyse">
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left font-medium px-6 py-2">Police</th>
                  <th className="text-left font-medium px-6 py-2">Produit</th>
                  <th className="text-left font-medium px-6 py-2">Segment</th>
                  <th className="text-right font-medium px-6 py-2">Prime nette</th>
                  <th className="text-left font-medium px-6 py-2">Effet</th>
                  <th className="text-left font-medium px-6 py-2">Échéance</th>
                  <th className="text-center font-medium px-6 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {VALIDATION_ROWS.map((r) => (
                  <tr key={r.code} className="border-b border-border last:border-0">
                    <td className="px-6 py-3 font-mono text-xs text-foreground">{r.code}</td>
                    <td className="px-6 py-3 text-foreground">{r.produit}</td>
                    <td className="px-6 py-3 text-muted-foreground">{r.segment}</td>
                    <td className="px-6 py-3 text-right text-foreground">{r.prime}</td>
                    <td className="px-6 py-3 text-muted-foreground">{r.debut}</td>
                    <td className="px-6 py-3 text-muted-foreground">{r.fin}</td>
                    <td className="px-6 py-3 text-center">
                      {r.status === "ok" && <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Valide</Badge>}
                      {r.status === "warn" && <Badge variant="warning"><AlertTriangle className="h-3 w-3" /> Attention</Badge>}
                      {r.status === "error" && <Badge variant="danger"><X className="h-3 w-3" /> Prime manquante</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Historique des imports" description="14 derniers dépôts">
          <div className="space-y-2">
            {RECENT_IMPORTS.map((f) => (
              <div key={f.name} className="flex items-center gap-4 p-3 rounded-md hover:bg-muted transition-colors">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.date} · {f.rows.toLocaleString("fr-FR")} lignes · qualité {f.quality}%</div>
                </div>
                {f.status === "ok"
                  ? <Badge variant="success">OK</Badge>
                  : <Badge variant="warning">Avertissements</Badge>}
                <button className="h-8 w-8 rounded-md hover:bg-muted-foreground/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
