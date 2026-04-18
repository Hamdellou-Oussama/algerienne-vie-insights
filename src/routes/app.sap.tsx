import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Topbar } from "@/components/layout/Topbar";
import { KpiCard, SectionCard, Badge } from "@/components/ui/kpi-card";
import { FileUploadZone, FileInfoBar } from "@/components/ui/file-upload-zone";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { FileWarning, Download } from "lucide-react";

export const Route = createFileRoute("/app/sap")({
  head: () => ({ meta: [{ title: "SAP — Sinistres À Payer · L'Algérienne Vie" }] }),
  component: SapPage,
});

interface SapRow {
  statut: string;
  montant: number;
  produit?: string;
  reseau?: string;
  date?: string;
  [key: string]: unknown;
}

interface SapData {
  rows: SapRow[];
  totalCount: number;
  byStatut: { statut: string; count: number; montant: number }[];
  byProduit: { name: string; count: number; montant: number }[];
  byReseau: { name: string; count: number; montant: number }[];
  montantTotal: number;
  montantSAP: number;
  sheetName: string;
}

const STATUS_KEYWORDS = ["statut", "status", "etat", "état", "situation", "state"];
const AMOUNT_KEYWORDS = ["montant", "capital", "prime", "somme", "indemnite", "montants", "amount"];
const PRODUCT_KEYWORDS = ["produit", "branche", "garantie", "product", "contrat"];
const NETWORK_KEYWORDS = ["réseau", "reseau", "agence", "region", "direction", "r1", "r2"];

