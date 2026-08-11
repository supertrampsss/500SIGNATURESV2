/**
 * Le simulateur à l'écran : le cockpit, l'arbre réglable, les onglets.
 *
 * Ce module ne calcule rien. Chaque chiffre affiché sort de `simulateur.ts`,
 * qui est testé à part ; ici on met en page et on branche les gestes. La
 * séparation tient une promesse simple : ce qui est à l'écran est exactement ce
 * que le modèle a répondu, et tout le rendu se vérifie sans navigateur.
 *
 * TROIS RÈGLES DE PRODUIT gouvernent ce fichier, et elles ont chacune coûté un
 * aller-retour avec le commanditaire :
 *
 * 1. AUCUN BLOC DE PROSE. Deux phrases existent dans toute la page : le
 *    périmètre sous le titre du cockpit, et l'avertissement de comportement
 *    au-dessus des recettes. Il n'y a pas de section « ce que ce simulateur
 *    calcule », pas de paragraphe pédagogique, pas d'état vide bavard. Ce qui
 *    doit être dit se dit à l'endroit exact où ça compte, en une ligne.
 *
 * 2. AUCUNE COULEUR DE JUGEMENT. Le site n'a pas de token vert et n'en
 *    inventera pas : un geste qui améliore le solde s'écrit en encre sobre, un
 *    geste qui le dégrade en argile. La couleur dit le sens, pas le bien.
 *
 * 3. RIEN DE CLIQUABLE NE MÈNE À UNE SECTION VIDE. L'onglet « Votre plan »
 *    n'existe pas tant qu'aucune ligne n'est réglée, et le simulateur entier
 *    n'existe pas si le fichier n'est pas publié.
 *
 * L'arbre se déplie à la demande : le PLF 2025 compte plus de mille lignes, et
 * les construire au chargement pour en montrer une quarantaine coûterait une
 * seconde d'écran figé à chaque ouverture.
 */

import { formater } from "./echelle.ts";
import {
  chercher as chercherAtelier,
  encoder,
  contribution,
  externes,
  pourcentagePilote,
  reglagesEffectifs,
  type Externe,
  effort,
  gestes,
  plan,
  reglagesDe,
  tauxDe,
  transferts,
  type EtatAtelier,
  type LigneAtelier,
  type TrouveAtelier,
  type Volet,
} from "./atelier.ts";
import { renduTranches } from "./bareme-rendu.ts";
import {
  quiPaie,
  rendement as rendementBareme,
  regler as reglerTaux,
  type Taux,
} from "./bareme.ts";
import {
  aTrouverAuDepart,
  budgetsTenus,
  contratDe,
  resteATrouver,
  ruptures,
  CONTRATS,
  type Contrat,
  type Rupture,
} from "./mission.ts";

import { echapper } from "./texte.ts";
import {
  defis,
  ecartObjectif,
  regler,
  equivalence,
  impact,
  montantEffectif,
  programmes,
  totalObjectif,
  totaux,
  PREFIXE_RECETTE,
  type Budget,
  type Defi,
  type Entree,
  type Index,
  type LignePlan,
  type Reglages,
} from "./simulateur.ts";

/** Ce que le pas d'un bouton vaut. Cinq points : assez pour voir bouger le
 *  solde d'un clic, assez fin pour viser une coupe crédible en trois. */
const PAS = 5;

const MESURES: Record<string, string> = {
  credit_de_paiement: "crédits de paiement",
  autorisation_engagement: "autorisations d'engagement",
};

/**
 * **Il n'y a plus d'onglets.**
 *
 * Dépenses et recettes vivaient dans deux panneaux dont un seul s'affichait.
 * On ne peut pas équilibrer un budget en voyant une moitié à la fois : couper
 * une dépense et lever un impôt sont le même geste vu des deux côtés, et le
 * lecteur passait son temps à faire l'aller-retour pour retrouver ce qu'il
 * venait de faire. Les deux se suivent maintenant dans une seule colonne, et
 * la barre de solde reste à l'écran pendant qu'on descend.
 */

/* --------------------------------------------------------------------------
 * Formats
 * ----------------------------------------------------------------------- */

/** Un montant d'euros, à l'échelle du site : le million, partout. */
export function euros(montant: number): string {
  return formater(montant, "EUR", false);
}

/** Le même, avec le « + » que `formater` ne met jamais : sur un écart, le sens
 *  du geste est l'information, et un « 4 200 M€ » nu ne dit pas s'il s'ajoute
 *  ou se retranche. */
export function eurosSigne(montant: number): string {
  return montant > 0 ? `+${euros(montant)}` : euros(montant);
}

/**
 * La couleur d'un écart, selon ce qu'il fait au solde. Sobre s'il l'améliore,
 * argile s'il le dégrade, rien s'il ne le touche pas.
 *
 * Volontairement pas de vert : la charte n'en a pas, et un vert « bien » face à
 * un rouge « mal » transformerait une arithmétique en morale.
 */
export function classeEcart(surSolde: number): string {
  if (surSolde > 0) return " simu__val--sobre";
  if (surSolde < 0) return " simu__val--argile";
  return "";
}

/** « PLF 2025, budget général, crédits de paiement ». La seule phrase de
 *  cadrage de la page, et elle tient sur une ligne.
 *
 *  Le fichier publié la porte depuis que le site sert deux budgets : celui de
 *  la Sécurité sociale n'a ni budget général ni crédits de paiement, et une
 *  phrase construite ici lui aurait attribué les deux. La construction reste
 *  pour les publications antérieures, qui ne portent pas `cadre`. */
export function perimetre(budget: Budget): string {
  if (budget.cadre) return budget.cadre;
  const mesure = budget.mesure ? (MESURES[budget.mesure] ?? budget.mesure) : "";
  // L'unité est dite ici, une fois. Sans elle, « Santé 1 643 M€ » se lit comme
  // 1 643 milliards par qui n'a pas le nez sur le sigle — le chiffre est juste,
  // c'est la lecture qui glisse d'un facteur mille.
  return `${budget.loi} ${budget.exercice}, budget général, ${mesure},`
    + " montants en millions d'euros (M€)";
}

/** Le titre du cockpit. Publié aussi, et pour la même raison. */
export function titre(budget: Budget): string {
  return budget.titre ?? "Le budget de l'État, ligne à ligne";
}

/** Le mot qui nomme le niveau des équivalences : « le programme X » sur le
 *  budget de l'État, « le poste X » sur celui de la Sécurité sociale. */
export function repere(budget: Budget): string {
  return budget.repere ?? "programme";
}

