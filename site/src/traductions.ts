/**
 * Les libellés que la nomenclature comptable rend opaques.
 *
 * « Dépenses d'intervention » est exact et ne dit rien à personne : ce sont
 * les aides et subventions versées. « FCTVA », « CVAE », « DMTO » sont des
 * sigles de comptable public. La traduction ne touche que l'affichage :
 * l'identifiant et la fiche technique gardent le vocabulaire de la source,
 * et le sigle reste entre parenthèses pour qui le connaît.
 */
export const TRADUCTIONS: Record<string, string> = {
  "Dépenses d'intervention": "Aides et subventions versées",
  FCTVA: "TVA remboursée par l'État (FCTVA)",
  // Le compte ne sépare pas les associations des entreprises : M14 n'a qu'un
  // compte 6574 sans subdivision, et en M57 Bordeaux inscrit 44,9 M€ sur 45,9
  // dans le sous-compte « autres personnes de droit privé ». Écrire l'un des
  // deux mots serait inventer une ventilation que la comptabilité ne fait pas.
  // Les bénéficiaires nommés, eux, existent pour les versements de l'État :
  // c'est l'onglet Vie associative.
  "Subventions aux personnes de droit privé": "Subventions versées aux organismes privés",
  CVAE: "Cotisation sur la valeur ajoutée des entreprises (CVAE)",
  TSCA: "Taxe sur les contrats d'assurance (TSCA)",
  TICPE: "Taxe sur les carburants (TICPE)",
  DDEC: "Dotation pour l'équipement des collèges (DDEC)",
  DRES: "Dotation pour l'équipement scolaire (DRES)",
  FMDI: "Fonds de mobilisation pour l'insertion (FMDI)",
  CNSA: "Concours de la Caisse nationale de solidarité pour l'autonomie (CNSA)",
  "Emprunts hors GAD": "Emprunts nouveaux",
  "Remboursements d'emprunts hors GAD": "Remboursements d'emprunts",
  "DMTO avant péreq.": "Droits sur les ventes immobilières (DMTO), avant péréquation",
  "DMTO après péreq.": "Droits sur les ventes immobilières (DMTO), après péréquation",
  "Attribution fonds de péreq. DMTO": "Reçu du fonds de péréquation des droits de mutation",
  "Prélèvement fonds de péreq. DMTO": "Versé au fonds de péréquation des droits de mutation",
  "Dépenses d'investissement hors remb": "Dépenses d'investissement, hors remboursements d'emprunts",
  "Dépenses totales hors remb": "Dépenses totales, hors remboursements d'emprunts",
  "Fiscalité reversée": "Fiscalité partagée avec l'intercommunalité",
};

export function traduire(libelle: string): string {
  return TRADUCTIONS[libelle] ?? libelle;
}
