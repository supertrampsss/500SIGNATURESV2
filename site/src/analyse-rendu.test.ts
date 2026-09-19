/**
 * Le rendu d'une analyse : quatre étages, du plus rapide au plus profond.
 *
 * L'analyse de test reprend le premier fichier réel du dépôt (défense 2025,
 * `hors_perimetre` / `vote_execute`) et une variante minimale pour les cas que
 * ce fichier ne couvre pas (cran `exact`, auteur `null`, budget vide…).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Analyse, Confusion, QualificationVerdict } from "./analyse-rendu.ts";
import {
  filtrerAnalyses,
  LIBELLE_CONFUSION,
  LIBELLE_CRAN,
  LIBELLE_QUALIFICATION,
  qualificationVerdict,
  rendu,
  renduIndex,
} from "./analyse-rendu.ts";
import { citable, citer, type Citation } from "./citer.ts";
import { formater } from "./echelle.ts";
import { construireRegistre, indexerSources } from "./registre-sources.ts";

const CATALOGUE = [
  { id: "etat_mission_defense_credits_votes", unite: "EUR" },
  { id: "etat_mission_defense_credits_consommes", unite: "EUR" },
] as never[];

// Catalogue pour les fixtures qui mélangent les registres — distinct de
// CATALOGUE ci-dessus pour porter un `jeu`, comme le ferait un vrai catalogue.
// Ce champ n'est plus lu par l'étage 4 (Critical A, voir analyse-rendu.ts) :
// il reste dans la fixture pour prouver que sa présence ne fait rien
// réapparaître.
const CATALOGUE_MIXTE = [
  { id: "test_indicateur_vote", unite: "EUR", jeu: "jeu-test" },
  { id: "test_indicateur_consomme", unite: "EUR", jeu: "jeu-test" },
] as never[];

// L'analyse réelle du dépôt, chargée telle que publiée : le rendu doit la
// tenir sans transformation.
const DEFENSE: Analyse = JSON.parse(
  readFileSync(
    new URL("../analyses/defense-credits-votes-consommes-2025.json", import.meta.url),
    "utf8",
  ),
);

/** Une analyse minimale, pour les cas que le fichier réel ne couvre pas. */
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
      texte: "<script>alert(1)</script> Un chiffre couramment répété.",
      auteur: null,
      date: null,
      source: { titre: "Source de test", url: "https://exemple.test", consulte_le: "2026-01-01" },
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
          valeur: 59946338573.0,
        },
        registre: "fait_comptable",
        lecture: "Les crédits votés.",
      },
    ],
    hypotheses: [],
    effets_indirects: [],
    sources: [
      { titre: "Source de test", url: "https://exemple.test", consulte_le: "2026-01-01" },
    ],
    simulateur: { budget: "", contrat: "", lecture: "Rien à rejouer pour cette analyse." },
    mises_a_jour: [],
    verifie_contre: "",
    ...overrides,
  } as Analyse;
}

/**
 * Une analyse qui mélange les registres — deux `fait_comptable` observés sur
 * deux exercices différents, et une `interpretation` sans `observe` — avec un
 * `dit` distinct sur chaque chiffre. Les treize tests d'origine ne
 * couvraient qu'un seul registre à la fois et qu'un seul exercice par
 * chiffre : c'est cette variété absente qui laissait passer les trois
 * défauts fermés par cette vague (findings 1 à 3).
 */
function analyseMixte(overrides: Partial<Analyse> = {}): Analyse {
  return analyseMinimale({
    slug: "mixte-test",
    chiffres: [
      {
        dit: "à peu près 45 milliards d'euros",
        observe: {
          indicateur: "test_indicateur_vote",
          niveau: "pays",
          code: "FR",
          periode: "2019",
          valeur: 44987654321.5,
        },
        registre: "fait_comptable",
        lecture: "Les crédits votés en 2019.",
      },
      {
        dit: "un peu plus de 50 milliards d'euros",
        observe: {
          indicateur: "test_indicateur_consomme",
          niveau: "pays",
          code: "FR",
          periode: "2025",
          valeur: 50123456789.12,
        },
        registre: "fait_comptable",
        lecture: "Les crédits consommés en 2025.",
      },
      {
        dit: "de l'ordre de 5 milliards selon plusieurs instituts",
        registre: "interpretation",
        lecture: "Un rapprochement qui n'est publié par aucun fichier.",
      },
    ],
    ...overrides,
  });
}

