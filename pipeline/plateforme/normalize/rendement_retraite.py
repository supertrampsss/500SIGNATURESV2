"""Ce qu'une génération récupère de ses cotisations retraite (INSEE, Destinie 2).

« Pour 100 € cotisés, combien de pension ? » est la question qui tient sous tout
le débat des retraites, et le site n'y répondait pas. L'INSEE l'a calculée, par
génération, dans son document de travail **G2015/06** (Yves Dubois et Anthony
Marino, « Disparités de rendement du système de retraite dans le secteur privé :
approches intergénérationnelle et intragénérationnelle »).

| Génération | 1950 | 1965 | 1985 |
|---|---|---|---|
| Récupéré pour 100 € cotisés | 158,57 € | 126,21 € | 117,28 € |

─────────────────────────────────────────────────────────────────────────────
CE N'EST PAS UNE OBSERVATION, ET LE CATALOGUE LE DIT
─────────────────────────────────────────────────────────────────────────────
Ces trois indicateurs sortent du modèle de microsimulation **Destinie 2** :
pour les générations qui n'ont pas fini de cotiser — toutes, sauf en partie
1950 —, la pension future est simulée. Ils sont donc déclarés `estimated`, et
non `observed` comme les séries de la DREES publiées à côté. Un chiffre modélisé
posé sans mention à côté d'un chiffre constaté est la confusion que ce dépôt
refuse partout ailleurs.

**Trois bornes que la fiche doit porter, faute de quoi le chiffre ment :**

1. **Le champ** : salariés du **secteur privé**, vivants à 60 ans. Ni les
   fonctionnaires, ni les indépendants, ni ceux morts avant la retraite — dont
   le rendement est nul par construction et qui tireraient la moyenne vers le
   bas.
2. **La législation** est celle de **2014**. La réforme de 2023, qui recule
   l'âge légal à 64 ans, n'y est pas : elle abaisserait mécaniquement le
   rendement des générations postérieures à 1961. Publier ce chiffre comme
   l'état du système aujourd'hui serait faux.
3. **L'actualisation** est faite au salaire moyen par tête (SMPT). Un autre
   taux d'actualisation donnerait d'autres niveaux — c'est le propre d'un
   calcul sur cycle de vie.

**La sensibilité est publiée par l'étude, et elle est large.** Pour la seule
génération 1950, le taux de récupération vaut :

- **158,57 %** tous financements confondus — le chiffre retenu ici, celui de
  l'annexe 1 ;
- **155,45 %** si l'équilibre du régime est bouclé sur les actifs *et* les
  retraités, **158,38 %** sur les seuls actifs, **146,75 %** sur les seuls
  retraités ;
- **175,17 %** si l'on ne compte au dénominateur que les cotisations hors
  allègements, **177,21 %** allègements compris.

Le site publie la ligne de l'annexe 1 — tous financements, sans bouclage — et
dit l'étendue plutôt que de laisser croire à une décimale certaine.

─────────────────────────────────────────────────────────────────────────────
CE QUE L'ÉTUDE PUBLIE ET QUE CE MODULE NE REPREND PAS
─────────────────────────────────────────────────────────────────────────────
L'annexe 1 porte un quatrième indicateur, le **taux de prestation** (TPR), sous
l'intitulé « TPR = TR × TP ». La ligne imprimée ne vérifie pas cette identité :
pour la génération 1950, TR × TP vaut 37,71 alors que la ligne affiche 42,87 —
et 37,71 s'y trouve deux colonnes plus loin. Le décalage est **systématique sur
les six premières générations**, ce qui désigne un défaut d'alignement de la
ligne plutôt qu'une autre définition : une définition différente ne reproduirait
pas le produit à la deuxième décimale, six fois de suite.

Ce module ne publie donc pas le TPR. Le calculer soi-même par TR × TP serait
possible, mais ce serait publier un chiffre que la source affiche autrement, et
ce dépôt ne corrige pas une source : il la cite ou il s'abstient. Les trois
autres indicateurs sont, eux, confirmés deux fois dans le document — le taux de
récupération de l'annexe 1 est identique à la ligne « tout financement » de
l'annexe des variantes.

─────────────────────────────────────────────────────────────────────────────
POURQUOI UNE GRAINE ET PAS UN CONNECTEUR
─────────────────────────────────────────────────────────────────────────────
La source est un document de travail publié une fois, en 2015, en PDF. Il n'y a
ni API ni fichier tabulaire à télécharger, et **il n'y en aura pas** : une
publication figée ne se recharge pas. Extraire ses tableaux à chaque exécution
serait fragile sans rien apporter. Les valeurs sont donc semées, avec leur
source, comme le sont déjà la nomenclature des programmes budgétaires et le
catalogue des agrégats de l'OFGL.

**La période est une génération, pas un exercice.** « 1950 » désigne ici l'année
de naissance ; lu comme une année d'observation, il ferait dire à la série que
le rendement valait 158 % en 1950. La granularité déclarée est donc
`generation`, chaque intitulé porte le mot, et un test refuse un libellé qui
l'oublierait.

Usage : python -m plateforme.normalize.rendement_retraite
"""

