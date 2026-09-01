import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SCENARIO_V10_CATALOGUE } from "./scenario-v10-catalogue.ts";
import {
  SCENARIO_V11_CATALOGUE,
  V11_ADAPTIVE_DECISION_IDS,
  V11_COMMON_DECISION_IDS,
  V11_SYNTHESIS_DECISION_IDS,
  v11PolicyById,
} from "./scenario-v11-catalogue.ts";

const TARGET_OPTIONS = [
  ["Fusionner l'impôt sur le revenu et la CSG ?", ["Créer un impôt unique et progressif", "Garder le système actuel"]],
  ["Quels taux de TVA appliquer ?", ["Garder les taux", "Passer le taux normal à 21 %", "Relever la TVA de la restauration", "Cumuler les hausses et renforcer le contrôle"]],
  ["Comment faire contribuer les grands groupes ?", ["Garder les règles", "Pérenniser la surtaxe sur les bénéfices", "Augmenter la taxe sur les rachats d'actions"]],
  ["Comment taxer les très grandes fortunes ?", ["Garder les règles", "Taxer le patrimoine financier", "Taxer 2 % au-delà de 100 M€"]],
  ["Supprimer certaines réductions sur l'épargne ?", ["Supprimer une liste publiée", "Garder la liste actuelle"]],
  ["Comment taxer les héritages ?", ["Garder les règles", "Abattement de 300 000 € par enfant", "Réduire l'avantage de l'assurance-vie", "Supprimer les droits"]],
  ["Quelles aides à l'emploi conserver ?", ["Garder les aides", "Cibler l'apprentissage", "Réduire les exonérations au-dessus de 2,5 SMIC", "Cumuler les deux réformes"]],
  ["Réduire les aides fiscales aux entreprises ?", ["Garder les dispositifs", "Réduire les subventions directes", "Recentrer le crédit impôt recherche", "Réduire les deux dispositifs"]],
  ["À quel âge partir à la retraite ?", ["Revenir à 62 ans", "Garder la règle actuelle", "Aller vers 65 ans"]],
  ["Faire progresser les pensions moins vite que les prix ?", ["Indexer sur les prix", "Retirer un point à la revalorisation"]],
  ["Réduire l'assurance chômage ?", ["Garder les droits", "Réduire les droits selon un barème"]],
  ["Ajouter une retraite par capitalisation ?", ["Garder la répartition seule", "Ajouter un fonds collectif"]],
  ["Passer la durée légale à 39 heures ?", ["Garder 35 heures", "Passer à 39 heures, salaire précisé"]],
  ["Comment augmenter le revenu tiré du travail ?", ["Garder les règles", "Augmenter le SMIC", "Remplacer la prime par moins de prélèvements"]],
  ["Qui doit financer davantage les soins ?", ["Garder les règles", "Doubler les franchises", "Taxer davantage le sucre et l'alcool", "Cumuler franchises et taxes"]],
  ["Acheter d'abord les médicaments comparables ?", ["Privilégier les équivalents, sauf raison médicale", "Garder les règles"]],
  ["Réduire les arrêts maladie évitables ?", ["Renforcer prévention et contrôle médical", "Garder le dispositif"]],
  ["Où recruter dans les métiers du soin ?", ["À l'hôpital", "Dans le grand âge", "Dans les deux", "Ne pas ajouter de postes"]],
  ["Simplifier l'accès aux prestations sociales ?", ["Garder les démarches", "Unifier la demande et le versement", "Unifier et renforcer le recouvrement"]],
  ["Augmenter le RSA ?", ["Garder le montant", "Le relever selon un barème publié"]],
  ["Supprimer l'aide médicale d'État ?", ["Garder l'AME", "La supprimer en maintenant les soins obligatoires"]],
  ["Remplacer les complémentaires par une couverture publique ?", ["Garder le système", "Créer une couverture publique unique"]],
  ["Réduire les effectifs ou les rémunérations publiques ?", ["Garder la trajectoire", "Ne pas remplacer une partie des départs", "Réduire le coût des absences", "Cumuler les deux réformes"]],
  ["Réduire les frais de structure de l'État ?", ["Garder l'organisation", "Regrouper des opérateurs", "Mutualiser les achats", "Regrouper opérateurs, achats et immobilier"]],
  ["Quel rôle d'actionnaire pour l'État ?", ["Vendre des participations nommées", "Les conserver", "Nationaliser des entreprises nommées"]],
  ["Réorganiser les collectivités ?", ["Garder l'organisation", "Transférer les compétences et leur financement", "Supprimer les départements", "Cumuler les deux réformes"]],
  ["Élire l'Assemblée à la proportionnelle ?", ["Garder le scrutin", "Passer à la proportionnelle"]],
  ["Où mettre plus de moyens dans l'école ?", ["Garder les moyens", "Augmenter les salaires enseignants", "Réduire la taille des classes prioritaires"]],
  ["Doubler les bourses étudiantes ?", ["Garder le barème", "Doubler le montant des étudiants déjà éligibles"]],
  ["Construire des logements ou augmenter les APL ?", ["Garder les règles", "Financer plus de logements sociaux", "Augmenter les APL"]],
  ["Créer 200 000 places de crèche ?", ["Garder le rythme", "Financer 200 000 places"]],
  ["Verser les allocations dès le premier enfant ?", ["Garder le droit au deuxième enfant", "Ouvrir dès le premier enfant"]],
  ["Qui doit piloter et financer l'école ?", ["Garder le cadre national", "Donner plus d'autonomie et de choix", "Réduire le financement du privé", "Cumuler les deux réformes"]],
  ["Rendre un service national obligatoire ?", ["Le garder volontaire", "L'étendre à une classe d'âge avec exemptions"]],
  ["Faut-il recruter davantage de policiers et gendarmes ?", ["Garder les effectifs prévus", "Recruter police et gendarmerie"]],
  ["Décider plus vite sur les demandes d'asile ?", ["Garder les moyens", "Renforcer l'instruction et réduire les délais", "Réduire les délais et supprimer l'allocation"]],
  ["Exécuter davantage d'OQTF ?", ["Garder les moyens", "Augmenter les éloignements et la rétention"]],
  ["Doubler les cours de français et l'aide vers l'emploi ?", ["Garder les moyens", "Doubler cours et accompagnement"]],
  ["Attendre cinq ans avant de recevoir certaines aides ?", ["Garder les règles actuelles", "Exiger cinq ans de résidence régulière"]],
  ["Fixer des objectifs d'immigration de travail ?", ["Garder les règles par titre", "Fixer des objectifs par métier"]],
  ["Fixer des peines minimales en cas de récidive ?", ["Garder l'individualisation", "Fixer un seuil avec dérogation motivée"]],
  ["Légaliser et taxer le cannabis ?", ["Garder l'interdiction", "Créer un marché légal encadré et taxé"]],
  ["Rénover davantage les logements ?", ["Garder le budget", "Doubler l'aide avec des règles publiées"]],
  ["Rénover davantage le réseau ferroviaire ?", ["Garder les crédits", "Augmenter les crédits"]],
  ["Comment aider au passage à l'électrique ?", ["Cibler les ménages modestes qui roulent beaucoup", "Garder le bonus large", "Supprimer les aides"]],
  ["Quel avenir pour le nucléaire ?", ["Construire six EPR2 et prolonger le parc", "Prolonger sans nouvel EPR2", "Fermer d'ici 2040"]],
  ["Taxer davantage les énergies fossiles ?", ["Ne pas relever", "Relever sans remboursement", "Relever et verser une aide ciblée", "Relever aussi la taxe sur les billets d'avion"]],
  ["Arrêter les nouveaux projets renouvelables ?", ["Poursuivre les projets autorisés", "Suspendre les nouveaux projets"]],
  ["Supprimer des avantages fiscaux sur les fossiles ?", ["Garder les avantages", "Supprimer une liste publiée avec transition"]],
  ["À quel rythme augmenter le budget militaire ?", ["Accélérer vers 3 % du PIB", "Tenir la programmation", "Décaler la hausse"]],
  ["Comment renforcer les effectifs disponibles ?", ["Doubler la réserve", "Créer un service militaire volontaire", "Garder les dispositifs"]],
  ["Renforcer le renseignement intérieur ?", ["Garder la trajectoire", "Doubler recrutements, outils et contrôles"]],
  ["Quel niveau de défense partager en Europe ?", ["Garder les décisions nationales", "Acheter et financer en commun", "Intégrer des unités sous commandement commun", "Financer l'effort en réduisant l'aide au développement"]],
  ["Quitter l'euro ?", ["Rester dans l'euro", "Rétablir une monnaie nationale"]],
  ["Organiser un référendum sur la sortie de l'Union ?", ["Ne pas l'organiser", "Organiser le référendum"]],
  ["Faut-il recruter davantage de magistrats et greffiers ?", ["Garder les effectifs prévus", "Recruter magistrats et greffiers"]],
  ["Faut-il construire 15 000 places de prison ?", ["Garder la trajectoire", "Construire 15 000 places"]],
] as const;

