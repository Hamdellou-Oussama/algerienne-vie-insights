import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge, SectionCard } from "@/components/ui/kpi-card";
import { History, Loader2, Printer, Save } from "lucide-react";
import { useAuth } from "@/lib/api/auth";
import { useBilanHistory, useBilanLevel3, useCreateBilanSnapshot } from "@/lib/api/queries";
import type { BilanLevel3, BilanSnapshot } from "@/lib/api/types";

export const Route = createFileRoute("/app/balance")({
  head: () => ({ meta: [{ title: "Bilan des sinistres — L'Algérienne Vie" }] }),
  component: BilanPage,
});

interface BilanRow {
  exercice: number;
  ouverture: { nbre: number; montant: number };
  repris: { nbre: number; montant: number };
  declares: { nbre: number; montant: number };
  reglements: { nbre: number; montant: number };
  css: { nbre: number; montant: number };
  reeval: { positif: number; negatif: number };
  reserves: { nbre: number; montant: number };
}

interface BilanView {
  id: string;
  titre: string;
  produit: string;
  branche: string;
  dateGeneration: string;
  periodeOuverture: string;
  periodeCloture: string;
  source: string;
  status: "valide" | "brouillon";
  rows: BilanRow[];
}

const groups = [
  { label: "Dossiers en cours", sub: ["Nbre", "Montant (M DA)"], cols: 2, shade: false },
  { label: "S/S repris", sub: ["Nbre", "Montant (M DA)"], cols: 2, shade: true },
  { label: "Déclarés", sub: ["Nbre", "Montant (M DA)"], cols: 2, shade: false },
  { label: "Règlements", sub: ["Nbre", "Montant (M DA)"], cols: 2, shade: true },
  { label: "Classés S/S", sub: ["Nbre", "Montant (M DA)"], cols: 2, shade: false },
  { label: "Réévaluation", sub: ["+ (M DA)", "− (M DA)"], cols: 2, shade: true },
  { label: "Réserves clôture", sub: ["Nbre", "Montant (M DA)"], cols: 2, shade: false },
  { label: "Vérif", sub: ["Nbre", "Mnt"], cols: 2, shade: true },
];

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

const fmtN = (v: number) => (v === 0 ? "—" : v.toLocaleString("fr-FR"));

