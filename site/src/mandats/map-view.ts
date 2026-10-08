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
  mapPosition,
} from "./map-state.ts";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { escape } from "./sharing.ts";
import { focusedNarrativeEvent } from "./narrative-engine.ts";
import type { Game } from "./types.ts";

export const cleanGameText = (text: string) =>
  text
    .replace(/[—–]/g, ", ")
    .replace(/[←→↗↘↔›‹»«]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const e = (text: string) => escape(cleanGameText(text));
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0];
function fallbackMap() {
  const paths = FRANCE_OUTLINES.map(
    (outline) =>
      outline
        .map(([lon, lat], i) => {
          const { x, z } = mapPosition(lon, lat);
          return `${i ? "L" : "M"}${500 + x * 72},${450 - z * 72}`;
        })
        .join(" ") + "Z",
  );
  return `<svg data-map-fallback class="mandate-map__fallback" viewBox="0 0 1000 920" role="img" aria-label="Carte de France : les sujets restent accessibles même sans rendu 3D"><defs><linearGradient id="country-ground" x2="0.8" y2="1"><stop stop-color="#789979"/><stop offset="1" stop-color="#415e50"/></linearGradient></defs>${paths.map((path) => `<path d="${path}" fill="url(#country-ground)" stroke="#b8b591" stroke-width="2"/>`).join("")}</svg>`;
}
export function mapWorld(game: Game | null): string {
  const state = mapState(game);
  return `<section class="mandate-map" data-mandate-map data-renderer="loading" data-movements="${state.movements.length}" aria-label="Carte de France et sujets du mandat">
    ${fallbackMap()}<canvas data-map-canvas class="mandate-map__canvas" aria-hidden="true"></canvas>
    <div class="mandate-map__markers" data-map-markers>${state.markers
      .map((item, index) => {
        const { x, z } = mapPosition(
          MAP_PLACES[item.place].lon,
          MAP_PLACES[item.place].lat,
        );
        return `<button class="map-marker ${item.urgent ? "map-marker--urgent" : ""} ${state.selected === item.id ? "is-selected" : ""}" data-map-marker="${e(item.id)}" data-action="story-select" data-story-id="${e(item.id)}" style="left:${50 + x * 7.2 + index * 2}%;top:${49 - z * 7.8 + index * 5}%" aria-label="${e(item.title)}${item.id.startsWith("policy:") ? " · portée nationale" : ` · ${e(markerLabel(item))}`}" aria-pressed="${state.selected === item.id}"><span class="map-marker__point" aria-hidden="true"></span><span class="map-marker__label">${e(item.label)}</span></button>`;
      })
      .join(
        "",
      )}${state.tracking.map((item) => `<button class="map-marker map-marker--tracking" data-map-marker="${e(item.id)}" data-action="map-track" data-track-id="${e(item.id)}" aria-label="${e(item.title)} · ${e(item.label)}"><span class="map-marker__point" aria-hidden="true"></span><span class="map-marker__label">${e(item.label)} · En préparation</span></button>`).join("")}</div>
    <div class="map-camera" aria-label="Caméra de la carte"><button data-action="map-camera" data-camera="in" aria-label="Agrandir la carte">+</button><button data-action="map-camera" data-camera="out" aria-label="Réduire la carte">−</button><button data-action="map-camera" data-camera="reset">Recentrer</button></div>
    <p class="map-geography-note">France · situations simulées</p>
    <p class="map-render-status" data-map-status role="status"></p>
  </section>`;
}
function mapHeader(game: Game | null) {
  return `<header class="map-game__header"><a href="/mandats/" class="map-game__brand" aria-label="Accueil Mandats">MANDATS</a><div>${game ? `<span>Année ${calendarFor(game).year} / 5</span><button data-action="view" data-view="finance">État du pays</button>` : ""}<button data-action="tools">Ma partie</button></div></header>`;
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
  const agenda = mapState(game).markers;
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
  return `<section class="map-game ${focus ? "map-game--focused" : ""}" data-map-game data-turn="${game.turn}">${mapHeader(game)}${mapWorld(game)}
    <section class="map-subject ${focus ? "" : "map-subject--agenda"}" ${focus ? "data-map-decision" : "data-map-agenda"}>
      ${
        focus
          ? `<header><h1 tabindex="-1">${e(event?.title ?? dossier?.title ?? focus.title)}</h1><button data-action="map-close" aria-label="Fermer le sujet">Fermer</button></header><p class="map-subject__intro">${e(summary)}</p>${urgent}<div class="map-choices">${choices
              .map((choice) => {
                const error = preview(game, choice.id).error;
                const cost = Math.max(
                  Math.abs(choice.effect.investment ?? 0),
                  Math.abs(choice.effect.operating ?? 0),
                  Math.abs(choice.effect.revenue ?? 0),
                );
                return `<button class="choice map-choice" data-action="choose" data-choice="${e(choice.id)}" ${error ? "disabled" : ""}><strong>${e(choice.title)}</strong><span>${e(choice.sacrifice)}</span>${cost >= 1 ? `<small>${e(choice.cost)}</small>` : ""}${error ? `<span class="choice-error">${e(error)}</span>` : ""}</button>`;
              })
              .join(
                "",
              )}</div>${focus.id.startsWith("policy:") || focus.id.startsWith("institutional:") ? "" : `<button class="map-inspect" data-action="map-inspect" data-place="${placeForTopic(focus)}">Voir le lieu</button>`}${details}`
          : `<h1 tabindex="-1">${game.turn ? "Le pays évolue." : "Votre mandat commence."}</h1><p>Choisissez un sujet sur la carte.</p><div class="map-agenda">${agenda.map((item) => `<button data-action="story-select" data-story-id="${e(item.id)}"><span>${e(item.label)}</span><strong>${e(item.title)}</strong></button>`).join("")}</div>`
      }
      ${shared ? '<p class="map-fiction-note">Parcours partagé. Votre sauvegarde reste intacte.</p>' : ""}
    </section>
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
  return `<section class="map-game">${mapHeader(game)}${mapWorld(game)}<section class="map-subject map-summary" data-map-year><p class="map-entry__kicker">ANNÉE ${year} ACHEVÉE</p><h1 tabindex="-1">Le mandat continue.</h1><p class="map-subject__intro">Les décisions de cette année restent inscrites dans le pays.</p>${countryReadings(game)}<button class="map-primary" data-action="next-year">Reprendre le mandat</button>${commitments(game)}<details class="map-subject__details"><summary>Les ${decisions.length} décisions de l’année</summary><ol>${decisions.map((item) => `<li>${e(item.title)}</li>`).join("")}</ol></details></section></section>`;
}
export function mapResult(game: Game, shared = false): string {
  const complete = game.politics?.ending?.kind === "term_complete",
    epilogue = narrativeElectionOutcome(game);
  return `<section class="map-game">${mapHeader(null)}${mapWorld(game)}<article class="map-subject map-summary map-result" data-map-result><p class="map-entry__kicker">${shared ? "MANDAT PARTAGÉ" : complete ? "CINQ ANS ACCOMPLIS" : "MANDAT INTERROMPU"}</p><h1 tabindex="-1">${complete ? "Vous avez tenu cinq ans." : e(game.politics?.ending?.title ?? "Le mandat s’achève.")}</h1><p class="map-subject__intro">${complete ? `${game.turn} décisions. Le pays garde leurs conséquences.` : e(game.politics?.ending?.reason ?? `${game.turn} décisions enregistrées.`)}</p>${countryReadings(game)}<button class="map-primary" data-action="new-run">Nouveau mandat</button><button class="map-secondary" data-action="open-replay-selection">Rejouer un tournant du mandat</button><button class="map-inspect" data-action="view" data-view="finance">Consulter le bilan complet</button>${commitments(game)}${epilogue ? `<details class="map-subject__details"><summary>La suite politique</summary><h3>${e(epilogue.title)}</h3><p>${e(epilogue.detail)}</p></details>` : ""}<details class="map-subject__details"><summary>Partager ou retrouver ce scénario</summary><button class="map-secondary" data-action="share">Partager cet héritage</button><button class="map-secondary" data-action="replay">Rejouer exactement ce défi</button><p>Scénario ${game.seed} · version ${game.version} · simulation.</p></details></article></section>`;
}
export function mapReview(
  game: Game,
  accounts: string,
  journal: string,
): string {
  return `<section class="map-game">${mapHeader(game)}${mapWorld(game)}<section class="map-subject map-summary" data-map-review><header><h1 tabindex="-1">État du pays</h1><button data-action="view" data-view="decision">Revenir au mandat</button></header>${countryReadings(game)}<details class="map-subject__details"><summary>Comptes et indicateurs</summary>${accounts}</details><details class="map-subject__details"><summary>Les effets sur les territoires</summary>${game.areas.map((item) => `<button class="map-secondary" data-action="area" data-area="${item.id}">${e(item.name)} · services ${Math.round(item.services)}/100</button>`).join("")}</details>${commitments(game)}<details class="map-subject__details"><summary>Le journal de vos décisions</summary>${journal}</details></section></section>`;
}
export function mapReplay(game: Game, content: string): string {
  return `<section class="map-game">${mapHeader(null)}${mapWorld(game)}<section class="map-subject map-summary map-replay">${content}</section></section>`;
}
