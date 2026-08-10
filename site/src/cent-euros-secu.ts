/**
 * « 100 € de prestations sociales, où vont-ils ? »
 *
 * Le pendant, côté protection sociale, du bloc « 100 € du budget de l'État ».
 * La question que se pose le lecteur est « où vont mes cotisations » ; la
 * réponse honnête n'est pas celle-là, et le titre le dit : ce qui est
 * décomposé, ce sont les **prestations versées**, pas les cotisations
 * encaissées. Les deux masses ne coïncident pas, et rien ne relie un
 * prélèvement à une prestation.
 *
 * Ce que le site publie permet exactement une moitié de la figure. Les comptes
 * de la protection sociale de la DREES donnent les prestations par risque
 * (vieillesse-survie, santé, famille, emploi, logement, pauvreté-exclusion) ;
 * ils ne donnent pas la ventilation des recettes, et aucun autre indicateur du
 * catalogue ne la porte. Il n'y a donc qu'un camembert, et le repli des
 * réserves dit pourquoi.
 *
 * Périmètre : tous les régimes, en comptabilité nationale. Plus large que la
 * Sécurité sociale du débat public et sans rapport avec la comptabilité
 * budgétaire de l'État.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { camembert, colonne } from "./cent-euros.ts";
import { formater } from "./echelle.ts";

/** Les six risques de la nomenclature DREES (ps_niveau 1), qui partitionnent
 *  exactement le total. Pour chacun : l'identifiant publié, le nom que tout le
 *  monde emploie, l'intitulé de la source, et ce que le risque couvre. */
export const RISQUES = [
  [
    "drees_protection_sociale_vieillesse",
    "La retraite",
    "Vieillesse-survie",
    "pensions de base et complémentaires, réversions, minimum vieillesse",
  ],
  [
    "drees_protection_sociale_sante",
    "La santé",
    "Santé",
    "remboursements de soins, hôpital, médicaments, indemnités journalières, invalidité, accidents du travail",
  ],
  [
    "drees_protection_sociale_famille",
    "La famille",
    "Famille",
    "allocations familiales, garde des jeunes enfants, naissance, congé parental",
  ],
  [
    "drees_protection_sociale_emploi",
    "Le chômage et l'insertion",
    "Emploi",
    "indemnisation du chômage, préretraites, aides à l'insertion professionnelle",
  ],
  [
    "drees_protection_sociale_pauvrete",
    "Les minima sociaux",
    "Pauvreté-exclusion sociale",
    "RSA et autres minima sociaux, aide alimentaire, hébergement d'urgence",
  ],
  [
    "drees_protection_sociale_logement",
    "Les aides au logement",
    "Logement",
    "APL, allocation de logement familiale, allocation de logement sociale",
  ],
] as const;

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Le millésime le plus récent où les six risques sont tous renseignés. Un
 *  risque manquant fausserait le dénominateur sans que rien ne le signale :
 *  mieux vaut reculer d'un an que publier des parts sur cinq risques. */
export function derniereAnneeComplete(series: Record<string, Record<string, number>>): string | null {
  const risques = RISQUES.map(([id]) => series[id]);
  if (risques.some((serie) => !serie)) return null;
  const annees = Object.keys(risques[0] as Record<string, number>).sort();
  for (let i = annees.length - 1; i >= 0; i -= 1) {
    const annee = annees[i];
    if (risques.every((serie) => (serie as Record<string, number>)[annee] !== undefined)) {
      return annee;
    }
  }
  return null;
}

type Poste = {
  libelle: string;
  officiel: string;
  couvre: string;
  valeur: number;
  part: number;
  montant: string;
};

/** -> les six risques d'une année, du plus lourd au plus léger, avec leur part
 *  sur 100 € et leur montant réel. */
export function postes(
  series: Record<string, Record<string, number>>,
  annee: string,
): Poste[] {
  const valeurs = RISQUES.map(([id, libelle, officiel, couvre]) => ({
    libelle,
    officiel,
    couvre,
    valeur: series[id]?.[annee] ?? 0,
  }));
  const total = valeurs.reduce((somme, v) => somme + v.valeur, 0);
  if (!total) return [];
  return valeurs
    .map((v) => ({
      ...v,
      part: (v.valeur / total) * 100,
      montant: formater(v.valeur, "EUR", false),
    }))
    .sort((a, b) => b.part - a.part);
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(france: Territoire | undefined, catalogue: Indicateur[]): string {
  const series = france?.series;
  if (!series) return "";
  const publies = new Set(catalogue.map((i) => i.id));
  if (RISQUES.some(([id]) => !publies.has(id))) return "";
  const annee = derniereAnneeComplete(series);
  if (!annee) return "";
  const lignes = postes(series, annee);
  if (!lignes.length) return "";
  const total = lignes.reduce((somme, l) => somme + l.valeur, 0);

  // Un camembert seul dans un bloc large : sans largeur maximale, la légende
  // étire ses parts jusqu'au bord droit et la ligne de lecture se casse. La
  // borne vit dans `.cent__solo`, côté feuille de style.
  return `
    <h3>100 € de prestations sociales, où vont-ils ?
      <span class="cent-euros__exercice">versées en ${echapper(annee)}</span></h3>
    <p class="bloc__complement">En ${echapper(annee)}, la France a versé
      <strong>${echapper(formater(total, "EUR", false))}</strong> de prestations sociales,
      tous régimes confondus : Sécurité sociale, retraites complémentaires obligatoires,
      assurance chômage, État, collectivités, mutuelles et sociétés d'assurance.</p>
    <div class="cent__solo">
      ${camembert(
        "Où vont 100 € ?",
        "Part de chaque risque dans le total des prestations versées.",
        lignes.map((l) => ({ libelle: l.libelle, part: l.part, montant: l.montant })),
      )}
    </div>
    <details class="repli">
      <summary>Le détail ligne à ligne</summary>
      ${colonne(
        "Où vont 100 € ?",
        `Prestations par risque, ${annee}, en euros courants. Comptes de la protection sociale (DREES), base 2020.`,
        lignes.map((l) => ({
          libelle: `${l.libelle}, ${l.montant} (${l.officiel} : ${l.couvre})`,
          part: l.part,
        })),
      )}
    </details>`;
}
