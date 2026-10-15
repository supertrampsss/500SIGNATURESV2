# Finition de la maison CC0

La maison de l'atelier du 9 octobre possède six primitives par niveau, deux
désaccords de normales en détail et une toiture dont le motif paraît trop grand.
La finition utilise sa géométrie réellement exportée, pas l'image de studio.

Risques à contrôler avant adoption : une mauvaise couche UV efface les matières ;
une cuisson d'albédo avec éclairage incruste des ombres ; la réduction ou le
réexport peut déplacer le pied ; un atlas propre à chaque niveau peut désactiver
leur raccord Babylon ; une jonction de normales peut devenir noire ; un nouvel
export peut grossir le téléchargement ou modifier les autres préfabriqués.
Les contrôles portent sur le GLB final puis sur la scène réellement exécutée,
avec ses contacts, le passage des niveaux, les téléphones et le cache hors ligne.
La composition du pays doit toujours être rapprochée de la maquette confirmée.

`finish-house.py` utilise explicitement TEXCOORD_0 de la source. L'autre couche
source est inutilisée et ne doit pas devenir la couche de cuisson. L'albédo exclut
l'éclairage direct et indirect. L'occlusion, la rugosité et le métal occupent
respectivement les canaux R, G et B d'une image distincte. Le détail utilise
512 pixels et la distance 128 pixels. Les UV de toiture répètent les matières
d'origine 2,5 fois plus finement ; la silhouette géométrique reste inchangée.
Les deux niveaux occupent le même emplacement dans la source. Chaque cuisson
masque donc l'autre niveau : une comparaison AO isolée a révélé que leur
superposition assombrissait artificiellement le niveau distant. Les deux objets
redeviennent visibles avant l'export et la sauvegarde Blender.

Le script répare seulement les boucles dont les normales importées s'opposent à
leur face. Il conserve la géométrie détaillée et les dimensions des deux niveaux. Chaque
niveau possède un atlas et une primitive. Le raccord des matériaux différents
doit donc être vérifié dans le chargeur de modèles avant une adoption.

La planche Babylon a écarté le précédent niveau à 287 triangles : ses façades et
ses raccords de toiture présentent des trous. Le nouveau niveau est reconstruit
à partir du détail, avec une réduction de 50 %, puis recalé sur ses bornes. Il
contient 695 triangles exportés, pour un budget de 750. Les deux implantations
actuelles permettent ce coût supplémentaire sans multiplier les surfaces.

Les commandes, preuves et limites de l'itération sont conservées dans le dossier
de comparaison. Une planche Blender n'établit pas la conformité de la carte.
