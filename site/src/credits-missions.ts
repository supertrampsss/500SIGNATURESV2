/**
 * Les crédits des missions du budget de l'État : un tableau à deux colonnes,
 * pas soixante-six lignes.
 *
 * La page ANALYSES rangeait le thème « Budget de l'État » en 81 lignes, dont
 * 66 pour les missions — 33 missions × 2 montants, `…_credits_votes` et
 * `…_credits_consommes`, empilés au même niveau et séparés par le tri. Ce
 * n'est pas une liste à plier : c'est un tableau à deux colonnes qui s'était
 * déplié en lignes. Le remettre en colonnes ne fait pas que gagner de la
 * place — il met le voté et le consommé côte à côte, c'est-à-dire l'écart que
 * la première analyse publiée du site existe pour expliquer.
 *
 * Quatre règles tiennent le module.
 *
 * **L'appariement est une convention de nommage, pas une hiérarchie
 * déclarée.** Aucune source ne dit « ces deux séries sont les deux faces d'une
 * même mission » : c'est leur identifiant qui le suggère, et un identifiant
 * n'est pas une déclaration. La convention est donc écrite ici (`MOTIF`),
 * vérifiée deux fois — le suffixe *et* les deux libellés, qui doivent désigner
 * la même mission une fois leur parenthèse retirée — et quand elle ne tient
 * pas, la ligne n'est pas appariée : elle reste dans le tableau ordinaire du
 * thème et le rendu la nomme en rouge. Rien n'est avalé.
 *
 * **Aucun total, aucune somme de missions.** Les 33 missions font davantage
 * que les dépenses nettes du budget général, parce que « Remboursements et
 * dégrèvements » est compté ici en brut et que c'est précisément ce que
 * « nettes » retranche. Une colonne « total » serait fausse d'un tiers. Le
 * seul calcul du module est l'écart *d'une* mission entre ses deux montants,
 * et la légende du tableau dit pourquoi il n'y a pas de ligne de total.
 *
 * **Aucun classement, aucune note.** Les missions sont rangées par écart
 * décroissant : c'est un ordre de lecture, celui du sujet de la section, pas
 * un palmarès — une mission en tête n'est ni meilleure ni pire, elle est
 * seulement celle dont le voté et le consommé s'écartent le plus. La légende
 * le dit au lecteur.
 *
 * **Tous les exercices publiés, chacun avec ses colonnes.** La règle du site
 * — un exercice par colonne — vaut ici aussi : chaque exercice publié par les
 * missions porte ses trois colonnes (votés, consommés, écart), et aucune année
 * ne disparaît au profit de la dernière.
 *
 * Rendu pur, comme `blocs.ts` ou `situation.ts` : aucune touche au DOM, une
 * chaîne en sortie, et c'est cette chaîne qui est testée.
 */

import { MENTION_MILLIONS, millions } from "./echelle.ts";
import { echapper } from "./texte.ts";

/** Une ligne du thème, telle que `analyses.ts` la construit : le nombre publié
 *  par exercice, en euros, à côté du libellé qui l'appelle. */
export type LigneCredits = {
  id: string;
  libelle: string;
  /** Les valeurs publiées, en euros, par exercice. */
  brut: Record<string, number>;
};

export type Mission = {
  /** La clé lue dans l'identifiant — jamais affichée, elle sert à apparier. */
  cle: string;
  /** Le nom de la mission, libellé débarrassé de sa parenthèse. */
  libelle: string;
  votes: Record<string, number>;
  consommes: Record<string, number>;
};

export type Credits = {
  /** Les exercices publiés par les missions, du plus ancien au plus récent. */
  exercices: string[];
  missions: Mission[];
  /** Les lignes qui portent le préfixe des missions mais que la convention
   *  n'a pas su apparier. Elles ne sont pas retenues : elles restent dans le
   *  tableau ordinaire du thème, et le rendu les nomme en rouge. */
  ecartees: LigneCredits[];
  /** Les identifiants effectivement appariés : l'appelant les retire de son
   *  tableau, et lui seul décide quoi faire du reste. */
  retenus: Set<string>;
};

