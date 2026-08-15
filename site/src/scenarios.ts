/**
 * Le cycle de vie d'un scénario du simulateur.
 *
 * Un scénario est l'état encodé du simulateur — les chaînes `budget` et
 * `contrat` que l'URL porte déjà — plus un nom, des dates, et l'exercice sur
 * lequel il a été construit. Rien ne quitte le navigateur (décision D8) :
 * pas de compte, pas de serveur, seulement `localStorage`.
 *
 * Ce module ne connaît ni le document ni `localStorage` : il reçoit un
 * dépôt (`Depot`), ce qui le rend testable sans navigateur, comme
 * `routes.ts`. Il ne lit pas non plus l'horloge directement — `cree_le` et
 * `modifie_le` viennent d'une fonction injectée, par défaut l'horloge
 * réelle, pour la même raison que le dépôt est injecté : un module qui lit
 * `Date.now()` lui-même n'est pas testable au déterminisme près.
 *
 * L'enveloppe stockée porte une version (`{ v: 1, scenarios: [...] }`) :
 * sans elle, un changement de forme ultérieur du type `Scenario` casserait
 * silencieusement les scénarios déjà enregistrés chez le lecteur, au lieu
 * d'être détecté et de retomber proprement sur une liste vide.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * REJOUER UN SCÉNARIO SUR L'EXERCICE COURANT (`transposer`)
 * ─────────────────────────────────────────────────────────────────────────
 * Un scénario enregistré sur un exercice révolu doit se rejouer sur
 * l'exercice courant. Ça marche parce que les réglages sont des
 * *coefficients* (atelier.ts), pas des montants : couper une ligne de 10 %
 * signifie la même chose quelle que soit sa base cette année-là.
 *
 * Ce qui ne se transpose pas, c'est une ligne que la nomenclature a laissée
 * tomber depuis. `decoder` (atelier.ts) l'ignore déjà, sans lever — c'est
 * documenté dans sa propre docstring — mais il le fait en silence : rien
 * dans son retour ne dit ce qu'il a écarté. `transposer` referme cet écart
 * en reparcourant les mêmes morceaux que `decoder`, seulement pour nommer
 * ceux qui n'ont pas survécu.
 *
 * `decoder` écarte aussi un morceau dont la valeur ne se lit pas (`NaN`,
 * `Infinity`) — une chaîne corrompue, à la main ou par un lien mal recopié —
 * même quand le code, lui, existe toujours. Ce n'est pas la même disparition
 * qu'une ligne que la nomenclature a laissée tomber : le code est là, c'est
 * la valeur qui ne l'est pas. `transposer` le nomme quand même, avec un mot
 * qui dit lequel des deux faits s'est produit, plutôt que de laisser croire
 * que la ligne a simplement cessé d'exister.
 *
 * Le cœur du travail ne dépend que de la chaîne encodée et des volets :
 * `transposerBudget` le porte, et `transposer` le lui délègue. Tout budget
 * qui devient un état de l'atelier passe donc par la même porte — celui d'un
 * scénario cliqué, celui qu'une adresse partagée apporte, celui d'une colonne
 * comparée — sans que deux implémentations puissent diverger.
 */

import { decoder, gestes, type EtatAtelier, type Volet } from "./atelier.ts";

/** Un scénario du simulateur, tel que gardé dans le dépôt.
 *
 *  `exercice` vaut `null` quand il est inconnu — l'atelier n'avait aucun volet
 *  monté au moment de l'enregistrement. **Une seule sentinelle pour ce fait**,
 *  celle-là : la chaîne vide ne dit pas « inconnu », et deux façons de le dire
 *  faisaient rendre au tableau de comparaison « Exercice » suivi de rien,
 *  parce que `??` ne rattrape pas `""`. C'est la même sentinelle que
 *  `Comparable.exercice` (scenarios-rendu.ts), qui l'affiche. */
export type Scenario = {
  nom: string;
  budget: string;
  contrat: string;
  cree_le: string;
  modifie_le: string;
  exercice: string | null;
};

/** Le dépôt où vivent les scénarios. En production, une enveloppe autour de
 *  `localStorage` ; dans les tests, un objet en mémoire. */
export type Depot = {
  lire(): string | null;
  ecrire(contenu: string): void;
};

/** Longueur maximale d'un nom de scénario. Une limite d'affichage : un nom
 *  plus long est tronqué, jamais rejeté — le lecteur ne doit pas perdre son
 *  travail pour avoir trop tapé. */
