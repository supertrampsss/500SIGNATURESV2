/**
 * Le SVG d'une carte de partage — 1200 × 630, lisible hors contexte.
 *
 * Une carte sort du site. Elle circule sans la page qui l'explique, dans un
 * fil de discussion, à côté d'un lien que personne n'ouvrira. Tout ce qui
 * permet de lire le chiffre doit donc être peint dessus : ce qu'il vaut, dans
 * quelle unité, d'où il vient et de quel millésime.
 *
 * Comme `analyse-rendu.ts` et `scenarios-rendu.ts`, chaque fonction est pure :
 * elle reçoit des données déjà résolues et rend une chaîne. Aucune lecture de
 * fichier, aucun `document`, aucun accès réseau — c'est la même chaîne qui est
 * peinte au build par le rasteriseur et qui est testée.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN SVG N'A PAS DE MISE EN PAGE
 * ─────────────────────────────────────────────────────────────────────────
 * Rien ne replie un titre, rien ne rougit quand il sort du cadre : le texte
 * est peint là où on le pose, et l'image part quand même, illisible. C'est le
 * défaut le plus probable de ce module, et la raison d'être de `replier()` et
 * d'`ordonnees()` : toute chaîne posée ici passe par un modèle de largeur, et
 * toute rangée par une bande verticale bornée.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE N'ÉCRIT JAMAIS
 * ─────────────────────────────────────────────────────────────────────────
 * Aucun montant n'est calculé ici : chaque nombre peint vient d'un champ reçu.
 * Deux budgets ne s'additionnent pas, et une carte n'écrit donc jamais un
 * total de dépense publique. La carte de comparaison montre deux colonnes et
 * leurs écarts — jamais leur somme, jamais un gagnant, une note, un classement
 * ni une marque de tête.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ADRESSE DU SITE ET LA SOURCE SONT REÇUES, JAMAIS DEVINÉES
 * ─────────────────────────────────────────────────────────────────────────
 * Aucun domaine n'est écrit en dur ici : le dépôt n'en publie pas, et une URL
 * inventée sur une image qui circule serait un faux. L'appelant — le pré-rendu,
 * qui connaît l'adresse de publication — la passe. Même règle pour la source
 * et son millésime : ils sont exigés par leur VALEUR, pas seulement par le
 * type — une chaîne vide passe un type et laisse partir une image qui affirme
 * « Source : · millésime ».
 */

import { LIBELLE_CRAN, type Cran } from "./analyse-rendu.ts";
import { MENTION_MILLIONS, PALETTE, formater } from "./echelle.ts";
import { formaterVariation, modeVariation } from "./evolution-carte.ts";
import { eurosSigne } from "./simulateur-rendu.ts";
import { echapper } from "./texte.ts";

/** Le format des cartes de lien des plateformes. Jamais un autre : une image
 *  d'un autre rapport est rognée par elles, en général sur le titre. */
export const LARGEUR = 1200;
export const HAUTEUR = 630;

/**
 * La police du dessin, générique et volontairement.
 *
 * Aucune police distante (règlement européen sur les données) et aucun nom de
 * fonte propriétaire : le rasteriseur du build branche la fonte embarquée du
 * dépôt sur la famille par défaut. Un nom de famille exotique écrit ici
 * sortirait le texte invisible sans que rien ne rougisse.
 */
export const POLICE = "sans-serif";

const MARGE = 72;
const LARGEUR_UTILE = LARGEUR - 2 * MARGE;
/** L'espace minimal entre le libellé d'une rangée et sa valeur. */
const GOUTTIERE = 24;

const FOND = PALETTE[0];
const TRAIT = PALETTE[3];
const ACCENT = PALETTE[6];
const ENCRE = "#16324a";
const ENCRE_SOURDE = "#4c6478";

const TAILLE_CHAPEAU = 26;
const TAILLE_TITRE = 46;
const INTERLIGNE_TITRE = 58;
const TAILLE_LIBELLE = 27;
const TAILLE_VALEUR = 34;
const TAILLE_PHRASE = 30;
const TAILLE_PIED = 24;

/** Première ligne de base du titre, et bande où tiennent les rangées. */
const TITRE_HAUT = 160;
const CORPS_HAUT = 330;
const CORPS_BAS = 506;
const PAS_MAX = 62;

/**
 * Les trois lignes du pied, et pourquoi elles sont trois.
 *
 * Le pied porte quatre choses : ce que sont les nombres, l'intitulé de la
 * source, son millésime et l'adresse du site. Mesurées à corps 24 sur la
 * première source réelle du dépôt, elles demandent 2 193 unités — un intitulé
 * de projet de loi de règlement en pèse à lui seul 1 392. Deux lignes n'en
 * offrent que 2 112 : la source y était coupée à « Projet de loi relatif aux
 * résultats… », c'est-à-dire au tronçon qui ne dit ni le sigle, ni l'exercice
 * du texte, ni l'annexe qui porte le chiffre — tout ce qui permettrait de la
 * retrouver. Une image circule seule ; un tronçon non identifiable n'y vaut pas
 * mieux qu'une source absente.
 *
 * La troisième ligne est prise sur le blanc du bas, pas sur le corps : la
 * mention d'unité ne bouge pas, la dernière ligne de base tombe à 612 et sa
 * jambe à 618, douze unités au-dessus du bord. L'adresse du site remonte sur la
 * ligne de l'unité, où la mention laisse 735 unités de libre — c'est ce qui rend
 * les deux lignes de la source PLEINES, et c'est ce dont la place manquait.
 */
const PIED_UNITE = 552;
const PIED_SOURCE = 582;
const INTERLIGNE_PIED = 30;
/** Deux lignes pour l'intitulé de la source : 1 734 unités, où le plus long
 *  intitulé du dépôt en demande 1 392. Ce qui dépasserait est coupé par
 *  `replier`, qui marque la suite. */
