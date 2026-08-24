/**
 * L'aperçu d'un scénario partagé.
 *
 * Trois garanties, et chacune protège un défaut qui ne se voit qu'une fois le
 * lien posté, c'est-à-dire trop tard :
 *
 * 1. **l'aperçu dit ce que la page montrera** — mêmes `decoder`, `plan` et
 *    `effort` que l'atelier, même entrepôt de données que le navigateur ;
 * 2. **une adresse sans budget garde les métadonnées du site** — un robot qui
 *    reçoit une erreur, ou un aperçu vide, n'affiche rien du tout ;
 * 3. **le document servi ne porte qu'un jeu de balises** — une plateforme qui
 *    en lit deux en choisit un, et lequel ne se sait jamais d'avance.
 *
 * Les montants attendus sont **produits en appelant `formater`**, jamais tapés :
 * les séparateurs du site sont des espaces fines insécables (U+202F), qu'aucun
 * clavier ne distingue d'une espace ordinaire.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { apercuScenario, poserApercu, IMAGE_SCENARIO } from "./apercu-scenario.ts";
import { encoder, etatVide, reglagesDe, type Volet, type VoletBudget } from "./atelier.ts";
import { formater } from "./echelle.ts";
import { indexer, type Budget } from "./simulateur.ts";
import { BASE_DONNEES } from "./simulateur-volets.ts";

const ICI = path.dirname(fileURLToPath(import.meta.url));

/** Un montant d'écart tel que l'écran l'écrit : le million partout, et le
 *  « + » que `formater` ne met jamais. Produit, jamais tapé. */
function ecart(montant: number): string {
  const rendu = formater(montant, "EUR", false);
  return montant > 0 ? `+${rendu}` : rendu;
}

/** Un budget de quatre lignes, de poids volontairement mêlés : la plus grosse
 *  est déclarée en dernier, si bien qu'un aperçu qui garderait l'ordre de
 *  déclaration au lieu du poids se verrait tout de suite. */
function budgetEtat(): Budget {
  return {
    exercice: "2025",
    loi: "PLF",
    mesure: "credit_de_paiement",
    unite: "EUR",
    depenses: [
      { c: "A", l: "Petite ligne", v: 1_000_000_000 },
      { c: "B", l: "Ligne moyenne", v: 10_000_000_000 },
      { c: "C", l: "Ligne légère", v: 2_000_000_000 },
      { c: "D", l: "Grosse ligne", v: 100_000_000_000 },
    ],
    recettes: [],
  };
}

function voletEtat(budget: Budget = budgetEtat()): VoletBudget {
  return { genre: "budget", cle: "etat", nom: "État", budget, index: indexer(budget) };
}

/**
 * Un second budget, d'un autre millésime que le premier.
 *
 * `loi` et `exercice` sont ceux que la publication porte réellement — le
 * fichier `simulateur/secu-2026.json` déclare « PLFSS » et « 2026 », comme
 * `etat-2025.json` déclare « PLF » et « 2025 ». Rien n'est inventé ici : c'est
 * précisément le désaccord de millésimes que ces tests éprouvent.
 */
function voletSecu(): VoletBudget {
  const budget: Budget = {
    exercice: "2026",
    loi: "PLFSS",
    unite: "EUR",
    depenses: [{ c: "D-PRE", l: "Prestations sociales", v: 600_000_000_000 }],
    recettes: [],
  };
  return { genre: "budget", cle: "secu", nom: "Sécurité sociale", budget, index: indexer(budget) };
}

/** Un échelon de collectivités. Les trois échelons publiés partagent le même
 *  cadre — « Comptes de gestion 2025 » — et c'est ce que la dernière assertion
 *  du test des millésimes multiples vient constater. */
function voletEchelon(cle: string, nom: string, code: string): VoletBudget {
  const budget: Budget = {
    exercice: "2025",
    loi: "Comptes de gestion",
    unite: "EUR",
    depenses: [{ c: code, l: `Dépenses des ${nom}`, v: 50_000_000_000 }],
    recettes: [],
  };
  return { genre: "budget", cle, nom, budget, index: indexer(budget) };
}

