// Bilan des sinistres — modèle de données et historique

export interface BilanRow {
  exercice: number;
  ouverture:   { nbre: number; montant: number }; // Dossiers en cours au 01/01
  repris:      { nbre: number; montant: number }; // Dossiers S/S repris
  declares:    { nbre: number; montant: number }; // Dossiers déclarés
  reglements:  { nbre: number; montant: number }; // Total règlements
  css:         { nbre: number; montant: number }; // Dossiers classés sans suite
  reeval:      { positif: number; negatif: number };
  reserves:    { nbre: number; montant: number }; // Réserves clôture
}

export interface Bilan {
  id: string;
  titre: string;
  produit: string;
  branche: string;
  dateGeneration: string;
  periodeOuverture: string;
  periodeClôture: string;
  source: string;
  status: "brouillon" | "valide" | "archive";
  lockedAt?: string;
  lockedBy?: string;
  rows: BilanRow[];
}

// Vérification comptable : ouverture + repris + déclarés − réglés − css ± reeval = réserves
export function verifRow(r: BilanRow) {
  const nbre =
    r.ouverture.nbre + r.repris.nbre + r.declares.nbre
    - r.reglements.nbre - r.css.nbre;
  const montant =
    r.ouverture.montant + r.repris.montant + r.declares.montant
    - r.reglements.montant - r.css.montant
    + r.reeval.positif - r.reeval.negatif;
  return {
    nbreOk:    nbre    === r.reserves.nbre,
    montantOk: Math.abs(montant - r.reserves.montant) < 1,
  };
}

export function totalRow(rows: BilanRow[]): BilanRow {
  const sum = (key: (r: BilanRow) => number) => rows.reduce((s, r) => s + key(r), 0);
  return {
    exercice: 0,
    ouverture:  { nbre: sum(r => r.ouverture.nbre),  montant: sum(r => r.ouverture.montant) },
    repris:     { nbre: sum(r => r.repris.nbre),     montant: sum(r => r.repris.montant) },
    declares:   { nbre: sum(r => r.declares.nbre),   montant: sum(r => r.declares.montant) },
    reglements: { nbre: sum(r => r.reglements.nbre), montant: sum(r => r.reglements.montant) },
    css:        { nbre: sum(r => r.css.nbre),         montant: sum(r => r.css.montant) },
    reeval:     { positif: sum(r => r.reeval.positif), negatif: sum(r => r.reeval.negatif) },
    reserves:   { nbre: sum(r => r.reserves.nbre),   montant: sum(r => r.reserves.montant) },
  };
}

