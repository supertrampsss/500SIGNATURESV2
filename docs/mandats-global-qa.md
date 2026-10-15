# Passe globale du 15 octobre 2026

Point de départ : version publiée `b36015e`, Mandats national v13.
Les parcours ci-dessous recherchent de nouveaux défauts, au-delà des contrôles
de la première livraison de la pression. Les fichiers de preuve se trouvent dans
`site/pressure-artifacts/global-qa/`.

## Défauts reproduits avant correction

### Comparaison inaccessible depuis Ma partie

Seed 0, v13, une vraie décision (`pol-wealth-hospital-package`), puis Ma partie,
Comparer une autre stratégie. L'ancien atelier affiche trente listes ne contenant
que « Choisir un arbitrage » : aucune alternative n'est sélectionnable. Les règles
narratives attendent une sélection de dossier que cet ancien atelier ne fait pas.
La sauvegarde reste intacte. Preuves : `planner-before.json` et
`planner-before.png`.

Échec à prévenir : ouvrir la comparaison doit proposer les décisions effectivement
prises ; consulter cette sélection ne doit ni avancer le mandat ni changer la
sauvegarde. Reprendre avant une décision doit donner des choix jouables, conserver
l'origine et permettre de la retrouver. Le parcours couvre ordinateur, 390 px,
320 px et WebKit. Avant toute décision, aucun faux atelier vide ne doit être offert.

La contre-revue du nouveau point d'entrée vérifie aussi son bouton de retour :
une partie en cours doit revenir au mandat. Réutiliser sans condition le retour
à l'héritage du parcours terminé produirait une fausse « fin de mandat » au tour 1.
Le retour et le libellé dépendent donc de la fin réelle enregistrée par le moteur.

### Crises actives qui disparaissent

Les parcours légaux conservés dans `ignored-crises.json` montrent qu'un port
bloqué ou une cyberattaque peut sortir de l'agenda à l'expiration d'une proposition
sans perturbation associée dans les stocks. Les conséquences et leur résolution
doivent être vérifiées indépendamment des fluctuations normales des six fronts.
Une occasion facultative qui expire reste distincte d'une crise active.

Le contrôle d'intégration doit aussi vérifier la lecture de cet incident dans
l'interface : un port réellement bloqué ne doit pas apparaître comme un projet
bleu. Après une vraie décision d'attente, la carte et l'agenda doivent signaler
son caractère urgent sans faire avancer le temps lors de leur consultation.

## Limites connues à réévaluer

- Efficacité des secours temporaires au regard de leur coût et du temps consommé.
- Réparation et abandon d'un projet réellement bloqué.
- Lisibilité de plusieurs alertes sur petit écran et en paysage.
- L'illustration approuvée contient un raster utile de 1268 × 801 pixels ; son
  enveloppe SVG ne constitue pas une source photographique Full HD.

Les hypothèses d'équilibrage ne sont pas des mesures observées sur la France.
Cette passe est bornée et ne prétend pas couvrir toutes les suites de décisions.

## Versions et sauvegardes

Les nouvelles règles démarrent en v14. Le changement d'agenda des incidents ne
doit pas rendre illégaux les choix d'une sauvegarde publiée en v13. Un lot de
25 trajectoires v13 conserve les entrées et le SHA-256 de tout leur état recalculé.
Ces empreintes sont vérifiées contre le moteur extrait du commit publié
`b36015efd51d569642421fc3b5a941d1df1a0674`, puis contre le moteur modifié.
Le lot contient 24 parcours de trois seeds et huit stratégies, plus la vraie
rupture politique à la décision 21. Les priorités ne sont pas comptées comme
des parcours physiques indépendants. La vérification dédiée reste dans la CI.

## Lecture publique et navigation

Le lien « Données vérifiées · Une méthode transparente » de l'accueil mène à
`/sources/#methode`, mais aucune cible `methode` n'existe dans le HTML publié ni
dans le document hydraté de la version `b36015e`. Le clic laisse la page Sources
en haut (`scrollY = 0`), loin de son titre « La méthode ». Reproduction du
15 octobre à 20 h 33 UTC : `/workspace/mandats-global-public/followup.json` et
`sources-after-method-link.png`. Le parcours E2E est ajouté avant le correctif :
depuis le vrai lien d'accueil, le titre de méthode doit être lisible dans
la fenêtre et le défilement doit avoir rejoint cette partie de la page. Une
tolérance inférieure au pixel couvre l'arrondi natif du défilement d'ancre.

L'audit HTTP public couvre 35 pages canoniques et leurs 35 redirections `www` :
aucune erreur de statut, de canonique, de robots, de sitemap ou de guide `llms.txt`.
Les lectures avec navigateur couvrent accueil, France, Dossiers, un dossier,
une réponse, le guide Mandats et le jeu à 320, 390 et 1440 pixels. Les contrôles
portent sur les erreurs JavaScript, ressources absentes, débordements,
chargements publicitaires sans consentement, filtres et navigation. Les éléments
SPA cachés et les contrôles volontairement réservés au mobile sont exclus des
faux positifs. Les preuves de cette exploration restent dans
`/workspace/mandats-global-public/`.

