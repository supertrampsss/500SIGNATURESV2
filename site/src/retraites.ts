/**
 * Les retraites : combien de retraités, quelle pension, à quel âge.
 *
 * Le site publiait ce que la vieillesse **coûte** — la première dépense
 * publique française, 426,7 Md€ de prestations — et rien de ce qu'elle est.
 * « La France dépense trop pour ses retraites » se discutait ici sans qu'aucun
 * des quatre chiffres du débat soit à l'écran.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE BLOC MONTRE, ET CE QU'IL SE GARDE DE CONCLURE
 * ─────────────────────────────────────────────────────────────────────────
 * Quatre mesures, chacune avec son millésime, parce qu'elles ne viennent pas
 * du même tableau : les effectifs, les pensions et l'âge de départ s'arrêtent
 * à l'exercice publié par la DREES, le rapport cotisants/retraités **s'arrête
 * en 2016** chez ce producteur. Une date n'est pas une réserve : c'est la
 * moitié d'un chiffre.
 *
 * **L'écart entre femmes et hommes est montré, jamais expliqué ici.** 1 241 €
 * contre 1 933 € en 2022 est un fait de la série ; ce qui le produit — durées
 * cotisées, salaires, temps partiels — demande d'autres séries que celles-ci,
 * et le bloc ne s'aventure pas à le dire à leur place.
 *
 * **Brut et net ne se confondent pas.** L'écart entre les deux n'est pas un
 * impôt sur le revenu : c'est la CSG, la CRDS et la cotisation maladie, qui
 * financent la protection sociale elle-même.
 *
 * **Le mot « conjoncturel » reste.** L'âge publié n'est pas celui auquel une
 * génération est partie — on ne le sait qu'après coup — mais celui qu'on
 * observerait si les comportements d'une année duraient. Le raccourcir en
 * « âge de départ » ferait dire à la série ce qu'elle ne dit pas.
 */