const SOURCE_LIGNES = 2;
const PIED_SUITE = PIED_SOURCE + INTERLIGNE_PIED;

/**
 * Les bandes du dessin, exportées pour être éprouvées sur les coordonnées
 * émises.
 *
 * Un test qui retape ces nombres n'éprouve plus la mise en page : il éprouve sa
 * propre copie, et reste vert quand le dessin s'en écarte. Une rangée posée à
 * y=578 — entre la mention d'unité et la source, par-dessus le pied — était
 * « dans le cadre 1200 × 630 » et ne faisait rougir personne.
 */
export const GEOMETRIE = {
  MARGE,
  CORPS_HAUT,
  CORPS_BAS,
  PIED_UNITE,
  PIED_SOURCE,
  PIED_SUITE,
} as const;

/**
 * L'avance de chaque caractère, en fraction du corps.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS UNE CHASSE MOYENNE
 * ─────────────────────────────────────────────────────────────────────────
 * Une constante unique a tenu ce rôle — 0,58 em, la chasse moyenne d'une
 * sans-serif sur du texte français — et elle n'a pas suffi. Les chiffres de la
 * fonte embarquée ne sont pas tabulaires : « 1 » avance de 0,407 em et « 8 »
 * de 0,648. Une colonne de chiffres (0,648) comme un titre en capitales
 * (0,613) passent tous deux au-dessus de la moyenne, et le titre
 * « PROGRAMME 150 FORMATIONS SUPÉRIEURES ET » sortait du cadre de 39 px sans
 * qu'aucun test ne rougisse — les tests mesuraient avec la constante qui avait
 * servi à la mise en page, et la moyenne ne peut pas majorer ce qu'elle moyenne.
 *
 * Les valeurs sont donc **mesurées**, dans la table `hmtx` de la fonte que le
 * rasteriseur embarque (Public Sans Regular, `scripts/polices/`), et arrondies
 * vers le HAUT au millième : le modèle majore la fonte, jamais l'inverse. Le
 * crénage, lui, ne fait que resserrer — l'encre réelle reste sous le modèle.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ESPACE FINE INSÉCABLE
 * ─────────────────────────────────────────────────────────────────────────
 * U+202F, que `formater` pose entre les groupes de chiffres, n'a **pas de
 * glyphe** dans cette fonte. Elle n'est pour autant ni de largeur nulle ni une
 * espace ordinaire : rustybuzz, le façonneur de resvg, connaît les espaces
 * d'Unicode et lui fabrique une avance de la moitié d'une espace — 0,122 em
 * contre 0,243, mesuré sur le PNG rasterisé. La compter pour un caractère
 * ordinaire surestimerait toutes les chaînes de montants ; la compter pour
 * rien les sous-estimerait.
 */
const AVANCES = new Map<string, number>();
for (const [avance, caracteres] of [
  // Les deux espaces s'écrivent échappées : au clavier, elles sont
  // indiscernables l'une de l'autre et d'une espace ordinaire.
  [0.122, "\u202f"], [0.243, " \u00a0"],
  [0.225, "."], [0.226, ":"], [0.230, "·"], [0.232, "’"], [0.240, ";"], [0.242, "î,"],
  [0.248, "i'"], [0.251, "!"], [0.263, "j|"], [0.283, "IÎÏ"], [0.302, "ï"], [0.303, "l([]"],
  [0.309, ")"], [0.328, "{"], [0.332, "}"], [0.351, "/\\"], [0.367, "²"], [0.378, "-"],
  [0.389, "tJ"], [0.391, "r"], [0.394, "*"], [0.396, "f"], [0.402, "³"], [0.407, "1"],
  [0.426, '"'], [0.455, "«"], [0.463, "°"], [0.473, "^"], [0.479, "»"], [0.481, "z"],
  [0.505, "v"], [0.506, "s"], [0.518, "_"], [0.521, "?"], [0.535, "yÿ"], [0.544, "cç"],
  [0.546, "<>"], [0.553, "aàâä"], [0.555, "–+=−"], [0.562, "k"], [0.565, "x"], [0.566, "oôö"],
  [0.567, "eéèêë"], [0.568, "~"], [0.577, "hn"], [0.578, "L"], [0.581, "uùûü"], [0.594, "FT"],
  [0.596, "pq2"], [0.597, "bd"], [0.600, "€"], [0.601, "7"], [0.603, "#"], [0.607, "YŸ"],
  [0.612, "0"], [0.621, "EÉÈÊË"], [0.623, "g6"], [0.625, "9"], [0.629, "4"], [0.630, "3"],
  [0.637, "PZ"], [0.641, "5"], [0.648, "8"], [0.659, "$"], [0.670, "S"], [0.671, "B"],
  [0.673, "V"], [0.677, "R"], [0.682, "K"], [0.688, "X"], [0.689, "CÇ"], [0.694, "D"],
  [0.701, "UÙÛÜ"], [0.709, "&"], [0.710, "AÀÂÄ"], [0.733, "G"], [0.734, "OÔÖ"], [0.748, "Q"],
  [0.754, "N"], [0.766, "H"], [0.768, "…"], [0.780, "w"], [0.831, "@"], [0.865, "m"],
  [0.886, "M"], [0.904, "%"], [0.914, "æ"], [0.948, "œ"], [0.954, "W"], [0.975, "Æ"],
  [1.117, "—"], [1.118, "Œ"], [1.305, "‰"],
] as [number, string][]) {
  for (const caractere of caracteres) AVANCES.set(caractere, avance);
}

/** Ce qu'avance un caractère hors du répertoire mesuré : le plus large que la
 *  fonte porte pour le site (« ‰ »), et davantage que le carré vide qu'elle
 *  peint pour un caractère qu'elle ignore. Majorer est le seul repli sûr —
 *  sous-estimer ne se voit qu'une fois l'image publiée. */
