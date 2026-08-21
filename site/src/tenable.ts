/**
 * « Est-ce tenable ? » — le chapitre qui répond à sa propre question.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA QUESTION REÇOIT UNE RÉPONSE, ET ELLE EST FACTUELLE
 * ─────────────────────────────────────────────────────────────────────────
 * Le bloc de la dette posait la question du chapitre sans jamais y répondre,
 * et le lecteur l'a refusé. La réponse est écrite en tête, et elle n'est pas
 * un jugement : elle est la conjonction de trois faits publiés — la dette a
 * augmenté plus vite que la richesse depuis 2017, un emprunt neuf coûte
 * plusieurs fois le taux de 2017, et les intérêts pèsent déjà tant par an.
 * Chaque nombre de la phrase est recalculé des séries à chaque affichage :
 * le jour où les faits changent, la phrase change avec eux.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA DETTE, AVEC SES DEUX BOUTS
 * ─────────────────────────────────────────────────────────────────────────
 * La dette se montre année par année — c'est la demande du lecteur pour ce
 * chapitre. Le taux d'un nouvel emprunt à 10 ans, lui, ne porte plus son
 * propre graphique : les deux chiffres qui comptaient (3,3 % aujourd'hui
 * contre 0,8 % en 2017) sont déjà dans la réponse, et un second endroit pour
 * les mêmes deux nombres ne les rendait pas plus vrais.
 *
 * Le bloc absorbe l'ancien bloc « Dette publique » (montant, part du PIB,
 * sous-secteurs) : deux blocs sur la dette dans le même chapitre auraient été
 * le doublon suivant. Qui porte la dette est dit dans la réponse elle-même,
 * pas dans une légende à part sous le graphique.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { dessiner } from "./graphique.ts";
import { montantLisible } from "./echelle.ts";
import { nomPays } from "./pays-noms.ts";

const DETTE = "insee_dette_apu_montant";
const DETTE_PIB = "eurostat_dette_pib";
const TAUX = "eurostat_taux_10_ans";
const INTERETS = "eurostat_apu_interets";
const RECETTES = "eurostat_apu_recettes";
const PIB = "eurostat_pib_montant";
const POPULATION = "eurostat_population";

const REFERENCE = "2017";

/** Les voisins de la comparaison : même mesure, même millésime, et l'ordre ne
 *  bouge pas — un tri par valeur ferait un classement. */
const VOISINS = ["FR", "IT", "ES", "DE", "EA20"];

