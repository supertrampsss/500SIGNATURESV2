import { currentDecision } from "./campaign.ts";
import { availableConcessions } from "./crises.ts";
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
  const trailing = state.phase === "intro"
    ? `<span class="simulateur-v3__pause-state">Mission</span>`
    : state.phase === "pause"
      ? `<span class="simulateur-v3__pause-state">En pause</span>`
      : state.phase === "verdict"
        ? `<span class="simulateur-v3__pause-state">Mandat terminé</span>`
        : `<button type="button" class="simulateur-v3__pause" data-v3-action="pause">Pause</button>`;
  return `
    <header class="simulateur-v3__command-bar">
      <a class="simulateur-v3__brand" href="/bilan" aria-label="Où va l'argent public, revenir à France">
        <span class="simulateur-v3__flag" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Où va l'argent public</span>
      </a>
      <p class="simulateur-v3__mandate">Mandat 2026 à 2031</p>
      <p class="simulateur-v3__chapter-progress">Chapitre ${state.chapterIndex + 1} sur 8</p>
      <p class="simulateur-v3__decision-progress">Dossier ${globalPosition(state)} sur 96</p>
      ${trailing}
    </header>`;
}

function renderIntro(options: RenderSimulatorV3Options): string {
  return `
    <main class="simulateur-v3__stage simulateur-v3__stage--intro">
      <article class="simulateur-v3__dossier simulateur-v3__intro">
        <p class="simulateur-v3__eyebrow">Votre mission</p>
        <h1>Reprendre le contrôle des comptes sans perdre le pays.</h1>
        <p class="simulateur-v3__mission-number">153 milliards d'euros</p>
        <p class="simulateur-v3__lead">La France emprunte cette somme cette année. Vous avez cinq ans pour réduire le déficit, préserver l'activité et conserver la capacité d'agir.</p>
        <ul class="simulateur-v3__objectives" aria-label="Objectifs du mandat">
          <li>Redresser les finances</li>
          <li>Préserver l'économie réelle</li>
          <li>Conserver une majorité</li>
          <li>Maintenir la confiance</li>
        </ul>
        ${options.v2Found ? `<p class="simulateur-v3__migration" role="status">Une ancienne partie a été trouvée. Elle reste intacte. Ce nouveau mandat repart avec les règles V3.</p>` : ""}
        <button type="button" class="simulateur-v3__primary" data-v3-action="start">Prendre mes fonctions</button>
      </article>
    </main>`;
}

