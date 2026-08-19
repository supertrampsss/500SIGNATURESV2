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
import { variation } from "./ouverture.ts";

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

function cartesChiffres(lignes: { texte: string; libelle: string; exercice: string }[]): string {
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

/** Une table à deux colonnes — l'indicateur, sa valeur — quand une liste se
 *  lit mieux en colonne qu'en barre : des comptes de personnes qui n'ont pas
 *  à se comparer en longueur les uns aux autres, juste à se lire un par un. */
function table(lignes: { libelle: string; valeur: string; exercice?: string }[]): string {
  if (!lignes.length) return "";
  return `<table class="davantage__table"><tbody>${lignes
    .map(
      (l) =>
        `<tr><td>${echapper(l.libelle)}</td><td class="davantage__num">${echapper(l.valeur)}</td>${
          l.exercice ? `<td class="davantage__exercice">${echapper(l.exercice)}</td>` : ""
        }</tr>`,
    )
    .join("")}</tbody></table>`;
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
    indicateurs.filter((i) => i.theme === id && !INDICATEURS_EXCLUS.has(i.id)),
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

/** Indicateurs exclus de tout rendu générique : un salaire mensuel moyen
 *  n'est pas une masse — passé par le même M€ que le reste, il s'arrondit à
 *  « 0,00 M€ » et n'apprend rien. Rendu à l'euro, il redirait ce que la carte
 *  affiche déjà (`indicateurCourant`, `formater`) sans y ajouter la
 *  comparaison entre communes que la carte, elle, permet. */
const INDICATEURS_EXCLUS = new Set(["insee_salaire_net_eqtp_mensuel"]);

const THEMES_GENERIQUES = [
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

/** Les trois tranches d'âge de la population, dans l'ordre où elles se lisent
 *  — la plus âgée d'abord, comme la barre de magnitude qu'elles remplaçaient
 *  triait déjà par valeur décroissante dans la plupart des communes. */
const AGES = [
  { id: "insee_population_55_ans_et_plus", libelle: "55 ans et plus" },
  { id: "insee_population_25_54_ans", libelle: "25 à 54 ans" },
  { id: "insee_population_15_24_ans", libelle: "15 à 24 ans" },
];

/** Population, Revenus et pauvreté, Diplômes : un seul bloc plutôt que trois,
 *  quatre chiffres de tête puis le détail en colonnes — jamais en barre, ces
 *  comptes de personnes n'ayant pas à se comparer en longueur les uns aux
 *  autres. Le revenu de tête est le revenu fiscal de référence PAR FOYER, pas
 *  le total : « 86,9 M€ » ne dit rien à qui vient lire un revenu, quand
 *  « 31 182 € par foyer » se compare à ce que le lecteur gagne lui-même. */
function themePopulationRevenusDiplomes(indicateurs: Indicateur[], territoire: Territoire, nom: string): string {
  const population = dernieresValeurs(territoire, indicateurs.filter((i) => i.theme === "population"));
  const revenus = dernieresValeurs(territoire, indicateurs.filter((i) => i.theme === "revenus"));
  const diplomes = dernieresValeurs(territoire, indicateurs.filter((i) => i.theme === "diplomes"));
  if (!population.length && !revenus.length && !diplomes.length) return "";

  const municipale = population.find((l) => l.id === "insee_population_municipale");
  const foyers = revenus.find((l) => l.id === "dgfip_ircom_foyers_fiscaux");
  const reference = revenus.find((l) => l.id === "dgfip_ircom_revenu_fiscal_reference");
  const diplomeTete = tete(diplomes, "count");

  const tetes: { valeur: string; libelle: string; exercice: string }[] = [];
  if (municipale) tetes.push({ valeur: municipale.texte, libelle: "habitants", exercice: municipale.exercice });
  if (foyers) tetes.push({ valeur: foyers.texte, libelle: "foyers fiscaux", exercice: foyers.exercice });
  // Le total du revenu fiscal de référence ne parle à personne — « 86,9 M€ »
  // n'est comparable à rien que le lecteur connaisse. Rapporté au foyer, il
  // se lit contre son propre revenu.
  let rfrParFoyerTexte = "";
  if (foyers && reference && foyers.exercice === reference.exercice && foyers.brut > 0) {
    rfrParFoyerTexte = euros(Math.round(reference.brut / foyers.brut));
    tetes.push({ valeur: rfrParFoyerTexte, libelle: "revenu fiscal de référence, par foyer", exercice: reference.exercice });
  }
  if (diplomeTete) {
    // Le libellé du diplôme reste tel quel : « titulaires d'un Aucun diplôme »
    // n'aurait eu aucun sens pour la ligne « Aucun diplôme ou certificat
    // d'études », qui EST elle-même un diplôme dominant possible.
    tetes.push({ valeur: diplomeTete.texte, libelle: `${diplomeTete.libelle}, diplôme le plus courant`, exercice: diplomeTete.exercice });
  }

  const phraseMorceaux: string[] = [];
  if (municipale) phraseMorceaux.push(`${echapper(nom)} compte ${echapper(municipale.texte)} habitants en ${echapper(municipale.exercice)}`);
  if (rfrParFoyerTexte) phraseMorceaux.push(`le revenu fiscal de référence y est de ${echapper(rfrParFoyerTexte)} par foyer en ${echapper(reference!.exercice)}`);
  if (diplomeTete) phraseMorceaux.push(`<b>${echapper(diplomeTete.libelle)}</b> est le diplôme le plus courant`);
  const phrase = phraseMorceaux.length ? `${phraseMorceaux.join(", ")}.` : "";

  const cartesTete = tetes.length
    ? `<div class="davantage__cartes">${tetes
        .map(
          (t) =>
            `<div class="davantage__carte"><span class="davantage__v">${echapper(t.valeur)}</span><span class="davantage__l">${echapper(
              t.libelle,
            )}</span><span class="davantage__e">${echapper(t.exercice)}</span></div>`,
        )
        .join("")}</div>`
    : "";

  // Âges : les trois tranches, seulement si elles publient toutes le même
  // exercice — une pyramide où un étage daterait d'une autre année ne se lit
  // pas.
  const lignesAges = AGES.map((a) => population.find((l) => l.id === a.id)).filter((l): l is Ligne => Boolean(l));
  const memeExercice = lignesAges.length === AGES.length && lignesAges.every((l) => l.exercice === lignesAges[0]!.exercice);
  const groupe = (titre: string, tableau: string) =>
    tableau ? `<div class="davantage__groupe"><h4>${echapper(titre)}</h4>${tableau}</div>` : "";

  const ageTable = memeExercice
    ? groupe(
        `Population par tranche d'âge, ${lignesAges[0]!.exercice}`,
        table(lignesAges.map((l) => ({ libelle: l.libelle, valeur: l.texte }))),
      )
    : "";

  const diplomesTable = diplomes.length
    ? groupe(
        `Diplômes de la population, ${diplomes[0]!.exercice}`,
        table([...diplomes].sort((a, b) => b.brut - a.brut).map((l) => ({ libelle: l.libelle, valeur: l.texte }))),
      )
    : "";

  // La pauvreté, sous les diplômes : le taux publié à la maille de ce
  // territoire, et les deux prestations que la CAF verse aux foyers modestes.
  const pauvrete = revenus.filter((l) => ["insee_taux_pauvrete", "cnaf_foyers_rsa", "cnaf_foyers_prime_activite"].includes(l.id));
  const pauvreteTable = pauvrete.length
    ? groupe("Pauvreté", table(pauvrete.map((l) => ({ libelle: l.libelle, valeur: l.texte, exercice: l.exercice }))))
    : "";

  return section(
    "population",
    "Population, revenus et diplômes",
    `${phrase ? `<p class="davantage__affirmation">${phrase}</p>` : ""}${cartesTete}${ageTable}${diplomesTable}${pauvreteTable}`,
    "Source : INSEE (population, diplômes, pauvreté), DGFiP (revenus), CAF (RSA, prime d'activité).",
  );
}

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

const EXERCICE_REFERENCE = "2019";

/** Sécurité : les seuls taux (pour mille habitants ou logements), avec leur
 *  évolution depuis 2019 — la fenêtre tenue partout ailleurs sur le site — et
 *  seulement les catégories qui ont une valeur au dernier exercice publié.
 *  Les décomptes bruts, qui doublent chaque taux sans rien ajouter, et les
 *  catégories que la source ne met plus à jour, ne sont pas repris. En
 *  colonnes plutôt qu'en barres : ce qui compte ici est l'écart entre deux
 *  dates, pas la longueur d'un seul taux. */
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
  const lignes: {
    libelle: string;
    unite: string;
    depart: number | null;
    arrivee: number;
    texteDepart: string;
    texteArrivee: string;
  }[] = [];
  for (const i of taux) {
    const arrivee = territoire.series[i.id]?.[dernier];
    if (typeof arrivee !== "number" || !Number.isFinite(arrivee)) continue;
    const brutDepart = territoire.series[i.id]?.[EXERCICE_REFERENCE];
    const depart = typeof brutDepart === "number" && Number.isFinite(brutDepart) ? brutDepart : null;
    lignes.push({
      libelle: i.libelle,
      unite: i.unite,
      depart,
      arrivee,
      texteDepart: depart === null ? "" : valeurLisible(depart, i.unite),
      texteArrivee: valeurLisible(arrivee, i.unite),
    });
  }
  if (!lignes.length) return "";
  const triees = [...lignes].sort((a, b) => b.arrivee - a.arrivee);
  const phrase = `<b>${echapper(triees[0].libelle)}</b> est la catégorie la plus fréquente en ${echapper(dernier)} : ${echapper(
    triees[0].texteArrivee,
  )}.`;
  const tableau = `<table class="davantage__table"><thead><tr><th>Catégorie</th><th>${echapper(
    EXERCICE_REFERENCE,
  )}</th><th>${echapper(dernier)}</th><th>Évolution</th></tr></thead><tbody>${triees
    .map(
      (l) =>
        `<tr><td>${echapper(l.libelle)}</td><td class="davantage__num">${
          l.depart === null ? "—" : echapper(l.texteDepart)
        }</td><td class="davantage__num">${echapper(l.texteArrivee)}</td><td class="davantage__num">${
          l.depart === null || l.depart === 0 ? "—" : echapper(variation(l.depart, l.arrivee))
        }</td></tr>`,
    )
    .join("")}</tbody></table>`;
  return section(
    "securite",
    "Sécurité",
    `<p class="davantage__affirmation">${phrase}</p>${tableau}`,
    "Source : SSMSI, taux pour 1 000 habitants (sauf cambriolages, pour 1 000 logements). Décomptes bruts et catégories sans valeur au dernier exercice non repris.",
  );
}

/** Vie associative : le nom et le montant de chaque association subventionnée
 *  par l'État, pas seulement leur total. La liste nominative vit dans un
 *  fichier à part (`donnees.subventions`, publié par département) ; en son
 *  absence — département non chargé, ou aucune association identifiée — le
 *  thème garde son seul agrégat plutôt que de ne rien afficher.
 *
 *  Un récapitulatif par mission budgétaire a vécu ici : le code du
 *  programme, seule typologie du jaune qui soit un vocabulaire contrôlé,
 *  suffit à grouper les montants, mais pas à leur donner un sens de
 *  lecteur — une subvention d'action sociale pour demandeurs d'asile peut
 *  être rattachée au programme « Hébergement… » (mission Cohésion des
 *  territoires) plutôt qu'à « Immigration, asile et intégration », parce
 *  que c'est la ligne budgétaire réelle de l'État, pas l'activité de
 *  l'association. Un regroupement qui peut faire lire une mission comme
 *  sous-dotée alors que l'argent est ailleurs dans le même tableau est
 *  retiré plutôt que corrigé au cas par cas. */
/** Millions d'euros, toujours deux décimales. */
function millionsDeuxDecimales(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valeur / 1e6)} M€`;
}

/** Combien d'associations s'affichent directement, sans dépli. */
const ASSOCIATIONS_VISIBLES = 15;

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
    const total = beneficiaires.reduce((s, b) => s + b.montant, 0);
    const phrase =
      beneficiaires.length === 1
        ? `Une association subventionnée par l'État à ${echapper(nom)} en ${echapper(exercice)}.`
        : `${beneficiaires.length} associations subventionnées par l'État à ${echapper(nom)} en ${echapper(exercice)}, pour ${echapper(
            millionsDeuxDecimales(total),
          )} au total.`;
    // La plus dotée d'abord (donnees.ts) : les quinze premières s'affichent
    // directement, le reste se déplie.
    const ligneAssoc = (b: (typeof beneficiaires)[number]) =>
      `<div class="davantage__assoc"><span class="davantage__nom">${echapper(b.nom)}</span><span class="davantage__montant">${echapper(
        euros(b.montant),
      )}</span>${b.objet ? `<span class="davantage__objet">${echapper(b.objet)}</span>` : ""}</div>`;
    const visibles = beneficiaires.slice(0, ASSOCIATIONS_VISIBLES);
    const reste = beneficiaires.slice(ASSOCIATIONS_VISIBLES);
    const liste = `<div class="davantage__associations">${visibles.map(ligneAssoc).join("")}</div>`;
    const pli = reste.length
      ? `<details class="davantage__pli"><summary>Voir ${
          reste.length === 1 ? "l'autre association" : `les ${reste.length} autres associations`
        }</summary><div class="davantage__associations">${reste.map(ligneAssoc).join("")}</div></details>`
      : "";
    return section(
      "vie-associative",
      "Vie associative",
      `<p class="davantage__affirmation">${phrase}</p>${liste}${pli}`,
      "Source : jaune budgétaire, effort financier de l'État en faveur des associations.",
    );
  }
  const compte = lignes.find((l) => l.id === "etat_subventions_associations_etablissements");
  const phrase = compte
    ? `${echapper(compte.texte)} établissement${compte.brut > 1 ? "s" : ""} associatif${compte.brut > 1 ? "s" : ""} subventionné${
        compte.brut > 1 ? "s" : ""
      } par l'État à ${echapper(nom)} en ${echapper(compte.exercice)}.`
    : "";
  const montant = lignes.find((l) => l.id === "etat_subventions_associations");
  const cartes = [montant, compte]
    .filter((l): l is Ligne => Boolean(l))
    .map((l) => ({
      texte: l.id === "etat_subventions_associations" ? millionsDeuxDecimales(l.brut) : l.texte,
      libelle: l.libelle,
      exercice: l.exercice,
    }));
  return section(
    "vie-associative",
    "Vie associative",
    `${phrase ? `<p class="davantage__affirmation">${phrase}</p>` : ""}${cartesChiffres(cartes)}`,
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
  return themeGenerique(t.id, t.libelle, t.accent, indicateurs, territoire, t.phrase, t.source);
}

export function rendu(
  territoire: Territoire,
  indicateurs: Indicateur[],
  associations: SubventionsCommune | undefined,
): string {
  const blocs = [
    themeVieAssociative(indicateurs, territoire, territoire.nom, associations),
    themePopulationRevenusDiplomes(indicateurs, territoire, territoire.nom),
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
