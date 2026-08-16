/**
 * Les adresses du site.
 *
 * Le site n'avait qu'une adresse — la racine — et portait sa vue dans le
 * fragment. Un fragment ne part pas au serveur : aucune page ne pouvait être
 * indexée, ni servie pré-rendue, ni partagée avec sa propre vignette. Chaque
 * vue a donc son chemin, et le fragment retrouve son seul rôle, l'ancre interne.
 *
 * Ce module ne connaît pas le document : il traduit une adresse en nom de vue et
 * l'inverse. C'est ce qui le rend testable sans navigateur.
 */

/** Les vues qui ont un chemin.
 *
 *  Le simulateur n'en est une que si un budget est publié : cette table décrit
 *  les chemins, `vuesConnues()` dans `main.ts` tranche ce qui est ouvrable. */
export const CHEMINS: Record<string, string> = {
  territoire: "/territoire",
  reperes: "/reperes",
  detail: "/detail",
  simulateur: "/simulateur",
  methode: "/methode",
};

/**
 * Les anciens noms, et ce qu'ils ouvrent aujourd'hui.
 *
 * `carte` était une vue avant de devenir un mode de la vue territoire.
 * `analyses` désignait les tableaux d'un territoire ; le nom sert désormais aux
 * analyses éditoriales, et les tableaux s'appellent `detail`. `decryptages` est
 * devenu `reperes`. `donnees` a été retiré. Un lien déjà partagé doit ouvrir ce
 * qu'il promettait, pas une page blanche.
 */
export const ALIAS: Record<string, string> = {
  carte: "territoire",
  analyses: "detail",
  decryptages: "reperes",
  donnees: "territoire",
};

/** Le chemin d'une vue. Une vue inconnue retombe sur la racine du site. */
export function cheminDeVue(vue: string): string {
  return CHEMINS[vue] ?? "/territoire";
}

/** Le nom de vue que porte un segment (chemin), sinon `null`. */
function vueDuNom(nom: string): string | null {
  return nom in CHEMINS ? nom : null;
}

/**
 * La vue que demande une adresse, ou `null` si elle n'en demande aucune.
 *
 * Le chemin fait foi. Le fragment n'est lu que sur la racine : c'est là que
 * vivent les liens partagés avant l'existence des chemins. `null` est une
 * réponse utile — une ancre interne ne nomme pas une vue, et l'appelant doit
 * pouvoir laisser en place celle qui est déjà affichée.
 */
export function vueDepuisAdresse(chemin: string, fragment: string): string | null {
  const segment = chemin.replace(/^\/+|\/+$/g, "").split("/")[0];
  if (segment) return vueDuNom(segment);
  const ancre = fragment.replace(/^#/, "");
  if (!ancre) return null;
  // Les alias sont résolus uniquement pour les fragments : anciens liens
  // partagés avant l'existence des chemins.
  const resolu = ALIAS[ancre] ?? ancre;
  return resolu in CHEMINS ? resolu : null;
}

/**
 * La racine du site rend l'accueil, et rien d'autre n'y mène.
 *
 * `vueDepuisAdresse` y répond déjà `null` : la racine est libre, la carte vit à
 * `/territoire`, et l'accueil s'y installe sans qu'aucune vue bouge ni qu'aucun
 * lien déjà partagé change de destination. L'accueil n'entre donc pas dans
 * `CHEMINS` — ce n'est pas une vue de l'application monoécran, c'est une page.
 *
 * Mais `null` est aussi ce que répond une ancre interne, et l'appelant doit
 * séparer les deux : une ancre laisse en place la vue affichée, la racine ouvre
 * l'accueil. Le fragment est donc relu ici, pour la seule raison qui l'y
 * autorise — un lien partagé avant l'existence des chemins (`/#carte`,
 * `/#decryptages`) demande une vue, et ce n'est pas l'accueil.
 */
export function estAccueil(chemin: string, fragment: string): boolean {
  return chemin.replace(/^\/+|\/+$/g, "") === "" && vueDepuisAdresse(chemin, fragment) === null;
}
