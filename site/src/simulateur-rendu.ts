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
import type { SubventionsProgramme } from "./donnees.ts";
import {
  trajectoire,
  lecture as lectureTrajectoire,
  HORIZON_MAXIMUM,
  HORIZON_PAR_DEFAUT,
  type Depart,
} from "./trajectoire.ts";

/** Les bénéficiaires nommés, posés une fois par `afficherSimulateur`. Le dépli
 *  d'une branche rend des lignes bien après le premier rendu : leur passer le
 *  fichier de main en main traverserait six signatures pour un fichier qui ne
 *  change jamais pendant la vie de la page. */
let subventionsPubliees: SubventionsProgramme | null = null;
import { echapper } from "./texte.ts";
import {
  chercher,
  defis,
  ecartAuReel,
  ecartObjectif,
  encoder,
  equivalence,
  impact,
  montantEffectif,
  plan,
  programmes,
  regler,
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

function commandes(entree: Entree, pourcentage: number): string {
  const nom = echapper(entree.libelle);
  const raz = pourcentage === 0 ? ' hidden=""' : "";
  return `<span class="simu__reglage">
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
/**
 * Qui touche les subventions d'un programme.
 *
 * Un tiroir, jamais une décomposition : les versements nominatifs déclarés ne
 * redonnent pas les crédits du programme — le jaune budgétaire ne les couvre pas
 * tous, et un programme finance bien autre chose que des associations. Le
 * résumé dit donc ce qui est déclaré et combien de bénéficiaires, sans jamais
 * en tirer une part du programme.
 */
export function renduBeneficiaires(
  code: string,
  subventions: SubventionsProgramme | null,
): string {
  const p = subventions?.programmes?.[code];
  if (!p || !p.beneficiaires.length) return "";
  const montres = p.beneficiaires.length;
  const reste = p.beneficiaires_total - montres;
  return `<details class="simu__beneficiaires" data-beneficiaires="${echapper(code)}">
    <summary>Qui touche ces subventions ?<span class="simu__beneficiaires-compte">${
      p.beneficiaires_total
    } bénéficiaires nommés, ${euros(p.declare)} déclarés en ${echapper(subventions.exercice)}
    </span></summary>
    <p class="simu__beneficiaires-note">Subventions aux associations déclarées au jaune
      budgétaire, à l'adresse du siège du bénéficiaire. Elles ne sont pas la décomposition
      du programme : elles n'en couvrent qu'une partie, et ce programme finance aussi
      autre chose.</p>
    <ol class="simu__beneficiaires-liste">${p.beneficiaires
      .map(
        (b) => `<li><span class="simu__beneficiaire-nom">${echapper(b.nom)}</span>${
          b.objet ? `<span class="simu__beneficiaire-objet">${echapper(b.objet)}</span>` : ""
        }<span class="nombre">${euros(b.montant)}</span></li>`,
      )
      .join("")}</ol>${
    reste > 0
      ? `<p class="simu__beneficiaires-note">Les ${montres} plus gros sont montrés ;
         ${reste} autres bénéficiaires ne le sont pas.</p>`
      : ""
  }</details>`;
}

export function renduLigne(
  entree: Entree,
  reglages: Reglages,
  subventions: SubventionsProgramme | null = subventionsPubliees,
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
    ${commandes(entree, pourcentage)}
    <span class="simu__montant nombre">${euros(entree.signe * montant)}</span>
    <span class="simu__delta nombre${classeEcart(surSolde)}">${
      delta === 0 ? "" : eurosSigne(delta)
    }</span>
  </div>${renduBeneficiaires(entree.code, subventions)}${
    enfants ? `<div class="simu__enfants" data-enfants="${code}" hidden></div>` : ""
  }`;
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
 * Les recettes, par famille. Les deux prélèvements sur recettes se *déduisent*
 * des recettes de l'État : leur titre le dit, et leur montant s'affiche négatif
 * plutôt que de laisser croire à un encaissement.
 *
 * Le total d'un groupe est celui de ses lignes **réglées**, feuilles sommées :
 * un groupe qui afficherait sa base pendant que ses lignes bougent dirait le
 * contraire de ce qu'on vient de faire.
 */
export function renduRecettes(budget: Budget, index: Index, reglages: Reglages): string {
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
          .map((e) => renduLigne(e, reglages))
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

/* --------------------------------------------------------------------------
 * La barre de solde, les raccourcis, la trajectoire
 * ----------------------------------------------------------------------- */

/**
 * La barre de solde : quatre nombres sur une ligne, toujours à l'écran.
 *
 * Le cockpit posait quatre cartes en haut de page. Dès qu'on descendait d'un
 * cran dans l'arbre, elles sortaient de l'écran : on réglait à l'aveugle,
 * donc au hasard. La barre est collante — en haut sur grand écran, **en bas
 * sur téléphone**, dans la zone du pouce, là où l'on regarde déjà.
 *
 * Le solde y est écrit deux fois quand il a bougé : le voté, puis le vôtre.
 * Un seul nombre ne dit pas ce qu'on vient de changer.
 */
export function renduBarreSolde(budget: Budget, index: Index, reglages: Reglages): string {
  const t = totaux(budget, reglages);
  const ecart = ecartAuReel(budget, reglages);
  const vote = t.solde - ecart;
  return `<div class="simu__solde">
      <span class="simu__solde-quoi">Solde</span>
      ${
        ecart === 0
          ? `<b class="simu__solde-val nombre">${euros(t.solde)}</b>`
          : `<span class="simu__solde-avant nombre">${euros(vote)}</span>
             <span class="simu__solde-fleche" aria-hidden="true">→</span>
             <b class="simu__solde-val nombre">${euros(t.solde)}</b>`
      }
    </div>
    <dl class="simu__solde-detail">
      <div><dt>Dépenses</dt><dd class="nombre">${euros(t.depenses)}</dd></div>
      <div><dt>Recettes</dt><dd class="nombre">${euros(t.recettes)}</dd></div>
      <div><dt>Écart</dt><dd class="nombre${classeEcart(ecart)}">${
        ecart === 0 ? "aucun geste" : eurosSigne(ecart)
      }</dd></div>
    </dl>`;
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
 * La dette, année après année
 * ----------------------------------------------------------------------- */

/** « 1,8 % ». */
function pourcentage(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(valeur)}\u202f%`;
}

/**
 * Le solde **hors charge de la dette** : la seule part que le lecteur décide.
 *
 * Les intérêts ne se règlent pas, ils suivent l'encours — c'est tout l'objet de
 * la projection, qui les recalcule chaque année. Les laisser dans le solde
 * primaire les compterait deux fois.
 */
export function soldePrimaire(budget: Budget, index: Index, reglages: Reglages, codeCharge: string): number {
  const charge = index.get(codeCharge);
  const interets = charge ? montantEffectif(charge, reglages) : 0;
  return totaux(budget, reglages).solde + interets;
}

/** Le programme qui porte la charge de la dette de l'État. */
export const CODE_CHARGE_DETTE = "117";

export type Projection = { depart: Depart; taux: number; horizon: number };

/**
 * « Et après ? » — la seule partie de la page qui ne soit pas de l'arithmétique
 * sur des chiffres publiés, et elle le dit.
 *
 * Trois nombres publiés entrent : l'encours de la dette de l'État, la charge de
 * cette dette, et le solde primaire tel que les réglages le laissent. Deux
 * hypothèses sortent du lecteur : le taux, et l'horizon. Elles sont **au-dessus
 * du résultat**, réglables, jamais enterrées dans le calcul.
 */
export function renduTrajectoire(
  budget: Budget,
  index: Index,
  reglages: Reglages,
  projection: Projection,
): string {
  const { depart, taux, horizon } = projection;
  const primaire = soldePrimaire(budget, index, reglages, CODE_CHARGE_DETTE);
  const t = trajectoire(depart, primaire, { taux, horizon });
  const derniere = t.annees[t.annees.length - 1];
  const maximum = Math.max(...t.annees.map((a) => a.dette), depart.encours);
  return `<div class="simu__hypotheses">
      <label>Taux d'intérêt
        <span class="simu__champ"><input type="text" inputmode="decimal" id="simu-taux"
          class="nombre" value="${new Intl.NumberFormat("fr-FR", {
            maximumFractionDigits: 2,
          }).format(taux)}" /><span class="simu__unite" aria-hidden="true">%</span></span>
      </label>
      <label>Horizon
        <span class="simu__champ"><input type="text" inputmode="numeric" id="simu-horizon"
          class="nombre" value="${horizon}" /><span class="simu__unite" aria-hidden="true">ans</span></span>
      </label>
      <p class="simu__hypotheses-note">Taux apparent publié : ${pourcentage(
        t.tauxApparent,
      )}, soit la charge de ${euros(depart.charge)} de ${echapper(
        depart.chargeExercice,
      )} rapportée à l'encours de ${euros(depart.encours)} de ${echapper(
        depart.encoursExercice,
      )}. Ce n'est pas le taux auquel l'État emprunterait demain.</p>
    </div>
    <p class="simu__verdict">${echapper(lectureTrajectoire(t, horizon))}</p>
    <dl class="simu__compteurs">
      ${compteur("Solde hors intérêts", eurosSigne(primaire), classeEcart(primaire))}
      ${compteur(
        `Intérêts, année ${derniere.rang}`,
        euros(derniere.interets),
      )}
      ${compteur(`Dette, année ${derniere.rang}`, euros(derniere.dette))}
    </dl>
    <ol class="simu__annees">${t.annees
      .map(
        (a) => `<li>
          <span class="simu__annee-rang">an ${a.rang}</span>
          <span class="simu__annee-barre"><i style="width:${
            maximum ? Math.round((a.dette / maximum) * 100) : 0
          }%"></i></span>
          <span class="simu__annee-dette nombre">${euros(a.dette)}</span>
          <span class="simu__annee-interets nombre">dont ${euros(a.interets)} d'intérêts</span>
        </li>`,
      )
      .join("")}</ol>
    <p class="simu__note">Aucune croissance, aucune inflation, aucun comportement : le solde
      hors intérêts est reconduit à l'identique chaque année. L'encours est celui de l'État,
      pas la dette publique toutes administrations.</p>`;
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

/* --------------------------------------------------------------------------
 * La page
 * ----------------------------------------------------------------------- */

/**
 * Le squelette, monté une fois. Les zones qui bougent portent un identifiant :
 * un réglage réécrit la barre, le plan et la trajectoire, jamais l'arbre déjà
 * déplié.
 *
 * L'ORDRE EST LE PRODUIT, et il a changé.
 *
 * 1. **La barre de solde**, collante, toujours visible.
 * 2. **Votre plan**, avant l'arbre : c'est le résultat, l'arbre est l'outil de
 *    saisie. On ouvrait sur mille lignes de nomenclature ; on ouvre maintenant
 *    sur ce qu'on a décidé, et le plan n'existe pas tant qu'on n'a rien décidé.
 * 3. **La recherche**, en grand : pour régler l'aide au logement, il fallait
 *    deviner qu'elle est rangée sous « Cohésion des territoires ».
 * 4. **Les raccourcis** vers les postes dont on débat.
 * 5. **Les dépenses, puis les recettes**, à la suite. Plus d'onglets.
 * 6. **La dette, année après année**, quand le budget en porte la charge.
 */
export function rendu(
  budget: Budget,
  index: Index,
  reglages: Reglages,
  projection?: Projection,
): string {
  const ecart = ecartAuReel(budget, reglages);
  return `<header class="simu__tete">
    <h2>${echapper(titre(budget))}</h2>
    <p class="simu__perimetre">${echapper(perimetre(budget))}</p>
  </header>

  <div class="simu__barre-solde" id="simu-solde" aria-live="polite">${renduBarreSolde(
    budget,
    index,
    reglages,
  )}</div>

  <section class="simu__bloc simu__bloc--plan" id="simu-plan-bloc"${
    reglages.size ? "" : " hidden"
  }>
    <h3 class="simu__bloc-titre">Votre plan<span id="simu-plan-compte">${
      reglages.size ? `${reglages.size} ${reglages.size > 1 ? "gestes" : "geste"}` : ""
    }</span></h3>
    <ul class="simu__plan" id="simu-plan">${renduPlan(
      plan(index, reglages),
      programmes(index),
      repere(budget),
    )}</ul>
    <p class="simu__equivalence" id="simu-equivalence">${renduEquivalence(
      index,
      ecart,
      repere(budget),
    )}</p>
    <ul class="simu__defis" id="simu-defis">${renduDefis(
      defis(index, reglages, ecart, totaux(budget, reglages).solde),
    )}</ul>
    <div class="simu__plan-actions">
      <button type="button" class="simu__copier" id="simu-copier">Copier le lien de mon budget</button>
      <button type="button" class="simu__creux" id="simu-raz">Tout remettre à zéro</button>
    </div>
  </section>

  <div class="simu__recherche">
    <label for="simu-q" class="visuellement-cache">Chercher une ligne du budget</label>
    <input id="simu-q" type="search" autocomplete="off"
           placeholder="Chercher : police, logement, TVA…" />
    <ul class="simu__suggestions" id="simu-suggestions" role="listbox" hidden></ul>
  </div>

  ${renduRaccourcis(index)}

  <section class="simu__bloc" id="simu-vue-depenses">
    <h3 class="simu__bloc-titre">Ce qu'il dépense<span class="nombre">${euros(
      totaux(budget, reglages).depenses,
    )}</span></h3>
    <div class="simu__arbre" id="simu-arbre-depenses">${renduDepenses(
      budget,
      index,
      reglages,
    )}</div>
  </section>

  <section class="simu__bloc" id="simu-vue-recettes">
    <h3 class="simu__bloc-titre">Ce qu'il encaisse<span class="nombre">${euros(
      totaux(budget, reglages).recettes,
    )}</span></h3>
    <p class="simu__note">Le rendement réel d'un impôt dépend des comportements : non modélisé.</p>
    <div class="simu__arbre" id="simu-arbre-recettes">${renduRecettes(
      budget,
      index,
      reglages,
    )}</div>
  </section>

  ${
    budget.objectif
      ? `<section class="simu__bloc" id="simu-vue-objectif">
           <h3 class="simu__bloc-titre">${echapper(budget.objectif.t)}</h3>
           ${renduObjectif(budget, index, reglages)}
         </section>`
      : ""
  }

  ${
    projection
      ? `<section class="simu__bloc simu__bloc--dette" id="simu-vue-trajectoire">
           <h3 class="simu__bloc-titre">Et après ? La dette, année après année</h3>
           <div id="simu-trajectoire">${renduTrajectoire(budget, index, reglages, projection)}</div>
         </section>`
      : ""
  }`;
}

/* --------------------------------------------------------------------------
 * Branchement
 * ----------------------------------------------------------------------- */

type Options = {
  /** L'état des réglages, déjà décodé depuis l'URL par l'appelant. */
  reglages: Reglages;
  /** Appelé après chaque geste, avec l'état encodé : c'est l'appelant qui
   *  possède l'URL du site, ce module ne la touche pas. */
  surReglages: (encode: string) => void;
  /**
   * De quoi projeter la dette : l'encours publié et la charge publiée.
   *
   * Le budget de la Sécurité sociale n'en a pas : sa dette est portée par la
   * CADES, sur un autre encours, et lui appliquer le taux apparent de l'État
   * donnerait un chiffre juste appliqué au mauvais périmètre. Absent, la
   * section « Et après ? » n'existe pas.
   */
  depart?: Depart;
  /** Les bénéficiaires nommés par programme. Absent des publications
   *  antérieures : aucun tiroir ne s'ouvre. */
  subventions?: SubventionsProgramme | null;
};

/**
 * Les écouteurs du montage précédent, s'il y en a eu un.
 *
 * Le simulateur se remonte sur le **même** élément quand le lecteur passe d'un
 * budget à l'autre. Les écouteurs posés sur cet élément-là, eux, ne partent pas
 * avec le HTML qu'on remplace : deux jeux se retrouvaient à répondre au même
 * clic. Celui du budget précédent ne connaissait plus aucun des codes affichés,
 * dépliait donc une branche vide — et celui du budget courant, voyant la
 * branche ouverte, la refermait aussitôt. Un pli sur deux ne s'ouvrait plus.
 */
let montage: AbortController | null = null;

export function afficherSimulateur(bloc: HTMLElement, budget: Budget, index: Index, options: Options): void {
  const { reglages, surReglages } = options;
  const $ = <T extends HTMLElement>(id: string) => bloc.querySelector<T>(`#${id}`)!;

  montage?.abort();
  montage = new AbortController();
  const { signal } = montage;

  subventionsPubliees = options.subventions ?? null;
  /** Les deux hypothèses de la projection, réglées par le lecteur, jamais
   *  écrites dans l'URL : ce ne sont pas des gestes budgétaires, et un lien
   *  partagé doit ouvrir le plan de son auteur, pas ses paramètres de calcul. */
  const projection: Projection | undefined = options.depart
    ? {
        depart: options.depart,
        taux: Math.round((options.depart.charge / options.depart.encours) * 10000) / 100,
        horizon: HORIZON_PAR_DEFAUT,
      }
    : undefined;
  bloc.innerHTML = rendu(budget, index, reglages, projection);

  const elSolde = $("simu-solde");
  const elDefis = $("simu-defis");
  const elPlanBloc = $("simu-plan-bloc");
  const elPlan = $("simu-plan");
  const elQ = $<HTMLInputElement>("simu-q");
  const elSugg = $("simu-suggestions");

  const ligneDe = (code: string) =>
    bloc.querySelector<HTMLElement>(`.simu__ligne[data-code="${CSS.escape(code)}"]`);

  /** Les lignes déjà à l'écran, remises à jour après chaque geste. Les autres
   *  n'existent pas encore : c'est tout l'intérêt du dépli à la demande. */
  function majLignes(): void {
    for (const el of bloc.querySelectorAll<HTMLElement>(".simu__ligne")) {
      const entree = index.get(el.dataset.code ?? "");
      if (!entree) continue;
      const pourcentage = reglages.get(entree.code) ?? 0;
      const { montant, delta, surSolde } = impact(entree, reglages);
      el.querySelector(".simu__montant")!.textContent = euros(entree.signe * montant);
      const cible = el.querySelector<HTMLElement>(".simu__delta")!;
      cible.textContent = delta === 0 ? "" : eurosSigne(delta);
      cible.className = `simu__delta nombre${classeEcart(surSolde)}`;
      el.classList.toggle("simu__ligne--reglee", pourcentage !== 0);
      el.querySelector<HTMLElement>(".simu__raz")!.hidden = pourcentage === 0;
      const champ = el.querySelector<HTMLInputElement>(".simu__pct")!;
      if (document.activeElement !== champ) champ.value = String(pourcentage);
    }
  }

  function majTrajectoire(): void {
    if (!projection) return;
    $("simu-trajectoire").innerHTML = renduTrajectoire(budget, index, reglages, projection);
  }

  function majTotaux(): void {
    elSolde.innerHTML = renduBarreSolde(budget, index, reglages);
    const ecart = ecartAuReel(budget, reglages);
    elDefis.innerHTML = renduDefis(
      defis(index, reglages, ecart, totaux(budget, reglages).solde),
    );
    elPlan.innerHTML = renduPlan(plan(index, reglages), programmes(index), repere(budget));
    $("simu-equivalence").innerHTML = renduEquivalence(index, ecart, repere(budget));
    // Le plan n'existe pas tant qu'aucune ligne n'est réglée : un bloc « Votre
    // plan » vide au-dessus de l'arbre dirait qu'on a oublié de faire quelque
    // chose.
    elPlanBloc.hidden = reglages.size === 0;
    $("simu-plan-compte").textContent = reglages.size
      ? `${reglages.size} ${reglages.size > 1 ? "gestes" : "geste"}`
      : "";
    for (const [id, valeur] of [
      ["simu-vue-depenses", totaux(budget, reglages).depenses],
      ["simu-vue-recettes", totaux(budget, reglages).recettes],
    ] as const) {
      const total = bloc.querySelector(`#${id} .simu__bloc-titre .nombre`);
      if (total) total.textContent = euros(valeur);
    }
    // Le compteur de l'ONDAM vit dans son bloc : la barre de solde ne le porte
    // pas, et c'est ce qui garantit qu'un réglage d'objectif ne déplace pas le
    // solde.
    const compteursObjectif = bloc.querySelector("#simu-compteurs-objectif");
    if (compteursObjectif && budget.objectif) {
      compteursObjectif.innerHTML =
        compteur(echapper(budget.objectif.t), euros(totalObjectif(budget, reglages))) +
        compteur("Votre écart à l'objectif", eurosSigne(ecartObjectif(budget, reglages)));
    }
    majTrajectoire();
    surReglages(encoder(reglages));
  }

  function appliquer(code: string, valeur: number): void {
    regler(reglages, code, valeur);
    majLignes();
    majTotaux();
  }

  /** Rend les enfants au premier dépli, et seulement à ce moment-là. */
  function deplier(code: string): void {
    const zone = bloc.querySelector<HTMLElement>(
      `.simu__enfants[data-enfants="${CSS.escape(code)}"]`,
    );
    if (!zone) return;
    if (!zone.childElementCount) {
      const enfants = index.get(code)?.noeud.enfants ?? [];
      zone.innerHTML = enfants
        .flatMap((n) => {
          const entree = index.get(n.c);
          return entree ? [renduLigne(entree, reglages)] : [];
        })
        .join("");
    }
    zone.hidden = false;
    ligneDe(code)?.querySelector(".simu__pli")?.setAttribute("aria-expanded", "true");
  }

  /**
   * Aller à une ligne, d'où qu'on vienne : plan, recherche ou raccourci.
   *
   * Il n'y a plus de panneau à montrer d'abord — dépenses et recettes sont sur
   * la même page. Restent le dépli des ancêtres et le défilement.
   */
  function viser(code: string): void {
    const entree = index.get(code);
    if (!entree) return;
    for (const ancetre of entree.ancetres) deplier(ancetre);
    const el = ligneDe(code);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("simu__ligne--visee");
    void el.offsetWidth;
    el.classList.add("simu__ligne--visee");
  }

  bloc.addEventListener("click", (evenement) => {
    const cible = evenement.target as HTMLElement;

    const vise = cible.closest<HTMLElement>("[data-vise]");
    if (vise?.dataset.vise) {
      elSugg.hidden = true;
      elQ.value = "";
      return viser(vise.dataset.vise);
    }

    const ligne = cible.closest<HTMLElement>(".simu__ligne");
    const code = ligne?.dataset.code;
    if (!code) return;

    const pli = cible.closest<HTMLElement>(".simu__pli");
    if (pli) {
      const zone = bloc.querySelector<HTMLElement>(
        `.simu__enfants[data-enfants="${CSS.escape(code)}"]`,
      );
      if (zone && !zone.hidden) {
        zone.hidden = true;
        pli.setAttribute("aria-expanded", "false");
      } else deplier(code);
      return;
    }
    const pas = cible.closest<HTMLElement>("[data-pas]");
    if (pas) return appliquer(code, (reglages.get(code) ?? 0) + Number(pas.dataset.pas));
    if (cible.closest(".simu__raz")) return appliquer(code, 0);
  }, { signal });

  bloc.addEventListener("change", (evenement) => {
    const el = evenement.target as HTMLElement;
    // Les deux hypothèses de la projection : elles ne touchent aucun réglage
    // budgétaire, elles ne repeignent que leur propre section.
    if (projection && (el.id === "simu-taux" || el.id === "simu-horizon")) {
      const valeur = Number((el as HTMLInputElement).value.replace(",", ".")) || 0;
      if (el.id === "simu-taux") projection.taux = Math.max(0, Math.min(20, valeur));
      else projection.horizon = Math.max(1, Math.min(HORIZON_MAXIMUM, Math.round(valeur)));
      return majTrajectoire();
    }
    const champ = el.closest<HTMLInputElement>(".simu__pct");
    const code = champ?.closest<HTMLElement>(".simu__ligne")?.dataset.code;
    if (champ && code) appliquer(code, Number(champ.value.replace(",", ".")) || 0);
  }, { signal });

  elQ.addEventListener("input", () => {
    const trouves = chercher(index, elQ.value);
    elSugg.innerHTML = renduSuggestions(trouves);
    elSugg.hidden = trouves.length === 0;
  }, { signal });

  $<HTMLButtonElement>("simu-raz").addEventListener("click", () => {
    reglages.clear();
    majLignes();
    majTotaux();
  }, { signal });

  const copier = $<HTMLButtonElement>("simu-copier");
  copier.addEventListener("click", () => {
    void navigator.clipboard?.writeText(location.href).then(
      () => {
        copier.textContent = "Lien copié";
        setTimeout(() => {
          copier.textContent = "Copier le lien de mon budget";
        }, 2000);
      },
      () => {
        // Presse-papiers refusé par le navigateur : l'adresse de la page est
        // déjà le lien, il n'y a rien à annoncer de plus.
      },
    );
  }, { signal });
}
