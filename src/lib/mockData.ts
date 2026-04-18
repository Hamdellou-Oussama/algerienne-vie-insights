// L'Algérienne Vie — mock data
import {
  HeartPulse, Plane, Activity, Shield, Wallet, Flower2,
  type LucideIcon,
} from "lucide-react";

export type ProductKey =
  | "prevoyance-sante"
  | "voyage-assistance"
  | "accidents-corporels"
  | "temporaire-deces"
  | "emprunteur"
  | "warda";

export type SegmentKey = "particuliers" | "professionnels" | "entreprises";

export interface Product {
  key: ProductKey;
  name: string;
  shortName: string;
  family: "Vie & Prévoyance" | "Assistance" | "Protection" | "Crédit" | "Famille";
  icon: LucideIcon;
  contracts: number;
  premiumsMDA: number;       // millions DZD
  claimsMDA: number;
  reservesMDA: number;
  lossRatio: number;         // S/P
  trend: number;             // YoY %
  description: string;
}

export const products: Product[] = [
  {
    key: "prevoyance-sante",
    name: "Assurance Prévoyance et Santé",
    shortName: "Prévoyance & Santé",
    family: "Vie & Prévoyance",
    icon: HeartPulse,
    contracts: 48230,
    premiumsMDA: 1842,
    claimsMDA: 1156,
    reservesMDA: 2187,
    lossRatio: 0.628,
    trend: 8.4,
    description: "Couverture santé complémentaire et prévoyance longue durée.",
  },
  {
    key: "voyage-assistance",
    name: "Assurance Voyage et Assistance",
    shortName: "Voyage & Assistance",
    family: "Assistance",
    icon: Plane,
    contracts: 32104,
    premiumsMDA: 412,
    claimsMDA: 198,
    reservesMDA: 154,
    lossRatio: 0.481,
    trend: 14.2,
    description: "Assistance médicale et rapatriement à l'étranger.",
  },
  {
    key: "accidents-corporels",
    name: "Assurance Accidents Corporels",
    shortName: "Accidents Corporels",
    family: "Protection",
    icon: Activity,
    contracts: 19842,
    premiumsMDA: 687,
    claimsMDA: 421,
    reservesMDA: 612,
    lossRatio: 0.613,
    trend: 3.1,
    description: "Indemnisation en cas d'invalidité ou décès accidentel.",
  },
  {
    key: "temporaire-deces",
    name: "Assurance Temporaire au Décès",
    shortName: "Temporaire Décès",
    family: "Vie & Prévoyance",
    icon: Shield,
    contracts: 27518,
    premiumsMDA: 956,
    claimsMDA: 487,
    reservesMDA: 3420,
    lossRatio: 0.509,
    trend: 5.7,
    description: "Capital décès garanti pour la durée du contrat.",
  },
  {
    key: "emprunteur",
    name: "Assurance Emprunteur",
    shortName: "Emprunteur",
    family: "Crédit",
    icon: Wallet,
    contracts: 14267,
    premiumsMDA: 1238,
    claimsMDA: 542,
    reservesMDA: 4185,
    lossRatio: 0.438,
    trend: 11.8,
    description: "Garantie décès-invalidité associée aux crédits bancaires.",
  },
  {
    key: "warda",
    name: "Assurance Warda",
    shortName: "Warda",
    family: "Famille",
    icon: Flower2,
    contracts: 8412,
    premiumsMDA: 184,
    claimsMDA: 71,
    reservesMDA: 96,
    lossRatio: 0.386,
    trend: 22.5,
    description: "Produit famille dédié à la protection des femmes.",
  },
];

export const segments: { key: SegmentKey; name: string; share: number; contracts: number; premiumsMDA: number }[] = [
  { key: "particuliers", name: "Particuliers", share: 0.62, contracts: 92840, premiumsMDA: 3214 },
  { key: "professionnels", name: "Professionnels", share: 0.21, contracts: 31420, premiumsMDA: 1187 },
  { key: "entreprises", name: "Entreprises", share: 0.17, contracts: 26113, premiumsMDA: 918 },
];

