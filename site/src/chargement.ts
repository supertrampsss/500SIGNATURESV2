/**
 * État occupé du panneau, pendant qu'un territoire se charge.
 *
 * Ouvrir une fiche communale demande la couche de la maille (34 772 valeurs)
 * puis les lots de fiches qui la couvrent : dix-sept secondes mesurées à
 * l'audit, pendant lesquelles l'ancienne fiche restait affichée telle quelle.
 * Le lecteur croyait que son clic n'avait pas pris.
 *
 * Deux pièces, toutes deux pures :
 *
 * - `squeletteFiche` : la forme de la fiche à venir, en barres, avec le nom du
 *   territoire demandé. Un rond qui tourne dirait « ça travaille » ; la forme
 *   dit en plus **ce qui va s'afficher et où**, et le nom dit sur quoi le clic
 *   a porté.
 * - `creerFile` : un ticket par ouverture. Le même territoire demandé deux fois
 *   de suite ne relance rien (double-clic), un autre territoire prend la main
 *   et les tickets périmés savent qu'ils ne doivent plus rien écrire.
 */

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Une barre grise, à la place d'un texte à venir. */
function barre(largeur: string, hauteur: string, marge = "0 0 var(--espace-3)"): string {
  return `<div style="width:${largeur};height:${hauteur};margin:${marge};border-radius:var(--rayon-xs);background:var(--trait)"></div>`;
}

/**
 * Le squelette de la fiche : titre, identité, synthèse, onglets, mesures.
 *
 * Les proportions sont celles de la fiche réelle, pour que le contenu ne fasse
 * pas sauter la mise en page en arrivant.
 */
export function squeletteFiche(nom: string): string {
  const propre = nom.trim();
  const annonce = propre
    ? `Chargement de <strong>${echapper(propre)}</strong>…`
    : "Chargement du territoire…";
  const mesure = `<div style="padding:var(--espace-4) 0;border-top:1px solid var(--trait)">
      ${barre("46%", "0.8125rem", "0 0 var(--espace-3)")}
      ${barre("28%", "1.125rem", "0")}
    </div>`;
  const onglet = (largeur: string) =>
    `<div style="width:${largeur};height:1.5rem;border-radius:var(--rayon-pilule);background:var(--trait)"></div>`;
  return `<div class="fiche__chargement" role="status" style="padding:var(--espace-6) var(--espace-6) 0">
      <p style="margin:0 0 var(--espace-6);font-size:var(--texte-m);color:var(--encre-douce)">${annonce}</p>
      <div aria-hidden="true">
        ${barre("58%", "1.25rem", "0 0 var(--espace-4)")}
        ${barre("38%", "0.75rem", "0 0 var(--espace-6)")}
        <div style="height:6rem;margin:0 0 var(--espace-6);border-radius:var(--rayon);background:var(--papier-creuse)"></div>
        <div style="display:flex;gap:var(--espace-2);margin:0 0 var(--espace-5)">
          ${onglet("5rem")}${onglet("6.5rem")}${onglet("4.5rem")}${onglet("6rem")}
        </div>
        ${mesure.repeat(4)}
      </div>
    </div>`;
}

export type File = {
  /** Ouvre un ticket, ou `null` si ce même territoire est déjà en cours. */
  ouvrir(cle: string): number | null;
  /** Ce ticket est-il toujours la dernière demande ? Sinon, ne rien écrire. */
  courant(ticket: number): boolean;
  /** Referme le ticket, s'il est encore le dernier. */
  fermer(ticket: number): void;
};

export function creerFile(): File {
  let dernier = 0;
  let encours: string | null = null;
  return {
    ouvrir(cle: string): number | null {
      if (encours === cle) return null;
      encours = cle;
      dernier += 1;
      return dernier;
    },
    courant(ticket: number): boolean {
      return ticket === dernier;
    },
    fermer(ticket: number): void {
      if (ticket === dernier) encours = null;
    },
  };
}
