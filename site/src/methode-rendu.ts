/**
 * La grille de verdicts : les règles publiques du système éditorial
 * (docs/analyses-schema.md, docs/superpowers/specs/2026-08-14-arbitre-
 * rejouable-design.md §9.2 et §14), affichées avant les analyses qui les
 * suivent — pour qu'un lecteur puisse tenir le site à ce qu'elle annonce.
 *
 * Texte de référence, pas un calcul : aucune donnée d'entrée, aucun `fetch`.
 * Les crans et les confusions sont importés de `analyse-rendu.ts` plutôt que
 * recopiés ici, pour qu'un désaccord entre la page et le rendu d'analyse — ou
 * le contrôle déterministe qui partage la même taxonomie — soit une erreur de
 * compilation, jamais une divergence silencieuse.
 */

import {
  LIBELLE_CONFUSION,
  LIBELLE_CRAN,
  type Confusion,
  type Cran,
  type Registre,
} from "./analyse-rendu.ts";

/** Ordre d'affichage des crans — celui de `docs/analyses-schema.md` § Crans. */
const ORDRE_CRANS: Cran[] = ["exact", "hors_perimetre", "introuvable"];

/** Ordre d'affichage des confusions — celui de `docs/analyses-schema.md` §
 *  Confusions, repris tel quel dans le brief de la tâche. */
const ORDRE_CONFUSIONS: Confusion[] = [
  "ae_cp",
  "brut_net",
  "vote_execute",
  "stock_flux",
  "etat_apu",
  "annuel_cumule",
  "perimetre_geographique",
];

/** Les six registres que porte le type `Registre` — leur ordre est celui de
 *  la spec §14.2, points 1 à 6. Le septième point de la spec, l'opinion,
 *  n'a pas de valeur dans `Registre` : il n'existe pas sur le site, et la
 *  grille le dit en prose plutôt que d'ajouter une entrée qui n'a rien à
 *  vérifier derrière elle. */
const REGISTRES: { registre: Registre; libelle: string; texte: string }[] = [
  {
    registre: "fait_comptable",
    libelle: "Fait comptable",
    texte: "Une observation publiée par le pipeline. Vérifiée par la machine, de façon bloquante.",
  },
  {
    registre: "donnee_officielle",
    libelle: "Donnée officielle citée",
    texte:
      "Publiée par un producteur officiel mais absente de l'entrepôt : lien vers la source primaire obligatoire, jamais reformulée en fait comptable.",
  },
  {
    registre: "resultat_simulation",
    libelle: "Résultat de simulation",
    texte: "Produite par le moteur du site, accompagnée des réglages qui la reproduisent.",
  },
  {
    registre: "estimation_externe",
    libelle: "Estimation externe",
    texte:
      "Un chiffrage de tiers, attribué et daté, avec ses hypothèses. Le site le confronte à d'autres ; il ne le départage que lorsque les comptes le permettent.",
  },
  {
    registre: "hypothese",
    libelle: "Hypothèse",
    texte: "Ce qu'il faut supposer pour que le calcul tienne.",
  },
  {
    registre: "interpretation",
    libelle: "Interprétation",
    texte:
      "Une lecture ou un rapprochement des registres précédents, toujours dérivable d'eux, jamais elle-même une observation.",
  },
];

/** Rendu pur, sans DOM et sans donnée d'entrée : la grille est du texte de
 *  référence, elle ne dépend d'aucune publication du pipeline. */
export function renduGrille(): string {
  const crans = ORDRE_CRANS.map(
    (cran) => `<dt><code>${cran}</code></dt><dd>« ${LIBELLE_CRAN[cran]} »</dd>`,
  ).join("");

  const confusions = ORDRE_CONFUSIONS.map(
    (confusion) => `<dt><code>${confusion}</code></dt><dd>${LIBELLE_CONFUSION[confusion]}</dd>`,
  ).join("");

  const registres = REGISTRES.map(
    (r) => `<li><strong>${r.libelle}</strong> <code>${r.registre}</code> — ${r.texte}</li>`,
  ).join("");

  return `
    <h3>La grille de verdicts</h3>
    <p class="methode-grille__intro">
      Les règles que chaque analyse suit, écrites avant les analyses elles-mêmes :
      les crans que le site peut rendre, les confusions qu'il peut nommer, les
      registres auxquels un chiffre cité peut appartenir, et le critère qui
      choisit les sujets.
    </p>

    <h4>Le verdict, en trois crans</h4>
    <dl class="methode-grille__crans">${crans}</dl>
    <p>
      Aucun cran ne porte de jugement. « Trompeur », « mensonger », « exagéré »
      qualifient une intention, invérifiable : ils n'existent pas ici. Le site
      compare deux nombres et nomme ce qui les sépare.
    </p>

    <h4>Les sept confusions</h4>
    <p class="methode-grille__aide">
      Un verdict <code>hors_perimetre</code> nomme toujours laquelle de ces sept
      confusions est en cause.
    </p>
    <dl class="methode-grille__confusions">${confusions}</dl>

    <h4>Les sept registres d'énoncé</h4>
    <p class="methode-grille__aide">
      Chaque chiffre cité par une analyse appartient à l'un de ces registres.
    </p>
    <ol class="methode-grille__registres">
      ${registres}
      <li><strong>Opinion</strong> — n'existe pas sur le site. Aucune phrase ne
      qualifie une mesure de bonne ou de mauvaise, souhaitable ou non.</li>
    </ol>

    <h4>Le choix des sujets</h4>
    <p>
      Est analysé un chiffre qui circule largement et qui touche une ligne que
      le site publie. Ni l'auteur du chiffre, ni son orientation n'entrent
      dans le critère. La file des sujets est publique — les issues du dépôt
      — ce qui rend le biais de sélection observable.
    </p>
  `;
}