/** Un budget réglé, encodé par `encoder()` — la chaîne que l'adresse porte
 *  réellement, jamais une chaîne écrite à la main pour le test. */
function budgetEncode(volets: readonly Volet[], reglages: [string, number][]): string {
  const etat = etatVide();
  const volet = volets[0] as VoletBudget;
  for (const [code, pourcentage] of reglages) reglagesDe(etat, volet).set(code, pourcentage);
  return encoder(volets, etat);
}

/** Un budget réglé volet par volet : la chaîne d'un scénario qui traverse
 *  plusieurs budgets, encodée par l'atelier comme l'adresse la porte. */
function budgetEncodeParVolet(
  volets: readonly VoletBudget[],
  reglages: [string, string, number][],
): string {
  const etat = etatVide();
  for (const [cle, code, pourcentage] of reglages) {
    const volet = volets.find((v) => v.cle === cle)!;
    reglagesDe(etat, volet).set(code, pourcentage);
  }
  return encoder(volets, etat);
}

test("l'aperçu nomme la somme des écarts et montre les trois gestes les plus lourds", () => {
  const volets = [voletEtat()];
  // −10 % de 100 Md€ pèse 10 Md€ ; −50 % de 10 Md€ en pèse 5 ; −100 % de 2 Md€
  // en pèse 2 ; −10 % de 1 Md€ en pèse 0,1. Les trois premiers sont montrés.
  const budget = budgetEncode(volets, [
    ["A", -10],
    ["B", -50],
    ["C", -100],
    ["D", -10],
  ]);

  const apercu = apercuScenario(volets, budget, "");
  assert.ok(apercu);

  assert.match(apercu.description, /^Somme des écarts : /);
  assert.ok(
    apercu.description.includes(ecart(17_100_000_000)),
    `la somme des écarts manque : ${apercu.description}`,
  );
  for (const [libelle, montant] of [
    ["Grosse ligne", -10_000_000_000],
    ["Ligne moyenne", -5_000_000_000],
    ["Ligne légère", -2_000_000_000],
  ] as [string, number][]) {
    assert.ok(
      apercu.description.includes(`${libelle} ${ecart(montant)}`),
      `« ${libelle} ${ecart(montant)} » manque : ${apercu.description}`,
    );
  }
  // Le quatrième geste, le plus léger, ne monte pas : trois et pas quatre.
  assert.ok(!apercu.description.includes("Petite ligne"), apercu.description);
});

test("les gestes sont classés par poids, pas par ordre de déclaration", () => {
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [
    ["A", -10],
    ["B", -50],
    ["D", -10],
  ]);
  const apercu = apercuScenario(volets, budget, "");
  assert.ok(apercu);
  const rangs = ["Grosse ligne", "Ligne moyenne", "Petite ligne"].map((l) =>
    apercu.description.indexOf(l),
  );
  assert.ok(
    rangs.every((rang) => rang > 0) && rangs[0] < rangs[1] && rangs[1] < rangs[2],
    `ordre inattendu : ${apercu.description}`,
  );
});

test("l'aperçu dit son unité et ne pose aucun total de dépense publique", () => {
  const volets = [voletEtat()];
  const apercu = apercuScenario(volets, budgetEncode(volets, [["D", -10]]), "");
  assert.ok(apercu);
  assert.ok(apercu.description.endsWith("Montants en millions d'euros."), apercu.description);
  // Le seul nombre nommé autrement qu'un geste est la somme des ÉCARTS. Les
  // budgets, eux, ne s'additionnent pas : aucun total, aucun solde public.
  for (const interdit of ["total", "solde", "dépense publique", "classement", "note"]) {
    assert.ok(
      !apercu.description.toLowerCase().includes(interdit),
      `« ${interdit} » n'a rien à faire dans un aperçu : ${apercu.description}`,
    );
  }
});

/* --------------------------------------------------------------------------
 * D'où viennent les lignes que l'aperçu chiffre
 * ----------------------------------------------------------------------- */

