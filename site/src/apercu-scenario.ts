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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE L'APERÇU ÉCRIT TOUJOURS : D'OÙ VIENNENT LES LIGNES QU'IL CHIFFRE
 * ─────────────────────────────────────────────────────────────────────────
 * Un écart est l'arithmétique du lecteur, mais il s'applique à une ligne
 * publiée d'un exercice précis : sans cet exercice, personne ne peut le
 * refaire. Et cette description est le **seul** canal d'un scénario partagé —
 * il n'y a pas d'image par scénario (décision D-L3-b). Elle nomme donc les
 * cadres publiés des budgets qu'elle chiffre, comme `exigerProvenance`
 * (carte-og.ts) l'exige d'une image et `citer()` d'un nombre copié.
 */

import { decoder, effort, plan, type LigneAtelier, type Volet } from "./atelier.ts";
import { MENTION_MILLIONS } from "./echelle.ts";
import { eurosSigne } from "./simulateur-rendu.ts";
import { echapper } from "./texte.ts";

/** Ce qu'une carte de lien porte de texte, et ce que la fonction d'edge pose
 *  dans le document servi. */
export type Apercu = { titre: string; description: string };

/** Le titre d'un scénario que le lecteur n'a pas nommé. Les scénarios sans nom
 *  sont le cas courant : un budget se partage bien avant d'être enregistré. */
const TITRE_SANS_NOM = "Un scénario du simulateur";

/**
 * Ce qu'une carte de lien montre avant de couper.
 *
 * X coupe l'`og:description` autour de 200 signes, LinkedIn autour de 250,
 * Facebook autour de 300 : c'est la plus serrée des trois qui décide, sinon la
 * clause de provenance tombe hors du cadre visible là où un lien circule le
 * plus. Mesuré sur un scénario réglant les trois cadres, la description faisait
 * 276 signes et la clause commençait au signe 190 : elle partait coupée à
 * « Sources : PL », et les exercices avec.
 *
 * **La mention d'unité reste hors de ce budget**, et c'est délibéré : elle vient
 * après la clause, et des deux c'est elle qui se rattrape — chaque montant porte
 * déjà son « M€ », alors que l'exercice n'est écrit nulle part ailleurs. Elle
 * pèse 29 signes, si bien qu'à 200 signes de budget la description entière tient
 * sous les 250 de LinkedIn.
 */
const SIGNES_VISIBLES = 200;

/** Au plus trois gestes, et pas quatre : au-delà, la description dépasse ce
 *  qu'une carte de lien affiche. Combien s'en écrivent vraiment, c'est le budget
 *  de signes qui le dit, geste par geste — un scénario aux intitulés courts en
 *  garde trois, un scénario aux intitulés longs perd le plus léger plutôt que la
 *  clause de provenance. */
const GESTES_MONTRES = 3;

/** De quoi nommer un geste sans manger la place des deux autres. Les intitulés
 *  officiels vont au-delà de cent caractères (« Enseignement scolaire public du
 *  premier degré ») et trois d'entre eux, non bornés, poussaient les montants
 *  hors de ce qu'une plateforme montre.
 *
 *  La borne n'a pas été resserrée pour loger la clause de provenance : un
 *  intitulé coupé plus court cesse d'identifier la ligne qu'il nomme, et ce
 *  serait le défaut qu'on vient de fermer sur les cartes — un tronçon qui ne
 *  vaut pas mieux que rien. C'est le nombre de gestes qui cède, pas leur nom. */
const LIBELLE_MAX = 46;

/** Le nom que le lecteur donne à son scénario voyage dans l'adresse : il est
 *  aussi long qu'on veut. Borné ici, échappé plus bas — un aperçu ne recopie
 *  jamais tel quel ce qu'une adresse lui tend. */
const NOM_MAX = 70;

/** Ce que sont les nombres de la description.
 *
 *  La mention est en dernier, une fois : ce sont les gestes qu'on vient lire,
 *  et une carte de lien coupe par la queue.
 *
 *  La phrase vient d'`echelle.ts`, comme celle des cartes de partage : les
 *  deux disaient la même chose dans deux constantes, à un point final près, et
 *  deux formulations d'une même règle se corrigent séparément. Le point est
 *  ajouté ici parce qu'ici elle est une phrase entière, au bout d'une
 *  description qui en aligne trois.
 *
 *  Exportée pour que le résumé collable (`partage.ts`) l'écrive dans les mêmes
 *  mots. */
