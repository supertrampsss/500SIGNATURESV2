/**
 * Les communes semblables : le repère que le site promettait sans le montrer.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI MANQUAIT, ET CE QUI EXISTAIT DÉJÀ
 * ─────────────────────────────────────────────────────────────────────────
 * « Ma commune dépense-t-elle plus que les communes comparables ? » est l'une
 * des questions de l'accueil, et la page de méthode décrit depuis longtemps le
 * groupe qui y répond — « strate de population, caractère rural, outre-mer,
 * montagne, tourisme, publiés par l'Observatoire des finances locales ». La
 * publication calcule ses quartiles par groupe de pairs depuis le 5 août.
 *
 * **Aucun écran ne le montrait.** Il manquait un seul champ : la clé du groupe
 * se construit des drapeaux d'un territoire, et l'index de la maille — le seul
 * fichier qu'une page d'ensemble charge — ne les portait pas. Il les porte
 * (`semblables`), et le groupe se compose donc dans le navigateur, sans une
 * requête de plus que le palmarès n'en faisait déjà.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI UN PALMARÈS DE GROUPE PLUTÔT QU'UN RANG DE PLUS
 * ─────────────────────────────────────────────────────────────────────────
 * Le palmarès de l'échelon range 34 778 communes ensemble : un village de deux
 * cents habitants et Bordeaux y sont voisins de tableau. C'est utile — « et les
 * autres ? » — et ce n'est pas la question qu'on pose de sa propre commune. Le
 * groupe de pairs répond à celle-là, avec les mêmes notes, le même barème et le
 * même tri : seule change la population comparée.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE CE MODULE REFUSE DE FAIRE
 * ─────────────────────────────────────────────────────────────────────────
 * **Il n'invente aucun intitulé.** Les bornes des strates sont celles que
 * l'OFGL écrit dans la description de sa propre colonne, republiées avec
 * l'index. Une valeur sans intitulé — une strate de plus chez le producteur —
 * ne produit pas « groupe 11 » : elle produit une absence de section. Un
 * groupe qui ne se nomme pas ne se lit pas, et un repère illisible est pire
 * qu'un repère manquant.
 *
 * **Il ne descend pas sous l'effectif minimal publié.** En dessous, la médiane
 * d'un groupe bouge d'un tiers si l'une de ses communes change de politique —
 * c'est la raison pour laquelle la publication écarte déjà ces groupes de ses
 * quartiles, et elle vaut ici mot pour mot.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE ÇA DONNE, MESURÉ SUR LES 34 875 COMMUNES PUBLIÉES
 * ─────────────────────────────────────────────────────────────────────────
 * Balayage des trois rangs de la cascade sur la publication `2026-08-17T1052`,
 * avec les critères que l'OFGL publie et les notes que le site calcule :
 *
 * | Ce que la commune obtient | Communes |
 * |---|---|
 * | son groupe sur les cinq critères | 34 628 |
 * | le jeu de trois critères, le groupe fin étant trop petit | 147 |
 * | le jeu de deux critères | 29 |
 * | aucun groupe : même le jeu le plus large est sous vingt | 64 |
 * | aucun critère publié | 7 |
 *
 * **Les soixante-quatre sans groupe sont toutes d'outre-mer**, et c'est un
 * refus, pas un trou : les onze strates y comptent chacune moins de vingt
 * communes. Retirer le critère d'outre-mer les comparerait à des communes
 * métropolitaines, ce qui est exactement la comparaison que la charte refuse
 * — « aucune comparaison territoriale sans contrôle de définition, périmètre,
 * période et unité ». Le plus petit groupe réellement affiché compte 22
 * communes, toutes notées.
 *
 * Aucun groupe publié n'a toutes ses notes égales : les deux bouts du palmarès
 * de groupe ne s'y recouvrent donc jamais, contrôlé sur les 93 groupes.
 */

import type { IndexTerritoires } from "./repertoire.ts";