const SOUS_SECTEURS: [string, string][] = [
  ["insee_dette_etat_montant", "L'État"],
  ["insee_dette_asso_montant", "La Sécurité sociale"],
  ["insee_dette_apul_montant", "Les collectivités"],
  ["insee_dette_odac_montant", "Les organismes divers"],
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const UNE_DECIMALE = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const ENTIER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Le dernier trimestre de chaque année de la série trimestrielle, plus le
 *  dernier point publié quand l'année en cours n'a pas encore son Q4. */
export function finsAnnee(serie: Record<string, number>): [string, number][] {
  const periodes = Object.keys(serie).sort();
  const dernieres = periodes.filter((p) => p.endsWith("-Q4"));
  const dernier = periodes[periodes.length - 1];
  const points: [string, number][] = dernieres.map((p) => [p.slice(0, 4), serie[p]]);
  if (dernier && !dernier.endsWith("-Q4")) {
    points.push([dernier.replace("-", " "), serie[dernier]]);
  }
  return points;
}

/** L'horizon du prolongement : la question du lecteur est « et en 2032 ? ». */
export const HORIZON = 2032;

/**
 * Le prolongement de la dette au rythme observé — un prolongement
 * arithmétique, JAMAIS une prévision, et la légende le dit avec ces mots.
 *
 * Aucune institution ne publie de trajectoire de dette jusqu'à ${HORIZON} :
 * inventer une prévision serait la faute que la charte interdit (aucun
 * chiffre sans source). Ce qui peut s'écrire honnêtement est l'arithmétique
 * du rythme courant : la hausse moyenne par an sur les cinq derniers
 * exercices pleins, prolongée telle quelle. La méthode tient en une phrase et
 * la légende la porte en entier — le lecteur peut refaire le calcul de tête.
 */
export function prolongement(annees: [string, number][]): [string, number][] {
  // Le rythme se mesure sur les exercices PLEINS (fin d'année) ; l'ancre est
  // le dernier point publié, trimestre en cours compris — un « 2026 projeté »
  // posé à côté du 2026 T1 publié aurait mis deux valeurs sous la même année.
  const pleines = annees.filter(([an]) => /^\d{4}$/.test(an));
  if (pleines.length < 6 || !annees.length) return [];
  const rythme = (pleines[pleines.length - 1][1] - pleines[pleines.length - 6][1]) / 5;
  const [anAncre, valeurAncre] = annees[annees.length - 1];
  const anneeAncre = Number(anAncre.slice(0, 4));
  const points: [string, number][] = [];
  for (let an = anneeAncre + 1; an <= HORIZON; an += 1) {
    points.push([String(an), valeurAncre + rythme * (an - anneeAncre)]);
  }
  return points;
}

/** Le bloc, ou la chaîne vide tant que la dette et le taux ne sont pas
 *  publiés — la réponse cite les deux, et une réponse à moitié sourcée ne
 *  s'écrit pas. */
export function rendu(
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): string {
  const france = pays["FR"];
  if (!france) return "";
  const publies = new Set(catalogue.map((i) => i.id));
  if (!publies.has(DETTE) || !publies.has(TAUX)) return "";
  const serie = (id: string) => france.series[id] ?? {};

  const dette = serie(DETTE);
  const annees = finsAnnee(dette).filter(([an]) => an >= REFERENCE);
  if (annees.length < 2) return "";
  const [anDebut, detteDebut] = annees[0];
  const detteFin = annees[annees.length - 1][1];

  const taux = serie(TAUX);
  const anneesTaux = Object.keys(taux).sort();
  const dernierTaux = anneesTaux[anneesTaux.length - 1];
  const premierTaux = anneesTaux.includes(REFERENCE) ? REFERENCE : anneesTaux[0];
  if (!dernierTaux || dernierTaux === premierTaux) return "";

  // La croissance de la richesse sur la même fenêtre, pour la réponse.
  const pib = serie(PIB);
  const pibDebut = pib[anDebut];
  const pibFin = pib[Object.keys(pib).sort().pop() ?? ""];

  const interets = serie(INTERETS);
  const anInterets = Object.keys(interets).sort().pop();
  const recettes = serie(RECETTES);
  const par100 =
    anInterets && recettes[anInterets] !== undefined
      ? (interets[anInterets] / recettes[anInterets]) * 100
      : null;

  const hausseDette = (detteFin / detteDebut - 1) * 100;
  const hausseRichesse =
    pibDebut !== undefined && pibFin !== undefined ? (pibFin / pibDebut - 1) * 100 : null;

  const sousSecteurs = SOUS_SECTEURS.map(([id, libelle]) => {
    const s = serie(id);
    const p = Object.keys(s).sort().pop();
    return p ? `${libelle} ${montantLisible(s[p])}` : "";
  })
    .filter(Boolean)
    .join(" · ");

  const reponse = `<p class="reponse"><strong>Au rythme actuel, la charge de la dette va
      augmenter.</strong> La dette a augmenté de <strong>${UNE_DECIMALE.format(
        hausseDette,
      )}&nbsp;%</strong> depuis ${echapper(anDebut)}${
        hausseRichesse !== null
          ? ` quand la richesse produite augmentait de ${UNE_DECIMALE.format(hausseRichesse)}&nbsp;%`
          : ""
      }, et l'État emprunte aujourd'hui à <strong>${UNE_DECIMALE.format(
        taux[dernierTaux],
      )}&nbsp;%</strong> contre ${UNE_DECIMALE.format(taux[premierTaux])}&nbsp;% en
      ${echapper(premierTaux)}.${
        anInterets && par100 !== null
          ? ` Les intérêts coûtent déjà <strong>${montantLisible(
              interets[anInterets],
            )}</strong> par an, soit ${UNE_DECIMALE.format(par100)}&nbsp;€ sur chaque 100&nbsp;€
      encaissés : à mesure que les vieux emprunts sont remplacés par des neufs, cette
      facture monte.`
          : ""
      }${sousSecteurs ? ` Qui la porte : ${sousSecteurs}.` : ""}</p>`;

  // ── La dette, en courbe, prolongée à l'horizon ─────────────────────────
  // Les barres horizontales année par année ont été refusées : « un graphique
  // avec courbe serait plus parlant ». La courbe observée est pleine ; le
  // prolongement est POINTILLÉ, anchré sur le dernier point publié, et sa
  // légende dit la méthode en entier — un prolongement arithmétique du rythme
  // observé, jamais une prévision.
  const enMilliards: [string, number][] = annees.map(([an, v]) => [an, v / 1e9]);
  const projete = prolongement(enMilliards);
  const dernierObserve = enMilliards[enMilliards.length - 1];
  const series = [
    { nom: "Dette publiée", couleur: "#2a68c4", accent: true, points: enMilliards },
    ...(projete.length
      ? [
          {
            nom: "Prolongement",
            couleur: "#2a68c4",
            pointille: true,
            points: [dernierObserve, ...projete] as [string, number][],
          },
        ]
      : []),
  ];
  const { svg } = dessiner(series, {
    formater: (v) => ENTIER.format(v),
    titre: "La dette publique, en milliards d'euros",
  });

  // La figure ne remplace pas le tableau, elle le précède : les valeurs
  // exactes, année par année, dans un cadre qui défile.
  const colonnes = [...enMilliards, ...projete];
  const tableau = `<div class="tenable__valeurs" tabindex="0"><table class="comparaison">
    <thead><tr><th scope="col"></th>${colonnes
      .map(([an]) => `<th scope="col">${echapper(an)}</th>`)
      .join("")}</tr></thead>
    <tbody><tr><th scope="row">Dette</th>${enMilliards
      .map(([, v]) => `<td>${ENTIER.format(v)}</td>`)
      .join("")}${projete
      .map(([, v]) => `<td class="tenable__projete">${ENTIER.format(v)}</td>`)
      .join("")}</tr></tbody>
  </table></div>`;

  const population = serie(POPULATION);
  const habitants = population[Object.keys(population).sort().pop() ?? ""];
  const parHabitant =
    habitants !== undefined ? ` Soit <strong>${ENTIER.format(detteFin / habitants)}&nbsp;€</strong> par habitant.` : "";

  // ── Les voisins ────────────────────────────────────────────────────────
  const dernierePart = (code: string): [string, number] | null => {
    const s = pays[code]?.series?.[DETTE_PIB];
    if (!s) return null;
    const an = Object.keys(s).sort().pop();
    return an ? [an, s[an]] : null;
  };
  const partFr = dernierePart("FR");
  const voisins = partFr
    ? VOISINS.map((code) => {
        const part = pays[code]?.series?.[DETTE_PIB]?.[partFr[0]];
        if (part === undefined) return "";
        return `<div class="tenable__rang" style="grid-template-columns:minmax(6rem,11rem) minmax(0,1fr) 4.6rem">
          <span class="apu__nom">${echapper(nomPays(code))}</span>
          <span class="apu__piste"><span style="width:${Math.min(100, (part / Math.max(...VOISINS.map((c) => pays[c]?.series?.[DETTE_PIB]?.[partFr[0]] ?? 0))) * 100).toFixed(1)}%"></span></span>
          <span class="apu__valeur">${UNE_DECIMALE.format(part)}&nbsp;%</span>
        </div>`;
      }).join("")
    : "";

  // Pas de titre de bloc : la question du chapitre — « Est-ce tenable ? » —
  // est juste au-dessus, et la maquette validée pose la réponse directement
  // sous elle.
  return `
    ${reponse}
    <div>
      <h3 class="sous-titre">La dette, jusqu'en ${HORIZON}</h3>
      ${svg}
      ${tableau}
      <p class="bloc__complement">Milliards d'euros, fin d'année ; le dernier point plein est
        le dernier trimestre publié.${parHabitant} Source : INSEE. Le pointillé prolonge la
        hausse moyenne des cinq derniers exercices — un prolongement arithmétique du rythme
        observé, pas une prévision.</p>
    </div>
    ${
      voisins
        ? // Le millésime vivait dans une légende à part sous le titre ; il
          // tient dans le titre lui-même, à côté de « en un an » qu'il
          // précise. La source reste écrite — un chiffre de comparaison
          // internationale sans elle ne se contrôle pas — mais en une ligne
          // courte, pas dans un paragraphe qui répète « même définition pour
          // tous » que le titre dit déjà.
          `<h3 class="sous-titre">La dette rapportée à la richesse produite en un an, ${echapper(partFr![0])}</h3>
    ${voisins}
    <p class="bloc__complement">Source : Eurostat.</p>`
        : ""
    }`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint : le sommaire de la page se
 *  construit sur ce qui s'est réellement affiché. */
export function afficherTenable(
  cadre: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(pays, catalogue);
  if (html) cadre.innerHTML = html;
  // Qui remplit un cadre le déplie : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien d'autre ne le rouvrirait.
  if (html) cadre.hidden = false;
  return html !== "";
}
