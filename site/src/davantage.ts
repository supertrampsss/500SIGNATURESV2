/**
 * « Davantage de données » : la suite du panneau de la fiche, pas un mur à part.
 *
 * `#detail` montrait les deux cent quatre indicateurs publiés d'un territoire,
 * vingt-deux thèmes confondus, en tableaux bruts sous des onglets de rubrique.
 * C'était exhaustif et illisible : aucune couleur, aucune phrase, un tableau
 * de finances locales à soixante-huit lignes ouvert par défaut. Ce module ne
 * retire rien du site — la page ANALYSES garde l'exhaustivité, thème par
 * thème, colonne par exercice — il choisit onze thèmes, les met en couleur et
 * les explique comme un chapitre de BILAN : une affirmation, puis la preuve.
 *
 * **Onze thèmes gardés, dix blocs rendus.** Salariés par secteur et
 * Établissements par secteur ne sont plus deux tableaux côte à côte : un seul
 * bloc, un ratio calculé par secteur. Finances locales et Impôts locaux ne
 * sont pas repris ici — la note de gestion et les blocs « Ce qu'elle encaisse
 * / Ce qu'elle dépense », juste au-dessus dans le même panneau, portent déjà
 * cette matière.
 *
 * **Aucune couleur décorative.** Un rail de couleur sur chaque carte ne dit
 * rien — c'est la teinte qui décore, jamais la donnée. La couleur ne vit ici
 * que dans le remplissage des barres de magnitude, où elle porte la mesure.
 *
 * **Aucun repli, aucun bouton.** Le lecteur qui vient de lire « Les communes
 * semblables » continue de faire défiler le même panneau ; il n'y a rien à
 * déplier.
 */

import { valeurLisible } from "./analyses.ts";
import type { Indicateur, SubventionsCommune, Territoire } from "./donnees.ts";
import { pourcentage } from "./echelle.ts";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un montant nommé, association par association : un contrat de plusieurs
 *  millions et une subvention de trois cents euros ne se lisent pas à la même
 *  échelle. `montantLisible`/`millions` divisent toujours par un million — la
 *  bonne échelle pour un budget, la mauvaise pour un versement individuel. */
function euros(valeur: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(valeur);
}

type Ligne = { id: string; libelle: string; unite: string; exercice: string; brut: number; texte: string };

/** La dernière valeur publiée de chaque indicateur, une ligne par indicateur
 *  qui a au moins un exercice renseigné pour ce territoire. */
function dernieresValeurs(territoire: Territoire, indicateurs: Indicateur[]): Ligne[] {
  const lignes: Ligne[] = [];
  for (const indicateur of indicateurs) {
    const serie = territoire.series[indicateur.id];
    if (!serie) continue;
    const periodes = Object.keys(serie)
      .filter((p) => typeof serie[p] === "number" && Number.isFinite(serie[p]))
      .sort();
    if (!periodes.length) continue;
    const exercice = periodes[periodes.length - 1];
    const brut = serie[exercice];
    lignes.push({
      id: indicateur.id,
      libelle: indicateur.libelle,
      unite: indicateur.unite,
      exercice,
      brut,
      texte: valeurLisible(brut, indicateur.unite),
    });
  }
  return lignes;
}

