import { BUDGET_ESTIMATES } from "./budget-registry.ts";
import { policyEvidence, type PolicySourceKey } from "./policy-sources.ts";
import { SCENARIO_V3_CATALOGUE } from "./scenario.ts";
import { validatePolicyCatalogue } from "./validation.ts";
import type { BudgetProfile, Decision, DecisionKind, DecisionOption, GroupKey, IndicatorKey, Scenario } from "./types.ts";

export { STRUCTURAL_ADOPT_DECISION_IDS } from "./budget-registry.ts";

const NULL_PROFILE: BudgetProfile = { estimateKey: null, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] };
type Replacement = { id: string; chapterId: string; kind: DecisionKind; title: string; context: string; subject: string; legal: string; beneficiaries: string[]; contributors: string[]; indicator: IndicatorKey; group: GroupKey; sourceKeys: PolicySourceKey[]; estimateKey: string | null; year?: 2 | 3 | 5 };
const TAX = "taxes-assets-transmission", WORK = "work-wages-pensions", HEALTH = "health-social-protection", ENERGY = "energy-climate-transport-agriculture", STATE = "state-institutions-territories";

// Each entry is a new V10 decision definition. The V9 key only selects its catalogue slot;
// no old copy, consequence, lock, event or effect is read while compiling these dossiers.
const REPLACEMENTS: Record<string, Replacement> = {
  "geler-le-bareme-de-l-impot-sur": { id: "facturation-electronique-controle-tva", chapterId: TAX, kind: "gestion", title: "Faut-il déployer la facturation électronique contre la fraude à la TVA ?", context: "Les factures structurées permettent de rapprocher plus vite transactions et déclarations afin de cibler les anomalies de TVA.", subject: "le contrôle de la TVA par facturation électronique", legal: "Respecter le calendrier légal de déploiement et la protection des données commerciales.", beneficiaries: ["finances publiques", "entreprises respectant les règles"], contributors: ["fraudeurs à la TVA", "entreprises non préparées"], indicator: "financialCredibility", group: "businesses", sourceKeys: ["plan-antifraude-facturation-electronique"], estimateKey: "vat-einvoice-control-net", year: 2 },
  "flat-tax-a-20-des-le-premier": { id: "perenniser-surtaxe-grandes-entreprises", chapterId: TAX, kind: "transformation", title: "Faut-il pérenniser la surtaxe sur les grandes entreprises ?", context: "La contribution exceptionnelle des grands groupes apporte une recette mais modifie leur coût du capital et leur compétitivité.", subject: "la pérennisation de la surtaxe d'impôt sur les sociétés", legal: "Inscrire l'assiette, le seuil et la durée dans la loi de finances.", beneficiaries: ["finances publiques"], contributors: ["grandes entreprises", "actionnaires"], indicator: "financialCredibility", group: "businesses", sourceKeys: ["senat-plf-2026-surtaxe-is"], estimateKey: "corporate-profit-surtax-net", year: 2 },
  "flat-tax-a-20-avec-abattement-protegeant": { id: "relever-tva-restauration-commerciale", chapterId: TAX, kind: "transformation", title: "Faut-il relever la TVA de la restauration commerciale ?", context: "La restauration commerciale constitue une assiette distincte du taux normal, dont l'évolution se retrouve directement dans les prix et les marges.", subject: "la TVA applicable à la restauration commerciale", legal: "Modifier le code général des impôts et informer les professionnels avant l'entrée en vigueur.", beneficiaries: ["finances publiques"], contributors: ["clients de restaurants", "restaurateurs"], indicator: "financialCredibility", group: "businesses", sourceKeys: ["bofip-tva-restauration-2024", "evm-2026-tva-restauration"], estimateKey: "commercial-restaurant-vat-net", year: 2 },
  "tranche-a-50-au-dela-de-250": { id: "unifier-ir-csg-bareme-continu", chapterId: TAX, kind: "transformation", title: "Faut-il unifier l'IR, la CSG et les prélèvements personnels dans un barème continu ?", context: "Un prélèvement personnel continu remplace les superpositions actuelles, sans impôt négatif ni versement forfaitaire en espèces.", subject: "un prélèvement personnel progressif unifié", legal: "Préserver les cotisations contributives et calibrer la réforme à rendement constant.", beneficiaries: ["salariés aux revenus modestes", "usagers"], contributors: ["administrations fiscales et sociales"], indicator: "institutionalTrust", group: "privateEmployees", sourceKeys: ["dgfip-ir-2024", "ccss-csg-2025", "cgi-197"], estimateKey: null },
  "soumettre-les-revenus-du-capital-au-bareme": { id: "supprimer-niches-fiscales-menages-capital", chapterId: TAX, kind: "gestion", title: "Faut-il supprimer un panier documenté de niches fiscales des ménages et du capital ?", context: "Le panier porte sur les dépenses fiscales identifiées des ménages et du capital, en dehors du CIR, des niches sociales, des niches brunes et du barème unifié.", subject: "la suppression des niches ménages et capital sélectionnées", legal: "Préciser les droits acquis et le calendrier d'extinction dans la loi de finances.", beneficiaries: ["finances publiques", "neutralité fiscale"], contributors: ["bénéficiaires des niches"], indicator: "financialCredibility", group: "middleClasses", sourceKeys: ["evm-2026"], estimateKey: "household-capital-tax-expenditures-net", year: 2 },
  "supprimer-les-allegements-de-cotisations-entre-2": { id: "recentrer-allegements-exonerations-sociales", chapterId: WORK, kind: "gestion", title: "Faut-il recentrer les allègements et exonérations sociales ?", context: "Les exonérations sont resserrées là où leur effet emploi est insuffisamment démontré, sans reprendre l'apprentissage ou le prélèvement unifié.", subject: "le ciblage des allègements et exonérations sociales", legal: "Modifier les paramètres de cotisations après concertation des partenaires sociaux.", beneficiaries: ["finances sociales"], contributors: ["employeurs concernés"], indicator: "financialCredibility", group: "businesses", sourceKeys: ["plfss-2025-annexe-4", "plfss-2026-annexe-9"], estimateKey: "social-exemptions-targeted-net", year: 2 },
  "fiscaliser-les-heures-supplementaires-comme-le": { id: "cibler-aides-apprentissage", chapterId: WORK, kind: "gestion", title: "Faut-il cibler les aides à l'apprentissage ?", context: "Les aides sont concentrées sur les formations et contrats dont l'effet d'emploi est démontré, en distinguant employeurs et exonérations d'apprentis.", subject: "le ciblage des aides à l'apprentissage", legal: "Fixer les critères d'éligibilité par décret après avis des partenaires sociaux.", beneficiaries: ["finances publiques", "apprentis des filières prioritaires"], contributors: ["employeurs de contrats non ciblés"], indicator: "employment", group: "businesses", sourceKeys: ["pap-travail-2026", "plfss-2026-annexe-9"], estimateKey: "apprenticeship-aid-targeted-net", year: 2 },
  "raboter-de-5-les-subventions-directes-aux": { id: "supprimer-subventions-directes-entreprises", chapterId: WORK, kind: "transformation", title: "Faut-il supprimer les subventions directes aux entreprises insuffisamment évaluées ?", context: "Une revue publique peut organiser l'extinction des aides non évaluées, sans revendiquer un gain avant une ventilation fiable des dispositifs.", subject: "la revue des subventions directes insuffisamment évaluées", legal: "Respecter les engagements contractuels et les règles européennes d'aides d'État.", beneficiaries: ["transparence publique"], contributors: ["bénéficiaires des aides supprimées"], indicator: "institutionalTrust", group: "businesses", sourceKeys: ["hcsp-aides-entreprises-2025"], estimateKey: null },
  "raboter-le-credit-d-impot-recherche-de": { id: "recentrer-cir-niches-fiscales-entreprises", chapterId: WORK, kind: "transformation", title: "Faut-il recentrer le CIR et les niches fiscales des entreprises ?", context: "Le scénario vise un demi-taux de CIR avec décotes explicites, sans additionner les subventions directes ni présumer toute R&D additionnelle.", subject: "le recentrage du CIR et des niches entreprises", legal: "Modifier le CGI avec des garanties de sécurité juridique pour les dépenses engagées.", beneficiaries: ["finances publiques", "R&D additionnelle"], contributors: ["grands bénéficiaires du CIR"], indicator: "financialCredibility", group: "businesses", sourceKeys: ["evm-2026", "bofip-cir-2025"], estimateKey: "business-cir-tax-expenditures-net", year: 2 },
  "allocation-sociale-unique": { id: "remplacer-prime-activite-prelevements-travail", chapterId: WORK, kind: "transformation", title: "Faut-il remplacer la prime d'activité par une baisse des prélèvements sur le travail ?", context: "La prime séparée est supprimée progressivement et son enveloppe est intégralement réemployée pour améliorer le salaire net des premiers revenus du travail.", subject: "le recyclage neutre de la prime d'activité vers le salaire net", legal: "Garantir la neutralité budgétaire et la continuité des droits pendant la transition.", beneficiaries: ["salariés aux revenus modestes"], contributors: ["organismes gestionnaires de la prime"], indicator: "employment", group: "privateEmployees", sourceKeys: ["cnaf-prime-activite-2024"], estimateKey: "prime-activity-recycle-2024" },
  "imposer-generiques-et-biosimilaires-en-premiere-intention": { id: "medicaments-comparables-achats-sante", chapterId: HEALTH, kind: "gestion", title: "Faut-il généraliser les médicaments comparables et mutualiser les achats de santé ?", context: "Les prescriptions et achats privilégient les produits comparables ou biosimilaires lorsque la qualité de soin le permet.", subject: "les médicaments comparables et les achats hospitaliers mutualisés", legal: "Préserver la liberté médicale et les exceptions thérapeutiques.", beneficiaries: ["assurance maladie", "patients"], contributors: ["laboratoires de spécialités"], indicator: "publicServices", group: "businesses", sourceKeys: ["igf-annexe-xii-achats-hospitaliers-2026", "plfss-2026-annexe-5"], estimateKey: "health-drugs-procurement-net", year: 3 },
  "renforcer-le-controle-des-arrets-de-travail": { id: "reduire-arrets-evitables-prescription", chapterId: HEALTH, kind: "gestion", title: "Faut-il réduire les arrêts évitables et responsabiliser la prescription ?", context: "Le dispositif combine prévention, accompagnement et contrôle des prescriptions, hors absences des agents publics.", subject: "la prévention et la prescription des arrêts évitables", legal: "Respecter le secret médical et les garanties des assurés.", beneficiaries: ["assurance maladie", "salariés accompagnés"], contributors: ["prescripteurs hors recommandations"], indicator: "publicServices", group: "privateEmployees", sourceKeys: ["cnam-rapport-charges-produits-2026", "placss-2025-annexe-6"], estimateKey: "health-sick-leave-net", year: 3 },
  "derembourser-les-cures-thermales": { id: "recouvrer-fraude-sociale-additionnelle", chapterId: HEALTH, kind: "gestion", title: "Faut-il renforcer le recouvrement additionnel de la fraude sociale ?", context: "Seuls les encaissements supplémentaires après détection et redressement sont retenus pour éviter le double compte.", subject: "le recouvrement net de la fraude sociale", legal: "Respecter le contradictoire et les voies de recours.", beneficiaries: ["finances sociales", "cotisants respectueux"], contributors: ["fraudeurs sociaux"], indicator: "institutionalTrust", group: "privateEmployees", sourceKeys: ["placss-2025-annexe-6"], estimateKey: "social-fraud-recovery-net", year: 3 },
  "verser-le-rsa-automatiquement-fin-du-non": { id: "unifier-instruction-prestations-solidarite", chapterId: HEALTH, kind: "gestion", title: "Faut-il unifier l'instruction des prestations de solidarité ?", context: "Le chiffrage se limite au back-office APL : il ne comptabilise ni non-recours, ni réduction de droit, ni prime d'activité.", subject: "la mutualisation du back-office APL", legal: "Préserver les droits, voies de recours et la protection des données.", beneficiaries: ["usagers", "agents de gestion"], contributors: ["organisations à adapter"], indicator: "publicServices", group: "lowIncomeHouseholds", sourceKeys: ["budget-programme-109"], estimateKey: "benefits-backoffice-net", year: 3 },
  "interdire-les-voitures-thermiques-en-2030": { id: "supprimer-niches-fiscales-brunes", chapterId: ENERGY, kind: "transformation", title: "Faut-il supprimer un panier documenté de niches fiscales brunes ?", context: "Tarifs réduits et remboursements retenus sont supprimés sans inclure les aides budgétaires, le bonus automobile ou la taxe carbone.", subject: "la suppression des niches fiscales brunes sélectionnées", legal: "Prévoir un calendrier d'adaptation pour les secteurs exposés.", beneficiaries: ["finances publiques", "transition climatique"], contributors: ["secteurs bénéficiaires"], indicator: "growth", group: "businesses", sourceKeys: ["evm-2026"], estimateKey: "brown-tax-expenditures-net", year: 5 },
  "reduire-de-5-les-dotations-aux-collectivites": { id: "clarifier-competences-doublons-territoriaux", chapterId: STATE, kind: "transformation", title: "Faut-il clarifier les compétences et doublons territoriaux ?", context: "La réforme traite les recouvrements de compétences sans compter à nouveau achats, immobilier, absences ou opérateurs.", subject: "la clarification des compétences territoriales", legal: "Garantir la continuité des services et la consultation des collectivités.", beneficiaries: ["usagers", "collectivités clarifiées"], contributors: ["structures en doublon"], indicator: "institutionalTrust", group: "localAuthorities", sourceKeys: ["igf-collectivites-2024", "senat-ravignon"], estimateKey: "territorial-competencies-net", year: 5 },
  "geler-le-point-d-indice-en-2026": { id: "mutualiser-achats-publics", chapterId: STATE, kind: "gestion", title: "Faut-il mutualiser et professionnaliser les achats publics ?", context: "Les marchés où la mutualisation est réalisable sont regroupés entre État et collectivités, sans reprendre des gains déjà attribués ailleurs.", subject: "la mutualisation des achats publics", legal: "Préserver l'accès des PME et les règles de la commande publique.", beneficiaries: ["finances publiques", "acheteurs publics"], contributors: ["fournisseurs moins compétitifs"], indicator: "publicServices", group: "businesses", sourceKeys: ["igf-collectivites-2024", "dae-2025"], estimateKey: "public-procurement-net", year: 5 },
  "fermer-un-tiers-des-agences-et-operateurs": { id: "rationaliser-operateurs-ingenierie-territoriale", chapterId: STATE, kind: "gestion", title: "Faut-il rationaliser les opérateurs d'ingénierie territoriale ?", context: "Cerema, ANCT et ADEME coordonnent leurs interventions sur un périmètre documenté, sans fermeture générique.", subject: "la rationalisation des opérateurs d'ingénierie territoriale", legal: "Assurer la continuité de l'appui aux territoires.", beneficiaries: ["collectivités accompagnées", "finances publiques"], contributors: ["structures à réorganiser"], indicator: "publicServices", group: "localAuthorities", sourceKeys: ["igf-ingenierie-territoriale-2025"], estimateKey: "territorial-engineering-operators-net", year: 5 },
  "diviser-par-deux-le-nombre-de-parlementaires": { id: "reduire-surfaces-loyers-publics", chapterId: STATE, kind: "gestion", title: "Faut-il réduire les surfaces et loyers publics ?", context: "Les implantations sont regroupées afin de diminuer loyers et entretien récurrents, sans transformer les cessions ponctuelles en rendement annuel.", subject: "la réduction des surfaces et loyers publics", legal: "Respecter les contraintes de service, de sécurité et de mobilité des agents.", beneficiaries: ["finances publiques", "services regroupés"], contributors: ["sites libérés", "agents mobiles"], indicator: "publicServices", group: "publicEmployees", sourceKeys: ["die-2025"], estimateKey: "public-property-rent-net", year: 5 },
  "deux-jours-de-carence-dans-la-fonction": { id: "reduire-cout-absences-fonctions-publiques", chapterId: STATE, kind: "gestion", title: "Faut-il réduire le coût des absences dans les fonctions publiques ?", context: "Prévention, organisation du travail et remplacement réduisent le coût des absences dans les trois fonctions publiques, hors arrêts de santé déjà chiffrés.", subject: "la prévention des absences et les remplacements publics", legal: "Préserver les droits à congé maladie et le dialogue social.", beneficiaries: ["services publics", "agents accompagnés"], contributors: ["organisations à adapter"], indicator: "publicServices", group: "publicEmployees", sourceKeys: ["dgafp-temps-2024", "igf-igas-absences"], estimateKey: "public-absence-replacement-net", year: 5 },
};

