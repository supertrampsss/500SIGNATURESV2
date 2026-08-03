/**
 * Fiche territoire. Règle du produit (docs/04) : un chiffre ne s'affiche jamais
 * seul. Il porte son unité, son millésime, son dénominateur quand c'est un
 * ratio, et il est accompagné de sa source, de sa méthode et de ses limites.
 */

import type { Indicateur, Jeu, Territoire } from "./donnees.ts";
import { formater, parHabitantAUnSens, populationDeReference } from "./echelle.ts";
import { evolution, rendu as rendreSerie } from "./serie.ts";
import { reperes, type References } from "./reference.ts";
import { lecture, synthese, tendance } from "./synthese.ts";

const NIVEAUX: Record<string, string> = {
  commune: "Commune",
  epci: "Intercommunalité",
  departement: "Département",
  region: "Région",
};

function echapper(texte: string): string {
  const noeud = document.createElement("span");
  noeud.textContent = texte;
  return noeud.innerHTML;
}

function ligneIndicateur(
  indicateur: Indicateur,
  territoire: Territoire,
  periode: string,
  parHabitant: boolean,
  niveau: string,
  toutesReferences: References | null,
  /** Cet indicateur est celui peint sur la carte : il porte en plus le rang
   *  du territoire dans la couche (le seul KPI qui suppose la couche
   *  chargée) et se signale d'un mot. */
  surCarte = false,
  rang?: { position: number; total: number },
  comparateurs: { libelle: string; territoire: Territoire }[] = [],
): string {
  const serie = territoire.series[indicateur.id];
  const brut = serie?.[periode];
  if (brut === undefined) {
    return `<div class="mesure mesure--absente">
      <dt>${titreMesure(indicateur, surCarte)}</dt>
      <dd>Donnée non disponible pour ${periode}</dd>
    </div>`;
  }
  const denom = populationDeReference(territoire, periode);
  const ratio = parHabitant && parHabitantAUnSens(indicateur);
  if (ratio && !denom.valeur) {
    return `<div class="mesure mesure--absente">
      <dt>${titreMesure(indicateur, surCarte)}</dt>
      <dd>Population inconnue : le montant par habitant n'est pas calculable</dd>
    </div>`;
  }
  const valeur = ratio ? brut / (denom.valeur as number) : brut;
  // L'étiquette dit d'où vient le dénominateur : la référence OFGL de
  // l'exercice quand elle existe, celle du référentiel géographique sinon.
  // Le dénominateur n'occupe plus une ligne : il est dit au survol de la
  // valeur, et en détail dans « Sources et méthode ».
  const infoDenominateur = ratio
    ? ` title="Par habitant — population ${new Intl.NumberFormat("fr-FR").format(
        denom.valeur as number,
      )} (${
        denom.exercice
          ? `référence OFGL ${echapper(denom.exercice)}`
          : "référentiel géographique"
      })"`
    : "";
  // Chaque exercice se divise par SA population, pas par celle d'aujourd'hui :
  // sinon les dépenses de 2022 se lisent rapportées aux habitants de 2025. La
  // courbe partage le dénominateur de la valeur affichée, sans quoi elle
  // raconterait autre chose.
  const suivie = ratio
    ? Object.fromEntries(
        Object.entries(serie).flatMap(([p, v]) => {
          const pop = populationDeReference(territoire, p).valeur;
          return pop ? [[p, v / pop] as [string, number]] : [];
        }),
      )
    : serie;
  // Une série recalculée par le producteur dans la géographie d'aujourd'hui ne
  // se coupe pas à la fusion : ses valeurs anciennes portent déjà sur le
  // territoire actuel. Lui signaler une rupture déclarerait incomparable une
  // série qui ne l'est pas — c'est le cas des populations légales de l'INSEE.
  // L'autre lecture du même chiffre, en petit : le par-habitant montre le
  // total, le total montre le par-habitant. Deux regards, une seule donnée.
  const autreLecture =
    indicateur.unite === "EUR" && parHabitantAUnSens(indicateur)
      ? ratio
        ? `<span class="mesure__autre">soit ${formater(brut, "EUR", false)} au total</span>`
        : denom.valeur
          ? `<span class="mesure__autre">soit ${formater(
              brut / denom.valeur,
              "EUR",
              true,
            )} par habitant</span>`
          : ""
      : "";
  const evenements = indicateur.geographie_courante ? [] : (territoire.evenements ?? []);
  // Les points de comparaison, calculés une fois : ils nourrissent la phrase
  // de lecture ET les lignes tracées sur la courbe — un seul calcul, donc
  // aucun risque que le texte dise autre chose que le dessin.
  const comparaisonsMesure = [
    // La valeur du département, de la région, de la France : publiée pour
    // ces mailles, donc disponible même sous secret de diffusion.
    ...comparateurs.flatMap((c) => {
      const brutParent = c.territoire.series[indicateur.id]?.[periode];
      if (brutParent === undefined) return [];
      const popParent = populationDeReference(c.territoire, periode).valeur;
      if (ratio && !popParent) return [];
      return [
        { libelle: c.libelle, valeur: ratio ? brutParent / (popParent as number) : brutParent },
      ];
    }),
    ...reperes(
      toutesReferences?.[indicateur.id]?.[periode]?.[niveau],
      niveau,
      territoire.region ?? null,
      ratio,
    ).map((r) => ({ libelle: r.libelle, valeur: r.valeur })),
  ];
  return `<div class="mesure${surCarte ? " mesure--carte" : ""}">
    <dt>${titreMesure(indicateur, surCarte)}</dt>
    <dd>
      <strong${infoDenominateur}>${formater(valeur, indicateur.unite, ratio)}</strong>${
        ratio ? `<span class="par-quoi">par habitant</span>` : ""
      }
      <span class="millesime">${periode}</span>
      ${autreLecture}
      ${evolution(suivie, periode, evenements)}
      ${kpis(indicateur, territoire, suivie, periode, valeur, rang)}
      <p class="mesure__lecture">${echapper(
        [
          lecture(valeur, comparaisonsMesure, (v) => formater(v, indicateur.unite, ratio)),
          tendance(suivie),
        ]
          .filter(Boolean)
          .join(" "),
      )}</p>
      ${rendreSerie(
        suivie,
        evenements,
        (v) => formater(v, indicateur.unite, ratio),
        comparaisonsMesure,
      )}
      ${miniTableau(suivie, indicateur, ratio, ratio ? serie : undefined)}

    </dd>
  </div>`;
}

