import { currentDecision } from "./campaign.ts";
import { BUDGET_ESTIMATES } from "./budget-registry.ts";
import { availableConcessions } from "./crises.ts";
import { INDICATOR_META } from "./indicator-meta.ts";
import { groupJournal } from "./presentation.ts";
import { totalDecisions } from "./validation.ts";
import { buildMandateVerdictViewModel } from "./verdict.ts";
import type {
  MandateVerdictViewModel,
  VerdictAftermath,
  VerdictChoice,
  VerdictSignal,
} from "./verdict.ts";
import type {
  CampaignState,
  CausalEntry,
  CrisisRule,
  Decision,
  DecisionOption,
  EffectRule,
  PoliticalPromise,
  Scenario,
  ScheduledEvent,
} from "./types.ts";

export type RenderSimulatorV3Options = {
  v2Found?: boolean;
  restartRequired?: boolean;
  crisisRules?: readonly CrisisRule[];
  pauseView?: "menu" | "journal" | "restart";
  saveFailed?: boolean;
  /** The option whose player-facing detail panel is currently open. */
  detailOptionId?: string;
  /** Whether the immediately preceding policy choice can be restored. */
  canUndo?: boolean;
  /** Best score kept across completed mandates, expressed in millions of euros. */
  bestScore?: number;
  /** Improvement over the previous personal best, expressed in millions of euros. */
  recordImprovement?: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function compactText(value: string, maximum = 176): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const sentence = normalized.match(/^.{24,}?[.!?](?:\s|$)/)?.[0]?.trim() ?? normalized;
  if (sentence.length <= maximum) return sentence;
  const cut = sentence.slice(0, maximum + 1).lastIndexOf(" ");
  return `${sentence.slice(0, cut > 80 ? cut : maximum).replace(/[,:;.!?]+$/, "")}…`;
}

function compactOptionLabel(label: string): string {
  const normalized = label
    .replace(/\s+/g, " ")
    .replace("Réserver les prestations non contributives aux nationaux et aux étrangers présents depuis 5 ans", "Conditionner les prestations non contributives à la nationalité ou à 5 ans de présence")
    .trim()
    .replace(/\s*\?$/, "");
  const beforeExplanation = normalized.split(/\s+:\s+/, 1)[0]?.trim();
  return beforeExplanation && beforeExplanation.length >= 12 ? beforeExplanation : normalized;
}

export function formatV3Amount(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000) {
    const billions = Math.round(value / 1_000);
    return `${signed(billions)} ${Math.abs(billions) === 1 ? "milliard" : "milliards"} d'euros`;
  }
  const millions = Math.round(value);
  return `${signed(millions)} ${Math.abs(millions) === 1 ? "million" : "millions"} d'euros`;
}

function globalPosition(state: CampaignState, scenario: Scenario): number {
  if (state.scenarioVersion === 11 && state.sessionDecisionIds) {
    return Math.min(state.sessionDecisionIds.length, state.decisions.length + 1);
  }
  const before = scenario.chapters
    .slice(0, state.chapterIndex)
    .reduce((sum, chapter) => sum + chapter.decisionIds.length, 0);
  return Math.min(totalDecisions(scenario), before + state.decisionIndex + 1);
}

function renderCommandBar(state: CampaignState, scenario: Scenario, canUndo = false): string {
  const total = totalDecisions(scenario);
  const progressLevel = Math.max(0, Math.min(100, Math.round((state.decisions.length / total) * 100)));
  const trailing = state.phase === "intro"
    ? `<span class="simulateur-v3__pause-state">Mission</span>`
    : state.phase === "pause"
      ? `<span class="simulateur-v3__pause-state">En pause</span>`
      : state.phase === "verdict"
        ? `<span class="simulateur-v3__pause-state">Mandat terminé</span>`
        : `<button type="button" class="simulateur-v3__pause" data-v3-action="pause">Pause</button>`;
  const progress = state.phase === "verdict"
    ? `<p class="simulateur-v3__verdict-progress">Verdict du mandat</p>`
    : `<button type="button" class="simulateur-v3__undo" data-v3-action="undo"${canUndo ? "" : " disabled"}>Retour</button>
      <p class="simulateur-v3__decision-progress">Dossier ${globalPosition(state, scenario)} sur ${total}</p>`;
  return `
    <header class="simulateur-v3__command-bar">
      <a class="simulateur-v3__brand" href="/bilan" aria-label="Où va l'argent public, revenir à France">
        <span class="simulateur-v3__flag" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Où va l'argent public</span>
      </a>
      <p class="simulateur-v3__mandate">Mandat 2026 à 2031</p>
      <p class="simulateur-v3__command-balance"><span>Solde annuel</span><strong>${escapeHtml(formatV3Amount(state.indicators.annualBalance))}</strong></p>
      ${progress}
      <span class="simulateur-v3__command-progress" role="progressbar" aria-label="Progression du mandat" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressLevel}"><i style="--v3-command-progress: ${progressLevel}%"></i></span>
      ${trailing}
    </header>`;
}

function formatV3AbsoluteAmount(value: number): string {
  return formatV3Amount(Math.abs(value)).replace(/^\+/, "");
}

function renderIntro(state: CampaignState, options: RenderSimulatorV3Options): string {
  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--intro">
      <article class="simulateur-v3__dossier simulateur-v3__intro">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Votre mission</p>
          <h1>Reprendre le contrôle des comptes sans perdre le pays.</h1>
          <p class="simulateur-v3__mission-number">${escapeHtml(formatV3AbsoluteAmount(state.baseline.annualBalanceMillions))}</p>
          <p class="simulateur-v3__lead">La France emprunte cette somme cette année. À vous de choisir comment réduire le déficit.</p>
        </header>
        <div class="simulateur-v3__scene-body">
          <ul class="simulateur-v3__objectives" aria-label="Objectifs du mandat">
            <li>Redresser les finances</li>
            <li>Préserver l'économie réelle</li>
            <li>Conserver une majorité</li>
            <li>Maintenir la confiance</li>
          </ul>
          ${options.v2Found ? `<p class="simulateur-v3__migration" role="status">Une ancienne partie a été trouvée. Elle reste intacte. Ce nouveau mandat repart avec les règles V3.</p>` : ""}
          ${options.restartRequired ? `<p class="simulateur-v3__migration" role="status">Cette sauvegarde utilise les anciennes règles. Un nouveau mandat est nécessaire pour continuer.</p>` : ""}
        </div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__primary" data-v3-action="start">Prendre mes fonctions</button></footer>
      </article>
    </main>`;
}

function renderChapterIntro(state: CampaignState, scenario: Scenario): string {
  const chapter = scenario.chapters[state.chapterIndex]!;
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__chapter-intro">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Chapitre ${state.chapterIndex + 1}</p>
          <h1>${escapeHtml(chapter.title)}</h1>
          <p class="simulateur-v3__lead">${escapeHtml(chapter.opening)}</p>
        </header>
        <div class="simulateur-v3__scene-body">
          <ul class="simulateur-v3__domains" aria-label="Domaines de ce chapitre">
            ${chapter.domains.map((domain) => `<li>${escapeHtml(domain)}</li>`).join("")}
          </ul>
          <p class="simulateur-v3__tension"><strong>La ligne de fracture</strong>${escapeHtml(chapter.tension)}</p>
        </div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__primary" data-v3-action="open-chapter">Ouvrir le premier dossier</button></footer>
      </article>
    </main>`;
}

function annualBalanceEffect(option: DecisionOption): EffectRule | undefined {
  return option.effects.find((effect) => effect.target === "indicator" && effect.key === "annualBalance");
}

const GROUP_EFFECT_LABELS: Record<string, string> = {
  businesses: "Entreprises",
  localAuthorities: "Territoires",
  unions: "Syndicats",
  farmers: "Agriculteurs",
  retirees: "Retraités",
  lowIncomeHouseholds: "Ménages modestes",
  middleClasses: "Classes moyennes",
  publicEmployees: "Agents publics",
  privateEmployees: "Salariés du privé",
  creditors: "Créanciers",
  europeanPartners: "Partenaires européens",
  parliamentaryMajority: "Majorité parlementaire",
};

