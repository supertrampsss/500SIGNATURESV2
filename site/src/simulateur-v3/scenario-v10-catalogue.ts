import { BUDGET_ESTIMATES } from "./budget-registry.ts";
import { POLICY_SOURCES, policyEvidence, type PolicySourceKey } from "./policy-sources.ts";
import { SCENARIO_V3_CATALOGUE } from "./scenario.ts";
import type { BudgetProfile, Decision, DecisionOption, EffectRule, Scenario } from "./types.ts";

export { STRUCTURAL_ADOPT_DECISION_IDS } from "./budget-registry.ts";

const NULL_PROFILE: BudgetProfile = Object.freeze({ estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] });

type Replacement = { id: string; title: string; sourceKeys: PolicySourceKey[]; estimateKey: string | null; year?: 2 | 3 | 5 };

const REPLACEMENTS: Record<string, Replacement> = {
  "geler-le-bareme-de-l-impot-sur": { id: "facturation-electronique-controle-tva", title: "Faut-il exploiter la facturation électronique contre la fraude à la TVA ?", sourceKeys: ["plan-antifraude-facturation-electronique"], estimateKey: "vat-einvoice-control-net", year: 2 },
  "flat-tax-a-20-des-le-premier": { id: "perenniser-surtaxe-grandes-entreprises", title: "Faut-il pérenniser la surtaxe sur les grandes entreprises ?", sourceKeys: ["senat-plf-2026-surtaxe-is"], estimateKey: "corporate-profit-surtax-net", year: 2 },
  "flat-tax-a-20-avec-abattement-protegeant": { id: "relever-tva-restauration-commerciale", title: "Faut-il relever la TVA de la restauration commerciale ?", sourceKeys: ["bofip-tva-restauration-2024", "evm-2026-tva-restauration"], estimateKey: "commercial-restaurant-vat-net", year: 2 },
  "tranche-a-50-au-dela-de-250": { id: "unifier-ir-csg-bareme-continu", title: "Faut-il unifier l'IR, la CSG et les prélèvements personnels ?", sourceKeys: ["dgfip-ir-2024", "ccss-csg-2025", "cgi-197"], estimateKey: null },
  "soumettre-les-revenus-du-capital-au-bareme": { id: "supprimer-niches-fiscales-menages-capital", title: "Faut-il supprimer les niches fiscales des ménages et du capital ?", sourceKeys: ["evm-2026"], estimateKey: "household-capital-tax-expenditures-net", year: 2 },
  "supprimer-les-allegements-de-cotisations-entre-2": { id: "recentrer-allegements-exonerations-sociales", title: "Faut-il recentrer les allègements et exonérations sociales ?", sourceKeys: ["plfss-2025-annexe-4", "plfss-2026-annexe-9"], estimateKey: "social-exemptions-targeted-net", year: 2 },
  "fiscaliser-les-heures-supplementaires-comme-le": { id: "cibler-aides-apprentissage", title: "Faut-il cibler les aides à l'apprentissage ?", sourceKeys: ["pap-travail-2026", "plfss-2026-annexe-9"], estimateKey: "apprenticeship-aid-targeted-net", year: 2 },
  "raboter-de-5-les-subventions-directes-aux": { id: "supprimer-subventions-directes-entreprises", title: "Faut-il supprimer les subventions directes insuffisamment évaluées ?", sourceKeys: ["hcsp-aides-entreprises-2025"], estimateKey: null },
  "raboter-le-credit-d-impot-recherche-de": { id: "recentrer-cir-niches-fiscales-entreprises", title: "Faut-il recentrer le CIR et les niches fiscales des entreprises ?", sourceKeys: ["evm-2026", "bofip-cir-2025"], estimateKey: "business-cir-tax-expenditures-net", year: 2 },
  "allocation-sociale-unique": { id: "remplacer-prime-activite-prelevements-travail", title: "Faut-il remplacer la prime d'activité par une baisse des prélèvements sur le travail ?", sourceKeys: ["cnaf-prime-activite-2024"], estimateKey: "prime-activity-recycle-2024" },
  "imposer-generiques-et-biosimilaires-en-premiere-intention": { id: "medicaments-comparables-achats-sante", title: "Faut-il généraliser les médicaments comparables et les achats de santé ?", sourceKeys: ["igf-achats-sante-2025", "ccss-ondam-2025"], estimateKey: "health-drugs-procurement-net", year: 3 },
  "renforcer-le-controle-des-arrets-de-travail": { id: "reduire-arrets-evitables-prescription", title: "Faut-il réduire les arrêts évitables et responsabiliser la prescription ?", sourceKeys: ["ccss-ondam-2025"], estimateKey: "health-sick-leave-net", year: 3 },
  "derembourser-les-cures-thermales": { id: "recouvrer-fraude-sociale-additionnelle", title: "Faut-il renforcer le recouvrement de la fraude sociale ?", sourceKeys: ["urssaf-fraude-2024", "cnaf-fraude-2024"], estimateKey: "social-fraud-recovery-net", year: 3 },
  "verser-le-rsa-automatiquement-fin-du-non": { id: "unifier-instruction-prestations-solidarite", title: "Faut-il unifier l'instruction des prestations de solidarité ?", sourceKeys: ["budget-programme-304", "cnaf-gestion"], estimateKey: "benefits-backoffice-net", year: 3 },
  "interdire-les-voitures-thermiques-en-2030": { id: "supprimer-niches-fiscales-brunes", title: "Faut-il supprimer les niches fiscales brunes ?", sourceKeys: ["evm-2026"], estimateKey: "brown-tax-expenditures-net", year: 5 },
  "reduire-de-5-les-dotations-aux-collectivites": { id: "clarifier-competences-doublons-territoriaux", title: "Faut-il clarifier les compétences et doublons territoriaux ?", sourceKeys: ["igf-collectivites-2024", "senat-ravignon"], estimateKey: "territorial-competencies-net", year: 5 },
  "geler-le-point-d-indice-en-2026": { id: "mutualiser-achats-publics", title: "Faut-il mutualiser les achats publics ?", sourceKeys: ["igf-collectivites-2024", "dae-2025"], estimateKey: "public-procurement-net", year: 5 },
  "fermer-un-tiers-des-agences-et-operateurs": { id: "rationaliser-operateurs-ingenierie-territoriale", title: "Faut-il rationaliser les opérateurs d'ingénierie territoriale ?", sourceKeys: ["igf-ingenierie-territoriale-2025"], estimateKey: "territorial-engineering-operators-net", year: 5 },
  "diviser-par-deux-le-nombre-de-parlementaires": { id: "reduire-surfaces-loyers-publics", title: "Faut-il réduire les surfaces et loyers publics ?", sourceKeys: ["die-2025"], estimateKey: "public-property-rent-net", year: 5 },
  "deux-jours-de-carence-dans-la-fonction": { id: "reduire-cout-absences-fonctions-publiques", title: "Faut-il réduire le coût des absences dans la fonction publique ?", sourceKeys: ["dgafp-temps-2024", "igf-igas-absences"], estimateKey: "public-absence-replacement-net", year: 5 },
};

