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
