/**
 * Le tunnel et sa pile.
 *
 * Trois familles de garanties, qui ne se vérifient nulle part ailleurs :
 * l'intégrité du catalogue (chaque mesure porte tout ce que sa carte affiche,
 * et ses verrous pointent des contrats qui existent) ; la mécanique du jeu
 * (un tampon par mesure, l'ajournée revient, le compteur ne devient jamais
 * négatif, l'équilibre ne se franchit qu'à reste nul) ; et la frontière
 * éditoriale (les ordres de grandeur et les règles du jeu sont annoncés comme
 * tels dans le rendu — c'est ce qui sépare le tunnel du reste du site).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTRATS } from "./mission.ts";
import { MESURES } from "./mesures.ts";
import {
  ajourner,
  REPORTS_GRATUITS,
  TELEX,
  annuler,
  collectionner,
  decorations,
  basculerEngagement,
  bilanTexte,
  decoderDefi,
  encoderDefi,
  restaurer,
  reprendre,
  comble,
  commencer,
  courante,
  etatInitial,
  paliersTunnel,
  pile,
  profil,
  rendu,
  renduConseil,
  renduMission,
  renduVerdict,
  soutiens,
  tamponner,
  trouve,
  verifierCensure,
  poursuivreTelex,
  trancherTelex,
  verifierTelex,
  type EtatTunnel,
} from "./tunnel.ts";

const MISSION = 159_297e6;

/** Un conseil ouvert sans engagement : la pile entière. */
function conseil(): EtatTunnel {
  return commencer(etatInitial());
}

/** Tamponner la mesure courante par son id attendu — le test échoue si la
 *  pile ne présente pas celle qu'on croit. */
function adopterId(etat: EtatTunnel, id: string): EtatTunnel {
  while (courante(etat) && courante(etat)!.id !== id) {
    etat = tamponner(etat, "rejete");
  }
  assert.equal(courante(etat)?.id, id, `« ${id} » n'est pas dans la pile`);
  return tamponner(etat, "adopte");
}

test("le catalogue est entier : 96 mesures, ids uniques, cartes complètes", () => {
  assert.equal(MESURES.length, 96);
  assert.equal(new Set(MESURES.map((m) => m.id)).size, 96);
  for (const m of MESURES) {
    assert.ok(m.titre.length > 8, m.id);
    // « Évaluations LFSS. » est courte et suffisante : elle nomme la source.
    assert.ok(m.detail.length >= 15, `${m.id} : une carte sans provenance ne se défend pas`);
    assert.ok(m.chapitre, m.id);
    assert.notEqual(m.effet, 0, `${m.id} : une mesure sans effet n'a rien à faire en conseil`);
    assert.ok(Object.keys(m.reactions).length >= 1, `${m.id} : aucune réaction déclarée`);
  }
});

test("chaque verrou pointe un contrat qui existe dans mission.ts", () => {
  const connus = new Set(CONTRATS.map((c) => c.cle));
  for (const m of MESURES) {
    for (const cle of m.bloqueePar ?? []) {
      assert.ok(connus.has(cle), `${m.id} : contrat inconnu « ${cle} »`);
    }
  }
});

test("les deux variantes de la flat tax coexistent, et se contredisent comme prévu", () => {
  // C'est la pédagogie du catalogue : « épargne les modestes » et « rapporte »
  // ne coexistent pas. La sèche rapporte énormément, celle à abattement coûte.
  const seche = MESURES.find((m) => m.id.startsWith("flat-tax-a-20-des"));
  const abattement = MESURES.find((m) => m.id.startsWith("flat-tax-a-20-avec"));
  assert.ok(seche && abattement);
  assert.ok(seche!.effet > 100_000 && abattement!.effet < 0);
  // Les fourchettes contestées sont AFFICHÉES : la précision fait partie du chiffre.
  assert.match(seche!.precision ?? "", /arithmétique/);
  const prestations = MESURES.find((m) => m.id.startsWith("reserver-les-prestations"));
  assert.match(prestations!.precision ?? "", /fourchette/);
});

test("signer un engagement retire ses mesures — dans les deux sens, comme le contrat", () => {
  const toutes = pile([]);
  assert.equal(toutes.length, 96);
  const sansEcole = pile(["ecole-sante"]);
  // « Sans toucher à l'école ni à la santé » retire AUSSI la revalorisation
  // des enseignants : un engagement n'est pas une préférence.
  assert.ok(!sansEcole.some((m) => m.id.startsWith("revaloriser-les-enseignants")));
  assert.ok(!sansEcole.some((m) => m.id.startsWith("doubler-les-franchises")));
  const sansImpot = pile(["sans-impot"]);
  assert.ok(!sansImpot.some((m) => m.id.startsWith("porter-le-taux-normal-de-tva")));
  // Les baisses d'impôt restent : ne pas lever n'interdit pas d'alléger.
  assert.ok(sansImpot.some((m) => m.id.startsWith("exonerer-de-droits-de-succession")));
  // Tout signer laisse quand même un jeu jouable.
  const toutSigne = pile(CONTRATS.map((c) => c.cle));
  assert.ok(toutSigne.length >= 40, `${toutSigne.length} mesures restantes`);
});

