/**
 * L'aperçu d'un scénario partagé : le titre et la description qu'un robot de
 * plateforme lit dans l'adresse d'un budget réglé.
 *
 * Un scénario ne vit que dans son adresse. Personne ne l'a enregistré nulle
 * part, aucun fichier ne le porte, et il n'y a donc aucune page à pré-rendre :
 * ce qui décrit un scénario se calcule au moment où on le demande, à partir de
 * la chaîne encodée elle-même. C'est tout l'objet de la fonction d'edge
 * (`functions/simulateur/_middleware.ts`), dont ce module est la partie pure —
 * ni requête, ni DOM, ni horloge, donc éprouvable sous Node.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNE SEULE IMPLÉMENTATION DE LA RÈGLE
 * ─────────────────────────────────────────────────────────────────────────
 * Rien n'est recalculé ici. `decoder`, `plan` et `effort` viennent d'atelier.ts,
 * exactement comme l'atelier interactif les appelle ; `plan` rend déjà les
 * lignes **la plus lourde d'abord**, si bien que « les trois gestes les plus
 * lourds » est un `slice(0, 3)` et non un second tri. Les montants passent par
 * `eurosSigne` (simulateur-rendu.ts), le format que l'écran emploie pour un
 * écart. Une copie de l'une de ces règles finirait par dire autre chose que la
 * page qu'on ouvre en cliquant sur l'aperçu.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE L'APERÇU N'ÉCRIT JAMAIS
 * ─────────────────────────────────────────────────────────────────────────
 * **Aucun total de dépense publique.** Ce que le scénario règle, ce sont
 * plusieurs budgets qui ne s'additionnent pas ; ce qui s'additionne, ce sont
 * les écarts, et ce nombre-là est NOMMÉ « somme des écarts » plutôt que laissé
 * seul — seul et gros dans un aperçu, il se lirait comme le budget que le
 * scénario propose. Aucune note, aucun classement, aucun gagnant non plus : un
 * aperçu décrit un geste, il ne le juge pas.
 */

import { decoder, effort, plan, type Volet } from "./atelier.ts";
import { eurosSigne } from "./simulateur-rendu.ts";
import { echapper } from "./texte.ts";

/** Ce qu'une carte de lien porte de texte, et ce que la fonction d'edge pose
 *  dans le document servi. */
export type Apercu = { titre: string; description: string };

/** Le titre d'un scénario que le lecteur n'a pas nommé. Les scénarios sans nom
 *  sont le cas courant : un budget se partage bien avant d'être enregistré. */
const TITRE_SANS_NOM = "Un scénario du simulateur";

/** Les trois gestes les plus lourds, et pas quatre : au-delà, la description
 *  dépasse ce qu'une carte de lien affiche, et c'est la mention d'unité — la
 *  dernière phrase — qui se ferait couper. */
const GESTES_MONTRES = 3;

/** De quoi nommer un geste sans manger la place des deux autres. Les intitulés
 *  officiels vont au-delà de cent caractères (« Enseignement scolaire public du
 *  premier degré ») et trois d'entre eux, non bornés, poussaient les montants
 *  hors de ce qu'une plateforme montre. */
const LIBELLE_MAX = 46;

/** Le nom que le lecteur donne à son scénario voyage dans l'adresse : il est
 *  aussi long qu'on veut. Borné ici, échappé plus bas — un aperçu ne recopie
 *  jamais tel quel ce qu'une adresse lui tend. */
const NOM_MAX = 70;

/** Ce que sont les nombres de la description.
 *
 *  « Santé 1 643 M€ » se lit « 1 643 milliards » par qui n'a pas le nez sur le
 *  sigle. La mention est en dernier, une fois : ce sont les gestes qu'on vient
 *  lire, et une carte de lien coupe par la queue.
 *
 *  Exportée pour que le résumé collable (`partage.ts`) l'écrive dans les mêmes
 *  mots : deux formulations de la même mention se corrigeraient séparément. */
export const MENTION_UNITE = "Montants en millions d'euros.";

/** Coupe au dernier mot entier et marque la suite. Un intitulé tronqué reste
 *  lisible ; un intitulé qui pousse les montants hors du cadre, non. */
