/**
 * Les quatre blocs de lecture. Ce qui est verrouillé ici : l'ordre, le refus de
 * décomposer quand la somme ne tombe pas, la langue — élision, accord,
 * contraction, aucun tiret cadratin — et le fait que les blocs ne redisent pas
 * les repères qui les précèdent.
 *
 * Les chiffres sont ceux de Bordeaux tels que l'OFGL les publie : un texte
 * calculé se teste sur les données qui l'ont motivé.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { blocs, rendreBlocs, type Entree } from "./blocs.ts";
import type { Indicateur } from "./donnees.ts";
import { ROLES } from "./reperes.ts";

const CATALOGUE = (
  [
    ["ofgl_achats_et_charges_externes", "Achats et charges externes", "ofgl_depenses_fonctionnement"],
    ["ofgl_autres_depenses_d_investissement", "Autres dépenses d'investissement", "ofgl_depenses_d_investissement_hors_remb"],
    ["ofgl_autres_depenses_de_fonctionnement", "Autres dépenses de fonctionnement", "ofgl_depenses_fonctionnement"],
    ["ofgl_autres_dotations_de_fonctionnement", "Autres dotations de fonctionnement", "ofgl_concours_de_l_etat"],
    ["ofgl_autres_impots_et_taxes", "Autres impôts et taxes", "ofgl_impots_et_taxes"],
    ["ofgl_autres_recettes_de_fonctionnement", "Autres recettes de fonctionnement", "ofgl_recettes_fonctionnement"],
    ["ofgl_charges_financieres", "Charges financières (intérêts de la dette)", "ofgl_depenses_fonctionnement"],
    ["ofgl_concours_de_l_etat", "Concours de l'Etat", "ofgl_recettes_fonctionnement"],
    ["ofgl_cvae", "CVAE", "ofgl_impots_locaux"],
    ["ofgl_depenses_d_equipement", "Dépenses d'équipement", "ofgl_depenses_d_investissement_hors_remb"],
    ["ofgl_depenses_d_intervention", "Dépenses d'intervention", "ofgl_depenses_fonctionnement"],
    ["ofgl_depenses_d_investissement_hors_remb", "Dépenses d'investissement hors remb", "ofgl_depenses_investissement"],
    ["ofgl_depenses_fonctionnement", "Dépenses de fonctionnement", "ofgl_depenses_totales"],
    ["ofgl_dotation_globale_de_fonctionnement", "Dotation globale de fonctionnement", "ofgl_concours_de_l_etat"],
    ["ofgl_encours_dette", "Encours de dette", null],
    ["ofgl_epargne_brute", "Épargne brute", null],
    ["ofgl_fiscalite_reversee", "Fiscalité reversée", "ofgl_impots_locaux"],
    ["ofgl_frais_personnel", "Frais de personnel", "ofgl_depenses_fonctionnement"],
    ["ofgl_impots_et_taxes", "Impôts et taxes", "ofgl_recettes_fonctionnement"],
    ["ofgl_impots_locaux", "Impôts locaux", "ofgl_impots_et_taxes"],
    ["ofgl_perequations_et_compensations_fiscales", "Péréquations et compensations fiscales", "ofgl_concours_de_l_etat"],
    ["ofgl_recettes_fonctionnement", "Recettes de fonctionnement", "ofgl_recettes_totales"],
    ["ofgl_subventions_d_equipement_versees", "Subventions d'équipement versées", "ofgl_depenses_d_investissement_hors_remb"],
    ["ofgl_subventions_recues_et_participations", "Subventions reçues et participations", "ofgl_recettes_fonctionnement"],
    ["ofgl_travaux_en_regie", "Travaux en régie", "ofgl_depenses_fonctionnement"],
    ["ofgl_ventes_de_biens_et_services", "Ventes de biens et services", "ofgl_recettes_fonctionnement"],
  ] as [string, string, string | null][]
).map(
  ([id, libelle, parent]) =>
    ({
      id, libelle, parent, unite: "EUR", theme: "finances_locales", sommable: true,
      niveaux: ["commune"], definition: "", jeu: "ofgl-communes",
    }) as never as Indicateur,
);

/**
 * Le catalogue national, tel que la publication le déclare.
 *
 * Les identifiants, les libellés et les parents sont ceux du fichier publié : les
 * recettes nettes du budget général ouvrent les deux familles que la source en
 * publie, et les dépenses nettes n'ouvrent rien. Les deux impôts qui suivent sont
 * réels et sans parent déclaré, ici comme à la publication : ils servent aux
 * fixtures qui vérifient qu'un poste absent de la table ne se dit pas.
 */
