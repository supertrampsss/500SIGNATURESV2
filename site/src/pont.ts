/**
 * Le pont : d'un euro encaissé à ce qu'il en reste, et ce qu'il y a dedans.
 *
 * La fiche donnait les masses côte à côte. Rangées en liste, elles ne disent
 * pas qu'elles s'enchaînent : le lecteur ne peut pas voir que l'épargne brute
 * *est* la différence des deux premières, ni où passe l'argent qui reste. Le
 * pont met l'enchaînement à plat, dans l'ordre où il se produit, avec une
 * colonne « il reste » — c'est elle qui en fait un pont et non une liste.
 *
 * **Et chaque étape s'ouvre sur ses composantes.** Neuf lignes de totaux, on
 * les trouve déjà partout ailleurs dans la fiche ; ce qu'on ne trouvait nulle
 * part, c'est ce qu'il y a *dans* les 369 millions de charges courantes. La
 * réponse existait depuis le premier jour — l'OFGL publie ses agrégats avec
 * leur place dans l'arbre comptable — et n'était lue nulle part. Ouvrir
 * « Charges courantes » donne les frais de personnel, les interventions, les
 * achats, les charges financières ; ouvrir « Impôts et taxes » sépare les
 * impôts locaux du reste, qui s'ouvre à son tour.
 *
 * **Un total ne s'ouvre que si ses composantes le redonnent.** Elles sont
 * sommées et confrontées au parent avant que le pli n'apparaisse : une
 * décomposition à laquelle il manque une ligne ferait lire « voilà où va
 * l'argent » sous une liste qui n'en explique qu'une partie, et rien dans
 * l'affichage ne le dirait.
 *
 * Trois autres règles tiennent l'honnêteté du bloc.
 *
 * **Chaque marche est une identité publiée**, pas un calcul de notre main :
 * l'OFGL définit l'épargne brute comme « recettes de fonctionnement − dépenses
 * de fonctionnement », l'épargne nette comme « épargne brute − remboursements
 * d'emprunts », les recettes totales comme la somme de leurs trois blocs.
 *
 * **Les paliers se vérifient contre les agrégats publiés.** Recalculés depuis
 * leurs termes puis confrontés à la valeur que l'OFGL publie pour ce même
 * palier ; si l'un des trois contrôles échoue, il n'y a pas de pont. Un
 * enchaînement qui ne boucle pas ne s'explique pas, il s'enlève.
 *
 * **La dernière ligne n'est pas un déficit** au sens de l'État : une collectivité
 * vote sa section de fonctionnement en équilibre. Cette réserve, la méthode des
 * contrôles et le mode d'emploi des plis se lisent sur la page « Données ». Ils
 * ont d'abord été écrits sous le tableau, où ils prenaient plus de place que les
 * chiffres qu'ils accompagnaient — dans une barre latérale, chaque ligne de
 * prose est une ligne de compte en moins.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { millions } from "./echelle.ts";
import { traduire } from "./traductions.ts";

const RF = "ofgl_recettes_fonctionnement";
const DF = "ofgl_depenses_fonctionnement";
const EB = "ofgl_epargne_brute";
const EN = "ofgl_epargne_nette";
const REMBOURSEMENTS = "ofgl_remboursements_d_emprunts_hors_gad";
const RI_HORS_EMPRUNTS = "ofgl_recettes_d_investissement_hors_emprunts";
const EMPRUNTS = "ofgl_emprunts_hors_gad";
const DI_HORS_REMB = "ofgl_depenses_d_investissement_hors_remb";
const RT = "ofgl_recettes_totales";
const DT = "ofgl_depenses_totales";

/** Ce que le pont tolère entre son calcul et l'agrégat publié : l'arrondi de
 *  publication, rien de plus. Un millionième des recettes totales, soit cent
 *  euros sur un budget de cent millions. */
const TOLERANCE_RELATIVE = 1e-6;