/** Le titre d'une mesure : cliquable pour la porter sur la carte, et marqué
 *  quand elle y est déjà. Chaque mesure est complète — même valeur, mêmes
 *  courbes, même tableau : ce qui vaut pour la première vaut pour toutes. */
function titreMesure(indicateur: Indicateur, surCarte: boolean): string {
  return `<button type="button" class="mesure__titre" data-indicateur="${indicateur.id}"
    title="Afficher sur la carte">${echapper(indicateur.libelle)}</button>${
    surCarte ? `<span class="mesure__marque">sur la carte</span>` : ""
  }`;
}

/** Croissance annuelle moyenne, en % par an — ce qu'une évolution brute sur
 *  plusieurs années ne dit pas : +35 % en trois ans, c'est +10,5 %/an. */
export function croissanceAnnuelle(serie: Record<string, number>): number | null {
  const periodes = Object.keys(serie).sort();
  if (periodes.length < 3) return null;
  const premiere = serie[periodes[0]];
  const derniere = serie[periodes[periodes.length - 1]];
  const annees = Number(periodes[periodes.length - 1].slice(0, 4)) - Number(periodes[0].slice(0, 4));
  if (!premiere || !annees || premiere <= 0 || derniere <= 0) return null;
  return ((derniere / premiere) ** (1 / annees) - 1) * 100;
}

/**
 * Les repères chiffrés d'une mesure : densité, rang, croissance annuelle.
 *
 * Un nombre seul — « 602 076 établissements » — n'apprend rien : beaucoup ou
 * peu, en hausse ou en baisse, où dans le pays ? Ces trois KPI répondent avec
 * ce qui est disponible, et se taisent quand la donnée manque plutôt que
 * d'inventer. La densité n'est calculée que pour les effectifs (un montant a
 * déjà son « par habitant »), le rang que si la couche est chargée.
 */
