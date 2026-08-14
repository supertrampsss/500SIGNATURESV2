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
 */

/** Un scénario du simulateur, tel que gardé dans le dépôt. */
export type Scenario = {
  nom: string;
  budget: string;
  contrat: string;
  cree_le: string;
  modifie_le: string;
  exercice: string;
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

/** Lit la liste des scénarios du dépôt. Un contenu illisible — JSON invalide
 *  ou enveloppe d'une version inconnue — rend une liste vide plutôt que de
 *  lever : un stockage corrompu ne doit pas empêcher d'ouvrir le simulateur. */
function lireScenarios(depot: Depot): Scenario[] {
  const brut = depot.lire();
  if (brut === null) return [];
  try {
    const contenu: unknown = JSON.parse(brut);
    return estEnveloppe(contenu) ? contenu.scenarios : [];
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
 *  est refusé, il n'y a rien à tronquer. */
function nomNettoye(nom: string): string | null {
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