test("l'aperçu date ses écarts sur le cadre publié du budget qu'il chiffre", () => {
  const volets = [voletEtat()];
  const apercu = apercuScenario(volets, budgetEncode(volets, [["D", -10]]), "");
  assert.ok(apercu);
  // « PLF » et « 2025 » viennent du fichier publié, pas d'une constante du
  // module : un écart de scénario s'applique à une ligne d'un exercice précis,
  // et sans cet exercice personne ne peut le refaire. Cette description est le
  // seul canal d'un scénario partagé (D-L3-b) : ce qui n'y est pas est perdu.
  assert.ok(apercu.description.includes("Source : PLF 2025."), apercu.description);
  // La provenance passe avant la mention d'unité, qui reste la dernière phrase.
  assert.ok(
    apercu.description.indexOf("Source : PLF 2025.") <
      apercu.description.indexOf("Montants en millions d'euros."),
    apercu.description,
  );
});

test("un scénario qui traverse plusieurs exercices les nomme tous", () => {
  // Le cas que la tâche 4 avait jugé indatable : régler l'État et la Sécurité
  // sociale, c'est régler un PLF 2025 et un PLFSS 2026. En choisir un ferait
  // valoir sa date pour l'autre ; les deux sont donc écrits.
  const volets = [
    voletEtat(),
    voletSecu(),
    voletEchelon("collectivites-commune", "Communes", "COM"),
    voletEchelon("collectivites-region", "Régions", "REG"),
  ];
  const budget = budgetEncodeParVolet(volets, [
    ["etat", "D", -10],
    ["secu", "D-PRE", -5],
    ["collectivites-commune", "COM", -20],
    ["collectivites-region", "REG", -20],
  ]);

  const apercu = apercuScenario(volets, budget, "");
  assert.ok(apercu);
  // Dans l'ordre des volets — celui des sections de la page —, jamais celui du
  // poids des gestes, qui changerait d'un réglage à l'autre. Et les deux
  // échelons partagent un cadre : il est nommé une fois, pas deux.
  assert.ok(
    apercu.description.includes("Sources : PLF 2025, PLFSS 2026, Comptes de gestion 2025."),
    apercu.description,
  );
});

/** Un budget d'État dont les intitulés ont la longueur de ceux que la
 *  nomenclature publie vraiment — c'est là, et pas sur « Grosse ligne », que le
 *  budget de signes de la description travaille. */
function budgetIntitulesLongs(): Budget {
  return {
    ...budgetEtat(),
    depenses: [
      { c: "A", l: "Ligne d'essai la plus lourde des trois", v: 100_000_000_000 },
      { c: "B", l: "Ligne d'essai de poids intermédiaire", v: 60_000_000_000 },
      { c: "C", l: "Ligne d'essai la plus légère des trois", v: 20_000_000_000 },
    ],
  };
}

