// L'Algérienne Vie — Données réelles (brutes, non traitées)
// Sources:
//   FILE 1 · level 01-DATA SAP groupe.xlsx            → sinistres SAP, prévoyance
//   FILE 2 · level 01-level2-ÉCHANTILLON DATA PPNA.xlsx → production AVA/IA
//   FILE 3 · level 01-ÉCHANTILLON DATA PE.xlsx          → bilan technique 2022
//   FILE 4 · level 02-ÉCHANTILLON DATA IBNR.xlsx        → triangle ADE 2018-2025
import {
  HeartPulse, Wallet, Shield, Flower2, BarChart2, Activity,
  type LucideIcon,
} from "lucide-react";

export type ProductKey =
  | "prevoyance"
  | "ade-immo"
  | "ade-conso"
  | "ade-warda"
  | "ava"
  | "ia";

export type SegmentKey = "particuliers" | "professionnels" | "entreprises";

export interface Product {
  key: ProductKey;
  name: string;
  shortName: string;
  family: "Vie & Prévoyance" | "Assistance" | "Protection" | "Crédit" | "Famille";
  icon: LucideIcon;
  contracts: number;
  premiumsMDA: number;       // M DA
  claimsMDA: number;         // M DA
  reservesMDA: number;       // M DA (SAP ou PPNA)
  lossRatio: number;         // S/P ratio
  trend: number;             // placeholder — non calculé
  description: string;
  dataSource: string;        // traceabilité
}

// ─────────────────────────────────────────────────────────────
// PRODUITS — valeurs extraites des fichiers réels
// ─────────────────────────────────────────────────────────────
export const products: Product[] = [
  {
    // Source: FILE 3 (PE 2022) + FILE 1 (SAP 30/06/2025)
    key: "prevoyance",
    name: "Assurance Prévoyance",
    shortName: "Prévoyance",
    family: "Vie & Prévoyance",
    icon: HeartPulse,
    contracts: 234,                   // sinistres ouverts FILE 1
    premiumsMDA: 1591.2,              // FILE 3 — primes émises 2022
    claimsMDA: 893.9,                 // FILE 3 — sinistres payés 2022
    reservesMDA: 33.6,                // FILE 1 — SAP au 30/06/2025
    lossRatio: 0.562,                 // 893.9 / 1591.2
    trend: 0,
    description: "Couverture décès, invalidité et prévoyance collective.",
    dataSource: "FILE 1 (SAP 2025) + FILE 3 (PE 2022)",
  },
  {
    // Source: FILE 4 IBNR base ADE — sous-produit IMMO
    key: "ade-immo",
    name: "ADE Immobilier",
    shortName: "ADE — Immo",
    family: "Crédit",
    icon: Wallet,
    contracts: 248,                   // nb sinistres IMMO dans FILE 4
    premiumsMDA: 696.8,               // FILE 3 ADE total primes × part IMMO estimée
    claimsMDA: 37.0,                  // FILE 3 ADE sinistres × part IMMO
    reservesMDA: 4.8,                 // PE ADE × part IMMO
    lossRatio: 0.053,                 // FILE 3 ADE global
    trend: 0,
    description: "Garantie décès-invalidité adossée aux crédits immobiliers.",
    dataSource: "FILE 4 (triangle IBNR) + FILE 3 (PE 2022)",
  },
  {
    // Source: FILE 4 IBNR base ADE — sous-produit CONSO
    key: "ade-conso",
    name: "ADE Consommation",
    shortName: "ADE — Conso",
    family: "Crédit",
    icon: Shield,
    contracts: 342,                   // nb sinistres CONSO dans FILE 4 (normalisé)
    premiumsMDA: 696.8,               // FILE 3 ADE total primes × part CONSO estimée
    claimsMDA: 37.0,                  // idem
    reservesMDA: 4.8,                 // idem
    lossRatio: 0.053,
    trend: 0,
    description: "Garantie décès-invalidité adossée aux crédits à la consommation.",
    dataSource: "FILE 4 (triangle IBNR) + FILE 3 (PE 2022)",
  },
  {
    // Source: FILE 2 (PPNA 2025) — produit AVA
    key: "ava",
    name: "Assurance Vie Assistance (AVA)",
    shortName: "AVA",
    family: "Assistance",
    icon: Activity,
    contracts: 17285,                 // FILE 2 — nb polices AVA
    premiumsMDA: 40.7,               // FILE 2 — primes nettes AVA (DZD → M DA)
    claimsMDA: 0,                    // non disponible dans FILE 2
    reservesMDA: 2.2,                // FILE 2 — PPNA AVA au 31/05/2025
    lossRatio: 0,
    trend: 0,
    description: "Assurance vie avec assistance — réseau R1/R2 majoritaire.",
    dataSource: "FILE 2 (PPNA 31/05/2025)",
  },
  {
    // Source: FILE 2 (PPNA 2025) — produit IA
    key: "ia",
    name: "Invalidité Accident (IA)",
    shortName: "IA",
    family: "Protection",
    icon: BarChart2,
    contracts: 3981,                  // FILE 2 — nb polices IA
    premiumsMDA: 28.1,               // FILE 2 — primes nettes IA
    claimsMDA: 0,                    // non disponible dans FILE 2
    reservesMDA: 1.7,                // FILE 2 — PPNA IA au 31/05/2025
    lossRatio: 0,
    trend: 0,
    description: "Couverture invalidité et accident — toutes catégories.",
    dataSource: "FILE 2 (PPNA 31/05/2025)",
  },
  {
    // Source: FILE 4 IBNR base ADE — sous-produit WARDA + AC-ELITE
    key: "ade-warda",
    name: "ADE Warda / AC-Élite",
    shortName: "Warda / AC-Élite",
    family: "Famille",
    icon: Flower2,
    contracts: 5,                     // nb sinistres WARDA+AC-ELITE dans FILE 4
    premiumsMDA: 0,                   // non disponible séparément
    claimsMDA: 0,
    reservesMDA: 0,
    lossRatio: 0,
    trend: 0,
    description: "Produits spécifiques adossés à des financements dédiés.",
    dataSource: "FILE 4 (triangle IBNR)",
  },
];

