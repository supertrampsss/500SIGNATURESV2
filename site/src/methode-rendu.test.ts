/**
 * La grille de verdicts est du texte de référence, pas un calcul : elle rend
 * public ce que `docs/analyses-schema.md` documente en prose et que le
 * contrôle déterministe (`pipeline/plateforme/controle_analyses.py`) applique
 * en code. Un désaccord entre la page et le contrôle serait pire qu'une page
 * absente — donc le test qui suit ne recopie pas les trois listes fermées
 * (`CRANS`, `CONFUSIONS`, `REGISTRES`) à la main : il les lit dans le fichier
 * Python lui-même et les compare, champ par champ, à ce que la grille rend.
 * Une copie tapée dans ce fichier de test aurait pu diverger du contrôle sans
 * qu'aucun test ne le remarque ; lire le fichier ne le peut pas.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renduGrille } from "./methode-rendu.ts";

/** Une des trois listes fermées de `controle_analyses.py`, lue dans le
 *  fichier Python lui-même — jamais recopiée. `nomVariable` doit être ancré
 *  en début de ligne (`^NOM = {`) pour ne pas confondre `REGISTRES` avec
 *  `REGISTRES_A_SOURCER` ou `REGISTRES_OBSERVE_INTERDIT`, qui partagent le
 *  même préfixe. */
function ensemblePython(nomVariable: string): Set<string> {
  const source = readFileSync(
    new URL("../../pipeline/plateforme/controle_analyses.py", import.meta.url),
    "utf8",
  );
  const motif = new RegExp(`^${nomVariable} = \\{([\\s\\S]*?)\\}`, "m");
  const bloc = source.match(motif)?.[1];
  if (!bloc) {
    throw new Error(
      `Bloc Python "${nomVariable}" introuvable dans controle_analyses.py — le contrôle a changé de forme.`,
    );
  }
  return new Set([...bloc.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!));
}

/** Les identifiants `<code>…</code>` rendus dans un conteneur de la grille —
 *  la même grille que `renduGrille()` publie, jamais une recopie de sa
 *  structure interne. */
function ensembleGrille(html: string, motifConteneur: RegExp): Set<string> {
  const conteneur = html.match(motifConteneur)?.[0];
  if (!conteneur) throw new Error(`Conteneur "${motifConteneur}" introuvable dans la grille rendue.`);
  return new Set([...conteneur.matchAll(/<code>([a-z_]+)<\/code>/g)].map((m) => m[1]!));
}

test("les crans de la grille sont exactement CRANS de controle_analyses.py (finding F)", () => {
  const html = renduGrille();
  const rendus = ensembleGrille(html, /<dl class="methode-grille__crans">[\s\S]*?<\/dl>/);
  assert.deepEqual([...rendus].sort(), [...ensemblePython("CRANS")].sort());
});

test("les confusions de la grille sont exactement CONFUSIONS de controle_analyses.py (finding F)", () => {
  const html = renduGrille();
  const rendues = ensembleGrille(html, /<dl class="methode-grille__confusions">[\s\S]*?<\/dl>/);
  assert.deepEqual([...rendues].sort(), [...ensemblePython("CONFUSIONS")].sort());
});

test("les registres de la grille sont exactement REGISTRES de controle_analyses.py (finding F)", () => {
  // L'« Opinion » de la grille (septième point de la spec) n'a pas de valeur
  // dans `Registre` ni dans `REGISTRES` : elle est rendue en prose, sans
  // `<code>`, donc absente des deux ensembles comparés ici — voir le
  // commentaire sur `REGISTRES_INFO` dans methode-rendu.ts.
  const html = renduGrille();
  const rendus = ensembleGrille(html, /<ol class="methode-grille__registres">[\s\S]*?<\/ol>/);
  assert.deepEqual([...rendus].sort(), [...ensemblePython("REGISTRES")].sort());
});

test("les trois crans figurent avec leur formulation exacte", () => {
  const html = renduGrille();
  assert.match(html, /exact/);
  assert.match(html, /« Le chiffre est celui des comptes »/);
  assert.match(html, /hors_perimetre/);
  assert.match(html, /« Le chiffre existe, mais pas pour ce qu'il désigne »/);
  assert.match(html, /introuvable/);
  assert.match(html, /« Aucune ligne publiée ne porte ce montant »/);
});

test("aucun cran ne porte de jugement — la page le dit explicitement", () => {
  const html = renduGrille();
  assert.match(html, /trompeur/i);
  assert.match(html, /mensonger/i);
  assert.match(html, /exagéré/i);
  assert.match(html, /compare deux nombres et nomme ce qui les sépare/);
});

test("les sept confusions figurent, chacune avec ce qu'elle désigne", () => {
  const html = renduGrille();
  const confusions = [
    "ae_cp",
    "brut_net",
    "vote_execute",
    "stock_flux",
    "etat_apu",
    "annuel_cumule",
    "perimetre_geographique",
  ];
  for (const confusion of confusions) {
    assert.match(html, new RegExp(confusion), `${confusion} absente de la grille`);
  }
  // Chaque confusion nomme ce qu'elle désigne, pas seulement son identifiant :
  // un lecteur qui ne connaît pas le vocabulaire du schéma doit s'y retrouver.
  assert.match(html, /autorisations d.engagement/i);
  assert.match(html, /brut.*net/i);
  assert.match(html, /voté.*exécuté/i);
  assert.match(html, /stock.*flux/i);
  assert.match(html, /administrations publiques/i);
  assert.match(html, /cumul/i);
  assert.match(html, /territoriaux|géographiques/i);
});

test("le cran hors_perimetre est rattaché aux sept confusions", () => {
  const html = renduGrille();
  assert.match(html, /hors_perimetre[\s\S]{0,400}(ae_cp|Les sept confusions)/i);
});

test("les sept registres figurent, et le septième dit que l'opinion n'existe pas", () => {
  const html = renduGrille();
  const registres = [
    "fait_comptable",
    "donnee_officielle",
    "resultat_simulation",
    "estimation_externe",
    "hypothese",
    "interpretation",
  ];
  for (const registre of registres) {
    assert.match(html, new RegExp(registre), `${registre} absent de la grille`);
  }
  assert.match(html, /opinion/i);
  assert.match(html, /n'existe pas/);
  assert.match(html, /bonne.*mauvaise|mauvaise.*bonne/i);
  assert.match(html, /souhaitable/i);
});

test("le critère de choix des sujets est écrit, sans auteur ni orientation", () => {
  const html = renduGrille();
  assert.match(html, /circule largement/);
  assert.match(html, /touche une ligne/);
  assert.match(html, /(N|n)i l'auteur.*(N|n)i son orientation|orientation.*n'entrent/i);
  assert.match(html, /file des sujets est publique/);
  assert.match(html, /issues du dépôt/);
});

test("aucune réserve qui s'excuse", () => {
  const html = renduGrille();
  assert.doesNotMatch(html, /ne garantit pas|fiabilité (est )?inégale|à prendre avec précaution/i);
});

test("le rendu est pur : deux appels produisent la même chaîne", () => {
  assert.equal(renduGrille(), renduGrille());
});

test("le rendu ne prend aucune donnée en entrée", () => {
  assert.equal(renduGrille.length, 0);
});
