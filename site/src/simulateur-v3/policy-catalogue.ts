import { DILEMMES } from "../dilemmes.ts";
import { MESURES } from "../mesures.ts";
import { INDICATOR_META } from "./indicator-meta.ts";
import { policyConsequence, type ExplicitEffect } from "./policy-consequences.ts";
import { policyEvidence, type PolicySourceKey } from "./policy-sources.ts";
import type {
  Decision,
  DecisionKind,
  DecisionOption,
  EffectRule,
  GroupKey,
  IndicatorKey,
  PolicyHorizon,
  PromiseRule,
  ScheduledEventRule,
  Uncertainty,
} from "./types.ts";

export type PolicyOptionDefinition = {
  id: string;
  label: string;
  summary: string;
  mechanism: string;
  horizon: PolicyHorizon;
  legalConstraints: string[];
  budgetDelta: number;
  budgetDuration: "annual" | "once";
  budgetTiming: EffectRule["timing"];
  beneficiaries: string[];
  contributors: string[];
  uncertainty?: Uncertainty;
  indicatorEffects: Partial<Record<IndicatorKey, ExplicitEffect>>;
  groupEffects: Partial<Record<GroupKey, ExplicitEffect>>;
  locks?: string[];
  unlocks?: string[];
  scheduledEvents?: ScheduledEventRule[];
  promises?: PromiseRule[];
  fulfillsPromises?: string[];
};

export type PolicyDecisionDefinition = {
  id: string;
  chapterId: string;
  kind: DecisionKind;
  title: string;
  context: string;
  options: PolicyOptionDefinition[];
  sourceKeys: PolicySourceKey[];
  evidenceLabel: string;
  evidenceNote?: string;
  dependencies?: string[];
  conflicts?: string[];
};

/** Catalogue inventory only; causal fields live exclusively in policy-consequences.ts. */
type PolicyOptionDraft = Omit<PolicyOptionDefinition,
  | "mechanism"
  | "horizon"
  | "legalConstraints"
  | "budgetDuration"
  | "budgetTiming"
  | "indicatorEffects"
  | "groupEffects"
  | "locks"
  | "unlocks"
  | "scheduledEvents"
  | "promises"
  | "fulfillsPromises"
>;

type PolicyDecisionDraft = Omit<PolicyDecisionDefinition, "options"> & { options: PolicyOptionDraft[] };

export type ExistingPolicyCopy = {
  id: string;
  chapterId: string;
  kind: DecisionKind;
  title?: string;
  context?: string;
  adoptLabel?: string;
  adoptSummary: string;
  keepLabel: string;
  keepSummary: string;
  beneficiaries: string[];
  contributors: string[];
  sourceKeys: PolicySourceKey[];
  evidenceNote?: string;
};

export type OptionDistanceDimension =
  | "budget"
  | "indicators"
  | "groups"
  | "horizon"
  | "stakeholders"
  | "legal_constraints"
  | "locks"
  | "uncertainty"
  | "commitments";

const MEASURES_BY_ID = new Map(MESURES.map((measure) => [measure.id, measure]));
type Stakeholders = { beneficiaries: string[]; contributors: string[] };