function findColumn(headers: string[], keywords: string[]): string | undefined {
  const lc = headers.map((h) => String(h).toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lc.findIndex((h) => h.includes(kw));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function parseSAP(buffer: ArrayBuffer, fileName: string): SapData {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Try header=0, fallback header=1
  let rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
  if (rows.length > 0) {
    const firstKey = Object.keys(rows[0])[0];
    if (firstKey.startsWith("__EMPTY") || firstKey.startsWith("Unnamed")) {
      rows = XLSX.utils.sheet_to_json(ws, { defval: null, range: 1 });
    }
  }

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const statutCol = findColumn(headers, STATUS_KEYWORDS);
  const montantCol = findColumn(headers, AMOUNT_KEYWORDS);
  const produitCol = findColumn(headers, PRODUCT_KEYWORDS);
  const reseauCol = findColumn(headers, NETWORK_KEYWORDS);

  // Detect amount column by finding first numeric column if not found
  const actualMontantCol =
    montantCol ??
    headers.find((h) => rows.some((r) => typeof r[h] === "number" && (r[h] as number) > 0));

  const sapRows: SapRow[] = rows
    .filter((r) => {
      if (actualMontantCol) {
        const v = r[actualMontantCol];
        return typeof v === "number" && !isNaN(v);
      }
      return true;
    })
    .map((r) => ({
      statut: statutCol ? String(r[statutCol] ?? "INCONNU").toUpperCase().trim() : "N/A",
      montant: actualMontantCol ? (Number(r[actualMontantCol]) || 0) : 0,
      produit: produitCol ? String(r[produitCol] ?? "").trim() : undefined,
      reseau: reseauCol ? String(r[reseauCol] ?? "").trim() : undefined,
      ...r,
    }));

  // Group by statut
  const statutMap = new Map<string, { count: number; montant: number }>();
  for (const r of sapRows) {
    const s = r.statut || "INCONNU";
    const prev = statutMap.get(s) ?? { count: 0, montant: 0 };
    statutMap.set(s, { count: prev.count + 1, montant: prev.montant + r.montant });
  }
  const byStatut = Array.from(statutMap.entries()).map(([statut, v]) => ({ statut, ...v }));

  // Group by produit
  const produitMap = new Map<string, { count: number; montant: number }>();
  for (const r of sapRows) {
    const p = r.produit || "Autre";
    const prev = produitMap.get(p) ?? { count: 0, montant: 0 };
    produitMap.set(p, { count: prev.count + 1, montant: prev.montant + r.montant });
  }
  const byProduit = Array.from(produitMap.entries()).map(([name, v]) => ({ name, ...v })).slice(0, 10);

  // Group by réseau
  const reseauMap = new Map<string, { count: number; montant: number }>();
  for (const r of sapRows) {
    const net = r.reseau || "Autre";
    const prev = reseauMap.get(net) ?? { count: 0, montant: 0 };
    reseauMap.set(net, { count: prev.count + 1, montant: prev.montant + r.montant });
  }
  const byReseau = Array.from(reseauMap.entries()).map(([name, v]) => ({ name, ...v })).slice(0, 10);

  const montantTotal = sapRows.reduce((s, r) => s + r.montant, 0);
  const sapStatus = byStatut.find((s) => s.statut === "SAP" || s.statut.includes("SAP"));
  const montantSAP = sapStatus?.montant ?? montantTotal;

  return {
    rows: sapRows.slice(0, 200),
    totalCount: sapRows.length,
    byStatut,
    byProduit,
    byReseau,
    montantTotal,
    montantSAP,
    sheetName,
  };
}

const fmtM = (v: number) =>
  v === 0
    ? "—"
    : (v / 1_000_000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " M DA";

const STATUT_COLORS: Record<string, string> = {
  SAP: "var(--chart-1)",
  "EN COURS": "var(--chart-1)",
  REGLE: "var(--success)",
  RÉGLÉ: "var(--success)",
  REJET: "var(--destructive)",
  REJETÉ: "var(--destructive)",
  "CLASSE SANS SUITE": "var(--chart-3)",
  CSS: "var(--chart-3)",
};

function getStatusColor(s: string) {
  return (
    STATUT_COLORS[s] ||
    STATUT_COLORS[Object.keys(STATUT_COLORS).find((k) => s.includes(k)) ?? ""] ||
    "var(--chart-4)"
  );
}

function SapPage() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<SapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((buffer: ArrayBuffer, f: File) => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const parsed = parseSAP(buffer, f.name);
        setData(parsed);
        setFile(f);
      } catch (e) {
        setError("Impossible de lire ce fichier. Vérifiez le format Excel.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 100);
  }, []);

  const reset = () => { setFile(null); setData(null); setError(null); };

  const sapCount = data?.byStatut.find((s) => s.statut.includes("SAP"))?.count ?? 0;
  const regleCount = data?.byStatut.find((s) => s.statut.includes("REGL") || s.statut.includes("RÉGL"))?.count ?? 0;
  const rejetCount = data?.byStatut.find((s) => s.statut.includes("REJET"))?.count ?? 0;

  return (
    <>
      <Topbar
        title="Sinistres À Payer"
        subtitle="SAP · Pipeline d'analyse · Provisionnement"
      />
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header meta */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-hero flex items-center justify-center shadow-md">
              <FileWarning className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Sinistres À Payer (SAP)</div>
              <div className="text-xs text-muted-foreground">
                Provision pour sinistres survenus déclarés et en cours de règlement
              </div>
            </div>
          </div>
          {data && (
            <button className="flex items-center gap-2 text-xs bg-gradient-primary text-white px-4 py-2 rounded-lg hover:shadow-elegant transition-all">
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          )}
        </div>

        {!data && (
          <FileUploadZone
            onFile={handleFile}
            title="Charger le fichier SAP"
            description="Importez le fichier Excel SAP (ex. level 01-DATA SAP groupe.xlsx) pour lancer l'analyse"
            loading={loading}
            error={error}
          />
        )}

        {data && file && (
          <>
            <FileInfoBar
              file={file}
              rowCount={data.totalCount}
              sheetName={data.sheetName}
              onReset={reset}
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Total sinistres"
                value={data.totalCount.toLocaleString("fr-FR")}
                hint="dossiers identifiés"
                icon={<FileWarning className="h-4 w-4" />}
                accent="primary"
                delay={0}
              />
              <KpiCard
                label="SAP · En cours"
                value={sapCount > 0 ? sapCount.toLocaleString("fr-FR") : data.byStatut[0]?.count?.toLocaleString("fr-FR") ?? "—"}
                hint={fmtM(data.montantSAP)}
                accent="gold"
                delay={0.05}
              />
              <KpiCard
                label="Réglés"
                value={regleCount.toLocaleString("fr-FR")}
                hint="dossiers clôturés"
                delay={0.1}
              />
              <KpiCard
                label="Rejetés / CSS"
                value={rejetCount.toLocaleString("fr-FR")}
                hint="classés sans suite"
                delay={0.15}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Statuts distribution */}
              <SectionCard
                title="Répartition par statut"
                description="Nombre de dossiers par état"
              >
                {data.byStatut.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data.byStatut.map((s) => ({ name: s.statut, value: s.count }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={11}
                      >
                        {data.byStatut.map((s, i) => (
                          <Cell key={s.statut} fill={getStatusColor(s.statut)} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR"), "Dossiers"]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    Aucune colonne de statut détectée
                  </div>
                )}
              </SectionCard>

              {/* Montants par statut */}
              <SectionCard
                title="Montants par statut"
                description="Provisions en M DA"
              >
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.byStatut.map((s) => ({
                      name: s.statut,
                      montant: +(s.montant / 1_000_000).toFixed(2),
                    }))}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} unit=" M" />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown) => [Number(v).toLocaleString("fr-FR") + " M DA", "Montant"]}
                    />
                    <Bar dataKey="montant" fill="var(--gold)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              {/* Par produit */}
              {data.byProduit.some((p) => p.name && p.name !== "undefined") && (
                <SectionCard
                  title="Répartition par produit"
                  description="Nombre de dossiers"
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.byProduit.filter((p) => p.name && p.name !== "undefined" && p.name !== "null")}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Dossiers" />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}

              {/* Par réseau */}
              {data.byReseau.some((r) => r.name && r.name !== "undefined") && (
                <SectionCard
                  title="Répartition par réseau"
                  description="Nombre de dossiers"
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.byReseau.filter((r) => r.name && r.name !== "undefined" && r.name !== "null")}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="var(--chart-3)" radius={[4, 4, 0, 0]} name="Dossiers" />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}
            </div>

            {/* Data table */}
            <SectionCard
              title="Aperçu des dossiers"
              description={`${Math.min(data.rows.length, 100)} premiers enregistrements`}
              action={<Badge variant="info">{data.totalCount.toLocaleString("fr-FR")} total</Badge>}
            >
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="text-[11px] tracking-wider uppercase text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-6 py-2">Statut</th>
                      <th className="text-right font-medium px-6 py-2">Montant (DA)</th>
                      {data.rows[0]?.produit !== undefined && (
                        <th className="text-left font-medium px-6 py-2">Produit</th>
                      )}
                      {data.rows[0]?.reseau !== undefined && (
                        <th className="text-left font-medium px-6 py-2">Réseau</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-2.5">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: getStatusColor(r.statut) + "22",
                              color: getStatusColor(r.statut),
                              border: `1px solid ${getStatusColor(r.statut)}44`,
                            }}
                          >
                            {r.statut}
                          </span>
                        </td>
                        <td className="px-6 py-2.5 text-right font-mono text-foreground">
                          {r.montant > 0 ? r.montant.toLocaleString("fr-FR") : "—"}
                        </td>
                        {data.rows[0]?.produit !== undefined && (
                          <td className="px-6 py-2.5 text-muted-foreground">{r.produit || "—"}</td>
                        )}
                        {data.rows[0]?.reseau !== undefined && (
                          <td className="px-6 py-2.5 text-muted-foreground">{r.reseau || "—"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </>
  );
}