function effectLabel(effect: { target: "indicator" | "group"; key: string; delta: number }): string {
  const label = effect.target === "indicator"
    ? INDICATOR_META[effect.key as keyof typeof INDICATOR_META]?.label ?? effect.key
    : GROUP_EFFECT_LABELS[effect.key] ?? effect.key;
  if (effect.target === "indicator") {
    const meta = INDICATOR_META[effect.key as keyof typeof INDICATOR_META];
    if (meta?.unit === "M€") return `${label} ${formatV3Amount(effect.delta)}`;
    const value = effect.delta.toLocaleString("fr-FR", {
      maximumFractionDigits: meta?.precision ?? 2,
    });
    const signedValue = `${effect.delta > 0 ? "+" : ""}${value}`;
    const point = Math.abs(effect.delta) <= 1 ? "point" : "points";
    if (meta?.unit === "% du PIB") return `${label} ${signedValue} ${point} de PIB`;
    if (meta?.unit === "% par an") return `${label} ${signedValue} ${point} de pourcentage par an`;
    return `${label} ${signedValue} ${point} d'indice`;
  }
  const value = effect.delta.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const point = Math.abs(effect.delta) <= 1 ? "point" : "points";
  return `${label} ${effect.delta > 0 ? "+" : ""}${value} ${point} d'indice`;
}

function formatIndicatorSnapshotValue(key: keyof typeof INDICATOR_META, value: number): string {
  const meta = INDICATOR_META[key];
  if (meta.unit === "M€") return formatV3Amount(value);
  const formatted = value.toLocaleString("fr-FR", {
    minimumFractionDigits: meta.precision,
    maximumFractionDigits: meta.precision,
  });
  if (meta.unit === "% du PIB") return `${formatted} % du PIB`;
  if (meta.unit === "% par an") return `${formatted} % par an`;
  return `${formatted} / 100`;
}

function timingLabel(timing: EffectRule["timing"]): string {
  if (timing.kind === "immediate") return "";
  if (timing.kind === "mandate_year") return `année ${timing.year}`;
  return `après ${timing.count} ${timing.count === 1 ? "décision" : "décisions"}`;
}

function effectLabelWithTiming(effect: EffectRule): string {
  const timing = timingLabel(effect.timing);
  return timing ? `${effectLabel(effect)} · ${timing}` : effectLabel(effect);
}

const COMPACT_INDICATOR_LABELS: Record<keyof typeof INDICATOR_META, string> = {
  annualBalance: "Solde",
  debtToGdp: "Dette",
  interestCost: "Intérêts",
  growth: "Croissance",
  employment: "Emploi",
  investment: "Investissement",
  publicServices: "Services publics",
  majority: "Majorité",
  reformCapacity: "Réformes",
  opinion: "Opinion",
  institutionalTrust: "Confiance",
  financialCredibility: "Marchés",
};

function compactImpactLabel(effect: Extract<EffectRule, { target: "indicator" }>): string {
  const key = effect.key as keyof typeof INDICATOR_META;
  const meta = INDICATOR_META[key];
  const label = COMPACT_INDICATOR_LABELS[key];
  const value = effect.delta.toLocaleString("fr-FR", { maximumFractionDigits: meta.precision });
  const signedValue = `${effect.delta > 0 ? "+" : ""}${value}`;
  const delta = meta.unit === "M€"
    ? Math.abs(effect.delta) >= 1_000
      ? `${effect.delta > 0 ? "+" : ""}${(effect.delta / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md€`
      : `${signedValue} M€`
    : meta.unit === "% du PIB"
      ? `${signedValue} pt PIB`
      : meta.unit === "% par an"
        ? `${signedValue} pt/an`
        : signedValue;
  const timing = effect.timing.kind === "mandate_year"
    ? ` · an ${effect.timing.year}`
    : effect.timing.kind === "after_decisions"
      ? ` · +${effect.timing.count} choix`
      : "";
  return `${label} ${delta}${timing}`;
}

function horizonLabel(horizon: DecisionOption["horizon"]): string {
  if (horizon.kind === "immediate") return "Immédiat";
  if (horizon.kind === "mandate_year") return `Année ${horizon.year}`;
  return `Après ${horizon.count} ${horizon.count === 1 ? "décision" : "décisions"}`;
}

function meter(label: string, value: number): string {
  const level = Math.max(0, Math.min(100, Math.round(value)));
  return `
    <div class="simulateur-v3__dashboard-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${level}</strong>
      <span class="simulateur-v3__meter" role="meter" aria-label="${escapeHtml(label)} : ${level} sur 100" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${level}">
        <i class="simulateur-v3__meter-tick" style="left:25%"></i><i class="simulateur-v3__meter-tick" style="left:50%"></i><i class="simulateur-v3__meter-tick" style="left:75%"></i>
        <i style="--v3-meter: ${level}%"></i>
      </span>
    </div>`;
}

function sparkline(values: readonly number[]): string {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const width = values.length > 1 ? 80 / (values.length - 1) : 80;
  const points = values.map((value, index) => {
    const y = 32 - ((value - minimum) / range) * 24;
    return `${Math.round(index * width)},${Math.round(y)}`;
  }).join(" ");
  const area = `0,34 ${points} 80,34`;
  return `
    <svg class="simulateur-v3__sparkline" aria-hidden="true" viewBox="0 0 80 38" preserveAspectRatio="none">
      <line class="simulateur-v3__sparkline-grid" x1="0" y1="10" x2="80" y2="10"></line>
      <line class="simulateur-v3__sparkline-grid" x1="0" y1="22" x2="80" y2="22"></line>
      <polygon class="simulateur-v3__sparkline-area" points="${area}"></polygon>
      <polyline points="${points}"></polyline>
      <circle class="simulateur-v3__sparkline-last" cx="80" cy="${Math.round(32 - ((values.at(-1)! - minimum) / range) * 24)}" r="2.5"></circle>
    </svg>`;
}

function annualBalanceSeries(state: CampaignState): number[] {
  const movements = state.causalLedger
    .filter((entry) => entry.target === "indicator" && entry.key === "annualBalance")
    .slice(-4);
  let cursor = state.indicators.annualBalance;
  const values = [cursor];
  for (const movement of [...movements].reverse()) {
    cursor -= movement.delta;
    values.unshift(cursor);
  }
  return values.length > 1 ? values : [cursor, cursor];
}

function renderMandateDashboard(state: CampaignState): string {
  const growth = state.indicators.growth.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `
    <aside class="simulateur-v3__mandate-dashboard" aria-label="Tableau de situation du mandat">
      <section class="simulateur-v3__dashboard-group simulateur-v3__dashboard-group--finances">
        <p>Finances</p>
        <strong>${escapeHtml(formatV3Amount(state.indicators.annualBalance))}</strong>
        <span>Solde annuel</span>
        ${sparkline(annualBalanceSeries(state))}
      </section>
      <section class="simulateur-v3__dashboard-group">
        <p>Pays</p>
        <div class="simulateur-v3__dashboard-pair"><span>${INDICATOR_META.growth.label}</span><strong>${growth} %</strong></div>
        ${meter("Services", state.indicators.publicServices)}
      </section>
      <section class="simulateur-v3__dashboard-group">
        <p>Pouvoir</p>
        ${meter("Majorité", state.indicators.majority)}
        ${meter("Réformes", state.indicators.reformCapacity)}
      </section>
      <section class="simulateur-v3__dashboard-group">
        <p>Confiance</p>
        ${meter("Opinion", state.indicators.opinion)}
        ${meter("Marchés", state.indicators.financialCredibility)}
      </section>
    </aside>`;
}

function principalIndicatorEffect(option: DecisionOption): Extract<EffectRule, { target: "indicator" }> | undefined {
  const candidates = option.effects.filter((effect): effect is Extract<EffectRule, { target: "indicator" }> =>
    effect.target === "indicator" && effect.key !== "annualBalance");
  return [...candidates].sort((left, right) =>
    INDICATOR_META[right.key].priority - INDICATOR_META[left.key].priority
    || left.id.localeCompare(right.id, "fr")).at(0);
}

