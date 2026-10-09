import {
  calendarFor,
  choicesFor,
  domainFor,
  preview,
  storyContextOptions,
  narrativeElectionOutcome,
} from "./engine.ts";
import { annualDeficit } from "./national-deficit.ts";
import {
  mapState,
  markerLabel,
  placeForTopic,
  MAP_PLACES,
  mapSourcePosition,
} from "./map-state.ts";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { escape } from "./sharing.ts";
import { focusedNarrativeEvent } from "./narrative-engine.ts";
import { iconForTopic, mapIcon, toneForTopic } from "./map-icons.ts";
import type { Game } from "./types.ts";
import type { StoryAgendaItem } from "./narrative-types.ts";

export const cleanGameText = (text: string) =>
  text
    .replace(/[—–]/g, ", ")
    .replace(/[←→↗↘↔›‹»«]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const e = (text: string) => escape(cleanGameText(text));
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0];
// The agenda identifies the problem; opening it retains the full question and choices.
const agendaEventTitles: Record<string, string> = {
  "soins-garde-nuit": "Équipes de nuit incomplètes",
  "soins-lits-aval": "Patients sans relais",
  "soins-desert-medical": "Consultations trop éloignées",
  "industrie-aide-contre-emplois": "Aide avant les embauches",
  "industrie-commandes-locales": "PME et marchés publics",
  "industrie-site-pollue": "Sol industriel à vérifier",
  "energie-bus-usine": "Bus du soir sans chauffeur",
  "energie-menages-captifs": "Chauffage sans solution",
  "energie-reseau-partage": "Financer le raccordement",
  "recrutement-postes-vacants": "Postes vacants, horaires réduits",
  "integration-diplomes": "Diplômes étrangers en attente",
  "integration-logement-travail": "Recrues sans logement",
  "integrite-interets": "Marché public à vérifier",
  "integrite-alerte": "Alerte sur un marché public",
  "integrite-pieces": "Contrat et confidentialité",
  "logement-expulsions": "Expulsions imminentes",
  "logement-vacants": "Logements vides et attente",
  "logement-construction": "Logements ou parc près de la gare",
  "suite-soins-service-bloque": "Travaux hospitaliers bloqués",
  "suite-industrie-site-bloque": "Dépollution en retard",
  "suite-energie-recharge-bloquee": "Recharge des bus bloquée",
  "suite-recrutement-residence-bloquee": "Résidence des recrues en retard",
  "suite-integrite-audit-bloque": "Audit du marché en retard",
  "suite-logement-programme-bloque": "Logements de la gare en retard",
  "ia-usine": "Automatisation de l’usine",
  "eau-equipes": "Fuite d’eau et réserves basses",
  "cyber-hopital": "Cyberattaque à l’hôpital",
  "port-bloque": "Grève au port",
  "science-stockage": "Stockage d’énergie à tester",
  "chaleur-ecoles": "Écoles face aux fortes chaleurs",
  "logements-vacants": "Emplois loin des logements",
  "ia-services": "IA pour les démarches publiques",
  "education-lycees": "Classes à regrouper",
};
function agendaTitle(item: Pick<StoryAgendaItem, "id" | "title">, game: Game): string {
  const movement = game.social?.movements.find(
    (candidate) => candidate.id === item.id && candidate.status === "active",
  );
  if (movement) {
    return {
      lyceens: "Mobilisation lycéenne",
      salaries: "Salariés mobilisés",
      retraites: "Retraités mobilisés",
      agents: "Agents publics mobilisés",
      menages: "Ménages modestes mobilisés",
    }[movement.actor];
  }
  if (item.id.startsWith("institutional:") && item.title === "Le prélèvement sur les patrimoines finance l’hôpital.") {
    return "Patrimoines et hôpital";
  }
  if (item.id.startsWith("policy:") && item.title === "Faut-il réduire les pensions pour diminuer le déficit ?") {
    return "Pensions et déficit";
  }
  return agendaEventTitles[item.id] ?? item.title;
}
const agendaTitleClass = (title: string) => title.length > 64
  ? "map-agenda__item--long-title"
  : title.length > 42 ? "map-agenda__item--medium-title" : "";
