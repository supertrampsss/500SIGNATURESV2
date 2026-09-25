# Dilemmes, calendrier et équilibre budgétaire

Risques identifiés avant modification :
- Une crise consomme un tour et fait disparaître une réforme jamais présentée.
- Les mêmes recettes sont encaissées deux fois ou un texte rejeté produit des effets.
- Une trajectoire apparemment équilibrée dépend de modifications artificielles du jeu.
- Le texte d'une crise ne correspond pas à son déclencheur réel.
- Rechargement et reprise divergent du parcours joué.
- La navigation mobile reste cachée ou masque les choix.
- Des formules génériques remplacent les bénéficiaires et perdants concrets.

Validation : parcours déterministe par les choix disponibles, puis parcours navigateur
avec les mêmes identifiants, sauvegarde, reprise et captures. Les rendements des
réformes restent ceux du catalogue, avec leurs conséquences sociales et les votes.

## Parcours de référence

`site/tests/fixtures/mandats-equilibre.json` contient les 30 choix du scénario 13,
version 10, ambition équilibre. Aucun état financier ou politique n'est injecté.
Le navigateur sélectionne chaque carte, franchit les quatre bilans intermédiaires,
consulte le résultat, quitte Mandats pour France et reprend le même mandat.
Le résultat de référence est un excédent annuel de 24,0579 Md€ à la cinquième année.
Les vingt réformes structurelles sont proposées. Leurs rendements ne sont pas augmentés.

Reproduction :

```sh
cd site
npm run build
npx playwright test --config playwright.board.config.ts --grep 'budget equilibrium'
```

Les captures annuelles, le résultat et la sauvegarde rejouable sont conservés dans
`board-audit-artifacts` et les artefacts du workflow Mandats board review. Le scénario,
le navigateur et le viewport sont joints au rapport.

Le calendrier v10 compte les réformes effectivement présentées, y compris celles
rejetées. Une interruption politique ne consomme donc plus une réforme invisible.
Un créneau adaptatif survient après quatre dossiers ordinaires, sauf si les tours
restants doivent être réservés aux réformes encore non présentées. Une longue crise
peut toujours empêcher de tout voter avant la fin du mandat. Le calendrier v9 reste figé.

Les fixtures de destitution sont recalées sur ce calendrier : même scénario 27,
fin à la décision 19, mêmes votes et mêmes seuils. Les assertions sur les effets,
la persistance et les résultats de vote sont conservées.