/**
 * La convention de nommage, écrite en un seul endroit.
 *
 * `etat_mission_<clé>_credits_votes` et `etat_mission_<clé>_credits_consommes`
 * sont les deux faces d'une même mission. Ce n'est pas le pipeline qui le
 * déclare — aucun champ du catalogue ne porte cette hiérarchie —, c'est ce
 * motif qui le suppose. Un identifiant qui commence par le préfixe sans finir
 * par l'un des deux suffixes ne s'apparie pas : il rougit.
 */
const PREFIXE = "etat_mission_";
const MOTIF = /^etat_mission_(.+)_(credits_votes|credits_consommes)$/;

/** Le nom de la mission, sa parenthèse retirée : « Défense (crédits votés) »
 *  donne « Défense ». Les deux libellés d'une paire doivent y aboutir au même
 *  nom — c'est le second contrôle de la convention, celui qui porte sur les
 *  mots et non sur l'identifiant. */
function nomDeMission(libelle: string): string {
  return libelle.replace(/\s*\([^)]*\)\s*$/u, "").trim();
}

/**
 * Apparie les lignes de missions, et n'apparie rien d'autre.
 *
 * L'appelant passe **toutes** les lignes de son thème : le module reconnaît
 * les siennes au préfixe et rend dans `retenus` celles qu'il a prises. Ce qui
 * porte le préfixe sans satisfaire la convention part dans `ecartees` — jamais
 * dans `retenus`, donc jamais retiré du tableau du thème.
 */
export function credits(lignes: readonly LigneCredits[]): Credits {
  const paires = new Map<string, { votes?: LigneCredits; consommes?: LigneCredits }>();
  const ecartees: LigneCredits[] = [];
  for (const ligne of lignes) {
    if (!ligne.id.startsWith(PREFIXE)) continue;
    const trouve = MOTIF.exec(ligne.id);
    if (!trouve) {
      // Le préfixe des missions, un suffixe inattendu : la convention ne dit
      // rien de cette ligne, et deviner serait exactement la faute à éviter.
      ecartees.push(ligne);
      continue;
    }
    const [, cle, face] = trouve;
    const paire = paires.get(cle) ?? {};
    if (face === "credits_votes") paire.votes = ligne;
    else paire.consommes = ligne;
    paires.set(cle, paire);
  }

  const missions: Mission[] = [];
  for (const [cle, paire] of paires) {
    const { votes, consommes } = paire;
    // Une mission qui n'aurait qu'un des deux chiffres n'est pas une mission
    // appariée : la mettre seule dans un tableau à deux colonnes laisserait
    // croire que l'autre montant vaut zéro.
    if (!votes || !consommes) {
      ecartees.push(...[votes, consommes].filter((l): l is LigneCredits => l !== undefined));
      continue;
    }
    // Le second contrôle : les deux libellés doivent nommer la même mission.
    // Sans lui, l'appariement ne reposerait que sur la découpe d'une chaîne
    // d'identifiant, et deux missions dont les clés se ressembleraient
    // suffiraient à coller ensemble deux montants sans rapport.
    const nom = nomDeMission(votes.libelle);
    if (nom !== nomDeMission(consommes.libelle)) {
      ecartees.push(votes, consommes);
      continue;
    }
    missions.push({ cle, libelle: nom, votes: votes.brut, consommes: consommes.brut });
  }

  const exercices = [
    ...new Set(
      missions.flatMap((m) => [...Object.keys(m.votes), ...Object.keys(m.consommes)]),
    ),
  ].sort();

  const retenus = new Set(
    missions.flatMap((m) => [`${PREFIXE}${m.cle}_credits_votes`, `${PREFIXE}${m.cle}_credits_consommes`]),
  );
  return { exercices, missions, ecartees, retenus };
}

/** L'écart d'une mission sur un exercice : consommés − votés, et rien quand
 *  l'un des deux manque. Jamais un pourcentage — une mission peut être votée à
 *  zéro et consommée (« Plan de relance », 2025), le rapport n'existerait pas.
 *  C'est un montant, donc pas de variation en % ni en points à déléguer. */
