/**
 * Le sommaire de « Sources et méthode ».
 *
 * La page fonde la confiance du site : elle dit d'où vient chaque chiffre et
 * comment il est calculé. Elle pèse un demi-million de caractères répartis en
 * quatre-vingt-quatorze plis empilés, sans point d'entrée : personne n'y
 * trouvait la définition qu'il cherchait.
 *
 * Le contenu ne change pas. On ajoute devant la liste de ses thèmes, avec le
 * nombre d'indicateurs de chacun, et un filtre qui masque ce qui ne correspond
 * pas. Le filtre porte aussi sur les noms d'indicateurs : on cherche
 * « chômage », pas « Emploi et chômage ».
 */

export type EntreeSommaire = {
  /** L'identifiant du pli visé. */
  ancre: string;
  libelle: string;
  nombre: number;
  /** Ce sur quoi le filtre porte : le thème et les noms de ses indicateurs. */
  termes: string;
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Minuscules sans accents : « Éducation » se trouve en tapant « education ». */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function filtrer(entrees: EntreeSommaire[], requete: string): EntreeSommaire[] {
  const cherche = normaliser(requete.trim());
  if (!cherche) return entrees;
  return entrees.filter((e) => normaliser(`${e.libelle} ${e.termes}`).includes(cherche));
}

/** La liste, un bouton par thème : le clic ouvre le pli et y fait défiler. */
export function rendreSommaire(entrees: EntreeSommaire[]): string {
  return entrees
    .map(
      (e) => `<li><button type="button" class="sommaire__entree" data-ancre="${echapper(e.ancre)}"
        style="font:inherit;font-size:var(--texte-m);text-align:left;border:0;background:none;color:var(--encre);cursor:pointer;padding:var(--espace-3) 0">${echapper(
          e.libelle,
        )} <span style="color:var(--encre-douce)">(${e.nombre})</span></button></li>`,
    )
    .join("");
}
