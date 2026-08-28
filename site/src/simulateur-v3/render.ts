import { currentDecision } from "./campaign.ts";
import { availableConcessions } from "./crises.ts";
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
  Scenario,
} from "./types.ts";

export type RenderSimulatorV3Options = {
  v2Found?: boolean;
  crisisRules?: readonly CrisisRule[];
  pauseView?: "menu" | "journal" | "restart";
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

function globalPosition(state: CampaignState): number {
  return Math.min(96, state.chapterIndex * 12 + state.decisionIndex + 1);
}

function renderCommandBar(state: CampaignState): string {
  const progressLevel = Math.max(0, Math.min(100, Math.round((state.decisions.length / 96) * 100)));
  const trailing = state.phase === "intro"
    ? `<span class="simulateur-v3__pause-state">Mission</span>`
    : state.phase === "pause"
      ? `<span class="simulateur-v3__pause-state">En pause</span>`
      : state.phase === "verdict"
        ? `<span class="simulateur-v3__pause-state">Mandat terminé</span>`
        : `<button type="button" class="simulateur-v3__pause" data-v3-action="pause">Pause</button>`;
  const progress = state.phase === "verdict"
    ? `<p class="simulateur-v3__verdict-progress">Verdict du mandat</p>`
    : `<p class="simulateur-v3__chapter-progress">Chapitre ${state.chapterIndex + 1} sur 8</p>
      <p class="simulateur-v3__decision-progress">Dossier ${globalPosition(state)} sur 96</p>`;
  return `
    <header class="simulateur-v3__command-bar">
      <a class="simulateur-v3__brand" href="/bilan" aria-label="Où va l'argent public, revenir à France">
        <span class="simulateur-v3__flag" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Où va l'argent public</span>
      </a>
      <p class="simulateur-v3__mandate">Mandat 2026 à 2031</p>
      <p class="simulateur-v3__command-balance"><span>Solde annuel</span><strong>${escapeHtml(formatV3Amount(state.indicators.annualBalance))}</strong></p>
      ${progress}
      <span class="simulateur-v3__command-progress" aria-hidden="true"><i style="--v3-command-progress: ${progressLevel}%"></i></span>
      ${trailing}
    </header>`;
}

function renderIntro(options: RenderSimulatorV3Options): string {
  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--intro">
      <article class="simulateur-v3__dossier simulateur-v3__intro">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Votre mission</p>
          <h1>Reprendre le contrôle des comptes sans perdre le pays.</h1>
          <p class="simulateur-v3__mission-number">153 milliards d'euros</p>
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

const EFFECT_LABELS: Record<string, string> = {
  annualBalance: "Solde public",
  growth: "Croissance",
  employment: "Emploi",
  investment: "Investissement",
  publicServices: "Services publics",
  opinion: "Opinion",
  financialCredibility: "Marchés",
  reformCapacity: "Capacité de réforme",
  majority: "Majorité",
  institutionalTrust: "Confiance institutionnelle",
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
  const label = EFFECT_LABELS[effect.key] ?? effect.key;
  if (effect.target === "indicator" && effect.key === "annualBalance") {
    return `${label} ${formatV3Amount(effect.delta)}`;
  }
  const unit = Math.abs(effect.delta) === 1 ? "point" : "points";
  return `${label} ${signed(effect.delta)} ${unit}`;
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
        <div class="simulateur-v3__dashboard-pair"><span>Croissance</span><strong>${growth} %</strong></div>
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

function illustrationKind(decision: Decision): string {
  const words = `${decision.chapterId} ${decision.id} ${decision.title}`.toLocaleLowerCase("fr");
  if (/epr|nuclé|réacteur/.test(words)) return "nuclear";
  if (/défense|armée|otan|militaire/.test(words)) return "defence";
  if (/energy|climat|agriculture|transport|train|vélo|voiture|véhicule|avion/.test(words)) return "transport";
  if (/hôpital|santé|soin|médic/.test(words)) return "health";
  if (/école|université|enseign/.test(words)) return "education";
  if (/logement|loyer|foncier/.test(words)) return "housing";
  if (/retraite|travail|salaire|chômage/.test(words)) return "work";
  if (/impôt|tax|tva|fiscal|succession|patrimoine/.test(words)) return "tax";
  return "state";
}

function illustrationDrawing(kind: string, variant: number): string {
  if (kind === "nuclear") {
    if (variant === 2) return `<path d="M15 84h150M27 84c7-17 9-34 5-52h24c-4 18-2 35 5 52M72 84c7-17 9-34 5-52h24c-4 18-2 35 5 52M117 84c7-17 9-34 5-52h24c-4 18-2 35 5 52M30 51h28M75 51h28M120 51h28"/><path d="M40 25c-8-8 5-12-3-19M85 25c-8-8 5-12-3-19M130 25c-8-8 5-12-3-19"/><path d="M151 7h15v15h-15z"/>`;
    if (variant === 3) return `<path d="M36 84h108M58 84c9-20 11-39 7-58h34c-4 19-2 38 7 58M62 49h40"/><path d="M77 20c-9-9 5-13-3-20M126 17l20-20M126-3l20 20"/>`;
  }
  const drawings: Record<string, string> = {
    nuclear: `<path d="M22 84h136M42 84c9-20 11-39 7-58h26c-4 19-2 38 7 58M98 84c9-20 11-39 7-58h26c-4 19-2 38 7 58M45 48h33M101 48h33"/><path d="M55 20c-9-9 5-13-3-20M116 20c-9-9 5-13-3-20"/>`,
    tax: `<ellipse cx="55" cy="75" rx="31" ry="10"/><path d="M24 56v19c0 6 14 11 31 11s31-5 31-11V56M24 56c0 6 14 11 31 11s31-5 31-11-14-11-31-11-31 5-31 11Z"/><circle cx="122" cy="47" r="28"/><path d="M122 31v32M112 38c3-8 22-7 22 2 0 13-24 5-24 17 0 9 20 10 25 1"/>`,
    defence: `<path d="M28 79h124M44 72V35l42-17 50 22v32M59 72V50h62v22M76 72V57h28v15"/><path d="M85 18V7l23 8-22 8"/>`,
    transport: `<path d="M22 78h136M41 69h96l-13-34H56L41 69Z"/><circle cx="61" cy="74" r="10"/><circle cx="117" cy="74" r="10"/><path d="M66 35l12 34M107 35l-8 34M28 27h31M19 38h27"/>`,
    health: `<path d="M73 19h34v22h22v34h-22v22H73V75H51V41h22V19Z"/><path d="M24 90h132"/>`,
    education: `<path d="M20 42l70-28 70 28-70 27-70-27Z"/><path d="M48 54v25c20 14 64 14 84 0V54M151 46v38"/>`,
    housing: `<path d="M25 85h130M39 85V45l51-31 51 31v40M62 85V58h23v27M103 52h19v19h-19V52Z"/>`,
    work: `<circle cx="57" cy="39" r="19"/><path d="M24 88c4-25 16-37 33-37s29 12 33 37M112 77h45M121 77V51h27v26M134 51V35"/>`,
    state: `<path d="M22 85h136M34 78h112M45 71V39M69 71V39M93 71V39M117 71V39M141 71V39M30 32h126L93 11 30 32Z"/>`,
  };
  const marker = variant === 1 ? `<circle cx="153" cy="17" r="8"/>` : variant === 2 ? `<path d="M146 9h15v15h-15z"/>` : `<path d="M145 23l16-16M145 7l16 16"/>`;
  return `${drawings[kind] ?? drawings.state}${marker}`;
}

function renderIllustration(decision: Decision, optionIndex: number): string {
  const kind = illustrationKind(decision);
  return `<svg class="simulateur-v3__decision-illustration simulateur-v3__decision-illustration--${kind} simulateur-v3__decision-illustration--variant-${optionIndex + 1}" aria-hidden="true" viewBox="0 0 180 104">${illustrationDrawing(kind, optionIndex + 1)}</svg>`;
}

function renderOption(decision: Decision, option: DecisionOption, optionIndex: number): string {
  const budget = annualBalanceEffect(option);
  const visibleEffects = option.effects
    .filter((effect) => !(effect.target === "indicator" && effect.key === "annualBalance"))
    .filter((effect) => effect.timing.kind === "immediate")
    .slice(0, 2);
  const budgetLabel = budget ? `${formatV3Amount(budget.delta)} par an` : "Solde inchangé";
  const budgetSignal = !budget || budget.delta === 0 ? "neutral" : budget.delta > 0 ? "positive" : "negative";
  return `
    <article class="simulateur-v3__option" data-option-id="${escapeHtml(option.id)}">
      <button
        type="button"
        class="simulateur-v3__option-select"
        data-v3-action="select"
        data-decision-id="${escapeHtml(decision.id)}"
        data-option-id="${escapeHtml(option.id)}"
        aria-label="Choisir : ${escapeHtml(option.label)}"
      >
        ${renderIllustration(decision, optionIndex)}
        <span class="simulateur-v3__option-head">
          <span class="simulateur-v3__option-label">${escapeHtml(compactOptionLabel(option.label))}</span>
          <strong class="simulateur-v3__option-budget simulateur-v3__option-budget--${budgetSignal}">${escapeHtml(budgetLabel)}</strong>
        </span>
        ${option.summary !== decision.context ? `<span class="simulateur-v3__option-summary">${escapeHtml(option.summary)}</span>` : ""}
        <span class="simulateur-v3__option-effects">
          ${visibleEffects.map((effect) => `<span>${escapeHtml(effectLabel(effect))}</span>`).join("")}
        </span>
        <span class="simulateur-v3__option-confidence">Risque ${escapeHtml(option.uncertainty)}<i aria-hidden="true" data-risk="${option.uncertainty}"></i></span>
      </button>
    </article>`;
}

function renderEvidence(decision: Decision): string {
  return `
    <details class="simulateur-v3__evidence">
      <summary>Voir l'analyse et les sources</summary>
      <div class="simulateur-v3__evidence-body">
        <section class="simulateur-v3__analysis">
          <h3>Le dossier</h3>
          <p>${escapeHtml(decision.context)}</p>
        </section>
        ${decision.options.map((option) => `
          <section>
            <h3>${escapeHtml(option.label)}</h3>
            <dl>
              <div><dt>Bénéficiaires</dt><dd>${escapeHtml(option.beneficiaries.join(", "))}</dd></div>
              <div><dt>Contributeurs</dt><dd>${escapeHtml(option.contributors.join(", "))}</dd></div>
              <div><dt>Incertitude</dt><dd>${escapeHtml(option.uncertainty)}</dd></div>
            </dl>
          </section>`).join("")}
        <section class="simulateur-v3__source-block">
          <h3>Sources</h3>
          <p>${escapeHtml(decision.evidence[0]?.label ?? "")}</p>
          <ul class="simulateur-v3__sources">
            ${decision.evidence.map((evidence) => `
            <li>
              <a href="${escapeHtml(evidence.sourceUrl)}">${escapeHtml(evidence.sourceName)}</a>
              <time datetime="${escapeHtml(evidence.publishedAt)}">${escapeHtml(evidence.publishedAt.slice(0, 4))}</time>
              ${evidence.note ? `<small>${escapeHtml(evidence.note)}</small>` : ""}
            </li>`).join("")}
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
            <p class="simulateur-v3__eyebrow">${escapeHtml(chapter.title)} · Dossier ${globalPosition(state)}</p>
            <h1>${escapeHtml(decision.title)}</h1>
            <p class="simulateur-v3__context">${escapeHtml(compactText(decision.context))}</p>
          </header>
          <div class="simulateur-v3__scene-body">
            <section class="simulateur-v3__options simulateur-v3__options--${decision.options.length}" aria-label="Choix possibles">
              ${decision.options.map((option, index) => renderOption(decision, option, index)).join("")}
            </section>
            ${renderMandateDashboard(state)}
            ${renderEvidence(decision)}
          </div>
        </article>
      </div>
    </main>`;
}

function decisionAndOption(state: CampaignState, scenario: Scenario, recordIndex: number) {
  const record = state.decisions[recordIndex];
  const decision = record ? scenario.decisions.find((candidate) => candidate.id === record.decisionId) : undefined;
  const option = decision?.options.find((candidate) => candidate.id === record?.optionId);
  return { record, decision, option };
}

function renderJournal(state: CampaignState, scenario: Scenario): string {
  const statuses: Record<string, string> = {
    confirmed: "En vigueur",
    suspended: "Suspendue après une crise",
    amended: "Amendée après une crise",
    reversed: "Renversée après une crise",
    superseded: "Sans objet après un arbitrage précédent",
  };
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__journal">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Mémoire de la campagne</p>
          <h1>Journal du mandat</h1>
          <p class="simulateur-v3__lead">Vos arbitrages, leur statut et les concessions arrachées pendant le mandat.</p>
        </header>
        <div class="simulateur-v3__scene-body"><ol class="simulateur-v3__journal-list">
          ${state.decisions.map((record, index) => {
            const { decision, option } = decisionAndOption(state, scenario, index);
            const optionLabel = compactOptionLabel(option?.label ?? record.optionId);
            const decisionTitle = decision?.title ?? record.decisionId;
            const repeatsDecision = decisionTitle.replace(/\s*\?$/, "").startsWith(optionLabel);
            return `<li>
              <span class="simulateur-v3__journal-index">${index + 1}</span>
              <div><h2>${escapeHtml(optionLabel)}</h2>
              ${repeatsDecision ? "" : `<p>${escapeHtml(decisionTitle)}</p>`}
              <strong>${escapeHtml(statuses[record.status] ?? record.status)}</strong></div>
            </li>`;
          }).join("") || "<li>Aucune décision confirmée.</li>"}
        </ol></div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__secondary" data-v3-action="back-pause">Revenir à Pause</button></footer>
      </article>
    </main>`;
}

function renderPause(state: CampaignState, scenario: Scenario, view: RenderSimulatorV3Options["pauseView"]): string {
  if (view === "journal") return renderJournal(state, scenario);
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

function sourceDecisionIdForCause(state: CampaignState, cause: CausalEntry): string | undefined {
  if (cause.sourceType === "decision") return cause.sourceId.split(":")[0];
  if (cause.sourceType === "event") {
    return [...state.eventHistory, ...state.scheduledEvents].find((event) => event.id === cause.sourceId)?.sourceDecisionId;
  }
  if (cause.sourceType === "promise") {
    return [...state.promiseHistory, ...state.activePromises].find((promise) => promise.id === cause.sourceId)?.sourceDecisionId;
  }
  return [...state.crisisHistory, ...(state.activeCrisis ? [state.activeCrisis] : [])]
    .find((crisis) => crisis.ruleId === cause.sourceId)?.triggeredByDecisionId;
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

function renderDelayedEvent(state: CampaignState, scenario: Scenario): string {
  const events = state.scheduledEvents.filter((event) => event.dueAtDecision <= state.decisions.length);
  const promises = state.activePromises.filter((promise) => promise.dueAtDecision <= state.decisions.length);
  const first = events[0];
  const source = first ? scenario.decisions.find((decision) => decision.id === first.sourceDecisionId) : undefined;
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__event">
        <header class="simulateur-v3__scene-header">
          <p class="simulateur-v3__eyebrow">Conséquence différée</p>
          <h1>${escapeHtml(first?.title ?? "Une promesse revient dans le débat.")}</h1>
          ${source ? `<p class="simulateur-v3__event-source"><strong>Décision d'origine</strong>${escapeHtml(source.title)}</p>` : ""}
        </header>
        <div class="simulateur-v3__scene-body">
          ${events.map((event) => `<section class="simulateur-v3__event-card"><p>${escapeHtml(event.body)}</p><ul>${event.effects.map((effect) => `<li>${escapeHtml(effectLabel(effect))}</li>`).join("")}</ul></section>`).join("")}
          ${promises.map((promise) => `<section class="simulateur-v3__event-card"><h2>${escapeHtml(promise.label)}</h2><p>${promise.fulfilled ? "Promesse tenue." : "Promesse non tenue. Le coût politique est appliqué."}</p>${promise.fulfilled ? "" : `<ul>${promise.failureEffects.map((effect) => `<li>${escapeHtml(effectLabel(effect))}</li>`).join("")}</ul>`}</section>`).join("")}
        </div>
        <footer class="simulateur-v3__scene-actions"><button type="button" class="simulateur-v3__primary" data-v3-action="continue">Assumer la suite</button></footer>
      </article>
    </main>`;
}

function renderCrisis(state: CampaignState, scenario: Scenario, rules: readonly CrisisRule[]): string {
  const rule = rules.find((candidate) => candidate.id === state.activeCrisis?.ruleId);
  if (!rule || !state.activeCrisis) return renderUnavailable("Cette crise n'est plus disponible.");
  const trigger = scenario.decisions.find((decision) => decision.id === state.activeCrisis?.triggeredByDecisionId);
  const concessions = availableConcessions(state, rules);
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__crisis">
        <div class="simulateur-v3__crisis-visual" aria-hidden="true">
          <svg viewBox="0 0 1200 330" preserveAspectRatio="xMidYMid slice">
            <path class="simulateur-v3__crisis-sky" d="M0 0h1200v330H0z"/>
            <path class="simulateur-v3__crisis-city" d="M0 245h62v-74h44v74h75v-118h66v118h59v-63h83v63h56v-151h82v151h61v-90h65v90h89v-122h71v122h49v-71h90v71h60v-137h66v137h74v85H0z"/>
            <path class="simulateur-v3__crisis-crowd" d="M0 288c95-33 176-13 251-30 81-19 159-29 255 4 85 29 167-22 260-5 87 16 170 42 264 8 62-22 119-15 170 3v62H0z"/>
            <path class="simulateur-v3__crisis-flare" d="M160 265l34-105 35 105M932 270l38-129 42 129"/>
          </svg>
        </div>
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
    return `${signal.delta > 0 ? "+" : ""}${value} point depuis le début`;
  }
  const rounded = Math.round(signal.delta);
  return `${signed(rounded)} ${Math.abs(rounded) === 1 ? "point" : "points"} depuis le début`;
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

function renderVerdictCheckpoint(point: VerdictCheckpoint): string {
  return `<li class="simulateur-v3__verdict-checkpoint${point.decisionCount === 96 ? " simulateur-v3__verdict-checkpoint--final" : ""}">
    <span class="simulateur-v3__verdict-checkpoint-dot" aria-hidden="true"></span>
    <span class="simulateur-v3__verdict-checkpoint-label">${escapeHtml(point.label)}</span>
    <strong>${escapeHtml(formatV3Amount(point.annualBalance))}</strong>
    <small>Pouvoir ${Math.round(point.majority)} / 100</small>
  </li>`;
}

function formatStructuralEffect(choice: VerdictChoice): string {
  const effect = choice.structuralEffect;
  if (!effect) return "Aucun second effet chiffré";
  const value = effect.delta.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const unit = Math.abs(effect.delta) === 1 ? "point" : "points";
  return `${effect.label} ${effect.delta > 0 ? "+" : ""}${value} ${unit}`;
}

function renderVerdictChoice(choice: VerdictChoice): string {
  return `<li class="simulateur-v3__verdict-choice">
    <span class="simulateur-v3__verdict-choice-rank" aria-hidden="true">${String(choice.rank).padStart(2, "0")}</span>
    <div class="simulateur-v3__verdict-choice-copy">
      <p>${escapeHtml(choice.chapter)}</p>
      <h3>${escapeHtml(choice.label)}</h3>
      <dl>
        <div><dt>Solde annuel</dt><dd>${choice.budgetDelta === 0 ? "Inchangé" : `${escapeHtml(formatV3Amount(choice.budgetDelta))} par an`}</dd></div>
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

function renderVerdict(view: MandateVerdictViewModel): string {
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
          <ol>${view.trajectory.map(renderVerdictCheckpoint).join("")}</ol>
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
      content = renderIntro(options);
      break;
    case "chapter_intro":
      content = renderChapterIntro(state, scenario);
      break;
    case "decision":
      content = renderDecision(state, scenario);
      break;
    case "decision_result":
      content = "";
      break;
    case "pause":
      content = renderPause(state, scenario, options.pauseView ?? "menu");
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
      content = renderVerdict(buildMandateVerdictViewModel(state, scenario, options.crisisRules ?? []));
      break;
    default:
      content = renderUnavailable("Cet écran du mandat n'est pas disponible.");
  }
  return `<section class="simulateur-v3">${renderCommandBar(state)}${content}</section>`;
}
