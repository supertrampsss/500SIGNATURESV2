import { PROMOTION_REPORT } from "./promotion-report.ts";
import type { Decision, Scenario } from "./types.ts";

export type { PromotionEvidence } from "./promotion-report.ts";

export type CampaignChapter = Readonly<{ id: string; decisionIds: readonly string[] }>;
export type KnownCampaignDecision = Readonly<{ id: string; chapterId: string }>;
export type PublishedCampaignValidationInput = Readonly<{
  chapters?: readonly CampaignChapter[];
  knownDecisions?: readonly KnownCampaignDecision[];
  checkpoints?: readonly number[];
  references?: readonly string[];
}>;

const CORE_CHAPTERS: readonly CampaignChapter[] = [
  { id: "taxes-assets-transmission", decisionIds: [
    "unifier-ir-csg-bareme-continu", "supprimer-niches-fiscales-menages-capital", "facturation-electronique-controle-tva", "porter-le-taux-normal-de-tva-a", "doubler-la-taxe-sur-les-rachats-d", "retablir-un-impot-sur-la-fortune-financiere", "exonerer-de-droits-de-succession-jusqu-a", "abolir-les-droits-de-succession",
  ] },
  { id: "work-wages-pensions", decisionIds: [
    "recentrer-allegements-exonerations-sociales", "cibler-aides-apprentissage", "supprimer-subventions-directes-entreprises", "recentrer-cir-niches-fiscales-entreprises", "repousser-l-age-legal-a-65-ans", "desindexer-les-pensions-d-un-point", "durcir-l-assurance-chomage-degressivite-duree", "remplacer-prime-activite-prelevements-travail",
  ] },
  { id: "health-social-protection", decisionIds: [
    "medicaments-comparables-achats-sante", "reduire-arrets-evitables-prescription", "recouvrer-fraude-sociale-additionnelle", "unifier-instruction-prestations-solidarite", "creer-5-000-postes-de-soignants", "loi-grand-age-50-000-recrutements", "supprimer-l-aide-medicale-d-etat", "assurance-maladie-publique-unique",
  ] },
  { id: "security-immigration-justice", decisionIds: [
    "recruter-10-000-policiers-et-gendarmes", "construire-15-000-places-de-prison-supplementaires", "recruter-3-000-magistrats-et-greffiers", "doubler-l-execution-des-eloignements-oqtf", "supprimer-l-allocation-pour-demandeurs-d", "reserver-les-prestations-non-contributives-aux-nationaux", "quotas-annuels-d-immigration", "legaliser-et-taxer-le-cannabis",
  ] },
  { id: "defence-europe-sovereignty", decisionIds: [
    "porter-l-effort-de-defense-vers-3", "doubler-la-reserve-operationnelle", "service-militaire-volontaire-de-50-000", "doubler-les-moyens-du-renseignement-interieur", "sortir-de-l-euro", "referendum-sur-la-sortie-de-l-ue", "creer-une-armee-europeenne",
  ] },
  { id: "energy-climate-transport-agriculture", decisionIds: [
    "doubler-maprimerenov", "plan-ferroviaire-3-000-m-de-plus", "engager-six-epr2-part-annuelle-de-l", "retablir-une-trajectoire-carbone-recettes-redistribuees", "sortie-du-nucleaire-en-2040", "moratoire-sur-les-renouvelables", "supprimer-niches-fiscales-brunes",
  ] },
  { id: "education-housing-family", decisionIds: [
    "revaloriser-les-enseignants-de-5", "doubler-les-bourses-etudiantes-sur-criteres", "financer-100-000-logements-sociaux-de-plus", "revaloriser-les-apl-de-5", "cheque-education-par-eleve", "supprimer-le-financement-public-du-prive", "autonomie-complete-des-etablissements",
  ] },
  { id: "state-institutions-territories", decisionIds: [
    "clarifier-competences-doublons-territoriaux", "mutualiser-achats-publics", "rationaliser-operateurs-ingenierie-territoriale", "reduire-surfaces-loyers-publics", "reduire-cout-absences-fonctions-publiques", "regle-d-or-constitutionnelle", "proportionnelle-integrale",
  ] },
];

