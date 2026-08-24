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
import { ordreExpress } from "./campagne.ts";
import {
  ajourner,
  REPORTS_GRATUITS,
  TELEX,
  annuler,
  collectionner,
  decorations,
  basculerEngagement,
  afficherTunnel,
  bilanTexte,
  bilanVerdict,
  decoderDefi,
  encoderDefi,
  restaurer,
  reprendre,
  comble,
  commencer,
  courante,
  etatInitial,
  missionRestante,
  nouvelleContrainte,
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
  verifierCrise,
  trancherCrise,
  poursuivreTelex,
  trancherTelex,
  transitionApresRetour,
  verifierTelex,
  type EtatTunnel,
} from "./tunnel.ts";

const MISSION = 159_297e6;

test("la façade du tunnel conserve le moteur, les rendus et le contrôleur", async () => {
  const facade = await import("./tunnel.ts");
  assert.equal(typeof facade.commencer, "function");
  assert.equal(typeof facade.renduConseil, "function");
  assert.equal(typeof facade.afficherTunnel, "function");
  assert.equal(typeof facade.impactDecision, "function");
});

test("le retour BFCache garde un unique contrôleur cliquable et réarme le chrono", () => {
  const global = globalThis as Record<string, unknown>;
  const anciens = new Map<string, unknown>(["window", "location", "sessionStorage", "setTimeout", "clearTimeout"].map((cle) => [cle, global[cle]]));
  const presents = new Set(["window", "location", "sessionStorage", "setTimeout", "clearTimeout"].filter((cle) => cle in global));
  const ecouteurs = new Map<string, Set<(evenement: { persisted?: boolean }) => void>>();
  const fenetre = {
    addEventListener: (type: string, ecouteur: (evenement: { persisted?: boolean }) => void) => {
      if (!ecouteurs.has(type)) ecouteurs.set(type, new Set());
      ecouteurs.get(type)!.add(ecouteur);
    },
    removeEventListener: (type: string, ecouteur: (evenement: { persisted?: boolean }) => void) => ecouteurs.get(type)?.delete(ecouteur),
    emettre: (type: string, evenement: { persisted?: boolean }) => {
      for (const ecouteur of ecouteurs.get(type) ?? []) ecouteur(evenement);
    },
  };
  const taches = new Set<{ annulee: boolean }>();
  const stockage = new Map<string, string>();
  const clics = new Set<(evenement: MouseEvent) => void>();
  let peintures = 0;
  const cadre = {
    set innerHTML(_html: string) { peintures++; },
    get innerHTML() { return ""; },
    addEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.add(ecouteur),
    removeEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.delete(ecouteur),
    emettreClic: (cible: HTMLElement) => { for (const ecouteur of clics) ecouteur({ target: cible } as MouseEvent); },
  } as unknown as HTMLElement & { emettreClic: (cible: HTMLElement) => void };
  const bouton = { dataset: { action: "commencer" }, closest: (selecteur: string) => selecteur === ".tunnel__quitter" ? null : bouton } as unknown as HTMLElement;
  try {
    global.window = fenetre;
    global.location = { search: "", origin: "https://exemple.test" };
    global.sessionStorage = { getItem: (cle: string) => stockage.get(cle) ?? null, setItem: (cle: string, valeur: string) => void stockage.set(cle, valeur), removeItem: (cle: string) => void stockage.delete(cle) };
    global.setTimeout = (() => { const tache = { annulee: false }; taches.add(tache); return tache; }) as unknown;
    global.clearTimeout = ((tache: { annulee?: boolean } | undefined) => { if (tache) tache.annulee = true; }) as unknown;
    stockage.set("tunnel-partie", JSON.stringify({ ...etatInitial(), chrono: true }));

    const demonter = afficherTunnel(cadre, { missionEuros: MISSION });
    cadre.emettreClic(bouton);
    const avantRetour = peintures;
    fenetre.emettre("pagehide", { persisted: true });
    fenetre.emettre("pageshow", { persisted: true });

    assert.equal(clics.size, 1);
    assert.ok(peintures > avantRetour);
    assert.equal([...taches].filter((tache) => !tache.annulee).length, 1);
    const apresRetour = peintures;
    cadre.emettreClic(bouton);
    assert.equal(peintures, apresRetour + 1);
    demonter();
  } finally {
    for (const [cle, valeur] of anciens) {
      if (presents.has(cle)) global[cle] = valeur;
      else delete global[cle];
    }
  }
});