function principalBudgetProfileValue(option: DecisionOption): number {
  const runRate = option.budgetProfile.runRateMillions;
  if (runRate !== 0) return runRate;
  return [...option.budgetProfile.transitionFlows]
    .sort((left, right) => Math.abs(right.amountMillions) - Math.abs(left.amountMillions))[0]
    ?.amountMillions ?? 0;
}

function budgetProfileLabel(option: DecisionOption): string {
  const runRate = option.budgetProfile.runRateMillions;
  if (runRate !== 0) return `${formatV3Amount(runRate)} par an`;
  const transition = principalBudgetProfileValue(option);
  return transition === 0 ? "Solde public inchangé" : `${formatV3Amount(transition)} une seule fois`;
}

function renderOption(decision: Decision, option: DecisionOption, scenario: Scenario, detailOptionId?: string): string {
  const budget = annualBalanceEffect(option);
  const principalImpact = principalIndicatorEffect(option);
  const isV10 = scenario.version >= 10;
  const budgetTiming = budget ? timingLabel(budget.timing) : "";
  const budgetLabel = isV10
    ? budgetProfileLabel(option)
    : budget
      ? `${formatV3Amount(budget.delta)} ${budget.duration === "once" ? "une seule fois" : "par an"}${budgetTiming ? ` · ${budgetTiming}` : ""}`
      : "Solde inchangé";
  const budgetValue = isV10 ? principalBudgetProfileValue(option) : budget?.delta ?? 0;
  const budgetSignal = budgetValue === 0 ? "neutral" : budgetValue > 0 ? "positive" : "negative";
  const maxBudget = Math.max(1, ...decision.options.map((candidate) => Math.abs(
    scenario.version >= 10 ? principalBudgetProfileValue(candidate) : annualBalanceEffect(candidate)?.delta ?? 0,
  )));
  const budgetWidth = Math.min(100, Math.round((Math.abs(budgetValue) / maxBudget) * 100));
  const impactLabel = principalImpact ? compactImpactLabel(principalImpact) : "Impact non chiffré";
  const impactDescription = principalImpact ? effectLabelWithTiming(principalImpact) : impactLabel;
  const displayCopy = option.displayCopy;
  const label = displayCopy?.shortLabel ?? compactOptionLabel(option.label);
  const summary = displayCopy?.outcome ?? option.summary;
  const detailsOpen = option.id === detailOptionId;
  const labelId = `v3-option-label-${option.id}`;
  const summaryId = `v3-option-summary-${option.id}`;
  const budgetId = `v3-option-budget-${option.id}`;
  const impactId = `v3-option-impact-${option.id}`;
  return `
    <article class="simulateur-v3__option" data-option-id="${escapeHtml(option.id)}">
      <button
        type="button"
        class="simulateur-v3__option-select"
        data-v3-action="select"
        data-decision-id="${escapeHtml(decision.id)}"
        data-option-id="${escapeHtml(option.id)}"
        aria-labelledby="${escapeHtml(labelId)}"
        aria-describedby="${escapeHtml(isV10 ? `${summaryId} ${budgetId}` : `${summaryId} ${budgetId} ${impactId}`)}"
      >
        <span class="simulateur-v3__option-copy">
          <span id="${escapeHtml(labelId)}" class="simulateur-v3__option-label" data-v3-fact="name">${escapeHtml(label)}</span>
          <span id="${escapeHtml(summaryId)}" class="simulateur-v3__option-summary" data-v3-fact="summary">${escapeHtml(summary)}</span>
        </span>
        <span class="simulateur-v3__option-signals">
          <strong id="${escapeHtml(budgetId)}" class="simulateur-v3__option-budget simulateur-v3__option-budget--${budgetSignal}" data-v3-fact="budget">${escapeHtml(budgetLabel)}</strong>
          ${isV10 ? "" : `<span id="${escapeHtml(impactId)}" class="simulateur-v3__option-impact-pill" data-v3-fact="impact" aria-label="${escapeHtml(impactDescription)}">${escapeHtml(impactLabel)}</span>`}
        </span>
        <span class="simulateur-v3__option-impact-track simulateur-v3__option-impact-track--${budgetSignal}" aria-hidden="true"><i style="width:${budgetWidth}%"></i></span>
      </button>
      ${displayCopy ? `<button type="button" class="simulateur-v3__option-details-trigger" data-v3-action="open-details" data-option-id="${escapeHtml(option.id)}" data-v3-detail-trigger="${escapeHtml(option.id)}" aria-expanded="${detailsOpen}" aria-haspopup="dialog"><span>Comprendre ce choix</span><span aria-hidden="true">›</span></button>` : ""}
    </article>`;
}

const DETAIL_SCOPE_BY_ESTIMATE: Readonly<Record<string, readonly string[]>> = {
  "benefits-backoffice-net": [
    "Le calcul porte sur la gestion des aides personnelles au logement, pas sur le montant versé aux ménages.",
    "Une demande commune évite de ressaisir les mêmes informations et mutualise l'instruction entre organismes.",
  ],
  "brown-tax-expenditures-net": [
    "Tarif réduit sur le gazole, le fioul lourd et le gaz utilisés pour l'agriculture et les travaux forestiers.",
    "Remboursement d'accise sur le gazole des poids lourds du transport routier de marchandises.",
    "Remboursement d'accise sur les carburants utilisés par les taxis.",
    "Tarif réduit sur le gazole du transport ferroviaire de personnes ou de marchandises.",
  ],
  "household-capital-tax-expenditures-net": [
    "Abattement de 10 % sur les pensions et retraites imposables.",
    "Exonération ou imposition réduite de certains produits de l'assurance-vie et des contrats de capitalisation.",
  ],
};

function estimateFor(option: DecisionOption) {
  const key = option.budgetProfile.estimateKey;
  if (!key) return undefined;
  return Object.values(BUDGET_ESTIMATES).find((estimate) => estimate.key === key);
}

function calculationLines(option: DecisionOption): string[] {
  const estimate = estimateFor(option);
  if (!estimate) return [];
  const lines = [
    `Montant de départ du calcul : ${formatV3Amount(Math.abs(estimate.baseAmountMillions)).replace(/^\+/, "")} (${estimate.baseYear}).`,
  ];
  if (estimate.grossActionMillions !== estimate.runRateMillions) {
    lines.push(`Gain ou coût avant corrections : ${formatV3Amount(estimate.grossActionMillions)}.`);
  }
  if (estimate.behavioralOffsetMillions > 0) {
    lines.push(`Réactions et changements de comportement déduits : ${formatV3Amount(-estimate.behavioralOffsetMillions)}.`);
  }
  if (estimate.recurringOperatingCostMillions > 0) {
    lines.push(`Coût annuel de fonctionnement déduit : ${formatV3Amount(-estimate.recurringOperatingCostMillions)}.`);
  }
  lines.push(`Résultat annuel retenu : ${formatV3Amount(estimate.runRateMillions)}.`);
  return lines;
}

function usefulPeople(option: DecisionOption): string[] {
  const ignored = new Set(["personnes concernées", "finances publiques"]);
  const entries = [
    ...option.beneficiaries.map((item) => `Bénéficient : ${item}.`),
    ...option.contributors.map((item) => `Contribuent ou s'adaptent : ${item}.`),
  ];
  return entries.filter((entry) => ![...ignored].some((item) => entry.includes(item)));
}