test("la clause de provenance tient dans ce qu'une carte de lien montre", () => {
  // Cette description est le SEUL canal d'un scénario partagé (D-L3-b) : ce qui
  // tombe après la coupe d'une plateforme est perdu, exercices compris. X coupe
  // l'`og:description` autour de 200 signes — le plus serré des trois cadres,
  // LinkedIn en montrant environ 250 et Facebook environ 300. Mesurée sur un
  // scénario réglant les trois cadres, la description faisait 276 signes et la
  // clause commençait au signe 190 : elle partait coupée à « Sources : PL ».
  const COUPE_X = 200;
  const COUPE_LINKEDIN = 250;
  const volets = [
    voletEtat(budgetIntitulesLongs()),
    voletSecu(),
    voletEchelon("collectivites-commune", "Communes", "COM"),
  ];
  const apercu = apercuScenario(
    volets,
    budgetEncodeParVolet(volets, [
      ["etat", "A", -20],
      ["etat", "B", -20],
      ["etat", "C", -20],
      ["secu", "D-PRE", -5],
      ["collectivites-commune", "COM", -20],
    ]),
    "",
  );
  assert.ok(apercu);

  const clause = "Sources : PLF 2025, PLFSS 2026, Comptes de gestion 2025.";
  assert.ok(apercu.description.includes(clause), apercu.description);
  // Le compte est en points de code, comme celui du module : une paire de
  // substitution est un signe, pas deux.
  const visible = [...apercu.description].slice(0, COUPE_X).join("");
  assert.ok(
    visible.includes(clause),
    `la clause tombe au-delà des ${COUPE_X} signes visibles : ${apercu.description}`,
  );
  // La mention d'unité, elle, est hors du budget — mais elle ne coûte que ce
  // qu'un second cadre montre : la description entière tient sous LinkedIn.
  assert.ok(
    [...apercu.description].length <= COUPE_LINKEDIN,
    `${[...apercu.description].length} signes : ${apercu.description}`,
  );

  // Ce que ce budget retire au lecteur, nommément : le plus léger des gestes
  // montrés — jamais un intitulé rogné plus court, jamais la clause. Les deux
  // plus lourds gardent leur nom entier.
  //
  // Poids des lignes réglées : 30 000 M€ pour les prestations, 20 000 pour la
  // plus lourde des trois, 12 000 pour celle de poids intermédiaire, 10 000 pour
  // les communes, 4 000 pour la plus légère. Le troisième geste est donc celui
  // qui saute.
  // Le montant est produit en appelant `formater` : son séparateur est une
  // espace fine insécable, indiscernable au clavier d'une espace ordinaire.
  assert.ok(
    apercu.description.includes(`Prestations sociales ${ecart(-30_000_000_000)}`),
    apercu.description,
  );
  assert.ok(
    apercu.description.includes(`Ligne d'essai la plus lourde des trois ${ecart(-20_000_000_000)}`),
    apercu.description,
  );
  assert.ok(
    !apercu.description.includes("de poids intermédiaire"),
    `le troisième geste a mangé la place de la clause : ${apercu.description}`,
  );

  // Et il saute PARCE QUE la clause est longue, pas parce qu'il serait hors des
  // trois plus lourds : sous un seul cadre, la même ligne est écrite.
  const seulEtat = [voletEtat(budgetIntitulesLongs())];
  const sansSecu = apercuScenario(
    seulEtat,
    budgetEncode(seulEtat, [
      ["A", -20],
      ["B", -20],
      ["C", -20],
    ]),
    "",
  );
  assert.ok(sansSecu);
  assert.ok(sansSecu.description.includes("de poids intermédiaire"), sansSecu.description);
});

test("un budget que le scénario ne touche pas n'est pas nommé", () => {
  const volets = [voletEtat(), voletSecu()];
  const apercu = apercuScenario(volets, budgetEncodeParVolet(volets, [["etat", "D", -10]]), "");
  assert.ok(apercu);
  // L'atelier monte les six volets pour toute adresse (`construireVolets`) :
  // nommer un millésime qu'aucun geste ne touche daterait l'aperçu d'un budget
  // que le lecteur n'a pas ouvert.
  assert.ok(apercu.description.includes("Source : PLF 2025."), apercu.description);
  assert.ok(!apercu.description.includes("PLFSS"), apercu.description);
});

test("un budget touché sans cadre publié ne rend aucun aperçu", () => {
  // Un type exige un champ, pas une valeur : `{ loi: "", exercice: "" }` se
  // publie. Plutôt qu'un « Source :  2025. » qui affirmerait une provenance
  // qu'il n'a pas, l'aperçu se tait et le lien garde les métadonnées du site —
  // même refus qu'`exigerProvenance` (carte-og.ts) et que `citer()`.
  for (const manque of [{ loi: "" }, { exercice: "" }]) {
    const volets = [voletEtat({ ...budgetEtat(), ...manque })];
    assert.equal(apercuScenario(volets, budgetEncode(volets, [["D", -10]]), "Un nom"), null);
  }
});

test("le nom du scénario entre dans le titre, et le titre s'en passe", () => {
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [["D", -10]]);

  const nomme = apercuScenario(volets, budget, "Mon budget 2025");
  assert.ok(nomme);
  assert.ok(nomme.titre.includes("Mon budget 2025"), nomme.titre);

  const anonyme = apercuScenario(volets, budget, "");
  assert.ok(anonyme);
  assert.ok(!anonyme.titre.includes("«"), anonyme.titre);
  assert.ok(anonyme.titre.length > 0);
});

