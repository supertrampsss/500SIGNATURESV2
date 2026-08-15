/**
 * « Citer » : ce que la commande copie.
 *
 * Cinq garanties, et chacune protège un défaut qui ne se voit qu'une fois la
 * citation partie — c'est-à-dire trop tard, comme pour une capture d'écran :
 *
 * 1. **la citation porte les cinq éléments** — le nombre, son unité, sa source,
 *    son millésime et le permalien : ce qui est copié doit permettre de
 *    retrouver le chiffre sans le site ;
 * 2. **sans source ni millésime, il n'y a pas de citation** — copier un nombre
 *    nu, c'est la capture d'écran floue sous une autre forme, en plus commode ;
 * 3. **un taux varie en points**, jamais en pourcentage, y compris les taux que
 *    la source publie pour mille et que l'écran montre en pourcentage ;
 * 4. **un ratio nomme son dénominateur** — deux populations plausibles
 *    coexistent sur ce site, et « 1 240 € par habitant » ne dit pas laquelle ;
 * 5. **le permalien restitue l'état exact** — un budget encodé porte `/`, `:`
 *    et `,` : coupée, l'adresse ouvre un atelier vierge.
 *
 * Les valeurs attendues sont **produites en appelant `formater` et
 * `formaterVariation`**, jamais tapées : les séparateurs du site sont des
 * espaces fines insécables (U+202F), qu'aucun clavier ne distingue d'une
 * espace ordinaire.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { citable, citer, offrirCitation, type Citation, type Presse } from "./citer.ts";
import { formater } from "./echelle.ts";
import { formaterVariation, modeVariation } from "./evolution-carte.ts";
import { permalien } from "./partage.ts";

const ORIGINE = "https://plateforme-9sz.pages.dev";

/** Le chiffre de la seule analyse publiée du dépôt, avec la provenance que
 *  cette analyse déclare elle-même — jamais une source inventée pour le test. */
function chiffreDAnalyse(): Citation {
  return {
    libelle: "Les crédits consommés : ce que la mission a effectivement payé",
    valeur: 62_123_736_749.91,
    unite: "EUR",
    id: "etat_mission_defense_credits_consommes",
    source:
      "Projet de loi relatif aux résultats de la gestion et portant approbation des comptes de l'année 2024",
    millesime: "2025",
    permalien: `${ORIGINE}/analyses/defense-credits-votes-consommes-2025/`,
  };
}

/* --------------------------------------------------------------------------
 * 1. La citation porte les cinq éléments
 * ----------------------------------------------------------------------- */

test("la citation porte le nombre, son unité, sa source, son millésime et le permalien", () => {
  const citation = chiffreDAnalyse();
  const texte = citer(citation);

  // Le nombre ET son unité : `formater` les écrit ensemble, en millions
  // d'euros, avec les espaces fines insécables du site.
  const nombre = formater(citation.valeur, "EUR", false, citation.id);
  assert.ok(nombre.endsWith("M€"), nombre);
  assert.ok(texte.includes(nombre), texte);

  assert.ok(texte.includes(citation.source), texte);
  assert.ok(texte.includes(`exercice ${citation.millesime}`), texte);
  assert.ok(texte.endsWith(citation.permalien), texte);
  // L'intitulé aussi : un nombre sans nom se cite aussi mal qu'un nombre sans
  // date.
  assert.ok(texte.includes(citation.libelle), texte);

  // Trois lignes : le chiffre daté, sa source, son adresse. Collée dans un fil
  // de discussion, une citation doit se lire d'un coup d'œil.
  assert.equal(texte.split("\n").length, 3);
});

test("un montant se cite en millions d'euros, jamais en k€ ni en Md€", () => {
  // 340 000 € : la seule taille où la règle des décimales change, et celle où
  // un formatage maison retomberait sur les k€.
  const texte = citer({ ...chiffreDAnalyse(), valeur: 340_000, id: undefined });
  assert.ok(texte.includes(formater(340_000, "EUR", false)), texte);
  assert.ok(!texte.includes("k€") && !texte.includes("Md€"), texte);
});

/* --------------------------------------------------------------------------
 * 2. Sans source ni millésime, il n'y a pas de citation
 * ----------------------------------------------------------------------- */

test("un chiffre sans source n'est pas citable, et la citation est refusée", () => {
  const orphelin = { ...chiffreDAnalyse(), source: "" };
  assert.equal(citable(orphelin), false);
  assert.throws(() => citer(orphelin), /la source/);
});

test("un chiffre sans millésime n'est pas citable, et la citation est refusée", () => {
  const sansDate = { ...chiffreDAnalyse(), millesime: "" };
  assert.equal(citable(sansDate), false);
  assert.throws(() => citer(sansDate), /le millésime/);
});

test("un chiffre sans permalien ni intitulé n'est pas citable non plus", () => {
  assert.equal(citable({ ...chiffreDAnalyse(), permalien: "" }), false);
  assert.equal(citable({ ...chiffreDAnalyse(), libelle: "  " }), false);
  assert.equal(citable({ ...chiffreDAnalyse(), unite: "" }), false);
  assert.equal(citable({ ...chiffreDAnalyse(), valeur: Number.NaN }), false);
  // Le chiffre complet, lui, passe : la garde refuse ce qui manque, pas tout.
  assert.equal(citable(chiffreDAnalyse()), true);
});

/* --------------------------------------------------------------------------
 * 3. Un taux varie en points
 * ----------------------------------------------------------------------- */

