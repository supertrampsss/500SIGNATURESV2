/**
 * Le sélecteur d'indicateur de la carte.
 *
 * La carte ne se pilotait que par « Voir sur la carte », caché dans le détail
 * déplié d'une mesure : « la carte du chômage » ne se trouvait pas. Elle a
 * maintenant sa propre commande, à côté des pilules, groupée par thème.
 *
 * La liste est **limitée à ce qui se peint ici et maintenant** : une série
 * nationale n'a pas de valeur par commune, un indicateur reconstitué n'a pas de
 * fichier de carte. Une entrée qui ne ferait rien est pire que pas d'entrée.
 */

export type ChoixCarte = { id: string; libelle: string };
export type GroupeCarte = { theme: string; libelle: string; choix: ChoixCarte[] };

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

type Source = { id: string; theme: string; libelle: string };

/**
 * Les groupes proposés, dans l'ordre des thèmes donné par l'appelant.
 *
 * Un thème dont aucun indicateur ne se peint à cette maille disparaît : il
 * n'ouvrirait qu'un `optgroup` vide.
 */
export function groupesCarte<T extends Source>(
  indicateurs: T[],
  themes: string[],
  cartographiable: (indicateur: T) => boolean,
  libelleTheme: (theme: string) => string,
  libelleIndicateur: (libelle: string) => string = (l) => l,
): GroupeCarte[] {
  const groupes: GroupeCarte[] = [];
  for (const theme of themes) {
    const choix = indicateurs
      .filter((i) => i.theme === theme && cartographiable(i))
      .map((i) => ({ id: i.id, libelle: libelleIndicateur(i.libelle) }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
    if (choix.length) groupes.push({ theme, libelle: libelleTheme(theme), choix });
  }
  return groupes;
}

/**
 * Les `optgroup` du sélecteur, l'indicateur courant marqué `selected`.
 *
 * Si l'indicateur courant ne figure pas dans la liste (il ne se peint pas à
 * cette maille), le sélecteur ne fait pas semblant de le montrer : il ouvre sur
 * une entrée neutre, désactivée, plutôt que sur le premier de la liste, qui
 * laisserait croire que c'est lui qui colore la carte.
 */
export function rendreSelecteur(groupes: GroupeCarte[], courant: string): string {
  const connu = groupes.some((g) => g.choix.some((c) => c.id === courant));
  const tete = connu
    ? ""
    : `<option value="" selected disabled>Choisir un indicateur</option>`;
  return (
    tete +
    groupes
      .map(
        (g) => `<optgroup label="${echapper(g.libelle)}">${g.choix
          .map(
            (c) =>
              `<option value="${echapper(c.id)}"${c.id === courant ? " selected" : ""}>${echapper(
                c.libelle,
              )}</option>`,
          )
          .join("")}</optgroup>`,
      )
      .join("")
  );
}

/** Combien d'indicateurs le sélecteur propose : sert à ne pas l'afficher vide. */
export function nombreDeChoix(groupes: GroupeCarte[]): number {
  return groupes.reduce((total, g) => total + g.choix.length, 0);
}
