import { currentDecision } from "./campaign.ts";
import { availableConcessions } from "./crises.ts";
import { INDICATOR_META } from "./indicator-meta.ts";
import { groupJournal } from "./presentation.ts";
import { totalDecisions } from "./validation.ts";
import { buildMandateVerdictViewModel } from "./verdict.ts";
import type {
  MandateVerdictViewModel,
  VerdictAftermath,
  VerdictChoice,
  VerdictCheckpoint,
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
  const before = scenario.chapters
    .slice(0, state.chapterIndex)
    .reduce((sum, chapter) => sum + chapter.decisionIds.length, 0);
  return Math.min(totalDecisions(scenario), before + state.decisionIndex + 1);
}

function renderCommandBar(state: CampaignState, scenario: Scenario): string {
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
    : `<p class="simulateur-v3__chapter-progress">Chapitre ${state.chapterIndex + 1} sur ${scenario.chapters.length}</p>
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
          <p class="simulateur-v3__lead">La France emprunte cette somme cette année. Vous avez cinq ans pour réduire le déficit, préserver l'activité et conserver la capacité d'agir.</p>
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
  return `
    <svg class="simulateur-v3__sparkline" aria-hidden="true" viewBox="0 0 80 38" preserveAspectRatio="none">
      <polyline points="${points}"></polyline>
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

function renderOption(decision: Decision, option: DecisionOption): string {
  const budget = annualBalanceEffect(option);
  const principalImpact = principalIndicatorEffect(option);
  const budgetTiming = budget ? timingLabel(budget.timing) : "";
  const budgetLabel = budget
    ? `${formatV3Amount(budget.delta)} ${budget.duration === "once" ? "une seule fois" : "par an"}${budgetTiming ? ` · ${budgetTiming}` : ""}`
    : "Solde inchangé";
  const budgetSignal = !budget || budget.delta === 0 ? "neutral" : budget.delta > 0 ? "positive" : "negative";
  const impactLabel = principalImpact ? compactImpactLabel(principalImpact) : "Impact non chiffré";
  const impactDescription = principalImpact ? effectLabelWithTiming(principalImpact) : impactLabel;
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
        aria-describedby="${escapeHtml(`${summaryId} ${budgetId} ${impactId}`)}"
      >
        <span class="simulateur-v3__option-copy">
          <span id="${escapeHtml(labelId)}" class="simulateur-v3__option-label" data-v3-fact="name">${escapeHtml(compactOptionLabel(option.label))}</span>
          <span id="${escapeHtml(summaryId)}" class="simulateur-v3__option-summary" data-v3-fact="summary">${escapeHtml(option.summary)}</span>
        </span>
        <span class="simulateur-v3__option-signals">
          <strong id="${escapeHtml(budgetId)}" class="simulateur-v3__option-budget simulateur-v3__option-budget--${budgetSignal}" data-v3-fact="budget">${escapeHtml(budgetLabel)}</strong>
          <span id="${escapeHtml(impactId)}" class="simulateur-v3__option-impact-pill" data-v3-fact="impact" aria-label="${escapeHtml(impactDescription)}">${escapeHtml(impactLabel)}</span>
        </span>
      </button>
    </article>`;
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

function renderDecision(state: CampaignState, scenario: Scenario): string {
  const decision = currentDecision(state, scenario);
  if (!decision) return renderUnavailable("Ce dossier n'est plus disponible.");
  const chapter = scenario.chapters[state.chapterIndex]!;
  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--decision">
      <div class="simulateur-v3__decision-layout">
        <article class="simulateur-v3__dossier simulateur-v3__decision simulateur-v3__decision--${decision.kind}">
          <header class="simulateur-v3__scene-header">
            <p class="simulateur-v3__eyebrow">${escapeHtml(chapter.title)} · Dossier ${globalPosition(state, scenario)}</p>
            <h1>${escapeHtml(decision.title)}</h1>
            <p class="simulateur-v3__context">${escapeHtml(compactText(decision.context))}</p>
          </header>
          <div class="simulateur-v3__scene-body">
            <fieldset class="simulateur-v3__options simulateur-v3__options--${decision.options.length}">
              <legend>Choix possibles</legend>
              ${decision.options.map((option) => renderOption(decision, option)).join("")}
            </fieldset>
            ${renderEvidence(decision)}
          </div>
        </article>
      </div>
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

function renderCrisis(state: CampaignState, scenario: Scenario, rules: readonly CrisisRule[]): string {
  const rule = rules.find((candidate) => candidate.id === state.activeCrisis?.ruleId);
  if (!rule || !state.activeCrisis) return renderUnavailable("Cette crise n'est plus disponible.");
  const trigger = scenario.decisions.find((decision) => decision.id === state.activeCrisis?.triggeredByDecisionId);
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
          <p class="simulateur-v3__lead">${escapeHtml(rule.body)}</p>
        </header>
        <div class="simulateur-v3__scene-body">
          <p class="simulateur-v3__crisis-cause"><strong>Décision déclencheuse</strong>${escapeHtml(trigger?.title ?? state.activeCrisis.triggeredByDecisionId)}</p>
          <div class="simulateur-v3__crisis-options">
          <button type="button" class="simulateur-v3__crisis-option" data-v3-action="resolve-crisis" data-resolution-id="hold-course">
            <span>Maintenir le cap</span><small>La réforme reste en vigueur.</small>
            <em>${rule.holdCourseEffects.map(effectLabel).map(escapeHtml).join(" · ")}</em>
          </button>
          ${concessions.map((concession) => `<button type="button" class="simulateur-v3__crisis-option simulateur-v3__crisis-option--concession" data-v3-action="resolve-crisis" data-resolution-id="${escapeHtml(concession.id)}">
            <span>${escapeHtml(concession.label)}</span><small>${concession.policyChange === "suspend" ? "La réforme sera suspendue." : concession.policyChange === "amend" ? "La réforme sera amendée." : "La réforme sera renversée."}</small>
            <em>${concession.effects.map(effectLabel).map(escapeHtml).join(" · ")}</em>
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

function formatVerdictDelta(signal: VerdictSignal): string {
  if (signal.key === "growth") {
    const value = signal.delta.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const point = Math.abs(signal.delta) <= 1 ? "point" : "points";
    return `${signal.delta > 0 ? "+" : ""}${value} ${point} de pourcentage depuis le début`;
  }
  const rounded = Math.round(signal.delta);
  return `${signed(rounded)} ${Math.abs(rounded) <= 1 ? "point" : "points"} d'indice depuis le début`;
}

function renderVerdictSignal(signal: VerdictSignal): string {
  const level = signal.key === "growth"
    ? Math.max(0, Math.min(100, Math.round(((signal.value + 1) / 4) * 100)))
    : Math.max(0, Math.min(100, Math.round(signal.value)));
  return `<li class="simulateur-v3__verdict-signal simulateur-v3__verdict-signal--${signal.key}">
    <span class="simulateur-v3__verdict-signal-label">${escapeHtml(signal.label)}</span>
    <strong>${escapeHtml(formatVerdictSignal(signal))}</strong>
    <span class="simulateur-v3__verdict-signal-delta">${escapeHtml(formatVerdictDelta(signal))}</span>
    <span class="simulateur-v3__verdict-signal-track" aria-hidden="true"><i style="--v3-verdict-level: ${level}%"></i></span>
    <small>${escapeHtml(signal.descriptor)}</small>
  </li>`;
}

function renderVerdictCheckpoint(point: VerdictCheckpoint, campaignLength: number): string {
  return `<li class="simulateur-v3__verdict-checkpoint${point.decisionCount === campaignLength ? " simulateur-v3__verdict-checkpoint--final" : ""}">
    <span class="simulateur-v3__verdict-checkpoint-dot" aria-hidden="true"></span>
    <span class="simulateur-v3__verdict-checkpoint-label">${escapeHtml(point.label)}</span>
    <strong>${escapeHtml(formatV3Amount(point.annualBalance))}</strong>
    <small>Pouvoir ${Math.round(point.majority)} / 100</small>
  </li>`;
}

function formatStructuralEffect(choice: VerdictChoice): string {
  const effect = choice.structuralEffect;
  if (!effect) return "Aucun second effet chiffré";
  return effectLabel(effect);
}

function renderVerdictChoice(choice: VerdictChoice): string {
  return `<li class="simulateur-v3__verdict-choice">
    <span class="simulateur-v3__verdict-choice-rank" aria-hidden="true">${String(choice.rank).padStart(2, "0")}</span>
    <div class="simulateur-v3__verdict-choice-copy">
      <p>${escapeHtml(choice.chapter)}</p>
      <h3>${escapeHtml(choice.label)}</h3>
      <dl>
        <div><dt>${choice.budgetDuration === "once" ? "Impact ponctuel" : "Solde annuel"}</dt><dd>${choice.budgetDelta === 0 ? "Inchangé" : `${escapeHtml(formatV3Amount(choice.budgetDelta))} ${choice.budgetDuration === "once" ? "une seule fois" : "par an"}`}</dd></div>
        <div><dt>Second effet</dt><dd>${escapeHtml(formatStructuralEffect(choice))}</dd></div>
      </dl>
      <span class="simulateur-v3__verdict-choice-status">${escapeHtml(choice.status)}</span>
    </div>
  </li>`;
}

function renderVerdictAftermath(item: VerdictAftermath): string {
  return `<li class="simulateur-v3__verdict-aftermath-item simulateur-v3__verdict-aftermath-item--${item.kind}">
    <div>
      <span>${item.kind === "crisis" ? "Crise traversée" : escapeHtml(item.status ?? "Réforme modifiée")}</span>
      <h3>${escapeHtml(item.title)}</h3>
    </div>
    <p>${escapeHtml(item.detail)}</p>
  </li>`;
}

function renderVerdict(view: MandateVerdictViewModel, scenario: Scenario): string {
  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--verdict">
      <article class="simulateur-v3__verdict">
        <header class="simulateur-v3__verdict-hero">
          <div class="simulateur-v3__verdict-hero-copy">
            <p class="simulateur-v3__eyebrow">Le verdict du pays</p>
            <h1>${escapeHtml(view.headline)}</h1>
            <p class="simulateur-v3__verdict-summary">${escapeHtml(view.summary)}</p>
          </div>
          <div class="simulateur-v3__verdict-totem">
            <span>Solde annuel</span>
            <strong>${escapeHtml(formatV3Amount(view.annualBalance))}</strong>
            <small>Écart au départ : ${escapeHtml(formatV3Amount(view.annualBalanceDelta))}</small>
          </div>
        </header>

        <section class="simulateur-v3__verdict-section simulateur-v3__verdict-signals" aria-labelledby="v3-verdict-signals-title">
          <div class="simulateur-v3__verdict-section-heading">
            <p class="simulateur-v3__eyebrow">État du mandat</p>
            <h2 id="v3-verdict-signals-title">Le pays au dernier jour</h2>
          </div>
          <ul>${view.signals.map(renderVerdictSignal).join("")}</ul>
        </section>

        <section class="simulateur-v3__verdict-section simulateur-v3__verdict-trajectory" aria-labelledby="v3-trajectory-title">
          <div class="simulateur-v3__verdict-section-heading">
            <p class="simulateur-v3__eyebrow">Cinq ans de décisions</p>
            <h2 id="v3-trajectory-title">Votre trajectoire de pouvoir</h2>
          </div>
          <ol>${view.trajectory.map((point) => renderVerdictCheckpoint(point, totalDecisions(scenario))).join("")}</ol>
        </section>

        <section class="simulateur-v3__verdict-section simulateur-v3__verdict-choices" aria-labelledby="v3-choices-title">
          <div class="simulateur-v3__verdict-section-heading">
            <p class="simulateur-v3__eyebrow">Votre ligne politique</p>
            <h2 id="v3-choices-title">Les trois décisions qui définissent votre mandat</h2>
          </div>
          <ol>${view.decisiveChoices.map(renderVerdictChoice).join("")}</ol>
        </section>

        ${view.aftermath.length ? `<section class="simulateur-v3__verdict-section simulateur-v3__verdict-aftermath" aria-labelledby="v3-aftermath-title">
          <div class="simulateur-v3__verdict-section-heading">
            <p class="simulateur-v3__eyebrow">Ce que le pouvoir vous a coûté</p>
            <h2 id="v3-aftermath-title">Crises et réformes sous pression</h2>
          </div>
          <ul>${view.aftermath.map(renderVerdictAftermath).join("")}</ul>
        </section>` : ""}

        <footer class="simulateur-v3__verdict-actions">
          <button type="button" class="simulateur-v3__primary" data-v3-action="share-verdict">Partager mon verdict</button>
          <button type="button" class="simulateur-v3__secondary" data-v3-action="restart">Refaire un mandat</button>
          <a class="simulateur-v3__verdict-france" href="/bilan">Retourner à France</a>
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
      content = renderDecision(state, scenario);
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
      content = renderVerdict(buildMandateVerdictViewModel(state, scenario, options.crisisRules ?? []), scenario);
      break;
    default:
      content = renderUnavailable("Cet écran du mandat n'est pas disponible.");
  }
  const accessibleContent = content.replace("<h1>", '<h1 tabindex="-1">');
  const saveWarning = options.saveFailed
    ? `<p class="simulateur-v3__save-error" role="status">La sauvegarde locale est indisponible. La partie continue dans cet onglet.</p>`
    : "";
  return `<section class="simulateur-v3">${renderCommandBar(state, scenario)}${saveWarning}${accessibleContent}</section>`;
}