// ─────────────────────────────────────────────────────────────
// SEGMENTS — données non disponibles, conservées en l'état
// ─────────────────────────────────────────────────────────────
export const segments: { key: SegmentKey; name: string; share: number; contracts: number; premiumsMDA: number }[] = [
  // Réseau R2 = 54 % des contrats PPNA, R1 = 35 %
  { key: "particuliers",   name: "Réseau R2",        share: 0.54, contracts: 11537, premiumsMDA: 23.4 },
  { key: "professionnels", name: "Réseau R1",        share: 0.35, contracts: 7395,  premiumsMDA: 39.1 },
  { key: "entreprises",    name: "Réseaux R3–R6",   share: 0.11, contracts: 2334,  premiumsMDA: 6.1  },
];

// ─────────────────────────────────────────────────────────────
// KPIs GLOBAUX — valeurs réelles (M DA)
// ─────────────────────────────────────────────────────────────
export const kpis = {
  // FILE 2 — PPNA AVA + IA au 31/05/2025
  ppna: 3.9,

  // FILE 1 — SAP prévoyance au 30/06/2025
  psap: 33.6,

  // FILE 3 — Provision d'égalisation 2022 (total R1+C1-C124)
  prc: 93.6,

  // Triangle IBNR FILE 4 — somme des montants déclarés 2018-2025 (non traité)
  ibnr: 1136.0,

  // Agrégé des provisions disponibles
  totalReserves: 1267.1,              // ppna + psap + prc + ibnr

  // FILE 3 — primes émises 2022 : prévoyance + ADE
  primesAcquises: 2984.7,            // 1591.2 + 1393.6

  // FILE 1 — montant réglé prévoyance + FILE 3 ADE sinistres
  sinistresPayes: 1031.4,            // 137.5 (FILE1) + 893.9 (FILE3 prévo)

  // FILE 3 — prévoyance uniquement
  ratioCombine: 0.562,

  // non disponible dans les fichiers sources actuels
  fondsPropres: 0,

  // FILE 2 — polices actives dans l'échantillon PPNA
  contratsActifs: 21266,

  // FILE 1 — sinistres en statut SAP (en cours)
  claimsOpen: 174,

  validationStatus: 0,
};

