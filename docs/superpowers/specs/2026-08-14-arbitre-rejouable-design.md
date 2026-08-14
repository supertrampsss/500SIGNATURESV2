# L'arbitre rejouable — conception

**Date** : 14 août 2026
**Périmètre** : refonte du site public — page Analyse, scénarios, partage, accueil,
navigation, réparations. Le pipeline de données n'est modifié que pour ce que la
page Analyse exige.
**État** : conception validée section par section. Ce document sert de référence à
la rédaction du plan d'implémentation.

---

## 1. Contexte

Le projet publie depuis le 31 juillet 2026 une plateforme de données publiques
françaises : environ 276 indicateurs issus de 67 jeux officiels, à cinq mailles
(commune, arrondissement municipal, département, région, pays), un simulateur
budgétaire qui couvre le budget général de l'État jusqu'à la sous-action, les cinq
branches du régime général plus l'ONDAM, le barème de l'impôt sur le revenu et les
trois échelons de collectivités. L'entrepôt est un fichier DuckDB sur R2 (décision
D6quinquies du 4 août 2026) ; le site lit des fichiers JSON immuables versionnés
servis par le CDN, sans base ni backend.

Ce socle est solide et vérifiable. Il est aussi invisible : le site porte
`noindex, nofollow` depuis l'origine (décision D1, « projet non annoncé »), n'a
aucune balise de partage social, et son adresse reste `plateforme-9sz.pages.dev`.
Un simulateur exact que personne ne trouve et dont aucun résultat ne circule ne
produit aucun effet public.

Le propriétaire a décidé que la refonte décrite ici **est le lancement public** :
levée de l'indexation, rattachement du domaine `500signatures.fr`, et ajout des
trois briques qui manquent au produit — un étage éditorial, la comparaison de
scénarios, une mécanique de partage.

## 2. Problème

### 2.1 Ce que le marché ne fait pas

L'étude des acteurs français (14 août 2026) montre quatre familles qui ne se
recouvrent pas.

Les **simulateurs citoyens** sont interactifs et partageables mais invérifiables :
`francebudget.fr` projette le chômage de 2030 à partir de multiplicateurs du FMI et
d'une loi d'Okun, `simubudget.org` assume des « données simplifiées » et deux scores
inventés, `monbudgetpourlafrance.fr` affiche publiquement son propre plafond —
248 budgets élaborés, 29 partages.

Les **rigoureux** sont exacts et sans audience : LexImpact, maintenu par l'Assemblée
nationale, calcule des réformes du barème sur la population réelle mais s'adresse aux
parlementaires, ne couvre pas la dépense et n'a aucune mécanique de diffusion ;
Fipeco a l'autorité éditoriale sans outil.

Les **fact-checkeurs** ont les formats et l'audience mais ne savent pas calculer :
face à une annonce budgétaire, l'AFP, les Décodeurs, CheckNews et les Surligneurs
citent des rapports ; aucun ne peut dire « rejouez le calcul vous-même ».

L'**État s'est retiré** : `enavoirpourmesimpots.gouv.fr` ne résout plus,
NosDéputés.fr cherche un repreneur, le simulateur de l'Institut Montaigne porte une
méthodologie de 2016-2017.

Personne ne fait donc du **fact-checking budgétaire calculable, rejouable et
territorialisé**. Quand une mesure est annoncée, aucun acteur ne publie une analyse
qui soit à la fois chiffrée sur les lignes comptables réelles, déclinée à la maille,
rejouable d'un clic et partageable comme un objet autonome.

### 2.2 Ce que le public demande

Les enquêtes disponibles convergent. 72 % des Français se disent insatisfaits de
l'utilisation de l'argent public et le Conseil des prélèvements obligatoires
(baromètre 2025) en fait le déterminant principal du consentement à l'impôt : la
demande porte sur l'usage et le contrôle, pas sur le niveau. La confiance dans l'État
pour bien employer l'argent public tombe à 22 %. Les trois quarts des personnes
interrogées ne croient pas que la trajectoire de réduction annoncée sera tenue
(Odoxa, novembre 2025). La littératie de départ est basse : 15 % ne savent pas s'ils
paient la CSG.

Surtout, le débat de 2026 s'est déplacé. Il ne demande plus qu'on lui explique le
budget — l'État et une demi-douzaine de simulateurs le font — mais qu'on lui donne
de quoi **trancher un chiffre contesté** : la taxe Zucman rapporte-t-elle 20 milliards
ou 5 ? l'année blanche, c'est quoi et ça change quoi ? les 44 milliards d'économies,
pris où ? Aucun arbitre accessible n'existe, et la bataille se déplace faute de
mieux sur la crédibilité des personnes.

Un contre-signal doit être retenu : rien ne prouve que le partage d'un budget
personnel soit viral. Aucun scénario de simulateur français n'a jamais circulé, et le
seul compteur public disponible (29 partages) suggère l'inverse. La conception ne
mise donc pas sur l'auto-expression comme moteur principal.

### 2.3 Ce qui manque au produit

Sept manques mesurés dans le dépôt :

1. Aucune balise Open Graph, aucune image sociale, `noindex` global, pas de favicon,
   pas de `canonical`. Le seul partage est un bouton « Copier mon budget ».
2. Aucune comparaison de scénarios : un seul budget à la fois, ni nom, ni sauvegarde,
   ni duplication. `localStorage` ne sert qu'au thème.
3. Aucun étage éditorial. La vue `#decryptages` montre des blocs de données
   nationaux, la vue `#analyses` des tableaux exhaustifs par territoire ; rien
   n'analyse une mesure ou une annonce.
4. Un défaut bloquant probable au démarrage : `site/src/main.ts:1864` et
   `site/src/main.ts:1910` accrochent un écouteur sur `#exporter` et `#comparateur`,
   deux identifiants supprimés de `index.html`. Les gardes équivalentes existent
   partout ailleurs et sont testées ; ces deux-là ont été oubliées.
5. Sept modules hors service. Cinq n'ont aucun appelant en production —
   `croiser.ts`, `journal.ts`, `fraicheur.ts`, `euros-constants.ts`,
   `recapitulatif.ts` ; deux sont importés par `main.ts` mais leurs conteneurs ont
   disparu du document — `comparateur.ts`, `export.ts`. S'y ajoutent un conteneur
   `#palmares` jamais rempli, un mode « évolution » de la carte rendu
   inatteignable par l'interface bien que son calcul et ses tests subsistent, et
   `traductions.test.ts` vide.
6. Le simulateur ne couvre ni les comptes spéciaux, ni les budgets annexes, ni les
   ODAC ; `provenance.ts` se tait à la maille France.
7. Dette documentaire : `README.md` et `docs/00` à `docs/03` décrivent encore
   Supabase et PostGIS, abandonnés par D6quinquies.

Les manques 1 à 5 sont dans le périmètre de cette spécification. Le manque 6 est
explicitement exclu (section 4). Le manque 7 est traité à la marge : la spécification
ne réécrit pas les documents périmés mais ne s'y appuie pas non plus.

