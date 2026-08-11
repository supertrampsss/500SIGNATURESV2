/**
 * Refaire le barème de l'impôt sur le revenu.
 *
 * Ce module ne connaît pas le DOM. Il tient la distribution publiée des foyers
 * fiscaux par tranche de revenu, l'état des taux réglés, et répond aux quatre
 * questions qu'on pose à un barème : combien il rapporte, qui il touche, à
 * quel taux moyen, et de combien il s'écarte de l'impôt réellement émis.
 *
 * UN PRINCIPE DE CALCUL, et il est ce qui rend l'exercice honnête :
 *
 * **LE RENDEMENT EST EXACT, PAS ESTIMÉ.** Le fichier publie, pour chaque
 * tranche, le nombre de foyers et leur revenu total. Comme tout foyer d'une
 * tranche a un revenu au moins égal à sa borne basse, la somme de ce qui
 * dépasse cette borne vaut « revenu total − foyers × borne », sans aucune
 * hypothèse sur la répartition à l'intérieur de la tranche. La matière taxable
 * d'une tranche marginale s'en déduit, et elle est publiée : `a`. Le rendement
 * d'un barème n'est alors qu'une somme de taux fois assiettes.
 *
 * Cela n'est vrai que parce que les seuils du barème **sont** les bornes
 * publiées par la DGFiP. Un seuil intermédiaire — 45 000 € par exemple —
 * demanderait d'inventer une répartition à l'intérieur d'une tranche : le
 * simulateur n'en propose donc aucun, plutôt que d'en inventer un.
 *
 * Ce qui n'est PAS modélisé, et qui ne doit pas être suggéré ailleurs :
 * l'assiette est le **revenu fiscal de référence du foyer**, pas le revenu net
 * imposable par part. Ni quotient familial, ni décote, ni réductions, ni crédits
 * d'impôt. Et aucun comportement : un taux à 90 % ne rapporte pas ce que dit
 * l'arithmétique.
 */

/** Une tranche publiée : ses bornes, ses foyers, son revenu, son assiette
 *  marginale et l'impôt qui y est réellement émis. */
export type Tranche = {
  /** Borne basse, en euros. */
  b: number;
  /** Borne haute, ou `null` pour la dernière — celle qui n'en a pas. */
  h: number | null;
  /** Foyers fiscaux de la tranche. */
  f: number;
  /** Foyers dont le revenu dépasse la borne basse : ceux que cette tranche du
   *  barème atteint. */
  fa: number;
  /** Revenu fiscal de référence total de la tranche. */
  r: number;
  /** Matière taxable de la tranche marginale. Voir le principe ci-dessus. */
  a: number;
  /** Impôt net réellement émis sur la tranche. Repère, jamais assiette. */
  i: number;
};

export type Bareme = {
  exercice: string;
  titre: string;
  cadre: string;
  note: string;
  foyers: number;
  revenu_total: number;
  /** Impôt sur le revenu réellement émis par voie de rôle. */
  impot_emis: number;
  tranches: Tranche[];
};

/** Borne basse de tranche -> taux en pourcentage. Une tranche absente n'est pas
 *  réglée : « réglée à 0 % » et « pas réglée » sont la même chose ici, et la
 *  table ne garde donc que ce qui n'est pas nul. */
export type Taux = Map<number, number>;

/** Un taux vit entre 0 et 100 %. Au-delà de 100, le barème prendrait plus que
 *  le revenu de la tranche ; en dessous de 0, il en verserait — ce que fait un
 *  crédit d'impôt, que ce simulateur ne modélise pas. */
export function borner(valeur: number): number {
  if (!Number.isFinite(valeur)) return 0;
  // Au dixième de point : le barème fédéral suisse plafonne à 11,5 %, et
  // l'arrondir à 12 changerait le rendement de plusieurs milliards.
  return Math.max(0, Math.min(100, Math.round(valeur * 10) / 10));
}

export function regler(taux: Taux, borne: number, valeur: number): void {
  const v = borner(valeur);
  if (v === 0) taux.delete(borne);
  else taux.set(borne, v);
}

export function tauxDe(taux: Taux, tranche: Tranche): number {
  return taux.get(tranche.b) ?? 0;
}

/** Ce que rapporte une tranche : son taux appliqué à sa matière taxable. */
export function rendementTranche(tranche: Tranche, taux: Taux): number {
  return (tauxDe(taux, tranche) / 100) * tranche.a;
}

export function rendement(bareme: Bareme, taux: Taux): number {
  return bareme.tranches.reduce((s, t) => s + rendementTranche(t, taux), 0);
}

