/**
 * Le peu de mise en forme que les définitions portent.
 *
 * Les fiches techniques sont écrites dans le pipeline, en français, avec des
 * passages en gras marqués `**ainsi**` — c'est la convention du dépôt, et elle
 * sert : « **Rupture attendue en 2025** » est la phrase qu'un lecteur doit voir
 * avant les autres. Insérées telles quelles dans la page, ces étoiles
 * s'affichaient à l'écran.
 *
 * La conversion se fait **après** l'échappement : le texte vient de notre
 * pipeline, mais une définition n'a aucune raison de pouvoir écrire du HTML.
 */

export function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Le texte échappé, ses `**passages**` rendus en gras. */
export function emphase(texte: string): string {
  return echapper(texte).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
