import { DILEMMES } from "../dilemmes.ts";
import { MESURES, type Mesure, type Soutien } from "../mesures.ts";
import type {
  Chapter,
  Decision,
  EffectRule,
  Scenario,
  Uncertainty,
} from "./types.ts";
import { V3_MODELED_EFFECT_MARKER } from "./types.ts";

const SOURCE_URL = "https://plateforme-9sz.pages.dev/sources/";

const CHAPTERS: Omit<Chapter, "decisionIds">[] = [
  {
    id: "taxes-assets-transmission",
    title: "Impôts, patrimoine et transmission",
    domains: ["Impôt sur le revenu", "Patrimoine", "Consommation", "Entreprises"],
    opening: "Le mandat commence par la question la plus immédiate : qui finance l'action publique et selon quelles règles.",
    tension: "Chaque recette protège un budget, mais déplace l'effort vers un groupe précis.",
  },
  {
    id: "work-wages-pensions",
    title: "Travail, salaires et retraites",
    domains: ["Emploi", "Salaires", "Retraites", "Assurance chômage"],
    opening: "Le financement du modèle social dépend du travail, des cotisations et de la durée d'activité.",
    tension: "Redresser les comptes sociaux modifie directement les revenus et les parcours de vie.",
  },
  {
    id: "health-social-protection",
    title: "Santé et protection sociale",
    domains: ["Hôpital", "Soins de ville", "Prestations", "Solidarité"],
    opening: "Les besoins progressent plus vite que certaines ressources et rendent les arbitrages immédiatement visibles.",
    tension: "Réduire la dépense peut déplacer le coût vers les patients, les familles ou les professionnels.",
  },
  {
    id: "security-immigration-justice",
    title: "Sécurité, immigration et justice",
    domains: ["Police", "Justice", "Immigration", "Prisons"],
    opening: "L'autorité publique se mesure à ses moyens, mais aussi aux règles qu'elle accepte de s'imposer.",
    tension: "Les mesures les plus visibles sont souvent celles dont les effets budgétaires et juridiques sont les plus discutés.",
  },
  {
    id: "defence-europe-sovereignty",
    title: "Défense, Europe et souveraineté",
    domains: ["Armées", "Europe", "Diplomatie", "Industrie stratégique"],
    opening: "La souveraineté exige des capacités coûteuses et des alliances qui limitent parfois la liberté de décision.",
    tension: "Préparer les crises futures oblige à financer aujourd'hui des résultats difficiles à observer immédiatement.",
  },
  {
    id: "energy-climate-transport-agriculture",
    title: "Énergie, climat, transports et agriculture",
    domains: ["Électricité", "Climat", "Mobilités", "Agriculture"],
    opening: "La transition transforme les infrastructures, les prix et l'aménagement du territoire.",
    tension: "Accélérer coûte maintenant. Attendre reporte le coût et augmente certains risques.",
  },
  {
    id: "education-housing-family",
    title: "Éducation, logement et famille",
    domains: ["École", "Université", "Logement", "Famille"],
    opening: "Ces politiques déterminent les possibilités offertes aux générations présentes et futures.",
    tension: "Les économies rapides peuvent produire des coûts durables sur l'égalité et l'attractivité.",
  },
  {
    id: "state-institutions-territories",
    title: "État, institutions et territoires",
    domains: ["Administration", "Institutions", "Collectivités", "Services publics"],
    opening: "Le dernier chapitre interroge la machine publique elle-même et la manière dont le pouvoir est réparti.",
    tension: "Transformer l'État peut dégager des marges, mais fragilise les équilibres qui permettent encore d'agir.",
  },
];

function clean(text: string): string {
  return text.replaceAll("\u2014", ":").replace(/\s+/g, " ").trim();
}

function uncertainty(measure: Mesure): Uncertainty {
  const precision = measure.precision?.toLocaleLowerCase("fr") ?? "";
  if (/contest|arithmétique|fourchette|incertain|brut/.test(precision)) return "forte";
  if (precision) return "moyenne";
  return "moyenne";
}