function kpis(
  indicateur: Indicateur,
  territoire: Territoire,
  serie: Record<string, number>,
  periode: string,
  valeur: number,
  rang?: { position: number; total: number },
): string {
  const cases: string[] = [];
  const population = territoire.population;
  if (indicateur.unite === "count" && indicateur.sommable && population) {
    const densite = (valeur / population) * 1000;
    cases.push(`<div><dt>Pour 1 000 habitants</dt><dd>${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: densite < 10 ? 1 : 0,
    }).format(densite)}</dd></div>`);
  }
  if (rang && rang.total > 1) {
    cases.push(
      `<div><dt>Rang</dt><dd>${new Intl.NumberFormat("fr-FR").format(rang.position)}<span>
        sur ${new Intl.NumberFormat("fr-FR").format(rang.total)}</span></dd></div>`,
    );
  }
  const cagr = croissanceAnnuelle(serie);
  if (cagr !== null) {
    cases.push(
      `<div><dt>Croissance annuelle</dt><dd>${cagr >= 0 ? "+" : ""}${new Intl.NumberFormat(
        "fr-FR",
        { maximumFractionDigits: 1 },
      ).format(cagr)} %<span>par an</span></dd></div>`,
    );
  }
  const millesimes = Object.keys(serie).length;
  if (millesimes === 1) {
    cases.push(
      `<div><dt>Millésime</dt><dd>${echapper(periode)}<span>seul publié à ce jour</span></dd></div>`,
    );
  }
  return cases.length ? `<dl class="kpis">${cases.join("")}</dl>` : "";
}

/** Les exercices en chiffres : 2022 | 2023 | 2024 | 2025. La courbe donne la
 *  forme, le tableau donne les nombres — demandé tel quel. Six colonnes au
 *  plus : au-delà, il déborde sans rien apprendre. */
function miniTableau(
  serie: Record<string, number>,
  indicateur: Indicateur,
  ratio: boolean,
  /** La même série en montants totaux, quand la première est un ratio : les
   *  deux lectures se lisent alors l'une sous l'autre, année par année. */
  totaux?: Record<string, number>,
): string {
  const periodes = Object.keys(serie).sort().slice(-6);
  if (periodes.length < 2) return "";
  const ligne = (libelle: string, valeurs: Record<string, number>, parHabitant: boolean) =>
    `<tr><th scope="row">${libelle}</th>${periodes
      .map(
        (p) =>
          `<td>${
            valeurs[p] === undefined ? "—" : formater(valeurs[p], indicateur.unite, parHabitant)
          }</td>`,
      )
      .join("")}</tr>`;
  return `<table class="mini-serie">
    <thead><tr><td></td>${periodes
      .map((p) => `<th scope="col">${echapper(p)}</th>`)
      .join("")}</tr></thead>
    <tbody>
      ${ligne(ratio ? "par hab." : "total", serie, ratio)}
      ${totaux ? ligne("total", totaux, false) : ""}
    </tbody>
  </table>`;
}

export function panneauSource(indicateurs: Indicateur[], jeux: Jeu[]): string {
  const utilises = new Set(indicateurs.map((i) => i.jeu));
  const lignes = jeux
    .filter((jeu) => utilises.has(jeu.id))
    .map(
      (jeu) => `<li>
        <strong>${echapper(jeu.titre)}</strong><br />
        ${echapper(jeu.producteur)} — ${echapper(jeu.licence)}<br />
        Extraction du ${new Date(jeu.extraction).toLocaleDateString("fr-FR")} ·
        <a href="${echapper(jeu.url)}" rel="noreferrer">fichier source</a>
      </li>`,
    )
    .join("");
  return `<h3 class="panneau__section">D'où viennent ces chiffres ?</h3>
    <ul class="sources">${lignes}</ul>`;
}

