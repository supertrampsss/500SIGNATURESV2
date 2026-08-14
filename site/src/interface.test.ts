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
const ROUTES = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");

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
  // On peint toujours depuis le sélecteur de la carte : c'est lui qui choisit
  // l'indicateur, et il n'a jamais été dans la fiche.
  assert.match(MAIN, /function peintSurCarte\(indicateur: Indicateur\): boolean/);
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
  assert.match(balises, /id="carte-bascule"/);
  // Les liens `#carte` déjà partagés continuent d'ouvrir ce qu'ils
  // promettaient : la fiche, carte déployée.
  // La table des alias a rejoint `routes.ts`, où elle se teste sans navigateur.
  assert.match(ROUTES, /carte: "territoire"/);
  assert.match(MAIN, /if \(location\.hash === "#carte"\) carteOuverte = true;/);
  // La carte se mesure au montage : rendue dans un conteneur replié, elle
  // garderait cette taille au déploiement.
  assert.match(MAIN, /requestAnimationFrame\(\(\) => carte\?\.resize\(\)\);/);

  // La réécriture des liens à fragment efface le fragment : la règle `#carte`
  // doit être consommée depuis le fragment tel qu'il est arrivé, sinon elle
  // ne s'applique jamais au démarrage et le déploiement de la carte ne tient
  // plus qu'à la valeur initiale de `carteOuverte`.
  assert.match(MAIN, /const fragmentInitial = location\.hash;/);
  assert.match(MAIN, /if \(fragmentInitial === "#carte"\) carteOuverte = true;/);
  const ouverture = MAIN.slice(MAIN.indexOf("const fragmentInitial = location.hash;"));
  assert.ok(
    ouverture.indexOf('if (fragmentInitial === "#carte") carteOuverte = true;') <
      ouverture.indexOf("history.replaceState"),
    "la règle #carte doit être lue avant que la réécriture n'efface le fragment",
  );
});

test("chaque vue a une adresse, et les anciennes ouvrent la bonne", () => {
  // Le fragment ne part pas au serveur : tant que la vue y vivait, aucune page
  // ne pouvait être indexée ni servie pré-rendue.
  assert.match(MAIN, /vueDepuisAdresse\(location\.pathname, location\.hash\)/);
  // Le chemin est lu AVANT toute autre source : c'est lui qui fait foi.
  // La borne générique "/**\n * Le sommaire" matchait d'abord le sommaire de
  // « Sources et méthode », plus haut dans le fichier : on vise ici celui de
  // REPÈRES, qui suit basculerVue.
  const corps = MAIN.slice(MAIN.indexOf("function basculerVue"), MAIN.indexOf("/**\n * Le sommaire de REPÈRES."));
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
  assert.doesNotMatch(balises, /href="#(territoire|reperes|detail|simulateur|methode)"/);
  assert.match(balises, /href="\/territoire" data-vue="territoire"/);
});