function barresMagnitude(lignes: Ligne[], accent: string): string {
  if (!lignes.length) return "";
  const triees = [...lignes].sort((a, b) => b.brut - a.brut);
  const max = triees[0].brut || 1;
  return `<div class="davantage__mag" style="--accent:${accent}">${triees
    .map(
      (l) =>
        `<div class="davantage__rang"><span class="davantage__etiq">${echapper(
          l.libelle,
        )}</span><span class="davantage__piste"><span style="width:${Math.max(
          0,
          Math.min(100, (l.brut / max) * 100),
        ).toFixed(1)}%"></span></span><span class="davantage__val">${echapper(l.texte)}</span></div>`,
    )
    .join("")}</div>`;
}

function cartesChiffres(lignes: Ligne[]): string {
  if (!lignes.length) return "";
  return `<div class="davantage__cartes">${lignes
    .map(
      (l) =>
        `<div class="davantage__carte"><span class="davantage__v">${echapper(
          l.texte,
        )}</span><span class="davantage__l">${echapper(l.libelle)}</span><span class="davantage__e">${echapper(
          l.exercice,
        )}</span></div>`,
    )
    .join("")}</div>`;
}

function section(id: string, libelle: string, corps: string, source: string): string {
  if (!corps) return "";
  return `<section class="davantage__theme" id="davantage-${echapper(id)}">
    <h3>${echapper(libelle)}</h3>
    ${corps}
    <p class="davantage__source">${source}</p>
  </section>`;
}

/** Un thème générique : les indicateurs `count` en barres, les `EUR` et le
 *  reste en cartes, les `percent` en note — jamais mélangés dans un même
 *  graphique, une magnitude ne comparant que des grandeurs de même nature. */
function themeGenerique(
  id: string,
  libelle: string,
  accent: string,
  indicateurs: Indicateur[],
  territoire: Territoire,
  phrase: (lignes: Ligne[]) => string,
  source: string,
): string {
  const lignes = dernieresValeurs(
    territoire,
    indicateurs.filter((i) => i.theme === id),
  );
  if (!lignes.length) return "";
  const comptes = lignes.filter((l) => l.unite === "count");
  const monetaires = lignes.filter((l) => l.unite === "EUR");
  const pourcentages = lignes.filter((l) => l.unite === "percent");
  const autres = lignes.filter((l) => !["count", "EUR", "percent"].includes(l.unite));
  const corps = [
    barresMagnitude(comptes, accent),
    cartesChiffres([...monetaires, ...autres]),
    pourcentages
      .map((l) => `<p class="davantage__note">${echapper(l.libelle)} : ${echapper(l.texte)} (${echapper(l.exercice)}).</p>`)
      .join(""),
  ].join("");
  return section(id, libelle, `<p class="davantage__affirmation">${phrase(lignes)}</p>${corps}`, source);
}

function tete(lignes: Ligne[], unite: string): Ligne | null {
  const filtrees = lignes.filter((l) => l.unite === unite);
  if (!filtrees.length) return null;
  return [...filtrees].sort((a, b) => b.brut - a.brut)[0];
}

const THEMES_GENERIQUES = [
  {
    id: "population",
    libelle: "Population",
    accent: "var(--serie-1)",
    source: "Source : INSEE, état civil et recensement de la population.",
    phrase: (lignes: Ligne[], nom: string) => {
      const municipale = lignes.find((l) => l.id === "insee_population_municipale");
      if (municipale) return `${echapper(nom)} compte ${echapper(municipale.texte)} habitants en ${echapper(municipale.exercice)}.`;
      const t = tete(lignes, "count");
      return t ? `${echapper(t.libelle)} : ${echapper(t.texte)} en ${echapper(t.exercice)}.` : "";
    },
  },
  {
    id: "revenus",
    libelle: "Revenus et pauvreté",
    accent: "var(--serie-3)",
    source: "Source : DGFiP (revenus), CAF (prestations).",
    phrase: (lignes: Ligne[], nom: string) => {
      const foyers = lignes.find((l) => l.id === "dgfip_ircom_foyers_fiscaux");
      const reference = lignes.find((l) => l.id === "dgfip_ircom_revenu_fiscal_reference");
      if (foyers && reference) {
        return `${echapper(foyers.texte)} foyers fiscaux à ${echapper(nom)}, pour un revenu fiscal de référence de ${echapper(reference.texte)} en ${echapper(reference.exercice)}.`;
      }
      const t = tete(lignes, "count") ?? tete(lignes, "EUR");
      return t ? `${echapper(t.libelle)} : ${echapper(t.texte)} en ${echapper(t.exercice)}.` : "";
    },
  },
  {
    id: "diplomes",
    libelle: "Diplômes de la population",
    accent: "var(--serie-1)",
    source: "Source : INSEE, recensement de la population.",
    phrase: (lignes: Ligne[]) => {
      const t = tete(lignes, "count");
      return t ? `<b>${echapper(t.libelle)}</b> est le diplôme le plus courant : ${echapper(t.texte)} personnes en ${echapper(t.exercice)}.` : "";
    },
  },
  {
    id: "emploi",
    libelle: "Emploi et chômage",
    accent: "var(--serie-2)",
    source: "Source : INSEE (recensement), DARES (France Travail).",
    phrase: (lignes: Ligne[]) => {
      const actifs = lignes.find((l) => l.id === "insee_actifs_occupes");
      const chomeurs = lignes.find((l) => l.id === "insee_chomeurs_rp");
      if (actifs && chomeurs) {
        return `${echapper(actifs.texte)} personnes ont un emploi, ${echapper(chomeurs.texte)} sont au chômage, en ${echapper(actifs.exercice)}.`;
      }
      const t = tete(lignes, "count");
      return t ? `${echapper(t.libelle)} : ${echapper(t.texte)} en ${echapper(t.exercice)}.` : "";
    },
  },
  {
    id: "professions",
    libelle: "Professions et catégories sociales",
    accent: "var(--serie-4)",
    source: "Source : INSEE, recensement de la population.",
    phrase: (lignes: Ligne[]) => {
      const t = tete(lignes, "count");
      return t ? `<b>${echapper(t.libelle)}</b> est la catégorie la plus représentée : ${echapper(t.texte)} personnes en ${echapper(t.exercice)}.` : "";
    },
  },
  {
    id: "tourisme",
    libelle: "Hébergement touristique",
    accent: "var(--serie-3)",
    source: "Source : INSEE, fréquentation et capacité touristique.",
    phrase: (lignes: Ligne[]) => {
      const t = tete(lignes, "count");
      return t ? `<b>${echapper(t.libelle)}</b> est la première capacité d'accueil : ${echapper(t.texte)} en ${echapper(t.exercice)}.` : "";
    },
  },
];