export function panneauMethode(indicateurs: Indicateur[]): string {
  const lignes = indicateurs
    .map(
      (i) => `<li>
        <strong>${echapper(i.libelle)}</strong> — ${echapper(i.definition)}
        <br /><span class="technique">${echapper(i.definition_technique)}</span>
        <br /><span class="formule">Calcul : ${echapper(i.formule)}</span>
      </li>`,
    )
    .join("");
  return `<h3 class="panneau__section">Méthodologie et limites</h3>
    <ul class="methodes">${lignes}</ul>
    <p class="avertissement">
      Ces montants sont ceux des comptes exécutés, budgets principaux et annexes
      consolidés. Un budget voté n'est pas une dépense réalisée. Les montants par
      habitant utilisent la population retenue par l'Observatoire des finances
      locales, afin que nos ratios reproduisent exactement les siens.
    </p>`;
}

export function panneauComparabilite(territoire: Territoire, niveau: string): string {
  const avertissements: string[] = [];
  const drapeaux = territoire.drapeaux ?? {};
  if ((drapeaux as Record<string, unknown>).type === "EPT") {
    avertissements.push(
      "Établissement public territorial : son périmètre est inclus dans celui de la Métropole du Grand Paris. Ne pas additionner les deux.",
    );
  }
  if ((drapeaux as Record<string, unknown>).statut_particulier) {
    avertissements.push(
      "Collectivité à statut particulier : elle exerce les compétences d'un département sans en être un au Code officiel géographique.",
    );
  }
  avertissements.push(
    "Les repères sont la médiane des territoires de même niveau — la moitié se" +
      " situe en dessous. « Communes de la région » désigne l'ensemble des communes" +
      " de cette région, jamais le budget du conseil régional, qui est une autre" +
      " collectivité aux autres compétences.",
  );
  if (niveau === "commune") {
    avertissements.push(
      "Les communes nouvelles portent l'historique de leurs communes d'origine, additionné sous le code actuel.",
    );
  }
  avertissements.push(
    "Comparer deux territoires suppose la même année, la même unité et le même périmètre budgétaire.",
  );
  return `<h3 class="panneau__section">Comparabilité</h3>
    <ul>${avertissements.map((a) => `<li>${echapper(a)}</li>`).join("")}</ul>`;
}

/**
 * La synthèse d'ouverture : ce qu'on retiendrait de ce territoire en trois
 * lignes. Elle ne dit rien qui ne soit ailleurs dans le panneau, chiffre à
 * l'appui — elle choisit, elle n'invente pas. L'ordre est celui des questions
 * que les gens posent : combien d'habitants, combien dépense la commune, avec
 * quelle dette, quels revenus, quelle délinquance.
 */
const ORDRE_SYNTHESE = [
  "insee_population_municipale",
  "ofgl_depenses_fonctionnement",
  "ofgl_encours_dette",
  "insee_niveau_vie_median",
  "insee_taux_pauvrete",
  "ssmsi_cambriolages_taux",
  "drees_apl_generalistes",
  "menj_ecoles",
];

function syntheseTerritoire(
  indicateurs: Indicateur[],
  territoire: Territoire,
  periode: string,
  parHabitant: boolean,
  comparateurs: { libelle: string; territoire: Territoire }[],
  references: References | null,
  niveau: string,
): string {
  const faits = ORDRE_SYNTHESE.flatMap((id) => {
    const indicateur = indicateurs.find((i) => i.id === id);
    if (!indicateur) return [];
    const serie = territoire.series[id];
    const brut = serie?.[periode];
    if (brut === undefined) return [];
    const denom = populationDeReference(territoire, periode);
    const ratio = parHabitant && parHabitantAUnSens(indicateur);
    if (ratio && !denom.valeur) return [];
    const valeur = ratio ? brut / (denom.valeur as number) : brut;
    const comparaisons = [
      ...comparateurs.flatMap((c) => {
        const parent = c.territoire.series[id]?.[periode];
        if (parent === undefined) return [];
        const pop = populationDeReference(c.territoire, periode).valeur;
        if (ratio && !pop) return [];
        return [{ libelle: c.libelle, valeur: ratio ? parent / (pop as number) : parent }];
      }),
      ...reperes(
        references?.[id]?.[periode]?.[niveau],
        niveau,
        territoire.region ?? null,
        ratio,
      ).map((r) => ({ libelle: r.libelle, valeur: r.valeur })),
    ];
    const situation = lecture(valeur, comparaisons, (v) =>
      formater(v, indicateur.unite, ratio),
    );
    return [
      {
        id,
        texte: `<strong>${echapper(indicateur.libelle)}</strong> ${echapper(
          formater(valeur, indicateur.unite, ratio),
        )}${ratio ? " par habitant" : ""}. ${echapper(situation)}`.trim(),
      },
    ];
  });
  const lignes = synthese(faits);
  if (!lignes.length) return "";
  return `<div class="synthese">
    <p class="synthese__titre">L'essentiel</p>
    <ul>${lignes.map((l) => `<li>${l}</li>`).join("")}</ul>
  </div>`;
}