/** Deux séries et deux sources qui forcent le rendu long à rendre ses axes et
 * ses citations explicitement, sans pouvoir emprunter la première source. */
function analyseLongue(): Analyse {
  return analyseMinimale({
    slug: "dossier-long",
    titre: "Comment ces deux grandeurs ont-elles évolué ?",
    publie_le: "2026-08-30",
    sources: [
      {
        id: "eurostat",
        titre: "Eurostat, prix de l'électricité",
        url: "https://ec.europa.eu/eurostat/prix",
        consulte_le: "2026-08-29",
      },
      {
        id: "insee",
        titre: "Insee, satisfaction dans la vie",
        url: "https://www.insee.fr/satisfaction",
        consulte_le: "2026-08-28",
      },
    ],
    dossier: {
      chapo: "Deux publications officielles répondent à deux questions distinctes.",
      sommaire: ["constat"],
      series: [
        {
          id: "prix-electricite",
          libelle: "Prix de l'électricité des ménages",
          unit: "EUR_per_kWh",
          definition: "Prix TTC des ménages dans la bande de consommation DC.",
          sourceId: "eurostat",
          observations: [
            { period: "2024-S1", value: 0.4023, qualityFlags: ["provisional"] },
          ],
        },
        {
          id: "satisfaction",
          libelle: "Satisfaction dans la vie",
          unit: "score_0_10",
          definition: "Note moyenne déclarée par les personnes âgées de 16 ans ou plus.",
          sourceId: "insee",
          observations: [{ period: "2024", value: 7.2 }],
        },
      ],
      preuves: [
        {
          id: "preuve-prix",
          libelle: "Prix semestriel publié",
          value: 0.4023,
          unit: "EUR_per_kWh",
          period: "2024-S1",
          definition: "Prix TTC des ménages dans la bande de consommation DC.",
          sourceId: "eurostat",
          seriesId: "prix-electricite",
          qualityFlags: ["provisional"],
        },
        {
          id: "preuve-satisfaction",
          libelle: "Satisfaction annuelle publiée",
          value: 7.2,
          unit: "score_0_10",
          period: "2024",
          definition: "Note moyenne déclarée par les personnes âgées de 16 ans ou plus.",
          sourceId: "insee",
          seriesId: "satisfaction",
        },
      ],
      visualisations: [
        {
          id: "comparaison",
          type: "line",
          titre: "Deux échelles publiées séparément",
          resume: "Le tableau restitue chaque observation dans son unité officielle.",
          seriesIds: ["prix-electricite", "satisfaction"],
          axes: [
            { id: "axe-prix", unit: "EUR_per_kWh", seriesIds: ["prix-electricite"] },
            { id: "axe-score", unit: "score_0_10", seriesIds: ["satisfaction"] },
          ],
        },
      ],
      sections: [
        {
          id: "constat",
          titre: "Ce que montrent les publications",
          paragraphes: ["Les deux séries restent séparées car elles ne mesurent pas la même chose."],
          preuveIds: ["preuve-prix", "preuve-satisfaction"],
          visualisationIds: ["comparaison"],
        },
      ],
      limitations: ["Ces deux grandeurs ne permettent pas d'établir une relation causale."],
    },
  });
}

























