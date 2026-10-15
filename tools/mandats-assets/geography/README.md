# Contours régionaux

Les contours intérieurs reprennent les régions françaises renseignées dans
Natural Earth 10m Admin 1, données du domaine public. Ils servent au décor du
diorama ; les sujets et calculs restent ceux du moteur de jeu.

Source récupérée le 8 octobre 2026 :
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson

Empreinte SHA256 du fichier mondial :
`22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5`.
Identifiant Git du blob : `4a8438f98ac7dfec7dc1739b1eaf91398ad33f22`.

Le sous-ensemble conservé contient les géométries et noms de 96 départements
métropolitains, regroupés selon leur champ `region`. Les arêtes partagées par
des régions distinctes sont retenues une fois ; les limites départementales et
le littoral sont exclus. La simplification garde une tolérance de 0,004 degré.
Le rendu applique la même projection miniature et hauteur de sol que le pays.
Ce décor ne constitue pas un relevé cadastral.

Reproduction, sans dépendance Python supplémentaire :

```sh
python tools/mandats-assets/geography/build-region-lines.py
```

Conditions : https://www.naturalearthdata.com/about/terms-of-use/