/** Explicit editorial contract for the 71 existing-policy `keep` branches. */
const EXISTING_POLICY_KEEP_STAKEHOLDERS: Record<string, Stakeholders> = {
  "geler-le-bareme-de-l-impot-sur": { beneficiaries: ["foyers imposables", "classes moyennes"], contributors: ["finances publiques"] },
  "porter-le-taux-normal-de-tva-a": { beneficiaries: ["consommateurs", "ménages modestes", "classes moyennes"], contributors: ["finances publiques"] },
  "doubler-la-taxe-sur-les-rachats-d": { beneficiaries: ["actionnaires des groupes cotés", "groupes cotés"], contributors: ["finances publiques"] },
  "raboter-l-avantage-successoral-de-l-assurance": { beneficiaries: ["détenteurs de contrats d'assurance-vie", "héritiers de contrats d'assurance-vie"], contributors: ["finances publiques", "héritiers soumis au droit commun"] },
  "tranche-a-50-au-dela-de-250": { beneficiaries: ["très hauts revenus"], contributors: ["finances publiques", "progressivité fiscale"] },
  "retablir-un-impot-sur-la-fortune-financiere": { beneficiaries: ["grands patrimoines financiers"], contributors: ["finances publiques", "égalité de traitement entre patrimoines mobiliers et immobiliers"] },
  "soumettre-les-revenus-du-capital-au-bareme": { beneficiaries: ["détenteurs de capital", "épargnants imposés dans les tranches hautes"], contributors: ["finances publiques", "progressivité entre revenus du travail et du capital"] },
  "exonerer-de-droits-de-succession-jusqu-a": { beneficiaries: ["finances publiques", "non-héritiers"], contributors: ["héritiers de patrimoines taxables"] },
  "flat-tax-a-20-des-le-premier": { beneficiaries: ["foyers aujourd'hui non imposables", "classes moyennes", "progressivité fiscale"], contributors: ["finances publiques", "hauts revenus soumis au barème actuel"] },
  "flat-tax-a-20-avec-abattement-protegeant": { beneficiaries: ["finances publiques", "progressivité fiscale"], contributors: ["hauts revenus"] },
  "impot-plancher-de-2-sur-les-patrimoines": { beneficiaries: ["patrimoines supérieurs à 100 millions d'euros", "entreprises dont les titres seraient inclus dans l'assiette"], contributors: ["finances publiques", "redistribution patrimoniale"] },
  "fiscaliser-les-heures-supplementaires-comme-le": { beneficiaries: ["salariés effectuant des heures supplémentaires"], contributors: ["finances publiques"] },
  "supprimer-les-allegements-de-cotisations-entre-2": { beneficiaries: ["employeurs de salariés entre 2,5 et 3,5 SMIC"], contributors: ["finances sociales"] },
  "raboter-de-5-les-subventions-directes-aux": { beneficiaries: ["entreprises subventionnées", "territoires industriels bénéficiaires"], contributors: ["finances publiques"] },
  "raboter-le-credit-d-impot-recherche-de": { beneficiaries: ["entreprises réalisant des dépenses de recherche", "salariés et laboratoires de recherche privée"], contributors: ["finances publiques"] },
  "repousser-l-age-legal-a-65-ans": { beneficiaries: ["actifs proches de la retraite", "salariés du privé", "syndicats"], contributors: ["finances sociales", "cotisants futurs"] },
  "revenir-a-62-ans": { beneficiaries: ["finances sociales", "cotisants futurs"], contributors: ["actifs proches de la retraite"] },
  "desindexer-les-pensions-d-un-point": { beneficiaries: ["retraités"], contributors: ["finances sociales", "cotisants futurs"] },
  "durcir-l-assurance-chomage-degressivite-duree": { beneficiaries: ["demandeurs d'emploi", "salariés du privé", "syndicats"], contributors: ["finances de l'Unédic", "employeurs cotisants"] },
  "ouvrir-un-etage-de-capitalisation-collective": { beneficiaries: ["retraités actuels", "actifs finançant la transition"], contributors: ["actifs futurs sans réserve collective", "financement de long terme de l'économie"] },
  "doubler-les-franchises-medicales": { beneficiaries: ["patients soumis aux franchises", "malades chroniques", "retraités"], contributors: ["finances de l'Assurance maladie"] },
  "imposer-generiques-et-biosimilaires-en-premiere-intention": { beneficiaries: ["patients auxquels le prescripteur maintient un médicament de marque", "laboratoires de princeps"], contributors: ["finances de l'Assurance maladie"] },
  "derembourser-les-cures-thermales": { beneficiaries: ["curistes", "stations thermales"], contributors: ["finances de l'Assurance maladie"] },
  "renforcer-le-controle-des-arrets-de-travail": { beneficiaries: ["salariés en arrêt maladie"], contributors: ["employeurs", "finances sociales"] },
  "creer-5-000-postes-de-soignants": { beneficiaries: ["finances publiques"], contributors: ["patients hospitaliers", "équipes soignantes"] },
  "loi-grand-age-50-000-recrutements": { beneficiaries: ["finances publiques"], contributors: ["personnes âgées dépendantes", "proches aidants", "personnels du grand âge"] },
  "fusionner-agences-sanitaires-et-echelons-des-ars": { beneficiaries: ["agents des agences sanitaires", "réseaux territoriaux de santé"], contributors: ["finances publiques"] },
  "fiscalite-nutritionnelle-au-niveau-recommande": { beneficiaries: ["consommateurs", "producteurs des aliments concernés"], contributors: ["finances publiques", "politiques de prévention"] },
  "supprimer-l-aide-medicale-d-etat": { beneficiaries: ["personnes étrangères sans titre éligibles", "hôpitaux publics", "santé publique"], contributors: ["finances de l'Assurance maladie"] },
  "verser-le-rsa-automatiquement-fin-du-non": { beneficiaries: ["finances départementales"], contributors: ["personnes éligibles en non-recours"] },
  "porter-le-rsa-au-seuil-de": { beneficiaries: ["finances départementales", "contribuables"], contributors: ["allocataires à bas revenus"] },
  "recruter-10-000-policiers-et-gendarmes": { beneficiaries: ["finances publiques"], contributors: ["habitants des zones sous-dotées", "policiers et gendarmes"] },
  "construire-15-000-places-de-prison-supplementaires": { beneficiaries: ["finances publiques", "collectivités accueillant les sites"], contributors: ["personnels pénitentiaires", "personnes détenues"] },
  "recruter-3-000-magistrats-et-greffiers": { beneficiaries: ["finances publiques"], contributors: ["justiciables", "magistrats et greffiers"] },
  "etendre-les-centres-de-retention-administrative": { beneficiaries: ["finances publiques", "collectivités accueillant les centres"], contributors: ["services chargés des éloignements", "personnes retenues"] },
  "reduire-les-delais-de-traitement-de-l": { beneficiaries: ["finances publiques"], contributors: ["demandeurs d'asile", "agents instructeurs", "collectivités d'accueil"] },
  "doubler-l-execution-des-eloignements-oqtf": { beneficiaries: ["personnes protégées par l'examen individuel", "partenaires européens"], contributors: ["services chargés des éloignements"] },
  "doubler-les-moyens-de-l-integration-francais": { beneficiaries: ["finances publiques"], contributors: ["nouveaux arrivants", "employeurs", "collectivités d'accueil"] },
  "supprimer-l-allocation-pour-demandeurs-d": { beneficiaries: ["demandeurs d'asile éligibles", "collectivités d'accueil"], contributors: ["finances publiques"] },
  "reserver-les-prestations-non-contributives-aux-nationaux": { beneficiaries: ["résidents étrangers régulièrement éligibles", "ménages modestes", "collectivités"], contributors: ["finances publiques"] },
  "legaliser-et-taxer-le-cannabis": { beneficiaries: ["riverains des points de vente illicites", "personnes souhaitant éviter la banalisation"], contributors: ["consommateurs de cannabis", "finances publiques", "forces de sécurité"] },
  "porter-l-effort-de-defense-vers-3": { beneficiaries: ["contribuables", "créanciers publics"], contributors: ["forces armées", "industrie de défense", "partenaires européens"] },
  "etaler-la-marche-2026-de-la-programmation": { beneficiaries: ["forces armées", "industrie de défense", "partenaires européens"], contributors: ["finances publiques"] },
  "doubler-la-reserve-operationnelle": { beneficiaries: ["employeurs de réservistes"], contributors: ["forces armées", "réservistes candidats"] },
  "reduire-l-aide-publique-au-developpement-de": { beneficiaries: ["pays partenaires", "organisations de développement", "partenaires européens"], contributors: ["finances publiques"] },
  "service-militaire-volontaire-de-50-000": { beneficiaries: ["finances publiques", "employeurs civils"], contributors: ["jeunes candidats", "forces armées"] },
  "doubler-les-moyens-du-renseignement-interieur": { beneficiaries: ["finances publiques", "personnes attachées aux garanties de la vie privée"], contributors: ["services de renseignement", "population exposée aux menaces"] },
  "doubler-maprimerenov": { beneficiaries: ["finances publiques"], contributors: ["ménages rénovateurs", "entreprises du bâtiment"] },
  "plan-ferroviaire-3-000-m-de-plus": { beneficiaries: ["finances publiques"], contributors: ["voyageurs ferroviaires", "entreprises ferroviaires", "collectivités"] },
  "supprimer-le-bonus-automobile-electrique": { beneficiaries: ["acheteurs de véhicules électriques", "constructeurs automobiles", "ménages modestes et moyens"], contributors: ["finances publiques"] },
  "relancer-le-leasing-social-de-vehicules-electriques": { beneficiaries: ["finances publiques"], contributors: ["ménages modestes", "filière automobile électrique"] },
  "retablir-une-trajectoire-carbone-recettes-redistribuees": { beneficiaries: ["automobilistes", "ménages chauffés aux énergies fossiles", "entreprises", "collectivités"], contributors: ["finances publiques", "transition climatique"] },
  "renforcer-la-taxe-sur-les-billets-d": { beneficiaries: ["compagnies aériennes", "voyageurs aériens", "territoires touristiques"], contributors: ["finances publiques"] },
  "doubler-le-soutien-a-l-agriculture-bio": { beneficiaries: ["finances publiques"], contributors: ["agriculteurs biologiques", "filières alimentaires", "collectivités"] },
  "revaloriser-les-enseignants-de-5": { beneficiaries: ["finances publiques"], contributors: ["enseignants", "élèves", "établissements scolaires"] },
  "etendre-le-dedoublement-des-classes-au-cm1": { beneficiaries: ["finances publiques", "collectivités"], contributors: ["élèves de l'éducation prioritaire", "enseignants"] },
  "recentrer-le-pass-culture": { beneficiaries: ["jeunes utilisateurs", "entreprises culturelles"], contributors: ["finances publiques", "actions culturelles ciblées"] },
  "doubler-les-bourses-etudiantes-sur-criteres": { beneficiaries: ["finances publiques"], contributors: ["étudiants boursiers"] },
  "financer-100-000-logements-sociaux-de-plus": { beneficiaries: ["finances publiques", "collectivités"], contributors: ["demandeurs de logement social", "entreprises du bâtiment"] },
  "revaloriser-les-apl-de-5": { beneficiaries: ["finances publiques"], contributors: ["locataires allocataires"] },
  "ouvrir-200-000-places-de-creche": { beneficiaries: ["finances publiques", "collectivités"], contributors: ["jeunes enfants", "parents actifs", "employeurs"] },
  "allocations-familiales-des-le-premier-enfant": { beneficiaries: ["finances sociales"], contributors: ["familles avec un enfant"] },
  "generaliser-le-service-national-universel": { beneficiaries: ["finances publiques", "jeunes qui préfèrent le volontariat"], contributors: ["structures d'accueil", "cohésion nationale"] },
  "geler-le-point-d-indice-en-2026": { beneficiaries: ["agents publics"], contributors: ["finances publiques", "collectivités employeuses"] },
  "deux-jours-de-carence-dans-la-fonction": { beneficiaries: ["agents publics", "syndicats"], contributors: ["finances publiques"] },
  "ne-pas-remplacer-un-depart-administratif-sur": { beneficiaries: ["agents publics", "usagers des services"], contributors: ["finances publiques"] },
  "fermer-un-tiers-des-agences-et-operateurs": { beneficiaries: ["agents des opérateurs", "usagers des agences"], contributors: ["finances publiques"] },
  "diviser-par-deux-le-nombre-de-parlementaires": { beneficiaries: ["territoires", "électeurs", "parlementaires"], contributors: ["finances publiques"] },
  "supprimer-le-cese": { beneficiaries: ["organisations représentées", "société civile organisée"], contributors: ["finances publiques"] },
  "ceder-des-participations-non-strategiques-de-l": { beneficiaries: ["État actionnaire", "bénéficiaires des dividendes publics"], contributors: ["créanciers publics", "désendettement immédiat"] },
  "reduire-de-5-les-dotations-aux-collectivites": { beneficiaries: ["collectivités", "usagers locaux", "entreprises locales"], contributors: ["finances de l'État"] },
};