const AVANCE_INCONNUE = 1.31;

/** Largeur approchée d'un texte, en unités du dessin. La boucle parcourt les
 *  points de code, pas les unités UTF-16 : une paire de substitution est un
 *  caractère, pas deux. */
export function largeurApprochee(texte: string, taille: number): number {
  let em = 0;
  for (const caractere of texte) em += AVANCES.get(caractere) ?? AVANCE_INCONNUE;
  return em * taille;
}

/**
 * Replie un texte sur au plus `maxLignes` lignes larges de `largeur` unités.
 *
 * Ce qui ne tient pas est coupé au dernier mot entier et marqué d'un caractère
 * de suite : une carte tronquée reste lisible, une carte débordée ne l'est
 * pas. Un mot plus long que la ligne est coupé en dur — sinon il sortirait du
 * cadre à lui seul, et c'est exactement le cas qu'aucun œil ne rattrape.
 *
 * La coupure se fait sur les espaces **sécables** seulement, jamais sur `\s` :
 * `\s` comprend l'espace fine insécable (U+202F) que `formater` pose entre les
 * groupes de chiffres, et découper dessus rendait « 1 234 M€ » avec une espace
 * ordinaire — le montant restait lisible, mais ce n'était plus la typographie
 * du site, et aucune valeur attendue produite par `formater` ne s'y retrouvait.
 * Une espace insécable dit précisément « ne pas couper ici » : elle reste dans
 * le mot.
 *
 * Zéro ligne demandée rend zéro ligne. La signature accepte `0` — et les
 * négatifs — alors que les cinq natures n'en passent jamais ; sans cette
 * borne, la coupe lisait `gardees[-1]` et lançait un `TypeError` obscur, dans
 * un module exporté que d'autres tâches consomment.
 */
export function replier(
  texte: string,
  taille: number,
  largeur: number,
  maxLignes: number,
): string[] {
  if (maxLignes < 1) return [];
  // Le repli compte des LARGEURS, pas des caractères : « 111 » et « 888 »
  // n'occupent pas la même place, un nombre de caractères par ligne ne peut
  // donc pas borner une ligne.
  const tient = (essai: string) => largeurApprochee(essai, taille) <= largeur;
  const mots: string[] = [];
  for (const brut of texte.split(/[ \t\r\n]+/).filter(Boolean)) {
    let reste = [...brut];
    while (reste.length > 1 && !tient(reste.join(""))) {
      // Le plus grand préfixe qui tient, un caractère au moins : la coupe
      // avance toujours, et un mot plus long que la ligne finit par passer.
      let n = 1;
      while (n < reste.length - 1 && tient(reste.slice(0, n + 1).join(""))) n += 1;
      mots.push(reste.slice(0, n).join(""));
      reste = reste.slice(n);
    }
    if (reste.length > 0) mots.push(reste.join(""));
  }
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (tient(essai)) {
      courante = essai;
      continue;
    }
    if (courante) lignes.push(courante);
    courante = mot;
  }
  if (courante) lignes.push(courante);
  if (lignes.length <= maxLignes) return lignes;
  const gardees = lignes.slice(0, maxLignes);
  gardees[maxLignes - 1] = marquerLaSuite(gardees[maxLignes - 1], taille, largeur);
  return gardees;
}

/** Marque une ligne coupée d'un caractère de suite, en lui faisant la place :
 *  « … » avance de 0,768 em, plus que la plupart des lettres. L'ajouter sans
 *  retirer ce qu'il occupe ferait déborder la ligne qu'on vient de borner. */
function marquerLaSuite(ligne: string, taille: number, largeur: number): string {
  let gardee = ligne;
  while (gardee && largeurApprochee(`${gardee}…`, taille) > largeur) {
    gardee = [...gardee].slice(0, -1).join("").trimEnd();
  }
  return `${gardee}…`;
}

type Ancre = "start" | "end";

/** Un `<text>`, échappé, avec ses attributs dans un ordre stable. */
function texte(
  contenu: string,
  x: number,
  y: number,
  taille: number,
  couleur: string,
  ancre: Ancre = "start",
): string {
  if (!contenu) return "";
  return `<text x="${x}" y="${y}" font-family="${POLICE}" font-size="${taille}" fill="${couleur}" text-anchor="${ancre}">${echapper(
    contenu,
  )}</text>`;
}

/**
 * Les ordonnées de `n` rangées dans la bande du corps.
 *
 * Le pas se resserre quand il y a plus de rangées, au lieu de pousser la
 * dernière sous le pied de page : une carte qui reçoit une rangée de plus
 * qu'on n'avait prévu se serre, elle ne déborde pas.
 *
 * Les ordonnées sont arrondies : `y="388.6666666666667"` dans un attribut SVG
 * ne pose pas le texte plus juste, il alourdit le document et rend le dessin
 * pénible à relire d'une carte à l'autre.
 */
function ordonnees(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [CORPS_HAUT];
  const pas = Math.min(PAS_MAX, (CORPS_BAS - CORPS_HAUT) / (n - 1));
  return Array.from({ length: n }, (_, i) => Math.round(CORPS_HAUT + i * pas));
}

/** Une rangée du corps : soit un libellé et sa valeur, soit une phrase seule. */
type Rangee = { libelle: string; valeur: string } | { phrase: string };

/**
 * Le corps d'une carte : les rangées, chacune bornée en largeur.
 *
 * La valeur est posée d'abord — c'est elle qu'on vient lire, et elle ne se
 * tronque pas — puis le libellé reçoit ce qui reste, gouttière déduite.
 */
