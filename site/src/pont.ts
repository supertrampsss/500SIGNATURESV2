/**
 * Le pont : d'un euro encaissé à ce qu'il en reste.
 *
 * La fiche donnait les masses côte à côte — recettes de fonctionnement,
 * dépenses de fonctionnement, épargne brute, dette. Rangées en liste, elles ne
 * disent pas qu'elles s'enchaînent : le lecteur ne peut pas voir que l'épargne
 * brute *est* la différence des deux premières, ni où passe l'argent qui reste.
 * Le pont met l'enchaînement à plat, dans l'ordre où il se produit.
 *
 * **Chaque marche est une identité publiée, pas un calcul de notre main.**
 * L'OFGL définit l'épargne brute comme « recettes de fonctionnement − dépenses
 * de fonctionnement », l'épargne nette comme « épargne brute − remboursements
 * d'emprunts hors gestion active de la dette », les recettes totales comme
 * « recettes de fonctionnement + recettes d'investissement hors emprunts +
 * emprunts », et les dépenses totales symétriquement. Le pont ne fait que les
 * suivre.
 *
 * **Et il se vérifie contre les agrégats publiés avant de s'afficher.** Les
 * paliers du pont sont recalculés depuis leurs termes, puis confrontés à la
 * valeur que l'OFGL publie pour ce même palier. Si l'un des trois contrôles
 * échoue, il n'y a pas de pont — pas de pont approché, pas de pont avec un
 * écart mis en note de bas de page. Un enchaînement qui ne boucle pas ne
 * s'explique pas, il s'enlève.
 *
 * **La dernière ligne n'est pas un déficit.** Une collectivité vote sa section
 * de fonctionnement en équilibre : l'écart entre tout ce qu'elle a encaissé et
 * tout ce qu'elle a payé sur l'exercice ne se lit pas comme le solde budgétaire
 * de l'État, qui est un besoin de financement. Le bloc l'écrit plutôt que de
 * laisser le rapprochement se faire tout seul.
 */

import type { Territoire } from "./donnees.ts";

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

export type Marche = {
  libelle: string;
  montant: number;
  /** `depart` ouvre, `flux` s'ajoute ou se retranche, `palier` est un total
   *  intermédiaire publié par l'OFGL, `arrivee` clôt. */
  role: "depart" | "flux" | "palier" | "arrivee";
  /** Ce que la ligne dit, pour les paliers seulement : un flux se lit tout
   *  seul, un palier a besoin qu'on dise ce qu'il est. */
  lecture?: string;
};

function valeur(territoire: Territoire, id: string, exercice: string): number | undefined {
  const v = territoire.series?.[id]?.[exercice];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
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
  // Les trois contrôles. Ils portent sur des agrégats que l'OFGL publie
  // séparément : ce n'est pas une vérification de notre arithmétique, c'est
  // une confrontation de notre lecture aux comptes.
  if (!boucle((rf as number) - (df as number), eb as number)) return null;
  if (!boucle((eb as number) - (remboursements as number), en as number)) return null;
  if (
    !boucle(
      (en as number) + (investissementRecettes as number) + (emprunts as number) -
        (investissementDepenses as number),
      (rt as number) - (dt as number),
    )
  ) {
    return null;
  }

  return [
    { libelle: "Recettes de fonctionnement", montant: rf as number, role: "depart" },
    { libelle: "Dépenses de fonctionnement", montant: -(df as number), role: "flux" },
    {
      libelle: "Épargne brute",
      montant: eb as number,
      role: "palier",
      lecture: "Ce que la collectivité dégage de son fonctionnement courant.",
    },
    { libelle: "Remboursements d'emprunts", montant: -(remboursements as number), role: "flux" },
    {
      libelle: "Épargne nette",
      montant: en as number,
      role: "palier",
      lecture: "Ce qui reste pour investir sans emprunter davantage.",
    },
    {
      libelle: "Recettes d'investissement hors emprunts",
      montant: investissementRecettes as number,
      role: "flux",
    },
    { libelle: "Emprunts de l'année", montant: emprunts as number, role: "flux" },
    {
      libelle: "Dépenses d'investissement",
      montant: -(investissementDepenses as number),
      role: "flux",
    },
    {
      libelle: "Recettes totales − dépenses totales",
      montant: (rt as number) - (dt as number),
      role: "arrivee",
      lecture:
        "L'écart entre tout ce qui est entré et tout ce qui est sorti sur l'exercice. Ce n'est pas un déficit au sens de l'État : une collectivité vote sa section de fonctionnement en équilibre.",
    },
  ];
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Les montants du pont se lisent les uns sous les autres : ils sont tous à la
 *  même échelle, en milliers ou en millions selon la collectivité. */
export function montant(valeur: number): string {
  const signe = valeur < 0 ? "−" : "";
  const absolu = Math.abs(valeur);
  const format = (v: number, decimales: number) =>
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(v);
  if (absolu >= 1e9) return `${signe}${format(absolu / 1e9, 2)} Md€`;
  if (absolu >= 1e6) return `${signe}${format(absolu / 1e6, 1)} M€`;
  if (absolu >= 1e3) return `${signe}${format(absolu / 1e3, 0)} k€`;
  return `${signe}${format(absolu, 0)} €`;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(territoire: Territoire, exercice: string | null): string {
  if (!exercice) return "";
  const etapes = marches(territoire, exercice);
  if (!etapes) return "";
  // La barre de chaque ligne est proportionnelle à la plus grande masse du
  // pont — les recettes de fonctionnement, sauf exercice hors norme. Sans
  // échelle commune, un remboursement de 2 % ferait la même longueur qu'une
  // recette de 100 %.
  const echelle = Math.max(...etapes.map((e) => Math.abs(e.montant))) || 1;
  const lignes = etapes
    .map((etape) => {
      const largeur = ((Math.abs(etape.montant) / echelle) * 100).toFixed(1);
      const lecture = etape.lecture
        ? `<p class="pont__lecture">${echapper(etape.lecture)}</p>`
        : "";
      return `<li class="pont__marche pont__marche--${etape.role}"${
        etape.montant < 0 ? ' data-sens="sortie"' : ""
      }>
        <span class="pont__libelle">${echapper(etape.libelle)}</span>
        <span class="pont__montant">${echapper(montant(etape.montant))}</span>
        <span class="pont__barre" style="width:${largeur}%" aria-hidden="true"></span>
        ${lecture}
      </li>`;
    })
    .join("");
  // Replié par défaut : neuf marches ouvertes pousseraient les six rapports et
  // le premier indicateur hors de l'écran, et la barre latérale n'a qu'une
  // hauteur.
  return `<details class="repli pont">
    <summary>D'un euro encaissé à ce qu'il en reste <span class="pont__exercice">exercice ${echapper(
      exercice,
    )}</span></summary>
    <ol class="pont__marches">${lignes}</ol>
    <p class="pont__source">Enchaînement des agrégats du budget principal publiés par
    l'Observatoire des finances et de la gestion publique locales (OFGL) pour l'exercice
    ${echapper(exercice)}. Chaque palier est recalculé depuis ses termes et confronté à
    l'agrégat publié : le bloc ne s'affiche pas si l'un des trois contrôles échoue.</p>
  </details>`;
}
