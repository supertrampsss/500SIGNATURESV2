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
 * LES ÉVOLUTIONS, AVEC LEURS DEUX BOUTS
 * ─────────────────────────────────────────────────────────────────────────
 * La dette se montre année par année — c'est la demande du lecteur pour ce
 * chapitre — et le taux d'emprunt sur quatre exercices choisis, dont 2020,
 * l'année où la France était payée pour emprunter : sans ce point bas, la
 * remontée n'a pas d'échelle.
 *
 * Le bloc absorbe l'ancien bloc « Dette publique » (montant, part du PIB,
 * sous-secteurs) : deux blocs sur la dette dans le même chapitre auraient été
 * le doublon suivant.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
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
  // Quatre points : la référence, le creux de la fenêtre, un intermédiaire,
  // le dernier. Le creux est cherché, pas écrit en dur — c'est lui qui donne
  // l'échelle de la remontée.
  const fenetre = anneesTaux.filter((an) => an >= premierTaux);
  const creux = fenetre.reduce((bas, an) => (taux[an] < taux[bas] ? an : bas), fenetre[0]);
  const pointsTaux = [...new Set([premierTaux, creux, fenetre[Math.floor(fenetre.length * 0.7)], dernierTaux])]
    .filter((an): an is string => an !== undefined)
    .sort();

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
      }</p>`;

  // ── La dette, année par année ──────────────────────────────────────────
  const maximumDette = detteFin;
  const rangsDette = annees
    .map(
      ([an, valeur], i) => `<div class="tenable__rang">
        <span class="apu__nom">${echapper(an)}</span>
        <span class="apu__piste"><span style="width:${((valeur / maximumDette) * 100).toFixed(
          1,
        )}%"></span></span>
        <span class="apu__valeur"${i === annees.length - 1 ? ' style="font-weight:700"' : ""}>${ENTIER.format(
          valeur / 1e9,
        )}</span>
      </div>`,
    )
    .join("");

  const population = serie(POPULATION);
  const habitants = population[Object.keys(population).sort().pop() ?? ""];
  const parHabitant =
    habitants !== undefined ? ` Soit <strong>${ENTIER.format(detteFin / habitants)}&nbsp;€</strong> par habitant.` : "";

  const sousSecteurs = SOUS_SECTEURS.map(([id, libelle]) => {
    const s = serie(id);
    const p = Object.keys(s).sort().pop();
    return p ? `${libelle} ${montantLisible(s[p])}` : "";
  })
    .filter(Boolean)
    .join(" · ");

  // ── Le taux, sur quatre points ─────────────────────────────────────────
  const maxTaux = Math.max(...pointsTaux.map((an) => taux[an]));
  const rangsTaux = pointsTaux
    .map(
      (an) => `<div class="tenable__rang tenable__rang--taux">
        <span class="apu__nom">${echapper(an)}</span>
        <span class="apu__piste"><span style="width:${Math.max(
          0,
          (taux[an] / maxTaux) * 100,
        ).toFixed(1)}%"></span></span>
        <span class="apu__valeur">${taux[an] < 0 ? "−" : ""}${UNE_DECIMALE.format(
          Math.abs(taux[an]),
        )}&nbsp;%</span>
      </div>`,
    )
    .join("");

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
    <div class="tenable__duo">
      <div>
        <h4>La dette, année par année</h4>
        ${rangsDette}
        <p class="bloc__complement">Milliards d'euros, fin d'année ; la dernière ligne est le
          dernier trimestre publié.${parHabitant}${
            sousSecteurs ? ` Qui la porte : ${sousSecteurs}.` : ""
          } Source : INSEE, dette au sens de Maastricht.</p>
      </div>
      <div>
        <h4>Le coût d'un nouvel emprunt à 10 ans</h4>
        ${rangsTaux}
        <p class="bloc__complement">En ${echapper(creux)}, la France ${
          taux[creux] < 0 ? "était payée pour emprunter" : "empruntait au plus bas"
        }. Source : Eurostat, rendement des obligations d'État à 10 ans.</p>
      </div>
    </div>
    ${
      voisins
        ? `<h4>La dette rapportée à la richesse produite en un an</h4>
    ${voisins}
    <p class="bloc__complement">Exercice ${echapper(partFr![0])}, même définition pour
      tous : la dette au sens de Maastricht. Source : Eurostat.</p>`
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
