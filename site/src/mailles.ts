/**
 * Quelle maille à quel zoom.
 *
 * La France entière se lit en régions, un département en communes. Les seuils
 * suivent ceux du liseré : la maille change quand ses contours deviennent
 * lisibles, pas avant. Le changement automatique évite le réglage que
 * personne ne pense à faire — on zoomait sur une ville en gardant la couche
 * des régions, et la carte semblait n'avoir rien de plus fin.
 */

export const NIVEAU_PAR_ZOOM: { jusqua: number; niveau: string }[] = [
  { jusqua: 6.2, niveau: "region" },
  { jusqua: 7.6, niveau: "departement" },
  { jusqua: 8.8, niveau: "epci" },
  { jusqua: Infinity, niveau: "commune" },
];

export function niveauPourZoom(zoom: number): string {
  return (NIVEAU_PAR_ZOOM.find((p) => zoom < p.jusqua) as { niveau: string }).niveau;
}
