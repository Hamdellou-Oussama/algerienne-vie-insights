# FONDATION HACKATHON — SYSTÈME DE PROVISIONNEMENT TECHNIQUE

## Document de référence exhaustif : Équations · Algorithmes · Architecture · UI/UX

**Sources consolidées :**

- `IBNR_reserving.pdf` — Pr. Adlane HAFFAR (NHSM) — 283 slides
- `EIC-provisionnement_170426.pptx` — SLIMANI Si Takieddine Abderaouf — 41 slides
- `CALCUL_DES_PROVISIONS_TECHNIQUES_VMF.pdf` — Annexe réglementaire
- `Cadrage_du_défi_et_méthodologie_d_évaluation.pdf` — Règlement du concours

---

# PARTIE I — CATALOGUE EXHAUSTIF DES ÉQUATIONS & ALGORITHMES (FACTS)

---

## MODULE 1 — IDENTITÉS FONDAMENTALES

### 1.1 Relations structurelles du passif technique

```
Provision_Totale = PSAP + IBNR

SAP = PSAP + IBNR

Charge_Ultime = Déjà_Payé + PSAP + IBNR

IBNR = Sinistres_ultimes_estimés − Sinistres_cumulés_observés
     = S_ult − S_obs

Fonds_Propres = Actif_Total − Provisions_Techniques

Résultat_Technique = Primes_acquises − Sinistres − Charges_techniques

Résultat_Global = Résultat_Technique + Produits_financiers

Loss_Ratio (S/P) = Sinistres / Primes
```

### 1.2 Information disponible à l'instant n

```
ℋ_n = { X_{i,j} : i + j ≤ n } = { C_{i,j} : i + j ≤ n }

ℱ_{i, n−i} = { X_{i,j} : j = 0, …, n−i } = { C_{i,j} : j = 0, …, n−i }
```

### 1.3 Objectif de prédiction

```
Ĉ_{i,n}^{(n−i)} = E[ C_{i,n} | ℱ_{i, n−i} ]

R̂_i = Ĉ_{i,n} − C_{i, n−i}         (réserve IBNR par année de survenance)

R̂ = Σ_i R̂_i                         (réserve totale agrégée)
```

### 1.4 Claims Development Result (CDR)

```
CDR_i(n) = Δ_i^n = Ĉ_{i,n}^{(n−i+1)} − Ĉ_{i,n}^{(n−i)}

E[ Δ_i^n | ℱ_{i, n−i} ] = 0          (espérance nulle — ni boni ni mali en moyenne)
```

---

## MODULE 2 — PROVISION POUR PRIMES NON ACQUISES (PPNA)

### 2.1 Formule au prorata temporis

```
PPNA = Σ_{polices} ( P_nette × N_jours_restants / N_jours_période )
```

### 2.2 Formulation actuarielle détaillée

```
PPNA = Σ_{polices} [ P_nette × (Date_échéance_i − Date_arrêtée)
                              / (Date_échéance_i − Date_effet_i) ]
```

| Symbole              | Définition                                           |
| -------------------- | ----------------------------------------------------- |
| `P_nette`          | Prime émise nette d'annulations et de taxes          |
| `N_jours_restants` | Jours entre date d'inventaire et prochaine échéance |
| `N_jours_période` | Durée totale de la période de couverture            |

---

## MODULE 3 — PROVISION POUR SINISTRES À PAYER (PSAP)

### 3.1 Formule générale (méthode dossier par dossier)

```
PSAP = Σ_{s=1}^{S} ( E[Coût_final_s] − Déjà_payé_s )
     = Σ_{s=1}^{S} ( Charge_ultime_estimée_s − Paiements_cumulés_s )
```

### 3.2 Décomposition de la charge ultime par dossier

```
Charge_ultime_s = Indemnités_s + Frais_gestion_s + Frais_juridiques_s + Autres_coûts_s
```

| Symbole              | Définition                                         |
| -------------------- | --------------------------------------------------- |
| `S`                | Nombre total de sinistres déclarés non clôturés |
| `E[Coût_final_s]` | Estimation actuarielle du coût total du sinistre s |
| `Déjà_payé_s`   | Cumul des règlements effectués pour le sinistre s |

---

## MODULE 4 — PROVISION POUR RISQUES EN COURS (PRC)

### 4.1 Formule

```
PRC = max( 0,  Coût_futur_estimé − PPNA )
```

> Si PRC > 0 → signal d'alarme : tarification insuffisante.

---

## MODULE 5 — PROVISION POUR SINISTRES NON DÉCLARÉS (IBNR)

### 5.1 Triangle de développement — Notation standard

```
C_{i,j}  : paiements cumulés, année de survenance i, développement j
Y_{i,j}  : paiements incrementaux, Y_{i,j} = C_{i,j} − C_{i,j−1}
N_{i,j}  : nombre cumulé de sinistres
Γ_{i,j}  : charge dossier-par-dossier cumulée (triangle des chargés)
P_i      : prime acquise de l'année i
```

---

## MODULE 6 — MÉTHODE CHAIN-LADDER

### 6.1 Hypothèse fondamentale

```
C_{i, j+1} = λ_j × C_{i,j}     pour tout i, j = 1, …, n
```

### 6.2 Estimateur des facteurs de développement

```
λ̂_j = Σ_{i=1}^{n−j} C_{i, j+1}
       ─────────────────────────
       Σ_{i=1}^{n−j} C_{i,j}
```

### 6.3 Écriture comme moyenne pondérée

```
λ̂_j = Σ_{i=1}^{n−j} ω_{i,j} × λ_{i,j}

où  ω_{i,j} = C_{i,j} / Σ_{i=1}^{n−j} C_{i,j}
et  λ_{i,j} = C_{i, j+1} / C_{i,j}
```

### 6.4 Projections des cases futures

```
Ĉ_{i,j} = λ̂_{n+1−i} × … × λ̂_{j−1} × C_{i, n+1−i}
```

### 6.5 Réserve par année de survenance

```
R̂_i = Ĉ_{i,n} − C_{i, n−i}
```

### 6.6 Réserve totale (formule rapide)

```
R̂_total = Σ_i [ ( ∏_{k=n−i+1}^{n} λ̂_k − 1 ) × C_{i, n−i} ]
```

### 6.7 Taux de paiement cumulatifs et incrémentaux

```
γ̂_j = 1 / ∏_{k=j}^{n−1} λ̂_k          (taux cumulatif de paiement jusqu'à maturité)

φ̂_j = γ̂_j − γ̂_{j−1}                  (taux incrémental de paiement)
```

### 6.8 Équivalence avec la régression pondérée

```
λ̂_j = argmin Σ_{i=1}^{n−j} (1/C_{i,j}) × ( C_{i,j+1} − λ_j × C_{i,j} )²
```

### 6.9 Extrapolation queue de distribution (λ_∞)

```
log(λ_k − 1) = a + b × k              (modèle log-linéaire sur les facteurs)

λ_∞ = ∏_{k≥n} λ̂_k                    (produit infini extrapolé)

C_{i,∞} = C_{i,n} × λ_∞
```

---

## MODULE 7 — MODÈLE DE MACK (1993)

### 7.1 Hypothèses du modèle

