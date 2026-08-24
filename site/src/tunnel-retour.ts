/** Le bref retour, lisible, qui sépare un geste de la carte suivante. */

import { millions } from "./echelle.ts";
import { SOUTIENS, comble, soutiens, type EtatTunnel } from "./tunnel-modele.ts";
import type { Soutien } from "./mesures.ts";

export type ImpactDecision = {
  verdict: "adopte" | "rejete";
  resteAvant: number;
  resteApres: number;
  budget: { avant: number; apres: number; delta: number };
  soutiens: { cle: Soutien; nom: string; avant: number; apres: number; delta: number }[];
};

export type EtapeRetour = "engagement" | "tampon" | "impact" | "consequence";

type MomentRetour = { etape: EtapeRetour | "terminer"; a: number };

export type HorlogeRetour = {
  programmer: (callback: () => void, delai: number) => unknown;
  annuler: (identifiant: unknown) => void;
};

const horlogeNavigateur: HorlogeRetour = {
  programmer: (callback, delai) => setTimeout(callback, delai),
  annuler: (identifiant) => clearTimeout(identifiant as ReturnType<typeof setTimeout>),
};

/** La partition est pure pour tenir les millisecondes sans dépendre du DOM. */
export function chronologieRetour(reduire = false): MomentRetour[] {
  return reduire
    ? [{ etape: "terminer", a: 400 }]
    : [
        { etape: "engagement", a: 0 },
        { etape: "tampon", a: 180 },
        { etape: "impact", a: 650 },
        { etape: "consequence", a: 1400 },
        { etape: "terminer", a: 1800 },
      ];
}

function reste(etat: EtatTunnel, missionEuros: number): number {
  return Math.max(0, missionEuros - comble(etat) * 1e6);
}

/** Le verdict du dernier geste, son effet sur le reste à trouver et les jauges. */
export function impactDecision(
  avant: EtatTunnel,
  apres: EtatTunnel,
  missionEuros: number,
): ImpactDecision {
  const dernier = apres.historique.at(-1)?.id;
  const verdict = dernier ? apres.tampons[dernier] : undefined;
  if (verdict !== "adopte" && verdict !== "rejete") {
    throw new Error("impactDecision attend un tampon adopté ou rejeté");
  }
  const resteAvant = reste(avant, missionEuros);
  const resteApres = reste(apres, missionEuros);
  const avantSoutiens = new Map(soutiens(avant, missionEuros).map((s) => [s.cle, s.valeur]));
  const apresSoutiens = new Map(soutiens(apres, missionEuros).map((s) => [s.cle, s.valeur]));
  return {
    verdict,
    resteAvant,
    resteApres,
    budget: { avant: resteAvant, apres: resteApres, delta: resteApres - resteAvant },
    soutiens: SOUTIENS.map(({ cle, nom }) => {
      const avant = avantSoutiens.get(cle) ?? 0;
      const apres = apresSoutiens.get(cle) ?? 0;
      return { cle, nom, avant, apres, delta: apres - avant };
    }),
  };
}

function signeMontant(valeur: number): string {
  return `${valeur >= 0 ? "+" : "−"}${millions(Math.abs(valeur))}`;
}

function signePoints(valeur: number): string {
  return `${valeur >= 0 ? "+" : "−"}${Math.abs(valeur)} point${Math.abs(valeur) === 1 ? "" : "s"}`;
}

/** Le texte existe entier hors animation : la couleur ne porte aucun résultat. */
export function renduImpact(impact: ImpactDecision): string {
  const decision = impact.verdict === "adopte" ? "Adopter" : "Rejeter";
  const tampon = impact.verdict === "adopte" ? "ADOPTÉE" : "REJETÉE";
  return `<article class="tunnel__retour" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">
    <section class="tunnel__retour-etape tunnel__retour-etape--engagement" data-retour-etape="engagement">
      <p class="tunnel__surtitre">Engagement</p><p>${decision} : votre décision est enregistrée.</p>
    </section>
    <section class="tunnel__retour-etape tunnel__retour-etape--tampon" data-retour-etape="tampon" hidden>
      <p class="tunnel__surtitre">Tampon</p><p>${tampon}</p>
    </section>
    <section class="tunnel__retour-etape tunnel__retour-etape--impact" data-retour-etape="impact" hidden>
      <p class="tunnel__surtitre">Impact budgétaire</p>
      <p>Reste à trouver : <strong>${millions(impact.budget.avant)}</strong> → <strong>${millions(impact.budget.apres)}</strong> (${signeMontant(impact.budget.delta)}).</p>
    </section>
    <section class="tunnel__retour-etape tunnel__retour-etape--consequence" data-retour-etape="consequence" hidden>
      <p class="tunnel__surtitre">Conséquence sur les soutiens</p>
      <ul>${impact.soutiens
        .map((s) => `<li><strong>${s.nom}</strong> : ${s.avant}\u202f% → ${s.apres}\u202f% (${signePoints(s.delta)}).</li>`)
        .join("")}</ul>
    </section>
  </article>`;
}

function montrerEtape(cadre: HTMLElement, etape: EtapeRetour, toutAfficher = false): void {
  const ordre: EtapeRetour[] = ["engagement", "tampon", "impact", "consequence"];
  const index = ordre.indexOf(etape);
  const retour = cadre.querySelector<HTMLElement>(".tunnel__retour");
  retour?.setAttribute("data-retour-courant", etape);
  for (const noeud of cadre.querySelectorAll<HTMLElement>("[data-retour-etape]")) {
    const position = ordre.indexOf(noeud.dataset.retourEtape as EtapeRetour);
    noeud.hidden = !toutAfficher && position > index;
  }
}

/**
 * Joue un seul retour entre deux cartes. Les gestes précédents deviennent
 * inertes avant d'être remplacés, et le contrôleur reste le gardien du second
 * clic éventuel.
 */
export function jouerRetour(
  cadre: HTMLElement,
  impact: ImpactDecision,
  terminer: () => void,
  horloge: HorlogeRetour = horlogeNavigateur,
): () => void {
  const reduire = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const actions = [...cadre.querySelectorAll<HTMLElement>("[data-geste], [data-action], [data-engagement], [data-telex]")];
  for (const action of actions) {
    action.setAttribute("inert", "");
  }
  cadre.setAttribute("aria-busy", "true");
  cadre.innerHTML = renduImpact(impact);
  const retour = cadre.querySelector<HTMLElement>(".tunnel__retour");
  const minuteurs: unknown[] = [];
  let clos = false;
  const nettoyer = () => {
    for (const action of actions) action.removeAttribute("inert");
    cadre.removeAttribute("aria-busy");
  };
  const clore = (rendreLaMain: boolean) => {
    if (clos) return;
    clos = true;
    for (const minuteur of minuteurs) horloge.annuler(minuteur);
    nettoyer();
    if (rendreLaMain) terminer();
  };
  const finir = () => {
    clore(true);
  };
  const programmer = (callback: () => void, delai: number) => {
    minuteurs.push(horloge.programmer(callback, delai));
  };
  if (reduire) {
    montrerEtape(cadre, "consequence", true);
    retour?.focus();
    programmer(finir, chronologieRetour(true)[0].a);
    return () => clore(false);
  }
  for (const moment of chronologieRetour()) {
    if (moment.etape === "terminer") {
      programmer(finir, moment.a);
    } else if (moment.a === 0) {
      montrerEtape(cadre, moment.etape);
    } else {
      programmer(() => montrerEtape(cadre, moment.etape as EtapeRetour), moment.a);
    }
  }
  return () => clore(false);
}
