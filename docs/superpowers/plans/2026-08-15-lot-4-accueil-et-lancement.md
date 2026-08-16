# Lot 4 — Accueil et lancement : plan d'implémentation

Spec de référence : `docs/superpowers/specs/2026-08-14-arbitre-rejouable-design.md`, §8
(Page d'accueil), §24 (roadmap, lot 4), et la décision D1.

C'est le lot qui ouvre le site. Les trois précédents ont rendu les chiffres vérifiables,
rejouables et partageables ; celui-ci décide qui les verra. Sa dernière tâche est la
seule du projet qu'on ne peut pas défaire : une page indexée reste dans les caches des
moteurs longtemps après qu'on l'a retirée.

Base : `claude/french-budget-citizen-platform-zbu8mh` après fusion du lot 3.

---

## Trois décisions prises avant d'écrire

### D-L4-a — la racine est libre, l'accueil ne déplace rien

Vérifié en exécutant `vueDepuisAdresse` : `/` rend **`null`**, et la carte vit à
`/territoire`. Le travail de routage du lot 0 a donc déjà laissé la place. L'accueil
occupe `/` sans qu'aucune vue existante ne bouge, et sans qu'un lien déjà partagé change
de destination.

Ne réintroduis pas de vue à la racine : `CHEMINS` décrit les vues qui ont un chemin, et
l'accueil n'est pas une vue de l'application monoécran — c'est une page.

### D-L4-b — on lance sur l'adresse qu'on a, et le domaine reste un paramètre

Le dépôt ne publie aucun nom de domaine. `SITE_URL` vaut `https://plateforme-9sz.pages.dev`,
et c'est l'adresse que le contrôle CORS rejoue à chaque déploiement — la seule qui soit
vérifiée par une exécution.

**Rattacher un domaine n'est pas une action de ce dépôt** : elle se fait dans la console
Cloudflare et chez un bureau d'enregistrement, avec un nom que personne n'a fourni. Ce lot
ne l'invente pas. Il prépare tout pour qu'un changement de `SITE_URL` suffise : canoniques,
`robots.txt`, plan de site et cartes de partage lisent cette valeur, jamais une constante
écrite en dur.

Écris dans le rapport la liste exacte de ce qu'il resterait à faire le jour où un domaine
existe. C'est un livrable.

### D-L4-c — la levée du `noindex` est la dernière tâche, et elle a des préalables

`site/index.html:7` porte `noindex, nofollow` depuis l'origine (décision D1, « projet non
annoncé »). C'est une seule ligne, donc une tâche qui paraît triviale — elle ne l'est pas :
c'est la seule du projet qui ne se rattrape pas.

Elle ne se fait qu'après que tout le reste du lot est en place et vérifié **sur le site
déployé**, pas en local.

---

## Global Constraints

- **Langue** : interface et documentation en français ; identifiants et messages de commit
  en anglais ; commentaires en français, expliquant *pourquoi*.
- **Montants en millions d'euros** via `formater()` de `echelle.ts`, décimales seulement
  sous 1 M€. **Séparateurs U+202F** : toute valeur attendue dans un test se produit en
  **appelant `formater`**, jamais en tapant la chaîne. Si un montant paraît manquer,
  vérifier par **codes de caractères** dans un script Node, jamais à l'œil — ce piège a
  produit plusieurs fausses alertes à chaque lot, y compris dans des sondes de
  vérification.
- **Dire l'unité là où le nombre est gros.** La mention « montants en millions d'euros »
  est posée **une fois**, en tête d'accueil (spec §8).
- **Aucun montant par habitant sur l'accueil** — le par-habitant ne s'affiche que dans les
  tableaux dépliés.
- **Un taux varie en points**, jamais en pourcentage, y compris les taux publiés pour mille
  et montrés en pourcentage. La règle est écrite, exportée et testée : `modeVariation()` et
  `formaterVariation()` dans `evolution-carte.ts`. **Déléguer, jamais recopier** — le lot 3
  a corrigé exactement cette faute une fois.
- **Aucune réserve qui s'excuse.** Ce qui change la lecture d'un chiffre se dit dans la
  légende, avec les chiffres, jamais en avertissement après eux.
- **Les budgets ne s'additionnent pas** ; **aucun score composite, aucun classement,
  aucun jugement moral**.
- **Ne jamais inventer** une source, une citation, un auteur, une URL, un domaine, un
  exercice — même en fixture. Toute URL écrite doit résoudre et désigner ce qu'elle
  prétend désigner.
- **Rien ne quitte le navigateur** : aucun script tiers, aucune police distante, aucun
  comptage, aucun widget social.
- **Toute page qui montre un territoire doit permettre d'en changer**, avec le champ de
  recherche du site, pas un autre.