function auditedProfile(replacement: Replacement): BudgetProfile {
  if (replacement.estimateKey === null) return structuredClone(NULL_PROFILE);
  if (replacement.id === "remplacer-prime-activite-prelevements-travail") return { estimateKey: replacement.estimateKey, runRateMillions: 0, runRateTiming: null, transitionFlows: [], exclusiveScopeKeys: [] };
  const estimate = BUDGET_ESTIMATES[`${replacement.id}:adopt:${replacement.estimateKey}`]!;
  return { estimateKey: estimate.key, runRateMillions: estimate.runRateMillions, runRateTiming: { kind: "mandate_year", year: replacement.year! }, transitionFlows: structuredClone(estimate.transitionFlows), exclusiveScopeKeys: [...estimate.exclusiveScopeKeys] };
}
function replacementOption(replacement: Replacement, local: "adopt" | "keep"): DecisionOption {
  const adopt = local === "adopt";
  const profile = adopt ? auditedProfile(replacement) : structuredClone(NULL_PROFILE);
  const polarity = adopt ? 1 : -1;
  return { id: `${replacement.id}:${local}`, label: adopt ? `Mettre en œuvre ${replacement.subject}` : `Ne pas modifier ${replacement.subject}`, summary: adopt ? `La décision engage ${replacement.subject} selon un périmètre audité.` : `Le cadre actuel est conservé et la réforme n'est pas engagée.`, mechanism: adopt ? `Mettre en œuvre ${replacement.subject}.` : `Maintenir le cadre actuel sans engager ${replacement.subject}.`, horizon: { kind: "immediate" }, legalConstraints: [replacement.legal], budgetProfile: profile, beneficiaries: adopt ? replacement.beneficiaries : replacement.contributors, contributors: adopt ? replacement.contributors : replacement.beneficiaries, uncertainty: "moyenne", effects: [{ id: `${replacement.id}:${local}:indicator:${replacement.indicator}`, target: "indicator", key: replacement.indicator, delta: 2 * polarity, timing: { kind: "immediate" }, duration: "once", explanation: adopt ? `Conséquence institutionnelle de ${replacement.subject}.` : `Conséquence du maintien du cadre actuel.` }, { id: `${replacement.id}:${local}:group:${replacement.group}`, target: "group", key: replacement.group, delta: -polarity, timing: { kind: "immediate" }, duration: "once", explanation: adopt ? `Effet distributif de ${replacement.subject}.` : "Effet distributif du maintien." }], scheduledEvents: [], promises: [], fulfillsPromises: [], locks: [], unlocks: [] };
}
function replacementDecision(replacement: Replacement): Decision { return { id: replacement.id, version: 10, kind: replacement.kind, chapterId: replacement.chapterId, title: replacement.title, context: replacement.context, evidence: policyEvidence(replacement.sourceKeys, "Source primaire du dossier V10."), options: [replacementOption(replacement, "adopt"), replacementOption(replacement, "keep")], dependencies: [], conflicts: [] }; }

