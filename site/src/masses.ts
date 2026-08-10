/**
 * Les grandes masses, telles qu'une phrase les nomme.
 *
 * Un libellé de nomenclature n'est pas un groupe nominal : « Dépenses de
 * fonctionnement » ne se met pas dans une phrase sans son article, et l'article
 * ne se déduit d'aucune règle mécanique. « Dépenses » est féminin pluriel,
 * « encours » masculin singulier, « charge » féminin singulier, « FCTVA » ne
 * s'emploie qu'avec « le ». Les deviner, c'est en rater quelques-uns, et une
 * faute d'accord dans une phrase posée à côté d'un chiffre décrédibilise le
 * chiffre.
 *
 * La table donne donc le **groupe nominal complet, article compris**, une fois.
 * Les deux emplois s'en déduisent mécaniquement :
 *
 * - en sujet : « **Les dépenses de fonctionnement** passent de… » ;
 * - en complément : « la hausse vient **des dépenses de fonctionnement** », où
 *   « de + les » se contracte en « des », « de + le » en « du ».
 *
 * Un identifiant absent de la table prend la tournure invariable « le poste
 * « X » », grammaticale quel que soit le libellé. Rien n'est jamais deviné.
 */

/** Identifiant -> groupe nominal, article compris, en minuscules. */
const MASSES: Record<string, string> = {
  // Les totaux et les deux sections.
  ofgl_depenses_totales: "les dépenses totales",
  ofgl_recettes_totales: "les recettes totales",
  ofgl_depenses_fonctionnement: "les dépenses de fonctionnement",
  ofgl_recettes_fonctionnement: "les recettes de fonctionnement",
  ofgl_depenses_investissement: "les dépenses d'investissement",
  ofgl_recettes_d_investissement: "les recettes d'investissement",
  ofgl_depenses_totales_hors_remb: "les dépenses hors remboursements d'emprunts",
  ofgl_recettes_totales_hors_emprunts: "les recettes hors emprunts",
  ofgl_depenses_d_investissement_hors_remb: "l'investissement hors remboursements",
  ofgl_recettes_d_investissement_hors_emprunts: "les recettes d'investissement hors emprunts",

  // Le fonctionnement, poste par poste.
  ofgl_frais_personnel: "les frais de personnel",
  ofgl_achats_et_charges_externes: "les achats et charges externes",
  ofgl_charges_financieres: "les intérêts de la dette",
  ofgl_depenses_d_intervention: "les dépenses d'intervention",
  ofgl_autres_depenses_de_fonctionnement: "les autres dépenses de fonctionnement",
  ofgl_travaux_en_regie: "les travaux en régie",
  ofgl_allocations_apa: "l'allocation personnalisée d'autonomie",
  ofgl_allocations_pch: "la prestation de compensation du handicap",
  ofgl_allocations_rsa: "le revenu de solidarité active",
  ofgl_contributions_aux_sdis: "les contributions aux services d'incendie",
  ofgl_frais_d_hebergement: "les frais d'hébergement",
  ofgl_subventions_aux_personnes_de_droit_prive: "les subventions aux personnes de droit privé",

  // L'investissement.
  ofgl_depenses_d_equipement: "les dépenses d'équipement",
  ofgl_subventions_d_equipement_versees: "les subventions d'équipement versées",
  ofgl_autres_depenses_d_investissement: "les autres dépenses d'investissement",
  ofgl_remboursements_d_emprunts_hors_gad: "le remboursement des emprunts",
  ofgl_emprunts_hors_gad: "les emprunts",
  ofgl_fctva: "le fonds de compensation de la TVA",
  ofgl_autres_dotations_et_subventions: "les autres dotations et subventions",
  ofgl_autres_recettes_d_investissement: "les autres recettes d'investissement",
  ofgl_ddec: "la dotation départementale d'équipement des collèges",
  ofgl_dres: "la dotation régionale d'équipement scolaire",

  // Les recettes de fonctionnement.
  ofgl_impots_et_taxes: "les impôts et taxes",
  ofgl_impots_locaux: "les impôts locaux",
  ofgl_autres_impots_et_taxes: "les autres impôts et taxes",
  ofgl_concours_de_l_etat: "les concours de l'État",
  ofgl_dotation_globale_de_fonctionnement: "la dotation globale de fonctionnement",
  ofgl_perequations_et_compensations_fiscales: "les péréquations et compensations fiscales",
  ofgl_autres_dotations_de_fonctionnement: "les autres dotations de fonctionnement",
  ofgl_subventions_recues_et_participations: "les subventions reçues et participations",
  ofgl_ventes_de_biens_et_services: "les ventes de biens et services",
  ofgl_autres_recettes_de_fonctionnement: "les autres recettes de fonctionnement",
  ofgl_fiscalite_reversee: "la fiscalité reversée",
  ofgl_cvae: "la cotisation sur la valeur ajoutée des entreprises",
  ofgl_tva: "la part de TVA",
  ofgl_ticpe: "la taxe intérieure sur les produits énergétiques",
  ofgl_tsca: "la taxe sur les conventions d'assurance",
  ofgl_cartes_grises: "la taxe sur les certificats d'immatriculation",
  ofgl_taxe_d_enlevement_des_ordures_menageres: "la taxe d'enlèvement des ordures ménagères",
  ofgl_versement_transport: "le versement mobilité",
  ofgl_dmto_avant_pereq: "les droits de mutation avant péréquation",
  ofgl_dmto_apres_pereq: "les droits de mutation après péréquation",
  ofgl_attribution_fonds_de_pereq_dmto: "l'attribution du fonds de péréquation des droits de mutation",
  ofgl_prelevement_fonds_de_pereq_dmto: "le prélèvement du fonds de péréquation des droits de mutation",
  ofgl_cnsa: "les concours de la Caisse nationale de solidarité pour l'autonomie",
  ofgl_fmdi: "le fonds de mobilisation départementale pour l'insertion",

  // La dette et les soldes.
  ofgl_encours_dette: "l'encours de dette",
  ofgl_encours_de_dette_dettes_bancaires_et_assimilees: "la dette bancaire",
  ofgl_encours_de_dette_depots_et_cautionnements_recus: "les dépôts et cautionnements reçus",
  ofgl_epargne_brute: "l'épargne brute",
  ofgl_epargne_nette: "l'épargne nette",
  ofgl_epargne_de_gestion: "l'épargne de gestion",
  ofgl_annuite_de_la_dette: "l'annuité de la dette",

  // L'État et la comptabilité nationale.
  etat_depenses_nettes_bg: "les dépenses nettes du budget général",
  etat_recettes_nettes_bg: "les recettes nettes du budget général",
  etat_charge_dette: "la charge de la dette de l'État",
  etat_depenses_personnel: "les dépenses de personnel de l'État",
  etat_impot_revenu: "l'impôt sur le revenu",
  etat_impot_societes: "l'impôt sur les sociétés",
  insee_apu_solde: "le solde public",
  insee_dette_apu_montant: "la dette publique",
  depense_fiscale_totale: "le coût des niches fiscales",
};