function renderChapterIntro(state: CampaignState, scenario: Scenario): string {
  const chapter = scenario.chapters[state.chapterIndex]!;
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__chapter-intro">
        <p class="simulateur-v3__eyebrow">Chapitre ${state.chapterIndex + 1}</p>
        <h1>${escapeHtml(chapter.title)}</h1>
        <p class="simulateur-v3__lead">${escapeHtml(chapter.opening)}</p>
        <ul class="simulateur-v3__domains" aria-label="Domaines de ce chapitre">
          ${chapter.domains.map((domain) => `<li>${escapeHtml(domain)}</li>`).join("")}
        </ul>
        <p class="simulateur-v3__tension"><strong>La ligne de fracture</strong>${escapeHtml(chapter.tension)}</p>
        <button type="button" class="simulateur-v3__primary" data-v3-action="open-chapter">Ouvrir le premier dossier</button>
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

function renderOption(decision: Decision, option: DecisionOption, selected: boolean): string {
  const budget = annualBalanceEffect(option);
  return `
    <article class="simulateur-v3__option${selected ? " simulateur-v3__option--selected" : ""}" data-option-id="${escapeHtml(option.id)}">
      <button
        type="button"
        class="simulateur-v3__option-select"
        data-v3-action="select"
        data-decision-id="${escapeHtml(decision.id)}"
        data-option-id="${escapeHtml(option.id)}"
        aria-pressed="${selected ? "true" : "false"}"
      >
        <span class="simulateur-v3__option-label">${escapeHtml(option.label)}</span>
        ${option.summary !== decision.context ? `<span class="simulateur-v3__option-summary">${escapeHtml(option.summary)}</span>` : ""}
        <span class="simulateur-v3__option-metrics">
          <span>${budget ? `${escapeHtml(formatV3Amount(budget.delta))} par an` : "Solde public inchangé"}</span>
          <span>Incertitude ${escapeHtml(option.uncertainty)}</span>
        </span>
      </button>
      ${selected ? `
        <div class="simulateur-v3__option-confirmation" role="group" aria-label="Confirmer ce choix">
          <p>Vous engagez la France sur cette trajectoire.</p>
          <div>
            <button type="button" class="simulateur-v3__confirm" data-v3-action="confirm">Confirmer ce choix</button>
            <button type="button" class="simulateur-v3__cancel" data-v3-action="cancel">Revenir au dossier</button>
          </div>
        </div>` : ""}
    </article>`;
}

function renderEvidence(decision: Decision): string {
  return `
    <details class="simulateur-v3__evidence">
      <summary>Voir l'analyse et les sources</summary>
      <div class="simulateur-v3__evidence-body">
        ${decision.options.map((option) => `
          <section>
            <h3>${escapeHtml(option.label)}</h3>
            <dl>
              <div><dt>Bénéficiaires</dt><dd>${escapeHtml(option.beneficiaries.join(", "))}</dd></div>
              <div><dt>Contributeurs</dt><dd>${escapeHtml(option.contributors.join(", "))}</dd></div>
              <div><dt>Incertitude</dt><dd>${escapeHtml(option.uncertainty)}</dd></div>
            </dl>
          </section>`).join("")}
        <ul class="simulateur-v3__sources">
          ${decision.evidence.map((evidence) => `
            <li>
              <a href="${escapeHtml(evidence.sourceUrl)}">${escapeHtml(evidence.sourceName)}</a>
              <span>${escapeHtml(evidence.label)}</span>
              ${evidence.note ? `<small>${escapeHtml(evidence.note)}</small>` : ""}
            </li>`).join("")}
        </ul>
      </div>
    </details>`;
}

function renderDecision(state: CampaignState, scenario: Scenario): string {
  const decision = currentDecision(state, scenario);
  if (!decision) return renderUnavailable("Ce dossier n'est plus disponible.");
  const chapter = scenario.chapters[state.chapterIndex]!;
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__decision">
        <p class="simulateur-v3__eyebrow">${escapeHtml(chapter.title)} · Dossier ${globalPosition(state)}</p>
        <h1>${escapeHtml(decision.title)}</h1>
        <p class="simulateur-v3__context">${escapeHtml(decision.context)}</p>
        <section class="simulateur-v3__options" aria-label="Choix possibles">
          ${decision.options.map((option) => renderOption(
            decision,
            option,
            state.pendingSelection?.optionId === option.id,
          )).join("")}
        </section>
        ${renderEvidence(decision)}
      </article>
    </main>`;
}

function renderDecisionResult(state: CampaignState, scenario: Scenario): string {
  const record = state.decisions.at(-1);
  const decision = record ? scenario.decisions.find((candidate) => candidate.id === record.decisionId) : undefined;
  const option = decision?.options.find((candidate) => candidate.id === record?.optionId);
  if (!decision || !option) return renderUnavailable("Le résultat de cette décision est indisponible.");
  const budget = annualBalanceEffect(option);
  const otherEffects = option.effects.filter((effect) => effect !== budget && effect.timing.kind === "immediate");
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__result" aria-live="polite">
        <p class="simulateur-v3__eyebrow">Décision actée</p>
        <h1>${escapeHtml(option.label)}</h1>
        <p class="simulateur-v3__result-question">${escapeHtml(decision.title)}</p>
        <div class="simulateur-v3__result-grid">
          <section><h2>Effet sur les comptes</h2><p>${budget ? `${escapeHtml(formatV3Amount(budget.delta))} par an` : "Solde public inchangé"}</p></section>
          ${otherEffects.length ? `<section><h2>Effet politique immédiat</h2><ul class="simulateur-v3__result-effects">${otherEffects.map((effect) => `<li>${escapeHtml(effectLabel(effect))}</li>`).join("")}</ul></section>` : ""}
          ${option.scheduledEvents.length ? `<section><h2>À surveiller</h2><p>${option.scheduledEvents.length} conséquence programmée.</p></section>` : ""}
        </div>
        <button type="button" class="simulateur-v3__primary" data-v3-action="continue">Continuer le mandat</button>
      </article>
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
  };
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__journal">
        <p class="simulateur-v3__eyebrow">Mémoire de la campagne</p>
        <h1>Journal du mandat</h1>
        <p class="simulateur-v3__lead">Chaque arbitrage confirmé reste ici, y compris lorsqu'une crise vous a forcé à le modifier.</p>
        <ol class="simulateur-v3__journal-list">
          ${state.decisions.map((record, index) => {
            const { decision, option } = decisionAndOption(state, scenario, index);
            return `<li>
              <span class="simulateur-v3__journal-index">${index + 1}</span>
              <div><h2>${escapeHtml(option?.label ?? record.optionId)}</h2>
              <p>${escapeHtml(decision?.title ?? record.decisionId)}</p>
              <strong>${escapeHtml(statuses[record.status] ?? record.status)}</strong></div>
            </li>`;
          }).join("") || "<li>Aucune décision confirmée.</li>"}
        </ol>
        <button type="button" class="simulateur-v3__secondary" data-v3-action="back-pause">Revenir à Pause</button>
      </article>
    </main>`;
}

function renderPause(state: CampaignState, scenario: Scenario, view: RenderSimulatorV3Options["pauseView"]): string {
  if (view === "journal") return renderJournal(state, scenario);
  if (view === "restart") {
    return `
      <main class="simulateur-v3__stage">
        <article class="simulateur-v3__dossier simulateur-v3__pause-menu">
          <p class="simulateur-v3__eyebrow">Recommencer</p>
          <h1>Effacer ce mandat et repartir de zéro ?</h1>
          <p class="simulateur-v3__lead">Vos décisions V3 seront remplacées. Une éventuelle partie V2 restera intacte.</p>
          <div class="simulateur-v3__pause-actions">
            <button type="button" class="simulateur-v3__danger" data-v3-action="restart">Oui, recommencer</button>
            <button type="button" class="simulateur-v3__secondary" data-v3-action="back-pause">Conserver ce mandat</button>
          </div>
        </article>
      </main>`;
  }
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__pause-menu">
        <p class="simulateur-v3__eyebrow">Mandat suspendu</p>
        <h1>Le Conseil vous attend.</h1>
        <div class="simulateur-v3__pause-actions">
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
        <p class="simulateur-v3__eyebrow">Conseil après ${state.decisions.length} décisions</p>
        <h1>Le pays vous présente l'addition.</h1>
        <p class="simulateur-v3__lead">Le Conseil relie les mouvements du mandat aux arbitrages qui viennent d'être pris.</p>
        <div class="simulateur-v3__situation-grid">
          <section><h2>Finances</h2><strong>${escapeHtml(formatV3Amount(state.indicators.annualBalance))}</strong><p>Solde public annuel</p></section>
          <section><h2>Économie réelle</h2><strong>${state.indicators.growth.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong><p>Croissance, investissement ${Math.round(state.indicators.investment)}</p></section>
          <section><h2>Pouvoir</h2><strong>${Math.round(state.indicators.majority)} / 100</strong><p>Capacité de réforme ${Math.round(state.indicators.reformCapacity)}</p></section>
          <section><h2>Confiance</h2><strong>${Math.round(state.indicators.opinion)} / 100</strong><p>Crédibilité financière ${Math.round(state.indicators.financialCredibility)}</p></section>
        </div>
        ${causes.length ? `<section class="simulateur-v3__causes"><h2>Ce qui vient de peser</h2><ul>${causes.map((cause) => {
          const decisionId = sourceDecisionIdForCause(state, cause);
          const title = scenario.decisions.find((decision) => decision.id === decisionId)?.title;
          return `<li><strong>${escapeHtml(effectLabel(cause))}</strong><span>${escapeHtml(title ?? "Événement du mandat")}</span><small>${escapeHtml(cause.explanation)}</small></li>`;
        }).join("")}</ul></section>` : ""}
        <button type="button" class="simulateur-v3__primary" data-v3-action="continue">Retourner aux dossiers</button>
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
        <p class="simulateur-v3__eyebrow">Conséquence différée</p>
        <h1>${escapeHtml(first?.title ?? "Une promesse revient dans le débat.")}</h1>
        ${source ? `<p class="simulateur-v3__event-source"><strong>Décision d'origine</strong>${escapeHtml(source.title)}</p>` : ""}
        ${events.map((event) => `<section class="simulateur-v3__event-card"><p>${escapeHtml(event.body)}</p><ul>${event.effects.map((effect) => `<li>${escapeHtml(effectLabel(effect))}</li>`).join("")}</ul></section>`).join("")}
        ${promises.map((promise) => `<section class="simulateur-v3__event-card"><h2>${escapeHtml(promise.label)}</h2><p>${promise.fulfilled ? "Promesse tenue." : "Promesse non tenue. Le coût politique est appliqué."}</p>${promise.fulfilled ? "" : `<ul>${promise.failureEffects.map((effect) => `<li>${escapeHtml(effectLabel(effect))}</li>`).join("")}</ul>`}</section>`).join("")}
        <button type="button" class="simulateur-v3__primary" data-v3-action="continue">Assumer la suite</button>
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
        <p class="simulateur-v3__eyebrow">Conseil de crise</p>
        <h1>${escapeHtml(rule.title)}</h1>
        <p class="simulateur-v3__lead">${escapeHtml(rule.body)}</p>
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
      </article>
    </main>`;
}

function chapterLedger(state: CampaignState): CausalEntry[] {
  const start = state.chapterIndex * 12;
  return state.causalLedger.filter((entry) => entry.appliedAtDecision > start && entry.appliedAtDecision <= start + 12);
}

function renderChapterVerdict(state: CampaignState, scenario: Scenario): string {
  const chapter = scenario.chapters[state.chapterIndex]!;
  const records = state.decisions.filter((record) => record.confirmedAtIndex > state.chapterIndex * 12 && record.confirmedAtIndex <= (state.chapterIndex + 1) * 12);
  const ledger = chapterLedger(state);
  const budget = ledger.filter((entry) => entry.target === "indicator" && entry.key === "annualBalance").reduce((sum, entry) => sum + entry.delta, 0);
  const opinion = ledger.filter((entry) => entry.target === "indicator" && entry.key === "opinion").reduce((sum, entry) => sum + entry.delta, 0);
  const contradiction = budget > 0 && opinion < 0
    ? "Les comptes progressent, mais le consentement recule. La suite du mandat dépendra de votre capacité à tenir cette ligne."
    : budget < 0 && opinion > 0
      ? "Le pays respire politiquement, mais la trajectoire financière se dégrade. Le prochain chapitre devra financer ce répit."
      : "Vous avez réduit une tension sans la faire disparaître. Les effets différés peuvent encore déplacer ce bilan.";
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__chapter-verdict">
        <p class="simulateur-v3__eyebrow">Chapitre terminé</p>
        <h1>${escapeHtml(chapter.title)}</h1>
        <p class="simulateur-v3__lead">${records.length} décisions ont fixé votre ligne.</p>
        <div class="simulateur-v3__chapter-score"><section><h2>Solde annuel</h2><strong>${escapeHtml(formatV3Amount(budget))}</strong></section><section><h2>Opinion</h2><strong>${signed(opinion)} points</strong></section></div>
        <section class="simulateur-v3__contradiction"><h2>Contradiction ouverte</h2><p>${escapeHtml(contradiction)}</p></section>
        <button type="button" class="simulateur-v3__primary" data-v3-action="continue">Ouvrir le chapitre suivant</button>
      </article>
    </main>`;
}

function renderVerdict(state: CampaignState, scenario: Scenario): string {
  const abandoned = state.decisions.filter((record) => record.status !== "confirmed").length;
  const crisisCount = state.crisisHistory.length;
  const balance = state.indicators.annualBalance;
  const headline = balance >= 0
    ? "Vous avez remis les comptes à l'équilibre. Le prix du mandat reste politique."
    : balance >= -50_000
      ? "Vous n'avez pas tout réglé, mais la trajectoire est devenue crédible."
      : "Le déficit résiste. Votre mandat a surtout choisi qui devait être protégé.";
  const decisive = state.decisions.slice().sort((a, b) => {
    const effect = (record: typeof a) => scenario.decisions.find((decision) => decision.id === record.decisionId)?.options.find((option) => option.id === record.optionId)?.effects.find((item) => item.target === "indicator" && item.key === "annualBalance")?.delta ?? 0;
    return Math.abs(effect(b)) - Math.abs(effect(a));
  }).slice(0, 3);
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__verdict">
        <p class="simulateur-v3__eyebrow">Votre mandat</p>
        <h1>${escapeHtml(headline)}</h1>
        <p class="simulateur-v3__lead">96 décisions, ${crisisCount} ${crisisCount === 1 ? "crise" : "crises"}, ${abandoned} ${abandoned === 1 ? "réforme abandonnée sous pression" : "réformes abandonnées sous pression"}.</p>
        <div class="simulateur-v3__situation-grid">
          <section><h2>Solde annuel</h2><strong>${escapeHtml(formatV3Amount(balance))}</strong></section>
          <section><h2>Croissance</h2><strong>${state.indicators.growth.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %</strong></section>
          <section><h2>Pouvoir</h2><strong>${Math.round(state.indicators.majority)} / 100</strong></section>
          <section><h2>Opinion</h2><strong>${Math.round(state.indicators.opinion)} / 100</strong></section>
        </div>
        <section class="simulateur-v3__decisive"><h2>Les trois gestes qui ont le plus pesé</h2><ol>${decisive.map((record) => {
          const decision = scenario.decisions.find((candidate) => candidate.id === record.decisionId);
          const option = decision?.options.find((candidate) => candidate.id === record.optionId);
          return `<li><strong>${escapeHtml(option?.label ?? record.optionId)}</strong><span>${escapeHtml(decision?.title ?? record.decisionId)}</span></li>`;
        }).join("")}</ol></section>
        <div class="simulateur-v3__verdict-actions"><button type="button" class="simulateur-v3__primary" data-v3-action="restart">Prendre ma revanche</button><a class="simulateur-v3__secondary" href="/bilan">Revenir à France</a></div>
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
      content = renderDecisionResult(state, scenario);
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
    case "chapter_verdict":
      content = renderChapterVerdict(state, scenario);
      break;
    case "verdict":
      content = renderVerdict(state, scenario);
      break;
    default:
      content = renderUnavailable("Cet écran du mandat n'est pas disponible.");
  }
  return `<section class="simulateur-v3">${renderCommandBar(state)}${content}</section>`;
}
