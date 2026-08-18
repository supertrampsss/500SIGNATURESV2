/**
 * Barres horizontales triées : comparer des magnitudes.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE FORME, ET PAS UN CAMEMBERT DE PLUS
 * ─────────────────────────────────────────────────────────────────────────
 * L'œil compare des longueurs alignées bien mieux que des angles : neuf fois
 * plus long se voit d'un coup, neuf fois plus d'angle ne se voit pas. C'est
 * exactement ce que le tableau seul cachait — « 24,09 » posé au-dessus de
 * « 2,70 » ne dit pas *neuf fois*, il demande au lecteur de diviser.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EN HTML, ET PAS EN SVG : UNE MESURE, PAS UN GOÛT
 * ─────────────────────────────────────────────────────────────────────────
 * La première version était un SVG en `viewBox="0 0 100 H"` étiré à la largeur
 * disponible. Vu au navigateur : à 1 000 px de large, une rangée de 34 unités
 * devient **340 px de haut**, et huit fonctions occupaient trois écrans. Un
 * repère où la hauteur d'une rangée est une fraction de la LARGEUR n'a pas de
 * taille propre — il prend celle de son conteneur.
 *
 * En HTML, la longueur reste un pourcentage exact, et la hauteur comme le texte
 * gardent les jetons de la charte : lisibles à 320 px comme à 1 440 px, sans
 * une seule taille en dur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNE SEULE TEINTE, ET POURQUOI
 * ─────────────────────────────────────────────────────────────────────────
 * La longueur porte déjà la mesure. Huit couleurs sur une comparaison de
 * tailles feraient croire à une seconde dimension qui n'existe pas, et une
 * teinte choisie sur la valeur ferait juger le chiffre par sa couleur — ce que
 * la charte refuse (« aucune couleur de jugement »).
 *
 * Seul un **regroupement** sort de la teinte de série : « ce qui reste » n'est
 * pas une catégorie nommée, et lui donner la même couleur qu'un poste le ferait
 * lire comme un poste.
 *
 * L'identité ne passe jamais par la seule couleur : chaque barre porte son
 * libellé en toutes lettres et sa valeur chiffrée, et la figure est doublée par
 * le tableau qui la suit.
 */

export type Part = { libelle: string; valeur: number; regroupement?: boolean };

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Une figure de magnitudes, ou la chaîne vide si rien n'est mesurable.
 *
 * `valeurs` formate le montant : la figure ne connaît pas l'unité de ce qu'elle
 * dessine, et un module qui déciderait à sa place afficherait des euros sur des
 * points de pourcentage.
 */
export function barresMagnitude(
  titre: string,
  entrees: Part[],
  formater: (valeur: number) => string,
): string {
  const maximum = Math.max(...entrees.map((e) => e.valeur), 0);
  if (!maximum) return "";
  const rangs = entrees
    .map(
      (e) => `<li class="barres__rang">
        <span class="barres__nom">${echapper(e.libelle)}</span>
        <span class="barres__piste">
          <span class="barres__marque${e.regroupement ? " barres__marque--reste" : ""}"
            style="width:${((e.valeur / maximum) * 100).toFixed(2)}%"></span>
        </span>
        <span class="barres__valeur">${echapper(formater(e.valeur))}</span>
      </li>`,
    )
    .join("");
  return `<figure class="barres">
    <figcaption class="barres__titre">${echapper(titre)}</figcaption>
    <ul class="barres__rangs">${rangs}</ul>
  </figure>`;
}