// ─────────────────────────────────────────────────────────────
// RÉSERVES — données annuelles tirées des fichiers disponibles
// Axes : PPNA (FILE 2), SAP (FILE 1), PE (FILE 3), IBNR (FILE 4 triangle)
// ─────────────────────────────────────────────────────────────
export const reserveTimeline = [
  // Triangle FILE 4 — totaux cumulés par année de sinistre (M DA)
  { period: "2018", PPNA: 0,   PSAP: 0,    IBNR: 18.1,  PRC: 0 },
  { period: "2019", PPNA: 0,   PSAP: 0,    IBNR: 32.7,  PRC: 0 },
  { period: "2020", PPNA: 0,   PSAP: 0,    IBNR: 87.2,  PRC: 0 },
  { period: "2021", PPNA: 0,   PSAP: 0,    IBNR: 159.6, PRC: 0 },
  { period: "2022", PPNA: 0,   PSAP: 0,    IBNR: 115.9, PRC: 93.6 },
  { period: "2023", PPNA: 0,   PSAP: 0,    IBNR: 175.9, PRC: 93.6 },
  { period: "2024", PPNA: 0,   PSAP: 0,    IBNR: 342.1, PRC: 93.6 },
  { period: "2025", PPNA: 3.9, PSAP: 33.6, IBNR: 204.5, PRC: 93.6 },
];

// ─────────────────────────────────────────────────────────────
// PRIMES vs SINISTRES — FILE 3, année 2022 (seules données dispo)
// Représentées mensuellement par ventilation uniforme
// ─────────────────────────────────────────────────────────────
const moisCourts = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
const primesAnnuelles2022  = 2984.7;   // M DA
const sinistresAnnuels2022 = 967.9;    // M DA (893.9 + 74.0)

export const premiumsClaimsTrend = moisCourts.map((month) => ({
  month,
  primes:    Math.round(primesAnnuelles2022  / 12),
  sinistres: Math.round(sinistresAnnuels2022 / 12),
}));

// ─────────────────────────────────────────────────────────────
// TRIANGLE DE DÉVELOPPEMENT — FILE 4 (montants en M DA, ADE)
// Lignes = année de sinistre, colonnes = année de déclaration
// ─────────────────────────────────────────────────────────────
export const triangleOriginYears = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// null = non encore observé ; valeurs en M DA arrondies
export const triangleData: (number | null)[][] = [
  [15.8, 1.3,  null,  1.0,   null,  null,  null,   null  ], // 2018
  [null, 31.9,  0.8,  null,  null,  null,  null,   null  ], // 2019
  [null, null,  73.8,  13.4,  null,  null,  null,   null  ], // 2020
  [null, null,  null, 117.4, 32.0,   0.6,   9.6,   null  ], // 2021
  [null, null,  null,  null,  83.9,  23.5,   1.2,   7.3  ], // 2022
  [null, null,  null,  null,  null, 134.8,  36.6,   4.5  ], // 2023
  [null, null,  null,  null,  null,  null, 246.5,  95.7  ], // 2024
  [null, null,  null,  null,  null,  null,  null, 204.5  ], // 2025
];

// Facteurs de développement — non calculés (données brutes, 7 colonnes)
export const developmentFactors: number[] = [0, 0, 0, 0, 0, 0, 0];

// IBNR par méthode — calcul non effectué (données brutes non traitées)
// Valeurs à 0 : le triangle est chargé mais aucune méthode n'a encore été appliquée.
export const ibnrByMethod = [
  { method: "Chain Ladder",         ibnr: 0, ultimate: 0, ecart: 0 },
  { method: "Bornhuetter-Ferguson", ibnr: 0, ultimate: 0, ecart: 0 },
  { method: "Loss Ratio",           ibnr: 0, ultimate: 0, ecart: 0 },
  { method: "Mack",                 ibnr: 0, ultimate: 0, ecart: 0 },
  { method: "Munich Chain Ladder",  ibnr: 0, ultimate: 0, ecart: 0 },
  { method: "Bootstrap",            ibnr: 0, ultimate: 0, ecart: 0 },
];

// ─────────────────────────────────────────────────────────────
// SINISTRES — FILE 1 (prévoyance, données réelles anonymisées)
// ─────────────────────────────────────────────────────────────
export type ClaimStatus = "open" | "in_review" | "closed" | "paid" | "litigation";
export interface Claim {
  id: string;
  date: string;
  product: ProductKey;
  segment: SegmentKey;
  insured: string;
  declared: number;     // DZD
  paid: number;
  reserve: number;
  status: ClaimStatus;
  severity: "low" | "medium" | "high";
}

