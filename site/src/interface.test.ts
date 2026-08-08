/**
 * Trois défauts vus en naviguant sur le site, que rien ne testait : la légende
 * recouvrait la carte, l'année restait bloquée sur un vieux millésime, et un
 * maire manquant laissait un blanc indistinct d'une absence de fonctionnalité.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const PAGE = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const MAIN = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const CSS = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const FICHE = readFileSync(new URL("./fiche.ts", import.meta.url), "utf8");

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

test("déplier une mesure ne repeint pas la carte", () => {
  // Peindre relit une couche de 34 772 territoires et réécrit la fiche
  // entière. Tant que ce coût était celui d'un dépliage, *lire* un chiffre
  // coûtait le prix de *cartographier* un chiffre — à chaque ligne, sur un
  // thème qui en compte soixante-dix-neuf.
  assert.match(MAIN, /closest<HTMLElement>\("\[data-carte\]"\)/);
  assert.doesNotMatch(MAIN, /closest<HTMLElement>\("\[data-mesure\]"\)/);
  // Le bouton n'existe que là où il y a quelque chose à peindre : les mêmes
  // refus que `choisirIndicateur`, appliqués avant de le proposer.
  assert.match(MAIN, /function peintSurCarte\(indicateur: Indicateur\): boolean/);
  assert.match(FICHE, /data-carte="/);
});

test("un maire absent n'écrit rien, comme toute donnée absente", () => {
  // « Maire : non renseigné » occupait une ligne pour dire qu'il n'y avait
  // rien à dire, en contradiction avec la règle de la fiche.
  assert.doesNotMatch(FICHE, /non renseigné par le Répertoire/);
});

test("la taxe fonciere dit sa part dans les recettes de la collectivite", () => {
  // « Ma taxe foncière, ça pèse combien dans ce que la commune encaisse ? »
  // Le rapprochement DGFiP/OFGL n'entre dans PART_DU_TOTAL qu'après contrôle
  // du périmètre ; ce test verrouille sa présence, le contrôle vit en
  // commentaire à côté de la table.
  assert.match(FICHE, /dgfip_produit_foncier_bati: \{\s*total: "ofgl_recettes_fonctionnement"/);
});

/* ------------------------------------------------------------------------
 * Le système de design, verrouillé. Ces tests ne jugent pas du goût : ils
 * empêchent la dette de revenir par la porte de derrière — une taille en dur
 * ici, un rayon de 2px là, un `<link>` vers Google Fonts « juste pour essayer ».
 * ---------------------------------------------------------------------- */

/** Corps de la feuille, tokens exclus : c'est là que les valeurs en dur se
 *  glissent. Le bloc `:root` et les `@font-face` ont le droit d'en contenir. */
const CSS_CORPS = CSS.slice(CSS.indexOf("* {\n  box-sizing: border-box;\n}"));
/** Les feuilles de ce projet se commentent beaucoup, et les commentaires citent
 *  volontiers ce qu'on vient de bannir (« @media (max-width: 640px) a été
 *  réécrit »). Un test qui cherche une interdiction doit lire les règles, pas
 *  les explications. */
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
      (v) => v !== "" && v !== "0" && !v.startsWith("var(--espace-") && v !== "var(--cible)",
    );
  assert.deepEqual(enDur, [], "padding en dur");
  assert.match(CSS, /--espace-1:/);
  assert.match(CSS, /--espace-8:/);
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

test("papier unique assumé : pas de mode sombre, un fond peint", () => {
  // Décision documentée en tête de feuille (audit, point 22). Le fond doit
  // être peint explicitement, sinon la page emprunte celui du système.
  assert.doesNotMatch(CSS_REGLES, /prefers-color-scheme/);
  assert.match(CSS, /color-scheme: light;/);
  const corps = CSS.slice(CSS.indexOf("\nbody {"), CSS.indexOf("\nbody {") + 260);
  assert.match(corps, /background: var\(--fond\);/);
  // L'accent n'a pas de couleur propre : c'est un choix, pas un oubli.
  assert.match(CSS, /--accent: #0f1b2e;/);
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