- **Fichiers moteur intouchables** : `site/src/atelier.ts`, `site/src/simulateur.ts`,
  `site/src/simulateur-rendu.ts`.
- **Commiter avant de saboter.** `git checkout -- <fichier>` restaure au dernier commit ;
  sur un fichier non commité, il l'efface. C'est arrivé deux fois au lot 2.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `site/src/accueil.ts` | **Nouveau.** Les cinq blocs de l'accueil, fonction pure `(donnees) → string`. |
| `site/src/accueil.test.ts` | **Nouveau.** |
| `site/src/main.ts` | Modifié : montage de l'accueil à `/`. |
| `site/src/methode-rendu.ts` | Modifié : sources, méthode, grille de verdicts. |
| `site/scripts/prerendre.ts` | Modifié : pré-rendu de l'accueil, `robots.txt`, plan de site, canoniques. |
| `site/index.html` | Modifié **en dernier** : levée du `noindex`. |
| `site/src/style.css` | Modifié : l'habillage de l'accueil. |

---

### Task 1: `accueil.ts`, les cinq blocs

Fonction pure, sur le modèle de `analyse-rendu.ts` et `scenarios-rendu.ts` : elle reçoit
des données déjà résolues et rend une chaîne. Aucune E/S, aucun `document`.

Les cinq blocs, dans l'ordre de la spec §8 :

1. **Le verdict du moment** — la dernière analyse mise en avant, au format carte-verdict :
   chiffre annoncé, son auteur et sa date, chiffre des comptes, cran, source.
2. **Vérifiez par vous-même** — une porte vers le simulateur. Une phrase d'appel et les
   défis existants. **Pas de simulateur embarqué.**
3. **Et chez vous ?** — le champ de recherche de territoire **du site**, pas un autre, et
   trois chiffres d'un territoire tirés au sort à chaque chargement.
4. **Les analyses récentes** — quatre à six cartes, avec cran et date.
5. **La bande de confiance** — nombre d'indicateurs publiés, liste textuelle des
   producteurs (mentions sans logo, décision D9), lien vers `/methode`, lien vers le
   journal des corrections.

Le message principal, immédiatement suivi d'une preuve et jamais d'un développement :
« Les chiffres du débat budgétaire, recalculés sur les comptes publiés — et rejouables. »

Trois appels à l'action, dans l'ordre de l'entonnoir : *Lire le verdict*, *Rejouer le
calcul*, *Chercher ma commune*.

**Deux pièges à traiter, pas à découvrir :**

- **« Mise en avant » n'existe peut-être pas.** Vérifie le schéma d'analyse avant de le
  supposer. S'il ne porte pas ce champ, le repli honnête est la plus récente — et ajouter
  le champ est une modification de schéma que `controle_analyses.py` doit valider, donc
  une décision à écrire, pas à glisser.
- **Le tirage au sort du bloc 3 ne doit jamais montrer un territoire incomplet.** « Parmi
  les territoires dont les trois valeurs sont publiées » est la condition, et un
  territoire dont une valeur manque afficherait un trou à l'endroit le plus visible du
  site. Le tirage se teste : la fonction reçoit sa source d'aléa, elle ne l'appelle pas.

- [ ] **Commiter** : `git commit -m "Render the home page's five blocks"`

---

### Task 2: L'accueil à la racine

**Files:** `site/src/main.ts`, `site/src/style.css`.

`/` rend `null` dans `vueDepuisAdresse` (D-L4-a) : l'accueil s'y monte sans toucher à
`CHEMINS` ni déplacer la carte, qui reste à `/territoire`.

Le champ de recherche du bloc 3 est **celui du site**. Ne construis pas un second champ :
regarde comment `main.ts` branche déjà la recherche de territoire et réutilise-la. Deux
champs de recherche qui se comportent différemment sur la même donnée est un défaut que
ce projet a déjà nommé.

- [ ] **Commiter** : `git commit -m "Open the site on its home page"`

---

### Task 3: `/methode` complétée

**Files:** `site/src/methode-rendu.ts` et son test.

La page existe depuis le lot 0, où elle recueille le journal des corrections et l'état de
fraîcheur des sources. Ce lot y ajoute **les sources, la méthode, et la grille de
verdicts** — cette dernière écrite au lot 1 avec les analyses qu'elle sert.

C'est la page vers laquelle la bande de confiance renvoie : ce qu'elle promet doit s'y
trouver. Un lien de confiance qui ouvre une page incomplète coûte plus que pas de lien.

**Aucune réserve qui s'excuse** : la méthode dit ce que le site fait et comment il le
vérifie. Elle ne dit pas au lecteur de se méfier.

- [ ] **Commiter** : `git commit -m "Give /methode the sources, the method and the verdict scale"`

