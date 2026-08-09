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

/** Les barèmes tout faits, en pilules. Un clic remplace tous les taux. */
export function renduModeles(): string {
  return MODELES.map(
    (modele, rang) =>
      `<button type="button" class="simu__creux" data-modele="${rang}"
         title="${echapper(modele.aide)}">${echapper(modele.nom)}</button>`,
  ).join("");
}

/** Une tranche : son intitulé, qui elle touche, sa matière taxable, son taux et
 *  ce qu'elle rapporte. */
export function renduTranche(bareme: Bareme, taux: Taux, rang: number): string {
  const tranche = bareme.tranches[rang];
  const pourcent = tauxDe(taux, tranche);
  const nom = echapper(intitule(tranche));
  return `<div class="simu__ligne bareme__ligne${
    pourcent === 0 ? "" : " simu__ligne--reglee"
  }" data-borne="${tranche.b}">
    <span class="simu__intitule"><span class="simu__lib">${nom}</span></span>
    <span class="bareme__foyers nombre" title="Foyers dont le revenu dépasse cette borne">${NOMBRE.format(
      tranche.fa,
    )}</span>
    <span class="simu__base nombre" title="Matière taxable de cette tranche">${euros(
      tranche.a,
    )}</span>
    <span class="simu__reglage">
      <button type="button" class="simu__pas" data-pas="${-PAS}"
              aria-label="Baisser le taux de ${nom} d'un point">−</button>
      <span class="simu__champ">
        <input type="text" inputmode="numeric" class="simu__pct nombre" value="${pourcent}"
               aria-label="Taux appliqué à la tranche ${nom}" />
        <span class="simu__unite" aria-hidden="true">%</span>
      </span>
      <button type="button" class="simu__pas" data-pas="${PAS}"
              aria-label="Monter le taux de ${nom} d'un point">+</button>
    </span>
    <span class="simu__montant nombre">${
      pourcent === 0 ? "" : euros(rendementTranche(tranche, taux))
    }</span>
  </div>`;
}

export function renduTranches(bareme: Bareme, taux: Taux): string {
  // Des intitulés courts, et l'explication dans l'infobulle : « Matière
  // taxable » débordait de sa colonne et se collait au « Taux » voisin.
  return `<div class="simu__ligne bareme__entete">
      <span class="simu__intitule">Tranche de revenu fiscal de référence</span>
      <span class="bareme__foyers" title="Foyers dont le revenu dépasse la borne basse de la tranche">Foyers</span>
      <span class="simu__base" title="Ce que cette tranche du barème peut taxer">Assiette</span>
      <span class="simu__reglage">Taux</span>
      <span class="simu__montant">Rendement</span>
    </div>${bareme.tranches.map((_, rang) => renduTranche(bareme, taux, rang)).join("")}`;
}

export function rendu(bareme: Bareme, taux: Taux): string {
  return `<div class="simu__cockpit" id="bareme-cockpit" aria-live="polite">${renduCockpit(
    bareme,
    taux,
  )}</div>
  <p class="simu__note">${echapper(bareme.note)}</p>
  <div class="simu__barre">
    <div class="simu__onglets" id="bareme-modeles">${renduModeles()}
      <button type="button" class="simu__creux" id="bareme-raz">Tout remettre à zéro</button>
    </div>
  </div>
  <div class="simu__arbre" id="bareme-tranches">${renduTranches(bareme, taux)}</div>
  <p class="simu__note" id="bareme-lecture">${lecture(bareme, taux)}</p>`;
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

/** Les écouteurs du montage précédent, coupés au montage suivant : le même
 *  élément sert aux budgets et au barème, et deux jeux d'écouteurs sur un même
 *  clic se marchent dessus. */
let montage: AbortController | null = null;

export function afficherBareme(bloc: HTMLElement, bareme: Bareme, options: Options): void {
  montage?.abort();
  montage = new AbortController();
  const { signal } = montage;
  const { taux, surReglages } = options;

  bloc.innerHTML = rendu(bareme, taux);

  const rafraichir = (): void => {
    bloc.querySelector("#bareme-cockpit")!.innerHTML = renduCockpit(bareme, taux);
    bloc.querySelector("#bareme-tranches")!.innerHTML = renduTranches(bareme, taux);
    bloc.querySelector("#bareme-lecture")!.textContent = lecture(bareme, taux);
    surReglages(encoder(taux));
  };

  bloc.addEventListener(
    "click",
    (evenement) => {
      const cible = evenement.target as HTMLElement;
      const modele = cible.closest<HTMLElement>("[data-modele]");
      if (modele?.dataset.modele) {
        const choisi = appliquer(bareme, MODELES[Number(modele.dataset.modele)]);
        taux.clear();
        for (const [borne, valeur] of choisi) taux.set(borne, valeur);
        return rafraichir();
      }
      if (cible.closest("#bareme-raz")) {
        taux.clear();
        return rafraichir();
      }
      const pas = cible.closest<HTMLElement>("[data-pas]");
      const borne = Number(cible.closest<HTMLElement>("[data-borne]")?.dataset.borne);
      if (pas && Number.isFinite(borne)) {
        regler(taux, borne, (taux.get(borne) ?? 0) + Number(pas.dataset.pas));
        rafraichir();
      }
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
        rafraichir();
      }
    },
    { signal },
  );
}

export { decoder };
