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
  contribution,
  effort,
  pourcentagePilote,
  reglagesDe,
  reglagesEffectifs,
} from "./atelier.ts";
import type { Bareme } from "./bareme.ts";
import {
  classeEcart,
  euros,
  eurosSigne,
  exercicesPublies,
  exercicesDeLaBranche,
  perimetre,
  renduEffort,
  renduEnteteVolet,
  renduAtelier,
  renduEquivalence,
  renduRaccourcisAtelier,
  renduDefis,
  renduDepenses,
  renduLigne,
  renduPlan,
  renduRecettes,
  renduSuggestionsAtelier,
  resume,
} from "./simulateur-rendu.ts";
import { contratsDe } from "./mission.ts";
import { estAccueil } from "./routes.ts";

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

/** L'atelier de test : un seul volet, celui de l'État. Les fonctions de rendu
 *  n'ont pas besoin de plus, et un second volet n'apprendrait rien de plus sur
 *  la mise en page. */
const VOLET = { genre: "budget" as const, cle: "etat", nom: "État", budget: BUDGET, index: INDEX };
const atelier = (table: Reglages = new Map()) => ({
  budgets: new Map([["etat", table]]),
  baremes: new Map(),
});

function reglages(...paires: [string, number][]): Reglages {
  const table: Reglages = new Map();
  for (const [code, valeur] of paires) regler(table, code, valeur);
  return table;
}