function supportEffect(decisionId: string, optionId: string, support: Soutien, delta: number): EffectRule {
  const base = {
    id: `${decisionId}:${optionId}:${support}`,
    delta,
    timing: { kind: "immediate" } as const,
    duration: "once" as const,
    explanation: clean(`Réaction simulée du groupe ${support}.`),
  };
  switch (support) {
    case "opinion":
      return { ...base, target: "indicator", key: "opinion" };
    case "marches":
      return { ...base, target: "indicator", key: "financialCredibility" };
    case "entreprises":
      return { ...base, target: "group", key: "businesses" };
    case "territoires":
      return { ...base, target: "group", key: "localAuthorities" };
  }
}

function scaledPoliticalDelta(delta: number): number {
  return Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / 2));
}

function scaledGrowthDelta(support: Soutien, delta: number): number {
  const coefficient = support === "entreprises" ? 0.015 : 0.01;
  return Math.round(delta * coefficient * 1_000) / 1_000;
}

function modeledEffects(decisionId: string, optionId: string, support: Soutien, delta: number): EffectRule[] {
  const id = (indicator: string) => `${decisionId}:${optionId}${V3_MODELED_EFFECT_MARKER}${support}:${indicator}`;
  const immediate = { kind: "immediate" } as const;
  if (support === "opinion") {
    return [{
      id: id("majority"),
      target: "indicator",
      key: "majority",
      delta: scaledPoliticalDelta(delta),
      timing: immediate,
      duration: "once",
      explanation: "Règle du jeu : la réaction de l'opinion se répercute sur la solidité de la majorité.",
    }];
  }
  if (support === "entreprises") {
    return [
      {
        id: id("growth"),
        target: "indicator",
        key: "growth",
        delta: scaledGrowthDelta(support, delta),
        timing: immediate,
        duration: "annual",
        explanation: "Règle du jeu : la réaction des entreprises influe sur l'activité économique.",
      },
      {
        id: id("investment"),
        target: "indicator",
        key: "investment",
        delta,
        timing: immediate,
        duration: "once",
        explanation: "Règle du jeu : la réaction des entreprises influe sur l'investissement.",
      },
    ];
  }
  if (support === "marches") {
    return [{
      id: id("growth"),
      target: "indicator",
      key: "growth",
      delta: scaledGrowthDelta(support, delta),
      timing: immediate,
      duration: "annual",
      explanation: "Règle du jeu : les conditions de financement influent sur l'activité économique.",
    }];
  }
  return [{
    id: id("publicServices"),
    target: "indicator",
    key: "publicServices",
    delta: scaledPoliticalDelta(delta),
    timing: immediate,
    duration: "once",
    explanation: "Règle du jeu : la réaction des territoires influe sur la continuité des services publics.",
  }];
}

function supportEffects(
  decisionId: string,
  optionId: string,
  reactions: Mesure["reactions"] | Mesure["rejet"],
): EffectRule[] {
  return Object.entries(reactions ?? {}).flatMap(([supportName, delta]) => {
    const support = supportName as Soutien;
    return [
      supportEffect(decisionId, optionId, support, delta),
      ...modeledEffects(decisionId, optionId, support, delta),
    ];
  });
}

function directQuestion(measure: Mesure): string {
  const editorial = DILEMMES[measure.id];
  if (editorial) return clean(editorial.question);
  const title = clean(measure.titre).replace(/[.?!]+$/, "");
  return `${title} ?`;
}

function scheduledEventsFor(measure: Mesure): Decision["options"][number]["scheduledEvents"] {
  if (measure.id !== "tranche-a-50-au-dela-de-250") return [];
  return [{
    id: "high-income-tax-base-reaction",
    title: "La tranche à 50 % résiste, les départs font la une",
    body: "Un an après l'annonce, l'assiette fiscale reste largement en France, mais plusieurs départs concentrent le débat et affaiblissent le rendement attendu.",
    afterDecisions: 1,
    effects: [
      {
        id: "high-income-tax-base-reaction:businesses",
        target: "group",
        key: "businesses",
        delta: -2,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "Les organisations patronales durcissent leur opposition à la réforme.",
      },
      {
        id: "high-income-tax-base-reaction:credibility",
        target: "indicator",
        key: "financialCredibility",
        delta: -1,
        timing: { kind: "immediate" },
        duration: "once",
        explanation: "Le rendement futur de la mesure devient plus incertain.",
      },
    ],
  }];
}