export const NOM_MAX = 60;

/** Version courante de l'enveloppe stockée. */
const VERSION = 1;

type Enveloppe = { v: typeof VERSION; scenarios: Scenario[] };

/** Ce que fournit l'appelant pour enregistrer ou dupliquer un scénario : tout
 *  sauf les dates, que ce module fixe lui-même. */
type Brouillon = Omit<Scenario, "cree_le" | "modifie_le">;

function estEnveloppe(valeur: unknown): valeur is Enveloppe {
  return (
    typeof valeur === "object" &&
    valeur !== null &&
    (valeur as { v?: unknown }).v === VERSION &&
    Array.isArray((valeur as { scenarios?: unknown }).scenarios)
  );
}

/**
 * Une entrée du dépôt, relue et contrôlée.
 *
 * L'enveloppe était vérifiée, ses entrées non : n'importe quelle forme pouvait
 * ensuite circuler sous le type `Scenario`. Une entrée dont un champ manque ou
 * n'est pas du bon type est écartée, et elle seule — un scénario abîmé
 * n'emporte pas les autres.
 *
 * C'est aussi ici que la sentinelle de l'exercice inconnu est tenue : une
 * entrée écrite avant elle porte `""`, et se relit `null`.
 */
function scenarioLu(valeur: unknown): Scenario | null {
  if (typeof valeur !== "object" || valeur === null) return null;
  const e = valeur as Record<string, unknown>;
  for (const champ of ["nom", "budget", "contrat", "cree_le", "modifie_le"]) {
    if (typeof e[champ] !== "string") return null;
  }
  if (e.exercice !== null && typeof e.exercice !== "string") return null;
  return {
    nom: e.nom as string,
    budget: e.budget as string,
    contrat: e.contrat as string,
    cree_le: e.cree_le as string,
    modifie_le: e.modifie_le as string,
    exercice: (e.exercice as string | null) || null,
  };
}

/** Lit la liste des scénarios du dépôt. Un contenu illisible — JSON invalide
 *  ou enveloppe d'une version inconnue — rend une liste vide plutôt que de
 *  lever : un stockage corrompu ne doit pas empêcher d'ouvrir le simulateur. */
function lireScenarios(depot: Depot): Scenario[] {
  const brut = depot.lire();
  if (brut === null) return [];
  try {
    const contenu: unknown = JSON.parse(brut);
    if (!estEnveloppe(contenu)) return [];
    return (contenu.scenarios as unknown[])
      .map(scenarioLu)
      .filter((s): s is Scenario => s !== null);
  } catch {
    return [];
  }
}

/** Écrit la liste dans le dépôt et la rend telle quelle. Si `ecrire` lève —
 *  quota dépassé, navigation privée stricte — l'échec est avalé : seule la
 *  persistance est perdue, l'appelant reçoit quand même la liste à jour. */
function ecrireScenarios(depot: Depot, scenarios: Scenario[]): Scenario[] {
  const enveloppe: Enveloppe = { v: VERSION, scenarios };
  try {
    depot.ecrire(JSON.stringify(enveloppe));
  } catch {
    // Persistance perdue, pas l'opération : voir la docstring ci-dessus.
  }
  return scenarios;
}

/** Nettoie un nom saisi : coupe les espaces autour, tronque à `NOM_MAX`.
 *  `null` si rien ne reste après nettoyage — un nom vide ou fait d'espaces
 *  est refusé, il n'y a rien à tronquer.
 *
 *  Exporté parce que l'appelant doit savoir sous quel nom un scénario a été
 *  écrit — pour marquer le courant, pour que l'adresse ne nomme pas un
 *  scénario qui n'existe pas. `main.ts` refaisait ce `trim().slice()` de son
 *  côté : deux copies d'une règle qui doit rester identique, dont l'une
 *  pouvait s'écarter de ce qui est réellement stocké. */
export function nomNettoye(nom: string): string | null {
  const propre = nom.trim().slice(0, NOM_MAX);
  return propre.length > 0 ? propre : null;
}

/** La liste des scénarios gardés dans le dépôt. */
export function lister(depot: Depot): Scenario[] {
  return lireScenarios(depot);
}

/**
 * Enregistre un scénario. Un nom déjà pris **remplace** l'entrée existante
 * et met `modifie_le` à jour sans dupliquer : c'est « Enregistrer » sur un
 * scénario déjà ouvert, pas « Dupliquer ». Un nom vide ou fait d'espaces est
 * refusé, la liste rendue est inchangée.
 */