// Global KPIs (millions DZD)
export const kpis = {
  totalReserves: 10654,
  ppna: 2185,
  psap: 4128,
  ibnr: 2814,
  prc: 1527,
  primesAcquises: 5319,
  sinistresPayes: 2875,
  ratioCombine: 0.847,
  fondsPropres: 3842,
  contratsActifs: 150373,
  claimsOpen: 4287,
  validationStatus: 0.78,
};

// Reserve composition over 8 quarters
export const reserveTimeline = [
  { period: "T1-23", PPNA: 1820, PSAP: 3450, IBNR: 2410, PRC: 1310 },
  { period: "T2-23", PPNA: 1885, PSAP: 3580, IBNR: 2487, PRC: 1342 },
  { period: "T3-23", PPNA: 1942, PSAP: 3712, IBNR: 2541, PRC: 1378 },
  { period: "T4-23", PPNA: 2018, PSAP: 3845, IBNR: 2618, PRC: 1410 },
  { period: "T1-24", PPNA: 2074, PSAP: 3938, IBNR: 2685, PRC: 1448 },
  { period: "T2-24", PPNA: 2118, PSAP: 4012, IBNR: 2741, PRC: 1481 },
  { period: "T3-24", PPNA: 2156, PSAP: 4081, IBNR: 2784, PRC: 1508 },
  { period: "T4-24", PPNA: 2185, PSAP: 4128, IBNR: 2814, PRC: 1527 },
];

// Premiums vs Claims trend
export const premiumsClaimsTrend = [
  { month: "Jan", primes: 412, sinistres: 218 },
  { month: "Fév", primes: 428, sinistres: 234 },
  { month: "Mar", primes: 451, sinistres: 256 },
  { month: "Avr", primes: 437, sinistres: 241 },
  { month: "Mai", primes: 462, sinistres: 268 },
  { month: "Juin", primes: 478, sinistres: 252 },
  { month: "Juil", primes: 491, sinistres: 287 },
  { month: "Août", primes: 472, sinistres: 264 },
  { month: "Sep", primes: 485, sinistres: 271 },
  { month: "Oct", primes: 498, sinistres: 289 },
  { month: "Nov", primes: 512, sinistres: 295 },
  { month: "Déc", primes: 524, sinistres: 312 },
];

// Development triangle (cumulative paid claims, MDA) — 7 origin years × 7 dev years
export const triangleOriginYears = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
export const triangleData: (number | null)[][] = [
  [482, 712, 854, 921, 958, 974, 982],
  [524, 768, 922, 994, 1034, 1051, null],
  [571, 838, 1006, 1083, 1126, null, null],
  [612, 898, 1078, 1162, null, null, null],
  [658, 968, 1163, null, null, null, null],
  [704, 1034, null, null, null, null, null],
  [754, null, null, null, null, null, null],
];

// Chain Ladder development factors (computed)
export const developmentFactors = [1.469, 1.201, 1.078, 1.041, 1.018, 1.008];

// IBNR by method (MDA)
export const ibnrByMethod = [
  { method: "Chain Ladder", ibnr: 2814, ultimate: 8754, ecart: 0 },
  { method: "Bornhuetter-Ferguson", ibnr: 2862, ultimate: 8802, ecart: 1.7 },
  { method: "Loss Ratio", ibnr: 2945, ultimate: 8885, ecart: 4.6 },
  { method: "Mack", ibnr: 2831, ultimate: 8771, ecart: 0.6 },
  { method: "Munich Chain Ladder", ibnr: 2798, ultimate: 8738, ecart: -0.6 },
  { method: "Bootstrap", ibnr: 2841, ultimate: 8781, ecart: 1.0 },
];

// Claims dossiers
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

