/**
 * Fiche territoire. Règle du produit (docs/04) : un chiffre ne s'affiche jamais
 * seul. Il porte son unité, son millésime, son dénominateur quand c'est un
 * ratio, et il est accompagné de sa source, de sa méthode et de ses limites.
 */

import { rendreReperes, reperes as reperesDOuverture } from "./reperes.ts";
import { blocs, rendreBlocs } from "./blocs.ts";
import { exercices, rendreExercices } from "./exercices.ts";
import type { Indicateur, Territoire } from "./donnees.ts";

/** L'intitulé de chaque maille. Exporté pour que le partage d'une fiche
 *  nomme la maille avec le mot que la fiche affiche, et pas un autre. */
export const NIVEAUX: Record<string, string> = {
  commune: "Commune",
  // Paris, Lyon et Marseille n'existent que par arrondissement dans certaines
  // sources — la carte des loyers de l'ANIL, par exemple, dont les codes 75056,
  // 69123 et 13055 sont absents. Sans intitulé, leur fiche s'ouvrait sur le nom
  // technique de la maille.
  arrondissement_municipal: "Arrondissement municipal",
  departement: "Département",
  region: "Région",
  pays: "Niveau national",
};

/**
 * Échappement pur, sans DOM.
 *
 * La version précédente passait par `document.createElement`, ce qui avait deux
 * conséquences. Elle rendait ce module intestable hors navigateur — les
 * fonctions de rendu de ce fichier sont pourtant des fonctions pures, et c'est
 * ainsi que le reste du site les teste. Et `textContent` vers `innerHTML`
 * n'échappe pas les guillemets, alors qu'`echapper` est interpolé ici dans un
 * attribut `title="…"` : le motif est faux même si les valeurs qui y passent
 * aujourd'hui sont des millésimes. `questions.ts` et `conjoncture.ts`
 * échappaient déjà ainsi.
 */
function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Les rubriques : quatre entrées pour vingt-six thèmes.
 *
 * Vingt-six onglets sur une seule ligne, c'est une barre qu'il faut faire
 * défiler pour savoir ce qu'elle contient : le lecteur ne voit jamais l'offre
 * entière, donc il ne cherche que ce qu'il apercevait déjà. Deux niveaux la
 * rendent lisible d'un coup d'œil — quatre entrées tiennent sans défilement, et
 * chacune ouvre au plus neuf thèmes.
 *
 * Le découpage suit la question posée, pas la source. Les revenus des ménages
 * sont rangés avec les habitants et non avec l'argent public : « combien
 * gagne-t-on ici » n'est pas « où va l'impôt », et les confondre ferait lire
 * un salaire comme une dépense publique. L'ordre à l'intérieur d'une rubrique
 * reste celui de ce qu'on vient chercher, l'argent en premier.
 *
 * Un thème absent de cette table n'est pas écarté : il se range dans la
 * dernière rubrique. C'est la même règle que pour les libellés — une liste
 * écrite en dur avait déjà fait disparaître des données publiées.
 */
const RUBRIQUES: { cle: string; libelle: string; themes: string[] }[] = [
  {
    cle: "argent",
    libelle: "Argent public",
    themes: [
      "finances_locales",
      "impots_locaux",
      "budget_etat",
      "depenses_fiscales",
      "dette",
      "fonctions",
      "securite_sociale",
      // Les subventions de l'État aux associations sont de l'argent public qui
      // sort, pas un trait du cadre de vie : c'est à ce titre qu'elles se
      // rangent ici. La règle de repli les avait mises dans la dernière
      // rubrique, ce qui était un défaut de table et non une décision.
      "vie_associative",
      "macro",
      "europe",
    ],
  },
  {
    cle: "habitants",
    libelle: "Habitants",
    themes: ["population", "revenus", "famille", "diplomes", "elections"],
  },
  {
    cle: "travail",
    libelle: "Travail",
    themes: [
      "emploi",
      "professions",
      "entreprises",
      "secteurs_salaries",
      "secteurs_etablissements",
    ],
  },
  {
    cle: "cadre",
    libelle: "Cadre de vie",
    themes: [
      "logement", "sante", "education", "securite", "justice", "energie",
      "transports", "environnement", "equipements", "tourisme",
    ],
  },
];

/** La rubrique d'un thème. Un thème inconnu tombe dans la dernière, il ne
 *  disparaît pas. */
export function rubriqueDuTheme(theme: string): string {
  const trouvee = RUBRIQUES.find((r) => r.themes.includes(theme));
  return (trouvee ?? RUBRIQUES[RUBRIQUES.length - 1]).cle;
}