import type { Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";

const EFFECTIF = "drees_retraites_effectif";
const BRUTE = "drees_pension_moyenne_brute";
const BRUTE_FEMMES = "drees_pension_moyenne_brute_femmes";
const BRUTE_HOMMES = "drees_pension_moyenne_brute_hommes";
const NETTE = "drees_pension_moyenne_nette";
const AGE = "drees_age_depart";
const AGE_FEMMES = "drees_age_depart_femmes";
const AGE_HOMMES = "drees_age_depart_hommes";
const COTISANTS = "drees_cotisants_par_retraite";

/** Ce qu'une génération récupère de ses cotisations, par génération de naissance.
 *
 *  **Ce sont des projections, et le tableau le dit.** Elles sortent du modèle
 *  Destinie 2 de l'INSEE, portent sur les seuls salariés du privé et supposent
 *  la législation de 2014 — la réforme de 2023 n'y est pas. Les poser sans
 *  mention à côté des chiffres constatés de la DREES ferait passer un calcul
 *  pour un relevé, ce que ce site refuse partout ailleurs : elles ont donc leur
 *  propre tableau, leur propre légende et leur propre source. */
const GENERATIONS = ["1950", "1960", "1970", "1985"];
const RECUPERATION = "insee_retraite_taux_recuperation";
const PRELEVEMENT = "insee_retraite_taux_prelevement";

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

/** Une ligne du tableau : sa mesure, son millésime, et rien d'implicite. */
function rangee(
  intitule: string,
  valeur: [string, number] | null,
  unite: string,
  id?: string,
): string {
  if (!valeur) return "";
  return `<tr><th scope="row">${intitule}</th>
    <td>${formater(valeur[1], unite, false, id)}</td>
    <td><span class="millesime">${echapper(valeur[0])}</span></td></tr>`;
}

/**
 * Le bloc, ou la chaîne vide tant que les effectifs et la pension manquent.
 *
 * Ces deux-là font la phrase d'ouverture ; sans elles il resterait un tableau
 * de deux lignes sous un titre qui en promet quatre.
 */
export function rendu(pays: Record<string, Territoire>): string {
  const france = pays["FR"];
  if (!france) return "";
  const serie = (id: string) => derniere(france.series[id]);
  const effectif = serie(EFFECTIF);
  const brute = serie(BRUTE);
  if (!effectif || !brute) return "";

  const nette = serie(NETTE);
  const femmes = serie(BRUTE_FEMMES);
  const hommes = serie(BRUTE_HOMMES);
  const age = serie(AGE);
  const cotisants = serie(COTISANTS);

  // L'écart entre les pensions des femmes et des hommes, calculé plutôt que
  // laissé au lecteur : deux nombres côte à côte ne disent pas leur rapport.
  const ecart =
    femmes && hommes && femmes[0] === hommes[0]
      ? `<p class="bloc__complement">La pension moyenne des femmes est de
          <strong>${formater(femmes[1], "EUR", false, BRUTE_FEMMES)}</strong> par mois,
          celle des hommes de <strong>${formater(hommes[1], "EUR", false, BRUTE_HOMMES)}</strong> :
          <strong>${formater(
            (1 - femmes[1] / hommes[1]) * 100,
            "percent",
            false,
          )}</strong> de moins.</p>`
      : "";

  return `
    <h3>Les retraites</h3>
    <p class="bloc__chiffre">
      <strong>${formater(effectif[1], "count", false)}</strong>
      <span class="millesime">${echapper(effectif[0])}</span>
    </p>
    <p class="bloc__complement">retraités, tous régimes confondus, qui touchent en
      moyenne <strong>${formater(brute[1], "EUR", false, BRUTE)}</strong> brut par
      mois${
        nette && nette[0] === brute[0]
          ? ` — <strong>${formater(nette[1], "EUR", false, NETTE)}</strong> une fois
            la CSG, la CRDS et la cotisation maladie retenues`
          : ""
      }.</p>
    ${ecart}
    <table class="comparaison" tabindex="0">
      <caption>Tous régimes confondus. Les quatre mesures ne sortent pas du même
        tableau : chacune porte son millésime. Source : DREES, à partir de
        l'enquête annuelle auprès des caisses de retraite.</caption>
      <thead><tr><th scope="col">Mesure</th><th scope="col">Valeur</th>
        <th scope="col">Exercice</th></tr></thead>
      <tbody>
        ${rangee("Nombre de retraités", effectif, "count")}
        ${rangee("Pension mensuelle brute moyenne", brute, "EUR", BRUTE)}
        ${rangee("Pension mensuelle nette moyenne", nette, "EUR", NETTE)}
        ${rangee("Âge conjoncturel moyen de départ", age, "annees")}
        ${rangee("dont femmes", serie(AGE_FEMMES), "annees")}
        ${rangee("dont hommes", serie(AGE_HOMMES), "annees")}
        ${rangee("Cotisants par retraité", cotisants, "ratio")}
      </tbody>
    </table>
    ${renduGenerations(france)}
    <p class="avertissement">L'âge est dit « conjoncturel » : il ne donne pas l'âge
      auquel une génération est partie, qui ne se connaît qu'une fois qu'elle est
      partie, mais celui qu'on observerait si les comportements de l'année
      duraient. Le rapport cotisants/retraité commande l'équilibre d'un régime
      par répartition, où les pensions d'aujourd'hui sont payées par les
      cotisations d'aujourd'hui.</p>`;
}

/**
 * Ce qu'une génération récupère pour 100 € cotisés.
 *
 * Le tableau du dessus dit ce que les retraités touchent aujourd'hui ; celui-ci
 * dit ce qu'une génération retire de ce qu'elle a versé, sur toute sa vie.
 * C'est la question que le débat pose, et la seule réponse chiffrée publique
 * est un calcul de modèle : la légende le dit avant les nombres, pas après.
 */
/**
 * Le taux de récupération, reformulé en euros pour 100 € cotisés.
 *
 * Le catalogue le publie en pourcentage — 158,57 % — parce que c'est ainsi que
 * l'INSEE le calcule. La question, elle, se pose en euros : « pour 100 €
 * cotisés, combien je récupère ». La conversion est l'identité, et le
 * dénominateur est dans l'intitulé de la colonne.
 *
 * **Deux décimales, comme la source.** C'est une colonne qu'on lit de haut en
 * bas, et 158,57 € contre 117,28 € se joue aux centimes autant qu'aux euros.
 */
function pour100(taux: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(taux)} €`;
}

function renduGenerations(france: Territoire): string {
  const recuperation = france.series[RECUPERATION];
  const prelevement = france.series[PRELEVEMENT];
  if (!recuperation || !prelevement) return "";
  const lignes = GENERATIONS.filter(
    (generation) => recuperation[generation] !== undefined,
  );
  // Deux générations ne font pas une évolution : sous ce seuil, le tableau
  // montrerait un écart sans la pente qui lui donne son sens.
  if (lignes.length < 3) return "";
  return `
    <h4>Pour 100 € cotisés, ce qu'une génération récupère</h4>
    <table class="comparaison" tabindex="0">
      <caption><strong>Projection</strong>, et non relevé : calcul par microsimulation
        (modèle Destinie 2 de l'INSEE), pour les <strong>salariés du secteur privé</strong>
        vivants à 60 ans, sous la <strong>législation de 2014</strong> — la réforme de 2023
        n'y est pas. Source : INSEE, document de travail G2015/06, Dubois et Marino.</caption>
      <thead><tr><th scope="col">Génération née en</th>
        <th scope="col">Récupéré pour 100 € cotisés</th>
        <th scope="col">Part du salaire cotisée</th></tr></thead>
      <tbody>${lignes
        .map(
          (generation) => `<tr>
            <th scope="row">${echapper(generation)}</th>
            <td>${pour100(recuperation[generation])}</td>
            <td>${formater(prelevement[generation], "percent", false)}</td>
          </tr>`,
        )
        .join("")}</tbody>
    </table>`;
}

/** L'enveloppe DOM. `false` quand rien n'est peint : le sommaire de la page se
 *  construit sur ce qui s'est réellement affiché. */
export function afficherRetraites(
  cadre: HTMLElement,
  pays: Record<string, Territoire>,
): boolean {
  const html = rendu(pays);
  if (html) cadre.innerHTML = html;
  return html !== "";
}
