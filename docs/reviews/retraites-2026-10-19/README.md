# Mise à jour retraites — validation du 19 octobre 2026

## Périmètre livré

- Nouveau Dossier `/analyses/financement-retraites-publiques/`, graphiques de financement COR 2025 et crédits ministériels PLF 2027, sources et réserves en bas de lecture.
- Cinq dossiers existants précisés : Retraites, Défense exécutée, Défense Europe, Prélèvements et Dépense publique. Les séries historiques et leurs URL sont conservées.
- France et « 100 € » : vieillesse/minima/réversion, cotisations employeur effectives et imputées, absence de double comptage ; lien vers le financement.
- Ancien repère DREES daté explicitement ; repère COR récent présenté avec son champ dans le nouveau dossier, sans prolongement artificiel de la série DREES.
- Salaires : profil OCDE conservé, explication de la répartition collective précisée. Guide Mandats enrichi ; aucun paramètre, règle ou sauvegarde modifié.
- Aperçus sociaux, métadonnées, maillage, sitemap et prérendu régénérés par la chaîne de build existante.

## Sources et choix méthodologiques

Voir [le rapprochement et les empreintes des trois PDF archivés](../../retraites-rapprochement-2026-10-19.md). Les données éditoriales suivent le contrat JSON existant ; aucun normaliseur DuckDB n’a été ajouté pour transformer des instantanés de champs différents en une série annuelle.

La divergence Bercy 41,5/43,9 reste visible et exclue de tout indicateur unique. Le complément de ressources COR est calculé explicitement par différence. Les financements ne sont pas additionnés aux prestations. Aucun taux FPE n’est appliqué au profil OCDE ou à l’ensemble des fonctionnaires.

Le tableau 2.2 du COR est retenu explicitement : les 7,1 Md€ des opérateurs sont inclus en sous-rubrique dans les 277 Md€. La note 6 de la synthèse dit pourtant les opérateurs exclus ; cette divergence de champ est signalée au lecteur. Le premier rapprochement avait compté cette sous-rubrique comme un agrégat supplémentaire : cette erreur a été corrigée, puis chaque somme a été recomptée à partir des PDF par deux relectures distinctes. Les valeurs des graphiques sont restées inchangées.

## Contrôles reproductibles

Depuis `site/` :

```powershell
npm run check
npx playwright test --config playwright.mandats.config.ts retraites-public.test.mjs editorial-tabs.test.mjs analytics-consent.test.mjs
npm run test:mandats
```

Depuis `pipeline/` :

```powershell
python -m plateforme.controle_analyses ../site/analyses
```

Résultats locaux établis avant revue : 1 100 tests unitaires réussis, typage/build/prérendu complets réussis, 14 dossiers contrôlés sans erreur. La revue indépendante a vérifié les périmètres et les sommes ; ses répétitions mineures ont été corrigées.

Les tests navigateur ciblés produisent les captures et traces dans `site/test-results/` et le rapport dans `site/playwright-report-mandats/`. La CI exécute également la suite complète, les contrôles Python/base et l’audit visuel ; consulter leur résultat sur la PR avant fusion. Aucun échec n’est neutralisé par une option de CI.

## Inspection visuelle

Les douze captures `*-desktop.png` / `*-mobile.png` couvrent les pages entières France, nouveau dossier, Retraites, Défense, Salaires et index Dossiers. `observations.json` consigne leurs URL, titres visibles, hauteur et absence de débordement horizontal à 1440 × 1000 et 390 × 844. Les planches `*-inspection.png` découpent les longues pages pour permettre une lecture sans réduction excessive. France a été examinée jusqu’au pied de page avec le thème Retraites ouvert. Le refus de mesure d’audience a été choisi pour dégager les captures ; aucune acceptation n’a été injectée.

Les cinq projets navigateur comprennent également 320 px, iPhone WebKit et paysage. Les captures E2E emploient `scale: 'css'` pour éviter la limite WebKit de 32 767 pixels sur les pages longues à forte densité.

## Défauts rencontrés pendant les contrôles

- Aperçu du nouveau dossier sans millésime : ajout de la preuve du total COR 2025, source explicite ; les trois tests de cartes précédemment rouges passent.
- Date historique et ancien dossier vedette codés en dur dans un parcours éditorial : scénario adapté à la publication du 19 octobre, sans retirer les assertions sur le coût du travail.
- Sous Windows, le script de build du consentement comparait un chemin natif avec une expression en `/` et ajoutait le script aux pages exclues. Conversion par `fileURLToPath`, normalisation des séparateurs ; le test de consentement existant reproduisait le défaut avant correction. Les exclusions Mandats/Salaires/Simulateur sont conservées sur toutes les plateformes.
- La première tentative de suite complète locale a été arrêtée après les défauts ci-dessus et une saturation des navigateurs de jeu. Elle ne vaut pas validation complète ; les contrôles ciblés et la CI de la branche font foi.

## Publication et limites

La fusion et le déploiement doivent suivre les contrôles de la PR, sans contournement ; la vérification HTTP de la production est distincte du build. Les taux, conventions et exercices doivent être revus lors des prochaines publications officielles. La divergence du document Bercy demeure une limite documentaire, pas un chiffre manquant à inventer.
