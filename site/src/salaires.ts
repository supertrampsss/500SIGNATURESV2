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

function montantDepuisChamp(value: string): number | null {
  const normalise = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalise)) return null;
  const montant = Number(normalise);
  return Number.isFinite(montant) && montant <= 1_000_000 ? montant : null;
}

function libelleStatut(statut: Statut): string {
  return statut.charAt(0).toUpperCase() + statut.slice(1);
}

const LIGNES = [
  ["net", "Revenu reçu"],
  ["cotisationsSalariales", "Cotisations liées au revenu"],
  ["impot", "Impôt sur le revenu"],
  ["cotisationsEmployeur", "Cotisations employeur"],
] as const;

function libelleLigne(cle: string, statut: Statut, defaut: string): string {
  if (cle === "cotisationsEmployeur" && statut === "indépendant") return "Autres cotisations du modèle";
  return defaut;
}

function coefficients(statut: Statut): string {
  const taux = TAUX[statut];
  return `Cotisations liées au revenu : × ${taux.cotisationsSalariales.toLocaleString("fr-FR")}. Impôt : × ${taux.impot.toLocaleString("fr-FR")}. ${statut === "indépendant" ? "Autres cotisations" : "Cotisations employeur"} : × ${taux.cotisationsEmployeur.toLocaleString("fr-FR")}.`;
}

export function renduSalaires(net = 2100, statut: Statut = "salarié"): string {
  const calcul = calculerSalaire(net, statut);
  return `<section class="salaires" id="salaires-contenu">
    <header class="salaires__entree"><p class="salaires__eyebrow">Salaires & revenus</p>
    <h1>Votre revenu,<br> décomposé.</h1>
    <p class="salaires__intro">Explorez le poids des prélèvements avec un modèle pédagogique simplifié.</p></header>
    <div class="salaires__atelier">
    <form class="salaires__form" id="salaires-form">
      <div class="salaires__statuts" role="group" aria-label="Votre statut">${STATUTS.map(option => `<button type="button" class="salaires__statut" data-statut="${option}" aria-pressed="${option === statut}">${libelleStatut(option)}</button>`).join("")}</div>
      <label for="salaires-net" class="salaires__label">Votre revenu net mensuel</label>
      <div class="salaires__montant"><input id="salaires-net" name="net" inputmode="decimal" autocomplete="off" maxlength="14" value="${echapper(formaterSalaire(net).replace(" €", ""))}" aria-describedby="salaires-aide salaires-erreur"><span aria-hidden="true">€</span><small>/ mois</small></div>
      <p class="salaires__aide" id="salaires-aide">Le montant qui arrive sur votre compte.</p>
      <p id="salaires-erreur" class="salaires__erreur" role="status" hidden></p>
      <div class="salaires__reserve"><strong>Une illustration, pas votre fiche de paie.</strong></div>
    </form>
    <section class="salaires__resultat" aria-labelledby="salaires-resultat-label" data-salaires-statut="${statut}">
      <div class="salaires__total"><p id="salaires-resultat-label">Montant total illustratif</p><h2 id="salaires-resultat-titre">${formaterSalaire(calcul.coutTotal)}</h2><p>par mois · ${libelleStatut(statut).toLowerCase()}</p></div>
      <div class="salaires__barre" aria-hidden="true">${LIGNES.map(([cle],i)=>`<span class="salaires__segment salaires__segment--${i}" data-segment="${cle}" style="width:${calcul.coutTotal ? calcul[cle]/calcul.coutTotal*100 : 0}%"></span>`).join("")}</div>
      <dl class="salaires__ventilation">${LIGNES.map(([cle,label],i)=>`<div><dt><i class="salaires__cle salaires__segment--${i}" aria-hidden="true"></i><span data-label="${cle}">${libelleLigne(cle,statut,label)}</span></dt><dd data-salaires="${cle}">${formaterSalaire(calcul[cle])}</dd></div>`).join("")}</dl>
      <p class="visuellement-cache" id="salaires-annonce" role="status"></p>
    </section></div>
    <details class="salaires__detail"><summary>Voir le calcul</summary><p>Chaque composante est calculée à partir du revenu saisi, puis additionnée. Les montants sont arrondis à l'euro à l'écran.</p><p data-coefficients>${coefficients(statut)}</p><p>Ces coefficients sont des hypothèses illustratives non calibrées sur un barème annuel. Ils ne constituent ni un calcul officiel ni une estimation personnalisée. Le modèle ne reconstitue pas un salaire brut.</p><p class="salaires__sources"><a href="https://www.urssaf.fr/accueil/outils-documentation/simulateurs.html" rel="noreferrer">Calculer une situation avec l'Urssaf</a> · <a href="https://www.insee.fr/fr/statistiques/8376872?sommaire=8376908" rel="noreferrer">Consulter les salaires observés par l'Insee</a></p></details>
    <section class="salaires__allocation"><header><p class="salaires__eyebrow">La contrepartie collective</p><h2>Des protections,<br> des services, des droits.</h2><p>Quelques missions financées collectivement. Cette liste ne ventile pas vos prélèvements personnels.</p></header><ul><li><span>Santé</span><b>Soins et protection</b></li><li><span>Retraite</span><b>Pensions et droits futurs</b></li><li><span>Chômage</span><b>Assurance en cas de perte d'emploi</b></li><li><span>Famille & services publics</span><b>Prestations et services collectifs</b></li></ul></section>
  </section>`;
}

