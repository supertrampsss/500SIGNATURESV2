import { currentDecision } from "./campaign.ts";
import type {
  CampaignState,
  Decision,
  DecisionOption,
  EffectRule,
  Scenario,
} from "./types.ts";

export type RenderSimulatorV3Options = {
  v2Found?: boolean;
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
  if (absolute >= 1_000) return `${signed(Math.round(value / 1_000))} milliards d'euros`;
  return `${signed(Math.round(value))} millions d'euros`;
}

function globalPosition(state: CampaignState): number {
  return Math.min(96, state.chapterIndex * 12 + state.decisionIndex + 1);
}

function renderCommandBar(state: CampaignState): string {
  return `
    <header class="simulateur-v3__command-bar">
      <a class="simulateur-v3__brand" href="/bilan" aria-label="Où va l'argent public, revenir à France">
        <span class="simulateur-v3__flag" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>Où va l'argent public</span>
      </a>
      <p class="simulateur-v3__mandate">Mandat 2026 à 2031</p>
      <p class="simulateur-v3__chapter-progress">Chapitre ${state.chapterIndex + 1} sur 8</p>
      <p class="simulateur-v3__decision-progress">Dossier ${globalPosition(state)} sur 96</p>
      <button type="button" class="simulateur-v3__pause" data-v3-action="pause">Pause</button>
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
        <span class="simulateur-v3__option-summary">${escapeHtml(option.summary)}</span>
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
  const otherEffects = option.effects.filter((effect) => effect !== budget);
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__result" aria-live="polite">
        <p class="simulateur-v3__eyebrow">Décision actée</p>
        <h1>${escapeHtml(option.label)}</h1>
        <p class="simulateur-v3__result-question">${escapeHtml(decision.title)}</p>
        <div class="simulateur-v3__result-grid">
          <section><h2>Effet sur les comptes</h2><p>${budget ? `${escapeHtml(formatV3Amount(budget.delta))} par an` : "Solde public inchangé"}</p></section>
          <section><h2>Effet politique immédiat</h2><p>${otherEffects.length ? escapeHtml(otherEffects.map((effect) => effect.explanation).join(" ")) : "Aucune variation immédiate mesurée."}</p></section>
          <section><h2>Ce qui reste à venir</h2><p>${option.scheduledEvents.length ? `${option.scheduledEvents.length} conséquence programmée.` : "Aucune conséquence différée programmée dans cette version."}</p></section>
        </div>
        <button type="button" class="simulateur-v3__primary" data-v3-action="continue">Continuer le mandat</button>
      </article>
    </main>`;
}

function renderPause(): string {
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__pause-menu">
        <p class="simulateur-v3__eyebrow">Mandat suspendu</p>
        <h1>Le Conseil vous attend.</h1>
        <div class="simulateur-v3__pause-actions">
          <button type="button" class="simulateur-v3__primary" data-v3-action="resume">Reprendre</button>
          <a class="simulateur-v3__secondary" href="/bilan">Quitter vers France</a>
        </div>
      </article>
    </main>`;
}

function renderInterlude(state: CampaignState): string {
  const labels: Partial<Record<CampaignState["phase"], string>> = {
    council: "Le Conseil fait le point.",
    chapter_verdict: "Le chapitre est terminé.",
    verdict: "Votre mandat est terminé.",
    crisis: "Une crise exige une décision.",
    delayed_event: "Une conséquence de vos choix revient.",
  };
  return `
    <main class="simulateur-v3__stage">
      <article class="simulateur-v3__dossier simulateur-v3__interlude">
        <p class="simulateur-v3__eyebrow">Situation du mandat</p>
        <h1>${escapeHtml(labels[state.phase] ?? "Le mandat se poursuit.")}</h1>
        ${state.phase === "verdict" ? `<a class="simulateur-v3__primary" href="/bilan">Revenir à France</a>` : `<button type="button" class="simulateur-v3__primary" data-v3-action="continue">Poursuivre</button>`}
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
      content = renderPause();
      break;
    default:
      content = renderInterlude(state);
  }
  return `<section class="simulateur-v3">${renderCommandBar(state)}${content}</section>`;
}
