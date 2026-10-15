import { escape } from "./sharing.ts";
import { cleanGameText } from "./map-view.ts";
import type { Game } from "./types.ts";
import type { PressureProgramme } from "./pressure-types.ts";

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
  const programmes = game.pressure?.programmes ?? [];
  const preparing = programmes.filter(programme => programme.status === "preparing")
    .sort((a, b) => a.dueTurn - b.dueTurn || a.sourceTurn - b.sourceTurn);
  const inPlace = programmes.filter(programme => programme.status === "active" || programme.status === "completed" && !programme.duration)
    .sort((a, b) => (b.deliveredTurn ?? 0) - (a.deliveredTurn ?? 0));
  const history = programmes.filter(programme => programme.status === "cancelled" || programme.status === "completed" && !!programme.duration)
    .sort((a, b) => b.sourceTurn - a.sourceTurn);
  const programmeCard = (programme: PressureProgramme) => {
    const permanent = programme.status === "completed" && !programme.duration;
    const restriction = (programme.capacity ?? 0) < 0 || (programme.need ?? 0) > 0;
    const status = programme.status === "preparing" ? "En préparation"
      : programme.status === "cancelled" ? "Annulé"
      : permanent ? restriction ? "Appliqué" : "En service"
      : programme.status === "active" ? "En service" : "Terminé";
    const description = programme.status === "preparing"
      ? `Mise en place au plus tôt à la décision ${programme.dueTurn}${programme.dueTurn <= game.turn ? ", en attente de capacité d’exécution" : ""}.`
      : programme.status === "cancelled" ? "Intervention annulée."
      : permanent ? `${restriction ? "Mesure appliquée" : "Moyens durablement en service"} depuis la décision ${programme.deliveredTurn ?? programme.dueTurn}.`
      : programme.status === "completed" ? "Renfort temporaire terminé ; les dépenses engagées restent dans les comptes."
      : `En service depuis la décision ${programme.deliveredTurn ?? programme.dueTurn}.${programme.endsTurn !== undefined ? ` Intervention temporaire jusqu’à la décision ${programme.endsTurn}.` : ""}`;
    return `<article class="map-panel__project" data-pressure-programme="${e(programme.id)}"><header><h3>${e(programme.label)}</h3><span>${status}</span></header><p>${description}</p></article>`;
  };
  return `<section class="map-panel" data-map-projects>${programmes.length ? `<section class="map-panel__programmes"><h3>Capacités et interventions</h3><p>Les moyens financés produisent leurs effets après leur mise en place.</p>${preparing.length ? `<section data-pressure-preparing><h3>Mises en place attendues</h3>${preparing.map(programmeCard).join("")}</section>` : ""}${inPlace.length ? `<section data-pressure-in-service><h3>Moyens en place</h3>${inPlace.map(programmeCard).join("")}</section>` : ""}${history.length ? `<details class="map-subject__details" data-pressure-programme-history><summary>Interventions terminées (${history.length})</summary>${history.map(programmeCard).join("")}</details>` : ""}</section>` : ""}${projects.length
    ? projects.map(project => `<article class="map-panel__project"><header><h3>${e(project.label)}</h3><span>${statuses[project.status]}</span></header><p>${e(project.note)}</p><details class="map-subject__details"><summary>Origine du projet</summary><p>Engagé à la décision ${project.startedTurn + 1}.</p></details></article>`).join("")
    : programmes.length ? "" : "<p>Les projets financés au cours du mandat apparaîtront ici.</p>"}</section>`;
}
