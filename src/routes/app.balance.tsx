import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/layout/Topbar";
import {
  bilans, totalRow, verifRow,
  type Bilan, type BilanRow,
} from "@/lib/bilanData";
import { useState, useCallback } from "react";
import { Lock, Printer, CheckCircle2, Clock, FileText, ShieldCheck, AlertTriangle, Upload } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/app/balance")({
  head: () => ({ meta: [{ title: "Bilan des sinistres — L'Algérienne Vie" }] }),
  component: BilanPage,
});

// ── Formatters ───────────────────────────────────────────────
const fmtM = (v: number) =>
  v === 0 ? "—" : (v / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (v: number) => (v === 0 ? "—" : v.toLocaleString("fr-FR"));

function statusInfo(s: Bilan["status"]) {
  if (s === "archive") return { label: "Archivé",   color: "text-blue-700 bg-blue-50 border-blue-200",   dot: "bg-blue-500" };
  if (s === "valide")  return { label: "Validé",    color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  return                      { label: "Brouillon", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-400" };
}

// ── Table row ────────────────────────────────────────────────
function Row({ row, isTotal }: { row: BilanRow; isTotal?: boolean }) {
  const v = isTotal ? { nbreOk: true, montantOk: true } : verifRow(row);
  const bg = isTotal ? "bg-primary/6 font-semibold" : "even:bg-muted/20 hover:bg-muted/40 transition-colors";

  const td = "px-2.5 py-2 text-xs tabular-nums";
  const num  = `${td} text-center text-foreground`;
  const amt  = `${td} text-right text-foreground`;
  const amtG = `${td} text-right text-emerald-700`;
  const amtR = `${td} text-right text-red-600`;
  const amtB = `${td} text-right text-primary font-medium`;

  return (
    <tr className={`border-t border-border/60 ${bg}`}>
      <td className={`${td} font-semibold text-foreground border-r border-border sticky left-0 bg-inherit`}>
        {isTotal ? "TOTAL" : row.exercice}
      </td>
      {/* Ouverture */}
      <td className={`${num} border-l border-border/30`}>{fmtN(row.ouverture.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.ouverture.montant)}</td>
      {/* Repris */}
      <td className={`${num} border-l border-border/30`}>{fmtN(row.repris.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.repris.montant)}</td>
      {/* Déclarés */}
      <td className={`${num} border-l border-border/30`}>{fmtN(row.declares.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.declares.montant)}</td>
      {/* Règlements */}
      <td className={`${num} border-l border-border/30`}>{fmtN(row.reglements.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.reglements.montant)}</td>
      {/* C/SS */}
      <td className={`${num} border-l border-border/30`}>{fmtN(row.css.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.css.montant)}</td>
      {/* Réévaluation */}
      <td className={`${amtG} border-l border-border/30`}>{fmtM(row.reeval.positif)}</td>
      <td className={`${amtR} border-r border-border`}>{fmtM(row.reeval.negatif)}</td>
      {/* Réserves */}
      <td className={`${num} border-l border-border/30 font-medium`}>{fmtN(row.reserves.nbre)}</td>
      <td className={`${amtB} border-r border-border`}>{fmtM(row.reserves.montant)}</td>
      {/* Vérif */}
      <td className="px-2 py-2 text-center border-l border-border/30">
        <Chip ok={v.nbreOk} />
      </td>
      <td className="px-2 py-2 text-center">
        <Chip ok={v.montantOk} />
      </td>
    </tr>
  );
}

function Chip({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">OK</span>
    : <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">ERR</span>;
}

// ── Column group header ──────────────────────────────────────
const groups = [
  { label: "Dossiers en cours",  sub: ["Nbre", "Montant (M DA)"],  cols: 2, shade: false },
  { label: "S/S repris",         sub: ["Nbre", "Montant (M DA)"],  cols: 2, shade: true  },
  { label: "Déclarés",           sub: ["Nbre", "Montant (M DA)"],  cols: 2, shade: false },
  { label: "Règlements",         sub: ["Nbre", "Montant (M DA)"],  cols: 2, shade: true  },
  { label: "Classés S/S",        sub: ["Nbre", "Montant (M DA)"],  cols: 2, shade: false },
  { label: "Réévaluation",       sub: ["+ (M DA)", "− (M DA)"],    cols: 2, shade: true  },
  { label: "Réserves clôture",   sub: ["Nbre", "Montant (M DA)"],  cols: 2, shade: false },
  { label: "Vérif",              sub: ["Nbre", "Mnt"],             cols: 2, shade: true  },
];

// ── Main page ────────────────────────────────────────────────
function BilanPage() {
  const [selectedId, setSelectedId] = useState(bilans[bilans.length - 1].id);
  const [importing, setImporting] = useState(false);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target!.result as ArrayBuffer, { type: "array" });
        // Just notify user — full parsing would create a new brouillon entry
        alert(`Fichier "${file.name}" reçu (${wb.SheetNames.length} feuilles). Intégration dans le pipeline de bilan en cours de développement.`);
      } catch {
        alert("Erreur de lecture du fichier.");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, []);
  const selected = bilans.find(b => b.id === selectedId)!;
  const isLocked = selected.status === "archive";
  const totaux   = totalRow(selected.rows);

  return (
    <>
      <Topbar title="Bilan des sinistres" subtitle="Traçabilité · Archivage immuable · Impression" />

      <div className="flex flex-1 min-h-0 overflow-hidden print:block print:overflow-visible print:h-auto">

        {/* ── LEFT: history list ──────────────────────────── */}
        <aside className="w-56 flex-shrink-0 border-r border-border bg-card flex flex-col print:hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-muted-foreground">
              Historique
            </span>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {[...bilans].reverse().map(b => {
              const s = statusInfo(b.status);
              const active = b.id === selectedId;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-3
                    ${active ? "bg-primary/8 ring-1 ring-primary/15" : "hover:bg-muted/50"}`}
                >
                  <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12.5px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                      Exercice {b.periodeClôture.slice(-4)}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    </div>
                  </div>
                  {b.status === "archive" && <Lock className="h-2.5 w-2.5 text-muted-foreground/40 flex-shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* Import button */}
          <div className="p-3 border-t border-border">
            <label className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all
              ${importing ? "opacity-50 cursor-not-allowed" : "bg-primary/8 text-primary hover:bg-primary/15 border border-primary/15 hover:border-primary/30"}`}>
              <Upload className="h-3.5 w-3.5" />
              {importing ? "Import…" : "Importer nouveau bilan"}
              <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={handleImport} disabled={importing} />
            </label>
          </div>
        </aside>

        {/* ── RIGHT: bilan detail ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto print:overflow-visible">

          {/* Status banner */}
          {isLocked ? (
            <div className="flex items-center gap-2.5 px-5 py-2.5 bg-blue-50 border-b border-blue-100 print:hidden">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <strong>Archivé et verrouillé</strong> — lecture et impression uniquement.
                Verrouillé le <strong>{selected.lockedAt}</strong> par {selected.lockedBy}.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-5 py-2.5 bg-amber-50 border-b border-amber-100 print:hidden">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>Brouillon</strong> — données partielles au {selected.dateGeneration}.
                Ce bilan sera verrouillé après validation par la direction.
              </p>
            </div>
          )}

          {/* ── Printable document ────────────────────────── */}
          <div className="p-5 print:p-0 print:m-0">

            {/* Screen: header + print button */}
            <div className="flex items-start justify-between mb-5 print:hidden">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-lg font-bold text-foreground">{selected.titre}</h2>
                  <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${statusInfo(selected.status).color}`}>
                    {statusInfo(selected.status).label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selected.produit} · {selected.branche} ·
                  Période {selected.periodeOuverture} → {selected.periodeClôture} ·
                  Généré le {selected.dateGeneration}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Source : <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{selected.source}</code>
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground
                  text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm flex-shrink-0"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimer / PDF
              </button>
            </div>

            {/* Print: document header */}
            <div className="hidden print:block mb-5">
              <div className="flex justify-between items-end pb-3 border-b-2 border-primary mb-3">
                <div>
                  <div className="text-[8pt] font-bold text-primary tracking-widest uppercase mb-0.5">
                    L'Algérienne Vie · Direction Technique
                  </div>
                  <div className="text-[13pt] font-bold text-foreground">{selected.titre}</div>
                  <div className="text-[8pt] text-muted-foreground mt-0.5">
                    {selected.produit} · {selected.branche}
                  </div>
                </div>
                <div className="text-right text-[7.5pt] text-muted-foreground leading-relaxed">
                  <div>Période : <strong>{selected.periodeOuverture} → {selected.periodeClôture}</strong></div>
                  <div>Généré le : {new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</div>
                  <div>Source : {selected.source}</div>
                  {isLocked && <div className="text-blue-700 font-semibold mt-0.5">Archivé · Verrouillé le {selected.lockedAt}</div>}
                </div>
              </div>
              <div className="text-[7.5pt] text-muted-foreground italic">
                Montants en millions de dinars algériens (M DA) · Vérif = Ouverture + Repris + Déclarés − Réglements − C/SS ± Réévaluation = Réserves
              </div>
            </div>

            {/* ── The table ─────────────────────────────────── */}
            <div className="rounded-xl border border-border overflow-hidden shadow-sm print:rounded-none print:shadow-none print:border-0">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse text-xs print:text-[7.5pt] print:w-full">
                  <thead>
                    {/* Row 1: group labels */}
                    <tr className="bg-primary text-white text-[9.5px] print:text-[7pt] font-bold uppercase tracking-[0.08em]">
                      <th
                        rowSpan={2}
                        className="px-3 py-2.5 text-left border-r border-white/20 w-16 sticky left-0 bg-primary z-10 print:static"
                      >
                        Exercice
                      </th>
                      {groups.map((g, i) => (
                        <th
                          key={i}
                          colSpan={g.cols}
                          className={`px-2 py-2 text-center border-r border-white/20 last:border-r-0 whitespace-nowrap
                            ${g.shade ? "bg-primary/90" : "bg-primary"}`}
                        >
                          {g.label}
                        </th>
                      ))}
                    </tr>
                    {/* Row 2: sub-labels */}
                    <tr className="text-[8.5px] print:text-[6.5pt] font-semibold text-white/80">
                      {groups.map((g, gi) =>
                        g.sub.map((s, si) => (
                          <th
                            key={`${gi}-${si}`}
                            className={`px-2 py-1.5 text-center border-r border-white/10 last:border-r-0
                              ${g.shade ? "bg-primary/80" : "bg-primary/70"}`}
                          >
                            {s}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {selected.rows.map((row, idx) => (
                      <Row key={row.exercice} row={row} />
                    ))}
                    {/* Spacer before total */}
                    <tr className="h-0 border-t-2 border-primary/30" />
                    <Row row={totaux} isTotal />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Screen legend */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10.5px] text-muted-foreground print:hidden">
              <span>Montants en <strong>M DA</strong> (millions de dinars)</span>
              <span>Vérif : Ouverture + Repris + Déclarés − Règlements − C/SS ± Rééval = Réserves</span>
              {isLocked && <span className="flex items-center gap-1 text-blue-600"><Lock className="h-2.5 w-2.5" /> Bilan verrouillé — lecture seule</span>}
            </div>

            {/* Print signature block */}
            <div className="hidden print:grid grid-cols-3 gap-16 mt-12 pt-6 border-t border-border/50 text-center">
              {["Établi par", "Vérifié par", "Approuvé par"].map(label => (
                <div key={label}>
                  <div className="h-10 border-b border-foreground/30 mb-1.5" />
                  <div className="text-[8pt] font-semibold text-muted-foreground">{label}</div>
                  <div className="text-[7pt] text-muted-foreground mt-0.5">Date : ___________</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