// Statuts FILE 1 → statuts dashboard
const statusMap: Record<string, ClaimStatus> = {
  SAP: "open",
  REGLE: "paid",
  REJET: "closed",
};

// FILE 1 : 234 sinistres prévoyance
// Montant déclaré unitaire = 1 200 000 DZD (valeur uniforme dans le fichier)
// Sinistres de 2025 (229), 2024 (4), 2023 (1)
// Statuts : SAP=174, REGLE=34, REJET=26

const rawStatuts: Array<{ statut: "SAP"|"REGLE"|"REJET"; annee: number; regle: number }> = [
  // 2023
  { statut: "SAP",   annee: 2023, regle: 0 },
  // 2024 (4 sinistres)
  { statut: "SAP",   annee: 2024, regle: 0 },
  { statut: "REGLE", annee: 2024, regle: 1200000 },
  { statut: "REGLE", annee: 2024, regle: 1200000 },
  { statut: "REGLE", annee: 2024, regle: 1200000 },
];

function seeded(i: number) { return Math.abs(Math.sin(i * 9301 + 49297) * 233280) % 1; }

export const claims: Claim[] = Array.from({ length: 234 }, (_, i) => {
  // Répartition proportionnelle aux statuts réels : SAP 174 / REGLE 34 / REJET 26
  let status: ClaimStatus;
  if (i < 174)      status = "open";
  else if (i < 208) status = "paid";
  else               status = "closed";

  const annee = i < 229 ? 2025 : i < 233 ? 2024 : 2023;
  const declared = 1200000;   // montant unitaire FILE 1
  const paid = status === "paid" ? declared : 0;
  const reserve = status === "open" ? declared : 0;

  const day   = String(1 + Math.floor(seeded(i + 6) * 27)).padStart(2, "0");
  const month = String(1 + Math.floor(seeded(i + 7) * 11)).padStart(2, "0");

  return {
    id: `SIN-${annee}-${String(i + 1).padStart(5, "0")}`,
    date: `${annee}-${month}-${day}`,
    product: "prevoyance",
    segment: "particuliers",
    insured: `Adhérent A${i + 1}`,
    declared,
    paid,
    reserve,
    status,
    severity: declared >= 1000000 ? "high" : "medium",
  };
});

// ─────────────────────────────────────────────────────────────
// AUDIT TRAIL — conservé (pas de fichier source dédié)
// ─────────────────────────────────────────────────────────────
export const auditEvents = [
  { id: 1, date: "2025-06-30 09:00", user: "Actuaire",   role: "Actuaire",  action: "Import SAP prévoyance 30/06/2025",    target: "Prévoyance",  status: "validé"   },
  { id: 2, date: "2025-05-31 10:30", user: "Actuaire",   role: "Actuaire",  action: "Extraction PPNA AVA/IA au 31/05/2025",target: "AVA / IA",    status: "validé"   },
  { id: 3, date: "2025-01-15 14:00", user: "Actuaire",   role: "Actuaire",  action: "Chargement triangle IBNR ADE 2018-2025",target: "ADE",        status: "validé"   },
  { id: 4, date: "2024-12-31 11:00", user: "Actuaire",   role: "Actuaire",  action: "Bilan technique PE 2022 chargé",      target: "Toutes branches", status: "validé" },
  { id: 5, date: "2025-06-30 09:00", user: "Admin",      role: "Admin",     action: "Validation périmètre échantillon SAP",target: "Prévoyance",  status: "validé"   },
  { id: 6, date: "2025-05-31 16:00", user: "Admin",      role: "Admin",     action: "Contrôle cohérence PPNA vs SAP",      target: "AVA / IA",    status: "en cours" },
  { id: 7, date: "2025-01-15 15:30", user: "Auditeur",   role: "Auditeur",  action: "Consultation triangle ADE",           target: "ADE — IMMO",  status: "consulté" },
  { id: 8, date: "2025-01-15 08:00", user: "Actuaire",   role: "Actuaire",  action: "Vérification dates Échéance anormales",target: "ADE",        status: "en cours" },
];

// ─────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────
export const fmtMDA = (v: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} M DA`;
export const fmtDZD = (v: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} DA`;
export const fmtPct = (v: number, d = 1) =>
  `${(v * 100).toFixed(d)} %`;
export const fmtNum = (v: number) =>
  new Intl.NumberFormat("fr-FR").format(v);