export const CORE_CAMPAIGN_DECISION_IDS = Object.freeze(CORE_CHAPTERS.flatMap((chapter) => chapter.decisionIds));

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function publishChapter(core: CampaignChapter): CampaignChapter {
  const candidates = PROMOTION_REPORT.candidates.filter((candidate) => candidate.chapterId === core.id);
  return {
    id: core.id,
    decisionIds: core.decisionIds.flatMap((decisionId) => [
      decisionId,
      ...candidates.filter((candidate) => candidate.replacesDecisionId === decisionId).map((candidate) => candidate.decisionId),
    ]),
  };
}

export const CAMPAIGN_CHAPTERS: readonly CampaignChapter[] = deepFreeze(CORE_CHAPTERS.map(publishChapter));
export const CAMPAIGN_DECISION_IDS = Object.freeze(CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.decisionIds));
export const CAMPAIGN_CHAPTER_SIZES = Object.freeze(CAMPAIGN_CHAPTERS.map((chapter) => chapter.decisionIds.length));
export const campaignLength = CAMPAIGN_DECISION_IDS.length;

const CHAPTER_MANDATE_YEARS = [1, 1, 2, 2, 3, 4, 4, 5] as const;

export function mandateCheckpointsFor(chapters: readonly CampaignChapter[]): number[] {
  let total = 0;
  const checkpoints: number[] = [];
  for (const [index, chapter] of chapters.entries()) {
    total += chapter.decisionIds.length;
    if (CHAPTER_MANDATE_YEARS[index + 1] !== CHAPTER_MANDATE_YEARS[index]) checkpoints.push(total);
  }
  return checkpoints;
}

export const CAMPAIGN_MANDATE_CHECKPOINTS = Object.freeze(mandateCheckpointsFor(CAMPAIGN_CHAPTERS));
const DEFAULT_KNOWN_DECISIONS = Object.freeze(CAMPAIGN_CHAPTERS.flatMap((chapter) => chapter.decisionIds.map((id) => ({ id, chapterId: chapter.id }))));

function sameSequence<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validatePublishedCampaign(input: PublishedCampaignValidationInput = {}): string[] {
  const chapters = input.chapters ?? CAMPAIGN_CHAPTERS;
  const knownDecisions = input.knownDecisions ?? DEFAULT_KNOWN_DECISIONS;
  const checkpoints = input.checkpoints ?? mandateCheckpointsFor(chapters);
  const errors: string[] = [];
  const ids = chapters.flatMap((chapter) => chapter.decisionIds);
  const chapterIds = chapters.map((chapter) => chapter.id);
  const knownById = new Map(knownDecisions.map((decision) => [decision.id, decision]));

  if (chapters.length !== 8) errors.push("campaign-chapter-count");
  if (new Set(chapterIds).size !== chapterIds.length) errors.push("campaign-chapter-duplicate");
  if (chapters.some((chapter) => chapter.decisionIds.length === 0)) errors.push("campaign-chapter-empty");
  if (!sameSequence(chapterIds, CORE_CHAPTERS.map((chapter) => chapter.id))) errors.push("campaign-chapter-order");
  if (ids.length !== 72) errors.push(`campaign-length:${ids.length}`);
  if (new Set(ids).size !== ids.length) errors.push("campaign-decision-duplicate");
  if (ids.some((id) => !knownById.has(id))) errors.push("campaign-decision-unknown");
  if (chapters.some((chapter) => chapter.decisionIds.some((id) => knownById.get(id)?.chapterId !== chapter.id))) errors.push("campaign-decision-chapter");

  let coreIndex = 0;
  for (const id of ids) if (id === CORE_CAMPAIGN_DECISION_IDS[coreIndex]) coreIndex += 1;
  if (coreIndex !== CORE_CAMPAIGN_DECISION_IDS.length) errors.push("campaign-core-order");
  if (PROMOTION_REPORT.candidates.length !== 12 || PROMOTION_REPORT.candidates.some((candidate) => candidate.status !== "promoted" || candidate.score < 8)) errors.push("campaign-promotion-qualification");
  const previousPromotionForAnchor = new Map<string, string>();
  for (const candidate of PROMOTION_REPORT.candidates) {
    const index = ids.indexOf(candidate.decisionId);
    const predecessor = previousPromotionForAnchor.get(candidate.replacesDecisionId) ?? candidate.replacesDecisionId;
    if (index < 0 || ids[index - 1] !== predecessor) errors.push(`campaign-promotion-placement:${candidate.decisionId}`);
    previousPromotionForAnchor.set(candidate.replacesDecisionId, candidate.decisionId);
  }

  const expectedCheckpoints = mandateCheckpointsFor(chapters);
  if (checkpoints.length !== 5 || !sameSequence(checkpoints, expectedCheckpoints) || checkpoints.at(-1) !== ids.length) errors.push("campaign-mandate-checkpoints");
  const references = input.references ?? PROMOTION_REPORT.candidates.flatMap((candidate) => [candidate.decisionId, candidate.replacesDecisionId]);
  if (references.some((id) => !ids.includes(id))) errors.push("campaign-unpublished-reference");
  return errors;
}

