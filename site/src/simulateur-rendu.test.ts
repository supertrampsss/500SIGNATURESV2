/**
 * Le rendu du simulateur. Le calcul est vérifié ailleurs (simulateur.test.ts) ;
 * ce qui se joue ici, c'est que l'écran dise exactement ce que le modèle a
 * répondu, et qu'il ne dise rien d'autre.
 *
 * Trois promesses de produit sont donc testées au même titre que le HTML :
 * aucun bloc de prose, aucune couleur de jugement, et rien de cliquable qui
 * mène à une section vide — les trois reproches déjà faits au prototype.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { indexer, regler, totaux, ecartAuReel, defis, plan, programmes, chercher, type Budget, type Reglages } from "./simulateur.ts";
import {
  classeEcart,
  euros,
  eurosSigne,
  exercicesPublies,
  perimetre,
  rendu,
  renduCockpit,
  renduDefis,
  renduDepenses,
  renduLigne,
  renduOnglets,
  renduPlan,
  renduRecettes,
  renduSuggestions,
} from "./simulateur-rendu.ts";

/**
 * Le même budget minuscule que le modèle, à trois détails près qui sont
 * précisément ce que le rendu doit affronter : un cadratin dans un intitulé
 * officiel, une esperluette et un chevron dans un autre.
 */
const BUDGET: Budget = {
  exercice: "2025",
  loi: "PLF",
  mesure: "credit_de_paiement",
  unite: "EUR",
  depenses: [
    {
      c: "DA",
      l: "Défense",
      v: 0,
      enfants: [
        {
          c: "146",
          l: "Équipement des forces",
          v: 0,
          enfants: [
            {
              c: "146-09",
              l: "Engagement et combat",
              v: 0,
              enfants: [
                { c: "146-09-63", l: "Frapper à distance — porte-avions", v: 100_000_000 },
                { c: "146-09-64", l: "Frapper au contact", v: 900_000_000 },
              ],
            },
          ],
        },
        { c: "178", l: "Préparation & emploi des forces", v: 4_000_000_000 },
      ],
    },
    {
      c: "IA",
      l: "Enseignement scolaire",
      v: 0,
      enfants: [{ c: "140", l: "Enseignement public du premier degré", v: 20_000_000_000 }],
    },
  ],
  recettes: [
    {
      t: "Recettes fiscales",
      signe: 1,
      lignes: [
        { c: "1301", l: "Impôt sur les sociétés <IS>", v: 30_000_000_000 },
        { c: "1401", l: "Taxe sur la valeur ajoutée", v: 10_000_000_000 },
      ],
    },
    {
      t: "Prélèvement au profit de l'Union européenne",
      signe: -1,
      lignes: [{ c: "9001", l: "Prélèvement européen", v: 5_000_000_000 }],
    },
  ],
};

const INDEX = indexer(BUDGET);
const RIEN: Reglages = new Map();

function reglages(...paires: [string, number][]): Reglages {
  const table: Reglages = new Map();
  for (const [code, valeur] of paires) regler(table, code, valeur);
  return table;
}

function page(table: Reglages): string {
  return rendu(BUDGET, INDEX, table);
}

/* --------------------------------------------------------------------------
 * Ce qui décide qu'il y a un simulateur
 * ----------------------------------------------------------------------- */

test("un index absent, vide ou malformé ne publie aucun exercice", () => {
  // C'est ce qui fait qu'il n'y a ni onglet, ni entrée de menu, ni message :
  // « pas d'exercice » est le seul état d'absence du simulateur.
  assert.deepEqual(exercicesPublies(undefined), []);
  assert.deepEqual(exercicesPublies(null), []);
  assert.deepEqual(exercicesPublies({}), []);
  assert.deepEqual(exercicesPublies("2025"), []);
  assert.deepEqual(exercicesPublies([2025]), []);
  // La seule forme du contrat : un tableau de chaînes, du plus récent au plus
  // ancien, tel que `publish.py` le dépose.
  assert.deepEqual(exercicesPublies(["2025", "2024"]), ["2025", "2024"]);
  // Une publication qui changerait de forme doit se voir, pas se rattraper : le
  // simulateur disparaît, et c'est un symptôme lisible.
  assert.deepEqual(exercicesPublies({ exercices: ["2025"] }), []);
});

/* --------------------------------------------------------------------------
 * Une ligne réglable
 * ----------------------------------------------------------------------- */

