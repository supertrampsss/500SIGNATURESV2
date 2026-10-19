import { renduReclassementBercy } from "./reclassement-bercy.ts";
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
 * publique. Le repli est parti : ses six groupes (retraites avec réversion, chômage,
 * famille, RSA, arrêts maladie, aides au logement) s'affichent
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
import { barreEmpilee } from "./dataviz.ts";

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

/** Les prestations sont affichées en six groupes. La ligne Retraites réunit
 * vieillesse (minima inclus) et survivants, sans modifier le total publié. */
// Regrouper vieillesse et survivants au même exercice conserve le total des prestations.
const FONCTIONS: [ids: string[], libelle: string][] = [
  [["eurostat_apu_prestations_vieillesse", "eurostat_apu_prestations_survivants"], "Retraites"],
  [["eurostat_apu_prestations_maladie_invalidite"], "Arrêts maladie et invalidité"],
  [["eurostat_apu_prestations_chomage"], "Chômage"],
  [["eurostat_apu_prestations_famille"], "Famille et enfants"],
  [["eurostat_apu_prestations_exclusion"], "RSA et autres minima sociaux"],
  [["eurostat_apu_prestations_logement"], "Aides au logement versées en espèces"],
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

/** Chaque ventilation est lue sur l'exercice du compte affiché. Les fonctions,
 * leur total, les transactions, les recettes et les dépenses doivent être
 * disponibles ensemble ; sinon le dernier compte complet reste non ventilé. */
type Feuille = { libelle: string; valeur: number; creux?: boolean };

/**
 * La ventilation du premier poste en fonctions, comme DONNÉES — plus comme
 * HTML : « Où ils vont » fond désormais ces fonctions dans une seule liste
 * triée avec les autres postes, et le tri se fait sur les valeurs, pas sur des
 * chaînes déjà rendues.
 *
 * `null` tant que les six groupes de fonctions et leur total ne partagent pas un
 * exercice avec les recettes : une part dont le dénominateur vient d'ailleurs
 * ne mesure rien. Le dénominateur reste celui de l'exercice ventilé, jamais
 * les recettes du tableau du dessus — voir le refus documenté ci-dessus.
 */
function ventilationLignes(france: Territoire, exercice: string): Feuille[] | null {
  const serie = (id: string) => france.series[id];
  const total = serie(VENTILEES);
  const recettes = serie(RECETTES);
  if (!total || !recettes) return null;
  if (total[exercice] === undefined || recettes[exercice] === undefined ||
      !FONCTIONS.every(([ids]) => ids.every(id => serie(id)?.[exercice] !== undefined))) return null;

  const encaisse = recettes[exercice];
  const part = (montant: number) => (montant / encaisse) * 100;
  const lignes: Feuille[] = FONCTIONS.map(([ids, libelle]) => ({
    libelle,
    valeur: part(ids.reduce((somme, id) => somme + serie(id)![exercice], 0)),
  }));
  const ensemble = part(total[exercice]);
  const reste = ensemble - lignes.reduce((somme, l) => somme + l.valeur, 0);
  return [
    ...lignes,
    { libelle: "Prestations hors protection sociale (bourses, culture, santé)", valeur: reste, creux: true },
  ];
}

/** Les teintes de série, validées sur les deux fonds (voir `style.css`) :
 *  jamais un hexadécimal inventé ici, qui casserait la séparation de la gamme. */
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
    .filter((an) => recettes[an] > 0 && depenses[an] !== undefined && POSTES.every(([id]) => serie(id)?.[an] !== undefined))
    .sort();
  // Toute la liste partage un millésime : priorité au dernier compte complet
  // ventilable, puis repli sur le dernier compte complet sans ventilation.
  const exercice = [...exercices].reverse().find(an => ventilationLignes(france, an) !== null) ?? exercices.at(-1);
  if (!exercice) return "";

  const total = recettes[exercice];
  const part = (id: string) => {
    const valeur = serie(id)?.[exercice];
    return valeur === undefined ? null : (valeur / total) * 100;
  };
  const postes = POSTES.map(([id, libelle]) => [libelle, part(id)] as const);
  if (postes.some(([, valeur]) => valeur === null)) return "";

  const depense = (depenses[exercice] / total) * 100;
  const solde = 100 - depense;

  const ressources = RESSOURCES.map(([id, libelle]) => [libelle, part(id)] as const).filter(
    (ligne): ligne is readonly [string, number] => ligne[1] !== null,
  );
  const autresRecettes = 100 - ressources.reduce((somme, [, valeur]) => somme + valeur, 0);
  const recettesGraphique = barreEmpilee({
    titre: "D'où viennent les 100 €",
    description: "Composition des recettes de l'ensemble des administrations publiques.",
    segments: [
      ...ressources.map(([libelle, valeur]) => ({ libelle, valeur })),
      { libelle: "Ventes de services et autres recettes", valeur: autresRecettes },
    ],
    formater: pour100,
  });

  // « Où ils vont » : une seule liste de postes-feuilles, triée du plus lourd
  // au plus léger — demandé par le propriétaire. Le premier poste, quand sa
  // ventilation est publiée, est remplacé par ses fonctions ; sinon il reste
  // une ligne. Toutes les feuilles entrent dans le même tri et partagent une
  // seule échelle de barre, pour que « Retraites » (26,76) et « Rémunération »
  // (23,69) se comparent enfin d'un regard.
  const ventilation = ventilationLignes(france, exercice);
  const [premierPoste, ...autresPostes] = postes;
  const detail: Feuille[] = [
    ...(ventilation ?? [{ libelle: premierPoste[0], valeur: premierPoste[1] ?? 0 }]),
    ...autresPostes.map(([libelle, valeur]) => ({ libelle, valeur: valeur ?? 0 })),
  ];
  // Le résidu réconcilie aussi les millésimes de publication des deux jeux
  // Eurostat. Cet écart n'est jamais affecté arbitrairement aux retraites.
  const reste = depense - detail.reduce((somme, ligne) => somme + ligne.valeur, 0);
  const feuilles = [...detail, { libelle: "Autres dépenses", valeur: reste }].sort((a, b) => b.valeur - a.valeur);

  const maximum = Math.max(...feuilles.map((f) => f.valeur));
  // Le total n'a pas de barre : à trois fois le plus gros poste, elle serait
  // tronquée à 100 % et lirait comme un poste de plus.
  const rang = (libelle: string, valeur: number, options: { creux?: boolean; total?: boolean } = {}) => `
    <div class="apu__rang${options.total ? " apu__total" : ""}" data-apu-valeur="${valeur}">
      <span class="apu__nom">${echapper(libelle)}</span>
      ${
        options.total
          ? "<span></span>"
          : `<span class="apu__piste${options.creux ? " apu__piste--creux" : ""}"><span
        style="width:${Math.min(100, (valeur / maximum) * 100).toFixed(1)}%"></span></span>`
      }
      <span class="apu__valeur flux--moins">−${pour100(valeur)}</span>
    </div>`;

  // L'affirmation et les recettes à gauche, les dépenses en barres à droite,
  // comme la maquette validée. Pas de titre de bloc : la question du chapitre,
  // juste au-dessus, le porte déjà.
  return `
    <h3 class="sous-titre">Pour 100 € de recettes publiques</h3>
    <p class="chart-context">${echapper(exercice)} : ${pour100(depense)} dépensés pour 100 € reçus${solde < 0 ? `, soit ${pour100(Math.abs(solde))} à financer` : ''}.</p>
    <div class="accounts-composition">
      ${recettesGraphique}
      <figure class="spending-bars"><figcaption>Où va l'argent</figcaption>
        ${feuilles.map((f) => rang(f.libelle, f.valeur, { creux: f.creux })).join("")}
        ${rang("Total dépensé", depense, { total: true })}
      </figure>
    </div>
    <p class="chart-context">Tous les postes utilisent le même exercice. Le solde « Autres dépenses » inclut les dépenses non détaillées et les écarts de publication entre comptes et ventilation des prestations. Les retraites regroupent les prestations de vieillesse, les minima vieillesse et les pensions de réversion. Les rémunérations comprennent les cotisations sociales employeur, effectives et imputées. Les financements des retraites publiques ne s’ajoutent pas à ces dépenses. <a href="/analyses/financement-retraites-publiques/">Comprendre le financement des retraites publiques</a></p>
    <p class="chart-source">Ensemble des administrations publiques · ${montantLisible(total)} de recettes · Eurostat</p>
    ${renduReclassementBercy()}

  `;
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
