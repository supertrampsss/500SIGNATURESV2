# Reprise d’un accord social déjà financé

Défaut reproduit avant correction le 15 octobre 2026, moteur national v13,
seed 0, priorité équilibre. Les entrées utilisent seulement les choix publics.

Après un regroupement des classes, une suspension financée à la décision 10
engage 2 Md€/an. Les services sont insuffisants à son échéance : l’engagement
échoue à la décision 12 et la capacité attendue est annulée. Les crédits restent
dans les comptes. À la décision 13, choisir à nouveau la même suspension ajoute
pourtant 2 Md€/an au lieu de reprendre les crédits déjà votés.

Le contrefactuel, au même état et après la même indexation annuelle, donne
1 535,9799816 Md€ de charges structurelles avec un maintien des moyens et
1 537,9799816 Md€ avec la seconde suspension. L’écart est exactement de 2 Md€.

Préfixe reproductible :

```json
{"version":13,"mode":"national","seed":0,"ambition":"equilibre","choices":["n11-0-education-lycees-regrouper","r01a","r02a","pol-censure-withdraw","r03a","r04a","u02a","r05a","r06a","n11-9-mvt-lyceens-0-suspendre","n11-10-pressure-energy-maintain","n11-11-pressure-energy-maintain"]}
```

Preuves générées : `site/pressure-artifacts/qa-balance/social-retry-before.json`
et `social-retry-0.json`. Le replay v13 reconstruit exactement le défaut.
La v13 reste déterministe ; la correction vise les nouvelles parties v14.

Hypothèses de régression à vérifier avant l’implémentation :

1. La reprise de la même réponse ne débite pas une nouvelle fois les crédits
   déjà engagés, y compris après une indexation annuelle.
2. Une réponse différente garde son propre financement ; aucun remboursement
   ou transfert automatique entre accords ne crée un crédit fictif.
3. Un coût de réponse qui augmente ne demande que le supplément au-dessus des
   crédits existants, indexés comme les autres charges du budget.
4. Un rejet de la nouvelle proposition ne crée ni financement, ni engagement,
   ni capacité. Les crédits antérieurs restent acquis.
5. Une reprise financée reste en préparation jusqu’à une vraie livraison ; un
   nouvel échec ne restaure aucun poste. Rechargement, export et import
   reconstruisent les mêmes financements à partir des choix.

Le nouveau parcours navigateur importe le préfixe légal, examine les réponses,
vote la reprise et vérifie l’engagement, le budget, la capacité et la sauvegarde.
Les variantes de coût, de vote et de nature d’accord sont explorées depuis des
préfixes légaux ; elles ne reposent pas sur un état social injecté.

## Résultat de la correction v14

La reprise de la suspension n’ajoute plus de dépense : l’enveloppe initiale de
2 Md€/an vaut 2,036 Md€/an après l’indexation déjà inscrite au budget. Le choix
annonce ces crédits existants et zéro crédit nouveau. La capacité d’enseignement
reste inchangée tant que l’engagement n’a pas réellement abouti.

Au même préfixe, l’expérimentation constitue un accord différent : ses
0,25 Md€/an restent à financer et les crédits de suspension ne sont pas
remboursés. Le redéploiement à 0,35 Md€/an est, lui, réellement rejeté par
248 voix pour ; il ne crée ni financement supplémentaire, ni nouvel engagement,
ni capacité. Les anciens crédits et l’engagement échoué restent identiques.

Un second préfixe légal, seed 1, a financé 5,66 Md€/an de recrutements à la
décision 19. Après l’échec de mise en œuvre à la décision 21, le besoin affiché
atteint 9,69 Md€/an : la reprise ne vote que les 4,03 Md€/an manquants.
La nouvelle capacité administrative attend toujours la livraison effective.
Les entrées complètes de ce parcours figurent dans le test navigateur.

Les nouveaux parcours ont passé six cas actifs : reprise sur bureau, 390 px et
320 px, puis accord différent, rejet réel et supplément de financement sur
bureau. La composition des cartes a été inspectée sur bureau et 320 px. Le
contrôle des types passe. Les suites sociales complètes et les autres contrôles
de livraison restent à exécuter sur le build final commun.

Reproduction depuis `site/`, après le build :

```sh
npx playwright test --config playwright.social.config.ts --grep "social agreement|different social response"
```

Les rapports, captures et entrées sont conservés dans `site/social-artifacts/`.
Les journaux exploratoires locaux sont dans
`site/pressure-artifacts/qa-balance/`. Le journal `before-e2e.log` conserve
l’échec attendu, reproduit sur la v13 avant l’implémentation : la carte réclamait
encore 2 Md€/an lors de la seconde suspension.
