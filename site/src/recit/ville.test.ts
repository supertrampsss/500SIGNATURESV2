import assert from "node:assert/strict";
import { test } from "node:test";
import { repereFrance, ville } from "./calculs.ts";
import { etapesVille } from "./ville.ts";

const an = (v: number) => ({ "2025": v });
const bordeaux = {
  nom: "Bordeaux", parent: "33", population: 267991, drapeaux: {},
  series: {
    ofgl_recettes_fonctionnement: an(417.14e6), ofgl_depenses_fonctionnement: an(369.01e6), ofgl_epargne_brute: an(48.13e6),
    ofgl_remboursements_d_emprunts_hors_gad: an(33.73e6), ofgl_epargne_nette: an(14.4e6),
    ofgl_impots_locaux: an(253.98e6), ofgl_autres_impots_et_taxes: an(43.94e6), ofgl_concours_de_l_etat: an(44.82e6), ofgl_ventes_de_biens_et_services: an(47.78e6), ofgl_subventions_recues_et_participations: an(16.56e6),
    ofgl_frais_personnel: an(183.05e6), ofgl_achats_et_charges_externes: an(85.7e6), ofgl_depenses_d_intervention: an(86.73e6), ofgl_charges_financieres: an(8.29e6),
    ofgl_subventions_aux_personnes_de_droit_prive: an(48.31e6), etat_subventions_associations: { "2021": 91.95e6 }, etat_subventions_associations_etablissements: { "2021": 568 },
    fonction_commune_enseignement: an(68.4e6), fonction_commune_securite: an(11.9e6), fonction_commune_retraitements_ofgl: an(-35.9e6),
    dgfip_taux_tfb_commune: an(48.48), dgfip_taux_tfb_global: an(49.54), dgfip_produit_foncier_bati: an(248.4e6),
    ssmsi_violences_hors_famille_nombre: an(1364), ssmsi_cambriolages_nombre: an(1159), ssmsi_degradations_nombre: an(3946),
    insee_taux_pauvrete: { "2023": 18.9 }, insee_actifs: { "2023": 142651 }, insee_chomeurs_rp: { "2023": 16878 },
  },
};

test("une commune se lit poste par poste, au total publié, et face à la France", () => {
  const v = ville(bordeaux, "33063")!;
  assert.equal(v.annee, "2025");
  const somme = (l: [string, number][]) => l.reduce((a, x) => a + x[1], 0);
  assert.ok(Math.abs(somme(v.entrees!) - v.recettes) < 1, "les entrées redonnent les recettes");
  assert.ok(Math.abs(somme(v.sorties!) - v.depenses) < 1, "les sorties redonnent les dépenses");
  assert.deepEqual(v.missions!.lignes.map(l => l[0]), ["Écoles et formation", "Sécurité et salubrité"], "le retraitement négatif n'est pas une mission");
  assert.equal(v.associations!.etat!.nombre, 568);
  assert.equal(v.delits!.lignes[0][0], "violences_hors_famille");
  assert.ok(Math.abs(v.delits!.lignes[0][3] - 1364 / 267991 * 1000) < 1e-9);
  assert.ok(Math.abs(v.portrait!.chomage![1] - 16878 / 142651 * 100) < 1e-9);

  const france = repereFrance({ nom: "France", parent: null, population: null, drapeaux: {}, series: { ssmsi_violences_hors_famille_nombre: an(215728), eurostat_population: an(68.6e6), insee_taux_pauvrete_60: { "2024": 15.4 } } });
  const etapes = etapesVille(v, france);
  const sujets = etapes.map(e => e.attributs?.["data-sujet"]);
  assert.deepEqual(sujets, ["recettes", "depenses", "missions", "associations", "reste", "foncier", "securite", "portrait"]);
  assert.ok(etapes.every(e => !("source" in e)), "les sources sont en pied de page");
  assert.match(etapes.find(e => e.attributs?.["data-sujet"] === "securite")!.sous!, /France : 3,1/);
  assert.match(etapes.at(-1)!.contenu!, /Choisir une autre ville/);
  assert.doesNotMatch(JSON.stringify(etapes), /fonctionnement/i, "aucun jargon comptable");
});

test("une commune sans détail garde ses comptes, sans étape vide", () => {
  const { series } = bordeaux;
  const v = ville({ ...bordeaux, population: null, series: { ofgl_recettes_fonctionnement: series.ofgl_recettes_fonctionnement, ofgl_depenses_fonctionnement: series.ofgl_depenses_fonctionnement, ofgl_epargne_brute: series.ofgl_epargne_brute } }, "33063")!;
  const etapes = etapesVille(v);
  assert.deepEqual(etapes.map(e => e.attributs?.["data-sujet"]), ["recettes", "depenses", "reste"]);
  assert.ok(etapes.every(e => e.valeur === undefined || (Number.isFinite(e.valeur) && e.valeur !== 0)));
});
