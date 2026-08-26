/**
 * Trois défauts vus en naviguant sur le site, que rien ne testait : la légende
 * recouvrait la carte, l'année restait bloquée sur un vieux millésime, et un
 * maire manquant laissait un blanc indistinct d'une absence de fonctionnalité.
 */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import {
  dupliquer,
  enregistrer,
  lister,
  nomNettoye,
  renommer,
  type Depot,
} from "./scenarios.ts";
import { adresseTerritoire, estAccueil, vueDepuisAdresse } from "./routes.ts";
import { MAILLES_HORS_CARTE, NIVEAUX_RECHERCHABLES } from "./mailles.ts";
import { MAXIMUM } from "./comparateur.ts";
import type { Indicateur, Territoire } from "./donnees.ts";
import { carteRetenue, renduIndex, type Analyse } from "./analyse-rendu.ts";
import {
  appliquerEtatCarte,
  carteDemandeeParFragment,
  carteVisibleParDefaut,
  REQUETE_CARTE_SECONDAIRE,
  suivreVisibiliteCarteParDefaut,
} from "./carte-territoriale.ts";

const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const CSS = readFileSync(new URL("./style.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const BILAN_GUIDE = readFileSync(new URL("./styles/bilan-guide.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const FONDATIONS = readFileSync(new URL("./styles/fondations.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const TUNNEL_CABINET = readFileSync(new URL("./styles/tunnel-cabinet.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const DOSSIERS_VERIFICATION = readFileSync(new URL("./styles/dossiers-verification.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const REGISTRE_SOURCES = readFileSync(new URL("./styles/registre-sources.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const BRIEFING_TERRITORIAL = readFileSync(new URL("./briefing-territorial.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const FICHE = readFileSync(new URL("./fiche.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const ROUTES = readFileSync(new URL("./routes.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("les fondations communes rendent les états et actions accessibles", () => {
  assert.match(FONDATIONS, /--ui-nuit:\s*#10213a;/);
  assert.match(FONDATIONS, /--ui-papier:\s*#fbf7ee;/);
  assert.match(FONDATIONS, /min-height:\s*44px;/);
  assert.match(FONDATIONS, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  for (const etat of ["chargement", "vide", "erreur", "perime"]) {
    assert.match(FONDATIONS, new RegExp(`\\.ui-etat--${etat}`));
  }
  for (const classe of ["ui-conclusion", "ui-action", "ui-tiroir", "ui-visually-hidden", "ui-erreur-champ"]) {
    assert.match(FONDATIONS, new RegExp(`\\.${classe}`));
  }
  assert.match(MAIN, /import "\.\/styles\/fondations\.css";/);
});

test("les états communs se distinguent aussi sans leur couleur", () => {
  const marqueur = (etat: string): string => {
    const regle = [...FONDATIONS.matchAll(new RegExp(`\\.ui-etat--${etat}\\s*\\{([^}]+)\\}`, "g"))].at(-1);
    assert.ok(regle, `règle de l'état ${etat} introuvable`);
    const style = regle[1].match(/border-inline-start-style:\s*([\w-]+);/);
    assert.ok(style, `marqueur non chromatique absent pour ${etat}`);
    return style[1];
  };

  assert.deepEqual(
    ["chargement", "vide", "erreur", "perime"].map(marqueur),
    ["dotted", "dashed", "solid", "double"],
  );
});

test("le bilan n'annonce plus une unité générique que les chiffres démentent", () => {
  // « Montants en millions d'euros. » coiffait la section quand chaque montant
  // s'écrivait encore en millions bruts. Depuis `montantLisible` (échelle
  // choisie sur le montant, unité en toutes lettres — « 1 561,63 milliards
  // d'euros »), la mention générique ne décrivait plus ce que la page montre :
  // elle promettait des millions là où le lecteur lit des milliards en toutes
  // lettres. Le titre « La France dans son ensemble » est parti avec elle —
  // ce n'est pas la France, c'est le bilan, et l'onglet actif le dit déjà.
  const section = PAGE_BALISES.slice(
    PAGE_BALISES.indexOf('<section class="national"'),
    PAGE_BALISES.indexOf('id="bloc-ouverture"'),
  );
  assert.ok(section.length > 50, "section national introuvable");
  assert.doesNotMatch(section, /Montants en millions d&#39;euros\.|Montants en millions d'euros\./);
  assert.doesNotMatch(section, /La France dans son ensemble/);
});

test("le bilan ouvre par le verdict et laisse l'analyse entièrement visible", () => {
  const bilan = PAGE_BALISES.slice(
    PAGE_BALISES.indexOf('<section class="national"'),
    PAGE_BALISES.indexOf('<div class="bilan__attribution"'),
  );
  const position = (id: string) => {
    const index = bilan.indexOf(`id="${id}"`);
    assert.ok(index >= 0, `${id} introuvable dans le bilan`);
    return index;
  };

  assert.ok(position("conclusion-france-verdict") < bilan.indexOf('<nav class="bilan-guide__nav"'));
  assert.ok(position("conclusion-france-entrees") < position("conclusion-france-sorties"));
  assert.ok(position("conclusion-france-sorties") < position("conclusion-france-dette"));
  assert.ok(position("conclusion-france-dette") < position("bloc-europe"));
  assert.doesNotMatch(bilan, /<details class="bilan-details">|<summary>Comprendre le calcul<\/summary>/);
  for (const id of [
    "bloc-ouverture",
    "bloc-recettes-etat",
    "bloc-cent-euros-apu",
    "bloc-fonctions",
    "bloc-redistribution",
    "bloc-secu",
    "bloc-dette",
    "bloc-europe",
  ]) {
    assert.match(bilan, new RegExp(`<article class="bloc bloc--large(?: ouverture)?" id="${id}"></article>`));
  }
});

test("les introductions restent plates et le verdict tient sous 390 pixels", () => {
  assert.match(BILAN_GUIDE, /\.bilan-guide__section > \[id\^="conclusion-france-"\] > \.ui-conclusion/);
  assert.match(BILAN_GUIDE, /@media \(max-width: 40rem\)[\s\S]*?\.bilan-verdict__chiffres\s*\{[\s\S]*?grid-column: 1;/);
});

test("le verdict n'a ni doublon ni concurrent, et conduit au simulateur", () => {
  const bilan = PAGE_BALISES.slice(
    PAGE_BALISES.indexOf('<section class="national"'),
    PAGE_BALISES.indexOf('id="vue-simulateur"'),
  );
  assert.doesNotMatch(bilan, /id="bilan-synthese"|id="bilan-reperes"/);
  const europe = bilan.indexOf('id="bloc-europe"');
  const cta = bilan.indexOf('<a class="bilan-guide__cta" href="/simulateur">Passer au simulateur</a>');
  assert.ok(europe >= 0 && cta > europe, "le simulateur doit suivre l'analyse européenne");
  assert.match(BILAN_GUIDE, /#national \{\s*max-width: 72rem;/);
  assert.match(BILAN_GUIDE, /\.bilan-verdict \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(18rem, \.75fr\);/);
  assert.match(BILAN_GUIDE, /@media \(max-width: 40rem\)[\s\S]*?\.bilan-verdict\s*\{[^}]*grid-template-columns: 1fr;/);
});

test("les surcouches ne cachent pas la donnée qu'elles expliquent", () => {
  // Première version : la légende recouvrait le sud-ouest de la France. La
  // leçon n'a pas changé quand la carte est devenue la page : les surcouches
  // flottent, mais le cadrage réserve leurs zones (`paddingCarte`) pour que
  // la France se dessine dans l'espace libre, jamais derrière un panneau.
  assert.match(PAGE, /class="legende surcouche surcouche--legende"/);
  assert.match(MAIN, /function paddingCarte\(\)/);
  assert.match(MAIN, /fitBounds\(bornes, \{ padding: paddingCarte\(\)/);
  assert.match(MAIN, /fitBoundsOptions: \{ padding: paddingCarte\(\) \}/);
  assert.ok(CSS.includes(".surcouche--legende"));
});

test("changer de thème repart sur l'année la plus récente", () => {
  // La barre latérale gauche a disparu : le panneau de droite porte tout le
  // catalogue, thème après thème, déjà chargé. La règle vit dans
  // choisirIndicateur(), appelée au clic sur une ligne du panneau.
  // On lit le corps de la fonction, pas une fenêtre de N caractères après son
  // nom : chaque commentaire ajouté au-dessus de la règle faisait rougir ce
  // test sans que la règle ait bougé, et la réponse était d'élargir la fenêtre.
  const corps = MAIN.slice(
    MAIN.indexOf("async function choisirIndicateur"),
    MAIN.indexOf("function brancherCommandes"),
  );
  assert.ok(corps.length > 200, "corps de choisirIndicateur introuvable");
  assert.match(corps, /etat\.periode = ""/);
  assert.doesNotMatch(PAGE, /surcouche--commandes/);
  assert.match(MAIN, /\$\("fiche"\)\.addEventListener\("click", surLigne\)/);
  // Une mesure ne se peint que si elle existe à la maille affichée : les séries
  // nationales n'ont pas de valeur communale, et un indicateur calculé n'a pas
  // de couche publiée du tout.
  assert.match(corps, /if \(!choisi\.niveaux\?\.includes\(etat\.niveau\)\) return;/);
  assert.match(corps, /if \(IDS_DERIVES\.has\(id\)\) return;/);
});

test("la fiche n'aligne plus une seule ligne de mesure", () => {
  // Elle en alignait cent quinze, rangées par thème, plus les mêmes rangées
  // par question : la même valeur écrite deux fois sur une même page. Ce que
  // la fiche montre tient maintenant en quatre repères, quatre blocs et trois
  // faits ; l'exhaustivité est le métier de la page ANALYSES, où chaque
  // exercice publié a sa colonne.
  assert.doesNotMatch(FICHE, /data-mesure=/);
  assert.doesNotMatch(FICHE, /class="mesures"/);
  assert.doesNotMatch(FICHE, /theme-groupe|onglets-themes|onglets-rubriques/);
  // Le sélecteur d'indicateur de la carte a été retiré de l'écran le 17 août
  // 2026 : deux menus posés sur la carte pour des réglages que personne
  // n'employait. Ce qu'ils réglaient reste piloté par l'adresse, et « Voir sur
  // la carte » dans le détail d'une mesure appelle toujours `choisirIndicateur`.
  assert.doesNotMatch(MAIN, /construireSelecteurCarte|construireBarreCarte/);
  assert.match(MAIN, /async function choisirIndicateur\(id: string\): Promise<void>/);
});

test("un maire absent n'écrit rien, comme toute donnée absente", () => {
  // « Maire : non renseigné » occupait une ligne pour dire qu'il n'y avait
  // rien à dire, en contradiction avec la règle de la fiche.
  assert.doesNotMatch(FICHE, /non renseigné par le Répertoire/);
});

/* ------------------------------------------------------------------------
 * Le système de design, verrouillé. Ces tests ne jugent pas du goût : ils
 * empêchent la dette de revenir par la porte de derrière — une taille en dur
 * ici, un rayon de 2px là, un `<link>` vers Google Fonts « juste pour essayer ».
 * ---------------------------------------------------------------------- */

/** Corps de la feuille, tokens exclus : c'est là que les valeurs en dur se
 *  glissent. Le bloc `:root` et les `@font-face` ont le droit d'en contenir. */
const CSS_CORPS = CSS.slice(CSS.indexOf("* {\n  box-sizing: border-box;\n}"));
/** Les feuilles de ce projet se commentent beaucoup, et les commentaires peuvent
 *  documenter des seuils historiques. Un test qui cherche une interdiction doit
 *  lire les règles, pas les explications. */
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const CSS_REGLES = sansCommentaires(CSS);
const PAGE_BALISES = PAGE.replace(/<!--[\s\S]*?-->/g, "");

/** Luminance relative WCAG 2.x, sur une couleur hexadécimale. */
function luminance(hex: string): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const n = parseInt(hex.replace("#", ""), 16);
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
}
function contraste(a: string, b: string): number {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (haut + 0.05) / (bas + 0.05);
}
function token(nom: string): string {
  const m = CSS.match(new RegExp(`\\n\\s*${nom}:\\s*(#[0-9a-f]{6})\\s*;`, "i"));
  assert.ok(m, `token ${nom} introuvable`);
  return m![1];
}

function tokenFondation(nom: string): string {
  const racine = FONDATIONS.slice(FONDATIONS.indexOf(":root {"), FONDATIONS.indexOf("\n}"));
  const m = racine.match(new RegExp(`\\n\\s*${nom}:\\s*(#[0-9a-f]{6})\\s*;`, "i"));
  assert.ok(m, `token de fondation ${nom} introuvable`);
  return m![1];
}

test("le gris second passe AA sur le papier ET sur les carreaux", () => {
  // #6e7d73 donnait 4,34:1 sur blanc et 3,83:1 sur #f2f1ec : il porte les
  // sous-titres, les lectures des rapports, les légendes et les pilules
  // inactives — soit des dizaines d'échecs pour un seul token. La valeur se
  // calcule, elle ne se choisit pas à l'œil : le calcul est refait ici.
  const gris = token("--encre-douce");
  for (const fond of ["--papier", "--papier-creuse", "--fond"]) {
    const r = contraste(gris, token(fond));
    assert.ok(r >= 4.5, `--encre-douce sur ${fond} : ${r.toFixed(2)}:1 < 4,5`);
  }
});

test("l'argile reste lisible quand elle sert de couleur de texte", () => {
  // Survol d'un nom de mesure, mesure portée sur la carte, phrase d'alerte :
  // l'argile est du texte, pas seulement un filet.
  for (const t of ["--argile", "--alerte"]) {
    for (const fond of ["--papier", "--papier-creuse"]) {
      const r = contraste(token(t), token(fond));
      assert.ok(r >= 4.5, `${t} sur ${fond} : ${r.toFixed(2)}:1 < 4,5`);
    }
  }
});

test("l'anneau de focus se voit : 3:1 au moins, c'est un indicateur non textuel", () => {
  for (const fond of ["--papier", "--papier-creuse"]) {
    const r = contraste(token("--dore"), token(fond));
    assert.ok(r >= 3, `--dore sur ${fond} : ${r.toFixed(2)}:1 < 3`);
  }
});

/** Un token, lu dans le bloc de thème sombre plutôt que dans `:root`. */
function tokenSombre(nom: string): string {
  const bloc = CSS.slice(CSS.indexOf(':root[data-theme="sombre"] {'));
  const m = bloc.match(new RegExp(`\\n\\s*${nom}:\\s*(#[0-9a-f]{6})\\s*;`, "i"));
  assert.ok(m, `token sombre ${nom} introuvable`);
  return m![1];
}

test("le rendu sombre tient les mêmes seuils que le clair", () => {
  // Les ratios annoncés en tête du bloc sombre sont refaits ici. Une palette
  // sombre se juge encore moins à l'œil qu'une claire : le contraste y paraît
  // toujours plus fort qu'il n'est, et c'est précisément ce qui fait passer un
  // gris second sous AA sans que personne ne le remarque.
  for (const fond of ["--papier", "--papier-creuse", "--fond"]) {
    const r = contraste(tokenSombre("--encre-douce"), tokenSombre(fond));
    assert.ok(r >= 4.5, `sombre : --encre-douce sur ${fond} : ${r.toFixed(2)}:1 < 4,5`);
    const encre = contraste(tokenSombre("--encre"), tokenSombre(fond));
    assert.ok(encre >= 7, `sombre : --encre sur ${fond} : ${encre.toFixed(2)}:1 < 7`);
  }
  for (const t of ["--argile", "--alerte"]) {
    for (const fond of ["--papier", "--papier-creuse"]) {
      const r = contraste(tokenSombre(t), tokenSombre(fond));
      assert.ok(r >= 4.5, `sombre : ${t} sur ${fond} : ${r.toFixed(2)}:1 < 4,5`);
    }
  }
  for (const fond of ["--papier", "--papier-creuse", "--fond"]) {
    const r = contraste(tokenSombre("--dore"), tokenSombre(fond));
    assert.ok(r >= 3, `sombre : --dore sur ${fond} : ${r.toFixed(2)}:1 < 3`);
  }
  // Le texte posé SUR un aplat d'encre : c'est l'aplat qui change de camp
  // d'un thème à l'autre, et avec lui ce qui doit s'y lire.
  const surAplat = contraste(tokenSombre("--sur-encre"), tokenSombre("--encre"));
  assert.ok(surAplat >= 4.5, `sombre : --sur-encre sur --encre : ${surAplat.toFixed(2)}:1 < 4,5`);
  const surAplatClair = contraste(token("--sur-encre"), token("--encre"));
  assert.ok(surAplatClair >= 4.5, `clair : --sur-encre sur --encre : ${surAplatClair.toFixed(2)}:1 < 4,5`);
});

test("toutes les tailles de texte passent par l'échelle", () => {
  // 29 tailles distinctes avant, dont une nappe sous 12px. Une taille en dur
  // dans le corps de la feuille, c'est un cran de plus qui ne dit pas son nom.
  const enDur = [...sansCommentaires(CSS_CORPS).matchAll(/font-size:\s*([^;]+);/g)]
    .map((m) => m[1].trim())
    .filter((v) => !v.startsWith("var(--texte-"));
  // Seule exception : les textes *dans* un SVG, exprimés en unités du viewBox
  // et non en pixels CSS — l'échelle de la page ne les gouverne pas.
  assert.deepEqual(
    enDur.filter((v) => !/^\d+px$/.test(v)),
    [],
    "font-size en dur hors unités de viewBox",
  );
  for (const cran of ["xs", "s", "m", "l", "xl", "xxl"]) {
    assert.match(CSS, new RegExp(`--texte-${cran}:`), `cran --texte-${cran} manquant`);
  }
  // Plancher : aucun cran sous 0,75rem = 12px.
  for (const [, valeur] of CSS.matchAll(/--texte-[\w-]+:\s*([\d.]+)rem/g)) {
    assert.ok(Number(valeur) >= 0.75, `cran typographique à ${valeur}rem, sous le plancher`);
  }
});

test("aucun sélecteur réduit à un point isolé", () => {
  // Un nom de classe effacé laisse son point. Seul sur sa ligne, il fusionne
  // avec la règle suivante et rend le sélecteur invalide : le navigateur jette
  // la règle entière, sans un mot. Cent trente-deux points traînaient dans le
  // fichier, et l'un d'eux emportait le `position: relative` des onze cibles
  // tactiles — les liens de l'en-tête compris, dont les zones de frappe se
  // superposaient toutes au même endroit. On ne pouvait plus quitter la vue
  // courante.
  const orphelins = CSS.split("\n")
    .map((ligne, index) => [index + 1, ligne.trim()] as const)
    .filter(([, ligne]) => ligne === ".");
  assert.deepEqual(orphelins, [], `points isolés : ${orphelins.map(([n]) => n).join(", ")}`);
});

test("les onze cibles tactiles élargies portent bien un `position: relative`", () => {
  // Le pseudo-élément de 44 px se centre sur son bouton — à condition que le
  // bouton soit positionné. Sans quoi il se centre sur le premier ancêtre qui
  // l'est, et onze zones de frappe se retrouvent empilées au même endroit.
  const avecPseudo = [...CSS.matchAll(/^([^{}]*::after),?$/gm)]
    .map((m) => m[1]!.trim())
    .filter((s) => s.endsWith("::after"));
  const bloc = CSS.slice(CSS.indexOf("CIBLES TACTILES"));
  const positionnes = bloc.slice(0, bloc.indexOf("{"));
  for (const selecteur of ["\n.entete__nav a", "\n.pilule", "\n.legende__poignee"]) {
    assert.ok(positionnes.includes(selecteur), `${selecteur.trim()} n'est pas positionné`);
  }
  assert.ok(avecPseudo.length > 0);
});

test("tous les espacements passent par l'échelle", () => {
  // `(?<![-\w])` : `scroll-padding-left` est un décalage d'ancrage, pas un
  // espacement — il suit la position de la barre, pas le rythme de la page.
  const enDur = [...sansCommentaires(CSS_CORPS).matchAll(/(?<![-\w])padding(?:-\w+)?:\s*([^;{}]+);/g)]
    // les calculs (réservation de place pour un contrôle superposé, échelle
    // d'indentation) sont eux-mêmes écrits à partir des crans : on les retire
    // avant de découper, sinon `calc(a + b)` se lit comme trois valeurs.
    .map((m) => m[1].replace(/calc\((?:[^()]|\([^()]*\))*\)/g, ""))
    .flatMap((v) => v.split(/\s+/))
    .filter(
      (v) =>
        v !== "" &&
        v !== "0" &&
        !v.startsWith("var(--espace-") &&
        v !== "var(--cible)" &&
        // La gouttière de page : la marge qui sépare une vue du bord de
        // l'écran. Ce n'est pas un neuvième cran d'espacement — elle suit le
        // viewport là où les crans sont fixes — et elle est elle-même
        // calculée depuis deux d'entre eux, ce que le test vérifie plus bas.
        v !== "var(--gouttiere)",
    );
  assert.deepEqual(enDur, [], "padding en dur");
  assert.match(CSS, /--espace-1:/);
  assert.match(CSS, /--espace-8:/);
  // La gouttière n'échappe à l'échelle qu'en apparence : ses deux bornes en
  // sont des crans. Écrite `clamp(1rem, 4vw, 2.5rem)`, elle aurait rouvert la
  // porte aux valeurs libres par la fenêtre.
  assert.match(CSS, /--gouttiere: clamp\(var\(--espace-\d\), [\d.]+vw, var\(--espace-\d\)\);/);
});

test("plus aucune valeur de rayon en dur : trois rôles, quatre tokens", () => {
  // 999px, 12/8px et 2/3/5/6px cohabitaient sans règle écrite. La règle est en
  // tête de feuille ; ce test empêche un cinquième système d'apparaître.
  const enDur = [...sansCommentaires(CSS_CORPS).matchAll(/border-radius:\s*([^;{}]+);/g)]
    .flatMap((m) => m[1].split(/\s+/))
    .filter((v) => v !== "0" && v !== "50%" && !v.startsWith("var(--rayon"));
  assert.deepEqual(enDur, [], "rayon en dur (seule exception : 50%, une forme)");
  assert.match(CSS, /--rayon-pilule: 999px;/);
  assert.match(CSS, /--rayon-xs:/);
});

test("les points de rupture n'ont plus qu'une unité", () => {
  const seuils = [...CSS_REGLES.matchAll(/@media \(max-width: ([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(seuils.length > 0);
  for (const s of seuils) assert.match(s, /rem$/, `point de rupture en ${s}`);
  assert.deepEqual([...new Set(seuils)].sort(), ["40rem", "60rem"]);
});

test("les polices sont auto-hébergées : plus rien ne part chez Google", () => {
  // Bloquant au rendu, et transfert de l'IP du lecteur hors UE sur un site
  // civique français. Les deux familles sont sous SIL OFL.
  assert.doesNotMatch(PAGE_BALISES, /fonts\.googleapis\.com/);
  assert.doesNotMatch(PAGE_BALISES, /fonts\.gstatic\.com/);
  assert.doesNotMatch(CSS_REGLES, /fonts\.(googleapis|gstatic)\.com/);
  assert.match(CSS, /@font-face/);
  assert.match(CSS, /font-display: swap;/);
  for (const f of ["public-sans-latin", "spectral-500-latin", "spectral-600-latin", "spectral-700-latin"]) {
    assert.match(CSS, new RegExp(`/polices/${f}\\.woff2`), `${f} non déclarée`);
    assert.ok(
      readFileSync(new URL(`../public/polices/${f}.woff2`, import.meta.url)).length > 1000,
      `fichier ${f}.woff2 absent ou vide`,
    );
  }
});

test("le focus parle la même langue partout, liens compris", () => {
  // L'en-tête gardait l'anneau bleu du navigateur quand tout le reste passait
  // à l'or : au clavier, la même touche changeait de langage visuel entre la
  // navigation et la page.
  const regle = CSS.slice(CSS.indexOf("a:focus-visible,"), CSS.indexOf("a:focus-visible,") + 260);
  assert.match(regle, /button:focus-visible/);
  assert.match(regle, /summary:focus-visible/);
  assert.match(regle, /outline: 2px solid var\(--dore\)/);
});

test("les cibles tactiles font 44px, et leur barre aussi", () => {
  // Le rond « i » faisait 16px, les pilules 27, les onglets 29, la poignée 25.
  // La barre porteuse fait la même hauteur que la zone étendue : sinon deux
  // cibles se recouvrent et le doigt déclenche la voisine.
  assert.match(CSS, /\.mesure__info::after/);
  assert.match(CSS, /--cible: 2\.75rem;/);
  assert.match(CSS, /min-height: var\(--cible\);/);
  for (const sel of [".onglets-rubriques", ".onglets-themes", ".pilule"]) {
    const bloc = CSS.slice(CSS.indexOf(`\n${sel} {`), CSS.indexOf(`\n${sel} {`) + 700);
    assert.match(bloc, /min-height: (var\(--cible\)|1\.75rem);/, `${sel} sans hauteur de cible`);
  }
});

test("le clair reste le rendu de référence, le sombre n'est qu'une commodité", () => {
  // La décision « pas de mode sombre » est rouverte (décision de système 1).
  // Ce que ce test verrouille n'est donc plus son absence, mais les trois
  // garanties qui l'ont rendue acceptable.

  // 1. Le clair est le défaut : `:root` nu le déclare, et rien ne bascule sans
  //    que le lecteur ou son système l'ait demandé.
  assert.match(CSS, /:root \{\n\s*color-scheme: light;/);
  const corps = CSS.slice(CSS.indexOf("\nbody {"), CSS.indexOf("\nbody {") + 260);
  assert.match(corps, /background: var\(--fond\);/);
  // L'accent n'a pas de couleur propre : c'est un choix, pas un oubli.
  assert.match(CSS, /--accent: #0f1b2e;/);

  // 2. La bascule du lecteur l'emporte sur le système dans les deux sens : le
  //    bloc système s'exclut lui-même quand le clair a été choisi à la main.
  assert.match(CSS_REGLES, /@media \(prefers-color-scheme: dark\) \{\n\s*:root:not\(\[data-theme="clair"\]\) \{/);
  assert.match(CSS_REGLES, /:root\[data-theme="sombre"\] \{/);

  // 3. Parité : chaque token de couleur du clair a sa contrepartie sombre.
  //    Un token oublié, c'est une couleur du clair qui reste posée sur un fond
  //    sombre — invisible, et invisible seulement pour ceux qui lisent ainsi.
  const bloc = (debut: string) => {
    const i = CSS.indexOf(debut);
    return CSS.slice(i, CSS.indexOf("\n}", i));
  };
  const tokens = (texte: string) =>
    new Set([...texte.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
  const clair = tokens(bloc(":root {\n  color-scheme: light;"));
  const sombre = tokens(bloc(':root[data-theme="sombre"] {'));
  const couleurs = [...clair].filter((t) =>
    ["--encre", "--papier", "--fond", "--trait", "--accent", "--argile", "--dore", "--alerte", "--sur-encre", "--voile"].some(
      (racine) => t === racine || t.startsWith(`${racine}-`),
    ),
  );
  assert.ok(couleurs.length >= 12, `échantillon de tokens de couleur trop court : ${couleurs.length}`);
  assert.deepEqual(
    couleurs.filter((t) => !sombre.has(t)),
    [],
    "tokens de couleur sans contrepartie sombre",
  );

  // 4. Aucun composant ne redéfinit une couleur sous `[data-theme]` : les deux
  //    palettes vivent au même endroit, sinon la parité se perd au premier
  //    ajout et plus aucun test ne peut la vérifier.
  const ailleurs = [...CSS_REGLES.matchAll(/[^\n{}]*\[data-theme="(?:sombre|clair)"\][^{]*\{/g)]
    .map((m) => m[0].trim())
    .filter(
      (s) =>
        s !== ':root[data-theme="sombre"] {' &&
        s !== ':root:not([data-theme="clair"]) {',
    );
  assert.deepEqual(ailleurs, [], "palette redéfinie hors du bloc de thème");

  // 5. Ce qu'on imprime et ce qu'on cite reste le clair, quel que soit l'écran.
  assert.match(CSS_REGLES, /@media print \{\n\s*:root \{\n\s*color-scheme: light;/);
});

test("les barres de rubriques se lisent sans défiler jusqu'à elles", () => {
  // Rendues par fiche.ts après le pont, elles étaient à 2 282px de
  // défilement : `position: sticky` ne remonte rien, un élément collant part
  // de sa place dans le flux. L'ordre visuel se règle en CSS.
  assert.match(CSS, /\.fiche \.onglets-rubriques,\n\.fiche \.onglets-themes \{\n\s*order: -1;/);
  assert.match(CSS, /\.onglets-rubriques \{\n\s*position: sticky;/);
});

test("une prose ne court pas sur 140 caractères", () => {
  const bloc = CSS.slice(CSS.indexOf("LARGEUR DE LECTURE"));
  assert.match(bloc, /max-width: 70ch;/);
  assert.match(bloc, /\.questions span/);
});

test("l'état de l'URL est lu avant la première vue peinte", () => {
  // Un lien `#analyses` partagé s'ouvrait sur une page blanche : `basculerVue`
  // peint la vue demandée, ANALYSES lit `etat.selection` pour savoir si elle a
  // un territoire à détailler, et `etat` n'était affecté qu'après le premier
  // aller-retour réseau. La levée partait dans un `void` — donc aucune trace à
  // l'écran — et le défaut ne se voyait qu'au chargement à froid : en arrivant
  // depuis une autre vue, `etat` existait déjà.
  const corps = MAIN.slice(
    MAIN.indexOf("async function demarrer"),
    MAIN.indexOf("await donnees.initialiser()"),
  );
  assert.ok(corps.length > 100, "corps de demarrer introuvable");
  assert.ok(
    corps.indexOf("etat = lireUrl();") !== -1 &&
      corps.indexOf("etat = lireUrl();") < corps.indexOf("basculerVue();"),
    "etat doit être lu avant la première bascule de vue",
  );
  // Et une seule fois : réaffecté plus bas, il écraserait tout ce que la
  // première peinture aurait pu régler.
  assert.equal(MAIN.match(/^\s*etat = lireUrl\(\);$/gm)?.length, 1);
});

test("la carte est un mode de la vue territoire, plus une entrée de menu", () => {
  // Deux entrées pour un seul écran : le même panneau, la même fiche, avec ou
  // sans fond de carte derrière.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(balises, /data-vue="carte"/);
  // L'ancien bouton de mode a disparu ; la commande du briefing conserve,
  // elle, le choix de dévoiler la carte sans créer une nouvelle vue.
  assert.doesNotMatch(balises, /id="carte-bascule"/);
  assert.doesNotMatch(MAIN, /carteOuverte/);
  // Les liens `#carte` déjà partagés continuent d'ouvrir la fiche. La carte
  // adopte ensuite sa présentation adaptée au viewport.
  // La table des alias a rejoint `routes.ts`, où elle se teste sans navigateur.
  assert.match(ROUTES, /carte: "territoire"/);
  // La carte se mesure au montage : rendue dans un conteneur replié, elle
  // garderait cette taille au déploiement.
  assert.match(MAIN, /requestAnimationFrame\(\(\) => carte\?\.resize\(\)\);/);

  // La réécriture des liens à fragment garde une copie du fragment initial :
  // elle est nécessaire au choix explicite conservé de `#carte`, couvert par
  // son contrat de cycle ci-dessous.
  assert.match(MAIN, /const fragmentInitial = location\.hash;/);
});

test("chaque vue a une adresse, et les anciennes ouvrent la bonne", () => {
  // Le fragment ne part pas au serveur : tant que la vue y vivait, aucune page
  // ne pouvait être indexée ni servie pré-rendue.
  assert.match(MAIN, /vueDepuisAdresse\(location\.pathname, location\.hash\)/);
  // Le chemin est lu AVANT toute autre source : c'est lui qui fait foi.
  // Le sommaire du BILAN, qui suivait basculerVue, est parti avec le sommaire
  // lui-même (retiré) ; la borne vise désormais le commentaire qui le suit
  // directement dans le fichier.
  const BORNE = "/**\n * Ouvre ou referme le fond de carte.";
  // Une borne introuvable rend −1, et `slice(a, -1)` découpe jusqu'à la fin du
  // fichier : le test resterait vert en ne mesurant plus rien. C'est ce qui
  // s'est produit quand ce commentaire a été retitré.
  assert.ok(MAIN.includes(BORNE), "borne introuvable dans main.ts");
  const corps = MAIN.slice(MAIN.indexOf("function basculerVue"), MAIN.indexOf(BORNE));
  assert.ok(corps.length > 200, "corps de basculerVue introuvable");
  assert.ok(
    corps.indexOf("vueDepuisAdresse(") < corps.indexOf("vuesConnues()"),
    "la vue doit être résolue avant d'être confrontée aux vues ouvrables",
  );
  // L'adresse écrite conserve le chemin : sans lui, le premier réglage dans le
  // simulateur renvoyait le lecteur à la racine.
  assert.match(MAIN, /history\.replaceState\(null, "", `\$\{location\.pathname\}\?\$\{p\}\$\{location\.hash\}`\)/);
  // Les boutons précédent/suivant du navigateur restituent la vue.
  assert.match(MAIN, /window\.addEventListener\("popstate", basculerVue\)/);
  // Un lien à fragment déjà partagé est réécrit vers son chemin, sans
  // rechargement et sans perdre les paramètres.
  assert.match(MAIN, /history\.replaceState\(null, "", `\$\{cheminDeVue\(vueDuFragment\)\}\$\{location\.search\}`\)/);
  // La navigation vise des chemins : un `href="#territoire"` cliqué depuis
  // `/simulateur` donnerait `/simulateur#territoire`, et le chemin l'emporte.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(balises, /href="#(territoire|bilan|simulateur)"/);
  assert.match(balises, /id="navigation-principale"/);
  assert.match(MAIN, /import \{ (?:intercepterNavigation, )?renduNavigation \} from "\.\/navigation\.ts"/);
});

test("les vues renommées portent leur nouveau nom partout", () => {
  // « Analyses » désigne désormais les analyses éditoriales ; les tableaux d'un
  // territoire s'appellent « detail ». « Décryptages » est devenu « Repères ».
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balises, /id="vue-bilan"/);
  assert.doesNotMatch(balises, /id="vue-analyses"/);
  assert.doesNotMatch(balises, /id="vue-decryptages"/);
  // Et le nom retiré ne revient pas par la bande.
  assert.doesNotMatch(MAIN, /const VUES_PAGE = \[[^\]]*"donnees"/);
});

test("un seul champ de recherche pour tout le site", () => {
  // Il y en avait deux, `#recherche` et `#recherche-analyses`, câblés par la
  // même fonction sur le même index mais sans état commun : ce que l'un
  // trouvait, l'autre l'ignorait. Et la règle éditoriale demande le champ du
  // site, pas un autre.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.equal(balises.match(/type="search"/g)?.length, 1);
  assert.match(balises, /<header class="entete">[\s\S]*id="recherche"[\s\S]*<\/header>/);
  assert.equal(MAIN.match(/brancherRecherche\(/g)?.length, 2); // la définition et son seul appel
  // Le champ s'annonce `combobox` : un combobox qui dit toujours « replié » ne
  // dit rien à qui l'écoute.
  assert.match(balises, /role="combobox"/);
  assert.match(MAIN, /champ\.setAttribute\("aria-expanded", String\(ouverte\)\)/);
});

test("les trois états d'une zone de données se distinguent", () => {
  // Vide, en cours, en échec s'écrivaient en trois paragraphes gris
  // interchangeables : une page vide et une page en panne se lisaient pareil.
  for (const classe of [".etat", ".etat--echec", ".etat__titre", ".etat__quoi"]) {
    assert.ok(CSS.includes(`\n${classe}`), `${classe} sans style`);
  }
  // L'échec dit ce qui a échoué et propose de recommencer ; le détail
  // technique se replie, il ne s'affiche pas en tête.
  const echec = MAIN.slice(MAIN.indexOf("demarrer().catch("));
  assert.match(echec, /etat--echec/);
  assert.match(echec, /role="alert"/);
  assert.match(echec, /Réessayer/);
  assert.match(echec, /etat__detail/);
  // Le message technique passe par `textContent` : il peut porter une URL, et
  // une URL peut porter des chevrons.
  assert.match(echec, /bloc\.textContent = detail;/);
});

test("ce qui se peint sur le support suit le thème du support", () => {
  // Le halo des annotations du graphique était `rgb(255 255 255 / 0.85)` écrit
  // en dur, quand son `fill` suivait `--encre`. En thème sombre l'encre est
  // claire : le chiffre clair se retrouvait bordé d'un liseré clair de 3 px, et
  // « +7,3 % » se lisait comme une tache. Même cause pour l'aire sous la
  // courbe, un aplat d'encre à 5 % posé sur un fond d'encre.
  //
  // Ni les tests de couleur ni axe-core ne pouvaient le voir : les uns
  // calculent les ratios sur les couleurs DÉCLARÉES et un halo n'est pas un
  // fond, l'autre ne mesure pas le texte d'un SVG. C'est la peinture qui l'a
  // montré, comme pour l'opacité des paliers.
  for (const selecteur of [".graphique__valeur", ".graphique__aire"]) {
    const corps = CSS_REGLES.match(new RegExp(`\\${selecteur} \\{([^}]*)\\}`))?.[1];
    assert.ok(corps, `${selecteur} sans règle`);
    for (const propriete of ["stroke", "fill"]) {
      const valeur = corps.match(new RegExp(`(?:^|\\n)\\s*${propriete}:([^;]*);`))?.[1];
      if (!valeur || valeur.trim() === "none") continue;
      assert.match(valeur, /var\(--/, `${selecteur} : ${propriete} ne suit pas le thème`);
    }
  }
});

test("le bilan ne porte que ses chapitres", () => {
  // « Un amas d'analyses qui n'ont aucun lien entre elles » : la vue portait
  // aussi seize questions d'entrée — qui doublaient le sommaire — et les
  // tableaux de territoire, qui rangent une couche de carte et n'ont rien à
  // voir avec les cinq chapitres. Ce que le bilan garde : la section
  // nationale, et le pied que la Licence Ouverte impose.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  const debut = balises.indexOf('id="vue-bilan"');
  const fin = balises.indexOf('id="vue-simulateur"');
  assert.ok(debut > 0 && fin > debut, "bornes de la vue BILAN introuvables");
  const vue = balises.slice(debut, fin);
  assert.match(vue, /id="national"/);
  assert.doesNotMatch(vue, /methode-sources|bilan__attribution/);
  for (const intrus of ['id="questions"', 'id="palmares"', 'id="detail"', 'id="tableau-donnees"']) {
    assert.ok(!vue.includes(intrus), `${intrus} est resté dans le bilan`);
  }
});

test("la gamme ne peint jamais du texte : les signes de flux restent en encre", () => {
  // La gamme est validée à 3:1 — le seuil des MARQUES graphiques. Un texte de
  // 12 px exige 4,5:1 : les signes +/− des flux ne portent donc aucune
  // couleur, l'identité du chapitre passant par le filet de 4 px au-dessus,
  // qui est une marque.
  const flux = CSS_REGLES.match(/\.flux--plus,\s*\.flux--moins \{([^}]*)\}/)?.[1];
  assert.ok(flux, ".flux--plus/.flux--moins sans règle commune");
  assert.doesNotMatch(flux, /color:/);
});

test("les chapitres du bilan ne se numérotent pas : un intitulé, comme sur /territoire", () => {
  // « Chapitre 1 », « Chapitre 2 »… empilé cinq fois lisait comme une table
  // des matières de roman, et /territoire ne numérote aucune de ses
  // sections. Régression exacte d'une première correction qui n'avait
  // raccourci que les questions sans retirer le mot « Chapitre ».
  assert.doesNotMatch(PAGE, /chapitre__rang/);
  assert.doesNotMatch(PAGE, />Chapitre\s+\d</);
});

test("les grilles du bilan laissent leurs colonnes descendre sous leur contenu", () => {
  // Un enfant de grille a `min-width: auto` et refuse de descendre sous la
  // largeur de son contenu : une colonne écrite `1fr` laisse donc un tableau
  // large pousser le CORPS DE LA PAGE, alors même que ce tableau défile déjà
  // dans son propre cadre. Mesuré à 320 px avant correction : corps à 547 px,
  // la paire de chapitre à 482 px de contenu pour 190 px de place.
  //
  // La règle vaut pour les DEUX règles de la paire — celle à une colonne comme
  // celle à deux. C'est la version à une colonne qui manquait, et c'est elle
  // qui sert au téléphone, c'est-à-dire là où la place manque.
  for (const selecteur of [".chapitre", ".chapitre__paire"]) {
    const regles = [...CSS_REGLES.matchAll(new RegExp(`\\${selecteur} \\{([^}]*)\\}`, "g"))].map(
      (m) => m[1]!,
    );
    assert.ok(regles.length > 0, `${selecteur} sans règle`);
    for (const corps of regles) {
      const colonnes = corps.match(/grid-template-columns:([^;]*);/);
      if (!colonnes) continue;
      // Le `1fr` d'un `minmax(0, 1fr)` est justement la forme voulue : on ne
      // cherche que les pistes nues, une fois les minmax retirés.
      const nues = colonnes[1]!.replace(/minmax\([^)]*\)/g, "");
      assert.doesNotMatch(
        nues,
        /\bfr\b|\d+fr/,
        `${selecteur} : une piste en fr sans minmax(0,…) laisse son contenu élargir la page`,
      );
      assert.match(colonnes[1]!, /minmax\(0,/, selecteur);
    }
  }
});

test("une ancre interne d'une vue longue ne recharge pas la vue depuis le haut", () => {
  // Une ancre interne ne doit pas être prise pour une vue inconnue et renvoyer
  // le lecteur sur TERRITOIRE au moment où il descend dans ce qu'il lit.
  // Le fragment fait partie de la garde depuis qu'un Back vers `/` — cible
  // inconnue elle aussi, mais sans fragment — s'y faisait avaler : voir
  // "le Back vers `/` n'est plus avalé par la garde des ancres internes".
  assert.match(
    MAIN,
    /if \(!vuesConnues\(\)\.includes\(cible\) && document\.body\.dataset\.vue && location\.hash\) return;/,
  );
  assert.match(CSS, /scroll-margin-top: calc\(var\(--haut-entete\)/);
  // Le chemin nomme désormais la vue, si bien que la garde ci-dessus ne couvre
  // plus les ancres internes d'une page routée : c'est le retour en haut qui
  // doit être conditionnel, sinon il annule le défilement vers l'ancre.
  assert.match(MAIN, /const precedente = document\.body\.dataset\.vue;/);
  assert.match(MAIN, /if \(vue !== precedente\) window\.scrollTo\(\{ top: 0 \}\);/);
});

test("le sommaire du bilan est parti, pas seulement replié", () => {
  // Douze puis cinq entrées répétaient les questions déjà posées à l'écran :
  // un sommaire de la page qu'on est déjà en train de lire n'ajoute rien.
  assert.doesNotMatch(PAGE, /id="sommaire-bilan"/);
  assert.doesNotMatch(MAIN, /peindreSommaireReperes/);
  assert.doesNotMatch(CSS, /\.sommaire-vue/);
});

test("le Back vers `/` n'est plus avalé par la garde des ancres internes", () => {
  // Un lecteur arrivé sur `/` clique `/reperes`, puis appuie sur Précédent.
  // `vueDepuisAdresse("/", "")` renvoie `null` PAR DESIGN (routes.test.ts) :
  // l'appelant doit distinguer « rien n'est demandé » de « TERRITOIRE est
  // demandée ». `cible` valait donc "" — une cible inconnue de `vuesConnues()`
  // — exactement comme pour une ancre interne, et la garde avalait les deux
  // sans distinction : l'adresse revenait à `/?…`, la page restait figée sur
  // `/reperes`.
  //
  // On extrait l'expression EXACTE de la garde du fichier source et on
  // l'évalue avec les deux scénarios que le fragment doit désormais
  // distinguer, plutôt que de se fier à sa seule présence dans le texte.
  const garde = MAIN.match(
    /if \((!vuesConnues\(\)\.includes\(cible\) && document\.body\.dataset\.vue && location\.hash)\) return;/,
  );
  assert.ok(garde, "garde introuvable sous sa forme attendue");
  const avale = (cible: string, vueAffichee: string | undefined, hash: string): boolean =>
    Boolean(
      new Function(
        "vuesConnues",
        "document",
        "location",
        "cible",
        `return (${garde![1]});`,
      )(
        () => ["territoire", "bilan"],
        { body: { dataset: { vue: vueAffichee } } },
        { hash },
        cible,
      ),
    );
  // Back vers `/` : cible inconnue, une vue est déjà affichée, aucun fragment
  // — la garde ne doit plus avaler ce cas, `basculerVue` doit retomber sur
  // TERRITOIRE.
  assert.equal(avale("", "bilan", ""), false, "un Back vers / doit changer la vue affichée");
  // Ancre interne : cible inconnue aussi, mais un fragment est présent — le
  // comportement que la garde protège depuis l'origine ne doit pas régresser.
  assert.equal(avale("", "bilan", "#bloc-etat"), true, "une ancre interne doit laisser la vue en place");
});

test("sous le pouce, la navigation ne se coupe plus", () => {
  // Elle défilait horizontalement dans l'en-tête, coupée à droite : la
  // dernière entrée n'existait que pour qui pensait à pousser la barre.
  const petit = CSS.slice(CSS.indexOf("@media (max-width: 60rem)"), CSS.indexOf("@media (max-width: 40rem)"));
  assert.match(petit, /\.entete__nav \{[\s\S]*?position: fixed;/);
  assert.match(petit, /grid-auto-columns: 1fr;/);
  assert.match(petit, /env\(safe-area-inset-bottom, 0px\)/);
  // Et la barre basse ne recouvre pas la fin de la vue.
  assert.match(petit, /\.vue \{\n\s*padding-bottom:/);
});

test("la vue DONNÉES est retirée, et ses anciens liens ne cassent pas", () => {
  // 6 691 px de listes que personne ne parcourait. Ce qui disparaît de l'écran
  // est réel et assumé : « Sources et méthode », le tableau équivalent de la
  // carte, l'export CSV et le comparateur. Ce qui reste : le fichier public,
  // lié depuis le pied de page, et la définition de chaque mesure dans son
  // rond « i ».
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(balises, /id="vue-donnees"/);
  assert.doesNotMatch(balises, /data-vue="donnees"/);
  assert.doesNotMatch(MAIN, /const VUES_PAGE = \[[^\]]*"donnees"/);
  // Un lien `#donnees` déjà partagé ne doit pas laisser le lecteur sur une
  // page blanche : la vue de repli le ramène sur TERRITOIRE. Depuis que la
  // racine rend l'accueil, le repli a deux branches — et c'est celle qui ne
  // s'applique PAS ici qu'il faut vérifier : `#donnees` est un alias de
  // `territoire`, donc `estAccueil` répond faux et le lecteur va bien à la
  // carte, pas à l'accueil.
  assert.match(MAIN, /: estAccueil\(location\.pathname, location\.hash\)\s*\? "accueil"\s*: "territoire";/);
  assert.equal(estAccueil("/", "#donnees"), false);
  assert.equal(vueDepuisAdresse("/", "#donnees"), "territoire");
  // Et plus personne ne l'y envoie de son propre chef.
  assert.doesNotMatch(MAIN, /location\.hash = "#donnees"/);
  // Les fonctions qui peignaient dans ses conteneurs se taisent au lieu de
  // lever : `$` rend `null`, et `null.innerHTML` casse toute la fiche.
  assert.ok(
    MAIN.includes('if (!document.getElementById("sources-contenu")) return;'),
    "garde manquante pour #sources-contenu",
  );
  // Les écouteurs aussi. `brancherCommandes()` accrochait `#comparateur` sans
  // garde : `$` rend `null`, `null.addEventListener` lève, et l'exception
  // remontait au `.catch` de `demarrer()` — tout ce qui suit l'appel ne
  // s'exécutait plus, blocs de Décryptages compris.
  assert.match(
    MAIN,
    /document\.getElementById\("comparateur"\)\?\.addEventListener/,
    "écouteur non gardé : #comparateur",
  );
  assert.doesNotMatch(MAIN, /\$\("comparateur"\)\.addEventListener/);
  // Le classement de la couche et son export ont été retirés : ni le
  // conteneur, ni le bouton, ni leur guard ne devraient réapparaître.
  assert.doesNotMatch(PAGE, /id="tableau-donnees"/);
  assert.doesNotMatch(PAGE, /id="exporter"/);
  assert.doesNotMatch(MAIN, /getElementById\("exporter"\)/);
});

test("la carte territoriale est repliée par défaut sur mobile", () => {
  const requetes: string[] = [];
  const mobile = (requete: string) => {
    requetes.push(requete);
    return { matches: false };
  };

  assert.equal(carteVisibleParDefaut(mobile), false);
  assert.deepEqual(requetes, [REQUETE_CARTE_SECONDAIRE]);
});

test("la carte territoriale reste visible par défaut sur grand écran", () => {
  const bureau = (requete: string) => ({ matches: requete === REQUETE_CARTE_SECONDAIRE });

  assert.equal(carteVisibleParDefaut(bureau), true);
});

test("la carte suit le viewport jusqu'au premier choix explicite", () => {
  let changement: (() => void) | undefined;
  const media = {
    matches: false,
    addEventListener: (_: "change", ecouter: () => void) => { changement = ecouter; },
  };
  const poses: boolean[] = [];
  const cycle = suivreVisibiliteCarteParDefaut(() => media, (ouverte) => poses.push(ouverte));

  assert.deepEqual(poses, [false]);
  media.matches = true;
  changement?.();
  assert.deepEqual(poses, [false, true]);
  cycle.choisir(false);
  media.matches = false;
  changement?.();
  media.matches = true;
  changement?.();
  assert.deepEqual(poses, [false, true, false]);
});

test("révéler la carte met à jour son état et redimensionne l'instance", () => {
  const cadre = { hidden: true };
  const attributs = new Map<string, string>();
  const bouton = {
    textContent: "",
    setAttribute: (nom: string, valeur: string) => attributs.set(nom, valeur),
  };
  let redimensionnements = 0;

  appliquerEtatCarte(cadre, bouton, true, () => { redimensionnements += 1; });
  assert.equal(cadre.hidden, false);
  assert.equal(attributs.get("aria-expanded"), "true");
  assert.equal(bouton.textContent, "Masquer la carte");
  assert.equal(redimensionnements, 1);
  appliquerEtatCarte(cadre, bouton, false, () => { redimensionnements += 1; });
  assert.equal(cadre.hidden, true);
  assert.equal(attributs.get("aria-expanded"), "false");
  assert.equal(bouton.textContent, "Voir sur la carte");
  assert.equal(redimensionnements, 1);
});

test("le lien historique #carte devient un choix explicite conservé après sa réécriture", () => {
  assert.equal(carteDemandeeParFragment("#carte"), true);
  assert.equal(carteDemandeeParFragment("#bloc-etat"), false);
  assert.match(MAIN, /ouvrirCarteDemandee = carteDemandeeParFragment\(fragmentInitial\);/);
  assert.match(MAIN, /brancherBriefingTerritorial\(ouvrirCarteDemandee\);/);
});

test("l'attribution de la carte est repliée au premier rendu", () => {
  // `compact: true` pose le bouton « i » mais MapLibre rend la boîte OUVERTE
  // au premier affichage : la ligne de crédits — quatre producteurs et une
  // licence — mangeait le bas de la carte jusqu'au premier clic. Rien n'est
  // retiré : la mention reste à un clic, ce que la Licence Ouverte demande.
  assert.match(MAIN, /compact: true/);
  // C'est l'ATTRIBUT `open` du `<details>` qu'on ferme, pas la classe : MapLibre
  // resynchronise la classe sur l'attribut, si bien qu'une classe retirée
  // revient aussitôt. Vu au navigateur.
  assert.match(MAIN, /details\.maplibregl-ctrl-attrib/);
  assert.match(MAIN, /boite\.open = false;/);
  // Et pas sur `load`, qui attend les tuiles d'un tiers : sur un réseau lent ou
  // absent il ne vient jamais, et l'attribution resterait ouverte tout ce temps.
  // (main.ts emploie `carte.once("load")` ailleurs, à bon droit — l'assertion
  // porte donc sur CE geste-ci, pas sur l'absence de l'événement.)
  assert.match(MAIN, /requestAnimationFrame\(\(\) => \{\s+for \(const boite of/);
  const geste = MAIN.slice(MAIN.indexOf("requestAnimationFrame(() => {"));
  assert.doesNotMatch(geste.slice(0, 400), /once\("load"/);
});

test("la carte est à gauche, collante le long de toute la page du territoire", () => {
  // Empilées, la carte poussait la fiche sous la ligne de flottaison. Et
  // collée dans `.atelier`, elle s'arrêtait à la fin de la fiche : `sticky`
  // ne dépasse pas son conteneur, et « Sa place parmi les autres » comme le
  // panneau « davantage » défilaient sans carte en face. La grille vit donc
  // sur la vue, l'atelier passe en `display: contents`, et la piste de la
  // carte court sur les rangées de la fiche ET des tables.
  const bloc = CSS.slice(CSS.indexOf('/* La grille vit sur la VUE, pas sur l\'atelier'));
  assert.match(bloc, /body\[data-carte="oui"\] \.vue--territoire \{[^}]*grid-template-columns: minmax\(30rem, 1fr\) minmax\(0, 1\.25fr\);/);
  assert.match(bloc, /body\[data-carte="oui"\] \.vue--territoire \.atelier \{\n\s*display: contents;/);
  assert.match(bloc, /\.atelier__carte \{\n\s*grid-column: 1;\n\s*grid-row: 2 \/ span 2;\n\s*position: sticky;/);
  // Les tables continuent la colonne de la fiche, jamais une pleine page.
  assert.match(bloc, /\.territoire__tables \{\n\s*grid-column: 2;\n\s*grid-row: 3;/);
  // Sous 60rem, une colonne : deux donneraient une carte trop étroite pour
  // viser une commune et une colonne de texte de trente caractères.
  assert.match(bloc, /@media \(max-width: 60rem\) \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/);
});

test("les surcouches de la carte s'ancrent sur la carte, pas sur la page", () => {
  // Elles s'ancraient sur l'atelier, qui porte maintenant la fiche : les deux
  // menus déroulants venaient se poser en bas du texte, sans rien qui dise à
  // quoi ils servaient.
  assert.match(PAGE_BALISES, /<div class="atelier__carte">/);
  const carte = PAGE_BALISES.slice(
    PAGE_BALISES.indexOf('<div class="atelier__carte">'),
    PAGE_BALISES.indexOf('<aside class="panneau'),
  );
  for (const dedans of ['id="carte"', 'id="legende"', 'class="carte-barre"', 'id="etiquettes"', 'id="infobulle"']) {
    assert.ok(carte.includes(dedans), `${dedans} devrait être dans le cadre de la carte`);
  }
  // En haut du cadre : ce qu'on règle avant de lire la carte se met là où le
  // regard entre, et le bas reste au dessin.
  assert.match(CSS, /body\[data-carte="oui"\] \.carte-barre \{\n\s*position: absolute;\n\s*top: var\(--espace-4\);/);
});

test("cliquer une commune semblable met à jour toute la page, pas seulement la fiche", () => {
  // Cliquer « Lyon » dans les semblables d'Angers ouvrait la fiche de Lyon
  // mais laissait le groupe de semblables et le panneau « davantage » sur
  // Angers : `ouvrirTerritoire` ne repeint que la fiche. Les deux tableaux
  // délégués passent donc par `ouvrirDepuisTableau`, qui repeint ensuite le
  // classement et le groupe.
  assert.match(MAIN, /async function ouvrirDepuisTableau\(code: string, niveau: string \| null\)/);
  assert.match(MAIN, /await ouvrirTerritoire\(code, niveau\);\s*\n\s*if \(document\.body\.dataset\.vue === "territoire"\) \{\s*\n\s*await peindreDetail\(\);\s*\n\s*void peindrePalmares\(\);/);
  // Et le gestionnaire délégué est posé UNE seule fois : `peindrePalmares`
  // s'exécute à chaque clic, ré-attacher empilerait un écouteur par clic.
  assert.equal((MAIN.match(/if \(!cible\.dataset\.clicBranche\) \{/g) ?? []).length, 2);
  assert.doesNotMatch(MAIN, /void ouvrirTerritoire\(place\.dataset\.territoire/);
});

test("le bilan se lit à plat, comme la fiche territoire", () => {
  // Les cadres bordés, ombrés et rembourrés faisaient les « problèmes
  // d'espace » nommés par le propriétaire : chaque bloc ajoutait son coussin
  // au chapitre qui a déjà le sien. À plat, séparés par le filet du chapitre.
  assert.match(CSS, /\.national \.bloc \{\n\s*border: none;\n\s*border-radius: 0;\n\s*padding: 0;/);
  // Le verdict porte déjà l'équation et ses trois nombres : une seconde
  // synthèse d'ouverture doublerait le premier écran du bilan.
  assert.doesNotMatch(PAGE_BALISES, /id="bilan-synthese"|id="bilan-reperes"/);
});

test("choisir un territoire zoome la carte sur lui, pas seulement sur sa vue", () => {
  // Recadrer la seule vue d'ensemble laissait la carte immobile pour tout
  // choix à l'intérieur d'une même vue : cliquer une commune du groupe de
  // semblables ou la chercher au champ ouvrait sa fiche sans que la carte ne
  // bouge — « zéro intérêt d'avoir cette carte ». La géométrie vient des
  // tuiles chargées, avec un second essai après recadrage de la vue quand le
  // territoire est hors champ.
  assert.match(MAIN, /function bornesDuTerritoire\(/);
  assert.match(MAIN, /querySourceFeatures\("territoires"/);
  assert.match(MAIN, /fitBounds\(bornes, \{ padding: paddingCarte\(\), duration: 800, maxZoom: 11\.5 \}\)/);
  // Et le second essai ne zoome pas sur une sélection déjà remplacée.
  assert.match(MAIN, /if \(zoomAttendu !== code\) return;/);
});

test("l'infobulle dit le nom du territoire, jamais son code", () => {
  // Les tuiles portent le code là où l'on attendait le libellé : « 75 »
  // s'affichait pour la Nouvelle-Aquitaine. Le nom vient du référentiel,
  // comme pour les étiquettes.
  assert.doesNotMatch(MAIN, /const nom = \(figure\?\.properties\?\.nom as string \| undefined\) \?\? nomDe\(code\);/);
  assert.match(MAIN, /const nom = nomDe\(code\);/);
});

test("on arrive sur la France, jamais sur un résumé de couche", () => {
  // Le panneau montrait la dispersion de la couche affichée — minimum,
  // médiane, quartiles : une statistique sur des territoires, pas un
  // territoire. Le module qui l'écrivait est retiré.
  assert.doesNotMatch(MAIN, /apercuRendu|from "\.\/apercu\.ts"/);
  // La maille pays est demandée dès l'ouverture, avant la carte.
  assert.match(MAIN, /function chargerFrance\(\): Promise<void>/);
  assert.match(MAIN, /void chargerFrance\(\);\n\s*\/\/ Sans attendre/);
});

test("le pied de page est retiré", () => {
  // Deux paragraphes de mentions sous chaque vue.
  assert.doesNotMatch(PAGE_BALISES, /<footer/);
  assert.doesNotMatch(MAIN, /telechargement/);
  assert.doesNotMatch(CSS_REGLES, /\.pied\b/);
});

test("les repères se rangent sur la place réelle, pas sur la fenêtre", () => {
  // Quatre colonnes fixes dans une barre latérale : « Ce qu'elle encaisse »
  // s'affichait « Ce qu'elle e… » sur un écran de 1 440 px.
  assert.match(CSS, /\.reperes \{\n\s*display: grid;\n\s*grid-template-columns: repeat\(auto-fit, minmax\(9\.5rem, 1fr\)\);/);
});

test("les réglages ne se perdent plus : tous les budgets sont sur la même page", () => {
  // On changeait de budget par une barre de pastilles, et le changement
  // effaçait tout. Il n'y a plus de barre : les budgets se suivent en sections
  // sur une seule page, et un geste posé sur l'un n'efface rien chez l'autre —
  // chaque volet garde sa propre table de réglages.
  assert.doesNotMatch(MAIN, /reglagesParBudget|budgetAffiche/);
  const atelier = readFileSync(new URL("./atelier.ts", import.meta.url), "utf8");
  assert.match(atelier, /budgets: Map<string, Reglages>;/);
  assert.match(atelier, /baremes: Map<string, Taux>;/);
});

test("l'infobulle met une ligne par lecture", () => {
  // La valeur et sa seconde lecture se suivaient sans séparateur :
  // « 345 €2 158 M€ au total ».
  assert.match(CSS, /\.infobulle span \{\n\s*display: block;/);
});



test("aucun fetch de DÉTAIL ne part avant que l'initialisation n'ait résolu", () => {
  // Même défaut que MÉTHODE, pré-existant celui-là : `basculerVue` peint la
  // première vue AVANT `await donnees.initialiser()` dans `demarrer`, et
  // `etat = lireUrl()` a déjà lu le territoire dans `location.search`. Un
  // chargement à froid sur `/detail?territoire=…` — une adresse que cette
  // branche rend enfin partageable — appelait donc `chargerLotsNecessaires`
  // avec `donnees.racine` encore à "". `donnees.ts` cache par chemin
  // relatif, pas par URL résolue : l'échec se figeait pour le reste de la
  // session, et un lien partagé restait blanc, pour de bon.
  const corpsPeintre = MAIN.slice(
    MAIN.indexOf("async function peindreDetail"),
    MAIN.indexOf("Le simulateur n'est une vue du site"),
  );
  assert.ok(corpsPeintre.length > 100, "corps de peindreDetail introuvable");
  // `publiee`, pas `prete` : `prete` se résout dès que `donnees.racine` est
  // connue, alors que le catalogue n'est assemblé que plus loin dans
  // `demarrer`. Ce peintre partait donc parfois avec un catalogue vide et
  // `#detail` sortait blanc — mesuré une fois sur trois, à toutes les mailles.
  // `publiee` se résout après l'assemblage : elle vaut `prete` et davantage.
  assert.ok(
    corpsPeintre.indexOf("await publiee;") !== -1 &&
      corpsPeintre.indexOf("await publiee;") < corpsPeintre.indexOf("chargerLotsNecessaires("),
    "peindreDetail doit attendre `publiee` — le catalogue assemblé — avant tout fetch",
  );
});


test("le détail d'un territoire porte sa comparaison, plus son classement ni son export", () => {
  // Le classement de la couche affichée et son export CSV ont été retirés du
  // gabarit : demandé par le propriétaire du site, un tableau de cent
  // territoires sous « Davantage de données » n'avait plus sa place.
  // `#comparateur`, lui, reste — ce n'est pas la même fonctionnalité.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  const depart = balises.indexOf('class="territoire__tables"');
  // Une borne introuvable rend −1, et `slice(-1)` découpe la fin du fichier :
  // le test resterait vert en ne mesurant plus rien.
  assert.ok(depart > 0, "section des tableaux de territoire introuvable");
  const vue = balises.slice(depart);
  // **Il suit la carte, pas le bilan.** Il n'avait rien à voir avec les cinq
  // chapitres du bilan.
  assert.ok(
    balises.indexOf('id="vue-territoire"') < depart &&
      depart < balises.indexOf('id="vue-bilan"'),
    "les tableaux de territoire doivent vivre dans la vue TERRITOIRE",
  );
  assert.match(vue, /id="comparateur"/);
  assert.doesNotMatch(vue, /id="tableau-donnees"/);
  assert.doesNotMatch(vue, /id="exporter"/);
});

test("le seul cadre qui somme les trois budgets est montré, à côté de l'atelier", () => {
  // L'atelier n'écrit jamais de total : entre le budget général et les régimes
  // de base circulent des dizaines de milliards que chacun compte de son côté.
  // La comptabilité nationale est le seul cadre qui les somme — publiée, et
  // jamais affichée.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balises, /id="simu-recapitulatif"/);
  // Nommer le conteneur, pas seulement l'appel : peindre le récapitulatif dans
  // `#simu` passait la version précédente de ce test, et l'atelier l'aurait
  // effacé au premier réglage.
  assert.match(MAIN, /afficherRecapitulatif\(\$\("simu-recapitulatif"\)/);
  // Il est posé à côté de l'atelier, pas dedans : `afficherAtelier` possède
  // `#simu` et le repeint entièrement à chaque réglage.
  assert.doesNotMatch(MAIN, /afficherAtelier\(\$\("simu-recapitulatif"\)/);
  // Un cadre à côté de l'atelier qui n'a pas le fond, la bordure, l'ombre et
  // les marges de `.simu` se lit comme une ardoise nue à côté du reste. La
  // règle s'étend à `.simu-recapitulatif` plutôt que de dupliquer ses
  // déclarations, l'idiome déjà en place dans la feuille.
  assert.match(CSS, /\.simu,\n\.simu-recapitulatif \{\n\s*padding: var\(--espace-7\);/);
  // Ce même cadre — padding, fond, bordure, ombre — rend visible tout ce
  // qu'il entoure, y compris rien du tout : `#simu-recapitulatif` doit donc
  // partir caché, et ne se révéler qu'après un rendu réussi. Sans ce garde,
  // chaque lecteur qui ouvre /simulateur voit une case bordée, ombrée, vide
  // le temps du fetch — et pour de bon si `recapitulatif.json` n'est pas
  // publié, puisque le `catch` d'`ouvrirSimulateur` ne fait rien.
  const balisesRecap = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balisesRecap, /<section class="simu-recapitulatif" id="simu-recapitulatif" hidden>/);
  const corpsOuvrir = MAIN.slice(
    MAIN.indexOf("async function ouvrirSimulateur"),
    MAIN.indexOf("async function demarrer"),
  );
  const corpsRecap = corpsOuvrir.slice(corpsOuvrir.indexOf("afficherRecapitulatif("));
  assert.ok(
    corpsRecap.indexOf(".hidden = false;") !== -1 &&
      corpsRecap.indexOf(".hidden = false;") < corpsRecap.indexOf("catch"),
    "ouvrirSimulateur doit révéler #simu-recapitulatif seulement après un rendu réussi",
  );
  assert.match(corpsRecap, /catch \{[^}]*\.hidden = true;/);
});

test("le paramètre d'évolution ouvre ce qu'il promet, sans bouton pour le proposer", () => {
  // Le bouton a été retiré exprès : deux mots sans phrase pour deux façons de
  // peindre la même série, et la carte peignait la moitié du temps une
  // grandeur que le lecteur croyait être l'autre. Il ne revient pas.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(balises, /id="barre-mode"/);
  // Mais l'adresse porte toujours `mode=evolution`, lu et écrit : plus rien ne
  // doit l'annuler juste après sa lecture.
  assert.match(MAIN, /p\.get\("mode"\) === "evolution" \? "evolution" : "niveau"/);
  assert.doesNotMatch(MAIN, /function construireBarreMode\(\)/);
  // Le seul repli qui subsiste est celui qui a une raison comptable : une
  // évolution demande deux millésimes publiés à cette maille.
  assert.match(MAIN, /if \(periodes\.length < 2\) etat\.mode = "niveau";/);
});

test("une page éditoriale pré-rendue n'est pas repeinte par la vue territoire", () => {
  // Une page d'analyse sert le shell de l'application : sans garde,
  // `basculerVue` ne reconnaît pas son chemin, retombe sur la vue territoire
  // et masque le contenu déjà écrit dans le HTML. La page arriverait lisible
  // puis se viderait sous les yeux du lecteur.
  assert.match(MAIN, /document\.body\.dataset\.page === "editorial"/);
  const corps = MAIN.slice(MAIN.indexOf("function basculerVue"));
  assert.ok(
    corps.indexOf('dataset.page === "editorial"') < corps.indexOf("dataset.vue = vue"),
    "la garde doit précéder toute peinture de vue",
  );
});

test("une page éditoriale garde sa recherche, pas le reste de l'amorçage", () => {
  // La garde de `basculerVue` ne suffit pas seule : `demarrer()` continue
  // ensuite vers `construireSelecteurs()`, qui écrit dans `#pilules-vue` — un
  // conteneur de la vue territoire, absent d'une page éditoriale — et lèverait
  // sur un `$` renvoyant `null`. Le thème est déjà branché avant tout fetch, et
  // la navigation n'est que des liens sans `data-vue` qui se rechargent : seule
  // la recherche, dans l'en-tête commun aux deux types de page, a besoin d'être
  // câblée en JavaScript. Elle doit donc l'être AVANT la garde, pas dans la
  // branche qui s'arrête là — sans quoi elle ne fonctionnerait que sur la carte.
  const corps = MAIN.slice(MAIN.indexOf("async function demarrer"));
  // Le repère était `resoudrePrete()`, disparu avec MÉTHODE — c'était le seul
  // peintre qui attendait cette promesse. L'initialisation des données joue le
  // même rôle : c'est après elle que tout le reste de l'amorçage se branche.
  const idxResoudrePrete = corps.indexOf("await donnees.initialiser()");
  assert.ok(idxResoudrePrete !== -1, "donnees.initialiser() introuvable dans demarrer()");
  const idxRecherche = corps.indexOf("brancherRecherche(", idxResoudrePrete);
  const idxGarde = corps.indexOf('dataset.page === "editorial"', idxResoudrePrete);
  const idxSelecteurs = corps.indexOf("construireSelecteurs();", idxResoudrePrete);
  assert.ok(idxGarde !== -1, "garde éditoriale de demarrer() introuvable après l'initialisation");
  assert.ok(
    idxRecherche !== -1 && idxRecherche > idxResoudrePrete && idxRecherche < idxGarde,
    "la recherche doit être branchée avant la garde éditoriale, pour fonctionner sur les deux types de page",
  );
  assert.ok(
    idxGarde < idxSelecteurs,
    "la garde éditoriale doit précéder tout code qui suppose le shell de l'application",
  );
});

/* --------------------------------------------------------------------------
 * Choisir un territoire depuis une analyse pré-rendue
 *
 * Le champ de l'en-tête est câblé sur ces pages exprès (test ci-dessus), et
 * ce sont les pages d'arrivée des lecteurs venus d'un moteur : elles sont
 * indexables et au plan du site. Mais le pré-rendu remplace tout
 * `<main id="contenu">`, donc `#fiche` n'y est pas, et `$` est un cast, pas
 * une garde : `panneau.setAttribute` s'appliquait à `null`. Le champ proposait
 * des territoires et n'en ouvrait aucun.
 *
 * Les bancs qui suivent EXÉCUTENT le corps d'`ouvrirTerritoire` et celui de
 * `lireUrl` pris dans main.ts, avec un `$` qui rend `null` sur un identifiant
 * absent — ce que rend le vrai sur ces pages — et le vrai `adresseTerritoire`.
 * Lire cette chaîne ne suffisait pas : c'est en la lisant qu'elle a passé une
 * revue.
 * -------------------------------------------------------------------------- */

type OuvertureSimulee = {
  /** Les adresses données au navigateur, dans l'ordre. */
  adresses: string[];
  /** Les territoires pour lesquels le panneau a été peint. */
  fiches: string[];
  /** Les attributs posés et retirés sur `#fiche`. */
  gestes: string[];
  /** L'état de la carte après l'ouverture : la couche peinte, et la maille de
   *  sélection quand ce n'est pas elle. C'est ici que se lit la garde des
   *  mailles sans tuiles — `etat.niveau` ne doit jamais en prendre une. */
  etat: { niveau: string; maille: string | null };
  erreur: Error | null;
};

/** Le corps d'`ouvrirTerritoire` pris dans main.ts, débarrassé de ses seules
 *  annotations TypeScript. */
function corpsOuvrirTerritoire(): string {
  const debut = MAIN.indexOf("async function ouvrirTerritoire");
  const fin = MAIN.indexOf("function tiroirRedimensionnable");
  assert.ok(debut > -1 && fin > debut, "ouvrirTerritoire introuvable dans main.ts");
  const brut = MAIN.slice(debut, fin);
  // Verrouille la signature avant de lui ôter ses annotations : si elle change,
  // ce banc doit rougir plutôt qu'évaluer autre chose que la vraie fonction.
  assert.match(
    brut,
    /async function ouvrirTerritoire\(\s+code: string,\s+niveauDemande: string \| null,\s+nom\?: string,\s*\): Promise<void> \{/,
  );
  const corps = brut.replace(
    /async function ouvrirTerritoire\([\s\S]*?\): Promise<void> \{/,
    "async function ouvrirTerritoire(code, niveauDemande, nom) {",
  );
  assert.doesNotMatch(
    corps,
    /function \w+\([^)]*\):/,
    "une annotation de type reste dans le corps évalué",
  );
  return corps;
}

/** Ouvre un territoire comme le fait une suggestion de recherche, sur un
 *  document qui ne porte que les éléments listés.
 *
 *  `$` rend `null` pour un identifiant absent, exactement comme le vrai
 *  (`document.getElementById(id) as T`) : c'est cette absence qui faisait
 *  lever. `adresseTerritoire` n'est pas simulée — ce que le banc lit est
 *  l'adresse que le lecteur recevrait. */
async function executerOuvrirTerritoire(
  page: string | null,
  code: string,
  niveau: string | null,
  presents: string[] = [],
): Promise<OuvertureSimulee> {
  const adresses: string[] = [];
  const fiches: string[] = [];
  const gestes: string[] = [];
  const elements: Record<string, unknown> = {};
  for (const id of presents)
    elements[id] = {
      innerHTML: "",
      scrollTop: 1,
      setAttribute: (attribut: string, valeur: string) => gestes.push(`${attribut}=${valeur}`),
      removeAttribute: (attribut: string) => gestes.push(`-${attribut}`),
      querySelector: () => null,
    };
  const document = { body: { dataset: page ? { page } : {} } };
  const location = { assign: (adresse: string) => adresses.push(adresse) };
  const fileOuverture = { ouvrir: () => 1, courant: () => true, fermer: () => {} };
  const etat = { niveau: "commune", maille: null as string | null, niveauAuto: false };
  let erreur: Error | null = null;
  try {
    await (
      new Function(
        "document",
        "location",
        "adresseTerritoire",
        "$",
        "fileOuverture",
        "squeletteFiche",
        "repertoire",
        "entiteDe",
        "etat",
        "MAILLES_HORS_CARTE",
        "construireSelecteurs",
        "montrerFiche",
        "peindre",
        "demande",
        `${corpsOuvrirTerritoire()}
         return ouvrirTerritoire(demande.code, demande.niveau, demande.nom);`,
      )(
        document,
        location,
        adresseTerritoire,
        (id: string) => elements[id] ?? null,
        fileOuverture,
        () => "",
        null,
        () => null,
        etat,
        MAILLES_HORS_CARTE,
        () => {},
        (vise: string) => fiches.push(vise),
        () => {},
        { code, niveau, nom: "Territoire choisi" },
      ) as Promise<void>
    );
  } catch (leve) {
    erreur = leve as Error;
  }
  return { adresses, fiches, gestes, etat, erreur };
}

/** Ce que `lireUrl` — la vraie, prise dans main.ts avec `COUCHES`,
 *  `niveauConnu` et `mailleConnue` — lit d'une adresse. Le banc ne recopie ni
 *  la table des couches ni celle des mailles : il testerait sa propre copie. */
function executerLireUrl(adresse: string): Record<string, string | null> {
  const debutCouches = MAIN.indexOf("const COUCHES");
  const finCouches = MAIN.indexOf("type Etat = {");
  const debut = MAIN.indexOf("function niveauConnu");
  const fin = MAIN.indexOf("function ecrireUrl");
  assert.ok(debutCouches > -1 && finCouches > debutCouches, "COUCHES introuvable dans main.ts");
  assert.ok(debut > -1 && fin > debut, "lireUrl introuvable dans main.ts");
  const corps =
    MAIN.slice(debutCouches, finCouches).replace(
      "const COUCHES: Record<string, string> = {",
      "const COUCHES = {",
    ) +
    MAIN.slice(debut, fin)
      .replace("function niveauConnu(demande: string | null): string {", "function niveauConnu(demande) {")
      .replace(
        "function mailleConnue(demande: string | null): string | null {",
        "function mailleConnue(demande) {",
      )
      .replace("function niveauSelection(): string {", "function niveauSelection() {")
      .replace("function lireUrl(): Etat {", "function lireUrl() {");
  assert.doesNotMatch(
    corps,
    /function \w+\([^)]*\):/,
    "une annotation de type reste dans le corps évalué",
  );
  assert.doesNotMatch(corps, /const \w+:/, "une annotation de type reste dans le corps évalué");
  const location = { search: adresse.slice(adresse.indexOf("?")) };
  return new Function(
    "location",
    "MAILLES_HORS_CARTE",
    "NIVEAUX_RECHERCHABLES",
    "MAXIMUM",
    `${corps}\nreturn lireUrl();`,
  )(location, MAILLES_HORS_CARTE, NIVEAUX_RECHERCHABLES, MAXIMUM) as Record<string, string | null>;
}

/** Ce que la page DÉTAIL peint pour une sélection, par la vraie `peindreDetail`
 *  prise dans main.ts avec la vraie `niveauSelection` et le vrai
 *  `indicateursDeLaFiche` — les trois pièces dont l'accord fait la page. Ni
 *  l'une ni l'autre n'est recopiée ici : le banc testerait sa propre copie.
 *
 *  `davantageRendu` (davantage.ts) fait sa propre curation, thème par thème :
 *  le banc n'a pas à la rejouer, il capture ce qu'on lui passe — le
 *  territoire, le catalogue déjà filtré par la maille, les associations —
 *  pour vérifier l'accord des trois pièces plutôt que le rendu HTML. */
async function executerPeindreDetail(
  selection: { code: string | null; niveau: string; maille: string | null },
  catalogue: Indicateur[],
  entites: Record<string, Territoire>,
  associationsBanc: Record<string, unknown> = {},
): Promise<{
  territoire: Territoire | null;
  indicateurs: Indicateur[];
  associations: unknown;
  vide: string;
  charges: string[];
  comparateur: number;
}> {
  const debutSelection = MAIN.indexOf("function niveauSelection");
  const finSelection = MAIN.indexOf("function lireUrl");
  const debutFiltre = MAIN.indexOf("function indicateursDeLaFiche");
  const finFiltre = MAIN.indexOf("function afficherApercu");
  const debutPeintre = MAIN.indexOf("async function peindreDetail");
  const finPeintre = MAIN.indexOf("/** Le simulateur n'est une vue du site");
  assert.ok(finSelection > debutSelection && debutSelection > -1, "niveauSelection introuvable");
  assert.ok(finFiltre > debutFiltre && debutFiltre > -1, "indicateursDeLaFiche introuvable");
  assert.ok(finPeintre > debutPeintre && debutPeintre > -1, "peindreDetail introuvable");
  const corps = [
    MAIN.slice(debutSelection, finSelection).replace(
      "function niveauSelection(): string {",
      "function niveauSelection() {",
    ),
    MAIN.slice(debutFiltre, finFiltre).replace(
      "function indicateursDeLaFiche(niveau: string): Indicateur[] {",
      "function indicateursDeLaFiche(niveau) {",
    ),
    MAIN.slice(debutPeintre, finPeintre).replace(
      "async function peindreDetail(): Promise<void> {",
      "async function peindreDetail() {",
    ),
  ].join("\n");
  assert.doesNotMatch(
    corps,
    /function \w+\([^)]*\):/,
    "une annotation de type reste dans le corps évalué",
  );
  const detail = { innerHTML: "" };
  const etat = { selection: selection.code, niveau: selection.niveau, maille: selection.maille };
  const charges: string[] = [];
  let territoire: Territoire | null = null;
  let indicateurs: Indicateur[] = [];
  let associationsRecues: unknown;
  let comparateur = 0;
  await (
    new Function(
      "$",
      "prete",
      // `peindreDetail` attend `publiee` — le catalogue assemblé — et non plus
      // `prete`, qui se résout dès que la racine des données est connue.
      "publiee",
      "etat",
      "catalogue",
      "DENOMINATEURS",
      "chargerLotsNecessaires",
      "chargerAssociations",
      "entiteDe",
      "davantageRendu",
      "associations",
      "majComparateur",
      `${corps}\nreturn peindreDetail();`,
    )(
      (id: string) => (id === "detail" ? detail : null),
      Promise.resolve(),
      Promise.resolve(),
      etat,
      catalogue,
      new Set(["ofgl_population_reference"]),
      async (niveau: string, codes: string[]) => {
        charges.push(`${niveau}:${codes.join(",")}`);
      },
      async () => {},
      (code: string, niveau: string) => entites[`${niveau}:${code}`],
      (t: Territoire, i: Indicateur[], a: unknown) => {
        territoire = t;
        indicateurs = i;
        associationsRecues = a;
        return "";
      },
      associationsBanc,
      async () => {
        comparateur += 1;
      },
    ) as Promise<void>
  );
  return { territoire, indicateurs, associations: associationsRecues, vide: detail.innerHTML, charges, comparateur };
}

test("choisir un territoire depuis une analyse pré-rendue ouvre ce territoire", async () => {
  // Le panneau que peint `ouvrirTerritoire` vit dans `<main id="contenu">`,
  // la région entière que le pré-rendu remplace par l'analyse : voilà pourquoi
  // ces pages n'ont pas de `#fiche`.
  const ouverture = PAGE.indexOf('<main id="contenu">');
  assert.ok(ouverture > -1, "#contenu introuvable dans index.html");
  const fermeture = PAGE.indexOf("</main>", ouverture);
  const fiche = PAGE.indexOf('id="fiche"');
  assert.ok(
    fiche > ouverture && fiche < fermeture,
    "#fiche doit être dans #contenu : c'est ce que le pré-rendu remplace",
  );

  const choix = await executerOuvrirTerritoire("editorial", "33063", "commune");
  assert.equal(choix.erreur, null, "ouvrir un territoire ne doit rien lever sur une page servie");
  // Une adresse, pas une peinture : la page n'a pas de panneau à peindre.
  assert.deepEqual(choix.adresses, ["/territoire?niveau=commune&territoire=33063"]);
  assert.deepEqual(choix.fiches, []);
  // Et cette adresse ouvre bien CE territoire, à SA maille — lu par la vraie
  // `lireUrl`, celle qui s'exécutera au chargement suivant.
  const lu = executerLireUrl(choix.adresses[0]!);
  assert.equal(lu.selection, "33063");
  assert.equal(lu.niveau, "commune");
  assert.equal(lu.maille, null);
});

test("la même commande sur la carte peint toujours le panneau, sans quitter la page", async () => {
  const choix = await executerOuvrirTerritoire(null, "33063", "commune", [
    "fiche",
    "volet-territoire",
  ]);
  assert.equal(choix.erreur, null);
  assert.deepEqual(choix.adresses, [], "la carte ouvre la fiche sur place, elle ne navigue pas");
  assert.deepEqual(choix.fiches, ["33063"]);
  assert.deepEqual(choix.gestes, ["aria-busy=true", "-aria-busy"]);
});

test("un arrondissement municipal choisi depuis une analyse s'ouvre par sa maille", async () => {
  // La carte n'a pas de couche d'arrondissements : écrite en `niveau`, la
  // maille serait ramenée à la maille par défaut au chargement suivant et la
  // fiche de Paris 1er s'ouvrirait sur une région.
  const choix = await executerOuvrirTerritoire("editorial", "75101", "arrondissement_municipal");
  assert.equal(choix.erreur, null);
  assert.deepEqual(choix.adresses, [
    "/territoire?maille=arrondissement_municipal&territoire=75101",
  ]);
  const lu = executerLireUrl(choix.adresses[0]!);
  assert.equal(lu.selection, "75101");
  assert.equal(lu.maille, "arrondissement_municipal");
});

/* --------------------------------------------------------------------------
 * La maille pays : « la même fiche à toutes les mailles » (CLAUDE.md).
 *
 * Les 81 indicateurs du budget de l'État déclarent `niveaux: ["pays"]`, et le
 * site filtre son catalogue sur ce champ. Aucune commande ne posait `pays` en
 * maille de sélection : `/detail?territoire=FR` peignait une France déclarée
 * région, dont aucune ligne nationale ne passait le filtre, et `#detail`
 * restait vide.
 * -------------------------------------------------------------------------- */

/** Deux indicateurs nationaux, un local, et le dénominateur que la fiche
 *  n'affiche jamais. Les millésimes sont ceux de la fenêtre du dépôt. */
const CATALOGUE_BANC = [
  { id: "etat_depenses_nettes", libelle: "Dépenses nettes", theme: "budget_etat", niveaux: ["pays"] },
  { id: "etat_charge_dette", libelle: "Charge de la dette", theme: "budget_etat", niveaux: ["pays"] },
  {
    id: "ofgl_depenses_fonctionnement",
    libelle: "Dépenses de fonctionnement",
    theme: "finances_locales",
    niveaux: ["commune", "departement", "region"],
  },
  {
    id: "ofgl_population_reference",
    libelle: "Population de référence",
    theme: "population",
    niveaux: ["commune", "departement", "region", "pays"],
  },
] as unknown as Indicateur[];

/** La France telle que `territoires/pays/tous.json` la publie : ses séries
 *  nationales, et celles que le filtre de maille doit écarter. */
const FRANCE_BANC = {
  "pays:FR": {
    nom: "France",
    parent: null,
    series: {
      etat_depenses_nettes: { "2019": 337_000, "2025": 501_000 },
      etat_charge_dette: { "2019": 40_300, "2025": 66_500 },
      ofgl_depenses_fonctionnement: { "2019": 1, "2025": 2 },
      ofgl_population_reference: { "2019": 67_000_000, "2025": 68_600_000 },
    },
  },
  "region:FR": undefined,
} as unknown as Record<string, Territoire>;

test("la page DÉTAIL passe à davantageRendu le territoire et le catalogue de la maille ouverte", async () => {
  // La France s'ouvre à la maille pays sans que la carte quitte sa couche :
  // c'est `etat.maille` qui la porte, comme pour un arrondissement.
  const peinte = await executerPeindreDetail(
    { code: "FR", niveau: "region", maille: "pays" },
    CATALOGUE_BANC,
    FRANCE_BANC,
    { FR: { exercice: "2021", beneficiaires: [] } },
  );
  // Le lot demandé est celui de la maille de sélection : chercher « FR » dans
  // les régions ne rendrait rien du tout.
  assert.deepEqual(peinte.charges, ["pays:FR"]);
  assert.equal(peinte.territoire, FRANCE_BANC["pays:FR"]);
  // Le catalogue passé à davantageRendu est déjà filtré par la maille : le
  // local (« finances_locales ») n'est pas publié à cette maille, et le
  // dénominateur ne fait jamais une ligne — c'est `indicateursDeLaFiche` qui
  // fait ce travail, pas davantage.ts, et c'est cet accord que ce test tient.
  assert.deepEqual(
    peinte.indicateurs.map((i) => i.id),
    ["etat_depenses_nettes", "etat_charge_dette"],
  );
  // Et davantage.ts reçoit bien les associations de ce territoire, telles que
  // `main.ts` les tient — le banc ne rejoue pas sa curation, il vérifie
  // qu'elle reçoit ce qu'il faut.
  assert.deepEqual(peinte.associations, { exercice: "2021", beneficiaires: [] });

  // Et la même page à la maille d'à côté ne montre pas les lignes nationales :
  // c'est bien le filtre de maille qui travaille, pas l'ordre du catalogue.
  const region = await executerPeindreDetail(
    { code: "75", niveau: "region", maille: null },
    CATALOGUE_BANC,
    {
      "region:75": {
        nom: "Nouvelle-Aquitaine",
        series: { ofgl_depenses_fonctionnement: { "2019": 1, "2025": 2 } },
      },
    } as unknown as Record<string, Territoire>,
  );
  assert.deepEqual(
    region.indicateurs.map((i) => i.id),
    ["ofgl_depenses_fonctionnement"],
  );
  // Aucune association publiée pour ce code dans le banc : `associations[code]`
  // vaut `undefined`, et davantage.ts doit pouvoir le recevoir tel quel.
  assert.equal(region.associations, undefined);
});

test("le comparateur de DÉTAIL est appelé pour se taire, il n'est pas sauté", async () => {
  // Comparer suppose plusieurs territoires d'une même maille ; la France est
  // seule à la sienne. Le peintre appelle quand même `majComparateur`, qui
  // referme `#comparateur` — le retour du peintre commande la visibilité du
  // conteneur, c'est la règle du dépôt. Le sauter laisserait à l'écran le
  // comparateur du territoire précédent.
  const peinte = await executerPeindreDetail(
    { code: "FR", niveau: "region", maille: "pays" },
    CATALOGUE_BANC,
    FRANCE_BANC,
  );
  assert.equal(peinte.comparateur, 1);
  // Et sans sélection, la page dit ce qu'elle attend au lieu de peindre un
  // cadre vide : aucune rubrique, aucun lot demandé, aucun comparateur.
  const sans = await executerPeindreDetail(
    { code: null, niveau: "region", maille: null },
    CATALOGUE_BANC,
    FRANCE_BANC,
  );
  assert.equal(sans.territoire, null);
  assert.deepEqual(sans.charges, []);
  assert.equal(sans.comparateur, 0);
  assert.match(sans.vide, /Aucun territoire choisi/);
});

test("ouvrir la France ne fait pas changer la carte de couche", async () => {
  // `pays` n'a pas de tuiles — `NIVEAUX_CARTOGRAPHIES` de publish.py n'en
  // retient que trois — et `COUCHES` n'en porte donc aucune. Laisser
  // `etat.niveau` la prendre ferait demander `remplissage-undefined` à
  // MapLibre au premier repeint.
  const choix = await executerOuvrirTerritoire(null, "FR", "pays", ["fiche", "volet-territoire"]);
  assert.equal(choix.erreur, null);
  assert.equal(choix.etat.niveau, "commune", "la couche peinte ne bouge pas");
  assert.equal(choix.etat.maille, "pays");
  assert.deepEqual(choix.fiches, ["FR"]);

  // Depuis une analyse pré-rendue, la même commande écrit une adresse dont la
  // maille survit à la relecture : en `niveau`, `niveauConnu` la ramènerait à
  // la maille par défaut et la France s'ouvrirait sur une région.
  const lien = await executerOuvrirTerritoire("editorial", "FR", "pays");
  assert.deepEqual(lien.adresses, ["/territoire?maille=pays&territoire=FR"]);
  const lu = executerLireUrl(lien.adresses[0]!);
  assert.equal(lu.selection, "FR");
  assert.equal(lu.maille, "pays");
  assert.notEqual(lu.niveau, "pays", "la maille de la carte reste une couche de tuiles");

  // Et l'adresse écrite à la main tombe sur la même garde.
  const force = executerLireUrl("/detail?niveau=pays&territoire=FR");
  assert.notEqual(force.niveau, "pays");
});

test("la panne de chargement ne s'écrit pas là où il n'y a pas où l'écrire", () => {
  // Le rattrapage de `demarrer()` écrit dans `#vue-accueil` ou `#fiche` :
  // aucun des deux n'existe sur une page d'analyse, et `$` étant un cast, la
  // panne se doublait d'une levée dans son propre rattrapage. Une analyse
  // porte son texte et ses chiffres dans le HTML servi : il n'y a rien à
  // annoncer.
  const corps = MAIN.slice(MAIN.indexOf("demarrer().catch("));
  const idxGarde = corps.indexOf('dataset.page === "editorial"');
  const idxHote = corps.indexOf('$("vue-accueil")');
  assert.ok(idxGarde > -1, "garde éditoriale introuvable dans le rattrapage de demarrer()");
  assert.ok(idxHote > idxGarde, "la garde doit précéder tout `$` sur un conteneur de vue");
});

test("le site ne dessine pas de corrélations et ne mêle pas deux unités", () => {
  // Un nuage de points assorti d'un coefficient de Pearson est l'écran où le
  // lecteur lit une causalité tout seul : la charte l'interdit, le module n'a
  // jamais été branché, il est retiré.
  assert.doesNotMatch(MAIN, /from "\.\/croiser\.ts"/);
  // Les euros constants introduisaient une seconde unité à côté du million
  // d'euros courants, que les règles d'affichage n'admettent pas.
  assert.doesNotMatch(MAIN, /from "\.\/euros-constants\.ts"/);
});

test("aucun conteneur que rien ne remplit", () => {
  // `#palmares` a été retiré au lot 0 parce que RIEN ne l'écrivait : un cadre
  // vide dans le document est une promesse que la page ne tient pas, et il a
  // survécu des mois sans que personne s'en aperçoive.
  //
  // Il est revenu le 17 août 2026, rempli cette fois — le palmarès des notes.
  // Ce que la garde d'origine protégeait n'était pas l'absence d'un palmarès
  // mais l'absence d'un conteneur mort, et c'est cela qu'elle vérifie
  // désormais : le conteneur peut exister, à condition que `main.ts` l'écrive.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  if (/id="palmares"/.test(balises)) {
    assert.match(
      MAIN,
      /getElementById\("palmares"\)/,
      "#palmares est dans le document et personne ne l'écrit",
    );
    assert.match(MAIN, /rendrePalmares\(/);
  }
});

/* ------------------------------------------------------------------------
 * La barre de scénarios et la comparaison — tâche 4 du lot « Le simulateur
 * enregistre » (scenarios.ts, comparaison.ts, scenarios-rendu.ts).
 * ---------------------------------------------------------------------- */

test("le conteneur #scenarios existe et précède #simu", () => {
  // La barre se lit avant l'atelier : un lecteur qui arrive doit d'abord voir
  // ce qu'il a déjà enregistré, pas le découvrir sous le formulaire.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  const vue = balises.slice(balises.indexOf('id="vue-simulateur"'));
  assert.match(vue, /id="scenarios"/);
  assert.ok(
    vue.indexOf('id="scenarios"') < vue.indexOf('id="simu"'),
    "#scenarios doit précéder #simu",
  );
});

test("lireUrl lit nom, face et face-nom, comme budget et contrat", () => {
  const corps = MAIN.slice(MAIN.indexOf("function lireUrl()"), MAIN.indexOf("function ecrireUrl()"));
  assert.match(corps, /nom: p\.get\("nom"\) \?\? ""/);
  assert.match(corps, /face: p\.get\("face"\) \?\? ""/);
  assert.match(corps, /faceNom: p\.get\("face-nom"\) \?\? ""/);
});

test("ecrireUrl écrit nom, face et face-nom seulement quand ils ne sont pas vides", () => {
  const corps = MAIN.slice(MAIN.indexOf("function ecrireUrl()"), MAIN.indexOf("history.replaceState"));
  assert.match(corps, /if \(etat\.nom\) p\.set\("nom", etat\.nom\);/);
  assert.match(corps, /if \(etat\.face\) p\.set\("face", etat\.face\);/);
  assert.match(corps, /if \(etat\.faceNom\) p\.set\("face-nom", etat\.faceNom\);/);
});

test("recharger un scénario rappelle afficherAtelier, sans toucher à atelier.ts", () => {
  // `afficherAtelier` est déjà ré-entrante (`montage?.abort()` à son début,
  // simulateur-rendu.ts) : recharger un scénario est un second appel avec un
  // état décodé, jamais une modification du moteur.
  assert.match(MAIN, /function chargerScenario\(nom: string\): void \{/);
  const corps = MAIN.slice(
    MAIN.indexOf("function chargerScenario"),
    MAIN.indexOf("function chargerScenario") + 900,
  );
  assert.match(corps, /afficherAtelier\(\$\("simu"\), voletsMontes/);
  // Le moteur lui-même n'a pas bougé : ni `atelier.ts` ni `simulateur.ts` ni
  // `simulateur-rendu.ts` ne mentionnent les scénarios.
  for (const fichier of ["atelier.ts", "simulateur.ts", "simulateur-rendu.ts"]) {
    const source = readFileSync(new URL(`./${fichier}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /[Ss]cenario/, `${fichier} ne doit pas connaître les scénarios`);
  }
});

/* ------------------------------------------------------------------------
 * `transposer` (scenarios.ts) avait un appelant nulle part : Task 5 l'a
 * ajouté, confiné à ses propres fichiers, sans que rien ne l'invoque. Charger
 * un scénario enregistré doit désormais passer par lui — pas par `decoder`
 * seul, qui ignore en silence les lignes que la nomenclature a laissées
 * tomber — et les lignes disparues doivent se nommer à l'écran.
 * ---------------------------------------------------------------------- */

test("charger un scénario passe par transposer, jamais par decoder seul", () => {
  const corps = MAIN.slice(
    MAIN.indexOf("function chargerScenario"),
    MAIN.indexOf("function chargerScenario") + 900,
  );
  assert.match(corps, /transposer\(scenario, voletsMontes\)/);
  // L'état donné à l'atelier vient de la transposition, pas d'un decodage
  // direct qui laisserait les lignes disparues sans nom.
  assert.doesNotMatch(corps, /etat: decoderAtelier\(scenario\.budget, voletsMontes\)/);
  assert.match(corps, /disparuesCourantes = \{ lignes: disparues, rienRepris \}/);
});

test("régler l'atelier reconstruit la barre des scénarios, donc les boutons de partage", () => {
  // Les boutons de partage sont peints par `montrerScenarios()` et ne
  // s'offrent qu'avec un atelier réglé (`partageDuSimulateur`). Le seul
  // chemin qui les fait apparaître sur le parcours ordinaire — régler, puis
  // partager — est donc ce rappel depuis `surReglages`. Sans lui, le lecteur
  // ne verrait de bouton qu'après avoir touché à un scénario, et le lot
  // entier resterait hors d'atteinte.
  // Les deux poses de l'atelier — celle de `chargerScenario` et celle
  // d'`ouvrirSimulateur` — sont éprouvées, pas seulement la première : une
  // seule des deux privée de ce rappel laisserait le défaut entier sur un
  // parcours, et le fichier ne dit pas laquelle le lecteur emprunte.
  const poses = [...MAIN.matchAll(/surReglages: \(/g)].map((m) =>
    MAIN.slice(m.index, MAIN.indexOf("\n  });", m.index)),
  );
  assert.equal(poses.length, 2, "les poses de l'atelier ont changé de nombre dans main.ts");
  for (const pose of poses) assert.match(pose, /\bmontrerScenarios\(\);/);
});

test("tout budget encodé qui devient un état de l'atelier passe par la même porte", () => {
  // `transposer` n'était branché que sur le scénario cliqué dans la barre — le
  // seul des trois chemins où le lecteur avait déjà sa copie. Le budget porté
  // par l'adresse (lien partagé, bouton « Rejouer » d'une analyse) et la
  // colonne comparée passaient par `decoder` nu, et perdaient leurs lignes
  // sans un mot. Plus aucun `decoder` d'atelier ne subsiste dans main.ts : la
  // porte est unique, donc les trois chemins nomment ce qu'ils abandonnent.
  assert.doesNotMatch(MAIN, /decoder as decoderAtelier/);
  assert.doesNotMatch(MAIN, /\bdecoderAtelier\(/);
  const ouverture = MAIN.slice(
    MAIN.indexOf("async function ouvrirSimulateur"),
    MAIN.indexOf("async function demarrer"),
  );
  assert.match(ouverture, /transposerBudget\(etat\.budget, volets\)/);
  assert.match(ouverture, /etat: ouverture\.etat/);
  const colonne = MAIN.slice(
    MAIN.indexOf("function colonneDepuis"),
    MAIN.indexOf("function colonnesComparaison"),
  );
  assert.match(colonne, /transposerBudget\(budget, voletsMontes\)/);
  // La colonne emporte ce qu'elle a perdu : sans ce champ, rien à l'écran ne
  // pourrait l'attribuer à sa colonne.
  assert.match(colonne, /\bdisparues,/);
});

test("les lignes disparues d'un scénario chargé sont nommées à l'écran, pas seulement comptées", () => {
  assert.match(MAIN, /import \{[\s\S]*?renduDisparues[\s\S]*?\} from "\.\/scenarios-rendu\.ts";/);
  const corps = MAIN.slice(
    MAIN.indexOf("function montrerScenarios"),
    MAIN.indexOf("function brancherScenarios"),
  );
  assert.match(
    corps,
    /const disparues = renduDisparues\(disparuesCourantes\.lignes, disparuesCourantes\.rienRepris\)/,
  );
  // Et le bloc atteint réellement l'écran : le rendre sans le concaténer dans
  // `#scenarios` laissait passer sa disparition sans qu'aucun test ne bronche,
  // alors que c'est le nom même de ce test.
  const ecriture = corps.slice(corps.indexOf("cible.innerHTML ="));
  // L'espacement est indifférent — la concaténation peut tenir sur une ligne
  // ou sur dix — mais `disparues` doit être un terme de la somme, pas une
  // sous-chaîne d'un autre identifiant : `\b` le garantit.
  assert.match(ecriture, /^cible\.innerHTML =[^;]*\+\s*\bdisparues\b\s*\+/);
});

test("supprimer le scénario courant efface aussi les lignes disparues qu'il portait", () => {
  const corps = MAIN.slice(
    MAIN.indexOf("function supprimerScenarioCourant"),
    MAIN.indexOf("function faceChoisie"),
  );
  assert.match(corps, /disparuesCourantes = \{ lignes: \[\], rienRepris: false \};/);
});

/** Les aides de main.ts dont dépendent les gestes sur un scénario —
 *  `scenarioCourant`, `scenarioNomme`, `exercicePorte` — prises dans le fichier
 *  source et débarrassées de leurs seules annotations TypeScript, pour être
 *  évaluées par `new Function`. Une seule copie de l'extraction : quatre bancs
 *  d'essai la partagent, et une aide ajoutée entre elles ne doit pas être
 *  oubliée par trois d'entre eux. */
function aidesScenario(): string {
  const debut = MAIN.indexOf("function scenarioCourant");
  const fin = MAIN.indexOf("/** Une colonne comparée, transposée");
  assert.ok(debut > -1 && fin > debut, "les aides de scénario sont introuvables dans main.ts");
  const aides = MAIN.slice(debut, fin)
    .replace("function scenarioCourant(): Scenario | undefined {", "function scenarioCourant() {")
    .replace("function scenarioNomme(): Scenario | undefined {", "function scenarioNomme() {")
    .replace("function exercicePorte(): string | null {", "function exercicePorte() {");
  assert.doesNotMatch(
    aides,
    /function \w+\([^)]*\):/,
    "une annotation de type reste dans les aides évaluées",
  );
  return aides;
}

/** Exécute `supprimerScenarioCourant` telle qu'écrite dans main.ts, avec le
 *  vrai `scenarioNomme` plutôt qu'un doublon, et rend ce qui s'est réellement
 *  passé : le nom supprimé s'il y en a eu un, et l'état des lignes disparues.
 *  Même technique que `executerColonnesComparaison`. */
function executerSupprimerScenarioCourant(
  etatSimule: Record<string, string>,
  scenariosLocaux: { nom: string; budget: string; exercice: string }[],
  reponse = true,
): { supprime: string | null; disparuesVidees: boolean; question: string | null } {
  const aides = aidesScenario();
  const corps = MAIN.slice(
    MAIN.indexOf("function supprimerScenarioCourant"),
    MAIN.indexOf("function faceChoisie"),
  ).replace("function supprimerScenarioCourant(): void {", "function supprimerScenarioCourant() {");
  let supprime: string | null = null;
  let disparuesVidees = false;
  let question: string | null = null;
  const etat = { ...etatSimule };
  const window = {
    confirm: (texte: string) => {
      question = texte;
      return reponse;
    },
  };
  new Function(
    "etat",
    "listerScenarios",
    "depotScenarios",
    "supprimerScenario",
    "ecrireUrl",
    "montrerScenarios",
    "window",
    "poser",
    `${aides}${corps}
     let disparuesCourantes = null;
     supprimerScenarioCourant();
     poser(disparuesCourantes);`,
  )(
    etat,
    () => scenariosLocaux,
    {},
    (_depot: unknown, nom: string) => {
      supprime = nom;
    },
    () => {},
    () => {},
    window,
    (d: { lignes: string[] } | null) => {
      disparuesVidees = d !== null && d.lignes.length === 0;
    },
  );
  return { supprime, disparuesVidees, question };
}

test("un lien nommant un scénario absent du dépôt ne supprime rien, et n'efface rien", () => {
  // Le bouton « Supprimer « X » » ne devrait même pas s'offrir pour un X que
  // ce lecteur n'a pas — mais s'il est atteint, il ne doit ni supprimer un
  // homonyme, ni faire disparaître de l'écran la liste des lignes que ce lien
  // vient précisément de perdre.
  const { supprime, disparuesVidees } = executerSupprimerScenarioCourant(
    { nom: "Chez l'envoyeur", budget: "b64" },
    [],
  );
  assert.equal(supprime, null);
  assert.equal(disparuesVidees, false);
});

test("un scénario réellement présent est bien supprimé", () => {
  const { supprime, disparuesVidees, question } = executerSupprimerScenarioCourant(
    { nom: "Chez moi", budget: "b64" },
    [{ nom: "Chez moi", budget: "b64", exercice: "2022" }],
  );
  assert.equal(supprime, "Chez moi");
  assert.equal(disparuesVidees, true);
  // La question nomme le scénario : sinon elle ne dit pas ce qui va se passer.
  assert.match(question!, /Chez moi/);
});

test("la suppression est refusable, et refuser ne supprime rien", () => {
  // Le bouton partage sa rangée et sa pilule avec « Enregistrer ce budget » :
  // un clic à côté effaçait définitivement un scénario, sans retour possible.
  const { supprime, disparuesVidees, question } = executerSupprimerScenarioCourant(
    { nom: "Chez moi", budget: "b64" },
    [{ nom: "Chez moi", budget: "b64", exercice: "2022" }],
    false,
  );
  assert.notEqual(question, null);
  assert.equal(supprime, null);
  assert.equal(disparuesVidees, false);
});

/* ------------------------------------------------------------------------
 * `renommer` et `dupliquer` (scenarios.ts) étaient livrés sans appelant : la
 * spec §11 les liste tous deux comme des gestes du lecteur, et « Dupliquer »
 * y porte une raison explicite — c'est le geste « créer mon alternative ».
 * `dupliquer` porte au passage l'invariant d'unicité le plus travaillé du
 * module, pour un chemin qu'aucun lecteur ne pouvait emprunter.
 * ---------------------------------------------------------------------- */

/** Un dépôt en mémoire, garni des noms donnés. Les vraies fonctions de
 *  `scenarios.ts` s'exécutent dessus : ce qui est éprouvé est le branchement
 *  réel, jamais une copie de ses règles. */
function depotGarni(noms: string[]): Depot {
  let contenu: string | null = null;
  const depot: Depot = {
    lire: () => contenu,
    ecrire: (c) => {
      contenu = c;
    },
  };
  for (const nom of noms) {
    enregistrer(depot, { nom, budget: "b64", contrat: "", exercice: "2025" });
  }
  return depot;
}

/** Exécute `renommerScenarioCourant` telle qu'écrite dans main.ts, avec le
 *  vrai `scenarioNomme`, le vrai `renommer` et le vrai `nomNettoye`, sur un
 *  dépôt en mémoire. Rend les noms du dépôt après le geste, et le nom que
 *  l'adresse porte alors. Même technique que
 *  `executerSupprimerScenarioCourant`. */
function executerRenommerScenarioCourant(
  nomAdresse: string,
  noms: string[],
  saisi: string | null,
): { depot: string[]; adresse: string } {
  const aides = aidesScenario();
  const corps = MAIN.slice(
    MAIN.indexOf("function renommerScenarioCourant"),
    MAIN.indexOf("function dupliquerScenarioCourant"),
  ).replace("function renommerScenarioCourant(): void {", "function renommerScenarioCourant() {");
  assert.doesNotMatch(`${aides}${corps}`, /: Scenario|: void/, "une annotation de type reste");
  const depot = depotGarni(noms);
  const etat = { nom: nomAdresse, budget: "b64" };
  new Function(
    "etat",
    "listerScenarios",
    "depotScenarios",
    "renommerScenario",
    "nomNettoye",
    "ecrireUrl",
    "montrerScenarios",
    "window",
    `${aides}${corps}renommerScenarioCourant();`,
  )(
    etat,
    () => lister(depot),
    depot,
    renommer,
    nomNettoye,
    () => {},
    () => {},
    { prompt: () => saisi },
  );
  return { depot: lister(depot).map((s) => s.nom), adresse: etat.nom };
}

/** Même banc, pour `dupliquerScenarioCourant`. */
function executerDupliquerScenarioCourant(
  nomAdresse: string,
  noms: string[],
): { depot: string[]; adresse: string } {
  const aides = aidesScenario();
  const corps = MAIN.slice(
    MAIN.indexOf("function dupliquerScenarioCourant"),
    MAIN.indexOf("function supprimerScenarioCourant"),
  ).replace("function dupliquerScenarioCourant(): void {", "function dupliquerScenarioCourant() {");
  const depot = depotGarni(noms);
  const etat = { nom: nomAdresse, budget: "b64" };
  new Function(
    "etat",
    "listerScenarios",
    "depotScenarios",
    "dupliquerScenario",
    "montrerScenarios",
    `${aides}${corps}dupliquerScenarioCourant();`,
  )(etat, () => lister(depot), depot, dupliquer, () => {});
  return { depot: lister(depot).map((s) => s.nom), adresse: etat.nom };
}

test("la barre offre les trois gestes qui portent sur un scénario du dépôt, chacun nommant sa cible", () => {
  const corps = MAIN.slice(
    MAIN.indexOf("function montrerScenarios"),
    MAIN.indexOf("function brancherScenarios"),
  );
  for (const [id, verbe] of [
    ["scenario-renommer", "Renommer"],
    ["scenario-dupliquer", "Dupliquer"],
    ["scenario-supprimer", "Supprimer"],
  ]) {
    assert.match(corps, new RegExp(`id="${id}">${verbe} « \\$\\{echapper\\(`));
  }
  // Les trois pendent au même fait — l'adresse nomme un scénario qui existe —
  // et portent la classe des boutons de la barre, jamais un habillage à part.
  assert.match(corps, /const nomme = scenarioNomme\(\);/);
  for (const id of ["renommer", "dupliquer", "supprimer"]) {
    assert.match(corps, new RegExp(`class="scenarios-rendu__scenario" id="scenario-${id}"`));
  }
  // Et les écouteurs sont posés une seule fois, sur `#scenarios`, comme les
  // deux autres : `brancherScenarios` n'est appelée qu'au montage.
  const branchement = MAIN.slice(
    MAIN.indexOf("function brancherScenarios"),
    MAIN.indexOf("async function ouvrirSimulateur"),
  );
  assert.match(branchement, /closest\("#scenario-renommer"\)\) return renommerScenarioCourant\(\)/);
  assert.match(branchement, /closest\("#scenario-dupliquer"\)\) return dupliquerScenarioCourant\(\)/);
});

test("renommer un scénario le renomme dans le dépôt, et l'adresse suit", () => {
  const { depot, adresse } = executerRenommerScenarioCourant(
    "Mon budget",
    ["Mon budget", "Un autre"],
    "Mon budget 2027",
  );
  assert.deepEqual(depot, ["Mon budget 2027", "Un autre"]);
  // Sans ça, l'adresse nommerait un scénario qui n'existe plus : la barre
  // perdrait sa marque « courant » sans un mot, et un lien partagé rouvrirait
  // un nom fantôme — exactement ce que `supprimerScenarioCourant` évite déjà.
  assert.equal(adresse, "Mon budget 2027");
});

test("le nom retenu par l'adresse est celui réellement stocké, espaces et longueur compris", () => {
  // `renommer` nettoie le nom avant de l'écrire. L'adresse doit porter CE
  // nom-là, pas celui qu'on a tapé : `main.ts` refaisait ce `trim().slice()`
  // de son côté, et deux copies d'une règle qui doit rester identique finissent
  // par diverger — l'adresse nommerait alors un scénario absent du dépôt. Le
  // nom saisi ici dépasse `NOM_MAX` et porte des espaces, les deux façons dont
  // les copies peuvent s'écarter.
  const long = `  ${"n".repeat(80)}  `;
  const { depot, adresse } = executerRenommerScenarioCourant("A", ["A"], long);
  assert.equal(adresse, depot[0]);
  assert.equal(adresse, nomNettoye(long));
});

test("un renommage refusé ne touche ni le dépôt ni l'adresse", () => {
  // `renommer` refuse un nom déjà pris par un AUTRE scénario — le renommer
  // détruirait celui-là. Le nom d'origine survit dans la liste rendue, et
  // c'est ce fait, pas le nom saisi, qui commande l'adresse.
  const pris = executerRenommerScenarioCourant("A", ["A", "B"], "B");
  assert.deepEqual(pris.depot, ["A", "B"]);
  assert.equal(pris.adresse, "A");
  const vide = executerRenommerScenarioCourant("A", ["A", "B"], "   ");
  assert.deepEqual(vide.depot, ["A", "B"]);
  assert.equal(vide.adresse, "A");
});

test("annuler la boîte de renommage ne renomme rien", () => {
  const { depot, adresse } = executerRenommerScenarioCourant("A", ["A"], null);
  assert.deepEqual(depot, ["A"]);
  assert.equal(adresse, "A");
});

test("un lien nommant un scénario absent du dépôt n'offre ni ne fait aucun renommage", () => {
  const { depot, adresse } = executerRenommerScenarioCourant("Chez l'envoyeur", ["A"], "Volé");
  assert.deepEqual(depot, ["A"]);
  assert.equal(adresse, "Chez l'envoyeur");
});

test("dupliquer ajoute une copie sans toucher à l'original ni au scénario courant", () => {
  const { depot, adresse } = executerDupliquerScenarioCourant("Mon budget", ["Mon budget"]);
  assert.deepEqual(depot, ["Mon budget", "Copie de Mon budget"]);
  // L'écran montre toujours le budget d'origine : déplacer le nom de l'adresse
  // sur la copie ferait marquer « courant » un scénario que le lecteur n'a pas
  // ouvert.
  assert.equal(adresse, "Mon budget");
});

test("dupliquer deux fois ne collisionne pas, et un scénario absent ne duplique rien", () => {
  const depot = depotGarni(["A"]);
  dupliquer(depot, "A");
  const { depot: noms } = executerDupliquerScenarioCourant("A", ["A", "Copie de A"]);
  assert.deepEqual(noms, ["A", "Copie de A", "Copie de A (2)"]);
  assert.deepEqual(executerDupliquerScenarioCourant("Absent", ["A"]).depot, ["A"]);
});

test("un stockage indisponible dégrade en scénarios de session, et l'interface le dit", () => {
  // Même défaut que celui déjà corrigé pour le thème (`brancherTheme`) : la
  // navigation privée stricte fait lever `localStorage`. `scenarios.ts` avale
  // déjà l'échec d'ÉCRITURE (sa docstring, `ecrireScenarios`), mais il ne dit
  // rien au lecteur — c'est à ce module de sonder le stockage et de le dire.
  assert.match(MAIN, /function stockagePersistant\(\): boolean \{/);
  const corps = MAIN.slice(
    MAIN.indexOf("function stockagePersistant"),
    MAIN.indexOf("function stockagePersistant") + 400,
  );
  assert.match(corps, /catch \{\s*return false;/);
  // Le dépôt de session — en mémoire, jamais `localStorage` — est celui sur
  // lequel on retombe.
  assert.match(MAIN, /const depotSession: Depot = \{/);
  assert.match(MAIN, /const depotScenarios: Depot = persistant \? depotLocal : depotSession;/);
  // Et l'interface le dit, plutôt que de laisser croire à une sauvegarde qui
  // n'aura pas lieu.
  assert.match(MAIN, /Stockage indisponible/);
});

test("comparer deux scénarios est un mode du simulateur, jamais une vue distincte", () => {
  // `/simulateur/comparer` résout déjà sur `simulateur` — une vue réelle se
  // reconnaît à son premier segment, à n'importe quelle profondeur. Ouvrir une
  // entrée de menu pour un écran qui n'a
  // de sens qu'à deux scénarios en main afficherait un lien mort à qui n'en a
  // aucun. Le mode se déclenche par la présence de `face` dans l'adresse.
  // Le motif visait tout le fichier ; il vise maintenant les seules tables qui
  // fabriquent des adresses. `comparer` peut être NOMMÉ en commentaire — il
  // l'est, pour expliquer pourquoi une vue se reconnaît à son premier segment —
  // mais il ne doit être ni un chemin ni un alias.
  const tables = ROUTES.slice(ROUTES.indexOf("export const CHEMINS"), ROUTES.indexOf("/** Le chemin d'une vue"));
  assert.doesNotMatch(tables, /comparer/);
  assert.match(MAIN, /const tableau = faceChoisie\(\)/);
});

/* ------------------------------------------------------------------------
 * Une face CHOISIE ouvre la comparaison — un budget non vide ne la commande
 * pas. Le budget voté est l'atelier tous réglages à zéro (`budget: ""`), et
 * un scénario enregistré sans réglage l'est aussi : les tenir pour « pas de
 * comparaison » n'affichait ni tableau ni bouton de fermeture, et refermait
 * au passage la comparaison en cours.
 * ---------------------------------------------------------------------- */

/** Exécute `faceChoisie` telle qu'écrite dans main.ts, avec un `etat` simulé
 *  — même technique que `executerColonnesComparaison` plus bas. */
function executerFaceChoisie(etatSimule: Record<string, string>): boolean {
  const debut = MAIN.indexOf("function faceChoisie()");
  assert.ok(debut > -1, "faceChoisie introuvable dans main.ts");
  const corpsBrut = MAIN.slice(debut, MAIN.indexOf("\n}", debut) + 2);
  assert.match(corpsBrut, /function faceChoisie\(\): boolean \{/);
  const corps = corpsBrut.replace("function faceChoisie(): boolean {", "function faceChoisie() {");
  return new Function("etat", `${corps}\nreturn faceChoisie();`)(etatSimule) as boolean;
}

test("une face au budget vide — le budget voté — est bien une face choisie", () => {
  assert.equal(executerFaceChoisie({ face: "", faceNom: "Budget voté" }), true);
});

test("un scénario du lecteur enregistré sans aucun réglage est une face choisie lui aussi", () => {
  // Même trou que le budget voté : `enregistrerScenarioCourant` enregistre
  // `budget: etat.budget`, qui vaut "" quand rien n'est réglé.
  assert.equal(executerFaceChoisie({ face: "", faceNom: "Mon budget à zéro" }), true);
});

test("un lien antérieur à face-nom, qui ne porte que face, est une face choisie", () => {
  assert.equal(executerFaceChoisie({ face: "etat/146:-10", faceNom: "" }), true);
});

test("aucune face nommée ni portée : pas de comparaison", () => {
  assert.equal(executerFaceChoisie({ face: "", faceNom: "" }), false);
});

test("le tableau et le bouton de fermeture pendent au même fait, jamais à un budget non vide", () => {
  const corps = MAIN.slice(
    MAIN.indexOf("function montrerScenarios"),
    MAIN.indexOf("function brancherScenarios"),
  );
  assert.match(corps, /faceChoisie\(\)\s*\n?\s*\? `<button type="button"[^`]*scenario-fermer-comparaison/);
  assert.doesNotMatch(corps, /etat\.face\s*$/m);
  // Fermer la comparaison remet l'état à « aucune face choisie » : les trois
  // paramètres partent ensemble, sinon `faceChoisie()` resterait vraie.
  const fermeture = MAIN.slice(MAIN.indexOf('closest("#scenario-fermer-comparaison")'));
  const bloc = fermeture.slice(0, fermeture.indexOf("montrerScenarios()"));
  assert.match(bloc, /etat\.face = "";/);
  assert.match(bloc, /etat\.faceNom = "";/);
  assert.match(bloc, /etat\.faceExercice = "";/);
});

test("l'adresse relit une face choisie au rechargement, même quand son budget est vide", () => {
  // `face-nom` est écrit dès qu'il est non vide, et `lireUrl` le relit : c'est
  // lui qui rouvre la comparaison quand `face` est vide. Sans cette paire, le
  // menu rouvrait sur « Budget voté » sélectionné devant un écran vide.
  const ecriture = MAIN.slice(MAIN.indexOf("function ecrireUrl()"), MAIN.indexOf("history.replaceState"));
  assert.match(ecriture, /if \(etat\.faceNom\) p\.set\("face-nom", etat\.faceNom\);/);
  const lecture = MAIN.slice(MAIN.indexOf("function lireUrl()"), MAIN.indexOf("function ecrireUrl()"));
  assert.match(lecture, /faceNom: p\.get\("face-nom"\) \?\? ""/);
});

/* ------------------------------------------------------------------------
 * L'exercice d'une colonne comparée ne se devine pas — trouvaille critique
 * de la revue : `colonnesComparaison` retombait sur `exerciceCourant()` (le
 * millésime PUBLIÉ AUJOURD'HUI sur le site) pour un scénario `face` ou `nom`
 * que le lecteur n'a pas en local, un an sans aucun rapport avec ce que
 * l'envoyeur du lien a réellement réglé. Les six tests ci-dessus sur la barre
 * de scénarios sont tous textuels/structurels ; ceux-ci exécutent réellement
 * le corps de `colonnesComparaison` (extrait du fichier source, débarrassé
 * de sa seule annotation TypeScript — l'annotation de retour — et évalué via
 * `new Function` avec des dépendances simulées), sur le modèle du test
 * "le Back vers `/`..." plus haut.
 * ---------------------------------------------------------------------- */

/** Exécute `colonnesComparaison` telle qu'écrite dans main.ts, avec `etat`,
 *  `listerScenarios`, `exerciceCourant` et `referencesScenarios` simulés, et
 *  capture les arguments reçus par `colonneDepuis` — en particulier
 *  l'exercice, le serment et le lien retenus pour chaque colonne.
 *
 *  `scenarioCourant` est pris dans main.ts lui aussi, jamais simulé : c'est
 *  lui qui porte la règle « l'état affiché EST ce scénario » (même nom ET même
 *  budget), et un banc d'essai qui la remplacerait par un stub testerait sa
 *  propre copie de la règle plutôt que celle qui s'exécute. */
function executerColonnesComparaison(
  etatSimule: Record<string, string>,
  scenariosLocaux: { nom: string; budget: string; exercice: string; contrat?: string }[],
  references: { titre: string; slug: string | null; contrat: string; lien: string | null }[] = [],
): { nom: string; exercice: string | null; contrat: string; lien: string | null }[] {
  const aides = aidesScenario();

  const debut = MAIN.indexOf("function colonnesComparaison");
  const fin = MAIN.indexOf("function chargerScenario(nom: string): void {");
  assert.ok(debut > -1 && fin > debut, "colonnesComparaison introuvable dans main.ts");
  const corpsBrut = MAIN.slice(debut, fin);
  // Verrouille la forme de la signature avant de lui ôter son annotation :
  // si elle change, ce test doit rougir plutôt que d'évaluer autre chose que
  // le vrai corps de la fonction.
  assert.match(corpsBrut, /function colonnesComparaison\(\): Comparable\[\] \{/);
  const corps =
    aides +
    corpsBrut.replace(
      "function colonnesComparaison(): Comparable[] {",
      "function colonnesComparaison() {",
    );
  // Ce que la fonction REND, jamais l'ordre dans lequel elle a appelé
  // `colonneDepuis` : les deux ont divergé le jour où la colonne `face` a été
  // construite avant la courante, et des tests qui lisaient l'ordre d'appel
  // se sont mis à vérifier la colonne d'en face en croyant lire la leur.
  const colonneDepuis = (
    nom: string,
    _budget: string,
    exercice: string | null,
    contrat: string,
    lien: string | null,
  ) => ({ nom, exercice, contrat, lien });
  const listerScenarios = () => scenariosLocaux;
  // `faceSource` absent du gabarit = le cas d'un lien antérieur à ce
  // paramètre, celui qui doit continuer de deviner. Les tests qui portent sur
  // une origine choisie la nomment explicitement.
  const etatComplet = { faceSource: "", ...etatSimule };
  // L'exercice publié aujourd'hui sur le site, sans aucun rapport avec les
  // scénarios testés : un test qui verrait cette valeur là où il attend
  // `null` prouve que le fallback fautif est revenu.
  const exerciceCourant = () => "2025-SITE";
  return new Function(
    "etat",
    "listerScenarios",
    "depotScenarios",
    "colonneDepuis",
    "exerciceCourant",
    "referencesScenarios",
    `${corps}\nreturn colonnesComparaison();`,
  )(etatComplet, listerScenarios, {}, colonneDepuis, exerciceCourant, references);
}

test("une colonne `face` absente du dépôt local, sans exercice dans l'adresse, dit l'exercice inconnu", () => {
  const [, face] = executerColonnesComparaison(
    { nom: "", budget: "", faceNom: "Scénario partagé", face: "b64", faceExercice: "" },
    [],
  );
  assert.equal(face!.exercice, null);
  assert.notEqual(face!.exercice, "2025-SITE");
});

test("une colonne `face` absente du dépôt local, avec exercice dans l'adresse, montre CET exercice", () => {
  const [, face] = executerColonnesComparaison(
    { nom: "", budget: "", faceNom: "Scénario partagé", face: "b64", faceExercice: "2019" },
    [],
  );
  assert.equal(face!.exercice, "2019");
  assert.notEqual(face!.exercice, "2025-SITE");
});

test("symétrique : une colonne « courante » nommée mais absente du dépôt local dit aussi l'exercice inconnu", () => {
  const [courante] = executerColonnesComparaison(
    { nom: "Scénario partagé", budget: "b64", faceNom: "", face: "", faceExercice: "" },
    [],
  );
  assert.equal(courante!.exercice, null);
  assert.notEqual(courante!.exercice, "2025-SITE");
});

test("un scénario réellement présent localement garde toujours SON exercice, pas le courant du site", () => {
  const [courante, face] = executerColonnesComparaison(
    { nom: "Chez moi", budget: "b64", faceNom: "Chez mon collègue", face: "c64", faceExercice: "" },
    [
      { nom: "Chez moi", budget: "b64", exercice: "2022" },
      { nom: "Chez mon collègue", budget: "c64", exercice: "2024" },
    ],
  );
  assert.equal(courante!.exercice, "2022");
  assert.equal(face!.exercice, "2024");
});

test("un curseur bougé : la colonne courante cesse d'annoncer le nom et l'exercice du scénario ouvert", () => {
  // Le lecteur a ouvert « Chez moi » (budget `b64`, exercice 2022) puis a
  // bougé un curseur : l'adresse porte toujours `nom=Chez moi`, mais le
  // budget affiché n'est plus celui du scénario. La colonne ne peut donc plus
  // se dire ce scénario-là — ni par son nom, ni par son millésime.
  const [courante] = executerColonnesComparaison(
    { nom: "Chez moi", budget: "b64-retouche", faceNom: "", face: "", faceExercice: "" },
    [{ nom: "Chez moi", budget: "b64", exercice: "2022" }],
  );
  assert.equal(courante!.exercice, null);
  assert.notEqual(courante!.exercice, "2022");
  assert.notEqual(courante!.exercice, "2025-SITE");
});

test("deux colonnes ne portent jamais le même nom au-dessus de deux budgets différents", () => {
  // « Chez moi » ouvert, un curseur bougé, puis « Chez moi » choisi comme
  // face : sans arbitrage les deux en-têtes seraient identiques au-dessus de
  // deux budgets différents, et rien à l'écran ne dirait lequel est
  // l'enregistré. C'est la colonne vive qui cède le nom.
  const [courante, face] = executerColonnesComparaison(
    {
      nom: "Chez moi",
      budget: "b64-retouche",
      faceNom: "Chez moi",
      face: "b64",
      faceExercice: "",
    },
    [{ nom: "Chez moi", budget: "b64", exercice: "2022" }],
  );
  assert.notEqual(courante!.nom, face!.nom);
  assert.equal(face!.nom, "Chez moi");
});


/* ------------------------------------------------------------------------
 * Les scénarios de référence — tâche 6 du lot « Le simulateur enregistre » :
 * le budget voté et les chiffrages des analyses, produits au build par
 * `prerendre.ts` et offerts comme comparables par `main.ts`. Ferme la boucle
 * entre l'éditorial (les analyses) et l'outil (le simulateur).
 * ---------------------------------------------------------------------- */

const PRERENDRE = readFileSync(new URL("../scripts/prerendre.ts", import.meta.url), "utf8");

/** Exécute `entreesReference` telle qu'écrite dans prerendre.ts, sur de
 *  fausses analyses minimales — même technique que
 *  `executerColonnesComparaison` plus haut : on teste le vrai corps du
 *  fichier source, pas une réécriture. */
function executerEntreesReference(
  analyses: { titre: string; slug: string; simulateur: { budget: string; contrat: string } }[],
): { titre: string; slug: string | null; lien: string | null; budget: string; contrat: string; exercice: string | null }[] {
  const debut = PRERENDRE.indexOf("const ENTREE_NEUTRE");
  const fin = PRERENDRE.indexOf("async function ecrireScenariosReference");
  assert.ok(debut > -1 && fin > debut, "entreesReference introuvable dans prerendre.ts");
  const corpsBrut = PRERENDRE.slice(debut, fin);
  // Verrouille les deux déclarations avant de leur ôter leurs annotations
  // TypeScript, que `new Function` — qui évalue du JS pur — ne sait pas
  // parser : le type de la constante, et la signature de la fonction.
  assert.match(corpsBrut, /const ENTREE_NEUTRE: EntreeReference = \{/);
  assert.match(corpsBrut, /function entreesReference\(analyses: readonly Analyse\[\]\): EntreeReference\[\] \{/);
  const corps = corpsBrut
    .replace("const ENTREE_NEUTRE: EntreeReference = {", "const ENTREE_NEUTRE = {")
    .replace(
      "function entreesReference(analyses: readonly Analyse[]): EntreeReference[] {",
      "function entreesReference(analyses) {",
    );
  return new Function(`${corps}\nreturn entreesReference;`)()(analyses);
}

test("le fichier de référence porte une entrée neutre au budget vide, sans slug ni lien", () => {
  const entrees = executerEntreesReference([]);
  assert.equal(entrees.length, 1);
  assert.equal(entrees[0]!.budget, "");
  assert.equal(entrees[0]!.slug, null);
  assert.equal(entrees[0]!.lien, null);
});

test("une analyse sans réglage de simulateur n'engendre aucune entrée — rien n'est inventé", () => {
  const entrees = executerEntreesReference([
    { titre: "Sans réglage", slug: "sans-reglage", simulateur: { budget: "", contrat: "" } },
  ]);
  assert.equal(entrees.length, 1); // seulement l'entrée neutre
  assert.equal(entrees.some((e) => e.slug === "sans-reglage"), false);
});

test("une analyse réglée engendre une entrée avec son titre, son slug et son lien", () => {
  const entrees = executerEntreesReference([
    { titre: "Le budget de la Défense", slug: "defense-2025", simulateur: { budget: "etat/146:-10", contrat: "c1" } },
  ]);
  const reglee = entrees.find((e) => e.slug === "defense-2025");
  assert.ok(reglee);
  assert.equal(reglee!.titre, "Le budget de la Défense");
  assert.equal(reglee!.lien, "/analyses/defense-2025/");
  assert.equal(reglee!.budget, "etat/146:-10");
  assert.equal(reglee!.contrat, "c1");
});

test("aucune entrée ne porte un exercice : rien ne le déclare de façon fiable dans une analyse", () => {
  const entrees = executerEntreesReference([
    { titre: "X", slug: "x", simulateur: { budget: "etat/146:-10", contrat: "" } },
  ]);
  for (const e of entrees) assert.equal(e.exercice, null);
});

test("prerendre.ts écrit le fichier dans dist/simulateur/scenarios-reference.json, après le contrôle des liens", () => {
  assert.match(PRERENDRE, /path\.join\(DIST, "simulateur"\)/);
  assert.match(PRERENDRE, /"scenarios-reference\.json"/);
  const corps = PRERENDRE.slice(PRERENDRE.indexOf("async function main"));
  const posValidation = corps.indexOf("await validerLiensSimulateur(");
  const posEcriture = corps.indexOf("await ecrireScenariosReference(");
  assert.ok(posValidation > -1 && posEcriture > posValidation, "ecrireScenariosReference doit suivre validerLiensSimulateur");
});

test("le simulateur charge le fichier de référence à l'ouverture, sans casser s'il est absent", () => {
  assert.match(MAIN, /fetch\("\/simulateur\/scenarios-reference\.json"\)/);
  const debut = MAIN.indexOf("async function chargerReferences");
  assert.ok(debut > -1, "chargerReferences introuvable dans main.ts");
  const corps = MAIN.slice(debut, debut + 600);
  assert.match(corps, /catch \{/);
  assert.match(MAIN, /await chargerReferences\(\);/);
});

test("les entrées de référence apparaissent parmi les comparables, distinguées des scénarios du lecteur", () => {
  const corps = MAIN.slice(
    MAIN.indexOf("function montrerScenarios"),
    MAIN.indexOf("function brancherScenarios"),
  );
  assert.match(corps, /referencesScenarios/);
  // Deux groupes distincts dans le menu, jamais mélangés en une seule liste.
  assert.match(corps, /<optgroup label="Vos scénarios">/);
  assert.match(corps, /<optgroup label="Références">/);
});

test("le sélecteur « Comparer à » n'emprunte pas la classe des états vides", () => {
  // `scenarios-rendu__vide` dit « il n'y a rien ici », cadre pointillé compris.
  // Le choix d'une face ne s'affiche justement que quand il y a quelque chose
  // à comparer, et il porte une commande : il lui faut sa classe, et une règle
  // CSS à lui.
  const corps = MAIN.slice(
    MAIN.indexOf("function montrerScenarios"),
    MAIN.indexOf("function brancherScenarios"),
  );
  const bloc = corps.slice(corps.indexOf("const choix ="), corps.indexOf('id="scenario-face"'));
  assert.doesNotMatch(bloc, /scenarios-rendu__vide/);
  assert.match(bloc, /class="scenarios-rendu__choix"/);
  assert.match(CSS, /\.scenarios-rendu__choix \{/);
  const regle = CSS.slice(
    CSS.indexOf(".scenarios-rendu__choix {"),
    CSS.indexOf("}", CSS.indexOf(".scenarios-rendu__choix {")),
  );
  assert.doesNotMatch(regle, /dashed/);
});

test("l'exercice inconnu a une seule sentinelle, et l'adresse s'y convertit en un seul endroit", () => {
  // `Scenario.exercice`, `Comparable.exercice` et `exerciceCourant()` disent
  // tous « inconnu » avec `null`. L'adresse, elle, ne sait le dire qu'avec la
  // chaîne vide : la conversion se fait dans `exercicePorte`, et nulle part
  // ailleurs — `colonnesComparaison` mêlait `??` et `||` dans une seule
  // expression, ce qui est tenir deux sentinelles à la fois.
  assert.match(MAIN, /function exercicePorte\(\): string \| null \{\n  return etat\.faceExercice \|\| null;\n\}/);
  assert.match(MAIN, /function exerciceCourant\(\): string \| null \{/);
  const colonnes = MAIN.slice(
    MAIN.indexOf("function colonnesComparaison"),
    MAIN.indexOf("function chargerScenario(nom: string): void {"),
  );
  assert.match(colonnes, /faceEnregistree\?\.exercice \?\? exercicePorte\(\),/);
  assert.doesNotMatch(colonnes, /\|\| null/);
  // Une colonne dont l'exercice est inconnu le dit en toutes lettres, jamais
  // par un millésime pendouillant : c'est la sentinelle qui le permet.
  const [, face] = executerColonnesComparaison({ nom: "", face: "b", faceNom: "Reçu", faceExercice: "" }, []);
  assert.equal(face!.exercice, null);
});

test("un fichier de référence qui n'est pas la liste attendue ne devient pas la liste", () => {
  // Un JSON valide mais non-tableau — page d'erreur JSON servie à la place du
  // fichier, build partiel — passait l'affirmation de type sans broncher, puis
  // faisait lever `.map` à chaque rendu de la barre, donc à chaque geste sur
  // l'atelier.
  const debut = MAIN.indexOf("function estReferences");
  assert.ok(debut > -1, "estReferences introuvable dans main.ts");
  // La garde s'exécute telle qu'écrite, débarrassée de ses seules annotations
  // TypeScript : un doublon écrit ici testerait sa propre copie de la règle.
  const garde = MAIN.slice(debut, MAIN.indexOf("async function chargerReferences"))
    .replace(
      "function estReferences(valeur: unknown): valeur is EntreeReference[] {",
      "function estReferences(valeur) {",
    )
    .replaceAll("(e as EntreeReference)", "e");
  assert.doesNotMatch(garde, /: unknown|as EntreeReference/, "une annotation de type reste");
  const estReferences = new Function(`${garde}return estReferences;`)() as (v: unknown) => boolean;
  assert.equal(estReferences([]), true);
  assert.equal(
    estReferences([{ titre: "Budget voté", slug: null, lien: null, budget: "", contrat: "", exercice: "2025" }]),
    true,
  );
  assert.equal(estReferences({ erreur: "not found" }), false);
  assert.equal(estReferences(null), false);
  assert.equal(estReferences("[]"), false);
  assert.equal(estReferences([{ titre: 3 }]), false);
  assert.equal(estReferences([null]), false);
  // Et le chargeur ne retient que ce que la garde accepte.
  const chargeur = MAIN.slice(
    MAIN.indexOf("async function chargerReferences"),
    MAIN.indexOf("let disparuesCourantes"),
  );
  assert.match(chargeur, /if \(estReferences\(lu\)\) referencesScenarios = lu;/);
  assert.doesNotMatch(chargeur, /as EntreeReference\[\]/);
});

test("enregistrer sous un autre nom oublie les lignes perdues par le scénario précédent", () => {
  // Après avoir chargé un scénario amputé puis enregistré l'état sous un autre
  // nom, la notice continuait à décrire le scénario précédent — et « Aucun
  // réglage n'a pu être repris » restait affiché alors que le lecteur avait
  // posé ses propres curseurs. `supprimerScenarioCourant` l'oublie déjà.
  const corps = MAIN.slice(
    MAIN.indexOf("function enregistrerScenarioCourant"),
    MAIN.indexOf("function renommerScenarioCourant"),
  );
  assert.match(corps, /disparuesCourantes = \{ lignes: \[\], rienRepris: false \};/);
  // Dans la branche du nom accepté : un enregistrement refusé (nom vide) ne
  // change rien à l'écran, donc n'a rien à oublier.
  const accepte = corps.slice(corps.indexOf("if (nomPropre) {"));
  assert.match(accepte, /disparuesCourantes = \{ lignes: \[\], rienRepris: false \};/);
});

test("le budget voté (slug null) prend l'exercice réellement monté ; une analyse garde le sien, jamais deviné", () => {
  // Le budget voté n'est pas un scénario dont on ignorerait l'origine — c'est
  // l'atelier tel que monté à l'instant : son exercice se lit vrai avec
  // `exerciceCourant()`. Une entrée issue d'une analyse, elle, ne porte aucun
  // exercice vérifiable (voir prerendre.ts) : jamais ce même repli.
  // Borné sur ce qui suit, jamais sur un nombre de caractères : une ligne
  // ajoutée au gestionnaire poussait la règle hors d'une fenêtre fixe et
  // faisait rougir ce test sans que la règle ait bougé.
  const corps = MAIN.slice(
    MAIN.indexOf('cible.addEventListener("change"'),
    MAIN.indexOf("async function ouvrirSimulateur"),
  );
  assert.match(corps, /reference\.slug === null\s*\n?\s*\? exerciceCourant\(\) \?\? ""\s*\n?\s*: reference\.exercice/);
});

/* ------------------------------------------------------------------------
 * Aucun champ écrit qui ne soit lu. `prerendre.ts` écrivait `contrat` et
 * `lien` dans `scenarios-reference.json`, `main.ts` n'en lisait aucun : une
 * entrée de référence se comparait sans sa contrainte — un budget bâti sous
 * serment se lisant alors comme un exploit — et aucun lien ne ramenait à
 * l'analyse dont le chiffrage venait.
 * ---------------------------------------------------------------------- */

test("chaque champ du fichier de référence est lu par main.ts", () => {
  const forme = PRERENDRE.slice(
    PRERENDRE.indexOf("type EntreeReference = {"),
    PRERENDRE.indexOf("/** Le budget voté"),
  );
  const champs = [...forme.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]!);
  assert.deepEqual(champs, ["titre", "slug", "lien", "budget", "contrat", "exercice"]);
  const bloc = MAIN.slice(
    MAIN.indexOf("type EntreeReference = {"),
    MAIN.indexOf("async function ouvrirSimulateur"),
  );
  for (const champ of champs) {
    assert.match(bloc, new RegExp(`\\.${champ}\\b`), `main.ts ne lit jamais \`${champ}\``);
  }
});

test("une entrée de référence apporte sa contrainte et le lien de son analyse", () => {
  const [, face] = executerColonnesComparaison(
    { nom: "", budget: "", faceNom: "Le budget de la Défense", face: "b64", faceExercice: "" },
    [],
    [
      {
        titre: "Le budget de la Défense",
        slug: "defense-2025",
        contrat: "sans-impot",
        lien: "/analyses/defense-2025/",
      },
    ],
  );
  assert.equal(face!.contrat, "sans-impot");
  assert.equal(face!.lien, "/analyses/defense-2025/");
});

/* Deux homonymes, un dans le dépôt du lecteur et un dans le fichier de
 * référence : c'est l'origine choisie dans le menu qui tranche, et elle
 * voyage dans l'adresse. Le nom ne peut pas trancher — c'est le même. Un test
 * qui n'en éprouverait qu'un des deux sens figerait un tirage au sort en le
 * faisant passer pour un invariant. */

const HOMONYMES: {
  etat: Record<string, string>;
  locaux: { nom: string; budget: string; exercice: string; contrat?: string }[];
  references: { titre: string; slug: string | null; contrat: string; lien: string | null }[];
} = {
  etat: { nom: "", budget: "", faceNom: "Budget voté", face: "", faceExercice: "2025" },
  locaux: [{ nom: "Budget voté", budget: "", exercice: "2022", contrat: "sans-prestation" }],
  references: [{ titre: "Budget voté", slug: null, contrat: "sans-impot", lien: "/analyses/x/" }],
};

test("origine « scenario » : la face porte le serment du scénario du lecteur", () => {
  const [, face] = executerColonnesComparaison(
    { ...HOMONYMES.etat, faceSource: "scenario" },
    HOMONYMES.locaux,
    HOMONYMES.references,
  );
  assert.equal(face!.contrat, "sans-prestation");
  assert.equal(face!.exercice, "2022");
  // Un scénario du lecteur n'a pas de page : il ne prend pas le lien de la
  // référence homonyme.
  assert.equal(face!.lien, null);
});

test("origine « reference » : la face porte le serment de la référence, pas celui de l'homonyme local", () => {
  const [, face] = executerColonnesComparaison(
    { ...HOMONYMES.etat, faceSource: "reference:" },
    HOMONYMES.locaux,
    HOMONYMES.references,
  );
  assert.equal(face!.contrat, "sans-impot");
  assert.notEqual(face!.contrat, "sans-prestation");
  assert.equal(face!.lien, "/analyses/x/");
  // L'exercice vient de l'adresse, jamais du scénario local homonyme.
  assert.equal(face!.exercice, "2025");
  assert.notEqual(face!.exercice, "2022");
});

test("une analyse au slug « neutre » ne se confond pas avec le budget voté", () => {
  // La clé de l'entrée neutre est la chaîne vide, qu'aucun slug ne porte : une
  // clé littérale était collisionnable, et l'analyse se serait affichée sous
  // son titre avec le budget voté dessous.
  const [, face] = executerColonnesComparaison(
    { nom: "", budget: "", faceNom: "Une analyse", face: "b64", faceExercice: "", faceSource: "reference:neutre" },
    [],
    [
      { titre: "Budget voté", slug: null, contrat: "", lien: null },
      { titre: "Une analyse", slug: "neutre", contrat: "sans-impot", lien: "/analyses/neutre/" },
    ],
  );
  assert.equal(face!.contrat, "sans-impot");
  assert.equal(face!.lien, "/analyses/neutre/");
});

test("la colonne courante porte le serment que l'atelier applique, et ne prétend venir de nulle part", () => {
  const [courante] = executerColonnesComparaison(
    { nom: "", budget: "b64", contrat: "sans-impot", faceNom: "", face: "", faceExercice: "" },
    [],
  );
  assert.equal(courante!.contrat, "sans-impot");
  assert.equal(courante!.lien, null);
});

test("le bloc des lignes non reprises est habillé comme le reste de la barre", () => {
  // Premier diff à le mettre à l'écran : sans règle, il sortait sans cadre ni
  // distinction, entre les boutons d'action et le menu.
  assert.match(CSS, /\.scenarios-rendu__disparues \{/);
  const regle = CSS.slice(
    CSS.indexOf(".scenarios-rendu__disparues {"),
    CSS.indexOf(".scenarios-rendu__disparues p {"),
  );
  // Jetons de design uniquement : ni couleur ni espacement en dur.
  assert.doesNotMatch(regle, /#[0-9a-f]{3,8}\b/i);
  assert.match(regle, /var\(--trait\)/);
  assert.match(regle, /var\(--espace-5\)/);
});

/* --------------------------------------------------------------------------
 * « Citer » : un écouteur délégué, et rien à gratter sur la page
 * ----------------------------------------------------------------------- */

test("la commande « citer » est un écouteur délégué, posé une seule fois", () => {
  // Même motif que `brancherPartage` et `brancherScenarios` : l'article d'une
  // analyse n'est jamais remplacé, un écouteur par rendu les aurait empilés.
  const corps = MAIN.slice(
    MAIN.indexOf("function brancherCitations"),
    MAIN.indexOf("function brancherScenarios"),
  );
  assert.ok(corps.length > 200, "corps de brancherCitations introuvable");
  assert.match(corps, /article\.addEventListener\("click"/);
  assert.match(corps, /closest<HTMLElement>\("button\[data-citer\]"\)/);
  // Branchée avant tout appel réseau : la charge utile est déjà dans la page,
  // écrite par le pré-rendu. Sur l'ordre, pas sur la ligne qui suit — un
  // branchement ajouté juste après cassait l'assertion sans rien casser du
  // site.
  const debut = MAIN.indexOf("async function demarrer");
  assert.ok(debut > 0, "demarrer introuvable");
  // La présence AVANT l'ordre. `indexOf` rend −1 pour un appel absent, et −1
  // précède tout : la seule comparaison d'ordre certifiait une fonction que
  // personne n'appelle. Vérifié par sabotage — retirer `brancherCitations()`
  // de `demarrer` laissait les 865 tests au vert.
  const appel = MAIN.indexOf("brancherCitations();", debut);
  assert.ok(appel > -1, "`demarrer` doit appeler brancherCitations()");
  assert.ok(
    appel < MAIN.indexOf("await donnees.initialiser()", debut),
    "« citer » doit être branchée avant le premier appel réseau",
  );
});

test("la citation se lit dans la charge utile, jamais sur la page rendue", () => {
  // Le montant affiché a déjà perdu son unité brute et son millésime sa forme :
  // gratter la page recomposerait un chiffre au lieu de le citer.
  assert.match(MAIN, /const brute = bouton\.dataset\.citer;/);
  assert.match(MAIN, /JSON\.parse\(brute\) as Citation/);
  // La même limite qu'au rendu, tenue au clic : une charge incomplète ne
  // produit rien, surtout pas un message d'échec.
  assert.match(MAIN, /return citable\(citation\) \? citation : null;/);
  // Le presse-papiers est injecté, jamais lu dans `offrirCitation` : c'est ce
  // qui rend le chemin éprouvable sous Node.
  assert.match(MAIN, /offrirCitation\(citation, presseDuNavigateur\(\)\)/);
});

test("la commande « citer » est habillée sans couleur ni espacement en dur", () => {
  assert.match(CSS, /^\.citer \{/m);
  const regle = CSS.slice(CSS.indexOf("\n.citer {"), CSS.indexOf("\n.citer:hover"));
  assert.doesNotMatch(regle, /#[0-9a-f]{3,8}\b/i);
  assert.match(regle, /var\(--encre-douce\)/);
  assert.match(regle, /var\(--texte-xs\)/);
  // Le repli reçoit la citation quand le presse-papiers refuse : sans lui,
  // « indisponible » ne laisserait rien à emporter.
  assert.match(CSS, /^\.citer__repli \{/m);
  assert.match(CSS, /^\.citer__retour \{/m);
});

/* ------------------------------------------------------------------------
 * Les filtres de l'index des analyses — spec §9.1.
 * ---------------------------------------------------------------------- */

/** Le corps de `brancherFiltresAnalyses`, prêt à évaluer.
 *
 *  Comme `corpsOuvrirTerritoire`, le banc verrouille la signature avant de lui
 *  ôter son annotation : si elle change, il rougit plutôt que d'évaluer autre
 *  chose que la vraie fonction. Le corps, lui, est écrit sans annotation ni
 *  générique — c'est ce qui permet de l'exécuter tel quel, sans le réécrire. */
function corpsFiltresAnalyses(): string {
  const debut = MAIN.indexOf("function brancherFiltresAnalyses");
  const fin = MAIN.indexOf("/* ---------", debut);
  assert.ok(debut > -1 && fin > debut, "brancherFiltresAnalyses introuvable dans main.ts");
  const brut = MAIN.slice(debut, fin);
  assert.match(brut, /function brancherFiltresAnalyses\(\): void \{/);
  const corps = brut.replace(
    "function brancherFiltresAnalyses(): void {",
    "function brancherFiltresAnalyses() {",
  );
  assert.doesNotMatch(corps, /:\s*(string|void|number|boolean)\b/, "une annotation reste");
  assert.doesNotMatch(corps, /querySelector(All)?</, "un générique reste dans le corps évalué");
  return corps;
}

type CarteSimulee = { dataset: Record<string, string>; hidden: boolean };

/** Le vrai `brancherFiltresAnalyses` posé sur l'index vraiment rendu par
 *  `renduIndex`, puis réglé. Le banc ne recopie ni la règle de correspondance
 *  — c'est le vrai `carteRetenue` qui est injecté — ni les attributs des
 *  cartes : il les relit dans le HTML produit. */
function reglerFiltres(
  analyses: Analyse[],
  reglages: { recherche?: string; type?: string; theme?: string; budget?: string },
): { visibles: string[]; compte: string; barreDepliee: boolean } {
  const html = renduIndex(analyses, [] as never[]);
  const cartes: CarteSimulee[] = [...html.matchAll(/<li class="[^"]*analyse-rendu__index-ligne[^"]*"([^>]*)>/g)].map(
    (balise) => {
      const dataset: Record<string, string> = {};
      for (const [, nom, valeur] of balise[1]!.matchAll(/data-([a-z]+)="([^"]*)"/g)) {
        dataset[nom!] = valeur!.replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      }
      return { dataset, hidden: false };
    },
  );
  const facettes = [...html.matchAll(/data-facette="([a-z]+)"/g)].map((m) => m[1]!);
  const menus = facettes.map((nom) => ({
    dataset: { facette: nom },
    value: (reglages as Record<string, string | undefined>)[nom] ?? "",
  }));
  const champ = { value: reglages.recherche ?? "" };
  const compte = { textContent: "" };
  const barre = {
    hidden: true,
    querySelectorAll: () => menus,
    querySelector: (selecteur: string) => (selecteur === "input" ? champ : compte),
    addEventListener: (_type: string, ecouteur: () => void) => {
      ecouteurs.push(ecouteur);
    },
  };
  const ecouteurs: (() => void)[] = [];
  const liste = { querySelectorAll: () => cartes };
  const document = {
    getElementById: (id: string) =>
      id === "analyses-filtres" ? barre : id === "analyses-index" ? liste : null,
  };
  new Function(
    "document",
    "carteRetenue",
    `${corpsFiltresAnalyses()}\nreturn brancherFiltresAnalyses();`,
  )(document, carteRetenue);
  assert.equal(ecouteurs.length, 1, "un seul écouteur, posé sur la barre");
  ecouteurs[0]!();
  const titres = [...html.matchAll(/<a[^>]* href="\/analyses\/([a-z0-9-]+)\/">/g)].map((m) => m[1]!);
  return {
    visibles: titres.filter((_, i) => !cartes[i]!.hidden),
    compte: compte.textContent,
    barreDepliee: !barre.hidden,
  };
}

const CORPUS_INDEX: Analyse[] = [
  analyseIndex("defense", "decryptage", ["budget_etat"], ["etat"], "Les crédits de la Défense"),
  analyseIndex("retraites", "comparaison", ["securite_sociale"], ["secu"], "Une aide à l'insertion sociale"),
  analyseIndex("communes", "decryptage", ["finances_locales"], ["collectivites"], "L'investissement des communes"),
];

function analyseIndex(
  slug: string,
  type: string,
  themes: string[],
  budgets: string[],
  titre: string,
): Analyse {
  return {
    slug,
    titre,
    type,
    publie_le: "2026-01-01",
    themes,
    budgets_concernes: budgets,
    mise_en_avant: false,
    affirmation: {
      texte: "Un chiffre couramment répété.",
      auteur: null,
      date: null,
      source: { titre: "Source", url: "https://exemple.test", consulte_le: "2026-01-01" },
    },
    verdict: { cran: "exact", phrase: "Le chiffre correspond aux comptes publiés." },
    chiffres: [{ dit: "environ 60 milliards", valeur: 6e10, registre: "estimation_externe", lecture: "Le montant cité." }],
    hypotheses: [],
    effets_indirects: [],
    sources: [{ titre: "Source", url: "https://exemple.test", consulte_le: "2026-01-01" }],
    simulateur: { budget: "", contrat: "", lecture: "Rien à rejouer." },
    mises_a_jour: [],
    verifie_contre: "",
  } as unknown as Analyse;
}

test("la barre se déplie quand le paquet l'a câblée, et pas avant", () => {
  // Servie repliée par le pré-rendu : sans JavaScript, aucun réglage mort ne
  // s'affiche et les cartes restent toutes lisibles.
  assert.match(renduIndex(CORPUS_INDEX, [] as never[]), /class="analyses-filtres"[^>]* hidden>/);
  assert.equal(reglerFiltres(CORPUS_INDEX, {}).barreDepliee, true);
});

test("les filtres secondaires ont un tiroir mobile et une remise à zéro", () => {
  const html = renduIndex(CORPUS_INDEX, [] as never[]);
  assert.match(
    html,
    /<button[^>]*id="analyses-filtres-bouton"[^>]*aria-expanded="false"[^>]*aria-controls="analyses-filtres"/,
  );
  assert.match(html, /data-effacer-filtres/);
  assert.match(MAIN, /getElementById\("analyses-filtres-bouton"\)/);
  assert.match(MAIN, /getElementById\("analyses-etat-vide"\)/);
  assert.match(html, /Effacer les filtres/);
});

test("les dossiers restent lisibles sur mobile et leurs filtres s'ouvrent sur bureau", () => {
  const chemin = new URL("./styles/dossiers-verification.css", import.meta.url);
  assert.equal(existsSync(chemin), true, "la feuille des dossiers doit exister");
  const css = readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
  assert.match(MAIN, /import "\.\/styles\/dossiers-verification\.css";/);
  assert.match(
    css,
    /\.analyses-filtres:not\(\[hidden\]\):not\(\[data-ouvert="true"\]\) \{\n\s*display: none;/,
  );
  assert.doesNotMatch(css, /\.analyses-filtres:not\(\[data-ouvert="true"\]\)/);
  const bureau = css.slice(css.indexOf("@media (min-width: 60rem)"));
  assert.match(
    bureau,
    /\.analyses-filtres:not\(\[hidden\]\):not\(\[data-ouvert="true"\]\) \{\n\s*display: grid;/,
  );
  assert.match(css, /\.dossier-index__lien:focus-visible/);
});

test("un filtre cache les cartes écartées, il ne recompose pas la liste", () => {
  // La page est pré-rendue : les cartes sont déjà dans le HTML servi, et le
  // filtrage bascule leur `hidden`.
  assert.deepEqual(reglerFiltres(CORPUS_INDEX, { type: "decryptage" }).visibles, [
    "defense",
    "communes",
  ]);
  assert.deepEqual(reglerFiltres(CORPUS_INDEX, { theme: "securite_sociale" }).visibles, [
    "retraites",
  ]);
  assert.deepEqual(reglerFiltres(CORPUS_INDEX, { budget: "collectivites" }).visibles, ["communes"]);
});

test("la recherche de l'index est permissive, mot à mot et sans contiguïté", () => {
  assert.deepEqual(reglerFiltres(CORPUS_INDEX, { recherche: "sociale aide" }).visibles, [
    "retraites",
  ]);
  assert.deepEqual(reglerFiltres(CORPUS_INDEX, { recherche: "DEFENSE" }).visibles, ["defense"]);
});

test("ce qu'un réglage retranche se dit, et le silence signifie que rien n'est retranché", () => {
  // Une page qui se vide sans un mot ne se distingue pas d'une page en panne.
  assert.equal(reglerFiltres(CORPUS_INDEX, { type: "decryptage" }).compte, "2 analyses sur 3");
  assert.equal(reglerFiltres(CORPUS_INDEX, { theme: "securite_sociale" }).compte, "1 analyse sur 3");
  assert.equal(reglerFiltres(CORPUS_INDEX, { recherche: "introuvable" }).compte, "0 analyse sur 3");
  assert.equal(reglerFiltres(CORPUS_INDEX, {}).compte, "");
});

test("les filtres sont branchés avant le premier appel réseau", () => {
  // L'index est servi entier, cartes comprises : un manifeste muet ne doit pas
  // laisser sa barre repliée sur une liste qu'on voulait réduire.
  const debut = MAIN.indexOf("async function demarrer");
  assert.ok(debut > 0, "demarrer introuvable");
  // La présence AVANT l'ordre : un appel retiré rend `indexOf` négatif, donc
  // « avant » tout le reste, et la comparaison seule passait au vert sur une
  // fonction que plus personne n'appelle.
  const appel = MAIN.indexOf("brancherFiltresAnalyses();", debut);
  assert.ok(appel > 0, "brancherFiltresAnalyses n'est appelée nulle part dans demarrer");
  assert.ok(
    appel < MAIN.indexOf("await donnees.initialiser()", debut),
    "les filtres doivent être branchés avant le premier appel réseau",
  );
});

test("une carte cachée et une barre repliée le restent bien à l'écran", () => {
  // `display: grid` sur la carte et `display: flex` sur la barre l'emportent
  // sur le `display: none` que `[hidden]` donne : sans règle explicite, le
  // filtre ne filtre rien et la barre s'affiche morte sans JavaScript. C'est
  // le défaut déjà vu sur `.onglets-themes`.
  assert.match(CSS_REGLES, /\.analyse-rendu__index-ligne\[hidden\] \{\n\s*display: none;/);
  assert.match(CSS_REGLES, /\.analyses-filtres\[hidden\] \{\n\s*display: none;/);
});

/**
 * L'export CSV nomme sa source à la maille exportée.
 *
 * Le module `export.ts` a la fonction et ses tests ; ce qui se vérifie ici est
 * son BRANCHEMENT. Une fonction juste qu'aucun appelant n'emploie laisse le
 * défaut en ligne — c'est le piège que ce dépôt a déjà rencontré deux fois, un
 * test vert au-dessus d'un écran faux.
 */
/**
 * La fiche de territoire est partageable, à toutes les mailles.
 *
 * Spec §13 : cinq objets partageables, dont « Fiche territoire — nom du
 * territoire, trois chiffres, exercice ». `carteFiche` et `partageFiche` ont
 * leurs tests ; ce qui se vérifie ici est qu'un appelant existe, et qu'il
 * existe aux DEUX endroits où la fiche s'affiche — le panneau d'accueil, qui
 * montre la France, et la sélection d'un territoire. « La même fiche à toutes
 * les mailles » (CLAUDE.md) vaut aussi pour ce qu'on peut en emporter.
 */
test("le pied de fiche porte le partage, sur la France comme sur un territoire", () => {
  assert.ok(
    FICHE.includes('id="fiche-partage"'),
    "la fiche ne laisse plus de conteneur au cadre de partage",
  );
  const poses = MAIN.match(/poserPartageDeLaFiche\(/g) ?? [];
  assert.equal(
    poses.length - 1,
    2,
    `le cadre de partage est posé ${poses.length - 1} fois pour deux affichages de fiche`,
  );
  assert.ok(
    MAIN.includes('poserPartageDeLaFiche("pays", "FR", france)'),
    "le panneau d'accueil, qui montre la France, n'offre pas son partage",
  );
  assert.ok(MAIN.includes("brancherPartageDeLaFiche();"), "les gestes ne sont branchés nulle part");
});

test("l'image d'une fiche se construit au clic, elle ne s'annonce pas comme un fichier", () => {
  // Le build n'écrit pas 34 875 PNG : `partageFiche` rend `image: null`, et le
  // bouton passe par `carteFiche` puis `telecharger`. Un href vers une image
  // que rien ne produit est l'aperçu cassé que `validerImagesAnnoncees` refuse.
  assert.ok(
    MAIN.includes('nomDeFichier(fichePartagee.territoire.nom, fichePartagee.niveau, "carte", "svg")'),
    "la carte de fiche ne se télécharge pas, ou pas en SVG",
  );
  assert.ok(
    /button\[data-carte\]/.test(MAIN),
    "aucun écouteur ne sert le bouton d'image construite",
  );
});

/**
 * Une piste de grille ne reste pas plus large que son cadre.
 *
 * `repeat(auto-fit, minmax(20rem, 1fr))` garde sa piste de 20 rem même quand le
 * conteneur est plus étroit qu'elle. Mesuré au navigateur à 320 px : la section
 * nationale n'offre que 190 px et deux de ses cadres en prenaient 320, « 100 € »
 * 288 px dans un cadre de 156. Le corps de `/reperes` défilait alors sur 385 px
 * — le §24 pris en défaut, sur des surfaces plus anciennes que le cadre de
 * partage qui a fait chercher.
 *
 * `min(Nrem, 100%)` ne change rien au-dessus de N rem ; il donne à la piste le
 * droit de descendre avec son conteneur. Les quatre autres grilles de ce fichier
 * — 16, 12, 9,5 et 9 rem — ont été mesurées aux mêmes 320 px et tiennent : elles
 * restent telles quelles, faute de défaut à corriger.
 */
test("les deux grilles qui débordaient à 320 px bornent leur piste", () => {
  for (const grille of ["national__grille", "cent__grille"]) {
    const bloc = CSS.slice(CSS.indexOf(`.${grille} {`));
    const declaration = bloc.slice(0, bloc.indexOf("}"));
    assert.match(
      declaration,
      /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(\d+rem,\s*100%\),\s*1fr\)\)/,
      `.${grille} : la piste ne peut plus descendre sous sa taille, et déborde à 320 px`,
    );
  }
});

/**
 * Le chiffre de tête d'un cadre et son millésime passent à la ligne.
 *
 * Deuxième cause du défilement de `/reperes`, cachée derrière la première :
 * borner les pistes de grille a ramené le corps de 385 px à 330, pas à 320. Le
 * reste venait d'ici — `.bloc__chiffre` est un flex, le chiffre y est au corps
 * le plus gros du site, et « 3 536 100 M€ » suivi de la pilule « 2026-Q1 »
 * demande 330 px. Un flex ne passe pas à la ligne tout seul.
 *
 * La leçon vaut plus que la ligne : une grosse amélioration mesurée — 385 vers
 * 330 — n'est pas une page réparée, et s'arrêter là aurait produit une
 * affirmation fausse.
 */
test("le chiffre de tête et son millésime passent à la ligne plutôt que de sortir", () => {
  const bloc = CSS.slice(CSS.indexOf(".bloc__chiffre {"));
  const declaration = bloc.slice(0, bloc.indexOf("}"));
  assert.match(declaration, /display:\s*flex/, ".bloc__chiffre n'est plus un flex : ce test vise le mauvais sélecteur");
  assert.match(
    declaration,
    /flex-wrap:\s*wrap/,
    "le millésime sort du cadre à 320 px, et le corps de page défile avec lui",
  );
});

/**
 * Les deux correctifs d'accessibilité que seul un navigateur voyait.
 *
 * `axe-core` n'est pas dans l'intégration continue : ces deux gardes sont donc
 * la seule chose qui empêche les quinze nœuds de revenir. Elles sont
 * grossières — du texte dans une feuille et dans huit gabarits — et c'est
 * exactement leur intérêt : elles coûtent une milliseconde et tiennent la
 * mesure qui a coûté un moteur de rendu.
 */
test("les paliers de la mission ne s'estompent pas sur fond clair", () => {
  // `opacity: 0.55` composait --encre-douce en #a3aaa2 sur le carreau : 2,1:1
  // pour un seuil de 4,5. Les tests de couleur du dépôt ne pouvaient pas le
  // voir — ils lisent des couleurs déclarées, et l'opacité n'en est pas une.
  const bloc = CSS.slice(CSS.indexOf(".mission .simu__palier {"));
  const declaration = bloc.slice(0, bloc.indexOf("}"));
  assert.match(
    declaration,
    /opacity:\s*1/,
    "l'estompe est revenue sur fond clair : le contraste retombe à 2,1:1",
  );
});

test("tout cadre qui défile est atteignable au clavier, la liste étant déduite", () => {
  // La version précédente de ce contrôle énumérait huit gabarits à la main, et
  // **elle en a manqué quatre** : les cadres défilants des analyses, du rendu
  // d'analyse et des scénarios sont arrivés après elle, et une liste écrite à
  // la main ne pousse pas toute seule. `axe-core` les a trouvés sur /bilan.
  //
  // La liste se déduit donc de la feuille de style : toute classe dont une
  // règle déclare `overflow-x: auto` doit porter `tabindex="0"` partout où un
  // gabarit l'écrit. Un cadre défilant neuf tombe ici le jour de sa naissance.
  const feuille = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  const defilantes = new Set<string>();
  for (const bloc of feuille.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/overflow-x:\s*auto/.test(bloc[2])) continue;
    for (const classe of bloc[1].matchAll(/\.([a-zA-Z0-9_-]+)/g)) defilantes.add(classe[1]);
  }
  assert.ok(defilantes.size >= 5, `${defilantes.size} classes défilantes trouvées`);

  const manquants: string[] = [];
  for (const fichier of readdirSync(new URL(".", import.meta.url)).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts"),
  )) {
    const source = readFileSync(new URL(`./${fichier}`, import.meta.url), "utf8");
    for (const balise of source.matchAll(/<[a-z]+[^>]*class="([^"]*)"[^>]*>/g)) {
      const classes = balise[1].split(/\s+/);
      if (!classes.some((c) => defilantes.has(c))) continue;
      // La règle WCAG est « atteignable » : un cadre dont le CONTENU est
      // focalisable défile déjà au clavier, et `axe-core` le laisse passer.
      // `.pilules` ne contient que des boutons ; c'est la seule exception, et
      // elle se vérifie en lisant les six lignes qui suivent le gabarit.
      // La fenêtre s'arrête à la fermeture du cadre : sans cette coupe, un
      // bouton écrit APRÈS le tableau — `renduAbandons`, juste sous celui des
      // scénarios — exemptait un cadre qui n'en contient aucun.
      const suite = source.slice(balise.index ?? 0, (balise.index ?? 0) + 600).split("</div>")[0];
      if (/<(?:button|a|input|select)\b/.test(suite)) continue;
      if (!balise[0].includes('tabindex="0"')) manquants.push(`${fichier} : ${balise[0].slice(0, 70)}`);
    }
  }
  assert.deepEqual(manquants, [], `cadres défilants sans tabindex :\n${manquants.join("\n")}`);
});

test("les tables annuelles du bilan défilent dans leur cadre aussi sur tablette", () => {
  // Mesuré à 768 px : `.secu` et `.comparaison` poussaient le document à
  // 985 px. Le correctif ne réduit ni les colonnes ni leur texte ; il étend à
  // la tablette le même cadre défilant et focalisable que sur téléphone.
  const debut = CSS.indexOf("@media (min-width: 40.001rem) and (max-width: 60rem)");
  assert.ok(debut >= 0, "palier tablette des tableaux introuvable");
  const bloc = CSS.slice(debut, CSS.indexOf("\n}\n\n@media", debut) + 2);
  for (const classe of ["pont", "comparaison", "fonctions", "secu", "niches"]) {
    assert.match(bloc, new RegExp(`\\.${classe}`), `.${classe} sort du cadre à 768 px`);
  }
  assert.match(bloc, /overflow-x:\s*auto/);
  assert.match(bloc, /:focus-visible/);
});

test("qui remplit un cadre le déplie", () => {
  // Le pré-rendu REPLIE tout cadre dont il ne peut pas écrire le corps —
  // `.bloc` est bordé et ombré, et une case vide se lit comme une panne. Rien
  // ne le rouvrait : un bloc dont les séries sont publiées APRÈS le dernier
  // déploiement restait invisible à tout lecteur, écrit, peint et caché, jusqu'à
  // ce qu'un commit sur `site/**` refasse le document. La publication ne
  // déclenche pas de déploiement — c'est le cas qu'ont posé les 100 € de toutes
  // les administrations, dont les séries arrivent par l'ingestion qui suit la
  // fusion.
  //
  // La liste des peintres se DÉDUIT de main.ts : une liste écrite à la main ne
  // pousse pas, et c'est la troisième garde de ce dépôt à devoir l'apprendre.
  const peintres = [...MAIN.matchAll(/\bafficher([A-Z][A-Za-z]*)\(\$\("bloc-/g)].map((m) => m[1]);
  // Six peintres : un par bloc de la maquette validée — les sept blocs hérités
  // sont sortis de /bilan le jour où la page a cessé de lui ressembler.
  assert.ok(peintres.length >= 6, `${peintres.length} peintre(s) de bloc lus dans main.ts`);
  const manquants: string[] = [];
  for (const peintre of new Set(peintres)) {
    // Le module qui exporte ce peintre, trouvé par son import — jamais un nom
    // de fichier deviné, qui ferait passer ce test sur un fichier absent.
    const importe = MAIN.match(new RegExp(`import \\{[^}]*\\bafficher${peintre}\\b[^}]*\\} from "\\./([^"]+)"`));
    assert.ok(importe, `afficher${peintre} : import introuvable dans main.ts`);
    const source = readFileSync(new URL(`./${importe[1]}`, import.meta.url), "utf8");
    const corps = source.slice(source.indexOf(`export function afficher${peintre}`));
    const fin = corps.indexOf("\n}\n");
    const fonction = corps.slice(0, fin === -1 ? undefined : fin);
    assert.match(fonction, /\.innerHTML =/, `afficher${peintre} : ce test vise à côté`);
    if (!/\.hidden = false/.test(fonction)) manquants.push(`${importe[1]} : afficher${peintre}`);
  }
  assert.deepEqual(manquants, [], `peintres qui remplissent un cadre sans le déplier :\n${manquants.join("\n")}`);
});

test("les huit cadres qui défilent sont atteignables au clavier", () => {
  // Un `overflow-x: auto` sans contenu focalisable ne défile qu'à la souris
  // (WCAG 2.1.1) : les colonnes cachées sont perdues pour qui navigue au
  // clavier. Le sélecteur est vérifié avant le `tabindex`, sans quoi un
  // renommage de classe rendrait ce test vert sur un gabarit disparu.
  const gabarits: [string, string][] = [
    ["etat.ts", 'class="pont"'],
    ["etat.ts", 'class="comparaison"'],
    ["national.ts", 'class="comparaison"'],
    ["fonctions.ts", 'class="fonctions"'],
    ["niches.ts", 'class="niches"'],
    ["secu.ts", 'class="secu"'],
    ["exercices.ts", 'class="tableau-exercices"'],
  ];
  for (const [fichier, motif] of gabarits) {
    const source = readFileSync(new URL(`./${fichier}`, import.meta.url), "utf8");
    assert.ok(source.includes(motif), `${fichier} : ${motif} introuvable, le test vise à côté`);
    assert.ok(
      source.includes(`${motif} tabindex="0"`),
      `${fichier} : ${motif} défile sans être atteignable au clavier`,
    );
  }
});

/* --------------------------------------------------------------------------
 * Le bilan parle la langue de la fiche territoire
 * ----------------------------------------------------------------------- */

test("le bilan n'a plus de carte de page : une colonne au filet, comme la fiche", () => {
  // Le dernier « cadre dans un cadre » du site : `.national` portait bordure,
  // rayon et ombre autour de cinq chapitres déjà à plat, et sa marge de
  // 1,5 rem s'ajoutait à la gouttière de `.vue`. `/territoire` n'a aucune
  // carte de page ; `/bilan` non plus.
  const bloc = CSS.slice(CSS.indexOf("\n.national {"), CSS.indexOf("\n.national h2"));
  assert.doesNotMatch(bloc, /box-shadow/);
  assert.doesNotMatch(bloc, /border:/);
  assert.match(bloc, /max-width: var\(--colonne-texte\)/);
});

test("un chapitre se sépare au filet de la fiche, pas au filet teinté", () => {
  // Cinq couleurs de chrome sur une page que la fiche tient avec une seule.
  // La couleur reste déclarée pour les MARQUES — pistes et courbes.
  const bloc = CSS.slice(CSS.indexOf("\n.chapitre {"), CSS.indexOf("\n.chapitre:first-of-type"));
  assert.match(bloc, /border-top: 1px solid var\(--trait\)/);
  assert.doesNotMatch(bloc, /4px/);
  assert.match(CSS, /#chapitre-tenable \{ --chapitre: var\(--serie-5\); \}/);
});

test("le titre d'un chapitre pèse le cran de section de la fiche, pas celui de la page", () => {
  // `.chapitre__question` déclarait `--texte-l` et `.national h2` l'écrasait à
  // `--texte-xxl` : une section pesait le rang au-dessus d'elle.
  const question = CSS.slice(CSS.indexOf("\n.chapitre__question {"));
  assert.match(question.slice(0, question.indexOf("}")), /font-size: var\(--texte-xl\)/);
  const h2 = CSS.slice(CSS.indexOf("\n.national h2 {"));
  assert.match(h2.slice(0, h2.indexOf("}")), /font-size: var\(--texte-xl\)/);
});

test("ni le pont ni la réponse ne portent d'aplat teinté", () => {
  // Les deux seuls encarts colorés de la page ; la fiche n'en a aucun.
  for (const nom of ["\n.chapitre__pont {", "\n.reponse {"]) {
    const regle = CSS.slice(CSS.indexOf(nom));
    const corps = regle.slice(0, regle.indexOf("}"));
    assert.doesNotMatch(corps, /background/, nom);
    assert.doesNotMatch(corps, /border-left/, nom);
  }
});

test("la colonne d'évolution se déclare, elle n'est pas la dernière venue", () => {
  // Viser `td:last-child` aurait donné le filet et le gras de la colonne
  // d'évolution à une colonne d'année, qui n'est pas une variation.
  assert.match(CSS, /\.chapitre table \.evolution \{/);
  assert.doesNotMatch(CSS, /\.chapitre table td:last-child/);
});

test("ANALYSES n'est pas une destination de la navigation principale", () => {
  const nav = PAGE.slice(PAGE.indexOf('<nav class="entete__nav"'));
  const barre = nav.slice(0, nav.indexOf("</nav>"));
  assert.doesNotMatch(barre, /Analyses|\/analyses/);
  assert.match(MAIN, /renduNavigation\(location\.pathname, simulateurDisponible\)/);
});

test("l'onglet ANALYSES se marque courant, et le marquage passe avant tout", () => {
  // `basculerVue` — qui pose `aria-current` — sort à sa première ligne sur une
  // page éditoriale : le marquage se fait donc à part. Et EN PREMIER dans
  // `demarrer()`, parce que tout ce qui suit peut lever sur ces pages-là.
  assert.match(MAIN, /function marquerOngletAnalyses\(\): void \{/);
  const debut = MAIN.slice(MAIN.indexOf("async function demarrer(): Promise<void> {"));
  const avantTheme = debut.slice(0, debut.indexOf("brancherTheme();"));
  assert.match(avantTheme, /marquerOngletAnalyses\(\);/, "le marquage doit ouvrir demarrer()");
});

test("la navigation primaire est aussi rendue sur les documents éditoriaux", () => {
  // Les analyses et le registre sortent avant `basculerVue()` : ils doivent
  // donc peupler eux-mêmes la barre mobile, au lieu de laisser un fin cadre
  // fixe sans destination.
  const debut = MAIN.slice(MAIN.indexOf("async function demarrer(): Promise<void> {"));
  const avantTheme = debut.slice(0, debut.indexOf("brancherTheme();"));
  assert.match(avantTheme, /rendreNavigationPrincipale\(\);/);
});

test("les documents éditoriaux gardent Simuler disponible sans ouvrir la SPA sans données", () => {
  const navigation = MAIN.slice(
    MAIN.indexOf("function rendreNavigationPrincipale(): void {"),
    MAIN.indexOf("/* --------------------------------------------------------------------------\n * L'accueil"),
  );
  // Les pages pré-rendues ne chargent pas les budgets : leur lien reste une
  // porte vers le simulateur. Les vues SPA, elles, restent liées à la présence
  // effective des exercices.
  assert.match(
    navigation,
    /const simulateurDisponible = document\.body\.dataset\.page === "editorial" \|\| exercicesParVolet\.length > 0;/,
  );
  assert.match(navigation, /renduNavigation\(location\.pathname, simulateurDisponible\)/);
  assert.match(MAIN, /function vuesConnues\(\): readonly string\[\] \{\s*return exercicesParVolet\.length \? \[\.\.\.VUES_PAGE, "simulateur"\] : VUES_PAGE;/s);
});

test("les liens de navigation d'un document éditorial gardent leur navigation native", () => {
  const gestionnaire = MAIN.slice(
    MAIN.indexOf('document.querySelector(".entete__nav")?.addEventListener("click"'),
    MAIN.indexOf("/* --------------------------------------------------------------------------\n * La navigation principale"),
  );
  const garde = 'if (document.body.dataset.page === "editorial") return;';
  assert.match(gestionnaire, new RegExp(garde.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(
    gestionnaire.indexOf(garde) < gestionnaire.indexOf("const destination = intercepterNavigation(clic);"),
    "le document éditorial doit laisser le href naviguer avant toute interception SPA",
  );
});

test("dossiers et registre ne conservent aucune colonne minimale sur mobile", () => {
  // Une grille à piste implicite `auto` prend la largeur du mot le plus long :
  // sur un petit écran, le dossier ou une fiche source sort alors du viewport.
  assert.match(DOSSIERS_VERIFICATION, /\.analyse-rendu\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
  assert.match(REGISTRE_SOURCES, /\.registre-sources\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
  assert.match(REGISTRE_SOURCES, /\.registre-sources__publication\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
});

test("les filtres bureau gardent chaque libellé collé à son contrôle", () => {
  const bureau = DOSSIERS_VERIFICATION.slice(DOSSIERS_VERIFICATION.indexOf("@media (min-width: 60rem)"));
  assert.match(bureau, /\.analyses-filtres__groupe\s*\{\s*display: grid;/);
  assert.match(bureau, /\.analyses-filtres__groupe--recherche\s*\{\s*grid-column: 1 \/ -1;/);
});

test("le registre propose un filtre de contexte qui garde le HTML intégral sans JavaScript", () => {
  const registre = MAIN.slice(MAIN.indexOf("function brancherRegistreSources(): void {"));
  assert.match(registre, /getElementById\("registre-sources-contexte"\)/);
  assert.match(registre, /fiche\.dataset\.contextes/);
  assert.match(REGISTRE_SOURCES, /\.registre-sources__groupe/);
});

test("une ancre de source donne le focus à la fiche exacte", () => {
  const registre = MAIN.slice(MAIN.indexOf("function brancherRegistreSources(): void {"));
  assert.match(registre, /const focaliserAncre = \(\) => \{/);
  assert.match(registre, /cible\.tabIndex = -1;/);
  assert.match(registre, /cible\.focus\(\{ preventScroll: true \}\);/);
  assert.match(REGISTRE_SOURCES, /\.registre-sources__fiche:focus-visible/);
});

test("le pied de fiche ne fait pas tomber le démarrage d'une page éditoriale", () => {
  // `$("fiche")` rend `null` sur l'index des analyses et sur une analyse :
  // `brancherPartage` levait dessus, `demarrer()` s'arrêtait là, et TOUT ce
  // qui suit ne s'exécutait plus — à commencer par `brancherRecherche`. Le
  // champ de recherche de l'en-tête était donc MORT sur chaque page d'analyse,
  // et le rattrapage de `demarrer()`, muet sur les pages éditoriales, ne le
  // disait pas.
  const fonction = MAIN.slice(MAIN.indexOf("function brancherPartageDeLaFiche(): void {"));
  const corps = fonction.slice(0, fonction.indexOf("\n}"));
  assert.match(corps, /if \(!panneau\) return;/);
  // Le garde-fou doit précéder le premier usage du cadre.
  assert.ok(
    corps.indexOf("if (!panneau) return;") < corps.indexOf("brancherPartage(panneau"),
    "le garde-fou doit venir avant l'usage",
  );
});

test("la vue simulateur passe en vrai tunnel : plein écran, sauf pour un lien d'atelier", () => {
  // Le montage pose la classe du plein écran, mais jamais quand l'adresse
  // porte un budget ou un face-à-face : un lien partagé ouvre l'atelier
  // qu'il promettait, dans la page.
  assert.match(MAIN, /tunnel\.classList\.add\("tunnel--plein"\)/);
  assert.match(MAIN, /demarrerSessionImmersive\(tunnel/);
  assert.match(MAIN, /if \(etat\.budget \|\| etat\.face\) \$\("mode-expert"\)\.hidden = false;\n  else \{/);
});

test("le verdict garde une encre sombre sur ses cartes claires", () => {
  // Les trois cartes claires du verdict héritaient des blancs de la palette
  // « crise ». Les sélecteurs restent locaux au verdict, afin de préserver
  // l'en-tête bleu nuit qui porte volontairement un texte clair.
  for (const selecteur of [
    ".verdict__mandat .tunnel__verdict-nom",
    ".verdict__gestes .tunnel__tampon",
    ".verdict__gestes .tunnel__tampon b",
    ".verdict__stabilite .tunnel__soutien-valeur",
  ]) {
    assert.match(TUNNEL_CABINET, new RegExp(`${selecteur.replace(/\./g, "\\.")}\\s*\\{[^}]*color:\\s*var\\(--ui-encre\\);`));
  }
  for (const selecteur of [
    ".verdict__mandat .tunnel__surtitre",
    ".verdict__gestes .tunnel__surtitre",
    ".verdict__stabilite .tunnel__surtitre",
    ".verdict__mandat .tunnel__chapeau",
    ".verdict__stabilite .tunnel__soutien-nom",
    ".verdict__stabilite .tunnel__note",
  ]) {
    assert.match(TUNNEL_CABINET, new RegExp(`${selecteur.replace(/\./g, "\\.")}[^}]*color:\\s*var\\(--ui-encre-douce\\);`));
  }
  for (const fond of ["--ui-papier", "--ui-surface"]) {
    const principal = contraste(tokenFondation("--ui-encre"), tokenFondation(fond));
    const secondaire = contraste(tokenFondation("--ui-encre-douce"), tokenFondation(fond));
    assert.ok(principal >= 7, `--ui-encre sur ${fond} : ${principal.toFixed(2)}:1 < 7`);
    assert.ok(secondaire >= 4.5, `--ui-encre-douce sur ${fond} : ${secondaire.toFixed(2)}:1 < 4,5`);
  }
});

test("le territoire commence par ses commandes d'analyse sans briefing redondant", () => {
  assert.doesNotMatch(PAGE, /id="briefing-territorial"/);
  assert.doesNotMatch(MAIN, /\bmonterBriefingTerritorial\b/);
  assert.doesNotMatch(MAIN, /\brenduBriefing\b/);
  for (const theme of ["Budget", "Fiscalité", "Dette", "Services", "Trajectoire"]) {
    assert.match(PAGE, new RegExp(`>${theme}<`));
  }
  assert.match(PAGE, /id="afficher-carte"[^>]*aria-expanded="false"/);
});

test("la carte territoriale se révèle sans être recréée", () => {
  assert.match(MAIN, /appliquerEtatCarte\(cadre, bouton, ouverte/);
  assert.match(MAIN, /suivreVisibiliteCarteParDefaut\(/);
  assert.match(MAIN, /carte\?\.resize\(\)/);
});

test("les commandes territoriales gardent leur feuille de styles", () => {
  assert.match(PAGE, /class="territoire-themes"/);
  assert.match(PAGE, /class="territoire-carte__action"/);
  assert.match(MAIN, /import "\.\/styles\/territoire-briefing\.css";/);
});

test("la carte révélée retrouve toute la colonne sur mobile", () => {
  const css = readFileSync(new URL("./styles/territoire-briefing.css", import.meta.url), "utf8");
  const mobile = css.slice(css.lastIndexOf("@media (max-width: 60rem)"));
  assert.match(mobile, /\.vue--territoire\s*\{\s*display:\s*block;\s*grid-template-columns:\s*none;/);
  assert.match(mobile, /\.atelier\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(mobile, /\.atelier__carte\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1;/);
  assert.match(mobile, /#panneau\s*\{\s*grid-column:\s*1;\s*grid-row:\s*2;/);
  assert.match(mobile, /#palmares,[\s\S]*#detail\s*\{\s*width:\s*auto;\s*max-width:\s*100%;/);
});

test("le redimensionnement de la carte n'interroge pas une couche absente", () => {
  const etiquettes = MAIN.slice(MAIN.indexOf("function majEtiquettes(): void {"));
  assert.match(etiquettes, /const idCouche = `remplissage-\$\{couche\}`;/);
  assert.match(etiquettes, /if \(!carte\.getLayer\(idCouche\)\) return;/);
  assert.match(etiquettes, /layers: \[idCouche\]/);
});

test("les thèmes territoriaux conduisent à une section détaillée", () => {
  for (const theme of ["Budget", "Fiscalité", "Dette", "Services", "Trajectoire"]) {
    assert.match(PAGE, new RegExp(`>${theme}<`));
  }
  assert.match(MAIN, /data-territoire-theme/);
  assert.match(BRIEFING_TERRITORIAL, /focus\(\{ preventScroll: true \}\)/);
});
