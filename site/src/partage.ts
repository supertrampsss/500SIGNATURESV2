/**
 * Les trois formats d'un objet partageable — permalien, résumé texte, image.
 *
 * Spec §13 : « trois formats, produits d'un même geste ». Ce module produit
 * les trois, en fonctions pures : il ne touche ni au document, ni au réseau,
 * ni à l'horloge. Le geste lui-même — le panneau du système, le presse-papiers,
 * le lien de téléchargement — vit dans `main.ts`, qui appelle `offrir()` avec
 * les deux canaux que le navigateur porte réellement.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UNE SEULE VOIX PAR OBJET
 * ─────────────────────────────────────────────────────────────────────────
 * Le résumé d'un scénario **n'est pas réécrit ici** : il reprend mot pour mot
 * l'aperçu que `apercuScenario` (apercu-scenario.ts) compose déjà pour la carte
 * de lien, laquelle décompte à son tour l'effort et les gestes d'`atelier.ts`.
 * Un lecteur qui voit l'aperçu du lien puis colle le résumé lit alors la même
 * phrase ; deux rédactions du même scénario finiraient par dire deux choses.
 * Même règle pour une analyse : son résumé reprend le titre et la phrase de
 * verdict que le pré-rendu a posés dans ses balises, pas une seconde version.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TOUT OBJET N'A PAS D'IMAGE, ET LE DIRE EST LE TRAVAIL DU TYPE
 * ─────────────────────────────────────────────────────────────────────────
 * Le build rasterise un PNG par analyse et un pour le site (D-L3-a) ; il n'en
 * écrit **aucun par scénario**, l'espace des budgets encodés étant infini
 * (D-L3-b). `image` vaut donc `null` pour un scénario comme pour une
 * comparaison, et `main.ts` n'offre le lien de téléchargement que là où il y a
 * un fichier au bout. Une adresse d'image que le build n'écrit jamais est un
 * aperçu cassé, exactement ce que `validerImagesAnnoncees` fait rougir au
 * build.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QU'UN RÉSUMÉ N'ÉCRIT JAMAIS
 * ─────────────────────────────────────────────────────────────────────────
 * **Aucun total de dépense publique.** Un scénario règle plusieurs budgets qui
 * ne s'additionnent pas ; ce qui s'additionne, ce sont les écarts, et ce
 * nombre-là est nommé « somme des écarts ». Une comparaison pose ses deux
 * colonnes côte à côte, dans l'ordre reçu, sans jamais les sommer, ni les
 * noter, ni désigner laquelle mène.
 */

import type { Apercu } from "./apercu-scenario.ts";
import { MENTION_UNITE } from "./apercu-scenario.ts";
import type { ColonneComparee } from "./carte-og.ts";
import { formater } from "./echelle.ts";

/**
 * Les deux formes du résumé.
 *
 * `compact` ne s'offre que là où il y a un détail à garder — un scénario. Sur
 * un objet qui n'en a pas, `resume()` rend la forme complète : mieux vaut la
 * phrase entière qu'une ligne vide.
 */
export type Forme = "complet" | "compact";

/** Un objet partageable, dans ses trois formats. */
export type Partage = {
  /** Le titre court : celui que le panneau de partage du système affiche. */
  titre: string;
  /** L'URL complète, qui restitue l'état exact. */
  permalien: string;
  /** Les lignes du résumé, **sans** le lien — `resume()` l'ajoute. Deux au
   *  plus : avec le lien, le collage tient en trois lignes (spec §13). */
  lignes: readonly string[];
  /** La variante compacte à pictogrammes, ou `null` quand l'objet n'a rien à
   *  garder pour lui. */
  compact: readonly string[] | null;
  /** L'adresse de l'image de cet objet, ou `null` quand le build n'en écrit
   *  aucune pour lui. */
  image: string | null;
};

/* --------------------------------------------------------------------------
 * Le permalien
 * ----------------------------------------------------------------------- */

/**
 * L'URL complète d'un objet, qui restitue son état exact.
 *
 * Les paramètres passent par `URLSearchParams`, jamais par une concaténation :
 * un budget encodé porte `/`, `:` et `,` (voir `encoder`, atelier.ts) et le nom
 * qu'un lecteur donne à son scénario porte ce qu'il veut, `&` et `#` compris.
 * Recollés à la main, ces caractères coupent l'adresse en deux et le lien
 * partagé ouvre un atelier vierge — un budget perdu, sans un mot.
 *
 * Une valeur vide n'entre pas dans l'adresse. `lireUrl` (main.ts) rend `""`
 * pour un paramètre absent : l'écrire quand même allongerait le lien de
 * paramètres qui ne disent rien.
 */
