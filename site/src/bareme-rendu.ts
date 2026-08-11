/**
 * Le barème à l'écran.
 *
 * Ce module ne calcule rien : chaque chiffre affiché sort de `bareme.ts`, qui
 * est testé à part. Les trois règles de produit du simulateur s'appliquent ici
 * telles quelles — aucun bloc de prose, aucune couleur de jugement, rien de
 * cliquable qui mène à une section vide.
 *
 * Une quatrième s'y ajoute, propre à cet écran : **la ligne dit toujours qui
 * elle touche**. Un barème se lit par son rendement, mais un rendement sans le
 * nombre de foyers qui le paient est une moitié de réponse — et c'est la moitié
 * dont on discute.
 */

import { formater } from "./echelle.ts";
import { echapper } from "./texte.ts";
import {
  MODELES,
  TAUX_UNIQUE_PAR_DEFAUT,
  appliquer,
  decoder,
  ecartAuReel,
  encoder,
  foyersConcernes,
  partDesFoyers,
  regler,
  rendement,
  rendementTranche,
  tauxDe,
  tauxMoyen,
  tauxMoyenDesConcernes,
  type Bareme,
  type Taux,
} from "./bareme.ts";

const PAS = 1;

const NOMBRE = new Intl.NumberFormat("fr-FR");
const POURCENT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function euros(montant: number): string {
  return formater(montant, "EUR", false);
}

function eurosSigne(montant: number): string {
  return montant > 0 ? `+${euros(montant)}` : euros(montant);
}

function pourcentage(part: number): string {
  return `${POURCENT.format(part * 100)} %`;
}

/** « De 30 000 € à 50 000 € », « Au-dessus de 9 000 000 € ». La borne haute
 *  manque sur la dernière tranche, et c'est une information, pas un trou. */
export function intitule(tranche: { b: number; h: number | null }): string {
  const bas = NOMBRE.format(tranche.b);
  if (tranche.h === null) return `Au-dessus de ${bas} €`;
  if (tranche.b === 0) return `Jusqu'à ${NOMBRE.format(tranche.h)} €`;
  return `De ${bas} € à ${NOMBRE.format(tranche.h)} €`;
}

function compteur(nom: string, valeur: string, aide = ""): string {
  return `<div class="simu__compteur">
    <dt${aide ? ` title="${echapper(aide)}"` : ""}>${nom}</dt>
    <dd class="nombre">${valeur}</dd>
  </div>`;
}

/**
 * Le cockpit : ce que le barème rapporte, à qui, à quel taux moyen, et de
 * combien il s'écarte de l'impôt réellement émis.
 *
 * Le taux moyen est celui de tout le revenu déclaré, jamais la moyenne des taux
 * affichés : 60 % sur les seuls revenus de plus de neuf millions d'euros font
 * un taux moyen de 0,5 %, et c'est ce genre d'écart que cet écran doit rendre
 * visible.
 */
export function renduCockpit(bareme: Bareme, taux: Taux): string {
  const total = rendement(bareme, taux);
  const ecart = ecartAuReel(bareme, taux);
  return `<div class="simu__titres">
      <h2>${echapper(bareme.titre)}</h2>
      <p class="simu__perimetre">${echapper(bareme.cadre)}</p>
    </div>
    <dl class="simu__compteurs">
      ${compteur("Rendement", euros(total))}
      ${compteur(
        "Foyers qui paient",
        NOMBRE.format(foyersConcernes(bareme, taux)),
        "Les foyers dont le revenu dépasse la borne de la première tranche taxée.",
      )}
      ${compteur("Part des foyers", pourcentage(partDesFoyers(bareme, taux)))}
      ${compteur(
        "Taux moyen",
        pourcentage(tauxMoyen(bareme, taux)),
        "Ce que le barème prend rapporté à tout le revenu fiscal de référence"
          + " déclaré, et non la moyenne des taux réglés.",
      )}
      ${compteur(
        "Écart à l'impôt émis",
        eurosSigne(ecart),
        `L'impôt sur le revenu réellement émis par voie de rôle vaut ${euros(
          bareme.impot_emis,
        )}.`,
      )}
    </dl>`;
}