function clean(value: string): string {
  return value.replaceAll("\u2014", ":").replace(/\s+/g, " ").trim();
}

function validHorizon(horizon: PolicyHorizon): boolean {
  return horizon.kind === "immediate"
    || (horizon.kind === "after_decisions" && Number.isInteger(horizon.count) && horizon.count > 0)
    || (horizon.kind === "mandate_year" && Number.isInteger(horizon.year) && horizon.year >= 1 && horizon.year <= 5);
}

function explicitValue(value: ExplicitEffect): Exclude<ExplicitEffect, number> {
  return typeof value === "number" ? { delta: value } : value;
}

function effect(
  id: string,
  target: "indicator" | "group",
  key: IndicatorKey | GroupKey,
  value: ExplicitEffect,
  mechanism: string,
  defaultTiming: EffectRule["timing"] = { kind: "immediate" },
): EffectRule {
  const declared = explicitValue(value);
  return {
    id,
    target,
    key,
    delta: declared.delta,
    timing: declared.timing ?? defaultTiming,
    duration: declared.duration ?? "once",
    explanation: clean(declared.explanation ?? mechanism),
  } as EffectRule;
}

function consequenceTiming(horizon: PolicyHorizon): EffectRule["timing"] {
  if (horizon.kind === "after_decisions") return { kind: "after_decisions", count: horizon.count };
  if (horizon.kind === "mandate_year") return { kind: "mandate_year", year: horizon.year };
  return { kind: "immediate" };
}