## 3. Objectifs

1. **Faire du site l'arbitre des chiffres du débat budgétaire français.** Publier des
   analyses qui opposent un chiffre annoncé au chiffre des comptes, avec un verdict
   factuel, une source primaire et un chemin de calcul vérifiable.
2. **Rendre chaque analyse rejouable.** Tout verdict s'ouvre dans le simulateur,
   préréglé sur la mesure, en un clic.
3. **Permettre la contradiction outillée.** Nommer, sauvegarder, dupliquer et
   comparer des scénarios côte à côte, en millions d'euros, sans compte ni backend.
4. **Rendre le travail transportable.** Chaque page expose un objet partageable en
   trois formats : une image autoportante, un résumé texte, un permalien.
5. **Rendre le site trouvable.** Vraies URL, pages indexables, sitemap, domaine
   public, indexation levée.
6. **Garantir l'exactitude par la machine.** Aucun chiffre publié dans une analyse ne
   peut diverger des données publiées : le contrôle est bloquant au déploiement, et
   rejoué à chaque publication de données.
7. **Réparer avant d'ajouter.** Corriger le défaut de démarrage et statuer sur chaque
   module mort.

## 4. Non-objectifs

Explicitement hors périmètre, avec la raison :

- **Comptes spéciaux, budgets annexes, ODAC, provenance au niveau France.** Chantier
  de données autonome, sans dépendance avec cette refonte ; il garde son propre
  cycle. Reste le reste-à-faire n° 1 et n° 2 du projet.
- **Comptes utilisateurs, backend, base applicative.** La décision D8 reste reportée.
  Tout l'état utilisateur vit dans le navigateur et dans l'URL.
- **Analyses écrites par des tiers, modération, votes, commentaires.** Exigeraient un
  backend et une chaîne de modération. La contribution externe passe par le
  signalement d'erreur et les issues du dépôt.
- **Vidéo, formats verticaux, TikTok, Instagram.** Les canaux retenus sont X, Reddit
  et les forums, la presse et les infolettres : texte et image.
- **Mode PLF (« faites mieux que Bercy ») et projection « quel budget êtes-vous ? ».**
  Reconnus comme les meilleures mécaniques de deuxième vague ; inscrits en roadmap
  (section 24), pas dans cette version.
- **Pré-rendu des 34 875 fiches communales.** Reporté : le sitemap et les analyses
  portent le référencement initial (section 24).
- **Refonte visuelle du système de design.** Les tokens, la typographie et les
  gabarits existants sont conservés ; seules les pages nouvelles sont dessinées, avec
  les composants en place.
- **Réécriture des documents périmés** (`README.md`, `docs/00` à `docs/03`).

## 5. Utilisateurs

Trois publics, en entonnoir. Chaque étage a sa porte d'entrée, son unité de valeur et
sa mesure.

**Le curieux.** Arrive par un lien partagé sur X ou un article de presse. Ne connaît
pas le vocabulaire budgétaire — il dit « où passent mes impôts », « le trou », « les
niches », pas « ventilation par mission » ni « dépense fiscale ». Il doit comprendre
en dix secondes ce que dit une analyse, sans faire défiler. Son unité de valeur :
l'étage express d'une analyse. Sa mesure : le trafic organique et référent sur
`/analyses/<slug>`.

**L'engagé.** Débat en ligne, cherche des munitions chiffrées, veut construire son
propre contre-budget. Descend dans le simulateur, règle, compare, partage son
scénario en réponse à un argument. Son unité de valeur : le scénario nommé et la vue
de comparaison. Sa mesure : le taux de passage d'une analyse au simulateur.

**Le relais.** Journaliste, enseignant, chercheur, créateur de contenu. Ne cite que ce
qu'il peut vérifier et attribuer. A besoin de la source primaire, du millésime, de
l'unité, d'un graphique exportable et d'une page de méthode. Son unité de valeur : le
chemin de calcul et le bouton « citer ». Sa mesure : le taux de partage et de reprise.

## 6. Parcours

Le parcours cible, câblé de bout en bout :

1. **Découverte.** Un chiffre circule ; le lecteur voit passer la carte-verdict sur X
   ou dans une infolettre, ou trouve l'analyse par une recherche.
2. **Compréhension.** Il ouvre `/analyses/<slug>` : deux nombres, un verdict, une
   source. Dix secondes suffisent ; les trois étages suivants attendent s'il veut
   plus.
3. **Vérification.** Il descend au chemin de calcul, ou il clique « Rejouer le
   calcul » : le simulateur s'ouvre préréglé sur la mesure, les lignes concernées
   dépliées.
4. **Contradiction.** Il n'est pas d'accord : « Créer mon alternative » duplique
   l'état en scénario modifiable ; il règle ce qu'il veut, sous les contraintes qu'il
   choisit de signer.
5. **Comparaison.** Il ouvre la vue de comparaison : son scénario, le chiffrage de
   l'analyse, le budget voté — trois colonnes, les écarts en millions d'euros.
6. **Partage.** Il partage l'un des trois objets : la carte-verdict de l'analyse, la
   vignette de son scénario, le tableau de comparaison en image. Le lien ramène à
   l'état exact.

Deux parcours secondaires, tout aussi câblés. Depuis un territoire : le lecteur
cherche sa commune, lit sa fiche, et voit les analyses qui concernent sa maille.
Depuis le simulateur : une ligne récemment analysée porte un renvoi vers l'analyse
correspondante — le mouvement inverse du parcours principal.

## 7. Architecture

### 7.1 Principe

Le site reste une application d'une seule page en TypeScript sans framework, avec des
fonctions de rendu pures qui produisent des chaînes HTML et sont testées comme telles.
Ce choix est conservé pour une raison vérifiée dans le dépôt : ces fonctions étant
pures, le pré-rendu au moment du build n'est qu'un appelant de plus. Aucun framework
n'est introduit.