/** Le groupe de pairs publié avec l'index d'une maille. */
export type Semblables = {
  /** Les jeux de critères, du plus fin au plus large. */
  cascade: string[][];
  /** En dessous, un groupe ne compare plus. */
  minimum: number;
  /** L'intitulé de chaque valeur : « 10 » -> « de 100 000 habitants et plus ». */
  libelles: Record<string, Record<string, string>>;
  /** Les combinaisons distinctes, dans l'ordre de `cascade[0]`, séparées par
   *  des barres. Écrites une fois : il y en a moins de deux cents pour
   *  trente-quatre mille communes. */
  cles: string[];
  /** Le rang de la clé de chaque territoire, dans l'ordre de `codes`. `null`
   *  quand un critère manque — un groupe composé sur quatre critères au lieu
   *  de cinq rangerait la commune avec d'autres qui ne lui ressemblent pas sur
   *  le cinquième, sans que rien ne le dise. */
  groupe: (number | null)[];
};

/** Le groupe d'un territoire, tel que l'écran le montre. */
export type Groupe = {
  /** Les critères réellement retenus : cinq pour une commune ordinaire, trois
   *  ou deux pour une commune atypique dont le groupe fin est trop petit. */
  criteres: string[];
  /** Ce que le groupe dit de ses membres, dans l'ordre des critères :
   *  « de 100 000 habitants et plus », « urbaines »… */
  intitules: string[];
  /** Les codes du groupe, celui du territoire compris. */
  codes: Set<string>;
};

/**
 * Le groupe d'un territoire : le jeu de critères le plus fin dont l'effectif
 * atteint le minimum publié.
 *
 * La cascade est essayée dans l'ordre. Une commune ordinaire est comparée à ses
 * semblables sur cinq critères ; une commune atypique — une station de montagne
 * d'outre-mer — retombe sur trois puis sur deux, et ne perd pas son repère en
 * gagnant en finesse. Les critères retenus sont rendus avec le groupe : « 48
 * communes de 100 000 habitants et plus, urbaines » et « 8 982 communes de 500
 * à 2 000 habitants » ne veulent pas dire la même chose.
 *
 * `null` si la maille n'a pas de critères (l'OFGL n'en publie que pour les
 * communes), si le territoire n'en porte pas, ou si même le jeu le plus large
 * n'atteint pas l'effectif minimal.
 */
export function groupeDe(index: IndexTerritoires, code: string): Groupe | null {
  const semblables = index.semblables;
  if (!semblables) return null;
  const rang = index.codes.indexOf(code);
  if (rang < 0) return null;
  const sien = semblables.groupe[rang];
  if (sien === null || sien === undefined) return null;

  const fin = semblables.cascade[0] ?? [];
  const parts = (semblables.cles[sien] ?? "").split("|");
  for (const criteres of semblables.cascade) {
    // Chaque jeu de la cascade est un sous-ensemble du premier : c'est ce qui
    // permet de ne publier qu'une clé par territoire. Un critère qui n'y
    // serait pas rendrait le jeu inapplicable — on le saute plutôt que de
    // composer une clé fausse.
    const positions = criteres.map((critere) => fin.indexOf(critere));
    if (positions.some((position) => position < 0)) continue;
    const intitules = criteres.map(
      (critere, i) => semblables.libelles[critere]?.[parts[positions[i]]],
    );
    // Un groupe qui ne se nomme pas ne se lit pas : une valeur inconnue du
    // producteur fait tomber la section entière, jamais un intitulé inventé.
    if (intitules.some((intitule) => !intitule)) continue;
    const cle = positions.map((position) => parts[position]).join("|");
    // La projection est calculée par clé distincte — il y en a moins de deux
    // cents — et non par territoire : autrement chaque rang de la cascade
    // redécouperait trente-quatre mille chaînes.
    const projetees = semblables.cles.map((autre) => {
      const morceaux = autre.split("|");
      return positions.map((position) => morceaux[position]).join("|");
    });
    const codes = new Set<string>();
    index.codes.forEach((autre, i) => {
      const rangCle = semblables.groupe[i];
      if (rangCle !== null && rangCle !== undefined && projetees[rangCle] === cle) {
        codes.add(autre);
      }
    });
    if (codes.size >= semblables.minimum) {
      return { criteres, intitules: intitules as string[], codes };
    }
  }
  return null;
}

/** Le groupe en toutes lettres : « de 100 000 habitants et plus, urbaines, de
 *  métropole, hors montagne, touristiques ». */
export function intituleGroupe(groupe: Groupe): string {
  return groupe.intitules.join(", ");
}