/**
 * L'ordre des thèmes dans la fiche.
 *
 * L'ordre alphabétique faisait ouvrir un site sur l'argent public par
 * « Éducation », et reléguait les finances locales au quatrième écran. Celui-ci
 * découle des rubriques, pour qu'il n'y ait qu'une seule table à tenir à jour :
 * deux listes séparées se seraient contredites au premier thème ajouté. Un
 * thème absent se range à la fin, par ordre alphabétique.
 */
export const ORDRE_THEMES = RUBRIQUES.flatMap((r) => r.themes);

/** Ce qu'un comparateur désigne : une maille, et le code du territoire qui la
 *  porte pour cette fiche. `parent` publié est le département d'une commune,
 *  `region` sa région (voir la requête de `publish.territoires`).
 *
 *  Les libellés sont écrits par l'appelant. Un libellé qu'on ne sait pas
 *  résoudre, ou un code absent, ne produit pas de bouton : le nom reste écrit
 *  en clair, comme avant. Mieux vaut un texte que le mauvais lien. */
function mailleDuComparateur(
  libelle: string,
  territoire: Territoire,
  niveau: string,
): { code: string; niveau: string } | null {
  if (libelle === "la France") return { code: "FR", niveau: "pays" };
  if (libelle === "sa région") {
    return territoire.region ? { code: territoire.region, niveau: "region" } : null;
  }
  if (libelle === "son département") {
    return niveau === "commune" && territoire.parent
      ? { code: territoire.parent, niveau: "departement" }
      : null;
  }
  return null;
}

/** Le nom d'un territoire parent, en bouton quand on sait où il mène.
 *
 *  Le contrat avec `main.ts` tient dans les deux attributs : `data-code` et
 *  `data-niveau` sur `.fiche__parent`, quel que soit l'endroit de la fiche où
 *  le bouton se trouve. C'est un seul gestionnaire, par délégation. */
function boutonParent(
  parent: { libelle: string; territoire: Territoire },
  maille: { code: string; niveau: string } | null,
): string {
  const nom = echapper(parent.territoire.nom);
  return maille
    ? `<button type="button" class="fiche__parent" data-code="${echapper(
        maille.code,
      )}" data-niveau="${echapper(maille.niveau)}">${nom}</button>`
    : nom;
}

/* ------------------------------------------------------------------------ *
 * L'ouverture de la fiche : le récit, le verdict, et le corps par questions.
 *
 * Le panneau publiait cent quatre-vingt-dix-huit indicateurs au même niveau
 * visuel, rangés sous les intitulés du plan comptable. Ce qui suit ne retire
 * rien : la fiche d'avant est intacte derrière « Tout voir ». Ce qui change,
 * c'est ce qu'on voit en premier — une phrase qui dit le bilan, trois à cinq
 * chiffres qui la soutiennent, puis des questions en français.
 * ------------------------------------------------------------------------ */

/** Chaque maille sur son propre calendrier : `calendrierDe` rend celui de
 *  l'assemblée qui vote ce budget-là, et `null` pour le pays, dont le budget
 *  est voté chaque année par un Parlement au calendrier propre. */

/* La ligne de mandat est partie.

   « Le mandat ouvert en juin 2021 n'a pas encore de comptes publiés » posait
   une date d'élection au-dessus d'une fiche dont la fenêtre est comptable :
   2019 et le dernier exercice publié. C'est exactement ce que la règle du
   dépôt interdit — la fenêtre se lit sur les exercices publiés, jamais sur un
   calendrier électoral, et aucune ligne ne dit de fenêtre de mandat. Les
   millésimes des phrases suffisent. */


/**
 * La fiche d'un territoire : quatre repères, quatre blocs, et rien d'autre.
 *
 * Elle alignait aussi cent quinze lignes de mesures rangées par thème, les
 * mêmes rangées sous sept questions, deux barres d'onglets pour les parcourir,
 * une synthèse, six rapports, trois faits, le pont et la feuille d'impôts.
 * Tout cela redisait, sous dix habillages, ce que les repères et les blocs
 * disent en dix lignes — et l'exhaustivité est le métier de la page ANALYSES,
 * où chaque exercice publié a sa colonne.
 *
 * La fiche s'arrête donc au dernier bloc, « Ce que ça a payé ».
 */