/**
 * Les exercices que la publication déclare.
 *
 * `simulateur/index.json` est un tableau de chaînes, du plus récent au plus
 * ancien : c'est ce que dépose `publish.py`, et c'est la seule forme lue. Une
 * lecture plus tolérante laisserait passer sans bruit une publication qui aurait
 * changé de forme, et le simulateur disparaîtrait de la barre de menu sans que
 * personne sache pourquoi.
 *
 * Un fichier absent, vide ou d'une autre forme ne vaut pas erreur : il vaut
 * « rien à montrer », et le simulateur n'apparaît pas du tout.
 */
export function exercicesPublies(index: unknown): string[] {
  if (!Array.isArray(index)) return [];
  return index.filter((e): e is string => typeof e === "string" && e !== "");
}

/**
 * Les exercices d'une branche, dans un index qui les porte toutes.
 *
 * `simulateur/index-branches.json` liste des clés « branche-exercice » —
 * « vieillesse-2026 » — parce que les cinq branches n'ont aucune raison de
 * porter toutes les mêmes millésimes : la DSS peut publier l'une et pas l'autre.
 *
 * Le découpage se fait sur le **premier** tiret, jamais le dernier : une clé de
 * branche peut en contenir, et « atmp-2026 » comme « accidents-du-travail-2026 »
 * doivent rendre le même exercice.
 */
export function exercicesDeLaBranche(index: unknown, branche: string): string[] {
  const prefixe = `${branche}-`;
  return exercicesPublies(index)
    .filter((cle) => cle.startsWith(prefixe))
    .map((cle) => cle.slice(prefixe.length))
    .filter((exercice) => exercice !== "");
}

/* --------------------------------------------------------------------------
 * Une ligne réglable
 * ----------------------------------------------------------------------- */

/** Profondeur d'affichage : les recettes et l'ONDAM vivent sous un titre de
 *  groupe, elles partent donc du même cran que les programmes. */
function niveau(entree: Entree): number {
  const depart = entree.cote === "depense" ? 0 : 1;
  return Math.min(depart + entree.ancetres.length, 3);
}

function commandes(
  entree: Entree,
  pourcentage: number,
  externe: Externe | null = null,
): string {
  const nom = echapper(entree.libelle);
  const raz = pourcentage === 0 ? ' hidden=""' : "";
  // Un pourcentage venu d'ailleurs s'affiche à côté de la commande, jamais
  // dedans : le lecteur doit voir que la ligne a bougé sans qu'il y touche, et
  // pouvoir la régler quand même.
  const venu = externe
    ? `<button type="button" class="simu__venu" data-vise-volet="${echapper(
        externe.volet,
      )}" title="Ces points viennent d'ailleurs : ${echapper(externe.dit)}"${
        externe.pourcentage === 0 ? " hidden" : ""
      }>${pointsAffiches(externe.pourcentage)}</button>`
    : "";
  return `<span class="simu__reglage">${venu}
    <button type="button" class="simu__pas" data-pas="${-PAS}"
            aria-label="Baisser ${nom} de ${PAS} points">−</button>
    <span class="simu__champ">
      <input type="text" inputmode="numeric" class="simu__pct nombre" value="${pourcentage}"
             aria-label="Pourcentage appliqué à ${nom}" />
      <span class="simu__unite" aria-hidden="true">%</span>
    </span>
    <button type="button" class="simu__pas" data-pas="${PAS}"
            aria-label="Monter ${nom} de ${PAS} points">+</button>
    <button type="button" class="simu__raz" aria-label="Remettre ${nom} à zéro"${raz}>↺</button>
  </span>`;
}

/**
 * Une ligne du budget, à n'importe quelle profondeur : intitulé, montant de
 * base, réglage, montant recalculé, écart signé.
 *
 * Le conteneur d'enfants est posé vide et masqué : c'est lui qui rend le
 * dépliage à la demande possible sans que l'appelant ait à connaître l'arbre.
 */
export function renduLigne(
  entree: Entree,
  reglages: Reglages,
  externe: Externe | null = null,
): string {
  const code = echapper(entree.code);
  const pourcentage = reglages.get(entree.code) ?? 0;
  const { montant, delta, surSolde } = impact(entree, reglages);
  const enfants = entree.noeud.enfants?.length ? entree.noeud.enfants : null;
  const nom = echapper(entree.libelle);
  return `<div class="simu__ligne simu__ligne--n${niveau(entree)}${
    pourcentage === 0 ? "" : " simu__ligne--reglee"
  }" data-code="${code}">
    ${
      enfants
        ? `<button type="button" class="simu__pli" aria-expanded="false"
                   aria-label="Déplier ${nom}"></button>`
        : `<span class="simu__pli simu__pli--feuille" aria-hidden="true"></span>`
    }
    <span class="simu__intitule">
      ${
        entree.cote === "depense" && entree.ancetres.length
          ? `<span class="simu__code nombre">${code}</span>`
          : ""
      }
      <span class="simu__lib">${nom}</span>
    </span>
    <span class="simu__base nombre">${euros(entree.signe * entree.base)}</span>
    ${
      externe?.exclusif
        ? renvoi(externe, pourcentage)
        : commandes(entree, pourcentage - (externe?.pourcentage ?? 0), externe)
    }
    <span class="simu__montant nombre">${euros(entree.signe * montant)}</span>
    <span class="simu__delta nombre${classeEcart(surSolde)}">${
      delta === 0 ? "" : eurosSigne(delta)
    }</span>
  </div>${enfants ? `<div class="simu__enfants" data-enfants="${code}" hidden></div>` : ""}`;
}

/** Les missions, et rien d'autre : le reste arrive au premier dépli. */
export function renduDepenses(budget: Budget, index: Index, reglages: Reglages): string {
  return budget.depenses
    .flatMap((mission) => {
      const entree = index.get(mission.c);
      return entree ? [renduLigne(entree, reglages)] : [];
    })
    .join("");
}

/**
 * Le renvoi qui remplace la commande d'une ligne calculée ailleurs.
 *
 * Deux commandes pour un même impôt, ce sont deux réponses possibles à la même
 * question. La ligne dit donc où on la règle, et y mène.
 */
function renvoi(externe: Externe, pourcentage: number): string {
  return `<span class="simu__reglage">
    <button type="button" class="simu__renvoi" data-vise-volet="${echapper(externe.volet)}">
      ${pourcentage === 0 ? "" : `<b class="nombre">${pointsAffiches(pourcentage)}</b>`}
      réglé par ${echapper(externe.dit)}
    </button>
  </span>`;
}

const POINTS = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** Un pourcentage venu d'ailleurs, au dixième de point : la répartition d'un
 *  transfert entre trois échelons tombe rarement sur l'entier. */
export function pointsAffiches(valeur: number): string {
  const arrondi = Math.round(valeur * 10) / 10;
  // Le signe moins du site, pas le trait d'union du formateur : « -9,4 % » au
  // milieu de « −1 566 M€ » ferait deux moins différents sur la même ligne.
  return `${arrondi > 0 ? "+" : ""}${POINTS.format(arrondi).replace("-", "\u2212")} %`;
}

