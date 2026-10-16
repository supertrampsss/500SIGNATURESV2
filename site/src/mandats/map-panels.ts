import { escape } from "./sharing.ts";
import { cleanGameText } from "./map-view.ts";
import { politicalVoteOutcome } from "./political-motion.ts";
import type { Game } from "./types.ts";
import type { NarrativeProject } from "./narrative-types.ts";
import type { PressureProgramme, PressureSectorId } from "./pressure-types.ts";

const e = (text: string) => escape(cleanGameText(text));
const number = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
const sectorNames: Record<PressureSectorId, string> = {
  health: "Santé", housing: "Logement", transport: "Transports",
  energy: "Eau et énergie", education: "Enseignement", administration: "Services publics",
};
type Tone = "navy" | "red" | "gold" | "muted";
const badge = (label: string, tone: Tone = "navy") => `<span class="map-panel__status" data-panel-tone="${tone}">${e(label)}</span>`;
const section = (eyebrow: string, title: string, body: string, attributes = "") =>
  `<section class="map-panel__section" ${attributes}><header class="map-panel__section-heading"><p class="map-panel__eyebrow">${eyebrow}</p><h3>${title}</h3></header>${body}</section>`;

/** On-demand views read the saved campaign; consulting them never advances time. */
export function mapGovernmentPanel(game: Game): string {
  const politics = game.politics;
  if (!politics) return `<section class="map-panel map-panel--government" data-map-government><p class="map-panel__empty">Le gouvernement sera constitué au début du mandat.</p></section>`;
  const cabinet = { stable: "Gouvernement en place", fallen: "Gouvernement censuré", cohabitation: "Cohabitation" }[politics.cabinet];
  const seats = politics.blocs.reduce((total, bloc) => total + bloc.seats, 0);
  const support = politics.blocs.filter(bloc => bloc.inGovernment).reduce((total, bloc) => total + bloc.seats, 0);
  const majority = Math.floor(seats / 2) + 1;
  const margin = support - majority;
  const vote = politics.lastVote;
  const outcome = vote ? politicalVoteOutcome(vote) : undefined;
  const commitments = politics.commitments.filter(item => item.status === "pending").sort((a, b) => a.dueTurn - b.dueTurn);
  const crisisNames = {
    coalition: "Un accord de coalition reste à trouver.", censure: "Une motion de censure menace le gouvernement.",
    cabinet: "Un nouveau gouvernement doit être constitué.", scandal: "Une affaire fragilise le pouvoir.",
    destitution: "Une procédure de destitution est ouverte.", rupture: "La continuité du mandat est en jeu.",
  };
  const crisis = politics.institutionalCrisis;
  const alert = politics.ending ? politics.ending.reason
    : crisis?.stage === "regime" ? "La crise institutionnelle engage désormais la continuité du mandat."
    : crisis?.stage === "national" ? `${crisis.remaining} décision${crisis.remaining > 1 ? "s" : ""} pour réparer la crise institutionnelle. Un nouveau manquement raccourcit ce délai.`
    : politics.pendingCrisis ? crisisNames[politics.pendingCrisis] : "";
  const majorityDetail = margin === 0 ? "Le seuil de majorité absolue est atteint."
    : margin > 0 ? `${margin} siège${margin > 1 ? "s" : ""} au-dessus du seuil de majorité absolue.`
    : `${Math.abs(margin)} siège${margin < -1 ? "s" : ""} manque${margin < -1 ? "nt" : ""} pour atteindre la majorité absolue.`;
  const blocList = politics.blocs.map(bloc => `<li data-panel-bloc="${bloc.id}"><span class="map-panel__bloc-name"><i aria-hidden="true"></i><span>${e(bloc.label)}<small>${bloc.inGovernment ? "Soutien au gouvernement" : "Opposition"}</small></span></span><strong>${bloc.seats}<small>sièges</small></strong></li>`).join("");
  const voteMarkup = vote && outcome ? `<div class="map-panel__vote"><div class="map-panel__vote-heading">${badge(outcome.label, outcome.adverse ? "red" : "navy")}<span>${e(vote.chamber)}</span></div><h4>${e(vote.title)}</h4>${vote.kind === "election"
    ? `<p>${vote.groups.every(group => group.seats !== undefined) ? `Répartition enregistrée : ${vote.groups.map(group => `${e(group.label)} ${number(group.seats!)} sièges`).join(" · ")}.` : "La composition actuelle de l’Assemblée figure ci-dessus."}</p>`
    : `<dl class="map-panel__vote-tally"><div><dt>Pour</dt><dd>${number(vote.for)}</dd></div><div><dt>Contre</dt><dd>${number(vote.against)}</dd></div><div><dt>Abstentions</dt><dd>${number(vote.abstain)}</dd></div></dl>${vote.stages?.length ? `<p class="map-panel__caption">${vote.stages.map(stage => `${e(stage.chamber)} : ${number(stage.for)} pour, ${number(stage.against)} contre, ${number(stage.abstain)} abstentions`).join(" · ")}.</p>` : ""}`}</div>` : `<p class="map-panel__empty">Le premier vote apparaîtra ici après votre décision.</p>`;
  return `<section class="map-panel map-panel--government" data-map-government>
    <header class="map-panel__intro"><p class="map-panel__eyebrow">L’équilibre politique</p><p class="map-panel__lead">${cabinet}</p><p>Vos soutiens à l’Assemblée déterminent les accords à construire pour faire voter vos textes.</p></header>
    ${alert ? `<aside class="map-panel__alert" role="note"><span class="map-panel__eyebrow">À traiter</span><p>${e(alert)}</p></aside>` : ""}
    <section class="map-panel__majority" aria-label="Soutiens à l’Assemblée"><div class="map-panel__majority-top"><div><span class="map-panel__eyebrow">${margin >= 0 ? "Majorité de coalition" : "Majorité relative"}</span><p><strong>${support}</strong><span> / ${seats} sièges</span></p></div><span class="map-panel__majority-threshold">${majority}<small>majorité absolue</small></span></div><div class="map-panel__seat-bar" aria-hidden="true" style="--majority-position:${majority / Math.max(1, seats) * 100}%">${politics.blocs.map(bloc => `<span data-panel-bloc="${bloc.id}" style="flex-grow:${bloc.seats}"></span>`).join("")}</div><p class="map-panel__caption">${majorityDetail} Les soutiens ne garantissent pas chaque vote.</p></section>
    <dl class="map-panel__indicators"><div><dt>Légitimité</dt><dd>${number(politics.legitimacy)}<small>/100</small></dd></div><div><dt>Tension sociale</dt><dd>${number(politics.unrest)}<small>/100</small></dd></div>${game.version >= 11 ? `<div><dt>Contre-pouvoirs</dt><dd>${number(politics.ruleOfLaw)}<small>/100</small></dd></div>` : ""}</dl>
    ${section("Assemblée nationale", "Les forces en présence", `<ul class="map-panel__list">${blocList}</ul>`)}
    ${section(`${commitments.length} engagement${commitments.length > 1 ? "s" : ""} en attente`, "La parole donnée", commitments.length ? `<ol class="map-panel__commitments">${commitments.map(item => `<li><span>${e(item.label)}</span><small>À tenir à la décision ${item.dueTurn + 1}</small></li>`).join("")}</ol>` : `<p class="map-panel__empty">Aucun engagement politique en attente.</p>`)}
    ${section("Dernier scrutin", "Ce que l’Assemblée a décidé", voteMarkup)}
    <p class="map-panel__footnote">Situation du mandat simulé. Les indices et les groupes politiques appartiennent au scénario.</p>
  </section>`;
}