const CATALOGUE_FRANCE = (
  [
    ["etat_depenses_nettes_bg", "Dépenses nettes du budget général", null],
    ["etat_recettes_nettes_bg", "Recettes nettes du budget général", null],
    ["etat_recettes_fiscales", "Recettes fiscales nettes", "etat_recettes_nettes_bg"],
    ["etat_recettes_non_fiscales", "Recettes non fiscales", "etat_recettes_nettes_bg"],
    ["etat_impot_revenu", "Impôt sur le revenu", null],
    ["etat_impot_societes", "Impôt sur les sociétés", null],
  ] as [string, string, string | null][]
).map(
  ([id, libelle, parent]) =>
    ({
      id, libelle, parent, unite: "EUR", theme: "budget_etat", sommable: false,
      cadre_comptable: "budgetaire", niveaux: ["pays"], definition: "",
      jeu: "execution-budget-etat",
    }) as never as Indicateur,
);

/** Les montants publiés pour la France, aux deux bornes de la fenêtre. Les deux
 *  familles redonnent leur total au centime, aux deux exercices. */
const FRANCE: Record<string, Record<string, number>> = {
  etat_depenses_nettes_bg: { "2019": 336068575453.89, "2025": 441194313369.76 },
  etat_recettes_nettes_bg: { "2019": 295256348109.01, "2025": 380389657383.09 },
  etat_recettes_fiscales: { "2019": 281289250970.51, "2025": 356397925509.5 },
  etat_recettes_non_fiscales: { "2019": 13967097138.5, "2025": 23991731873.59 },
};

function deFrance(modifications: Partial<Entree> = {}) {
  return blocs({
    niveau: "pays", nom: "France", series: FRANCE, catalogue: CATALOGUE_FRANCE, ...modifications,
  });
}

const BORDEAUX: Record<string, Record<string, number>> = {
  ofgl_achats_et_charges_externes: { "2019": 64526171.08, "2025": 85695732.08 },
  ofgl_autres_depenses_d_investissement: { "2019": 433691.55, "2025": 127841.29 },
  ofgl_autres_depenses_de_fonctionnement: { "2019": 6693784.11, "2025": 5246583.47 },
  ofgl_autres_dotations_de_fonctionnement: { "2019": 1827437, "2025": 1919282.19 },
  ofgl_autres_impots_et_taxes: { "2019": 43668562.16, "2025": 43936352.84 },
  ofgl_autres_recettes_de_fonctionnement: { "2019": 6060136.81, "2025": 10074438.4 },
  ofgl_charges_financieres: { "2019": 6354776.23, "2025": 8288081.69 },
  ofgl_concours_de_l_etat: { "2019": 46374084, "2025": 44816306.19 },
  ofgl_depenses_d_equipement: { "2019": 56355923.66, "2025": 109850175.79 },
  ofgl_depenses_d_intervention: { "2019": 72919832.93, "2025": 86726481.33 },
  ofgl_depenses_d_investissement_hors_remb: { "2019": 81394747.25, "2025": 135965988.05 },
  ofgl_depenses_fonctionnement: { "2019": 294082496.89, "2025": 369011621.25 },
  ofgl_dotation_globale_de_fonctionnement: { "2019": 37287230, "2025": 36477848 },
  ofgl_encours_dette: { "2019": 252257675.39, "2025": 412980519.9 },
  ofgl_epargne_brute: { "2019": 57871668.33, "2025": 48126337.27 },
  ofgl_fiscalite_reversee: { "2019": -39360084.88, "2025": -49425246.38 },
  ofgl_frais_personnel: { "2019": 143587932.54, "2025": 183054742.68 },
  ofgl_impots_et_taxes: { "2019": 238862163.28, "2025": 297912287.46 },
  ofgl_impots_locaux: { "2019": 195193601.12, "2025": 253975934.62 },
  ofgl_perequations_et_compensations_fiscales: { "2019": 7259417, "2025": 6419176 },
  ofgl_recettes_fonctionnement: { "2019": 351954165.22, "2025": 417137958.52 },
  ofgl_subventions_d_equipement_versees: { "2019": 24605132.04, "2025": 25987970.97 },
  ofgl_subventions_recues_et_participations: { "2019": 18853320.06, "2025": 16557332.14 },
  ofgl_ventes_de_biens_et_services: { "2019": 41804461.07, "2025": 47777594.33 },
};