function compiledOption(decisionId: string, definition: PolicyOptionDefinition): DecisionOption {
  if (!definition.mechanism.trim()) throw new Error(`Mécanisme absent : ${decisionId}:${definition.id}`);
  if (!validHorizon(definition.horizon)) throw new Error(`Horizon invalide : ${decisionId}:${definition.id}`);
  if (!Array.isArray(definition.legalConstraints)) throw new Error(`Contraintes absentes : ${decisionId}:${definition.id}`);
  const mechanism = clean(definition.mechanism);
  const effects: EffectRule[] = [];
  if (definition.budgetDelta !== 0) {
    effects.push(effect(
      `${decisionId}:${definition.id}:indicator:annualBalance`,
      "indicator",
      "annualBalance",
      { delta: definition.budgetDelta, duration: definition.budgetDuration },
      `${mechanism} Impact budgétaire retenu par le jeu : ${definition.budgetDelta} millions d'euros.`,
      definition.budgetTiming,
    ));
  }
  for (const [key, value] of Object.entries(definition.indicatorEffects)) {
    effects.push(effect(
      `${decisionId}:${definition.id}:indicator:${key}`,
      "indicator",
      key as IndicatorKey,
      value as ExplicitEffect,
      mechanism,
      consequenceTiming(definition.horizon),
    ));
  }
  for (const [key, value] of Object.entries(definition.groupEffects)) {
    effects.push(effect(
      `${decisionId}:${definition.id}:group:${key}`,
      "group",
      key as GroupKey,
      value as ExplicitEffect,
      mechanism,
      consequenceTiming(definition.horizon),
    ));
  }
  if (!effects.some((rule) => rule.target === "indicator" && rule.key !== "annualBalance")) {
    throw new Error(`Indicateur non budgétaire absent : ${decisionId}:${definition.id}`);
  }
  return {
    id: `${decisionId}:${definition.id}`,
    label: clean(definition.label),
    summary: clean(definition.summary),
    mechanism,
    horizon: definition.horizon,
    legalConstraints: definition.legalConstraints.map(clean),
    budgetDuration: definition.budgetDuration,
    budgetTiming: definition.budgetTiming,
    beneficiaries: definition.beneficiaries.map(clean),
    contributors: definition.contributors.map(clean),
    uncertainty: definition.uncertainty ?? "moyenne",
    effects,
    scheduledEvents: definition.scheduledEvents ?? [],
    promises: definition.promises ?? [],
    fulfillsPromises: definition.fulfillsPromises ?? [],
    locks: definition.locks ?? [],
    unlocks: definition.unlocks ?? [],
  };
}

