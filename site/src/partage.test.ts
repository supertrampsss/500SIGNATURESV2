/**
 * Les trois formats d'un objet partageable.
 *
 * Quatre garanties, et chacune protège un défaut qui ne se voit qu'une fois le
 * lien parti, c'est-à-dire trop tard :
 *
 * 1. **le permalien restitue l'état exact** — un budget encodé porte `/`, `:`
 *    et `,`, un nom de scénario porte ce que le lecteur y met : recollés à la
 *    main, ces caractères coupent l'adresse et le lien ouvre un atelier vierge ;
 * 2. **le résumé ne somme pas deux budgets** — deux budgets ne s'additionnent
 *    pas, et un troisième nombre sous les deux autres se lirait comme un total ;
 * 3. **le presse-papiers prend le relais quand `navigator.share` manque** — il
 *    manque sur la plupart des navigateurs de bureau, donc chez une bonne part
 *    des lecteurs : c'est le cas courant, pas le cas limite ;
 * 4. **une annulation ne produit aucun message d'échec** — le lecteur qui ferme
 *    le panneau de partage n'a pas subi une panne ; le lui dire serait faux.
 *
 * Les montants attendus sont **produits en appelant `formater`**, jamais tapés :
 * les séparateurs du site sont des espaces fines insécables (U+202F), qu'aucun
 * clavier ne distingue d'une espace ordinaire.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { apercuScenario, MENTION_UNITE } from "./apercu-scenario.ts";
import { decoder, encoder, etatVide, plan, reglagesDe, type Volet, type VoletBudget } from "./atelier.ts";
import { formater } from "./echelle.ts";
import {
  formeEffort,
  offrir,
  partageAnalyse,
  partageComparaison,
  partageScenario,
  permalien,
  resume,
  type Canaux,
  type ChargeSysteme,
} from "./partage.ts";
import { indexer, type Budget } from "./simulateur.ts";

const ORIGINE = "https://plateforme-9sz.pages.dev";

/* --------------------------------------------------------------------------
 * De quoi fabriquer un scénario réel, encodé par l'atelier lui-même
 * ----------------------------------------------------------------------- */

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

function voletEtat(): VoletBudget {
  return { genre: "budget", cle: "etat", nom: "État", budget: budgetEtat(), index: indexer(budgetEtat()) };
}

/** Un budget réglé, encodé par `encoder()` — la chaîne que l'adresse porte
 *  réellement, jamais une chaîne écrite à la main pour le test. */
function budgetEncode(volets: readonly Volet[], reglages: [string, number][]): string {
  const etat = etatVide();
  const volet = volets[0] as VoletBudget;
  for (const [code, pourcentage] of reglages) reglagesDe(etat, volet).set(code, pourcentage);
  return encoder(volets, etat);
}

/** Les écarts du plan, les plus lourds d'abord — ce que `main.ts` passe.
 *  Décodés par `decoder`, jamais relus à la main : le test emprunte le chemin
 *  du site, sinon il éprouve sa propre copie. */
function ecartsDe(volets: readonly Volet[], budget: string): number[] {
  return plan(volets, decoder(budget, volets)).map((ligne) => ligne.delta);
}

/* --------------------------------------------------------------------------
 * 1. Le permalien restitue l'état exact
 * ----------------------------------------------------------------------- */

test("le permalien rend le budget encodé caractère pour caractère", () => {
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [
    ["A", -10],
    ["D", -25],
  ]);
  // La chaîne encodée porte les trois caractères qui coupent une adresse
  // recollée à la main : le séparateur de volet, celui de valeur, et la virgule
  // qui sépare deux réglages.
  assert.ok(budget.includes("/") && budget.includes(":") && budget.includes(","), budget);

  const lien = permalien(ORIGINE, "/simulateur", {
    budget,
    // Un nom de scénario porte ce que le lecteur y met : espaces, accents, et
    // l'esperluette qui, recollée, ouvrirait un paramètre de plus.
    nom: "Éducation & défense",
    contrat: "",
  });

  const relu = new URL(lien);
  assert.equal(relu.origin, ORIGINE);
  assert.equal(relu.pathname, "/simulateur");
  assert.equal(relu.searchParams.get("budget"), budget);
  assert.equal(relu.searchParams.get("nom"), "Éducation & défense");
  // Un paramètre vide n'entre pas dans l'adresse : `lireUrl` rend `""` pour un
  // paramètre absent, l'écrire n'ajouterait que de la longueur.
  assert.equal(relu.searchParams.has("contrat"), false);
});

test("le permalien d'un scénario s'ouvre sur le budget qu'il porte", () => {
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [["D", -10]]);
  const lien = permalien(ORIGINE, "/simulateur", { budget });
  // Le tour complet : ce que l'adresse rend est ce que l'atelier décodera.
  const repris = new URL(lien).searchParams.get("budget") ?? "";
  assert.deepEqual(ecartsDe(volets, repris), ecartsDe(volets, budget));
  assert.equal(ecartsDe(volets, repris)[0], -10_000_000_000);
});