function corpsRangees(rangees: Rangee[]): string {
  const ys = ordonnees(rangees.length);
  return rangees
    .map((rangee, i) => {
      const y = ys[i];
      if ("phrase" in rangee) {
        const ligne = replier(rangee.phrase, TAILLE_PHRASE, LARGEUR_UTILE, 1)[0] ?? "";
        return texte(ligne, MARGE, y, TAILLE_PHRASE, ENCRE);
      }
      const valeur = replier(rangee.valeur, TAILLE_VALEUR, LARGEUR_UTILE, 1)[0] ?? "";
      const dispo = LARGEUR_UTILE - largeurApprochee(valeur, TAILLE_VALEUR) - GOUTTIERE;
      // Quand la valeur prend toute la ligne, il ne reste rien pour le libellé.
      // Le replier dans la place restante rendait alors le seul caractère de
      // suite : un « … » qui n'apprend rien et qui se pose PAR-DESSUS la
      // valeur, à la même ordonnée. Pas de place, pas de libellé — c'est la
      // valeur qu'on vient lire.
      const replie = dispo > 0 ? (replier(rangee.libelle, TAILLE_LIBELLE, dispo, 1)[0] ?? "") : "";
      const libelle = replie === "…" ? "" : replie;
      return (
        texte(libelle, MARGE, y, TAILLE_LIBELLE, ENCRE_SOURDE) +
        texte(valeur, LARGEUR - MARGE, y, TAILLE_VALEUR, ENCRE, "end")
      );
    })
    .join("");
}

/** L'interligne d'un paragraphe du corps. Plus serré que le pas des rangées :
 *  ce sont des lignes d'une même phrase, pas des rangées distinctes. */
const INTERLIGNE_PHRASE = 42;

/** Au plus quatre lignes : la quatrième se pose à y=456, sous la bande du corps
 *  et au-dessus du filet du pied. Ce qui ne tient pas est coupé par `replier`,
 *  qui marque la suite. */
const PHRASE_LIGNES = 4;

/**
 * Le corps d'une carte qui n'aligne aucun chiffre : un paragraphe, replié.
 *
 * `corpsRangees` ne sait poser qu'une ligne par rangée — c'est ce qu'il faut
 * quand chaque ligne est un libellé et sa valeur. Une phrase entière n'y tient
 * pas : les descriptions du site vont au-delà de deux fois la largeur utile, et
 * repliées sur une ligne elles ne rendaient qu'un « … ».
 */
function corpsPhrase(phrase: string): string {
  return replier(phrase, TAILLE_PHRASE, LARGEUR_UTILE, PHRASE_LIGNES)
    .map((ligne, i) => texte(ligne, MARGE, CORPS_HAUT + i * INTERLIGNE_PHRASE, TAILLE_PHRASE, ENCRE))
    .join("");
}

/**
 * La source d'un chiffre peint sur une carte : les champs sans lesquels l'image
 * ne se relit pas une fois sortie du site.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX SORTES DE DATE, DONC DEUX MOTS
 * ─────────────────────────────────────────────────────────────────────────
 * Un chiffre des comptes se date par son **exercice** : « 2025 », l'année que
 * la ligne mesure, et c'est cette date-là qu'on cherche pour la retrouver dans
 * le fichier du producteur. Une carte qui décrit une page du site, elle, ne
 * peint aucun chiffre : ce qui la date est la **publication** dont elle parle,
 * « 2026-08-11T0807 ». Les deux passaient sous le même mot, « millésime », sur
 * deux images voisines — et « millésime 2026-08-11T0807 » se lit mal, un
 * millésime étant une année.
 *
 * `datation` est donc le mot peint devant la date, et il dit laquelle des deux
 * on lit. Il vaut « millésime » par défaut : c'est le cas des quatre natures
 * qui alignent des chiffres, et l'oublier ne peut pas rendre l'autre par
 * accident.
 */
export type SourceCarte = {
  titre: string;
  millesime: string;
  datation?: "millésime" | "version";
};

/** Le châssis commun aux cinq natures de carte. */
type Cadre = {
  /** L'étiquette de nature : elle dit ce qu'on regarde avant qu'on le lise. */
  chapeau: string;
  titre: string;
  /** Le corps, déjà dessiné par la nature dans la bande [CORPS_HAUT, CORPS_BAS]. */
  corps: string;
  /** Ce que sont les nombres qu'on vient de lire. */
  unite: string;
  source: SourceCarte;
  /** L'adresse de publication, reçue de l'appelant — jamais devinée ici. */
  site: string;
  /** Le nombre de lignes réservées au titre. Trois par défaut ; une carte sans
   *  corps peut descendre plus bas sans rien heurter. */
  titreLignes?: number;
};

/**
 * Ce sans quoi une carte ne se relit pas, une fois sortie du site.
 *
 * Le type exige ces trois champs, mais un type n'exige pas une **valeur** :
 * `{ titre: "", millesime: "" }` et `site: ""` se construisaient, et l'image
 * partait en peignant « Source : · millésime ». Une image qui circule en
 * affirmant une source qu'elle n'a pas est pire qu'une image absente.
 */
function exigerProvenance(cadre: Cadre): void {
  const champs: [string, string][] = [
    ["la source", cadre.source.titre],
    ["le millésime", cadre.source.millesime],
    ["l'adresse du site", cadre.site],
  ];
  const manquants = champs.filter(([, valeur]) => !valeur.trim()).map(([nom]) => nom);
  if (manquants.length > 0) {
    throw new Error(
      `Carte de partage sans ${manquants.join(", ")} : une image circule seule, ce qui n'est pas peint dessus est perdu.`,
    );
  }
}

