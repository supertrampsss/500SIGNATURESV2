import { escape } from "./sharing.ts";
import { cleanGameText } from "./map-view.ts";
import type { Game } from "./types.ts";

const e = (text: string) => escape(cleanGameText(text));

/** On-demand views read the saved campaign; consulting them has no game effect. */
export function mapGovernmentPanel(game: Game): string {
  const politics = game.politics;
  if (!politics) return "<p>Le gouvernement sera constitué au début du mandat.</p>";
  const cabinet = { stable: "Gouvernement en place", fallen: "Gouvernement censuré", cohabitation: "Cohabitation" }[politics.cabinet];
  const seats = politics.blocs.reduce((total, bloc) => total + bloc.seats, 0);
  const support = politics.blocs.filter(bloc => bloc.inGovernment).reduce((total, bloc) => total + bloc.seats, 0);
  const vote = politics.lastVote;
  return `<section class="map-panel" data-map-government>
    <p class="map-panel__lead">${cabinet}</p>
    <p>${support} sièges de soutien sur ${seats} à l’Assemblée.</p>
    <ul class="map-panel__list">${politics.blocs.map(bloc => `<li><span>${e(bloc.label)}<small>${bloc.inGovernment ? "Soutien au gouvernement" : "Opposition"}</small></span><strong>${bloc.seats}<small>sièges</small></strong></li>`).join("")}</ul>
    ${vote ? `<section><h3>Dernier vote</h3><p><strong>${e(vote.title)}</strong></p><p>${vote.passed ? "Vote favorable" : "Vote défavorable"} · ${vote.for} pour, ${vote.against} contre, ${vote.abstain} abstentions.</p></section>` : ""}
    ${politics.commitments.some(item => item.status === "pending") ? `<details class="map-subject__details"><summary>Engagements politiques</summary><ul>${politics.commitments.filter(item => item.status === "pending").map(item => `<li>${e(item.label)}</li>`).join("")}</ul></details>` : ""}
  </section>`;
}

export function mapProjectsPanel(game: Game): string {
  const projects = game.narrative?.projects ?? [];
  const statuses = { funded: "En préparation", blocked: "Bloqué", delivered: "Livré", withdrawn: "Abandonné" } as const;
  return `<section class="map-panel" data-map-projects>${projects.length
    ? projects.map(project => `<article class="map-panel__project"><header><h3>${e(project.label)}</h3><span>${statuses[project.status]}</span></header><p>${e(project.note)}</p><details class="map-subject__details"><summary>Origine du projet</summary><p>Engagé à la décision ${project.startedTurn + 1}.</p></details></article>`).join("")
    : "<p>Les projets financés au cours du mandat apparaîtront ici.</p>"}</section>`;
}