test("un tampon par mesure, et l'ajournée revient en fin de pile", () => {
  let etat = conseil();
  const premiere = courante(etat)!;
  etat = ajourner(etat);
  assert.notEqual(courante(etat)!.id, premiere.id, "l'ajournée ne doit pas rester sur le bureau");
  assert.equal(etat.ordre[etat.ordre.length - 1], premiere.id);
  assert.equal(etat.ordre.length, 96, "ajourner ne supprime pas");
  // Elle finit par revenir, et se tamponne comme les autres.
  etat = adopterId(etat, premiere.id);
  assert.equal(etat.tampons[premiere.id], "adopte");
});

test("rejeter est gratuit, adopter bouge le compteur — dans les deux sens", () => {
  let etat = conseil();
  etat = tamponner(etat, "rejete");
  assert.equal(trouve(etat), 0);
  etat = adopterId(etat, "porter-le-taux-normal-de-tva-a");
  assert.equal(trouve(etat), 9800);
  // Une mesure qui coûte retranche : créer des postes de soignants se paie.
  etat = adopterId(etat, "creer-5-000-postes-de-soignants");
  assert.equal(trouve(etat), 9800 - 350);
});

test("le compteur ne devient jamais négatif : dépenser ne crée pas une dette de mission", () => {
  let etat = conseil();
  etat = adopterId(etat, "revenir-a-62-ans");
  assert.ok(trouve(etat) < 0);
  assert.equal(comble(etat), 0);
  const paliers = paliersTunnel(etat, MISSION);
  assert.ok(paliers.every((p) => !p.franchi));
});

test("les paliers sont ceux de la mission, et l'équilibre exige un reste nul", () => {
  let etat = conseil();
  etat = adopterId(etat, "porter-le-taux-normal-de-tva-a");
  etat = adopterId(etat, "reconduire-la-surtaxe-des-grandes-entreprises");
  // 17 800 M€ : le premier palier (10 000) est franchi, pas le deuxième.
  const paliers = paliersTunnel(etat, MISSION);
  assert.deepEqual(
    paliers.map((p) => p.franchi),
    [true, false, false, false],
  );
  // Même comblé au-delà de tous les seuils ronds, l'équilibre reste fermé
  // tant qu'il reste un euro à trouver.
  const presque = paliersTunnel(etat, 17_800e6 + 1e6);
  assert.equal(presque[presque.length - 1]!.franchi, false);
  const equilibre = paliersTunnel(etat, 17_800e6);
  assert.equal(equilibre[equilibre.length - 1]!.franchi, true);
});

test("les soutiens réagissent aux tampons, restent bornés, et la rupture s'annonce sous 20", () => {
  let etat = conseil();
  const depart = soutiens(etat, MISSION);
  assert.deepEqual(
    depart.map((s) => s.nom),
    ["Opinion", "Entreprises", "Territoires", "Marchés"],
  );
  assert.ok(depart.every((s) => s.valeur >= 4 && s.valeur <= 96 && !s.danger));
  // La flat tax sèche fait plonger l'opinion (−20) et remonter les marchés.
  etat = adopterId(etat, "flat-tax-a-20-des-le-premier");
  const apres = soutiens(etat, MISSION);
  const opinion = apres.find((s) => s.cle === "opinion")!;
  const marches = apres.find((s) => s.cle === "marches")!;
  assert.equal(opinion.valeur, 42);
  assert.ok(marches.valeur > depart.find((s) => s.cle === "marches")!.valeur);
  assert.ok(!opinion.danger, "42 % n'est pas la rupture");
});

test("le profil nomme la forme du plan, jamais une note", () => {
  assert.equal(profil(conseil()).nom, "L'observateur");
  let percepteur = conseil();
  percepteur = adopterId(percepteur, "porter-le-taux-normal-de-tva-a");
  assert.equal(profil(percepteur).nom, "Le percepteur");
  let chirurgien = conseil();
  chirurgien = adopterId(chirurgien, "geler-le-point-d-indice-en-2026");
  assert.equal(profil(chirurgien).nom, "Le chirurgien");
  let relance = conseil();
  relance = adopterId(relance, "revenir-a-62-ans");
  assert.equal(profil(relance).nom, "La relance assumée");
  // Dans l'ordre du catalogue : `adopterId` rejette tout ce qui précède sa
  // cible, donc on adopte en avançant, jamais en revenant.
  let equilibriste = conseil();
  equilibriste = adopterId(equilibriste, "porter-le-taux-normal-de-tva-a");
  equilibriste = adopterId(equilibriste, "repousser-l-age-legal-a-65-ans");
  equilibriste = adopterId(equilibriste, "geler-le-point-d-indice-en-2026");
  assert.equal(profil(equilibriste).nom, "L'équilibriste");
});