test("le retour BFCache résout une décision tamponnée une seule fois, sans la rejouer", () => {
  const global = globalThis as Record<string, unknown>;
  const anciens = new Map<string, unknown>(["window", "location", "sessionStorage", "setTimeout", "clearTimeout", "document"].map((cle) => [cle, global[cle]]));
  const presents = new Set(["window", "location", "sessionStorage", "setTimeout", "clearTimeout", "document"].filter((cle) => cle in global));
  const ecouteurs = new Map<string, Set<(evenement: { persisted?: boolean }) => void>>();
  const stockage = new Map<string, string>();
  const evenements: unknown[] = [];
  const clics = new Set<(evenement: MouseEvent) => void>();
  const fenetre = {
    addEventListener: (type: string, ecouteur: (evenement: { persisted?: boolean }) => void) => {
      if (!ecouteurs.has(type)) ecouteurs.set(type, new Set());
      ecouteurs.get(type)!.add(ecouteur);
    },
    removeEventListener: (type: string, ecouteur: (evenement: { persisted?: boolean }) => void) => ecouteurs.get(type)?.delete(ecouteur),
    emettre: (type: string, evenement: { persisted?: boolean }) => {
      for (const ecouteur of ecouteurs.get(type) ?? []) ecouteur(evenement);
    },
  };
  const cadre = {
    innerHTML: "",
    addEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.add(ecouteur),
    removeEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.delete(ecouteur),
    querySelectorAll: () => [],
    querySelector: () => null,
    setAttribute: () => {},
    removeAttribute: () => {},
    emettreClic: (cible: HTMLElement) => { for (const ecouteur of clics) ecouteur({ target: cible } as MouseEvent); },
  } as unknown as HTMLElement & { emettreClic: (cible: HTMLElement) => void };
  const bouton = { dataset: { geste: "adopter" }, closest: (selecteur: string) => selecteur === ".tunnel__quitter" ? null : bouton } as unknown as HTMLElement;
  try {
    global.window = fenetre;
    global.location = { search: "", origin: "https://exemple.test" };
    global.sessionStorage = { getItem: (cle: string) => stockage.get(cle) ?? null, setItem: (cle: string, valeur: string) => void stockage.set(cle, valeur), removeItem: (cle: string) => void stockage.delete(cle) };
    global.setTimeout = (() => ({ annulee: false })) as unknown;
    global.clearTimeout = ((_tache: unknown) => {}) as unknown;
    global.document = { dispatchEvent: (evenement: { detail: unknown }) => { evenements.push(evenement.detail); return true; } };
    stockage.set("tunnel-partie", JSON.stringify({
      ...conseil(), mode: "express", ordre: ["reconduire-la-surtaxe-des-grandes-entreprises"], tampons: {}, historique: [],
      telex: { vus: TELEX.map((telex) => telex.id), surcout: 0, soutiens: {} },
    }));

    const demonter = afficherTunnel(cadre, { missionEuros: MISSION });
    cadre.emettreClic(bouton);
    fenetre.emettre("pagehide", { persisted: true });
    fenetre.emettre("pageshow", { persisted: true });
    fenetre.emettre("pageshow", { persisted: true });

    const apres = JSON.parse(stockage.get("tunnel-partie")!) as EtatTunnel;
    assert.equal(apres.phase, "verdict");
    assert.deepEqual(evenements, [
      { type: "decision", acte: 1, numero: 1, verdict: "adopte" },
      { type: "partie_terminee", mode: "express", dossiers: 1 },
    ]);
    demonter();
  } finally {
    for (const cle of ["window", "location", "sessionStorage", "setTimeout", "clearTimeout", "document"]) {
      if (presents.has(cle)) global[cle] = anciens.get(cle);
      else delete global[cle];
    }
  }
});

test("sans Clipboard API, un clic Partager ouvre l'invite et émet une fois", async () => {
  const global = globalThis as Record<string, unknown>;
  const anciens = new Map<string, unknown>(["window", "location", "sessionStorage", "document"].map((cle) => [cle, global[cle]]));
  const presents = new Set(["window", "location", "sessionStorage", "document"].filter((cle) => cle in global));
  const descripteurNavigateur = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const stockage = new Map<string, string>();
  const evenements: unknown[] = [];
  const invites: [string, string][] = [];
  const clics = new Set<(evenement: MouseEvent) => void>();
  const cadre = {
    innerHTML: "",
    addEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.add(ecouteur),
    removeEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.delete(ecouteur),
    emettreClic: (cible: HTMLElement) => { for (const ecouteur of clics) ecouteur({ target: cible } as MouseEvent); },
  } as unknown as HTMLElement & { emettreClic: (cible: HTMLElement) => void };
  const bouton = {
    dataset: { action: "partager" }, textContent: "Partager le bilan",
    setAttribute: () => {}, removeAttribute: () => {},
    closest: (selecteur: string) => selecteur === ".tunnel__quitter" ? null : bouton,
  } as unknown as HTMLElement;
  try {
    global.window = { addEventListener: () => {}, removeEventListener: () => {}, prompt: (titre: string, texte: string) => { invites.push([titre, texte]); return null; } };
    global.location = { search: "", origin: "https://exemple.test" };
    global.sessionStorage = { getItem: (cle: string) => stockage.get(cle) ?? null, setItem: (cle: string, valeur: string) => void stockage.set(cle, valeur), removeItem: (cle: string) => void stockage.delete(cle) };
    global.document = { dispatchEvent: (evenement: { detail: unknown }) => { evenements.push(evenement.detail); return true; } };
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
    stockage.set("tunnel-partie", JSON.stringify({ ...conseil(), phase: "verdict" }));

    const demonter = afficherTunnel(cadre, { missionEuros: MISSION });
    cadre.emettreClic(bouton);
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(evenements, [{ type: "partage" }]);
    assert.equal(invites.length, 1);
    assert.equal(invites[0]?.[0], "Votre bilan, à copier :");
    demonter();
  } finally {
    if (descripteurNavigateur) Object.defineProperty(globalThis, "navigator", descripteurNavigateur);
    else delete global.navigator;
    for (const cle of ["window", "location", "sessionStorage", "document"]) {
      if (presents.has(cle)) global[cle] = anciens.get(cle);
      else delete global[cle];
    }
  }
});

