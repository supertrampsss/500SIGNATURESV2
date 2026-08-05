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

/** Les mailles que le site sait nommer et ouvrir, du plus fin au plus large.
 *
 *  L'ordre est aussi celui des suggestions de recherche : on cherche presque
 *  toujours une commune. */
export const NIVEAUX_RECHERCHABLES: Record<string, string> = {
  commune: "Commune",
  departement: "Département",
  region: "Région",
};

export type EntreeRecherche = { c: string; n: string; l: string; p: string | null };

/**
 * Les huit suggestions d'une frappe, dans l'ordre où elles s'affichent.
 *
 * Le filtre sur les mailles connues n'est pas une précaution de principe. Le
 * site et les données ne se déploient pas ensemble : entre le déploiement qui
 * retire l'intercommunalité et la publication qui la purge, l'index de
 * recherche continue de la contenir. Sans ce filtre, taper « Bordeaux » aurait
 * proposé « Bordeaux Métropole — epci », en clair, et l'ouvrir aurait affiché
 * une fiche dont le site ne sait plus dire ce qu'elle est. Le même filtre
 * protège l'inverse : une donnée en avance sur le code.
 */
export function suggestions(
  index: EntreeRecherche[],
  requete: string,
  niveauAffiche: string,
  combien = 8,
): EntreeRecherche[] {
  const rang = Object.keys(NIVEAUX_RECHERCHABLES);
  const cherche = requete.trim().toLowerCase();
  return index
    .filter((e) => e.l in NIVEAUX_RECHERCHABLES)
    .filter((e) => e.n.toLowerCase().startsWith(cherche) || e.c === cherche)
    .sort(
      (a, b) =>
        // La maille affichée d'abord : chercher « Gironde » en vue
        // départementale doit proposer le département avant la commune.
        Number(b.l === niveauAffiche) - Number(a.l === niveauAffiche) ||
        rang.indexOf(a.l) - rang.indexOf(b.l) ||
        a.n.localeCompare(b.n, "fr"),
    )
    .slice(0, combien);
}