Trois ajouts seulement : de vraies URL lues dans `location.pathname`, des pages HTML
générées après le build par un script Node, et des fonctions edge Cloudflare Pages
pour ce qui doit être calculé à la demande (les métadonnées sociales d'un scénario).

### 7.2 Routes

| Chemin | Contenu | Servi par |
|---|---|---|
| `/` | Accueil refondu | Page générée au build |
| `/territoire` (+ `?territoire=`) | Carte et fiche territoire | `index.html`, repli SPA |
| `/reperes` | Les blocs nationaux (ex-`#decryptages`) | Page générée au build |
| `/detail` | Tableaux exhaustifs d'un territoire (ex-`#analyses`) | Repli SPA |
| `/analyses/` | Index éditorial | Page générée au build |
| `/analyses/<slug>` | Une analyse | Page générée au build |
| `/simulateur` (+ `?budget=&contrat=`) | L'atelier | Page générée + fonction edge |
| `/simulateur/comparer` (+ `?face=`) | Comparaison de scénarios | Page générée + fonction edge |
| `/methode` | Sources, méthode, grille de verdicts, corrections | Page générée au build |

Un scénario partagé n'a pas de chemin propre : il est une URL de `/simulateur` portant
son état. Cette décision remplace le `/s/<code>` envisagé en conception — elle évite
un encodage supplémentaire et une table de correspondance, l'état étant déjà
sérialisé et déjà partageable.

**Renommages.** La vue actuelle `#analyses` (les tableaux d'un territoire) devient
`/detail` ; le nom « Analyses » est libéré pour l'éditorial. La vue `#decryptages`
devient `/reperes`. Le nom `donnees` reste interdit : son absence est verrouillée par
un test d'architecture existant.

**Compatibilité.** Toutes les ancres déjà partagées continuent de fonctionner :
au démarrage, si le chemin est `/` et que le fragment nomme une vue connue, le site
réécrit l'adresse vers le chemin réel sans rechargement. `#analyses?territoire=33063`
ouvre donc `/detail` et tient sa promesse — les tableaux du territoire. Les fragments
d'ancre interne (`#bloc-etat`) ne sont pas touchés.

**Repli.** Cloudflare Pages sert `index.html` pour tout chemin sans fichier tant
qu'aucun `404.html` n'existe. Cette absence devient une règle écrite et testée : un
`404.html` casserait tous les liens profonds.

### 7.3 Modules

Nouveaux modules de site, tous purs et testés à côté de leurs pairs dans `site/src/` :

| Module | Rôle |
|---|---|
| `routes.ts` | Table des routes, `vueDepuisAdresse(pathname, hash)`, `cheminDeVue(vue)`, alias |
| `analyse-rendu.ts` | Rendu d'une analyse et de l'index éditorial |
| `scenarios.ts` | Cycle de vie d'un scénario, dépôt de stockage injecté |
| `comparaison.ts` | Alignement de deux états de simulateur en lignes comparables |
| `scenarios-rendu.ts` | Barre de scénarios et tableau de comparaison |
| `carte-og.ts` | Construction du SVG d'une carte sociale |
| `partage.ts` | Résumé texte, résumé emoji, appel à `navigator.share` ou presse-papiers |

Nouveaux fichiers hors `src/` :

| Fichier | Rôle |
|---|---|
| `site/scripts/prerendre.ts` | Génère les pages, le sitemap et les images d'analyses après `vite build` |
| `site/functions/simulateur.ts` | Réécrit les métadonnées sociales d'un scénario partagé |
| `site/functions/og/scenario.ts` | Rend l'image sociale d'un scénario à la demande |
| `site/analyses/<slug>.json` | Les analyses, versionnées dans le dépôt |
| `pipeline/plateforme/controle_analyses.py` | Contrôle déterministe des analyses |

Modifications de l'existant, limitées et nommées : `main.ts` (lecture du chemin,
préservation du chemin à l'écriture de l'URL, `popstate`, compatibilité des ancres,
montage de la barre de scénarios, gardes manquantes), `index.html` (identifiants de
vues, conteneur de scénarios, suppression de la balise `robots`), `deploy.yml`
(contrôle des analyses, répertoire de travail de wrangler), `cron.yml`
(re-vérification après publication). `atelier.ts` et `simulateur.ts` ne sont pas
modifiés.

### 7.4 Flux de données

Deux flux distincts, qui ne se mélangent pas.

**Les chiffres** suivent le flux existant : sources officielles → connecteurs Python →
entrepôt DuckDB → `publish.py` → fichiers JSON immuables sur R2 → lus par le site à
l'exécution. Rien ne change.

**Les analyses** suivent un flux propre : rédaction dans `site/analyses/<slug>.json` →
contrôle déterministe contre les fichiers publiés → mise en page au build par
`prerendre.ts` → pages statiques dans `dist/` → déploiement Cloudflare Pages. Une
analyse n'entre jamais dans l'entrepôt : elle **référence** des observations
publiées, elle n'en crée pas.

Le point de jonction est le contrôle : il lit `data/derniere.json`, résout la version
courante, et vérifie chaque chiffre cité contre le fichier publié correspondant.

## 8. Page d'accueil

**Message principal.** Une phrase qui dit ce que fait le site : « Les chiffres du
débat budgétaire, recalculés sur les comptes publiés — et rejouables. » Immédiatement
suivie d'une preuve, jamais d'un développement.

**Blocs, dans l'ordre.**

1. **Le verdict du moment.** La dernière analyse marquée comme mise en avant, au
   format carte-verdict : le chiffre annoncé, son auteur et sa date, le chiffre des
   comptes, le cran de verdict, la source. Lien vers l'analyse.
2. **Vérifiez par vous-même.** Porte du simulateur : une phrase d'appel et les défis
   existants. Pas de simulateur embarqué — une porte.
3. **Et chez vous ?** Le champ de recherche de territoire du site, avec un exemple
   vivant : trois chiffres d'un territoire, tirés au sort à chaque chargement parmi
   les territoires dont les trois valeurs sont publiées.
4. **Les analyses récentes.** Quatre à six cartes, avec cran de verdict et date.
5. **La bande de confiance.** Nombre d'indicateurs publiés, liste textuelle des
   producteurs (mentions sans logo, décision D9), lien vers `/methode`, lien vers le
   journal des corrections.

**Cadrage.** La mention « montants en millions d'euros » est posée une fois, en tête
de page, conformément à la règle d'affichage du projet. Aucun montant par habitant
n'apparaît sur l'accueil.

**Appels à l'action.** Trois, dans l'ordre de l'entonnoir : *Lire le verdict*,
*Rejouer le calcul*, *Chercher ma commune*.

## 9. Page Analyse

### 9.1 L'index — `/analyses/`

Liste antichronologique de cartes-verdicts. Chaque carte porte le chiffre en cause, le
cran, la date de publication, et un marqueur si l'analyse a été mise à jour depuis sa
parution. Filtres : par type d'analyse, par thème, par budget concerné. La recherche
textuelle est permissive — mot à mot, sans exiger la contiguïté, comme le reste du
site.

### 9.2 Une analyse — `/analyses/<slug>`

Quatre étages, du plus rapide au plus profond. Le même gabarit pour toutes les
analyses, quel que soit leur type.

**Étage 1 — L'express.** Le chiffre annoncé, avec qui l'a dit, où et quand ; le
chiffre des comptes, avec son indicateur, sa période et sa source ; le verdict en
trois crans :

| Cran | Sens | Formulation à l'écran |
|---|---|---|
| `exact` | Le montant annoncé correspond au montant publié | « Le chiffre est celui des comptes » |
| `hors_perimetre` | Le montant existe mais désigne autre chose | « Le chiffre existe, mais pas pour ce qu'il désigne » |
| `introuvable` | Aucune ligne publiée ne porte ce montant | « Aucune ligne publiée ne porte ce montant » |

Le cran `hors_perimetre` **nomme toujours la confusion** : autorisations d'engagement
prises pour des crédits de paiement, brut pour net, voté pour exécuté, stock pour
flux, dépense de l'État pour dépense publique, une année pour un cumul. Cette
taxonomie est celle qui figure déjà dans les règles du projet ; elle devient la grille
publique de vérification.

Aucun cran ne porte de jugement. « Trompeur », « mensonger », « exagéré » n'existent
pas : ce sont des qualifications d'intention, invérifiables. Le site compare deux
nombres et nomme ce qui les sépare.

**Étage 2 — Le détail.** La phrase qui explique l'écart. Le tableau des exercices
publiés, un exercice par colonne. Les gagnants et les perdants quand la donnée le
permet : par tranche de revenu lorsque l'IRCOM le porte, par territoire lorsque les
fiches le portent, par branche lorsque le PLFSS le porte — jamais par déduction. Les
effets directs, calculés et attribués comme tels, sont distingués visuellement des
effets indirects, qui sont cités avec leur auteur et jamais calculés par le site : le
simulateur ne modélise pas le comportement et le dit.

**Étage 3 — L'interactif.** Deux commandes, câblées sur le simulateur existant :
« Rejouer le calcul » ouvre `/simulateur` avec l'état de l'analyse, les lignes
touchées dépliées ; « Créer mon alternative » ouvre le même état en scénario nommé et
modifiable. Quand l'analyse oppose deux chiffrages, une troisième commande ouvre
directement la vue de comparaison avec les deux colonnes.

**Étage 4 — La preuve.** Le chemin de calcul, cliquable de bout en bout : producteur →
jeu de données → millésime → indicateur → période → valeur → fichier publié. Les
hypothèses, listées une par une, chacune avec ce qui en dépend. Les incertitudes,
dites avec les chiffres et dans la légende du tableau — jamais en réserve qui
s'excuse, conformément à la règle absolue du projet : ce qui manque à un fichier se
dit avec les chiffres, pas après eux. Les contradictions entre sources, montrées
telles quelles, chacune attribuée et datée, sans être départagées lorsque les comptes
ne le permettent pas.

**Pied de page de l'analyse.** L'historique des mises à jour, chacune datée et
motivée. Le signalement d'erreur : un lien qui ouvre une issue GitHub pré-remplie avec
le slug et la version des données. Le partage : carte-verdict en image, résumé texte,
permalien.

### 9.3 Ce qui rend la page utile

Trois propriétés, chacune vérifiable :

- **Elle tranche.** Le lecteur repart avec un verdict, pas avec un dossier.
- **Elle se vérifie.** Tout chiffre affiché est relié au fichier public qui le porte.
- **Elle se conteste.** Le désaccord a un bouton, pas seulement un commentaire.

## 10. Simulateur

Le moteur n'est pas modifié : coefficients qui se composent, montant d'un nœud égal à
la somme de ses feuilles, bornage à ±100 points, contrats verrouillants appliqués
aussi à la saisie clavier, couplages entre budgets, ONDAM à écart séparé, aucun total
qui additionnerait des budgets qui ne s'additionnent pas.

**Trois portes d'entrée**, sans mode à choisir :

1. **Par un défi** — les défis existants, avec en tête celui qui correspond au montant
   en débat s'il y en a un.
2. **Par une analyse** — l'état est préréglé, les lignes concernées sont dépliées et
   signalées, le reste est replié.
3. **Par l'exploration libre** — l'atelier tel qu'il est aujourd'hui.

Il n'y a pas de bascule « simple / expert ». La progressivité est déjà dans l'arbre :
les raccourcis et les défis servent le premier niveau, le dépliement à la demande
jusqu'à la sous-action sert l'expert. Un seul simulateur, une seule vérité affichée.

**Le bilan de scénario** est le seul ajout à l'écran : trois chiffres (effort trouvé,
nombre de gestes, geste le plus lourd), une phrase de diagnostic factuel — « votre
scénario porte 80 % de l'effort sur trois missions » — et les équivalences existantes.
Ce bilan alimente la carte de partage et le résumé texte. Il ne porte aucune
appréciation.