function consequenceOption(
  decisionId: string,
  draft: PolicyOptionDraft,
): PolicyOptionDefinition {
  const consequence = policyConsequence(decisionId, draft.id);
  return {
    ...draft,
    mechanism: consequence.mechanism,
    horizon: consequence.horizon,
    legalConstraints: consequence.legalConstraints,
    budgetDuration: consequence.budgetDuration,
    budgetTiming: consequence.budgetTiming,
    indicatorEffects: consequence.indicatorEffects,
    groupEffects: consequence.groupEffects,
    uncertainty: consequence.uncertainty ?? draft.uncertainty,
    locks: consequence.locks,
    unlocks: consequence.unlocks,
    scheduledEvents: consequence.scheduledEvents ?? [],
    promises: [],
    fulfillsPromises: [],
  };
}

export function policyDecision(definition: PolicyDecisionDefinition): Decision {
  if (!definition.context.trim() || !definition.title.trim() || !definition.evidenceLabel.trim()) {
    throw new Error(`Dossier éditorial incomplet : ${definition.id}`);
  }
  if (definition.sourceKeys.length === 0) throw new Error(`Source absente : ${definition.id}`);
  const options = definition.options.map((option) => compiledOption(definition.id, option));
  if (options.some((option) => !option.label || !option.summary)) throw new Error(`Option incomplète : ${definition.id}`);
  return {
    id: definition.id,
    version: 3,
    kind: definition.kind,
    chapterId: definition.chapterId,
    title: clean(definition.title),
    context: clean(definition.context),
    options,
    evidence: policyEvidence(definition.sourceKeys, clean(definition.evidenceLabel)).map((item) => ({
      ...item,
      ...(definition.evidenceNote ? { note: clean(definition.evidenceNote) } : {}),
    })),
    dependencies: definition.dependencies ?? [],
    conflicts: [...new Set([...(definition.conflicts ?? []), ...options.flatMap((option) => option.locks)])],
  };
}