/**
 * Les recettes, par famille. Les deux prélèvements sur recettes se *déduisent*
 * des recettes de l'État : leur titre le dit, et leur montant s'affiche négatif
 * plutôt que de laisser croire à un encaissement.
 *
 * Le total d'un groupe est celui de ses lignes **réglées**, feuilles sommées :
 * un groupe qui afficherait sa base pendant que ses lignes bougent dirait le
 * contraire de ce qu'on vient de faire.
 */
export function renduRecettes(
  budget: Budget,
  index: Index,
  reglages: Reglages,
  externes: Map<string, Externe> = new Map(),
): string {
  return budget.recettes
    .map((groupe) => {
      const entrees = groupe.lignes.flatMap((l) => index.get(PREFIXE_RECETTE + l.c) ?? []);
      const somme = entrees.reduce((s, e) => s + montantEffectif(e, reglages), 0);
      return `<div class="simu__groupe">
        <h3 class="simu__groupe-titre">
          <span>${echapper(groupe.t)}${groupe.signe < 0 ? " (se déduit)" : ""}</span>
          <span class="nombre">${euros(groupe.signe * somme)}</span>
        </h3>
        <div class="simu__groupe-lignes">${entrees
          .map((e) => renduLigne(e, reglages, externes.get(e.code) ?? null))
          .join("")}</div>
      </div>`;
    })
    .join("");
}

/**
 * L'ONDAM et ses sous-objectifs, réglables et comptés à part.
 *
 * Ce panneau a son propre total et son propre écart, et c'est tout le sujet :
 * l'objectif national de dépenses d'assurance maladie traverse trois branches
 * de la Sécurité sociale sans être la somme d'aucune. L'ajouter aux charges
 * compterait deux fois 270 Md€ ; le retrancher n'aurait pas plus de sens. La
 * note le dit une fois, au-dessus, et le solde du cockpit ne bouge pas d'un
 * euro quand on règle ici.
 */
export function renduObjectif(budget: Budget, index: Index, reglages: Reglages): string {
  const objectif = budget.objectif;
  if (!objectif) return "";
  const total = totalObjectif(budget, reglages);
  const ecart = ecartObjectif(budget, reglages);
  return `<p class="simu__note">${echapper(objectif.note)}</p>
    <dl class="simu__compteurs simu__compteurs--objectif" id="simu-compteurs-objectif">
      ${compteur(echapper(objectif.t), euros(total))}
      ${compteur("Votre écart à l'objectif", eurosSigne(ecart))}
    </dl>
    <div class="simu__arbre">${objectif.lignes
      .flatMap((l) => index.get(l.c) ?? [])
      .map((e) => renduLigne(e, reglages))
      .join("")}</div>`;
}

/* --------------------------------------------------------------------------
 * Cockpit, défis, plan
 * ----------------------------------------------------------------------- */

function compteur(nom: string, valeur: string, classe = "", aide = ""): string {
  return `<div class="simu__compteur">
    <dt${aide ? ` title="${echapper(aide)}"` : ""}>${nom}</dt>
    <dd class="nombre${classe}">${valeur}</dd>
  </div>`;
}

/** Ce que pèse l'écart total, dit avec une ligne du budget : « soit le
 *  programme Police nationale ». Rien quand aucune ligne n'en est proche —
 *  « l'équivalent de X » tromperait au lieu d'éclairer. */
export function renduEquivalence(index: Index, ecart: number, nomDuRepere: string): string {
  const proche = equivalence(programmes(index), ecart);
  if (!proche) return "";
  return `Votre écart, c'est le ${echapper(nomDuRepere)} « ${echapper(
    proche.libelle,
  )} » (${euros(proche.montant)}).`;
}

/** Les défis, en pilules. Un défi tenu se marque par la forme et par le mot
 *  « tenu », pas par une couleur de récompense. */
export function renduDefis(liste: Defi[]): string {
  return liste
    .map((defi) => {
      // « L'équilibre » a zéro pour cible : « −138 000 M€ sur 0 M€ » n'apprend
      // rien que « −138 000 M€ » ne dise déjà.
      const progres = defi.cible
        ? `${eurosSigne(defi.valeur)} sur ${euros(defi.cible)}`
        : eurosSigne(defi.valeur);
      const etat = defi.reussi ? "tenu" : (defi.obstacle ?? progres);
      return `<li class="simu__defi${defi.reussi ? " simu__defi--tenu" : ""}">
        <span>${echapper(defi.nom)}</span>
        <span class="simu__defi-etat nombre">${echapper(etat)}</span>
      </li>`;
    })
    .join("");
}

/** Les lignes réglées, la plus lourde d'abord. Chaque ligne renvoie à sa place
 *  dans l'arbre : le plan est une table des matières de ce qu'on a fait. */
export function renduPlan(
  lignes: LignePlan[],
  candidats: Entree[],
  nomDuRepere = "programme",
): string {
  return lignes
    .map(({ entree, pourcentage, delta, surSolde }) => {
      const proche = equivalence(candidats, delta);
      return `<li class="simu__plan-ligne">
        <button type="button" class="simu__vise" data-vise="${echapper(entree.code)}">
          <span class="simu__plan-lib">${echapper(entree.libelle)} à ${
            pourcentage > 0 ? "+" : "−"
          }${Math.abs(pourcentage)} %</span>
          <span class="simu__plan-chemin">${echapper(
            entree.chemin || (entree.cote === "recette" ? "Recettes" : "Mission"),
          )}</span>
          ${
            proche
              ? `<span class="simu__plan-equiv">Soit le ${echapper(nomDuRepere)} « ${echapper(
                  proche.libelle,
                )} ».</span>`
              : ""
          }
        </button>
        <span class="simu__plan-delta nombre${classeEcart(surSolde)}">${eurosSigne(
          delta,
        )}</span>
      </li>`;
    })
    .join("");
}

export function renduSuggestions(resultats: Entree[]): string {
  return resultats
    .map(
      (entree) => `<li><button type="button" class="simu__vise" data-vise="${echapper(
        entree.code,
      )}">
        <span class="simu__plan-lib">${echapper(entree.libelle)}</span>
        <span class="simu__plan-chemin">${echapper(
          entree.chemin || (entree.cote === "recette" ? "Recettes" : "Mission"),
        )} · ${euros(entree.signe * entree.base)}</span>
      </button></li>`,
    )
    .join("");
}


/**
 * Les raccourcis vers ce qu'on vient chercher.
 *
 * **Cette liste est choisie, pas calculée.** Trier les missions par montant
 * mettrait « Remboursements et dégrèvements » en tête, qui n'est le sujet de
 * personne. Ce sont les postes dont on débat, nommés comme on en parle, et un
 * code absent de la publication ne fait simplement pas de raccourci.
 */
