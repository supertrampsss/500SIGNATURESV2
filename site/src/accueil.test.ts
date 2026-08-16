/**
 * L'accueil : cinq blocs, en fonctions pures.
 *
 * Les fixtures reprennent le fichier réel du dépôt (défense 2025,
 * `hors_perimetre` / `vote_execute`, `mise_en_avant: true`) et des analyses
 * minimales pour ce qu'il ne couvre pas. Aucune source, aucune URL, aucun
 * auteur n'est inventé : les fixtures qui en ont besoin utilisent le TLD
 * réservé `exemple.test`.
 *
 * Tout montant attendu est **produit en appelant `formater`**, jamais tapé : le
 * séparateur de milliers est une espace fine insécable (U+202F) qu'un test
 * écrit à la main manque une fois sur deux, et l'échec qui suit envoie chercher
 * un défaut d'affichage là où il n'y en a pas.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Analyse } from "./analyse-rendu.ts";
import { LIBELLE_CONFUSION, LIBELLE_CRAN } from "./analyse-rendu.ts";
import type { Indicateur } from "./donnees.ts";
import {
  analyseDuMoment,
  MESSAGE_PRINCIPAL,
  rendu,
  renduAnalysesRecentes,
  renduBandeConfiance,
  renduChezVous,
  renduVerdictDuMoment,
  renduVerifiez,
  tirerTerritoire,
  type ExempleTerritoire,
} from "./accueil.ts";
import { formater, MENTION_MILLIONS } from "./echelle.ts";
import { formaterVariation, modeVariation } from "./evolution-carte.ts";
import { CONTRATS } from "./mission.ts";
import { echapper } from "./texte.ts";

const SOURCE = readFileSync(new URL("./accueil.ts", import.meta.url), "utf8");

/** L'analyse réelle du dépôt, chargée telle que publiée. */
const DEFENSE: Analyse = JSON.parse(
  readFileSync(
    new URL("../analyses/defense-credits-votes-consommes-2025.json", import.meta.url),
    "utf8",
  ),
);

/** Le catalogue des deux séries citées par l'analyse réelle. */
const CATALOGUE = [
  { id: "etat_mission_defense_credits_votes", unite: "EUR" },
  { id: "etat_mission_defense_credits_consommes", unite: "EUR" },
] as unknown as Indicateur[];

function analyseMinimale(overrides: Partial<Analyse> = {}): Analyse {
  return {
    slug: "test-minimale",
    titre: "Titre de test",
    type: "verification_chiffre",
    publie_le: "2026-01-01",
    themes: ["budget_etat"],
    budgets_concernes: ["etat"],
    mise_en_avant: false,
    affirmation: {
      texte: "Un chiffre couramment répété.",
      auteur: "Auteur de test",
      date: "2026-01-01",
      source: {
        titre: "La déclaration mise en cause",
        url: "https://declaration.exemple.test",
        consulte_le: "2026-01-01",
      },
    },
    verdict: { cran: "exact", phrase: "Le chiffre correspond aux comptes publiés." },
    chiffres: [
      {
        dit: "environ 60 milliards",
        observe: {
          indicateur: "etat_mission_defense_credits_votes",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 59_946_338_573,
        },
        registre: "fait_comptable",
        lecture: "Les crédits votés.",
      },
    ],
    hypotheses: [],
    effets_indirects: [],
    sources: [
      {
        titre: "Le fichier des comptes",
        url: "https://comptes.exemple.test",
        consulte_le: "2026-01-01",
      },
    ],
    simulateur: { budget: "", contrat: "", lecture: "Rien à rejouer." },
    mises_a_jour: [],
    verifie_contre: "",
    ...overrides,
  } as Analyse;
}

/** Un territoire d'exemple : trois chiffres, tous publiés sauf mention. */
function territoire(
  nom: string,
  chiffres: ExempleTerritoire["chiffres"] = [
    {
      libelle: "Dépenses de fonctionnement",
      unite: "EUR",
      id: "ofgl_depenses_fonctionnement",
      exercice: "2025",
      valeur: 412_300_000,
      precedent: { exercice: "2024", valeur: 400_000_000 },
    },
    {
      libelle: "Recettes de fonctionnement",
      unite: "EUR",
      id: "ofgl_recettes_fonctionnement",
      exercice: "2025",
      valeur: 480_000_000,
      precedent: null,
    },
    {
      libelle: "Dépenses d'investissement",
      unite: "EUR",
      id: "ofgl_depenses_investissement",
      exercice: "2025",
      valeur: 120_500_000,
      precedent: null,
    },
  ],
): ExempleTerritoire {
  return { nom, code: "33063", niveau: "commune", chiffres };
}

