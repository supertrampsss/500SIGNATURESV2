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
 * et son millésime : le type les exige, une carte sans eux ne se construit pas.
 */

import { LIBELLE_CRAN, type Cran } from "./analyse-rendu.ts";
import { PALETTE, formater, moins } from "./echelle.ts";
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
const PIED_UNITE = 552;
const PIED_SOURCE = 590;

/**
 * La chasse moyenne d'un caractère, en fraction du corps.
 *
 * Sans fonte chargée, aucune largeur exacte n'est calculable : ce module ne
 * peut qu'approcher. 0,58 em est la chasse moyenne d'une sans-serif sur du
 * texte français courant, majuscules et chiffres compris. Le modèle est
 * volontairement large — mieux vaut replier une ligne qui aurait tenu que
 * laisser une ligne déborder, parce que le débordement, lui, ne se voit qu'une
 * fois l'image publiée.
 */
const CHASSE = 0.58;

/** Largeur approchée d'un texte, en unités du dessin. */
export function largeurApprochee(texte: string, taille: number): number {
  return texte.length * taille * CHASSE;
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
 */
export function replier(
  texte: string,
  taille: number,
  largeur: number,
  maxLignes: number,
): string[] {
  const max = Math.max(1, Math.floor(largeur / (taille * CHASSE)));
  const mots: string[] = [];
  for (const brut of texte.split(/[ \t\r\n]+/).filter(Boolean)) {
    let reste = brut;
    while (reste.length > max) {
      mots.push(reste.slice(0, max));
      reste = reste.slice(max);
    }
    if (reste) mots.push(reste);
  }
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length <= max) {
      courante = essai;
      continue;
    }
    if (courante) lignes.push(courante);
    courante = mot;
  }
  if (courante) lignes.push(courante);
  if (lignes.length <= maxLignes) return lignes;
  const gardees = lignes.slice(0, maxLignes);
  const derniere = gardees[maxLignes - 1];
  gardees[maxLignes - 1] =
    `${derniere.length < max ? derniere : derniere.slice(0, max - 1).trimEnd()}…`;
  return gardees;
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
 */
function ordonnees(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [CORPS_HAUT];
  const pas = Math.min(PAS_MAX, (CORPS_BAS - CORPS_HAUT) / (n - 1));
  return Array.from({ length: n }, (_, i) => CORPS_HAUT + i * pas);
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
      const libelle = replier(rangee.libelle, TAILLE_LIBELLE, Math.max(1, dispo), 1)[0] ?? "";
      return (
        texte(libelle, MARGE, y, TAILLE_LIBELLE, ENCRE_SOURDE) +
        texte(valeur, LARGEUR - MARGE, y, TAILLE_VALEUR, ENCRE, "end")
      );
    })
    .join("");
}

/** La source d'un chiffre peint sur une carte : les deux champs sans lesquels
 *  l'image ne se relit pas une fois sortie du site. */
export type SourceCarte = { titre: string; millesime: string };

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
 * Le dessin commun : fond, chapeau, titre replié, corps, pied.
 *
 * La hauteur du titre est **réservée**, pas mesurée : un titre d'une ligne et
 * un titre de trois posent le corps et le pied au même endroit. Une carte dont
 * la source remonte quand le titre raccourcit se relit mal d'une image à
 * l'autre, et rien ne garantirait plus que le pied tienne dans le cadre.
 */
