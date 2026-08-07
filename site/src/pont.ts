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
  /** `depart` ouvre une section, `flux` s'ajoute ou se retranche, `report`
   *  reprend le total de la section précédente sans rien mesurer de neuf,
   *  `palier` est un total intermédiaire publié par l'OFGL, `arrivee` clôt. */
  role: "depart" | "flux" | "report" | "palier" | "arrivee";
  /** Le bloc auquel la marche appartient. Neuf lignes d'affilée se lisent
   *  comme une liste ; trois blocs de trois se lisent comme un raisonnement. */
  section: "fonctionnement" | "dette" | "investissement";
  /** Ce que la ligne dit, pour les paliers seulement : un flux se lit tout
   *  seul, un palier a besoin qu'on dise ce qu'il est. */
  lecture?: string;
};

/** Les trois temps de l'exercice, dans l'ordre où ils se produisent. */
export const SECTIONS: { cle: Marche["section"]; titre: string }[] = [
  { cle: "fonctionnement", titre: "Ce que l'année rapporte et ce qu'elle coûte" },
  { cle: "dette", titre: "Ce que la dette prélève" },
  { cle: "investissement", titre: "Ce qui est investi, et avec quoi" },
];

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
    {
      libelle: "Recettes de fonctionnement",
      montant: rf as number,
      role: "depart",
      section: "fonctionnement",
    },
    {
      libelle: "Charges courantes",
      montant: -(df as number),
      role: "flux",
      section: "fonctionnement",
    },
    {
      libelle: "Épargne brute",
      montant: eb as number,
      role: "palier",
      section: "fonctionnement",
      lecture: "Ce que la collectivité dégage de son fonctionnement courant.",
    },
    {
      libelle: "Remboursement du capital emprunté",
      montant: -(remboursements as number),
      role: "flux",
      section: "dette",
    },
    {
      libelle: "Épargne nette",
      montant: en as number,
      role: "palier",
      section: "dette",
      lecture: "Ce qui reste pour investir sans emprunter davantage.",
    },
    // Le report n'apporte aucun euro neuf : il redit le total de la section
    // précédente pour que l'addition de celle-ci se vérifie de l'œil. Sans
    // lui, la dernière ligne tombait d'un calcul dont deux termes étaient
    // hors du bloc.
    {
      libelle: "Report de l'épargne nette",
      montant: en as number,
      role: "report",
      section: "investissement",
    },
    {
      libelle: "Subventions et recettes d'investissement",
      montant: investissementRecettes as number,
      role: "flux",
      section: "investissement",
    },
    {
      libelle: "Emprunts nouveaux",
      montant: emprunts as number,
      role: "flux",
      section: "investissement",
    },
    {
      libelle: "Dépenses d'investissement",
      montant: -(investissementDepenses as number),
      role: "flux",
      section: "investissement",
    },
    {
      libelle: "Ce qui reste à la fin de l'exercice",
      montant: (rt as number) - (dt as number),
      role: "arrivee",
      section: "investissement",
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

/**
 * Sur 100 € encaissés, ce qui part et ce qui reste.
 *
 * Une phrase avant le tableau. Les barres proportionnelles ligne à ligne
 * n'aidaient personne : neuf longueurs à comparer entre elles, sans repère
 * commun, c'est un dessin de plus à déchiffrer avant de lire les chiffres. Un
 * seul rapport, dit en français, remplace les neuf.
 */
export function surCentEuros(etapes: Marche[]): string {
  const trouver = (libelle: string) => etapes.find((e) => e.libelle === libelle)?.montant;
  const recettes = trouver("Recettes de fonctionnement");
  const charges = trouver("Charges courantes");
  const dette = trouver("Remboursement du capital emprunté");
  const nette = trouver("Épargne nette");
  if (!recettes || charges === undefined || dette === undefined || nette === undefined) return "";
  const pour100 = (v: number) =>
    new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(Math.abs(v / recettes) * 100)
      .replace("-", "−");
  const reste = nette >= 0 ? "il reste" : "il manque";
  return `Sur 100${FINE}€ de recettes de fonctionnement, ${pour100(charges)}${FINE}€ paient les
    charges courantes et ${pour100(dette)}${FINE}€ remboursent le capital emprunté :
    ${reste} ${pour100(nette)}${FINE}€.`;
}

/** Espace fine insécable : la typographie française avant une unité. */
const FINE = "\u202f";

/** Le signe qui ouvre la ligne. C'est lui qui fait lire une addition plutôt
 *  qu'une liste — il tient sa propre colonne, aligné d'une ligne à l'autre. */
function signe(marche: Marche): string {
  if (marche.role === "palier" || marche.role === "arrivee") return "=";
  if (marche.role === "depart" || marche.role === "report") return "";
  return marche.montant < 0 ? "−" : "+";
}

/**
 * Rendu pur, sans DOM : c'est lui qui est testé.
 *
 * Ouvert, et non replié. « D'un euro encaissé à ce qu'il en reste » est la
 * question que le lecteur vient poser : la mettre derrière un triangle à
 * déplier revenait à la ranger avec les annexes.
 */
export function rendu(territoire: Territoire, exercice: string | null): string {
  if (!exercice) return "";
  const etapes = marches(territoire, exercice);
  if (!etapes) return "";

  const blocs = SECTIONS.filter((section) => etapes.some((e) => e.section === section.cle))
    .map((section) => {
      const lignes = etapes
        .filter((e) => e.section === section.cle)
        .map((etape) => {
          const lecture = etape.lecture
            ? `<p class="pont__lecture">${echapper(etape.lecture)}</p>`
            : "";
          return `<li class="pont__marche pont__marche--${etape.role}">
            <span class="pont__signe" aria-hidden="true">${signe(etape)}</span>
            <span class="pont__libelle">${echapper(etape.libelle)}</span>
            <span class="pont__montant">${echapper(montant(etape.montant))}</span>
            ${lecture}
          </li>`;
        })
        .join("");
      return `<li class="pont__section">
        <h4>${echapper(section.titre)}</h4>
        <ol class="pont__marches">${lignes}</ol>
      </li>`;
    })
    .join("");

  return `<section class="pont">
    <h3>D'un euro encaissé à ce qu'il en reste <span class="pont__exercice">exercice ${echapper(
      exercice,
    )}</span></h3>
    <p class="pont__cent">${surCentEuros(etapes)}</p>
    <ol class="pont__sections">${blocs}</ol>
  </section>`;
}
