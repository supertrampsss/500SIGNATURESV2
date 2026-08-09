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
import { echapper } from "./texte.ts";
import {
  chercher,
  defis,
  ecartAuReel,
  encoder,
  equivalence,
  impact,
  plan,
  programmes,
  regler,
  totaux,
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

const VUES = ["depenses", "recettes", "plan"] as const;
export type VueSimulateur = (typeof VUES)[number];

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
 *  cadrage de la page, et elle tient sur une ligne. */
export function perimetre(budget: Budget): string {
  const mesure = MESURES[budget.mesure] ?? budget.mesure;
  // L'unité est dite ici, une fois. Sans elle, « Santé 1 643 M€ » se lit comme
  // 1 643 milliards par qui n'a pas le nez sur le sigle — le chiffre est juste,
  // c'est la lecture qui glisse d'un facteur mille.
  return `${budget.loi} ${budget.exercice}, budget général, ${mesure},`
    + " montants en millions d'euros (M€)";
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

/* --------------------------------------------------------------------------
 * Une ligne réglable
 * ----------------------------------------------------------------------- */

/** Profondeur d'affichage : les recettes vivent sous un titre de groupe, elles
 *  partent donc du même cran que les programmes. */
function niveau(entree: Entree): number {
  return entree.cote === "recette" ? 1 : Math.min(entree.ancetres.length, 3);
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
export function renduLigne(entree: Entree, reglages: Reglages): string {
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
  </div>${
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
 */
export function renduRecettes(budget: Budget, index: Index, reglages: Reglages): string {
  return budget.recettes
    .map((groupe) => {
      const lignes = groupe.lignes.flatMap((l) => {
        const entree = index.get(`r${l.c}`);
        return entree ? [renduLigne(entree, reglages)] : [];
      });
      const somme = groupe.lignes.reduce((s, l) => s + l.v, 0);
      return `<div class="simu__groupe">
        <h3 class="simu__groupe-titre">
          <span>${echapper(groupe.t)}${groupe.signe < 0 ? " (se déduit)" : ""}</span>
          <span class="nombre">${euros(groupe.signe * somme)}</span>
        </h3>
        <div class="simu__groupe-lignes">${lignes.join("")}</div>
      </div>`;
    })
    .join("");
}

/* --------------------------------------------------------------------------
 * Cockpit, défis, plan
 * ----------------------------------------------------------------------- */

function compteur(nom: string, valeur: string, classe = ""): string {
  return `<div class="simu__compteur">
    <dt>${nom}</dt>
    <dd class="nombre${classe}">${valeur}</dd>
  </div>`;
}

/** Dépenses, recettes, solde, votre écart. Quatre nombres, toujours les mêmes,
 *  toujours au même endroit : c'est ce qui rend un réglage lisible. */
export function renduCockpit(budget: Budget, index: Index, reglages: Reglages): string {
  const t = totaux(budget, reglages);
  const ecart = ecartAuReel(budget, reglages);
  const proche = equivalence(programmes(index), ecart);
  return `<div class="simu__titres">
      <h2>Le budget de l'État, ligne à ligne</h2>
      <p class="simu__perimetre">${echapper(perimetre(budget))}</p>
    </div>
    <dl class="simu__compteurs">
      ${compteur("Dépenses", euros(t.depenses))}
      ${compteur("Recettes nettes", euros(t.recettes))}
      ${
        // Le solde reste en encre, même profondément négatif : le déficit du
        // budget voté est un fait, pas un geste du lecteur. Le colorer en
        // argile en permanence serait un jugement sur le budget, et la couleur
        // ne sert ici qu'à dire le sens de ce que le lecteur vient de faire.
        compteur("Solde", euros(t.solde))
      }
      ${compteur("Votre écart", eurosSigne(ecart), classeEcart(ecart))}
    </dl>
    ${
      proche
        ? `<p class="simu__equivalence">Soit le programme « ${echapper(
            proche.libelle,
          )} » (${euros(proche.montant)}).</p>`
        : ""
    }`;
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
export function renduPlan(lignes: LignePlan[], candidats: Entree[]): string {
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
              ? `<span class="simu__plan-equiv">Soit le programme « ${echapper(
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

/** Les onglets. « Votre plan » n'apparaît qu'une fois quelque chose à y voir. */
export function renduOnglets(vue: VueSimulateur, regles: number): string {
  const libelles: Record<VueSimulateur, string> = {
    depenses: "Dépenses",
    recettes: "Recettes",
    plan: `Votre plan (${regles})`,
  };
  return VUES.filter((nom) => nom !== "plan" || regles > 0)
    .map(
      (nom) => `<button type="button" role="tab" id="simu-onglet-${nom}"
        aria-selected="${nom === vue}" aria-controls="simu-vue-${nom}"
        data-onglet="${nom}">${libelles[nom]}</button>`,
    )
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

/* --------------------------------------------------------------------------
 * La page
 * ----------------------------------------------------------------------- */

/** Le squelette, monté une fois. Les zones qui bougent portent un identifiant :
 *  un réglage réécrit le cockpit et le plan, jamais l'arbre déjà déplié. */
export function rendu(budget: Budget, index: Index, reglages: Reglages): string {
  const ecart = ecartAuReel(budget, reglages);
  return `<div class="simu__cockpit" id="simu-cockpit" aria-live="polite">${renduCockpit(
    budget,
    index,
    reglages,
  )}</div>
  <ul class="simu__defis" id="simu-defis">${renduDefis(
    defis(index, reglages, ecart, totaux(budget, reglages).solde),
  )}</ul>
  <div class="simu__barre">
    <div class="simu__recherche">
      <label for="simu-q" class="visuellement-cache">Chercher une ligne du budget</label>
      <input id="simu-q" type="search" autocomplete="off"
             placeholder="Chercher une ligne du budget" />
      <ul class="simu__suggestions" id="simu-suggestions" role="listbox" hidden></ul>
    </div>
    <div class="simu__onglets" id="simu-onglets" role="tablist">${renduOnglets(
      "depenses",
      reglages.size,
    )}</div>
  </div>
  <section class="simu__panneau" id="simu-vue-depenses" role="tabpanel"
           aria-labelledby="simu-onglet-depenses">
    <div class="simu__arbre" id="simu-arbre-depenses">${renduDepenses(
      budget,
      index,
      reglages,
    )}</div>
  </section>
  <section class="simu__panneau" id="simu-vue-recettes" role="tabpanel"
           aria-labelledby="simu-onglet-recettes" hidden>
    <p class="simu__note">Le rendement réel d'un impôt dépend des comportements : non modélisé.</p>
    <div class="simu__arbre" id="simu-arbre-recettes">${renduRecettes(
      budget,
      index,
      reglages,
    )}</div>
  </section>
  <section class="simu__panneau" id="simu-vue-plan" role="tabpanel"
           aria-labelledby="simu-onglet-plan" hidden>
    <div class="simu__plan-actions">
      <button type="button" class="tableau__export" id="simu-copier">Copier le lien de mon budget</button>
      <button type="button" class="simu__creux" id="simu-raz">Tout remettre à zéro</button>
    </div>
    <ul class="simu__plan" id="simu-plan">${renduPlan(
      plan(index, reglages),
      programmes(index),
    )}</ul>
  </section>`;
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
};

export function afficherSimulateur(bloc: HTMLElement, budget: Budget, index: Index, options: Options): void {
  const { reglages, surReglages } = options;
  const $ = <T extends HTMLElement>(id: string) => bloc.querySelector<T>(`#${id}`)!;

  bloc.innerHTML = rendu(budget, index, reglages);

  const cockpit = $("simu-cockpit");
  const elDefis = $("simu-defis");
  const elOnglets = $("simu-onglets");
  const elPlan = $("simu-plan");
  const elQ = $<HTMLInputElement>("simu-q");
  const elSugg = $("simu-suggestions");
  const panneaux: Record<VueSimulateur, HTMLElement> = {
    depenses: $("simu-vue-depenses"),
    recettes: $("simu-vue-recettes"),
    plan: $("simu-vue-plan"),
  };
  let vue: VueSimulateur = "depenses";

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

  function majTotaux(): void {
    cockpit.innerHTML = renduCockpit(budget, index, reglages);
    const ecart = ecartAuReel(budget, reglages);
    elDefis.innerHTML = renduDefis(
      defis(index, reglages, ecart, totaux(budget, reglages).solde),
    );
    elPlan.innerHTML = renduPlan(plan(index, reglages), programmes(index));
    // L'onglet « Votre plan » peut apparaître ou disparaître à ce geste : s'il
    // disparaît sous le lecteur qui le regarde, on le ramène aux dépenses.
    if (vue === "plan" && reglages.size === 0) montrer("depenses");
    else elOnglets.innerHTML = renduOnglets(vue, reglages.size);
    surReglages(encoder(reglages));
  }

  function appliquer(code: string, valeur: number): void {
    regler(reglages, code, valeur);
    majLignes();
    majTotaux();
  }

  function montrer(nom: VueSimulateur): void {
    vue = nom;
    for (const [cle, el] of Object.entries(panneaux)) el.hidden = cle !== nom;
    elOnglets.innerHTML = renduOnglets(nom, reglages.size);
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

  function viser(code: string): void {
    const entree = index.get(code);
    if (!entree) return;
    montrer(entree.cote === "recette" ? "recettes" : "depenses");
    for (const ancetre of entree.ancetres) deplier(ancetre);
    const el = ligneDe(code);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.remove("simu__ligne--visee");
    void el.offsetWidth;
    el.classList.add("simu__ligne--visee");
    el.querySelector<HTMLInputElement>(".simu__pct")?.focus();
  }

  bloc.addEventListener("click", (evenement) => {
    const cible = evenement.target as HTMLElement;

    // `data-onglet` et non `data-vue` : `<body>` porte déjà `data-vue`, et un
    // `closest("[data-vue]")` remontait jusqu'à lui — le moindre clic dans le
    // simulateur demandait alors d'afficher une vue nommée « simulateur », qui
    // n'existe pas ici, et masquait les trois panneaux d'un coup.
    const onglet = cible.closest<HTMLElement>("[data-onglet]");
    if (onglet?.dataset.onglet) return montrer(onglet.dataset.onglet as VueSimulateur);

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
  });

  bloc.addEventListener("change", (evenement) => {
    const champ = (evenement.target as HTMLElement).closest<HTMLInputElement>(".simu__pct");
    const code = champ?.closest<HTMLElement>(".simu__ligne")?.dataset.code;
    if (champ && code) appliquer(code, Number(champ.value.replace(",", ".")) || 0);
  });

  elQ.addEventListener("input", () => {
    const trouves = chercher(index, elQ.value);
    elSugg.innerHTML = renduSuggestions(trouves);
    elSugg.hidden = trouves.length === 0;
  });

  $<HTMLButtonElement>("simu-raz").addEventListener("click", () => {
    reglages.clear();
    majLignes();
    majTotaux();
  });

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
  });
}