/**
 * Le dessin commun : fond, chapeau, titre replié, corps, pied.
 *
 * La hauteur du titre est **réservée**, pas mesurée : un titre d'une ligne et
 * un titre de trois posent le corps et le pied au même endroit. Une carte dont
 * la source remonte quand le titre raccourcit se relit mal d'une image à
 * l'autre, et rien ne garantirait plus que le pied tienne dans le cadre.
 *
 * Le titre se **centre** dans ce bloc réservé. La hauteur reste réservée — le
 * corps et le pied ne bougent pas d'une carte à l'autre, ce que la règle
 * ci-dessus protège — mais le blanc du bloc se répartit au lieu de tomber
 * entièrement sous le texte : un titre d'une ligne laissait sinon 150 px de
 * vide au-dessus du corps, et l'affirmation d'un repère flottait tout en haut
 * d'une image aux deux tiers blanche.
 */
function dessiner(cadre: Cadre): string {
  exigerProvenance(cadre);
  const maxLignes = cadre.titreLignes ?? 3;
  const lignes = replier(cadre.titre, TAILLE_TITRE, LARGEUR_UTILE, maxLignes);
  const creux = Math.round(((maxLignes - lignes.length) * INTERLIGNE_TITRE) / 2);
  const lignesTitre = lignes
    .map((ligne, i) =>
      texte(ligne, MARGE, TITRE_HAUT + creux + i * INTERLIGNE_TITRE, TAILLE_TITRE, ACCENT),
    )
    .join("");
  // La source se replie, le millésime jamais. Repliée d'un bloc, la ligne
  // « Source : … · millésime 2025 » se coupait par la QUEUE : sur la première
  // source réelle du site — l'intitulé d'un projet de loi de règlement, 110
  // caractères — l'image partait en affirmant un chiffre sans date, ce que
  // toute la carte existe pour empêcher. Le millésime prend donc sa place
  // d'abord, sur TOUTES les lignes de l'intitulé — la coupe ne sait pas
  // d'avance laquelle sera la dernière — et l'intitulé reçoit ce qui reste.
  const millesime = ` · ${cadre.source.datation ?? "millésime"} ${cadre.source.millesime}`;
  const largeurSource = LARGEUR_UTILE - largeurApprochee(millesime, TAILLE_PIED);
  const lignesSource = replier(
    `Source : ${cadre.source.titre}`,
    TAILLE_PIED,
    largeurSource,
    SOURCE_LIGNES,
  );
  // L'adresse est mesurée AVANT la mention d'unité, qui partage sa ligne : elle
  // est bornée au tiers de la largeur utile, mais c'est ce qu'elle occupe
  // vraiment — jamais sa borne — qui dit ce qui reste à gauche.
  const adresse = replier(cadre.site, TAILLE_PIED, LARGEUR_UTILE / 3, 1)[0] ?? "";
  const restePourUnite =
    LARGEUR_UTILE - largeurApprochee(adresse, TAILLE_PIED) - GOUTTIERE;
  const pied =
    texte(
      replier(cadre.unite, TAILLE_PIED, restePourUnite, 1)[0] ?? "",
      MARGE,
      PIED_UNITE,
      TAILLE_PIED,
      ENCRE_SOURDE,
    ) +
    texte(adresse, LARGEUR - MARGE, PIED_UNITE, TAILLE_PIED, ENCRE_SOURDE, "end") +
    lignesSource
      .map((ligne, i) =>
        texte(
          // Le millésime se pose au bout de la DERNIÈRE ligne : coller à la
          // première le séparerait de la fin de l'intitulé qu'il date.
          i === lignesSource.length - 1 ? `${ligne}${millesime}` : ligne,
          MARGE,
          PIED_SOURCE + i * INTERLIGNE_PIED,
          TAILLE_PIED,
          ENCRE_SOURDE,
        ),
      )
      .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}" viewBox="0 0 ${LARGEUR} ${HAUTEUR}" role="img"><title>${echapper(
    `${cadre.chapeau} — ${cadre.titre}`,
  )}</title><rect x="0" y="0" width="${LARGEUR}" height="${HAUTEUR}" fill="${FOND}"></rect><rect x="0" y="0" width="${LARGEUR}" height="10" fill="${ACCENT}"></rect>${texte(
    cadre.chapeau,
    MARGE,
    88,
    TAILLE_CHAPEAU,
    ENCRE_SOURDE,
  )}<line x1="${MARGE}" y1="110" x2="${
    LARGEUR - MARGE
  }" y2="110" stroke="${TRAIT}" stroke-width="2"></line>${lignesTitre}${cadre.corps}<line x1="${MARGE}" y1="524" x2="${
    LARGEUR - MARGE
  }" y2="524" stroke="${TRAIT}" stroke-width="2"></line>${pied}</svg>`;
}

/** La mention d'unité que porte toute carte alignant des montants publics :
 *  l'image le dit en toutes lettres, une fois, en bas. La phrase vient
 *  d'`echelle.ts`, à côté de `millions()` qui produit le sigle — recopiée ici,
 *  elle avait déjà divergé d'un point final de celle des aperçus. */
const UNITE_EUROS = MENTION_MILLIONS;

/** Un autre chiffre publié que l'analyse oppose au premier : son montant en
 *  euros, et ce qu'il désigne dans les mots de l'analyse. */
export type ChiffreOppose = { valeur: number; lecture: string };