function estimateFor(decisionId: string, optionId: string, key: string) {
  const estimate = BUDGET_ESTIMATES[`${decisionId}:${optionId}:${key}`];
  if (!estimate) throw new Error(`Missing V10 estimate ${decisionId}:${optionId}:${key}`);
  return estimate;
}

function auditedProfile(decisionId: string, key: string, year: 2 | 3 | 5): BudgetProfile {
  const estimate = estimateFor(decisionId, "adopt", key);
  return { estimateKey: key, runRateMillions: estimate.runRateMillions, runRateTiming: { kind: "mandate_year", year }, transitionFlows: [...estimate.transitionFlows], exclusiveScopeKeys: [...estimate.exclusiveScopeKeys] };
}

function carryProfile(decision: Decision, option: DecisionOption): BudgetProfile {
  const originalOptionId = option.id.split(":").at(-1)!;
  const v10OptionId = decision.id === "engager-six-epr2-part-annuelle-de-l" && originalOptionId === "six" ? "adopt" : originalOptionId;
  if (v10OptionId === "keep" || (option.budgetProfile.runRateMillions === 0 && option.budgetProfile.transitionFlows.length === 0)) return { ...NULL_PROFILE, transitionFlows: [], exclusiveScopeKeys: [] };
  const key = `carry-forward-${decision.id}-${v10OptionId}`;
  const estimate = estimateFor(decision.id, v10OptionId, key);
  return { estimateKey: key, runRateMillions: estimate.runRateMillions, runRateTiming: option.budgetProfile.runRateTiming, transitionFlows: [...estimate.transitionFlows], exclusiveScopeKeys: [...estimate.exclusiveScopeKeys] };
}

