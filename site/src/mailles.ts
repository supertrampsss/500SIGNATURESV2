/**
 * Quelle maille à quel zoom.
 *
 * La France entière se lit en régions, un département en communes. Les seuils
 * suivent ceux du liseré : la maille change quand ses contours deviennent
 * lisibles, pas avant. Le changement automatique évite le réglage que
 * personne ne pense à faire — on zoomait sur une ville en gardant la couche
 * des régions, et la carte semblait n'avoir rien de plus fin.
 *
 * **L'intercommunalité n'est plus une maille du site.** Elle l'était, entre le
 * département et la commune : en zoomant vers sa ville on traversait un
 * découpage que personne ne reconnaît — « CC du Val de… » — et qui n'est pas ce
 * qu'on est venu chercher. Elle a d'abord quitté le zoom, puis le produit
 * entier : 1 266 territoires, 719 000 observations, 557 fichiers de carte à
 * chaque publication et une couche de tuiles, pour un niveau sur lequel aucune
 * des questions d'entrée ne porte.
 *
 * Ce qu'elle explique reste dit, là où ça compte : une commune d'une métropole
 * intégrée ne paie ni la voirie, ni les déchets, ni l'urbanisme, et ses
 * dépenses par habitant paraissent basses sans que rien ne soit anormal. Cet
 * avertissement figure sur la fiche et dans le comparateur — retirer le niveau
 * ne fait pas disparaître l'intercommunalité du réel.
 */

export const NIVEAU_PAR_ZOOM: { jusqua: number; niveau: string }[] = [
  { jusqua: 6.2, niveau: "region" },
  { jusqua: 8.0, niveau: "departement" },
  { jusqua: Infinity, niveau: "commune" },
];

export function niveauPourZoom(zoom: number): string {
  return (NIVEAU_PAR_ZOOM.find((p) => zoom < p.jusqua) as { niveau: string }).niveau;
}