**Renvoi vers les analyses.** Une ligne du simulateur citée par une analyse publiée
porte un lien discret vers elle. La correspondance est établie par le code de ligne
déclaré dans l'analyse ; elle est calculée au build, pas à l'exécution.

## 11. Scénarios

Un scénario est l'état encodé du simulateur, plus un nom, une date et le millésime des
données sur lequel il a été construit.

| Action | Comportement |
|---|---|
| **Créer** | Tout réglage en cours est un scénario implicite ; « Enregistrer » lui donne un nom |
| **Nommer, renommer** | Champ libre, 60 caractères, échappé au rendu |
| **Sauvegarder** | `localStorage`, liste « Mes scénarios » dans le simulateur |
| **Ouvrir** | Recharge l'atelier dans l'état exact |
| **Dupliquer** | Depuis la liste ou depuis un scénario reçu par lien ; c'est le geste « créer mon alternative » |
| **Supprimer** | Avec confirmation |
| **Comparer** | Section 12 |
| **Partager** | L'URL porte l'état ; le partage est la publication |
| **Transposer** | Un scénario construit sur un exercice révolu se rejoue sur l'exercice courant : les réglages étant des coefficients, ils se transposent ; les lignes disparues sont listées à l'écran, jamais perdues en silence |

Aucune donnée ne quitte le navigateur. Si `localStorage` est indisponible — navigation
privée — les scénarios vivent le temps de la session et l'interface le dit, sans
casser la page. C'est le comportement déjà retenu pour le thème.

## 12. Comparaison

**Vue `/simulateur/comparer`.** Deux à trois colonnes : A, B, et la référence — le
budget voté tel qu'il est publié. En tête : le nom de chaque scénario, son effort
total, son solde, les contrats qu'il a signés. En dessous : toutes les lignes réglées
dans au moins une colonne, avec pour chacune le réglage et l'écart en millions
d'euros, colonne par colonne. Les lignes sont triées par écart absolu décroissant.

**Comparables.** Trois natures : les scénarios de l'utilisateur ; un scénario reçu par
lien ; les **scénarios de référence** publiés par le pipeline — le budget voté, et les
chiffrages issus des analyses (« le chiffre annoncé par X, posé sur les lignes »).
Cette troisième nature est ce qui referme la boucle entre l'éditorial et l'outil.

**Partage d'une comparaison.** L'URL porte les deux états et leurs noms. La vignette
sociale montre les trois écarts les plus lourds.

**Ce que la comparaison ne fait pas.** Elle ne désigne pas de gagnant, ne note pas les
scénarios, n'additionne pas des budgets qui ne s'additionnent pas, et ne compare
jamais deux scénarios construits sur des exercices différents sans le dire.

## 13. Partage

**Trois formats, produits d'un même geste**, pour chaque objet partageable :

1. **L'image autoportante** — 1200 × 630, lisible hors contexte : un titre qui
   affirme, au plus trois chiffres, l'unité (« montants en millions d'euros »), la
   source et le millésime, l'adresse du site. Construite par un module SVG pur,
   commun au build et à l'edge.