export type DonneesAnalyse = {
  /** Le titre qui affirme — celui de l'analyse. */
  titre: string;
  /** Le chiffre annoncé, tel qu'il a été cité : du texte, jamais un nombre.
   *  « cent milliards » est une citation, pas une valeur du site. */
  dit: string;
  /** Le chiffre des comptes, en euros. `null` quand aucune ligne publiée ne
   *  lui répond : la rangée disparaît alors, le cran dit le reste. */
  observe: number | null;
  /**
   * Ce que ce chiffre-là désigne, dans les mots de l'analyse
   * (`chiffres[].lecture`).
   *
   * Sans elle, la carte alignait « Chiffre des comptes — 59 946 M€ » sous un
   * titre qui annonce « deux chiffres publiés, deux sens » : l'un des deux,
   * sous une étiquette générique, sans jamais dire lequel. Le lecteur voyait
   * « environ 59,9 milliards » à côté de « 59 946 M€ », donc un accord, sous un
   * verdict qui dit le contraire — et rien pour lire la différence. La citation
   * de la même donnée, elle, portait déjà la phrase : c'est la forme qui
   * circule seule qui en était amputée.
   */
  lecture: string;
  /**
   * Les AUTRES chiffres publiés que l'analyse oppose au premier.
   *
   * Dire lequel des deux on regarde ne suffisait pas. La carte alignait
   * « environ 59,9 milliards d'euros » et « 59 946 M€ » — deux montants qui
   * CONCORDENT — sous un verdict qui dit exactement le contraire, et le second
   * chiffre publié, 62 124 M€, qui est tout le sujet de l'analyse, n'était nulle
   * part sur l'image. Une image circule seule : elle affirmait un verdict en
   * retenant sa preuve.
   *
   * Vide ou absent quand l'analyse n'oppose qu'un chiffre publié — la carte est
   * alors exactement celle d'avant, elle ne perd rien.
   */
  opposes?: ChiffreOppose[];
  cran: Cran;
  source: SourceCarte;
  site: string;
};

/** La carte d'une analyse : chiffre annoncé, chiffre(s) des comptes, ce que
 *  chacun désigne, cran, source. */
export function carteAnalyse(donnees: DonneesAnalyse): string {
  const opposes = donnees.opposes ?? [];
  const rangees: Rangee[] = [{ libelle: "Chiffre annoncé", valeur: `« ${donnees.dit} »` }];
  if (donnees.observe !== null && opposes.length > 0) {
    // Plusieurs chiffres publiés : chacun sa rangée, et pour libellé ce qu'il
    // désigne. « Chiffre des comptes » nommerait les deux de la même façon —
    // c'est précisément l'étiquette générique qui avait déjà manqué —, et un
    // seul des deux peint laisserait le verdict sans ce contre quoi il juge.
    //
    // Aucun écart n'est peint entre eux : un écart est un calcul, et ce module
    // n'en fait aucun. Ce que la carte oppose, ce sont les deux montants
    // publiés, chacun sous ce qu'il désigne — la différence se lit.
    const publies: ChiffreOppose[] = [
      { valeur: donnees.observe, lecture: donnees.lecture },
      ...opposes,
    ];
    for (const publie of publies) {
      rangees.push({ libelle: publie.lecture, valeur: formater(publie.valeur, "EUR", false) });
    }
  } else {
    if (donnees.observe !== null) {
      rangees.push({
        libelle: "Chiffre des comptes",
        valeur: formater(donnees.observe, "EUR", false),
      });
    }
    // Juste sous le chiffre qu'elle qualifie, et avant le cran : c'est l'ordre
    // dans lequel on lit la carte — le nombre, ce qu'il désigne, ce que le site
    // en conclut.
    //
    // Sur une ligne, comme toute phrase de rangée : à quatre rangées, la bande
    // du corps donne 58 px de pas, et une seconde ligne à corps 30 se poserait
    // sur la rangée suivante. `replier` la coupe donc au dernier mot entier et
    // marque la suite. Les `lecture` du dépôt nomment ce qu'elles distinguent
    // en tête de phrase — « Les crédits votés : … » — et c'est la queue qui
    // part.
    if (donnees.lecture.trim()) rangees.push({ phrase: donnees.lecture });
  }
  rangees.push({ phrase: LIBELLE_CRAN[donnees.cran] });
  return dessiner({
    chapeau: "Analyse",
    titre: donnees.titre,
    corps: corpsRangees(rangees),
    // La mention des millions ne s'écrit que si un montant en euros est peint.
    // Le chiffre annoncé est une **citation** — du texte, « cent milliards » —
    // et le chiffre des comptes manque dès que le catalogue déclare
    // l'indicateur observé autrement qu'en euros (`donneesCarteAnalyse`,
    // scripts/prerendre.ts). La carte n'aligne alors aucun montant, et
    // annoncer une unité qu'aucun nombre ne porte serait faux : même règle que
    // `carteFiche` sous trois taux.
    unite: donnees.observe !== null ? UNITE_EUROS : "",
    source: donnees.source,
    site: donnees.site,
  });
}

/** Un geste du simulateur : la ligne réglée et l'écart qu'elle porte. */
export type Geste = { libelle: string; montant: number };

export type DonneesScenario = {
  nom: string;
  /** La somme des écarts du scénario. C'est ce que ce nombre est, et la carte
   *  le NOMME : seul et gros sur une image, il se lirait comme le budget que
   *  le scénario propose — la lecture que ce site refuse partout ailleurs. */
  effort: number;
  gestes: Geste[];
  source: SourceCarte;
  site: string;
};

/** La carte d'un scénario : nom, effort, trois gestes les plus lourds.
 *
 *  Les trois plus lourds sont choisis ici, sur la valeur absolue de l'écart :
 *  une carte qui garderait les trois premiers gestes déclarés montrerait
 *  l'ordre dans lequel l'atelier les a produits, qui n'apprend rien.
 *
 *  Les montants passent par `eurosSigne` (simulateur-rendu.ts), pas par
 *  `formater` : ce sont des ÉCARTS, et sur un écart le sens du geste est
 *  l'information — « 8 032 M€ » ne dit pas s'il s'ajoute ou se retranche.
 *  C'est déjà la forme que l'écran, l'aperçu du lien et le résumé collé
 *  emploient pour ce même scénario ; l'image en perdait le signe, et la même
 *  grandeur changeait de forme entre le texte et l'image qui l'accompagne.
 *
 *  La carte de comparaison, elle, garde `formater` : c'est la forme que le
 *  résumé d'une comparaison emploie (`partageComparaison`, partage.ts), et le
 *  point de cette règle est qu'un objet se dise partout de la même façon. */
