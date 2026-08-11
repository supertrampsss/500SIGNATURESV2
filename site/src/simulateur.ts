/**
 * Le budget de l'État, réglable ligne à ligne.
 *
 * Ce module ne connaît pas le DOM. Il tient l'arbre publié
 * (`simulateur/etat-{exercice}.json`), l'état des réglages, et répond aux
 * quatre questions du simulateur : combien vaut cette ligne une fois réglée,
 * combien valent les totaux, de combien le solde s'écarte du budget réel, et
 * ce que cet écart représente.
 *
 * DEUX PRINCIPES DE CALCUL, qui gouvernent tout le reste :
 *
 * 1. UN RÉGLAGE EST UN COEFFICIENT, PAS UN MONTANT. Régler une mission à
 *    −10 % multiplie *tout son sous-arbre* par 0,90. Régler ensuite une
 *    sous-action à +50 % ne remplace pas le premier réglage : les deux se
 *    composent, et cette ligne vaut 0,90 × 1,50 = 1,35 fois sa base. C'est la
 *    seule règle qui rende « je coupe la Défense de 10 % mais je protège le
 *    porte-avions » exprimable. Le prix à payer est qu'un pourcentage affiché
 *    sur une ligne profonde n'est pas son écart total : l'écart, lui, est
 *    toujours affiché en euros à côté.
 *
 * 2. LE MONTANT D'UN NŒUD EST TOUJOURS LA SOMME DE SES FEUILLES. Le contrat
 *    publie bien `v` sur les nœuds intermédiaires, mais ce module ne le lit
 *    jamais : il redescend jusqu'aux feuilles et additionne. Un total ne peut
 *    donc pas contredire son détail, quoi que publie le producteur — et un
 *    `v` à zéro sur un nœud intermédiaire (comme dans l'exemple du contrat)
 *    ne fait pas disparaître 60 Md€ de l'écran.
 *
 * Ce qui n'est PAS modélisé, et qui ne doit pas être suggéré ailleurs : le
 * comportement. Baisser un impôt de 10 % ne rapporte pas exactement 10 % de
 * moins, et supprimer un crédit ne supprime pas la dépense qu'il finançait.
 * Le simulateur fait de l'arithmétique budgétaire, pas de l'économie.
 */

import { accentuer } from "./traductions.ts";

/** Un nœud de dépense : mission, programme, action ou sous-action. Une feuille
 *  n'a pas de clé `enfants` — c'est ce qui la distingue, pas sa profondeur. */
export type Noeud = {
  c: string;
  l: string;
  v: number;
  enfants?: Noeud[];
  /** Ce que la ligne paie, en une clause. Aucun fichier publié n'en porte : le
   *  site l'ajoute là où l'intitulé officiel ne se comprend pas seul —
   *  « Autonomie » ne dit pas EHPAD, APA et handicap. */
  d?: string;
};
/** `signe` vaut −1 pour les deux familles de prélèvements sur recettes
 *  (collectivités, Union européenne), qui se *déduisent* des recettes.
 *
 *  Les lignes d'un groupe sont des nœuds, pas des feuilles : le budget de
 *  l'État n'en publie que de plates, celui de la Sécurité sociale détaille le
 *  non-recouvrement sous les cotisations. Aplatir aurait perdu ce détail. */
export type GroupeRecettes = { t: string; signe: number; lignes: Noeud[] };

/** L'objectif national de dépenses d'assurance maladie et ses sous-objectifs.
 *
 *  Publié à côté du budget, jamais dedans : l'ONDAM traverse trois branches et
 *  n'est la somme d'aucune. Il a donc son propre total et son propre écart, et
 *  `totaux` ne le voit pas. `note` dit cela à l'écran, une fois. */
export type Objectif = { t: string; note: string; lignes: Noeud[] };

export type Budget = {
  exercice: string;
  loi: string;
  mesure?: string;
  unite: string;
  depenses: Noeud[];
  recettes: GroupeRecettes[];
  /** Publiés depuis que le site sert deux budgets : « Le budget de l'État,
   *  ligne à ligne » ne décrit pas celui de la Sécurité sociale, et le cadrage
   *  d'un vote de crédits ne décrit pas un tableau de charges et de produits.
   *  Absents des publications antérieures, d'où les valeurs de repli. */
  titre?: string;
  cadre?: string;
  /** Le mot qui nomme le niveau servant d'équivalence : « programme » pour
   *  l'État, « poste » pour la Sécurité sociale. */
  repere?: string;
  objectif?: Objectif;
};

