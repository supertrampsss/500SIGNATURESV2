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

/**
 * Les capitales accentuées que les nomenclatures publiques n'accentuent pas.
 *
 * « Concours de l'Etat », « Etudes amont », « Taxe d'enlévement des ordures
 * ménagères » : les producteurs saisissent leurs libellés en majuscules non
 * accentuées, ou avec l'accent de travers, et le site les affichait tels quels.
 * En français, une capitale s'accentue — et une faute d'orthographe à l'écran
 * décrédibilise le chiffre posé à côté, quelle que soit la qualité de sa source.
 *
 * La correction est une table de mots entiers, jamais une règle automatique :
 * accentuer tout « Et » initial casserait « Etat-major » comme « et ». Elle ne
 * touche que l'affichage ; l'identifiant, la fiche technique et le fichier
 * publié gardent le libellé du producteur.
 */
const CAPITALES_ACCENTUEES: [RegExp, string][] = [
  [/\bEtats\b/g, "États"],
  [/\bEtat\b/g, "État"],
  [/\bEtude/g, "Étude"],
  [/\bEtabliss/g, "Établiss"],
  [/\bEconomi/g, "Économi"],
  [/\bEquipement/g, "Équipement"],
  [/\bEducation\b/g, "Éducation"],
  [/\bEnergie/g, "Énergie"],
  [/\bEcole/g, "École"],
  [/\bElection/g, "Élection"],
  [/\bEvaluation/g, "Évaluation"],
  [/\bEgalit(e|é)\b/g, "Égalité"],
  [/\bEtranger/g, "Étranger"],
  [/\bEmission/g, "Émission"],
  // Une faute de frappe de la nomenclature OFGL, pas un défaut d'accentuation.
  [/enlévement/g, "enlèvement"],
];

export function accentuer(libelle: string): string {
  return CAPITALES_ACCENTUEES.reduce((texte, [motif, bon]) => texte.replace(motif, bon), libelle);
}

export function traduire(libelle: string): string {
  return accentuer(TRADUCTIONS[libelle] ?? libelle);
}