export function carteScenario(donnees: DonneesScenario): string {
  const lourds = [...donnees.gestes]
    .sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))
    .slice(0, 3);
  const rangees: Rangee[] = [
    { libelle: "Somme des écarts", valeur: eurosSigne(donnees.effort) },
    ...lourds.map((geste) => ({
      libelle: geste.libelle,
      valeur: eurosSigne(geste.montant),
    })),
  ];
  return dessiner({
    chapeau: "Scénario",
    titre: donnees.nom,
    corps: corpsRangees(rangees),
    unite: UNITE_EUROS,
    source: donnees.source,
    site: donnees.site,
  });
}

/** Une colonne comparée, réduite à ce qu'une image peut porter. */
export type ColonneComparee = { nom: string; effort: number };

/** Un écart, ligne à ligne, dans les deux colonnes. `null` marque une ligne
 *  qu'une colonne n'a pas réglée — jamais un zéro, qui dirait qu'un lecteur a
 *  réglé une ligne qu'il n'a pas ouverte (même règle que `comparaison.ts`). */
export type EcartCompare = { libelle: string; cellules: [number | null, number | null] };

export type DonneesComparaison = {
  titre: string;
  colonnes: [ColonneComparee, ColonneComparee];
  ecarts: EcartCompare[];
  source: SourceCarte;
  site: string;
};

/** Les gouttières de la grille à trois colonnes de la comparaison. */
const COMP_LIBELLE = 456;
const COMP_VALEUR = (LARGEUR_UTILE - COMP_LIBELLE - GOUTTIERE) / 2;
const COMP_DROITES = [
  MARGE + COMP_LIBELLE + GOUTTIERE + COMP_VALEUR,
  MARGE + COMP_LIBELLE + GOUTTIERE + 2 * COMP_VALEUR,
];

/** Ce qu'une cellule non réglée écrit — jamais « 0 M€ », qui s'y confondrait. */
const NON_REGLE = "Non réglé";

/**
 * La carte d'une comparaison : deux colonnes et leurs trois écarts les plus
 * lourds.
 *
 * **Jamais la somme des deux colonnes** : deux budgets ne s'additionnent pas,
 * et une image qui poserait un troisième nombre sous les deux autres serait lue
 * comme leur total. **Jamais une marque de tête** non plus : les deux noms sont
 * peints au même corps, dans la même encre, dans l'ordre reçu. Rien ici ne
 * classe, ne note, ni ne désigne.
 */
export function carteComparaison(donnees: DonneesComparaison): string {
  const lourds = [...donnees.ecarts]
    .sort((a, b) => poidsEcart(b) - poidsEcart(a))
    .slice(0, 3);
  const ys = ordonnees(2 + lourds.length);
  const valeur = (montant: number | null) =>
    montant === null ? NON_REGLE : formater(montant, "EUR", false);

  const noms = donnees.colonnes
    .map((colonne, c) =>
      texte(
        replier(colonne.nom, TAILLE_LIBELLE, COMP_VALEUR, 1)[0] ?? "",
        COMP_DROITES[c],
        ys[0],
        TAILLE_LIBELLE,
        ENCRE,
        "end",
      ),
    )
    .join("");

  const efforts =
    texte("Somme des écarts", MARGE, ys[1], TAILLE_LIBELLE, ENCRE_SOURDE) +
    donnees.colonnes
      .map((colonne, c) =>
        texte(
          replier(formater(colonne.effort, "EUR", false), TAILLE_VALEUR, COMP_VALEUR, 1)[0] ?? "",
          COMP_DROITES[c],
          ys[1],
          TAILLE_VALEUR,
          ENCRE,
          "end",
        ),
      )
      .join("");

  const lignes = lourds
    .map((ecart, i) => {
      const y = ys[2 + i];
      const cellules = ecart.cellules
        .map((cellule, c) =>
          texte(
            replier(valeur(cellule), TAILLE_LIBELLE, COMP_VALEUR, 1)[0] ?? "",
            COMP_DROITES[c],
            y,
            TAILLE_LIBELLE,
            ENCRE,
            "end",
          ),
        )
        .join("");
      const libelle = replier(ecart.libelle, TAILLE_LIBELLE, COMP_LIBELLE, 1)[0] ?? "";
      return texte(libelle, MARGE, y, TAILLE_LIBELLE, ENCRE_SOURDE) + cellules;
    })
    .join("");

  return dessiner({
    chapeau: "Comparaison",
    titre: donnees.titre,
    corps: noms + efforts + lignes,
    unite: UNITE_EUROS,
    source: donnees.source,
    site: donnees.site,
  });
}

/** Le poids d'un écart : le plus gros des deux montants réglés, en valeur
 *  absolue. Jamais leur somme — c'est un critère de tri, pas un montant, et il
 *  n'est jamais peint. */
function poidsEcart(ecart: EcartCompare): number {
  return Math.max(...ecart.cellules.map((c) => (c === null ? 0 : Math.abs(c))));
}

/** Un chiffre d'une fiche : la valeur, son unité, et sa variation quand la
 *  carte la porte. */
export type ChiffreCarte = {
  libelle: string;
  valeur: number;
  unite: string;
  /** La variation entre les deux exercices de la fenêtre. Reçue en nombre, pas
   *  en chaîne toute faite : un taux varie en POINTS et le reste en pourcentage,
   *  et c'est l'unité — que la carte connaît — qui tranche. */
  variation?: number | null;
};

export type DonneesFiche = {
  territoire: string;
  chiffres: ChiffreCarte[];
  exercice: string;
  source: SourceCarte;
  site: string;
};