```
(H1) E[ C_{i,j+1} | ℋ_{i+j} ] = E[ C_{i,j+1} | C_{i,j} ] = λ_j × C_{i,j}

(H2) Var[ C_{i,j+1} | ℋ_{i+j} ] = Var[ C_{i,j+1} | C_{i,j} ] = σ²_j × C_{i,j}

(H3) { C_{i,j} }_{j≥0} indépendant de { C_{i',j} }_{j≥0}  pour i ≠ i'
```

### 7.2 Écriture stochastique du modèle

```
C_{i,j+1} = λ_j × C_{i,j} + σ_j × √C_{i,j} × ε_{i,j}

où ε_{i,j} sont i.i.d., E[ε]=0, Var[ε]=1
```

### 7.3 Propagation de l'espérance

```
E[ C_{i,j+k} | ℋ_{i+j} ] = λ_j × λ_{j+1} × … × λ_{j+k−1} × C_{i,j}
```

### 7.4 Estimateur de la volatilité σ²_j

```
σ̂²_j = ────────── 1 ─────────── × Σ_{i=0}^{n−j−1} C_{i,j} × ( C_{i,j+1}/C_{i,j} − λ̂_j )²
         n − j − 1
```

Forme équivalente avec résidus standardisés :

```
ε̂_{i,j} = ( C_{i,j+1} − λ̂_j × C_{i,j} ) / √C_{i,j}

σ̂²_j = 1/(n−j−1) × Σ_{i=0}^{n−j−1} ε̂²_{i,j}
```

### 7.5 Mean Squared Error of Prediction (MSEP)

```
msep(R̂) = E[ (R̂ − R)² ]

msep_n(R̂) = E[ (R̂ − R)² | ℋ_n ]     (conditionnel)

msep(R̂) ≈ E[ (R̂ − E[R̂])² ]  +  E[ (R − E[R])² ]
           ─────────────────────    ─────────────────
           Erreur d'estimation        Erreur de modèle
                                      = V(R)
```

### 7.6 MSEP par année de survenance et agrégé

La formule de Mack pour msep_n de R̂_i et de R̂_total (somme agrégée) est calculable en combinant les σ̂²_j, les λ̂_j, et les C_{i,j} observés.

---

## MODULE 8 — CDR & MERZ-WÜTHRICH (one-year uncertainty)

### 8.1 Définition du CDR

```
CDR_i(n) = Ĉ_{i,n}^{(n+1)} − Ĉ_{i,n}^{(n)}     (Claims Development Result)
```

### 8.2 Formule de Merz-Wüthrich pour msep_c(CDR_i(n))

```
msep_c( CDR_i(n) ) = Ĉ²_{i,∞} × ( Γ̂_{i,n} + Δ̂_{i,n} )
```

### 8.3 Composantes

```
Δ̂_{i,n} = σ̂²_{n−i+1} / ( λ̂²_{n−i+1} × S^{n+1}_{n−i+1} )
          + Σ_{j=n−i+2}^{n−1} ( C_{n−j+1,j} / S^{n+1}_j )² × σ̂²_j / ( λ̂²_j × S^n_j )

Γ̂_{i,n} = 1 + σ̂²_{n−i+1} / ( λ̂²_{n−i+1} × C_{i, n−i+1} )
          × ∏_{j=n−i+2}^{n−1} [ 1 + σ̂²_j / ( λ̂²_j × S^{n+1}_j ) ]²_{C_{n−j+1,j} − 1}
```

Approximation linéaire (valide si σ̂²_j / λ̂²_j ≪ C_{n−j+1,j}) :

```
Γ̂_{i,n} ≈ σ̂²_{n−i+1} / ( λ̂²_{n−i+1} × C_{i, n−i+1} )
          + Σ_{j=n−i+2}^{n−1} ( C_{n−j+1,j} / S^{n+1}_j )² × σ̂²_j / ( λ̂²_j × C_{n−j+1,j} )
```

---

## MODULE 9 — MUNICH CHAIN LADDER

### 9.1 Données et ratios

```
Q_{i,j}   = C_{i,j} / Γ_{i,j}          (ratio paiements / charge)

Q⁻¹_{i,j} = Γ_{i,j} / C_{i,j}          (ratio inverse)
```

### 9.2 Hypothèses du modèle

```
E[ C_{i,j+1} | ℱ^C_{i+j} ] = λ^C_j × C_{i,j}
E[ Γ_{i,j+1} | ℱ^Γ_{i+j} ] = λ^Γ_j × Γ_{i,j}

Var[ C_{i,j+1} | ℱ^C_{i+j} ] = (σ^C_j)² × C_{i,j}
Var[ Γ_{i,j+1} | ℱ^Γ_{i+j} ] = (σ^Γ_j)² × Γ_{i,j}
```

### 9.3 Facteurs de transition individuels

```
λ^C_{i,j−1} = C_{i,j} / C_{i,j−1}
λ^Γ_{i,j−1} = Γ_{i,j} / Γ_{i,j−1}
```

### 9.4 Correction croisée (Munich adjustment)

```
E[ λ^C_{i,j−1} | ℱ_{i+j} ] = λ^C_{j−1} + λ̂^C × Var[ λ^C_{i,j−1} | ℱ^C_{i+j} ]
                               × ( Q⁻¹_{i,j−1} − E[ Q⁻¹_{i,j−1} | ℱ^C_{i+j} ] )
                                 / Var[ Q⁻¹_{i,j−1} | ℱ^C_{i+j} ]

E[ λ^Γ_{i,j−1} | ℱ_{i+j} ] = λ^Γ_{j−1} + λ̂^Γ × Var[ λ^Γ_{i,j−1} | ℱ^Γ_{i+j} ]
                               × ( Q_{i,j−1} − E[ Q_{i,j−1} | ℱ^Γ_{i+j} ] )
                                 / Var[ Q_{i,j−1} | ℱ^Γ_{i+j} ]
```

### 9.5 Estimateur du ratio moyen

```
Q̂_j = Σ_{i=0}^{n_j} C_{i,j} / Σ_{i=0}^{n_j} Γ_{i,j} = 1 / Q̂⁻¹_j
```

### 9.6 Variance conditionnelle du ratio

```
V̂[ Q_{i,j} | ℱ^Γ_{i+j} ] = (…) × Σ_{i=0}^{n−j} Γ_{i,j} × ( Q_{i,j} − Q̂_j )²
```

### 9.7 Corrélations conditionnelles (termes λ^C, λ^Γ)

```
λ̂^C = Cor[ Γ_{i,j−1}, C_{i,j} | ℱ^C_{i+j−1} ]

λ̂^Γ = Cor[ C_{i,j−1}, Γ_{i,j} | ℱ^Γ_{i+j−1} ]

λ̂^Γ = Σ Q̃_{i,j−1} × λ̃^Γ_{i,j} / Σ Q̃²_{i,j−1}
```

---

## MODULE 10 — MÉTHODES DE RÉGRESSION (IBNR econométrique)

### 10.1 Modèle log-normal (Christofides / De Vylder)

```
log Y_{i,j} ~ N( a_i + b_j , σ² )

Ŷ_{i,j} = exp( â_i + b̂_j + σ̂²/2 )    (correction du biais lognormal)
```

### 10.2 Modèle de Taylor (effet diagonale)

