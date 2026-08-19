/**
 * Pour 100 € encaissés par toutes les administrations publiques, ce qui ressort.
 *
 * Le site répondait déjà deux fois à « où va l'argent public » : les 100 € du
 * budget de l'État, et les 100 € de prestations sociales. Il manquait la
 * réponse la plus large — celle qui met **l'État, les collectivités et la
 * Sécurité sociale ensemble** — et c'est la seule à laquelle on puisse
 * rattacher le déficit public dont tout le monde parle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TROIS « 100 € » SUR LE MÊME SITE, ET CE QUI LES SÉPARE
 * ─────────────────────────────────────────────────────────────────────────
 * Ce bloc-ci compte **toutes** les administrations publiques en comptabilité
 * **nationale** ; celui du budget de l'État compte l'État seul en comptabilité
 * **budgétaire** ; celui des prestations sociales répartit une dépense, pas un
 * encaissement. Aucun des trois ne se soustrait d'un autre, et le cadrage le
 * dit avant les nombres plutôt que de laisser trois camemberts se contredire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE TOTAL DÉPASSE 100 €, ET C'EST LE SUJET
 * ─────────────────────────────────────────────────────────────────────────
 * Les parts ne sont pas ramenées à cent : elles sont rapportées aux **recettes**,
 * si bien que leur somme vaut ce que les administrations dépensent pour 100 €
 * encaissés — 109,77 € en 2025. L'écart est le déficit, à sa place, dans
 * l'unité du lecteur. Le ramener à cent aurait fait disparaître la seule chose
 * que ce tableau existe pour montrer.
 *
 * **Le reste non détaillé est écrit.** Les neuf postes nommés couvrent 98,85 %
 * des dépenses ; le solde de la soustraction est une ligne, jamais un silence.
 *
 * La légende qui vivait au-dessus du tableau des recettes (exercice, source,
 * ce qui sépare ce « 100 € » des deux autres) est partie : ce qui sépare les
 * trois tient dans ce docstring, l'exercice dans la phrase d'ouverture, et la
 * source dans une ligne courte sous le tableau.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE PREMIER POSTE NE S'AFFICHE PLUS COMME UNE LIGNE À PART
 * ─────────────────────────────────────────────────────────────────────────
 * « Retraites, chômage, allocations » vivait sous un repli qu'il fallait
 * ouvrir pour voir sept lignes qui pèsent plus que la moitié de la dépense
 * publique. Le repli est parti : ses sept fonctions (retraites, chômage,
 * réversion, famille, RSA, arrêts maladie, aides au logement) s'affichent
 * directement, au même niveau que les huit autres postes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES SIGNES
 * ─────────────────────────────────────────────────────────────────────────
 * Une recette entre : +. Une dépense sort : −, et les sous-lignes du poste
 * aussi — les retraites sont une dépense, pas un gain. L'emprunt garde ses
 * hachures, jamais une couleur.
 */

import type { Territoire } from "./donnees.ts";
import { montantLisible } from "./echelle.ts";

const RECETTES = "eurostat_apu_recettes";
const DEPENSES = "eurostat_apu_depenses";

/** Les postes de dépense, du plus lourd au plus léger sur le dernier exercice
 *  connu. L'ordre est figé plutôt que recalculé : il change d'un exercice à
 *  l'autre pour des écarts de quelques centimes, et un tableau qui se
 *  réordonne tout seul empêche de comparer deux millésimes. */
const POSTES: [id: string, libelle: string][] = [
  ["eurostat_apu_prestations", "Retraites, chômage, allocations"],
  ["eurostat_apu_remunerations", "Rémunération des agents publics"],
  ["eurostat_apu_transferts_nature", "Soins et services remboursés"],
  ["eurostat_apu_consommations", "Achats de biens et de services"],
  ["eurostat_apu_investissement", "Investissement"],
  ["eurostat_apu_transferts_courants", "Transferts courants versés"],
  ["eurostat_apu_interets", "Intérêts de la dette"],
  ["eurostat_apu_subventions", "Subventions aux entreprises"],
  ["eurostat_apu_transferts_capital", "Transferts en capital"],
];

/** D'où viennent les 100 €. Trois lignes, et le reste nommé comme reste. */
const RESSOURCES: [id: string, libelle: string][] = [
  ["eurostat_apu_cotisations", "Cotisations sociales"],
  ["eurostat_apu_impots_production", "Impôts sur la production et la consommation"],
  ["eurostat_apu_impots_revenu", "Impôts sur le revenu et le patrimoine"],
];

/**
 * Ce que recouvre « Retraites, chômage, allocations ».
 *
 * Le poste le plus lourd de la dépense publique était aussi le plus muet : un
 * seul nombre pour trois choses qui n'ont ni le même montant, ni le même
 * public, ni le même débat. **La retraite y pèse neuf fois le chômage**, et
 * l'ordre des mots du libellé suggérait le contraire.
 *
 * Deux fonctions manquaient au trio que le libellé nomme, et elles ne sont pas
 * petites : les pensions de réversion et les indemnités d'arrêt maladie valent
 * chacune plus que le chômage. Les nommer « allocations » les aurait perdues.
 */
