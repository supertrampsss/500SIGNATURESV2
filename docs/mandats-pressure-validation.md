# Pression du mandat : scénarios de validation

Cette liste précède l'implémentation de la campagne de pression v13. Elle décrit
des risques de jeu à observer dans de vraies trajectoires, pas des valeurs à
recopier depuis le moteur. Les hypothèses de simulation ne sont pas des données
observées sur la France.

## Échecs réalistes à rechercher

1. **Un pays qui attend le joueur.** Trente décisions sans réponse aux besoins
   existants ne produisent ni retard accumulé, ni échéance plus proche, ni
   complication perceptible.
2. **Une difficulté arbitraire.** Les mêmes crises surgissent aux mêmes moments
   quelle que soit l'anticipation ; une bonne intervention ne change jamais la
   trajectoire.
3. **Un financement pris pour une livraison.** Une mesure structurelle résout le
   besoin dès son vote, alors que le chantier ou les recrutements attendent encore.
4. **Un rejet qui finance quand même.** Le vote rejette une intervention, mais sa
   capacité, son projet ou son soulagement sont pourtant appliqués.
5. **Des promesses sans capacité d'exécution.** Lancer de nombreux programmes
   n'allonge aucun délai, ne crée aucun coût et ne présente aucun risque visible.
6. **Une spirale sans retour.** Une situation dégradée ne peut jamais être
   stabilisée par une réponse adéquate et livrée dans des conditions favorables.
7. **Une solution gratuite universelle.** Le secours temporaire remplace toujours
   un investissement durable, sans durée ni financement récurrent ; ou une seule
   idéologie constitue la seule stratégie viable dans tous les contextes.
8. **Une causalité perdue.** Une crise ou un projet livré n'indique plus la décision
   initiale ; une intervention nouvelle efface l'historique du besoin.
9. **Une pression rejouée deux fois.** Ouvrir un front, zoomer, exporter, recharger,
   importer ou préparer le mode hors ligne avance le calendrier, applique un coût
   ou fait varier le pays sans nouvelle décision.
10. **Un bilan annuel faux.** Des coûts transitoires sont annualisés plusieurs fois,
    une dépense d'investissement réapparaît tous les ans, ou la dette annuelle ne
    correspond plus au solde de financement.
11. **Des crises simultanées illisibles.** Le front le plus urgent est caché par un
    agenda tronqué ; une échéance devient invisible sur un écran de 320 px.
12. **Une fin sans conséquence.** Une rupture institutionnelle n'interrompt pas la
    campagne, ou la dernière décision livre des projets qui devraient attendre.

La frontière financière fait l'objet de cas séparés : un renfort qui expire
avant la clôture laisse une dépense acquise ; un renfort lancé pendant la
sixième période est réparti entre les deux années ; un rejet ne crée aucun
coût de ce renfort. Son taux annuel ne devient pas une charge structurelle.

## Échantillonnage reproductible

Le script `site/scripts/mandats-pressure-audit.ts` joue le vrai moteur depuis ses
entrées publiques (`start`, agenda, sélection, choix, `decide`). Il conserve seed,
version, stratégie, IDs de choix, votes, projets, finances et fronts par période.
Les stratégies utilisent les informations des choix disponibles ; elles ne
regardent pas les issues futures pour choisir rétrospectivement un gagnant.

La matrice couvre les trois contextes d'ouverture avec plusieurs seeds, les trois
priorités de mandat, la négligence, l'anticipation, les secours, la réponse
structurelle tardive, les engagements simultanés et des arbitrages budgétaires
opposés. Des branches locales explorent les alternatives réellement disponibles.
Chaque trajectoire est rejouée et réimportée depuis ses seuls choix. Les branches
illégales ou les états fabriqués ne constituent pas une couverture.

Les parcours Playwright complètent ces observations en passant uniquement par
l'interface : ordinateur, 390 px, 320 px, WebKit, clavier et animations réduites.
Ils retiennent captures, export, inputs et rapport. Une simulation en série ne
prouve pas à elle seule la lisibilité, la qualité visuelle ou la difficulté ressentie.

## Limite de la preuve

Cette exploration est bornée et recherche des classes de situations. Elle ne
prétend pas énumérer toutes les suites de trente décisions ni démontrer un
équilibrage parfait. Les écarts entre stratégies et les trajectoires difficiles
doivent servir à la boucle de revue, puis à des parties humaines.
