import assert from "node:assert/strict";
import { test } from "node:test";

import { EXPRESS_PAR_ACTE } from "./campagne.ts";
import { DILEMMES, dilemmeDe } from "./dilemmes.ts";

const ATTENDUS = [
  ["flat-tax-a-20-avec-abattement-protegeant", "Baisser la flat tax tout en protégeant les revenus modestes ?", "Baisser", ["détenteurs de capital"], ["budget public"], "Maintenir", ["budget public"], ["détenteurs de capital"]],
  ["exonerer-de-droits-de-succession-jusqu-a", "Exonérer les successions jusqu'au seuil prévu par enfant ?", "Exonérer", ["héritiers concernés"], ["budget public"], "Conserver", ["budget public"], ["héritiers concernés"]],
  ["raboter-de-5-les-subventions-directes-aux", "Réduire de 5 % les subventions directes aux entreprises ?", "Réduire", ["budget public"], ["entreprises aidées"], "Maintenir", ["entreprises aidées"], ["contribuables"]],
  ["achever-la-suppression-de-la-cvae", "Achever la suppression de la CVAE ?", "Supprimer", ["entreprises redevables"], ["finances publiques et territoires"], "Conserver", ["finances publiques et territoires"], ["entreprises redevables"]],
  ["aligner-la-csg-des-retraites-aises-sur", "Aligner la CSG des retraités aisés sur celle des actifs ?", "Aligner", ["actifs et budget social"], ["retraités aisés"], "Refuser", ["retraités aisés"], ["actifs et budget social"]],
  ["reconduire-la-surtaxe-des-grandes-entreprises", "Reconduire la surtaxe des grandes entreprises ?", "Reconduire", ["budget public"], ["grandes entreprises"], "Arrêter", ["grandes entreprises"], ["contribuables"]],
  ["desindexer-les-pensions-d-un-point", "Désindexer les pensions d'un point ?", "Désindexer", ["budget social"], ["retraités"], "Indexer", ["retraités"], ["futurs budgets sociaux"]],
  ["repousser-l-age-legal-a-65-ans", "Repousser l'âge légal à 65 ans ?", "Repousser", ["finances sociales"], ["actifs proches de la retraite"], "Maintenir", ["actifs proches de la retraite"], ["finances sociales"]],
  ["supprimer-l-aide-medicale-d-etat", "Supprimer l'aide médicale d'État ?", "Supprimer", ["budget à court terme"], ["bénéficiaires et hôpitaux"], "Conserver", ["bénéficiaires et prévention"], ["budget public"]],
  ["porter-l-effort-de-defense-vers-3", "Porter l'effort de défense vers 3 % du PIB ?", "Porter", ["armées et industrie de défense"], ["autres budgets"], "Maintenir", ["autres budgets"], ["armées et industrie de défense"]],
  ["plan-ferroviaire-3-000-m-de-plus", "Ajouter le plan ferroviaire prévu ?", "Ajouter", ["voyageurs et territoires"], ["budget public"], "Refuser", ["budget public"], ["voyageurs et territoires"]],
  ["privatiser-l-audiovisuel-public", "Privatiser l'audiovisuel public ?", "Privatiser", ["budget public et acteurs privés"], ["service public audiovisuel"], "Conserver", ["service public audiovisuel"], ["budget public"]],
  ["doubler-les-franchises-medicales", "Doubler les franchises médicales ?", "Doubler", ["assurance maladie"], ["patients"], "Maintenir", ["patients"], ["assurance maladie"]],
  ["revaloriser-les-enseignants-de-5", "Revaloriser les enseignants de 5 % ?", "Revaloriser", ["enseignants et attractivité scolaire"], ["budget public"], "Refuser", ["budget public"], ["enseignants et attractivité scolaire"]],
  ["geler-le-point-d-indice-en-2026", "Geler le point d'indice en 2026 ?", "Geler", ["budget public"], ["agents publics"], "Revaloriser", ["agents publics"], ["budget public"]],
  ["fermer-un-tiers-des-agences-et-operateurs", "Fermer un tiers des agences et opérateurs ?", "Fermer", ["budget public"], ["agents et services concernés"], "Conserver", ["services concernés"], ["budget public"]],
  ["ceder-des-participations-non-strategiques-de-l", "Céder des participations non stratégiques de l'État ?", "Céder", ["dette à court terme"], ["dividendes futurs et contrôle public"], "Conserver", ["dividendes futurs et contrôle public"], ["dette à court terme"]],
  ["doubler-les-moyens-contre-la-fraude-fiscale", "Doubler les moyens contre la fraude fiscale et sociale ?", "Doubler", ["contribuables conformes et budget public"], ["fraudeurs"], "Maintenir", ["fraudeurs"], ["budget public et contribuables conformes"]],
  ["reduire-l-aide-publique-au-developpement-de", "Réduire de moitié l'aide publique au développement ?", "Réduire", ["budget national"], ["pays bénéficiaires et influence diplomatique"], "Maintenir", ["pays bénéficiaires et influence diplomatique"], ["budget national"]],
  ["porter-le-taux-normal-de-tva-a", "Porter le taux normal de TVA à 21 % ?", "Augmenter", ["budget public"], ["consommateurs"], "Maintenir", ["consommateurs"], ["budget public"]],
  ["reduire-de-5-les-dotations-aux-collectivites", "Réduire de 5 % les dotations aux collectivités ?", "Réduire", ["budget de l'État"], ["collectivités et services locaux"], "Maintenir", ["collectivités et services locaux"], ["budget de l'État"]],
] as const;

test("chaque candidat express possède deux choix contradictoires complets", () => {
  const ids = Object.values(EXPRESS_PAR_ACTE).flat();
  assert.equal(Object.keys(DILEMMES).length, ids.length);
  for (const id of ids) {
    const d = DILEMMES[id];
    assert.ok(d, id);
    assert.ok(d.question.endsWith("?"), id);
    assert.ok(d.contradiction.length >= 45, id);
    for (const choix of [d.adopter, d.rejeter]) {
      assert.ok(choix.libelle.length >= 4, id);
      assert.ok(choix.gagnants.length, id);
      assert.ok(choix.perdants.length, id);
      assert.equal(
        choix.argument,
        `${choix.gagnants.join(" et ")} en bénéficient ; ${choix.perdants.join(" et ")} en supportent le coût.`,
        id,
      );
    }
  }
});

test("les questions, verbes et camps de la campagne suivent la matrice éditoriale", () => {
  for (const [id, question, adopter, gagnantsAdopter, perdantsAdopter, rejeter, gagnantsRejeter, perdantsRejeter] of ATTENDUS) {
    const d = dilemmeDe(id);
    assert.ok(d, id);
    assert.equal(d.question, question, id);
    assert.deepEqual([d.adopter.libelle, d.adopter.gagnants, d.adopter.perdants], [adopter, gagnantsAdopter, perdantsAdopter], id);
    assert.deepEqual([d.rejeter.libelle, d.rejeter.gagnants, d.rejeter.perdants], [rejeter, gagnantsRejeter, perdantsRejeter], id);
  }
  assert.equal(dilemmeDe("inconnu"), undefined);
});

test("les dilemmes ne transportent aucun montant : les chiffres restent dans les mesures", () => {
  assert.doesNotMatch(JSON.stringify(DILEMMES), /\d+[.,]?\d*\s*(M€|Md€|€)/);
});