---

### Task 4: `robots.txt`, plan de site, canoniques

**Files:** `site/scripts/prerendre.ts`.

- `robots.txt` et le plan de site sont **produits au build**, à partir de `SITE_URL` et de
  la liste réelle des pages — jamais écrits à la main, où ils dériveraient à la première
  page ajoutée.
- Le plan de site ne liste que des adresses qui **répondent** : les chemins de vues et les
  analyses pré-rendues. Une adresse morte dans un plan de site est un signal de mauvaise
  qualité envoyé aux moteurs.
- Chaque page pré-rendue porte sa canonique, **la même chaîne que son `og:url`** — deux
  compositions différentes de la même adresse divergeront.
- Le build **rougit** si le plan de site annonce une page que le build n'écrit pas. C'est
  le motif de `validerImagesAnnoncees`, déjà dans ce fichier ; suis-le.

- [ ] **Commiter** : `git commit -m "Publish robots.txt and a sitemap the build can vouch for"`

---

### Task 5: La levée du `noindex`

**Files:** `site/index.html` (une ligne).

**Ne fais cette tâche qu'en dernier, et seulement après avoir vérifié sur le site
déployé** — `https://plateforme-9sz.pages.dev` — chacun de ces points :

- [ ] L'accueil répond à `/` et porte son message principal.
- [ ] `/methode` porte les sources, la méthode et la grille de verdicts.
- [ ] `robots.txt` et le plan de site sont servis, et **toutes** les adresses du plan
      répondent en 200.
- [ ] Chaque page pré-rendue porte une canonique absolue, identique à son `og:url`.
- [ ] Les cartes de partage sont servies et **portent leur unité, leur source et leur
      millésime** — regarde les images, ne te fie pas aux assertions.
- [ ] La fonction d'edge répond, et rend le générique du site sur un budget illisible,
      jamais une erreur.
- [ ] Aucune page ne sert un chiffre sans unité, sans source ou sans millésime.

Si un seul point manque, **arrête-toi et dis-le**. Une page indexée reste dans les caches
des moteurs longtemps après son retrait : c'est la seule tâche du projet qu'on ne peut pas
défaire.

Retire aussi le commentaire de `deploy.yml` qui annonce le `noindex`, sans quoi le fichier
décrira un état que le site n'a plus.

- [ ] **Commiter** : `git commit -m "Let the site be indexed"`

---

## Vérification du lot

```bash
cd site && npm test && npx tsc --noEmit && npx tsc -p tsconfig.scripts.json --noEmit \
  && npx tsc -p tsconfig.functions.json --noEmit && npm run build
cd pipeline && python -m pytest -q && ruff check plateforme/ tests/
cd /home/user/500SIGNATURESV2 && python -m plateforme.controle_analyses site/analyses
```

Attendu : aucun échec, build réussi, contrôle en sortie 0. Le lot ne touche pas au
pipeline : ses suites doivent rester exactement où le lot 3 les a laissées.

| Vérification | Attendu |
|---|---|
| `/` rend l'accueil, `/territoire` rend toujours la carte | l'accueil n'a rien déplacé |
| Le bloc « Et chez vous ? » utilise le champ de recherche du site | un seul comportement de recherche |
| Le tirage au sort ne montre jamais un territoire incomplet | pas de trou en tête de site |
| Aucun montant par habitant sur l'accueil | règle d'affichage tenue |
| La mention d'unité est posée une fois, en tête | dire l'unité là où le nombre est gros |
| `/methode` porte ce que la bande de confiance promet | le lien de confiance tient |
| Toutes les adresses du plan de site répondent 200 | rien de mort n'est annoncé |
| Canonique identique à `og:url`, page par page | une seule composition de l'adresse |
| Le `noindex` tombe en dernier, après vérification sur le site déployé | la seule tâche irréversible |

---

## Ce que ce lot ne fait pas

- **Il ne rattache aucun domaine** (D-L4-b) : cela se fait hors du dépôt, avec un nom que
  personne n'a fourni. Tout est préparé pour qu'un changement de `SITE_URL` suffise, et le
  rapport de la tâche 4 liste ce qu'il resterait à faire.
- **Il n'ouvre pas « citer » aux rendus qui n'ont pas de source.** Le lot 3 a établi qu'un
  seul rendu du site peut l'offrir, parce que `Jeu.producteur` n'existe que dans `main.ts`
  et ne descend pas jusqu'aux rendus. Faire descendre ces métadonnées est un travail de
  tuyauterie, pas de lancement.
- **Il ne condense pas les longues listes** — le pli « L'essentiel / Tout voir » les range
  sans les condenser, et c'est un chantier à part (voir `CLAUDE.md`, reste à faire n° 3).