export function permalien(
  origine: string,
  chemin: string,
  parametres: Record<string, string>,
): string {
  const url = new URL(chemin, origine);
  for (const [nom, valeur] of Object.entries(parametres)) {
    if (valeur) url.searchParams.set(nom, valeur);
  }
  return url.toString();
}

/** Le résumé collable : les lignes de la forme demandée, puis le lien. */
export function resume(partage: Partage, forme: Forme = "complet"): string {
  const lignes = forme === "compact" ? (partage.compact ?? partage.lignes) : partage.lignes;
  return [...lignes, partage.permalien].join("\n");
}

/* --------------------------------------------------------------------------
 * La forme de l'effort — la variante compacte à pictogrammes
 * ----------------------------------------------------------------------- */

/** Ce qu'un pictogramme dit d'un geste : son sens. Deux triangles, pas deux
 *  couleurs — la charte n'a pas de vert « bien » face à un rouge « mal », et un
 *  écart n'est ni l'un ni l'autre. */
const HAUSSE = "▲";
const BAISSE = "▼";

/** Trois hauteurs de pictogramme, et pas dix : au-delà, un lecteur compare des
 *  répétitions au lieu de voir une silhouette. */
const HAUTEURS = 3;

/** Le nombre de gestes dessinés. La ligne reste lisible dans un fil de
 *  discussion, et le compte entre parenthèses dit ce qui n'est pas dessiné. */
const GESTES_DESSINES = 8;

/** Sous l'euro il n'y a rien : un transfert intégralement propagé rend l'euro
 *  exact et la virgule flottante non (même garde qu'`apercuScenario`). Un
 *  pictogramme pour un geste qui ne déplace rien dessinerait une forme absente. */
const SEUIL = 1;

/**
 * La silhouette de l'effort : un groupe de pictogrammes par geste, du plus
 * lourd au moins lourd.
 *
 * Ni intitulé, ni montant, ni somme : la variante compacte montre **la forme**
 * d'un budget réglé — combien de gestes, dans quel sens, avec quel relief — et
 * garde le détail pour la page. C'est ce qui donne une raison d'ouvrir le lien
 * plutôt que de s'arrêter au collage (spec §13).
 *
 * Le relief est **relatif au geste le plus lourd**, jamais à une échelle
 * absolue : un scénario qui déplace des dizaines de millions et un qui déplace
 * des dizaines de milliards ont tous deux une silhouette, et une échelle
 * absolue aplatirait le premier en une ligne de pictogrammes identiques.
 */
export function formeEffort(ecarts: readonly number[]): string {
  const retenus = ecarts.filter((ecart) => Math.abs(ecart) >= SEUIL);
  if (retenus.length === 0) return "";
  const plusLourd = Math.max(...retenus.map(Math.abs));
  const dessines = retenus.slice(0, GESTES_DESSINES).map((ecart) => {
    const hauteur = Math.max(1, Math.ceil((Math.abs(ecart) / plusLourd) * HAUTEURS));
    return (ecart > 0 ? HAUSSE : BAISSE).repeat(hauteur);
  });
  return dessines.join(" ") + (retenus.length > dessines.length ? "…" : "");
}

/** La ligne compacte d'un scénario : la silhouette, et le nombre de gestes
 *  qu'elle résume — un compte n'est pas un détail, il dit seulement l'ampleur
 *  de ce que le lien contient. */
function ligneForme(ecarts: readonly number[]): string {
  const retenus = ecarts.filter((ecart) => Math.abs(ecart) >= SEUIL).length;
  const forme = formeEffort(ecarts);
  if (!forme) return "Aucun geste : le budget est celui qui a été voté.";
  return `Forme de l'effort, du plus lourd au moins lourd : ${forme} (${retenus} ${
    retenus > 1 ? "gestes" : "geste"
  }).`;
}

/* --------------------------------------------------------------------------
 * Les objets partageables
 * ----------------------------------------------------------------------- */