function renderOptionDetails(decision: Decision, option: DecisionOption): string {
  const details = option.displayCopy!.details;
  const estimateKey = option.budgetProfile.estimateKey;
  const sourceMechanism = /^(Conserver|Maintenir)\b/i.test(option.mechanism) ? undefined : option.mechanism;
  const measure = [details.howItWorks, details.whatChanges, sourceMechanism]
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  const affected = [...(details.whoPays ?? []), ...(details.whoGainsOrLoses ?? []), ...usefulPeople(option)];
  const calculation = calculationLines(option);
  const specifics = estimateKey ? DETAIL_SCOPE_BY_ESTIMATE[estimateKey] : undefined;
  const sources = decision.evidence.map((evidence) => evidence.sourceUrl
    ? `<a href="${escapeHtml(evidence.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(evidence.sourceName)}</a>`
    : escapeHtml(evidence.sourceName));
  const sections: Array<[string, string | readonly string[] | undefined, boolean?]> = [
    ["Aujourd'hui", decision.displayCopy?.context ?? decision.context],
    ["La mesure", specifics ?? measure],
    ["Personnes concernées", affected],
    ["Le calcul", calculation],
    ["À savoir", option.legalConstraints],
    ["Sources", sources, true],
  ];
  const content = sections.flatMap(([title, body, allowHtml = false]) => {
    if (!body || (Array.isArray(body) && body.length === 0)) return [];
    const text = typeof body === "string"
      ? `<p>${escapeHtml(body)}</p>`
      : `<ul>${body.map((item) => `<li>${allowHtml ? item : escapeHtml(item)}</li>`).join("")}</ul>`;
    return [`<section><h3>${title}</h3>${text}</section>`];
  }).join("");
  return content;
}

function renderDetailPanel(decision: Decision, option: DecisionOption): string {
  const copy = option.displayCopy;
  if (!copy) return "";
  return `<div class="simulateur-v3__detail-layer" data-v3-action="close-details">
    <aside class="simulateur-v3__detail-panel" data-v3-action="keep-details-open" data-v3-detail-panel="${escapeHtml(option.id)}" role="dialog" aria-modal="true" aria-labelledby="v3-detail-title-${escapeHtml(option.id)}" tabindex="-1">
      <header class="simulateur-v3__detail-panel-header">
        <p>Choix en détail</p>
        <button type="button" class="simulateur-v3__detail-close" data-v3-action="close-details" aria-label="Fermer les détails">×</button>
      </header>
      <div class="simulateur-v3__detail-panel-body">
        <div class="simulateur-v3__detail-title">
          <h2 id="v3-detail-title-${escapeHtml(option.id)}">${escapeHtml(copy.shortLabel)}</h2>
          <strong>${escapeHtml(budgetProfileLabel(option))}</strong>
        </div>
        ${renderOptionDetails(decision, option)}
      </div>
      <footer class="simulateur-v3__detail-actions">
        <button type="button" class="simulateur-v3__primary" data-v3-action="select" data-decision-id="${escapeHtml(decision.id)}" data-option-id="${escapeHtml(option.id)}">Choisir cette option</button>
      </footer>
    </aside>
  </div>`;
}

function renderEvidence(decision: Decision): string {
  const sources = decision.evidence.length === 0
    ? `<li class="simulateur-v3__source-unavailable" role="status">Aucune source n'est disponible pour ce dossier. Le mécanisme documenté reste consultable ci-dessus.</li>`
    : decision.evidence.map((evidence) => `
            <li>
              ${evidence.sourceUrl
                ? `<a href="${escapeHtml(evidence.sourceUrl)}">${escapeHtml(evidence.sourceName)}</a>`
                : `<span class="simulateur-v3__source-name">${escapeHtml(evidence.sourceName)}</span>`}
              <time datetime="${escapeHtml(evidence.publishedAt)}">${escapeHtml(evidence.publishedAt.slice(0, 4))}</time>
              ${evidence.sourceUrl ? "" : `<small role="status">Lien source indisponible.</small>`}
              ${evidence.note ? `<small>${escapeHtml(evidence.note)}</small>` : ""}
            </li>`).join("");
  return `
    <details class="simulateur-v3__evidence">
      <summary>Preuves, réserves et sources</summary>
      <div class="simulateur-v3__evidence-body">
        <section class="simulateur-v3__analysis">
          <h3>Le dossier</h3>
          <p>${escapeHtml(decision.context)}</p>
        </section>
        <section class="simulateur-v3__source-block">
          <h3>Sources</h3>
          <p>${escapeHtml(decision.evidence[0]?.label ?? "Les sources seront ajoutées dès qu'elles seront disponibles.")}</p>
          <ul class="simulateur-v3__sources">
            ${sources}
          </ul>
        </section>
      </div>
    </details>`;
}

function renderGameHud(state: CampaignState, scenario: Scenario): string {
  if (scenario.version < 11) return "";
  const gauges = [
    { key: "majority", label: "Pouvoir", value: state.indicators.majority },
    { key: "opinion", label: "Opinion", value: state.indicators.opinion },
    { key: "financialCredibility", label: "Marchés", value: state.indicators.financialCredibility },
  ];
  return `<section class="simulateur-v3__game-hud" aria-label="Jauges du mandat">
    ${gauges.map(({ key, label, value }) => {
      const level = Math.max(0, Math.min(100, Math.round(value)));
      const tone = level < 30 ? "critical" : level < 55 ? "fragile" : "stable";
      const delta = state.decisions.at(-1)?.impact?.indicators.find((impact) => impact.key === key)?.delta;
      const deltaMarkup = delta === undefined || delta === 0
        ? ""
        : `<small class="simulateur-v3__game-delta simulateur-v3__game-delta--${delta > 0 ? "positive" : "negative"}" aria-label="Variation ${delta > 0 ? "positive" : "negative"}">${delta > 0 ? "+" : ""}${delta}</small>`;
      return `<div class="simulateur-v3__game-gauge simulateur-v3__game-gauge--${tone}">
        <div class="simulateur-v3__game-gauge-head"><span>${escapeHtml(label)}</span><span class="simulateur-v3__game-gauge-value"><strong>${level}</strong>${deltaMarkup}</span></div>
        <span class="simulateur-v3__game-gauge-track" role="meter" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${level}"><i style="--v3-game-level: ${level}%"></i></span>
      </div>`;
    }).join("")}
  </section>`;
}

