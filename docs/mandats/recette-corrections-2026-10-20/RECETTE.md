# MANDATS — corrections et nouvelle recette joueur

**Mandat neuf joué jusqu’au bilan sur mobile : 3 objectifs sur 4, bilan mitigé.** Les retards restants sont explicitement désignés ; aucun blocage n’a empêché les trente périodes, l’export ou la reprise. Le contrôle local complet passe ; la revue et les gates de livraison font l’objet d’un suivi distinct dans la PR.

## Ce que nous avons réellement joué

- Départ normal « Une coalition fragile », sans import, sur une origine locale réservée à cet essai : `http://127.0.0.1:4182/mandats/`. La sauvegarde du propriétaire sur le domaine public est conservée.
- Règles v17, ambition équilibre, **graine 0**, identifiée seulement dans l’export final. Le [journal réellement exporté](partie-mobile-jouee.json) contient **30 passages de période et 14 ordres**, soit 44 entrées.
- Navigateur intégré, écran CSS **390 × 844**. Les six premiers passages ont lieu à ×1, avec environ trois minutes de temps actif et des pauses de lecture supplémentaires. Les 24 autres passages utilisent la commande normale Avancer. Aucune horloge, aucun état ni journal de victoire injecté.
- Stratégie choisie depuis les informations visibles : organisation et prévention d’abord, réseaux durables ensuite, rattrapage administratif en fin de mandat. Aucun ajustement du moteur pour faire réussir cette trajectoire.
- La partie commence sur `mandats-hkKKILPW.js`. Une correction de singulier du groupe d’événements produit `mandats-D0JMRBSv.js` ; rechargement normal à P21, neuf ordres retrouvés, mêmes crédits et appuis. La logique du jeu ne change pas entre ces rendus. Le dernier alignement des libellés du bilan, `mandats-DmGVFSHv.js`, est vérifié séparément sur cette sauvegarde terminée : transports et démarches affichent bien leur limite opérationnelle.

**Limite : essai par l’assistant déjà familier du projet, sur téléphone émulé ; aucune étude de joueurs externes, mesure du plaisir ou validation sur appareil physique n’est revendiquée.**

## Résultat constaté

| Indicateur | Bilan affiché |
|---|---|
| Fin | 30 périodes, mandat terminé |
| Objectifs | 3 / 4, « Un mandat aux résultats partagés » |
| Retards | 27,98 → **29,34** unités ; objectif manqué |
| Déficit annuel | 153 → **129,22 Md€**, année 5 clôturée |
| Référence au même horizon | **131,22 Md€** ; écart −2 Md€, comparaison globale avec gouvernement autonome |
| Appuis | **38,26 / 100**, gouvernement en fonction |
| Crédits restants | Environ **0,7 Md€** affiché |
| Pression finale | Santé 0 ; logement 14 ; transports 35 ; énergie 0 ; éducation 17 ; démarches 7 |

Les chiffres décrivent cette simulation. Le bilan distingue les services accessibles du retard total ; il ne transforme pas les trois objectifs atteints en victoire complète.

![Bilan réellement obtenu sur mobile](12-bilan-mobile.png)

## Décisions et conséquences observées

| Moment | Intention puis résultat |
|---|---|
| P1 | Prévenir les ruptures locatives (1,17 Md€), organiser les parcours de soins (1,4 Md€). Crédits et appuis diminuent immédiatement ; les pressions restent inchangées avant livraison. Deux travaux prévus sont distingués des équipes déjà mobilisées. |
| P2–P4 | Les premières livraisons apparaissent avec leur origine ministérielle ou présidentielle. Le bulletin suspend le temps ; sa fermeture garde la pause et la reprise conserve les secondes restantes. |
| P6 | Financer la durée par « Fermer les outils redondants », −3 Md€/an avec perturbation des équipes. Loi adoptée **287 pour, 247 contre, 43 abstentions**, seuil 268. Le résultat remonte dans Réformes ; sa répartition par groupe s’ouvre immédiatement. |
| P7–P10 | Anticiper les besoins de soins annoncés : réseau territorial, 2,65 Md€. Livraison à P10, **capacité +2,2 et besoins −0,3 par période** inscrits au bulletin. |
| P13–P18 | Attendre un besoin réel. À P18, logement pression 15 : la carte, le panneau et le bulletin annoncent tous la limite opérationnelle. Aucun texte ne prétend que le ministère dispose encore d’une marge. |
| P18–P21 | Partage du logement des agents, compromis de services publics, pilotage énergétique. Quatre équipes réellement mobilisées, travail prévu affiché séparément. Le compromis ne fournit ses appuis qu’après livraison. |
| P21 | Dossiers unifiés et réseau énergétique. Demande annuelle de crédits rejetée **250/284/43**, seuil 268 ; aucune enveloppe créée. Le résultat et son détail restent dans le contexte de financement. |
| P21–P23 | Préparer les remplacements scolaires : les appuis passent à 28,26, seuil 30 clairement visible. Après livraison, ils remontent ; le bandeau désigne alors les retards comme nouvel objectif manquant. |
| P25 | Nouvelle demande annuelle rejetée **248/283/46**, seuil 266. Réaffectation de 1,2 Md€ d’investissement général, avec actifs −1 annoncé et aucune recette créée. |
| P25–P30 | Renfort administratif de huit mois, 1,92 Md€, après lecture de son caractère temporaire. Le retard baisse mais reste supérieur au départ après le dernier passage : bilan mitigé assumé, sans modifier les règles. |
| Après fin | Export par le bouton du bilan, consultation des réformes désactivées, puis rechargement et Reprendre : mêmes retards, déficit, appuis et bilan. Rejouer le vote ramène à P6 avant son adoption ; réimportation de notre propre export terminé : mêmes trente périodes et même bilan. |