function page(table: Reglages): string {
  return renduAtelier([VOLET], atelier(table));
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

test("la barre de solde porte les trois nombres et le périmètre reste une ligne", () => {
  // L'unité fait partie du cadrage : « Santé 1 643 M€ » se lisait « 1 643
  // milliards » sans elle.
  assert.equal(
    perimetre(BUDGET),
    "PLF 2025, budget général, crédits de paiement, montants en millions d'euros (M€)",
  );
  // Aucun geste : la barre dit la mission — ce qu'il reste à trouver, et
  // l'invitation à commencer.
  const vide = renduEffort([VOLET], atelier());
  assert.match(vide, /Reste à trouver|Mission accomplie/);
  assert.match(vide, /Réglez une ligne/);
  // Et le solde du budget vit dans l'en-tête de sa section, pas dans la barre :
  // les budgets ne s'additionnent pas, seul l'effort le fait.
  assert.match(renduEnteteVolet(VOLET, atelier(), [VOLET]), /10\u202f000\u202fM€/);
});

test("le solde d'un budget s'écrit deux fois dès qu'il a bougé : le voté, puis le vôtre", () => {
  // Un seul nombre ne dit pas ce qu'on vient de changer.
  const html = renduEnteteVolet(VOLET, atelier(reglages(["140", -20])), [VOLET]);
  assert.match(html, /simu__volet-avant nombre">10\u202f000\u202fM€/);
  assert.match(html, /<b class="nombre">14\u202f000\u202fM€/);
});

test("la barre additionne des écarts, jamais des budgets", () => {
  // Le budget général de l'État et les régimes de base ne font pas leur somme :
  // des dizaines de milliards circulent entre eux et chacun les compte de son
  // côté. Ce qui s'additionne, ce sont les gestes.
  const html = renduEffort([VOLET], atelier(reglages(["140", -20])));
  assert.match(html, /\+4\u202f000\u202fM€ depuis le début/);
  assert.match(html, /1 geste/);
  // Et le mot « solde » n'apparaît nulle part dans la barre : ce qu'elle
  // compte, ce sont des écarts et des déficits, jamais une somme de soldes.
  assert.doesNotMatch(html, /[Ss]olde/);
});

/* --------------------------------------------------------------------------
 * Ce qu'un volet fait à un autre
 * ----------------------------------------------------------------------- */

/** Le barème minuscule qui pilote la ligne « r140 » du budget d'essai. */
const BAREME: Bareme = {
  exercice: "2024",
  titre: "Un impôt",
  cadre: "Essai",
  note: "Assiette d'essai.",
  foyers: 100,
  revenu_total: 1000,
  impot_emis: 40,
  tranches: [
    { b: 0, fa: 100, r: 600, a: 600, i: 0 },
    { b: 10, fa: 40, r: 400, a: 400, i: 40 },
  ],
};
const VOLET_BAREME = {
  genre: "bareme" as const,
  cle: "ir",
  nom: "Un impôt",
  bareme: BAREME,
  depart: new Map([[10, 10]]),
  pilote: { volet: "etat", code: "r1301" },
};

test("un barème pilote la ligne qu'il calcule, et n'apporte rien de son côté", () => {
  // Deux commandes pour un même impôt, ce sont deux réponses à la même
  // question : le barème déplace la recette de l'État, il ne s'ajoute pas à
  // côté. Sa contribution propre vaut donc zéro, toujours.
  const monde = [VOLET, VOLET_BAREME];
  const etat = atelier();
  etat.baremes.set("ir", new Map([[10, 20]]));

  // Le rendement double (10 % -> 20 % sur 400) : +100 % sur la ligne pilotée.
  assert.equal(pourcentagePilote(VOLET_BAREME, etat), 100);
  assert.equal(contribution(VOLET_BAREME, etat, monde), 0);

  // Et la ligne d'impôt sur les sociétés de l'État a doublé, elle.
  const ligne = INDEX.get("r1301")!;
  assert.equal(reglagesEffectifs(VOLET, etat, monde).get("r1301"), 100);
  assert.equal(contribution(VOLET, etat, monde), ligne.base);
});

test("une ligne pilotée n'a plus de commande à elle, elle renvoie au barème", () => {
  const monde = [VOLET, VOLET_BAREME];
  const html = renduAtelier(monde, atelier());
  const ligne = html.slice(html.indexOf('data-code="r1301"'));
  const fin = ligne.indexOf("</div>");
  assert.match(ligne.slice(0, fin), /simu__renvoi/);
  assert.doesNotMatch(ligne.slice(0, fin), /data-pas/);
});

test("couper une dotation ne gagne rien : les collectivités perdent ce que l'État gagne", () => {
  // C'est tout l'intérêt de les avoir sur la même page. Le chapitre 31 des
  // recettes de l'État est celui des prélèvements au profit des collectivités ;
  // ce qu'il cesse de verser, elles cessent de le recevoir, à l'euro près.
  const psr = (v: number): Budget => ({
    exercice: "2025",
    loi: "PLF",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [{ c: "DA", l: "Défense", v: 0, enfants: [{ c: "146", l: "Équipement", v: 100 }] }],
    recettes: [
      {
        t: "Prélèvements sur les recettes de l'État au profit des collectivités territoriales",
        signe: -1,
        lignes: [{ c: "3101", l: "Dotation globale de fonctionnement", v }],
      },
    ],
  });
  const concours = (v: number): Budget => ({
    exercice: "2024",
    loi: "OFGL",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [{ c: "d", l: "Dépenses", v: 0 }],
    recettes: [
      { t: "Recettes", signe: 1, lignes: [{ c: "ofgl_concours_de_l_etat", l: "Concours de l'Etat", v }] },
    ],
  });
  const budget = (cle: string, nom: string, b: Budget) => ({
    genre: "budget" as const,
    cle,
    nom,
    budget: b,
    index: indexer(b),
  });
  const monde = [
    budget("etat", "État", psr(40_000)),
    budget("collectivites-commune", "Communes", concours(20_000)),
    budget("collectivites-departement", "Départements", concours(10_000)),
  ];
  const etat = { budgets: new Map(), baremes: new Map() };
  regler(reglagesDe(etat, monde[0]), "r3101", -10);

  // L'État verse 4 000 de moins, donc gagne 4 000.
  assert.equal(contribution(monde[0], etat, monde), 4_000);
  // Les deux échelons perdent 4 000 à eux deux, au prorata de ce qu'ils
  // touchent : 30 000 d'assiette, donc 13,33 % chacun.
  const perdu = contribution(monde[1], etat, monde) + contribution(monde[2], etat, monde);
  assert.ok(Math.abs(perdu + 4_000) < 1e-9, `perdu ${perdu}`);
  // Et l'effort d'ensemble ne bouge pas d'un euro.
  assert.ok(Math.abs(effort(monde, etat)) < 1e-9);
});

test("le presse-papier reçoit un résultat, pas une adresse nue", () => {
  // « Regarde » suivi de trois cents caractères d'adresse n'a jamais donné
  // envie à personne. Et le budget se lit avec la contrainte sous laquelle il
  // a été fait : sans elle, il se lit comme un exploit.
  const texte = resume(
    [VOLET],
    atelier(reglages(["140", -20])),
    contratsDe(["sans-impot"]),
    "https://exemple/#simulateur",
  );
  // Le budget d'essai est en excédent : la mission y est accomplie d'office.
  assert.match(texte, /Mission accomplie/);
  assert.match(texte, /1 geste · L'équilibre franchi/);
  assert.match(texte, /Sous contrainte : sans lever un seul impôt\./);
  assert.match(texte, /https:\/\/exemple/);
  // Sans contrainte, il le dit aussi : le silence se lirait comme un oubli.
  assert.match(resume([VOLET], atelier(), [], "u"), /Sans contrainte\./);
});

test("les défis d'un budget n'apparaissent qu'une fois ce budget touché", () => {
  // Dix budgets qui affichent chacun trois pastilles grises au repos, ce sont
  // trente pastilles qui ne disent rien. Une fois réglé, le budget dit où il en
  // est — et l'écart dit à quel programme il ressemble.
  assert.doesNotMatch(page(new Map()), /simu__defi\b/);
  const html = page(reglages(["140", -21]));
  assert.match(html, /Dégagez 10\u202f000 M€/);
  assert.match(html, /L&#39;équilibre/);
  assert.match(html, /Votre écart, c'est le programme/);
});

test("l'équivalence ne s'écrit que quand un programme ressemble vraiment à l'écart", () => {
  // 4,2 Md€ dégagés : « Préparation & emploi des forces » (4 Md€) éclaire.
  assert.equal(ecartAuReel(BUDGET, reglages(["140", -21])), 4_200_000_000);
  assert.match(
    renduEquivalence(INDEX, 4_200_000_000, "programme"),
    /le programme « Préparation &amp; emploi des forces » \(4\u202f000\u202fM€\)/,
  );
  // 12 Md€ : aucun programme n'en est proche, on se tait plutôt que de comparer
  // ce qui ne se ressemble pas.
  assert.equal(renduEquivalence(INDEX, 12_000_000_000, "programme"), "");
});

test("un défi dit sa progression, ou ce qui le bloque, et « tenu » quand il l'est", () => {
  const table = reglages(["140", -60]);
  const ecart = ecartAuReel(BUDGET, table);
  const html = renduDefis(defis(INDEX, table, ecart, totaux(BUDGET, table).solde));
  // 12 Md€ dégagés : le premier défi est tenu.
  assert.match(html, /Dégagez 10\u202f000 M€<\/span>\s*<span class="simu__defi-etat nombre">tenu/);
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

test("dépenses et recettes se suivent : il n'y a plus d'onglets", () => {
  // On ne peut pas équilibrer un budget en voyant une moitié à la fois.
  const html = renduAtelier([VOLET], atelier());
  assert.doesNotMatch(html, /data-onglet=|role="tab"/);
  assert.ok(
    html.indexOf("Ce qu'il dépense") < html.indexOf("Ce qu'il encaisse"),
    "les dépenses viennent avant les recettes",
  );
});

test("le plan est avant l'arbre, et n'existe pas tant qu'il n'y a pas de plan", () => {
  // Règle maison : rien de cliquable ne mène à une section vide. C'est aussi ce
  // qui évite d'écrire un état vide bavard pour meubler.
  const vide = renduAtelier([VOLET], atelier());
  assert.match(vide, /id="simu-plan-bloc" hidden/);
  assert.ok(
    vide.indexOf('id="simu-plan-bloc"') < vide.indexOf("Ce qu'il dépense"),
    "le plan passe devant l'arbre",
  );
  const plein = renduAtelier([VOLET], atelier(reglages(["140", -20], ["r1301", -10])));
  assert.doesNotMatch(plein, /id="simu-plan-bloc" hidden/);
  assert.match(plein, /2 gestes/);
});

test("la recherche et les raccourcis passent devant l'arbre", () => {
  const html = renduAtelier([VOLET], atelier());
  assert.ok(
    html.indexOf('id="simu-q"') < html.indexOf("Ce qu'il dépense"),
    "la recherche passe devant l'arbre",
  );
});

test("une suggestion porte le code à viser, son chemin et son poids", () => {
  const html = renduSuggestionsAtelier(
    chercher(INDEX, "porte-avions").map((entree) => ({ entree, volet: VOLET })),
  );
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
  assert.deepEqual([...new Set(paragraphes)].sort(), [
    "mission__interdit",
    "mission__quoi",
    "mission__regle",
    "simu__effort-detail",
    "simu__equivalence",
    "simu__note",
    "simu__perimetre",
  ]);
  // La liste seule ne suffirait pas : ce que la règle interdit, c'est le
  // paragraphe, pas la classe. Aucune phrase de la page ne dépasse une ligne
  // de lecture.
  for (const [, texte] of html.matchAll(/<p class="[^"]+"[^>]*>([\s\S]*?)<\/p>/g)) {
    const nu = texte.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    assert.ok(nu.length <= 180, `paragraphe de ${nu.length} signes : « ${nu.slice(0, 90)}… »`);
  }
  // Le périmètre, à l'endroit exact où il compte.
  assert.match(html, /PLF 2025, budget général, crédits de paiement/);
  // Et l'avertissement de comportement, au-dessus des recettes et nulle part
  // ailleurs.
  const note = "Le rendement réel d'un impôt dépend des comportements : non modélisé.";
  assert.equal(html.split(note).length - 1, 1);
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
  // Le total du côté dépenses, dans le titre de son bloc.
  assert.match(html, /Ce qu'il dépense<span class="nombre">24\u202f500\u202fM€/);
  assert.match(html, /data-code="DA"[\s\S]*?simu__montant[^>]*>4\u202f500\u202fM€/);
  assert.match(html, /data-vise="DA"/);
  assert.equal(euros(24_500_000_000), "24\u202f500\u202fM€");
  assert.equal(eurosSigne(-500_000_000), "−500,0\u202fM€");
  assert.equal(eurosSigne(500_000_000), "+500,0\u202fM€");
});

/* --------------------------------------------------------------------------
 * Le câblage : chargement à la demande, cibles tactiles, absence silencieuse
 * ----------------------------------------------------------------------- */

const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const CSS = readFileSync(new URL("./style.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
// BRANCHES, DIT_LA_BRANCHE et fusionnerBranches vivent dans simulateur-volets.ts,
// partagés avec scripts/prerendre.ts : voir ce module pour le pourquoi.
const VOLETS = readFileSync(new URL("./simulateur-volets.ts", import.meta.url), "utf8");

test("les budgets ne se chargent qu'à l'ouverture de l'atelier", () => {
  // Cent kilo-octets pour le seul budget de l'État, sur une page que la plupart
  // des lecteurs n'ouvriront pas : le démarrage ne demande que les index
  // d'exercices, quelques octets chacun.
  // Le corps de la fonction, pas une fenêtre de N caractères après son nom :
  // un commentaire ajouté au-dessus de la règle poussait `afficherAtelier`
  // hors de la fenêtre et faisait rougir ce test sans que la règle ait bougé.
  const ouverture = MAIN.slice(
    MAIN.indexOf("async function ouvrirSimulateur"),
    MAIN.indexOf("async function demarrer"),
  );
  assert.ok(ouverture.length > 200, "ouvrirSimulateur introuvable");
  assert.match(ouverture, /volet\.charger\(exercice\)/);
  assert.match(ouverture, /afficherAtelier\(\$\("simu"\), volets/);
  // Chaque volet déclare son index **et** son chargeur : autant de l'un que de
  // l'autre, sans quoi un volet apparaîtrait au menu sans pouvoir s'ouvrir. On
  // compte les déclarations du fichier, gabarits compris — les cinq branches
  // s'écrivent d'un seul `map`, les trois échelons d'un autre.
  const catalogue = MAIN.slice(
    MAIN.indexOf("const VOLETS_PUBLIES"),
    MAIN.indexOf("/** Les volets dont l'index annonce un exercice"),
  );
  const index = catalogue.match(/^\s*index: /gm)?.length ?? 0;
  assert.ok(index >= 4, `trop peu de volets déclarés : ${index}`);
  assert.equal(catalogue.match(/^\s*charger: /gm)?.length, index);
  assert.match(MAIN, /void preparerSimulateur\(\);/);
});

test("il n'y a plus de barre de pastilles : une seule page, pas deux vues", () => {
  // La barre restait à l'écran à côté du budget affiché : deux vues du même
  // objet coexistaient, et changer de budget effaçait ce qu'on venait de faire.
  assert.doesNotMatch(PAGE, /simu-budgets|simu__budgets/);
  assert.doesNotMatch(MAIN, /peindreChoixDuBudget|budgetAffiche|BUDGETS_SIMULABLES/);
  assert.doesNotMatch(CSS, /\.simu__budgets/);
});

test("sans fichier publié, ni entrée de menu ni adresse", () => {
  // L'entrée de menu est écrite par le code, après les index — jamais dans la
  // page. Et `#simulateur` n'est une vue du site qu'à la même condition : un
  // budget publié au moins, quel qu'il soit.
  assert.doesNotMatch(PAGE.replace(/<!--[\s\S]*?-->/g, ""), /data-vue="simulateur"/);
  assert.match(
    MAIN,
    /return exercicesParVolet\.length \? \[\.\.\.VUES_PAGE, "simulateur"\] : VUES_PAGE;/,
  );
  // La vue de repli est « territoire » : la carte n'est plus la porte d'entrée
  // — et elle n'est même plus une vue, seulement un mode de celle-ci. Depuis
  // que la racine rend l'accueil, `/simulateur` sans budget publié tombe donc
  // sur territoire, jamais sur l'accueil : ce n'est pas la racine.
  assert.match(MAIN, /: estAccueil\(location\.pathname, location\.hash\)\s*\? "accueil"\s*: "territoire";/);
  assert.equal(estAccueil("/simulateur", ""), false);
  assert.doesNotMatch(MAIN, /const VUES_PAGE = \[[^\]]*"carte"/);
});

test("le budget réglé voyage dans l'URL comme le reste de l'écran", () => {
  assert.match(MAIN, /budget: p\.get\("budget"\) \?\? "",/);
  assert.match(MAIN, /if \(etat\.budget\) p\.set\("budget", etat\.budget\);/);
  // Le chemin porte la vue de page : le perdre à chaque réglage renverrait le
  // lecteur du simulateur à la racine.
  assert.match(MAIN, /history\.replaceState\(null, "", `\$\{location\.pathname\}\?\$\{p\}\$\{location\.hash\}`\)/);
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
  // La barre de solde est collante sous l'en-tête, pas derrière elle.
  assert.match(CSS, /--haut-entete: 3\.6rem;/);
  assert.match(CSS, /\.simu__barre-solde \{\n\s*position: sticky;\n\s*top: var\(--haut-entete\);/);
});

test("les raccourcis mènent aux postes dont on débat, jamais aux plus gros", () => {
  // Trier les missions par montant mettrait « Remboursements et dégrèvements »
  // en tête, qui n'est le sujet de personne.
  const html = renduRaccourcisAtelier([VOLET]);
  assert.match(html, /data-vise="140"|data-vise="SB"|data-vise="DA"/);
  // Un code absent de la publication ne fait pas de raccourci mort.
  for (const [, code] of [...html.matchAll(/data-vise="([^"]+)"/g)]) {
    assert.ok(INDEX.has(code), `raccourci vers un code absent : ${code}`);
  }
});

test("« Retraites » sur le budget de l'État renvoie au bon budget", () => {
  // La mission de l'État ne paie que les régimes spéciaux — six milliards. Les
  // pensions du régime général sont la branche vieillesse des régimes de base,
  // qui a désormais son propre budget réglable : le raccourci le dit plutôt que
  // de laisser prendre 6 000 M€ pour le sujet.
  const source = readFileSync(new URL("./simulateur-rendu.ts", import.meta.url), "utf8");
  assert.match(source, /RESERVE_RACCOURCIS/);
  assert.match(source, /régimes spéciaux/);
  assert.match(source, /branche vieillesse des régimes de base/);
});

test("aucun tiret cadratin dans la page réagencée", () => {
  assert.doesNotMatch(renduAtelier([VOLET], atelier(reglages(["140", -20]))), /[–—]/);
});


/* --------------------------------------------- les branches de la Sécu */

test("l'index des branches rend les exercices d'une branche, pas d'une autre", () => {
  const index = ["vieillesse-2026", "maladie-2026", "vieillesse-2025", "atmp-2026"];
  assert.deepEqual(exercicesDeLaBranche(index, "vieillesse"), ["2026", "2025"]);
  assert.deepEqual(exercicesDeLaBranche(index, "atmp"), ["2026"]);
  // Une branche non publiée ne fait pas d'entrée de menu morte.
  assert.deepEqual(exercicesDeLaBranche(index, "autonomie"), []);
  // Un index absent ou d'une autre forme vaut « rien à montrer ».
  assert.deepEqual(exercicesDeLaBranche(null, "vieillesse"), []);
  assert.deepEqual(exercicesDeLaBranche(["vieillesse-"], "vieillesse"), []);
});

test("les cinq branches vivent dans un seul budget, jamais en cinq sections", () => {
  // Cinq sections pour un même ensemble, c'est la nomenclature du code de la
  // Sécurité sociale posée à l'écran telle quelle. Il n'y en a plus qu'une.
  // BRANCHES et fusionnerBranches vivent dans simulateur-volets.ts, partagés
  // avec scripts/prerendre.ts (voir ce module).
  for (const branche of ["vieillesse", "maladie", "famille", "autonomie", "atmp"]) {
    assert.match(VOLETS, new RegExp(`\\["${branche}", "`), `branche ${branche} absente`);
  }
  assert.match(VOLETS, /\["vieillesse", "Retraites", "/);
  assert.match(MAIN, /cle: "secu"/);
  assert.doesNotMatch(MAIN, /cle: `branche-\$\{branche\}`/);
  // Le mot « branche » ne sort pas en intitulé de section : le titre vient du
  // fichier consolidé, qui dit « Le budget de la Sécurité sociale ».
  assert.match(MAIN, /donnees\.simulateurBudgetSecu\(exercice\)/);
  // Et chaque branche dit ce qu'elle paie : « Autonomie » ne se comprend pas
  // seul.
  assert.match(VOLETS, /"Grand âge et handicap/);
});

test("la somme des branches n'est pas le budget de la Sécurité sociale", () => {
  // Elles s'échangent 19 019 M€ que l'une compte en charge et l'autre en
  // produit : additionnées telles quelles, elles annoncent 695 944 M€ quand le
  // consolidé publié en dit 676 925. L'écart entre dans l'arbre, en ligne
  // visible, des deux côtés.
  assert.match(VOLETS, /CODE_ELIMINATION/);
  assert.match(VOLETS, /Transferts entre branches, comptés deux fois/);
  assert.match(VOLETS, /elimineDepense = totalBranches\.depenses - totalConsolide\.depenses/);
});

/**
 * Aucune unité qui ne soit le million d'euros, sur tout l'atelier.
 *
 * `mission.ts` a converti ses paliers de « 10 Md€ » en « 10 000 M€ », et son
 * commentaire nomme la raison : le compteur voisin dit « 159 297 M€ », et
 * savoir si la marche était franchie demandait une conversion de tête. Les
 * défis, sur le MÊME écran et à quelques pixels de là, écrivaient encore
 * « Dégagez 10 Md€ » au-dessus de « +9 520 M€ » — la correction avait été
 * portée dans un module et pas dans son voisin.
 *
 * Ce test ne vise donc pas une chaîne : il balaie ce que l'atelier rend, défis
 * compris, pour qu'une troisième unité ne réapparaisse pas dans un coin que
 * personne ne regarde.
 */
test("l'atelier n'écrit ni Md€ ni k€, nulle part", () => {
  // Un budget réglé : c'est seulement une fois des gestes posés que le bloc des
  // défis et celui du plan paraissent. À vide, ils sont `hidden` et le balayage
  // ne verrait ni l'un ni l'autre.
  const [premiere] = [...INDEX.keys()];
  const html = renduAtelier([VOLET], atelier(reglages([premiere, -10])), []);
  assert.ok(html.length > 1000, "l'atelier n'a rien rendu : le balayage ne prouverait rien");
  for (const unite of ["Md€", "k€"]) {
    assert.ok(
      !html.includes(unite),
      `« ${unite} » dans l'atelier : ${html.slice(Math.max(0, html.indexOf(unite) - 90), html.indexOf(unite) + 40)}`,
    );
  }
});