const RACCOURCIS: { code: string; nom: string }[] = [
  { code: "SB", nom: "Sécurité" },
  { code: "IA", nom: "Immigration" },
  { code: "DA", nom: "Défense" },
  { code: "JA", nom: "Justice" },
  { code: "EC", nom: "École" },
  { code: "SA", nom: "Santé" },
  { code: "RB", nom: "Retraites" },
  { code: "TA", nom: "Écologie" },
  { code: "EB", nom: "Dette" },
  { code: "VA", nom: "Logement" },
  { code: PREFIXE_RECETTE + "1601", nom: "TVA" },
  { code: PREFIXE_RECETTE + "1101", nom: "Impôt sur le revenu" },
  { code: PREFIXE_RECETTE + "1301", nom: "Impôt sur les sociétés" },
  // Sécurité sociale.
  { code: "D-PRE", nom: "Prestations sociales" },
  { code: "R-COT-SOC", nom: "Cotisations" },
  { code: "R-COT-CSG", nom: "CSG" },
  { code: "O-SDV", nom: "Soins de ville" },
  { code: "O-ETS", nom: "Hôpital" },
];

/**
 * Ce que les raccourcis ne peuvent pas atteindre, dit une fois.
 *
 * « Retraites » mène à la mission de l'État, qui ne paie que les régimes
 * spéciaux — six milliards. Les pensions du régime général sont dans le budget
 * de la Sécurité sociale, où l'annexe publie « Prestations légales » en un seul
 * bloc, sans les répartir par branche. Il n'y a donc **aucune ligne de
 * retraites réglable**, et c'est une limite de la publication, pas un choix
 * d'écran : le taire ferait passer 6 Md€ pour le sujet.
 */
const RESERVE_RACCOURCIS: Record<string, string> = {
  RB: "Cette mission ne porte que les régimes spéciaux (transports, mines, marins)."
    + " Les pensions du régime général sont dans le budget « Retraites », qui est la"
    + " branche vieillesse des régimes de base.",
  EB: "La charge de la dette est un crédit évaluatif : elle se constate, elle ne se"
    + " vote pas. La régler ici ne change pas ce que l'État doit payer.",
};

export function renduRaccourcis(index: Index): string {
  const presents = RACCOURCIS.filter((r) => index.has(r.code));
  if (presents.length < 2) return "";
  return `<nav class="simu__raccourcis" aria-label="Aller à un poste">
    <span class="simu__raccourcis-quoi">Aller à</span>
    ${presents
      .map((r) => {
        const reserve = RESERVE_RACCOURCIS[r.code];
        return `<button type="button" class="simu__raccourci" data-vise="${echapper(r.code)}"${
          reserve ? ` title="${echapper(reserve)}"` : ""
        }>${echapper(r.nom)}</button>`;
      })
      .join("")}
  </nav>`;
}


/* --------------------------------------------------------------------------
 * L'atelier : tous les budgets sur une page
 * ----------------------------------------------------------------------- */

/** Les raccourcis, tous volets confondus : chaque code est cherché là où il
 *  existe, et un code qu'aucun volet ne porte ne fait pas de bouton mort. */
export function renduRaccourcisAtelier(volets: readonly Volet[]): string {
  const trouves = RACCOURCIS.flatMap((r) => {
    const volet = volets.find((v) => v.genre === "budget" && v.index.has(r.code));
    return volet ? [{ ...r, volet: volet.cle }] : [];
  });
  if (trouves.length < 2) return "";
  return `<nav class="simu__raccourcis" aria-label="Aller à un poste">
    <span class="simu__raccourcis-quoi">Aller à</span>
    ${trouves
      .map((r) => {
        const reserve = RESERVE_RACCOURCIS[r.code];
        return `<button type="button" class="simu__raccourci" data-volet="${echapper(
          r.volet,
        )}" data-vise="${echapper(r.code)}"${
          reserve ? ` title="${echapper(reserve)}"` : ""
        }>${echapper(r.nom)}</button>`;
      })
      .join("")}
  </nav>`;
}

/**
 * **Votre effort**, et rien qui ressemble à un solde public.
 *
 * La barre additionne des écarts, jamais des budgets : le budget général de
 * l'État et les régimes de base ne font pas leur somme, parce que des dizaines
 * de milliards circulent entre eux et que chacun les compte de son côté. Chaque
 * budget garde donc son propre solde, dans l'en-tête de sa section ; ici on ne
 * lit que ce que le lecteur a changé.
 */
export function renduEffort(
  volets: readonly Volet[],
  etat: EtatAtelier,
  contrat: Contrat | null = null,
): string {
  // Un transfert intégralement propagé rend l'euro exact, la virgule flottante
  // non : couper la dotation globale laisse un résidu de quelques millionièmes
  // d'euro sur des montants de mille milliards. En dessous de l'euro, il n'y a
  // rien — et surtout pas un « +0,00 M€ » qui ferait passer une compensation
  // exacte pour un gain.
  const brut = effort(volets, etat);
  const total = Math.abs(brut) < 1 ? 0 : brut;
  const nombre = gestes(volets, etat);
  const reste = resteATrouver(volets, etat);
  const depart = aTrouverAuDepart(volets);
  const { tenus, total: combien } = budgetsTenus(volets, etat);
  const brisures = ruptures(contrat, volets, etat);
  // La jauge dit ce qui est comblé, jamais ce qui reste : à 160 028 M€ de
  // déficit, une barre pleine au départ dirait qu'on part de la victoire.
  const part = depart > 0 ? Math.min(1, Math.max(0, (depart - reste) / depart)) : 0;
  return `<div class="simu__effort">
      <span class="simu__effort-quoi">${
        reste === 0 ? "Mission accomplie" : "Reste à trouver"
      }</span>
      <b class="simu__effort-val nombre">${euros(reste)}</b>
    </div>
    <p class="simu__effort-detail">
      <span class="simu__effort-sens">${
        nombre === 0
          ? `${combien} budget${combien > 1 ? "s" : ""}, ${euros(
              depart,
            )} de déficit.<span class="simu__effort-ou"> Réglez une ligne, n'importe laquelle.</span>`
          : `${eurosSigne(total)} depuis le début<span class="simu__effort-ou">, ${tenus} budget${
              tenus > 1 ? "s" : ""
            } sur ${combien} à l'équilibre</span>.`
      }</span>${
        nombre === 0
          ? ""
          : `<span class="simu__effort-nb">${nombre} ${nombre > 1 ? "gestes" : "geste"}</span>`
      }${
        contrat
          ? `<span class="simu__effort-contrat${
              brisures.length ? " simu__val--argile" : ""
            }">${
              brisures.length
                ? `contrat rompu · ${echapper(brisures[0]!.libelle)}`
                : "contrat tenu"
            }</span>`
          : ""
      }
    </p>
    <div class="simu__effort-actions">
      <button type="button" class="simu__copier" id="simu-copier">Copier le lien</button>
      <button type="button" class="simu__creux" id="simu-raz"${
        nombre === 0 ? " hidden" : ""
      }>Tout remettre à zéro</button>
    </div>
    <div class="simu__jauge" role="presentation"><i style="width:${(part * 100).toFixed(
      2,
    )}%"></i></div>`;
}