/**
 * Les trois modes, et le curseur du taux unique.
 *
 * Trois boutons plutôt que vingt-cinq champs : le choix qu'on veut faire est
 * « quelle forme de barème », pas « quel taux sur la tranche 700 000 –
 * 800 000 € ». Le mode choisi se lit à son bouton, et son aide est écrite en
 * toutes lettres sous les boutons — pas dans une infobulle qu'un doigt ne peut
 * pas ouvrir.
 */
export function renduModes(choisi: string, tauxUnique: number): string {
  const mode = MODELES.find((m) => m.cle === choisi) ?? MODELES[0];
  return `<div class="bareme__modes" role="group" aria-label="Forme du barème">${MODELES.map(
    (modele) =>
      `<button type="button" data-mode="${modele.cle}"
         aria-pressed="${modele.cle === choisi}">${echapper(modele.nom)}</button>`,
  ).join("")}</div>
  ${
    choisi === "unique"
      ? `<div class="bareme__curseur">
          <label for="bareme-taux">Taux unique</label>
          <input type="range" id="bareme-taux" min="0" max="60" step="0.5"
                 value="${tauxUnique}" aria-describedby="bareme-taux-valeur" />
          <output id="bareme-taux-valeur" class="nombre">${pourcentage(tauxUnique / 100)}</output>
        </div>`
      : ""
  }
  <p class="simu__note bareme__aide">${echapper(mode.aide)}</p>`;
}

/** Une tranche : son intitulé, qui elle touche, sa matière taxable, son taux et
 *  ce qu'elle rapporte. */
export type VerrouTranche = { sens: "hausse" | "baisse" | "tout"; par: string };

export function renduTranche(
  bareme: Bareme,
  taux: Taux,
  rang: number,
  verrou: VerrouTranche | null = null,
): string {
  const tranche = bareme.tranches[rang];
  const pourcent = tauxDe(taux, tranche);
  const nom = echapper(intitule(tranche));
  // Le verrou est directionnel, et c'est ce qui rend « sans lever un seul
  // impôt » compatible avec une flat tax : les tranches qu'elle baisse restent
  // réglables, celles qu'elle lève sont refusées. Juger sur le rendement
  // agrégé aurait dit « vous levez un impôt » à qui en baisse la moitié.
  const ferme = (sens: "hausse" | "baisse") =>
    verrou && (verrou.sens === "tout" || verrou.sens === sens)
      ? ` disabled title="Verrouillé par « ${echapper(verrou.par)} »"`
      : "";
  return `<div class="simu__ligne bareme__ligne${
    pourcent === 0 ? "" : " simu__ligne--reglee"
  }${verrou ? " simu__ligne--verrouillee" : ""}" data-borne="${tranche.b}">
    <span class="simu__intitule"><span class="simu__lib">${nom}</span></span>
    <span class="bareme__foyers nombre" title="Foyers dont le revenu dépasse cette borne">${NOMBRE.format(
      tranche.fa,
    )}</span>
    <span class="simu__base nombre" title="Matière taxable de cette tranche">${euros(
      tranche.a,
    )}</span>
    <span class="simu__reglage">
      <button type="button" class="simu__pas" data-pas="${-PAS}"
              aria-label="Baisser le taux de ${nom} d'un point"${ferme("baisse")}>−</button>
      <span class="simu__champ">
        <input type="text" inputmode="numeric" class="simu__pct nombre" value="${pourcent}"
               aria-label="Taux appliqué à la tranche ${nom}" />
        <span class="simu__unite" aria-hidden="true">%</span>
      </span>
      <button type="button" class="simu__pas" data-pas="${PAS}"
              aria-label="Monter le taux de ${nom} d'un point"${ferme("hausse")}>+</button>
    </span>
    <span class="simu__montant nombre">${
      pourcent === 0 ? "" : euros(rendementTranche(tranche, taux))
    }</span>
  </div>`;
}