```
Y_{i,j} = r_j × μ_{i+j}
log Y_{i,j} = α_i + γ_{i+j}
```

### 10.3 Modèle de De Vylder (normal)

```
Y_{i,j} ~ N( α_i × β_j , σ² )

(α̂, β̂) = argmin Σ_{i,j} ( Y_{i,j} − α_i × β_j )²
```

### 10.4 Modèle GLM Poisson (Hachemeister-Stanard)

```
E[ Y_{i,j} | ℱ_n ] = μ_{i,j} = exp( γ + r_i + c_j )

Ŷ_{i,j} = exp( γ̂ + r̂_i + ĉ_j )
```

> Résultat fondamental : l'estimateur GLM Poisson est **identique** à l'estimateur Chain Ladder.

### 10.5 Modèle Quasi-Poisson (overdispersion)

```
E[ Y_{i,j} | ℱ_n ] = μ_{i,j}

Var[ Y_{i,j} | ℱ_n ] = φ × μ_{i,j}

φ̂ = Σ résidus_Pearson² / (n − k)     où k = nombre de paramètres
```

### 10.6 Résidus de Pearson standardisés

```
ε̂_{i,j} = ( Y_{i,j} − Ŷ_{i,j} ) / √Ŷ_{i,j}

ε̂_{i,j}^{adj} = ε̂_{i,j} × √( n / (n−k) )     (résidus ajustés pour bootstrap)
```

---

## MODULE 11 — INCERTITUDE DANS LE MODÈLE DE RÉGRESSION

### 11.1 Méthode delta (variante GLM log-link)

```
Var[ Ŷ_{i,j} ] ≈ ( ∂μ_{i,j} / ∂η_{i,j} )² × V̂[ η̂_{i,j} ]
               = μ²_{i,j} × V̂[ η̂_{i,j} ]          (pour lien log)
```

### 11.2 Covariance entre prédictions futures (quasi-Poisson)

```
Cov[ Ŷ_{i,j}, Ŷ_{k,l} ] ≈ μ̂_{i,j} × μ̂_{k,l} × Cov̂[ η̂_{i,j}, η̂_{k,l} ]
```

### 11.3 MSEP total de la réserve (GLM)

```
E[ (R̂ − R)² ] ≈ φ̂ × Σ_{i+j>n} μ̂_{i,j}  +  μ̂'_F × V̂(η̂_F) × μ̂_F
                  ─────────────────────────    ────────────────────────
                    Erreur de processus           Erreur d'estimation

où μ̂_F, η̂_F = vecteurs restreints au bas du triangle (i+j > n)
```

### 11.4 Bootstrap (estimation de l'erreur d'estimation)

```
Pseudo-triangle :  Y^b_{i,j} = Ŷ_{i,j} + √Ŷ_{i,j} × ε̃^b_{i,j}
ε̃^b : tiré avec remise parmi { ε̂^{adj}_{i,j} }

R̂^b = Σ_{i+j>n} Ŷ^b_{i,j}      (réserve du pseudo-triangle b)
```

### 11.5 Simulation de l'erreur de processus

**Poisson :**

```
Y^{scen}_{i,j} ~ Poisson( Ŷ^b_{i,j} )
```

**Gamma (quasi-Poisson overdispersé) :**

```
Y^{scen}_{i,j} ~ Gamma( α = Ŷ_{i,j}/φ,  β = φ )      E=Ŷ, Var=φ×Ŷ
```

**Binomiale négative :**

```
Y^{scen}_{i,j} ~ NegBin( μ = Ŷ_{i,j},  k = Ŷ_{i,j}/(φ×Ŷ_{i,j} − 1) )
```

**Mack stochastique (England-Verrall) :**

```
Ĉ^b_{i,j+1} | Ĉ^b_{i,j} ~ N( λ̂_j × Ĉ^b_{i,j},  σ̂²_j × Ĉ^b_{i,j} )
```

---

## MODULE 12 — MODÈLES TWEEDIE

### 12.1 Fonction de lien (Box-Cox généralisé)

```
g_λ(x) = λ⁻¹ × (x^λ − 1)     si λ > 0
g_0(x) = log(x)               (cas limite λ→0, équivalent Poisson)
```

### 12.2 Fonction de variance

```
Var[ Y_{i,j} | ℱ_n ] = φ × E[ Y_{i,j} | ℱ_n ]^μ
```

### 12.3 Prédiction

```
Ŷ_{i,j} = g⁻¹_λ( γ̂ + α̂_i + β̂_j )
```

### 12.4 Profil de vraisemblance pour μ

```
μ_opt = argmax_{μ ∈ (1,2)} log L_Tweedie(μ, φ̂, données)
```

> μ=1 : Poisson (correspond à Chain Ladder), μ=2 : Gamma

---

## MODULE 13 — MÉTHODE BORNHUETTER-FERGUSON (BF)

### 13.1 Hypothèse du modèle

```
E[ C_{i,1} ] = β_1 × μ_i
E[ C_{i,j+k} | C_{i,1}, …, C_{i,j} ] = C_{i,j} + (β_{j+k} − β_j) × μ_i
E[ C_{i,j} ] = β_j × μ_i
```

### 13.2 Taux de paiement cumulatif (issu de Chain Ladder)

```
β̂_j = 1 / ∏_{k=j+1}^{n} λ̂_k      (= γ̂_j dans la notation Chain Ladder)
```

### 13.3 Estimateur BF de la charge ultime

```
Ĉ^{BF}_{i,n} = C_{i, n−i} + (1 − β̂_{n−i}) × μ̂_i
```

### 13.4 Réserve BF

```
R̂^{BF}_i = (1 − β̂_{n−i}) × μ̂_i
```

---

## MODULE 14 — MÉTHODE BENKTANDER (BH / Hovinen)

### 14.1 Estimateur de Benktander

```
Ĉ^{BH}_{i,n} = β̂_{n−i} × Ĉ^{CL}_{i,n} + (1 − β̂_{n−i}) × Ĉ^{BF}_{i,n}
```

### 14.2 Réserve de Benktander

```
R̂^{BH}_i = Ĉ^{BH}_{i,n} − C_{i, n−i}
          = (1 − β̂_{n−i}) × [ β̂_{n−i} × Ĉ^{CL}_{i,n} + (1 − β̂_{n−i}) × μ̂_i ]
```

> Interprétation : combinaison convexe de Chain Ladder et Bornhuetter-Ferguson.

---

## MODULE 15 — MÉTHODE CAPE COD

### 15.1 Taux de paiement (issu de Chain Ladder)

```
π_{n−i} = C_{i, n−i} / Ĉ^{CL}_{i,n}
```

### 15.2 Loss Ratio agrégé (estimé sur un ensemble 𝒜 d'années)

```
LR_𝒜 = Σ_{k ∈ 𝒜} C_{n, n−k} / Σ_{k ∈ 𝒜} π_{n−k} × P_k
```

### 15.3 Réserve Cape Cod

```
R_i = (1 − π_{n−i}) × LR_𝒜 × P_i
```

### 15.4 Loss Ratio Chain Ladder (si utilisé comme a priori)

```
LR_i = Ĉ^{CL}_{i,n} / P_i
```

---

## MODULE 16 — MÉTHODE LOSS RATIO