function publishedDecision(decision: Decision, selectedIds: ReadonlySet<string>): Decision {
  const clone = structuredClone(decision);
  return {
    ...clone,
    dependencies: clone.dependencies.filter((id) => selectedIds.has(id)),
    conflicts: clone.conflicts.filter((id) => selectedIds.has(id)),
    options: clone.options.map((option) => ({
      ...option,
      locks: option.locks.filter((id) => selectedIds.has(id)),
      unlocks: option.unlocks.filter((id) => selectedIds.has(id)),
    })),
  };
}

export function publishCampaignFromCatalogue(catalogue: Scenario): Scenario {
  const knownDecisions = catalogue.decisions.map(({ id, chapterId }) => ({ id, chapterId }));
  const topologyErrors = validatePublishedCampaign({ chapters: CAMPAIGN_CHAPTERS, knownDecisions });
  if (topologyErrors.length > 0) throw new Error(`Invalid published campaign: ${topologyErrors.join(", ")}`);
  const selectedIds = new Set(CAMPAIGN_DECISION_IDS);
  const byId = new Map(catalogue.decisions.map((decision) => [decision.id, decision]));
  const byChapter = new Map(catalogue.chapters.map((chapter) => [chapter.id, chapter]));
  const decisions = CAMPAIGN_DECISION_IDS.map((id) => {
    const decision = byId.get(id);
    if (!decision) throw new Error(`Unknown published campaign decision ID: ${id}`);
    return publishedDecision(decision, selectedIds);
  });
  return deepFreeze({
    version: catalogue.version,
    title: catalogue.title,
    chapters: CAMPAIGN_CHAPTERS.map((topologyChapter) => {
      const chapter = byChapter.get(topologyChapter.id);
      if (!chapter) throw new Error(`Unknown published campaign chapter ID: ${topologyChapter.id}`);
      return { ...structuredClone(chapter), decisionIds: [...topologyChapter.decisionIds] };
    }),
    decisions,
  });
}

export function campaignPosition(completed: number): { chapterIndex: number; decisionIndex: number } {
  if (!Number.isInteger(completed) || completed < 0 || completed >= campaignLength) throw new RangeError(`Invalid campaign position: ${completed}`);
  let offset = completed;
  for (let chapterIndex = 0; chapterIndex < CAMPAIGN_CHAPTER_SIZES.length; chapterIndex += 1) {
    const size = CAMPAIGN_CHAPTER_SIZES[chapterIndex]!;
    if (offset < size) return { chapterIndex, decisionIndex: offset };
    offset -= size;
  }
  throw new RangeError(`Invalid campaign position: ${completed}`);
}
