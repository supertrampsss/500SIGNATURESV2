# Lot 3 — Partage : plan d'implémentation

Spec de référence : `docs/superpowers/specs/2026-08-14-arbitre-rejouable-design.md`, §13
(Partage), et §24 (roadmap, lot 3).

Ce lot rend partageable ce que les lots 1 et 2 ont rendu vérifiable. Une analyse et un
scénario existent ; rien ne permet encore de les montrer ailleurs sans une capture
d'écran floue. C'est le lot qui décide si le travail sort du site.

Base : `claude/french-budget-citizen-platform-zbu8mh` après fusion du lot 2.

---

## Trois décisions prises avant d'écrire, avec leur raison

Ces trois points auraient bloqué l'implémentation à mi-course. Ils sont tranchés ici.

### D-L3-a — les images sont matricielles, et produites au build

La spec §13 dit « construite par un module SVG pur, commun au build et à l'edge ». Le
module reste SVG ; ce qui est publié ne peut pas l'être. Les cartes de lien des grandes
plateformes n'affichent pas le SVG — `og:image` doit désigner une image matricielle. Un
SVG servi tel quel donne un aperçu vide, c'est-à-dire pire que pas d'image du tout.

La rasterisation se fait donc **au build**, sur l'ensemble fini des objets connus à ce
moment-là : chaque analyse, et une carte du site. `@resvg/resvg-wasm` (2.6.2, vérifié
présent au registre) fait le travail en WebAssembly — pas de binaire natif à compiler en
CI, et le même module tournerait à l'edge le jour où ce serait nécessaire.

**Piège à ne pas découvrir en production** : resvg ne connaît aucune police système. Un
texte rendu sans fonte embarquée sort **invisible**, et l'image part quand même. La
fonte doit être fournie au rasteriseur sous forme d'octets, depuis un fichier du dépôt,
sous une licence libre vérifiée — et un test doit constater que le texte est bien peint,
pas seulement que le PNG existe.

### D-L3-b — pas d'image par scénario ; la fonction edge produit des métadonnées

L'espace des scénarios est infini : un budget encodé est une URL parmi une infinité. Une
image par scénario suppose un rasteriseur et une fonte à l'edge, sur un chemin appelé
par les robots des plateformes.

Ce que la carte de lien montre réellement, c'est d'abord du **texte** : titre et
description. Ceux-là se calculent à l'edge pour un coût nul, en décodant le budget porté
par l'adresse avec le décodeur que le site utilise déjà — nom, effort, trois gestes les
plus lourds, exactement ce que la spec §13 demande de porter. `og:image` désigne alors la
carte du simulateur produite au build.

L'image par scénario reste possible plus tard ; elle n'est pas dans ce lot, et la
section « Ce que ce lot ne fait pas » le dit.

### D-L3-c — où vivent les fonctions edge