```
Charge_Ultime = Primes × Loss_Ratio_a_priori
Provision = Charge_Ultime − Déjà_Payé
```

---

## MODULE 17 — APPROCHE BAYÉSIENNE

### 17.1 Modèle probabiliste sur les facteurs de transition

```
λ_{i,j} | γ_j, σ²_j  ~  N( γ_j,  σ²_j / C_{i,j} )
```

### 17.2 Log-vraisemblance

```
log L(λ | γ) = Σ_{i,j} [ (C_{i,j−1} / 2σ²_j) × log(C_{i,j−1} / σ²_j)
                         − (1 / 2σ²_j) × ( λ_{i,j} − γ_j )² × C_{i,j−1} ]
```

### 17.3 Posterior (formule de Bayes)

```
log g(λ | γ) = log π(γ) + log L(λ | γ) + constante

où π(γ) : loi a priori sur γ (ex: vecteur gaussien)
```

---

## MODULE 18 — TRIANGLES MULTIVARIÉS

### 18.1 Modèle de Pröhl-Schmidt (Chain Ladder multivarié)

```
C_{i,j} = ( C^{(k)}_{i,j} )  ∈ ℝ^K           (vecteur K triangles)

E[ C_{i,j} | C_{i,j−1} ] = diag(λ_{j−1}) × C_{i,j−1}

Cov[ C_{i,j}, C_{i,j} | C_{i,j−1} ] = diag(√C_{i,j−1}) × Σ_{j−1} × diag(√C_{i,j−1})
```

### 18.2 Estimateur multivarié des facteurs de développement

```
λ̂_j = [ Σ_{i=0}^{n−j−1} diag(√C_{i,j−1}) × Σ⁻¹_j × diag(√C_{i,j−1}) ]⁻¹
       × Σ_{i=0}^{n−j−1} diag(√C_{i,j−1}) × Σ⁻¹_j × diag(√C_{i,j−1}) × λ_{i,j+1}
```

### 18.3 Projections multivariées

```
Ĉ_{i,n} = ∏_{j=n−i}^{n−1} diag(λ̂_j) × C_{i, n−i}
```

### 18.4 Approximation lognormale par triangle

```
μ_LN = log(E[X]) − (1/2) × log( 1 + V(X)/E(X)² )
σ²_LN = log( 1 + V(X)/E(X)² )

si X ~ LN(μ_LN, σ²_LN)  →  E[X] et V[X] connus via Mack
```

### 18.5 Corrélation entre triangles (modèle de régression bivarié)

```
ρ = Cor[ résidus_Pearson_triangle_1, résidus_Pearson_triangle_2 ]

Simulation appariée : (ε̃^{mat,b}_{i,j}, ε̃^{corp,b}_{i,j})  tirés conjointement
```

### 18.6 Simulation multivariée Mack (bivarié)

```
⎛ C^{mat}_{i,j+1}  ⎞         ⎛ λ^m_j × C^{mat}_{i,j}  ⎞       ⎛ σ^{m²}_j × C^{mat}_{i,j}   * ⎞
⎝ C^{corp}_{i,j+1} ⎠  ~  N  ⎝ λ^c_j × C^{corp}_{i,j} ⎠  ,   ⎝         *   σ^{c²}_j × C^{corp}_{i,j} ⎠
```

---

## MODULE 19 — PROVISION POUR ÉGALISATION (PE)

### 19.1 Condition de déclenchement et formule

```
Si RT_N > 0 :

PE_N = min( 72% × RT_N⁺  ;  15% × MOYENNE(A1, A2, A3) )

où  RT_N⁺ = max(0, Résultat_Technique_N)
    A1 = Charge_sinistre_{N−1}
    A2 = Charge_sinistre_{N−2}
    A3 = Charge_sinistre_{N−3}
```

| Symbole    | Définition                                      |
| ---------- | ------------------------------------------------ |
| `72%`    | Taux de dotation potentielle (plafond résultat) |
| `15%`    | Taux de la charge sinistre (plafond historique)  |
| `RT_N⁺` | Résultat technique bénéficiaire avant PE      |

---

## MODULE 20 — PROVISION POUR PARTICIPATION AUX BÉNÉFICES (PB)

### 20.1 Calcul en 3 étapes

```
RT = Primes_acquises − Sinistres − Charges_techniques

RG = RT + Produits_financiers

PB = RG × α
```

### 20.2 Condition de déclenchement

```
Ratio_S/P = Sinistres / Primes_acquises

PB > 0  ssi  Ratio_S/P < Seuil  (ex : 85%)
```

| Symbole   | Définition                                      |
| --------- | ------------------------------------------------ |
| `α`    | Taux de participation (typiquement 20% à 30%)   |
| `Seuil` | Seuil contractuel ou réglementaire du ratio S/P |

---

## MODULE 21 — FRAIS DE GESTION DE SINISTRES (FGS)

### 21.1 Méthode 1 — Taux forfaitaire

```
FGS = Sinistres × T_gestion
```

### 21.2 Méthode 2 — Coût unitaire par dossier

```
FGS = N_sinistres × CM_dossier
```

### 21.3 Méthode 3 — Approche analytique

```
FGS = Charges_RH + Frais_experts + Frais_indirects
    = Salaires_gestionnaires + Honoraires_externes + (IT + Structure)
```

| Symbole         | Définition                        |
| --------------- | ---------------------------------- |
| `T_gestion`   | Taux forfaitaire de gestion (%)    |
| `N_sinistres` | Nombre de sinistres de la période |
| `CM_dossier`  | Coût moyen par dossier            |

---

# PARTIE II — ARCHITECTURE SYSTÈME & ALGORITHMES (SUGGESTED-NOT FINAL)

---

## MODULE 22 — ARCHITECTURE DE L'APPLICATION (4 COUCHES)

```
┌─────────────────────────────────────────────────────┐
│  COUCHE 1 — INGESTION DES DONNÉES                   │
│  ▸ Import CSV / Excel                               │
│  ▸ Validation automatique des formats               │
│  ▸ Gestion des valeurs manquantes                   │
│  ▸ Nettoyage des formats dates                      │
│  ▸ Normalisation des unités monétaires              │
└─────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────┐
│  COUCHE 2 — MOTEUR ACTUARIEL                        │
│  Modules indépendants et testables :                │
│  ▸ Module PPNA                                      │
│  ▸ Module PSAP (dossier par dossier)                │
│  ▸ Module IBNR (Chain Ladder / BF / LR / Mack)     │
│  ▸ Module PRC                                       │
│  ▸ Module PE                                        │
│  ▸ Module PB                                        │
│  ▸ Module Frais de gestion                          │
│  ▸ Module Munich Chain Ladder (optionnel)           │
│  ▸ Module Bootstrap / Simulation (optionnel)        │
└─────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────┐
│  COUCHE 3 — ORCHESTRATEUR                           │
│  ▸ Exécution séquentielle logique                   │
│  ▸ Dépendances inter-provisions :                   │
│     PPNA → PRC                                      │
│     PSAP + IBNR → SAP                               │
│     SAP → PE                                        │
│     SAP → Frais de gestion                          │
│  ▸ Audit trail de chaque étape                      │
│  ▸ Gestion des erreurs et rollback                  │
└─────────────────────────────────────────────────────┘
           ▼
┌─────────────────────────────────────────────────────┐
│  COUCHE 4 — OUTPUT                                  │
│  ▸ Dashboard interactif                             │
│  ▸ Export Excel / CSV                               │
│  ▸ Rapport automatique PDF                          │
│  ▸ Audit trail complet                              │
│  ▸ Logs horodatés                                   │
└─────────────────────────────────────────────────────┘
```