test("un nom démesuré est borné plutôt que recopié", () => {
  const volets = [voletEtat()];
  const apercu = apercuScenario(
    volets,
    budgetEncode(volets, [["D", -10]]),
    "scénario ".repeat(200),
  );
  assert.ok(apercu);
  assert.ok(apercu.titre.length < 120, `titre de ${apercu.titre.length} signes`);
});

test("un nom borné ne part jamais coupé au milieu d'un caractère", () => {
  const volets = [voletEtat()];
  // Le nom vient de l'adresse : c'est la seule saisie non maîtrisée de ce
  // chemin, et un émoji y est ordinaire. Soixante-neuf signes puis un drapeau
  // tombent juste sur la borne des soixante-dix : coupé en unités UTF-16, le
  // titre partait avec un substitut haut isolé — un demi-caractère, que rien
  // ne remplace par U+FFFD, et le `og:title` servi ne se décodait plus.
  const apercu = apercuScenario(
    volets,
    budgetEncode(volets, [["D", -10]]),
    `${"e".repeat(69)}🇫🇷`,
  );
  assert.ok(apercu);
  // Ce que la fonction d'edge écrira dans le document, relu comme un client le
  // relira. Un substitut isolé devient U+FFFD en chemin : la chaîne rendue
  // n'est alors plus celle qui est partie.
  assert.equal(
    Buffer.from(apercu.titre, "utf8").toString("utf8"),
    apercu.titre,
    `le titre ne survit pas à un aller-retour UTF-8 : ${JSON.stringify(apercu.titre)}`,
  );
  assert.doesNotMatch(
    apercu.titre,
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u,
    "un substitut isolé est resté dans le titre",
  );
});

test("une adresse sans budget lisible ne rend aucun aperçu — jamais une erreur", () => {
  const volets = [voletEtat()];
  for (const budget of [
    "",
    "n'importe quoi",
    // Un volet que le site ne monte pas : rien à régler.
    "inconnu/A:-10",
    // Une ligne que la nomenclature ne porte pas.
    "etat/ZZZ:-10",
    // Zéro n'est pas un réglage dans un budget.
    "etat/D:0",
    // Une valeur qui n'est pas un nombre.
    "etat/D:abc",
  ]) {
    assert.equal(apercuScenario(volets, budget, "Un nom"), null, `budget « ${budget} »`);
  }
});

/* --------------------------------------------------------------------------
 * Poser l'aperçu dans le document servi
 * ----------------------------------------------------------------------- */

const APERCU = { titre: "Un titre", description: "Une description." };
const URL_SCENARIO = "https://exemple.test/simulateur?budget=etat%2FD%3A-10";
/** L'image telle que la fonction d'edge la compose : absolue, depuis l'adresse
 *  demandée — elle ne connaît pas autrement le domaine sous lequel elle tourne. */
const IMAGE = new URL(IMAGE_SCENARIO, URL_SCENARIO).toString();

/** Le gabarit tel que le pré-rendu le publie : `index.html` du dépôt, plus les
 *  balises de partage du site que `scripts/prerendre.ts` y injecte. */
async function gabaritPublie(): Promise<string> {
  const shell = await readFile(path.join(ICI, "..", "index.html"), "utf8");
  return shell.replace(
    "</head>",
    '  <meta property="og:title" content="Où va l\'argent public" />\n' +
      '  <meta property="og:description" content="Les finances de chaque commune." />\n' +
      '  <meta property="og:url" content="https://exemple.test/" />\n' +
      '  <meta property="og:image" content="https://exemple.test/carte.png" />\n' +
      '  <meta name="twitter:card" content="summary_large_image" />\n  </head>',
  );
}

function compter(html: string, motif: RegExp): number {
  return html.match(motif)?.length ?? 0;
}

