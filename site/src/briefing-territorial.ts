import type { Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";
import { adresseTerritoire } from "./routes.ts";

export type ChiffreBriefing = {
  id: string;
  libelle: string;
  valeur: string;
  comparaison?: string;
};

export type BriefingTerritorial = {
  diagnostic: string;
  chiffres: ChiffreBriefing[];
  groupe: string;
  exercice: string;
  code: string;
  niveau: string;
  /** Le territoire courant puis un pair réellement comparable. */
  comparer: string[];
};

export type EntreeBriefing = {
  territoire: Territoire;
  exercice: string;
  code: string;
  niveau: string;
  comparer: readonly string[];
  chiffres: readonly {
    id: string;
    libelle: string;
    unite: string;
    valeur: number;
    comparaison?: string;
  }[];
  diagnostic: string;
  groupe: string;
};

const PRIORITES = [
  "ofgl_recettes_fonctionnement",
  "ofgl_depenses_fonctionnement",
  "ofgl_encours_dette",
  "ofgl_epargne_brute",
];

function phrase(texte: string): string {
  const nettoye = texte.trim();
  return /[.!?…]$/u.test(nettoye) ? nettoye : `${nettoye}.`;
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (caractere) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        caractere
      ] as string,
  );
}

export function briefingTerritorial(entree: EntreeBriefing): BriefingTerritorial {
  const chiffres = PRIORITES.flatMap((id) => {
    const chiffre = entree.chiffres.find((candidat) => candidat.id === id);
    if (!chiffre || !Number.isFinite(chiffre.valeur)) return [];
    return [{
      id: chiffre.id,
      libelle: chiffre.libelle,
      valeur: formater(chiffre.valeur, chiffre.unite, false, chiffre.id),
      ...(chiffre.comparaison === undefined ? {} : { comparaison: chiffre.comparaison }),
    }];
  });
  return {
    diagnostic: phrase(entree.diagnostic),
    chiffres,
    groupe: entree.groupe,
    exercice: entree.exercice,
    code: entree.code,
    niveau: entree.niveau,
    comparer: [...entree.comparer],
  };
}

export function renduBriefing(briefing: BriefingTerritorial, territoire: Territoire): string {
  const comparaison = briefing.niveau === "pays"
    ? { href: "/bilan#france-verdict", libelle: "Comparer la France" }
    : briefing.comparer.length >= 2
      ? {
          href: `${adresseTerritoire(briefing.code, briefing.niveau)}&comparer=${encodeURIComponent(
            briefing.comparer.join(","),
          )}`,
          libelle: "Comparer",
        }
      : null;
  const chiffres = briefing.chiffres
    .map(
      (chiffre) => `<div>
        <dt>${echapper(chiffre.libelle)}</dt>
        <dd>${echapper(chiffre.valeur)}${
          chiffre.comparaison === undefined ? "" : ` <span>${echapper(chiffre.comparaison)}</span>`
        }</dd>
      </div>`,
    )
    .join("");
  return `<section class="briefing-territorial">
    <header>
      <h2>Briefing de ${echapper(territoire.nom)}</h2>
      <p>${echapper(briefing.diagnostic)}</p>
      <p>Territoires comparables : ${echapper(briefing.groupe)}</p>
    </header>
    <dl>${chiffres}</dl>
    <p>Exercice ${echapper(briefing.exercice)}</p>
    <p class="briefing-territorial__actions">
      ${comparaison ? `<a href="${echapper(comparaison.href)}">${comparaison.libelle}</a>` : ""}
      <span>Le simulateur porte sur le budget national.</span>
      <a href="/simulateur">Simuler le budget national</a>
    </p>
  </section>`;
}

export type ThemeTerritorial = "budget" | "fiscalite" | "dette" | "services" | "trajectoire";

const THEMES_TERRITORIAUX = new Set<ThemeTerritorial>([
  "budget",
  "fiscalite",
  "dette",
  "services",
  "trajectoire",
]);

function estThemeTerritorial(theme: string | undefined): theme is ThemeTerritorial {
  return theme !== undefined && THEMES_TERRITORIAUX.has(theme as ThemeTerritorial);
}

/** Un raccourci qui ne mène à rien ne reste pas au clavier. Les cibles sont
 * aussi rendues focalisables afin que le lien soit une arrivée, pas seulement
 * un défilement qui laisse le lecteur perdu dans la page. */
export function synchroniserThemesTerritoriaux(
  actions: Iterable<HTMLButtonElement>,
  cibles: Partial<Record<ThemeTerritorial, HTMLElement>>,
): void {
  for (const action of actions) {
    const cible = estThemeTerritorial(action.dataset.territoireTheme)
      ? cibles[action.dataset.territoireTheme]
      : undefined;
    action.hidden = !cible;
    action.disabled = !cible;
    if (!cible) continue;
    cible.dataset.territoireSection = action.dataset.territoireTheme;
    cible.tabIndex = -1;
  }
}

export function naviguerVersThemeTerritorial(
  theme: string,
  cibles: Partial<Record<ThemeTerritorial, HTMLElement>>,
  mouvementReduit: boolean,
): boolean {
  const cible = estThemeTerritorial(theme) ? cibles[theme] : undefined;
  if (!cible) return false;
  cible.scrollIntoView({ block: "start", behavior: mouvementReduit ? "auto" : "smooth" });
  cible.focus({ preventScroll: true });
  return true;
}
