/**
 * Quelle maille à quel zoom.
 *
 * La France entière se lit en régions, un département en communes. Les seuils
 * suivent ceux du liseré : la maille change quand ses contours deviennent
 * lisibles, pas avant. Le changement automatique évite le réglage que
 * personne ne pense à faire — on zoomait sur une ville en gardant la couche
 * des régions, et la carte semblait n'avoir rien de plus fin.
 *
 * **L'intercommunalité n'est plus une étape du zoom.** Elle l'était, entre le
 * département et la commune : en zoomant vers sa ville on traversait un
 * découpage que personne ne reconnaît — « CC du Val de… » — et qui n'est pas
 * ce qu'on est venu chercher. Elle reste entièrement publiée, atteignable par
 * son nom dans la recherche, par l'URL, et citée sur la fiche d'une commune :
 * c'est là qu'elle compte, parce qu'elle porte souvent plus d'argent que la
 * commune elle-même. Bordeaux Métropole dépense 1 310 € par habitant quand la
 * ville en dépense 1 373, et porte 2 420 € de dette par habitant contre 1 536.
 * La retirer de la carte ne la retire pas du site.
 */

export const NIVEAU_PAR_ZOOM: { jusqua: number; niveau: string }[] = [
  { jusqua: 6.2, niveau: "region" },
  { jusqua: 8.0, niveau: "departement" },
  { jusqua: Infinity, niveau: "commune" },
];

export function niveauPourZoom(zoom: number): string {
  return (NIVEAU_PAR_ZOOM.find((p) => zoom < p.jusqua) as { niveau: string }).niveau;
}