export function afficherFiche(
  cible: HTMLElement,
  options: {
    code: string;
    niveau: string;
    territoire: Territoire;
    indicateurs: Indicateur[];
    jeux: Jeu[];
    periode: string;
    parHabitant: boolean;
    /** L'indicateur affiché sur la carte : seul à recevoir courbe et repères. */
    principal?: string;
    /** Position du territoire dans la couche affichée, si elle est chargée. */
    rang?: { position: number; total: number };
    /** Libellé lisible d'un thème (la table vit dans main.ts). */
    libelleTheme?: (theme: string) => string;
    /** Territoires de comparaison (son département, sa région, la France) :
     *  leurs valeurs se tracent sur chaque courbe. Ce sont des chiffres
     *  publiés pour ces mailles, pas des médianes — ils existent donc même
     *  là où le secret de diffusion interdit toute médiane communale. */
    comparateurs?: { libelle: string; territoire: Territoire }[];
    comparaison?: string;
    /** Absent des publications antérieures aux repères : la fiche s'affiche
     *  alors sans eux, plutôt que de refuser de s'afficher. */
    references?: References | null;
  },
): void {
  const { territoire, indicateurs, periode, parHabitant, niveau } = options;
  const references = options.references ?? null;
  const principal = options.principal ?? indicateurs[0]?.id;
  const enTete = indicateurs.find((i) => i.id === principal);
  // Tout le catalogue est déjà là — les séries du territoire arrivent en un
  // seul fichier. Les thèmes se suivent donc dans le panneau, valeurs
  // comprises : il n'y a plus rien à sélectionner ailleurs pour voir un
  // chiffre, on fait défiler. Cliquer une ligne la porte sur la carte.
  const groupes = new Map<string, Indicateur[]>();
  for (const indicateur of indicateurs) {
    if (indicateur.id === principal) continue;
    groupes.set(indicateur.theme, [...(groupes.get(indicateur.theme) ?? []), indicateur]);
  }
  const mesures =
    (enTete
      ? ligneIndicateur(
          enTete, territoire, periode, parHabitant, niveau, references, true, options.rang,
          options.comparateurs,
        )
      : "") +
    [...groupes.entries()]
      .map(([theme, liste]) => {
        // Un thème montre sa mesure phare ; le reste se déplie. Vingt blocs
        // dépliés d'un coup faisaient un mur — le lecteur ne savait plus par
        // où entrer, alors que tout était là.
        const [premier, ...suite] = liste;
        const rendreLigne = (indicateur: Indicateur) =>
          ligneIndicateur(
            indicateur, territoire, periode, parHabitant, niveau, references,
            false, undefined, options.comparateurs,
          );
        return `<div class="theme-groupe">
          <p class="theme-groupe__titre">${echapper(
            options.libelleTheme?.(theme) ?? theme,
          )} <span class="theme-groupe__compte">${liste.length} indicateur${
            liste.length > 1 ? "s" : ""
          }</span></p>
          ${rendreLigne(premier)}
          ${
            suite.length
              ? `<details class="theme-groupe__suite">
                  <summary>Voir les ${suite.length} autre${
                    suite.length > 1 ? "s" : ""
                  } indicateur${suite.length > 1 ? "s" : ""}</summary>
                  ${suite.map(rendreLigne).join("")}
                </details>`
              : ""
          }
        </div>`;
      })
      .join("");
  cible.innerHTML = `
    <h2 class="fiche__titre">${echapper(territoire.nom)}</h2>
    <p class="fiche__meta">${NIVEAUX[niveau] ?? niveau} ${echapper(options.code)}${
      territoire.population
        ? ` · <abbr title="Population municipale (légale) au sens du recensement de l'INSEE. Les montants par habitant utilisent, eux, la population de référence de l'OFGL de l'exercice concerné : deux définitions, deux millésimes, deux nombres.">${new Intl.NumberFormat(
            "fr-FR",
          ).format(territoire.population)} hab.</abbr>`
        : ""
    }</p>
    ${
      niveau === "commune" && !territoire.maire
        ? `<p class="fiche__maire fiche__maire--absent">Maire : <em>non renseigné par le Répertoire National des Élus</em></p>`
        : territoire.maire
        ? `<p class="fiche__maire">Maire : <strong>${echapper(territoire.maire.nom)}</strong>${
            territoire.maire.depuis
              ? ` <span>depuis ${echapper(
                  new Date(territoire.maire.depuis).toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  }),
                )}</span>`
              : ""
          }</p>`
        : ""
    }
    ${syntheseTerritoire(
      indicateurs, territoire, periode, parHabitant,
      options.comparateurs ?? [], references, niveau,
    )}
    <dl class="mesures">${mesures}</dl>
    ${options.comparaison ?? ""}
  `;
}