export function renduTranches(
  bareme: Bareme,
  taux: Taux,
  verrou: VerrouTranche | null = null,
): string {
  // Des intitulés courts, et l'explication dans l'infobulle : « Matière
  // taxable » débordait de sa colonne et se collait au « Taux » voisin.
  return `<div class="simu__ligne bareme__entete">
      <span class="simu__intitule">Tranche de revenu fiscal de référence</span>
      <span class="bareme__foyers" title="Foyers dont le revenu dépasse la borne basse de la tranche">Foyers</span>
      <span class="simu__base" title="Ce que cette tranche du barème peut taxer">Assiette</span>
      <span class="simu__reglage">Taux</span>
      <span class="simu__montant">Rendement</span>
    </div>${bareme.tranches
      .map((_, rang) => renduTranche(bareme, taux, rang, verrou))
      .join("")}`;
}

export function rendu(
  bareme: Bareme,
  taux: Taux,
  mode: string,
  tauxUnique: number,
): string {
  return `<div class="simu__cockpit" id="bareme-cockpit" aria-live="polite">${renduCockpit(
    bareme,
    taux,
  )}</div>
  <div id="bareme-modes">${renduModes(mode, tauxUnique)}</div>
  <p class="simu__note" id="bareme-lecture">${lecture(bareme, taux)}</p>
  <!-- Le détail tranche par tranche existe toujours, replié : il répond à une
       question que peu de gens se posent, et il occupait tout l'écran de ceux
       qui ne se la posaient pas. -->
  <details class="bareme__detail">
    <summary>Régler tranche par tranche</summary>
    <div class="simu__arbre" id="bareme-tranches">${renduTranches(bareme, taux)}</div>
    <p class="simu__note">${echapper(bareme.note)}</p>
  </details>`;
}

/**
 * La phrase de lecture, sous le tableau. Une seule, et elle ne paraphrase pas
 * les compteurs : elle dit ce qu'aucun d'eux ne dit — le taux moyen des seuls
 * foyers atteints, qui est toujours plus haut que le taux moyen général et
 * qu'on lit systématiquement à sa place.
 */
export function lecture(bareme: Bareme, taux: Taux): string {
  const touches = foyersConcernes(bareme, taux);
  if (!touches) return "Aucune tranche n'est taxée : ce barème ne rapporte rien.";
  return `Ce barème atteint ${NOMBRE.format(touches)} foyers sur ${NOMBRE.format(
    bareme.foyers,
  )}, et leur prend en moyenne ${pourcentage(
    tauxMoyenDesConcernes(bareme, taux),
  )} de leur revenu déclaré.`;
}

/* --------------------------------------------------------------------------
 * Branchement
 * ----------------------------------------------------------------------- */

type Options = {
  taux: Taux;
  surReglages: (encode: string) => void;
};

/** Le mode qui décrit le mieux des taux déjà posés — celui d'un lien partagé.
 *  Aucun des trois ne colle : le lecteur a réglé à la main, et le détail
 *  s'ouvre sur ses valeurs plutôt que d'être écrasé par un mode. */
export function modeDe(bareme: Bareme, taux: Taux): string {
  for (const modele of MODELES) {
    if (modele.cle === "unique") continue;
    if (encoder(appliquer(bareme, modele)) === encoder(taux)) return modele.cle;
  }
  const valeurs = new Set(bareme.tranches.map((t) => taux.get(t.b) ?? 0));
  return valeurs.size === 1 && !valeurs.has(0) ? "unique" : "";
}