export function afficherFiche(
  cible: HTMLElement,
  options: {
    niveau: string;
    territoire: Territoire;
    /** Le catalogue de la maille, pour décomposer les mouvements des blocs :
     *  une composante absente d'ici fait échouer le contrôle de somme, et rien
     *  ne s'affiche plutôt qu'une attribution amputée. */
    indicateurs: Indicateur[];
    /** Territoires de comparaison. Seul le premier sert : il situe la commune
     *  dans son département, et c'est un bouton pour y monter. */
    comparateurs?: { libelle: string; territoire: Territoire }[];
  },
): void {
  const { territoire, niveau } = options;
  const comparateurs = options.comparateurs ?? [];
  // Situer le territoire plutôt que l'identifier. Le code INSEE figurait ici
  // pour départager les homonymes — il y a trois Sainte-Marie et douze
  // Saint-Martin — mais « 69123 » ne dit cela à personne : il fallait déjà
  // connaître la réponse pour la lire. La maille du dessus la donne en clair.
  // C'est le premier comparateur : département pour une commune, région pour
  // un département. Au-dessus, c'est la France, qui ne situe rien.
  //
  // Et cliquable : « Gironde » écrit en gris obligeait à retaper le nom du
  // département dans la recherche pour y monter. C'est un bouton, avec le code
  // et la maille de la cible ; le gestionnaire vit dans main.ts, par délégation.
  const dessus = comparateurs[0];
  const situe =
    dessus && dessus.libelle !== "la France"
      ? ` · ${boutonParent(dessus, mailleDuComparateur(dessus.libelle, territoire, niveau))}`
      : "";

  /* ---- L'ouverture : les repères, les blocs, les faits, les questions.
     Tout ce qui suit est calculé après les sections de thèmes, parce que les
     faits ont besoin de savoir quelles lignes existent : une phrase ne renvoie
     jamais vers une section vide. ---- */
  // Les quatre blocs qui suivent les repères : où va l'argent, qui paie, ce
  // qu'il reste, ce que ça a payé. Ils remplacent le récit et le paragraphe qui
  // l'accompagnait — les deux disaient les chiffres des repères une seconde
  // fois, en prose.
  const blocsDeLecture = blocs({
    niveau,
    nom: territoire.nom,
    series: territoire.series ?? {},
    catalogue: options.indicateurs,
  });
  // Les quatre repères ouvrent la fiche, puis les quatre blocs la lisent.
  //
  // Ce sont les repères qu'on vient chercher, et ils étaient noyés au milieu de
  // cent quinze lignes qui se ressemblaient toutes. Ils sont choisis par rôle,
  // pas par thème : ce qui entre, ce qui sort, ce qui reste, ce qui est dû. Les
  // blocs partent de là et disent ce qu'un nombre posé ne dit pas : d'où vient
  // le mouvement.
  const ouvertureChiffree = rendreReperes(reperesDOuverture(territoire.series ?? {}, niveau));
  cible.innerHTML = `
    <h2 class="fiche__titre">${echapper(territoire.nom)}</h2>
    <p class="fiche__meta">${NIVEAUX[niveau] ?? niveau}${situe}${
      // La population porte sa définition en infobulle et rien d'autre : elle
      // était soulignée en pointillé, c'est-à-dire habillée en lien, alors
      // qu'aucun clic ne mène nulle part. La classe dit au style de ne pas
      // souligner celle-ci (voir `.fiche__habitants`).
      territoire.population
        ? ` · <abbr class="fiche__habitants" title="Population municipale (INSEE). Les montants par habitant utilisent la population de référence de l'Observatoire des finances locales : détail dans Sources et méthode.">${new Intl.NumberFormat(
            "fr-FR",
          ).format(territoire.population)} hab.</abbr>`
        : ""
    }</p>
    ${
      territoire.maire
        ? `<p class="fiche__maire">Maire : <strong>${echapper(territoire.maire.nom)}</strong>${
            territoire.maire.depuis
              ? ` <span>depuis ${echapper(
                  new Date(territoire.maire.depuis).toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  }),
                )}</span>`
              : ""
          }</p>`
        : ""
    }
    ${
      // Sous le dernier bloc : le tableau des exercices, et rien d'autre. Les
      // blocs posent 2019 et le dernier exercice ; ce qui s'est passé entre
      // les deux n'existait nulle part. Les rangs (« Où ça se situe ») se
      // posent après, depuis main.ts : ils demandent la maille entière.
      `<div class="fiche__essentiel">${ouvertureChiffree}${rendreBlocs(blocsDeLecture)}${rendreExercices(
        exercices({
          cites: blocsDeLecture.flatMap((bloc) => bloc.cites),
          series: territoire.series ?? {},
          catalogue: options.indicateurs,
        }),
      )}<div class="fiche__situation" id="fiche-situation"></div></div>
    <div class="fiche__partage" id="fiche-partage"></div>`
    }
  `;
}
