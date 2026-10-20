# Budgets ministériels — tableau graphique compact

Référence approuvée le 20 octobre 2026 : [maquette 3](bercy-tableau-reference/reference.png).
L’intitulé de la colonne centrale a ensuite été fixé par le propriétaire :
« Ponctionné pour financer les retraites ». Les deux autres colonnes sont
« Budget affiché » et « Budget restant ».

La présentation remplace le grand flux et sa table séparée par une seule table
graphique, partagée entre France, Salaires et le dossier de financement des
retraites publiques. Chaque montant comporte une petite barre. La colonne des
retraites est rouge sur fond rose pâle ; le budget restant est marine. Les 19
ministères restent dans la table, sans titre redondant ni légende de flux.

Les longueurs de barres des images ImageGen sont des esquisses. Le rendu publié
doit recalculer les trois barres de chaque ligne depuis les mêmes montants en
euros, sur un maximum commun et des pistes de même largeur. Les zéros ne créent
aucun remplissage ; une retraite inconnue laisse aussi le reste inconnu.

Les montants ne changent pas : crédits de paiement prévus au PLF 2027,
contributions employeur issues des PAP et cotisations salariales estimées.
Le retrait des signes ≈ est un choix de présentation ; les drapeaux d’estimation,
les libellés accessibles et les explications des sources restent disponibles.
Le mot « ponctionné » est le libellé éditorial retenu pour cette ventilation de
financement déjà comprise dans les crédits ; les données ne mesurent ni une
économie ni des dépenses exécutées. Les limites CAS Pensions et l’absence du
montant complet de l’Enseignement supérieur restent décrites dans les sources.

Sur téléphone étroit, chaque ligne place le nom complet au-dessus des trois
montants ; les trois intitulés restent affichés une seule fois en tête de table.
Les pistes restent intégrées aux montants, sans cartes successives ni intitulés
répétés à chaque ministère. Les surfaces intermédiaires placent les pistes sous
les chiffres et conservent les quatre colonnes. La référence de charte
reste Spectral et Source Sans 3, marine #092d58 et rouge #c52438 sur papier #fffefa.
Les polices fixes déjà présentes conservent la graisse lisible sous WebKit.

Validation locale du 20 octobre 2026 : `npm run check` réussi (1 127 tests,
types et compilation complète), 14 dossiers contrôlés sans erreur et 15 parcours
Playwright réussis sur cinq configurations (Chromium 320, 390 et 1 280 px,
WebKit portrait et paysage). Les vérifications couvrent les 19 montants et leur
conservation, l’unicité de la table, les pistes égales et remplissages
proportionnels, les vrais zéros, les inconnues, les noms accessibles et l’absence
de débordement. Captures réelles inspectées sur France, Salaires et le dossier.

Références de revue : [avant sur ordinateur](bercy-tableau-reference/before-desktop.png),
[après sur ordinateur](bercy-tableau-reference/after-desktop.png),
[après sur téléphone](bercy-tableau-reference/after-mobile.png).
Les contrôles CI de la PR, le déploiement de son commit fusionné et les trois
routes publiques doivent ensuite être vérifiés avant d’annoncer la publication.