test("une ligne porte les cinq choses qui la rendent pilotable", () => {
  // Libellé, montant de base, contrôle, montant recalculé, écart signé.
  const html = renduLigne(INDEX.get("140")!, reglages(["140", -10]));
  assert.match(html, /data-code="140"/);
  assert.match(html, /Enseignement public du premier degré/);
  assert.match(html, /simu__base[^>]*>20\u202f000\u202fM€/);
  assert.match(html, /class="simu__pct nombre" value="-10"/);
  assert.match(html, /simu__montant[^>]*>18\u202f000\u202fM€/);
  assert.match(html, /simu__delta[^"]*"?[^>]*>−2\u202f000\u202fM€/);
  // Trois commandes plus la remise à zéro, chacune nommée pour un lecteur qui
  // n'a que la voix pour se repérer.
  assert.match(html, /aria-label="Baisser Enseignement public du premier degré de 5 points"/);
  assert.match(html, /aria-label="Monter Enseignement public du premier degré de 5 points"/);
  assert.match(html, /aria-label="Remettre Enseignement public du premier degré à zéro"/);
});

test("un dépliant n'existe que là où il y a quelque chose à déplier", () => {
  // `aria-expanded` sur un nœud, rien sur une feuille : un bouton qui ne fait
  // rien est pire que pas de bouton.
  const mission = renduLigne(INDEX.get("DA")!, RIEN);
  assert.match(mission, /aria-expanded="false"/);
  assert.match(mission, /<div class="simu__enfants" data-enfants="DA" hidden>/);

  const feuille = renduLigne(INDEX.get("140")!, RIEN);
  assert.doesNotMatch(feuille, /aria-expanded/);
  assert.doesNotMatch(feuille, /simu__enfants/);
});

test("l'arbre ne se construit pas d'avance : les missions, et rien dessous", () => {
  // Le PLF 2025 compte plus de mille lignes. Les rendre au chargement pour en
  // montrer une quarantaine, c'est une seconde d'écran figé à chaque ouverture.
  const html = renduDepenses(BUDGET, INDEX, RIEN);
  assert.equal((html.match(/class="simu__ligne/g) ?? []).length, 2);
  assert.match(html, /data-code="DA"/);
  assert.doesNotMatch(html, /data-code="146"/);
  assert.doesNotMatch(html, /data-code="146-09-63"/);
  // Les conteneurs d'enfants sont posés vides : c'est là que le premier dépli
  // écrira.
  assert.match(html, /data-enfants="DA" hidden><\/div>/);
});

test("la remise à zéro d'une ligne intacte est masquée sans quitter la ligne", () => {
  // `hidden` plutôt que retirée : sinon chaque réglage décalait les cinq
  // colonnes de la ligne sous le curseur du lecteur.
  assert.match(renduLigne(INDEX.get("140")!, RIEN), /class="simu__raz"[^>]*hidden/);
  assert.doesNotMatch(renduLigne(INDEX.get("140")!, reglages(["140", -10])), /simu__raz"[^>]*hidden/);
});

test("le montant affiché est celui du modèle, coefficients composés compris", () => {
  // La promesse produit : « je coupe la Défense de 10 %, mais je protège le
  // porte-avions ». 100 M€ × 0,90 × 1,50 = 135 M€, et l'écart vaut +35 M€.
  const table = reglages(["DA", -10], ["146-09-63", 50]);
  const html = renduLigne(INDEX.get("146-09-63")!, table);
  assert.match(html, /simu__montant[^>]*>135,0\u202fM€/);
  assert.match(html, /simu__delta[^>]*>\+35,0\u202fM€/);
});

test("un prélèvement sur recettes s'affiche pour ce qu'il est : une soustraction", () => {
  // Le piège du signe. La ligne pèse 5 Md€, mais elle se déduit des recettes :
  // l'afficher « 5 Md€ » laisserait croire à un encaissement.
  const html = renduRecettes(BUDGET, INDEX, RIEN);
  assert.match(html, /Prélèvement au profit de l&#39;Union européenne \(se déduit\)/);
  assert.match(html, /data-code="r9001"[\s\S]*?simu__base[^>]*>−5\u202f000\u202fM€/);
  assert.match(html, /Recettes fiscales<\/span>\s*<span class="nombre">40\u202f000\u202fM€/);
});

/* --------------------------------------------------------------------------
 * Le sens des couleurs
 * ----------------------------------------------------------------------- */

test("l'écart se colore par son effet sur le solde, jamais en vert", () => {
  // Couper une dépense améliore le solde ; baisser une recette le dégrade. Les
  // deux gestes font *baisser* un montant : c'est l'effet sur le solde qui
  // décide de la couleur, pas le sens de la flèche.
  assert.equal(classeEcart(1), " simu__val--sobre");
  assert.equal(classeEcart(-1), " simu__val--argile");
  assert.equal(classeEcart(0), "");

  const coupe = renduLigne(INDEX.get("140")!, reglages(["140", -10]));
  const baisse = renduLigne(INDEX.get("r1301")!, reglages(["r1301", -10]));
  assert.match(coupe, /simu__delta nombre simu__val--sobre/);
  assert.match(baisse, /simu__delta nombre simu__val--argile/);

  // Le site n'a pas de token vert et n'en invente pas ici : les deux seules
  // classes de couleur de l'écran sont celles-là.
  const html = page(reglages(["140", -10], ["r1301", -10]));
  const classes = new Set([...html.matchAll(/simu__val--(\w+)/g)].map((m) => m[1]));
  assert.deepEqual([...classes].sort(), ["argile", "sobre"]);
  assert.doesNotMatch(html, /vert|green|sauge/i);
});

/* --------------------------------------------------------------------------
 * Cockpit, défis, plan
 * ----------------------------------------------------------------------- */

test("le cockpit donne les quatre nombres et le périmètre en une ligne", () => {
  assert.equal(perimetre(BUDGET), "PLF 2025, budget général, crédits de paiement");
  const html = renduCockpit(BUDGET, INDEX, RIEN);
  for (const nom of ["Dépenses", "Recettes nettes", "Solde", "Votre écart"]) {
    assert.match(html, new RegExp(`<dt>${nom}</dt>`), `compteur ${nom} manquant`);
  }
  // 25 Md€ de dépenses, 30 + 10 − 5 de recettes, un solde de +10 Md€, et aucun
  // écart tant que rien n'est réglé.
  assert.match(html, /<dt>Dépenses<\/dt>\s*<dd class="nombre">25\u202f000\u202fM€/);
  assert.match(html, /<dt>Recettes nettes<\/dt>\s*<dd class="nombre">35\u202f000\u202fM€/);
  // Le solde reste en encre, même en déficit : c'est un fait du budget voté,
  // pas un geste du lecteur. Seul « Votre écart » porte la couleur du sens.
  assert.match(html, /<dt>Solde<\/dt>\s*<dd class="nombre">10\u202f000\u202fM€/);
  assert.doesNotMatch(
    renduCockpit(BUDGET, INDEX, reglages(["r1301", -100])),
    /<dt>Solde<\/dt>\s*<dd class="nombre simu__val/,
  );
  // `Intl` sépare le nombre de sa devise par une espace insécable : la chercher
  // à l'œil dans un test la remplacerait par une espace ordinaire.
  assert.match(html, new RegExp(`<dt>Votre écart</dt>\\s*<dd class="nombre">${euros(0)}`));
});

test("l'équivalence ne s'écrit que quand un programme ressemble vraiment à l'écart", () => {
  // 4,2 Md€ dégagés : « Préparation & emploi des forces » (4 Md€) éclaire.
  const proche = renduCockpit(BUDGET, INDEX, reglages(["140", -21]));
  assert.equal(ecartAuReel(BUDGET, reglages(["140", -21])), 4_200_000_000);
  assert.match(proche, /Soit le programme « Préparation &amp; emploi des forces » \(4\u202f000\u202fM€\)/);
  // 12 Md€ : aucun programme n'en est proche, on se tait plutôt que de comparer
  // ce qui ne se ressemble pas.
  assert.doesNotMatch(renduCockpit(BUDGET, INDEX, reglages(["140", -60])), /Soit le programme/);
});

test("un défi dit sa progression, ou ce qui le bloque, et « tenu » quand il l'est", () => {
  const table = reglages(["140", -60]);
  const ecart = ecartAuReel(BUDGET, table);
  const html = renduDefis(defis(INDEX, table, ecart, totaux(BUDGET, table).solde));
  // 12 Md€ dégagés : le premier défi est tenu.
  assert.match(html, /Dégagez 10 Md€<\/span>\s*<span class="simu__defi-etat nombre">tenu/);
  // Le deuxième ne l'est pas, et ce n'est pas une question de chiffre.
  assert.match(html, /l&#39;école est touchée/);
  assert.match(html, /simu__defi--tenu/);
  // « L'équilibre » a zéro pour cible : on n'écrit pas « sur 0 € ».
  assert.doesNotMatch(html, /sur 0 €/);
});

test("le plan classe par ce que ça pèse et renvoie chaque ligne à sa place", () => {
  const table = reglages(["146-09-63", -50], ["140", -10]);
  const html = renduPlan(plan(INDEX, table), programmes(INDEX));
  const ordre = [...html.matchAll(/data-vise="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ordre, ["140", "146-09-63"]);
  assert.match(html, /Enseignement public du premier degré à −10 %/);
  assert.match(html, /simu__plan-delta nombre simu__val--sobre">−2\u202f000\u202fM€/);
  // Le chemin situe la ligne : sans lui, « Frapper à distance » ne dit pas où.
  assert.match(html, /Défense · Équipement des forces · Engagement et combat/);
});

test("l'onglet « Votre plan » n'existe pas tant qu'il n'y a pas de plan", () => {
  // Règle maison : rien de cliquable ne mène à une section vide. C'est aussi ce
  // qui évite d'écrire un état vide bavard pour meubler.
  const vide = renduOnglets("depenses", 0);
  assert.doesNotMatch(vide, /data-onglet="plan"/);
  assert.match(vide, /data-onglet="depenses"/);

  const plein = renduOnglets("plan", 2);
  assert.match(plein, /data-onglet="plan">Votre plan \(2\)/);
  // `data-onglet` et pas `data-vue` : `<body>` porte déjà `data-vue`, et le
  // `closest` de l'écouteur remontait jusqu'à lui.
  assert.doesNotMatch(plein, /data-vue=/);
  assert.match(plein, /aria-selected="true" aria-controls="simu-vue-plan"/);
});

test("une suggestion porte le code à viser, son chemin et son poids", () => {
  const html = renduSuggestions(chercher(INDEX, "porte-avions"));
  assert.match(html, /data-vise="146-09-63"/);
  assert.match(html, /Frapper à distance - porte-avions/);
  assert.match(html, /Défense · Équipement des forces · Engagement et combat · 100,0\u202fM€/);
});

/* --------------------------------------------------------------------------
 * Les règles de produit, sur la page entière
 * ----------------------------------------------------------------------- */

test("aucun cadratin ni demi-cadratin ne sort à l'écran", () => {
  // Les intitulés officiels en sont pleins ; `net()` les ramène au trait
  // d'union à l'entrée du modèle, et rien ici n'en réintroduit.
  const html = page(reglages(["DA", -10], ["r9001", 20]));
  assert.doesNotMatch(html, /[–—]/);
  assert.match(html, /Frapper à distance - porte-avions|Défense/);
});

test("la page ne contient que deux phrases, et aucun bloc de prose", () => {
  // Deux reprises du commanditaire là-dessus, dont une sur ce prototype
  // précisément : pas de « ce que ce simulateur calcule », pas de « ce qu'il ne
  // promet pas », pas de paragraphe pédagogique.
  const html = page(reglages(["140", -21]));
  const paragraphes = [...html.matchAll(/<p class="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(paragraphes)].sort(),
    ["simu__equivalence", "simu__note", "simu__perimetre"],
  );
  // Le périmètre, à l'endroit exact où il compte.
  assert.match(html, /PLF 2025, budget général, crédits de paiement/);
  // Et l'avertissement de comportement, au-dessus des recettes et nulle part
  // ailleurs.
  const note = "Le rendement réel d'un impôt dépend des comportements : non modélisé.";
  assert.equal(html.split(note).length - 1, 1);
  assert.ok(html.indexOf("id=\"simu-arbre-recettes\"") > html.indexOf("simu__note"));
  // Aucun repli « ce que ces chiffres ne disent pas », aucune liste explicative.
  assert.doesNotMatch(html, /<details|<summary/);
});

test("un libellé publié ne peut pas écrire du HTML", () => {
  // Les intitulés viennent d'un fichier ; ils portent des esperluettes et, un
  // jour, autre chose.
  const html = page(RIEN);
  assert.match(html, /Impôt sur les sociétés &lt;IS&gt;/);
  assert.doesNotMatch(html, /<IS>/);
  // Et jusque dans les libellés des commandes, qui répètent l'intitulé.
  const programme = renduLigne(INDEX.get("178")!, RIEN);
  assert.match(programme, /Préparation &amp; emploi des forces/);
  assert.match(programme, /aria-label="Remettre Préparation &amp; emploi des forces à zéro"/);
});

test("un budget réglé se relit tel quel dans la page entière", () => {
  // Le rendu complet est la somme de ses parties : le cockpit, l'arbre et le
  // plan doivent raconter le même geste.
  const table = reglages(["DA", -10]);
  const html = page(table);
  assert.match(html, /<dt>Dépenses<\/dt>\s*<dd class="nombre">24\u202f500\u202fM€/);
  assert.match(html, /data-code="DA"[\s\S]*?simu__montant[^>]*>4\u202f500\u202fM€/);
  assert.match(html, /data-vise="DA"/);
  assert.equal(euros(24_500_000_000), "24\u202f500\u202fM€");
  assert.equal(eurosSigne(-500_000_000), "−500,0\u202fM€");
  assert.equal(eurosSigne(500_000_000), "+500,0\u202fM€");
});

/* --------------------------------------------------------------------------
 * Le câblage : chargement à la demande, cibles tactiles, absence silencieuse
 * ----------------------------------------------------------------------- */

const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const CSS = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("l'arbre du budget ne se charge qu'à l'ouverture du simulateur", () => {
  // Cent kilo-octets pour une page que la plupart des lecteurs n'ouvriront
  // pas : le démarrage ne demande que l'index des exercices.
  const ouverture = MAIN.slice(
    MAIN.indexOf("async function ouvrirSimulateur"),
    MAIN.indexOf("async function ouvrirSimulateur") + 900,
  );
  assert.ok(ouverture.length > 200, "ouvrirSimulateur introuvable");
  assert.match(ouverture, /donnees\.simulateurBudget\(/);
  assert.equal(MAIN.match(/donnees\.simulateurBudget\(/g)?.length, 1);
  assert.match(MAIN, /void preparerSimulateur\(\);/);
});

test("sans fichier publié, ni entrée de menu ni adresse", () => {
  // L'entrée de menu est écrite par le code, après l'index — jamais dans la
  // page. Et `#simulateur` n'est une vue du site qu'à la même condition.
  assert.doesNotMatch(PAGE.replace(/<!--[\s\S]*?-->/g, ""), /data-vue="simulateur"/);
  assert.match(MAIN, /return exerciceSimulateur \? \[\.\.\.VUES_PAGE, "simulateur"\] : VUES_PAGE;/);
  assert.match(MAIN, /const vue = vuesConnues\(\)\.includes\(demandee\) \? demandee : "carte";/);
});

test("le budget réglé voyage dans l'URL comme le reste de l'écran", () => {
  assert.match(MAIN, /budget: p\.get\("budget"\) \?\? "",/);
  assert.match(MAIN, /if \(etat\.budget\) p\.set\("budget", etat\.budget\);/);
  // Le hash porte la vue de page : le perdre à chaque réglage renverrait le
  // lecteur du simulateur à la carte.
  assert.match(MAIN, /history\.replaceState\(null, "", `\?\$\{p\}\$\{location\.hash\}`\)/);
});

test("les commandes d'une ligne font 44 px pleins, sans zone étendue", () => {
  // Deux zones de frappe étendues côte à côte se recouvrent, et le doigt
  // déclenche la voisine : ici les boutons *sont* à la taille de la cible.
  const bloc = CSS.slice(CSS.indexOf("\n.simu__pas,\n.simu__raz {"));
  assert.match(bloc.slice(0, 400), /min-width: var\(--cible\);\n  min-height: var\(--cible\);/);
  for (const sel of [".simu__pct", ".simu__pli", ".simu__vise", ".simu__creux"]) {
    const regle = CSS.slice(CSS.indexOf(`\n${sel} {`), CSS.indexOf(`\n${sel} {`) + 500);
    assert.match(regle, /(min-height|height): var\(--cible\)/, `${sel} sous la cible`);
  }
  // Le cockpit est collant sous la barre d'en-tête, pas derrière elle.
  assert.match(CSS, /--haut-entete: 3\.6rem;/);
  assert.match(CSS, /\.simu__cockpit \{\n\s*position: sticky;\n\s*top: var\(--haut-entete\);/);
});