test("les vues renommées portent leur nouveau nom partout", () => {
  // « Analyses » désigne désormais les analyses éditoriales ; les tableaux d'un
  // territoire s'appellent « detail ». « Décryptages » est devenu « Repères ».
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balises, /id="vue-detail"/);
  assert.match(balises, /id="vue-reperes"/);
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

test("une vue longue dit ce qu'elle contient", () => {
  // Huit blocs de plusieurs écrans sur 6 600 px de défilement, sans moyen de
  // savoir ce qui restait dessous ni d'y aller.
  assert.match(PAGE, /id="sommaire-reperes"/);
  assert.match(MAIN, /function peindreSommaireReperes\(\)/);
  // Le sommaire se construit sur ce qui s'est réellement affiché : rien de
  // cliquable ne doit mener à une section vide.
  const corps = MAIN.slice(
    MAIN.indexOf("function peindreSommaireReperes"),
    MAIN.indexOf("/** La carte est-elle déployée ?"),
  );
  assert.match(corps, /querySelector\("h2, h3"\)/);
  assert.match(corps, /if \(entrees\.length < 2\)/);
  // Une ancre interne ne doit pas être prise pour une vue inconnue et renvoyer
  // le lecteur sur TERRITOIRE au moment où il descend dans ce qu'il lit.
  assert.match(MAIN, /if \(!vuesConnues\(\)\.includes\(cible\) && document\.body\.dataset\.vue\) return;/);
  assert.match(CSS, /scroll-margin-top: calc\(var\(--haut-entete\)/);
  // Le chemin nomme désormais la vue, si bien que la garde ci-dessus ne couvre
  // plus les ancres internes d'une page routée : c'est le retour en haut qui
  // doit être conditionnel, sinon il annule le défilement vers l'ancre.
  assert.match(MAIN, /const precedente = document\.body\.dataset\.vue;/);
  assert.match(MAIN, /if \(vue !== precedente\) window\.scrollTo\(\{ top: 0 \}\);/);
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
  // page blanche : la vue de repli le ramène sur TERRITOIRE.
  assert.match(MAIN, /const vue = vuesConnues\(\)\.includes\(cible\) \? cible : "territoire";/);
  // Et plus personne ne l'y envoie de son propre chef.
  assert.doesNotMatch(MAIN, /location\.hash = "#donnees"/);
  // Les fonctions qui peignaient dans ses conteneurs se taisent au lieu de
  // lever : `$` rend `null`, et `null.innerHTML` casse toute la fiche.
  for (const garde of [
    'if (!document.getElementById("tableau-donnees")) return;',
    'if (!document.getElementById("sources-contenu")) return;',
  ]) {
    assert.ok(MAIN.includes(garde), `garde manquante : ${garde}`);
  }
  // Les écouteurs aussi. `brancherCommandes()` accrochait `#exporter` et
  // `#comparateur` sans garde : `$` rend `null`, `null.addEventListener` lève,
  // et l'exception remontait au `.catch` de `demarrer()` — tout ce qui suit
  // l'appel ne s'exécutait plus, blocs de Décryptages compris.
  for (const ecouteur of ["exporter", "comparateur"]) {
    assert.match(
      MAIN,
      new RegExp(`document\\.getElementById\\("${ecouteur}"\\)\\?\\.addEventListener`),
      `écouteur non gardé : #${ecouteur}`,
    );
  }
  assert.doesNotMatch(MAIN, /\$\("exporter"\)\.addEventListener/);
  assert.doesNotMatch(MAIN, /\$\("comparateur"\)\.addEventListener/);
});

test("la carte est déployée d'emblée sur la vue territoire", () => {
  // Repliée, il fallait la demander pour voir ce qu'aucune fiche ne montre :
  // la répartition dans l'espace. Le bouton reste, pour la refermer.
  assert.match(MAIN, /let carteOuverte = true;/);
  assert.match(PAGE, /id="carte-bascule"/);
});

test("la carte est à gauche, la fiche en barre latérale à droite", () => {
  // Empilées, la carte poussait la fiche sous la ligne de flottaison : on
  // ouvrait un territoire pour lire un texte qui commençait hors écran.
  const bloc = CSS.slice(CSS.indexOf('body[data-carte="oui"] .vue--territoire .atelier'));
  assert.match(bloc, /grid-template-columns: minmax\(30rem, 1fr\) minmax\(0, 1\.25fr\);/);
  // La carte est collante : la fiche est plus haute qu'elle, et une carte qui
  // sort de l'écran au troisième bloc ne sert plus à rien.
  assert.match(bloc, /body\[data-carte="oui"\] \.atelier__carte \{\n\s*position: sticky;/);
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

test("le site dit ce qu'il a corrigé et quand il a lu ses sources", () => {
  // Le pipeline publie `journal.json` et `fraicheur.json` à chaque exécution, et
  // les deux modules qui les rendent étaient écrits et testés sans être
  // appelés : le site savait dire ses corrections et ne les disait nulle part.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balises, /id="vue-methode"/);
  assert.match(balises, /id="methode-journal"/);
  assert.match(balises, /id="methode-fraicheur"/);
  assert.match(MAIN, /async function peindreMethode\(\)/);
  assert.match(MAIN, /afficherJournal\(/);
  assert.match(MAIN, /afficherFraicheur\(/);
  // Un fichier absent laisse la page debout : c'est la règle du site partout
  // ailleurs, elle vaut ici.
  const corps = MAIN.slice(MAIN.indexOf("async function peindreMethode"));
  assert.match(corps.slice(0, 900), /catch/);
});