export function enregistrer(
  depot: Depot,
  s: Brouillon,
  horloge: () => string = () => new Date().toISOString(),
): Scenario[] {
  const scenarios = lireScenarios(depot);
  const nom = nomNettoye(s.nom);
  if (nom === null) return scenarios;
  const existant = scenarios.find((sc) => sc.nom === nom);
  const maintenant = horloge();
  const enregistre: Scenario = {
    ...s,
    nom,
    cree_le: existant?.cree_le ?? maintenant,
    modifie_le: maintenant,
  };
  const suivants = existant
    ? scenarios.map((sc) => (sc.nom === nom ? enregistre : sc))
    : [...scenarios, enregistre];
  return ecrireScenarios(depot, suivants);
}

/**
 * Renomme un scénario. Contrairement à `enregistrer`, un nom déjà pris par
 * un **autre** scénario est refusé plutôt que remplacé : renommer vers un
 * nom pris détruirait ce scénario-là, ce qu'un simple changement de nom ne
 * doit jamais faire. La liste rendue est alors inchangée, comme pour un nom
 * absent ou un nom vide.
 */
export function renommer(
  depot: Depot,
  nom: string,
  nouveau: string,
  horloge: () => string = () => new Date().toISOString(),
): Scenario[] {
  const scenarios = lireScenarios(depot);
  if (!scenarios.some((sc) => sc.nom === nom)) return scenarios;
  const nomPropre = nomNettoye(nouveau);
  if (nomPropre === null) return scenarios;
  if (nomPropre !== nom && scenarios.some((sc) => sc.nom === nomPropre)) {
    return scenarios;
  }
  const maintenant = horloge();
  const suivants = scenarios.map((sc) =>
    sc.nom === nom ? { ...sc, nom: nomPropre, modifie_le: maintenant } : sc,
  );
  return ecrireScenarios(depot, suivants);
}

/**
 * Duplique un scénario sous le nom « Copie de X ». Si ce nom est déjà pris —
 * une deuxième duplication du même scénario — un numéro est ajouté pour ne
 * pas collisionner : « Copie de X (2) », puis (3), etc.
 *
 * Invariant : deux scénarios stockés ne partagent jamais leur `nom`. Les noms
 * déjà présents dans `noms` sont ceux réellement stockés, donc déjà tronqués
 * à `NOM_MAX` — comparer un candidat non tronqué contre eux peut manquer une
 * collision que la troncature ferait apparaître après coup. Le candidat est
 * donc tronqué *avant* le test de collision, jamais après : ce qu'on compare
 * est ce qui sera écrit. La troncature réserve aussi la place du suffixe
 * « (n) » en coupant la base, pas la chaîne finale — sinon un nom déjà à la
 * limite verrait son « (2) » tronqué à son tour, et retomberait sur le nom
 * de la copie précédente.
 */
export function dupliquer(
  depot: Depot,
  nom: string,
  horloge: () => string = () => new Date().toISOString(),
): Scenario[] {
  const scenarios = lireScenarios(depot);
  const source = scenarios.find((sc) => sc.nom === nom);
  if (!source) return scenarios;
  const noms = new Set(scenarios.map((sc) => sc.nom));
  const base = `Copie de ${nom}`;
  const nomTronque = (suffixe: string): string => {
    const limite = Math.max(0, NOM_MAX - suffixe.length);
    return `${base.slice(0, limite).trimEnd()}${suffixe}`;
  };
  let candidat = nomTronque("");
  for (let n = 2; noms.has(candidat); n++) {
    candidat = nomTronque(` (${n})`);
  }
  const maintenant = horloge();
  const copie: Scenario = {
    ...source,
    nom: candidat,
    cree_le: maintenant,
    modifie_le: maintenant,
  };
  return ecrireScenarios(depot, [...scenarios, copie]);
}

/** Retire un scénario. Un nom absent ne lève pas : la liste rendue est
 *  simplement celle d'avant, inchangée. */
export function supprimer(depot: Depot, nom: string): Scenario[] {
  const scenarios = lireScenarios(depot);
  const suivants = scenarios.filter((sc) => sc.nom !== nom);
  return ecrireScenarios(depot, suivants);
}

/* --------------------------------------------------------------------------
 * transposer() — rejouer un scénario sur l'exercice courant
 * ----------------------------------------------------------------------- */