function retainedProfile(source: Decision, option: DecisionOption, local: "adopt" | "keep"): BudgetProfile {
  if (local === "keep" || (option.budgetProfile.runRateMillions === 0 && option.budgetProfile.transitionFlows.length === 0)) return structuredClone(NULL_PROFILE);
  const key = `carry-forward-${source.id}-${local}`;
  const estimate = BUDGET_ESTIMATES[`${source.id}:${local}:${key}`]!;
  const annual = option.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance" && effect.duration !== "once");
  const runRateTiming = annual?.timing.kind === "immediate"
    ? { kind: "immediate" as const }
    : annual?.timing.kind === "after_decisions"
      ? { kind: "after_decisions" as const, count: annual.timing.count }
    : annual?.timing.kind === "mandate_year"
      ? { kind: "mandate_year" as const, year: annual.timing.year }
      : option.budgetProfile.runRateTiming;
  return { estimateKey: key, runRateMillions: estimate.runRateMillions, runRateTiming: structuredClone(runRateTiming), transitionFlows: structuredClone(estimate.transitionFlows), exclusiveScopeKeys: [...estimate.exclusiveScopeKeys] };
}
function retainedOption(source: Decision, option: DecisionOption, local: "adopt" | "keep", label?: string): DecisionOption {
  const profile = retainedProfile(source, option, local); const clone = structuredClone(option);
  const other = clone.effects.filter((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"));
  const oldLocal = option.id.split(":").at(-1)!;
  const remappedOther = other.map((effect) => ({ ...effect, id: effect.id.replace(`${source.id}:${oldLocal}:`, `${source.id}:${local}:`) }));
  const isFinalGoldenRuleAdoption = source.id === "regle-d-or-constitutionnelle" && local === "adopt";
  const finalTiming = { kind: "after_decisions" as const, count: 1 };
  const finalProfile = isFinalGoldenRuleAdoption
    ? { ...profile, runRateTiming: finalTiming }
    : profile;
  return {
    ...clone,
    id: `${source.id}:${local}`,
    label: label ?? clone.label,
    horizon: isFinalGoldenRuleAdoption ? finalTiming : clone.horizon,
    budgetProfile: finalProfile,
    effects: isFinalGoldenRuleAdoption
      ? remappedOther.map((effect) => ({ ...effect, timing: finalTiming }))
      : remappedOther,
    scheduledEvents: isFinalGoldenRuleAdoption
      ? clone.scheduledEvents.map((event) => ({ ...event, afterDecisions: 1 }))
      : clone.scheduledEvents,
  };
}
const FINAL_V10_RELATIONSHIPS: Readonly<Record<string, Readonly<{
  dependencies: readonly string[];
  conflicts: readonly string[];
  options: Readonly<Record<"adopt" | "keep", Readonly<{ locks: readonly string[]; unlocks: readonly string[] }>>>;
}>>> = {
  "abolir-les-droits-de-succession": {
    dependencies: [], conflicts: ["exonerer-de-droits-de-succession-jusqu-a"],
    options: { adopt: { locks: ["exonerer-de-droits-de-succession-jusqu-a"], unlocks: [] }, keep: { locks: [], unlocks: [] } },
  },
  "service-militaire-volontaire-de-50-000": {
    dependencies: [], conflicts: [],
    options: { adopt: { locks: [], unlocks: [] }, keep: { locks: [], unlocks: [] } },
  },
};

const LEGACY_V10_RELATIONSHIP_CONTRACTS: Readonly<Record<string, Readonly<{
  dependencies: readonly string[];
  conflicts: readonly string[];
  options: readonly Readonly<{ localId: "adopt" | "keep"; locks: readonly string[]; unlocks: readonly string[] }>[];
}>>> = {
  "abolir-les-droits-de-succession": {
    dependencies: [],
    conflicts: ["exonerer-de-droits-de-succession-jusqu-a", "raboter-l-avantage-successoral-de-l-assurance"],
    options: [
      { localId: "adopt", locks: ["exonerer-de-droits-de-succession-jusqu-a", "raboter-l-avantage-successoral-de-l-assurance"], unlocks: [] },
      { localId: "keep", locks: [], unlocks: [] },
    ],
  },
  "service-militaire-volontaire-de-50-000": {
    dependencies: [], conflicts: ["generaliser-le-service-national-universel"],
    options: [
      { localId: "adopt", locks: ["generaliser-le-service-national-universel"], unlocks: [] },
      { localId: "keep", locks: [], unlocks: [] },
    ],
  },
};

function assertLegacyV10RelationshipContract(decision: Decision): void {
  const expected = LEGACY_V10_RELATIONSHIP_CONTRACTS[decision.id];
  if (!expected) return;
  const actual = {
    dependencies: decision.dependencies,
    conflicts: decision.conflicts,
    options: decision.options.map((option) => ({
      localId: option.id.split(":").at(-1),
      locks: option.locks,
      unlocks: option.unlocks,
    })),
  };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`legacy-v10-relationship-contract:${decision.id}`);
  }
}