test("le catalogue V11 contient les 57 dilemmes et les options ciblées", () => {
  assert.equal(SCENARIO_V11_CATALOGUE.version, 11);
  assert.equal(SCENARIO_V11_CATALOGUE.decisions.length, 57);
  assert.equal(new Set(SCENARIO_V11_CATALOGUE.decisions.map((decision) => decision.id)).size, 57);
  assert.equal(SCENARIO_V11_CATALOGUE.chapters.length, 8);
  assert.deepEqual(SCENARIO_V11_CATALOGUE.decisions.map((decision) => [decision.displayCopy?.question, decision.options.map((option) => option.displayCopy?.shortLabel)]), TARGET_OPTIONS);
  assert.equal(v11PolicyById(SCENARIO_V11_CATALOGUE.decisions[0]!.id)?.id, SCENARIO_V11_CATALOGUE.decisions[0]!.id);
});

test("le catalogue V11 contient au moins une combinaison qui couvre 153 milliards d'euros", () => {
  const maximum = SCENARIO_V11_CATALOGUE.decisions.reduce((total, decision) => total + Math.max(
    ...decision.options.map((option) => option.budgetProfile.runRateMillions),
  ), 0);
  assert.ok(maximum >= 152_532, `${maximum} M€ seulement`);
});

test("V11 porte une copie visible complète et seulement des profils V10, combinés ou nuls", () => {
  const v10Profiles = new Set(SCENARIO_V10_CATALOGUE.decisions.flatMap((decision) => decision.options)
    .map((option) => JSON.stringify(option.budgetProfile)));
  const prohibited = /audité|documenté|concret|crédible|impact à préciser|effet distributif|conséquence institutionnelle|—/i;
  for (const decision of SCENARIO_V11_CATALOGUE.decisions) {
    assert.ok(decision.displayCopy?.question.trim(), `${decision.id}:question`);
    assert.ok(decision.displayCopy?.context.trim(), `${decision.id}:context`);
    for (const option of decision.options) {
      assert.ok(option.displayCopy?.shortLabel.trim(), `${option.id}:shortLabel`);
      assert.ok(option.displayCopy?.outcome.trim(), `${option.id}:outcome`);
      assert.equal(prohibited.test(JSON.stringify(option.displayCopy)), false, option.id);
      const combined = option.budgetProfile.estimateKey?.startsWith("combined-") === true;
      assert.equal(v10Profiles.has(JSON.stringify(option.budgetProfile)) || combined || option.budgetProfile.runRateMillions === 0, true, option.id);
      if (combined) assert.equal(new Set(option.budgetProfile.exclusiveScopeKeys).size, option.budgetProfile.exclusiveScopeKeys.length, option.id);
    }
  }
});