## MODULE 23 — ALGORITHME GÉNÉRAL D'ORCHESTRATION

```
ALGORITHME Orchestrateur_Provisions(données_brutes):

  ÉTAPE 0 — Validation
    données_propres ← Ingestion(données_brutes)
    SI erreur_validation → lever exception + log

  ÉTAPE 1 — Provisions indépendantes
    PPNA  ← calcul_PPNA(données_propres)
    PSAP  ← calcul_PSAP(données_propres)

  ÉTAPE 2 — Provisions dépendantes (PPNA ready)
    PRC   ← calcul_PRC(PPNA, coût_futur_estimé)

  ÉTAPE 3 — IBNR (selon méthode choisie)
    triangle ← construire_triangle(données_propres)
    SI méthode = "chain_ladder" :
        IBNR ← chain_ladder(triangle)
    SI méthode = "BF" :
        IBNR ← bornhuetter_ferguson(triangle, loss_ratio_a_priori, primes)
    SI méthode = "loss_ratio" :
        IBNR ← loss_ratio_method(primes, LR_a_priori, déjà_payé)
    SI méthode = "mack" :
        IBNR, MSEP ← mack_chain_ladder(triangle)
    SI méthode = "munich" :
        IBNR ← munich_chain_ladder(triangle_paid, triangle_incurred)

  ÉTAPE 4 — SAP
    SAP ← PSAP + IBNR

  ÉTAPE 5 — Frais de gestion
    FGS ← calcul_frais(SAP, méthode_frais)

  ÉTAPE 6 — Provisions conditionnelles
    PE  ← calcul_PE(RT, historique_sinistres)
    PB  ← calcul_PB(RT, produits_financiers, α, ratio_SP)

  ÉTAPE 7 — Bilan de synthèse
    passif_technique ← {PPNA, PSAP, IBNR, SAP, PRC, FGS, PE, PB}
    rapport ← générer_rapport(passif_technique, audit_trail)

  RETOURNER passif_technique, rapport
```

## MODULE 24 — ALGORITHME CHAIN LADDER (détaillé)

```
ALGORITHME Chain_Ladder(triangle C, facteur_queue f=1.0):

  n ← nb_lignes(C) = nb_colonnes(C)

  // Calcul des facteurs de développement
  POUR j ← 0 à n−2 :
    num ← Σ_{i=0}^{n−j−2} C[i][j+1]
    den ← Σ_{i=0}^{n−j−2} C[i][j]
    λ[j] ← num / den

  // Complétion du triangle
  Ĉ ← copie(C)
  POUR j ← 0 à n−2 :
    POUR i ← (n−j−1) à (n−1) :
      Ĉ[i][j+1] ← λ[j] × Ĉ[i][j]

  // Charges ultimes et réserves
  POUR i ← 0 à n−1 :
    charge_ultime[i] ← Ĉ[i][n−1] × f
    dernier_observé[i] ← C[i][n−1−i]
    réserve[i] ← charge_ultime[i] − dernier_observé[i]

  réserve_totale ← Σ réserve[i]
  RETOURNER charge_ultime, réserve, réserve_totale, λ, Ĉ
```

## MODULE 25 — ALGORITHME BORNHUETTER-FERGUSON

```
ALGORITHME Bornhuetter_Ferguson(triangle C, primes P, LR_a_priori):

  λ ← chain_ladder_factors(C)
  β ← taux_de_paiement(λ)     // β[j] = 1 / ∏_{k=j+1}^{n} λ[k]
  μ ← LR_a_priori × P         // charge ultime a priori

  POUR i ← 0 à n−1 :
    dernier_observé ← C[i][n−1−i]
    q ← β[n−1−i]               // part déjà développée
    réserve_BF[i] ← (1 − q) × μ[i]
    charge_ultime_BF[i] ← dernier_observé + réserve_BF[i]

  RETOURNER charge_ultime_BF, réserve_BF
```

## MODULE 26 — ALGORITHME MACK (incertitude)

```
ALGORITHME Mack_Chain_Ladder(triangle C):

  λ, Ĉ ← chain_ladder(C)

  // Estimation des volatilités σ²_j
  POUR j ← 0 à n−3 :
    σ²[j] ← (1/(n−j−1)) × Σ_{i=0}^{n−j−2} C[i][j] × (C[i][j+1]/C[i][j] − λ[j])²

  σ²[n−2] ← min(σ²[n−4], σ²[n−3])    // extrapolation pour le dernier facteur

  // MSEP par année de survenance
  POUR i ← 1 à n−1 :
    msep[i] ← Ĉ[i][n−1]² × Σ_{j=n−i}^{n−2} ( σ²[j] / (λ[j]² × (S_j_available)) )

  // MSEP agrégé (inclut termes de covariance)
  msep_total ← formule_Mack_agrégée(msep, Ĉ, λ, σ²)

  RETOURNER λ, Ĉ, σ², msep, msep_total
```

## MODULE 27 — ALGORITHME BOOTSTRAP

```
ALGORITHME Bootstrap_Provisions(triangle Y, B=10000, méthode_processus):

  // Ajustement modèle initial
  GLM_initial ← glm_poisson(Y)
  Ŷ ← prédictions(GLM_initial)
  résidus ← résidus_Pearson_ajustés(Y, Ŷ, n, k)

  résultats_R ← []
  résultats_Rs ← []

  POUR b ← 1 à B :
    // Erreur d'estimation — pseudo-triangle
    ε̃ ← tirer_avec_remise(résidus, taille=n²)
    Y^b ← Ŷ + √Ŷ × ε̃                   // triangle bootstrappé
    SI min(Y^b observé) < 0 → ignorer itération
    GLM^b ← glm_poisson(Y^b)
    Ŷ^b ← prédictions(GLM^b)
    R̂^b ← Σ Ŷ^b[i+j>n]
    résultats_R.ajouter(R̂^b)

    // Erreur de processus — simulation de scénario
    SI méthode_processus = "poisson" :
        Y^{scen} ← rPoisson(Ŷ^b)
    SI méthode_processus = "gamma" :
        Y^{scen} ← rGamma(shape=Ŷ^b/φ̂, scale=φ̂)
    SI méthode_processus = "neg_binom" :
        Y^{scen} ← rNegBin(μ=Ŷ^b, k=Ŷ^b/(φ̂×Ŷ^b−1))
    R^{scen} ← Σ Y^{scen}[i+j>n]
    résultats_Rs.ajouter(R^{scen})

  distribution_R̂ ← résultats_R valides
  distribution_R  ← résultats_Rs valides
  quantiles ← { 75%, 95%, 99%, 99.5% } sur les deux distributions

  RETOURNER distribution_R̂, distribution_R, quantiles
```

---

# PARTIE III — SPÉCIFICATIONS UI/UX COMPLÈTES DU SITE HACKATHON (SUGGESTED-NOT FINAL, MERE SUGGESTIONS)

