/**
 * Le rendu des scénarios : la barre qui les liste, le tableau qui les compare.
 *
 * Deux fonctions pures, sur le modèle d'`analyse-rendu.ts` : chacune rend une
 * chaîne, et c'est cette chaîne qui est testée, jamais le DOM.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Scenario } from "./scenarios.ts";
import type { LigneComparee } from "./comparaison.ts";
import { type Comparable, renduBarre, renduComparaison, renduDisparues } from "./scenarios-rendu.ts";
import { formater } from "./echelle.ts";

const SOURCE = readFileSync(new URL("./scenarios-rendu.ts", import.meta.url), "utf8");

/** Un scénario minimal, pour ne pas répéter les six champs à chaque test. */
function scenario(nom: string, exercice = "2025"): Scenario {
  return { nom, budget: "b64", contrat: "c64", cree_le: "2026-01-01", modifie_le: "2026-01-01", exercice };
}

/** Une colonne comparée minimale. */
function comparable(
  nom: string,
  effort: number,
  gestes: number,
  exercice: string | null = "2025",
  disparues: readonly string[] = [],
  contrat = "",
  lien: string | null = null,
): Comparable {
  return {
    nom,
    etat: { budgets: new Map(), baremes: new Map() },
    effort,
    gestes,
    exercice,
    disparues,
    contrat,
    lien,
  };
}

function ligne(libelle: string, cellules: (number | null)[], base = 1_000_000_000): LigneComparee {
  return { volet: "etat", code: "146", libelle, base, cellules };
}

/**
 * Tous les nombres qu'un rendu donne À LIRE, dans l'ordre.
 *
 * Les balises sont retirées d'abord : un chiffre dans un nom de classe ou une
 * adresse n'est pas un nombre que le lecteur lit. Un token va d'un chiffre
 * jusqu'au bout de son groupe — le séparateur de milliers est l'espace fine
 * insécable (U+202F) que `formater` pose, et la virgule décimale en fait
 * partie — pour que « 1 234,5 » compte pour un nombre et non pour trois.
 */
function nombresLus(html: string): string[] {
  return [...html.replace(/<[^>]*>/g, " ").matchAll(/[0-9][0-9\u202f]*(?:,[0-9]+)?/g)].map(
    (m) => m[0],
  );
}

/** Le premier en-tête de colonne du tableau, balise `<th>` comprise. */
function premierEntete(html: string): string {
  const debut = html.indexOf('<th scope="col" class="scenarios-rendu__entete">');
  return html.slice(debut, html.indexOf("</th>", debut));
}

test("1. la barre liste les scénarios, le courant marqué", () => {
  const html = renduBarre([scenario("Mon budget"), scenario("Un autre")], "Un autre");
  assert.match(html, />Mon budget</);
  assert.match(html, />Un autre</);
  // Le courant se distingue dans le balisage, pas seulement à l'œil.
  const balise = html.slice(html.indexOf('data-nom="Un autre"') - 200, html.indexOf('data-nom="Un autre"') + 50);
  assert.match(balise, /aria-current="true"|scenarios-rendu__scenario--courant/);
  const balisePremier = html.slice(0, html.indexOf('data-nom="Un autre"'));
  assert.doesNotMatch(balisePremier, /aria-current="true"/);
});