function renderDecision(state: CampaignState, scenario: Scenario, options: RenderSimulatorV3Options): string {
  const decision = currentDecision(state, scenario);
  if (!decision) return renderUnavailable("Ce dossier n'est plus disponible.");
  const detailOption = decision.options.find((option) => option.id === options.detailOptionId);
  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--decision">
      <div class="simulateur-v3__decision-layout">
        <article class="simulateur-v3__dossier simulateur-v3__decision simulateur-v3__decision--${decision.kind}">
          <header class="simulateur-v3__scene-header">
            <p class="simulateur-v3__eyebrow">Dossier ${globalPosition(state, scenario)}</p>
            <h1>${escapeHtml(decision.displayCopy?.question ?? decision.title)}</h1>
            <p class="simulateur-v3__context">${escapeHtml(decision.displayCopy?.context ?? compactText(decision.context))}</p>
          </header>
          <div class="simulateur-v3__scene-body">
            ${renderGameHud(state, scenario)}
            <fieldset class="simulateur-v3__options simulateur-v3__options--${decision.options.length}">
              <legend>Choix possibles</legend>
              ${decision.options.map((option) => renderOption(decision, option, scenario, options.detailOptionId)).join("")}
            </fieldset>
            ${scenario.version >= 10 ? "" : renderEvidence(decision)}
          </div>
        </article>
      </div>
      ${detailOption ? renderDetailPanel(decision, detailOption) : ""}
    </main>`;
}

function renderDecisionResult(state: CampaignState, scenario: Scenario): string {
  const record = state.decisions.at(-1);
  const decision = record
    ? scenario.decisions.find((candidate) => candidate.id === record.decisionId)
    : undefined;
  const option = decision?.options.find((candidate) => candidate.id === record?.optionId);
  if (!record || !decision || !option) return renderUnavailable("Le résultat de cette décision n'est plus disponible.");

  const impactUnavailable = record.impact === undefined;
  const changes = record.impact?.indicators.slice(0, 3) ?? [];
  const nextEvent = [...state.scheduledEvents]
    .filter((event) => event.sourceDecisionId === decision.id && event.sourceOptionId === option.id)
    .sort((left, right) => left.dueAtDecision - right.dueAtDecision)
    .at(0);
  const nextPromise = [...state.activePromises]
    .filter((promise) => promise.sourceDecisionId === decision.id && promise.sourceOptionId === option.id)
    .sort((left, right) => left.dueAtDecision - right.dueAtDecision)
    .at(0);
  const nextDueValues = [nextEvent?.dueAtDecision, nextPromise?.dueAtDecision]
    .filter((value): value is number => value !== undefined);
  nextDueValues.sort((left, right) => left - right);
  const nextDue = nextDueValues.at(0);

  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--result">
      <article class="simulateur-v3__dossier simulateur-v3__result" aria-live="polite">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Décision enregistrée</p>
          <h1>${escapeHtml(compactOptionLabel(option.label))}</h1>
          <p class="simulateur-v3__lead">${escapeHtml(decision.title)}</p>
        </header>
        <div class="simulateur-v3__scene-body">
          ${impactUnavailable
            ? `<p class="simulateur-v3__result-history-unavailable" role="status">Détail historique indisponible pour cette ancienne décision. Son mécanisme et son calendrier restent consultables.</p>`
            : changes.length > 0 ? `<dl class="simulateur-v3__result-metrics">${changes.map((change) => `
            <div>
              <dt>${escapeHtml(INDICATOR_META[change.key].label)}</dt>
              <dd>
                <span class="simulateur-v3__result-value"><small>Avant</small><span>${escapeHtml(formatIndicatorSnapshotValue(change.key, change.before))}</span></span>
                <span class="simulateur-v3__result-arrow" aria-hidden="true">→</span>
                <span class="simulateur-v3__result-value"><small>Après</small><span>${escapeHtml(formatIndicatorSnapshotValue(change.key, change.after))}</span></span>
                <strong>${escapeHtml(effectLabel({ target: "indicator", key: change.key, delta: change.delta }))}</strong>
              </dd>
            </div>`).join("")}</dl>` : `<p class="simulateur-v3__result-no-metric">Aucun indicateur ne change immédiatement. Les effets arrivent selon le calendrier annoncé.</p>`}
          <section class="simulateur-v3__result-cause" aria-label="Chaîne causale">
            <h2>Ce qui change</h2>
            <p>${escapeHtml(option.mechanism)}</p>
            <dl>
              <div><dt>Horizon</dt><dd>${escapeHtml(horizonLabel(option.horizon))}</dd></div>
              ${nextDue === undefined ? "" : `<div><dt>Prochaine échéance</dt><dd>Dossier ${nextDue} sur ${totalDecisions(scenario)}</dd></div>`}
            </dl>
          </section>
        </div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__primary" data-v3-action="continue">Dossier suivant</button></footer>
      </article>
    </main>`;
}

function renderJournalImpact(record: CampaignState["decisions"][number]): string {
  if (!record.impact) {
    return `<p class="simulateur-v3__journal-history-unavailable">Détail historique immédiat indisponible.</p>`;
  }
  if (record.impact.indicators.length === 0) {
    return `<p class="simulateur-v3__journal-no-immediate">Aucun indicateur modifié immédiatement.</p>`;
  }
  return `<dl class="simulateur-v3__journal-impact">${record.impact.indicators.map((impact) => `
    <div>
      <dt>${escapeHtml(INDICATOR_META[impact.key].label)}</dt>
      <dd><span>Avant ${escapeHtml(formatIndicatorSnapshotValue(impact.key, impact.before))}</span><span>Après ${escapeHtml(formatIndicatorSnapshotValue(impact.key, impact.after))}</span><strong>${escapeHtml(effectLabel({ target: "indicator", key: impact.key, delta: impact.delta }))}</strong></dd>
    </div>`).join("")}</dl>`;
}

function journalCauseSource(
  state: CampaignState,
  cause: CausalEntry,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): { kind: string; title: string; dueAtDecision?: number } {
  if (cause.sourceType === "event") {
    const event = [...state.eventHistory, ...state.scheduledEvents].find((candidate) => candidate.id === cause.sourceId);
    return { kind: "Effet différé", title: event?.title ?? "Événement du mandat", dueAtDecision: event?.dueAtDecision };
  }
  if (cause.sourceType === "promise") {
    const promise = [...state.promiseHistory, ...state.activePromises].find((candidate) => candidate.id === cause.sourceId);
    return { kind: "Promesse arrivée à échéance", title: promise?.label ?? "Promesse du mandat", dueAtDecision: promise?.dueAtDecision };
  }
  if (cause.sourceType === "crisis") {
    const rule = crisisRules.find((candidate) => candidate.id === cause.sourceId);
    return { kind: "Effet de crise", title: rule?.title ?? cause.sourceId };
  }
  const sourceDecisionId = sourceDecisionIdsForCause(state, cause).at(0);
  const decision = scenario.decisions.find((candidate) => candidate.id === sourceDecisionId);
  return { kind: "Effet immédiat", title: decision?.title ?? "Décision du mandat" };
}

function renderJournalCause(
  state: CampaignState,
  cause: CausalEntry,
  decisionTitle: string,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): string {
  const source = journalCauseSource(state, cause, scenario, crisisRules);
  const due = source.dueAtDecision === undefined ? "" : ` · échéance dossier ${source.dueAtDecision}`;
  return `<li>
    <strong>${escapeHtml(effectLabel(cause))}</strong>
    <span>${escapeHtml(source.kind)} : ${escapeHtml(source.title)}</span>
    <small>Décision source : ${escapeHtml(decisionTitle)}${escapeHtml(due)} · appliqué au dossier ${cause.appliedAtDecision}</small>
    <p>${escapeHtml(cause.explanation)}</p>
  </li>`;
}