function budgetEffects(decisionId: string, optionId: string, profile: BudgetProfile): EffectRule[] {
  const annual = profile.runRateMillions === 0 ? [] : [{ id: `${decisionId}:${optionId}:indicator:annualBalance`, target: "indicator" as const, key: "annualBalance" as const, delta: profile.runRateMillions, timing: profile.runRateTiming!, duration: "annual" as const, explanation: "Effet budgétaire V10 issu du registre." }];
  return [...annual, ...profile.transitionFlows.map((flow) => ({ id: `${decisionId}:${optionId}:transition:${flow.id}`, target: "indicator" as const, key: "annualBalance" as const, delta: flow.amountMillions, timing: flow.timing, duration: "once" as const, explanation: "Flux ponctuel V10 issu du registre." }))];
}

function remapOption(decision: Decision, option: DecisionOption, newDecisionId: string, localOptionId: "adopt" | "keep", profile: BudgetProfile, label?: string): DecisionOption {
  const nonBudget = option.effects.filter((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"));
  return { ...option, id: `${newDecisionId}:${localOptionId}`, label: label ?? option.label, budgetProfile: profile, effects: [...budgetEffects(newDecisionId, localOptionId, profile), ...nonBudget] };
}

function replacementDecision(source: Decision, replacement: Replacement): Decision {
  const adoptSource = source.options[0]!;
  const keepSource = source.options.at(-1)!;
  const adoptProfile = replacement.estimateKey === null ? { ...NULL_PROFILE, transitionFlows: [], exclusiveScopeKeys: [] }
    : replacement.id === "remplacer-prime-activite-prelevements-travail"
      ? { estimateKey: replacement.estimateKey, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] }
      : auditedProfile(replacement.id, replacement.estimateKey, replacement.year!);
  return { ...source, id: replacement.id, version: 10, title: replacement.title,
    evidence: policyEvidence(replacement.sourceKeys, "Source primaire du chiffrage V10."),
    options: [remapOption(source, adoptSource, replacement.id, "adopt", adoptProfile), remapOption(source, keepSource, replacement.id, "keep", { ...NULL_PROFILE, transitionFlows: [], exclusiveScopeKeys: [] })],
    dependencies: [], conflicts: [] };
}

function retainedDecision(source: Decision): Decision {
  if (source.id === "engager-six-epr2-part-annuelle-de-l") {
    const six = source.options.find((option) => option.id.endsWith(":six"))!;
    const none = source.options.find((option) => option.id.endsWith(":none"))!;
    return { ...source, version: 10, options: [
      remapOption(source, six, source.id, "adopt", carryProfile(source, six), "Engager six EPR2"),
      remapOption(source, none, source.id, "keep", { ...NULL_PROFILE, transitionFlows: [], exclusiveScopeKeys: [] }, "Ne pas engager de nouvel EPR2"),
    ] };
  }
  return { ...source, version: 10, options: source.options.map((option) => {
    const local = option.id.split(":").at(-1)! as "adopt" | "keep";
    return remapOption(source, option, source.id, local, carryProfile(source, option));
  }) };
}

const decisions = SCENARIO_V3_CATALOGUE.decisions.map((decision) => REPLACEMENTS[decision.id] ? replacementDecision(decision, REPLACEMENTS[decision.id]!) : retainedDecision(decision));
const knownIds = new Set(decisions.map((decision) => decision.id));
const normalized = decisions.map((decision) => ({ ...decision, conflicts: decision.conflicts.filter((id) => knownIds.has(id)), dependencies: decision.dependencies.filter((id) => knownIds.has(id)), options: decision.options.map((option) => ({ ...option, locks: option.locks.filter((id) => knownIds.has(id)), unlocks: option.unlocks.filter((id) => knownIds.has(id)) })) }));

export const SCENARIO_V10_CATALOGUE: Scenario = Object.freeze({ version: 10, title: "Bibliothèque V10 des politiques", chapters: SCENARIO_V3_CATALOGUE.chapters.map((chapter) => ({ ...chapter, decisionIds: normalized.filter((decision) => decision.chapterId === chapter.id).map((decision) => decision.id) })), decisions: normalized });

export function v10PolicyById(id: string): Decision | undefined {
  return SCENARIO_V10_CATALOGUE.decisions.find((decision) => decision.id === id);
}

void POLICY_SOURCES;