/* --------------------------------------------------------------------------
 * 2. Le résumé : une seule voix, et aucun total
 * ----------------------------------------------------------------------- */

test("le résumé d'un scénario reprend l'aperçu mot pour mot", () => {
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [
    ["B", -50],
    ["D", -10],
  ]);
  const apercu = apercuScenario(volets, budget, "Mon budget");
  assert.ok(apercu);

  const objet = partageScenario({
    apercu,
    permalien: permalien(ORIGINE, "/simulateur", { budget, nom: "Mon budget" }),
    ecarts: ecartsDe(volets, budget),
  });

  // Mot pour mot : la carte de lien et le collage disent la même chose. Une
  // seconde rédaction du même scénario finirait par en dire une autre.
  assert.deepEqual(objet.lignes, [apercu.titre, apercu.description]);
  const colle = resume(objet);
  assert.ok(colle.includes(apercu.description), colle);
  assert.ok(colle.endsWith(objet.permalien), colle);
  // Deux à trois lignes, lien compris (spec §13).
  assert.ok(colle.split("\n").length <= 3, colle);
  // Les montants sont ceux de `formater`, séparateurs compris.
  assert.ok(colle.includes(formater(-10_000_000_000, "EUR", false)), colle);
});

test("le résumé d'une comparaison pose deux colonnes, jamais leur somme", () => {
  const gauche = 17_100_000_000;
  const droite = -4_200_000_000;
  const objet = partageComparaison({
    colonnes: [
      { nom: "Votre budget actuel", effort: gauche },
      { nom: "Budget voté", effort: droite },
    ],
    permalien: permalien(ORIGINE, "/simulateur", { budget: "etat/D:-10", face: "etat/B:-5" }),
  });

  const colle = resume(objet);
  assert.ok(colle.includes(formater(gauche, "EUR", false)), colle);
  assert.ok(colle.includes(formater(droite, "EUR", false)), colle);
  // Le total des deux colonnes n'existe nulle part : deux budgets ne
  // s'additionnent pas, et un troisième nombre se lirait comme leur somme.
  assert.ok(!colle.includes(formater(gauche + droite, "EUR", false)), colle);
  assert.ok(colle.includes(MENTION_UNITE), colle);
  // Aucun gagnant, aucune note, aucun classement.
  for (const interdit of ["gagnant", "meilleur", "classement", "note", "total", "l'emporte"]) {
    assert.ok(!colle.toLowerCase().includes(interdit), `« ${interdit} » : ${colle}`);
  }
  // Les deux noms restent dans l'ordre reçu.
  assert.ok(colle.indexOf("Votre budget actuel") < colle.indexOf("Budget voté"), colle);
});

/* --------------------------------------------------------------------------
 * La variante compacte : la forme, sans le détail
 * ----------------------------------------------------------------------- */

test("la forme de l'effort dessine le sens et le relief de chaque geste", () => {
  // Le plus lourd donne trois pictogrammes, un tiers en donne un, une hausse et
  // une baisse ne se dessinent pas du même.
  assert.equal(formeEffort([-9_000_000_000, 3_000_000_000, -1_000_000_000]), "▼▼▼ ▲ ▼");
  // Un geste qui ne déplace rien ne dessine rien : sous l'euro, il n'y a pas de
  // geste (même garde que l'aperçu).
  assert.equal(formeEffort([-9_000_000_000, 0.4]), "▼▼▼");
  assert.equal(formeEffort([]), "");
  // Au-delà de huit gestes, la ligne dit qu'elle continue plutôt que de
  // s'allonger sans fin.
  assert.ok(formeEffort(Array.from({ length: 12 }, () => -1_000_000_000)).endsWith("…"));
});

test("la variante compacte montre la forme et garde le détail pour le lien", () => {
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [
    ["B", -50],
    ["D", -10],
  ]);
  const apercu = apercuScenario(volets, budget, "Mon budget");
  assert.ok(apercu);
  const objet = partageScenario({
    apercu,
    permalien: permalien(ORIGINE, "/simulateur", { budget }),
    ecarts: ecartsDe(volets, budget),
  });
  assert.ok(objet.compact);

  const lignes = objet.compact.join("\n");
  assert.ok(lignes.includes("▼▼▼"), lignes);
  assert.ok(lignes.includes("(2 gestes)"), lignes);
  // Ni intitulé, ni montant : c'est ce qui donne une raison d'ouvrir le lien.
  for (const detail of ["Grosse ligne", "Ligne moyenne", "M€", "Somme des écarts"]) {
    assert.ok(!lignes.includes(detail), `« ${detail} » dévoile le détail : ${lignes}`);
  }
  // Le titre reste : sans lui, le collage compact ne dit même pas de quoi il
  // parle.
  assert.equal(objet.compact[0], apercu.titre);
  assert.ok(resume(objet, "compact").endsWith(objet.permalien));
});

