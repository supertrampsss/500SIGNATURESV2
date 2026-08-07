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
 * **La dernière ligne n'est pas un déficit.** Une collectivité vote sa section
 * de fonctionnement en équilibre : l'écart entre tout ce qu'elle a encaissé et
 * tout ce qu'elle a payé ne se lit pas comme le solde budgétaire de l'État, qui
 * est un besoin de financement.
 */

import type { Indicateur, Territoire } from "./donnees.ts";

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
  lecture?: string;
};

/** Une composante d'un agrégat, dans l'arbre comptable de l'OFGL. */
export type Composante = {
  id: string;
  libelle: string;
  montant: number;
  /** Sa part du total qu'elle décompose. */
  part: number;
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
): Composante[] | null {
  if (!total) return null;
  const lignes = catalogue
    .filter((i) => i.parent === parent)
    .flatMap((i) => {
      const v = valeur(territoire, i.id, exercice);
      return v === undefined ? [] : [{ indicateur: i, montant: v }];
    });
  // Une composante unique n'est pas une décomposition : c'est le même chiffre
  // sous un autre nom.
  if (lignes.length < 2) return null;
  const somme = lignes.reduce((s, l) => s + l.montant, 0);
  if (Math.abs(somme - total) > Math.abs(total) * TOLERANCE_DECOMPOSITION) return null;
  return lignes
    .sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))
    .map((l) => ({
      id: l.indicateur.id,
      libelle: l.indicateur.libelle,
      montant: l.montant,
      part: (l.montant / total) * 100,
      // Récursif : « Impôts et taxes » s'ouvre sur les impôts locaux et les
      // autres impôts, qui s'ouvrent à leur tour. Autant de niveaux que la
      // source en publie.
      enfants: composantes(l.indicateur.id, l.montant, territoire, exercice, catalogue) ?? [],
    }));
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
      lecture: "Ce que la collectivité dégage de son fonctionnement courant.",
    },
    {
      id: REMBOURSEMENTS, libelle: "Remboursement du capital emprunté",
      montant: -(remboursements as number), role: "flux", section: "dette",
    },
    {
      id: EN, libelle: "Épargne nette", montant: en as number,
      role: "palier", section: "dette",
      lecture: "Ce qui reste pour investir sans emprunter davantage.",
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
      lecture:
        "L'écart entre tout ce qui est entré et tout ce qui est sorti sur l'exercice. Ce n'est pas un déficit au sens de l'État : une collectivité vote sa section de fonctionnement en équilibre.",
    },
  ];

  // La colonne « il reste » : le cumul, remis au palier chaque fois que la
  // source en publie un. C'est elle qui fait d'une liste un pont.
  let cumul = 0;
  return brut.map((marche) => {
    cumul =
      marche.role === "palier" || marche.role === "arrivee" || marche.role === "report"
        ? marche.montant
        : cumul + marche.montant;
    return { ...marche, reste: cumul };
  });
}

/** Les montants du pont se lisent les uns sous les autres, tous à la même
 *  échelle : celle de la collectivité. */
export function montant(valeur: number): string {
  const signe = valeur < 0 ? "−" : "";
  const absolu = Math.abs(valeur);
  const format = (v: number, decimales: number) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(v);
  if (absolu >= 1e9) return `${signe}${format(absolu / 1e9, 2)}${FINE}Md€`;
  if (absolu >= 1e6) return `${signe}${format(absolu / 1e6, 1)}${FINE}M€`;
  if (absolu >= 1e3) return `${signe}${format(absolu / 1e3, 0)}${FINE}k€`;
  return `${signe}${format(absolu, 0)}${FINE}€`;
}

function part(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.abs(valeur),
  )}${FINE}%`;
}

/**
 * Les composantes, en cascade.
 *
 * Une grille et non un tableau. Un tableau alignait les trois colonnes, mais
 * une composante qui s'ouvre sur les siennes doit occuper toute la largeur —
 * imbriquée dans la première cellule, sa propre grille se comprimait et
 * poussait la colonne « il reste » hors de l'écran. La grille, elle, se répète
 * à chaque niveau sans jamais sortir de sa colonne.
 */
function rendreComposantes(liste: Composante[], rang = 1): string {
  return liste
    .map((c) => {
      const rangee = `<span class="pont__c-nom">${echapper(c.libelle)}</span>
        <span class="pont__c-part">${echapper(part(c.part))}</span>
        <span class="pont__c-montant">${echapper(montant(c.montant))}</span>`;
      const corps = c.enfants.length
        ? `<details class="pont__sous">
             <summary class="pont__rangee">${rangee}</summary>
             <ul class="pont__composantes">${rendreComposantes(c.enfants, rang + 1)}</ul>
           </details>`
        : `<span class="pont__rangee">${rangee}</span>`;
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

  const lignes = etapes
    .map((etape) => {
      const total = etape.role === "palier" || etape.role === "arrivee";
      const decomposition = etape.id
        ? composantes(etape.id, Math.abs(etape.montant), territoire, exercice, catalogue)
        : null;
      // Un palier et un report n'ont pas de mouvement : ils *sont* le reste.
      const mouvement =
        etape.role === "report" || total
          ? ""
          : `${etape.montant < 0 ? "−" : "+"}${montant(Math.abs(etape.montant))}`;
      const rangee = `<span class="pont__nom">${echapper(etape.libelle)}</span>
        <span class="pont__mouvement">${echapper(mouvement)}</span>
        <span class="pont__reste">${echapper(montant(etape.reste))}</span>`;
      const corps = decomposition
        ? `<details class="pont__ouvrir">
             <summary class="pont__rangee">${rangee}</summary>
             <ul class="pont__composantes">${rendreComposantes(decomposition)}</ul>
           </details>`
        : `<span class="pont__rangee">${rangee}</span>`;
      const lecture = etape.lecture
        ? `<p class="pont__lecture">${echapper(etape.lecture)}</p>`
        : "";
      return `<li class="pont__ligne pont__ligne--${etape.role}">${corps}${lecture}</li>`;
    })
    .join("");

  return `<section class="pont">
    <h3>D'un euro encaissé à ce qu'il en reste <span class="pont__exercice">exercice ${echapper(
      exercice,
    )}</span></h3>
    <p class="pont__entete" aria-hidden="true">
      <span>Étape</span><span>Mouvement</span><span>Il reste</span>
    </p>
    <ol class="pont__etapes">${lignes}</ol>
    <p class="pont__aide">Les étapes soulignées s'ouvrent sur leur composition, et celle-ci sur la
    sienne. Une étape ne s'ouvre que si ses composantes redonnent son total.</p>
  </section>`;
}