function renderJournal(
  state: CampaignState,
  scenario: Scenario,
  crisisRules: readonly CrisisRule[],
): string {
  const statuses: Record<string, string> = {
    confirmed: "En vigueur",
    suspended: "Suspendue après une crise",
    amended: "Amendée après une crise",
    reversed: "Renversée après une crise",
    superseded: "Sans objet après un arbitrage précédent",
  };
  const groups = groupJournal(state.decisions, scenario);
  const journalBody = groups.length === 0
    ? `<section class="simulateur-v3__empty-state"><h2>Aucune décision enregistrée</h2><p>Le journal se remplira après votre premier arbitrage.</p><button type="button" class="simulateur-v3__secondary" data-v3-action="resume">Revenir au dossier en cours</button></section>`
    : `<div class="simulateur-v3__journal-groups">${groups.map((group) => {
      const activeCauseIds = new Set(group.records
        .filter((record) => record.status === "confirmed" || record.status === "amended")
        .flatMap((record) => state.causalLedger.filter((entry) => (
          entry.duration !== "once" && sourceDecisionIdsForCause(state, entry).includes(record.decisionId)
        )))
        .map((entry) => entry.id));
      const latest = group.records.at(-1);
      const latestImpact = latest?.impact?.indicators.at(0);
      const latestResult = latestImpact
        ? `${INDICATOR_META[latestImpact.key].label} : ${formatIndicatorSnapshotValue(latestImpact.key, latestImpact.before)} → ${formatIndicatorSnapshotValue(latestImpact.key, latestImpact.after)}`
        : `Dernier arbitrage : ${statuses[latest?.status ?? ""] ?? "détail historique indisponible"}`;
      const yearLabel = group.mandateYear === null ? "année non disponible" : `année ${group.mandateYear}`;
      return `<details class="simulateur-v3__journal-group">
        <summary>
          <span>${escapeHtml(group.chapterTitle)} · ${escapeHtml(yearLabel)}</span>
          <strong>${group.records.length} ${group.records.length === 1 ? "décision" : "décisions"}</strong>
          <small>${activeCauseIds.size} ${activeCauseIds.size === 1 ? "effet encore actif" : "effets encore actifs"} · ${escapeHtml(latestResult)}</small>
        </summary>
        <ol>${group.records.map((record) => {
          const decision = scenario.decisions.find((candidate) => candidate.id === record.decisionId);
          const option = decision?.options.find((candidate) => candidate.id === record.optionId);
          const decisionTitle = decision?.title ?? record.decisionId;
          const immediateIds = new Set(record.impact?.indicators.flatMap((impact) => impact.causalEntryIds) ?? []);
          const laterCauses = state.causalLedger.filter((entry) => (
            sourceDecisionIdsForCause(state, entry).includes(record.decisionId) && !immediateIds.has(entry.id)
          ));
          const crisis = record.changedByCrisisId
            ? crisisRules.find((candidate) => candidate.id === record.changedByCrisisId)
            : undefined;
          return `<li><details class="simulateur-v3__journal-decision">
            <summary><span>${escapeHtml(compactOptionLabel(option?.label ?? record.optionId))}</span><strong>${escapeHtml(statuses[record.status] ?? record.status)}</strong></summary>
            <div>
              <p>${escapeHtml(decisionTitle)}</p>
              <p><strong>Statut :</strong> ${escapeHtml(statuses[record.status] ?? record.status)}${crisis ? ` · modifiée par ${escapeHtml(crisis.title)}` : ""}</p>
              ${option ? `<p><strong>Horizon :</strong> ${escapeHtml(horizonLabel(option.horizon))}</p>` : ""}
              <section class="simulateur-v3__journal-immediate" aria-label="Effets immédiats"><h3>Au moment de la décision</h3>${renderJournalImpact(record)}</section>
              <section class="simulateur-v3__journal-later" aria-label="Conséquences ultérieures"><h3>Conséquences ultérieures</h3>${laterCauses.length > 0 ? `<ul>${laterCauses.map((cause) => renderJournalCause(state, cause, decisionTitle, scenario, crisisRules)).join("")}</ul>` : `<p>Aucune conséquence ultérieure appliquée à ce stade.</p>`}</section>
            </div>
          </details></li>`;
        }).join("")}</ol>
      </details>`;
    }).join("")}</div>`;
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__journal">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Mémoire de la campagne</p>
          <h1>Journal du mandat</h1>
          <p class="simulateur-v3__lead">Vos arbitrages, leur statut et les concessions arrachées pendant le mandat.</p>
        </header>
        <div class="simulateur-v3__scene-body">${journalBody}</div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__secondary" data-v3-action="back-pause">Revenir à Pause</button></footer>
      </article>
    </main>`;
}

function renderPause(
  state: CampaignState,
  scenario: Scenario,
  view: RenderSimulatorV3Options["pauseView"],
  crisisRules: readonly CrisisRule[],
): string {
  if (view === "journal") return renderJournal(state, scenario, crisisRules);
  if (view === "restart") {
    return `
      <main class="simulateur-v3__stage">
        <article class="simulateur-v3__dossier simulateur-v3__pause-menu">
          <header class="simulateur-v3__scene-header">
            <p class="simulateur-v3__eyebrow">Recommencer</p>
            <h1>Effacer ce mandat et repartir de zéro ?</h1>
            <p class="simulateur-v3__lead">Vos décisions V3 seront remplacées. Une éventuelle partie V2 restera intacte.</p>
          </header>
          <div class="simulateur-v3__scene-actions simulateur-v3__pause-actions">
            <button type="button" class="simulateur-v3__danger" data-v3-action="restart">Oui, recommencer</button>
            <button type="button" class="simulateur-v3__secondary" data-v3-action="back-pause">Conserver ce mandat</button>
          </div>
        </article>
      </main>`;
  }
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__pause-menu">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Mandat suspendu</p>
          <h1>Le Conseil vous attend.</h1>
          <p class="simulateur-v3__lead">Reprenez le dossier en cours ou consultez la trace de vos décisions.</p>
        </header>
        <div class="simulateur-v3__scene-actions simulateur-v3__pause-actions">
          <button type="button" class="simulateur-v3__primary" data-v3-action="resume">Reprendre</button>
          <button type="button" class="simulateur-v3__secondary" data-v3-action="journal">Ouvrir le journal</button>
          <button type="button" class="simulateur-v3__secondary" data-v3-action="ask-restart">Recommencer la campagne</button>
          <a class="simulateur-v3__secondary" href="/bilan">Quitter vers France</a>
        </div>
      </article>
    </main>`;
}

function recentCauses(state: CampaignState): CausalEntry[] {
  const floor = Math.max(0, state.decisions.length - 4);
  return state.causalLedger.filter((entry) => entry.appliedAtDecision > floor).slice(-5).reverse();
}

function sourceDecisionIdsForCause(state: CampaignState, cause: CausalEntry): string[] {
  if (cause.sourceType === "decision") {
    const record = state.decisions.find((candidate) => (
      cause.sourceId === `${candidate.decisionId}:${candidate.optionId}`
    ));
    return [record?.decisionId ?? cause.sourceId.split(":")[0]!];
  }
  if (cause.sourceType === "event") {
    const decisionId = [...state.eventHistory, ...state.scheduledEvents]
      .find((event) => event.id === cause.sourceId)?.sourceDecisionId;
    return decisionId ? [decisionId] : [];
  }
  if (cause.sourceType === "promise") {
    const decisionId = [...state.promiseHistory, ...state.activePromises]
      .find((promise) => promise.id === cause.sourceId)?.sourceDecisionId;
    return decisionId ? [decisionId] : [];
  }
  const crisis = [...state.crisisHistory, ...(state.activeCrisis ? [state.activeCrisis] : [])]
    .find((candidate) => candidate.ruleId === cause.sourceId);
  if (!crisis) return [];
  const exactDecisionIds = crisis.aggravatingChoices?.map((choice) => choice.decisionId) ?? [];
  return exactDecisionIds.length > 0 ? [...new Set(exactDecisionIds)] : [crisis.triggeredByDecisionId];
}

function sourceDecisionIdForCause(state: CampaignState, cause: CausalEntry): string | undefined {
  return sourceDecisionIdsForCause(state, cause).at(0);
}