function conflictsFor(measure: Mesure): string[] {
  return [...new Set([
    ...(measure.exclut ?? []),
    ...MESURES.filter((candidate) => candidate.exclut?.includes(measure.id)).map((candidate) => candidate.id),
  ])];
}

function toDecision(measure: Mesure, index: number): Decision {
  const chapter = CHAPTERS[Math.floor(index / 12)]!;
  const editorial = DILEMMES[measure.id];
  const adoptId = `${measure.id}:apply`;
  const keepId = `${measure.id}:keep`;
  const adoptEffects: EffectRule[] = [
    ...(measure.effet === 0 ? [] : [{
      id: `${measure.id}:apply:budget`,
      target: "indicator" as const,
      key: "annualBalance" as const,
      delta: measure.effet,
      timing: { kind: "immediate" } as const,
      duration: "annual" as const,
      explanation: clean(`Effet annuel estimé sur le solde public : ${measure.effet} millions d'euros.`),
    }]),
    ...supportEffects(measure.id, "apply", measure.reactions),
  ];
  if (adoptEffects.length === 0) {
    adoptEffects.push({
      id: `${measure.id}:apply:capacity`,
      target: "indicator",
      key: "reformCapacity",
      delta: 1,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "La décision clarifie la ligne du gouvernement.",
    });
  }
  const keepEffects = supportEffects(measure.id, "keep", measure.rejet);
  if (keepEffects.length === 0) {
    keepEffects.push({
      id: `${measure.id}:keep:capacity`,
      target: "indicator",
      key: "reformCapacity",
      delta: -1,
      timing: { kind: "immediate" },
      duration: "once",
      explanation: "Le statu quo consomme une partie du capital de réforme.",
    });
  }

  const adoptBeneficiaries = editorial?.adopter.gagnants
    ?? (measure.effet >= 0 ? ["finances publiques"] : ["bénéficiaires de la mesure"]);
  const adoptContributors = editorial?.adopter.perdants
    ?? (measure.effet >= 0 ? ["groupes affectés par la mesure"] : ["finances publiques"]);
  const keepBeneficiaries = editorial?.rejeter.gagnants ?? adoptContributors;
  const keepContributors = editorial?.rejeter.perdants ?? adoptBeneficiaries;
  const conflicts = conflictsFor(measure);

  return {
    id: measure.id,
    version: 1,
    chapterId: chapter.id,
    title: directQuestion(measure),
    context: clean(editorial?.contradiction ?? measure.detail),
    options: [
      {
        id: adoptId,
        label: clean(editorial?.adopter.libelle ?? measure.titre),
        summary: clean(editorial?.adopter.argument ?? measure.detail),
        beneficiaries: adoptBeneficiaries.map(clean),
        contributors: adoptContributors.map(clean),
        uncertainty: uncertainty(measure),
        effects: adoptEffects,
        scheduledEvents: scheduledEventsFor(measure),
        promises: [],
        fulfillsPromises: [],
        locks: conflicts,
        unlocks: [],
      },
      {
        id: keepId,
        label: clean(editorial?.rejeter.libelle ?? "Conserver la règle actuelle"),
        summary: clean(editorial?.rejeter.argument ?? "La règle actuelle reste en vigueur et la réforme n'est pas engagée."),
        beneficiaries: keepBeneficiaries.map(clean),
        contributors: keepContributors.map(clean),
        uncertainty: uncertainty(measure),
        effects: keepEffects,
        scheduledEvents: [],
        promises: [],
        fulfillsPromises: [],
        locks: [],
        unlocks: [],
      },
    ],
    evidence: [{
      label: clean(measure.detail),
      sourceName: "Sources budgétaires recensées",
      sourceUrl: SOURCE_URL,
      publishedAt: "2026-08-27",
      ...(measure.precision ? { note: clean(measure.precision) } : {}),
    }],
    dependencies: [],
    conflicts,
  };
}

const decisions = MESURES.map(toDecision);

export const SCENARIO_V3_PREVIEW: Scenario = {
  version: 5,
  title: "La France à l'épreuve des comptes",
  chapters: CHAPTERS.map((chapter, index) => ({
    ...chapter,
    decisionIds: decisions.slice(index * 12, index * 12 + 12).map((decision) => decision.id),
  })),
  decisions,
};