function applyFinalV10Relationships(decision: Decision): Decision {
  const final = FINAL_V10_RELATIONSHIPS[decision.id];
  if (!final) return decision;
  return {
    ...decision,
    dependencies: [...final.dependencies],
    conflicts: [...final.conflicts],
    options: decision.options.map((option) => {
      const local = option.id.split(":").at(-1)! as "adopt" | "keep";
      const relation = final.options[local];
      return { ...option, locks: [...relation.locks], unlocks: [...relation.unlocks] };
    }),
  };
}

function retainedDecision(source: Decision): Decision {
  assertLegacyV10RelationshipContract(source);
  const migrated = source.id === "engager-six-epr2-part-annuelle-de-l"
    ? (() => { const six = source.options.find((option) => option.id.endsWith(":six"))!; const none = source.options.find((option) => option.id.endsWith(":none"))!; return { ...structuredClone(source), version: 10 as const, options: [retainedOption(source, six, "adopt", "Engager six EPR2"), retainedOption(source, none, "keep", "Ne pas engager de nouvel EPR2")] }; })()
    : { ...structuredClone(source), version: 10 as const, options: source.options.map((option) => retainedOption(source, option, option.id.split(":").at(-1)! as "adopt" | "keep")) };
  return applyFinalV10Relationships(migrated);
}
function deepFreeze<T>(value: T): T { if (value && typeof value === "object") { for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); } return value; }
export function buildV10Catalogue(source: Scenario = SCENARIO_V3_CATALOGUE): Scenario {
  const decisions = source.decisions.map((decision) => REPLACEMENTS[decision.id] ? replacementDecision(REPLACEMENTS[decision.id]!) : retainedDecision(decision));
  const catalogue: Scenario = { version: 10, title: "Bibliothèque V10 des politiques", chapters: source.chapters.map((chapter) => ({ ...structuredClone(chapter), decisionIds: decisions.filter((decision) => decision.chapterId === chapter.id).map((decision) => decision.id) })), decisions };
  const errors = validatePolicyCatalogue(catalogue);
  if (errors.length > 0) throw new Error(`Invalid V10 catalogue: ${errors.join(", ")}`);
  return deepFreeze(catalogue);
}
export const SCENARIO_V10_CATALOGUE: Scenario = buildV10Catalogue();
export function v10PolicyById(id: string): Decision | undefined { return SCENARIO_V10_CATALOGUE.decisions.find((decision) => decision.id === id); }
