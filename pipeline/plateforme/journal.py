"""Journal public des changements.

docs/02 §1 pose la règle : « jamais de destruction silencieuse ». La table
`meta.change_log` existait pour la tenir, sans personne pour y écrire — une
promesse tenue par un schéma vide n'est pas tenue.

Ce module déclare les changements en code, comme `retention.py` déclare la
rétention : versionné, relisible, rejouable. Écrire ici est un acte éditorial,
pas une conséquence automatique d'un run — c'est pourquoi rien ne se déduit et
tout s'écrit à la main, en français, avec la date d'annonce figée. Un run qui
recalculerait `announced_at` ferait paraître d'hier une correction d'il y a six
mois.

Trois familles de changements méritent d'être ici, et pas ailleurs :

- **correction** : un chiffre déjà publié a bougé. C'est le seul cas où le
  lecteur peut avoir noté une valeur qui n'existe plus.
- **methodology** : le chiffre n'a pas bougé, sa fabrication si.
- **deprecation** : des données ont cessé d'être publiées, et il faut dire
  lesquelles plutôt que laisser un trou.

Les entrées écrites par la plateforme portent `author = 'plateforme'` : la
synchronisation ne touche qu'à celles-là, et laisse intactes celles qu'un
humain ajouterait à la main.

Usage : python -m plateforme.journal
"""

import argparse
from dataclasses import dataclass, field

from plateforme import db

AUTEUR = "plateforme"


@dataclass(frozen=True)
class Changement:
    annonce: str  # date d'annonce, figée : elle ne se recalcule jamais
    type: str  # correction | methodology | break | revision | deprecation
    public: str  # ce que ça change pour qui lit un chiffre
    technique: str | None = None  # ce qu'un réutilisateur doit savoir en plus
    jeu: str | None = None
    indicateur: str | None = None
    effet_au: str | None = None  # exercice ou date à partir de laquelle ça vaut
    sources: list[str] = field(default_factory=list)


JOURNAL: list[Changement] = [
    Changement(
        annonce="2026-07-31",
        type="correction",
        jeu="execution-budget-etat",
        effet_au="2019-01-01",
        public=(
            "Les dépenses exécutées de l'État pour 2019, 2020 et 2021 ont été"
            " corrigées. Le fichier de la DGFiP qui sert de référence portait, dans"
            " sa colonne « Exécution », les montants de l'exercice précédent :"
            " jusqu'à 53 milliards d'euros d'écart sur une année. L'exécution"
            " affichée ici est désormais lue dans la situation mensuelle"
            " budgétaire, où elle est juste."
        ),
        technique=(
            "Défaut du producteur, non corrigé à la source à la date d'annonce."
            " Le décalage ne touche que les pièces jointes « textes législatifs »"
            " pour les exercices 2019 à 2021 ; les montants votés et rectifiés des"
            " mêmes fichiers sont corrects. Chaque run recoupe désormais les deux"
            " fichiers producteur et enregistre l'écart constaté."
        ),
        sources=["situations-mensuelles-budgetaires-series-longues"],
    ),
    Changement(
        annonce="2026-07-31",
        type="correction",
        jeu="execution-budget-etat",
        effet_au="2022-01-01",
        public=(
            "Le détail des prélèvements sur recettes votés en loi de finances"
            " initiale pour 2022 n'est plus affiché : les montants publiés par le"
            " producteur ne s'additionnaient pas à leur propre total. Le total,"
            " lui, est cohérent et reste publié."
        ),
        technique=(
            "Mise en quarantaine du seul sous-ensemble en défaut, pas de la ligne"
            " ni de l'exercice : le contrôle d'identité du solde passe, celui du"
            " sous-total échoue. Les lignes écartées sont exportées avec le budget"
            " pour que la réutilisation voie ce qui manque et pourquoi."
        ),
        sources=["situations-mensuelles-budgetaires-series-longues"],
    ),
    Changement(
        annonce="2026-07-31",
        type="deprecation",
        jeu="ofgl-communes",
        effet_au="2022-01-01",
        public=(
            "Les finances communales antérieures à 2022 ne sont plus servies. Elles"
            " restent disponibles chez le producteur, et les instantanés bruts"
            " conservés permettent de les recharger à l'identique."
        ),
        technique=(
            "Politique de rétention déclarée dans `plateforme/retention.py` :"
            " 418 416 observations retirées pour tenir dans les 500 Mo du plan"
            " gratuit (décision D6bis). Au moins deux exercices sont garantis pour"
            " chaque niveau ; la règle est versionnée et rejouable."
        ),
    ),
]

TYPES_PERMIS = {"correction", "methodology", "break", "revision", "deprecation"}


def synchroniser(conn, journal: list[Changement] | None = None) -> int:
    """Remplace les entrées de la plateforme par celles déclarées ici.

    Le remplacement intégral est ce qui rend la déclaration lisible : le code
    dit l'état du journal, pas la suite des modifications qui y ont mené.
    """
    entrees = JOURNAL if journal is None else journal
    inconnus = {changement.type for changement in entrees} - TYPES_PERMIS
    if inconnus:
        raise ValueError(f"type de changement hors vocabulaire : {sorted(inconnus)}")
    with conn.cursor() as curseur:
        curseur.execute("delete from meta.change_log where author = %s", (AUTEUR,))
        for changement in entrees:
            curseur.execute(
                """
                insert into meta.change_log
                    (dataset_id, indicator_id, change_type, description_public,
                     description_technical, effective_date, announced_at, author)
                values (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    changement.jeu,
                    changement.indicateur,
                    changement.type,
                    changement.public,
                    changement.technique,
                    changement.effet_au,
                    changement.annonce,
                    AUTEUR,
                ),
            )
    conn.commit()
    return len(entrees)


def main() -> int:
    argparse.ArgumentParser().parse_args()
    conn = db.connect()
    try:
        ecrites = synchroniser(conn)
        print(f"journal : {ecrites} changements déclarés")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