test("le document servi ne porte qu'un jeu de balises d'aperçu", async () => {
  const pose = poserApercu(await gabaritPublie(), APERCU, URL_SCENARIO, IMAGE);
  assert.equal(compter(pose, /<title>/gi), 1);
  assert.equal(compter(pose, /<meta\s+name="description"/gi), 1);
  assert.equal(compter(pose, /<meta\s+property="og:title"/gi), 1);
  assert.equal(compter(pose, /<meta\s+property="og:description"/gi), 1);
  assert.equal(compter(pose, /<meta\s+property="og:url"/gi), 1);
  assert.ok(pose.includes(`content="${URL_SCENARIO}"`), "og:url n'est pas celle du scénario");
  assert.ok(pose.includes("<title>Un titre</title>"));
  assert.ok(pose.includes('content="Une description."'));
});

test("l'aperçu sert l'image du simulateur, et ne touche pas au corps du document", async () => {
  const gabarit = await gabaritPublie();
  const pose = poserApercu(gabarit, APERCU, URL_SCENARIO, IMAGE);
  // D-L3-b tient : il n'y a toujours pas d'image PAR SCÉNARIO — l'espace des
  // budgets encodés est infini. Mais le document servi portait celle du SITE,
  // et une plateforme montre l'image en grand avec le titre dessous : « un
  // scénario du simulateur » s'affichait sous une carte annonçant « Où va
  // l'argent public : carte des finances locales », chapeautée « Repère ».
  assert.equal(compter(pose, /<meta\s+property="og:image"/gi), 1);
  assert.ok(pose.includes(`content="${IMAGE}"`), pose.slice(0, 2000));
  assert.ok(!pose.includes('content="https://exemple.test/carte.png"'), "l'image du site est restée");
  // Absolue, et sous le domaine demandé : un robot ne résout pas toujours un
  // chemin, et la fonction ne connaît le domaine que par la requête.
  assert.equal(new URL(IMAGE).origin, new URL(URL_SCENARIO).origin);
  assert.equal(compter(pose, /<meta\s+name="twitter:card"/gi), 1);
  const corps = (html: string) => html.slice(html.search(/<\/head\s*>/i));
  assert.equal(corps(pose), corps(gabarit), "le corps du document a bougé");
});

test("un gabarit sans balises de partage en reçoit quand même", () => {
  const pose = poserApercu("<html><head></head><body></body></html>", APERCU, URL_SCENARIO, IMAGE);
  assert.equal(compter(pose, /<meta\s+property="og:title"/gi), 1);
  assert.equal(compter(pose, /<title>/gi), 1);
});

test("un document sans tête est rendu inchangé", () => {
  const brut = "pas du HTML";
  assert.equal(poserApercu(brut, APERCU, URL_SCENARIO, IMAGE), brut);
});

test("ce que l'adresse tend est échappé, jamais recopié dans le document", () => {
  const pose = poserApercu(
    "<html><head></head><body></body></html>",
    {
      titre: '"><script>alert(1)</script>',
      description: "<img onerror=alert(1)>",
    },
    'https://exemple.test/?nom="><script>alert(1)</script>',
    IMAGE,
  );
  assert.ok(!pose.includes("<script>"), pose);
  assert.ok(!pose.includes("<img "), pose);
});

/* --------------------------------------------------------------------------
 * Le même entrepôt que le navigateur
 * ----------------------------------------------------------------------- */

test("l'edge lit l'entrepôt que le navigateur lit", async () => {
  // `src/donnees.ts` porte l'adresse pour le navigateur, où elle se lit dans
  // `import.meta.env` — que ni Node ni un travailleur d'edge ne connaissent.
  // Les deux lignes ne peuvent pas être partagées ; qu'elles disent la même
  // chose, si. Sinon l'aperçu décrirait un scénario contre une publication que
  // le lecteur n'ouvrira jamais.
  const source = await readFile(path.join(ICI, "donnees.ts"), "utf8");
  assert.ok(
    source.includes(`"${BASE_DONNEES}"`),
    `src/donnees.ts ne lit pas ${BASE_DONNEES} : l'aperçu et le site liraient deux entrepôts.`,
  );
});