---

## MODULE 28 — STRUCTURE GLOBALE DU SITE (PAGES & NAVIGATION)

### 28.1 Pages principales (SUGGESTION ONLY, NEED MORE)

```
/                        → Page d'accueil / Landing
/dashboard               → Tableau de bord principal des provisions
/data-import             → Ingestion et validation des données
/triangle                → Visualisation et édition du triangle de développement
/provisions/ppna         → Module PPNA
/provisions/psap         → Module PSAP (dossier par dossier)
/provisions/ibnr         → Module IBNR (sélection de méthode)
/provisions/prc          → Module PRC
/provisions/pe           → Module Égalisation
/provisions/pb           → Module Participation aux Bénéfices
/provisions/frais        → Module Frais de Gestion
/bilan                   → Bilan du passif technique complet
/audit                   → Journal d'audit et traçabilité
/export                  → Export Excel / CSV / PDF
/settings                → Paramètres globaux (taux, hypothèses, seuils)
```

---

## MODULE 29 — PAGE D'ACCUEIL / LANDING

### Features UI

- **Hero section** : titre du hackathon, sous-titre, bouton CTA "Commencer le calcul"
- **Compteur animé** : score total / nombre de provisions calculées / réserve totale estimée
- **Cards de présentation des 6 provisions** avec icône, nom, statut (calculée / en attente)
- **Indicateur de progression global** : barre de progression en % de complétion
- **Carte interactive du bilan** : visualisation actif/passif en temps réel (mise à jour à chaque provision calculée)
- **Sélecteur de mode** : Niveau 1 (Fondamentaux) / Niveau 2 (Avancé) / Niveau 3 (Excellence)

---

## MODULE 30 — MODULE INGESTION DES DONNÉES (`/data-import`)

### 30.1 Features UI

- **Zone de drag-and-drop** pour import de fichiers CSV / Excel (.xlsx, .xls, .csv)
- **Parser automatique** détectant les colonnes : date_survenance, date_développement, montant_cumulé, prime, nombre_sinistres
- **Preview tableau** des données importées avec pagination
- **Panneau de validation automatique** :
  - Détection des valeurs manquantes (affichage en rouge avec compte)
  - Détection des formats de dates incohérents
  - Détection des valeurs négatives (avec avertissement)
  - Détection des colonnes manquantes obligatoires
- **Mapping de colonnes** : interface glisser-déposer pour associer colonnes du fichier aux champs attendus
- **Bouton "Corriger"** : remplissage manuel des valeurs manquantes dans le tableau
- **Indicateur de qualité des données** : score de 0 à 100 avec détail par dimension
- **Historique des imports** avec horodatage et statut (succès / erreur)
- **Saisie manuelle** : formulaire alternatif à l'import pour petits volumes

---

## MODULE 31 — MODULE TRIANGLE DE DÉVELOPPEMENT (`/triangle`)

### 31.1 Features UI

- **Grille interactive du triangle** (tableau éditable, cellules colorées par diagonale)
  - Cellules connues (coin supérieur gauche) : fond blanc / gris clair
  - Cellules à estimer (coin inférieur droit) : fond bleu / highlighted
  - Cellules projetées (après calcul) : fond vert avec valeur + bouton "détail"
- **Sélecteur de type de triangle** : Paiements cumulés (C) / Paiements incrémentaux (Y) / Nombre de sinistres (N) / Charges dossier (Γ)
- **Bascule Cumulatif ↔ Incrémental** : transformation automatique avec formule visible
- **Affichage des facteurs de développement** : ligne en bas du triangle, éditable
- **Heatmap de la triangulation** : colorimétrie sur la vitesse de développement (facteurs élevés = rouge, proches de 1 = vert)
- **Courbes de développement** : graphique en lignes, une courbe par année de survenance, tronquée au dernier observé, prolongée en pointillés pour les projections
- **Sélecteur d'années** : filtrer sur un sous-ensemble d'années de survenance
- **Bouton "Exclure diagonale"** : ignorer la dernière diagonale (sinistres atypiques)
- **Bouton "Ajouter une année"** : extension manuelle du triangle
- **Export du triangle complété** en CSV / Excel

---

## MODULE 32 — MODULE PPNA (`/provisions/ppna`)

### 32.1 Features UI

- **Formulaire de saisie par police** : Prime_nette, Date_effet, Date_échéance, Date_arrêté
- **Tableau récapitulatif** : colonne calculée N_jours_restants / N_jours_période / PPNA_unitaire
- **Somme PPNA totale** en grand affichage (widget numérique)
- **Filtres** : par branche, par portefeuille, par type de contrat
- **Formule affichée en temps réel** :
  ```
  PPNA = Σ [ P_nette × (Date_échéance − Date_arrêtée) / (Date_échéance − Date_effet) ]
  ```
- **Graphique camembert / barres** : répartition de la PPNA par branche ou par tranche d'échéance
- **Comparaison N vs N-1** : évolution de la PPNA par rapport à l'exercice précédent
- **Alerte PRC** : si coût futur estimé > PPNA → badge rouge "PRC à doter"

---

## MODULE 33 — MODULE PSAP (`/provisions/psap`)

### 33.1 Features UI

- **Table de gestion des dossiers** : colonnes N°_dossier, Type_sinistre, Coût_estimé_final, Déjà_payé, Provision_calculée, Statut (ouvert/clôturé)
- **Formulaire d'ajout/modification de dossier** :
  - Saisie : N°_dossier, Date_survenance, Date_déclaration, Coût_estimé_final
  - Décomposition : Indemnités + Frais_gestion + Frais_juridiques + Autres_coûts
- **Calcul automatique** de `PSAP_s = Coût_estimé_final_s − Déjà_payé_s` à chaque modification
- **Indicateur PSAP totale** (grand widget en temps réel)
- **Filtres** : par exercice de survenance, par état du dossier, par montant
- **Tri multi-colonnes** sur le tableau des dossiers
- **Graphique de distribution** : histogramme des coûts estimés par tranche
- **Import en masse** de dossiers depuis CSV
- **Export** des dossiers en Excel avec PSAP par exercice

---

## MODULE 34 — MODULE IBNR (`/provisions/ibnr`)

### 34.1 Sélecteur de méthode

Interface à onglets ou étapes :

```
[ Chain Ladder ] [ Bornhuetter-Ferguson ] [ Loss Ratio ] [ Mack ] [ Munich CL ]
```

### 34.2 Sous-module Chain Ladder

- **Affichage du triangle** (depuis Module Triangle)
- **Tableau des facteurs** λ̂_0, λ̂_1, …, λ̂_{n-1} avec formule et valeur
- **Tableau des taux de paiement** γ̂_j et φ̂_j (cumulatifs et incrémentaux)
- **Graphique barres** des φ̂_j (taux de paiement incrémentaux par année de développement)
- **Triangle complété** (fond différencié : observé vs projeté)
- **Tableau des réserves** par année de survenance + total
- **Options avancées** :
  - Toggle "Extrapolation queue (λ∞)" avec graphique log(λ_k−1) et ajustement linéaire
  - Slider "Facteur queue" f (multiplicateur de la charge ultime)
  - Exclusion d'années de développement sélectionnées