/** Ce que tolère une décomposition. Plus lâche que les paliers — chaque
 *  composante est arrondie au centime et le cumul de soixante arrondis dérive —
 *  mais assez serré pour qu'une ligne manquante saute aux yeux : un pour mille. */
const TOLERANCE_DECOMPOSITION = 1e-3;

/** Espace fine insécable : la typographie française avant une unité. */
const FINE = " ";

export type Marche = {
  /** L'agrégat OFGL correspondant, quand la marche en est un : c'est par lui
   *  qu'on retrouve ses composantes. Un report n'en a pas. */
  id?: string;
  libelle: string;
  montant: number;
  /** `depart` ouvre une section, `flux` s'ajoute ou se retranche, `report`
   *  reprend le total de la section précédente sans rien mesurer de neuf,
   *  `palier` est un total intermédiaire publié par l'OFGL, `arrivee` clôt. */
  role: "depart" | "flux" | "report" | "palier" | "arrivee";
  section: "fonctionnement" | "dette" | "investissement";
  /** Ce qu'il reste après cette marche : la colonne qui fait le pont. */
  reste: number;
  /** L'évolution vs l'exercice précédent, en %, ou `null` s'il n'est pas
   *  publié : voir les variations est la moitié de la question « où va
   *  l'argent ». */
  variation?: number | null;
};

/** Une composante d'un agrégat, dans l'arbre comptable de l'OFGL. */
export type Composante = {
  id: string;
  libelle: string;
  montant: number;
  /** Sa part du total qu'elle décompose. */
  part: number;
  /** Son évolution vs l'exercice précédent, en %, quand il est publié. */
  variation?: number | null;
  enfants: Composante[];
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function valeur(territoire: Territoire, id: string, exercice: string): number | undefined {
  const v = territoire.series?.[id]?.[exercice];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** L'exercice publié juste avant celui du pont, ou `null`. */
export function exercicePrecedent(territoire: Territoire, exercice: string): string | null {
  const annees = Object.keys(territoire.series?.[RF] ?? {})
    .filter((a) => a < exercice)
    .sort();
  return annees.length ? annees[annees.length - 1] : null;
}

/** L'évolution en %, ou `null` quand le passé manque ou vaut zéro : un
 *  pourcentage d'un zéro ne mesure rien. */
function evolutionEnPourcent(courant: number, precedent: number | undefined): number | null {
  if (precedent === undefined || precedent === 0) return null;
  return ((courant - precedent) / Math.abs(precedent)) * 100;
}

/**
 * Les composantes d'un agrégat, ou rien.
 *
 * `null` dès que la somme des composantes ne redonne pas le total. Une
 * décomposition incomplète ferait lire « voilà où va l'argent » sous une liste
 * qui n'en explique qu'une partie — et c'est le genre d'erreur qu'aucun lecteur
 * ne peut attraper, puisque rien dans les nombres affichés ne la trahit.
 */
export function composantes(
  parent: string,
  total: number,
  territoire: Territoire,
  exercice: string,
  catalogue: Indicateur[],
  /** « nature » : ce que la commune achète — personnel, achats, intérêts.
   *  « fonction » : à quoi ça sert — écoles, sport, culture. Deux lectures du
   *  même euro, qui ne s'additionnent jamais entre elles. */
  axe: "nature" | "fonction" = "nature",
  /** L'exercice d'avant, pour chiffrer l'évolution de chaque composante.
   *  `null` sur l'axe fonctionnel affiché sur un autre exercice : une
   *  variation sans année de départ claire serait un chiffre menteur. */
  precedent: string | null = null,
): Composante[] | null {
  if (!total) return null;
  const lignes = catalogue
    .filter((i) => (axe === "fonction" ? i.parent_fonction : i.parent) === parent)
    .flatMap((i) => {
      const v = valeur(territoire, i.id, exercice);
      return v === undefined ? [] : [{ indicateur: i, montant: v }];
    });
  if (!lignes.length) return null;
  const somme = lignes.reduce((s, l) => s + l.montant, 0);
  // Des composantes qui dépassent leur total se recouvrent : les afficher
  // compterait le même euro deux fois. Ce cas-là reste un refus.
  if (somme - total > Math.abs(total) * TOLERANCE_DECOMPOSITION) return null;
  // Et une décomposition dont la majorité reste inexpliquée n'explique rien :
  // les impôts locaux de Bordeaux n'ont qu'un enfant publié, la fiscalité
  // reversée, négative — l'afficher donnait « non détaillé : 119 % ». La
  // moitié au moins du total doit être nommée pour que le pli existe.
  if (somme / total < 0.5) return null;
  // Des composantes qui ne couvrent qu'une partie s'affichent quand même,
  // avec le reste nommé. Refuser cachait les subventions aux associations
  // sous les dépenses d'intervention, parce que la source ne publie pas
  // toutes les composantes de cet agrégat — le lecteur perdait le détail
  // publié au motif qu'il en manquait un autre.
  const reste = total - somme;
  const manque =
    Math.abs(reste) > Math.abs(total) * TOLERANCE_DECOMPOSITION
      ? [{
          id: "",
          libelle: "Non détaillé par la source",
          montant: reste,
          part: (reste / total) * 100,
          enfants: [],
        }]
      : [];
  return [...lignes
    .sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))
    .map((l) => ({
      id: l.indicateur.id,
      libelle: l.indicateur.libelle,
      montant: l.montant,
      part: (l.montant / total) * 100,
      variation: precedent
        ? evolutionEnPourcent(l.montant, valeur(territoire, l.indicateur.id, precedent))
        : null,
      // Récursif : « Impôts et taxes » s'ouvre sur les impôts locaux et les
      // autres impôts, qui s'ouvrent à leur tour. Autant de niveaux que la
      // source en publie.
      // Toujours par nature au niveau du dessous : la fonction ne se
      // sous-décompose pas dans ce que la source publie.
      enfants: composantes(l.indicateur.id, l.montant, territoire, exercice, catalogue, "nature", precedent) ?? [],
    })), ...manque];
}