/** Logement : cinq des quatorze indicateurs publiés — le stock total, le
 *  partage résidence principale / secondaire, le logement social, le loyer
 *  d'appartement. Les neuf autres (permis, mises en chantier, vacance,
 *  étiquette énergie, loyer des maisons, occupants à titre gratuit) ne sont
 *  pas repris : une carte de cinq chiffres se lit, une carte de quatorze ne se
 *  lit plus. */
const LOGEMENT_RETENUS = [
  "insee_logements",
  "insee_residences_principales",
  "insee_residences_secondaires",
  "rpls_logements_sociaux",
  "anil_loyer_appartement",
];

function themeLogement(indicateurs: Indicateur[], territoire: Territoire): string {
  const retenus = indicateurs.filter((i) => LOGEMENT_RETENUS.includes(i.id));
  const lignes = dernieresValeurs(territoire, retenus);
  if (!lignes.length) return "";
  const ordre = new Map(LOGEMENT_RETENUS.map((id, i) => [id, i]));
  lignes.sort((a, b) => (ordre.get(a.id) ?? 99) - (ordre.get(b.id) ?? 99));
  const principales = lignes.find((l) => l.id === "insee_residences_principales");
  const secondaires = lignes.find((l) => l.id === "insee_residences_secondaires");
  let phrase = "";
  if (principales && secondaires && principales.exercice === secondaires.exercice) {
    const total = principales.brut + secondaires.brut;
    const part = total > 0 ? (secondaires.brut / total) * 100 : 0;
    phrase = `${echapper(pourcentage(part))} des logements sont des résidences secondaires (${echapper(
      secondaires.texte,
    )} sur ${echapper(valeurLisible(total, "count"))}), en ${echapper(principales.exercice)}.`;
  } else {
    const t = lignes[0];
    phrase = `${echapper(t.libelle)} : ${echapper(t.texte)} en ${echapper(t.exercice)}.`;
  }
  return section(
    "logement",
    "Logement",
    `<p class="davantage__affirmation">${phrase}</p>${cartesChiffres(lignes)}`,
    "Source : INSEE (logements), répertoire des bailleurs (social), DVF/LOVAC (loyers). 9 des 14 indicateurs publiés ne sont pas repris ici.",
  );
}

/** Salariés par secteur et établissements par secteur disaient la même chose
 *  deux fois. Rapportés l'un à l'autre : combien de salariés pour un
 *  établissement, secteur par secteur. */
const SECTEURS = [
  {
    libelle: "Administration, enseignement, santé et action sociale",
    salaries: "insee_effectifs_salaries_administration_sante_social",
    etablissements: "insee_etablissements_employeurs_administration_sante_social",
  },
  {
    libelle: "Agriculture, sylviculture et pêche",
    salaries: "insee_effectifs_salaries_agriculture",
    etablissements: "insee_etablissements_employeurs_agriculture",
  },
  { libelle: "Construction", salaries: "insee_effectifs_salaries_construction", etablissements: "insee_etablissements_employeurs_construction" },
  { libelle: "Industrie", salaries: "insee_effectifs_salaries_industrie", etablissements: "insee_etablissements_employeurs_industrie" },
  {
    libelle: "Services principalement marchands",
    salaries: "insee_effectifs_salaries_services_marchands",
    etablissements: "insee_etablissements_employeurs_services_marchands",
  },
];

