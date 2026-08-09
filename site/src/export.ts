/**
 * Export CSV de ce que l'écran affiche.
 *
 * Le MVP promettait « exports CSV » ; le JSON versionné existe (docs/10) mais
 * il s'adresse aux développeurs. Ce bouton s'adresse à qui veut ouvrir les
 * chiffres dans un tableur : un journaliste, un élu, un conseil municipal.
 *
 * **Format tableur français, et c'est un choix dit.** Séparateur point-virgule
 * et virgule décimale : c'est ce qu'Excel et LibreOffice en français ouvrent
 * sans assistant ni colonne massacrée. Le BOM UTF-8 est là pour qu'Excel lise
 * les accents. Les valeurs sont arrondies au centième : ce fichier est une vue
 * pour tableur, pas un contrat — la réutilisation programmatique passe par le
 * JSON versionné, qui garde la précision d'origine. Les montants font
 * exception : écrits en millions d'euros comme à l'écran, ils gardent six
 * décimales, soit l'euro près, pour qu'une petite commune ne tombe pas à zéro.
 *
 * **Un chiffre ne voyage pas seul** (docs/06) : chaque ligne porte l'unité, la
 * période et le niveau, et l'en-tête nomme l'indicateur, la source et la date
 * d'export. Un CSV anonyme retrouvé dans un dossier trois mois plus tard ne
 * doit pas être un chiffre orphelin.
 */

import { modeVariation, variationExportee } from "./evolution-carte.ts";

export type LigneExport = {
  code: string;
  nom: string;
  valeur: number;
};