export function ecart(mission: Mission, exercice: string): number | null {
  const vote = mission.votes[exercice];
  const consomme = mission.consommes[exercice];
  if (typeof vote !== "number" || typeof consomme !== "number") return null;
  return consomme - vote;
}

/** Un exercice où exactement un des deux montants est publié : la convention
 *  promettait deux chiffres, il n'y en a qu'un. La cellule d'écart le dit en
 *  rouge plutôt que de rester vide comme une absence ordinaire. */
function boiteux(mission: Mission, exercice: string): boolean {
  const vote = typeof mission.votes[exercice] === "number";
  const consomme = typeof mission.consommes[exercice] === "number";
  return vote !== consomme;
}

export type Resume = {
  /** Le dernier exercice publié : celui sur lequel les trois chiffres se lisent. */
  exercice: string;
  exercices: string[];
  /** Le nombre de missions appariées. Un comptage de lignes, jamais une somme
   *  de montants. */
  nombre: number;
  /** Combien ont consommé plus qu'elles n'avaient voté. */
  audessus: number;
  /** Le plus grand écart en valeur absolue — un fait lu dans les montants, pas
   *  une note donnée à une mission. */
  plusGrand: { libelle: string; ecart: number } | null;
};

/** Les trois chiffres qui ouvrent la section. Aucun n'additionne : deux sont
 *  des comptages de missions, le troisième est l'écart d'une seule mission. */
export function resume(donnees: Credits): Resume | null {
  const exercice = donnees.exercices[donnees.exercices.length - 1];
  if (!exercice || !donnees.missions.length) return null;
  let audessus = 0;
  let plusGrand: { libelle: string; ecart: number } | null = null;
  for (const mission of donnees.missions) {
    const valeur = ecart(mission, exercice);
    if (valeur === null) continue;
    if (valeur > 0) audessus += 1;
    if (!plusGrand || Math.abs(valeur) > Math.abs(plusGrand.ecart)) {
      plusGrand = { libelle: mission.libelle, ecart: valeur };
    }
  }
  return {
    exercice,
    exercices: donnees.exercices,
    nombre: donnees.missions.length,
    audessus,
    plusGrand,
  };
}

const compte = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** Un écart signé : le « + » fait partie de l'information, sans lui une hausse
 *  de consommation se lit comme un niveau. Le « − » vient de `millions`, qui
 *  pose le signe typographique du site. */
function ecartDit(valeur: number): string {
  return `${valeur > 0 ? "+" : ""}${millions(valeur)}`;
}

/** Le montant d'une cellule, ou une cellule vide : un exercice que la source ne
 *  publie pas ne devient pas un zéro. */
function cellule(valeur: number | undefined): string {
  return typeof valeur === "number" ? echapper(millions(valeur)) : "";
}

/**
 * La section : une question, une phrase, trois chiffres, le tableau derrière.
 *
 * Le tableau est replié parce qu'il est le détail, pas parce qu'il serait
 * douteux : les trois chiffres au-dessus en viennent, et le pli les prolonge.
 */