/**
 * La carte d'une fiche territoire : nom du territoire, trois chiffres, exercice.
 *
 * La variation est **déléguée** à `evolution-carte.ts`, qui porte déjà la règle
 * du site et ses tests : un taux varie en points, et les taux publiés pour
 * mille suivent la conversion ÷ 10 que `formater` applique à l'écran. Réécrite
 * ici, elle avait raté les deux : la carte peignait « 2,1 % (+21 %) » — le bon
 * chiffre à gauche, à droite le mauvais mot et dix fois la grandeur.
 */
export function carteFiche(donnees: DonneesFiche): string {
  // Trois chiffres, jamais quatre : au-delà, les rangées se resserrent jusqu'à
  // l'illisible. Les trois PREMIERS, sans tri — au contraire du scénario, ces
  // chiffres n'ont pas d'unité commune (un montant et un taux ne se rangent pas
  // l'un contre l'autre) et l'ordre reçu est celui que la fiche a choisi.
  const chiffres = donnees.chiffres.slice(0, 3);
  const rangees: Rangee[] = chiffres.map((chiffre) => {
    const montant = formater(chiffre.valeur, chiffre.unite, false);
    const variation =
      chiffre.variation == null
        ? ""
        : ` (${formaterVariation(chiffre.variation, chiffre.unite, modeVariation(chiffre.unite))})`;
    return { libelle: chiffre.libelle, valeur: `${montant}${variation}` };
  });
  // L'exercice se dit avec l'unité, là où le lecteur apprend ce que sont les
  // nombres qu'il vient de lire — pas dans une rangée qui prendrait la place
  // d'un chiffre. Et la mention des millions ne s'écrit que si un montant en
  // euros est peint : sous trois taux, elle serait fausse.
  const euros = chiffres.some((chiffre) => chiffre.unite === "EUR");
  return dessiner({
    chapeau: "Fiche territoire",
    titre: donnees.territoire,
    corps: corpsRangees(rangees),
    unite: euros
      ? `${UNITE_EUROS} · exercice ${donnees.exercice}`
      : `Exercice ${donnees.exercice}`,
    source: donnees.source,
    site: donnees.site,
  });
}

export type DonneesReperes = {
  /** Le titre-affirmation du repère : c'est lui que la carte donne à lire. */
  titre: string;
  /** Ce que sont les nombres du graphique que la carte ne peut pas dessiner. */
  unite: string;
  source: SourceCarte;
  site: string;
};

/** La carte d'un repère : titre-affirmation, unité, source.
 *
 *  Pas de corps : un graphique ne se redessine pas à cette taille sans devenir
 *  un trait décoratif. Le titre reçoit donc la place du corps — cinq lignes au
 *  lieu de trois — et l'affirmation tient l'image à elle seule. */
export function carteReperes(donnees: DonneesReperes): string {
  return dessiner({
    chapeau: "Repère",
    titre: donnees.titre,
    corps: "",
    unite: donnees.unite,
    source: donnees.source,
    site: donnees.site,
    titreLignes: 5,
  });
}

export type DonneesSection = {
  /** Ce que la page EST, dans les mots que le site emploie déjà pour elle :
   *  « Le site », « Simulateur », « Analyses ». C'est le chapeau, et c'est lui
   *  qui empêche l'image de démentir le titre posé à côté d'elle. */
  nature: string;
  /** Le titre que la page porte déjà. Jamais une accroche écrite pour
   *  l'occasion : une image qui circule sous les mots du site doit être faite
   *  des mots du site. */
  titre: string;
  /** Ce que la page fait, dans ses propres mots — sa description. Vide quand
   *  le site n'en déclare aucune : mieux vaut une image sobre qu'une phrase
   *  inventée pour remplir. */
  phrase: string;
  source: SourceCarte;
  site: string;
};

/**
 * La carte d'une page du site : ce qu'elle est, son titre, ce qu'elle fait.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE SIXIÈME NATURE
 * ─────────────────────────────────────────────────────────────────────────
 * Les cinq premières sont des natures d'**objet partageable** : une analyse, un
 * scénario, une comparaison, une fiche, un repère. Une page du site n'en est
 * pas un — elle n'a ni chiffre à opposer, ni écart à montrer — et faute de
 * cette nature-là, la carte du site empruntait celle du repère : elle partait
 * avec le chapeau « Repère », sur `/`, sur `/analyses/` et sur tout scénario
 * partagé. Le lecteur voyait annoncé « un scénario du simulateur » une image
 * qui se présentait comme un repère intitulé « carte des finances locales ».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AUCUN CHIFFRE, ET C'EST LA RÈGLE, PAS UNE LACUNE
 * ─────────────────────────────────────────────────────────────────────────
 * Une carte de section décrit une page, pas un objet : elle ne sait rien du
 * scénario que le lecteur vient de régler (l'espace des budgets encodés est
 * infini, décision D-L3-b — il n'y a pas d'image par scénario). Elle n'écrit
 * donc aucun montant, et pas davantage de mention d'unité : annoncer des
 * millions d'euros sous une image qui n'en porte aucun serait faux, même règle
 * que `carteAnalyse` sans chiffre des comptes et que `carteFiche` sous trois
 * taux.
 */
export function carteSection(donnees: DonneesSection): string {
  const phrase = donnees.phrase.trim();
  return dessiner({
    chapeau: donnees.nature,
    titre: donnees.titre,
    corps: corpsPhrase(phrase),
    unite: "",
    source: donnees.source,
    site: donnees.site,
    // Sans phrase, le titre reçoit la place du corps — même geste que la carte
    // de repère, et pour la même raison : la hauteur du titre est réservée, et
    // un titre d'une ligne laisserait sinon les deux tiers de l'image blancs.
    titreLignes: phrase ? undefined : 5,
  });
}
