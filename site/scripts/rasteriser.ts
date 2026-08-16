/**
 * SVG → PNG : la rasterisation des cartes de partage, au build.
 *
 * Les cartes de lien des plateformes n'affichent pas le SVG : `og:image` doit
 * désigner une image matricielle, sous peine d'aperçu vide (décision D-L3-a du
 * plan du lot 3). `src/carte-og.ts` reste donc le module qui dessine, pur ;
 * ce fichier-ci n'est que la presse, appelée par `prerendre.ts` après le build.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE MODE D'ÉCHEC QUE CE MODULE EXISTE POUR EMPÊCHER
 * ─────────────────────────────────────────────────────────────────────────
 * resvg ne connaît **aucune police système** — il tourne en WebAssembly, sans
 * accès aux fontes de la machine. Un SVG rendu sans fonte fournie sort avec son
 * fond, ses traits, ses cadres, et **pas une lettre**. Le PNG a la bonne
 * taille, il n'est pas vide, et il est faux. Rien ne rougit.
 *
 * D'où la forme de l'interface : les fontes sont un **paramètre**, jamais une
 * constante interne que le module irait chercher tout seul. C'est ce qui rend
 * le mode d'échec testable — `rasteriser.test.ts` peint la même carte avec et
 * sans fontes, et constate sur les pixels que la seconde ne porte pas de texte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES OCTETS, PAS UN CHEMIN
 * ─────────────────────────────────────────────────────────────────────────
 * `lirePolices()` lit les fichiers de `scripts/polices/` — voir le README qui
 * s'y trouve pour la provenance et la licence de chacun. Ces fichiers ne sont
 * pas sous `public/`, qui est recopié tel quel dans `dist/` : les visiteurs
 * n'ont rien à télécharger de tout cela.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg, initWasm } from "@resvg/resvg-wasm";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const DOSSIER_POLICES = path.join(ICI, "polices");

/**
 * Le nom de famille sous lequel la fonte embarquée est branchée.
 *
 * `src/carte-og.ts` dessine avec `font-family="sans-serif"` — un nom générique,
 * volontairement, parce qu'un nom exotique écrit dans le SVG sortirait le texte
 * invisible si la fonte embarquée ne le portait pas. C'est donc ici que le
 * générique est résolu, et il l'est aux deux endroits : `sansSerifFamily` pour
 * le mot-clé du SVG, `defaultFontFamily` pour tout texte qui n'en déclarerait
 * aucune.
 */
export const FAMILLE = "Public Sans";

/** Les fichiers de fontes du dépôt, dans l'ordre de préférence : resvg cherche
 *  un glyphe manquant dans les suivants. */
const FICHIERS = ["PublicSans-Regular.ttf"];

/** Les octets des fontes du dépôt. */
export async function lirePolices(): Promise<Uint8Array[]> {
  return Promise.all(
    FICHIERS.map(async (nom) => new Uint8Array(await readFile(path.join(DOSSIER_POLICES, nom)))),
  );
}

/**
 * Le wasm de resvg, initialisé une seule fois par processus.
 *
 * `initWasm` jette si on l'appelle deux fois : la promesse est mémorisée, pas
 * seulement le résultat, pour que deux rasterisations lancées en parallèle
 * n'entrent pas ensemble dans l'initialisation.
 */
let wasm: Promise<void> | undefined;
function prete(): Promise<void> {
  wasm ??= (async () => {
    // `require.resolve` suit le champ `exports` du paquet : le chemin reste bon
    // quel que soit l'endroit où npm a hissé `@resvg/resvg-wasm`.
    const chemin = createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm");
    await initWasm(await readFile(chemin));
  })();
  return wasm;
}

/** Une image peinte, en RVBA, quatre octets par point, de gauche à droite puis
 *  de haut en bas — la forme dans laquelle un test peut regarder les pixels. */
export type Peinture = {
  largeur: number;
  hauteur: number;
  pixels: Uint8Array;
};

async function rendre(svg: string, fontes: readonly Uint8Array[]) {
  await prete();
  return new Resvg(svg, {
    font: {
      // `fontBuffers` veut un tableau modifiable ; la copie évite en plus qu'un
      // appelant garde une prise sur ce que le moteur lit.
      fontBuffers: [...fontes],
      defaultFontFamily: FAMILLE,
      sansSerifFamily: FAMILLE,
    },
  }).render();
}

/** Peint le SVG et rend ses pixels — ce que le contrôle du cadrage regarde. */
export async function peindre(svg: string, fontes: readonly Uint8Array[]): Promise<Peinture> {
  const image = await rendre(svg, fontes);
  // Les octets sont recopiés hors de la mémoire du wasm avant de la libérer :
  // ce que rend `pixels` la référence encore.
  const peinture = {
    largeur: image.width,
    hauteur: image.height,
    pixels: new Uint8Array(image.pixels),
  };
  image.free();
  return peinture;
}

/** Peint le SVG et rend les octets d'un PNG — ce que le build écrit. */
export async function rasteriser(svg: string, fontes: readonly Uint8Array[]): Promise<Uint8Array> {
  const image = await rendre(svg, fontes);
  const png = new Uint8Array(image.asPng());
  image.free();
  return png;
}