function fallbackMap() {
  const paths = FRANCE_OUTLINES.map(
    (outline) =>
      outline
        .map(([lon, lat], i) => {
          const { x, z } = mapSourcePosition(lon, lat);
          return `${i ? "L" : "M"}${500 + x * 72},${450 - z * 72}`;
        })
        .join(" ") + "Z",
  );
  return `<svg data-map-fallback class="mandate-map__fallback" viewBox="0 0 1000 920" role="img" aria-label="Carte de France : les sujets restent accessibles même sans rendu 3D"><defs><linearGradient id="country-ground" x2="0.8" y2="1"><stop stop-color="#b7b78d"/><stop offset="1" stop-color="#7f936b"/></linearGradient></defs>${paths.map((path) => `<path d="${path}" fill="url(#country-ground)" stroke="#e3d7ac" stroke-width="2"/>`).join("")}</svg>`;
}
function geographicLabels(): string {
  const labels = [
    { id: "manche", name: "Manche", lon: -2.8, lat: 50.55, kind: "sea" },
    { id: "atlantique", name: "Océan Atlantique", lon: -4.1, lat: 45.5, kind: "sea" },
    { id: "mediterranee", name: "Mer Méditerranée", lon: 6.1, lat: 42.7, kind: "sea" },
    { id: "belgique", name: "Belgique", lon: 4.8, lat: 50.9, kind: "country" },
    { id: "allemagne", name: "Allemagne", lon: 8.1, lat: 50.2, kind: "country" },
    { id: "suisse", name: "Suisse", lon: 7.9, lat: 46.8, kind: "country" },
    { id: "italie", name: "Italie", lon: 9.1, lat: 45.3, kind: "country" },
    { id: "espagne", name: "Espagne", lon: -1.9, lat: 43.0, kind: "country" },
    { id: "corse", name: "Corse", lon: 9.25, lat: 41.7, kind: "island" },
  ];
  return `<div class="map-geography-labels" aria-hidden="true">${labels.map(label => `<span hidden class="map-geographic-label" data-map-label="${label.id}" data-lon="${label.lon}" data-lat="${label.lat}" data-label-kind="${label.kind}">${label.kind === "sea" ? label.name.split(" ").join("<br>") : label.name}</span>`).join("")}</div>`;
}
export function mapWorld(game: Game | null): string {
  const state = mapState(game);
  return `<section class="mandate-map" data-mandate-map data-renderer="loading" data-movements="${state.movements.length}" aria-label="Carte de France et sujets du mandat">
    ${fallbackMap()}<canvas data-map-canvas class="mandate-map__canvas" aria-hidden="true"></canvas>${geographicLabels()}
    <div class="mandate-map__markers" data-map-markers>${state.markers
      .map((item, index) => {
        const { x, z } = item.id.startsWith("policy:") ? { x: 0, z: 0 } :
          mapSourcePosition(MAP_PLACES[item.place].lon, MAP_PLACES[item.place].lat);
        return `<button class="map-marker map-tone--${toneForTopic(item)} ${item.urgent ? "map-marker--urgent" : ""} ${state.selected === item.id ? "is-selected" : ""}" data-map-marker="${e(item.id)}" data-action="story-select" data-story-id="${e(item.id)}" style="left:${50 + x * 7.2 + index * 2}%;top:${49 - z * 7.8 + index * 5}%" aria-label="${e(item.title)}${item.id.startsWith("policy:") ? " · portée nationale" : ` · ${e(markerLabel(item))}`}" aria-pressed="${state.selected === item.id}"><span class="map-marker__point" aria-hidden="true">${mapIcon(iconForTopic(item))}</span><span class="map-marker__anchor" data-map-anchor aria-hidden="true"></span><span class="map-marker__label">${e(item.label)}</span></button>`;
      })
      .join(
        "",
      )}${state.tracking.map((item) => `<button class="map-marker map-marker--tracking map-tone--blue" data-map-marker="${e(item.id)}" data-action="map-track" data-track-id="${e(item.id)}" aria-label="${e(item.title)} · ${e(item.label)} · En préparation"><span class="map-marker__point" aria-hidden="true">${mapIcon("project")}</span><span class="map-marker__anchor" data-map-anchor aria-hidden="true"></span><span class="map-marker__label">${e(item.label)}<small>En préparation</small></span></button>`).join("")}</div>
    <div class="map-camera" aria-label="Caméra de la carte"><div class="map-camera__zoom"><button data-action="map-camera" data-camera="in" aria-label="Agrandir la carte">+</button><button data-action="map-camera" data-camera="out" aria-label="Réduire la carte">−</button></div><button class="map-camera__overview" data-action="map-camera" data-camera="reset">${mapIcon("locate")}<span>Vue France</span></button></div>
    <p class="map-geography-note">France · situations simulées</p>
    <p class="map-render-status" data-map-status role="status">La carte se prépare.</p>
  </section>`;
}
function mapHeader(game: Game | null) {
  const reading = (label: string, value: number, icon: "institution" | "people", tone: "blue" | "red") => {
    const score = Math.max(0, Math.min(100, Math.round(value)));
    return `<span class="map-game__metric map-game__metric--${tone}" aria-label="${label} ${score} sur 100">${mapIcon(icon)}<span class="map-game__metric-copy"><span class="map-game__metric-title">${label}<strong>${score}</strong></span><span class="map-game__bar" style="--map-reading:${score}%" aria-hidden="true"></span></span></span>`;
  };
  let status = "";
  if (game) {
    const year = calendarFor(game).year;
    const deficit = annualDeficit(game);
    const sustainability = Math.max(0, Math.min(100, Math.round(domainFor(game).sustainability(game))));
    const budgetDescription = `${deficit > 0 ? "Déficit" : deficit < 0 ? "Excédent" : "Équilibre"} annuel ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Math.abs(deficit))} milliards d’euros, soutenabilité ${sustainability} sur 100`;
    status = `<span class="map-game__calendar"><span class="map-game__year">Année ${year} / 5</span><span class="map-game__years" aria-hidden="true">${Array.from({ length: 5 }, (_, index) => `<i${index + 1 === year ? ' class="is-current"' : index + 1 < year ? ' class="is-complete"' : ""}></i>`).join("")}</span></span>${reading("Services", game.metrics.services, "institution", "blue")}${reading("Confiance", game.metrics.trust, "people", "red")}<button class="map-game__budget" data-action="view" data-view="finance" aria-label="État du pays" aria-describedby="map-budget-description">${mapIcon("budget")}<span class="map-game__metric-copy"><span class="map-game__budget-title">${deficit > 0 ? mapIcon("alert") : ""}${deficit > 0 ? "Budget sous tension" : deficit < 0 ? "Budget excédentaire" : "Budget à l’équilibre"}</span><span class="map-game__bar" style="--map-reading:${sustainability}%" aria-hidden="true"></span></span><span class="map-game__budget-compact">État du pays</span></button><span id="map-budget-description" class="map-visually-hidden">${budgetDescription}</span>`;
  }
  return `<header class="map-game__header"><a href="/mandats/" class="map-game__brand" aria-label="Accueil Mandats">MANDATS</a><div class="map-game__status${game ? "" : " map-game__status--empty"}">${status}<button class="map-game__tools" data-action="tools" aria-label="Ma partie" title="Ma partie">${mapIcon("settings")}<span class="map-game__tools-label">Ma partie</span></button></div></header>`;
}
function mapFooter(active: "country" | "finance" | null): string {
  return `<footer class="map-game__footer"><nav aria-label="Vues du mandat"><button data-action="view" data-view="decision"${active === "country" ? ' aria-current="page"' : ""}>${mapIcon("country")}<span>Pays</span></button><button data-action="map-government" aria-haspopup="dialog">${mapIcon("institution")}<span>Gouvernement</span></button><button data-action="map-projects" aria-haspopup="dialog">${mapIcon("project")}<span>Projets</span></button><button data-action="view" data-view="finance"${active === "finance" ? ' aria-current="page"' : ""}>${mapIcon("balance")}<span>Bilan</span></button></nav><p class="map-game__fiction">Scénario fictif</p></footer>`;
}
export function mapEntry(saved: Game | null): string {
  const contexts = {
    coalition: "Une coalition fragile",
    hospital: "Un hôpital à sauver",
    redress: "Des comptes à redresser",
  };
  return `<section class="map-game map-game--entry">${mapHeader(null)}${mapWorld(null)}<section class="map-entry"><p class="map-entry__kicker">GOUVERNER LA FRANCE</p><h1 tabindex="-1">Tenir cinq ans.</h1><p>Des sujets apparaissent dans le pays. Vos décisions changent leur suite.</p>${saved ? `<button class="map-primary" data-action="resume">Reprendre</button><p class="map-entry__saved">Année ${calendarFor(saved).year} · ${saved.turn} décisions enregistrées</p>` : ""}<button class="${saved ? "map-secondary" : "map-primary"}" data-action="new-run">${saved ? "Nouveau mandat" : "Commencer un mandat"}</button><details class="map-entry__contexts"><summary>Choisir une situation de départ</summary>${storyContextOptions()
    .map(
      (item) =>
        `<button data-action="start-context" data-context="${item.context}">${contexts[item.context]}</button>`,
    )
    .join(
      "",
    )}</details><a href="/mandats/methode/">Règles et méthode</a></section></section>`;
}
export function mapGame(game: Game, shared = false): string {
  const markers = mapState(game).markers;
  const primary = markers.find(item => item.urgent) ?? markers[0];
  const agenda = primary ? [primary, ...markers.filter(item => item.id !== primary.id)] : markers;
  const focus = agenda.find((item) => item.id === game.narrative?.focus);
  const dossier = focus ? domainFor(game).dossiers[game.turn] : undefined;
  const event = focus ? focusedNarrativeEvent(game) : undefined;
  const choices = focus ? choicesFor(game) : [];
  const place = focus ? MAP_PLACES[placeForTopic(focus)] : undefined;
  const summary = focus ? firstSentence(focus.summary) : "";
  const details = focus
    ? `<details class="map-subject__details"><summary>Voir les détails</summary><p>${e(focus.summary)}</p>${choices.map((choice) => `<section><h3>${e(choice.title)}</h3><p>${e(choice.description)}</p><p>${e(choice.cost)}</p><p>${e(choice.benefit)}</p>${choice.delayed ? `<p>Après ${choice.delayed.after} année${choice.delayed.after > 1 ? "s" : ""} : ${e(choice.delayed.label)}</p>` : ""}</section>`).join("")}<p class="map-fiction-note">Événement fictif du scénario. ${focus.id.startsWith("policy:") || focus.id.startsWith("institutional:") ? "Décision de portée nationale." : `${e(place!.name)} sert de repère géographique ; les personnes et organismes sont simulés.`}</p></details>`
    : "";
  const urgent =
    focus?.dueTurn !== undefined
      ? `<p class="map-subject__deadline">À décider avant la décision ${focus.dueTurn + 1}</p>`
      : focus?.id.startsWith("mvt-")
        ? `<p class="map-subject__deadline">${e(String(focus.urgency))}</p>`
        : "";
  return `<section class="map-game map-game--playing ${focus ? "map-game--focused" : ""}" data-map-game data-turn="${game.turn}">${mapHeader(game)}${mapWorld(game)}
    <section class="map-subject ${focus ? "" : "map-subject--agenda"}" ${focus ? "data-map-decision" : "data-map-agenda"}>
      ${
        focus
          ? `<p class="map-subject__eyebrow map-tone--${toneForTopic(focus)}"><span class="map-topic-icon">${mapIcon(iconForTopic(focus))}</span>${e(focus.label)}</p><header><h1 tabindex="-1">${e(event?.title ?? dossier?.title ?? focus.title)}</h1><button data-action="map-close" aria-label="Fermer le sujet">Fermer</button></header><p class="map-subject__intro">${e(summary)}</p>${urgent}<div class="map-choices">${choices
              .map((choice) => {
                const error = preview(game, choice.id).error;
                const cost = Math.max(
                  Math.abs(choice.effect.investment ?? 0),
                  Math.abs(choice.effect.operating ?? 0),
                  Math.abs(choice.effect.revenue ?? 0),
                );
                return `<button class="choice map-choice" data-action="choose" data-choice="${e(choice.id)}" ${error ? "disabled" : ""}><strong>${e(choice.title)}</strong><span>${e(choice.sacrifice)}</span><span class="map-choice__footer">${cost >= 1 ? `<small>${e(choice.cost)}</small>` : ""}<span class="map-choice__action" aria-hidden="true">Choisir</span></span>${error ? `<span class="choice-error">${e(error)}</span>` : ""}</button>`;
              })
              .join(
                "",
              )}</div>${focus.id.startsWith("policy:") ? "" : `<button class="map-inspect" data-action="map-inspect" data-place="${placeForTopic(focus)}">Voir le lieu</button>`}${details}`
          : `<h1 tabindex="-1" class="map-agenda__heading">À traiter</h1><div class="map-agenda">${agenda.map((item, index) => { const title = agendaTitle(item, game); return `<button class="map-agenda__item map-tone--${toneForTopic(item)} ${agendaTitleClass(title)} ${item.urgent ? "map-agenda__item--urgent" : ""} ${index === 0 ? "map-agenda__item--primary" : ""}" data-action="story-select" data-story-id="${e(item.id)}" aria-label="${e(item.title)} · ${e(item.label)}${item.urgent ? " · Urgent" : ""}"><span class="map-topic-icon">${mapIcon(iconForTopic(item))}</span><span class="map-agenda__copy"><strong>${e(title)}</strong><span class="map-agenda__meta">${e(item.label)}${item.urgent ? ' · <b>Urgent</b>' : ""}</span></span>${index === 0 ? '<span class="map-agenda__action" aria-hidden="true">Ouvrir le sujet</span>' : ""}</button>`; }).join("")}</div><ul class="map-agenda__legend" aria-label="Repères de la carte"><li class="map-tone--red"><span class="map-topic-icon">${mapIcon("people")}</span>Urgent</li><li class="map-tone--gold"><span class="map-topic-icon">${mapIcon("health")}</span>À surveiller</li><li class="map-tone--blue"><span class="map-topic-icon">${mapIcon("industry")}</span>Projet</li></ul>`
      }
      ${shared ? '<p class="map-fiction-note">Parcours partagé. Votre sauvegarde reste intacte.</p>' : ""}
    </section>${mapFooter("country")}
  </section>`;
}