/* --------------------------------------------------------------------------
 * L'image : celle qui existe, jamais celle qu'on aimerait
 * ----------------------------------------------------------------------- */

test("seule une analyse porte une image, parce que seule une analyse en a une", () => {
  const analyse = partageAnalyse({
    titre: "Le budget de la Défense : deux chiffres publiés, deux sens",
    phrase: "Les deux montants existent.",
    permalien: `${ORIGINE}/analyses/defense/`,
    image: `${ORIGINE}/analyses/defense/carte.png`,
  });
  assert.equal(analyse.image, `${ORIGINE}/analyses/defense/carte.png`);
  assert.deepEqual(analyse.lignes, [
    "Le budget de la Défense : deux chiffres publiés, deux sens",
    "Les deux montants existent.",
  ]);
  assert.equal(analyse.compact, null);

  // Aucun PNG n'est écrit par scénario ni par comparaison (D-L3-b) : `null`
  // est la réponse juste. Une adresse d'image que le build n'écrit jamais
  // serait un aperçu cassé, et c'est le défaut que `validerImagesAnnoncees`
  // fait rougir au build.
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [["D", -10]]);
  const apercu = apercuScenario(volets, budget, "");
  assert.ok(apercu);
  assert.equal(
    partageScenario({ apercu, permalien: `${ORIGINE}/simulateur`, ecarts: [] }).image,
    null,
  );
  assert.equal(
    partageComparaison({
      colonnes: [
        { nom: "A", effort: 1 },
        { nom: "B", effort: 2 },
      ],
      permalien: `${ORIGINE}/simulateur`,
    }).image,
    null,
  );
});

/* --------------------------------------------------------------------------
 * 3 et 4. Le geste : ses deux chemins, et l'annulation
 * ----------------------------------------------------------------------- */

const OBJET = partageAnalyse({
  titre: "Un titre",
  phrase: "Une phrase.",
  permalien: `${ORIGINE}/analyses/exemple/`,
  image: `${ORIGINE}/analyses/exemple/carte.png`,
});

/** Un presse-papiers de test, qui garde ce qu'on lui écrit. */
function pressePapiers(): { copies: string[]; canal: NonNullable<Canaux["copier"]> } {
  const copies: string[] = [];
  return {
    copies,
    canal: (texte) => {
      copies.push(texte);
      return Promise.resolve();
    },
  };
}

test("sans navigator.share, le presse-papiers prend le relais", async () => {
  const { copies, canal } = pressePapiers();
  // Le cas courant : la plupart des navigateurs de bureau n'ont pas de panneau
  // de partage. `partager` est absent, comme il l'est là-bas.
  const issue = await offrir(OBJET, { copier: canal });
  assert.equal(issue, "copié");
  assert.deepEqual(copies, [resume(OBJET)]);
  // Ce qui est collé porte le lien : c'est lui qui restitue l'état exact.
  assert.ok(copies[0].endsWith(OBJET.permalien), copies[0]);
});

test("le panneau du système, quand il existe, reçoit le lien à part du texte", async () => {
  const recues: ChargeSysteme[] = [];
  const { copies, canal } = pressePapiers();
  const issue = await offrir(OBJET, {
    partager: (charge) => {
      recues.push(charge);
      return Promise.resolve();
    },
    copier: canal,
  });
  assert.equal(issue, "partagé");
  // Le presse-papiers n'a rien reçu : le système a pris la main.
  assert.deepEqual(copies, []);
  assert.equal(recues.length, 1);
  assert.equal(recues[0].url, OBJET.permalien);
  assert.equal(recues[0].title, OBJET.titre);
  // Le lien n'est pas dans le texte : les deux ensemble, la plupart des cibles
  // collent l'adresse deux fois.
  assert.ok(!recues[0].text.includes(OBJET.permalien), recues[0].text);
});

test("fermer le panneau de partage n'est pas un échec", async () => {
  const { copies, canal } = pressePapiers();
  const issue = await offrir(OBJET, {
    partager: () => Promise.reject(Object.assign(new Error("Share canceled"), { name: "AbortError" })),
    copier: canal,
  });
  // « annulé » et rien d'autre : l'appelant n'a aucun message à afficher.
  assert.equal(issue, "annulé");
  // Recopier dans le presse-papiers passerait outre un refus volontaire.
  assert.deepEqual(copies, []);
});