function deBordeaux(modifications: Partial<Entree> = {}) {
  return blocs({
    niveau: "commune", nom: "Bordeaux", series: BORDEAUX, catalogue: CATALOGUE, ...modifications,
  });
}

/** Le texte tel qu'il se lit : sans balises, et l'apostrophe rendue. */
function lu(html: string): string {
  return html.replace(/<[^>]*>/gu, "").replace(/&#39;/gu, "'").replace(/&amp;/gu, "&");
}

const FIN = " "; // l'espace fine insécable des milliers et du signe %
// L'insécable que `montantLisible` pose entre le nombre et son unité écrite
// en toutes lettres : « 369,01 millions d'euros ».
const U = "\u00a0";

test("les quatre blocs suivent l'argent, et dans cet ordre", () => {
  assert.deepEqual(
    deBordeaux().map((b) => b.titre),
    ["Le train de vie", "Qui règle l'addition", "L'ardoise", "Ce qui sort de terre"],
  );
});

/**
 * Le texte de référence, mot pour mot.
 *
 * Ce test est long à lire et c'est ce qu'on lui demande : il fige la phrase que
 * le lecteur voit, pas seulement les nombres qui la composent. Un changement de
 * seuil, d'arrondi ou de formulation le casse, et c'est le but.
 */
test("Bordeaux se lit comme la maquette l'a écrit", () => {
  const [ou, qui, reste, paye] = deBordeaux().map((b) => lu(b.texte));
  assert.equal(
    ou,
    `Bordeaux dépense 369,01${U}millions d'euros par an pour faire tourner ses services, soit 74,93${U}millions d'euros de plus qu'en 2019.` +
      ` La moitié de cette augmentation tient aux salaires de ses agents, qui passent de 143,59 à 183,05${U}millions d'euros` +
      ` : c'est un euro sur deux du budget de fonctionnement.` +
      ` Viennent ensuite les achats, l'énergie et les prestataires (+21,17${U}millions d'euros),` +
      ` puis les aides et subventions versées (+13,81${U}millions d'euros).`,
  );
  assert.equal(
    qui,
    `Les recettes augmentent de 65,18${U}millions d'euros.` +
      ` La taxe foncière et les impôts des entreprises en apportent 90${FIN}%, soit 58,78${U}millions d'euros.` +
      ` Pendant ce temps, ce que l'État verse à la ville diminue` +
      ` : la dotation principale recule de 37,29 à 36,48${U}millions d'euros.`,
  );
  assert.equal(
    reste,
    `Il faudrait 8,6 années d'épargne pour rembourser les 412,98${U}millions d'euros que la ville doit encore,` +
      ` contre 4,4 années en 2019.`,
  );
  assert.equal(
    paye,
    `La ville a investi 135,97${U}millions d'euros en 2025, contre 81,39${U}millions d'euros en 2019.` +
      ` Les dépenses d'équipement en font 109,85${U}millions d'euros, soit 81${FIN}%.`,
  );
});

/**
 * La décomposition sert la variation, pas le stock.
 *
 * « +25,5 % » est un résumé ; « sur74,90 millions d'euros de hausse, 39,5 viennent des
 * salaires » est une explication. Le premier bloc doit donc nommer les postes
 * du mouvement, dans l'ordre de ce qu'ils y ont mis.
 */
test("le bloc des dépenses attribue la hausse à ses postes, le plus gros d'abord", () => {
  const [ou] = deBordeaux();
  assert.deepEqual(ou.cites, [
    "ofgl_depenses_fonctionnement",
    "ofgl_frais_personnel",
    "ofgl_achats_et_charges_externes",
    "ofgl_depenses_d_intervention",
  ]);
});

/**
 * Le refus est la réponse par défaut.
 *
 * Une composante retirée casse le contrôle de somme de `provenance.ts` : la
 * hausse ne s'attribue plus, et le bloc s'arrête à son total. Il n'écrit pas
 * qu'il lui manque quelque chose — ce qui manque à un fichier se dit dans la
 * légende du tableau, avec les chiffres, jamais après eux.
 */
test("une décomposition qui ne somme pas au total n'est pas écrite", () => {
  const ampute = { ...BORDEAUX };
  delete ampute.ofgl_frais_personnel;
  const [ou] = deBordeaux({ series: ampute });
  assert.deepEqual(ou.cites, ["ofgl_depenses_fonctionnement"]);
  assert.equal(
    lu(ou.texte),
    `Bordeaux dépense 369,01${U}millions d'euros par an pour faire tourner ses services, soit 74,93${U}millions d'euros de plus qu'en 2019.`,
  );
  // Et rien qui s'excuse de ne pas décomposer.
  assert.doesNotMatch(lu(ou.texte), /non publié|indisponible|ne permet pas|faute de/i);
});

test("sans catalogue, aucun bloc n'invente de hiérarchie", () => {
  for (const bloc of deBordeaux({ catalogue: [] })) {
    assert.equal(bloc.cites.length <= 2, true, `${bloc.titre} cite ${bloc.cites.join(", ")}`);
  }
});

/**
 * La provenance se dit à la maille France comme elle se dit pour une commune.
 *
 * Le catalogue national ne déclarait aucun parent : les blocs y tenaient en une
 * phrase faute de déclaration, pas par décision. Les recettes du budget général
 * ouvrent désormais les deux familles que la source en publie, et
 * la phrase les nomme comme elle nomme les postes d'une commune — en français,
 * avec son article et son accord, le terme comptable dans l'infobulle.
 */
test("la France nomme la famille de recettes qui porte la hausse", () => {
  const [depenses, recettes] = deFrance();
  assert.deepEqual([depenses.titre, recettes.titre], ["Le train de vie", "Qui règle l'addition"]);
  assert.equal(
    lu(recettes.texte),
    `Les recettes augmentent de 85${U}milliards d'euros.` +
      ` Les impôts que l'État perçoit en apportent 88${FIN}%, soit 75${U}milliards d'euros.`,
  );
  assert.deepEqual(recettes.cites, ["etat_recettes_nettes_bg", "etat_recettes_fiscales"]);
  // Le terme du fichier publié reste sous le curseur, comme pour une commune.
  assert.match(recettes.texte, /<abbr title="Recettes fiscales nettes">/u);
});

/**
 * La dépense du budget général ne s'ouvre pas, et ne le dit pas.
 *
 * Aucune composition publiée ne redonne le total : les missions sont des montants
 * bruts quand le total est net. Le bloc s'arrête donc à son agrégat, sans écrire
 * ce qui lui manque.
 */
test("la dépense de l'État pose son total sans rien décomposer ni s'en excuser", () => {
  const [depenses] = deFrance();
  assert.deepEqual(depenses.cites, ["etat_depenses_nettes_bg"]);
  assert.equal(
    lu(depenses.texte),
    `L'État dépense 441${U}milliards d'euros par an sur son budget général,` +
      ` soit 105${U}milliards d'euros de plus qu'en 2019.`,
  );
  assert.doesNotMatch(lu(depenses.texte), /non publié|indisponible|décomposition|faute de/i);
});

/**
 * La table décide de ce qui se dit, pas le catalogue.
 *
 * Mêmes montants, mêmes exercices, même contrôle de somme réussi : seuls les
 * identifiants changent, pour deux impôts que la table ne porte pas. Rien n'est
 * nommé, et surtout pas le libellé du catalogue au milieu d'une phrase.
 */
test("une composante que la table ne nomme pas ne se dit pas, même décomposée", () => {
  const [, recettes] = deFrance({
    series: {
      etat_depenses_nettes_bg: FRANCE.etat_depenses_nettes_bg,
      etat_recettes_nettes_bg: FRANCE.etat_recettes_nettes_bg,
      etat_impot_revenu: FRANCE.etat_recettes_fiscales,
      etat_impot_societes: FRANCE.etat_recettes_non_fiscales,
    },
    catalogue: CATALOGUE_FRANCE.map((i) =>
      i.id === "etat_impot_revenu" || i.id === "etat_impot_societes"
        ? { ...i, parent: "etat_recettes_nettes_bg" }
        : i
    ),
  });
  assert.equal(lu(recettes.texte), `Les recettes augmentent de 85${U}milliards d'euros.`);
  assert.deepEqual(recettes.cites, ["etat_recettes_nettes_bg"]);
  assert.doesNotMatch(recettes.texte, /Impôt sur le revenu|Impôt sur les sociétés/u);
});

/**
 * Un poste se dit dans le vocabulaire de son propre cadre.
 *
 * Les recettes du budget général sont de la comptabilité **budgétaire** : ce sont
 * des impôts revenant à l'État, ni les cotisations qui financent la Sécurité
 * sociale, ni les impôts locaux qui vont aux collectivités, ni un solde des
 * administrations publiques au sens de la comptabilité nationale. Une phrase qui
 * emprunterait un de ces mots serait fausse en sonnant juste.
 */
test("les postes du budget de l'État n'empruntent aucun mot d'un autre cadre", () => {
  const texte = deFrance().map((b) => lu(b.texte)).join(" ");
  assert.match(texte, /Les impôts que l'État perçoit/u);
  assert.doesNotMatch(
    texte,
    /cotisation|sécurité sociale|collectivité|administrations publiques|prestation|niche|dépense fiscale|redevance/iu,
    texte,
  );
});

/**
 * Ce que les repères disent, les blocs ne le redisent pas — et réciproquement.
 *
 * Les repères écrivent « Ce qu'elle doit 413,0 · +63,7 % » ; l'ancienne
 * ouverture enchaînait « l'encours passe de252,30 millions d'euros à413,00 millions d'euros, soit +63,7 % ».
 * Les blocs partent des mêmes agrégats mais n'en disent que le mouvement et sa
 * provenance : aucune phrase ne pose une variation en pourcentage.
 */
test("aucun bloc ne repose la variation en pourcentage qu'un repère porte déjà", () => {
  const roles = new Set(ROLES.commune.map((r) => r.id));
  for (const bloc of deBordeaux()) {
    const texte = lu(bloc.texte);
    assert.doesNotMatch(texte, new RegExp(`[+−]\\d+,\\d+${FIN}%`), `${bloc.titre} : ${texte}`);
    // Le bloc a bien le droit de partir d'un repère : c'est même le point. Ce
    // qu'il ajoute est la provenance, que les repères ne portent pas.
    if (bloc.cites.some((id) => roles.has(id))) {
      assert.ok(bloc.texte.length > 0);
    }
  }
});

test("un taux qui varie se dirait en points, jamais en pourcentage", () => {
  // Les blocs ne portent que des masses en euros : aucun d'eux n'écrit de
  // variation de taux, et le contrôle est là pour qu'aucun ne s'y mette.
  for (const bloc of deBordeaux()) {
    assert.doesNotMatch(lu(bloc.texte), /de \d+,\d+ % à \d+,\d+ %/u, bloc.titre);
  }
});

test("aucun par-habitant hors des tableaux dépliés", () => {
  for (const bloc of deBordeaux()) {
    assert.doesNotMatch(lu(bloc.texte), /par habitant|hab\./u, bloc.titre);
  }
});

/* ------------------------------------------------------------------------
 * La langue.
 * ---------------------------------------------------------------------- */

test("aucun tiret cadratin ni demi-cadratin dans le texte rendu", () => {
  const rendu = rendreBlocs(deBordeaux());
  assert.doesNotMatch(rendu, /[—–]/u, rendu);
  // Le signe moins est le signe typographique, pas un tiret : il reste permis.
  assert.doesNotMatch(rendu, /(?<=\d)-(?=\d)/u);
});

test("l'élision et les contractions tiennent, y compris sur une énumération", () => {
  const textes = [
    ...deBordeaux(),
    ...blocs({ niveau: "departement", nom: "Gironde", series: BORDEAUX, catalogue: CATALOGUE }),
  ].map((b) => lu(b.texte));
  for (const texte of textes) {
    assert.doesNotMatch(texte, /\bde [aeiouéèêh]/iu, texte);
    assert.doesNotMatch(texte, /\b(à|de) l(e|es) /u, texte);
  }
  // « aux achats, l'énergie et les prestataires » n'est pas du français : la
  // préposition se distribue sur chaque terme de l'énumération.
  const gruson = blocs({
    niveau: "commune",
    nom: "Gruson",
    series: {
      ...BORDEAUX,
      ofgl_achats_et_charges_externes: { "2019": 64526171.08, "2025": 130000000 },
      ofgl_frais_personnel: { "2019": 143587932.54, "2025": 138750474.76 },
    },
    catalogue: CATALOGUE,
  });
  assert.match(lu(gruson[0].texte), /tient aux achats, à l'énergie et aux prestataires/u);
});

test("le verbe s'accorde avec le poste, pas avec le nombre de postes", () => {
  // « Vient ensuite les achats, l'énergie et les prestataires » se lisait sur
  // toute commune dont la hausse n'a qu'un second poste.
  const unSeulSuivant = blocs({
    niveau: "commune",
    nom: "Ailleurs",
    series: {
      ofgl_depenses_fonctionnement: { "2019": 100e6, "2025": 130e6 },
      ofgl_frais_personnel: { "2019": 50e6, "2025": 70e6 },
      ofgl_achats_et_charges_externes: { "2019": 30e6, "2025": 40e6 },
      ofgl_charges_financieres: { "2019": 20e6, "2025": 20e6 },
    },
    catalogue: CATALOGUE,
  });
  assert.match(
    lu(unSeulSuivant[0].texte),
    new RegExp(`Viennent ensuite les achats, l'énergie et les prestataires \\(\\+10,00${U}millions d'euros\\)\\.$`, "u"),
  );
});

test("le pluriel des années commence à deux", () => {
  const court = blocs({
    niveau: "commune",
    nom: "Bordeaux",
    series: { ...BORDEAUX, ofgl_encours_dette: { "2019": 252257675.39, "2025": 48126337.27 } },
    catalogue: CATALOGUE,
  });
  assert.match(lu(court[2].texte), /Il faudrait 1,0 année d'épargne/u);
});

/* ------------------------------------------------------------------------
 * Le rendu.
 * ---------------------------------------------------------------------- */

test("le titre du bloc est un h3 dans une section, sans micro-label gris", () => {
  const rendu = rendreBlocs(deBordeaux());
  assert.equal([...rendu.matchAll(/<section class="bloc-lecture">/gu)].length, 4);
  assert.match(rendu, /<h3>Le train de vie<\/h3>/u);
  // Le gras porte le montant, la part, le poste.
  assert.match(rendu, /<strong>369,0/u);
  // Le terme comptable reste dans l'infobulle.
  assert.match(rendu, /<abbr title="Frais de personnel">/u);
  assert.match(rendu, /<abbr title="Dotation globale de fonctionnement">/u);
  assert.equal(rendreBlocs([]), "");
});

/**
 * Le terme de l'infobulle est celui de la source, accentué.
 *
 * L'OFGL saisit « Concours de l'Etat » sans accent : une faute d'orthographe à
 * l'écran décrédibilise le chiffre posé à côté. Et quand ce concours est
 * lui-même ce qui porte la hausse, la clause qui le redirait — « pendant ce
 * temps, ce que l'État verse à la ville augmente » — ne s'écrit pas.
 */
test("le concours de l'État se dit une fois, et son libellé est accentué", () => {
  const [qui] = blocs({
    niveau: "commune",
    nom: "Ailleurs",
    series: {
      ofgl_recettes_fonctionnement: { "2019": 100e6, "2025": 130e6 },
      ofgl_concours_de_l_etat: { "2019": 20e6, "2025": 45e6 },
      ofgl_impots_et_taxes: { "2019": 60e6, "2025": 60e6 },
      ofgl_ventes_de_biens_et_services: { "2019": 20e6, "2025": 25e6 },
    },
    catalogue: CATALOGUE,
  });
  assert.match(qui.texte, /<abbr title="Concours de l&#39;État">Ce que l&#39;État lui verse<\/abbr>/u);
  assert.equal([...lu(qui.texte).matchAll(/l'État/gu)].length, 1);
  assert.deepEqual(qui.cites, ["ofgl_recettes_fonctionnement", "ofgl_concours_de_l_etat"]);
  assert.equal(rendreBlocs([]), "");
});

test("une maille sans comptes publiés n'écrit aucun bloc", () => {
  assert.deepEqual(blocs({ niveau: "commune", nom: "X", series: {}, catalogue: CATALOGUE }), []);
  assert.deepEqual(
    blocs({ niveau: "intercommunalite", nom: "X", series: BORDEAUX, catalogue: CATALOGUE }),
    [],
  );
});