### 34.3 Sous-module Bornhuetter-Ferguson

- **Champs Loss Ratio a priori** par année de survenance (saisie manuelle ou import)
- **Saisie des primes** P_i par année de survenance
- **Tableau de calcul étape par étape** :
  - β̂_{n−i} (part développée) issu de Chain Ladder
  - (1 − β̂_{n−i}) (part non développée)
  - μ̂_i = LR × P_i (charge a priori)
  - Réserve BF = (1 − β̂_{n−i}) × μ̂_i
- **Comparaison Chain Ladder vs BF** : tableau et graphique en barres côte à côte
- **Curseur de pondération** : visualisation de la sensibilité selon q (% développé)

### 34.4 Sous-module Loss Ratio

- **Champs** : Primes_i, Loss_Ratio_a_priori, Déjà_payé_i
- **Calcul** : Charge_Ultime, Provision par ligne
- **Avertissement** si LR > seuil configurable (risque de sous-provisionnement)

### 34.5 Sous-module Mack

- **Affichage des σ̂_j** (volatilités par colonne de développement)
- **Tableau MSEP** par année de survenance + total
- **Coefficient de variation CV(IBNR)** par ligne
- **Graphique de développement par année** (avec intervalles de confiance ±1σ et ±2σ en pointillés)
- **Tableau CDR** : IBNR, CDR(1) S.E., Mack S.E. par ligne

### 34.6 Sous-module Munich Chain Ladder

- **Upload du triangle des charges (Γ)** en plus du triangle paiements (C)
- **Ratio P/I** = C/Γ par cellule (heatmap colorée)
- **Comparaison standard CL vs Munich CL** : tableau Ultimate Paid, Ultimate Incurred, ratio P/I final
- **Graphique d'évolution** paiements vs charges par année de survenance

### 34.7 Sous-module Bootstrap

- **Slider** : nombre de simulations B (1 000 à 100 000)
- **Sélecteur de loi processus** : Poisson / Gamma / Binomiale négative / Mack stochastique
- **Graphique de densité** de la distribution de R̂ et de R (scénarios)
- **Boxplot comparatif** R̂ vs R
- **Tableau de quantiles** : 75%, 95%, 99%, 99.5% pour les deux distributions
- **Barre de progression** pendant le calcul avec estimation du temps restant

---

## MODULE 35 — MODULE PRC (`/provisions/prc`)

### 35.1 Features UI

- **Tableau par contrat/portefeuille** : PPNA calculée, Coût_futur_estimé, PRC
- **Formule affichée** : `PRC = max(0, Coût_futur_estimé − PPNA)`
- **Badge d'alerte rouge** si PRC > 0 avec montant et liste des contrats concernés
- **Graphique en barres** PPNA vs Coût_futur_estimé par branche (superposition)
- **Indicateur agrégé** : PRC totale en grand affichage

---

## MODULE 36 — MODULE PROVISION POUR ÉGALISATION (`/provisions/pe`)

### 36.1 Features UI

- **Saisie du Résultat Technique** RT_N (ou import depuis le bilan)
- **Tableau des charges sinistres** : A1 (N-1), A2 (N-2), A3 (N-3) avec saisie/import
- **Calcul pas-à-pas visible** :
  ```
  MOYENNE(A1, A2, A3) = ?
  72% × RT_N⁺ = ?
  15% × MOYENNE = ?
  PE_N = min(...) = ?
  ```
- **Indicateur "Déclenchement"** : badge vert si RT > 0 (PE calculée), badge gris si RT ≤ 0 (pas de dotation)
- **Historique des dotations PE** par exercice (graphique en barres)
- **Cuve de la PE** : visualisation du stock cumulé de la provision d'égalisation (dotations − reprises) par exercice

---

## MODULE 37 — MODULE PARTICIPATION AUX BÉNÉFICES (`/provisions/pb`)

### 37.1 Features UI

- **Saisie** : Primes_acquises, Sinistres, Charges_techniques, Produits_financiers, Taux_α, Seuil_S/P
- **Calcul étape par étape affiché** :
  ```
  RT = Primes − Sinistres − Charges = ?
  RG = RT + Produits_financiers = ?
  Ratio S/P = Sinistres / Primes = ?
  PB = RG × α = ?   (si S/P < Seuil)
  ```
- **Indicateur de déclenchement** : affichage du ratio S/P avec jauge colorée (vert < seuil, rouge ≥ seuil)
- **Comparaison multi-contrats** : tableau PB par groupe de contrats / portefeuille
- **Évolution historique** : graphique courbe du ratio S/P et de la PB sur les N derniers exercices

---

## MODULE 38 — MODULE FRAIS DE GESTION (`/provisions/frais`)

### 38.1 Features UI

- **Sélecteur de méthode** (onglets) :
  - Méthode 1 : Taux forfaitaire
  - Méthode 2 : Coût unitaire par dossier
  - Méthode 3 : Approche analytique
- **Méthode 1** : saisie Sinistres + Taux → FGS affiché
- **Méthode 2** : saisie N_sinistres + CM_dossier → FGS affiché
- **Méthode 3** : saisie Charges_RH + Frais_experts + Frais_indirects → FGS affiché avec décomposition graphique (camembert)
- **Comparaison des 3 méthodes** : tableau côte-à-côte des 3 résultats + sélection de la méthode retenue
- **Bouton "Appliquer au bilan"** : valider la méthode et le montant retenus

---

## MODULE 39 — BILAN DU PASSIF TECHNIQUE (`/bilan`)

### 39.1 Features UI

- **Tableau de bilan complet** :

```
ACTIF                            PASSIF
Placements financiers      ?     Fonds propres                ?
Actifs de réassurance      ?     ─── PROVISIONS TECHNIQUES ───
Autres actifs              ?     PPNA                         ?
                                 PSAP                         ?
                                 IBNR                         ?
                                 SAP = PSAP + IBNR            ?
                                 PRC                          ?
                                 Frais de gestion             ?
                                 Provision d'Égalisation      ?
                                 Participation aux Bénéfices  ?
TOTAL                      ?     TOTAL                        ?
```

- **Équilibre bilan** : indicateur ACTIF = PASSIF (badge vert) ou déséquilibre (badge rouge + montant)
- **Graphique waterfall** : visualisation des provisions empilées dans le passif
- **KPIs clés** :
  - Taux de provisionnement = Provisions_Techniques / Primes_acquises
  - Ratio de couverture = Actif / Provisions
  - SAP / Primes_acquises
- **Comparaison N vs N-1** : évolution de chaque poste avec flèche de tendance
- **Bouton "Valider le bilan"** → enregistre l'état pour l'audit trail

---

## MODULE 40 — JOURNAL D'AUDIT & TRAÇABILITÉ (`/audit`)

### 40.1 Features UI

- **Timeline chronologique** : chaque calcul horodaté, avec utilisateur, méthode utilisée, paramètres
- **Détail par provision** : pour chaque provision, historique de toutes les versions calculées
- **Affichage des hypothèses** : liste visible des paramètres utilisés pour chaque calcul (taux, LR, α, seuil, etc.)
- **Diff comparatif** : comparaison entre deux versions d'une provision (mise en surbrillance des changements)
- **Logs téléchargeables** en JSON / CSV
- **Recherche et filtres** : par provision, par date, par méthode
- **Signature de validation** : bouton "Certifier ce calcul" avec horodatage immuable