/** Le dernier exercice où la ventilation fonctionnelle d'un agrégat existe,
 *  parmi ceux où l'agrégat lui-même est publié : la somme doit avoir un total
 *  à redonner. */
export function dernierExerciceFonction(
  parent: string,
  territoire: Territoire,
  catalogue: Indicateur[],
): string | null {
  const parents = Object.keys(territoire.series?.[parent] ?? {});
  const exercices = catalogue
    .filter((i) => i.parent_fonction === parent)
    .flatMap((i) => Object.keys(territoire.series?.[i.id] ?? {}))
    .filter((e) => parents.includes(e))
    .sort();
  return exercices.length ? exercices[exercices.length - 1] : null;
}

/** Le dernier exercice où les comptes sont là. */
export function exerciceDuPont(territoire: Territoire): string | null {
  const annees = Object.keys(territoire.series?.[RF] ?? {});
  return annees.length ? annees.sort()[annees.length - 1] : null;
}

/**
 * Les marches du pont, ou rien.
 *
 * `null` dès qu'une grandeur manque ou qu'un contrôle échoue : ce bloc affirme
 * un enchaînement comptable, il ne peut pas en afficher une partie.
 */
export function marches(territoire: Territoire, exercice: string): Marche[] | null {
  const lu = (id: string) => valeur(territoire, id, exercice);
  const rf = lu(RF);
  const df = lu(DF);
  const eb = lu(EB);
  const en = lu(EN);
  const remboursements = lu(REMBOURSEMENTS);
  const investissementRecettes = lu(RI_HORS_EMPRUNTS);
  const emprunts = lu(EMPRUNTS);
  const investissementDepenses = lu(DI_HORS_REMB);
  const rt = lu(RT);
  const dt = lu(DT);
  const termes = [
    rf, df, eb, en, remboursements, investissementRecettes, emprunts,
    investissementDepenses, rt, dt,
  ];
  if (termes.some((t) => t === undefined)) return null;

  const tolerance = Math.max(1, Math.abs(rt as number) * TOLERANCE_RELATIVE);
  const boucle = (calcule: number, publie: number) => Math.abs(calcule - publie) <= tolerance;
  if (!boucle((rf as number) - (df as number), eb as number)) return null;
  if (!boucle((eb as number) - (remboursements as number), en as number)) return null;
  const solde = (rt as number) - (dt as number);
  if (
    !boucle(
      (en as number) + (investissementRecettes as number) + (emprunts as number) -
        (investissementDepenses as number),
      solde,
    )
  ) {
    return null;
  }

  const brut: Omit<Marche, "reste">[] = [
    {
      id: RF, libelle: "Recettes de fonctionnement", montant: rf as number,
      role: "depart", section: "fonctionnement",
    },
    {
      id: DF, libelle: "Charges courantes", montant: -(df as number),
      role: "flux", section: "fonctionnement",
    },
    {
      id: EB, libelle: "Épargne brute", montant: eb as number,
      role: "palier", section: "fonctionnement",
    },
    {
      id: REMBOURSEMENTS, libelle: "Remboursement du capital emprunté",
      montant: -(remboursements as number), role: "flux", section: "dette",
    },
    {
      id: EN, libelle: "Épargne nette", montant: en as number,
      role: "palier", section: "dette",
    },
    // Le report n'apporte aucun euro neuf : il redit le total de la section
    // précédente pour que l'addition de celle-ci se vérifie de l'œil.
    {
      libelle: "Report de l'épargne nette", montant: en as number,
      role: "report", section: "investissement",
    },
    {
      id: RI_HORS_EMPRUNTS, libelle: "Subventions et recettes d'investissement",
      montant: investissementRecettes as number, role: "flux", section: "investissement",
    },
    {
      id: EMPRUNTS, libelle: "Emprunts nouveaux", montant: emprunts as number,
      role: "flux", section: "investissement",
    },
    {
      id: DI_HORS_REMB, libelle: "Dépenses d'investissement",
      montant: -(investissementDepenses as number), role: "flux", section: "investissement",
    },
    {
      libelle: "Ce qui reste à la fin de l'exercice", montant: solde,
      role: "arrivee", section: "investissement",
    },
  ];

  // La colonne « il reste » : le cumul, remis au palier chaque fois que la
  // source en publie un. C'est elle qui fait d'une liste un pont.
  //
  // Et chaque marche porte son évolution vs l'exercice précédent : voir que
  // les frais de personnel montent est la moitié de la question « où va
  // l'argent ». Le report n'en porte pas — il redit l'épargne nette — et
  // l'arrivée compare le solde au solde.
  const precedent = exercicePrecedent(territoire, exercice);
  const anterieure = (id: string | undefined) =>
    precedent && id ? valeur(territoire, id, precedent) : undefined;
  const soldePrecedent =
    precedent !== null
      ? (() => {
          const rtP = valeur(territoire, RT, precedent);
          const dtP = valeur(territoire, DT, precedent);
          return rtP !== undefined && dtP !== undefined ? rtP - dtP : undefined;
        })()
      : undefined;
  let cumul = 0;
  return brut.map((marche) => {
    cumul =
      marche.role === "palier" || marche.role === "arrivee" || marche.role === "report"
        ? marche.montant
        : cumul + marche.montant;
    const variation =
      marche.role === "report"
        ? null
        : marche.role === "arrivee"
          ? evolutionEnPourcent(marche.montant, soldePrecedent)
          : evolutionEnPourcent(
              // La grandeur comptable brute, pas le montant signé de
              // l'affichage : une épargne qui passe de −2 à −1 M€ s'améliore.
              valeur(territoire, marche.id as string, exercice) as number,
              anterieure(marche.id),
            );
    return { ...marche, reste: cumul, variation };
  });
}