const FONCTIONS: [id: string, libelle: string][] = [
  ["eurostat_apu_prestations_vieillesse", "Retraites"],
  ["eurostat_apu_prestations_maladie_invalidite", "Arrêts maladie et invalidité"],
  ["eurostat_apu_prestations_chomage", "Chômage"],
  ["eurostat_apu_prestations_survivants", "Pensions de réversion"],
  ["eurostat_apu_prestations_famille", "Famille et enfants"],
  ["eurostat_apu_prestations_exclusion", "RSA et autres minima sociaux"],
  ["eurostat_apu_prestations_logement", "Aides au logement versées en espèces"],
];

/** Le total de la ventilation — le même compte que le poste du tableau
 *  principal, mais lu dans le jeu qui le ventile, donc à un autre millésime. */
const VENTILEES = "eurostat_apu_prestations_ventilees";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un montant en euros pour 100 € encaissés, deux décimales : c'est une colonne
 *  qu'on lit de haut en bas, et les postes légers se départagent aux centimes. */
function pour100(part: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(part)} €`;
}

/**
 * La ventilation du premier poste, **sur son propre exercice**.
 *
 * Elle vient d'un autre jeu de la même source — celui qui croise la
 * transaction avec la fonction — et ce jeu ne dit pas la même année : il
 * s'arrête un exercice plus tôt, et son total diffère de 0,3 % de celui du
 * tableau principal sur les exercices récents. Deux millésimes d'un même
 * compte, publiés à deux dates.
 *
 * D'où le refus qui commande cette fonction : **les parts ne sont pas
 * calculées sur les recettes du tableau du dessus**, mais sur celles de
 * l'exercice ventilé, et le tableau porte son propre total. Redistribuer les
 * 37,11 € de 2025 sur des clés de 2024 aurait donné un tableau qui tombe juste
 * et qui ment — aucune de ses lignes n'aurait été un chiffre publié.
 *
 * La chaîne vide tant que les sept fonctions et leur total ne partagent pas un
 * exercice avec les recettes : une part dont le dénominateur vient d'ailleurs
 * ne mesure rien.
 */
function renduVentilation(france: Territoire): string {
  const serie = (id: string) => france.series[id];
  const total = serie(VENTILEES);
  const recettes = serie(RECETTES);
  if (!total || !recettes) return "";
  const exercice = Object.keys(total)
    .filter(
      (an) =>
        recettes[an] !== undefined && FONCTIONS.every(([id]) => serie(id)?.[an] !== undefined),
    )
    .sort()
    .pop();
  if (!exercice) return "";

  const encaisse = recettes[exercice];
  const part = (montant: number) => (montant / encaisse) * 100;
  const lignes = FONCTIONS.map(
    ([id, libelle]) => [libelle, part(serie(id)![exercice])] as const,
  );
  const ensemble = part(total[exercice]);
  const reste = ensemble - lignes.reduce((somme, [, valeur]) => somme + valeur, 0);
  const maximum = Math.max(...lignes.map(([, v]) => v));

  const rang = ([libelle, valeur]: readonly [string, number], creux = false) => `
    <div class="apu__rang">
      <span class="apu__nom">${echapper(libelle)}</span>
      <span class="apu__piste${creux ? " apu__piste--creux" : ""}"><span
        style="width:${((valeur / maximum) * 100).toFixed(1)}%"></span></span>
      <span class="apu__valeur flux--moins">−${pour100(valeur)}</span>
    </div>`;

  // Les sept fonctions se lisent au même niveau que le reste des postes, sans
  // ligne « Retraites, chômage, allocations » qui les résumerait avant de les
  // détailler. Leur somme (le jeu qui les croise avec la fonction) reste
  // légèrement différente du poste qu'elles remplacent visuellement (le jeu
  // principal, exercice suivant) — l'un et l'autre restent chacun un chiffre
  // publié, jamais recalé sur l'autre.
  return lignes.map((l) => rang(l)).join("") + rang(["Prestations hors protection sociale (bourses, culture, santé)", reste], true);
}

/**
 * Le bloc, ou la chaîne vide tant que les deux totaux et les neuf postes ne
 * sont pas publiés **sur le même exercice**.
 *
 * Une part calculée sur des recettes d'une autre année ne mesure rien : le
 * dénominateur bouge de quarante milliards d'un exercice à l'autre.
 */
export function rendu(pays: Record<string, Territoire>): string {
  const france = pays["FR"];
  if (!france) return "";
  const serie = (id: string) => france.series[id];
  const recettes = serie(RECETTES);
  const depenses = serie(DEPENSES);
  if (!recettes || !depenses) return "";
  const exercices = Object.keys(recettes)
    .filter((an) => depenses[an] !== undefined)
    .sort();
  const exercice = exercices[exercices.length - 1];
  if (!exercice) return "";

  const total = recettes[exercice];
  const part = (id: string) => {
    const valeur = serie(id)?.[exercice];
    return valeur === undefined ? null : (valeur / total) * 100;
  };
  const postes = POSTES.map(([id, libelle]) => [libelle, part(id)] as const);
  if (postes.some(([, valeur]) => valeur === null)) return "";

  const nommees = postes.reduce((somme, [, valeur]) => somme + (valeur ?? 0), 0);
  const depense = (depenses[exercice] / total) * 100;
  const reste = depense - nommees;
  const solde = 100 - depense;

  const ressources = RESSOURCES.map(([id, libelle]) => [libelle, part(id)] as const).filter(
    (ligne): ligne is readonly [string, number] => ligne[1] !== null,
  );
  const autresRecettes = 100 - ressources.reduce((somme, [, valeur]) => somme + valeur, 0);

  const maximum = Math.max(...postes.map(([, v]) => v ?? 0));
  // Le total n'a pas de barre : à trois fois le plus gros poste, elle serait
  // tronquée à 100 % et lirait comme un poste de plus.
  const rang = (libelle: string, valeur: number, options: { creux?: boolean; total?: boolean } = {}) => `
    <div class="apu__rang${options.total ? " apu__total" : ""}">
      <span class="apu__nom">${echapper(libelle)}</span>
      ${
        options.total
          ? "<span></span>"
          : `<span class="apu__piste${options.creux ? " apu__piste--creux" : ""}"><span
        style="width:${Math.min(100, (valeur / maximum) * 100).toFixed(1)}%"></span></span>`
      }
      <span class="apu__valeur flux--moins">−${pour100(valeur)}</span>
    </div>`;

  // Le premier poste ne s'affiche plus comme une ligne à part qui se déplie :
  // sa ventilation, quand elle est publiée, prend directement sa place, au
  // même niveau que les huit autres postes.
  const [premierPoste, ...autresPostes] = postes;
  const ventilation = renduVentilation(france);

  // L'affirmation et les recettes à gauche, les dépenses en barres à droite,
  // comme la maquette validée. Pas de titre de bloc : la question du chapitre,
  // juste au-dessus, le porte déjà.
  return `
    <div class="chapitre__duo">
      <div>
        <p class="bloc__complement">Toutes les administrations publiques réunies
          (l'État, les collectivités, la Sécurité sociale et les organismes qu'ils
          financent) ont encaissé <strong>${montantLisible(total)}</strong> en
          ${echapper(exercice)} et dépensé <strong>${pour100(depense)}</strong> pour chaque
          100 € reçus. Les <strong>${pour100(Math.abs(solde))}</strong> manquants ont été
          empruntés : c'est le déficit public. Le premier poste — retraites, chômage,
          allocations — en prend plus du tiers, et à l'intérieur, <strong>la retraite pèse
          neuf fois le chômage</strong>.</p>
        <table class="comparaison" tabindex="0">
          <thead><tr><th scope="col">D'où viennent les 100 €</th>
            <th scope="col">Montant</th></tr></thead>
          <tbody>${ressources
            .map(
              ([libelle, valeur]) => `<tr><th scope="row">${echapper(libelle)}</th>
                <td class="flux--plus">+${pour100(valeur)}</td></tr>`,
            )
            .join("")}
            <tr><th scope="row">Ventes de services et autres recettes</th>
              <td class="flux--plus">+${pour100(autresRecettes)}</td></tr>
            <tr class="souligne"><th scope="row">Total encaissé</th>
              <td class="flux--plus">+${pour100(100)}</td></tr>
          </tbody>
        </table>
        <p class="bloc__complement">Source : Eurostat.</p>
      </div>
      <div>
        <h3 class="sous-titre">Où ils vont</h3>
        ${ventilation || rang(premierPoste[0], premierPoste[1] ?? 0)}
        ${autresPostes.map(([libelle, valeur]) => rang(libelle, valeur ?? 0)).join("")}
        ${rang("Autres dépenses", reste)}
        ${rang("Total dépensé", depense, { total: true })}
        ${rang("Dépensé sans avoir été reçu : l'emprunt", Math.abs(solde), { creux: true })}
      </div>
    </div>`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint : le sommaire de la page se
 *  construit sur ce qui s'est réellement affiché. */
export function afficherCentEurosApu(
  cadre: HTMLElement,
  pays: Record<string, Territoire>,
): boolean {
  const html = rendu(pays);
  if (html) cadre.innerHTML = html;
  // Le cadre est peut-être REPLIÉ : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien ne le rouvrait. Un bloc dont les séries sont publiées
  // APRÈS le dernier déploiement restait alors invisible à tout lecteur —
  // écrit, peint, et caché. Qui remplit un cadre le déplie.
  if (html) cadre.hidden = false;
  return html !== "";
}