export function rendreCredits(donnees: Credits): string {
  const bilan = resume(donnees);
  const rouge = rendreEcartees(donnees.ecartees);
  if (!bilan) return rouge;

  const chiffres = [
    {
      valeur: compte(bilan.nombre),
      terme: `missions publiées, ${bilan.exercices.length > 1 ? "exercices" : "exercice"} ${bilan.exercices.join(" et ")}`,
    },
    {
      valeur: compte(bilan.audessus),
      terme: `ont consommé plus qu'elles n'avaient voté en ${bilan.exercice}`,
    },
    bilan.plusGrand
      ? {
          valeur: ecartDit(bilan.plusGrand.ecart),
          terme: `le plus grand écart de ${bilan.exercice} : ${bilan.plusGrand.libelle}`,
        }
      : null,
  ].filter((c): c is { valeur: string; terme: string } => c !== null);

  // Un ordre de lecture, pas un palmarès : la section parle de l'écart entre
  // le voté et le consommé, elle commence donc par les missions où il est le
  // plus grand. Aucune mission n'est mieux notée qu'une autre pour autant, et
  // la légende du tableau écrit l'ordre pour que le lecteur ne le prenne pas
  // pour un classement.
  const rangees = [...donnees.missions].sort((a, b) => {
    const ecartA = Math.abs(ecart(a, bilan.exercice) ?? 0);
    const ecartB = Math.abs(ecart(b, bilan.exercice) ?? 0);
    return ecartB - ecartA || a.libelle.localeCompare(b.libelle, "fr");
  });

  const entetes = donnees.exercices
    .map((e) => `<th scope="colgroup" colspan="3">${echapper(e)}</th>`)
    .join("");
  const sousEntetes = donnees.exercices
    .map(
      () =>
        `<th scope="col">Votés</th><th scope="col">Consommés</th><th scope="col">Écart</th>`,
    )
    .join("");

  const lignes = rangees
    .map((mission) => {
      const cellules = donnees.exercices
        .map((exercice) => {
          const valeur = ecart(mission, exercice);
          const troisieme = boiteux(mission, exercice)
            ? `<td class="analyses__valeur credits__manque">un seul des deux chiffres</td>`
            : `<td class="analyses__valeur credits__ecart">${
                valeur === null ? "" : echapper(ecartDit(valeur))
              }</td>`;
          return (
            `<td class="analyses__valeur">${cellule(mission.votes[exercice])}</td>` +
            `<td class="analyses__valeur">${cellule(mission.consommes[exercice])}</td>` +
            troisieme
          );
        })
        .join("");
      return `<tr><th scope="row">${echapper(mission.libelle)}</th>${cellules}</tr>`;
    })
    .join("");

  // La légende porte l'unité, la définition de l'écart, l'ordre des lignes et
  // la raison pour laquelle aucune colonne ne totalise : ce qui change la
  // lecture des chiffres se dit avec eux, jamais en avertissement après eux.
  const legende =
    `<caption>${MENTION_MILLIONS}. Écart = consommés − votés, mission par mission.` +
    ` Missions rangées par écart décroissant sur ${echapper(bilan.exercice)} — un ordre de lecture,` +
    ` pas un classement. Aucune colonne de total : « Remboursements et dégrèvements » est compté` +
    ` ici en brut, et c'est ce que les dépenses nettes du budget général retranchent.</caption>`;

  return `<section class="credits">
    <h4 class="credits__question">Voté, dépensé : est-ce le même chiffre ?</h4>
    <p class="credits__phrase">Chaque mission du budget général porte deux montants par exercice :
      ce que la loi de finances a voté, ce que l'exécution a consommé.</p>
    <div class="credits__chiffres">${chiffres
      .map(
        (c) => `<div class="credits__chiffre">
          <span class="credits__valeur">${echapper(c.valeur)}</span>
          <span class="credits__terme">${echapper(c.terme)}</span>
        </div>`,
      )
      .join("")}</div>
    ${rouge}
    <details class="credits__pli">
      <summary>Les ${compte(bilan.nombre)} missions, votés et consommés, exercice par exercice</summary>
      <div class="analyses__defilement">
        <table class="analyses__table credits__table">
          ${legende}
          <thead>
            <tr><th scope="col" rowspan="2">Mission</th>${entetes}</tr>
            <tr>${sousEntetes}</tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
      </div>
    </details>
  </section>`;
}

/** Ce que la convention n'a pas su apparier, nommé en rouge et par son
 *  identifiant : c'est l'identifiant qui portait la promesse, c'est lui qu'il
 *  faut regarder. Les lignes restent dans le tableau du thème — le rendu
 *  signale, il ne fait pas disparaître. */
function rendreEcartees(ecartees: readonly LigneCredits[]): string {
  if (!ecartees.length) return "";
  const noms = ecartees.map((l) => echapper(l.id)).join(", ");
  return `<p class="credits__anomalie">Convention de nommage non tenue par ${
    ecartees.length > 1 ? "ces séries" : "cette série"
  } : ${noms}. ${
    ecartees.length > 1 ? "Elles restent" : "Elle reste"
  } dans le tableau ci-dessus, sans appariement.</p>`;
}