/**
 * Position d'une commune parmi ses semblables. Le groupe est défini par des
 * critères publiés par l'OFGL, affichés avec le résultat : sans eux, « communes
 * comparables » ne veut rien dire. Aucun classement, aucun jugement — une
 * position dans une distribution, et le nombre de communes qui la composent.
 */
export function positionDansGroupe(
  territoire: Territoire,
  quartiles: { n: number; q1: number; mediane: number; q3: number } | undefined,
  valeurParHabitant: number | undefined,
  criteres: string[],
): string {
  if (!quartiles || valeurParHabitant === undefined) return "";
  const drapeaux = (territoire.drapeaux ?? {}) as Record<string, string>;
  const lisible: Record<string, string> = {
    tranche_population: "strate de population",
    rural: "caractère rural",
    outre_mer: "outre-mer",
  };
  const description = criteres
    .map((c) => `${lisible[c] ?? c} : ${drapeaux[c] ?? "non renseigné"}`)
    .join(" · ");
  const situation =
    valeurParHabitant < quartiles.q1
      ? "sous le quart inférieur"
      : valeurParHabitant > quartiles.q3
        ? "au-dessus du quart supérieur"
        : "dans la moitié centrale";
  return `<details class="repli">
    <summary>Comparaison avec des communes semblables</summary>
    <p>Parmi <strong>${quartiles.n}</strong> communes du même groupe, cette commune se situe
      <strong>${situation}</strong> de la distribution.</p>
    <ul class="quartiles">
      <li><span>1<sup>er</sup> quartile</span><strong>${formater(quartiles.q1, "EUR", true)}</strong></li>
      <li><span>Médiane</span><strong>${formater(quartiles.mediane, "EUR", true)}</strong></li>
      <li><span>3<sup>e</sup> quartile</span><strong>${formater(quartiles.q3, "EUR", true)}</strong></li>
      <li><span>Cette commune</span><strong>${formater(valeurParHabitant, "EUR", true)}</strong></li>
    </ul>
    <p class="avertissement">Groupe constitué sur des critères publiés par l'Observatoire
      des finances locales — ${echapper(description)} — et non sur un découpage propre à ce
      site. <strong>Une position basse ne signifie pas une meilleure gestion.</strong> Le
      premier facteur d'écart est l'intercommunalité : dans une métropole intégrée, la
      voirie, les déchets ou l'urbanisme sont payés par l'intercommunalité et n'apparaissent
      pas dans le budget communal. Les compétences exercées, la géographie et les choix
      politiques diffèrent d'une commune à l'autre.</p>
  </details>`;
}