function toDisplayDate(isoOrText: string): string {
  const parsed = new Date(isoOrText);
  if (Number.isNaN(parsed.getTime())) {
    return isoOrText;
  }
  return parsed.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function mapLevel3ToBilan(payload: BilanLevel3): BilanView | null {
  if (!payload.years || payload.years.length === 0) {
    return null;
  }
  const years = [...payload.years].sort((a, b) => a.exercice - b.exercice);
  const firstYear = years[0]?.exercice;
  const lastYear = years[years.length - 1]?.exercice;
  if (!firstYear || !lastYear) {
    return null;
  }
  return {
    id: `bilan-live-${payload.generated_at}`,
    titre: "Bilan des sinistres — Calcul backend",
    produit: "Portefeuille global",
    branche: "Vie & Prévoyance",
    dateGeneration: toDisplayDate(payload.generated_at),
    periodeOuverture: `01/01/${firstYear}`,
    periodeCloture: `31/12/${lastYear}`,
    source: payload.source,
    status: payload.all_years_balanced ? "valide" : "brouillon",
    rows: years.map((year) => ({
      exercice: year.exercice,
      ouverture: { nbre: year.en_cours_nbre, montant: year.en_cours_montant },
      repris: { nbre: year.repris_nbre, montant: year.repris_montant },
      declares: { nbre: year.declares_nbre, montant: year.declares_montant },
      reglements: { nbre: year.reglements_nbre, montant: year.reglements_montant },
      css: { nbre: year.rejet_nbre, montant: year.rejet_montant },
      reeval: { positif: year.reevaluation_pos, negatif: year.reevaluation_neg },
      reserves: { nbre: year.reserves_nbre, montant: year.reserves_montant },
    })),
  };
}

function mapSnapshotToBilan(snapshot: BilanSnapshot): BilanView | null {
  if (!snapshot.level3) {
    return null;
  }
  const mapped = mapLevel3ToBilan(snapshot.level3);
  if (!mapped) {
    return null;
  }
  return {
    ...mapped,
    id: snapshot.snapshot_id,
    titre: "Bilan des sinistres — Snapshot archivé",
    dateGeneration: toDisplayDate(snapshot.created_at),
    source: `${snapshot.level3.source} · Snapshot ${snapshot.snapshot_id.slice(0, 8)}`,
  };
}

function verifRow(row: BilanRow) {
  const nbre =
    row.ouverture.nbre + row.repris.nbre + row.declares.nbre - row.reglements.nbre - row.css.nbre;
  const montant =
    row.ouverture.montant +
    row.repris.montant +
    row.declares.montant -
    row.reglements.montant -
    row.css.montant +
    row.reeval.positif -
    row.reeval.negatif;
  return {
    nbreOk: nbre === row.reserves.nbre,
    montantOk: Math.abs(montant - row.reserves.montant) <= 1,
  };
}

function totalRow(rows: BilanRow[]): BilanRow {
  const sum = (picker: (row: BilanRow) => number) =>
    rows.reduce((acc, row) => acc + picker(row), 0);
  return {
    exercice: Number.NaN,
    ouverture: { nbre: sum((r) => r.ouverture.nbre), montant: sum((r) => r.ouverture.montant) },
    repris: { nbre: sum((r) => r.repris.nbre), montant: sum((r) => r.repris.montant) },
    declares: { nbre: sum((r) => r.declares.nbre), montant: sum((r) => r.declares.montant) },
    reglements: { nbre: sum((r) => r.reglements.nbre), montant: sum((r) => r.reglements.montant) },
    css: { nbre: sum((r) => r.css.nbre), montant: sum((r) => r.css.montant) },
    reeval: { positif: sum((r) => r.reeval.positif), negatif: sum((r) => r.reeval.negatif) },
    reserves: { nbre: sum((r) => r.reserves.nbre), montant: sum((r) => r.reserves.montant) },
  };
}

function Chip({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
      OK
    </span>
  ) : (
    <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
      ERR
    </span>
  );
}

function Row({ row, isTotal }: { row: BilanRow; isTotal?: boolean }) {
  const v = isTotal ? { nbreOk: true, montantOk: true } : verifRow(row);
  const bg = isTotal
    ? "bg-primary/6 font-semibold"
    : "even:bg-muted/20 hover:bg-muted/40 transition-colors";

  const td = "px-2.5 py-2 text-xs tabular-nums";
  const num = `${td} text-center text-foreground`;
  const amt = `${td} text-right text-foreground`;
  const amtG = `${td} text-right text-emerald-700`;
  const amtR = `${td} text-right text-red-600`;
  const amtB = `${td} text-right text-primary font-medium`;

  return (
    <tr className={`border-t border-border/60 ${bg}`}>
      <td
        className={`${td} font-semibold text-foreground border-r border-border sticky left-0 bg-inherit`}
      >
        {isTotal ? "TOTAL" : row.exercice}
      </td>
      <td className={`${num} border-l border-border/30`}>{fmtN(row.ouverture.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.ouverture.montant)}</td>
      <td className={`${num} border-l border-border/30`}>{fmtN(row.repris.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.repris.montant)}</td>
      <td className={`${num} border-l border-border/30`}>{fmtN(row.declares.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.declares.montant)}</td>
      <td className={`${num} border-l border-border/30`}>{fmtN(row.reglements.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.reglements.montant)}</td>
      <td className={`${num} border-l border-border/30`}>{fmtN(row.css.nbre)}</td>
      <td className={`${amt} border-r border-border`}>{fmtM(row.css.montant)}</td>
      <td className={`${amtG} border-l border-border/30`}>{fmtM(row.reeval.positif)}</td>
      <td className={`${amtR} border-r border-border`}>{fmtM(row.reeval.negatif)}</td>
      <td className={`${num} border-l border-border/30 font-medium`}>{fmtN(row.reserves.nbre)}</td>
      <td className={`${amtB} border-r border-border`}>{fmtM(row.reserves.montant)}</td>
      <td className="px-2 py-2 text-center border-l border-border/30">
        <Chip ok={v.nbreOk} />
      </td>
      <td className="px-2 py-2 text-center">
        <Chip ok={v.montantOk} />
      </td>
    </tr>
  );
}

function BilanPage() {
  const { user } = useAuth();
  const bilanQuery = useBilanLevel3();
  const historyQuery = useBilanHistory();
  const createSnapshotMutation = useCreateBilanSnapshot();
  const [selectedId, setSelectedId] = useState<string>("live");
  const [snapshotMessage, setSnapshotMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const canCreateSnapshot = user?.role === "ADMIN";

  const liveBilan = useMemo(() => {
    if (!bilanQuery.data) return null;
    return mapLevel3ToBilan(bilanQuery.data);
  }, [bilanQuery.data]);

  const historicalBilans = useMemo(
    () =>
      (historyQuery.data ?? [])
        .map(mapSnapshotToBilan)
        .filter((item): item is BilanView => item !== null),
    [historyQuery.data],
  );

  const selectedHistoricalBilan = useMemo(
    () => historicalBilans.find((item) => item.id === selectedId) ?? null,
    [historicalBilans, selectedId],
  );

  const selectedIsLive = selectedId === "live";
  const bilan = selectedIsLive ? liveBilan : selectedHistoricalBilan;

  const onCreateSnapshot = async () => {
    setSnapshotMessage(null);
    try {
      const created = await createSnapshotMutation.mutateAsync();
      setSelectedId(created.snapshot_id);
      setSnapshotMessage({
        kind: "ok",
        text: `Snapshot enregistré (${created.snapshot_id.slice(0, 8)}).`,
      });
    } catch (error) {
      setSnapshotMessage({
        kind: "err",
        text: error instanceof Error ? error.message : "Impossible de créer le snapshot.",
      });
    }
  };

  if (selectedIsLive && bilanQuery.isLoading) {
    return (
      <>
        <Topbar title="Bilan des sinistres" subtitle="Chargement des données backend" />
        <div className="p-6 lg:p-8">
          <SectionCard
            title="Chargement"
            description="Récupération du bilan Level3 depuis le backend"
          >
            <p className="text-sm text-muted-foreground">Veuillez patienter...</p>
          </SectionCard>
        </div>
      </>
    );
  }

  if (selectedIsLive && bilanQuery.isError) {
    return (
      <>
        <Topbar title="Bilan des sinistres" subtitle="Source unique backend" />
        <div className="p-6 lg:p-8">
          <SectionCard
            title="Bilan indisponible"
            description="Le backend n'a pas retourné de bilan Level3"
          >
            <p className="text-sm text-danger-foreground">
              {bilanQuery.error instanceof Error ? bilanQuery.error.message : "Erreur inconnue"}
            </p>
            <Link
              to="/app/import"
              className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
            >
              Vérifier les imports de fichiers
            </Link>
          </SectionCard>
        </div>
      </>
    );
  }

  if (!bilan) {
    return (
      <>
        <Topbar title="Bilan des sinistres" subtitle="Historique & impression" />
        <div className="p-6 lg:p-8">
          <SectionCard
            title={selectedIsLive ? "Aucune donnée" : "Snapshot indisponible"}
            description={
              selectedIsLive
                ? "Le bilan backend ne contient aucune année exploitable"
                : "Le snapshot sélectionné n'est pas exploitable"
            }
          >
            <p className="text-sm text-muted-foreground">
              {selectedIsLive
                ? "Aucun fallback local n'est utilisé sur cette page."
                : "Sélectionnez un autre snapshot ou revenez au bilan courant."}
            </p>
            {!selectedIsLive && (
              <button
                onClick={() => setSelectedId("live")}
                className="mt-3 inline-block text-sm text-primary underline underline-offset-4"
              >
                Revenir au bilan courant
              </button>
            )}
          </SectionCard>
        </div>
      </>
    );
  }

  const totaux = totalRow(bilan.rows);

  return (
    <>
      <Topbar
        title="Bilan des sinistres"
        subtitle="Traçabilité backend · Historique · Impression"
      />

      <div className="p-5 space-y-4">
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-primary" />
                Historique
              </h3>
              {historyQuery.isFetching && (
                <span className="text-[10px] text-muted-foreground">Synchronisation...</span>
              )}
            </div>

            <div className="mt-3 space-y-2">
              <button
                onClick={() => setSelectedId("live")}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  selectedIsLive
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <p className="text-xs font-semibold">Bilan courant (live)</p>
                <p className="text-[10.5px]">Dernier calcul backend</p>
              </button>

              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {historicalBilans.map((item) => {
                  const firstYear = item.rows[0]?.exercice;
                  const lastYear = item.rows[item.rows.length - 1]?.exercice;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedId === item.id
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <p className="text-xs font-semibold">Snapshot {item.id.slice(0, 8)}</p>
                      <p className="text-[10.5px]">Généré le {item.dateGeneration}</p>
                      {firstYear && lastYear && (
                        <p className="text-[10.5px]">
                          Exercices {firstYear}
                          {firstYear === lastYear ? "" : ` → ${lastYear}`}
                        </p>
                      )}
                    </button>
                  );
                })}

                {!historyQuery.isLoading && historicalBilans.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
                    Aucun snapshot enregistré pour le moment.
                  </p>
                )}
              </div>

              <button
                onClick={onCreateSnapshot}
                disabled={!canCreateSnapshot || createSnapshotMutation.isPending}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createSnapshotMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {createSnapshotMutation.isPending ? "Archivage..." : "Enregistrer ce bilan"}
              </button>

              {!canCreateSnapshot && (
                <p className="text-[10.5px] text-muted-foreground">
                  Action réservée au rôle ADMIN.
                </p>
              )}

              {snapshotMessage && (
                <p
                  className={`text-[10.5px] ${
                    snapshotMessage.kind === "ok" ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {snapshotMessage.text}
                </p>
              )}
            </div>
          </aside>

          <section className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-foreground">{bilan.titre}</h2>
                  <Badge variant={bilan.status === "valide" ? "success" : "warning"}>
                    {bilan.status === "valide" ? "Validé" : "Brouillon"}
                  </Badge>
                  {!selectedIsLive && <Badge variant="info">Historique</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bilan.produit} · {bilan.branche} · Période {bilan.periodeOuverture} →{" "}
                  {bilan.periodeCloture} · Généré le {bilan.dateGeneration}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Source: <span className="font-mono">{bilan.source}</span>
                </p>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-95"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimer / PDF
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-primary text-[9.5px] font-bold uppercase tracking-[0.08em] text-white">
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-10 w-16 border-r border-white/20 bg-primary px-3 py-2.5 text-left"
                      >
                        Exercice
                      </th>
                      {groups.map((g, i) => (
                        <th
                          key={i}
                          colSpan={g.cols}
                          className={`whitespace-nowrap border-r border-white/20 px-2 py-2 text-center last:border-r-0 ${
                            g.shade ? "bg-primary/90" : "bg-primary"
                          }`}
                        >
                          {g.label}
                        </th>
                      ))}
                    </tr>
                    <tr className="text-[8.5px] font-semibold text-white/80">
                      {groups.map((g, gi) =>
                        g.sub.map((s, si) => (
                          <th
                            key={`${gi}-${si}`}
                            className={`border-r border-white/10 px-2 py-1.5 text-center last:border-r-0 ${
                              g.shade ? "bg-primary/80" : "bg-primary/70"
                            }`}
                          >
                            {s}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {bilan.rows.map((row) => (
                      <Row key={row.exercice} row={row} />
                    ))}
                    <tr className="h-0 border-t-2 border-primary/30" />
                    <Row row={totaux} isTotal />
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-[10.5px] text-muted-foreground">
              Vérif: Ouverture + Repris + Déclarés − Règlements − C/SS ± Réévaluation = Réserves
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