/**
 * Une analyse : son titre, sa phrase de verdict, son permalien, son image.
 *
 * Les quatre champs sont ceux que le pré-rendu a écrits dans les balises de la
 * page (`balisesPartage`, scripts/prerendre.ts) : `main.ts` les y relit plutôt
 * que de recomposer un texte. La carte de lien et le collage disent alors la
 * même chose, mot pour mot.
 *
 * **Les chiffres de l'analyse ne montent pas dans le résumé, ils montent dans
 * l'image.** Chacun d'eux tient à sa lecture — « crédits votés » et « crédits
 * consommés » sont deux montants du même exercice, et c'est leur différence de
 * définition que l'analyse existe pour dire. Alignés nus dans un collage, ils se
 * lisent comme une contradiction ou comme un total. La carte les peint avec
 * leur intitulé, et le même geste l'attache.
 */
export function partageAnalyse(analyse: {
  titre: string;
  phrase: string;
  permalien: string;
  image: string | null;
}): Partage {
  return {
    titre: analyse.titre,
    permalien: analyse.permalien,
    lignes: [analyse.titre, analyse.phrase].filter(Boolean),
    compact: null,
    image: analyse.image,
  };
}

/**
 * Un scénario : l'aperçu déjà composé, le permalien, les écarts de son plan.
 *
 * `apercu` vient d'`apercuScenario()` — c'est la seule rédaction d'un scénario
 * dans ce dépôt. `ecarts` est la suite des `delta` de `plan()`, déjà rendue la
 * plus lourde d'abord : la silhouette n'a rien à retrier.
 *
 * `image` vaut `null`, et ce n'est pas un manque à combler : aucun PNG n'est
 * écrit par scénario (D-L3-b).
 */
export function partageScenario(scenario: {
  apercu: Apercu;
  permalien: string;
  ecarts: readonly number[];
}): Partage {
  return {
    titre: scenario.apercu.titre,
    permalien: scenario.permalien,
    lignes: [scenario.apercu.titre, scenario.apercu.description],
    compact: [scenario.apercu.titre, ligneForme(scenario.ecarts)],
    image: null,
  };
}

/**
 * Une comparaison : deux colonnes et leur somme des écarts.
 *
 * **Jamais leur somme**, jamais une note, jamais une marque de tête : les deux
 * noms sont écrits dans l'ordre reçu, séparés d'un point médian, et rien ici ne
 * classe. Deux budgets ne s'additionnent pas — un troisième nombre sous les
 * deux autres se lirait comme leur total.
 *
 * Pas d'image non plus : une comparaison est un couple de budgets encodés, donc
 * du même espace infini qu'un scénario.
 */
export function partageComparaison(comparaison: {
  colonnes: readonly [ColonneComparee, ColonneComparee];
  permalien: string;
}): Partage {
  const [gauche, droite] = comparaison.colonnes;
  const titre = `« ${gauche.nom} » et « ${droite.nom} » en regard`;
  const somme = (colonne: ColonneComparee) =>
    `« ${colonne.nom} » ${formater(colonne.effort, "EUR", false)}`;
  return {
    titre,
    permalien: comparaison.permalien,
    lignes: [
      titre,
      `Somme des écarts : ${somme(gauche)} · ${somme(droite)}. ${MENTION_UNITE}`,
    ],
    compact: null,
    image: null,
  };
}

/**
 * Une fiche de territoire : son nom, ses repères, l'exercice qui les porte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI LES CHIFFRES MONTENT ICI, ALORS QU'ILS NE MONTENT PAS AILLEURS
 * ─────────────────────────────────────────────────────────────────────────
 * Le résumé d'une analyse s'en abstient — deux montants du même exercice sous
 * deux définitions se lisent nus comme une contradiction. Ceux d'une fiche
 * n'ont pas ce piège : ce qui entre, ce qui sort, ce qui reste sont trois
 * grandeurs distinctes, et c'est précisément ce qu'on partage quand on partage
 * le budget de sa commune. Chacun garde son rôle devant lui, l'exercice les
 * date tous les trois, et la mention d'unité ferme la ligne.
 *
 * **Trois, comme la carte**, et les trois premiers dans l'ordre que la fiche a
 * choisi : le collage et l'image disent alors la même chose. Le quatrième
 * repère reste à l'écran, où il a la place de sa ligne.
 *
 * `image` vaut `null`, et pour une raison propre à cet objet : une fiche a
 * bien une adresse stable, mais trente-quatre mille huit cent soixante-quinze
 * PNG ne se rasterisent pas au build. L'image se construit donc dans le
 * navigateur, à partir de `carteFiche`, et se télécharge — elle n'a pas
 * d'adresse, donc rien à annoncer ici.
 */