export function existingPolicy(copy: ExistingPolicyCopy): PolicyDecisionDefinition {
  const measure = MEASURES_BY_ID.get(copy.id);
  if (!measure) throw new Error(`Mesure inconnue : ${copy.id}`);
  const editorial = DILEMMES[copy.id];
  const uncertainty = measure.precision ? "forte" as const : "moyenne" as const;
  const keepStakeholders = EXISTING_POLICY_KEEP_STAKEHOLDERS[copy.id];
  if (!keepStakeholders) throw new Error(`Parties prenantes du maintien absentes : ${copy.id}`);
  return {
    id: copy.id,
    chapterId: copy.chapterId,
    kind: copy.kind,
    title: clean(copy.title ?? editorial?.question ?? `${measure.titre.replace(/[.?!]+$/, "")} ?`),
    context: clean(copy.context ?? editorial?.contradiction ?? measure.detail),
    sourceKeys: copy.sourceKeys,
    evidenceLabel: clean(measure.detail),
    evidenceNote: copy.evidenceNote
      ? clean(copy.evidenceNote)
      : measure.precision
        ? clean(measure.precision)
        : undefined,
    dependencies: [],
    conflicts: [],
    options: [
      consequenceOption(copy.id, {
        id: "adopt",
        label: clean(copy.adoptLabel ?? editorial?.adopter.libelle ?? measure.titre),
        summary: copy.adoptSummary,
        budgetDelta: measure.effet,
        beneficiaries: copy.beneficiaries,
        contributors: copy.contributors,
        uncertainty,
      }),
      consequenceOption(copy.id, {
        id: "keep",
        label: copy.keepLabel,
        summary: copy.keepSummary,
        budgetDelta: 0,
        beneficiaries: keepStakeholders.beneficiaries,
        contributors: keepStakeholders.contributors,
        uncertainty,
      }),
    ],
  };
}

export function standalonePolicy(definition: PolicyDecisionDraft): PolicyDecisionDefinition {
  return {
    ...definition,
    dependencies: [],
    conflicts: [],
    options: definition.options.map((option) => consequenceOption(definition.id, option)),
  };
}

export function delayedEvent(
  id: string,
  title: string,
  body: string,
  afterDecisions: number,
  indicator: IndicatorKey,
  delta: number,
): ScheduledEventRule {
  return {
    id,
    title: clean(title),
    body: clean(body),
    afterDecisions,
    effects: [effect(`${id}:indicator:${indicator}`, "indicator", indicator, delta, `Conséquence différée du dossier ${id}.`)],
  };
}