function renderCouncil(state: CampaignState, scenario: Scenario): string {
  const causes = recentCauses(state);
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__council">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Point de situation</p>
          <h1>Le pays réagit à vos arbitrages.</h1>
          <p class="simulateur-v3__lead">${state.decisions.length} décisions ont déplacé les comptes et votre capacité d'agir.</p>
        </header>
        <div class="simulateur-v3__scene-body">${renderMandateDashboard(state)}
        ${causes.length ? `<section class="simulateur-v3__causes"><h2>Ce qui vient de peser</h2><ul>${causes.map((cause) => {
          const decisionId = sourceDecisionIdForCause(state, cause);
          const title = scenario.decisions.find((decision) => decision.id === decisionId)?.title;
          return `<li><strong>${escapeHtml(effectLabel(cause))}</strong><span>${escapeHtml(title ?? "Événement du mandat")}</span><small>${escapeHtml(cause.explanation)}</small></li>`;
        }).join("")}</ul></section>` : ""}</div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__primary" data-v3-action="continue">Retourner aux dossiers</button></footer>
      </article>
    </main>`;
}

type DueConsequenceGroup = {
  key: string;
  sourceDecisionId: string;
  sourceOptionId: string;
  dueAtDecision: number;
  events: ScheduledEvent[];
  promises: PoliticalPromise[];
};

function groupDueConsequences(state: CampaignState): DueConsequenceGroup[] {
  const events = state.scheduledEvents.filter((event) => event.dueAtDecision <= state.decisions.length);
  const promises = state.activePromises.filter((promise) => promise.dueAtDecision <= state.decisions.length);
  const groups = new Map<string, DueConsequenceGroup>();
  const getGroup = (sourceDecisionId: string, sourceOptionId: string, dueAtDecision: number) => {
    const key = `${sourceDecisionId}:${sourceOptionId}:${dueAtDecision}`;
    const existing = groups.get(key);
    if (existing) return existing;
    const created = { key, sourceDecisionId, sourceOptionId, dueAtDecision, events: [], promises: [] };
    groups.set(key, created);
    return created;
  };
  for (const event of events) getGroup(event.sourceDecisionId, event.sourceOptionId, event.dueAtDecision).events.push(event);
  for (const promise of promises) getGroup(promise.sourceDecisionId, promise.sourceOptionId, promise.dueAtDecision).promises.push(promise);
  return [...groups.values()].sort((left, right) =>
    left.dueAtDecision - right.dueAtDecision
    || left.sourceDecisionId.localeCompare(right.sourceDecisionId, "fr")
    || left.sourceOptionId.localeCompare(right.sourceOptionId, "fr"));
}

function renderDueConsequenceGroup(group: DueConsequenceGroup, scenario: Scenario, visible: boolean): string {
  const decision = scenario.decisions.find((candidate) => candidate.id === group.sourceDecisionId);
  const option = decision?.options.find((candidate) => candidate.id === group.sourceOptionId);
  const consequences = [
    ...group.events.flatMap((event) => event.effects.length > 0
      ? event.effects.map((effect) => ({ title: event.title, body: event.body, effect: effectLabel(effect) }))
      : [{ title: event.title, body: event.body, effect: "" }]),
    ...group.promises.flatMap((promise) => {
      if (promise.fulfilled) return [{ title: promise.label, body: "Promesse tenue.", effect: "" }];
      return promise.failureEffects.length > 0
        ? promise.failureEffects.map((effect) => ({
          title: promise.label,
          body: "Promesse non tenue. Le coût politique arrive à échéance.",
          effect: effectLabel(effect),
        }))
        : [{ title: promise.label, body: "Promesse non tenue.", effect: "" }];
    }),
  ];
  const direct = consequences.slice(0, 2);
  const remaining = consequences.slice(2);
  const renderConsequence = (consequence: (typeof consequences)[number]) => `<li>
    <strong>${escapeHtml(consequence.title)}</strong>
    <span>${escapeHtml(consequence.body)}</span>
    ${consequence.effect ? `<small>${escapeHtml(consequence.effect)}</small>` : ""}
  </li>`;
  return `<section class="simulateur-v3__event-group" data-v3-event-group="${escapeHtml(group.key)}" data-v3-event-group-visible="${visible}">
    <header>
      <h2>${escapeHtml(decision?.title ?? group.sourceDecisionId)}</h2>
      <p><strong>Option d'origine</strong>${escapeHtml(option ? compactOptionLabel(option.label) : group.sourceOptionId)} · échéance dossier ${group.dueAtDecision}</p>
    </header>
    <ul>${direct.map(renderConsequence).join("")}</ul>
    ${remaining.length > 0 ? `<details><summary>Voir ${remaining.length} ${remaining.length === 1 ? "autre effet" : "autres effets"}</summary><ul>${remaining.map(renderConsequence).join("")}</ul></details>` : ""}
  </section>`;
}

function renderDelayedEvent(state: CampaignState, scenario: Scenario): string {
  const groups = groupDueConsequences(state);
  const visibleGroups = groups.slice(0, 4);
  const overflowGroups = groups.slice(4);
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__event">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Conséquence différée</p>
          <h1>Les effets annoncés arrivent à échéance.</h1>
          <p class="simulateur-v3__lead">Chaque conséquence reste reliée au choix qui l'a produite.</p>
        </header>
        <div class="simulateur-v3__scene-body">
          <div class="simulateur-v3__event-groups">${visibleGroups.map((group) => renderDueConsequenceGroup(group, scenario, true)).join("")}</div>
          ${overflowGroups.length > 0 ? `<details class="simulateur-v3__event-overflow"><summary>Voir ${overflowGroups.length} autres conséquences</summary>${overflowGroups.map((group) => renderDueConsequenceGroup(group, scenario, false)).join("")}</details>` : ""}
        </div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__primary" data-v3-action="continue">Assumer la suite</button></footer>
      </article>
    </main>`;
}

function selectedCrisisOption(state: CampaignState, scenario: Scenario, decisionId: string): DecisionOption | undefined {
  const record = state.decisions.find((candidate) => candidate.decisionId === decisionId);
  return scenario.decisions.find((decision) => decision.id === decisionId)
    ?.options.find((option) => option.id === record?.optionId);
}

function crisisBudget(value: number, prefix = ""): string {
  const label = value === 0 ? "Solde public inchangé" : `${formatV3Amount(value)} par an`;
  const signal = value === 0 ? "neutral" : value > 0 ? "positive" : "negative";
  return `<strong class="simulateur-v3__crisis-budget simulateur-v3__crisis-budget--${signal}">${escapeHtml(prefix)}${escapeHtml(label)}</strong>`;
}

function optionAnnualBalance(option: DecisionOption, scenario: Scenario): number {
  return scenario.version >= 10
    ? option.budgetProfile.runRateMillions
    : annualBalanceEffect(option)?.delta ?? 0;
}

function preservedCrisisBalance(state: CampaignState, scenario: Scenario): number {
  return state.activeCrisis?.aggravatingChoices.reduce((sum, choice) => {
    const option = selectedCrisisOption(state, scenario, choice.decisionId);
    return sum + (option ? optionAnnualBalance(option, scenario) : 0);
  }, 0) ?? 0;
}

function concessionBalance(state: CampaignState, scenario: Scenario, concession: ReturnType<typeof availableConcessions>[number]): number {
  const explicit = concession.effects
    .filter((effect) => effect.target === "indicator" && effect.key === "annualBalance")
    .reduce((sum, effect) => sum + effect.delta, 0);
  if (concession.policyChange !== "reverse") return explicit;
  const option = selectedCrisisOption(state, scenario, concession.targetDecisionId);
  return explicit - (option ? optionAnnualBalance(option, scenario) : 0);
}