function programmeStatus(programme: PressureProgramme): { label: string; tone: Tone } {
  if (programme.status === "preparing") return { label: "En préparation", tone: "gold" };
  if (programme.status === "cancelled") return { label: "Annulé", tone: "muted" };
  if (programme.status === "active") return { label: "En service", tone: "navy" };
  if (programme.duration) return { label: "Terminé", tone: "muted" };
  return { label: (programme.capacity ?? 0) < 0 || (programme.need ?? 0) > 0 ? "Appliqué" : "En service", tone: "navy" };
}

function programmeTiming(programme: PressureProgramme, game: Game): string {
  if (programme.status === "preparing") return `Au plus tôt à la décision ${programme.dueTurn}${programme.dueTurn <= game.turn ? " · échéance atteinte" : ""}`;
  if (programme.status === "cancelled") return "Mise en place annulée";
  if (programme.status === "completed" && programme.duration) return `Renfort terminé${programme.endsTurn !== undefined ? ` à la décision ${programme.endsTurn}` : ""}`;
  return `Depuis la décision ${programme.deliveredTurn ?? programme.dueTurn}${programme.endsTurn !== undefined ? ` · fin prévue à la décision ${programme.endsTurn}` : ""}`;
}

function programmeWait(programme: PressureProgramme, game: Game): string {
  if (programme.status !== "preparing") return "";
  if (programme.socialMovementId) {
    const commitment = game.social?.movements.find(item => item.id === programme.socialMovementId)?.commitment;
    if (commitment?.status !== "kept") return "L’engagement social doit être réellement mis en œuvre avant l’arrivée des moyens.";
  }
  const project = programme.projectId ? game.narrative?.projects.find(item => item.id === programme.projectId) : undefined;
  if (project?.status === "blocked") return project.note;
  if (programme.remainingWork > .0001) return "Les équipes de mise en œuvre sont partagées entre les chantiers. Le financement reste engagé.";
  if (programme.dueTurn > game.turn) return "Le délai minimal de mise en place court encore.";
  if (project && project.status !== "delivered") return "Les moyens attendent la livraison effective du projet d’origine.";
  return "La mise en service attend la prochaine période de décision.";
}

