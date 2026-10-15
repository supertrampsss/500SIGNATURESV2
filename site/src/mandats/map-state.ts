import { storyAgenda } from "./narrative-engine.ts";
import type { Game } from "./types.ts";
import type { StoryAgendaItem } from "./narrative-types.ts";
import type { PressureSectorId } from "./pressure-types.ts";
export {
  COUNTRY_REFERENCE_POSE, mapPosition, mapCoordinates,
  mapSourcePosition, mapSourceCoordinates, mapAuthoredPosition,
  mapAuthoredCoordinates, mapAuthoredJacobian,
} from "./map-camera-projection.ts";

export const MAP_PLACES = {
  paris: { name: "Paris", lon: 2.35, lat: 48.86 },
  lyon: { name: "Lyon", lon: 4.84, lat: 45.76 },
  lille: { name: "Lille", lon: 3.06, lat: 50.63 },
  rennes: { name: "Rennes", lon: -1.68, lat: 48.11 },
  nantes: { name: "Nantes", lon: -1.55, lat: 47.22 },
  bordeaux: { name: "Bordeaux", lon: -0.58, lat: 44.84 },
  toulouse: { name: "Toulouse", lon: 1.44, lat: 43.6 },
  montpellier: { name: "Montpellier", lon: 3.88, lat: 43.61 },
  marseille: { name: "Marseille", lon: 5.37, lat: 43.3 },
  strasbourg: { name: "Strasbourg", lon: 7.75, lat: 48.58 },
  rouen: { name: "Rouen", lon: 1.1, lat: 49.44 },
  ajaccio: { name: "Ajaccio", lon: 8.74, lat: 41.92 },
} as const;
export type MapPlace = keyof typeof MAP_PLACES;
const pressurePlaces: Record<string, MapPlace> = {
  health: "rennes", housing: "bordeaux", transport: "nantes",
  energy: "strasbourg", education: "lyon", administration: "paris",
};
export function placeForTopic(
  item: Pick<StoryAgendaItem, "id" | "category" | "title">,
): MapPlace {
  if (item.id.startsWith("pressure-") && pressurePlaces[item.id.slice(9)])
    return pressurePlaces[item.id.slice(9)];
  if (item.id.startsWith("institutional:") || item.id.startsWith("policy:"))
    return "paris";
  if (item.id === "science-stockage") return "toulouse";
  if (item.id === "ia-services") return "paris";
  if (item.id === "chaleur-ecoles") return "montpellier";
  const key = `${item.id} ${item.category} ${item.title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/lycee|enseignement|education|mvt-lyceens/.test(key)) return "lyon";
  if (/eau|secheresse|incendie/.test(key)) return "montpellier";
  if (/cyber|hopital|soin|sante|mvt-agents/.test(key)) return "rennes";
  if (
    /industrie|usine|automatisation|reconversion|intelligence|mvt-salaries/.test(
      key,
    )
  )
    return "lille";
  if (/port|approvisionnement/.test(key)) return "marseille";
  if (/logement|housing/.test(key)) return "bordeaux";
  if (/energie|mobilite|transport/.test(key)) return "nantes";
  if (/recherche|science/.test(key)) return "toulouse";
  return "paris";
}
export function markerLabel(item: StoryAgendaItem): string {
  if (item.id.startsWith("institutional:")) return "Assemblée";
  if (item.id.startsWith("policy:")) return "France";
  const place = placeForTopic(item);
  return MAP_PLACES[place].name;
}
export function mapState(game: Game | null) {
  const agenda = game && !game.politics?.ending ? storyAgenda(game) : [];
  const subjects = agenda.map((item) => {
    const sector = item.id.startsWith("pressure-") ? item.id.slice(9) as PressureSectorId : undefined;
    const front = sector ? game?.pressure?.sectors[sector] : undefined;
    return {
      ...item,
      place: placeForTopic(item),
      label: markerLabel(item),
      pressureStage: front?.stage,
      pressureTrend: front?.trend,
      pressureLevel: front?.pressure,
      pressureStockChange: front?.lastChange,
      urgent: front ? front.stage === "disrupted" || front.stage === "crisis" :
        item.id.startsWith("mvt-") || item.dueTurn !== undefined ||
        (!!game?.politics?.pendingCrisis && item.id.startsWith("institutional:")),
    };
  });
  const priority = (item: typeof subjects[number]) =>
    item.id.startsWith("institutional:") && game?.politics?.pendingCrisis ? 10000 :
    item.pressureStage === "crisis" ? 5000 + (item.pressureLevel ?? 0) :
    item.id.startsWith("mvt-") ? 4000 : item.dueTurn !== undefined ? 3300 :
    item.pressureStage === "disrupted" ? 3200 + (item.pressureLevel ?? 0) :
    !item.pressureStage ? 1000 : (item.pressureLevel ?? 0);
  if (game?.pressure) subjects.sort((a, b) => priority(b) - priority(a));
  const visibleSubjects = game?.pressure ? subjects.slice(0, 3) : subjects;
  const selected = subjects.find(item => item.id === game?.narrative?.focus);
  if (selected && !visibleSubjects.includes(selected)) visibleSubjects.splice(2, 1, selected);
  const movements = (game?.social?.movements ?? [])
    .filter((item) => item.status === "active")
    .map((movement) => ({
      ...movement,
      placeOnMap: placeForTopic({
        id: `mvt-${movement.actor}`,
        category: "",
        title: movement.demand,
      }),
    }));
  const projects = (game?.narrative?.projects ?? []).map((project) => ({
    ...project,
    placeOnMap: placeForTopic({
      id: project.kind,
      category: project.kind,
      title: project.label,
    }),
  }));
  const occupied = new Set(visibleSubjects.map(item => item.place));
  const tracking = [
    ...movements
      .filter((item) => item.commitment?.status === "pending")
      .map((item) => ({
        id: item.id,
        place: item.placeOnMap,
        title: "Moyens en préparation",
        label: MAP_PLACES[item.placeOnMap].name,
      })),
    ...projects
      .filter((item) => item.status === "funded")
      .map((item) => ({
        id: item.id,
        place: item.placeOnMap,
        title: item.label,
        label: MAP_PLACES[item.placeOnMap].name,
      })),
  ]
    .filter((item) => {
      if (occupied.has(item.place)) return false;
      occupied.add(item.place);
      return true;
    })
    .slice(0, 2);
  return {
    seed: game?.seed ?? 42,
    turn: game?.turn ?? 0,
    selected: game?.narrative?.focus,
    agenda: subjects,
    markers: visibleSubjects,
    projects,
    movements,
    tracking,
  };
}
export type MandateMapState = ReturnType<typeof mapState>;
