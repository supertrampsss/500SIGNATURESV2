/**
 * La presse à cartes, éprouvée sur les pixels — jamais sur l'existence du
 * fichier.
 *
 * Ce fichier existe pour un seul mode d'échec, et il est vicieux : resvg ne
 * connaît aucune police système. Sans fonte fournie, il peint le fond, les
 * traits, les cadres, et **pas une lettre** — le PNG sort à la bonne taille,
 * non vide, et faux. « Le fichier existe » ne prouve donc rien du tout ; il
 * faut regarder ce qui est peint.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ESPACE FINE INSÉCABLE, QUI EST DANS TOUS LES MONTANTS
 * ─────────────────────────────────────────────────────────────────────────
 * `formater()` sépare les groupes de chiffres par U+202F, et **aucune fonte du
 * dépôt ne porte ce caractère** (vérifié sur les huit `.woff2` de
 * `public/polices/` comme sur le TTF embarqué). Sur le site, ça passe : le
 * navigateur retombe glyphe par glyphe sur une fonte système. resvg n'a pas
 * cette chaîne de repli, et un caractère qu'il ne trouve pas sort en carré vide
 * — ce qui donnerait un carré entre chaque groupe de chiffres, dans tous les
 * montants de toutes les cartes, sans que rien ne rougisse.
 *
 * Ce qui sauve la mise n'est pas la fonte mais le façonneur : rustybuzz connaît
 * les espaces d'Unicode et fabrique l'avance manquante sans peindre de glyphe.
 * Le test 4 le vérifie sur les pixels, et le distingue des deux voisins avec
 * lesquels on pourrait le confondre : une espace ordinaire, plus large, et un
 * caractère réellement absent, qui lui sort bien en carré.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { HAUTEUR, LARGEUR, POLICE, carteAnalyse, type SourceCarte } from "../src/carte-og.ts";
import { formater } from "../src/echelle.ts";
import { lirePolices, peindre, rasteriser, type Peinture } from "./rasteriser.ts";

/** Lues une fois : chaque lecture recopie 85 ko, et il y a une dizaine de
 *  rendus ici. */
const FONTES = await lirePolices();

/** Une source d'essai — `.test` est un domaine réservé qui ne résout nulle
 *  part, et rien ici ne pourrait passer pour une source réelle du site. */
const SOURCE: SourceCarte = { titre: "Fichier d'essai", millesime: "2025" };

const CARTE = {
  titre: "Le coût annoncé de la mesure",
  dit: "cent milliards",
  observe: 1_234_000_000,
  cran: "hors_perimetre" as const,
  source: SOURCE,
  site: "exemple.test",
};

/* --------------------------------------------------------------------------
 * Regarder les pixels
 * ----------------------------------------------------------------------- */

/** Les colonnes qui portent de l'encre sombre, sur fond clair. */
function colonnes(peinture: Peinture): boolean[] {
  const portees = new Array<boolean>(peinture.largeur).fill(false);
  for (let y = 0; y < peinture.hauteur; y += 1) {
    for (let x = 0; x < peinture.largeur; x += 1) {
      if (peinture.pixels[(y * peinture.largeur + x) * 4] < 200) portees[x] = true;
    }
  }
  return portees;
}

/**
 * Le nombre de taches d'encre séparées, lues de gauche à droite.
 *
 * C'est la mesure qui distingue une espace d'un carré vide : une espace
 * n'ajoute aucune tache entre deux groupes de chiffres, un `.notdef` en ajoute
 * exactement une. Compter l'encre ne suffirait pas — un carré et un glyphe
 * peuvent peser pareil.
 */
function taches(peinture: Peinture): number {
  const portees = colonnes(peinture);
  let compte = 0;
  for (let x = 0; x < portees.length; x += 1) {
    if (portees[x] && !portees[x - 1]) compte += 1;
  }
  return compte;
}

/** L'abscisse de la dernière colonne encrée : la fin réelle du texte peint. */
function droite(peinture: Peinture): number {
  const portees = colonnes(peinture);
  for (let x = portees.length - 1; x >= 0; x -= 1) if (portees[x]) return x;
  return -1;
}

/**
 * Les couleurs distinctes de l'image.
 *
 * C'est la mesure qui sépare une carte peinte d'une carte muette, sans rien
 * savoir de sa mise en page : le dessin d'une carte n'est fait que d'aplats —
 * fond, filet, bandeau — et n'apporte donc qu'une poignée de couleurs, tandis
 * qu'un texte, lissé sur ses bords, en apporte des dizaines de nuances. Un
 * repère fondé sur une bande d'ordonnées, lui, mentirait le jour où la mise en
 * page bougerait d'un pixel.
 */
function couleurs(peinture: Peinture): Set<string> {
  const vues = new Set<string>();
  for (let i = 0; i < peinture.pixels.length; i += 4) {
    vues.add(peinture.pixels.slice(i, i + 4).join(","));
  }
  return vues;
}