/** Le même séparateur que `SEPARATEUR_VOLET` (atelier.ts), non exporté de
 *  là-bas. `decoder` connaît déjà ce format ; on ne le réutilise ici que
 *  pour retrouver quels morceaux il a écartés, jamais pour refaire son
 *  calcul (bornage des pourcentages, table des tranches, etc.), qui reste
 *  entièrement le sien. */
const SEPARATEUR_VOLET = "/";

/** La ligne visée par `code` existe-t-elle encore dans ce volet ? Le même
 *  test que `decoder` applique avant d'écrire un réglage — pas dupliqué à
 *  la légère : c'est la seule façon de distinguer une ligne disparue d'une
 *  ligne simplement réglée à zéro, que la table de réglages ne garde jamais
 *  (voir la docstring de `decoder`). */
function ligneExiste(volet: Volet, code: string): boolean {
  if (volet.genre === "budget") return volet.index.has(code);
  const borne = Number(code);
  return volet.bareme.tranches.some((tranche) => tranche.b === borne);
}

/** Ce qu'une transposition a repris, et ce qu'elle a laissé. */
export type Transposition = {
  etat: EtatAtelier;
  /** Volet et code de chaque ligne que le budget réglait et que l'état rendu
   *  ne porte pas. */
  disparues: string[];
  /** Aucun réglage n'a survécu à la transposition. Le fait est décidé ici,
   *  où la transposition a lieu, jamais au rendu : entre les deux, le lecteur
   *  peut avoir remis ses propres curseurs à zéro, et un atelier vide ne dit
   *  alors plus rien de ce que la transposition a repris. */
  rienRepris: boolean;
};

/**
 * Rejoue un budget encodé contre les volets de l'exercice courant.
 *
 * `etat` vient tel quel de `decoder` : c'est lui qui sait composer un état
 * de l'atelier, `transposerBudget` ne refait pas ce travail. `disparues`
 * liste, volet et code, chaque ligne que le budget réglait et que l'état
 * rendu ne porte plus — soit que la nomenclature courante ne la porte plus (y
 * compris quand c'est le volet entier qui a disparu), soit que sa valeur ne
 * se lise plus, auquel cas la mention le dit. Une ligne mal formée dans la
 * chaîne (ancien format sans volet, chaîne corrompue) n'est pas une ligne
 * disparue : `decoder` l'ignore de la même façon, ce n'est pas une ligne du
 * tout.
 */
export function transposerBudget(budget: string, volets: readonly Volet[]): Transposition {
  const etat = decoder(budget, volets);
  const disparues: string[] = [];
  for (const morceau of budget.split(",")) {
    const barre = morceau.indexOf(SEPARATEUR_VOLET);
    const separateur = morceau.lastIndexOf(":");
    if (barre < 0 || separateur < barre) continue;
    const cleVolet = morceau.slice(0, barre);
    const code = morceau.slice(barre + 1, separateur);
    const volet = volets.find((v) => v.cle === cleVolet);
    if (!volet || !ligneExiste(volet, code)) {
      disparues.push(`${volet?.nom ?? cleVolet} : ${code}`);
      continue;
    }
    // La ligne existe toujours dans la nomenclature, mais `decoder` l'écarte
    // quand même si sa valeur ne se lit pas (`NaN`, `Infinity`) : un fait
    // différent d'une ligne disparue, que la mention distingue plutôt que de
    // laisser croire à une disparition de nomenclature qui n'a pas eu lieu.
    const valeur = Number(morceau.slice(separateur + 1));
    if (!Number.isFinite(valeur)) {
      disparues.push(`${volet.nom} : ${code} (valeur illisible)`);
    }
  }
  // `gestes` matérialise au passage les tables de volet absentes
  // (`reglagesDe` et `tauxDe`, atelier.ts) : il est mesuré sur une copie de
  // surface, pour que l'état rendu reste exactement celui que `decoder` a
  // composé — un volet qui n'a rien repris n'y gagne pas une table vide.
  const copie: EtatAtelier = { budgets: new Map(etat.budgets), baremes: new Map(etat.baremes) };
  return { etat, disparues, rienRepris: gestes(volets, copie) === 0 };
}

/** Rejoue un scénario enregistré. Le budget est la seule chose qui se
 *  transpose : le nom, les dates et l'exercice d'origine ne se rejouent pas. */
export function transposer(scenario: Scenario, volets: readonly Volet[]): Transposition {
  return transposerBudget(scenario.budget, volets);
}
