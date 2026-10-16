import { storyAgenda } from "./narrative-engine.ts";
import { NATIONAL_AGENDA } from "./national-agenda.ts";
import { escape } from "./sharing.ts";
import type { Game } from "./types.ts";

/** A separate route to the actual policy slot, never another source of choices. */
export function mapNationalPolicyAccess(game: Game): string {
  if (game.version < 14 || game.mode !== "national" || game.turn >= 30 || game.politics?.ending) return "";
  const policy = storyAgenda(game).find(item => item.id.startsWith("policy:"));
  const text = policy?.category ?? "Après la crise politique";
  return `<button type="button" class="map-national-policy" data-national-policy-access ${policy ? `data-action="story-select" data-story-id="${escape(policy.id)}" aria-label="Réformes nationales : ${escape(policy.title)}"` : 'disabled aria-label="Réformes nationales suspendues pendant la crise politique"'}><span class="map-national-policy__copy"><strong>Réformes nationales</strong><span>${escape(text)}</span></span><span class="map-national-policy__action" aria-hidden="true">${policy ? "Ouvrir" : "Suspendues"}</span></button>`;
}

/** Authored subjects remain prospective: they are not additional legal actions. */
export function mapNationalPolicyRoadmap(game: Game): string {
  if (game.version < 14 || game.mode !== "national" || !game.narrative?.focus?.startsWith("policy:")) return "";
  const current = storyAgenda(game).find(item => item.id === game.narrative!.focus);
  if (!current) return "";
  const major = ["r01", "r07", "r09"];
  const upcoming = major.flatMap(id => {
    const entry = NATIONAL_AGENDA.find(item => item.id === id);
    if (!entry || entry.dossier.title === current.title || game.choices.some(choice => entry.dossier.choices.some(item => item.id === choice))) return [];
    return [entry.dossier.title];
  });
  return `<aside class="map-national-roadmap" data-national-policy-roadmap><strong>Le programme national continue</strong><p>Un dossier national à la fois. Traiter une urgence ne retire pas les réformes encore à arbitrer.</p>${upcoming.length ? `<p>À venir dans l’agenda :</p><ul>${upcoming.map(title => `<li>${escape(title)}</li>`).join("")}</ul>` : ""}</aside>`;
}