test("la qualification distingue exactitude, périmètre et absence de preuve", () => {
  assert.equal(
    qualificationVerdict(analyseMinimale({ verdict: { cran: "exact", phrase: "Exact." } })),
    "confirme",
  );
  assert.equal(qualificationVerdict(DEFENSE), "contexte_manquant");
  assert.equal(
    qualificationVerdict(analyseMinimale({ verdict: { cran: "introuvable", phrase: "Absent." } })),
    "non_demontre",
  );

  const attendues = {
    ae_cp: "contexte_manquant",
    brut_net: "ordre_grandeur",
    vote_execute: "contexte_manquant",
    stock_flux: "contredit",
    etat_apu: "perimetre_trompeur",
    annuel_cumule: "contredit",
    perimetre_geographique: "perimetre_trompeur",
    gros_detail: "contexte_manquant",
    panier_partiel: "contexte_manquant",
    indicateur_partiel: "contexte_manquant",
  } satisfies Record<Confusion, QualificationVerdict>;
  for (const [confusion, qualification] of Object.entries(attendues) as [
    Confusion,
    QualificationVerdict,
  ][]) {
    assert.equal(
      qualificationVerdict(
        analyseMinimale({ verdict: { cran: "hors_perimetre", confusion, phrase: "Périmètre distinct." } }),
      ),
      qualification,
      `${confusion} doit rester qualifié sans recourir à la prose libre`,
    );
  }

  assert.deepEqual(LIBELLE_QUALIFICATION, {
    confirme: "Confirmé",
    ordre_grandeur: "Ordre de grandeur correct",
    contexte_manquant: "Contexte manquant",
    perimetre_trompeur: "Périmètre trompeur",
    non_demontre: "Non démontré",
    contredit: "Contredit",
  });
});



































test("l'index pointe vers la page réelle de l'analyse, pas une ancre morte (finding 3)", () => {
  const html = renduIndex([DEFENSE], CATALOGUE);
  assert.ok(
    html.includes(`href="/analyses/${DEFENSE.slug}/"`),
    "le lien de l'index doit pointer vers /analyses/<slug>/",
  );
  assert.doesNotMatch(html, /href="#/);
});













/* --------------------------------------------------------------------------
 * « Citer » : la commande n'est posée que là où les cinq éléments existent
 * ----------------------------------------------------------------------- */

const ADRESSE = "https://500signatures.fr/analyses/defense-credits-votes-consommes-2025/";

/** Les charges utiles `data-citer` d'un rendu, relues comme le fait `main.ts` :
 *  l'attribut est du JSON échappé pour l'attribut HTML, jamais du texte gratté
 *  sur la page. */
function citations(html: string): Citation[] {
  return [...html.matchAll(/data-citer="([^"]*)"/g)].map(
    (trouvee) =>
      JSON.parse(
        trouvee[1]!
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&"),
      ) as Citation,
  );
}













/* --------------------------------------------------------------------------
 * L'index — spec §9.1 : « Liste antichronologique de cartes-verdicts. Chaque
 * carte porte le chiffre en cause, le cran, la date de publication, et un
 * marqueur si l'analyse a été mise à jour depuis sa parution. Filtres : par
 * type d'analyse, par thème, par budget concerné. La recherche textuelle est
 * permissive. »
 * ----------------------------------------------------------------------- */

/** Le <li> qui porte ce titre, pour lire une carte sans découper sur une
 *  fenêtre de caractères arbitraire. */
function carteDe(html: string, titre: string): string {
  const idx = html.indexOf(titre);
  assert.ok(idx > -1, `« ${titre} » introuvable dans l'index`);
  const debut = html.lastIndexOf("<li", idx);
  return html.slice(debut, html.indexOf("</li>", idx) + "</li>".length);
}











test("un corpus d'une seule analyse n'affiche aucune barre de filtres", () => {
  // Une barre qui ne peut rien réduire est du mobilier : elle occupe la place
  // de la seule chose que la page a à montrer.
  const html = renduIndex([DEFENSE], CATALOGUE);
  assert.doesNotMatch(html, /analyses-filtres/);
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /type="search"/);
});