test("les rôles V11 couvrent les 57 décisions sans doublon", () => {
  assert.equal(V11_COMMON_DECISION_IDS.length, 10);
  assert.equal(V11_SYNTHESIS_DECISION_IDS.length, 3);
  assert.equal(V11_ADAPTIVE_DECISION_IDS.length, 44);
  const ids = [...V11_COMMON_DECISION_IDS, ...V11_SYNTHESIS_DECISION_IDS, ...V11_ADAPTIVE_DECISION_IDS];
  assert.equal(new Set(ids).size, 57);
  assert.deepEqual(new Set(ids), new Set(SCENARIO_V11_CATALOGUE.decisions.map((decision) => decision.id)));
});

test("la copie V11 est rédigée carte par carte, sans réserve interne ni panneau vide", () => {
  const banned = /Ce choix fixe une règle nationale|Montant annuel\s*:\s*à dériver|à chiffrer|cadratin|—/i;
  const acronyms: readonly [string, RegExp][] = [
    ["TVA", /taxe sur la valeur ajoutée/i], ["SMIC", /salaire minimum/i], ["RSA", /revenu de solidarité active/i],
    ["AME", /aide médicale de l'État/i], ["APL", /aide personnelle au logement/i], ["OQTF", /obligation de quitter le territoire français/i],
    ["EPR2", /réacteur nucléaire|nouveau réacteur/i], ["PIB", /production nationale|produit intérieur brut/i], ["CSG", /contribution sociale généralisée/i],
  ];
  for (const decision of SCENARIO_V11_CATALOGUE.decisions) {
    const visible = JSON.stringify(decision.displayCopy);
    assert.equal(banned.test(visible), false, decision.id);
    for (const [acronym, expansion] of acronyms) {
      if (visible.includes(acronym) && decision.id !== "v11-01-prelevement-personnel") assert.match(visible, expansion, `${decision.id}:${acronym}`);
    }
    for (const option of decision.options) {
      const details = option.displayCopy?.details;
      assert.ok(details && Object.keys(details).length > 0, `${option.id}:details`);
      assert.equal(banned.test(JSON.stringify(option.displayCopy)), false, option.id);
    }
  }
});

test("la copie reprend des résultats précis dans les trois decks", () => {
  const forbidden = [
    "modifie la règle pour les personnes, entreprises ou services concernés.",
    "Le financement dépend du dispositif retenu et des personnes concernées.",
  ];
  const byQuestion = new Map(SCENARIO_V11_CATALOGUE.decisions.map((decision) => [decision.displayCopy!.question, decision]));
  const examples: readonly [string, string, string][] = [
    ["Quels taux de TVA appliquer ?", "Passer le taux normal à 21 %", "Les achats au taux normal peuvent coûter plus cher"],
    ["À quel âge partir à la retraite ?", "Revenir à 62 ans", "peuvent partir plus tôt"],
    ["Qui doit financer davantage les soins ?", "Doubler les franchises", "patients paient davantage"],
    ["Augmenter le RSA ?", "Le relever selon un barème publié", "revenu de solidarité active plus élevé"],
    ["Construire des logements ou augmenter les APL ?", "Financer plus de logements sociaux", "effets sur les loyers arrivent plus tard"],
    ["Exécuter davantage d'OQTF ?", "Augmenter les éloignements et la rétention", "sans promettre un nombre de retours"],
    ["Légaliser et taxer le cannabis ?", "Créer un marché légal encadré et taxé", "vente devient légale"],
    ["Quel avenir pour le nucléaire ?", "Construire six EPR2 et prolonger le parc", "six nouveaux réacteurs"],
    ["À quel rythme augmenter le budget militaire ?", "Accélérer vers 3 % du PIB", "commandes, stocks et recrutements"],
    ["Quitter l'euro ?", "Rétablir une monnaie nationale", "contrats, dépôts, dettes et paiements"],
  ];
  for (const [question, label, expected] of examples) {
    const option = byQuestion.get(question)?.options.find((candidate) => candidate.displayCopy?.shortLabel === label);
    assert.match(option?.displayCopy?.outcome ?? "", new RegExp(expected, "i"), `${question}:${label}`);
  }
  for (const option of SCENARIO_V11_CATALOGUE.decisions.flatMap((decision) => decision.options)) {
    for (const phrase of forbidden) assert.doesNotMatch(JSON.stringify(option.displayCopy), new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("la copie ne fabrique aucun résultat à partir du libellé ou du contexte", () => {
  const source = readFileSync(new URL("./scenario-v11-copy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /genericCopy|:\s*\$\{contexts\[index\]\}/);
  let paidOrAffected = 0;
  for (const decision of SCENARIO_V11_CATALOGUE.decisions) {
    assert.ok(decision.options.some((option) => (option.displayCopy?.details.whatChanges?.length ?? 0) > 25), decision.id);
    for (const option of decision.options) {
      const copy = option.displayCopy!;
      assert.ok(copy.details.whatChanges?.trim(), `${option.id}:whatChanges`);
      assert.equal(copy.outcome.startsWith(`${copy.shortLabel}:`), false, option.id);
      if ((copy.details.whoPays?.length ?? 0) + (copy.details.whoGainsOrLoses?.length ?? 0) > 0) paidOrAffected += 1;
    }
  }
  assert.ok(paidOrAffected / SCENARIO_V11_CATALOGUE.decisions.flatMap((decision) => decision.options).length >= 0.8);
});