const insuredNames = [
  "Benali M.", "Khaled R.", "Mansouri F.", "Bouzid A.", "Hadj S.",
  "Lounis K.", "Cherif N.", "Belkacem H.", "Yahia O.", "Ferhat L.",
  "Saadi I.", "Brahimi T.", "Kaci D.", "Ouali M.", "Zerrouki R.",
  "Boudjedra Y.", "Slimani A.", "Bouchareb K.", "Mezouar S.", "Tahar B.",
];

const statuses: ClaimStatus[] = ["open", "in_review", "closed", "paid", "litigation"];
const severities = ["low", "medium", "high"] as const;
const productKeys = products.map((p) => p.key);
const segmentKeys: SegmentKey[] = ["particuliers", "professionnels", "entreprises"];

function seeded(i: number) { return Math.abs(Math.sin(i * 9301 + 49297) * 233280) % 1; }

export const claims: Claim[] = Array.from({ length: 60 }, (_, i) => {
  const r = seeded(i);
  const product = productKeys[Math.floor(r * productKeys.length)];
  const segment = segmentKeys[Math.floor(seeded(i + 1) * 3)];
  const status = statuses[Math.floor(seeded(i + 2) * statuses.length)];
  const severity = severities[Math.floor(seeded(i + 3) * 3)];
  const declared = Math.round((50000 + seeded(i + 4) * 4500000));
  const paid = status === "paid" || status === "closed" ? declared : Math.round(declared * seeded(i + 5));
  const reserve = Math.max(0, declared - paid);
  const day = String(1 + Math.floor(seeded(i + 6) * 27)).padStart(2, "0");
  const month = String(1 + Math.floor(seeded(i + 7) * 12)).padStart(2, "0");
  return {
    id: `SIN-2024-${String(10000 + i).padStart(5, "0")}`,
    date: `2024-${month}-${day}`,
    product,
    segment,
    insured: insuredNames[i % insuredNames.length],
    declared, paid, reserve, status, severity,
  };
});

// Audit trail
export const auditEvents = [
  { id: 1, date: "2024-12-18 14:32", user: "S. Boukerma", role: "Actuaire", action: "Calcul IBNR — Chain Ladder", target: "Prévoyance & Santé", status: "validé" },
  { id: 2, date: "2024-12-18 11:15", user: "M. Hadj", role: "Admin", action: "Validation provisions T4-2024", target: "Global", status: "validé" },
  { id: 3, date: "2024-12-17 16:48", user: "S. Boukerma", role: "Actuaire", action: "Mise à jour hypothèses Loss Ratio", target: "Emprunteur", status: "validé" },
  { id: 4, date: "2024-12-17 09:22", user: "K. Lounis", role: "Sinistres", action: "Ouverture dossier SIN-2024-10058", target: "Accidents Corporels", status: "en cours" },
  { id: 5, date: "2024-12-16 17:05", user: "S. Boukerma", role: "Actuaire", action: "Import données triangulation", target: "Toutes branches", status: "validé" },
  { id: 6, date: "2024-12-16 10:38", user: "M. Hadj", role: "Admin", action: "Génération rapport ACAPS T4", target: "Global", status: "validé" },
  { id: 7, date: "2024-12-15 15:12", user: "F. Mansouri", role: "Auditeur", action: "Consultation balance technique", target: "Global", status: "consulté" },
  { id: 8, date: "2024-12-15 11:47", user: "S. Boukerma", role: "Actuaire", action: "Comparaison méthodes IBNR", target: "Temporaire Décès", status: "validé" },
];

// Helpers
export const fmtMDA = (v: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} M DA`;
export const fmtDZD = (v: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v)} DA`;
export const fmtPct = (v: number, d = 1) =>
  `${(v * 100).toFixed(d)}%`;
export const fmtNum = (v: number) =>
  new Intl.NumberFormat("fr-FR").format(v);