test("une facette ne s'affiche que si le corpus porte au moins deux valeurs distinctes", () => {
  // Deux analyses de MÊME type, de MÊME budget, de thèmes DIFFÉRENTS : seule
  // la facette « thème » peut changer la liste, seule elle s'affiche.
  const a = analyseMinimale({ slug: "a", titre: "Première", themes: ["budget_etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", themes: ["dette"] });
  const html = renduIndex([a, b], CATALOGUE);
  assert.match(html, /data-facette="theme"/);
  assert.doesNotMatch(html, /data-facette="type"/);
  assert.doesNotMatch(html, /data-facette="budget"/);
  // Et les deux valeurs y sont, nommées en français — jamais l'identifiant nu.
  const menu = html.slice(html.indexOf('data-facette="theme"'), html.indexOf("</select>"));
  assert.match(menu, /Budget de l&#39;État/);
  assert.match(menu, /Dette publique/);
});

test("les trois facettes s'affichent dès que les trois séparent le corpus", () => {
  const a = analyseMinimale({ slug: "a", titre: "Première", type: "decryptage", themes: ["dette"], budgets_concernes: ["etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", type: "comparaison", themes: ["securite_sociale"], budgets_concernes: ["secu"] });
  const html = renduIndex([a, b], CATALOGUE);
  for (const facette of ["type", "theme", "budget"]) {
    assert.match(html, new RegExp(`data-facette="${facette}"`), `facette ${facette} absente`);
  }
});

test("la barre est servie repliée : sans le paquet, aucun réglage mort, toutes les cartes lisibles", () => {
  // La page est pré-rendue (scripts/prerendre.ts) : les filtres sont un
  // progrès, jamais une condition d'accès. `main.ts` déplie la barre.
  const a = analyseMinimale({ slug: "a", titre: "Première", themes: ["budget_etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", themes: ["dette"] });
  const html = renduIndex([a, b], CATALOGUE);
  assert.match(html, /<div class="analyses-filtres" id="analyses-filtres"[^>]* hidden>/);
  assert.doesNotMatch(html, /<li[^>]*\bhidden\b/);
  assert.ok(html.includes("Première") && html.includes("Seconde"));
});

/* ---- Le filtrage, en données ---- */

const CORPUS: Analyse[] = [
  analyseMinimale({
    slug: "defense",
    titre: "Les crédits de la Défense",
    type: "decryptage",
    themes: ["budget_etat"],
    budgets_concernes: ["etat"],
    verdict: { cran: "exact", phrase: "Le chiffre correspond aux comptes publiés." },
  }),
  analyseMinimale({
    slug: "retraites",
    titre: "Le déficit des retraites",
    type: "comparaison",
    themes: ["securite_sociale"],
    budgets_concernes: ["secu"],
    affirmation: {
      texte: "Une aide sociale versée à l'insertion des personnes sans emploi.",
      auteur: null,
      date: null,
      source: { titre: "Source", url: "https://exemple.test", consulte_le: "2026-01-01" },
    },
    verdict: { cran: "introuvable", phrase: "Aucune ligne ne porte ce montant." },
  }),
  analyseMinimale({
    slug: "commune",
    titre: "L'investissement des communes",
    type: "decryptage",
    themes: ["finances_locales", "budget_etat"],
    budgets_concernes: ["collectivites"],
    verdict: { cran: "exact", phrase: "Le montant annoncé est celui du compte." },
  }),
];

const slugs = (criteres: Parameters<typeof filtrerAnalyses>[1]) =>
  filtrerAnalyses(CORPUS, criteres).map((a) => a.slug);

test("sans critère, le filtre ne retranche rien", () => {
  assert.deepEqual(slugs({}), ["defense", "retraites", "commune"]);
});

test("filtre par type d'analyse", () => {
  assert.deepEqual(slugs({ type: "comparaison" }), ["retraites"]);
  assert.deepEqual(slugs({ type: "decryptage" }), ["defense", "commune"]);
});

test("filtre par thème — une analyse est retenue par chacun de ses thèmes", () => {
  assert.deepEqual(slugs({ theme: "budget_etat" }), ["defense", "commune"]);
  assert.deepEqual(slugs({ theme: "finances_locales" }), ["commune"]);
});

test("filtre par budget concerné", () => {
  assert.deepEqual(slugs({ budget: "secu" }), ["retraites"]);
  assert.deepEqual(slugs({ budget: "collectivites" }), ["commune"]);
});

test("les critères se cumulent", () => {
  assert.deepEqual(slugs({ type: "decryptage", budget: "collectivites" }), ["commune"]);
  assert.deepEqual(slugs({ type: "comparaison", budget: "etat" }), []);
});

test("la recherche est permissive : chaque mot compte, l'ordre et la contiguïté non", () => {
  // « aide sociale » ne doit pas exiger ces deux mots collés dans cet ordre —
  // c'est la règle de `chercher()` (simulateur.ts), et le texte visé porte
  // « aide » et « sociale » séparés par quatre mots, dans l'ordre inverse de
  // la requête ci-dessous.
  assert.deepEqual(slugs({ recherche: "sociale aide" }), ["retraites"]);
  assert.deepEqual(slugs({ recherche: "aide sociale" }), ["retraites"]);
  // Sans accents ni casse, comme partout ailleurs sur le site.
  assert.deepEqual(slugs({ recherche: "DEFICIT" }), ["retraites"]);
  // Et le « et » fait la précision : un mot absent écarte la ligne.
  assert.deepEqual(slugs({ recherche: "sociale defense" }), []);
});

test("la recherche porte sur le verdict et les chiffres, pas seulement sur le titre", () => {
  assert.deepEqual(slugs({ recherche: "comptes publiés" }), ["defense"]);
});







test("chaque libellé de filtre est groupé avec son contrôle", () => {
  const a = analyseMinimale({ slug: "a", titre: "Première", type: "decryptage", themes: ["dette"], budgets_concernes: ["etat"] });
  const b = analyseMinimale({ slug: "b", titre: "Seconde", type: "comparaison", themes: ["securite_sociale"], budgets_concernes: ["secu"] });
  const html = renduIndex([a, b], CATALOGUE);
  assert.match(html, /<div class="analyses-filtres__groupe analyses-filtres__groupe--recherche">\s*<label[^>]*for="analyses-recherche"[\s\S]*?<input[^>]*id="analyses-recherche"/);
  for (const facette of ["type", "theme", "budget"]) {
    assert.match(html, new RegExp(`<div class="analyses-filtres__groupe">\\s*<label[^>]*for="analyses-${facette}"[\\s\\S]*?<select[^>]*id="analyses-${facette}"`));
  }
});



test("tous les dossiers suivent la lecture continue et placent sources et date à la fin", () => {
  const noms = ["age-achat-residence-principale", "championne-du-monde-prelevements-2024", "defense-credits-votes-consommes-2025", "defense-europe-depenses-2024", "electricite-exportee-facture-francais", "fournitures-scolaires-prix-1990-2025", "groenland-accord-securite-europe", "la-depense-publique-baisse-2024", "prix-gaz-menages-2022-2025", "retraites-premier-poste-2024", "satisfaction-vie-france-2010-2024", "ukraine-pret-europeen-90-milliards"];
  for (const nom of noms) {
    const a = JSON.parse(readFileSync(new URL(`../analyses/${nom}.json`,import.meta.url),"utf8"));
    const html = rendu(a,[]);
    assert.equal((html.match(/<h1 /g) ?? []).length,1);
    assert.match(html,/class="analyse-longue__chapo"/);
    assert.match(html,/id="conclusion"/);
    assert.doesNotMatch(html,/<details|<summary|Citer ce chiffre|chemin de preuve|Méthode et périmètre|Données complètes|La rédaction|class="dossier-preuve/);
    const pied = html.indexOf('id="sources"');
    assert.ok(pied > html.indexOf('id="conclusion"'));
    assert.ok(html.indexOf('class="dossier-date"') > pied);
    assert.doesNotMatch(html.slice(0,pied), /href="https?:/);
    assert.doesNotMatch(html.slice(0,html.indexOf('</header>')), /<time|Publié le/);
  }
});
test("le dossier Groenland explique la sécurité avec un calendrier sourcé",()=>{
  const a=JSON.parse(readFileSync(new URL('../analyses/groenland-accord-securite-europe.json',import.meta.url),'utf8'));
  const html=rendu(a,[]);
  assert.match(html,/dossier-chronologie/);
  assert.match(html,/Assemblée générale de l’ONU/);
  assert.doesNotMatch(html,/DOAG|225|croissance verte/);
  a.dossier.chronologie.sourceId='inconnue';
  assert.throws(()=>rendu(a,[]),/chronologie.sourceId/);
});
test("les cartes donnent un seul lien natif et une introduction immédiatement lisible",()=>{
  const html=renduIndex([DEFENSE],CATALOGUE);
  assert.doesNotMatch(html,/<details|<summary|Le constat|↗/);
  assert.equal((html.match(/href="\/analyses\/defense-credits-votes-consommes-2025\/"/g)??[]).length,1);
  assert.match(html,/>Dossiers<\/h1>/);
});
test("le rendu échappe le titre, le texte et les sources",()=>{
 const html=rendu(analyseMinimale({titre:'<script>alert(1)</script>'}),[]);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