export function brancherSalaires(root: HTMLElement): void {
  const formulaire = root.querySelector<HTMLFormElement>("#salaires-form");
  const resultat = root.querySelector<HTMLElement>("[data-salaires-statut]");
  const champ = root.querySelector<HTMLInputElement>("#salaires-net");
  const erreur = root.querySelector<HTMLElement>("#salaires-erreur");
  if (!formulaire || !resultat || !champ || !erreur) return;
  let selection = statutValide(resultat.dataset.salairesStatut ?? null);
  let annonce: ReturnType<typeof setTimeout>;
  const afficher = () => {
    for (const bouton of root.querySelectorAll<HTMLButtonElement>(".salaires__statut")) bouton.setAttribute("aria-pressed", String(bouton.dataset.statut === selection));
    const montant = montantDepuisChamp(champ.value);
    champ.setAttribute("aria-invalid", String(montant === null));
    erreur.hidden = montant !== null;
    erreur.textContent = montant === null ? "Saisissez un montant de 0 à 1 000 000 €, avec deux décimales au maximum. Le résultat précédent est conservé." : "";
    if (montant === null) return;
    const calcul = calculerSalaire(montant, selection);
    resultat.dataset.salairesStatut = selection;
    resultat.querySelector("h2")!.textContent = formaterSalaire(calcul.coutTotal);
    resultat.querySelector(".salaires__total p:last-child")!.textContent = `par mois · ${selection}`;
    for (const [cle,label] of LIGNES) {
      resultat.querySelector<HTMLElement>(`[data-salaires="${cle}"]`)!.textContent = formaterSalaire(calcul[cle]);
      resultat.querySelector<HTMLElement>(`[data-segment="${cle}"]`)!.style.width = `${calcul.coutTotal ? calcul[cle]/calcul.coutTotal*100 : 0}%`;
      resultat.querySelector<HTMLElement>(`[data-label="${cle}"]`)!.textContent = libelleLigne(cle,selection,label);
    }
    root.querySelector<HTMLElement>("[data-coefficients]")!.textContent = coefficients(selection);
    clearTimeout(annonce);
    annonce = setTimeout(() => { root.querySelector<HTMLElement>("#salaires-annonce")!.textContent = `Montant total illustratif : ${formaterSalaire(calcul.coutTotal)} par mois.`; }, 400);
  };
  formulaire.addEventListener("submit", event => event.preventDefault());
  formulaire.addEventListener("input", afficher);
  formulaire.addEventListener("click", event => {
    const bouton = (event.target as HTMLElement).closest<HTMLButtonElement>(".salaires__statut");
    if (bouton) { selection = statutValide(bouton.dataset.statut ?? null); afficher(); }
  });
}