function programmeEffects(programme: PressureProgramme): string {
  const applied = programme.status === "active" || programme.status === "completed" && !programme.duration;
  const capacity = applied ? programme.appliedCapacity ?? programme.capacity : programme.capacity;
  const need = applied ? programme.appliedNeed ?? programme.need : programme.need;
  const change = (value: number) => `${value > 0 ? "+" : ""}${number(value)}`;
  const effects = [capacity ? `<div><dt>Capacité / période</dt><dd>${change(capacity)}</dd></div>` : "",
    need ? `<div><dt>Besoins / période</dt><dd>${change(need)}</dd></div>` : "",
    programme.backlog ? `<div><dt>Ajustement de file prévu</dt><dd>${change(programme.backlog)}</dd></div>` : "",
    programme.fatigue ? `<div><dt>Ajustement de fatigue prévu</dt><dd>${change(programme.fatigue)}<small> points</small></dd></div>` : "",
  ].filter(Boolean).join("");
  return effects ? `<div class="map-panel__effects"><p class="map-panel__eyebrow">${programme.status === "preparing" ? "Effets à la mise en service" : programme.status === "cancelled" ? "Effets non livrés" : programme.status === "completed" && programme.duration ? "Effets du renfort terminé" : "Effets mis en place"}</p><dl>${effects}</dl><p class="map-panel__caption">Unités de besoin simulées${programme.fatigue ? " ; fatigue en points" : ""}.</p></div>` : "";
}

function sourceDetails(game: Game, ids: string[]): string {
  const choices = [...new Set(ids)].flatMap(id => {
    const turn = game.history.findIndex(item => item.choice === id);
    const choice = game.history[turn]?.dossier?.choices.find(item => item.id === id);
    return turn < 0 ? [] : [{ turn, choice }];
  });
  return choices.length ? `<details class="map-panel__origin map-subject__details"><summary>Origine et financement</summary>${choices.map(({ turn, choice }) => `<div><p class="map-panel__eyebrow">Décision ${turn + 1}</p>${choice ? `<p><strong>${e(choice.title)}</strong></p><p>${e(choice.cost)}</p>` : `<p>Décision enregistrée dans le mandat.</p>`}</div>`).join("")}<p class="map-panel__caption">Coûts annoncés lors de l’engagement. Les dépenses déjà acquises restent dans les comptes.</p></details>` : "";
}