export type Cote = "depense" | "recette" | "objectif";

/** Une ligne du budget telle que l'interface la manipule : son code global,
 *  son chemin lisible, ses ancêtres (pour composer les coefficients) et son
 *  montant de base. */
export type Entree = {
  code: string;
  libelle: string;
  /** « Défense · Équipement des forces » ; le titre du groupe côté recettes. */
  chemin: string;
  /** Codes des ancêtres, du plus haut au plus proche. Vide pour une mission
   *  et pour toute ligne de recette. */
  ancetres: string[];
  cote: Cote;
  /** +1, sauf les prélèvements sur recettes qui valent −1. */
  signe: number;
  /** Montant publié, feuilles sommées. */
  base: number;
  noeud: Noeud;
};

export type Index = Map<string, Entree>;
/** Code de ligne -> pourcentage entier, borné à ±100. Une ligne absente de la
 *  table n'est pas réglée : « réglée à 0 % » n'existe pas. */
export type Reglages = Map<string, number>;

export type Totaux = { depenses: number; recettes: number; solde: number };

/**
 * Les codes de recettes (« 1301 ») et de dépenses (« 146 ») viennent de deux
 * nomenclatures qui ne se sont jamais parlé : rien n'interdit qu'elles se
 * croisent. Un préfixe côté recettes rend les clés globalement uniques, donc
 * l'URL non ambiguë.
 */
export const PREFIXE_RECETTE = "r";

/**
 * La ligne qui retire les transferts entre branches de la Sécurité sociale.
 *
 * Elle n'est pas un poste : c'est la soustraction qui rend le total exact quand
 * les cinq branches sont réunies en un budget. La régler ferait apparaître
 * 19 019 M€ venus de nulle part, et elle est donc verrouillée partout.
 */
export const CODE_ELIMINATION = "SS-ELIM";

const SEPARATEUR_CHEMIN = " · ";
/** En deçà, une équivalence en « programme » serait du bruit. */
const SEUIL_EQUIVALENCE = 3e8;
/** Un programme n'illustre un écart que s'il en est proche : au-delà, dire
 *  « l'équivalent de X » trompe au lieu d'éclairer. */
const ECART_EQUIVALENCE = 0.35;

/**
 * Les tirets cadratin et demi-cadratin des intitulés officiels, ramenés au
 * trait d'union. Règle produit : ils ne sortent jamais à l'écran, et la place
 * où l'on peut la tenir est l'entrée dans le modèle, pas chaque rendu.
 */
export function net(texte: string): string {
  return accentuer(texte.replace(/[–—]/g, "-"));
}

/** Le montant de base d'un nœud : ses feuilles, sommées. Voir principe 2. */
export function base(noeud: Noeud): number {
  return noeud.enfants ? noeud.enfants.reduce((s, e) => s + base(e), 0) : noeud.v;
}

export function coefficient(reglages: Reglages, code: string): number {
  return 1 + (reglages.get(code) ?? 0) / 100;
}

/**
 * Le montant d'un sous-arbre une fois réglé, *vu depuis ce nœud* : son propre
 * coefficient appliqué à la somme de ses enfants réglés. Les coefficients des
 * ancêtres ne sont pas connus ici — c'est `montantEffectif` qui les compose.
 */
export function effectif(noeud: Noeud, reglages: Reglages, prefixe = ""): number {
  const c = coefficient(reglages, prefixe + noeud.c);
  return (
    c *
    (noeud.enfants
      ? noeud.enfants.reduce((s, e) => s + effectif(e, reglages, prefixe), 0)
      : noeud.v)
  );
}

/** Le montant affiché sur une ligne : son sous-arbre réglé, multiplié par les
 *  coefficients de tous ses ancêtres. Voir principe 1. */
export function montantEffectif(entree: Entree, reglages: Reglages): number {
  const herite = entree.ancetres.reduce((m, c) => m * coefficient(reglages, c), 1);
  return herite * effectif(entree.noeud, reglages);
}

/** Ce que le réglage change, pour cette ligne et pour le solde.
 *
 *  `delta` est la variation du montant **signé** de la ligne : une recette
 *  déduite qui monte fait baisser les recettes nettes, et son delta est
 *  négatif. `surSolde` est ce que la ligne apporte au solde : dépenser moins
 *  et encaisser plus l'améliorent tous les deux. */