/** L'écart à l'impôt sur le revenu réellement émis. Positif : le barème réglé
 *  rapporte davantage. */
export function ecartAuReel(bareme: Bareme, taux: Taux): number {
  return rendement(bareme, taux) - bareme.impot_emis;
}

/**
 * Combien de foyers paieraient au moins un euro.
 *
 * C'est la réponse à « qui ? », et elle ne se devine pas : ce sont les foyers
 * situés au-dessus de la plus basse tranche dont le taux n'est pas nul. Zéro
 * si le barème est vide.
 */
export function foyersConcernes(bareme: Bareme, taux: Taux): number {
  const premiere = bareme.tranches.find((t) => tauxDe(taux, t) > 0);
  return premiere ? premiere.fa : 0;
}

/** La part des foyers fiscaux que le barème atteint. */
export function partDesFoyers(bareme: Bareme, taux: Taux): number {
  return bareme.foyers ? foyersConcernes(bareme, taux) / bareme.foyers : 0;
}

/**
 * **Qui paie ce que vous venez de changer**, et combien.
 *
 * Un rendement en millions d'euros ne dit rien à personne : « +2 128 M€ » est
 * une abstraction, « 1,4 million de foyers, 1 505 € de plus par an » est une
 * note d'impôt. Les deux nombres sortent du même fichier — la matière taxable
 * de chaque tranche et le nombre de foyers qu'elle atteint — et aucun n'est
 * estimé.
 *
 * Les foyers comptés sont ceux que la tranche modifiée la plus basse atteint :
 * une tranche relevée ne touche personne en dessous de sa borne. La moyenne
 * qui suit est bien une moyenne — dans une tranche, un foyer au bas de la
 * borne paie moins que celui qui est au-dessus.
 *
 * `null` tant que rien n'a bougé.
 */
export function quiPaie(
  bareme: Bareme,
  taux: Taux,
  depart: Taux,
): { total: number; foyers: number; parFoyer: number } | null {
  const total = rendement(bareme, taux) - rendement(bareme, depart);
  if (total === 0) return null;
  const changee = bareme.tranches.find((t) => tauxDe(taux, t) !== tauxDe(depart, t));
  const foyers = changee?.fa ?? 0;
  if (!foyers) return null;
  return { total, foyers, parFoyer: total / foyers };
}

/**
 * Le taux moyen : ce que le barème prend, rapporté à tout le revenu déclaré.
 *
 * Ce n'est **pas** la moyenne des taux affichés. Un barème à 45 % sur la seule
 * tranche des plus de neuf millions d'euros a un taux moyen de 0,3 % : c'est
 * cet écart-là qui apprend quelque chose, et une moyenne de taux le cacherait.
 */
export function tauxMoyen(bareme: Bareme, taux: Taux): number {
  return bareme.revenu_total ? rendement(bareme, taux) / bareme.revenu_total : 0;
}

/** Le taux moyen des seuls foyers atteints, rapporté à leur revenu. */
export function tauxMoyenDesConcernes(bareme: Bareme, taux: Taux): number {
  const premiere = bareme.tranches.findIndex((t) => tauxDe(taux, t) > 0);
  if (premiere < 0) return 0;
  const revenu = bareme.tranches.slice(premiere).reduce((s, t) => s + t.r, 0);
  return revenu ? rendement(bareme, taux) / revenu : 0;
}

/* --------------------------------------------------------------------------
 * Les barèmes tout faits
 * ----------------------------------------------------------------------- */

export type Modele = {
  cle: string;
  nom: string;
  /** Ce que le mode fait, et surtout ce qu'il approxime. Affiché sous les
   *  boutons, jamais en note de bas d'écran. */
  aide: string;
  /** Taux en points par borne de tranche. Un mode ne calcule rien : il pose
   *  des taux, et le rendement se déduit des assiettes publiées. */
  taux: Record<number, number>;
};

/**
 * Trois façons de refaire l'impôt, et trois seulement.
 *
 * Vingt-cinq champs de pourcentage répondaient à la question « quel barème ? »
 * en la reposant vingt-cinq fois. Ce que les gens veulent régler tient en trois
 * gestes : reprendre le barème d'aujourd'hui, tout mettre à un taux unique, ou
 * essayer une progressivité étrangère. Le réglage fin reste, derrière un pli,
 * pour qui le cherche.
 *
 * **Les taux sont rabattus sur les bornes publiées par la DGFiP**, qui ne sont
 * pas celles des barèmes réels : 11 497 €, la première marche française, tombe
 * entre deux bornes et devient 12 000 €. C'est le prix de l'exactitude du
 * rendement — les assiettes ne sont exactes qu'à ces bornes-là — et c'est écrit
 * dans l'aide de chaque mode plutôt que laissé à deviner.
 */
