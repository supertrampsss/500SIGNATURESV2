# MANDATS — recette clavier du 21 octobre 2026

**Validation en cours : le mandat publié a révélé un défaut de focus au bilan. La correction n’est pas encore livrée.**

## Partie qui a révélé le défaut

La partie v17, graine 1, a été jouée intégralement à ×1 réel avec pauses sur main `28a41096`, à l’adresse immuable c5e54344. Aucun import, commande Avancer ou temps injecté. Un rechargement en première période, après deux ordres, a remis le compteur partiel à zéro sans modifier le journal ; les notes opérateur consignent environ 26 secondes actives supplémentaires.

Le [journal joué](partie-publiee-x1-main28.json) contient **30 périodes autonomes et 18 ordres**. Sa reconstruction indépendante valide les 49 préfixes, journal vide compris. Le bilan est de **2/4** : financement et gouvernement atteints ; services et retards manqués. Retards : 39,21, cible 29,39. Déficit : 135,17 Md€, plafond 153 ; référence autonome : 132,42. Appuis : 47,7. Démarches finit à 98,01/100 et 36,82 unités en attente. Ces chiffres appartiennent à la simulation ; une défaite n’est pas masquée par la recette.

À la fin automatique, le bilan porte `role=dialog` et `aria-modal=true`, mais le focus reste sur le rail Santé. Une vraie Tab le déplace vers Logement derrière la fenêtre. Preuves : [focus initial](focus-avant-main28.json), [focus après Tab](tab-avant-main28.json).

![Bilan publié avant correction](bilan-avant-main28.png)

Ces preuves concernent les fichiers `mandats-TSeUnPH4.js` / `mandats-HazkIm3P.css`, source `2d65550c` incluse dans main28. Elles ne valident pas le correctif ultérieur.

## Correction en cours de validation

Les reproductions avant correction établissent quatre problèmes : la restauration du secteur écrase le focus initial du bilan ; Réformes inclut des commandes masquées dans des dossiers fermés ; Tab ne récupère pas un focus déjà placé derrière la fenêtre ; Escape n’a pas de destination utilisable lorsque l’origine est le fond de carte ou un bouton devenu désactivé.

Le changement est limité au runtime de présidence et à ses tests navigateur. Le bilan doit conserver son titre focalisé, les fenêtres doivent confiner Tab/Shift+Tab aux commandes visibles et Escape doit retrouver une commande utilisable. Le repli de visibilité doit aussi fonctionner sans l’API récente `checkVisibility`.

Les règles, tirages, comptes, délais de jeu et formats de sauvegarde restent identiques. Les résultats après correction, empreintes et captures seront ajoutés seulement après leur vérification.

## Méthode et limites

Les tests automatisés utilisent des journaux légaux et une horloge contrôlée ; ils sont distingués des parties jouées au temps réel. Un effet de défilement provoqué par le ciblage sémantique CUA a été isolé par comparaison avec le pointeur et le vrai clavier ; aucun correctif applicatif de défilement n’est attribué à cet effet.

Cette recette cible transfert de focus, Tab/Shift+Tab et Escape, selon le [modèle de fenêtre modale W3C APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Elle ne certifie pas une conformité WCAG globale. Les parties sont jouées par un assistant familier du produit sur navigateur et formats émulés, sans étude de joueurs externes, NVDA/VoiceOver ni appareil physique.

## Recette ciblée au vrai clavier, après correction

Sur une origine locale neuve, le build `mandats-_ZrXR1o6.js` est contrôlé dans le DOM. Le journal de la partie réelle est importé par le menu normal avec seulement son dernier `live-tick` retiré : 29 périodes et 18 ordres. La dernière période s’écoule au temps réel ×1 après navigation par Tab jusqu’au rail Santé. Cette reprise ciblée n’est pas présentée comme un nouveau mandat complet.

À P30, [le titre du bilan conserve le focus](focus-apres-local.json). [Le vrai clavier](clavier-apres-local.json) parcourt Fermer → Exporter avec Shift+Tab → Fermer avec Tab ; Escape retrouve le rail Santé. L’export normal est strictement identique au journal complet d’origine : 30 périodes, 18 ordres, mêmes entrées. Après rechargement et reprise au clavier en format mobile, mêmes chiffres et même bilan 2/4 ; aucune erreur ni alerte console relevée.

![Bilan corrigé, bureau](bilan-apres-bureau.png)

![Bilan corrigé, mobile après reprise](bilan-apres-mobile.png)

Les captures proviennent du navigateur, sans retouche. Un clic de ciblage après émulation mobile n’activait pas Reprendre ; la reprise par le vrai clavier fonctionne. Aucun défaut applicatif ni patch de pointeur n’est attribué à cet effet. L’ancienne origine locale contenant une partie historique n’a reçu aucun import ; la recette utilise une origine neuve. La sauvegarde canonique du propriétaire reste intacte.

## Validation du build identifié

Source applicative : `a703d864412e89f07c2ce429557a590df6c25aee`. Le [manifeste du build](build-evidence.json) enregistre JS `mandats-_ZrXR1o6.js` et CSS `mandats-HazkIm3P.css` ; l’ancien manifeste source2d est conservé séparément.

- `npm run check` : sortie 0, **1 158 tests unitaires réussis, aucun échec**, types application/scripts/functions, build, pré-rendu et bundle hors connexion. Celui-ci contient 37 ressources, version `f3a6c91463ff3983`.
- **32/32 contrôles ciblés sans retry** : 24 cas clavier et API absente sur bureau 1672×941, compact 320×568 et WebKit 390×844 ; 4 reçus/lecture Cabinet existants ; 4 premières ouvertures v16 existantes.
- Revues indépendantes de conformité et de qualité : Approved après correction du finding Safari. L’appel natif n’est exécuté que si disponible ; le repli exclut commandes masquées, contenu de détails fermés et ancêtres masqués.
- Les rouges précèdent les corrections : focus automatique, détails fermés, récupération de focus et origines Escape inutilisables. Sans API, Réformes reproduit le rouge ; Escape v16 reproduit un TypeError sur un journal légal terminé à P27. Une première fixture v16 invalide échouait avant montage et n’est pas comptée comme preuve Escape.

Les logs détaillés locaux restent dans `.superpowers/sdd/modal-safari-*.log` et `site/vdef-artifacts/player-modal-check.log`. Le retrait de l’API sur les moteurs récents exerce le repli ; il ne constitue pas un essai de Safari 16 physique. La suite vDef, les contrôles distants et la publication restent à terminer à ce stade de recette.