export function impact(
  entree: Entree,
  reglages: Reglages,
): { montant: number; delta: number; surSolde: number } {
  const montant = montantEffectif(entree, reglages);
  const delta = entree.signe * (montant - entree.base);
  // L'ONDAM ne touche pas le solde : c'est un objectif sur un autre périmètre,
  // et lui donner une couleur d'amélioration ou de dégradation ferait croire
  // qu'il s'y ajoute. Son écart à lui s'affiche à sa place, dans son panneau.
  if (entree.cote === "objectif") return { montant, delta, surSolde: 0 };
  return { montant, delta, surSolde: entree.cote === "recette" ? delta : -delta };
}

export function totaux(budget: Budget, reglages: Reglages): Totaux {
  const depenses = budget.depenses.reduce((s, m) => s + effectif(m, reglages), 0);
  // Les lignes de recettes sont indexées sous un code préfixé : le sous-arbre
  // l'est donc aussi, sans quoi le réglage d'une ligne détaillée ne composerait
  // pas avec celui de sa mère. Ici le préfixe est passé plutôt que le nœud
  // recopié — ce total est recalculé à chaque geste du lecteur.
  const recettes = budget.recettes.reduce(
    (s, g) =>
      s + g.signe * g.lignes.reduce((t, l) => t + effectif(l, reglages, PREFIXE_RECETTE), 0),
    0,
  );
  return { depenses, recettes, solde: recettes - depenses };
}

/** Le total de l'ONDAM une fois réglé, et son écart à l'objectif publié.
 *
 *  Deux fonctions à part, et c'est tout l'enjeu : additionner cet objectif aux
 *  charges compterait deux fois 270 Md€, et le retrancher n'aurait pas plus de
 *  sens. Il vit à côté du solde, jamais dedans. */
export function totalObjectif(budget: Budget, reglages: Reglages): number {
  return (budget.objectif?.lignes ?? []).reduce((s, n) => s + effectif(n, reglages), 0);
}

export function ecartObjectif(budget: Budget, reglages: Reglages): number {
  return totalObjectif(budget, reglages) - totalObjectif(budget, new Map());
}

/** L'écart du solde au budget réel, signé : positif = vous avez amélioré le
 *  solde. C'est le seul chiffre de résultat du simulateur. */
export function ecartAuReel(budget: Budget, reglages: Reglages): number {
  return totaux(budget, reglages).solde - totaux(budget, new Map()).solde;
}

/** Le même sous-arbre, tous codes préfixés. Voir `PREFIXE_RECETTE`.
 *
 *  Une copie, pas une mutation : le nœud publié garde son code, et deux appels
 *  successifs ne préfixent pas deux fois. */
export function prefixer(noeud: Noeud): Noeud {
  return {
    ...noeud,
    c: PREFIXE_RECETTE + noeud.c,
    ...(noeud.enfants ? { enfants: noeud.enfants.map(prefixer) } : {}),
  };
}

/** Toutes les lignes du budget, à toute profondeur, par code global. */
export function indexer(budget: Budget): Index {
  const index: Index = new Map();

  const poser = (noeud: Noeud, chemin: string[], ancetres: string[]): void => {
    const libelle = net(noeud.l);
    index.set(noeud.c, {
      code: noeud.c,
      libelle,
      chemin: chemin.join(SEPARATEUR_CHEMIN),
      ancetres,
      cote: "depense",
      signe: 1,
      base: base(noeud),
      noeud,
    });
    for (const enfant of noeud.enfants ?? []) {
      poser(enfant, [...chemin, libelle], [...ancetres, noeud.c]);
    }
  };
  for (const mission of budget.depenses) poser(mission, [], []);

  // Le nœud porte le code préfixé : c'est lui que `coefficient` cherchera, ici
  // comme dans l'arbre des dépenses. Le sous-arbre l'est aussi, quand il y en a.
  const poserLigne = (
    noeud: Noeud,
    cote: Cote,
    signe: number,
    chemin: string[],
    ancetres: string[],
  ): void => {
    const libelle = net(noeud.l);
    index.set(noeud.c, {
      code: noeud.c,
      libelle,
      chemin: chemin.join(SEPARATEUR_CHEMIN),
      ancetres,
      cote,
      signe,
      base: base(noeud),
      noeud,
    });
    for (const enfant of noeud.enfants ?? []) {
      poserLigne(enfant, cote, signe, [...chemin, libelle], [...ancetres, noeud.c]);
    }
  };

  for (const groupe of budget.recettes) {
    for (const ligne of groupe.lignes) {
      poserLigne(prefixer(ligne), "recette", groupe.signe, [net(groupe.t)], []);
    }
  }
  // L'ONDAM porte déjà des codes qui ne peuvent croiser aucun autre : ils
  // viennent d'une nomenclature écrite pour lui. Aucun préfixe n'est nécessaire.
  for (const ligne of budget.objectif?.lignes ?? []) {
    poserLigne(ligne, "objectif", 1, [net(budget.objectif!.t)], []);
  }
  return index;
}