/** Un SVG minimal d'une seule ligne, dessiné dans la même famille que les
 *  cartes : c'est le réglage de `carte-og.ts` qu'on éprouve, pas un autre. */
function ligne(contenu: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="200" viewBox="0 0 1000 200"><rect x="0" y="0" width="1000" height="200" fill="#ffffff"></rect><text x="20" y="140" font-family="${POLICE}" font-size="100" fill="#000000">${contenu}</text></svg>`;
}

/* --------------------------------------------------------------------------
 * Les tests
 * ----------------------------------------------------------------------- */

test("1. sans fonte fournie, la carte sort à la bonne taille et sans une lettre", async () => {
  const svg = carteAnalyse(CARTE);
  const sans = await peindre(svg, []);
  const avec = await peindre(svg, FONTES);

  // Le piège en entier : l'image sans fonte a la bonne taille et n'est pas
  // vide. Seules les couleurs disent laquelle des deux est fausse — trois
  // aplats observés sans fonte, quatre-vingt-quatre couleurs avec.
  assert.equal(sans.largeur, LARGEUR);
  assert.equal(sans.hauteur, HAUTEUR);
  assert.ok(
    couleurs(sans).size < 10,
    "sans fonte, la carte n'est que ses aplats : aucune lettre n'est peinte",
  );
  assert.ok(couleurs(avec).size > 30, "avec la fonte du dépôt, le texte est peint");
});

test("2. deux titres différents donnent deux images différentes", async () => {
  const a = await peindre(carteAnalyse(CARTE), FONTES);
  const b = await peindre(carteAnalyse({ ...CARTE, titre: "Un autre titre d'essai" }), FONTES);
  assert.notDeepEqual([...a.pixels], [...b.pixels]);
});

test("3. le PNG est un PNG, aux dimensions de la carte", async () => {
  const png = await rasteriser(carteAnalyse(CARTE), FONTES);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Le premier bloc d'un PNG est l'IHDR : largeur et hauteur y sont écrites sur
  // quatre octets chacune, à partir du seizième.
  const entete = new DataView(png.buffer, png.byteOffset, png.byteLength);
  assert.equal(entete.getUint32(16), LARGEUR);
  assert.equal(entete.getUint32(20), HAUTEUR);
});

/**
 * Le séparateur de groupes, **pris** dans la sortie de `formater` — jamais
 * tapé : au clavier il est indiscernable d'une espace ordinaire, et c'est la
 * faute qui a coûté plusieurs fausses alertes aux lots précédents.
 */
const FINE = formater(1_234_000_000, "EUR", false).match(/\d(\D)\d/)?.[1] ?? "";

/** Un caractère hors de la couverture latine de Public Sans : le témoin du
 *  carré vide. Cyrillique, U+0400. */
const ABSENT = "Ѐ";

test("4. l'espace fine des montants n'est ni un carré vide ni une espace ordinaire", async () => {
  // Vérifié par code de caractère, jamais à l'œil.
  assert.equal(FINE.codePointAt(0), 0x202f);

  const colle = await peindre(ligne("1234"), FONTES);
  const fine = await peindre(ligne(`1${FINE}234`), FONTES);
  const espace = await peindre(ligne("1 234"), FONTES);
  const absent = await peindre(ligne(`1${ABSENT}234`), FONTES);

  // Quatre chiffres, quatre taches : l'espace fine n'ajoute rien entre les
  // groupes. Le caractère absent, lui, en ajoute une — son carré vide.
  assert.equal(taches(colle), 4);
  assert.equal(taches(fine), 4, "l'espace fine ne peint pas de carré");
  assert.equal(taches(espace), 4);
  assert.equal(taches(absent), 5, "un caractère vraiment absent sort en carré");

  // Et elle avance : plus que rien, moins qu'une espace ordinaire. Sans cette
  // seconde borne, une espace fine avalée passerait le test des taches.
  assert.ok(droite(colle) < droite(fine), "l'espace fine écarte les groupes");
  assert.ok(droite(fine) < droite(espace), "elle est plus étroite qu'une espace");
});

test("5. les accents, les guillemets et le signe € sont peints, pas des carrés", async () => {
  // Le carré vide est le même pour tout caractère absent, au même endroit :
  // comparer les pixels à ce témoin suffit, et c'est plus sûr que compter les
  // taches — « … » en fait trois à lui seul.
  const carre = await peindre(ligne(ABSENT), FONTES);
  for (const caractere of "éàèçôûîœŒ«»’…€−%") {
    const peint = await peindre(ligne(caractere), FONTES);
    assert.ok(taches(peint) >= 1, `${caractere} n'est pas peint du tout`);
    assert.notDeepEqual([...peint.pixels], [...carre.pixels], `${caractere} sort en carré vide`);
  }
});