import argparse
import csv
from pathlib import Path

from plateforme import entrepot
from plateforme.normalize.geo import MILLESIME

DATASET = "insee-g2015-06-rendement-retraite"
GRAINE = Path(__file__).resolve().parents[3] / "infra/seed/insee_rendement_retraite.csv"

CHAMP = (
    "Salariés du secteur privé vivants à 60 ans, générations 1950 à 1985,"
    " législation 2014, tous financements, actualisation au salaire moyen par tête."
    " Calcul par microsimulation (modèle Destinie 2), INSEE, document de travail"
    " G2015/06."
)

INDICATEURS = {
    "insee_retraite_taux_recuperation": {
        "colonne": "taux_recuperation",
        "libelle": "Retraite récupérée par génération, pour 100 € cotisés",
        "unite": "percent",
        "public": "Ce qu'une génération touche en pension, sur toute sa retraite, pour"
        " 100 € de cotisations versées pendant sa carrière. Au-dessus de 100, elle"
        " reçoit plus qu'elle n'a versé. Les deux montants sont ramenés à une même"
        " date pour être comparables.",
        "technique": "Taux de récupération (P/C), rapport actualisé des pensions"
        f" perçues aux cotisations versées sur le cycle de vie. {CHAMP}",
        "formule": "Pensions actualisées / cotisations actualisées",
    },
    "insee_retraite_rendement_interne": {
        "colonne": "tri",
        "libelle": "Rendement interne de la retraite, par génération",
        "unite": "percent",
        "public": "Le rendement annuel qu'il faudrait obtenir en plaçant ses"
        " cotisations pour toucher la même retraite. Il se lit comme un taux d'intérêt,"
        " au-dessus de l'inflation.",
        "technique": "Taux de rendement interne (TRI) : taux d'actualisation qui"
        f" égalise pensions perçues et cotisations versées. {CHAMP}",
        "formule": "Taux d'actualisation annulant la différence actualisée",
    },
    "insee_retraite_taux_prelevement": {
        "colonne": "taux_prelevement",
        "libelle": "Part du salaire cotisée pour la retraite, par génération",
        "unite": "percent",
        "public": "La part de son salaire de carrière qu'une génération verse en"
        " cotisations retraite, employeur compris.",
        "technique": f"Taux de prélèvement (C/W), cotisations sur salaires. {CHAMP}",
        "formule": "Cotisations actualisées / salaires actualisés",
    },
}


def lire(chemin: Path = GRAINE) -> list[dict]:
    with chemin.open(encoding="utf-8") as fichier:
        return list(csv.DictReader(fichier))


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level,
                     badges)
                values (?, ?, ?, 'estimated',
                        array['Officiel','Projection de modèle','Secteur privé'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"], fiche["formule"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'retraites', ?, 'percent', false, array['pays'],
                        'generation', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, time_granularity = 'generation',
                    additive = false, published = true
                """,
                (indicateur, DATASET, definition, fiche["libelle"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def run(_store_spec: str = "") -> int:
    conn = entrepot.connect()
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        lignes = lire()
        total = 0
        for indicateur, fiche in INDICATEURS.items():
            valeurs = [
                (ligne["generation"], float(ligne[fiche["colonne"]]))
                for ligne in lignes
                if ligne.get(fiche["colonne"])
            ]
            with conn.cursor() as curseur:
                curseur.execute(
                    "delete from core.observations where indicator_id = ?", (indicateur,)
                )
                entrepot.copier(
                    conn,
                    "core.observations",
                    ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period",
                     "value", "run_id"],
                    (
                        (indicateur, "pays", "FR", MILLESIME, generation, valeur, run_id)
                        for generation, valeur in valeurs
                    ),
                )
            conn.commit()
            total += len(valeurs)
            print(f"{indicateur} : {len(valeurs)} générations")
        entrepot.finish_run(conn, run_id, "success", rows_written=total)
        print(f"Rendement des retraites : {total} observations")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