test("Partager sérialise les clics et ne touche plus le bouton démonté", async () => {
  const global = globalThis as Record<string, unknown>;
  const anciens = new Map<string, unknown>(["window", "location", "sessionStorage", "document"].map((cle) => [cle, global[cle]]));
  const presents = new Set(["window", "location", "sessionStorage", "document"].filter((cle) => cle in global));
  const descripteurNavigateur = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const stockage = new Map<string, string>();
  const evenements: unknown[] = [];
  const clics = new Set<(evenement: MouseEvent) => void>();
  let appels = 0;
  let resoudre: (() => void) | undefined;
  let retraits = 0;
  const cadre = {
    innerHTML: "",
    addEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.add(ecouteur),
    removeEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.delete(ecouteur),
    emettreClic: (cible: HTMLElement) => { for (const ecouteur of clics) ecouteur({ target: cible } as MouseEvent); },
  } as unknown as HTMLElement & { emettreClic: (cible: HTMLElement) => void };
  const attributs = new Map<string, string>();
  const bouton = {
    dataset: { action: "partager" },
    disabled: false,
    textContent: "Partager le bilan",
    setAttribute(nom: string, valeur: string) { attributs.set(nom, valeur); if (nom === "disabled") this.disabled = true; },
    removeAttribute(nom: string) { attributs.delete(nom); if (nom === "disabled") this.disabled = false; retraits++; },
    closest: (selecteur: string) => selecteur === ".tunnel__quitter" ? null : bouton,
  } as unknown as HTMLElement & { disabled: boolean };
  try {
    global.window = { addEventListener: () => {}, removeEventListener: () => {}, prompt: () => null };
    global.location = { search: "", origin: "https://exemple.test" };
    global.sessionStorage = { getItem: (cle: string) => stockage.get(cle) ?? null, setItem: (cle: string, valeur: string) => void stockage.set(cle, valeur), removeItem: (cle: string) => void stockage.delete(cle) };
    global.document = { dispatchEvent: (evenement: { detail: unknown }) => { evenements.push(evenement.detail); return true; } };
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
      share: () => {
        appels++;
        return new Promise<void>((resolve) => { resoudre = resolve; });
      },
    } });
    stockage.set("tunnel-partie", JSON.stringify({ ...conseil(), phase: "verdict" }));

    const demonter = afficherTunnel(cadre, { missionEuros: MISSION });
    cadre.emettreClic(bouton);
    cadre.emettreClic(bouton);
    assert.equal(appels, 1);
    assert.deepEqual(evenements, [{ type: "partage" }]);
    assert.equal(bouton.disabled, true);
    assert.equal(attributs.get("aria-busy"), "true");

    resoudre!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(bouton.disabled, false);
    cadre.emettreClic(bouton);
    assert.equal(appels, 2, "une action terminée peut être relancée");
    assert.deepEqual(evenements, [{ type: "partage" }, { type: "partage" }]);

    const retraitsAvantDemontage = retraits;
    demonter();
    resoudre!();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(retraits, retraitsAvantDemontage, "la promesse terminée ne touche pas un bouton démonté");
  } finally {
    if (descripteurNavigateur) Object.defineProperty(globalThis, "navigator", descripteurNavigateur);
    else delete global.navigator;
    for (const cle of ["window", "location", "sessionStorage", "document"]) {
      if (presents.has(cle)) global[cle] = anciens.get(cle);
      else delete global[cle];
    }
  }
});

test("le conseil express rend l'état, les deux camps, la preuve et la barre d'action", () => {
  const html = renduConseil(commencer(etatInitial()), MISSION);
  assert.match(html, /tunnel__etat-compact/);
  assert.match(html, /tunnel__comparaison/);
  assert.match(html, /tunnel__camp--adopter/);
  assert.match(html, /tunnel__camp--rejeter/);
  assert.match(html, /<details class="tunnel__preuve"/);
  assert.match(html, /tunnel__actions-fixes/);
  assert.match(html, /Acte 1/);
});