export const MENTION_UNITE = `${MENTION_MILLIONS}.`;

/**
 * Les cadres publiés des budgets que le scénario touche : « PLF 2025 »,
 * « PLFSS 2026 », « Comptes de gestion 2025 ». `null` quand l'un d'eux n'en
 * déclare pas.
 *
 * **Un scénario ne traverse pas un seul millésime.** Régler l'État et la
 * Sécurité sociale, c'est régler un PLF 2025 et un PLFSS 2026 : en choisir un
 * seul le ferait valoir faussement pour l'autre, et n'en nommer aucun laisse
 * partir des écarts que personne ne peut retrouver dans un fichier. Ils sont
 * donc **tous** nommés, et **seulement ceux dont une ligne bouge** — jamais les
 * six volets que l'atelier monte, dont la plupart ne portent aucun geste.
 *
 * **Un barème n'entre pas dans la liste.** Il ne pose aucun nombre ici : sa
 * contribution est nulle et son effet vit dans la ligne d'impôt qu'il pilote
 * (`contribution`, atelier.ts), au millésime du budget qui la porte. Nommer
 * l'exercice du barème daterait de son millésime un écart inscrit sur un autre.
 *
 * L'ordre est celui des volets — celui des sections de la page —, jamais celui
 * du poids des gestes, qui changerait d'un réglage à l'autre.
 *
 * `null` plutôt qu'un cadre approché : un type exige un champ, pas une valeur,
 * et `{ loi: "", exercice: "" }` se publie (même faille que celle que
 * `exigerProvenance` ferme dans carte-og.ts). Sans cadre, l'aperçu se tait et
 * le lien garde les métadonnées du site.
 */
function provenances(
  volets: readonly Volet[],
  lignes: readonly LigneAtelier[],
): string[] | null {
  const touches = new Set(lignes.map((ligne) => ligne.volet.cle));
  const cadres: string[] = [];
  for (const volet of volets) {
    if (volet.genre !== "budget" || !touches.has(volet.cle)) continue;
    const { loi, exercice } = volet.budget;
    if (!loi.trim() || !exercice.trim()) return null;
    const cadre = `${loi} ${exercice}`;
    // Les trois échelons de collectivités partagent le même cadre : nommé une
    // fois, pas trois.
    if (!cadres.includes(cadre)) cadres.push(cadre);
  }
  return cadres.length > 0 ? cadres : null;
}

/**
 * Coupe au dernier mot entier et marque la suite. Un intitulé tronqué reste
 * lisible ; un intitulé qui pousse les montants hors du cadre, non.
 *
 * **La coupe compte les points de code, pas les unités UTF-16** — même règle
 * que `replier` (carte-og.ts), et pour la même raison : une paire de
 * substitution est un caractère, pas deux. Le nom d'un scénario vient de
 * l'adresse, c'est la seule saisie non maîtrisée de ce chemin, et un émoji y
 * est ordinaire. Coupée en unités, la chaîne partait avec un demi-caractère à
 * la queue — un substitut haut isolé, que rien ne remplace par U+FFFD : le
 * `og:title` servi ne se décodait plus en UTF-8, et cela ne se voit qu'une
 * fois le lien posté.
 */