test("2. un nom est échappé : un scénario nommé <script> ne produit pas de balise", () => {
  const html = renduBarre([scenario("<script>alert(1)</script>")], null);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("3. la barre sans scénario invite à enregistrer plutôt que d'afficher une liste vide", () => {
  const html = renduBarre([], null);
  assert.doesNotMatch(html, /<li>/);
  assert.doesNotMatch(html, /<ul[^>]*>\s*<\/ul>/);
  assert.match(html, /enregistr/i);
});

test("4. le tableau porte une colonne par comparable, en tête le nom, l'effort et le nombre de gestes", () => {
  const colonnes = [comparable("A", 100_000_000, 2), comparable("B", -50_000_000, 1)];
  const html = renduComparaison(colonnes, [ligne("Défense", [10_000_000, null])]);
  assert.match(html, />A</);
  assert.match(html, />B</);
  assert.match(html, new RegExp(formater(100_000_000, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(formater(-50_000_000, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /2 gestes/);
  assert.match(html, /1 geste\b/);
});

test("5. une cellule null se distingue à l'écran d'un écart nul", () => {
  const colonnes = [comparable("Touché", 0, 1), comparable("Zéro", 0, 1), comparable("Absent", 0, 0)];
  const html = renduComparaison(
    colonnes,
    [ligne("Défense", [10_000_000, 0, null])],
  );
  const zeroAffiche = formater(0, "EUR", false);
  // Les trois cellules produisent trois textes différents : la valeur réglée,
  // le zéro effectivement réglé, et le texte qui dit « non réglé ». Aucun des
  // deux derniers ne doit se confondre.
  const cellules = [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
  assert.equal(cellules.length, 3);
  assert.equal(cellules[0], formater(10_000_000, "EUR", false));
  assert.equal(cellules[1], zeroAffiche);
  assert.notEqual(cellules[2], zeroAffiche);
  assert.notEqual(cellules[2], "");
  assert.match(cellules[2]!, /non réglé/i);
});

test("6. les montants passent par formater : l'attendu se calcule en appelant formater", () => {
  const colonnes = [comparable("A", 1_234_567, 1), comparable("B", 0, 0)];
  const html = renduComparaison(colonnes, [ligne("Défense", [987_654_321, null])]);
  assert.match(html, new RegExp(formater(1_234_567, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(formater(987_654_321, "EUR", false).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  // Le séparateur des milliers est l'espace fine insécable (U+202F), pas
  // l'espace ordinaire : un attendu tapé à la main l'aurait manqué.
  assert.match(formater(987_654_321, "EUR", false), / /);
});

test("7. la légende du tableau dit l'unité, comme exercices.ts et la page d'analyse", () => {
  const html = renduComparaison([comparable("A", 0, 0)], []);
  assert.match(html, /<caption>Montants en millions d'euros\.?<\/caption>/);
});

test("8. aucun total de dépense n'est écrit : tout nombre rendu est celui d'une colonne ou d'une cellule", () => {
  // Les budgets ne s'additionnent pas. La règle se tient sur CE QUE LA
  // FONCTION REND, jamais sur la façon dont elle est écrite : interdire les
  // mots « total » et « somme » dans le source laissait passer un total de
  // dépense publique écrit sous le tableau et appelé « dépense cumulée ».
  //
  // Un montant légitime se rattache ici à une colonne (son effort) ou à une
  // ligne comparée (sa cellule) ; un total ne se rattache à rien. On rend donc
  // la sortie sur des valeurs choisies pour qu'aucune somme parasite ne puisse
  // se confondre avec une valeur légitime — 7, 11, 13, 29, 37 et 41 M€, dont
  // aucune sous-somme ne retombe sur l'une d'elles — puis on vérifie que les
  // nombres lus sont EXACTEMENT les nombres attendus, un pour un. Un nombre de
  // plus, où qu'il soit posé — sous le tableau, dans la légende, dans un pied
  // de tableau — fait rougir ce test.
  const colonnes = [comparable("A", 7_000_000, 2, "2025"), comparable("B", 11_000_000, 3, "2019")];
  const lignes = [
    ligne("Défense", [13_000_000, 29_000_000], 1_000_000_000),
    ligne("Écoles", [37_000_000, 41_000_000], 3_000_000_000),
  ];
  const attendus = [
    // Les montants attendus se PRODUISENT en appelant `formater` : le
    // séparateur de milliers est une espace fine insécable, un attendu tapé à
    // la main l'aurait manqué.
    ...colonnes.flatMap((c) => [
      ...nombresLus(formater(c.effort, "EUR", false)),
      String(c.gestes),
      c.exercice ?? "",
    ]),
    ...lignes.flatMap((l) =>
      l.cellules
        .filter((v): v is number => v !== null)
        .flatMap((v) => nombresLus(formater(v, "EUR", false))),
    ),
  ];
  assert.deepEqual(nombresLus(renduComparaison(colonnes, lignes)).sort(), attendus.sort());
});

test("9. aucun gagnant : ce qu'une colonne rend ne dépend que d'elle", () => {
  // La comparaison ne juge pas. Ce n'est pas le mot « gagnant » qui est
  // interdit — une marque de tête, un rang, une note se posent sans lui — mais
  // le fait qu'une colonne soit désignée meilleure. Or désigner suppose de
  // regarder les autres : une colonne dont le rendu ne dépend que d'elle-même
  // ne peut porter aucune marque de tête.
  //
  // On rend donc deux fois la MÊME colonne, une fois contre une colonne
  // écrasée, une fois contre une colonne écrasante, et on vérifie que ce
  // qu'elle rend n'a pas bougé d'un caractère — en-tête et cellule.
  const mienne = comparable("La mienne", 10_000_000, 2);
  const contre = (autre: Comparable, ecart: number) =>
    renduComparaison([mienne, autre], [ligne("Défense", [13_000_000, ecart])]);
  const faible = contre(comparable("Modeste", 1_000_000, 1), 1_000_000);
  const forte = contre(comparable("Écrasante", 900_000_000, 40), 900_000_000);
  assert.equal(premierEntete(faible), premierEntete(forte));
  const cellule = (html: string) => html.match(/<td[^>]*>[^<]*<\/td>/)![0];
  assert.equal(cellule(faible), cellule(forte));
  // Et l'ordre des colonnes est celui qu'on a donné, jamais un classement :
  // « La mienne » reste en tête alors qu'« Écrasante » pèse quatre-vingt-dix
  // fois plus.
  assert.ok(forte.indexOf("La mienne") < forte.indexOf("Écrasante"));
});

test("9 bis. le montant en tête de colonne est nommé, jamais posé seul au-dessus des écarts", () => {
  // C'est le plus gros chiffre de la colonne, et il est gras : posé sans un
  // mot en tête d'une colonne d'écarts, il se lit comme le TOTAL de cette
  // colonne — la lecture que le lot interdit partout ailleurs. C'est une somme
  // d'écarts, et le mot doit le dire, comme « Exercice 2025 » et « 3 gestes »
  // le disent à côté de lui.
  const effort = 1_234_000_000;
  const entete = premierEntete(renduComparaison([comparable("A", effort, 3)], []));
  const montant = formater(effort, "EUR", false);
  const avant = entete.slice(0, entete.indexOf(montant));
  assert.ok(entete.includes(montant), "le montant doit être en tête de colonne");
  // Le mot est celui qui précède immédiatement le montant : rien d'autre —
  // et surtout aucun autre nombre — ne s'intercale entre le nom et la valeur
  // qu'il nomme. Peu importe qu'il tienne dans la même mention ou juste
  // au-dessus.
  assert.match(avant.replace(/<[^>]*>/g, " "), /écarts[^0-9]*$/i);
});

test("10. deux scénarios construits sur des exercices différents le disent en tête du tableau", () => {
  const colonnes = [comparable("A", 0, 0, "2019"), comparable("B", 0, 0, "2025")];
  const html = renduComparaison(colonnes, []);
  assert.match(html, /2019/);
  assert.match(html, /2025/);
});

test("11. un exercice inconnu (null) se dit explicitement, sans fabriquer de millésime", () => {
  // Un lien partagé ouvert chez un lecteur qui n'a pas le scénario en local,
  // et qui ne portait pas encore l'exercice dans l'adresse : `main.ts` rend
  // alors `null` plutôt que de deviner. Ce module doit le dire en toutes
  // lettres, jamais laisser une case vide ni écrire un an au hasard.
  const colonnes = [comparable("A", 0, 0, null), comparable("B", 0, 0, "2025")];
  const html = renduComparaison(colonnes, []);
  assert.match(html, /exercice inconnu/i);
  assert.match(html, /Exercice 2025/);
  // Aucun millésime à quatre chiffres ne doit apparaître pour la colonne A :
  // on découpe le HTML en deux moitiés à la frontière des deux `<th>` et on
  // vérifie que la première ne porte aucune année.
  const frontiere = html.indexOf(">B<");
  const premiereColonne = html.slice(0, frontiere);
  assert.doesNotMatch(premiereColonne, /\b(19|20)\d{2}\b/);
});

test("11 bis. une colonne au budget vide — le budget voté — se compare comme une autre", () => {
  // Tous réglages à zéro n'est pas une absence de colonne : c'est le budget
  // voté, et le lecteur doit lire son effort nul en tête et « Non réglé » dans
  // ses cellules, jamais un zéro qui se confondrait avec un écart réglé.
  const colonnes = [comparable("Votre budget actuel", 10_000_000, 1), comparable("Budget voté", 0, 0)];
  const html = renduComparaison(colonnes, [ligne("Défense", [10_000_000, null])]);
  const cellules = [...html.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]);
  assert.equal(cellules[1], "Non réglé");
  // L'effort en tête se produit en appelant `formater` : le séparateur
  // décimal et le sigle ne se tapent pas à la main.
  assert.match(html, new RegExp(`>${formater(0, "EUR", false)}<`));
  assert.match(html, />0 geste</);
});

/* --------------------------------------------------------------------------
 * renduDisparues() — les lignes qu'une transposition n'a pas pu reprendre
 * ----------------------------------------------------------------------- */

test("12. le rendu affiche la liste des lignes disparues quand elle n'est pas vide", () => {
  const html = renduDisparues(["Le budget de l'État : 999"], false);
  assert.match(html, /999/);
});

test("13. sans ligne disparue, le rendu ne produit rien", () => {
  assert.equal(renduDisparues([], false), "");
});

test("14. un scénario dont toutes les lignes ont disparu se dit explicitement : rien n'a pu être repris", () => {
  const html = renduDisparues(["Le budget de l'État : 999", "Le budget de l'État : 998"], true);
  // La page ne doit pas rester muette : elle dit qu'aucun réglage n'a survécu.
  assert.match(html, /aucun réglage.*repris|rien.*repris/i);
  assert.match(html, /999/);
  assert.match(html, /998/);
});

test("15. « rien n'a pu être repris » est un fait reçu de la transposition, jamais lu sur l'état vif", () => {
  // Un lecteur charge un scénario dont trois lignes ont survécu et une a
  // disparu, puis remet ses trois curseurs à zéro : l'atelier est alors vide,
  // mais la transposition, elle, avait bien repris quelque chose. La phrase ne
  // doit pas changer sous lui.
  const lignes = ["Le budget de l'État : 999"];
  assert.doesNotMatch(renduDisparues(lignes, false), /aucun réglage/i);
  assert.match(renduDisparues(lignes, true), /aucun réglage/i);
  // Le module ne peut plus faire ce jugement lui-même : il ne reçoit ni volets
  // ni état, donc il n'a rien sur quoi le refaire.
  assert.doesNotMatch(SOURCE, /function renduDisparues\([^)]*EtatAtelier/);
});

test("16. les lignes qu'une colonne n'a pas pu reprendre sont nommées SOUS le tableau, et attribuées à leur colonne", () => {
  // Sans ça, l'en-tête annonce un effort et un nombre de gestes calculés sur
  // un état tronqué, et le lecteur croit la colonne d'en face porteuse de ce
  // que son auteur y avait mis.
  const colonnes = [
    comparable("Chez moi", 10_000_000, 1),
    comparable("Chez mon collègue", 0, 0, "2019", ["Le budget de l'État : 999"]),
  ];
  const html = renduComparaison(colonnes, [ligne("Défense", [10_000_000, null])]);
  assert.match(html, /999/);
  // Le nom de la colonne et la ligne abandonnée se lisent dans le même bloc :
  // la mention dit de quelle colonne elle parle.
  const bloc = html.slice(html.indexOf('class="scenarios-rendu__disparues"'));
  assert.match(bloc, /Chez mon collègue/);
  assert.match(bloc, /999/);
  // Et le bloc arrive après le tableau : une colonne d'écarts n'a pas de case
  // pour une ligne qui n'a pas d'écart.
  assert.ok(html.indexOf("</table>") < html.indexOf('class="scenarios-rendu__disparues"'));
});

test("17. une colonne qui n'a rien perdu n'écrit aucun bloc", () => {
  const html = renduComparaison([comparable("Chez moi", 0, 0)], []);
  assert.doesNotMatch(html, /scenarios-rendu__disparues/);
});

/* --------------------------------------------------------------------------
 * Ce qu'une colonne de référence apporte avec elle : le serment sous lequel
 * son budget a été bâti, et l'analyse dont il vient. `prerendre.ts` écrivait
 * les deux dans `scenarios-reference.json`, `main.ts` n'en lisait aucun.
 * ----------------------------------------------------------------------- */

test("18. le titre d'une colonne qui vient d'une analyse mène à cette analyse", () => {
  const colonnes = [
    comparable("Votre budget actuel", 0, 0),
    comparable("Le budget de la Défense", 0, 0, "2025", [], "", "/analyses/defense-2025/"),
  ];
  const html = renduComparaison(colonnes, []);
  assert.match(html, /<a[^>]*href="\/analyses\/defense-2025\/"[^>]*>Le budget de la Défense<\/a>/);
  // La colonne du lecteur n'a pas de page : elle ne devient pas un lien mort.
  const entetes = html.split('<th scope="col" class="scenarios-rendu__entete">');
  assert.equal(entetes.length, 3);
  assert.doesNotMatch(entetes[1]!, /<a /);
  assert.match(entetes[2]!, /<a /);
});

test("19. les contraintes d'une colonne sont nommées en tête de cette colonne", () => {
  const colonnes = [comparable("Chiffrage", 0, 0, "2025", [], "sans-impot")];
  const html = renduComparaison(colonnes, []);
  // Le nom publié du contrat (mission.ts), pas sa clé : « sans-impot » ne dit
  // rien à un lecteur.
  assert.match(html, /Sous contrainte : sans lever un seul impôt/);
  assert.doesNotMatch(html, /sans-impot/);
});

test("20. deux contraintes se nomment toutes les deux", () => {
  const html = renduComparaison(
    [comparable("Chiffrage", 0, 0, "2025", [], "sans-impot,sans-prestation")],
    [],
  );
  assert.match(html, /sans lever un seul impôt/);
  assert.match(html, /sans baisser une seule prestation/);
});

test("21. un budget sans serment n'écrit pas de ligne de contrainte, et une clé inconnue n'en invente pas", () => {
  assert.doesNotMatch(renduComparaison([comparable("Chiffrage", 0, 0)], []), /Sous contrainte/);
  assert.doesNotMatch(
    renduComparaison([comparable("Chiffrage", 0, 0, "2025", [], "cle-inventee")], []),
    /Sous contrainte/,
  );
});
