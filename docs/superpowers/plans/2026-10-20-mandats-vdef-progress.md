# MANDATS vDef — progression

Branche codex/mandats-vdef-20261020 ; worktree mandats-audit-vdef. L'audit et les maquettes sont approuvés par « go dev ».

- Préparation : branche créée et origin/main a9aefab0 intégré ; code Mandats baseline v17 identique à l'audit.
- Baseline : npm run check:local réussi, 1 127 tests + types + build client ; smoke navigateur six secteurs desktop réussi (26,8 s). Preuves : site/vdef-artifacts/baseline/ et site/strategy-artifacts/vdef-baseline/.
- Task1 : implémentation + 15 tests ciblés et types verts ; revue indépendante approuvée sans défaut important. Test de livraison présidentielle renforcé, 9/9 projection verts après revue.
- Task2 : interface livrée ; revue indépendante et correction paysage approuvées (33dfdc66, 41eec8e7). 18 E2E + contrôles ciblés mobile/compact/paysage verts ; 3 cas runtime réservés Task3.
- Task3 : intégration atomique et correctif touche maintenue livrés (f68fdaa4, f2afe88c), revue indépendante approuvée ; 25 cas clavier/pointeur sur cinq formats réussis.
- Task4 : audit mécanique terminé, 36 trajectoires / 114 branches / 138 539 invariants sans anomalie ; 13 trajectoires historiques / 572 transitions inchangées. Deux journaux sur cinq graines : 6 réussites, 4 bilans mitigés, refus publiés. Build final intégral/hors connexion réussi ; revue globale approuvée. Recette intégrale et fusion suivies par les contrôles de la PR ; captures réelles et provenance dans docs/mandats-vdef.md.

Les recommandations d'équilibrage exploratoires A05/A12/A13/A16 n'autorisent pas à modifier silencieusement les règles numériques v17. Cette livraison améliore leur lecture, la comparaison et le contrôle de l'attente ; nouveaux réglages seulement sur preuve et version explicite.