function abreger(texte: string, maximum: number): string {
  const propre = texte.trim();
  const points = [...propre];
  if (points.length <= maximum) return propre;
  const gardes = points.slice(0, maximum);
  const espace = gardes.lastIndexOf(" ");
  const coupe = (espace > maximum / 2 ? gardes.slice(0, espace) : gardes).join("");
  return `${coupe.trimEnd()}…`;
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

  const cadres = provenances(volets, lignes);
  if (!cadres) return null;

  const nomNet = abreger(nom, NOM_MAX);
  const titre = nomNet ? `« ${nomNet} » — un scénario du simulateur` : TITRE_SANS_NOM;

  // Un transfert intégralement propagé rend l'euro exact, la virgule flottante
  // non : sous l'euro il n'y a rien, et surtout pas un « +0,00 M€ » qui ferait
  // passer une compensation exacte pour un gain. Même garde que `renduEffort`
  // (simulateur-rendu.ts), qui l'affiche à l'écran.
  const brut = effort(volets, etat);
  const somme = Math.abs(brut) < 1 ? 0 : brut;

  // La provenance passe AVANT la mention d'unité, qui reste la dernière phrase
  // : une carte de lien coupe par la queue, et des deux, l'unité est celle qui
  // se rattrape — chaque montant porte déjà son « M€ », alors que l'exercice
  // n'est écrit nulle part ailleurs.
  const tete = `Somme des écarts : ${eurosSigne(somme)}.`;
  const source = `Source${cadres.length > 1 ? "s" : ""} : ${cadres.join(", ")}.`;
  /** La description jusqu'à la clause de provenance : c'est elle qui doit tenir
   *  dans le budget de signes, la mention d'unité venant après. */
  const jusquAuxSources = (gestes: readonly string[]) =>
    `${tete}${gestes.length > 0 ? ` ${gestes.join(" ; ")}.` : ""} ${source}`;

  // La clause prend sa place d'abord, les gestes reçoivent ce qui reste — même
  // ordre que le millésime d'une carte de partage (carte-og.ts), et pour la même
  // raison : ce qui permet de retrouver le chiffre ne se sacrifie pas au chiffre.
  //
  // Le compte est en POINTS DE CODE, comme `abreger`. Et l'arrêt est un `break`,
  // jamais un `continue` : `plan` rend les lignes de la plus lourde à la plus
  // légère, et loger une ligne légère à la place d'une lourde qui déborde
  // montrerait un autre scénario que celui que la page ouvre.
  const gestes: string[] = [];
  for (const ligne of lignes.slice(0, GESTES_MONTRES)) {
    const geste = `${abreger(ligne.entree.libelle, LIBELLE_MAX)} ${eurosSigne(ligne.delta)}`;
    if ([...jusquAuxSources([...gestes, geste])].length > SIGNES_VISIBLES) break;
    gestes.push(geste);
  }

  return { titre, description: `${jusquAuxSources(gestes)} ${MENTION_UNITE}` };
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
  /<meta\s+property="og:(?:title|description|url|image)"[^>]*>\s*/gi,
];

/**
 * L'image d'un scénario partagé : la carte du simulateur, produite au build.
 *
 * Toujours pas d'image par scénario (décision D-L3-b) : l'espace des budgets
 * encodés est infini, et rasteriser à l'edge supposerait un rasteriseur et une
 * fonte sur un chemin que les robots appellent. Mais le document servi porte
 * l'image du **site**, et une plateforme montre l'image en grand avec le titre
 * dessous : « « Mon budget » — un scénario du simulateur » s'affichait sous une
 * carte annonçant « Où va l'argent public : carte des finances locales ».
 * Celle-ci dit « Simulateur », ce que le titre dit aussi.
 *
 * Le chemin est exporté pour que le pré-rendu écrive l'image **à cet
 * endroit-là** : deux constantes se seraient désaccordées le jour où l'une
 * bouge, et un `og:image` mort donne un aperçu vide — ce qui ne se voit qu'une
 * fois le lien partagé.
 */
export const IMAGE_SCENARIO = "/simulateur/carte.png";

/**
 * Le document servi, ses métadonnées remplacées par celles du scénario.
 *
 * `image` est une adresse **absolue**, composée par l'appelant depuis l'adresse
 * demandée : tous les robots ne résolvent pas un chemin, et la fonction ne
 * connaît pas le domaine sous lequel elle tourne autrement que par la requête.
 *
 * La fonction **insère** ce qu'elle a retiré plutôt que de compter sur la
 * présence des balises : un gabarit qui perdrait ses `og:` servirait sinon un
 * aperçu muet sans que rien ne le dise. Un document sans `</head>` est rendu
 * inchangé — il ne se répare pas, et le mutiler servirait moins bien qu'un
 * aperçu générique.
 */
export function poserApercu(html: string, apercu: Apercu, url: string, image: string): string {
  const fermeture = html.search(/<\/head\s*>/i);
  if (fermeture < 0) return html;
  const tete = REPRISES.reduce((texte, motif) => texte.replace(motif, ""), html.slice(0, fermeture));
  const balises =
    `<title>${echapper(apercu.titre)}</title>\n` +
    `    <meta name="description" content="${echapper(apercu.description)}" />\n` +
    `    <meta property="og:title" content="${echapper(apercu.titre)}" />\n` +
    `    <meta property="og:description" content="${echapper(apercu.description)}" />\n` +
    `    <meta property="og:url" content="${echapper(url)}" />\n` +
    `    <meta property="og:image" content="${echapper(image)}" />\n    `;
  return tete + balises + html.slice(fermeture);
}