/* --------------------------------------------------------------------------
 * Réglages et partage
 * ----------------------------------------------------------------------- */

/** ±100 points, entiers. Au-delà de −100 % une dépense deviendrait négative :
 *  la borne n'est pas une commodité d'affichage, c'est ce qui garde les
 *  montants dans le monde réel. */
export function borner(valeur: number): number {
  return Number.isFinite(valeur) ? Math.max(-100, Math.min(100, Math.round(valeur))) : 0;
}

export function regler(reglages: Reglages, code: string, valeur: number): void {
  const v = borner(valeur);
  if (v === 0) reglages.delete(code);
  else reglages.set(code, v);
}

/** L'état du simulateur en une chaîne : `CODE:pct,CODE:pct`. Vide si rien
 *  n'est réglé — l'URL ne porte alors pas le paramètre du tout. */
export function encoder(reglages: Reglages): string {
  return [...reglages].map(([code, valeur]) => `${code}:${valeur}`).join(",");
}

/**
 * Le chemin inverse. Un code inconnu est ignoré sans bruit : les codes
 * budgétaires changent d'un exercice à l'autre, et un lien partagé en 2025 doit
 * rester ouvrable en 2026 avec les lignes qui existent encore, plutôt que de
 * s'afficher en erreur pour une action supprimée.
 */
export function decoder(chaine: string, index: Index): Reglages {
  const reglages: Reglages = new Map();
  for (const morceau of chaine.split(",")) {
    const separateur = morceau.lastIndexOf(":");
    if (separateur < 0) continue;
    const code = morceau.slice(0, separateur);
    const valeur = borner(Number(morceau.slice(separateur + 1)));
    if (valeur !== 0 && index.has(code)) reglages.set(code, valeur);
  }
  return reglages;
}

/* --------------------------------------------------------------------------
 * Lecture de l'écart : équivalences, défis, plan
 * ----------------------------------------------------------------------- */

export type Equivalence = { libelle: string; montant: number };

/** Les programmes : le seul niveau dont les intitulés soient des repères
 *  connus (« Vie étudiante », « Police nationale »). Une mission est trop
 *  grosse pour illustrer un geste, une action trop obscure. */
export function programmes(index: Index): Entree[] {
  return [...index.values()].filter((e) => e.cote === "depense" && e.ancetres.length === 1);
}

/**
 * « 4,2 Md€, c'est l'équivalent du programme Vie étudiante. » Traduit un écart
 * en une chose que le lecteur peut se représenter — à condition qu'un
 * programme du **même budget** en soit proche, sinon on ne dit rien.
 */
export function equivalence(candidats: Entree[], montant: number): Equivalence | null {
  const cible = Math.abs(montant);
  if (cible < SEUIL_EQUIVALENCE) return null;
  let meilleur: Entree | null = null;
  for (const p of candidats) {
    if (Math.abs(p.base - cible) / cible >= ECART_EQUIVALENCE) continue;
    if (!meilleur || Math.abs(p.base - cible) < Math.abs(meilleur.base - cible)) meilleur = p;
  }
  return meilleur ? { libelle: meilleur.libelle, montant: meilleur.base } : null;
}

/** Une mission de dépense est « touchée » si elle-même ou l'une de ses lignes,
 *  à n'importe quelle profondeur, porte un réglage. */
export function missionTouchee(index: Index, reglages: Reglages, motif: RegExp): boolean {
  const missions = new Set(
    [...index.values()]
      .filter((e) => e.cote === "depense" && e.ancetres.length === 0 && motif.test(e.libelle))
      .map((e) => e.code),
  );
  if (!missions.size) return false;
  return [...reglages.keys()].some((code) => {
    const entree = index.get(code);
    if (!entree || entree.cote !== "depense") return false;
    return missions.has(code) || entree.ancetres.some((a) => missions.has(a));
  });
}