function formaterRatio(valeur: number): string {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valeur);
}

function themeSecteurs(territoire: Territoire): string {
  const lignes = SECTEURS.map(({ libelle, salaries, etablissements }) => {
    const sSal = territoire.series[salaries];
    const sEtab = territoire.series[etablissements];
    if (!sSal || !sEtab) return null;
    const periodes = Object.keys(sSal)
      .filter((p) => typeof sSal[p] === "number" && typeof sEtab[p] === "number" && (sEtab[p] as number) > 0)
      .sort();
    if (!periodes.length) return null;
    const exercice = periodes[periodes.length - 1];
    const ratio = (sSal[exercice] as number) / (sEtab[exercice] as number);
    return { libelle, exercice, ratio };
  }).filter((l): l is { libelle: string; exercice: string; ratio: number } => l !== null);
  if (!lignes.length) return "";
  const triees = [...lignes].sort((a, b) => b.ratio - a.ratio);
  const max = triees[0].ratio || 1;
  const barres = `<div class="davantage__mag" style="--accent:var(--serie-5)">${triees
    .map(
      (l) =>
        `<div class="davantage__rang"><span class="davantage__etiq">${echapper(
          l.libelle,
        )}</span><span class="davantage__piste"><span style="width:${Math.max(0, Math.min(100, (l.ratio / max) * 100)).toFixed(
          1,
        )}%"></span></span><span class="davantage__val">${echapper(formaterRatio(l.ratio))}</span></div>`,
    )
    .join("")}</div>`;
  const t = triees[0];
  const phrase = `<b>${echapper(t.libelle)}</b> compte le plus de salariés pour un établissement : ${echapper(
    formaterRatio(t.ratio),
  )} en ${echapper(t.exercice)}.`;
  return section(
    "secteurs",
    "Salariés par établissement, secteur par secteur",
    `<p class="davantage__affirmation">${phrase}</p>${barres}`,
    "Source : INSEE, CLAP/Flores. Salariés pour un établissement = salariés du secteur ÷ établissements du secteur.",
  );
}

/** Sécurité : les seuls taux (pour mille habitants ou logements), et
 *  seulement les catégories qui ont une valeur au dernier exercice publié —
 *  les décomptes bruts, qui doublent chaque taux sans rien ajouter, et les
 *  catégories que la source ne met plus à jour, ne sont pas repris. */
function themeSecurite(indicateurs: Indicateur[], territoire: Territoire): string {
  const taux = indicateurs.filter(
    (i) => i.theme === "securite" && (i.unite === "pour_1000_habitants" || i.unite === "pour_1000_logements"),
  );
  if (!taux.length) return "";
  let dernier = "";
  for (const i of taux) {
    const serie = territoire.series[i.id];
    if (!serie) continue;
    for (const periode of Object.keys(serie)) {
      if (typeof serie[periode] === "number" && Number.isFinite(serie[periode]) && periode > dernier) dernier = periode;
    }
  }
  if (!dernier) return "";
  const lignes: Ligne[] = [];
  for (const i of taux) {
    const valeur = territoire.series[i.id]?.[dernier];
    if (typeof valeur !== "number" || !Number.isFinite(valeur)) continue;
    lignes.push({ id: i.id, libelle: i.libelle, unite: i.unite, exercice: dernier, brut: valeur, texte: valeurLisible(valeur, i.unite) });
  }
  if (!lignes.length) return "";
  const triees = [...lignes].sort((a, b) => b.brut - a.brut);
  const phrase = `<b>${echapper(triees[0].libelle)}</b> est la catégorie la plus fréquente en ${echapper(dernier)} : ${echapper(
    triees[0].texte,
  )}.`;
  return section(
    "securite",
    "Sécurité",
    `<p class="davantage__affirmation">${phrase}</p>${barresMagnitude(lignes, "var(--serie-7)")}`,
    "Source : SSMSI, taux pour 1 000 habitants (sauf cambriolages, pour 1 000 logements). Décomptes bruts et catégories sans valeur au dernier exercice non repris.",
  );
}

/** Vie associative : le nom et le montant de chaque association subventionnée
 *  par l'État, pas seulement leur total. La liste nominative vit dans un
 *  fichier à part (`donnees.subventions`, publié par département) ; en son
 *  absence — département non chargé, ou aucune association identifiée — le
 *  thème garde son seul agrégat plutôt que de ne rien afficher. */
function themeVieAssociative(
  indicateurs: Indicateur[],
  territoire: Territoire,
  nom: string,
  associations: SubventionsCommune | undefined,
): string {
  const lignes = dernieresValeurs(
    territoire,
    indicateurs.filter((i) => i.theme === "vie_associative"),
  );
  if (!lignes.length) return "";
  const beneficiaires = associations?.beneficiaires ?? [];
  if (beneficiaires.length) {
    const exercice = associations!.exercice;
    const phrase =
      beneficiaires.length === 1
        ? `Une association subventionnée par l'État à ${echapper(nom)} en ${echapper(exercice)}.`
        : `${beneficiaires.length} associations subventionnées par l'État à ${echapper(nom)} en ${echapper(exercice)}, pour ${echapper(
            euros(beneficiaires.reduce((s, b) => s + b.montant, 0)),
          )} au total.`;
    const liste = `<div class="davantage__associations">${beneficiaires
      .map(
        (b) =>
          `<div class="davantage__assoc"><span class="davantage__nom">${echapper(b.nom)}</span><span class="davantage__montant">${echapper(
            euros(b.montant),
          )}</span>${b.objet ? `<span class="davantage__objet">${echapper(b.objet)}</span>` : ""}</div>`,
      )
      .join("")}</div>`;
    return section(
      "vie-associative",
      "Vie associative",
      `<p class="davantage__affirmation">${phrase}</p>${liste}`,
      "Source : jaune budgétaire, effort financier de l'État en faveur des associations.",
    );
  }
  const compte = lignes.find((l) => l.id === "etat_subventions_associations_etablissements");
  const phrase = compte
    ? `${echapper(compte.texte)} établissement${compte.brut > 1 ? "s" : ""} associatif${compte.brut > 1 ? "s" : ""} subventionné${
        compte.brut > 1 ? "s" : ""
      } par l'État à ${echapper(nom)} en ${echapper(compte.exercice)}.`
    : "";
  return section(
    "vie-associative",
    "Vie associative",
    `${phrase ? `<p class="davantage__affirmation">${phrase}</p>` : ""}${cartesChiffres(lignes)}`,
    "Source : jaune budgétaire, effort financier de l'État en faveur des associations.",
  );
}