const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
function countryReadings(game: Game): string {
  const balance = game.history.at(-1)?.ledger.deficit ?? annualDeficit(game);
  return `<dl class="map-readings"><div><dt>${balance < 0 ? "Excédent annuel" : "Déficit annuel"}</dt><dd>${amount.format(Math.abs(balance))}<small>Md€</small></dd></div><div><dt>Services publics</dt><dd>${Math.round(game.metrics.services)}<small>/ 100</small></dd></div><div><dt>Confiance</dt><dd>${Math.round(game.metrics.trust)}<small>/ 100</small></dd></div></dl>`;
}
function commitments(game: Game): string {
  const projects = game.narrative?.projects ?? [],
    movements = game.social?.movements ?? [];
  const projectNames = {
    funded: "En préparation",
    blocked: "Bloqué",
    delivered: "Livré",
    withdrawn: "Abandonné",
  } as const;
  return `<details class="map-subject__details"><summary>Projets et engagements</summary>${projects.length ? `<ul>${projects.map((item) => `<li><strong>${e(item.label)}</strong><p>${projectNames[item.status]} · ${e(item.note)}</p></li>`).join("")}</ul>` : "<p>Aucun projet engagé.</p>"}${movements.map((item) => `<p>${e(item.demand)} : ${item.status === "resolved" ? "mobilisation résolue" : item.commitment?.status === "pending" ? "moyens votés, mise en place attendue" : "mobilisation active"}.</p>`).join("")}${(game.narrative?.promises ?? []).map((item) => `<p>${e(item.label)} : ${({ active: "en cours", kept: "tenue", broken: "rompue" } as const)[item.status]}.</p>`).join("")}</details>`;
}
export function mapYear(game: Game): string {
  const year = game.history.at(-1)!.year,
    decisions = game.history.filter((item) => item.year === year);
  return `<section class="map-game map-game--playing">${mapHeader(game)}${mapWorld(game)}<section class="map-subject map-summary" data-map-year><p class="map-entry__kicker">ANNÉE ${year} ACHEVÉE</p><h1 tabindex="-1">Le mandat continue.</h1><p class="map-subject__intro">Les décisions de cette année restent inscrites dans le pays.</p>${countryReadings(game)}<button class="map-primary" data-action="next-year">Reprendre le mandat</button>${commitments(game)}<details class="map-subject__details"><summary>Les ${decisions.length} décisions de l’année</summary><ol>${decisions.map((item) => `<li>${e(item.title)}</li>`).join("")}</ol></details></section>${mapFooter("country")}</section>`;
}
export function mapResult(game: Game, shared = false): string {
  const complete = game.politics?.ending?.kind === "term_complete",
    epilogue = narrativeElectionOutcome(game);
  return `<section class="map-game map-game--playing">${mapHeader(null)}${mapWorld(game)}<article class="map-subject map-summary map-result" data-map-result><p class="map-entry__kicker">${shared ? "MANDAT PARTAGÉ" : complete ? "CINQ ANS ACCOMPLIS" : "MANDAT INTERROMPU"}</p><h1 tabindex="-1">${complete ? "Vous avez tenu cinq ans." : e(game.politics?.ending?.title ?? "Le mandat s’achève.")}</h1><p class="map-subject__intro">${complete ? `${game.turn} décisions. Le pays garde leurs conséquences.` : e(game.politics?.ending?.reason ?? `${game.turn} décisions enregistrées.`)}</p>${countryReadings(game)}<button class="map-primary" data-action="new-run">Nouveau mandat</button><button class="map-secondary" data-action="open-replay-selection">Rejouer un tournant du mandat</button><button class="map-inspect" data-action="view" data-view="finance">Consulter le bilan complet</button>${commitments(game)}${epilogue ? `<details class="map-subject__details"><summary>La suite politique</summary><h3>${e(epilogue.title)}</h3><p>${e(epilogue.detail)}</p></details>` : ""}<details class="map-subject__details"><summary>Partager ou retrouver ce scénario</summary><button class="map-secondary" data-action="share">Partager cet héritage</button><button class="map-secondary" data-action="replay">Rejouer exactement ce défi</button><p>Scénario ${game.seed} · version ${game.version} · simulation.</p></details></article>${mapFooter("country")}</section>`;
}
export function mapReview(
  game: Game,
  accounts: string,
  journal: string,
): string {
  return `<section class="map-game map-game--playing">${mapHeader(game)}${mapWorld(game)}<section class="map-subject map-summary" data-map-review><header><h1 tabindex="-1">État du pays</h1><button data-action="view" data-view="decision">Revenir au mandat</button></header>${countryReadings(game)}<details class="map-subject__details"><summary>Comptes et indicateurs</summary>${accounts}</details><details class="map-subject__details"><summary>Les effets sur les territoires</summary>${game.areas.map((item) => `<button class="map-secondary" data-action="area" data-area="${item.id}">${e(item.name)} · services ${Math.round(item.services)}/100</button>`).join("")}</details>${commitments(game)}<details class="map-subject__details"><summary>Le journal de vos décisions</summary>${journal}</details></section>${mapFooter("finance")}</section>`;
}
export function mapReplay(game: Game, content: string): string {
  return `<section class="map-game map-game--playing">${mapHeader(null)}${mapWorld(game)}<section class="map-subject map-summary map-replay">${content}</section>${mapFooter(null)}</section>`;
}