test("un panneau qui échoue vraiment retombe sur le presse-papiers", async () => {
  const { copies, canal } = pressePapiers();
  // `NotAllowedError` : le navigateur ne reconnaît pas le geste comme
  // volontaire. Ce n'est pas un refus du lecteur — il attend toujours quelque
  // chose.
  const issue = await offrir(OBJET, {
    partager: () => Promise.reject(Object.assign(new Error("refusé"), { name: "NotAllowedError" })),
    copier: canal,
  });
  assert.equal(issue, "copié");
  assert.deepEqual(copies, [resume(OBJET)]);
});

test("sans aucun canal, le geste le dit plutôt que de prétendre avoir copié", async () => {
  assert.equal(await offrir(OBJET, {}), "indisponible");
  assert.equal(
    await offrir(OBJET, { copier: () => Promise.reject(new Error("refus du navigateur")) }),
    "indisponible",
  );
});

test("la variante compacte est celle qui part, quand c'est elle qu'on demande", async () => {
  const volets = [voletEtat()];
  const budget = budgetEncode(volets, [["D", -10]]);
  const apercu = apercuScenario(volets, budget, "");
  assert.ok(apercu);
  const objet = partageScenario({
    apercu,
    permalien: permalien(ORIGINE, "/simulateur", { budget }),
    ecarts: ecartsDe(volets, budget),
  });
  const { copies, canal } = pressePapiers();
  await offrir(objet, { copier: canal }, "compact");
  assert.equal(copies[0], resume(objet, "compact"));
  assert.ok(!copies[0].includes("Somme des écarts"), copies[0]);
});

/* --------------------------------------------------------------------------
 * Le geste, tel que `main.ts` le pose
 * --------------------------------------------------------------------------
 * Ces trois-là se lisent dans la source : rien n'exécute de DOM dans ce dépôt,
 * et ce sont pourtant les défauts qui ne se voient qu'une fois le site publié.
 * ----------------------------------------------------------------------- */

const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const CSS = readFileSync(new URL("./style.css", import.meta.url), "utf8");

test("le partage n'appelle aucun tiers", () => {
  // Aucun widget de réseau social, aucun script externe : le règlement européen
  // sur les données interdit déjà les polices distantes ici, et un bouton de
  // partage transmet la même chose — l'adresse IP du lecteur et la page qu'il
  // lit — à un tiers qui ne lui a rien demandé.
  const partage = MAIN.slice(
    MAIN.indexOf("function rendrePartage"),
    MAIN.indexOf("function brancherPartageEditorial"),
  );
  assert.ok(partage.length > 500, "le geste de partage est introuvable dans main.ts");
  for (const tiers of [
    "facebook",
    "twitter",
    "x.com",
    "linkedin",
    "whatsapp",
    "telegram",
    "mastodon",
    "sharer",
    "intent/tweet",
  ]) {
    assert.ok(!partage.toLowerCase().includes(tiers), `${tiers} n'a rien à faire ici`);
    assert.ok(!CSS.toLowerCase().includes(tiers), `${tiers} n'a rien à faire dans la feuille`);
  }
  // Le geste passe par `navigator`, jamais par une requête.
  assert.ok(!partage.includes("fetch("), partage);
});

test("le simulateur n'annonce aucune image, parce qu'il n'en a aucune", () => {
  // D-L3-b : aucun PNG n'est écrit par scénario. Un lien de téléchargement vers
  // une adresse que le build n'écrit jamais est un aperçu cassé — exactement ce
  // que `validerImagesAnnoncees` (scripts/prerendre.ts) fait rougir au build.
  assert.match(MAIN, /rendrePartage\(gestes, null\)/);
  // L'analyse, elle, annonce l'image que le pré-rendu a rasterisée pour elle.
  assert.match(MAIN, /rendrePartage\(\[\{ cle: "analyse", libelle: "Partager cette analyse" \}\], compose\.objet\.image\)/);
});

test("l'écouteur du partage est délégué, posé une seule fois", () => {
  // Même motif que `brancherScenarios` : `#scenarios` n'est jamais remplacé,
  // seul son contenu l'est à chaque réglage. Un écouteur par rendu les
  // empilerait, et le geste partirait autant de fois qu'il y a eu de réglages.
  const brancher = MAIN.slice(
    MAIN.indexOf("function brancherPartage("),
    MAIN.indexOf("function partageDuSimulateur"),
  );
  assert.ok(brancher.includes('conteneur.addEventListener("click"'), brancher);
  assert.match(MAIN, /brancherPartage\(cible, partageDuSimulateur\);/);
  // Le cadre est repeint par `montrerScenarios`, qui ne pose donc aucun
  // écouteur.
  const montrer = MAIN.slice(
    MAIN.indexOf("function montrerScenarios"),
    MAIN.indexOf("type GestePartage"),
  );
  assert.ok(montrer.length > 500 && !montrer.includes("addEventListener"), montrer.length);
});