/** Les montants du pont se lisent les uns sous les autres, tous à la même
 *  échelle : le million, comme partout ailleurs sur le site. La colonne
 *  passait de « 1,23 Md€ » à « 417,1 M€ » à « 46 k€ » — trois unités qu'il
 *  fallait convertir de tête pour additionner deux lignes voisines. */
export const montant = millions;

/** « +4 % » : l'évolution d'une ligne, arrondie à ce que sa taille justifie. */
export function variationTexte(v: number): string {
  const absolu = Math.abs(v);
  const arrondi =
    absolu >= 100 ? Math.round(absolu / 10) * 10 : absolu >= 10 ? Math.round(absolu) : Math.round(absolu * 10) / 10;
  return `${v >= 0 ? "+" : "−"}${new Intl.NumberFormat("fr-FR").format(arrondi)}${FINE}%`;
}

function part(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.abs(valeur),
  )}${FINE}%`;
}

/**
 * L'évolution, dans sa propre cellule.
 *
 * Rendue sous le montant, en `display: block`, elle décalait la ligne suivante
 * d'une demi-hauteur : le regard qui descend la colonne des montants zigzaguait
 * au lieu de tomber droit. Elle occupe donc une colonne à elle, à droite du
 * montant, et la cellule est écrite même quand il n'y a rien à dire : une
 * cellule absente laisserait le montant de cette ligne-là se recaler sur le
 * bord droit, seul de sa colonne.
 */
function celluleEvolution(variation: number | null | undefined, classe: string): string {
  return `<span class="${classe}">${
    variation === null || variation === undefined ? "" : echapper(variationTexte(variation))
  }</span>`;
}

/**
 * Les composantes, en cascade.
 *
 * Une grille et non un tableau. Un tableau alignait les trois colonnes, mais
 * une composante qui s'ouvre sur les siennes doit occuper toute la largeur —
 * imbriquée dans la première cellule, sa propre grille se comprimait et
 * poussait la colonne « il reste » hors de l'écran. La grille, elle, se répète
 * à chaque niveau sans jamais sortir de sa colonne.
 *
 * La profondeur se lit sur deux marques, pas sur onze pixels de décalage : le
 * `data-rang` de chaque composante, et celui de la liste qui les porte — c'est
 * lui qui permet de tirer un trait de rattachement d'un niveau à l'autre.
 */
function rendreComposantes(liste: Composante[], rang = 1): string {
  return liste
    .map((c) => {
      const rangee = `<span class="pont__c-nom">${echapper(traduire(c.libelle))}</span>
        <span class="pont__c-part">${echapper(part(c.part))}</span>
        <span class="pont__c-montant">${echapper(montant(c.montant))}</span>
        ${celluleEvolution(c.variation, "pont__c-evolution")}`;
      const corps = c.enfants.length
        ? `<details class="pont__sous">
             <summary class="pont__rangee pont__rangee--composante">${rangee}</summary>
             <ul class="pont__composantes" data-rang="${rang + 1}">${rendreComposantes(
               c.enfants,
               rang + 1,
             )}</ul>
           </details>`
        : `<span class="pont__rangee pont__rangee--composante">${rangee}</span>`;
      return `<li class="pont__composante" data-rang="${rang}">${corps}</li>`;
    })
    .join("");
}

/**
 * Rendu pur, sans DOM : c'est lui qui est testé.
 *
 * Ouvert, et non replié. « D'un euro encaissé à ce qu'il en reste » est la
 * question que le lecteur vient poser : la mettre derrière un triangle à
 * déplier revenait à la ranger avec les annexes.
 */
export function rendu(territoire: Territoire, catalogue: Indicateur[] = []): string {
  const exercice = exerciceDuPont(territoire);
  if (!exercice) return "";
  const etapes = marches(territoire, exercice);
  if (!etapes) return "";
  const precedent = exercicePrecedent(territoire, exercice);

  const lignes = etapes
    .map((etape) => {
      const parNature = etape.id
        ? composantes(
            etape.id, Math.abs(etape.montant), territoire, exercice, catalogue,
            "nature", precedent,
          )
        : null;
      // Le second axe : à quoi sert l'argent, plutôt que ce qu'on achète.
      // « Achats et charges externes » ne se discute pas ; « 23 M€ pour le
      // sport » se discute.
      //
      // Son exercice n'est pas forcément celui du pont : le grand livre parait
      // avec deux ans de retard sur l'OFGL. Plutôt que d'attendre 2027 pour
      // montrer 2025, la ventilation s'affiche sur son propre exercice, contre
      // l'agrégat de ce même exercice — c'est contre lui que la somme boucle —
      // et le bouton porte l'année quand elle diffère.
      const exerciceFonction = etape.id
        ? dernierExerciceFonction(etape.id, territoire, catalogue)
        : null;
      const totalFonction =
        etape.id && exerciceFonction ? valeur(territoire, etape.id, exerciceFonction) : undefined;
      const parFonction =
        etape.id && exerciceFonction && totalFonction
          ? composantes(
              etape.id, Math.abs(totalFonction), territoire, exerciceFonction, catalogue,
              "fonction",
            )
          : null;
      // Sans bascule, pas d'axe fonctionnel d'un autre exercice : une liste
      // 2023 sous une ligne 2025, sans bouton pour porter l'année, se lirait
      // comme du 2025.
      const decomposition =
        parNature ?? (exerciceFonction === exercice ? parFonction : null);
      // Une seule colonne de montants. Le « mouvement » et le « il reste »
      // côte à côte doublaient la moitié des nombres : le cumul après chaque
      // flux est exactement le palier de la ligne suivante. Chaque ligne porte
      // son montant signé, les paliers portent le leur en gras — c'est le
      // signe et le trait qui font lire l'addition.
      const rangee = `<span class="pont__nom">${echapper(traduire(etape.libelle))}</span>
        <span class="pont__reste">${echapper(montant(etape.montant))}</span>
        ${celluleEvolution(etape.variation, "pont__evolution")}`;
      // Deux axes disponibles : le lecteur choisit lequel il regarde. Ils ne
      // s'additionnent jamais entre eux — c'est le même euro, vu deux fois.
      const bascule =
        parNature && parFonction
          ? `<p class="pont__axes" role="group" aria-label="Décomposer par">
               <button type="button" data-axe="nature" aria-pressed="true">ce qu'elle achète</button>
               <button type="button" data-axe="fonction" aria-pressed="false">à quoi ça sert${
                 exerciceFonction && exerciceFonction !== exercice
                   ? ` (${echapper(exerciceFonction)})`
                   : ""
               }</button>
             </p>`
          : "";
      const listes = !decomposition
        ? ""
        : parNature && parFonction
        ? `<ul class="pont__composantes" data-axe="nature">${rendreComposantes(parNature)}</ul>
           <ul class="pont__composantes" data-axe="fonction" hidden>${rendreComposantes(
             parFonction,
           )}</ul>`
        : `<ul class="pont__composantes">${rendreComposantes(decomposition)}</ul>`;
      // Ouvert d'emblée : un pli fermé cache l'information qu'on est venu
      // chercher, et le lecteur ne sait pas qu'elle existe.
      const corps = decomposition
        ? `<details class="pont__ouvrir" open>
             <summary class="pont__rangee">${rangee}</summary>
             ${bascule}${listes}
           </details>`
        : `<span class="pont__rangee">${rangee}</span>`;
      return `<li class="pont__ligne pont__ligne--${etape.role}">${corps}</li>`;
    })
    .join("");

  return `<section class="pont">
    <h3>D'un euro encaissé à ce qu'il en reste <span class="pont__exercice">exercice ${echapper(
      exercice,
    )}${
      precedent && etapes.some((e) => e.variation !== null && e.variation !== undefined)
        ? `, évolutions vs ${echapper(precedent)}`
        : ""
    }</span></h3>
    <ol class="pont__etapes">${lignes}</ol>
  </section>`;
}