function programmeBody(programme: PressureProgramme, game: Game): string {
  const wait = programmeWait(programme, game);
  return `<dl class="map-panel__milestones"><div><dt>${programme.status === "preparing" ? "Échéance minimale" : "Calendrier"}</dt><dd>${programmeTiming(programme, game)}</dd></div>${programme.status === "preparing" ? `<div><dt>Travail restant</dt><dd>${number(programme.remainingWork)} unité${programme.remainingWork > 1 ? "s" : ""} d’exécution</dd></div>` : ""}</dl>${wait ? `<p class="map-panel__project-note">${e(wait)}</p>` : programme.status === "completed" && programme.duration ? `<p class="map-panel__project-note">Le renfort a pris fin ; les dépenses engagées restent dans les comptes.</p>` : ""}${programmeEffects(programme)}`;
}

function programmeCard(programme: PressureProgramme, game: Game): string {
  const status = programmeStatus(programme);
  return `<article class="map-panel__project" data-pressure-programme="${e(programme.id)}" data-panel-state="${programme.status}"><header><div><p class="map-panel__eyebrow">${sectorNames[programme.sector]}</p><h4>${e(programme.label)}</h4></div>${badge(status.label, status.tone)}</header>${programmeBody(programme, game)}${sourceDetails(game, [programme.sourceChoice])}</article>`;
}

function narrativeProjectCard(project: NarrativeProject, programmes: PressureProgramme[], game: Game): string {
  const statuses = { funded: "En préparation", blocked: "Bloqué", delivered: "Livré", withdrawn: "Abandonné" } as const;
  const tone: Tone = project.status === "blocked" ? "red" : project.status === "funded" ? "gold" : project.status === "withdrawn" ? "muted" : "navy";
  const current = programmes.filter(item => item.status === "preparing" || item.status === "active" || item.status === "completed" && !item.duration);
  const history = programmes.filter(item => !current.includes(item));
  const endTurn = project.status === "delivered" ? project.deliveredTurn ?? project.resolvedTurn ?? project.dueTurn : project.status === "withdrawn" ? project.resolvedTurn ?? project.dueTurn : project.dueTurn;
  return `<article class="map-panel__project" data-narrative-project="${e(project.id)}" data-panel-state="${project.status}"><header><div><p class="map-panel__eyebrow">${e(project.place)}</p><h4>${e(project.label)}</h4></div>${badge(statuses[project.status], tone)}</header><ol class="map-panel__steps" aria-label="Étapes du chantier"><li data-step="done">Engagé</li><li data-step="${project.status === "delivered" ? "done" : project.status === "withdrawn" ? "stopped" : "current"}">${project.status === "blocked" ? "Bloqué" : project.status === "withdrawn" ? "Arrêté" : "Réalisation"}</li><li data-step="${project.status === "delivered" ? "done" : "next"}">Livré</li></ol><p class="map-panel__project-note">${e(project.note)}</p><dl class="map-panel__milestones"><div><dt>Engagement</dt><dd>Décision ${project.startedTurn + 1}</dd></div><div><dt>${project.status === "delivered" ? "Livraison" : project.status === "withdrawn" ? "Abandon" : "Échéance prévue"}</dt><dd>Décision ${endTurn + 1}</dd></div></dl>${current.map(programme => `<div class="map-panel__linked-programme" data-pressure-programme="${e(programme.id)}"><p class="map-panel__eyebrow">${sectorNames[programme.sector]} · moyens liés au chantier</p>${programmeBody(programme, game)}</div>`).join("")}${history.length ? `<details class="map-panel__origin map-subject__details"><summary>Interventions liées terminées (${history.length})</summary>${history.map(programme => `<div data-pressure-programme="${e(programme.id)}"><h5>${e(programme.label)}</h5>${programmeBody(programme, game)}</div>`).join("")}</details>` : ""}${sourceDetails(game, [project.sourceChoice, ...(project.remediationChoice ? [project.remediationChoice] : []), ...programmes.map(item => item.sourceChoice)])}</article>`;
}