2. **Le résumé texte** — collable dans un fil de discussion : deux à trois lignes, les
   chiffres, le lien. Une variante compacte avec pictogrammes est proposée pour les
   scénarios : elle montre la forme de l'effort sans dévoiler le détail, ce qui donne
   une raison d'ouvrir le lien.
3. **Le permalien** — l'URL complète, qui restitue l'état exact.

**Objet partageable par page :**

| Page | Objet | Ce que porte l'image |
|---|---|---|
| Analyse | La carte-verdict | Chiffre annoncé, chiffre des comptes, cran, source |
| Simulateur | Le scénario | Nom, effort, trois gestes les plus lourds |
| Comparaison | Le tableau | Deux colonnes, trois écarts les plus lourds |
| Fiche territoire | Les trois repères | Nom du territoire, trois chiffres, exercice |
| Repères | Le graphique | Titre-affirmation, unité, source |

**Mécanique.** `navigator.share` quand il existe, presse-papiers sinon, plus un lien
de téléchargement de l'image. Aucun bouton de réseau social tiers, aucun script
externe : la conformité au règlement européen sur les données interdit déjà les
polices distantes sur ce site, la même règle vaut pour les widgets.

**Citation.** Tout nombre affiché sur le site porte une commande « citer » qui copie
le nombre, son unité, sa source, son millésime et le permalien. C'est la réponse à la
capture d'écran floue.

## 14. Système éditorial

### 14.1 Types d'analyses

| Type | Question | Déclencheur |
|---|---|---|
| Vérification de chiffre | Ce montant existe-t-il dans les comptes ? | Un chiffre circule |
| Analyse de mesure | Que coûte ou rapporte cette mesure sur les lignes réelles ? | Une annonce, un article de loi de finances |
| Décryptage | Comment lire ce sujet ? | Un terme du débat mal compris |
| Comparaison | Deux chiffrages s'opposent : qu'est-ce qui les sépare ? | Une controverse |
| Analyse de promesse ou de programme | Ce programme est-il financé, ligne à ligne ? | Une campagne, un programme chiffré |
| Mise à jour | Le chiffre a changé : voilà ce qui a bougé | Nouvel exercice, révision, correction |

### 14.2 Régime des énoncés

Chaque affirmation d'une analyse appartient à un registre, déclaré dans le fichier et
distingué à l'écran :

1. **Fait comptable** — une observation publiée par le pipeline. Vérifié par la
   machine, bloquant.
2. **Donnée officielle citée** — publiée par un producteur mais absente de l'entrepôt.
   Lien vers la source primaire obligatoire ; jamais reformulée en fait comptable.
3. **Résultat de simulation** — produit par le moteur du site, accompagné des réglages
   qui le reproduisent.
4. **Estimation externe** — un chiffrage de tiers. Attribué, daté, avec ses hypothèses.
   Le site les confronte ; il ne les départage que lorsque les comptes le permettent.
5. **Hypothèse** — ce qu'il faut supposer pour que le calcul tienne.
6. **Interprétation** — la phrase de lecture, toujours dérivable des registres 1 à 5.
7. **Opinion** — n'existe pas. Aucune phrase ne qualifie une mesure de bonne ou de
   mauvaise, souhaitable ou non.

### 14.3 Production

La rédaction est assurée par l'IA, à partir de ce qui circule (déclarations, débats,
publications d'économistes, données officielles). La garantie d'exactitude n'est pas
la relecture : c'est le contrôle machine.

1. **Veille** — une session planifiée relève les chiffres qui circulent et ouvre une
   issue par sujet candidat, avec les liens sources.
2. **Rédaction** — l'analyse est écrite dans `site/analyses/<slug>.json`. Chaque
   chiffre porte sa référence : indicateur, maille, code, période, valeur attendue.
3. **Contrôle déterministe** — bloquant, décrit en 15.3.
4. **Publication** — par pull request. Le propriétaire garde un veto par le fait de
   fusionner ou non ; il n'est plus le garant de l'exactitude arithmétique.
5. **Vie de l'analyse** — après chaque publication de données, le contrôle est rejoué
   sur toutes les analyses en ligne. Une analyse invalidée par une révision ouvre une
   alerte et s'affiche marquée jusqu'à correction.

**Décision D11.** La validation humaine préalable exigée par la décision D7 pour les
connecteurs et la méthodologie est, pour les analyses éditoriales, remplacée par un
contrôle déterministe bloquant, complété d'un veto par fusion de pull request. Motif :
un relecteur humain ne peut pas vérifier à la main chaque montant cité contre les
fichiers publiés, alors qu'une machine le fait intégralement et à chaque publication
de données. D7 reste inchangée pour les connecteurs et la méthodologie.

### 14.4 Choix des sujets

Le critère est déclaré publiquement dans `/methode` : est analysé un chiffre qui
**circule largement** et qui **touche une ligne que le site publie**. Ni l'auteur du
chiffre, ni son orientation n'entrent dans le critère. La file des sujets est publique
(les issues du dépôt), ce qui rend le biais de sélection observable.

## 15. Données et sources

### 15.1 Ce que le site consomme

Rien ne change au flux existant : `data/derniere.json` donne la version, puis les
fichiers de cette version — catalogue d'indicateurs, couches de carte, fiches
territoire, index de recherche, comparaisons, budget de l'État, dépenses fiscales,
fichiers du simulateur, comptabilité nationale.

### 15.2 Ce qu'ajoute une analyse

Le fichier `site/analyses/<slug>.json` porte :

- l'identité : `slug` (égal au nom du fichier), `titre`, `type`, `publie_le`,
  `themes`, `budgets_concernes`, `mise_en_avant` ;
- l'affirmation : `texte`, `auteur`, `date`, `source` (`titre`, `url`, `consulte_le`) ;
- le verdict : `cran` parmi `exact`, `hors_perimetre`, `introuvable` ; `confusion`
  (obligatoire si `cran` vaut `hors_perimetre`, parmi une liste fermée : `ae_cp`,
  `brut_net`, `vote_execute`, `stock_flux`, `etat_apu`, `annuel_cumule`,
  `perimetre_geographique`) ; `phrase` ;