function firstPoliticalExplanation(effects: readonly EffectRule[], fallback: string): string {
  return effects.find((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"))?.explanation
    ?? effects[0]?.explanation
    ?? fallback;
}

function renderCrisis(state: CampaignState, scenario: Scenario, rules: readonly CrisisRule[]): string {
  const rule = rules.find((candidate) => candidate.id === state.activeCrisis?.ruleId);
  if (!rule || !state.activeCrisis) return renderUnavailable("Cette crise n'est plus disponible.");
  // Une crise reste un arbitrage binaire à l'écran : tenir ou céder sur le
  // premier compromis encore applicable. Les règles peuvent conserver des
  // concessions de repli pour d'autres combinaisons de décisions, sans
  // transformer la scène compacte en troisième catalogue d'options.
  const concessions = availableConcessions(state, rules).slice(0, 1);
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__crisis">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Conseil de crise</p>
          <h1>${escapeHtml(rule.title)}</h1>
        </header>
        <div class="simulateur-v3__scene-body">
          ${renderGameHud(state, scenario)}
          <p class="simulateur-v3__crisis-cause"><strong>Pourquoi maintenant ?</strong>${escapeHtml(rule.body)}</p>
          <p class="simulateur-v3__crisis-prompt">Décidez</p>
          <div class="simulateur-v3__crisis-options">
          <button type="button" class="simulateur-v3__crisis-option" data-v3-action="resolve-crisis" data-resolution-id="hold-course">
            <span class="simulateur-v3__crisis-option-head"><small class="simulateur-v3__crisis-option-kicker">Tenir</small><b>Maintenir les réformes</b>${crisisBudget(preservedCrisisBalance(state, scenario), "Mesures conservées : ")}</span>
            <span class="simulateur-v3__crisis-impact"><small><strong>Maintenant :</strong> ${escapeHtml(firstPoliticalExplanation(rule.holdCourseEffects, "La contestation continue."))}</small><small><strong>Décision :</strong> les mesures contestées restent en vigueur.</small></span>
          </button>
          ${concessions.map((concession) => `<button type="button" class="simulateur-v3__crisis-option simulateur-v3__crisis-option--concession" data-v3-action="resolve-crisis" data-resolution-id="${escapeHtml(concession.id)}">
            <span class="simulateur-v3__crisis-option-head"><small class="simulateur-v3__crisis-option-kicker">Céder</small><b>${escapeHtml(concession.label)}</b>${crisisBudget(concessionBalance(state, scenario, concession))}</span>
            <span class="simulateur-v3__crisis-impact"><small><strong>Maintenant :</strong> ${escapeHtml(firstPoliticalExplanation(concession.effects, "Le compromis réduit la tension."))}</small><small><strong>Ce que vous cédez :</strong> ${escapeHtml(selectedCrisisOption(state, scenario, concession.targetDecisionId)?.displayCopy?.shortLabel ?? selectedCrisisOption(state, scenario, concession.targetDecisionId)?.label ?? "la mesure contestée")}.</small></span>
          </button>`).join("")}
          </div>
        </div>
      </article>
    </main>`;
}

function formatVerdictSignal(signal: VerdictSignal): string {
  if (signal.key === "growth") {
    return `${signal.value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  }
  return `${Math.round(signal.value)} / 100`;
}

function renderVerdictSignal(signal: VerdictSignal): string {
  const level = signal.key === "growth"
    ? Math.max(0, Math.min(100, Math.round(((signal.value + 1) / 4) * 100)))
    : Math.max(0, Math.min(100, Math.round(signal.value)));
  return `<li class="simulateur-v3__verdict-signal simulateur-v3__verdict-signal--${signal.key}">
    <span class="simulateur-v3__verdict-signal-label">${escapeHtml(signal.label)}</span>
    <strong>${escapeHtml(formatVerdictSignal(signal))}</strong>
    <span class="simulateur-v3__verdict-signal-track" aria-hidden="true"><i style="--v3-verdict-level: ${level}%"></i></span>
  </li>`;
}

function formatStructuralEffect(choice: VerdictChoice): string {
  const effect = choice.structuralEffect;
  if (!effect) return "Aucun second effet chiffré";
  return effectLabel(effect);
}

function renderVerdictChoice(choice: VerdictChoice): string {
  return `<li class="simulateur-v3__verdict-choice">
    <div class="simulateur-v3__verdict-choice-copy">
      <h3>${escapeHtml(choice.label)}</h3>
      <strong>${choice.budgetDelta === 0 ? "Solde inchangé" : `${escapeHtml(formatV3Amount(choice.budgetDelta))}${choice.budgetDuration === "once" ? " une fois" : " par an"}`}</strong>
    </div>
  </li>`;
}

function renderVerdictChoiceConsequence(choice: VerdictChoice): string {
  return `<li class="simulateur-v3__verdict-aftermath-item simulateur-v3__verdict-aftermath-item--choice">
    <span>Effet</span>
    <div><h3>${escapeHtml(choice.label)}</h3><p>${escapeHtml(formatStructuralEffect(choice))}</p></div>
  </li>`;
}

function renderVerdictAftermath(item: VerdictAftermath): string {
  return `<li class="simulateur-v3__verdict-aftermath-item simulateur-v3__verdict-aftermath-item--${item.kind}">
    <span>${item.kind === "crisis" ? "Crise" : escapeHtml(item.status ?? "Réforme modifiée")}</span>
    <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p></div>
  </li>`;
}

function roundedBillions(value: number): string {
  return Math.round(value / 1_000).toLocaleString("fr-FR");
}

function renderVerdict(view: MandateVerdictViewModel, options: RenderSimulatorV3Options): string {
  const scorePercent = view.target > 0
    ? Math.max(0, Math.min(100, Math.round((view.score / view.target) * 100)))
    : 100;
  const bestScore = options.bestScore ?? view.score;
  const recordImprovement = options.recordImprovement ?? 0;
  const record = recordImprovement > 0
    ? `Nouveau record personnel : +${roundedBillions(recordImprovement)} Md€`
    : `Record personnel : ${roundedBillions(bestScore)} Md€`;
  const consequenceItems = [
    ...view.aftermath.slice(0, 3).map(renderVerdictAftermath),
    ...view.decisiveChoices
      .filter((choice) => choice.structuralEffect)
      .slice(0, Math.max(0, 3 - view.aftermath.length))
      .map(renderVerdictChoiceConsequence),
  ];
  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--verdict">
      <article class="simulateur-v3__verdict">
        <header class="simulateur-v3__verdict-hero">
          <p class="simulateur-v3__eyebrow">Résultat du mandat</p>
          <h1 class="simulateur-v3__verdict-score"><strong>${roundedBillions(view.score)}</strong><span>/ ${roundedBillions(view.target)} Md€</span></h1>
          <div class="simulateur-v3__verdict-progress-bar" role="progressbar" aria-label="Déficit résorbé" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${scorePercent}"><i style="--v3-score: ${scorePercent}%"></i></div>
          <div class="simulateur-v3__verdict-remaining">
            <span><strong>${roundedBillions(view.remaining)} Md€</strong> restent à financer</span>
            ${view.surplus > 0 ? `<span><strong>${roundedBillions(view.surplus)} Md€</strong> d'excédent</span>` : ""}
          </div>
          <p class="simulateur-v3__verdict-record">${escapeHtml(record)}</p>
        </header>

        <section class="simulateur-v3__verdict-section simulateur-v3__verdict-signals" aria-labelledby="v3-verdict-signals-title">
          <h2 id="v3-verdict-signals-title">Indicateurs</h2>
          <ul>${view.signals.map(renderVerdictSignal).join("")}</ul>
        </section>

        ${consequenceItems.length ? `<section class="simulateur-v3__verdict-section simulateur-v3__verdict-aftermath" aria-labelledby="v3-aftermath-title">
          <h2 id="v3-aftermath-title">Conséquences</h2>
          <ul>${consequenceItems.join("")}</ul>
        </section>` : ""}

        <section class="simulateur-v3__verdict-section simulateur-v3__verdict-choices" aria-labelledby="v3-choices-title">
          <h2 id="v3-choices-title">Choix décisifs</h2>
          <ol>${view.decisiveChoices.map(renderVerdictChoice).join("")}</ol>
        </section>

        <footer class="simulateur-v3__verdict-actions">
          <button type="button" class="simulateur-v3__primary" data-v3-action="restart">Recommencer</button>
          <button type="button" class="simulateur-v3__secondary" data-v3-action="share-verdict">Défier un proche</button>
          <a class="simulateur-v3__verdict-france" href="/bilan">France</a>
          <p class="simulateur-v3__verdict-share-status" aria-live="polite"></p>
        </footer>
      </article>
    </main>`;
}

function renderUnavailable(message: string): string {
  return `<main class="simulateur-v3__stage"><p class="simulateur-v3__error" role="alert">${escapeHtml(message)}</p></main>`;
}

export function renderSimulatorV3(
  state: CampaignState,
  scenario: Scenario,
  options: RenderSimulatorV3Options = {},
): string {
  let content: string;
  switch (state.phase) {
    case "intro":
      content = renderIntro(state, options);
      break;
    case "chapter_intro":
      content = renderChapterIntro(state, scenario);
      break;
    case "decision":
      content = renderDecision(state, scenario, options);
      break;
    case "decision_result":
      content = renderDecisionResult(state, scenario);
      break;
    case "pause":
      content = renderPause(state, scenario, options.pauseView ?? "menu", options.crisisRules ?? []);
      break;
    case "council":
      content = renderCouncil(state, scenario);
      break;
    case "delayed_event":
      content = renderDelayedEvent(state, scenario);
      break;
    case "crisis":
      content = renderCrisis(state, scenario, options.crisisRules ?? []);
      break;
    case "verdict":
      content = renderVerdict(buildMandateVerdictViewModel(state, scenario, options.crisisRules ?? []), options);
      break;
    default:
      content = renderUnavailable("Cet écran du mandat n'est pas disponible.");
  }
  const accessibleContent = content.replace("<h1>", '<h1 tabindex="-1">');
  const saveWarning = options.saveFailed
    ? `<p class="simulateur-v3__save-error" role="status">La sauvegarde locale est indisponible. La partie continue dans cet onglet.</p>`
    : "";
  const commandBar = state.phase === "intro" ? "" : renderCommandBar(state, scenario, options.canUndo);
  return `<section class="simulateur-v3 simulateur-v3--${state.phase}" data-v3-phase="${state.phase}">${commandBar}${saveWarning}${accessibleContent}</section>`;
}
