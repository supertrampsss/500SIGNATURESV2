import { echapper } from "./texte.ts";

export const STATUTS = ["salarié", "fonctionnaire", "indépendant", "retraité"] as const;
export type Statut = (typeof STATUTS)[number];

type Taux = {
  /** Part estimée du montant reçu correspondant aux cotisations salariales. */
  cotisationsSalariales: number;
  /** Part estimée du montant reçu correspondant à l'impôt sur le revenu. */
  impot: number;
  /** Part estimée du montant reçu correspondant aux cotisations employeur. */
  cotisationsEmployeur: number;
};

/**
 * Ordres de grandeur éditoriaux, séparés par statut.
 *
 * Le montant saisi est le revenu qui arrive sur le compte. Ces coefficients ne
 * remplacent pas une fiche de paie individuelle : la page affiche donc
 * explicitement « estimation » et renvoie vers les sources officielles. Leur
 * intérêt est de rendre visible l'écart net/coût total, comme le parcours
 * public de référence, sans prétendre calculer une situation personnelle.
 */
const TAUX: Record<Statut, Taux> = {
  salarié: { cotisationsSalariales: 0.281, impot: 0.071, cotisationsEmployeur: 0.5428 },
  fonctionnaire: { cotisationsSalariales: 0.205, impot: 0.071, cotisationsEmployeur: 0.365 },
  indépendant: { cotisationsSalariales: 0.235, impot: 0.071, cotisationsEmployeur: 0.434 },
  retraité: { cotisationsSalariales: 0.061, impot: 0.071, cotisationsEmployeur: 0.0 },
};

export type CalculSalaire = {
  net: number;
  cotisationsSalariales: number;
  impot: number;
  cotisationsEmployeur: number;
  coutTotal: number;
};

const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formaterSalaire(valeur: number): string {
  return `${entier.format(Math.max(0, Math.round(valeur)))} €`;
}

export function calculerSalaire(net: number, statut: Statut): CalculSalaire {
  const montant = Number.isFinite(net) ? Math.max(0, net) : 0;
  const taux = TAUX[statut];
  const cotisationsSalariales = montant * taux.cotisationsSalariales;
  const impot = montant * taux.impot;
  const cotisationsEmployeur = montant * taux.cotisationsEmployeur;
  return {
    net: montant,
    cotisationsSalariales,
    impot,
    cotisationsEmployeur,
    coutTotal: montant + cotisationsSalariales + impot + cotisationsEmployeur,
  };
}

function statutValide(value: string | null): Statut {
  return (STATUTS as readonly string[]).includes(value ?? "") ? (value as Statut) : "salarié";
}

function montantDepuisChamp(value: string | null): number {
  const normalise = (value ?? "").replace(/\s/g, "").replace(",", ".");
  const montant = Number(normalise);
  return Number.isFinite(montant) ? Math.max(0, montant) : 0;
}

function libelleStatut(statut: Statut): string {
  return statut.charAt(0).toUpperCase() + statut.slice(1);
}