function normalizedStrings(values: readonly string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))].sort((left, right) => left.localeCompare(right, "fr"));
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function aggregateEffects(option: DecisionOption, target: "indicator" | "group", includeBudget: boolean): Map<string, number> {
  const result = new Map<string, number>();
  for (const rule of option.effects) {
    if (rule.target !== target || (!includeBudget && rule.target === "indicator" && rule.key === "annualBalance")) continue;
    result.set(rule.key, (result.get(rule.key) ?? 0) + rule.delta);
  }
  return result;
}

function effectProfilesDiffer(
  left: Map<string, number>,
  right: Map<string, number>,
  epsilonFor: (key: string) => number,
): boolean {
  const keys = new Set([...left.keys(), ...right.keys()]);
  return [...keys].some((key) => Math.abs((left.get(key) ?? 0) - (right.get(key) ?? 0)) >= epsilonFor(key));
}

function normalizedJsonList(values: readonly unknown[]): unknown[] {
  return [...new Set(values.map((value) => JSON.stringify(value)))]
    .sort((left, right) => left.localeCompare(right, "fr"))
    .map((value) => JSON.parse(value) as unknown);
}

function normalizedCommitmentEffects(rules: readonly EffectRule[]): unknown[] {
  return normalizedJsonList(rules.map((rule) => [
    clean(rule.id),
    rule.target,
    rule.key,
    rule.delta,
    rule.duration,
    rule.timing.kind === "after_decisions"
      ? [rule.timing.kind, rule.timing.count]
      : rule.timing.kind === "mandate_year"
        ? [rule.timing.kind, rule.timing.year]
        : [rule.timing.kind],
  ]));
}

function commitmentProfile(option: DecisionOption): unknown {
  return {
    events: normalizedJsonList(option.scheduledEvents.map((item) => ({
      id: clean(item.id),
      afterDecisions: item.afterDecisions,
      effects: normalizedCommitmentEffects(item.effects),
    }))),
    promises: normalizedJsonList(option.promises.map((item) => ({
      id: clean(item.id),
      dueAfterDecisions: item.dueAfterDecisions,
      failureEffects: normalizedCommitmentEffects(item.failureEffects),
    }))),
    fulfillsPromises: normalizedStrings(option.fulfillsPromises),
  };
}

export function optionDistanceDimensions(a: DecisionOption, b: DecisionOption): OptionDistanceDimension[] {
  const dimensions: OptionDistanceDimension[] = [];
  const aBudget = aggregateEffects(a, "indicator", true).get("annualBalance") ?? 0;
  const bBudget = aggregateEffects(b, "indicator", true).get("annualBalance") ?? 0;
  if (
    Math.abs(aBudget - bBudget) >= INDICATOR_META.annualBalance.epsilon
    || a.budgetDuration !== b.budgetDuration
    || !sameJson(a.budgetTiming, b.budgetTiming)
  ) dimensions.push("budget");
  if (effectProfilesDiffer(
    aggregateEffects(a, "indicator", false),
    aggregateEffects(b, "indicator", false),
    (key) => INDICATOR_META[key as IndicatorKey].epsilon,
  )) dimensions.push("indicators");
  if (effectProfilesDiffer(aggregateEffects(a, "group", true), aggregateEffects(b, "group", true), () => 1)) dimensions.push("groups");
  if (!sameJson(a.horizon, b.horizon)) dimensions.push("horizon");
  if (!sameJson(
    [normalizedStrings(a.beneficiaries), normalizedStrings(a.contributors)],
    [normalizedStrings(b.beneficiaries), normalizedStrings(b.contributors)],
  )) dimensions.push("stakeholders");
  if (!sameJson(normalizedStrings(a.legalConstraints), normalizedStrings(b.legalConstraints))) dimensions.push("legal_constraints");
  if (!sameJson(
    [normalizedStrings(a.locks), normalizedStrings(a.unlocks)],
    [normalizedStrings(b.locks), normalizedStrings(b.unlocks)],
  )) dimensions.push("locks");
  if (a.uncertainty !== b.uncertainty) dimensions.push("uncertainty");
  if (!sameJson(commitmentProfile(a), commitmentProfile(b))) dimensions.push("commitments");
  return dimensions;
}
