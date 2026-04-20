"""Dataset contracts and schema registry."""

from __future__ import annotations

from pathlib import Path

from src.domain.enums import CleaningPolicy, DataType
from src.domain.types import DatasetContract, FieldContract

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"


def _ppna_contract() -> DatasetContract:
    return DatasetContract(
        dataset_name="ppna",
        workbook_path=DATA_DIR / "level 01-level2-ÉCHANTILLON DATA PPNA.xlsx",
        sheet_name=" PRODUCTION",
        header_row=1,
        data_start_row=2,
        output_sheet_name="ETAT DE SORTIE",
        fields=(
            FieldContract("Réseau", "network", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Distribution network.", controlled_vocabulary=("r1", "r2", "r5")),
            FieldContract("produit", "product", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Product label.", controlled_vocabulary=("ia", "ava")),
            FieldContract("Type", "transaction_type", DataType.CATEGORY, False, CleaningPolicy.RETAIN_AND_FLAG, "Transaction type for policy movement."),
            FieldContract("N° POLICE/AVENANT", "policy_endorsement_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Policy or endorsement identifier."),
            FieldContract("N° POLICE", "policy_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Policy identifier."),
            FieldContract("ASSURES", "insured_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Insured identifier."),
            FieldContract("souscription", "subscription_date", DataType.DATE, False, CleaningPolicy.COERCE, "Subscription date."),
            FieldContract("Effet", "effect_date", DataType.DATE, False, CleaningPolicy.COERCE, "Coverage start date."),
            FieldContract("Échéance", "expiry_date", DataType.DATE, False, CleaningPolicy.COERCE, "Coverage end date."),
            FieldContract("Prime nette", "net_premium", DataType.DECIMAL, False, CleaningPolicy.RETAIN_AND_FLAG, "Net premium used for PPNA."),
        ),
    )


def _sap_fields() -> tuple:
    """Return the common SAP/Level3-bilan field contracts."""
    return (
            FieldContract("Réseau", "network", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Distribution network.", controlled_vocabulary=("direct",)),
            FieldContract("Agence", "agency", DataType.INTEGER, False, CleaningPolicy.COERCE, "Agency code."),
            FieldContract("PRODUITS", "product", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Product label.", controlled_vocabulary=("prevoyance",)),
            FieldContract("N° Police ", "policy_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Policy identifier."),
            FieldContract("Date d'effet police", "policy_effect_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy effect date."),
            FieldContract("Date d'echeance police", "policy_expiry_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy expiry date."),
            FieldContract("N°adhésion", "adhesion_id", DataType.INTEGER, False, CleaningPolicy.COERCE, "Adhesion identifier."),
            FieldContract("Nom et Prénom d'adhérent ", "insured_name", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Insured full name."),
            FieldContract("Date de Naissance adhérent", "insured_birth_date", DataType.DATE, True, CleaningPolicy.RETAIN_AND_FLAG, "Insured birth date."),
            FieldContract("date d'adhésion adhérent", "adhesion_date", DataType.DATE, False, CleaningPolicy.COERCE, "Adhesion date."),
            FieldContract("Code Client", "client_code", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Client code."),
            FieldContract("Nom Client ", "client_name", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Client name."),
            FieldContract("Type Affaire", "business_type", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Business type."),
            FieldContract("Nom et Prénom bénéficiaire", "beneficiary_name", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Beneficiary full name."),
            FieldContract("lien de parenté", "relationship", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Relationship to insured."),
            FieldContract("Genre bénéficiaire", "beneficiary_gender", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Beneficiary gender."),
            FieldContract("Date de Naissance bénéficiaire", "beneficiary_birth_date", DataType.DATE, True, CleaningPolicy.RETAIN_AND_FLAG, "Beneficiary birth date."),
            FieldContract("N° Sinistre", "claim_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Claim identifier."),
            FieldContract("Garanties", "guarantee", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Guarantee."),
            FieldContract("Montant sinistre déclaré", "declared_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Declared claim amount."),
            FieldContract("Date de déclaration", "declaration_date", DataType.DATE, False, CleaningPolicy.COERCE, "Declaration date."),
            FieldContract("Année de survenance de sinsitre", "occurrence_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Occurrence year."),
            FieldContract("Date de survenance du sinistre ", "occurrence_date", DataType.DATE, False, CleaningPolicy.COERCE, "Occurrence date."),
            FieldContract("Statut", "status", DataType.CATEGORY, False, CleaningPolicy.RETAIN_AND_FLAG, "Claim status.", controlled_vocabulary=("sap", "regle", "rejet")),
            FieldContract("Date de notification reglement /REJET", "settlement_notification_date", DataType.DATE, True, CleaningPolicy.RETAIN_AND_FLAG, "Settlement or rejection date."),
            FieldContract("Montant réglé", "paid_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Paid amount."),
            FieldContract("Ecart  reglement", "settlement_gap", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Settlement gap."),
            FieldContract("sap au 30/06/2025", "sap_closing_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "SAP amount at workbook closing date."),
    )


def _sap_contract() -> DatasetContract:
    return DatasetContract(
        dataset_name="sap",
        workbook_path=DATA_DIR / "level 01-DATA SAP groupe.xlsx",
        sheet_name="SAP GROUPE (2)",
        header_row=2,
        data_start_row=3,
        output_sheet_name="ETAT SORTIE ATTENDU",
        fields=_sap_fields(),
    )


def _bilan_level3_contract() -> DatasetContract:
    """Return the dataset contract for the Level3 Bilan sinistres workbook."""

    return DatasetContract(
        dataset_name="bilan_level3",
        workbook_path=DATA_DIR / "level3-Bilan sinistres(2).xlsx",
        sheet_name="SAP GROUPE (2)",
        header_row=2,
        data_start_row=3,
        output_sheet_name=None,
        fields=(
            FieldContract("Réseau", "network", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Distribution network.", controlled_vocabulary=("direct",)),
            FieldContract("Agence", "agency", DataType.INTEGER, False, CleaningPolicy.COERCE, "Agency code."),
            FieldContract("PRODUITS", "product", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Product label.", controlled_vocabulary=("prevoyance",)),
            FieldContract("N° Police ", "policy_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Policy identifier."),
            FieldContract("Date d'effet police", "policy_effect_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy effect date."),
            FieldContract("Date d'echeance police", "policy_expiry_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy expiry date."),
            FieldContract("N°adhésion", "adhesion_id", DataType.INTEGER, False, CleaningPolicy.COERCE, "Adhesion identifier."),
            FieldContract("Nom et Prénom d'adhérent ", "insured_name", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Insured full name."),
            FieldContract("Date de Naissance adhérent", "insured_birth_date", DataType.DATE, True, CleaningPolicy.RETAIN_AND_FLAG, "Insured birth date."),
            FieldContract("date d'adhésion adhérent", "adhesion_date", DataType.DATE, False, CleaningPolicy.COERCE, "Adhesion date."),
            FieldContract("Code Client", "client_code", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Client code."),
            FieldContract("Nom Client ", "client_name", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Client name."),
            FieldContract("Type Affaire", "business_type", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Business type."),
            FieldContract("Nom et Prénom bénéficiaire", "beneficiary_name", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Beneficiary full name."),
            FieldContract("lien de parenté", "relationship", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Relationship to insured."),
            FieldContract("Genre bénéficiaire", "beneficiary_gender", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Beneficiary gender."),
            FieldContract("Date de Naissance bénéficiaire", "beneficiary_birth_date", DataType.DATE, True, CleaningPolicy.RETAIN_AND_FLAG, "Beneficiary birth date."),
            FieldContract("N° Sinistre", "claim_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Claim identifier."),
            FieldContract("Garanties", "guarantee", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Guarantee."),
            FieldContract("Montant sinistre déclaré", "declared_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Declared claim amount."),
            FieldContract("Date de déclaration", "declaration_date", DataType.DATE, False, CleaningPolicy.COERCE, "Declaration date."),
            FieldContract("Année de survenance de sinsitre", "occurrence_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Occurrence year."),
            FieldContract("Date de survenance du sinistre ", "occurrence_date", DataType.DATE, False, CleaningPolicy.COERCE, "Occurrence date."),
            FieldContract("Statut", "status", DataType.CATEGORY, False, CleaningPolicy.RETAIN_AND_FLAG, "Claim status.", controlled_vocabulary=("sap", "regle", "rejet")),
            FieldContract("Date de notification reglement /REJET", "settlement_notification_date", DataType.DATE, True, CleaningPolicy.RETAIN_AND_FLAG, "Settlement or rejection date."),
            FieldContract("Montant réglé", "paid_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Paid amount."),
            FieldContract("Ecart  reglement", "settlement_gap", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Settlement gap."),
            FieldContract("sap au 30/06/2025", "sap_closing_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "SAP amount at workbook closing date."),
        ),
    )


def _pe_contract() -> DatasetContract:
    return DatasetContract(
        dataset_name="pe",
        workbook_path=DATA_DIR / "level 01-ÉCHANTILLON DATA PE.xlsx",
        sheet_name="PE",
        header_row=3,
        data_start_row=4,
        output_sheet_name="OBJECTIF PE",
        uses_data_only_values=True,
        fields=(
            FieldContract("Réseau", "network", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Distribution network."),
            FieldContract("Produit", "product", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Product label."),
            FieldContract("Années d'exercice", "fiscal_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Fiscal year."),
            FieldContract("Garantie", "guarantee", DataType.CATEGORY, False, CleaningPolicy.COERCE, "Guarantee label."),
            FieldContract("Les primes émises_garantie Décès 2022", "emitted_premiums", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Emitted premiums."),
            FieldContract("(REC/Provisions Mathématiques)_Décès au 01/01/2022", "opening_rec_math_provision", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Opening REC or mathematical provision."),
            FieldContract("Provisions pour SAP AU 01/01/2022", "opening_sap", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Opening SAP."),
            FieldContract("TOTAL  CREDIT", "total_credit", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Total credit."),
            FieldContract("Les sinistres payés_Décès de l'éxercice 2022", "paid_claims", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Paid claims."),
            FieldContract("(REC/Provisions Mathématiques)_Décès au 31/12/2022", "closing_rec_math_provision", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Closing REC or mathematical provision."),
            FieldContract("Provisions pour SAP au 31/12/2022", "closing_sap", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Closing SAP."),
            FieldContract("Report du solde Débiteur eventuel des exercices anterieurs ", "historical_debit_carry_forward", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Historical debit carry-forward."),
            FieldContract("TOTAL DEBIT", "total_debit", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Total debit."),
            FieldContract("Résultat technique", "technical_result", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Technical result."),
            FieldContract("Charge sinistre (N)", "claims_charge_n", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Claims charge for N."),
            FieldContract("Charge sinistre (N-1)", "claims_charge_n1", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Claims charge for N-1."),
            FieldContract("Charge sinistre (N-2)", "claims_charge_n2", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Claims charge for N-2."),
            FieldContract("Charge sinistre (N-3)", "claims_charge_n3", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Claims charge for N-3."),
            FieldContract("NB d'année contrat", "contract_year_count", DataType.INTEGER, True, CleaningPolicy.RETAIN_AND_FLAG, "Contract-year count used only by workbook Excel formulas."),
            FieldContract("MOYENNE", "historical_average_claims_charge", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Historical average claims charge."),
            FieldContract("Provision d'égalisation", "equalization_provision", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Equalization provision."),
        ),
    )


def _pb_contract() -> DatasetContract:
    return DatasetContract(
        dataset_name="pb",
        workbook_path=DATA_DIR / "ÉCHANTILLON DATA PB (1).xlsx",
        sheet_name="BASE",
        header_row=5,
        data_start_row=6,
        output_sheet_name=None,
        uses_data_only_values=True,
        fields=(
            FieldContract("Client", "client_code", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Client identifier."),
            FieldContract("Canal", "channel", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Distribution channel."),
            FieldContract("N° Police", "policy_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Policy number."),
            FieldContract("Date d'effet ", "effect_date", DataType.DATE, False, CleaningPolicy.COERCE, "Coverage effect date."),
            FieldContract("Date d'échéance", "expiry_date", DataType.DATE, False, CleaningPolicy.COERCE, "Coverage expiry date."),
            FieldContract("Date Sousciption", "subscription_date", DataType.DATE, False, CleaningPolicy.COERCE, "Subscription date."),
            FieldContract(" Primes de l'exercice N", "premiums_n", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Gross premiums for exercise N."),
            FieldContract("REC au 01/01/N", "rec_opening", DataType.DECIMAL, True, CleaningPolicy.COERCE, "Opening REC at 01/01/N."),
            FieldContract("Provisions pour SAP AU 01/01/N", "sap_opening", DataType.DECIMAL, True, CleaningPolicy.COERCE, "Opening SAP provision at 01/01/N."),
            FieldContract("TOTAL  CREDIT", "total_credit_wb", DataType.DECIMAL, True, CleaningPolicy.RETAIN_AND_FLAG, "Workbook total credit (derived, for audit)."),
            FieldContract("Les sinistres payés(sinistre réglé) de l'éxercice N", "claims_paid_n", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Claims paid during exercise N."),
            FieldContract("Provisions pour risques en cours au 31/12/N", "prec_closing", DataType.DECIMAL, True, CleaningPolicy.COERCE, "Closing PREC at 31/12/N."),
            FieldContract("Provisions pour SAP au 31/12/N", "sap_closing", DataType.DECIMAL, True, CleaningPolicy.COERCE, "Closing SAP at 31/12/N."),
            FieldContract("% frais de gestion ", "management_fee_rate", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Management fee rate applied to premiums."),
            FieldContract("Les frais de gestion X% des primes nettes", "management_fee_amount_wb", DataType.DECIMAL, True, CleaningPolicy.RETAIN_AND_FLAG, "Workbook management fee amount (derived, for audit)."),
            FieldContract("Report du solde Débiteur eventuel des exercices anterieurs ", "prior_debit_carryover", DataType.DECIMAL, True, CleaningPolicy.COERCE, "Prior debit balance carryover."),
            FieldContract("TOTAL DEBIT", "total_debit_wb", DataType.DECIMAL, True, CleaningPolicy.RETAIN_AND_FLAG, "Workbook total debit (derived, for audit)."),
            FieldContract("Solde Crediteur", "credit_balance_wb", DataType.DECIMAL, True, CleaningPolicy.RETAIN_AND_FLAG, "Workbook credit balance (derived, for audit)."),
            FieldContract("S/P au 31-12-2022", "loss_ratio", DataType.DECIMAL, False, CleaningPolicy.COERCE, "S/P loss ratio at closing date."),
            FieldContract("Condition de PB S/P <= ", "loss_ratio_threshold", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Per-contract S/P eligibility threshold for PB."),
            FieldContract("bénéficier au PN", "pb_eligible_wb", DataType.STRING, True, CleaningPolicy.RETAIN_AND_FLAG, "Workbook PB eligibility flag OUI/NON (derived, for audit)."),
            FieldContract("taux pb ", "pb_rate", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Per-contract PB participation rate."),
            FieldContract("Participation aux bénéfices du solde créditeur", "participation_beneficiaire_wb", DataType.DECIMAL, True, CleaningPolicy.RETAIN_AND_FLAG, "Workbook PB amount (derived, for audit reconciliation)."),
        ),
    )


def _ibnr_contract() -> DatasetContract:
    return DatasetContract(
        dataset_name="ibnr",
        workbook_path=DATA_DIR / "level 02-ÉCHANTILLON DATA IBNR.xlsx",
        sheet_name="base ADE",
        header_row=1,
        data_start_row=2,
        output_sheet_name="calcule IBNR",
        uses_data_only_values=True,
        fields=(
            FieldContract("N° SINISTRE", "claim_id", DataType.STRING, False, CleaningPolicy.RETAIN_AND_FLAG, "Claim identifier."),
            FieldContract("Produit ", "product", DataType.CATEGORY, False, CleaningPolicy.COERCE,
                          "Product label within ADE line of business.",
                          controlled_vocabulary=("immo", "conso", "warda", "ac-elite")),
            FieldContract("N°Adhesion ", "adhesion_id", DataType.INTEGER, False, CleaningPolicy.COERCE, "Adhesion identifier."),
            FieldContract("Date de sous", "subscription_date", DataType.DATE, False, CleaningPolicy.COERCE, "Subscription date."),
            FieldContract("Année de souscription", "subscription_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Subscription year."),
            FieldContract("Date effet ", "effect_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy effect date."),
            FieldContract("Date Échéance", "expiry_date", DataType.DATE, False, CleaningPolicy.COERCE, "Policy expiry date."),
            FieldContract("Date du Sinistre", "occurrence_date", DataType.DATE, False, CleaningPolicy.COERCE, "Occurrence date."),
            FieldContract("Année de sinistre", "occurrence_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Occurrence year, used as triangle row."),
            FieldContract("Date de déclaration", "declaration_date", DataType.DATE, False, CleaningPolicy.COERCE, "Declaration date."),
            FieldContract("Année de déclaration", "declaration_year", DataType.INTEGER, False, CleaningPolicy.COERCE, "Declaration year, used as triangle column."),
            FieldContract("le montant de sinistre", "claim_amount", DataType.DECIMAL, False, CleaningPolicy.COERCE, "Claim amount, additive into triangle cells."),
            FieldContract("colonne  mois IBNR", "development_lag_years", DataType.INTEGER, True, CleaningPolicy.RETAIN_AND_FLAG,
                          "Workbook-derived development lag in years (=declaration_year - occurrence_year). Informational."),
        ),
    )


def get_dataset_contracts() -> dict[str, DatasetContract]:
    """Return all active dataset contracts."""

    return {
        "ppna": _ppna_contract(),
        "sap": _sap_contract(),
        "pe": _pe_contract(),
        "pb": _pb_contract(),
        "ibnr": _ibnr_contract(),
        "bilan_level3": _bilan_level3_contract(),
    }


def get_dataset_contract(dataset_name: str, workbook_path: Path | None = None) -> DatasetContract:
    """Return one dataset contract, optionally overriding the workbook path."""

    try:
        contract = get_dataset_contracts()[dataset_name]
    except KeyError as exc:
        raise ValueError(f"Unknown dataset contract: {dataset_name!r}") from exc
    return contract if workbook_path is None else contract.with_workbook_path(workbook_path)