---

## MODULE 41 — EXPORT (`/export`)

### 41.1 Features UI

- **Export Excel** : classeur multi-onglets (un onglet par provision + onglet bilan + onglet audit)
- **Export CSV** : un fichier par provision ou fichier unique fusionné
- **Export PDF** : rapport automatique structuré incluant :
  - Page de garde : date, utilisateur, exercice comptable
  - Résumé exécutif : totaux par provision
  - Détail méthode par méthode avec formules appliquées
  - Triangle complété
  - Tableau du bilan
  - Annexe audit trail
- **Aperçu du rapport avant export** (prévisualisation PDF dans le navigateur)
- **Sélection des sections à inclure** (cases à cocher)

---

## MODULE 42 — PARAMÈTRES GLOBAUX (`/settings`)

### 42.1 Features UI

- **Paramètres généraux** :
  - Date d'arrêté (date d'inventaire)
  - Devise (DZD par défaut)
  - Exercice comptable
- **Paramètres actuariels configurables** :
  - Loss Ratio a priori par branche (tableau éditable)
  - Taux de participation PB (α)
  - Seuil S/P pour déclenchement PB
  - Taux de gestion forfaitaire (méthode 1 FGS)
  - Coût moyen par dossier (méthode 2 FGS)
  - Taux de dotation PE (72% modifiable si réglementation différente)
  - Taux sinistre PE (15% modifiable)
  - Facteur queue λ∞ (optionnel)
  - Nombre de simulations bootstrap B
  - Loi de processus pour le bootstrap
- **Gestion des utilisateurs** (si multi-utilisateurs)
- **Réinitialisation** : bouton "Réinitialiser les calculs" avec confirmation

---

## MODULE 43 — TABLEAU DE BORD PRINCIPAL (`/dashboard`)

### 43.1 Features UI

- **Vue d'ensemble en 6 cartes provisions** : statut (calculée/non calculée), montant, méthode utilisée
- **Gauge / jauge de completion** : % de provisions complétées (Niveau 1 / 2 / 3)
- **Graphique radar** : visualisation multi-dimensions de la qualité des provisions (exactitude, robustesse, cohérence)
- **Alertes actives** :
  - PRC > 0 (tarification insuffisante)
  - IBNR non calculé
  - Données manquantes
  - Incohérence bilan
- **Timeline de calcul** : ordre d'exécution des provisions avec dépendances visualisées (graphe DAG)
- **Boutons d'action rapide** : recalculer tout / recalculer une provision / exporter

---

## MODULE 44 — SYSTÈME DE NOTATION INTÉGRÉ

### 44.1 Grille de score (affichable dans l'UI)

```
Score Total : /100

1. Exactitude actuarielle ............... /30
   ▸ Justesse calculs par produit / portefeuille
   ▸ Cohérence des méthodes inter-provisions

2. Architecture technique ............... /20
   ▸ Modularité des composants
   ▸ Performance (temps de calcul)

3. Automatisation & robustesse .......... /15
   ▸ Gestion des erreurs
   ▸ Nettoyage des données (dates, valeurs manquantes)
   ▸ Reproductibilité des calculs

4. Interface & UX ....................... /10
   ▸ Design professionnel
   ▸ Lisibilité
   ▸ Ergonomie

5. Traçabilité & Auditabilité ........... /10
   ▸ Logs complets
   ▸ Hypothèses visibles
   ▸ Audit trail complet

6. Innovation ........................... /10
   ▸ Visualisation originale
   ▸ Optimisations

7. Documentation ........................ /5
   ▸ README
   ▸ Commentaires code
   ▸ Guide utilisateur
```

---

## MODULE 45 — RÉCAPITULATIF DES DÉPENDANCES INTER-PROVISIONS

```
PPNA ─────────────────────────────────→ PRC
                                         (PRC = max(0, Coût_futur − PPNA))

PSAP ──┐
       ├─────────────────────────────→ SAP
IBNR ──┘                               (SAP = PSAP + IBNR)

SAP ──────────────────────────────────→ PE
                                         (RT = Primes − Sinistres (SAP) − Charges)

SAP ──────────────────────────────────→ FGS
                                         (FGS méthode 1 : SAP × T_gestion)

RT  ──────────────────────────────────→ PB
                                         (PB = (RT + Produits_fin) × α)

RT  ──────────────────────────────────→ PE
                                         (PE = min(72% × RT⁺ ; 15% × MOYENNE))
```

---

## MODULE 46 — CHECKLIST DE CONFORMITÉ HACKATHON

### Niveau 1 — Obligatoire ✓

- [ ] PPNA avec formule prorata temporis complète
- [ ] SAP = PSAP + IBNR
- [ ] Provision d'Égalisation avec formule min(72%×RT⁺ ; 15%×MOYENNE)

### Niveau 2 — Recommandé ✓

- [ ] PB avec 3 étapes + condition S/P
- [ ] PSAP dossier par dossier (tableau éditable)
- [ ] IBNR Chain Ladder avec facteurs λ̂_j visibles et triangle projeté

### Niveau 3 — Excellence ✓

- [ ] Bilan sinistre complet (toutes provisions + actif)
- [ ] Dashboard interactif avec KPIs
- [ ] Traçabilité + Audit trail (historique horodaté, hypothèses visibles, export)
- [ ] Méthode Mack (MSEP, CDR, intervalles de confiance)
- [ ] Bootstrap (distribution des réserves, quantiles)
- [ ] Munich Chain Ladder (triangle paiements + charges)
- [ ] Méthode Bornhuetter-Ferguson
- [ ] Triangles multivariés (si plusieurs branches)
- [ ] Export Excel/CSV/PDF automatisé

# PARTIE IV — EVALUATION CRITERIA (FACT)

# Actuarial Provisioning System – Challenge Brief

## Goal

Build an **industrial automated actuarial system** (not just calculate provisions).
Key requirements: robust architecture, inter-provision consistency, actuarial traceability, production-ready.

## Deliverables by Level

- **L1 (mandatory):** PPNA, SAP, Équalization provision
- **L2 (advanced):** PB (profit sharing), PSAP, IBNR (Chain Ladder)
- **L3 (excellence):** Claims balance sheet, interactive dashboard, audit trail

## Architecture

1. **Data ingestion** – CSV/Excel + auto-validation
2. **Actuarial engine** – independent modules (PPNA, SAP, IBNR, etc.)
3. **Orchestrator** – sequential execution respecting inter-provision dependencies
4. **Output** – interactive dashboard, Excel/CSV export, auto PDF report

## Scoring (100 pts)

| Criterion                                                                               | Pts |
| --------------------------------------------------------------------------------------- | --- |
| Actuarial accuracy (correct results, per product/portfolio, method consistency)         | 30  |
| Technical architecture (modularity, performance)                                        | 20  |
| Automation & robustness (error handling, date formats, missing values, reproducibility) | 15  |
| UI/UX (professional design, readability, ergonomics)                                    | 10  |
| Traceability & auditability (logs, visible assumptions)                                 | 10  |
| Innovation (visualization, optimization)                                                | 10  |
| Documentation                                                                           | 5   |