export function mapProjectsPanel(game: Game): string {
  const projects = game.narrative?.projects ?? [];
  const programmes = game.pressure?.programmes ?? [];
  // A narrative project and its capacity programme describe one chantier, not two.
  const linkedIds = new Set(projects.map(project => project.id));
  const standalone = programmes.filter(programme => !programme.projectId || !linkedIds.has(programme.projectId));
  const cardFor = (project: NarrativeProject) => narrativeProjectCard(project, programmes.filter(programme => programme.projectId === project.id), game);
  const preparing = standalone.filter(programme => programme.status === "preparing").sort((a, b) => a.dueTurn - b.dueTurn || a.sourceTurn - b.sourceTurn);
  const inPlace = standalone.filter(programme => programme.status === "active" || programme.status === "completed" && !programme.duration).sort((a, b) => (b.deliveredTurn ?? 0) - (a.deliveredTurn ?? 0));
  const history = standalone.filter(programme => programme.status === "cancelled" || programme.status === "completed" && !!programme.duration).sort((a, b) => b.sourceTurn - a.sourceTurn);
  const pendingProjects = projects.filter(project => project.status === "funded" || project.status === "blocked").sort((a, b) => Number(b.status === "blocked") - Number(a.status === "blocked") || a.dueTurn - b.dueTurn);
  const delivered = projects.filter(project => project.status === "delivered").sort((a, b) => (b.deliveredTurn ?? b.dueTurn) - (a.deliveredTurn ?? a.dueTurn));
  const withdrawn = projects.filter(project => project.status === "withdrawn");
  const blocked = pendingProjects.filter(project => project.status === "blocked").length;
  const pending = pendingProjects.length + preparing.length;
  const operating = delivered.length + inPlace.length;
  const execution = game.pressure?.execution;
  const allCount = projects.length + standalone.length;
  return `<section class="map-panel map-panel--projects" data-map-projects><header class="map-panel__intro"><p class="map-panel__eyebrow">De la décision au terrain</p><p class="map-panel__lead">Vos projets, à l’œuvre.</p><p>Les projets financés se préparent. Leurs bénéfices arrivent quand les moyens sont réellement en place.</p></header><dl class="map-panel__indicators"><div><dt>À faire avancer</dt><dd>${pending}</dd></div><div><dt>Bloqué${blocked > 1 ? "s" : ""}</dt><dd>${blocked}</dd></div><div><dt>En service</dt><dd>${operating}</dd></div></dl>${execution ? `<aside class="map-panel__execution"><div><span class="map-panel__eyebrow">Équipes de mise en œuvre</span><p><strong>${number(execution.used)}</strong><span> / ${number(execution.capacity)} unités mobilisées</span></p></div><meter min="0" max="${execution.capacity}" value="${execution.used}" aria-label="Capacité d’exécution utilisée : ${number(execution.used)} sur ${number(execution.capacity)}">${number(execution.used)} / ${number(execution.capacity)}</meter><p class="map-panel__caption">Capacité partagée pendant la dernière période. ${execution.waiting ? `${execution.waiting} programme${execution.waiting > 1 ? "s" : ""} attend${execution.waiting > 1 ? "ent" : ""} encore sa mise en service.` : "Aucun programme en attente de mise en service."}</p></aside>` : ""}${pending ? section("Suivi prioritaire", "À faire avancer", `<div class="map-panel__project-grid">${pendingProjects.map(cardFor).join("")}${preparing.map(programme => programmeCard(programme, game)).join("")}</div>`, "data-pressure-preparing") : ""}${operating ? section("Les réalisations du mandat", "Déjà en service", `<div class="map-panel__project-grid">${delivered.map(cardFor).join("")}${inPlace.map(programme => programmeCard(programme, game)).join("")}</div>`, "data-pressure-in-service") : ""}${history.length || withdrawn.length ? `<details class="map-panel__archive map-subject__details" data-pressure-programme-history><summary>Projets arrêtés et interventions terminées (${history.length + withdrawn.length})</summary><div class="map-panel__project-grid">${withdrawn.map(cardFor).join("")}${history.map(programme => programmeCard(programme, game)).join("")}</div></details>` : ""}${!allCount ? `<div class="map-panel__empty-state"><h3>Tout commence par une décision.</h3><p>Les projets financés et les interventions engagées apparaîtront ici, avec leurs délais et leurs moyens.</p></div>` : ""}<p class="map-panel__footnote">Hypothèses de simulation. Une période représente deux mois ; les unités d’exécution et de besoin décrivent le scénario. Consulter cette page ne fait pas avancer le temps.</p></section>`;
}