export type Defi = {
  nom: string;
  reussi: boolean;
  /** Où l'on en est, dans l'unité de la cible (des euros). */
  valeur: number;
  cible: number;
  /** Ce qui empêche la réussite indépendamment du chiffre, ou `null`. */
  obstacle: string | null;
};

const MISSION_ECOLE = /Enseignement scolaire/i;

/** Vrai si le budget porte une mission dont l'intitulé répond au motif.
 *
 *  Un défi qui protège une masse absente du budget serait toujours tenu, et
 *  demanderait de ne pas toucher à quelque chose qui n'y est pas. */
function masseExiste(index: Index, motif: RegExp): boolean {
  return [...index.values()].some(
    (e) => e.cote === "depense" && e.ancetres.length === 0 && motif.test(e.libelle),
  );
}

/**
 * Trois façons de rendre l'exercice fini plutôt qu'infini. Le deuxième défi
 * est le seul qui apprenne quelque chose : il rend visible que les grandes
 * masses ne sont pas où on les cherche, en interdisant la plus grosse — et il
 * ne s'affiche que sur un budget qui la porte.
 */
export function defis(index: Index, reglages: Reglages, ecart: number, solde: number): Defi[] {
  const ecole = missionTouchee(index, reglages, MISSION_ECOLE);
  const protegeable = masseExiste(index, MISSION_ECOLE);
  return [
    { nom: "Dégagez 10 Md€", reussi: ecart >= 1e10, valeur: ecart, cible: 1e10, obstacle: null },
    ...(protegeable
      ? [
          {
            nom: "30 Md€ sans toucher à l'école",
            reussi: ecart >= 3e10 && !ecole,
            valeur: ecart,
            cible: 3e10,
            obstacle: ecole ? "l'école est touchée" : null,
          },
        ]
      : []),
    { nom: "L'équilibre", reussi: solde >= 0, valeur: solde, cible: 0, obstacle: null },
  ];
}

export type LignePlan = {
  entree: Entree;
  pourcentage: number;
  delta: number;
  surSolde: number;
};

/** Les lignes réglées, la plus lourde d'abord. C'est « votre plan » : ce que
 *  vous avez fait, classé par ce que ça pèse, pas par où vous l'avez cliqué. */
export function plan(index: Index, reglages: Reglages): LignePlan[] {
  return [...reglages]
    .flatMap(([code, pourcentage]) => {
      const entree = index.get(code);
      if (!entree) return [];
      const { delta, surSolde } = impact(entree, reglages);
      return [{ entree, pourcentage, delta, surSolde }];
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/* --------------------------------------------------------------------------
 * Recherche
 * ----------------------------------------------------------------------- */

/** Sans accents ni casse : « defense » trouve « Défense », comme partout
 *  ailleurs sur le site. */
export function aplatir(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Toutes les lignes, à toute profondeur, par intitulé, par chemin ou par code.
 *
 * **Chaque mot compte, l'ordre non.** La requête entière devait tenir d'un seul
 * tenant : « aide sociale » ne trouvait rien tant que la ligne ne portait pas
 * ces deux mots collés dans cet ordre, alors que « Aide à l'insertion sociale »
 * est exactement ce qu'on cherchait. Les mots sont désormais cherchés un par
 * un, chacun devant se trouver quelque part dans l'intitulé, le chemin ou le
 * code — c'est le « et » qui fait la précision, pas la contiguïté.
 *
 * **Et le filet est large.** Douze réponses suffisent pour « catalyseurs », pas
 * pour « social », qui traverse quatre missions et des dizaines d'actions : la
 * moitié de ce qu'on cherchait tombait hors de la liste sans qu'on le sache.
 *
 * Les plus grosses d'abord : à requête égale, la ligne qui pèse 80 Md€ intéresse
 * avant celle qui pèse 400 k€.
 */
export function chercher(index: Index, requete: string, limite = 60): Entree[] {
  const mots = aplatir(requete.trim()).split(/\s+/).filter((m) => m.length >= 2);
  if (!mots.length) return [];
  return [...index.values()]
    .filter((e) => {
      const foin = aplatir(`${e.libelle} ${e.chemin} ${e.code}`);
      return mots.every((mot) => foin.includes(mot));
    })
    .sort((a, b) => b.base - a.base)
    .slice(0, limite);
}
