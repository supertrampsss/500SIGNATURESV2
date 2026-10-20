import type { Choice } from "./types.ts";

/** Qualitative UI wording only: saved choices and numeric effects stay in the engine. */
export function presentationEffect(choice: Choice): string {
  if (!choice.id.startsWith("s17-")) return presentationText(choice.benefit);
  const sector = choice.id.split("-")[1];
  const kind = choice.id.split("-").at(-1);
  const foundations: Record<string, { capacity: string; organisation: string }> = {
    health: { capacity: "Davantage de créneaux de soins grâce aux équipes formées et installées.", organisation: "Moins de doublons dans les parcours ; des gardes mieux organisées et des équipes moins fatiguées." },
    housing: { capacity: "Davantage de solutions de logement grâce aux rénovations préparées.", organisation: "Médiations et remises en location évitent des passages inutiles par l’hébergement d’urgence." },
    transport: { capacity: "Des équipements renouvelés et davantage de maintenance pour assurer les dessertes.", organisation: "Horaires et entretien coordonnés évitent des interventions inutiles, sans supprimer les dessertes." },
    energy: { capacity: "Des équipements et des équipes de maintenance renforcent la disponibilité du réseau.", organisation: "Moins de consommations inutiles ; un entretien planifié pour protéger les services essentiels." },
    education: { capacity: "Un vivier de remplaçants formés assure davantage de cours.", organisation: "Les établissements partagent les remplacements et évitent des heures de cours perdues." },
    administration: { capacity: "Des équipes formées et des outils renforcent le traitement des dossiers.", organisation: "Moins de démarches en double, avec accueil humain et recours maintenus." },
  };
  const specific = kind === "capacity" || kind === "organisation" ? foundations[sector]?.[kind] : undefined;
  if (specific) return `À la mise en service : ${specific} Une coordination territoriale devient ensuite accessible.`;
  return `Après préparation : ${choice.description}`;
}

export function presentationText(text: string): string {
  return text.replace(/Une unité d’exécution par période pendant au moins deux périodes/g, "Une équipe mobilisée pendant au moins quatre mois");
}

/** Describe current service separately from inherited requests still waiting. */
export function presentationSituation(front: { effectiveCapacity: number; incomingNeed: number; backlog: number }): string {
  const service = front.effectiveCapacity >= front.incomingNeed
    ? "Le service peut suivre la demande actuelle."
    : "La demande actuelle dépasse les moyens disponibles.";
  return `${service} ${front.backlog > 0 ? "Des demandes antérieures restent en attente." : "Aucun retard accumulé."}`;
}