/** Le groupe nominal d'une masse, ou la tournure invariable de repli. */
function groupeNominal(id: string, libelle: string): string {
  return MASSES[id] ?? `le poste « ${libelle} »`;
}

/** Une masse est-elle au pluriel ? Seul l'article le dit. */
export function estPluriel(id: string, libelle: string): boolean {
  return groupeNominal(id, libelle).startsWith("les ");
}

/** « Les dépenses de fonctionnement » : le groupe nominal en tête de phrase. */
export function sujet(id: string, libelle: string): string {
  const nom = groupeNominal(id, libelle);
  return nom.charAt(0).toLocaleUpperCase("fr-FR") + nom.slice(1);
}

/**
 * « des dépenses de fonctionnement », « du solde public », « de l'épargne ».
 *
 * La contraction est la seule règle mécanique du lot, et elle est sûre : « de »
 * suivi de « les » donne « des », suivi de « le » donne « du », et ne se
 * contracte ni devant « la » ni devant « l' ».
 */
export function complement(id: string, libelle: string): string {
  const nom = groupeNominal(id, libelle);
  if (nom.startsWith("les ")) return `des ${nom.slice(4)}`;
  if (nom.startsWith("le ")) return `du ${nom.slice(3)}`;
  return `de ${nom}`;
}
