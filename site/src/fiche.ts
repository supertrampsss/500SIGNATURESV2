/**
 * Fiche territoire. Règle du produit (docs/04) : un chiffre ne s'affiche jamais
 * seul. Il porte son unité, son millésime, son dénominateur quand c'est un
 * ratio, et il est accompagné de sa source, de sa méthode et de ses limites.
 */

import { ROLES, rendreReperes, reperes as reperesDOuverture } from "./reperes.ts";
import { blocs, rendreBlocs } from "./blocs.ts";
import type { Indicateur, Quartiles, Territoire } from "./donnees.ts";
import { rendu as rendreFeuilleDImpots } from "./feuille-impots.ts";
import { repartir } from "./fiche-questions.ts";
import { fenetreRacontee } from "./mandat.ts";
import { rendu as rendrePont } from "./pont.ts";
import { verdict, type Contexte, type Phrase, type Repere } from "./verdict.ts";

const NIVEAUX: Record<string, string> = {
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

/** Le nom commun de la maille, tel qu'une phrase le décline : « ses 17 régions
 *  semblables ». Une maille absente d'ici laisse `verdict.ts` sur son défaut. */
const MAILLE_DITE: Record<string, string> = {
  commune: "commune",
  arrondissement_municipal: "arrondissement",
  departement: "département",
  region: "région",
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

/** Les quatre questions dont les indicateurs sont des comptes. Ce sont leurs
 *  millésimes, et eux seuls, qui bornent un mandat : un recensement publié tous
 *  les cinq ans ne dit rien de ce qu'une équipe a dépensé. */
const QUESTIONS_D_ARGENT = new Set(["depenses", "recettes", "impots", "dette"]);

/**
 * Les exercices que les comptes atteignent vraiment.
 *
 * Deux façons de se tromper de fenêtre, et la fiche France les cumulait :
 *
 * 1. **Mélanger les granularités.** La dette publique est publiée par
 *    trimestre. « 2026-Q1 » se range après « 2026 » dans un tri de chaînes, et
 *    la fenêtre d'un bilan budgétaire finissait sur un trimestre. Un trimestre
 *    n'est pas un exercice : il ne borne rien.
 * 2. **Finir sur un exercice que presque rien ne porte.** Au niveau France, dix
 *    séries sur cent quatre-vingt-dix vont jusqu'à 2026 — ce sont les dépenses
 *    fiscales, prévues au PLF, pas des comptes exécutés. La fenêtre finissait
 *    donc en 2026, où toutes les autres séries sont muettes : chaque règle du
 *    verdict lisait `null` à l'arrivée et renonçait. La fiche nationale
 *    n'affichait pas une phrase, faute d'une année où lire ses chiffres.
 *
 * Le seuil de couverture n'est pas délicat, et c'est ce qui le rend tenable :
 * mesuré sur la France, 2026 est porté par 6 % des séries et 2025 par 85 % de
 * ce que porte le mieux couvert. Aucun seuil entre les deux ne change la
 * réponse. Là où toutes les séries couvrent les mêmes exercices — l'OFGL d'une
 * commune — la règle ne retire rien.
 */
const COUVERTURE_MINIMALE = 0.5;

function exercicesQueLesComptesAtteignent(
  indicateurs: Indicateur[],
  territoire: Territoire,
): string[] {
  const couverture = new Map<string, number>();
  for (const indicateur of indicateurs) {
    for (const exercice of Object.keys(territoire.series?.[indicateur.id] ?? {})) {
      if (!/^\d{4}$/.test(exercice)) continue;
      couverture.set(exercice, (couverture.get(exercice) ?? 0) + 1);
    }
  }
  if (!couverture.size) return [];
  const meilleure = Math.max(...couverture.values());
  const exercices = [...couverture.keys()].sort();
  // L'arrivée est le dernier exercice réellement couvert ; tout ce qui vient
  // après est une prévision isolée, et tout ce qui vient avant reste dans la
  // fenêtre — un exercice ancien moins bien couvert qu'un autre n'en fait pas
  // moins partie de l'historique.
  const arrivee = exercices.filter(
    (ex) => (couverture.get(ex) ?? 0) >= meilleure * COUVERTURE_MINIMALE,
  ).pop();
  return arrivee === undefined ? [] : exercices.filter((ex) => ex <= arrivee);
}

/**
 * Combien de faits la fiche affiche sous les blocs : trois au plus.
 *
 * `verdict.ts` en propose six par défaut, deux par sujet, et sa raison est
 * écrite — trois questions valent mieux qu'une posée trois fois. Les quatre
 * repères et les quatre blocs ont déjà répondu aux trois ; ce qui reste ici est
 * ce qu'aucun des deux n'a dit, et trois lignes suffisent à le porter.
 *
 * On en demande donc onze au module, dont sortiront tous les indicateurs déjà
 * dits plus haut : voir `phrasesQuiCompletent`.
 */
const PHRASES_DE_VERDICT = 3;

/**
 * Les faits disent ce que les repères et les blocs n'ont pas dit.
 *
 * Tous lisent les mêmes séries, classées pareil : sans filtre, la première
 * puce répétait « l'encours passe de 2 112 M€ à 3 502 M€, soit +65,8 % » sous
 * un repère qui venait d'écrire « Ce qu'elle doit 3 502 · +65,8 % ». La fiche
 * s'ouvrait sur un doublon là où on lui reproche déjà d'en avoir trop.
 *
 * Le filtre porte sur `vers`, l'indicateur : deux phrases du même indicateur
 * disent le même fait, quelle que soit la formulation.
 */
export function phrasesQuiCompletent(phrases: Phrase[], deja: string[]): Phrase[] {
  const dites = new Set(deja);
  return phrases.filter((p) => !dites.has(p.vers)).slice(0, PHRASES_DE_VERDICT);
}

/** La série de population qui sert de dénominateur au site : celle de l'OFGL,
 *  publiée chaque exercice. Le recensement, lui, ne l'est que tous les cinq
 *  ans — il ne peut pas mesurer une variation sur une fenêtre de mandat. */
const POPULATION_DU_MANDAT = "ofgl_population_reference";

/**
 * L'inflation cumulée entre deux exercices, en pourcentage.
 *
 * `insee_inflation_ipc` publie, mois par mois, le glissement sur douze mois de
 * l'indice des prix. La moyenne des douze mois d'une année est la hausse
 * moyenne des prix de cette année-là sur la précédente : c'est la définition de
 * l'inflation annuelle publiée par l'INSEE, et c'est elle qui se compose. On
 * multiplie donc les années **postérieures** à l'exercice de référence —
 * l'inflation de 2019 s'est produite avant lui et n'appartient pas à la
 * fenêtre. De 2019 à 2025, cela vaut +16,1 %.
 *
 * Une seule année manquante rend `null` : un cumul amputé d'un exercice se
 * lirait comme un cumul complet et sous-estimerait la hausse. Une donnée
 * absente n'écrit rien.
 */
export function inflationCumulee(
  ipc: Record<string, number> | undefined,
  reference: string,
  fin: string,
): number | null {
  if (!ipc) return null;
  const debut = Number(reference);
  const terme = Number(fin);
  if (!Number.isFinite(debut) || !Number.isFinite(terme) || terme <= debut) return null;
  let facteur = 1;
  for (let annee = debut + 1; annee <= terme; annee += 1) {
    const mois = Object.entries(ipc)
      .filter(([cle]) => cle.startsWith(`${annee}-`))
      .map(([, valeur]) => valeur)
      .filter((v) => Number.isFinite(v));
    if (mois.length < 12) return null;
    facteur *= 1 + mois.reduce((somme, v) => somme + v, 0) / mois.length / 100;
  }
  return (facteur - 1) * 100;
}

/** La variation de population sur la fenêtre, en pourcentage. Sans les deux
 *  bornes, rien : une hausse de dépenses ne se corrige pas d'une démographie
 *  qu'on ne connaît qu'à moitié. */
function variationPopulation(
  territoire: Territoire,
  reference: string,
  fin: string,
): number | null {
  const serie = territoire.series?.[POPULATION_DU_MANDAT];
  const depart = serie?.[reference];
  const arrivee = serie?.[fin];
  if (!depart || !arrivee || depart <= 0) return null;
  return ((arrivee - depart) / depart) * 100;
}

/**
 * Le verdict : trois phrases chiffrées au plus, chacune vers son détail.
 *
 * Une phrase dont l'indicateur cité n'a pas de ligne dans cette fiche n'est pas
 * cliquable : rien de cliquable ne mène à une section vide. Elle reste écrite —
 * le fait est vrai — mais elle ne promet pas un détail qui n'existe pas.
 */
function rendreVerdict(phrases: Phrase[], aUneLigne: (id: string) => boolean): string {
  if (!phrases.length) return "";
  const lignes = phrases
    .map((phrase) => {
      const texte = echapper(phrase.texte);
      const corps = aUneLigne(phrase.vers)
        ? `<button type="button" class="verdict__vers" data-verdict-vers="${echapper(
            phrase.vers,
          )}">${texte}</button>`
        : `<span class="verdict__texte">${texte}</span>`;
      return `<li class="verdict__phrase verdict__phrase--${echapper(phrase.sens)}">${corps}</li>`;
    })
    .join("");
  return `<ul class="verdict">${lignes}</ul>`;
}

/* La ligne de mandat est partie.

   « Le mandat ouvert en juin 2021 n'a pas encore de comptes publiés » posait
   une date d'élection au-dessus d'une fiche dont la fenêtre est comptable :
   2019 et le dernier exercice publié. C'est exactement ce que la règle du
   dépôt interdit — la fenêtre se lit sur les exercices publiés, jamais sur un
   calendrier électoral, et aucune ligne ne dit de fenêtre de mandat. Les
   millésimes des phrases suffisent. */


/**
 * La fiche d'un territoire : quatre repères, quatre blocs, trois faits.
 *
 * Elle alignait aussi cent quinze lignes de mesures rangées par thème, les
 * mêmes rangées par question, deux barres d'onglets pour les parcourir, une
 * synthèse et six rapports. Tout cela redisait, sous six habillages, ce que les
 * repères et les blocs disent en dix lignes — et l'exhaustivité est le métier
 * de la page ANALYSES, où chaque exercice publié a sa colonne.
 *
 * Ce qui reste sous les faits : le pont, qui suit un euro encaissé jusqu'à ce
 * qu'il en reste, et la feuille d'impôts, qui répond à une autre question.
 */
export function afficherFiche(
  cible: HTMLElement,
  options: {
    niveau: string;
    territoire: Territoire;
    indicateurs: Indicateur[];
    /** Territoires de comparaison. Seul le premier sert encore : il situe la
     *  commune dans son département, et c'est un bouton pour y monter. */
    comparateurs?: { libelle: string; territoire: Territoire }[];
    /** Où se tient la commune parmi ses semblables, indicateur par indicateur
     *  et exercice par exercice — la cascade de `comparaisons.json`. C'est ce
     *  qui décide quels faits sortent du lot. Absent au département et à la
     *  région, qui n'ont pas de strate publiée. */
    semblables?: (indicateur: string, exercice: string) => Repere | null;
    /** L'IPC national mensuel (`insee_inflation_ipc`), d'où se tire l'inflation
     *  cumulée sur la fenêtre. Ce module est pur : il ne va pas la chercher, on
     *  la lui donne. Absent, les faits se passent du repère des prix plutôt que
     *  d'en inventer un. */
    serieInflation?: Record<string, number>;
  },
): void {
  const { territoire, indicateurs, niveau } = options;
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
  // Les exercices qui bornent la fenêtre sont ceux des comptes, pas ceux du
  // recensement : la fenêtre d'un bilan financier se lit sur des exercices
  // budgétaires. Ce sont exactement les indicateurs que les quatre questions
  // d'argent rassemblent.
  const exercicesDesComptes = exercicesQueLesComptesAtteignent(
    repartir(indicateurs)
      .filter(({ question }) => QUESTIONS_D_ARGENT.has(question.cle))
      .flatMap(({ indicateurs: liste }) => liste),
    territoire,
  );
  // Une maille qui n'élit pas d'assemblée n'a pas de mandat — mais elle a des
  // exercices. Le pays était la seule fiche du site sans récit et sans ses deux
  // vitesses, pour une raison qui n'en justifiait qu'une : plaquer une
  // législature sur un budget serait faux, ne rien raconter ne l'est pas moins.
  // La fenêtre est alors comptable, et les phrases disent « depuis 2019 ».
  // **La même fenêtre à toutes les mailles : 2019 et 2025.**
  //
  // La fenêtre suivait le calendrier électoral de la maille : mandat municipal
  // ouvert en 2020 pour une commune, donc référence 2019 ; mandat départemental
  // ouvert en 2021 pour un département, donc référence 2020. Deux fiches
  // voisines racontaient alors deux périodes différentes, et la Gironde
  // s'ouvrait sur « contre 1 763 M€ en 2020 » quand Bordeaux disait 2019 : deux
  // territoires qu'on vient précisément comparer.
  //
  // C'est la règle du dépôt, et elle est écrite : la fenêtre est dans les
  // millésimes des phrases, 2019 et 2025. Elle se lit donc sur les exercices
  // publiés, jamais sur une date d'élection. Le calendrier ne sert plus qu'à
  // dire, en une ligne, qu'un mandat fraîchement ouvert n'a pas encore de
  // comptes.
  const raconte = !exercicesDesComptes.length
    ? null
    : fenetreRacontee(exercicesDesComptes);
  const contexte: Contexte | null = raconte
    ? {
        mandat: raconte,
        series: territoire.series ?? {},
        inflation: inflationCumulee(
          options.serieInflation,
          raconte.exerciceReference,
          raconte.exerciceFin,
        ),
        population: variationPopulation(
          territoire,
          raconte.exerciceReference,
          raconte.exerciceFin,
        ),
        nom: territoire.nom,
        avecPreposition: niveau === "commune" || niveau === "arrondissement_municipal",
        semblables: options.semblables,
        // La fenêtre se nomme par son millésime, jamais par un mandat : elle ne
        // suit plus aucune élection, et « sur le mandat » désignerait une
        // période que les chiffres ne couvrent pas.
        fenetre: `depuis ${raconte.exerciceReference}`,
        // Le nom commun de la maille : la fiche de Nouvelle-Aquitaine écrivait
        // « ses 17 communes semblables » et « la commune est dans le quart le
        // plus bas », le mot étant en dur dans `verdict.ts`.
        maille: MAILLE_DITE[niveau],
        // De quoi attribuer la variation d'un agrégat à ses composantes. La
        // liste est celle des indicateurs de la maille : une composante qui n'y
        // est pas fait échouer le contrôle de somme, donc rien ne s'affiche
        // plutôt qu'une attribution amputée.
        catalogue: options.indicateurs,
      }
    : null;
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
  const dejaDit = [
    ...(ROLES[niveau] ?? []).map((role) => role.id),
    ...blocsDeLecture.flatMap((bloc) => bloc.cites),
  ];
  const phrases = contexte
    ? phrasesQuiCompletent(verdict(contexte, PHRASES_DE_VERDICT + 8), dejaDit)
    : [];
  // Plus rien de cliquable dans la fiche : les lignes de mesures n'y sont plus,
  // et un renvoi ne mène jamais vers une section qui n'existe pas. Les faits
  // restent écrits, ils ne promettent simplement plus un détail absent.
  const aUneLigne = () => false;
  // La feuille d'impôts descend en bas de fiche.
  //
  // Elle occupait la troisième place de l'ouverture, entre le bilan et les
  // questions, alors qu'elle ne répond à aucune des quatre : c'est une
  // estimation de ce qu'un foyer paie, pas un compte de la collectivité. Elle
  // repoussait vers le bas ce que le lecteur vient chercher.
  const feuille = rendreFeuilleDImpots(territoire);
  // Les quatre repères ouvrent la fiche, puis les quatre blocs la lisent.
  //
  // Ce sont les repères qu'on vient chercher, et ils étaient noyés au milieu de
  // cent quinze lignes qui se ressemblaient toutes. Ils sont choisis par rôle,
  // pas par thème : ce qui entre, ce qui sort, ce qui reste, ce qui est dû. Les
  // blocs partent de là et disent ce qu'un nombre posé ne dit pas : d'où vient
  // le mouvement.
  const ouvertureChiffree = rendreReperes(reperesDOuverture(territoire.series ?? {}, niveau));
  const essentiel = `${ouvertureChiffree}${rendreBlocs(blocsDeLecture)}${rendreVerdict(phrases, aUneLigne)}`;
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
      // Ce que le lecteur voit d'abord : une phrase qui dit le bilan, les
      // chiffres qui la soutiennent, ce qu'il paie, puis les questions.
      `<div class="fiche__essentiel">${essentiel}</div>`
    }
    ${
      // L'enchaînement : les repères disent les masses, le pont dit où l'argent
      // passe, d'un euro encaissé à ce qu'il en reste.
      `<div class="fiche__tout">${rendrePont(territoire, indicateurs)}</div>`
    }
    ${feuille ? `<section class="feuille-impots">${feuille}</section>` : ""}
  `;
}

/**
 * La valeur d'une commune, ramenée à la base sur laquelle les quartiles de son
 * groupe ont été calculés.
 *
 * Le dénominateur est **la population de référence de l'OFGL de l'exercice**,
 * jamais la population municipale du recensement. Ce sont deux nombres
 * différents pour la même commune la même année — définitions et millésimes
 * distincts — et la publication calcule les quartiles avec le premier. Le site
 * plaçait la commune avec le second : deux grandeurs sur un seul axe.
 *
 * L'écart n'est pas théorique. Sur les 534 communes de la Gironde en 2025, 43
 * — une sur douze — changeaient de quartile selon le dénominateur retenu. La
 * Brède passait du deuxième au troisième : 888 € par habitant contre 1 000 €.
 * Sur Bordeaux l'écart était de quatre euros, assez petit pour n'avoir jamais
 * alerté.
 *
 * -> undefined quand la commune n'a pas de population de référence pour cet
 * exercice : la publication l'écarte alors du calcul des quartiles, et la
 * placer quand même serait la comparer à un groupe dont elle ne fait pas
 * partie.
 */
export function valeurComparable(
  territoire: Territoire,
  indicateur: string,
  periode: string,
  base: { base: "par_habitant" | "pour_mille" | "valeur" } | undefined,
): number | undefined {
  const brut = territoire.series[indicateur]?.[periode];
  if (brut === undefined) return undefined;
  if (base?.base === "valeur") return brut;
  const habitants = territoire.series["ofgl_population_reference"]?.[periode];
  if (!habitants) return undefined;
  return (brut / habitants) * (base?.base === "pour_mille" ? 1000 : 1);
}

/**
 * Le groupe le plus fin qui existe pour cette commune, et les critères qui le
 * définissent.
 *
 * La publication calcule plusieurs découpages du même ensemble : cinq critères,
 * puis trois, puis deux. Un découpage fin compare mieux — une station de
 * montagne face à des stations de montagne — mais laisse sans groupe les
 * communes trop singulières, dont la strate tombe sous le seuil de vingt. Les
 * essayer dans l'ordre donne à chacune le meilleur repère qu'elle puisse avoir,
 * plutôt que le même repère grossier pour toutes ou aucun repère pour les
 * atypiques.
 *
 * Les critères retenus sont renvoyés avec les quartiles : ils ne sont pas les
 * mêmes d'une commune à l'autre, et l'affichage doit dire lesquels ont servi.
 */
export function groupeDeLaCommune(
  territoire: Territoire,
  parIndicateur: Record<string, Quartiles> | undefined,
  cascade: string[][],
): { quartiles: Quartiles; criteres: string[] } | undefined {
  if (!parIndicateur) return undefined;
  const drapeaux = (territoire.drapeaux ?? {}) as Record<string, string>;
  for (const [rang, criteres] of cascade.entries()) {
    const cle = `${rang}:${criteres.map((c) => drapeaux[c] ?? "").join("|")}`;
    const quartiles = parIndicateur[cle];
    if (quartiles) return { quartiles, criteres };
  }
  return undefined;
}
