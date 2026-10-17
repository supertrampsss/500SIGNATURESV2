# Directeur contextuel : hypothèses avant code

17 octobre 2026. Périmètre : incidents v16 uniquement.

Échecs à prévenir : chaleur générée en plein hiver ; même famille tirée en boucle ; réparation sans répit ; tirage différent après rechargement ; révolte qui devient automatiquement révolution malgré disparition des causes ; résolution naturelle annulée par le calcul de phase ; troisième réponse purement cosmétique.

Vérifications écrites avant modification : saison d'éligibilité, mémoire de famille, score sensible à la pression et aux programmes livrés, reproductibilité, reflux civil sur plusieurs périodes et conservation de la résolution, poursuite d'une crise encore alimentée. Les tests isolent le directeur ; les parcours légaux existants vérifient l'intégration et la défaite possible.

Hypothèses de simulation : une crise sociale privée de ses causes locales et avec une pression moyenne inférieure à 45 peut refluer après deux périodes ; la décrue d'un stade ne vaut pas nomination d'un gouvernement. Une révolution sans cause encore négligée est stabilisée, mais les pressions et les arriérés restent réels. La chaleur ne devient un nouveau choc spontané qu'entre mai et août ; l'incident d'ouverture imposé par la graine reste inchangé pour cette livraison.

## Implémentation et preuve

Le test a d'abord échoué sur l'absence de `crisisDirectorCandidates`, avant changement de règles. Après implémentation : 11 tests ciblés (directeur, incidents, escalade) réussis et TypeScript validé. La sélection reste sans répétition d'un même incident pendant la partie ; la mémoire supplémentaire réduit le poids des autres incidents du même secteur pendant quatre périodes. Les programmes sectoriels actifs réduisent le poids de risque, sans immunité. Le tirage pondéré utilise un hash de graine/période/état du catalogue, sans horloge système.

Trois choix supplémentaires ont des coûts et des contraintes réels : unité de soins autonome temporaire mobilisant trois équipes ; reprise négociée accélérée du port avec deux équipes et un coût plus élevé ; réparation électrique urgente avec quatre équipes et un investissement accru. Ces branches ne prétendent pas simuler des transferts régionaux absents du moteur.

Limites : les plages de cadence et poids sont des hypothèses à calibrer avec l'audit multi-graines. L'incident initial conserve le choix historique de graine, y compris la chaleur possible au départ. Le reflux civil n'annule ni un vote ni une démission du cabinet, et ne remplace pas un dossier institutionnel déjà ouvert. Les scénarios navigateur doivent maintenant vérifier visuellement les états reçus du moteur.