## Défauts corrigés et contrôles

| Défaut | Contrôle concret |
|---|---|
| Ministère limité présenté comme rassurant | Préfixes du journal original 612 ; nouveau logement P18, énergie P19 et démarches P21. Retour au service opérationnel observé après transformation suffisante. |
| Libellé du bilan différent de la carte | Même modèle de lecture v17 pour les secteurs de la carte, du panneau et du bilan ; vérification réelle sur transports et démarches après rechargement de la partie terminée. |
| Objectif manquant caché derrière un compteur | Deux objectifs simultanés visibles à 320 et 390 pixels ; nature, valeur et cible ; liens directs vers les secteurs responsables des retards. |
| Secteurs qui se recouvrent ou texte rogné | Rectangles mesurés et hauteur adaptée au contenu ; contrôle de cinq dimensions, panneau ouvert et fermé, événements groupés. Les captures `controle-*` conservent les défauts intermédiaires, les images numérotées montrent le rendu corrigé. |
| Résultat de vote éloigné de la décision | Nouveau vote informatique adopté dans Réformes, deux crédits rejetés depuis la carte ; cas du budget adopté qui résout l’événement couvert séparément par le journal original et son parcours navigateur. |
| Régression des anciennes parties v16 | Régression de rendu du panneau Réformes et parcours navigateur dédiés. |
| Coûts nuls inventés dans le catalogue terminé | Pension/aide à domicile en consultation : **2 Md€, quatre mois, une équipe**, boutons désactivés. |
| Mauvais exercice financier dans le cap | Cas de frontière annuelle comparé à l’objectif autoritatif ; aucune valeur du moteur modifiée. |
| Capture automatisée qui relance le temps | Horloge figée et capture sans pause/reprise du pays ; temps, minuterie et sauvegarde contrôlés. Les exécutions initiales interrompues restent des échecs, pas des passes. |

![Objectifs et repères complets à 320 pixels](03-objectifs-et-secteurs-320.png)

![Carte et deux objectifs à 1280 pixels](04-deux-objectifs-desktop.png)

![Lecture cohérente des services dans le bilan](13-bilan-coherent.png)

## Validation et livraison

Révision applicative : `4d7b69b95b4d8e6184379f7316ce042350588d76`.

- `npm run check` exécuté par le parent sur cette révision : **1 158 / 1 158 tests unitaires**, zéro échec ; types, build, pré-rendu et génération hors connexion réussis. Bundle offline : 37 ressources, version `85b7e15b7fefdff0`.
- Régressions ciblées de l’implémenteur : 22 / 22 ; ouvertures et captures 6 / 6 dans chacune des deux suites ; parcours budget/contenu finaux 4 / 4 dans Chromium et WebKit. Ces contrôles ciblés ne sont pas présentés comme les suites navigateur complètes.
- Les premières suites globales interrompues après erreur du harnais sont conservées comme échecs. Les suites globales corrigées, la revue indépendante, les gates CI, la fusion et le contrôle du domaine publié sont consignés dans le compte rendu de livraison de la PR associée à cette révision.

Le [manifeste des bundles](build-evidence.json) est produit après le contrôle complet, avec empreintes SHA-256 et commit. La publication doit servir ces mêmes fichiers et être essayée dans le navigateur. Un build réussi ne vaut ni essai joueur ni publication réussie.