const TAUX_FRANCE: Record<number, number> = {
  12_000: 11, 15_000: 11, 20_000: 11, 30_000: 30, 50_000: 30,
  100_000: 41, 200_000: 45, 300_000: 45, 400_000: 45, 500_000: 45, 600_000: 45,
  700_000: 45, 800_000: 45, 900_000: 45, 1_000_000: 45, 2_000_000: 45,
  3_000_000: 45, 4_000_000: 45, 5_000_000: 45, 6_000_000: 45, 7_000_000: 45,
  8_000_000: 45, 9_000_000: 45,
};

const TAUX_SUISSE: Record<number, number> = {
  15_000: 1, 20_000: 2, 30_000: 3, 50_000: 6,
  100_000: 11, 200_000: 11.5, 300_000: 11.5, 400_000: 11.5, 500_000: 11.5,
  600_000: 11.5, 700_000: 11.5, 800_000: 11.5, 900_000: 11.5, 1_000_000: 11.5,
  2_000_000: 11.5, 3_000_000: 11.5, 4_000_000: 11.5, 5_000_000: 11.5,
  6_000_000: 11.5, 7_000_000: 11.5, 8_000_000: 11.5, 9_000_000: 11.5,
};

export const MODELES: Modele[] = [
  {
    cle: "france",
    nom: "Le barème d'aujourd'hui",
    aide:
      "Les cinq taux de l'impôt sur le revenu français — 0, 11, 30, 41 et 45 % —"
      + " posés sur les bornes publiées, qui ne sont pas exactement les marches"
      + " du barème réel. Et appliqués au revenu du foyer, quand le vrai barème"
      + " s'applique au revenu par part : c'est pourquoi le rendement calculé ici"
      + " dépasse largement l'impôt réellement émis.",
    taux: TAUX_FRANCE,
  },
  {
    cle: "unique",
    nom: "Un taux unique",
    aide:
      "Le même taux sur chaque euro déclaré, du premier au dernier. Réglez-le"
      + " au curseur : le rendement suit.",
    taux: {},
  },
  {
    cle: "suisse",
    nom: "Progressif, façon suisse",
    aide:
      "Les taux de l'impôt fédéral direct suisse, qui monte doucement jusqu'à"
      + " 11,5 %. Attention : en Suisse, l'impôt cantonal et l'impôt communal"
      + " s'ajoutent à celui-là et pèsent bien plus lourd — ce mode ne montre"
      + " donc pas ce que paie un contribuable suisse.",
    taux: TAUX_SUISSE,
  },
];

/** Le taux du curseur par défaut : celui qui rapporte à peu près ce que
 *  rapporte l'impôt réellement émis, 91,7 Md€ sur 1 375 Md€ de revenu déclaré.
 *  Le point de départ est donc « le même argent, tout autrement ». */
export const TAUX_UNIQUE_PAR_DEFAUT = 7;

export function appliquer(bareme: Bareme, modele: Modele, tauxUnique = 0): Taux {
  const taux: Taux = new Map();
  for (const tranche of bareme.tranches) {
    regler(taux, tranche.b, modele.cle === "unique" ? tauxUnique : (modele.taux[tranche.b] ?? 0));
  }
  return taux;
}

/* --------------------------------------------------------------------------
 * Partage
 * ----------------------------------------------------------------------- */

/** L'état du barème en une chaîne : `BORNE:taux,BORNE:taux`. Vide si rien n'est
 *  réglé — l'URL ne porte alors pas le paramètre du tout. */
export function encoder(taux: Taux): string {
  return [...taux]
    .sort((a, b) => a[0] - b[0])
    .map(([borne, valeur]) => `${borne}:${valeur}`)
    .join(",");
}

/** Le chemin inverse. Une borne que le millésime ne porte pas est ignorée sans
 *  bruit : les tranches de la DGFiP peuvent changer, et un lien partagé doit
 *  rester ouvrable avec celles qui existent encore. */
export function decoder(chaine: string, bareme: Bareme): Taux {
  const bornes = new Set(bareme.tranches.map((t) => t.b));
  const taux: Taux = new Map();
  for (const morceau of chaine.split(",")) {
    const [gauche, droite] = morceau.split(":");
    const borne = Number(gauche);
    const valeur = borner(Number(droite));
    if (bornes.has(borne) && valeur !== 0) taux.set(borne, valeur);
  }
  return taux;
}