test("un taux publié en pourcentage varie en points, pas en pourcentage", () => {
  const citation: Citation = {
    ...chiffreDAnalyse(),
    libelle: "Taux de pauvreté",
    valeur: 12.4,
    unite: "percent",
    id: undefined,
    variation: { valeur: 2, depuis: "2019" },
  };
  const texte = citer(citation);
  // La règle du site, appelée — jamais réécrite ici : c'est `evolution-carte.ts`
  // qui la porte, avec ses tests.
  const attendue = formaterVariation(2, "percent", modeVariation("percent"));
  assert.equal(modeVariation("percent"), "points");
  assert.ok(texte.includes(`(${attendue} depuis 2019)`), texte);
  // Un taux qui passe de 10 % à 12 % gagne 2 points ; il ne « monte pas de
  // 20 % ». Le pourcentage ne doit pas apparaître à la place des points.
  assert.ok(!texte.includes("+2 %"), texte);
});

test("un taux publié pour mille varie en points de son affichage, divisé par dix", () => {
  // Le piège que ce lot vient de corriger dans `carte-og.ts` : la source publie
  // pour mille, l'écran montre en pourcentage (÷ 10, voir `formater`), et une
  // règle recopiée peignait le taux en pourcentage ET dix fois trop grand.
  const citation: Citation = {
    ...chiffreDAnalyse(),
    libelle: "Cambriolages enregistrés",
    valeur: 21,
    unite: "pour_1000_logements",
    id: undefined,
    variation: { valeur: 3, depuis: "2019" },
  };
  const texte = citer(citation);
  assert.equal(modeVariation("pour_1000_logements"), "points");
  const attendue = formaterVariation(3, "pour_1000_logements", "points");
  assert.ok(texte.includes(`(${attendue} depuis 2019)`), texte);
  // Le niveau suit la même conversion que l'écran : c'est `formater` qui la
  // fait, et la citation ne doit pas contredire la page qu'elle référence.
  assert.ok(texte.includes(formater(21, "pour_1000_logements", false)), texte);
});

test("un montant varie en pourcentage, lui", () => {
  const citation: Citation = {
    ...chiffreDAnalyse(),
    variation: { valeur: 18.5, depuis: "2019" },
  };
  assert.equal(modeVariation("EUR"), "pourcent");
  assert.ok(
    citer(citation).includes(`(${formaterVariation(18.5, "EUR", "pourcent")} depuis 2019)`),
    citer(citation),
  );
});

/* --------------------------------------------------------------------------
 * 4. Un ratio nomme son dénominateur
 * ----------------------------------------------------------------------- */

test("une citation par habitant nomme la population qui a servi à diviser", () => {
  const denominateur = "population de référence de l'Observatoire des finances locales";
  const citation: Citation = {
    ...chiffreDAnalyse(),
    libelle: "Dépenses de fonctionnement",
    valeur: 1_240,
    parHabitant: true,
    denominateur,
    id: undefined,
  };
  const texte = citer(citation);
  // Le par-habitant se lit en euros, pas en millions : c'est `formater` qui le
  // décide, sur le drapeau qu'on lui passe.
  assert.ok(texte.includes(formater(1_240, "EUR", true)), texte);
  assert.ok(texte.includes(`par habitant (${denominateur})`), texte);
});

test("un ratio sans dénominateur nommé n'est pas citable", () => {
  // Deux populations plausibles coexistent sur ce site — la population
  // municipale de l'INSEE et la population de référence de l'OFGL. Un ratio
  // qui ne dit pas laquelle a servi ne se vérifie pas.
  const anonyme: Citation = { ...chiffreDAnalyse(), parHabitant: true, denominateur: "" };
  assert.equal(citable(anonyme), false);
  assert.throws(() => citer(anonyme), /le dénominateur/);
});

/* --------------------------------------------------------------------------
 * 5. Le permalien restitue l'état exact
 * ----------------------------------------------------------------------- */

test("le permalien traverse la citation caractère pour caractère", () => {
  // Un budget encodé porte les trois caractères qui coupent une adresse
  // recollée à la main (voir `permalien`, partage.ts) : le séparateur de volet,
  // celui de valeur, et la virgule entre deux réglages.
  const budget = "etat/A:-10,D:-25";
  const lien = permalien(ORIGINE, "/simulateur", { budget, nom: "Éducation & défense" });
  const texte = citer({ ...chiffreDAnalyse(), permalien: lien });

  const derniere = texte.split("\n").at(-1) ?? "";
  assert.equal(derniere, lien);
  // Le tour complet : ce que la citation rend est ce que l'atelier décodera.
  const relu = new URL(derniere);
  assert.equal(relu.searchParams.get("budget"), budget);
  assert.equal(relu.searchParams.get("nom"), "Éducation & défense");
});

/* --------------------------------------------------------------------------
 * Le geste : le presse-papiers, injecté
 * ----------------------------------------------------------------------- */

test("le presse-papiers reçoit exactement la citation composée", async () => {
  const citation = chiffreDAnalyse();
  let copie = "";
  const presse: Presse = async (texte) => {
    copie = texte;
  };
  assert.equal(await offrirCitation(citation, presse), "copié");
  assert.equal(copie, citer(citation));
});

test("un presse-papiers absent ou qui refuse se dit, il ne lève pas", async () => {
  const citation = chiffreDAnalyse();
  // Contexte non sécurisé : `navigator.clipboard` n'existe pas.
  assert.equal(await offrirCitation(citation), "indisponible");
  // Permission refusée, ou geste non reconnu comme volontaire.
  const refus: Presse = () => Promise.reject(new Error("NotAllowedError"));
  assert.equal(await offrirCitation(citation, refus), "indisponible");
});