export function partageFiche(fiche: {
  nom: string;
  maille: string;
  exercice: string;
  reperes: readonly { libelle: string; valeur: number; unite: string }[];
  permalien: string;
}): Partage {
  const titre = `${fiche.nom} — ${fiche.maille}`;
  const chiffres = fiche.reperes
    .slice(0, 3)
    .map((repere) => `${repere.libelle} ${formater(repere.valeur, repere.unite, false)}`)
    .join(" · ");
  // Sans chiffre publié, la deuxième ligne serait « exercice 2025. Montants en
  // millions d'euros. » sous un nom de commune : une mention d'unité sans un
  // nombre à mesurer. Le titre et le lien suffisent alors.
  const lignes = chiffres
    ? [titre, `${chiffres} — exercice ${fiche.exercice}. ${MENTION_UNITE}`]
    : [titre];
  return {
    titre,
    permalien: fiche.permalien,
    lignes,
    compact: null,
    image: null,
  };
}

/* --------------------------------------------------------------------------
 * Le geste : le panneau du système, sinon le presse-papiers
 * ----------------------------------------------------------------------- */

/** Ce que `navigator.share` attend. Le lien va dans `url`, pas dans `text` :
 *  les deux ensemble, la plupart des cibles collent l'adresse deux fois. */
export type ChargeSysteme = { title: string; text: string; url: string };

/**
 * Les deux canaux, injectés plutôt que lus dans `navigator`.
 *
 * `partager` est **facultatif**, et c'est le cœur du module : `navigator.share`
 * n'existe pas sur la plupart des navigateurs de bureau. Le presse-papiers
 * n'est donc pas un cas limite, c'est le chemin d'une bonne part des lecteurs,
 * et les deux s'éprouvent ici sous Node avec de simples fonctions.
 */
export type Canaux = {
  partager?: (charge: ChargeSysteme) => Promise<void>;
  copier?: (texte: string) => Promise<void>;
};

/** Ce qu'il est advenu du geste. `annulé` n'est pas un échec : le lecteur a
 *  fermé le panneau, et l'écran n'a rien à lui annoncer. */
export type Issue = "partagé" | "copié" | "annulé" | "indisponible";

/** Le nom que le navigateur donne au rejet d'un panneau que le lecteur ferme.
 *  Reconnu par le nom et non par la classe : `DOMException` n'existe pas
 *  partout où ce module tourne. */
function annulation(erreur: unknown): boolean {
  return (erreur as { name?: string } | null)?.name === "AbortError";
}

/**
 * Offre l'objet : le panneau du système quand il existe, le presse-papiers
 * sinon.
 *
 * Trois chemins, et le troisième est celui qu'on oublie :
 *
 * 1. `navigator.share` tenu — le système prend la main, rien à afficher.
 * 2. Pas de `navigator.share`, ou il échoue pour une autre raison que
 *    l'annulation (le geste n'est pas reconnu comme volontaire, la cible refuse
 *    la charge) : le presse-papiers reçoit le résumé, lien compris.
 * 3. **Le lecteur ferme le panneau** : la promesse est rejetée en `AbortError`.
 *    Ce n'est pas une panne. Recopier alors dans le presse-papiers passerait
 *    outre un refus, et afficher « le partage a échoué » serait un mensonge à
 *    l'écran. La fonction rend `annulé`, et l'appelant n'affiche rien.
 */
export async function offrir(
  partage: Partage,
  canaux: Canaux,
  forme: Forme = "complet",
): Promise<Issue> {
  const lignes = forme === "compact" ? (partage.compact ?? partage.lignes) : partage.lignes;
  if (canaux.partager) {
    try {
      await canaux.partager({
        title: partage.titre,
        text: lignes.join("\n"),
        url: partage.permalien,
      });
      return "partagé";
    } catch (erreur) {
      if (annulation(erreur)) return "annulé";
    }
  }
  if (!canaux.copier) return "indisponible";
  try {
    await canaux.copier(resume(partage, forme));
    return "copié";
  } catch {
    return "indisponible";
  }
}
