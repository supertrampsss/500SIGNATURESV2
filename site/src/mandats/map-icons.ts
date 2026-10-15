import type { StoryAgendaItem } from "./narrative-types.ts";

export type MapIcon = "people" | "health" | "industry" | "water" | "energy" | "school" | "institution" | "science" | "housing" | "budget" | "project" | "country" | "balance" | "settings" | "alert" | "locate";

const drawings: Record<MapIcon, string> = {
  people: '<circle cx="12" cy="6" r="3"/><circle cx="5" cy="8" r="2.2"/><circle cx="19" cy="8" r="2.2"/><path d="M8 21v-6a4 4 0 0 1 8 0v6H8ZM2 20v-6a3 3 0 0 1 4-2.8V20H2Zm16 0v-8.8A3 3 0 0 1 22 14v6h-4Z"/>',
  health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  industry: '<path d="M3 20V10l6-3v5l6-3v11H3Zm14 0V4h4v16h-4Z"/><path d="M5 15h2v2H5Zm4 0h2v2H9Zm4 0h2v2h-2Z" fill="var(--map-icon-cutout, #14579a)"/>',
  water: '<path d="M12 2C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 4 4" fill="none" stroke="var(--map-icon-cutout, #14579a)" stroke-width="1.8" stroke-linecap="round"/>',
  energy: '<path d="m13 2-8 12h6l-1 8 9-13h-7l1-7Z"/>',
  school: '<path d="M3 4h7a3 3 0 0 1 2 1 3 3 0 0 1 2-1h7v15h-7a3 3 0 0 0-2 1 3 3 0 0 0-2-1H3V4Z"/><path d="M12 6v11" stroke="var(--map-icon-cutout, #14579a)" stroke-width="1.7"/>',
  institution: '<path d="m12 2 10 6H2l10-6Zm-8 8h3v8H4v-8Zm6 0h4v8h-4v-8Zm7 0h3v8h-3v-8ZM2 20h20v2H2v-2Z"/>',
  science: '<path d="M9 2h6v2h-1v5l6 10a2 2 0 0 1-2 3H6a2 2 0 0 1-2-3l6-10V4H9V2Zm2 10-3 5h8l-3-5h-2Z"/>',
  housing: '<path d="m12 3 10 8h-3v10h-5v-7h-4v7H5V11H2l10-8Z"/>',
  budget: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 8a15 15 0 0 0 16 0v3c0 4-16 4-16 0V8Zm0 6a15 15 0 0 0 16 0v3c0 4-16 4-16 0v-3Z"/>',
  project: '<path d="M3 5h7l2 3h9v13H3V5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  country: '<path d="m10 2 3 2 4-1 1 4 3 2-3 4 1 5-4 3-4-2-4 1-3-4 1-3-3-3 4-1 1-4 3 1 2-4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  balance: '<path d="M3 13h4v8H3v-8Zm7-5h4v13h-4V8Zm7-5h4v18h-4V3Z"/>',
  settings: '<path d="m9.3 2-.6 3-2 .9-2.8-1-2.1 3.6 2.2 2v2.9l-2.2 2 2.1 3.6 2.8-1 2 .9.6 3h4.2l.6-3 2-.9 2.8 1 2.1-3.6-2.2-2v-2.9l2.2-2-2.1-3.6-2.8 1-2-.9-.6-3H9.3Z"/><circle cx="11.4" cy="12" r="3.2" fill="var(--map-navy, #071b32)"/>',
  alert: '<path d="M12 2 23 22H1L12 2Z"/><path d="M12 8v6" fill="none" stroke="var(--map-navy, #071b32)" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="18" r="1.2" fill="var(--map-navy, #071b32)"/>',
  locate: '<circle cx="12" cy="12" r="6.7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
};

export function mapIcon(icon: MapIcon): string {
  return `<svg class="map-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">${drawings[icon]}</svg>`;
}

/** Icons describe the saved subject; they do not introduce a severity score. */
export function iconForTopic(item: Pick<StoryAgendaItem, "id" | "category" | "title">): MapIcon {
  const key = `${item.id} ${item.category} ${item.title}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (item.id.startsWith("mvt-")) return "people";
  if (item.id.startsWith("institutional:")) return "institution";
  if (item.id.startsWith("policy:")) return "budget";
  if (/lycee|enseignement|education|ecole/.test(key)) return "school";
  if (/cyber|hopital|soin|sante/.test(key)) return "health";
  if (/eau|secheresse|incendie/.test(key)) return "water";
  if (/energie|mobilite|transport|stockage/.test(key)) return "energy";
  if (/industrie|usine|automatisation|reconversion|intelligence/.test(key)) return "industry";
  if (/logement|housing/.test(key)) return "housing";
  if (/recherche|science/.test(key)) return "science";
  return "institution";
}

export function toneForTopic(item: Pick<StoryAgendaItem, "id" | "category" | "title"> & { urgent?: boolean }): "red" | "gold" | "blue" {
  if (item.urgent) return "red";
  return ["health", "water", "energy"].includes(iconForTopic(item)) ? "gold" : "blue";
}