// ─────────────────────────────────────────────────────────────
// HISTORIQUE — bilans archivés (immuables) + brouillon courant
// ─────────────────────────────────────────────────────────────
export const bilans: Bilan[] = [
  // ── 2023 — Archivé ─────────────────────────────────────────
  {
    id: "bilan-2023",
    titre: "Bilan des sinistres — Exercice 2023",
    produit: "Prévoyance",
    branche: "Vie & Prévoyance",
    dateGeneration: "2024-02-15",
    periodeOuverture: "01/01/2023",
    periodeClôture: "31/12/2023",
    source: "SAP_2023_FINAL.xlsx",
    status: "archive",
    lockedAt: "2024-03-01",
    lockedBy: "Direction Technique",
    rows: [
      {
        exercice: 2021,
        ouverture:  { nbre: 12, montant: 18400000  },
        repris:     { nbre:  0, montant: 0          },
        declares:   { nbre:  0, montant: 0          },
        reglements: { nbre:  8, montant: 14200000  },
        css:        { nbre:  2, montant: 2800000   },
        reeval:     { positif: 0, negatif: 1400000 },
        reserves:   { nbre:  2, montant: 0          },
      },
      {
        exercice: 2022,
        ouverture:  { nbre: 38, montant: 52600000  },
        repris:     { nbre:  2, montant: 2400000   },
        declares:   { nbre:  0, montant: 0          },
        reglements: { nbre: 18, montant: 29800000  },
        css:        { nbre:  7, montant: 8400000   },
        reeval:     { positif: 600000, negatif: 0  },
        reserves:   { nbre: 15, montant: 17400000  },
      },
      {
        exercice: 2023,
        ouverture:  { nbre:  0, montant: 0          },
        repris:     { nbre:  0, montant: 0          },
        declares:   { nbre: 94, montant: 112800000 },
        reglements: { nbre: 12, montant: 14400000  },
        css:        { nbre: 18, montant: 21600000  },
        reeval:     { positif: 0, negatif: 0        },
        reserves:   { nbre: 64, montant: 76800000  },
      },
    ],
  },

  // ── 2024 — Archivé ─────────────────────────────────────────
  {
    id: "bilan-2024",
    titre: "Bilan des sinistres — Exercice 2024",
    produit: "Prévoyance",
    branche: "Vie & Prévoyance",
    dateGeneration: "2025-02-10",
    periodeOuverture: "01/01/2024",
    periodeClôture: "31/12/2024",
    source: "SAP_2024_FINAL.xlsx",
    status: "archive",
    lockedAt: "2025-03-01",
    lockedBy: "Direction Technique",
    rows: [
      {
        exercice: 2022,
        ouverture:  { nbre: 15, montant: 17400000  },
        repris:     { nbre:  0, montant: 0          },
        declares:   { nbre:  0, montant: 0          },
        reglements: { nbre: 10, montant: 13200000  },
        css:        { nbre:  4, montant: 3600000   },
        reeval:     { positif: 0, negatif: 600000  },
        reserves:   { nbre:  1, montant: 0          },
      },
      {
        exercice: 2023,
        ouverture:  { nbre: 64, montant: 76800000  },
        repris:     { nbre:  3, montant: 3600000   },
        declares:   { nbre:  0, montant: 0          },
        reglements: { nbre: 28, montant: 38400000  },
        css:        { nbre: 14, montant: 16800000  },
        reeval:     { positif: 1200000, negatif: 0 },
        reserves:   { nbre: 25, montant: 26400000  },
      },
      {
        exercice: 2024,
        ouverture:  { nbre:  0, montant: 0          },
        repris:     { nbre:  0, montant: 0          },
        declares:   { nbre:  4, montant: 18000000  },
        reglements: { nbre:  0, montant: 0          },
        css:        { nbre:  0, montant: 0          },
        reeval:     { positif: 0, negatif: 0        },
        reserves:   { nbre:  4, montant: 18000000  },
      },
    ],
  },

  // ── 2025 — Brouillon (données SAP au 30/06/2025, FILE 1) ──
  {
    id: "bilan-2025",
    titre: "Bilan des sinistres — Exercice 2025",
    produit: "Prévoyance",
    branche: "Vie & Prévoyance",
    dateGeneration: "2025-07-01",
    periodeOuverture: "01/01/2025",
    periodeClôture: "31/12/2025",
    source: "level 01-DATA SAP groupe.xlsx (30/06/2025)",
    status: "brouillon",
    rows: [
      // Exercice 2023 — 1 sinistre restant
      {
        exercice: 2023,
        ouverture:  { nbre:  1, montant: 1200000   },
        repris:     { nbre:  0, montant: 0          },
        declares:   { nbre:  0, montant: 0          },
        reglements: { nbre:  0, montant: 0          },
        css:        { nbre:  0, montant: 0          },
        reeval:     { positif: 0, negatif: 0        },
        reserves:   { nbre:  1, montant: 1200000   },
      },
      // Exercice 2024 — 4 sinistres (3 réglés, 1 en cours)
      {
        exercice: 2024,
        ouverture:  { nbre:  4, montant: 18000000  },
        repris:     { nbre:  0, montant: 0          },
        declares:   { nbre:  0, montant: 0          },
        reglements: { nbre:  3, montant: 13500000  },
        css:        { nbre:  0, montant: 0          },
        reeval:     { positif: 0, negatif: 4500000 },
        reserves:   { nbre:  1, montant: 0          },
      },
      // Exercice 2025 — 229 sinistres (FILE 1)
      // SAP=171 en cours, REGLE=32, REJET=26 (au 30/06 uniquement)
      {
        exercice: 2025,
        ouverture:  { nbre:   0, montant: 0          },
        repris:     { nbre:   0, montant: 0          },
        declares:   { nbre: 229, montant: 723600000 },
        reglements: { nbre:  32, montant: 124000000 },
        css:        { nbre:  26, montant: 31200000  },
        reeval:     { positif: 0, negatif: 0        },
        reserves:   { nbre: 171, montant: 568400000 },
      },
    ],
  },
];