function dessiner(cadre: Cadre): string {
  const maxLignes = cadre.titreLignes ?? 3;
  const lignesTitre = replier(cadre.titre, TAILLE_TITRE, LARGEUR_UTILE, maxLignes)
    .map((ligne, i) => texte(ligne, MARGE, TITRE_HAUT + i * INTERLIGNE_TITRE, TAILLE_TITRE, ACCENT))
    .join("");
  const source = `Source : ${cadre.source.titre} · millésime ${cadre.source.millesime}`;
  const pied =
    texte(
      replier(cadre.unite, TAILLE_PIED, LARGEUR_UTILE, 1)[0] ?? "",
      MARGE,
      PIED_UNITE,
      TAILLE_PIED,
      ENCRE_SOURDE,
    ) +
    texte(
      replier(cadre.site, TAILLE_PIED, LARGEUR_UTILE / 3, 1)[0] ?? "",
      LARGEUR - MARGE,
      PIED_SOURCE,
      TAILLE_PIED,
      ENCRE_SOURDE,
      "end",
    ) +
    texte(
      replier(source, TAILLE_PIED, (LARGEUR_UTILE * 2) / 3 - GOUTTIERE, 1)[0] ?? "",
      MARGE,
      PIED_SOURCE,
      TAILLE_PIED,
      ENCRE_SOURDE,
    );
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

/** La mention d'unité que porte toute carte alignant des montants publics.
 *  « Santé 1 643 M€ » se lit « 1 643 milliards » par qui n'a pas le nez sur le
 *  sigle : l'image le dit en toutes lettres, une fois, en bas. */
const UNITE_EUROS = "Montants en millions d'euros";

export type DonneesAnalyse = {
  /** Le titre qui affirme — celui de l'analyse. */
  titre: string;
  /** Le chiffre annoncé, tel qu'il a été cité : du texte, jamais un nombre.
   *  « cent milliards » est une citation, pas une valeur du site. */
  dit: string;
  /** Le chiffre des comptes, en euros. `null` quand aucune ligne publiée ne
   *  lui répond : la rangée disparaît alors, le cran dit le reste. */
  observe: number | null;
  cran: Cran;
  source: SourceCarte;
  site: string;
};

/** La carte d'une analyse : chiffre annoncé, chiffre des comptes, cran, source. */
export function carteAnalyse(donnees: DonneesAnalyse): string {
  const rangees: Rangee[] = [{ libelle: "Chiffre annoncé", valeur: `« ${donnees.dit} »` }];
  if (donnees.observe !== null) {
    rangees.push({
      libelle: "Chiffre des comptes",
      valeur: formater(donnees.observe, "EUR", false),
    });
  }
  rangees.push({ phrase: LIBELLE_CRAN[donnees.cran] });
  return dessiner({
    chapeau: "Analyse",
    titre: donnees.titre,
    corps: corpsRangees(rangees),
    unite: UNITE_EUROS,
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
 *  l'ordre dans lequel l'atelier les a produits, qui n'apprend rien. */
export function carteScenario(donnees: DonneesScenario): string {
  const lourds = [...donnees.gestes]
    .sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))
    .slice(0, 3);
  const rangees: Rangee[] = [
    { libelle: "Somme des écarts", valeur: formater(donnees.effort, "EUR", false) },
    ...lourds.map((geste) => ({
      libelle: geste.libelle,
      valeur: formater(geste.montant, "EUR", false),
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

/** Un taux varie en points, jamais en pourcentage : « le taux de pauvreté a
 *  augmenté de 3 % » et « de 3 points » sont deux affirmations différentes, et
 *  la seconde est celle que la source permet. */
function variationLisible(variation: number, unite: string): string {
  const nombre = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(variation);
  return moins(unite === "percent" || unite === "rate" ? `${nombre} points` : `${nombre} %`);
}

export type DonneesFiche = {
  territoire: string;
  chiffres: ChiffreCarte[];
  exercice: string;
  source: SourceCarte;
  site: string;
};

/** La carte d'une fiche territoire : nom du territoire, trois chiffres, exercice. */
export function carteFiche(donnees: DonneesFiche): string {
  const chiffres = donnees.chiffres.slice(0, 3);
  const rangees: Rangee[] = chiffres.map((chiffre) => {
    const montant = formater(chiffre.valeur, chiffre.unite, false);
    const variation =
      chiffre.variation == null ? "" : ` (${variationLisible(chiffre.variation, chiffre.unite)})`;
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