/** Les écouteurs du montage précédent, coupés au montage suivant : le même
 *  élément sert aux budgets et au barème, et deux jeux d'écouteurs sur un même
 *  clic se marchent dessus. */
let montage: AbortController | null = null;

export function afficherBareme(bloc: HTMLElement, bareme: Bareme, options: Options): void {
  montage?.abort();
  montage = new AbortController();
  const { signal } = montage;
  const { taux, surReglages } = options;

  let mode = taux.size ? modeDe(bareme, taux) : "france";
  let tauxUnique =
    mode === "unique"
      ? (taux.get(bareme.tranches[0].b) ?? TAUX_UNIQUE_PAR_DEFAUT)
      : TAUX_UNIQUE_PAR_DEFAUT;
  // Un lien sans réglage ouvre sur le barème d'aujourd'hui : un écran de
  // départ à zéro ne rapporte rien et n'apprend rien.
  if (!taux.size) {
    for (const [borne, valeur] of appliquer(bareme, MODELES[0])) taux.set(borne, valeur);
  }

  bloc.innerHTML = rendu(bareme, taux, mode, tauxUnique);

  const rafraichir = (recomposer = false): void => {
    bloc.querySelector("#bareme-cockpit")!.innerHTML = renduCockpit(bareme, taux);
    if (recomposer) {
      bloc.querySelector("#bareme-modes")!.innerHTML = renduModes(mode, tauxUnique);
    }
    bloc.querySelector("#bareme-tranches")!.innerHTML = renduTranches(bareme, taux);
    bloc.querySelector("#bareme-lecture")!.textContent = lecture(bareme, taux);
    surReglages(encoder(taux));
  };

  const poser = (nouveaux: Taux): void => {
    taux.clear();
    for (const [borne, valeur] of nouveaux) taux.set(borne, valeur);
  };

  bloc.addEventListener(
    "click",
    (evenement) => {
      const cible = evenement.target as HTMLElement;
      const bouton = cible.closest<HTMLElement>("[data-mode]");
      if (bouton?.dataset.mode) {
        mode = bouton.dataset.mode;
        const modele = MODELES.find((m) => m.cle === mode)!;
        poser(appliquer(bareme, modele, tauxUnique));
        return rafraichir(true);
      }
      const pas = cible.closest<HTMLElement>("[data-pas]");
      const borne = Number(cible.closest<HTMLElement>("[data-borne]")?.dataset.borne);
      if (pas && Number.isFinite(borne)) {
        regler(taux, borne, (taux.get(borne) ?? 0) + Number(pas.dataset.pas));
        mode = modeDe(bareme, taux);
        rafraichir(true);
      }
    },
    { signal },
  );

  // Le curseur : `input` et non `change`, pour que le rendement suive le doigt
  // au lieu d'attendre qu'on le lâche.
  bloc.addEventListener(
    "input",
    (evenement) => {
      const curseur = (evenement.target as HTMLElement).closest<HTMLInputElement>("#bareme-taux");
      if (!curseur) return;
      tauxUnique = Number(curseur.value);
      poser(appliquer(bareme, MODELES.find((m) => m.cle === "unique")!, tauxUnique));
      bloc.querySelector("#bareme-taux-valeur")!.textContent = pourcentage(tauxUnique / 100);
      rafraichir();
    },
    { signal },
  );

  bloc.addEventListener(
    "change",
    (evenement) => {
      const champ = (evenement.target as HTMLElement).closest<HTMLInputElement>(".simu__pct");
      const borne = Number(champ?.closest<HTMLElement>("[data-borne]")?.dataset.borne);
      if (champ && Number.isFinite(borne)) {
        regler(taux, borne, Number(champ.value.replace(",", ".")) || 0);
        // Un réglage à la main n'est plus aucun des trois modes : les boutons
        // le disent plutôt que d'en laisser un allumé à tort.
        mode = modeDe(bareme, taux);
        rafraichir(true);
      }
    },
    { signal },
  );
}

export { decoder };