function abreger(texte: string, maximum: number): string {
  const propre = texte.trim();
  if (propre.length <= maximum) return propre;
  const coupe = propre.slice(0, maximum);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > maximum / 2 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/**
 * L'aperçu d'un budget encodé, ou `null` quand il n'y a rien à décrire.
 *
 * `null` est une réponse, pas un échec : une adresse dont le budget n'ouvre
 * aucun réglage — vide, illisible, ou ne nommant que des volets disparus —
 * garde les métadonnées du site. Un robot ne doit jamais recevoir une erreur ;
 * il n'afficherait alors aucun aperçu, ce qui est pire qu'un aperçu générique.
 */
export function apercuScenario(
  volets: readonly Volet[],
  budget: string,
  nom: string,
): Apercu | null {
  const etat = decoder(budget, volets);
  // `plan` liste ce qui BOUGE, pas ce qu'on a cliqué : la ligne d'impôt que le
  // barème pilote et le concours de l'État qu'une coupe de dotation entraîne y
  // sont. Vide, il n'y a littéralement rien à décrire.
  const lignes = plan(volets, etat);
  if (lignes.length === 0) return null;

  const nomNet = abreger(nom, NOM_MAX);
  const titre = nomNet ? `« ${nomNet} » — un scénario du simulateur` : TITRE_SANS_NOM;

  // Un transfert intégralement propagé rend l'euro exact, la virgule flottante
  // non : sous l'euro il n'y a rien, et surtout pas un « +0,00 M€ » qui ferait
  // passer une compensation exacte pour un gain. Même garde que `renduEffort`
  // (simulateur-rendu.ts), qui l'affiche à l'écran.
  const brut = effort(volets, etat);
  const somme = Math.abs(brut) < 1 ? 0 : brut;

  const gestes = lignes
    .slice(0, GESTES_MONTRES)
    .map((ligne) => `${abreger(ligne.entree.libelle, LIBELLE_MAX)} ${eurosSigne(ligne.delta)}`);

  return {
    titre,
    description: `Somme des écarts : ${eurosSigne(somme)}. ${gestes.join(" ; ")}. ${MENTION_UNITE}`,
  };
}

/* --------------------------------------------------------------------------
 * Poser l'aperçu dans le document servi
 * ----------------------------------------------------------------------- */

/** Les balises que cette fonction reprend au document. Elles sont **retirées
 *  puis réécrites**, jamais remplacées sur place : une plateforme qui lit deux
 *  `og:title` en choisit un, et lequel ne se sait qu'une fois le lien partagé. */
const REPRISES = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<meta\s+property="og:(?:title|description|url)"[^>]*>\s*/gi,
];

/**
 * Le document servi, ses métadonnées remplacées par celles du scénario.
 *
 * `og:image` n'est pas touchée : elle désigne la carte du site produite au
 * build (décision D-L3-b). L'espace des budgets encodés est infini, et une
 * image par scénario supposerait un rasteriseur et une fonte à l'edge, sur un
 * chemin que les robots appellent.
 *
 * La fonction **insère** ce qu'elle a retiré plutôt que de compter sur la
 * présence des balises : un gabarit qui perdrait ses `og:` servirait sinon un
 * aperçu muet sans que rien ne le dise. Un document sans `</head>` est rendu
 * inchangé — il ne se répare pas, et le mutiler servirait moins bien qu'un
 * aperçu générique.
 */
export function poserApercu(html: string, apercu: Apercu, url: string): string {
  const fermeture = html.search(/<\/head\s*>/i);
  if (fermeture < 0) return html;
  const tete = REPRISES.reduce((texte, motif) => texte.replace(motif, ""), html.slice(0, fermeture));
  const balises =
    `<title>${echapper(apercu.titre)}</title>\n` +
    `    <meta name="description" content="${echapper(apercu.description)}" />\n` +
    `    <meta property="og:title" content="${echapper(apercu.titre)}" />\n` +
    `    <meta property="og:description" content="${echapper(apercu.description)}" />\n` +
    `    <meta property="og:url" content="${echapper(url)}" />\n    `;
  return tete + balises + html.slice(fermeture);
}
