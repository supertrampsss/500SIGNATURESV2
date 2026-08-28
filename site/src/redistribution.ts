/**
 * Ce que la redistribution change, décile par décile.
 *
 * Le site dit ce que l'État encaisse et ce qu'il dépense ; il ne disait pas ce
 * que cet argent-là **fait** aux revenus. C'est pourtant la question qui se
 * tient derrière la plupart des autres, et elle a une réponse chiffrée depuis
 * 1996 : l'INSEE publie les neuf déciles du niveau de vie avant et après
 * impôts et prestations.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE BLOC MONTRE, ET CE QU'IL REFUSE DE DIRE
 * ─────────────────────────────────────────────────────────────────────────
 * Il montre deux colonnes et leur écart, décile par décile. Il ne dit pas si
 * c'est assez, ni si c'est trop : l'écart est une mesure, pas un verdict — la
 * même ligne que la note de gestion tient sur les collectivités.
 *
 * **Le champ est nommé.** L'ERFS couvre la France métropolitaine, pas les
 * DROM. Une série nationale qui laisse deux millions de personnes dehors sans
 * le dire est une comparaison dont on ne contrôle pas le périmètre, et c'est
 * exactement ce que la charte du dépôt refuse.
 *
 * **Le seuil d'un décile n'est pas un revenu moyen.** « Le premier décile vaut
 * 13 970 € » veut dire que les 10 % les plus modestes vivent avec moins que
 * cela, pas qu'ils vivent avec cela — la précision vivait dans la légende du
 * tableau, retirée pour tenir les sources courtes et sous le tableau. Le
 * risque de lecture reste réel ; il n'est plus écrit ici.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { halteres } from "./dataviz.ts";
import { formater } from "./echelle.ts";

/** Le décile après redistribution, et son pendant avant. */
const APRES = (n: number) => `insee_niveau_vie_d${n}`;
const AVANT = (n: number) => `insee_niveau_vie_d${n}_avant_redistribution`;
const RAPPORT = "insee_rapport_interdecile";
const RAPPORT_AVANT = "insee_rapport_interdecile_avant_redistribution";

/** Ce que chaque décile sépare, en toutes lettres. Un « D3 » ne se lit pas. */
const RANGS = [
  "les 10 % les plus modestes",
  "les 20 % les plus modestes",
  "les 30 % les plus modestes",
  "les 40 % les plus modestes",
  "la moitié la plus modeste",
  "les 40 % les plus aisés",
  "les 30 % les plus aisés",
  "les 20 % les plus aisés",
  "les 10 % les plus aisés",
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function derniere(serie: Record<string, number> | undefined): [string, number] | null {
  if (!serie) return null;
  const periodes = Object.keys(serie).sort();
  const derniereP = periodes[periodes.length - 1];
  return derniereP ? [derniereP, serie[derniereP]] : null;
}

/**
 * Le bloc, ou la chaîne vide tant que les deux colonnes ne sont pas publiées.
 *
 * **Les deux, ou rien.** Une colonne « après » seule ne dit rien de la
 * redistribution : elle dit un niveau de vie, que la fiche porte déjà
 * ailleurs. C'est l'écart qui est le sujet, et un écart demande deux nombres
 * du même exercice — un décile de 2024 retranché d'un décile de 2022
 * mesurerait deux ans d'inflation et les appellerait redistribution.
 */
export function rendu(pays: Record<string, Territoire>, catalogue: Indicateur[]): string {
  const france = pays["FR"];
  if (!france) return "";
  const publie = new Set(catalogue.map((i) => i.id));
  if (!publie.has(APRES(1)) || !publie.has(AVANT(1))) return "";

  const lignes: { rang: string; avant: number; apres: number }[] = [];
  let exercice = "";
  for (let n = 1; n <= 9; n += 1) {
    const apres = derniere(france.series[APRES(n)]);
    const avant = derniere(france.series[AVANT(n)]);
    // Même exercice des deux côtés, sans quoi l'écart mesure autre chose.
    if (!apres || !avant || apres[0] !== avant[0]) continue;
    exercice = apres[0];
    lignes.push({ rang: RANGS[n - 1], avant: avant[1], apres: apres[1] });
  }
  if (lignes.length < 9) return "";

  const euros = (valeur: number, id: string) => formater(valeur, "EUR", false, id);
  const rangees = lignes
    .map((ligne, i) => {
      const ecart = ligne.apres - ligne.avant;
      return `<tr>
        <th scope="row">${echapper(ligne.rang)}</th>
        <td>${euros(ligne.avant, AVANT(i + 1))}</td>
        <td>${euros(ligne.apres, APRES(i + 1))}</td>
        <td class="evolution">${ecart > 0 ? "+" : ""}${euros(ecart, APRES(i + 1))}</td>
      </tr>`;
    })
    .join("");

  const rapport = derniere(france.series[RAPPORT]);
  const rapportAvant = derniere(france.series[RAPPORT_AVANT]);
  const resserrement =
    rapport && rapportAvant && rapport[0] === rapportAvant[0]
      ? `<p class="bloc__complement">Les 10 % les plus aisés disposaient de
          <strong>${formater(rapportAvant[1], "ratio", false)} fois</strong> le niveau de
          vie des 10 % les plus modestes avant impôts et prestations, et de
          <strong>${formater(rapport[1], "ratio", false)} fois</strong> après.</p>`
      : "";

  const premier = lignes[0];
  const dernier = lignes[8];
  const tableau = `<table class="comparaison" tabindex="0">
    <thead><tr><th scope="col">Seuil qui sépare</th>
      <th scope="col">Avant impôts et prestations</th>
      <th scope="col">Après</th>
      <th scope="col" class="evolution">Ce que ça change</th></tr></thead>
    <tbody>${rangees}</tbody>
  </table>`;
  const graphique = halteres({
    titre: "La redistribution resserre les niveaux de vie",
    description: `Seuils de niveau de vie avant et après impôts et prestations en ${exercice}.`,
    lignes: lignes.map((ligne) => ({ libelle: ligne.rang, avant: ligne.avant, apres: ligne.apres })),
    noms: ["Avant", "Après"],
    formater: (valeur) => `${Math.round(valeur).toLocaleString("fr-FR")} €`,
  });

  // Le tableau des neuf seuils, seul : les haltères qui l'accompagnaient
  // (avant/après reliés par un trait) doublaient l'information qu'il porte
  // déjà, colonne par colonne, sans rien ajouter que le tableau ne dise — le
  // lecteur les a jugées de trop.
  return `
    <p class="bloc__complement">En ${echapper(exercice)}, le seuil des 10 % les plus
      modestes passe de <strong>${euros(premier.avant, AVANT(1))}</strong> à
      <strong>${euros(premier.apres, APRES(1))}</strong> par an, celui des 10 % les plus
      aisés de <strong>${euros(dernier.avant, AVANT(9))}</strong> à
      <strong>${euros(dernier.apres, APRES(9))}</strong>.</p>
    ${resserrement}
    ${graphique}
    <div class="ui-visually-hidden">${tableau}
    <p class="bloc__complement">Source : INSEE.</p></div>`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint : le sommaire de la page se
 *  construit sur ce qui s'est réellement affiché. */
export function afficherRedistribution(
  cadre: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(pays, catalogue);
  if (html) cadre.innerHTML = html;
  // Le cadre est peut-être REPLIÉ : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien ne le rouvrait. Un bloc dont les séries sont publiées
  // APRÈS le dernier déploiement restait alors invisible à tout lecteur —
  // écrit, peint, et caché. Qui remplit un cadre le déplie.
  if (html) cadre.hidden = false;
  return html !== "";
}