function champ(texte: string): string {
  // Guillemets doublés, champ cité si séparateur, guillemet ou saut de ligne.
  const brut = String(texte);
  return /[";\n\r]/.test(brut) ? `"${brut.replace(/"/g, '""')}"` : brut;
}

function nombreFrancais(valeur: number, decimales = 2): string {
  // Virgule décimale, pas de séparateur de milliers : les milliers espacés
  // deviennent du texte dans un tableur. Arrondi au centième : la division
  // par habitant produit des décimales sans fin qui n'informent personne.
  const facteur = 10 ** decimales;
  return String(Math.round(valeur * facteur) / facteur).replace(".", ",");
}

/** La valeur exportée suit l'affichage : les taux pour mille de la source
 *  sont écrits en pourcentage et les montants en millions d'euros, comme à
 *  l'écran et comme le dit l'en-tête. Un fichier qui contredirait la carte
 *  serait pire qu'un fichier absent. */
export function valeurExportee(valeur: number, unite: string, parHabitant = false): number {
  if (unite === "pour_1000_habitants" || unite === "pour_1000_logements") return valeur / 10;
  // Le par-habitant reste en euros : c'est la seule lecture où le million n'a
  // pas de sens, à l'écran comme au tableur.
  if (unite === "EUR" && !parHabitant) return valeur / 1e6;
  return valeur;
}

/** Six décimales sur un montant en millions d'euros : l'euro près. L'arrondi
 *  au centième vaudrait dix mille euros, et ferait tomber à « 0 » la ligne
 *  d'une petite commune — un export ne perd pas ce que l'écran résume. */
const DECIMALES_EXPORT = (unite: string, parHabitant: boolean) =>
  unite === "EUR" && !parHabitant ? 6 : 2;

/** L'unité telle qu'elle se lit dans un tableur, jamais un code interne nu
 *  pour les unités connues — et le code tel quel pour les autres, comme à
 *  l'écran : une unité inconnue ne devient pas des euros (echelle.ts). */
export function uniteLisible(unite: string, parHabitant: boolean): string {
  const libelle =
    unite === "EUR"
      ? parHabitant
        ? "euros"
        : "millions d'euros"
      : unite === "percent"
        ? "%"
        : unite === "count"
          ? "nombre"
          : unite === "pour_1000_habitants"
            ? "% des habitants"
            : unite === "pour_1000_logements"
              ? "% des logements"
              : unite === "consultations_par_an"
                ? "consultations par an et par habitant"
                : unite;
  return parHabitant ? `${libelle} par habitant` : libelle;
}

/** Contenu CSV, pur et testé — le déclenchement du téléchargement est à part.
 *  La date est injectable pour la même raison. */
export function enCsv(
  lignes: LigneExport[],
  meta: {
    indicateur: string;
    unite: string;
    periode: string;
    niveau: string;
    parHabitant: boolean;
    source: string;
  },
  quand: Date = new Date(),
): string {
  const entetes = ["code", "territoire", "valeur", "unite", "periode", "niveau"];
  const unite = uniteLisible(meta.unite, meta.parHabitant);
  const corps = lignes.map((ligne) =>
    [
      champ(ligne.code),
      champ(ligne.nom),
      nombreFrancais(
        valeurExportee(ligne.valeur, meta.unite, meta.parHabitant),
        DECIMALES_EXPORT(meta.unite, meta.parHabitant),
      ),
      champ(unite),
      champ(meta.periode),
      champ(meta.niveau),
    ].join(";"),
  );
  const commentaires = [
    `# ${meta.indicateur}, ${meta.periode}`,
    `# Source : ${meta.source} · exporté le ${quand.toISOString().slice(0, 10)}`,
    "# Licence Ouverte 2.0. Données complètes et documentées : voir « Accéder aux données » en bas de page.",
  ];
  // BOM : sans lui, Excel ouvre les accents en mojibake.
  return "\uFEFF" + [...commentaires, entetes.join(";"), ...corps].join("\r\n") + "\r\n";
}

export type LigneExportEvolution = {
  code: string;
  nom: string;
  avant: number;
  apres: number;
  variation: number;
};

/** L'export du mode évolution suit la couche affichée : les deux millésimes et
 *  la variation, avec son unité propre — « % » pour une grandeur additive,
 *  « points » pour un taux. Mêmes conventions tableur qu'`enCsv`. */
export function enCsvEvolution(
  lignes: LigneExportEvolution[],
  meta: {
    indicateur: string;
    unite: string;
    periodeAvant: string;
    periodeApres: string;
    niveau: string;
    parHabitant: boolean;
    source: string;
  },
  quand: Date = new Date(),
): string {
  const mode = modeVariation(meta.unite);
  const entetes = [
    "code",
    "territoire",
    `valeur_${meta.periodeAvant}`,
    `valeur_${meta.periodeApres}`,
    "variation",
    "unite_variation",
    "unite",
    "niveau",
  ];
  const unite = uniteLisible(meta.unite, meta.parHabitant);
  const uniteVariation = mode === "points" ? "points" : "%";
  const corps = lignes.map((ligne) =>
    [
      champ(ligne.code),
      champ(ligne.nom),
      nombreFrancais(
        valeurExportee(ligne.avant, meta.unite, meta.parHabitant),
        DECIMALES_EXPORT(meta.unite, meta.parHabitant),
      ),
      nombreFrancais(
        valeurExportee(ligne.apres, meta.unite, meta.parHabitant),
        DECIMALES_EXPORT(meta.unite, meta.parHabitant),
      ),
      nombreFrancais(variationExportee(ligne.variation, meta.unite, mode)),
      champ(uniteVariation),
      champ(unite),
      champ(meta.niveau),
    ].join(";"),
  );
  const commentaires = [
    `# ${meta.indicateur}, évolution ${meta.periodeApres} vs ${meta.periodeAvant}`,
    `# Source : ${meta.source} · exporté le ${quand.toISOString().slice(0, 10)}`,
    "# Licence Ouverte 2.0. Données complètes et documentées : voir « Accéder aux données » en bas de page.",
  ];
  return "\uFEFF" + [...commentaires, entetes.join(";"), ...corps].join("\r\n") + "\r\n";
}

export function nomDeFichier(indicateur: string, niveau: string, periode: string): string {
  const propre = (texte: string) =>
    texte
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `${propre(indicateur)}-${propre(niveau)}-${periode}.csv`;
}

/** Déclenche le téléchargement côté navigateur. Non testé : DOM pur. */
export function telecharger(contenu: string, fichier: string): void {
  const blob = new Blob([contenu], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = fichier;
  lien.click();
  URL.revokeObjectURL(url);
}