Vérifié : `wrangler pages functions build` cherche un répertoire `functions` **relatif au
répertoire courant**. Le déploiement lance aujourd'hui `npx wrangler pages deploy
site/dist` **depuis la racine du dépôt** : un `site/functions/` ne serait donc jamais
compilé, et la fonction partirait sans bruit, absente du site sans qu'aucune étape ne
rougisse.

Deux issues : poser `functions/` à la racine du dépôt, ou déplacer l'étape de
déploiement dans `site/` et publier `dist`. La seconde garde tout le site sous `site/`,
ce qui est la convention du dépôt. C'est celle à suivre — et la tâche 4 doit **le
constater sur une exécution réelle**, pas le déduire du fichier de workflow.

**Il n'y a pas de prévisualisation de branche sur ce projet**, et ce plan disait le
contraire. `deploy.yml` passe toujours `--branch=main` : Cloudflare sert les autres
branches sous `<branche>.<projet>.pages.dev`, un niveau de sous-domaine que son
certificat générique ne couvre pas, et le navigateur refuse alors la connexion. La
boucle de vérification est donc `wrangler pages dev`, qui compile et exécute les
fonctions en local sans rien déployer — et qui dit à voix haute lequel des deux cas on
est dans : « Compiled Worker successfully » depuis `site/`, « No Functions.
Shimming… » depuis la racine du dépôt.

---

## Global Constraints

- **Langue** : interface et documentation en français ; identifiants et messages de
  commit en anglais ; commentaires en français, expliquant *pourquoi*.
- **Unités** : montants en millions d'euros via `formater()` de `echelle.ts`. Décimales
  seulement sous 1 M€. **Les séparateurs sont des espaces fines insécables (U+202F)** :
  toute valeur attendue dans un test se produit en **appelant `formater`**, jamais en
  tapant la chaîne. Ce piège a coûté plusieurs fausses alertes aux lots précédents — si
  un montant paraît manquer, vérifier par **codes de caractères** dans un script Node,
  jamais à l'œil.
- **Une image partagée porte son unité.** « Santé 1 643 M€ » se lit « 1 643 milliards »
  par qui n'a pas le nez sur le sigle. Toute carte qui aligne des montants écrit
  « montants en millions d'euros ».
- **Une image partagée porte sa source et son millésime.** Une image sort du site : elle
  circule sans la page qui l'explique. Un chiffre sans source ni millésime n'y monte pas.
- **Un taux varie en points**, jamais en pourcentage.
- **Aucune réserve qui s'excuse**, dans une image comme sur une page.
- **Les budgets ne s'additionnent pas** : aucune carte n'écrit un total de dépense
  publique.
- **La comparaison ne juge pas** : une carte de comparaison montre deux colonnes et
  leurs écarts, jamais un gagnant, une note ou un classement.
- **Aucun script tiers, aucun widget de réseau social, aucune police distante.** Le
  règlement européen sur les données l'interdit déjà pour les polices ; la même règle
  vaut pour les boutons de partage.
- **Rien ne quitte le navigateur** : le partage passe par `navigator.share` ou le
  presse-papiers, jamais par un appel serveur.
- **Ne jamais inventer** une source, une citation, un auteur, une URL, un exercice —
  même en fixture.
- **Fichiers moteur intouchables** : `site/src/atelier.ts`, `site/src/simulateur.ts`,
  `site/src/simulateur-rendu.ts`.
- **Tests** : `cd site && npm test`, `npx tsc --noEmit`, `npx tsc -p
  tsconfig.scripts.json --noEmit` silencieux, `npm run build` réussi.
- **Commiter avant de saboter.** `git checkout -- <fichier>` restaure au dernier commit ;
  lancé sur un fichier non commité, il efface le travail. C'est arrivé deux fois au lot 2.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `site/src/carte-og.ts` | **Nouveau.** Le SVG d'une carte de partage, fonction pure `(donnees) → string`. Aucune E/S, aucun DOM. |
| `site/src/carte-og.test.ts` | **Nouveau.** Tests de chaînes sur le SVG rendu. |
| `site/src/partage.ts` | **Nouveau.** Les trois formats d'un objet partageable : image, résumé texte, permalien. Pur. |
| `site/src/partage.test.ts` | **Nouveau.** |
| `site/src/citer.ts` | **Nouveau.** La chaîne que copie « citer » : nombre, unité, source, millésime, permalien. Pur. |
| `site/src/citer.test.ts` | **Nouveau.** |
| `site/scripts/rasteriser.ts` | **Nouveau.** SVG → PNG par `@resvg/resvg-wasm`, fonte embarquée. |
| `site/scripts/prerendre.ts` | Modifié : écrit la carte de chaque analyse et la carte du site. |
| `site/functions/simulateur/_middleware.ts` | **Nouveau.** Métadonnées OG d'un scénario, calculées à l'edge. |
| `site/src/main.ts` | Modifié : boutons de partage, commandes « citer ». |
| `site/src/style.css` | Modifié : l'habillage des deux commandes. |
| `.github/workflows/deploy.yml` | Modifié : déploiement depuis `site/` pour que `functions/` soit compilé. |
| `site/public/polices/` | **Nouveau.** La fonte embarquée pour la rasterisation, avec sa licence. |

---

### Task 1: `carte-og.ts`, le SVG d'une carte

Une fonction pure par nature de carte, sur le modèle des autres modules de rendu du
site : elle reçoit des données déjà résolues et rend une chaîne. Aucune lecture de
fichier, aucun `document`.

La spec §13 donne les cinq natures : analyse (chiffre annoncé, chiffre des comptes, cran,
source), scénario (nom, effort, trois gestes les plus lourds), comparaison (deux colonnes,
trois écarts les plus lourds), fiche territoire (nom, trois chiffres, exercice), repères
(titre-affirmation, unité, source).

**Files:** créer `site/src/carte-og.ts` et `site/src/carte-og.test.ts`.

- [ ] **Step 1: La carte d'analyse d'abord, seule**

1200 × 630. Un titre qui affirme, au plus trois chiffres, la mention d'unité, la source
et le millésime, l'adresse du site. Les montants passent par `formater()`.

Écrire les tests avant : la carte porte l'unité ; elle porte la source et le millésime ;
elle n'écrit aucun total ; un titre long ne déborde pas du cadre (le texte se replie ou
se coupe, mais le SVG reste valide et les chiffres restent lisibles).

**Le débordement est le défaut le plus probable de ce module** : un SVG n'a pas de mise
en page automatique. Un titre de soixante caractères sort du cadre sans que rien ne
rougisse. Un test doit poser une chaîne longue et constater que ce qui est rendu tient.

- [ ] **Step 2: Les quatre autres natures**

Même forme, mêmes garanties. La carte de comparaison est celle à surveiller : deux
colonnes et leurs écarts, **jamais** une somme des deux, jamais une marque de tête.

- [ ] **Step 3: Commiter**

```
git commit -m "Draw the social card as a pure SVG function"
```

---

### Task 2: `rasteriser.ts`, et la fonte qui manque

**Files:** créer `site/scripts/rasteriser.ts`, ajouter la fonte sous
`site/public/polices/` avec sa licence.

- [ ] **Step 1: Installer et éprouver le rasteriseur**

`@resvg/resvg-wasm` en dépendance de développement. Écrire le plus petit script qui rend
un SVG portant du texte, et **regarder le PNG produit**.

**Ne pas se contenter de « le fichier existe »** : sans fonte fournie, resvg peint le
fond et laisse le texte invisible, et le PNG sort à la bonne taille, non vide, faux. La
vérification doit porter sur les pixels — par exemple que l'image contient plus d'une
couleur dans la zone du texte, ou que deux textes différents donnent deux images
différentes.

- [ ] **Step 2: Choisir la fonte**

Une fonte sous licence libre, vérifiée, dont le fichier de licence entre dans le dépôt à
côté d'elle. Vérifier que le glyphe « € » et les caractères accentués français y sont —
une fonte qui les remplace par des rectangles vides passerait tous les tests de taille.

Ne pas inventer une URL de téléchargement : si la fonte ne peut pas être obtenue de façon
vérifiable, le dire et s'arrêter là plutôt que d'écrire un chemin qui ne résout pas.

- [ ] **Step 3: Commiter**

```
git commit -m "Rasterise a card to PNG with an embedded font"
```

---

### Task 3: Les images des analyses, produites au build

**Files:** modifier `site/scripts/prerendre.ts`.

- [ ] **Step 1: Une image par analyse, plus la carte du site**

`dist/analyses/<slug>/carte.png`, écrite à partir de l'analyse **déjà contrôlée** —
même flux et même garantie que le pré-rendu HTML, le contrôle déterministe passe avant
(voir `deploy.yml`). Plus une carte du site, servant de repli à toute page sans image
propre.

- [ ] **Step 2: Les balises `og:` et `twitter:` du pré-rendu**

Chaque page d'analyse pré-rendue porte `og:title`, `og:description`, `og:image` (URL
**absolue** — une URL relative n'est pas résolue par tous les robots), `og:url`, et le
`twitter:card` en `summary_large_image`.

- [ ] **Step 3: Le build échoue si une image manque**

Sur le modèle de `validerLiensSimulateur`, déjà dans ce fichier : une page qui annonce
une image qui n'existe pas est un aperçu cassé. Le build doit rougir, pas publier.

- [ ] **Step 4: Vérifier sur l'artefact et commiter**

Constater dans `site/dist/` que les fichiers sont là et que les URL des balises sont
absolues.

```
git commit -m "Generate a card for every analysis at build time"
```

---

### Task 4: La fonction edge des métadonnées de scénario

**Files:** créer `site/functions/simulateur/_middleware.ts`, modifier
`.github/workflows/deploy.yml`.

- [ ] **Step 1: Déplacer le déploiement dans `site/`**

Vérifié : wrangler cherche `functions/` relativement au répertoire courant. Sans ce
déplacement, la fonction ne serait **jamais compilée** et partirait sans bruit. Changer
l'étape pour qu'elle s'exécute depuis `site/` et publie `dist`.

- [ ] **Step 2: Les métadonnées, calculées du budget porté par l'adresse**

La fonction décode le budget avec le décodeur du site — jamais une seconde
implémentation, qui divergerait — et compose titre et description : nom du scénario s'il
en porte un, effort, trois gestes les plus lourds. `og:image` désigne la carte du
simulateur produite au build.

Une adresse sans budget, ou dont le budget ne se décode pas, rend les métadonnées
génériques du site. Elle ne rend jamais une page d'erreur : un robot qui reçoit une
erreur n'affiche aucun aperçu.

- [ ] **Step 3: Le prouver sur une exécution, pas sur le fichier**

`wrangler pages dev dist`, depuis `site/` : il compile les fonctions et les exécute en
local. Y demander `/simulateur?budget=…` avec l'en-tête d'un robot et **lire les balises
servies**, puis la même adresse avec celui d'un navigateur et vérifier que la page
arrive entière — `/simulateur` est une route cliente servie par le repli SPA. Une
fonction edge qui n'est pas compilée se manifeste exactement comme une fonction qui rend
les métadonnées génériques : seule la requête réelle distingue les deux. Pas de
prévisualisation de branche pour le faire à distance, voir D-L3-c.

- [ ] **Step 4: Commiter**

```
git commit -m "Compute a shared scenario's link preview at the edge"
```

---

### Task 5: `partage.ts` et les boutons

**Files:** créer `site/src/partage.ts` et son test ; modifier `site/src/main.ts`,
`site/src/style.css`.

- [ ] **Step 1: Les trois formats, purs**

`partage.ts` rend, pour un objet donné : le permalien, le résumé texte (deux à trois
lignes, les chiffres, le lien), et l'adresse de son image. Aucun DOM.

La variante compacte à pictogrammes pour les scénarios, que la spec §13 décrit — elle
montre la forme de l'effort sans dévoiler le détail, ce qui donne une raison d'ouvrir le
lien.

- [ ] **Step 2: Le geste**

`navigator.share` quand il existe, presse-papiers sinon, plus un lien de téléchargement
de l'image. Aucun bouton de réseau social tiers.

**Les deux chemins doivent être éprouvés** : `navigator.share` n'existe pas sur la
plupart des navigateurs de bureau, et une promesse rejetée parce que le lecteur a annulé
le panneau de partage n'est pas une erreur — l'avaler proprement, sans message d'échec.

- [ ] **Step 3: Commiter**

```
git commit -m "Offer the three shapes of a shareable object"
```

---

### Task 6: « Citer »

**Files:** créer `site/src/citer.ts` et son test ; modifier `site/src/main.ts`,
`site/src/style.css`.

- [ ] **Step 1: La chaîne citée**

Nombre, unité, source, millésime, permalien. C'est la réponse à la capture d'écran floue :
ce qui est copié doit permettre de retrouver le chiffre sans le site.

- [ ] **Step 2: La commande, posée là où les quatre éléments existent**

Un écouteur délégué unique, sur le modèle de `brancherScenarios` : les rendus émettent un
attribut porteur des métadonnées, `main.ts` écoute au-dessus.

**La limite est nette et il faut la tenir** : un rendu qui ne connaît ni source ni
millésime ne peut pas produire une citation honnête. Il n'offre alors pas la commande —
plutôt que de copier un nombre nu, qui est exactement la capture d'écran floue sous une
autre forme. Écrire dans le rapport quels rendus l'offrent et lesquels ne le peuvent pas,
avec la raison.

- [ ] **Step 3: Commiter**

```
git commit -m "Copy a figure with its unit, source, vintage and permalink"
```

---

## Vérification du lot

```bash
cd site && npm test && npx tsc --noEmit && npx tsc -p tsconfig.scripts.json --noEmit && npm run build
cd pipeline && python -m pytest -q && ruff check plateforme/ tests/
cd /home/user/500SIGNATURESV2 && python -m plateforme.controle_analyses site/analyses
```

Attendu : aucun échec, build réussi, contrôle en sortie 0. Le lot ne touche pas au
pipeline : ses suites doivent rester exactement où le lot 2 les a laissées.

| Vérification | Attendu |
|---|---|
| `dist/analyses/<slug>/carte.png` existe pour chaque analyse | les images sont produites |
| Le PNG porte du texte visible, pas un cadre vide | la fonte est bien embarquée |
| Les `og:image` sont des URL absolues | les robots les résolvent |
| Le build rougit si une image annoncée manque | pas d'aperçu cassé publié |
| `/simulateur?budget=…` sur la prévisualisation sert des métadonnées propres au scénario | la fonction edge est réellement compilée |
| Une adresse sans budget sert les métadonnées du site | pas de page d'erreur pour un robot |
| Aucune carte n'écrit de total de dépense publique | les budgets ne s'additionnent pas |
| Aucune carte de comparaison ne désigne un gagnant | la comparaison ne juge pas |
| Aucune requête vers un hôte tiers, aucune police distante | rien ne quitte le navigateur |
| « Citer » copie nombre, unité, source, millésime, permalien | la citation se suffit |

---

## Ce que ce lot ne fait pas

- **Pas d'image par scénario** (D-L3-b) : la fonction edge produit des métadonnées, pas
  une image. L'espace des scénarios est infini ; rasteriser à l'edge suppose un
  rasteriseur et une fonte sur un chemin appelé par les robots. La carte de lien montre
  d'abord du texte, et ce texte-là est calculé.
- **Pas de « citer » sur tout nombre du site** : la commande n'est posée que là où la
  source et le millésime existent au moment du rendu. Étendre la couverture demande de
  faire descendre ces métadonnées jusqu'aux rendus qui ne les ont pas — c'est un travail
  de tuyauterie, pas de partage.
- **Pas de refonte de l'accueil, pas de levée du `noindex`, pas de sitemap** : c'est le
  lot 4.