/** Un conseil ouvert sans engagement : la pile entière. */
function conseil(): EtatTunnel {
  return commencer({ ...etatInitial(), mode: "integral" });
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

test("le profil décrit la forme du plan, sans qualifier le joueur", () => {
  assert.equal(profil(conseil()).nom, "Plan sans décisions retenues");
  let percepteur = conseil();
  percepteur = adopterId(percepteur, "porter-le-taux-normal-de-tva-a");
  assert.equal(profil(percepteur).nom, "Plan de recettes nouvelles");
  let chirurgien = conseil();
  chirurgien = adopterId(chirurgien, "geler-le-point-d-indice-en-2026");
  assert.equal(profil(chirurgien).nom, "Plan d'économies");
  let relance = conseil();
  relance = adopterId(relance, "revenir-a-62-ans");
  assert.equal(profil(relance).nom, "Plan à dépenses nouvelles");
  // Dans l'ordre du catalogue : `adopterId` rejette tout ce qui précède sa
  // cible, donc on adopte en avançant, jamais en revenant.
  let equilibriste = conseil();
  equilibriste = adopterId(equilibriste, "porter-le-taux-normal-de-tva-a");
  equilibriste = adopterId(equilibriste, "repousser-l-age-legal-a-65-ans");
  equilibriste = adopterId(equilibriste, "geler-le-point-d-indice-en-2026");
  assert.equal(profil(equilibriste).nom, "Plan mixte");
});

test("la pile épuisée attend la résolution de fin de séance", () => {
  let etat = conseil();
  while (courante(etat)) etat = tamponner(etat, "rejete");
  assert.equal(etat.phase, "conseil");
  assert.equal(etat.finDifferee, true);
  assert.equal(Object.keys(etat.tampons).length, 96);
});

test("l'écran de mission écrit le vrai compteur et compte ce que chaque signature retire", () => {
  const html = renduMission(etatInitial(), MISSION);
  assert.match(html, /159\u202f297\u202fM€/);
  assert.match(html, /data-action="mode-integral"/);
  assert.match(html, /Conseil intégral · 96 mesures/);
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
  assert.match(html, /Plan de recettes nouvelles/);
  assert.match(html, /Relever le défi/);
  assert.match(html, /Partager le bilan/);
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
  assert.match(texte, /Plan de recettes nouvelles/);
  assert.match(texte, /9\u202f800/);
  assert.match(texte, /Faites mieux : https:\/\/exemple\.test\/simulateur/);
  delete (globalThis as { location?: unknown }).location;
});

test("le défi voyage dans l'adresse, et une adresse abîmée est ignorée en silence", () => {
  let etat = conseil();
  etat = { ...etat, graine: 123, engagements: ["ecole-sante", "sans-impot"] };
  etat = adopterId(etat, "reconduire-la-surtaxe-des-grandes-entreprises");
  const code = encoderDefi(etat);
  assert.equal(code, "v2~integral~3f~668~ecole-sante%2Csans-impot");
  const relu = decoderDefi(code);
  assert.deepEqual(relu, {
    comble: 8000,
    engagements: ["ecole-sante", "sans-impot"],
    mode: "integral",
    graine: 123,
  });
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

test("le verdict explique le mandat avant sa revanche et garde quinze choix accessibles", () => {
  let etat = { ...etatInitial(), mode: "express" as const, graine: 42 };
  etat = commencer(etat);
  while (courante(etat)) etat = tamponner(etat, "rejete");
  etat = transitionApresRetour(etat, MISSION);
  const html = renduVerdict(etat, MISSION);
  assert.ok(html.indexOf("Votre mandat") < html.indexOf("Relever le défi"));
  assert.match(html, /Promesses tenues/);
  assert.match(html, /Conséquences encore ouvertes/);
  assert.match(html, /<details class="tunnel__historique"/);
  assert.match(html, /Voir mes 15 choix/);
});

test("le bilan du verdict expose les chiffres, promesses, crises, reports et trois gestes", () => {
  let etat = { ...conseil(), engagements: ["sans-impot"], reports: 2 };
  etat = adopterId(etat, "geler-le-point-d-indice-en-2026");
  etat = adopterId(etat, "fermer-un-tiers-des-agences-et-operateurs");
  etat = adopterId(etat, "doubler-les-moyens-contre-la-fraude-fiscale");
  const bilan = bilanVerdict(etat, MISSION);
  assert.equal(bilan.trouve, comble(etat));
  assert.equal(bilan.reste, missionRestante(etat, MISSION));
  assert.equal(bilan.engagements[0]?.statut, "tenue");
  assert.equal(bilan.reports, 2);
  assert.equal(bilan.gestes.length, 3);
  assert.ok(bilan.gestes[0]!.montantAbsolu >= bilan.gestes[1]!.montantAbsolu);
  assert.match(bilan.profil.nom, /Plan/);
});

test("la revanche ajoute toujours le premier engagement absent, puis varie seulement la graine", () => {
  const etat = { ...etatInitial(), mode: "express" as const, graine: 0xffff_ffff, engagements: [] };
  const premier = nouvelleContrainte(etat);
  assert.deepEqual(premier.engagements, ["sans-impot"]);
  assert.equal(premier.graine, etat.graine);
  const tous = nouvelleContrainte({ ...etat, engagements: ["sans-impot", "sans-prestation", "ecole-sante", "sans-collectivites"] });
  assert.deepEqual(tous.engagements, ["sans-impot", "sans-prestation", "ecole-sante", "sans-collectivites"]);
  assert.notEqual(tous.graine, etat.graine);
  assert.ok(tous.graine >= 0 && tous.graine <= 0xffff_ffff);
});

test("la campagne express est la mission par défaut et l'intégrale garde les 96 mesures", () => {
  const depart = etatInitial();
  assert.equal(depart.version, 2);
  assert.equal(depart.mode, "express");
  assert.ok(Number.isInteger(depart.graine));
  const express = commencer(depart);
  assert.deepEqual(express.ordre, ordreExpress(depart.engagements, depart.graine));
  const integral = commencer({ ...depart, mode: "integral" });
  assert.equal(integral.ordre.length, MESURES.length);
});

test("la campagne express expose le dilemme éditorial, l'intégrale garde la carte générique", () => {
  const id = "flat-tax-a-20-avec-abattement-protegeant";
  const express = { ...etatInitial(), phase: "conseil" as const, mode: "express" as const, ordre: [id] };
  const integral = { ...express, mode: "integral" as const };
  assert.match(renduConseil(express, MISSION), /Baisser la flat tax tout en protégeant les revenus modestes/);
  assert.match(renduConseil(express, MISSION), /détenteurs de capital/);
  assert.match(renduConseil(express, MISSION), />Maintenir</);
  assert.match(renduConseil(integral, MISSION), /Flat tax à 20 %/);
});

test("le défi v2 transporte mode, graine, score et engagements, sans casser le format historique", () => {
  let etat = {
    ...etatInitial(),
    phase: "conseil" as const,
    mode: "express",
    graine: 123,
    engagements: ["ecole-sante"],
    ordre: ["reconduire-la-surtaxe-des-grandes-entreprises"],
  };
  etat = adopterId(etat, "reconduire-la-surtaxe-des-grandes-entreprises");
  assert.equal(encoderDefi(etat), "v2~express~3f~668~ecole-sante");
  assert.deepEqual(decoderDefi(encoderDefi(etat)), {
    comble: 8000,
    engagements: ["ecole-sante"],
    mode: "express",
    graine: 123,
  });
  assert.equal(decoderDefi("v2~express~pas-une-graine~668~ecole-sante"), null);
  assert.deepEqual(decoderDefi("8000~ecole-sante"), { comble: 8000, engagements: ["ecole-sante"] });
});

test("une sauvegarde sans version devient une intégrale sans modifier son ordre", () => {
  const memoire = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  try {
    const historique = commencer({ ...etatInitial(), mode: "integral" });
    const {
      version: _version,
      mode: _mode,
      graine: _graine,
      crisesVues: _crisesVues,
      criseSurcout: _criseSurcout,
      criseSoutiens: _criseSoutiens,
      ...avantV2
    } = historique;
    memoire.set("tunnel-partie", JSON.stringify(avantV2));
    const migre = restaurer();
    assert.ok(migre);
    assert.equal(migre!.version, 2);
    assert.equal(migre!.mode, "integral");
    assert.deepEqual(migre!.ordre, historique.ordre);
    assert.deepEqual(migre!.crisesVues, []);
    assert.equal(migre!.criseSurcout, 0);
    assert.deepEqual(migre!.criseSoutiens, {});
  } finally {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
});

test("une sauvegarde historique censurée devient une crise jouable, sans état verdict inerte", () => {
  const memoire = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  try {
    const ancien = {
      ...dernierDossier(),
      phase: "verdict" as const,
      tampons: { "doubler-la-taxe-sur-les-rachats-d": "rejete" as const },
      historique: [{ id: "doubler-la-taxe-sur-les-rachats-d", exclues: [] }],
      censure: "Opinion",
    };
    memoire.set("tunnel-partie", JSON.stringify(ancien));
    const migre = restaurer();
    assert.ok(migre);
    assert.equal(migre!.phase, "conseil");
    assert.equal(migre!.criseEnCours, "opinion");
    assert.equal(migre!.finDifferee, true);
    assert.equal(trancherCrise(migre!, "tenir", MISSION).phase, "verdict");

    const enCours = {
      ...ancien,
      ordre: ["doubler-la-taxe-sur-les-rachats-d", "reconduire-la-surtaxe-des-grandes-entreprises"],
    };
    memoire.set("tunnel-partie", JSON.stringify(enCours));
    const reprise = restaurer();
    assert.ok(reprise);
    assert.equal(reprise!.finDifferee, undefined);
    assert.equal(trancherCrise(reprise!, "tenir", MISSION).phase, "conseil");
    assert.equal(courante(trancherCrise(reprise!, "tenir", MISSION))!.id, "reconduire-la-surtaxe-des-grandes-entreprises");

    memoire.set("tunnel-partie", JSON.stringify({ ...ancien, censure: "Inconnu" }));
    const inconnu = restaurer();
    assert.ok(inconnu);
    assert.equal(inconnu!.phase, "verdict");
    assert.equal(inconnu!.criseEnCours, undefined);
  } finally {
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
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
  assert.match(partie(9000), /Relever le défi/);
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

function etatAvecSoutienA10(cle: "opinion" | "entreprises" | "territoires" | "marches"): EtatTunnel {
  const bases = { opinion: 62, entreprises: 55, territoires: 58, marches: 41 };
  return {
    ...conseil(),
    criseSoutiens: { [cle]: 10 - bases[cle] },
    crisesVues: [],
    criseSurcout: 0,
  };
}

function dernierDossier(): EtatTunnel {
  return { ...conseil(), ordre: ["doubler-la-taxe-sur-les-rachats-d"], tampons: {}, historique: [] };
}

function deuxDerniersDossiers(): EtatTunnel {
  return {
    ...conseil(),
    ordre: ["doubler-la-taxe-sur-les-rachats-d", "reconduire-la-surtaxe-des-grandes-entreprises"],
    tampons: {},
    historique: [],
  };
}

test("un dernier tampon ne déclenche qu'un télex avant les crises", () => {
  const dernier = {
    ...dernierDossier(),
    criseSoutiens: { opinion: -52, entreprises: -45, territoires: -48, marches: -31 },
  };
  let etat = transitionApresRetour(tamponner(dernier, "rejete"), MISSION);
  assert.equal(etat.telexEnCours, "taux");
  etat = trancherTelex(etat, "a", MISSION);
  assert.deepEqual(etat.telex.vus, ["taux"]);
  assert.equal(etat.criseEnCours, "opinion");
  assert.equal(etat.telexEnCours, undefined);
});

test("l'issue terminale sans crise rend le verdict sans second télex", () => {
  const dernier = {
    ...dernierDossier(),
    criseSoutiens: { opinion: -34, marches: -20 },
  };
  let etat = transitionApresRetour(tamponner(dernier, "rejete"), MISSION);
  assert.equal(etat.telexEnCours, "taux");
  etat = trancherTelex(etat, "a", MISSION);
  assert.equal(etat.phase, "verdict");
  assert.deepEqual(etat.telex.vus, ["taux"]);
});

test("un télex non terminal ne peut en ouvrir un autre qu'après le tampon suivant", () => {
  const deux = {
    ...deuxDerniersDossiers(),
    criseSoutiens: { opinion: -34, marches: -20 },
  };
  let etat = transitionApresRetour(tamponner(deux, "rejete"), MISSION);
  assert.equal(etat.telexEnCours, "taux");
  etat = trancherTelex(etat, "a", MISSION);
  assert.equal(etat.telexEnCours, undefined);
  assert.equal(etat.criseEnCours, undefined);
  assert.equal(courante(etat)!.id, "reconduire-la-surtaxe-des-grandes-entreprises");
  etat = transitionApresRetour(tamponner(etat, "rejete"), MISSION);
  assert.equal(etat.telexEnCours, "greve");
});

test("le contrôleur restauré ne rejoue pas le télex fermé du même tampon", () => {
  const global = globalThis as Record<string, unknown>;
  const anciens = new Map<string, unknown>(["window", "location", "sessionStorage"].map((cle) => [cle, global[cle]]));
  const presents = new Set(["window", "location", "sessionStorage"].filter((cle) => cle in global));
  const stockage = new Map<string, string>();
  const cadre = {
    innerHTML: "",
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as HTMLElement;
  try {
    global.window = { addEventListener: () => {}, removeEventListener: () => {} };
    global.location = { search: "", origin: "https://exemple.test" };
    global.sessionStorage = {
      getItem: (cle: string) => stockage.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => void stockage.set(cle, valeur),
      removeItem: (cle: string) => void stockage.delete(cle),
    };
    let etat = {
      ...deuxDerniersDossiers(),
      criseSoutiens: { opinion: -34, marches: -20 },
    };
    etat = transitionApresRetour(tamponner(etat, "rejete"), MISSION);
    assert.equal(etat.telexEnCours, "taux");
    etat = trancherTelex(etat, "a", MISSION);
    assert.equal(etat.telexEnCours, undefined);
    stockage.set("tunnel-partie", JSON.stringify(etat));

    const demonter = afficherTunnel(cadre, { missionEuros: MISSION });
    const relu = JSON.parse(stockage.get("tunnel-partie")!) as EtatTunnel;
    assert.deepEqual(relu.telex.vus, ["taux"]);
    assert.equal(relu.telexEnCours, undefined, "aucun nouveau télex sans nouveau tampon");
    assert.equal(transitionApresRetour(tamponner(relu, "rejete"), MISSION).telexEnCours, "greve");
    demonter();
  } finally {
    for (const cle of ["window", "location", "sessionStorage"]) {
      if (presents.has(cle)) global[cle] = anciens.get(cle);
      else delete global[cle];
    }
  }
});

test("le marqueur de télex survit aux remontages pendant et après le retour", () => {
  const global = globalThis as Record<string, unknown>;
  const ancien = global.sessionStorage;
  const memoire = new Map<string, string>();
  global.sessionStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  const recharger = (etat: EtatTunnel): EtatTunnel => {
    memoire.set("tunnel-partie", JSON.stringify(etat));
    return restaurer()!;
  };
  try {
    const enCours = transitionApresRetour(
      tamponner({ ...deuxDerniersDossiers(), criseSoutiens: { marches: -20 } }, "rejete"),
      MISSION,
    );
    assert.equal(enCours.telexEnCours, "taux");
    assert.equal(transitionApresRetour(recharger(enCours), MISSION).telexEnCours, "taux", "le télex ouvert est conservé");

    const sansTelex = {
      ...deuxDerniersDossiers(),
      telex: { vus: TELEX.map((t) => t.id), surcout: 0, soutiens: {} },
    };
    const nonTerminal = transitionApresRetour(tamponner(sansTelex, "rejete"), MISSION);
    assert.equal(nonTerminal.phase, "conseil");
    assert.equal((nonTerminal as EtatTunnel & { telexVerifie?: true }).telexVerifie, true);
    assert.equal(transitionApresRetour(recharger(nonTerminal), MISSION).telexEnCours, undefined);

    const terminal = transitionApresRetour(tamponner({ ...sansTelex, ordre: ["doubler-la-taxe-sur-les-rachats-d"], tampons: {}, historique: [] }, "rejete"), MISSION);
    assert.equal(terminal.phase, "verdict");
    assert.equal((terminal as EtatTunnel & { telexVerifie?: true }).telexVerifie, true);
    assert.equal(transitionApresRetour(recharger(terminal), MISSION).phase, "verdict");
  } finally {
    if (ancien === undefined) delete global.sessionStorage;
    else global.sessionStorage = ancien;
  }
});

test("un remontage pendant un télex diffère sa crise, jusqu'à sa fermeture", () => {
  const global = globalThis as Record<string, unknown>;
  const ancien = global.sessionStorage;
  const memoire = new Map<string, string>();
  global.sessionStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  const recharger = (etat: EtatTunnel): EtatTunnel => {
    memoire.set("tunnel-partie", JSON.stringify(etat));
    return restaurer()!;
  };
  try {
    const dossiers = [
      deuxDerniersDossiers(),
      dernierDossier(),
    ];
    for (const dossier of dossiers) {
      const ouvert = transitionApresRetour(
        tamponner({ ...dossier, criseSoutiens: { opinion: -52, marches: -20 } }, "rejete"),
        MISSION,
      );
      assert.equal(ouvert.telexEnCours, "taux");
      const remonte = transitionApresRetour(recharger(ouvert), MISSION);
      assert.equal(remonte.telexEnCours, "taux", "le télex reste au premier plan au remontage");
      assert.equal(remonte.criseEnCours, undefined, "la crise potentielle attend la fermeture du télex");
      assert.equal(trancherTelex(remonte, "a", MISSION).criseEnCours, "opinion", "fermer le télex ouvre exactement la crise attendue");
    }
  } finally {
    if (ancien === undefined) delete global.sessionStorage;
    else global.sessionStorage = ancien;
  }
});

test("une sauvegarde historique télex plus crise libère seulement la crise interrompue", () => {
  const global = globalThis as Record<string, unknown>;
  const ancien = global.sessionStorage;
  const memoire = new Map<string, string>();
  global.sessionStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  try {
    for (const dossier of [deuxDerniersDossiers(), dernierDossier()]) {
      const telex = transitionApresRetour(
        tamponner({ ...dossier, criseSoutiens: { opinion: -52, entreprises: -45, marches: -20 } }, "rejete"),
        MISSION,
      );
      assert.equal(telex.telexEnCours, "taux");
      memoire.set("tunnel-partie", JSON.stringify({
        ...telex,
        criseEnCours: "opinion",
        crisesVues: ["opinion", "entreprises"],
      }));

      const restaure = restaurer()!;
      assert.equal(restaure.telexEnCours, "taux");
      assert.equal(restaure.criseEnCours, undefined, "le télex garde la priorité dans l'état restauré");
      assert.deepEqual(restaure.crisesVues, ["entreprises"], "seule la crise interrompue redevient éligible");

      const rouverte = trancherTelex(restaure, "a", MISSION);
      assert.equal(rouverte.criseEnCours, "opinion", "la crise critique revient exactement après le télex");
      const apresCrise = trancherCrise(rouverte, "tenir", MISSION);
      assert.ok(apresCrise.crisesVues.includes("entreprises"), "une crise historiquement tranchée reste vue");
      assert.equal(apresCrise.criseEnCours, undefined, "la crise Entreprises déjà tranchée ne revient pas");
      assert.equal(apresCrise.phase, dossier.ordre.length === 1 ? "verdict" : "conseil");
    }
  } finally {
    if (ancien === undefined) delete global.sessionStorage;
    else global.sessionStorage = ancien;
  }
});

test("une sauvegarde antérieure sans marqueur rejoue seulement un télex dont l'état ne prouve pas la clôture", () => {
  const global = globalThis as Record<string, unknown>;
  const ancien = global.sessionStorage;
  const memoire = new Map<string, string>();
  global.sessionStorage = {
    getItem: (cle: string) => memoire.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void memoire.set(cle, valeur),
    removeItem: (cle: string) => void memoire.delete(cle),
  };
  try {
    const attente = tamponner({ ...deuxDerniersDossiers(), criseSoutiens: { marches: -20 } }, "rejete");
    memoire.set("tunnel-partie", JSON.stringify({ ...attente, telexEnCours: "taux" }));
    const pendant = restaurer()!;
    assert.equal((pendant as EtatTunnel & { telexVerifie?: true }).telexVerifie, true);
    assert.equal(transitionApresRetour(pendant, MISSION).telexEnCours, "taux");

    memoire.set("tunnel-partie", JSON.stringify(attente));
    const ambigu = restaurer()!;
    assert.equal((ambigu as EtatTunnel & { telexVerifie?: true }).telexVerifie, undefined);
    assert.equal(transitionApresRetour(ambigu, MISSION).telexEnCours, "taux");
  } finally {
    if (ancien === undefined) delete global.sessionStorage;
    else global.sessionStorage = ancien;
  }
});

test("la dernière mesure sans événement ne rend le verdict qu'après le retour", () => {
  const sansEvenement = {
    ...dernierDossier(),
    telex: { vus: TELEX.map((t) => t.id), surcout: 0, soutiens: {} },
  };
  const tampon = tamponner(sansEvenement, "rejete");
  assert.equal(tampon.phase, "conseil");
  assert.equal(tampon.finDifferee, true);
  assert.equal(transitionApresRetour(tampon, MISSION).phase, "verdict");
});

test("la dernière mesure laisse défiler télex puis crise avant le verdict", () => {
  const dernier = {
    ...dernierDossier(),
    criseSoutiens: { opinion: -52 },
    telex: { vus: TELEX.filter((t) => t.id !== "greve").map((t) => t.id), surcout: 0, soutiens: {} },
  };
  let etat = transitionApresRetour(tamponner(dernier, "rejete"), MISSION);
  assert.equal(etat.telexEnCours, "greve");
  assert.match(renduConseil(etat, MISSION), /Grève générale/);
  etat = trancherTelex(etat, "b", MISSION);
  assert.equal(etat.criseEnCours, "opinion");
  assert.match(renduConseil(etat, MISSION), /Mouvement social/);
  etat = trancherCrise(etat, "tenir", MISSION);
  assert.equal(etat.phase, "verdict");
  assert.equal(etat.finDifferee, undefined);
});

test("la dernière mesure laisse une crise secondaire se jouer avant le verdict", () => {
  const dernier = {
    ...dernierDossier(),
    criseSoutiens: { entreprises: -45, marches: -31 },
    telex: { vus: TELEX.map((t) => t.id), surcout: 0, soutiens: {} },
  };
  let etat = transitionApresRetour(tamponner(dernier, "rejete"), MISSION);
  assert.equal(etat.criseEnCours, "entreprises");
  etat = trancherCrise(etat, "tenir", MISSION);
  assert.equal(etat.criseEnCours, "marches");
  etat = trancherCrise(etat, "conceder", MISSION);
  assert.equal(etat.phase, "verdict");
});

test("un soutien au tapis ouvre une crise et la partie continue après l'issue", () => {
  const enCrise = verifierCrise(etatAvecSoutienA10("opinion"), MISSION);
  assert.equal(enCrise.phase, "conseil");
  assert.equal(enCrise.criseEnCours, "opinion");
  const repris = trancherCrise(enCrise, "conceder", MISSION);
  assert.equal(repris.phase, "conseil");
  assert.equal(repris.criseEnCours, undefined);
  assert.ok(soutiens(repris, MISSION).find((s) => s.cle === "opinion")!.valeur >= 15);
});

test("les huit issues de crise appliquent leurs coûts, réactions et le plancher de 15", () => {
  const issues: {
    soutien: "opinion" | "entreprises" | "territoires" | "marches";
    choix: "conceder" | "tenir";
    cout: number;
    reactions: Record<string, number>;
  }[] = [
    { soutien: "opinion", choix: "conceder", cout: -2000, reactions: { opinion: 8, entreprises: -2 } },
    { soutien: "opinion", choix: "tenir", cout: -500, reactions: { opinion: 3, territoires: -3 } },
    { soutien: "entreprises", choix: "conceder", cout: -1500, reactions: { entreprises: 8, opinion: -2 } },
    { soutien: "entreprises", choix: "tenir", cout: 0, reactions: { entreprises: 3, marches: -3 } },
    { soutien: "territoires", choix: "conceder", cout: -1200, reactions: { territoires: 8, marches: -2 } },
    { soutien: "territoires", choix: "tenir", cout: -200, reactions: { territoires: 3, opinion: -3 } },
    { soutien: "marches", choix: "conceder", cout: -2500, reactions: { marches: 8, opinion: -3 } },
    { soutien: "marches", choix: "tenir", cout: -800, reactions: { marches: 3, entreprises: -3 } },
  ];
  for (const issue of issues) {
    const ouvert = verifierCrise(etatAvecSoutienA10(issue.soutien), MISSION);
    const avant = Object.fromEntries(soutiens(ouvert, MISSION).map((s) => [s.cle, s.valeur]));
    const apres = trancherCrise(ouvert, issue.choix, MISSION);
    assert.equal(apres.criseSurcout, issue.cout, `${issue.soutien}/${issue.choix} coûte`);
    assert.equal(trouve(apres), issue.cout);
    assert.equal(missionRestante(apres, MISSION), MISSION - issue.cout * 1e6, "le coût augmente bien le reste à trouver");
    for (const [cle, delta] of Object.entries(issue.reactions)) {
      const valeur = soutiens(apres, MISSION).find((s) => s.cle === cle)!.valeur;
      assert.equal(valeur, Math.max(15, avant[cle]! + delta), `${issue.soutien}/${issue.choix}: ${cle}`);
    }
    assert.ok(soutiens(apres, MISSION).find((s) => s.cle === issue.soutien)!.valeur >= 15);
  }
});

test("une crise vue ne revient pas, mais une issue peut ouvrir celle d'un autre soutien", () => {
  const dejaVue = {
    ...etatAvecSoutienA10("opinion"),
    crisesVues: ["opinion" as const],
  };
  assert.equal(verifierCrise(dejaVue, MISSION).criseEnCours, undefined);

  const ouverte = verifierCrise({
    ...etatAvecSoutienA10("entreprises"),
    criseSoutiens: { entreprises: -45, marches: -28 },
  }, MISSION);
  const suivante = trancherCrise(ouverte, "tenir", MISSION);
  assert.equal(suivante.criseEnCours, "marches");
  assert.deepEqual(suivante.crisesVues, ["entreprises"]);
});

test("le rendu de crise annonce une décision assertive et deux choix", () => {
  const ouvert = verifierCrise(etatAvecSoutienA10("opinion"), MISSION);
  const html = renduConseil(ouvert, MISSION);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /Mouvement social/);
  assert.match(html, /data-crise="conceder"/);
  assert.match(html, /data-crise="tenir"/);
  assert.match(html, /2 000 M€ de plus à trouver/);
  assert.doesNotMatch(html, /Censuré|Annuler/);
});

test("le contrôleur route une décision de crise vers son arbitrage", () => {
  const global = globalThis as Record<string, unknown>;
  const anciens = new Map<string, unknown>(["window", "location", "sessionStorage"].map((cle) => [cle, global[cle]]));
  const presents = new Set(["window", "location", "sessionStorage"].filter((cle) => cle in global));
  const stockage = new Map<string, string>();
  const clics = new Set<(evenement: MouseEvent) => void>();
  const cadre = {
    innerHTML: "",
    addEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.add(ecouteur),
    removeEventListener: (_type: string, ecouteur: (evenement: MouseEvent) => void) => clics.delete(ecouteur),
  } as unknown as HTMLElement;
  const bouton = {
    dataset: { crise: "conceder" },
    closest: (selecteur: string) => selecteur === ".tunnel__quitter" ? null : bouton,
  } as unknown as HTMLElement;
  try {
    global.window = { addEventListener: () => {}, removeEventListener: () => {} };
    global.location = { search: "", origin: "https://exemple.test" };
    global.sessionStorage = {
      getItem: (cle: string) => stockage.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => void stockage.set(cle, valeur),
      removeItem: (cle: string) => void stockage.delete(cle),
    };
    stockage.set("tunnel-partie", JSON.stringify(verifierCrise(etatAvecSoutienA10("opinion"), MISSION)));
    const demonter = afficherTunnel(cadre, { missionEuros: MISSION });
    for (const clic of clics) clic({ target: bouton } as MouseEvent);
    const apres = JSON.parse(stockage.get("tunnel-partie")!) as EtatTunnel;
    assert.deepEqual(apres.crisesVues, ["opinion"]);
    assert.equal(apres.criseEnCours, undefined);
    demonter();
  } finally {
    for (const cle of ["window", "location", "sessionStorage"]) {
      if (presents.has(cle)) global[cle] = anciens.get(cle);
      else delete global[cle];
    }
  }
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

test("un télex attend la fin du retour : le tampon seul est l'état persistant", () => {
  let tampon = conseil();
  tampon = adopterId(tampon, "flat-tax-a-20-avec-abattement-protegeant");
  tampon = adopterId(tampon, "retablir-un-impot-sur-la-fortune-financiere");
  tampon = adopterId(tampon, "impot-plancher-de-2-sur-les-patrimoines");
  tampon = adopterId(tampon, "revenir-a-62-ans");

  assert.equal(tampon.telexEnCours, undefined);
  assert.equal(transitionApresRetour(tampon, MISSION).telexEnCours, "taux");
});

test("une crise attend elle aussi la fin du retour, après le télex", () => {
  const tampon = { ...etatAvecSoutienA10("opinion"), telex: { vus: TELEX.map((t) => t.id), surcout: 0, soutiens: {} } };

  assert.equal(tampon.phase, "conseil");
  assert.equal(transitionApresRetour(tampon, MISSION).criseEnCours, "opinion");
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
  etat = { ...etat, telex: { ...etat.telex, vus: TELEX.map((t) => t.id) }, crisesVues: ["opinion", "entreprises", "territoires", "marches"] };
  while (courante(etat)) etat = tamponner(etat, "rejete");
  etat = transitionApresRetour(etat, MISSION);
  const gagnees = decorations(etat, MISSION).map((d) => d.id);
  // Pile finie sans censure, sans recette nouvelle, les 96 tamponnées.
  assert.ok(gagnees.includes("sans-censure"));
  assert.ok(gagnees.includes("zero-impot"));
  assert.ok(gagnees.includes("integrale"));
  assert.ok(!gagnees.includes("equilibre"));
  // Adopter la TVA fait perdre « Zéro impôt levé ».
  let percepteur = conseil();
  percepteur = adopterId(percepteur, "porter-le-taux-normal-de-tva-a");
  percepteur = { ...percepteur, telex: { ...percepteur.telex, vus: TELEX.map((t) => t.id) }, crisesVues: ["opinion", "entreprises", "territoires", "marches"] };
  while (courante(percepteur)) percepteur = tamponner(percepteur, "rejete");
  percepteur = transitionApresRetour(percepteur, MISSION);
  assert.ok(!decorations(percepteur, MISSION).map((d) => d.id).includes("zero-impot"));
  // Un duel gagné se décore.
  let duel = { ...conseil(), defi: { comble: 5000 } };
  duel = adopterId(duel, "porter-le-taux-normal-de-tva-a");
  duel = { ...duel, telex: { ...duel.telex, vus: TELEX.map((t) => t.id) }, crisesVues: ["opinion", "entreprises", "territoires", "marches"] };
  while (courante(duel)) duel = tamponner(duel, "rejete");
  duel = transitionApresRetour(duel, MISSION);
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

test("tout rejeter en choisissant toujours la pire issue reste jouable, sans boucle et avec au plus quatre crises", () => {
  // La partie paresseuse d'avant la passe dilemmes ne rencontrait rien.
  // Elle traverse maintenant la revue de notation, les taux et la grève,
  // finit meurtrie, mais le jeu ne devient jamais imperdable par ennui ni
  // perdu d'office : les crises obligent à arbitrer, sans jamais terminer la partie.
  let etat = conseil();
  let garde = 0;
  while (etat.phase === "conseil" && garde++ < 400) {
    if (etat.telexEnCours) {
      const telex = TELEX.find((t) => t.id === etat.telexEnCours)!;
      etat = telex.issues ? trancherTelex(etat, "b", MISSION) : poursuivreTelex(etat, MISSION);
      continue;
    }
    if (etat.criseEnCours) {
      etat = trancherCrise(etat, "tenir", MISSION);
      continue;
    }
    if (!courante(etat)) break;
    etat = transitionApresRetour(tamponner(etat, "rejete"), MISSION);
  }
  assert.equal(etat.phase, "verdict");
  assert.ok(etat.crisesVues.length <= 4);
  assert.deepEqual(etat.telex.vus, ["notation", "taux", "greve"]);
  assert.ok(soutiens(etat, MISSION).every((s) => s.valeur >= 15 || etat.crisesVues.includes(s.cle)));
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