- les chiffres : pour chacun, `dit` (le montant tel qu'annoncé, avec son unité
  d'origine), `observe` (`indicateur`, `niveau`, `code`, `periode`, `valeur`),
  `registre`, `lecture` ;
- les hypothèses, les effets indirects cités, les sources, les liens de simulateur
  (`budget`, `contrat`, `lecture`), les lignes de simulateur concernées, l'historique
  `mises_a_jour`, et `verifie_contre` — la version des données sur laquelle le
  contrôle a réussi.

Le fichier stocke la valeur publiée brute ; l'affichage la convertit en millions
d'euros avec deux décimales sous le million, comme partout ailleurs sur le site.

### 15.3 Le contrôle déterministe

`pipeline/plateforme/controle_analyses.py`, exécutable en ligne de commande, refuse la
publication si l'une des conditions suivantes n'est pas remplie :

1. **Schéma** — champs obligatoires présents, `slug` égal au nom de fichier, dates
   valides, `cran` dans la liste fermée, `confusion` présente si le cran l'exige,
   `registre` déclaré pour chaque énoncé chiffré.
2. **Exactitude** — chaque `observe` correspond à une valeur réellement publiée dans
   la version courante, à l'unité près, sans tolérance. Une analyse recopie ce qui est
   publié ; elle n'arrondit ni ne recalcule.
3. **Cohérence de catalogue** — l'indicateur existe, il est publié à la maille
   invoquée, et l'unité affichée est celle du catalogue, pas celle de l'analyse.
4. **Absence de chiffre non référencé** — tout nombre supérieur ou égal à 1 000
   présent dans le titre, la phrase de verdict ou une lecture doit correspondre à l'un
   des chiffres référencés, ou être un millésime. Un montant qui apparaît dans la
   prose sans être adossé à une observation fait échouer le contrôle. C'est la garde
   contre l'invention.
5. **Sources** — toute donnée de registre 2 ou 4 porte une URL et une date de
   consultation.
6. **Liens de simulateur** — vérifiés au build par le script de pré-rendu, avec le
   décodeur réel du simulateur : un lien qui n'ouvre aucun réglage est une erreur.

Le contrôle s'exécute à deux moments : avant chaque déploiement du site, et après
chaque publication de données. Dans le premier cas il bloque le déploiement ; dans le
second il ouvre une alerte, via le mécanisme d'alerte existant.

### 15.4 Scénarios de référence

Le pipeline publie un fichier de scénarios de référence : le budget voté (état neutre,
tous réglages à zéro), et un scénario par chiffrage d'analyse déclaré comme
comparable. Ces scénarios sont produits à partir des analyses contrôlées, jamais
saisis à la main.

## 16. Gestion des erreurs

Le principe du site est conservé : un élément absent n'affiche rien plutôt qu'une
erreur, et n'empêche jamais le reste de s'afficher.

| Situation | Comportement |
|---|---|
| Fichier de données absent ou illisible | Le bloc concerné ne s'affiche pas ; le reste de la page tient |
| Chemin inconnu | L'application affiche la vue territoire, sans page d'erreur dédiée |
| Analyse inexistante | L'index des analyses s'affiche avec un message « cette analyse n'existe pas ou a été retirée » |
| État de simulateur illisible dans l'URL | L'atelier s'ouvre à l'état neutre, avec un message qui le dit |
| Ligne de scénario disparue d'un nouvel exercice | Listée explicitement à la transposition |
| `localStorage` indisponible | Scénarios en mémoire de session, mention à l'écran |
| Image sociale non générée | Repli sur les métadonnées textuelles, qui portent déjà les trois chiffres |
| Analyse invalidée par une révision de données | Marquée à l'écran, alerte ouverte, jamais supprimée en silence |
| Défaut au démarrage | Les deux gardes manquantes sont posées ; tout accès à un élément optionnel du document est gardé, et un test d'architecture le vérifie |

## 17. Accessibilité

Le niveau atteint est conservé et étendu aux pages nouvelles : lien d'évitement,
combobox de recherche complète au clavier, rôles et états ARIA, contraste AA calculé
par les tests, cibles tactiles de 44 pixels vérifiées, respect de
`prefers-reduced-motion`, thème appliqué avant le premier rendu.

Trois exigences propres à cette version :

1. **Le focus survit aux repeintures.** Le simulateur repeint des blocs entiers et
   perd le focus clavier ; les nouvelles surfaces (barre de scénarios, tableau de
   comparaison) restaurent le focus sur l'élément équivalent après repeinture.
2. **Les verdicts ne reposent pas sur la couleur.** Le cran est porté par le texte ;
   la couleur ne fait que redoubler.
3. **Les pages générées sont lisibles sans JavaScript.** Une analyse pré-rendue
   s'affiche entièrement sans exécution de script — c'est ce qui la rend accessible
   aux lecteurs d'écran les plus anciens autant qu'aux robots.

## 18. Responsive

Trois points de rupture, tous en `rem`, comme aujourd'hui. Les surfaces nouvelles
suivent la même grille :

- L'analyse est une colonne unique à toutes les largeurs, largeur de lecture bornée.
- Le tableau de comparaison passe, sous 60 rem, d'un tableau à colonnes à une lecture
  par ligne : chaque poste porte ses deux valeurs empilées et étiquetées.
- La barre de scénarios se replie en un bouton sous 40 rem.
- Aucune surface nouvelle ne provoque de défilement horizontal du corps de page ; les
  tableaux larges défilent dans leur propre conteneur.

## 19. Performance

| Contrainte | Valeur | Vérification |
|---|---|---|
| Une analyse pré-rendue est lisible sans exécuter de script | Toujours | Chargement avec script désactivé |
| Poids d'une page d'analyse, HTML seul | ≤ 100 ko | Mesure au build |
| Aucune requête réseau supplémentaire pour lire l'étage 1 | 0 | Le contenu est dans le HTML |
| Métadonnées sociales d'un scénario, en edge | ≤ 50 ms | Mesure sur la fonction |
| Image sociale d'un scénario, après premier rendu | Servie depuis le cache | En-tête de cache immuable |
| Chargement du catalogue de scénarios | Local, aucune requête | Par construction |
| Le simulateur ne recharge pas ses arbres au changement de scénario | Réutilise les volets déjà chargés | Test |

Le pré-rendu ne change pas le poids des ressources partagées : les fichiers d'actifs
sont ceux du build, avec leurs empreintes, communs à toutes les pages.

## 20. Analytics

**Contrainte.** Le site a retiré les polices distantes pour ne pas transférer l'adresse
IP de ses lecteurs hors d'Europe. La mesure d'audience suit la même règle : sans
cookie, sans identifiant persistant, hébergée en Europe, exemptée de consentement au
sens des recommandations de la CNIL. Aucun script tiers de réseau social.

**Ce qui est mesuré** — un indicateur par étage de l'entonnoir, plus les compléments
utiles :

| Étage | Indicateur | Définition |
|---|---|---|
| Découverte | Visites sur `/analyses/<slug>` | Par analyse, par source (recherche, référent, direct) |
| Compréhension | Profondeur de lecture | Part des visites atteignant l'étage 2, puis l'étage 4 |
| Passage | Taux de passage au simulateur | Part des visites d'analyse qui ouvrent « Rejouer » ou « Créer mon alternative » |
| Engagement | Scénarios enregistrés et comparaisons ouvertes | Événements anonymes, sans contenu de scénario |
| Diffusion | Taux de partage | Part des visites déclenchant une commande de partage ou de citation |

**Ce qui n'est jamais collecté** : le contenu d'un scénario, les termes de recherche
de territoire, aucune donnée permettant de reconstituer un parcours individuel.

## 21. Tests

Le dépôt teste des fonctions pures et des chaînes, avec le lanceur natif de Node d'un
côté et pytest de l'autre. Cette version prolonge le même mécanisme.

**Tests de modules purs, côté site** — un fichier par module nouveau :
`routes.test.ts` (résolution de chemin, alias, compatibilité des anciennes ancres),
`analyse-rendu.test.ts` (les quatre étages, les trois crans, l'obligation de nommer la
confusion, l'échappement des textes d'origine externe), `scenarios.test.ts` (cycle de
vie complet avec un dépôt en mémoire, dépôt indisponible, transposition d'exercice),
`comparaison.test.ts` (alignement de deux états, colonne de référence, tri par écart,
refus de comparer deux exercices différents sans le dire), `carte-og.test.ts` (au plus
trois chiffres, unité présente, source présente, texte échappé),
`partage.test.ts` (résumé texte, variante compacte, permalien).

**Tests d'architecture** — le mécanisme existant, qui lit les fichiers en texte, est
étendu : le chemin est lu avant le fragment, l'écriture de l'URL préserve le chemin,
aucun `404.html` n'existe, la balise `robots` d'exclusion est absente, un lien
canonique est présent sur chaque page générée, tout accès à un élément optionnel du
document est gardé.

**Tests du pipeline** — `test_controle_analyses.py`, avec des fixtures : une analyse
juste, une dont un montant diverge de la valeur publiée, une dont la prose contient un
montant non référencé, une au cran `hors_perimetre` sans confusion nommée, une dont
l'indicateur n'est pas publié à la maille invoquée, une dont le lien de simulateur ne
décode rien.

**Test de bout en bout du build** — le script de pré-rendu produit les pages attendues,
le sitemap contient exactement les pages publiques, chaque page d'analyse contient son
verdict et ses métadonnées sociales.

**Non-régression** — les 40 fichiers de test existants passent. Les tests
d'architecture modifiés au lot de routage sont **resserrés, jamais élargis** : chaque
assertion modifiée doit continuer à verrouiller une décision.

## 22. Risques

| Risque | Portée | Traitement |
|---|---|---|
| Accusation de parti pris | Politique | Crans factuels sans jugement, critère de sélection déclaré dans `/methode`, file des sujets publique, chiffrages opposés montrés sans être départagés quand les comptes ne tranchent pas |
| Analyse fausse publiée | Réputation | Contrôle bloquant au déploiement ; garde anti-invention sur la prose ; aucune publication possible sans correspondance exacte avec les fichiers publiés |
| Analyse qui pourrit après révision des données | Données | Contrôle rejoué après chaque publication, alerte, marquage à l'écran, historique obligatoire |
| Rédaction IA hors du régime des énoncés | Éditorial | Registre obligatoire par énoncé ; contrôle de schéma bloquant ; interdiction structurelle du registre « opinion » |
| Régression au changement de routage | Technique | Le lot de routage est isolé et livré seul ; les tests d'architecture sont la spécification ; compatibilité des anciennes ancres testée |
| Plafond de calcul de la fonction edge | Technique | Cache immuable par scénario ; repli sur métadonnées textuelles qui portent déjà les trois chiffres ; passage à un plan payant seulement sur mesure |
| Indexation d'un site encore imparfait | Produit | La levée de l'indexation est le dernier lot, après que tout le reste est vérifié |
| Contenu externe injecté dans une analyse | Sécurité | Tout texte d'origine externe (citation, nom d'auteur, nom de scénario) est échappé au rendu, avec test dédié |
| Dépendance à l'actualité pour alimenter la page | Produit | Les décryptages de fond, indépendants de l'actualité, constituent un stock ; l'index reste utile même sans analyse récente |

## 23. Critères d'acceptation

Chaque critère est vérifiable, par un test automatisé ou par une manipulation décrite.

**Réparations**
1. Le démarrage ne lève aucune exception lorsque des éléments optionnels sont absents
   du document ; un test d'architecture vérifie que chaque accès est gardé.
2. Chaque module hors service reçoit le sort déclaré au tableau du lot 0 : les six
   rebranchés sont atteignables depuis l'interface, les deux retirés ont disparu avec
   leurs tests, le conteneur `#palmares` n'existe plus, et `traductions.test.ts`
   n'est plus vide.

**Routage**
3. `/analyses/<slug>`, `/simulateur`, `/reperes`, `/detail`, `/methode` et `/`
   répondent en accès direct, sans passer par la page d'accueil.
4. Une URL à fragment déjà partagée ouvre la vue correspondante et réécrit l'adresse
   vers le chemin réel, sans rechargement ni perte de paramètres.
5. La navigation avant/arrière du navigateur restitue la vue attendue.

**Page Analyse**
6. Une analyse s'affiche entièrement sans exécution de script.
7. Le verdict affiché appartient aux trois crans ; un cran `hors_perimetre` sans
   confusion nommée fait échouer le contrôle.
8. Chaque chiffre affiché porte son indicateur, sa période, son unité et un lien vers
   le fichier public qui le porte.
9. Le bouton « Rejouer le calcul » ouvre le simulateur dans l'état déclaré par
   l'analyse ; un lien qui ne décode aucun réglage fait échouer le build.

**Contrôle éditorial**
10. Une analyse dont un montant diverge de la valeur publiée fait échouer le
    déploiement.
11. Une analyse dont la prose contient un montant supérieur ou égal à 1 000 non
    référencé fait échouer le déploiement.
12. Après une publication de données qui invalide une analyse en ligne, une alerte est
    ouverte et l'analyse est marquée à l'écran.

**Scénarios et comparaison**
13. Un scénario nommé, enregistré, rouvert restitue l'état exact.
14. Un scénario reçu par lien peut être dupliqué et modifié sans altérer l'original.
15. Deux scénarios se comparent ligne à ligne, écarts en millions d'euros, avec la
    colonne de référence ; les lignes sont triées par écart absolu décroissant.
16. Un scénario construit sur un exercice révolu se transpose sur l'exercice courant,
    et les lignes disparues sont listées à l'écran.
17. `localStorage` indisponible ne casse aucune page.

**Partage et référencement**
18. Un lien de scénario partagé produit une vignette portant son nom, son effort et
    ses trois gestes les plus lourds.
19. Chaque page publique porte un titre, une description, un lien canonique et des
    métadonnées sociales propres.
20. Le sitemap contient exactement les pages publiques et est référencé par
    `robots.txt`.
21. La balise d'exclusion des robots est absente, et un test en verrouille l'absence.
22. Toute commande « citer » copie le nombre, son unité, sa source, son millésime et
    le permalien.

**Global**
23. L'ensemble des tests existants passe, augmenté des tests nouveaux.
24. Aucune surface nouvelle ne provoque de défilement horizontal du corps de page à
    320 pixels de large.
25. Tout montant calculé ou publié par le site est affiché en millions d'euros ;
    le par-habitant n'apparaît que dans les tableaux dépliés. Seule exception, et
    elle est nécessaire : le montant tel qu'il a été annoncé est cité dans son
    unité d'origine, entre guillemets et attribué — c'est l'objet même de la
    vérification. Le chiffre des comptes qui lui est opposé est, lui, toujours en
    millions d'euros.

## 24. Roadmap

**Lot 0 — Réparations et routage.** Gardes manquantes, sort des modules hors service,
module de routes, chemins réels, compatibilité des anciennes ancres, renommages,
mise à jour des tests d'architecture.

Le sort de chaque module hors service est tranché ici, module par module :

| Module ou élément | Décision | Motif |
|---|---|---|
| `journal.ts` | Rebrancher sur `/methode` | Le journal public des corrections est un élément de confiance exigé par la section 8 ; le pipeline publie déjà le fichier |
| `fraicheur.ts` | Rebrancher sur `/methode` | Même raison : l'état de fraîcheur des sources est publié et n'était plus affiché |
| `recapitulatif.ts` | Rebrancher à l'atelier | Décrit comme livré dans les règles du projet mais jamais branché ; c'est le seul endroit qui a le droit de sommer les trois budgets |
| `comparateur.ts` | Rebrancher sur `/detail` | La comparaison de territoires est utile et n'a été perdue que par la disparition de son conteneur |
| `export.ts` | Rebrancher sur `/detail` et les tableaux d'analyse | L'export tabulaire sert directement le public « relais » |
| Mode « évolution » de la carte | Rendre au paramètre `?mode=evolution` son effet, sans réintroduire de bouton | Le bouton a été retiré délibérément, avec sa raison écrite dans le code : deux mots sans phrase pour deux façons de peindre la même série, et la carte peignait la moitié du temps une grandeur que le lecteur croyait être l'autre. Cette décision tient. Mais le paramètre est toujours lu et écrit dans l'adresse alors qu'une ligne le neutralise ensuite : un lien partagé promet une couche qu'il n'ouvre pas. Retirer cette ligne rend le calcul, le rendu et leurs dix-sept tests atteignables par qui les demande explicitement, sans rien proposer à qui ne les demande pas |
| `croiser.ts` | Retirer, avec son test | Un nuage de points et un coefficient de corrélation exposent le site à présenter une corrélation comme une causalité, ce que la charte interdit |
| `euros-constants.ts` | Retirer, avec son test | Introduit une seconde unité à côté du million d'euros courants, que les règles d'affichage n'admettent pas. À rétablir si une décision explicite d'unité est prise |
| Conteneur `#palmares` | Retirer | Présent et stylé, jamais rempli |
| `traductions.test.ts` | Écrire les tests manquants | Le module est utilisé en production ; son fichier de test est vide |

**Lot 1 — Page Analyse.** Schéma d'analyse, module de rendu, script de pré-rendu,
contrôle déterministe, branchement au déploiement et au cron, première analyse réelle.

**Lot 2 — Scénarios et comparaison.** Modules de scénarios, de comparaison et de
rendu ; barre de scénarios ; vue de comparaison ; scénarios de référence publiés par le
pipeline. Parallélisable avec le lot 1.

**Lot 3 — Partage.** Module de carte sociale, images d'analyses générées au build,
fonction edge de métadonnées, image de scénario à la demande, commandes de partage et
de citation.

**Lot 4 — Accueil et lancement.** Accueil refondu, levée de l'indexation,
`robots.txt`, sitemap, rattachement du domaine. La page `/methode` existe depuis le
lot 0, où elle recueille le journal des corrections et l'état de fraîcheur des
sources ; ce lot y ajoute les sources, la méthode et la grille de verdicts, cette
dernière étant écrite au lot 1 avec les analyses qu'elle sert.

**Après cette version, dans l'ordre de valeur estimée :**

1. Mode « projet de loi de finances » : le texte en débat préchargé comme scénario de
   référence, publié le jour de sa présentation.
2. Pré-rendu des fiches de département, de région et de France, puis des communes si
   le trafic le justifie.
3. Projection « votre scénario face aux programmes chiffrés ».
4. Reçu fiscal personnel : le montant d'impôt sur le revenu calculé par le barème
   exact, ventilé sur les missions, avec son dénominateur affiché.
5. Rendez-vous annuel par territoire à la publication des comptes locaux.
6. Comptes spéciaux, budgets annexes et ODAC au simulateur ; provenance au niveau
   France.

## 25. Décisions prises

| # | Décision | Motif |
|---|---|---|
| 1 | Positionnement « arbitre rejouable » : fact-checking budgétaire calculable | Seul créneau vide du marché français, et le seul qui exploite l'actif non copiable du projet |
| 2 | Verdicts en trois crans factuels, jamais moraux | Un cran d'intention est invérifiable et déplace le débat vers le juge |
| 3 | Le cran « hors périmètre » nomme toujours la confusion | La taxonomie du projet devient la grille publique de vérification |
| 4 | Analyses rédigées par l'IA, exactitude garantie par contrôle machine | Un relecteur humain ne peut pas vérifier chaque montant à chaque publication de données |
| 5 | D11 : le contrôle déterministe et le veto par fusion remplacent la relecture préalable de D7 pour les analyses | D7 reste en vigueur pour les connecteurs et la méthodologie |
| 6 | Analyses stockées en JSON versionné dans le dépôt, pas dans l'entrepôt | Une analyse est du contenu couplé au site, pas une donnée ; le diff est la revue |
| 7 | Garde anti-invention : tout montant de la prose doit être référencé | La rédaction automatique impose une garde automatique |
| 8 | Scénarios en stockage local et URL, sans compte ni backend | D8 reste reportée ; aucune donnée personnelle, aucune modération |
| 9 | Un scénario partagé est une URL de `/simulateur`, sans chemin dédié | L'état est déjà sérialisé ; un code court exigerait une table de correspondance |
| 10 | Vanilla TypeScript conservé, pré-rendu ajouté | Les fonctions de rendu sont déjà pures ; un framework serait une réécriture sans gain |
| 11 | Aucun `404.html` | Cloudflare Pages sert alors l'application pour tout chemin profond |
| 12 | La vue « Analyses » devient `/detail`, « Décryptages » devient `/reperes` | Libère le nom pour l'éditorial sans casser les liens partagés |
| 13 | Mesure d'audience sans cookie, hébergée en Europe, sans script tiers | Même règle que celle qui a fait retirer les polices distantes |
| 14 | Analyses communautaires exclues de cette version | Exigeraient backend et modération |
| 15 | Comptes spéciaux, ODAC et provenance France exclus | Chantier de données autonome, sans dépendance avec cette refonte |
| 16 | Levée de l'indexation en dernier lot | Le site s'ouvre quand il est vérifié, pas avant |
| 17 | Image sociale dynamique avec repli textuel | On ne paie un plan supérieur que sur mesure, pas sur hypothèse |
| 18 | La comparaison ne désigne aucun gagnant et n'additionne pas les budgets | Règle de neutralité et règle comptable du projet |
