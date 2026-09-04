# Mandats : implementation plan

**Goal:** Livrer deux campagnes courtes et complètes dans le dépôt existant, avec un moteur comptable séparé de l'interface et des conséquences différées vérifiables.

**Architecture:** Nouvelle entrée Vite `/mandats/`, indépendante du contrôleur historique. Moteur pur partagé, adaptateurs municipal et national distincts. Préserver le pipeline et les routes de données. Les scénarios sont explicitement fictifs. Aucun code de lieflat-charts, sous licence non commerciale, n'est repris.

**Tech Stack:** TypeScript, HTML sémantique, CSS, SVG pour cartes et graphiques fonctionnels, Node test, Vite et Cloudflare Pages existants. Pas de nouvelle dépendance de production.

## Contraintes globales

- Mobile jouable en portrait à partir de 320 px ; commandes de 44 px minimum ; aucune information accessible uniquement au survol.
- Municipal six tours, national cinq tours. Un clic sur une décision l'applique et ouvre son résultat. Reprise locale automatique.
- Aucune donnée de scénario présentée comme observation réelle. Pas de prédiction électorale.
- Zéro publicité et zéro publication X automatique. Pas de collecte de choix politiques.
- Sauvegardes et défis versionnés, validation stricte et recalcul depuis le journal des décisions.
- Les instructions de construction du brief autorisent l'exécution après cadrage sans nouvelle validation intermédiaire.

## Brainstorming et décisions avant code

Concept principal : Mandats, deux échelles, une responsabilité tangible. Alternative premium : dossiers de crise narratifs avec budgets limités. Moonshot : campagnes territoriales fédérées et scénarios pédagogiques créés par des experts.

Idées : facture d'entretien différée ; héritage initial ; capacité de livraison limitée ; rénovation visible à livraison ; bilan des engagements restant à financer ; qui paie/qui bénéficie/quand ; crise sensible aux investissements antérieurs ; rejouer les mêmes chocs ; promesse personnelle ; absence de stratégie parfaite ; cartes résultat avec sacrifice ; défi sans hausse fiscale ; remboursement contre rénovation ; subvention conditionnelle ; budgets par périmètre ; carte territoriale accessible ; bilan annuel décomposé ; comparaison desktop ; cockpit mobile à trois indicateurs ; carnet de décisions ; sauvegarde exportable ; métriques de score explicites ; journal des corrections ; dossier pédagogique par dilemme ; cartes sociales sourcées ; défis de classe sans noms ; intelligence X autorisée seulement ; brouillons sans clé de publication ; sources figées par version ; publicité uniquement éditoriale ; parrainage sans influence sur le moteur ; repli visuel sans animation.

Débat 1 : finance refuse d'assimiler budget de l'État et APU ; produit refuse un second mode verrouillé. Résolution : municipal phare et national introductif complet, périmètre APU synthétique déclaré, adaptations distinctes.

Débat 2 : croissance conteste la rentabilité publicitaire avant audience ; la direction visuelle demande une ville immersive ; technique protège le démarrage. Résolution : aucun tag tiers, carte SVG fonctionnelle avec liste équivalente, enrichissement desktop, comptes et 3D différés. Le dialogue complet distinguera contributions d'agents reçues et synthèse des rôles, sans prétendre 21 audits indépendants.

## Tâches

- [x] 1. Créer `site/src/mandats/types.ts`, `municipal.ts`, `national.ts`, `engine.ts`, `engine.test.ts`. Vérifier équilibre municipal, dette nationale, effets différés, déterminisme, récupération et transitions interdites. Commande : `node --test site/src/mandats/engine.test.ts`.
- [x] 2. Créer `storage.ts`, `sharing.ts` et leurs tests. Stocker uniquement version, mode, graine et IDs de choix ; recalculer toute importation ; refuser charges excessives et versions inconnues.
- [x] 3. Créer `render.ts`, `main.ts`, `style.css`, `site/mandats/index.html`. Sélection de mandat, briefing, décision, résolution, bilan, territoire, finances, méthodologie, partage et export/import. Tester le rendu sans navigateur puis les parcours quand le navigateur est disponible.
- [x] 4. Ajouter entrée Vite indépendante et lien depuis l'interface existante. Ajouter documents méthodologiques pré-rendus, cartes OG génériques et partage local téléchargeable. Ne pas annoncer un aperçu dynamique de score si aucun rendu serveur n'est livré.
- [x] 5. Produire le dossier `docs/mandats/STRATEGIE.md` dans les 17 sections demandées avec preuves, limites, modèles commerciaux, calendrier et critères d'acceptation.
- [x] 6. Exécuter tests critiques, vérification TypeScript et build. Revue des écarts, puis commit et branche/PR GitHub si l'accès le permet. Aucun déploiement du site existant n'est implicite.

Validation : suite complète 1 312 tests, build réussi, deux campagnes terminées en vue CSS 390 px. Voir `docs/mandats/VALIDATION.md`. La tâche 6 comprend une proposition GitHub, sans fusion ni déploiement public.