/**
 * La suite du panneau : onze thèmes gardés, rendus en dix blocs, dans l'ordre
 * où ils sont écrits ici. Un thème dont ce territoire ne publie aucune valeur
 * ne rend rien — jamais un bloc vide.
 */
function rendreGenerique(id: string, indicateurs: Indicateur[], territoire: Territoire): string {
  const t = THEMES_GENERIQUES.find((t) => t.id === id);
  if (!t) return "";
  return themeGenerique(t.id, t.libelle, t.accent, indicateurs, territoire, (lignes) => t.phrase(lignes, territoire.nom), t.source);
}

export function rendu(
  territoire: Territoire,
  indicateurs: Indicateur[],
  associations: SubventionsCommune | undefined,
): string {
  const blocs = [
    themeVieAssociative(indicateurs, territoire, territoire.nom, associations),
    rendreGenerique("population", indicateurs, territoire),
    rendreGenerique("revenus", indicateurs, territoire),
    rendreGenerique("diplomes", indicateurs, territoire),
    rendreGenerique("emploi", indicateurs, territoire),
    rendreGenerique("professions", indicateurs, territoire),
    themeSecteurs(territoire),
    themeLogement(indicateurs, territoire),
    themeSecurite(indicateurs, territoire),
    rendreGenerique("tourisme", indicateurs, territoire),
  ].filter(Boolean);
  if (!blocs.length) return "";
  return `<div class="davantage">${blocs.join("")}</div>`;
}

export function afficher(
  cible: HTMLElement,
  territoire: Territoire,
  indicateurs: Indicateur[],
  associations: SubventionsCommune | undefined,
): void {
  cible.innerHTML = rendu(territoire, indicateurs, associations);
}