/** Le texte que le lecteur lit : balises retirées, entités rendues à leur
 *  caractère — sans quoi l'apostrophe échappée (`&#39;`) compterait pour deux
 *  chiffres à l'écran, et une sonde à la recherche d'un nombre s'y tromperait. */
function texteLu(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#39;|&amp;|&lt;|&gt;|&quot;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Le source sans ses commentaires : une règle citée dans un docstring n'est
 *  pas une règle appliquée dans le code. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/* --------------------------------------------------------------------------
 * Bloc 1 — Le verdict du moment
 * ----------------------------------------------------------------------- */

test("1. le verdict du moment est la plus récente des analyses mises en avant", () => {
  const vieille = analyseMinimale({ slug: "vieille", publie_le: "2025-01-01", mise_en_avant: true });
  const recente = analyseMinimale({ slug: "recente", publie_le: "2026-05-01", mise_en_avant: true });
  const autre = analyseMinimale({ slug: "autre", publie_le: "2026-08-01" });
  assert.equal(analyseDuMoment([vieille, autre, recente])?.slug, "recente");
});

test("2. sans aucune mise en avant, le repli est la plus récente — jamais un accueil sans verdict", () => {
  const a = analyseMinimale({ slug: "a", publie_le: "2025-01-01" });
  const b = analyseMinimale({ slug: "b", publie_le: "2026-01-01" });
  assert.equal(analyseDuMoment([a, b])?.slug, "b");
  assert.equal(analyseDuMoment([]), null);
});

test("3. la carte-verdict porte le chiffre annoncé, le chiffre des comptes, le cran et le lien", () => {
  const html = renduVerdictDuMoment(DEFENSE, CATALOGUE);
  const chiffre = DEFENSE.chiffres[0]!;
  assert.ok(
    html.includes(`« ${echapper(chiffre.dit)} »`),
    "le chiffre annoncé est cité tel quel",
  );
  assert.ok(
    html.includes(formater(chiffre.observe!.valeur, "EUR", false)),
    "le chiffre des comptes est celui que produit formater",
  );
  assert.ok(html.includes("exercice 2025"), "le millésime accompagne le montant");
  assert.ok(html.includes(LIBELLE_CRAN[DEFENSE.verdict.cran]));
  assert.ok(html.includes(LIBELLE_CONFUSION.vote_execute), "hors_perimetre nomme sa confusion");
  assert.ok(html.includes(`href="/analyses/${DEFENSE.slug}/"`));
  assert.ok(html.includes("Lire le verdict"));
});

test("4. l'auteur et la date de la déclaration s'affichent quand l'analyse les porte", () => {
  const html = renduVerdictDuMoment(analyseMinimale(), CATALOGUE);
  assert.ok(html.includes("Auteur de test"));
  assert.ok(html.includes("2026-01-01"));
  // Une affirmation sans auteur (le cas du fichier réel) n'écrit pas de ligne
  // d'attribution vide.
  assert.ok(!renduVerdictDuMoment(DEFENSE, CATALOGUE).includes("accueil__attribution"));
});

test("5. la source du chiffre des comptes n'est pas celle de la déclaration mise en cause", () => {
  const html = renduVerdictDuMoment(analyseMinimale(), CATALOGUE);
  const montant = formater(59_946_338_573, "EUR", false);
  const apres = html.slice(html.indexOf(montant));
  assert.ok(
    apres.includes("https://comptes.exemple.test"),
    "le montant publié cite la source que l'analyse déclare pour lui",
  );
  assert.ok(
    !apres.slice(0, apres.indexOf("</dd>")).includes("declaration.exemple.test"),
    "jamais la source de la déclaration à côté du chiffre des comptes",
  );
});

test("6. un indicateur absent du catalogue ne peint pas un montant : pas d'unité de repli", () => {
  const html = renduVerdictDuMoment(analyseMinimale(), []);
  assert.ok(!html.includes("M€"), "aucun montant en millions sans unité déclarée");
  assert.ok(!html.includes("Chiffre des comptes"));
  // La carte reste utile : le cran, l'affirmation et le lien tiennent.
  assert.ok(html.includes(LIBELLE_CRAN.exact));
  assert.ok(html.includes("Lire le verdict"));
});

test("7. un taux observé garde son unité : jamais un pourcentage peint en millions d'euros", () => {
  const analyse = analyseMinimale({
    chiffres: [
      {
        dit: "un habitant sur dix",
        observe: {
          indicateur: "insee_taux_pauvrete",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 14.4,
        },
        registre: "fait_comptable",
        lecture: "Le taux de pauvreté.",
      },
    ] as Analyse["chiffres"],
  });
  const catalogue = [{ id: "insee_taux_pauvrete", unite: "percent" }] as unknown as Indicateur[];
  const html = renduVerdictDuMoment(analyse, catalogue);
  assert.ok(html.includes(formater(14.4, "percent", false)));
  assert.ok(!html.includes("M€"));
});

test("8. le titre et l'affirmation sont échappés", () => {
  const html = renduVerdictDuMoment(
    analyseMinimale({ titre: "<script>alert(1)</script>" }),
    CATALOGUE,
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("9. sans aucune analyse publiée, le bloc n'écrit pas un cadre vide", () => {
  assert.equal(renduVerdictDuMoment(null, CATALOGUE), "");
});

/* --------------------------------------------------------------------------
 * Bloc 2 — Vérifiez par vous-même
 * ----------------------------------------------------------------------- */

test("10. la porte du simulateur liste les défis existants, et n'embarque pas de simulateur", () => {
  const html = renduVerifiez();
  for (const contrat of CONTRATS) {
    assert.ok(html.includes(echapper(contrat.nom)), `${contrat.cle} manque à la liste`);
    assert.ok(html.includes(`/simulateur?contrat=${contrat.cle}`));
  }
  assert.ok(html.includes("Rejouer le calcul"));
  // Une porte, pas un simulateur : aucun réglage n'est posé sur l'accueil.
  assert.ok(!/<input|<form|type="range"/.test(html));
});

test("11. la porte du simulateur n'écrit aucun montant : elle ne reçoit aucun fichier publié", () => {
  const html = renduVerifiez();
  assert.ok(!/[0-9]/.test(texteLu(html)), "aucun chiffre sans source à l'écran");
});

/* --------------------------------------------------------------------------
 * Bloc 3 — Et chez vous ?
 * ----------------------------------------------------------------------- */

test("12. le tirage ne montre jamais un territoire dont une valeur manque", () => {
  const incomplet = territoire("Trou", [
    {
      libelle: "Dépenses de fonctionnement",
      unite: "EUR",
      exercice: "2025",
      valeur: null,
      precedent: null,
    },
    { libelle: "Recettes", unite: "EUR", exercice: "2025", valeur: 10_000_000, precedent: null },
    { libelle: "Investissement", unite: "EUR", exercice: "2025", valeur: 2_000_000, precedent: null },
  ]);
  const court = territoire("Deux chiffres", [
    { libelle: "Recettes", unite: "EUR", exercice: "2025", valeur: 10_000_000, precedent: null },
    { libelle: "Investissement", unite: "EUR", exercice: "2025", valeur: 2_000_000, precedent: null },
  ]);
  const bon = territoire("Complet");
  const candidats = [incomplet, court, bon];
  // Tout l'aléa possible, pas un tirage : c'est la garantie entière qui est
  // éprouvée, et un tirage isolé aurait pu tomber sur le bon par chance.
  for (let i = 0; i <= 100; i += 1) {
    const tire = tirerTerritoire(candidats, i / 100);
    assert.equal(tire?.nom, "Complet", `alea ${i / 100} a tiré un territoire incomplet`);
  }
  // Et le rendu ne peut donc afficher aucun trou.
  const html = renduChezVous(tirerTerritoire(candidats, 0.5));
  assert.ok(!texteLu(html).includes("null"));
  assert.ok(!texteLu(html).includes("NaN"));
});

test("13. le tirage parcourt toute la liste des territoires complets", () => {
  const candidats = [territoire("Un"), territoire("Deux"), territoire("Trois")];
  assert.equal(tirerTerritoire(candidats, 0)?.nom, "Un");
  assert.equal(tirerTerritoire(candidats, 0.5)?.nom, "Deux");
  assert.equal(tirerTerritoire(candidats, 0.999)?.nom, "Trois");
  // Les bornes ne sortent pas de la liste : `Math.random()` rend [0, 1[, mais
  // un appelant qui passe 1 ne doit pas obtenir `undefined`.
  assert.equal(tirerTerritoire(candidats, 1)?.nom, "Trois");
  assert.equal(tirerTerritoire([], 0.5), null);
});

test("14. sans territoire complet, le bloc montre le champ de recherche sans exemple", () => {
  const html = renduChezVous(null);
  assert.ok(!html.includes("accueil__exemple"));
  assert.ok(html.includes("Chercher ma commune"));
});

test("15. l'exemple montre ses montants en millions d'euros, jamais par habitant", () => {
  const html = renduChezVous(territoire("Complet"));
  assert.ok(html.includes(formater(412_300_000, "EUR", false)));
  assert.ok(html.includes(formater(480_000_000, "EUR", false)));
  assert.ok(html.includes(formater(120_500_000, "EUR", false)));
  // Le par-habitant ne s'affiche que dans les tableaux dépliés : ni la mention,
  // ni la forme que `formater` lui donne (une somme en euros) n'ont leur place
  // ici.
  assert.ok(!/par habitant/i.test(html));
  assert.ok(!html.includes(formater(412_300_000, "EUR", true)));
  // Et la règle se tient à la source : aucun appel de formater ne passe vrai.
  assert.ok(!/formater\([^)]*,\s*true/.test(SOURCE));
});

test("16. un taux varie en points, un montant en pourcentage", () => {
  const taux = renduChezVous(
    territoire("Taux", [
      {
        libelle: "Taux de pauvreté",
        unite: "percent",
        exercice: "2025",
        valeur: 12,
        precedent: { exercice: "2019", valeur: 10 },
      },
      { libelle: "Recettes", unite: "EUR", exercice: "2025", valeur: 10_000_000, precedent: null },
      {
        libelle: "Dépenses",
        unite: "EUR",
        exercice: "2025",
        valeur: 20_000_000,
        precedent: { exercice: "2019", valeur: 10_000_000 },
      },
    ]),
  );
  assert.ok(
    taux.includes(formaterVariation(2, "percent", modeVariation("percent"))),
    "un taux qui passe de 10 % à 12 % gagne 2 points",
  );
  assert.ok(!taux.includes("+20 %"), "il ne monte pas de 20 %");
  assert.ok(
    taux.includes(formaterVariation(100, "EUR", modeVariation("EUR"))),
    "un montant qui double monte de 100 %",
  );
});

test("17. un taux publié pour mille suit la conversion de l'écran, jamais un chiffre dix fois trop grand", () => {
  const html = renduChezVous(
    territoire("Pour mille", [
      {
        libelle: "Cambriolages",
        unite: "pour_1000_logements",
        exercice: "2025",
        valeur: 30,
        precedent: { exercice: "2019", valeur: 10 },
      },
      { libelle: "Recettes", unite: "EUR", exercice: "2025", valeur: 10_000_000, precedent: null },
      { libelle: "Dépenses", unite: "EUR", exercice: "2025", valeur: 20_000_000, precedent: null },
    ]),
  );
  const attendue = formaterVariation(20, "pour_1000_logements", modeVariation("pour_1000_logements"));
  assert.ok(html.includes(attendue), `la variation attendue est ${attendue}`);
  assert.ok(!html.includes("+20 pts"), "jamais les points non convertis");
});

test("18. une série qui partait de zéro n'affiche pas de variation infinie", () => {
  const html = renduChezVous(
    territoire("Depuis zéro", [
      {
        libelle: "Investissement",
        unite: "EUR",
        exercice: "2025",
        valeur: 5_000_000,
        precedent: { exercice: "2019", valeur: 0 },
      },
      { libelle: "Recettes", unite: "EUR", exercice: "2025", valeur: 10_000_000, precedent: null },
      { libelle: "Dépenses", unite: "EUR", exercice: "2025", valeur: 20_000_000, precedent: null },
    ]),
  );
  assert.ok(!html.includes("Infinity"));
  assert.ok(!html.includes("accueil__variation"));
  assert.ok(html.includes(formater(5_000_000, "EUR", false)), "le montant, lui, reste affiché");
});

test("19. le bloc vise le champ de recherche du site, il n'en construit pas un second", () => {
  const html = renduChezVous(territoire("Complet"));
  assert.ok(!html.includes("<input"), "aucun second champ de recherche");
  assert.ok(html.includes('href="#recherche"'), "l'appel vise le champ de l'en-tête");
  // L'exemple mène à sa fiche, avec les paramètres que l'adresse du site porte.
  assert.ok(html.includes("/territoire?niveau=commune&territoire=33063"));
});

test("20. l'exemple montre un territoire à la fois : aucun classement", () => {
  const html = renduChezVous(territoire("Complet"));
  const noms = [...html.matchAll(/accueil__exemple-nom/g)];
  assert.equal(noms.length, 1);
  assert.ok(!/<ol\b/.test(html), "aucune liste ordonnée : rien n'est rangé par valeur");
});

/* --------------------------------------------------------------------------
 * Bloc 4 — Les analyses récentes
 * ----------------------------------------------------------------------- */

test("21. les analyses récentes se rangent par date de publication, jamais par montant", () => {
  const petite = analyseMinimale({
    slug: "petite",
    titre: "La petite",
    publie_le: "2026-06-01",
    chiffres: [
      {
        dit: "un million",
        observe: {
          indicateur: "etat_mission_defense_credits_votes",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 1_000_000,
        },
        registre: "fait_comptable",
        lecture: "Un petit montant.",
      },
    ] as Analyse["chiffres"],
  });
  const grosse = analyseMinimale({
    slug: "grosse",
    titre: "La grosse",
    publie_le: "2026-02-01",
    chiffres: [
      {
        dit: "cent milliards",
        observe: {
          indicateur: "etat_mission_defense_credits_votes",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 100_000_000_000,
        },
        registre: "fait_comptable",
        lecture: "Un gros montant.",
      },
    ] as Analyse["chiffres"],
  });
  const html = renduAnalysesRecentes([grosse, petite]);
  assert.ok(
    html.indexOf("La petite") < html.indexOf("La grosse"),
    "la plus récente d'abord, quel que soit le montant en cause",
  );
});

test("22. chaque carte porte son cran et sa date, et six au plus", () => {
  const beaucoup = Array.from({ length: 9 }, (_, i) =>
    analyseMinimale({ slug: `a${i}`, titre: `Analyse ${i}`, publie_le: `2026-0${i + 1}-01` }),
  );
  const html = renduAnalysesRecentes(beaucoup);
  assert.equal([...html.matchAll(/accueil__carte-analyse/g)].length, 6);
  assert.ok(html.includes(LIBELLE_CRAN.exact));
  assert.ok(html.includes('<time datetime="2026-09-01">'));
});

test("23. l'analyse déjà en tête n'est pas relistée juste en dessous", () => {
  const a = analyseMinimale({ slug: "en-tete", titre: "Celle du moment" });
  const b = analyseMinimale({ slug: "autre", titre: "Une autre" });
  const html = renduAnalysesRecentes([a, b], "en-tete");
  assert.ok(!html.includes("Celle du moment"));
  assert.ok(html.includes("Une autre"));
  // Et quand il ne reste rien, pas de cadre vide.
  assert.equal(renduAnalysesRecentes([a], "en-tete"), "");
});

/* --------------------------------------------------------------------------
 * Bloc 5 — La bande de confiance
 * ----------------------------------------------------------------------- */

test("24. la bande compte les indicateurs qu'elle reçoit et cite ses producteurs sans logo", () => {
  const catalogue = Array.from(
    { length: 1234 },
    (_, i) => ({ id: `i${i}`, unite: "EUR" }) as unknown as Indicateur,
  );
  const html = renduBandeConfiance(catalogue, ["INSEE", "DGFiP", "INSEE", "OFGL"]);
  assert.ok(html.includes(`${formater(1234, "count", false)} indicateurs publiés`));
  // Mentions textuelles, jamais un logo (décision D9), et pas de doublon.
  assert.ok(!/<img|<svg/.test(html));
  assert.equal([...html.matchAll(/INSEE/g)].length, 1);
  assert.ok(html.includes("INSEE · DGFiP · OFGL"), "l'ordre reçu est gardé : pas de palmarès");
  assert.ok(html.includes('href="/methode"'));
  assert.ok(html.includes('href="/methode#methode-journal"'));
});

/* --------------------------------------------------------------------------
 * La page entière
 * ----------------------------------------------------------------------- */

function page(overrides: Partial<Parameters<typeof rendu>[0]> = {}): string {
  return rendu({
    analyses: [DEFENSE],
    catalogue: CATALOGUE,
    territoires: [territoire("Complet")],
    alea: 0.5,
    producteurs: ["DGFiP", "OFGL"],
    ...overrides,
  });
}

test("25. la mention d'unité est posée une fois, en tête de page", () => {
  const html = page();
  assert.equal(
    html.split(MENTION_MILLIONS).length - 1,
    1,
    "répétée, la mention cesse d'être lue là où elle compte",
  );
  assert.ok(
    html.indexOf(MENTION_MILLIONS) < html.indexOf("accueil__bloc"),
    "elle précède le premier bloc",
  );
});

test("26. le message principal est suivi immédiatement d'une preuve, jamais d'un développement", () => {
  const html = page();
  assert.ok(html.includes(MESSAGE_PRINCIPAL));
  const entreDeux = html.slice(
    html.indexOf(MESSAGE_PRINCIPAL) + MESSAGE_PRINCIPAL.length,
    html.indexOf('<section class="accueil__bloc'),
  );
  assert.equal(
    texteLu(entreDeux).replace(`${MENTION_MILLIONS}.`, "").trim(),
    "",
    "entre le message et la preuve, rien d'autre que la mention d'unité",
  );
  // La preuve, c'est le verdict : le premier bloc porte un chiffre publié.
  const premierBloc = html.slice(html.indexOf('<section class="accueil__bloc'));
  assert.ok(
    premierBloc.startsWith('<section class="accueil__bloc accueil__bloc--verdict'),
  );
  assert.ok(premierBloc.includes(formater(DEFENSE.chiffres[0]!.observe!.valeur, "EUR", false)));
});

test("27. les trois appels à l'action suivent l'entonnoir", () => {
  const html = page();
  const ordre = ["Lire le verdict", "Rejouer le calcul", "Chercher ma commune"].map((appel) =>
    html.indexOf(appel),
  );
  assert.ok(ordre.every((i) => i !== -1), "les trois appels existent");
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre, "et dans cet ordre");
});

test("28. les cinq blocs sont là, dans l'ordre de la spec", () => {
  const html = page({ analyses: [DEFENSE, analyseMinimale({ slug: "autre", titre: "Une autre" })] });
  const blocs = [...html.matchAll(/accueil__bloc accueil__bloc--([a-z]+)/g)].map((m) => m[1]);
  assert.deepEqual(blocs, ["verdict", "simulateur", "territoire", "analyses", "confiance"]);
});

test("29. aucun montant par habitant sur l'accueil entier", () => {
  const html = page();
  assert.ok(!/par habitant/i.test(html));
});

test("30. le module est pur : ni DOM, ni réseau, ni horloge, ni tirage caché", () => {
  const code = sansCommentaires(SOURCE);
  assert.ok(!/document\.|window\.|fetch\(|localStorage/.test(code));
  assert.ok(!/Math\.random|Date\.now|new Date\(/.test(code), "l'aléa est reçu, jamais appelé");
});

test("31. le message principal n'est écrit qu'une fois dans le dépôt", () => {
  // Le pré-rendu le peint sur la carte de partage du simulateur : il lit cette
  // constante-ci. Deux rédactions du même message finiraient par en dire deux
  // choses — c'est un défaut que ce projet a déjà corrigé deux fois.
  const prerendu = readFileSync(new URL("../scripts/prerendre.ts", import.meta.url), "utf8");
  assert.ok(!prerendu.includes("Les chiffres du débat budgétaire"));
  assert.ok(prerendu.includes('import { MESSAGE_PRINCIPAL } from "../src/accueil.ts"'));
});