/**
 * Le bloc de mission : le but, la règle qui le rend lisible, et le contrat.
 *
 * Il est en haut et il ne colle pas : on le lit une fois, on choisit, puis
 * c'est la barre collante qui suit le lecteur.
 */
export function renduMission(
  volets: readonly Volet[],
  etat: EtatAtelier,
  contrat: Contrat | null,
): string {
  // Le compteur n'est pas ici : il est dans la barre, juste dessous, et elle
  // suit le lecteur. Deux fois le même nombre à trois cents pixels d'écart se
  // lit comme une erreur.
  const { total: combien } = budgetsTenus(volets, etat);
  const brisures = ruptures(contrat, volets, etat);
  return `<p class="mission__quoi">Votre mission</p>
    <h2 class="mission__titre">Ramener les ${combien} budgets à l'équilibre</h2>
    <p class="mission__regle">Un budget en excédent ne comble pas le déficit d'un autre :
      le compteur ne compte que les déficits.</p>
    <div class="mission__contrat">
      <span class="mission__contrat-quoi">Votre contrat</span>
      <div class="mission__contrats" role="group" aria-label="Contrat">
        <button type="button" class="mission__pastille" data-contrat=""
                aria-pressed="${contrat === null}">Aucun</button>
        ${CONTRATS.map(
          (c) => `<button type="button" class="mission__pastille" data-contrat="${echapper(
            c.cle,
          )}" aria-pressed="${contrat?.cle === c.cle}">${echapper(c.nom)}</button>`,
        ).join("")}
      </div>
    </div>
    ${
      contrat
        ? `<p class="mission__interdit">${echapper(contrat.interdit)}</p>
           ${renduRuptures(brisures)}`
        : ""
    }`;
}

/** Ce qui rompt le contrat, nommé, et de combien il y en a. */
export function renduRuptures(brisures: readonly Rupture[]): string {
  if (!brisures.length) return "";
  const premiere = brisures[0]!;
  return `<p class="mission__rupture">Contrat rompu : « ${echapper(
    premiere.libelle,
  )} » à ${pointsAffiches(premiere.pourcentage)}, dans ${echapper(
    premiere.nomVolet === "État" ? "le budget de l'État" : premiere.nomVolet,
  )}${
    brisures.length > 1 ? `, et ${brisures.length - 1} autre${brisures.length > 2 ? "s" : ""}` : ""
  }.</p>`;
}

/** L'avertissement de double compte, et seulement quand il mord. */
export function renduTransferts(volets: readonly Volet[], etat: EtatAtelier): string {
  const lignes = transferts(volets, etat);
  if (!lignes.length) return "";
  return `<p class="simu__transfert">${lignes
    .map(
      (t) =>
        `« ${echapper(t.libelle)} » est une recette de ${echapper(
          t.dit,
        )} : le geste améliore un solde sans dégrader l'autre tant que la ligne d'en face n'est pas réglée.`,
    )
    .join(" ")}</p>`;
}

/** Le plan, tous volets confondus. Chaque ligne dit dans quel budget elle est. */
export function renduPlanAtelier(lignes: readonly LigneAtelier[]): string {
  return lignes
    .map(
      ({ entree, pourcentage, delta, surSolde, volet, externe }) => `<li class="simu__plan-ligne">
        <button type="button" class="simu__vise" data-volet="${echapper(
          volet.cle,
        )}" data-vise="${echapper(entree.code)}">
          <span class="simu__plan-lib">${echapper(entree.libelle)} à ${pointsAffiches(
            pourcentage,
          )}</span>
          <span class="simu__plan-chemin"><b>${echapper(volet.nom)}</b> · ${echapper(
            entree.chemin || (entree.cote === "recette" ? "Recettes" : "Mission"),
          )}${
            externe && externe.pourcentage !== 0
              ? ` · commandé par ${echapper(externe.dit)}`
              : ""
          }</span>
        </button>
        <span class="simu__plan-delta nombre${classeEcart(surSolde)}">${eurosSigne(
          delta,
        )}</span>
      </li>`,
    )
    .join("");
}

/** Les suggestions de recherche, qui traversent les budgets. */
export function renduSuggestionsAtelier(resultats: readonly TrouveAtelier[]): string {
  return resultats
    .map(
      ({ entree, volet }) => `<li><button type="button" class="simu__vise" data-volet="${echapper(
        volet.cle,
      )}" data-vise="${echapper(entree.code)}">
        <span class="simu__plan-lib">${echapper(entree.libelle)}</span>
        <span class="simu__plan-chemin"><b>${echapper(volet.nom)}</b> · ${echapper(
          entree.chemin || (entree.cote === "recette" ? "Recettes" : "Mission"),
        )} · ${euros(entree.signe * entree.base)}</span>
      </button></li>`,
    )
    .join("");
}

/** L'en-tête d'une section : ce que ce budget vote, et ce que vous en faites. */
export function renduEnteteVolet(
  volet: Volet,
  etat: EtatAtelier,
  volets: readonly Volet[],
): string {
  const ecart = contribution(volet, etat, volets);
  if (volet.genre === "bareme") {
    // Un barème n'a pas de solde. Ce qu'il a, c'est un effet sur la ligne
    // qu'il pilote — et c'est ce chiffre-là qu'il faut lire, pas les
    // 224 507 M€ de son assiette simulée.
    const pilote = ligneDuBareme(volet, volets);
    const points = pourcentagePilote(volet, etat);
    return `<span class="simu__volet-solde">
        <span class="simu__volet-quoi">${
          pilote ? "Au budget de l'État" : "Rendement"
        }</span>
        ${
          pilote
            ? points === 0
              ? `<b class="nombre">${euros(pilote.base)}</b>`
              : `<span class="simu__volet-avant nombre">${euros(
                  pilote.base,
                )}</span><span aria-hidden="true"> → </span><b class="nombre">${euros(
                  pilote.base * (1 + points / 100),
                )}</b>`
            : `<b class="nombre">${euros(
                rendementBareme(volet.bareme, tauxDe(etat, volet)),
              )}</b>`
        }
      </span>`;
  }
  const t = totaux(volet.budget, reglagesEffectifs(volet, etat, volets));
  return `<span class="simu__volet-solde">
      <span class="simu__volet-quoi">Solde</span>
      ${
        ecart === 0
          ? `<b class="nombre">${euros(t.solde)}</b>`
          : `<span class="simu__volet-avant nombre">${euros(
              t.solde - ecart,
            )}</span><span aria-hidden="true"> → </span><b class="nombre">${euros(
              t.solde,
            )}</b>`
      }
    </span>`;
}

/**
 * Les défis d'un budget, et ce à quoi son écart ressemble.
 *
 * Ils ne s'écrivent qu'une fois le budget touché : dix sections qui affichent
 * chacune trois pastilles grises au repos, ce sont trente pastilles qui ne
 * disent rien. Une fois qu'on a réglé, elles disent où on en est.
 */
export function renduJalons(
  volet: Volet,
  etat: EtatAtelier,
  volets: readonly Volet[],
): string {
  const ecart = contribution(volet, etat, volets);
  if (volet.genre !== "budget" || ecart === 0) return "";
  const reglages = reglagesEffectifs(volet, etat, volets);
  const mot = repere(volet.budget);
  return `<ul class="simu__defis">${renduDefis(
    defis(volet.index, reglages, ecart, totaux(volet.budget, reglages).solde),
  )}</ul>
    <p class="simu__equivalence">${renduEquivalence(volet.index, ecart, mot)}</p>`;
}

/**
 * **Qui paie**, sous le barème.
 *
 * « +2 128 M€ » ne dit rien à personne ; « 1,4 million de foyers, 1 505 € de
 * plus par an » est une note d'impôt. Les deux nombres sortent du fichier
 * IRCOM, aucun n'est estimé, et la phrase ne s'écrit que si une tranche a
 * bougé.
 */
export function renduQuiPaie(volet: Volet, etat: EtatAtelier): string {
  if (volet.genre !== "bareme") return "";
  const dit = quiPaie(volet.bareme, tauxDe(etat, volet), volet.depart);
  if (!dit) return "";
  const paient = dit.parFoyer > 0;
  return `<p class="simu__qui-paie-dit">
    <b class="nombre">${FOYERS.format(dit.foyers)}</b> foyers
    ${paient ? "paient" : "gagnent"}
    <b class="nombre">${EUROS_FOYER.format(Math.abs(dit.parFoyer))}</b>
    par an en moyenne<span class="simu__qui-paie-note">, soit ${eurosSigne(
      dit.total,
    )} au total</span>.
  </p>`;
}

const FOYERS = new Intl.NumberFormat("fr-FR");
const EUROS_FOYER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Le corps d'une section : l'arbre du budget, ou les tranches du barème. */
export function renduCorpsVolet(
  volet: Volet,
  etat: EtatAtelier,
  volets: readonly Volet[],
): string {
  if (volet.genre === "bareme") {
    return `<p class="simu__note">${echapper(volet.bareme.note)}</p>
      <div class="simu__qui-paie" data-qui-paie>${renduQuiPaie(volet, etat)}</div>
      <div class="simu__arbre">${renduTranches(volet.bareme, tauxDe(etat, volet))}</div>`;
  }
  const reglages = reglagesEffectifs(volet, etat, volets);
  const venus = externes(volet, etat, volets);
  const t = totaux(volet.budget, reglages);
  return `<div class="simu__cote">
      <h4 class="simu__cote-titre">Ce qu'il dépense<span class="nombre">${euros(
        t.depenses,
      )}</span></h4>
      <div class="simu__arbre">${renduDepenses(volet.budget, volet.index, reglages)}</div>
    </div>
    <div class="simu__cote">
      <h4 class="simu__cote-titre">Ce qu'il encaisse<span class="nombre">${euros(
        t.recettes,
      )}</span></h4>
      <p class="simu__note">Le rendement réel d'un impôt dépend des comportements : non modélisé.</p>
      <div class="simu__arbre">${renduRecettes(
        volet.budget,
        volet.index,
        reglages,
        venus,
      )}</div>
    </div>${
      volet.budget.objectif
        ? `<div class="simu__cote">
             <h4 class="simu__cote-titre">${echapper(volet.budget.objectif.t)}</h4>
             ${renduObjectif(volet.budget, volet.index, reglages)}
           </div>`
        : ""
    }`;
}

/** La ligne de recette qu'un barème pilote, si elle est chargée. */
function ligneDuBareme(
  volet: Volet,
  volets: readonly Volet[],
): { base: number; libelle: string } | null {
  if (volet.genre !== "bareme") return null;
  const cible = volets.find((v) => v.cle === volet.pilote.volet);
  if (!cible || cible.genre !== "budget") return null;
  const entree = cible.index.get(volet.pilote.code);
  return entree ? { base: entree.base, libelle: entree.libelle } : null;
}

/**
 * La page entière.
 *
 * Un seul écran, une seule barre, un seul plan. Les budgets se suivent, chacun
 * dans sa section, chacun avec son solde — et aucun total ne les additionne.
 */
export function renduAtelier(
  volets: readonly Volet[],
  etat: EtatAtelier,
  contrat: Contrat | null = null,
): string {
  return `<section class="mission" id="simu-mission">${renduMission(
    volets,
    etat,
    contrat,
  )}</section>

  <div class="simu__barre-solde" id="simu-effort" aria-live="polite">${renduEffort(
    volets,
    etat,
    contrat,
  )}</div>

  <section class="simu__bloc simu__bloc--plan" id="simu-plan-bloc"${
    gestes(volets, etat) ? "" : " hidden"
  }>
    <h3 class="simu__bloc-titre">Votre plan</h3>
    <ul class="simu__plan" id="simu-plan">${renduPlanAtelier(plan(volets, etat))}</ul>
    <div id="simu-transferts">${renduTransferts(volets, etat)}</div>
  </section>

  <div class="simu__recherche">
    <label for="simu-q" class="visuellement-cache">Chercher une ligne, dans tous les budgets</label>
    <input id="simu-q" type="search" autocomplete="off"
           placeholder="Chercher dans tous les budgets : police, retraites, TVA…" />
    <ul class="simu__suggestions" id="simu-suggestions" role="listbox" hidden></ul>
  </div>

  ${renduRaccourcisAtelier(volets)}

  ${volets
    .map(
      (volet) => `<section class="simu__volet" data-volet="${echapper(volet.cle)}">
        <header class="simu__volet-tete">
          <h3>${echapper(volet.genre === "budget" ? titre(volet.budget) : volet.nom)}</h3>
          ${renduEnteteVolet(volet, etat, volets)}
        </header>
        <p class="simu__perimetre">${echapper(
          volet.genre === "budget" ? perimetre(volet.budget) : volet.bareme.cadre,
        )}</p>
        <div class="simu__jalons">${renduJalons(volet, etat, volets)}</div>
        <div class="simu__volet-corps">${renduCorpsVolet(volet, etat, volets)}</div>
      </section>`,
    )
    .join("")}`;
}

/* --------------------------------------------------------------------------
 * Branchement
 * ----------------------------------------------------------------------- */

/**
 * Les écouteurs du montage précédent, s'il y en a eu un.
 *
 * L'atelier se remonte sur le **même** élément. Les écouteurs posés dessus ne
 * partent pas avec le HTML qu'on remplace : deux jeux se retrouveraient à
 * répondre au même clic, et un pli sur deux ne s'ouvrirait plus.
 */
let montage: AbortController | null = null;

type Options = {
  etat: EtatAtelier;
  /** Le contrat au chargement, tel que l'adresse le porte. */
  contrat?: string | null;
  /** Appelé après chaque geste, avec l'état encodé et le contrat choisi :
   *  c'est l'appelant qui possède l'URL du site, ce module ne la touche pas. */
  surReglages: (encode: string, contrat: string | null) => void;
};

export function afficherAtelier(
  bloc: HTMLElement,
  volets: readonly Volet[],
  options: Options,
): void {
  const { etat, surReglages } = options;
  let contrat = contratDe(options.contrat ?? null);
  montage?.abort();
  montage = new AbortController();
  const { signal } = montage;

  bloc.innerHTML = renduAtelier(volets, etat, contrat);

  const $ = <T extends HTMLElement>(id: string) => bloc.querySelector<T>(`#${id}`)!;
  const elQ = $<HTMLInputElement>("simu-q");
  const elSugg = $("simu-suggestions");
  const parCle = new Map(volets.map((v) => [v.cle, v]));

  const voletDe = (el: HTMLElement | null): Volet | undefined => {
    const cle = el?.closest<HTMLElement>("[data-volet]")?.dataset.volet;
    return cle ? parCle.get(cle) : undefined;
  };
  const section = (cle: string) =>
    bloc.querySelector<HTMLElement>(`.simu__volet[data-volet="${CSS.escape(cle)}"]`)!;

  /**
   * Les lignes déjà à l'écran d'un volet.
   *
   * Deux tables, et c'est tout le sujet : le montant se calcule sur les
   * réglages **effectifs** — ceux du lecteur plus ce que le barème et les
   * transferts imposent — mais le champ de saisie affiche le réglage
   * **propre** du lecteur, sans quoi il verrait apparaître dans sa case un
   * pourcentage qu'il n'a pas tapé.
   */
  function majLignes(volet: Volet): void {
    if (volet.genre !== "budget") return;
    const effectifs = reglagesEffectifs(volet, etat, volets);
    const propres = reglagesDe(etat, volet);
    const venus = externes(volet, etat, volets);
    for (const el of section(volet.cle).querySelectorAll<HTMLElement>(".simu__ligne")) {
      const entree = volet.index.get(el.dataset.code ?? "");
      if (!entree) continue;
      const externe = venus.get(entree.code) ?? null;
      const pourcentage = externe?.exclusif ? 0 : (propres.get(entree.code) ?? 0);
      const { montant, delta, surSolde } = impact(entree, effectifs);
      el.querySelector(".simu__montant")!.textContent = euros(entree.signe * montant);
      const cible = el.querySelector<HTMLElement>(".simu__delta")!;
      cible.textContent = delta === 0 ? "" : eurosSigne(delta);
      cible.className = `simu__delta nombre${classeEcart(surSolde)}`;
      el.classList.toggle("simu__ligne--reglee", delta !== 0);
      const raz = el.querySelector<HTMLElement>(".simu__raz");
      if (raz) raz.hidden = pourcentage === 0;
      const champ = el.querySelector<HTMLInputElement>(".simu__pct");
      if (champ && document.activeElement !== champ) champ.value = String(pourcentage);
      majVenu(el, externe);
    }
  }

  /** L'afficheur de ce qui vient d'ailleurs, posé au premier rendu et jamais
   *  créé après : il se remplit ou se tait. */
  function majVenu(el: HTMLElement, externe: Externe | null): void {
    const venu = el.querySelector<HTMLElement>(".simu__venu");
    if (venu) {
      venu.hidden = !externe || externe.pourcentage === 0;
      if (externe) venu.textContent = pointsAffiches(externe.pourcentage);
    }
    const renvoi = el.querySelector<HTMLElement>(".simu__renvoi b");
    if (renvoi && externe) renvoi.textContent = pointsAffiches(externe.pourcentage);
  }

  function majVolet(volet: Volet): void {
    const tete = section(volet.cle).querySelector(".simu__volet-solde")!;
    tete.outerHTML = renduEnteteVolet(volet, etat, volets);
    section(volet.cle).querySelector(".simu__jalons")!.innerHTML = renduJalons(
      volet,
      etat,
      volets,
    );
    if (volet.genre === "budget") {
      const t = totaux(volet.budget, reglagesEffectifs(volet, etat, volets));
      const titres = section(volet.cle).querySelectorAll(".simu__cote-titre .nombre");
      if (titres[0]) titres[0].textContent = euros(t.depenses);
      if (titres[1]) titres[1].textContent = euros(t.recettes);
    }
  }

  /** Les tranches du barème, et **tout ce qu'elles déplacent ailleurs**. Un
   *  point de barème bouge la recette de l'État : repeindre le seul barème
   *  laisserait à l'écran une ligne d'impôt sur le revenu périmée. */
  function repeindreBareme(volet: Volet, table: Taux): void {
    if (volet.genre !== "bareme") return;
    section(volet.cle).querySelector(".simu__arbre")!.innerHTML = renduTranches(
      volet.bareme,
      table,
    );
    for (const autre of volets) {
      majLignes(autre);
      majVolet(autre);
    }
  }

  function majTotaux(): void {
    $("simu-effort").innerHTML = renduEffort(volets, etat, contrat);
    $("simu-plan").innerHTML = renduPlanAtelier(plan(volets, etat));
    $("simu-transferts").innerHTML = renduTransferts(volets, etat);
    $("simu-plan-bloc").hidden = gestes(volets, etat) === 0;
    $("simu-mission").innerHTML = renduMission(volets, etat, contrat);
    for (const zone of bloc.querySelectorAll<HTMLElement>("[data-qui-paie]")) {
      const volet = voletDe(zone);
      if (volet) zone.innerHTML = renduQuiPaie(volet, etat);
    }
    surReglages(encoder(volets, etat), contrat?.cle ?? null);
  }

  /**
   * Un geste ne reste plus chez lui.
   *
   * Régler une tranche du barème déplace la ligne d'impôt sur le revenu de
   * l'État ; couper une dotation déplace les trois échelons de collectivités.
   * Repeindre le seul volet touché laisserait à l'écran des montants faux dans
   * les autres — c'est exactement le défaut qu'on répare. Tous les volets se
   * repeignent donc, et cela ne coûte que les lignes réellement affichées.
   */
  function appliquer(volet: Volet, code: string, valeur: number): void {
    if (volet.genre === "budget") regler(reglagesDe(etat, volet), code, valeur);
    else reglerTaux(tauxDe(etat, volet), Number(code), valeur);
    for (const autre of volets) {
      majLignes(autre);
      majVolet(autre);
    }
    majTotaux();
  }

  /** Rend les enfants au premier dépli, et seulement à ce moment-là. */
  function deplier(volet: Volet, code: string): void {
    if (volet.genre !== "budget") return;
    const zone = section(volet.cle).querySelector<HTMLElement>(
      `.simu__enfants[data-enfants="${CSS.escape(code)}"]`,
    );
    if (!zone) return;
    if (!zone.childElementCount) {
      const reglages = reglagesDe(etat, volet);
      zone.innerHTML = (volet.index.get(code)?.noeud.enfants ?? [])
        .flatMap((n) => {
          const entree = volet.index.get(n.c);
          return entree ? [renduLigne(entree, reglages)] : [];
        })
        .join("");
    }
    zone.hidden = false;
    section(volet.cle)
      .querySelector(`.simu__ligne[data-code="${CSS.escape(code)}"] .simu__pli`)
      ?.setAttribute("aria-expanded", "true");
  }

  function viser(volet: Volet, code: string): void {
    if (volet.genre !== "budget") return;
    const entree = volet.index.get(code);
    if (!entree) return;
    for (const ancetre of entree.ancetres) deplier(volet, ancetre);
    const el = section(volet.cle).querySelector<HTMLElement>(
      `.simu__ligne[data-code="${CSS.escape(code)}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("simu__ligne--visee");
    void el.offsetWidth;
    el.classList.add("simu__ligne--visee");
  }

  bloc.addEventListener("click", (evenement) => {
    const cible = evenement.target as HTMLElement;

    const pastille = cible.closest<HTMLElement>("[data-contrat]");
    if (pastille) {
      contrat = contratDe(pastille.dataset.contrat || null);
      majTotaux();
      // La rangée défile au doigt sur téléphone : sans ce recentrage, on signe
      // un contrat qui sort de l'écran au repeinturage, et rien ne dit lequel.
      $("simu-mission")
        .querySelector<HTMLElement>('.mission__pastille[aria-pressed="true"]')
        ?.scrollIntoView({ inline: "center", block: "nearest" });
      return;
    }

    // Une ligne commandée d'ailleurs mène à ce qui la commande : c'est ce
    // renvoi, et lui seul, qui rend le lien visible depuis la ligne.
    const versVolet = cible.closest<HTMLElement>("[data-vise-volet]");
    if (versVolet?.dataset.viseVolet) {
      section(versVolet.dataset.viseVolet).scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
      return;
    }

    const vise = cible.closest<HTMLElement>("[data-vise]");
    if (vise?.dataset.vise) {
      elSugg.hidden = true;
      elQ.value = "";
      const volet = parCle.get(vise.dataset.volet ?? "");
      if (volet) viser(volet, vise.dataset.vise);
      return;
    }
    if (cible.closest("#simu-raz")) {
      etat.budgets.clear();
      etat.baremes.clear();
      for (const volet of volets) {
        majLignes(volet);
        majVolet(volet);
      }
      // Les tranches du barème se repeignent en entier : elles n'ont pas de
      // conteneur d'enfants où glisser une mise à jour ligne par ligne.
      for (const volet of volets) {
        if (volet.genre === "bareme") {
          section(volet.cle).querySelector(".simu__arbre")!.innerHTML = renduTranches(
            volet.bareme,
            tauxDe(etat, volet),
          );
        }
      }
      return majTotaux();
    }

    const volet = voletDe(cible);
    if (!volet) return;

    // Le barème : ses lignes portent une borne, pas un code de nomenclature.
    const borne = cible.closest<HTMLElement>("[data-borne]")?.dataset.borne;
    const pas = cible.closest<HTMLElement>("[data-pas]");
    if (borne !== undefined && pas && volet.genre === "bareme") {
      const table = tauxDe(etat, volet);
      const valeur = (table.get(Number(borne)) ?? 0) + Number(pas.dataset.pas);
      reglerTaux(table, Number(borne), valeur);
      repeindreBareme(volet, table);
      return majTotaux();
    }

    const ligne = cible.closest<HTMLElement>(".simu__ligne");
    const code = ligne?.dataset.code;
    if (!code) return;

    const pli = cible.closest<HTMLElement>(".simu__pli");
    if (pli) {
      const zone = section(volet.cle).querySelector<HTMLElement>(
        `.simu__enfants[data-enfants="${CSS.escape(code)}"]`,
      );
      if (zone && !zone.hidden) {
        zone.hidden = true;
        pli.setAttribute("aria-expanded", "false");
      } else deplier(volet, code);
      return;
    }
    if (pas) {
      return appliquer(
        volet,
        code,
        (volet.genre === "budget" ? (reglagesDe(etat, volet).get(code) ?? 0) : 0) +
          Number(pas.dataset.pas),
      );
    }
    if (cible.closest(".simu__raz")) return appliquer(volet, code, 0);
  }, { signal });

  bloc.addEventListener("change", (evenement) => {
    const el = evenement.target as HTMLElement;
    const champ = el.closest<HTMLInputElement>(".simu__pct");
    if (!champ) return;
    const volet = voletDe(el);
    if (!volet) return;
    const valeur = Number(champ.value.replace(",", ".")) || 0;
    const borne = champ.closest<HTMLElement>("[data-borne]")?.dataset.borne;
    if (borne !== undefined && volet.genre === "bareme") {
      const table = tauxDe(etat, volet);
      reglerTaux(table, Number(borne), valeur);
      repeindreBareme(volet, table);
      return majTotaux();
    }
    const code = champ.closest<HTMLElement>(".simu__ligne")?.dataset.code;
    if (code) appliquer(volet, code, valeur);
  }, { signal });

  elQ.addEventListener("input", () => {
    const trouves = chercherAtelier(volets, elQ.value);
    elSugg.innerHTML = renduSuggestionsAtelier(trouves);
    elSugg.hidden = trouves.length === 0;
  }, { signal });

  const copier = $<HTMLButtonElement>("simu-copier");
  copier.addEventListener("click", () => {
    void navigator.clipboard?.writeText(location.href).then(
      () => {
        copier.textContent = "Lien copié";
        setTimeout(() => {
          copier.textContent = "Copier le lien";
        }, 2000);
      },
      () => {
        // Presse-papiers refusé : l'adresse de la page est déjà le lien.
      },
    );
  }, { signal });
}