export function renduSalaires(net = 2100, statut: Statut = "salarié"): string {
  const calcul = calculerSalaire(net, statut);
  const boutons = STATUTS.map(
    (option) => `<button type="button" class="salaires__statut" data-statut="${option}" aria-pressed="${option === statut}">${libelleStatut(option)}</button>`,
  ).join("");
  return `<section class="salaires" id="salaires-contenu">
    <p class="salaires__eyebrow">Salaires</p>
    <h1>Quel revenu arrive sur votre compte chaque mois&nbsp;?</h1>
    <p class="salaires__intro">Entrez un montant net pour voir ce qu'il représente avant prélèvements et comment les cotisations sont réparties.</p>
    <form class="salaires__form" id="salaires-form">
      <label class="salaires__montant"><span class="visuellement-cache">Revenu mensuel net</span><input id="salaires-net" name="net" inputmode="decimal" autocomplete="off" value="${echapper(formaterSalaire(net).replace(" €", ""))}" aria-describedby="salaires-aide"><b>€</b></label>
      <p class="salaires__aide" id="salaires-aide">Une estimation : le montant exact dépend de votre situation.</p>
      <div class="salaires__statuts" role="group" aria-label="Votre statut">${boutons}</div>
    </form>
    <section class="salaires__resultat" aria-live="polite" aria-labelledby="salaires-resultat-titre" data-salaires-statut="${statut}">
      <div class="salaires__total"><p class="salaires__eyebrow">Coût total estimé</p><h2 id="salaires-resultat-titre">${formaterSalaire(calcul.coutTotal)}</h2><p>pour ${libelleStatut(statut).toLowerCase()} recevant ${formaterSalaire(calcul.net)}</p></div>
      <dl class="salaires__ventilation">
        <div><dt>Revenu reçu</dt><dd data-salaires="net">${formaterSalaire(calcul.net)}</dd></div>
        <div><dt>Cotisations liées au revenu</dt><dd data-salaires="cotisationsSalariales">${formaterSalaire(calcul.cotisationsSalariales)}</dd></div>
        <div><dt>Impôt sur le revenu</dt><dd data-salaires="impot">${formaterSalaire(calcul.impot)}</dd></div>
        <div><dt>Cotisations employeur</dt><dd data-salaires="cotisationsEmployeur">${formaterSalaire(calcul.cotisationsEmployeur)}</dd></div>
      </dl>
    </section>
    <details class="salaires__detail"><summary>Voir le calcul</summary><p>Cette estimation sépare le revenu reçu, les cotisations et l'impôt. Elle sert à comprendre les ordres de grandeur, pas à établir une fiche de paie.</p><p class="salaires__sources"><a href="https://sarahknafo.fr/simulateur" rel="noreferrer">Voir le simulateur public de référence</a> · <a href="https://www.urssaf.fr/accueil/outils-documentation/simulateurs/cotisations-employeur.html" rel="noreferrer">Méthode Urssaf</a> · <a href="https://www.insee.fr/fr/statistiques/8376872?sommaire=8376908" rel="noreferrer">Salaires Insee</a></p></details>
    <section class="salaires__allocation"><p class="salaires__eyebrow">À quoi servent les prélèvements&nbsp;?</p><h2>Les protections et services financés</h2><ul><li><span>Santé</span><b>protection et soins</b></li><li><span>Retraite</span><b>pensions et droits futurs</b></li><li><span>Chômage</span><b>assurance en cas de perte d'emploi</b></li><li><span>Famille et services publics</span><b>prestations et fonctionnement collectif</b></li></ul></section>
  </section>`;
}

export function brancherSalaires(root: HTMLElement): void {
  const formulaire = root.querySelector<HTMLFormElement>("#salaires-form");
  const resultat = root.querySelector<HTMLElement>("[data-salaires-statut]");
  const champ = root.querySelector<HTMLInputElement>("#salaires-net");
  if (!formulaire || !resultat || !champ) return;
  const afficher = (statut: Statut) => {
    const calcul = calculerSalaire(montantDepuisChamp(champ.value), statut);
    resultat.dataset.salairesStatut = statut;
    const titre = resultat.querySelector("h2");
    const sousTitre = resultat.querySelector(".salaires__total p:last-child");
    if (titre) titre.textContent = formaterSalaire(calcul.coutTotal);
    if (sousTitre) sousTitre.textContent = `pour ${libelleStatut(statut).toLowerCase()} recevant ${formaterSalaire(calcul.net)}`;
    for (const cle of ["net", "cotisationsSalariales", "impot", "cotisationsEmployeur"] as const) {
      const valeur = resultat.querySelector<HTMLElement>(`[data-salaires="${cle}"]`);
      if (valeur) valeur.textContent = formaterSalaire(calcul[cle]);
    }
    for (const bouton of root.querySelectorAll<HTMLButtonElement>(".salaires__statut")) {
      bouton.setAttribute("aria-pressed", String(bouton.dataset.statut === statut));
    }
  };
  formulaire.addEventListener("submit", (event) => event.preventDefault());
  formulaire.addEventListener("input", () => afficher(statutValide(resultat.dataset.salairesStatut ?? null)));
  formulaire.addEventListener("click", (event) => {
    const bouton = (event.target as HTMLElement).closest<HTMLButtonElement>(".salaires__statut");
    if (bouton) afficher(statutValide(bouton.dataset.statut ?? null));
  });
}