test("la pile épuisée bascule d'elle-même sur le verdict", () => {
  let etat = conseil();
  while (courante(etat)) etat = tamponner(etat, "rejete");
  assert.equal(etat.phase, "verdict");
  assert.equal(Object.keys(etat.tampons).length, 96);
});

test("l'écran de mission écrit le vrai compteur et compte ce que chaque signature retire", () => {
  const html = renduMission(etatInitial(), MISSION);
  assert.match(html, /159\u202f297\u202fM€/);
  // Les intitulés sont échappés dans le rendu : « l'école » y est l&#39;école.
  const lisible = html.replace(/&#39;/g, "'");
  for (const contrat of CONTRATS) assert.ok(lisible.includes(contrat.nom), contrat.cle);
  const signe = basculerEngagement(etatInitial(), "ecole-sante");
  assert.match(renduMission(signe, MISSION), /11 mesures quittent la pile/);
});

test("la carte du conseil porte le montant, sa réserve, et la frontière éditoriale", () => {
  const html = renduConseil(conseil(), MISSION);
  // La première carte de la pile validée : la flat tax sèche, avec sa réserve.
  assert.match(html, /Flat tax à 20 %/);
  assert.match(html, /arithmétique brute/);
  assert.match(html, /150\u202f000\u202fM€/);
  assert.match(html, /Rejeter/);
  assert.match(html, /Adopter/);
  assert.match(html, /Ajourner/);
  const page = rendu(conseil(), MISSION);
  assert.match(page, /ordres de grandeur du débat public/);
  assert.match(page, /règles du jeu, pas des mesures/);
  // La porte vers l'atelier a été retirée de l'écran par le propriétaire.
  assert.doesNotMatch(page, /atelier expert/);
});

test("le verdict se partage sans balise et dit le comblé et les paliers", () => {
  let etat = conseil();
  etat = adopterId(etat, "porter-le-taux-normal-de-tva-a");
  while (courante(etat)) etat = tamponner(etat, "rejete");
  const html = renduVerdict(etat, MISSION);
  assert.match(html, /Le percepteur/);
  assert.match(html, /Rejouer/);
  assert.match(html, /Copier le bilan/);
  assert.match(html, /Porter le taux normal de TVA/);
});

test("le bilan copié tient en une phrase, chiffres compris", () => {
  // `location` n'existe pas sous node : le test le fournit, comme le
  // navigateur le ferait.
  (globalThis as { location?: { origin: string } }).location = {
    origin: "https://exemple.test",
  };
  let etat = conseil();
  etat = adopterId(etat, "porter-le-taux-normal-de-tva-a");
  while (courante(etat)) etat = tamponner(etat, "rejete");
  const texte = bilanTexte(etat, MISSION);
  assert.match(texte, /Le percepteur/);
  assert.match(texte, /9\u202f800/);
  assert.match(texte, /Faites mieux : https:\/\/exemple\.test\/simulateur/);
  delete (globalThis as { location?: unknown }).location;
});

test("le défi voyage dans l'adresse, et une adresse abîmée est ignorée en silence", () => {
  let etat = conseil();
  etat = { ...etat, engagements: ["ecole-sante", "sans-impot"] };
  etat = adopterId(etat, "reconduire-la-surtaxe-des-grandes-entreprises");
  const code = encoderDefi(etat);
  assert.equal(code, "8000~ecole-sante.sans-impot");
  const relu = decoderDefi(code);
  assert.deepEqual(relu, { comble: 8000, engagements: ["ecole-sante", "sans-impot"] });
  // Ce qui ne se lit pas n'ouvre rien : ni erreur, ni défi fantôme.
  assert.equal(decoderDefi(null), null);
  assert.equal(decoderDefi("n-importe-quoi"), null);
  assert.equal(decoderDefi("-5"), null);
  assert.equal(decoderDefi("999999999999"), null);
  // Un contrat inconnu est écarté, le défi tient sur ce qui reste.
  assert.deepEqual(decoderDefi("1200~inconnu.ecole-sante"), {
    comble: 1200,
    engagements: ["ecole-sante"],
  });
});

test("un défi reçu pré-signe les engagements et s'affiche sur la mission", () => {
  const etat = etatInitial({ comble: 12500, engagements: ["sans-prestation"] });
  assert.deepEqual(etat.engagements, ["sans-prestation"]);
  const html = renduMission(etat, MISSION);
  assert.match(html, /Défi reçu/);
  assert.match(html, /12 500 M€/);
  assert.match(html, /pré-signés/);
});

test("le verdict tranche le duel : battu, égalité, manqué", () => {
  const partie = (defi: number) => {
    let etat = { ...conseil(), defi: { comble: defi } };
    etat = adopterId(etat, "reconduire-la-surtaxe-des-grandes-entreprises");
    while (courante(etat)) etat = tamponner(etat, "rejete");
    return renduVerdict(etat, MISSION);
  };
  assert.match(partie(5000), /Défi <strong>battu<\/strong>/);
  assert.match(partie(8000), /Défi à <strong>égalité<\/strong>/);
  assert.match(partie(9000), /Défi <strong>manqué<\/strong>/);
  assert.match(partie(9000), /Défier quelqu'un/);
});

test("la partie survit au rechargement, et une sauvegarde abîmée est jetée entière", () => {
  // `sessionStorage` n'existe pas sous node : le test le fournit, minimal.
  const memoire = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  try {
    assert.equal(restaurer(), null, "rien de sauvé : rien à restaurer");
    let etat = conseil();
    etat = adopterId(etat, "porter-le-taux-normal-de-tva-a");
    memoire.set("tunnel-partie", JSON.stringify(etat));
    const relu = restaurer();
    assert.ok(relu);
    assert.equal(trouve(relu!), 9800);
    assert.equal(relu!.phase, "conseil");
    // Une pile qui cite une mesure disparue du catalogue est jetée ENTIÈRE :
    // mieux vaut recommencer que jouer une partie qui ne se terminera pas.
    memoire.set("tunnel-partie", JSON.stringify({ ...etat, ordre: [...etat.ordre, "disparue"] }));
    assert.equal(restaurer(), null);
    memoire.set("tunnel-partie", "{pas du json");
    assert.equal(restaurer(), null);
  } finally {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
});

test("les ancres publiées des cartes ne dérivent pas du reste du dépôt", () => {
  // Cinq cartes adossent leur ordre de grandeur à une ligne réellement
  // publiée, citée dans leur texte. Ces nombres-là ne sont pas des chiffrages
  // d'instituts : ce sont ceux que le site publie ailleurs (LFI 2025,
  // comptes des APU), et une régénération du catalogue ne doit pas les
  // emporter. C'est la première pierre de l'adossement ligne à ligne.
  const detail = (prefixe: string) => MESURES.find((m) => m.id.startsWith(prefixe))!.detail;
  assert.match(detail("geler-le-point-d-indice"), /370 016 M€/);
  assert.match(detail("desindexer-les-pensions"), /362 178 M€/);
  assert.match(detail("porter-l-effort-de-defense"), /60 004 M€/);
  // Le montant de la carte, lui, est l'écart vers la cible : 6 000, pas
  // 60 001 — la coquille qui a vécu en production s'était collé le « 1 »
  // de « 1re marche ».
  {
    const defense = MESURES.find((m) => m.id.startsWith("porter-l-effort-de-defense"))!;
    assert.equal(defense.effet, -6000);
    assert.equal(defense.precision, "1re marche");
  }
  assert.match(detail("revaloriser-les-enseignants"), /88 817 M€/);
  assert.match(detail("recruter-10-000-policiers"), /25 215 M€/);
});

test("adopter une mesure écarte ses incompatibles — et Annuler ramène tout", () => {
  // On ne vote pas deux barèmes de l'IR : la flat tax sèche écarte l'autre
  // variante, la tranche à 50, le gel du barème et la fin du PFU.
  let etat = conseil();
  etat = adopterId(etat, "flat-tax-a-20-des-le-premier");
  assert.equal(etat.tampons["flat-tax-a-20-avec-abattement-protegeant"], "exclue");
  assert.equal(etat.tampons["tranche-a-50-au-dela-de-250"], "exclue");
  assert.equal(etat.tampons["geler-le-bareme-de-l-impot-sur"], "exclue");
  assert.equal(etat.tampons["soumettre-les-revenus-du-capital-au-bareme"], "exclue");
  // Les ajouts de la passe des manques suivent la même règle : sous une flat
  // tax, ni le forfait des retraités ni la fiscalisation des heures sup n'ont
  // de sens — le barème qu'ils modifient n'existe plus.
  assert.equal(etat.tampons["remplacer-l-abattement-des-retraites-par"], "exclue");
  assert.equal(etat.tampons["fiscaliser-les-heures-supplementaires-comme-le"], "exclue");
  // Une exclue ne compte pas dans le trouvé, et ne repasse pas sur le bureau.
  assert.equal(trouve(etat), 150000);
  assert.notEqual(courante(etat)?.id, "flat-tax-a-20-avec-abattement-protegeant");
  // La symétrie vaut : 62 ans écarte 65 ans, déclaré de l'autre côté.
  let retraites = conseil();
  retraites = adopterId(retraites, "repousser-l-age-legal-a-65-ans");
  assert.equal(retraites.tampons["revenir-a-62-ans"], "exclue");
  // Annuler dépile le tampon ET ses exclusions.
  const avant = etat.historique.length;
  etat = annuler(etat);
  assert.equal(etat.historique.length, avant - 1);
  assert.equal(etat.tampons["flat-tax-a-20-des-le-premier"], undefined);
  assert.equal(etat.tampons["tranche-a-50-au-dela-de-250"], undefined);
  assert.equal(trouve(etat), 0);
  // Annuler sur une pile vierge ne fait rien.
  assert.equal(annuler(conseil()).historique.length, 0);
});

test("un soutien au tapis censure le gouvernement, et la censure s'annule", () => {
  // Des coups durs à l'opinion, adoptions ET rejets mêlés : la flat tax
  // sèche (−20), la TVA (−8, et les rejets de Zucman puis du panier en
  // route), 65 ans (−12) — à 12 %, elle tient encore. Puis rejeter le
  // retour à 62 ans (−3) et désindexer (−9) l'achèvent sous le seuil (10) :
  // depuis que le rejet a un prix, le mépris compte autant que la coupe.
  let etat = conseil();
  etat = verifierCensure(adopterId(etat, "flat-tax-a-20-des-le-premier"), MISSION);
  etat = verifierCensure(adopterId(etat, "porter-le-taux-normal-de-tva-a"), MISSION);
  etat = verifierCensure(adopterId(etat, "repousser-l-age-legal-a-65-ans"), MISSION);
  assert.equal(etat.phase, "conseil", "à 12 %, l'opinion tient encore");
  etat = verifierCensure(adopterId(etat, "desindexer-les-pensions-d-un-point"), MISSION);
  assert.equal(etat.phase, "verdict");
  assert.equal(etat.censure, "Opinion");
  const html = renduVerdict(etat, MISSION);
  assert.match(html, /Censuré/);
  assert.match(html, /le gouvernement tombe/);
  // Le geste de trop s'annule : la partie reprend au conseil.
  const reprise = annuler(etat);
  assert.equal(reprise.phase, "conseil");
  assert.equal(reprise.censure, undefined);
});

test("le journal nomme les écartées « incompatible », jamais « rejetée »", () => {
  let etat = conseil();
  etat = adopterId(etat, "flat-tax-a-20-des-le-premier");
  const html = renduConseil(etat, MISSION);
  assert.match(html, /incompatible/);
  assert.match(html, /Annuler le dernier tampon/);
});

test("un télex de crise tombe une fois, ne coûte rien avant d'être tranché, et chaque issue a son prix", () => {
  // Faire vaciller les Marchés sous 30 (adoptions et rejets mêlés font 21).
  // « Les taux montent » tombe : rien ne s'applique tant qu'on n'a pas
  // tranché — le dilemme se lit d'abord.
  let etat = conseil();
  etat = adopterId(etat, "flat-tax-a-20-avec-abattement-protegeant");
  etat = adopterId(etat, "retablir-un-impot-sur-la-fortune-financiere");
  etat = adopterId(etat, "impot-plancher-de-2-sur-les-patrimoines");
  etat = adopterId(etat, "revenir-a-62-ans");
  assert.equal(soutiens(etat, MISSION).find((s) => s.cle === "marches")!.valeur, 21);
  etat = verifierTelex(etat, MISSION);
  assert.equal(etat.telexEnCours, "taux");
  assert.equal(etat.telex.surcout, 0, "un dilemme ne coûte rien avant d'être tranché");
  // L'écran du dilemme : deux issues, leurs prix, pas de « Poursuivre ».
  const ecran = renduConseil(etat, MISSION);
  assert.match(ecran, /Annoncer un plan d&#39;économies/);
  assert.match(ecran, /Laisser filer les taux/);
  assert.ok(!ecran.includes("data-action=\"poursuivre\""));
  // Trancher « laisser filer » : 2 000 M€ de plus à trouver, Marchés −2.
  const marchesAvant = soutiens(etat, MISSION).find((s) => s.cle === "marches")!.valeur;
  etat = trancherTelex(etat, "b", MISSION);
  assert.equal(etat.telexEnCours, undefined);
  assert.equal(etat.phase, "conseil");
  assert.equal(etat.telex.surcout, -2000);
  assert.equal(trouve(etat), -12000 + 4500 + 15000 - 13000 - 2000);
  assert.equal(soutiens(etat, MISSION).find((s) => s.cle === "marches")!.valeur, marchesAvant - 2);
  // Le même télex ne retombe jamais.
  assert.equal(verifierTelex(etat, MISSION).telexEnCours, undefined);
  // L'autre issue, sur une partie jumelle : le plan d'économies remonte les
  // Marchés (+5) et se paie devant l'opinion (−4), sans toucher au compteur.
  let jumelle = conseil();
  jumelle = adopterId(jumelle, "flat-tax-a-20-avec-abattement-protegeant");
  jumelle = adopterId(jumelle, "retablir-un-impot-sur-la-fortune-financiere");
  jumelle = adopterId(jumelle, "impot-plancher-de-2-sur-les-patrimoines");
  jumelle = adopterId(jumelle, "revenir-a-62-ans");
  jumelle = verifierTelex(jumelle, MISSION);
  const avant = Object.fromEntries(soutiens(jumelle, MISSION).map((s) => [s.cle, s.valeur]));
  jumelle = trancherTelex(jumelle, "a", MISSION);
  assert.equal(jumelle.telex.surcout, 0);
  const apres = Object.fromEntries(soutiens(jumelle, MISSION).map((s) => [s.cle, s.valeur]));
  assert.equal(apres.marches, avant.marches + 5);
  assert.equal(apres.opinion, avant.opinion - 4);
});

test("les bons télex existent : franchir 50 000 M€ fait respirer les marchés", () => {
  let etat = conseil();
  etat = adopterId(etat, "flat-tax-a-20-des-le-premier");
  const avant = soutiens(etat, MISSION).find((s) => s.cle === "marches")!.valeur;
  etat = verifierTelex(etat, MISSION);
  // Le premier déclenché est « perspective » (comblé 150 000 ≥ 50 000).
  assert.equal(etat.telexEnCours, "perspective");
  assert.equal(etat.telex.surcout, 0);
  const apres = soutiens(etat, MISSION).find((s) => s.cle === "marches")!.valeur;
  assert.ok(apres >= avant, "un bon télex ne fait pas baisser les marchés");
  const html = renduConseil(etat, MISSION);
  assert.match(html, /Télex · entre deux mesures/);
  assert.match(html, /Perspective relevée/);
  assert.match(html, /Poursuivre/);
  assert.doesNotMatch(html, /REJETER/i);
});

test("les décorations se gagnent au verdict, jamais en cours de partie", () => {
  let etat = conseil();
  etat = adopterId(etat, "geler-le-point-d-indice-en-2026");
  assert.deepEqual(decorations(etat, MISSION), [], "rien avant le verdict");
  while (courante(etat)) etat = tamponner(etat, "rejete");
  const gagnees = decorations(etat, MISSION).map((d) => d.id);
  // Pile finie sans censure, sans recette nouvelle, les 96 tamponnées.
  assert.ok(gagnees.includes("sans-censure"));
  assert.ok(gagnees.includes("zero-impot"));
  assert.ok(gagnees.includes("integrale"));
  assert.ok(!gagnees.includes("equilibre"));
  // Adopter la TVA fait perdre « Zéro impôt levé ».
  let percepteur = conseil();
  percepteur = adopterId(percepteur, "porter-le-taux-normal-de-tva-a");
  while (courante(percepteur)) percepteur = tamponner(percepteur, "rejete");
  assert.ok(!decorations(percepteur, MISSION).map((d) => d.id).includes("zero-impot"));
  // Un duel gagné se décore.
  let duel = { ...conseil(), defi: { comble: 5000 } };
  duel = adopterId(duel, "porter-le-taux-normal-de-tva-a");
  while (courante(duel)) duel = tamponner(duel, "rejete");
  assert.ok(decorations(duel, MISSION).map((d) => d.id).includes("duel-gagne"));
});

test("la collection survit d'une partie à l'autre, et vit sans stockage", () => {
  const memoire = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  try {
    assert.deepEqual(collectionner([{ id: "sans-censure" }]), ["sans-censure"]);
    assert.deepEqual(collectionner([{ id: "equilibre" }]), ["sans-censure", "equilibre"]);
    // Regagner une décoration ne la compte pas deux fois.
    assert.deepEqual(collectionner([{ id: "equilibre" }]), ["sans-censure", "equilibre"]);
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
  // Sans stockage du tout : la vitrine du jour reste vraie.
  assert.deepEqual(collectionner([{ id: "funambule" }]), ["funambule"]);
});

test("les 18 ajouts n'ouvrent aucun enchaînement absurde : âges, RSA, SNU, contrats", () => {
  // Un seul choix d'âge de départ. Les deux âges passent avant la suspension
  // dans la pile : on les ajourne pour qu'ils soient encore en jeu quand la
  // suspension est tamponnée, et ils doivent tomber en « exclue ».
  let etat = conseil();
  const ages = new Set(["repousser-l-age-legal-a-65-ans", "revenir-a-62-ans"]);
  while (courante(etat)!.id !== "suspendre-la-reforme-des-retraites-jusqu") {
    etat = ages.has(courante(etat)!.id) ? ajourner(etat) : tamponner(etat, "rejete");
  }
  etat = tamponner(etat, "adopte");
  assert.equal(etat.tampons["repousser-l-age-legal-a-65-ans"], "exclue");
  assert.equal(etat.tampons["revenir-a-62-ans"], "exclue");
  // Et dans l'autre sens : adopter un âge écarte la suspension, plus loin.
  let autre = conseil();
  autre = adopterId(autre, "repousser-l-age-legal-a-65-ans");
  assert.equal(autre.tampons["suspendre-la-reforme-des-retraites-jusqu"], "exclue");
  // Conditionner le RSA et le verser automatiquement se contredisent.
  let rsa = conseil();
  rsa = adopterId(rsa, "verser-le-rsa-automatiquement-fin-du-non");
  assert.equal(rsa.tampons["conditionner-le-rsa-a-15-heures"], "exclue");
  // Le service militaire volontaire remplace le SNU (déclaré côté volontariat,
  // la symétrie fait le reste).
  let snu = conseil();
  snu = adopterId(snu, "service-militaire-volontaire-de-50-000");
  assert.equal(snu.tampons["generaliser-le-service-national-universel"], "exclue");
  // Les contrats couvrent les ajouts : « sans nouvel impôt » retire les
  // recettes nouvelles, « école et santé » retire bourses et grand âge,
  // « sans toucher aux prestations » retire les durcissements, « sans
  // toucher aux collectivités » retire les crèches.
  const sansImpot = new Set(pile(["sans-impot"]).map((m) => m.id));
  for (const id of [
    "fiscaliser-les-heures-supplementaires-comme-le",
    "elargir-la-taxe-sur-les-transactions",
    "fiscalite-nutritionnelle-au-niveau-recommande",
    "legaliser-et-taxer-le-cannabis",
    "remplacer-l-abattement-des-retraites-par",
  ]) assert.ok(!sansImpot.has(id), id);
  // La baisse de TVA sur l'énergie reste : ne pas lever n'interdit pas d'alléger.
  assert.ok(sansImpot.has("tva-a-5-5-sur-l-electricite"));
  const ecole = new Set(pile(["ecole-sante"]).map((m) => m.id));
  assert.ok(!ecole.has("doubler-les-bourses-etudiantes-sur-criteres"));
  assert.ok(!ecole.has("loi-grand-age-50-000-recrutements"));
  const prestations = new Set(pile(["sans-prestation"]).map((m) => m.id));
  assert.ok(!prestations.has("conditionner-le-rsa-a-15-heures"));
  assert.ok(!prestations.has("supprimer-l-allocation-pour-demandeurs-d"));
  // Les revalorisations, elles, restent jouables sous ce contrat.
  assert.ok(prestations.has("porter-le-rsa-au-seuil-de"));
  const collectivites = new Set(pile(["sans-collectivites"]).map((m) => m.id));
  assert.ok(!collectivites.has("ouvrir-200-000-places-de-creche"));
});

test("un défi reçu l'emporte sur une sauvegarde restée à l'écran de mission", () => {
  const recu = decoderDefi("8000~ecole-sante");
  assert.ok(recu);
  // Une simple visite d'hier (mission vierge sauvée) n'avale pas le défi.
  const vierge = etatInitial();
  const ouvert = reprendre(vierge, recu);
  assert.equal(ouvert.defi?.comble, 8000);
  assert.deepEqual(ouvert.engagements, ["ecole-sante"]);
  // Une partie en conseil, elle, reste prioritaire : le défi attend.
  const entamee = commencer(etatInitial());
  assert.equal(reprendre(entamee, recu), entamee);
  // Sans sauvegarde, le défi ouvre ; sans défi, la sauvegarde ouvre.
  assert.equal(reprendre(null, recu).defi?.comble, 8000);
  assert.equal(reprendre(vierge, null), vierge);
});

test("le rejet a un prix sur les cartes totem, et Annuler le rembourse", () => {
  // Rejeter la revalorisation des enseignants fâche l'opinion (−4) : depuis
  // la passe dilemmes, aucun tampon n'est neutre sur ces cartes.
  let etat = conseil();
  while (courante(etat)!.id !== "revaloriser-les-enseignants-de-5") etat = tamponner(etat, "rejete");
  const avant = soutiens(etat, MISSION).find((s) => s.cle === "opinion")!.valeur;
  etat = tamponner(etat, "rejete");
  assert.equal(soutiens(etat, MISSION).find((s) => s.cle === "opinion")!.valeur, avant - 4);
  // Le compteur, lui, ne bouge pas : rejeter reste gratuit en euros.
  assert.equal(trouve(etat), 0);
  assert.equal(comble(etat), 0);
  // Annuler rembourse le prix du rejet comme celui d'une adoption.
  etat = annuler(etat);
  assert.equal(soutiens(etat, MISSION).find((s) => s.cle === "opinion")!.valeur, avant);
  // Et le second prix s'affiche sur la carte, avant le tampon.
  assert.match(renduConseil(etat, MISSION), /Rejeter a aussi un prix/);
  // Une carte sans rejet déclaré reste neutre au rejet : le dilemme est
  // réservé aux totems, comme le catalogue l'écrit.
  let calme = conseil();
  calme = adopterId(calme, "doubler-la-taxe-sur-les-rachats-d");
  const jaugesAvant = soutiens(calme, MISSION).map((s) => s.valeur);
  calme = tamponner(calme, "rejete"); // l'assurance-vie, sans rejet déclaré
  assert.deepEqual(soutiens(calme, MISSION).map((s) => s.valeur), jaugesAvant);
});

test("l'immobilisme se paie : au-delà des reports gratuits, chaque ajournement coûte un point partout", () => {
  let etat = conseil();
  const depart = soutiens(etat, MISSION).map((s) => s.valeur);
  for (let i = 0; i < REPORTS_GRATUITS; i++) etat = ajourner(etat);
  assert.deepEqual(
    soutiens(etat, MISSION).map((s) => s.valeur),
    depart,
    "les reports gratuits ne coûtent rien",
  );
  etat = ajourner(etat);
  assert.deepEqual(
    soutiens(etat, MISSION).map((s) => s.valeur),
    depart.map((v) => v - 1),
  );
  etat = ajourner(etat);
  assert.deepEqual(
    soutiens(etat, MISSION).map((s) => s.valeur),
    depart.map((v) => v - 2),
  );
  // Le rendu prévient dès qu'on approche du seuil.
  assert.match(renduConseil(etat, MISSION), /chacun coûte 1 point/);
  // Le report ne s'annule pas : « Annuler » dépile les tampons, pas le temps
  // perdu — et une sauvegarde d'avant les reports repart à zéro.
  assert.equal(annuler(etat).reports, etat.reports);
});

test("tout rejeter en choisissant toujours la pire issue reste jouable : trois dilemmes, pas de censure", () => {
  // La partie paresseuse d'avant la passe dilemmes ne rencontrait rien.
  // Elle traverse maintenant la revue de notation, les taux et la grève,
  // finit meurtrie, mais le jeu ne devient jamais imperdable par ennui ni
  // perdu d'office : les jauges tiennent au-dessus de la censure.
  let etat = conseil();
  let garde = 0;
  while (etat.phase === "conseil" && garde++ < 400) {
    if (etat.telexEnCours) {
      const telex = TELEX.find((t) => t.id === etat.telexEnCours)!;
      etat = telex.issues ? trancherTelex(etat, "b", MISSION) : poursuivreTelex(etat, MISSION);
      continue;
    }
    if (!courante(etat)) break;
    etat = verifierTelex(tamponner(etat, "rejete"), MISSION);
    if (!etat.telexEnCours) etat = verifierCensure(etat, MISSION);
  }
  assert.equal(etat.phase, "verdict");
  assert.equal(etat.censure, undefined);
  assert.deepEqual(etat.telex.vus, ["notation", "taux", "greve"]);
  assert.ok(soutiens(etat, MISSION).every((s) => s.valeur > 10));
  // La revue de notation est bien le télex de mi-parcours : beaucoup de
  // tampons, peu de milliards — elle ne tombe jamais dans une partie qui
  // trouve tôt.
  let studieuse = conseil();
  studieuse = adopterId(studieuse, "flat-tax-a-20-des-le-premier");
  for (let i = 0; i < 45; i++) {
    if (!courante(studieuse)) break;
    studieuse = tamponner(studieuse, "rejete");
  }
  assert.notEqual(verifierTelex(studieuse, MISSION).telexEnCours, "notation");
});

test("le plein écran a sa porte de sortie : « Quitter le conseil » ramène au site", () => {
  // La porte vit dans le cadre à toutes les phases : mission, conseil,
  // verdict. C'est le seul lien vers le site quand le tunnel occupe l'écran.
  for (const etape of [etatInitial(), conseil(), { ...conseil(), phase: "verdict" as const }]) {
    const html = rendu(etape, MISSION);
    assert.match(html, /tunnel__quitter/);
    assert.match(html, /href="\/"/);
    assert.match(html, /Quitter le conseil/);
  }
});