Après ajout de la cible au titre existant, le parcours E2E passe sur Chromium
320, 390 et 1440 pixels, ainsi que WebKit 390 et 844 pixels : 5 parcours réussis.
Les captures après correction ont été inspectées ; la méthode est lisible,
sans en-tête superposé. Les 35 tests existants du rendu de méthode passent.
Rapport, coordonnées, captures et traces avant/après :
`/workspace/mandats-global-public/method-before/` et `method-after/`.
Les ancres de fiches de sources depuis France ouvrent aussi le bon accordéon
et placent la fiche au focus, sur Chromium et WebKit. Aucun autre défaut public
n'a été confirmé dans ce périmètre.

## Carte et navigation mobile

Trois défauts d’interface ont été reproduits dans la version publiée ou avec
les mêmes contrôles sur un parcours légal. Chaque régression E2E a été écrite,
puis observée en échec, avant son correctif. Les entrées et traces restent dans
`/workspace/mandats-global-ui/` et les captures de régression dans les rapports
rework.

- **Cartouche urgent qui intercepte un sujet.** National v13, seed 0,
  ambition équilibre, 29 décisions de négligence, 320 × 740 pixels : le cartouche
  Santé/Rennes recouvre le centre du bouton Enseignement/Lyon. Le clic est
  intercepté et le sujet ne s’ouvre pas. `repro-overlap.json` et
  `urgent-before.log` conservent le défaut. Les boutons sont maintenant placés
  avant les cartouches dupliqués ; les cartouches utilisent les espaces libres
  et restent absents lorsqu’aucune place n’existe. Le titre complet et le nom
  accessible du sujet restent dans l’agenda et sur son bouton.
- **Statut d’import qui bloque la navigation.** Après un import valide,
  « Partie importée et recalculée. » recouvre Gouvernement, Projets et Bilan
  sur téléphone. Le paragraphe persistant reçoit les clics ; huit parcours de
  l’exploration ont rencontré ce problème. `notice-before.log` contient l’échec
  E2E. Une deuxième assertion rouge sur ordinateur confirme que le texte masque
  également le libellé Pays (`notice-desktop-before.log`). Le statut devient non
  interactif et se place au-dessus de la navigation sur ordinateur et mobile,
  en tenant compte de la zone de sécurité du téléphone. Les messages
  restent visibles et annoncés sans expiration forcée.
- **Deux projets superposés sur une carte chargée.** National v13, seed 0,
  ambition services, 18 décisions, trois sujets et deux projets en préparation :
  ouvrir Enseignement et déplier la carte à 320 pixels masque le suivi
  Écoles/Paris derrière Logements/Bordeaux. Son clic est intercepté.
  `dense-5.json`, `dense-before.log` et `dense-before-results/` conservent les
  entrées et l’échec. Le placement cherche maintenant aussi les bords exacts
  des autres boutons et commandes lorsqu’un décalage régulier ne trouve pas
  de place. Les deux projets restent séparés et consultables dans ce parcours.

Les nouveaux parcours de `site/tests/mandats-rework.test.mjs` contrôlent les clics
réels sans forçage, les changements de sujet, les projets et les menus, tout en
conservant le nombre de décisions. Une exploration supplémentaire a suivi les
cinq repères en 320 et 390 pixels, puis en WebKit paysage 844 × 390 pixels,
avec zoom et clavier. Dix doubles clics successifs sur de vraies décisions
n’ont enregistré qu’une décision chacun (`rapid-browser.json`).

Les rectangles transparents de certains boutons peuvent encore se croiser dans
la carte réduite de 164 pixels lorsqu’elle porte cinq repères ; dans le parcours
inspecté, les libellés restent lisibles et les cinq centres cliquables. Cette
observation ne constitue pas une preuve que toute composition dense est parfaite.
Les longues légendes dupliquées et le niveau de détail de l’illustration source
restent des sujets d’amélioration visuelle distincts des blocages corrigés.

## Bilan et prochaines améliorations

La correction v14 relie explicitement deux incidents écrits à leur perte de
capacité. La fuite du dossier `eau-equipes` reste un candidat à relier de la même
manière : le secteur eau/énergie possède son stock général, mais pas encore une
perturbation propre à cette fuite. Les autres extensions du catalogue ne sont
pas déclarées livrées.

La restauration cyber lève sa perte de capacité et garde le gain permanent de
son programme. La cohérence de ce gain avec le texte de restauration doit être
recalibrée par des parties humaines. Une négociation politique rejetée peut
encore être reproposée plusieurs fois sans nouveau compromis ; les stocks du
pays avancent, mais la variété de ce dialogue reste à améliorer. Aucun
coefficient n'a été modifié pour masquer ces limites.

Les preuves distinguent les 24 parcours d'équilibrage **v13** conservés en
diagnostic de départ, et l'audit **v14** sous `global-model/`. Le second contrôle
seul permet de décrire la nouvelle règle. Les parcours navigateur vérifient les
interactions réelles, y compris le mandat de trente décisions et le rejeu.
Les suites complètes et les résultats de publication appartiennent aux rapports
de CI et de déploiement du commit livré.

Depuis `site/`, après le build :

```sh
node --experimental-strip-types scripts/mandats-legacy-pressure-audit.ts
MANDATS_PRESSURE_SEEDS=4 MANDATS_PRESSURE_BRANCH_SEEDS=1 MANDATS_PRESSURE_OUTPUT=pressure-artifacts/global-model node --experimental-strip-types scripts/mandats-pressure-audit.ts
node --experimental-strip-types scripts/mandats-pressure-review.ts pressure-artifacts/global-model
npx playwright test --config playwright.pressure.config.ts
npx playwright test --config playwright.incidents.config.ts
npx playwright test --config playwright.social.config.ts
npx playwright test --config playwright.rework.config.ts
```
