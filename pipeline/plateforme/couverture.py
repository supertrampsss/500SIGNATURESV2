"""Le contrôle qu'aucun total ne remplace : ce qu'on écrit couvre ce qu'on a lu.

Un connecteur qui agrège une source par territoire porte presque toujours un
contrôle d'identité — la somme des parties fait le total, les départements font
la France. Ces contrôles sont bons et ils ne suffisent pas : **ils comparent la
source à elle-même**. Ils passent parfaitement pendant que les codes de la
source et ceux du référentiel se ratent complètement, et ce qui sort est une
carte vide sans une ligne d'erreur.

Deux fois en une heure, le 6 août 2026 :

- l'annuaire de l'éducation écrit « 033 » là où le Code officiel géographique
  écrit « 33 ». Somme des départements égale somme des régions, contrôle vert,
  1 511 écoles publiées sur 101 départements au lieu de 47 109 ;
- le répertoire des logements sociaux code Paris, Lyon et Marseille par
  arrondissement. Mêmes totaux, même contrôle vert, et Paris publié à zéro
  logement social quand il en compte 250 640.

Aucun contrôle interne à la source ne pouvait voir ni l'un ni l'autre. Celui-ci
compare deux nombres qui viennent de deux mondes : ce que la source a donné, et
ce que le référentiel a reconnu.
"""

# Part de ce qui est lu qu'une maille doit retrouver au référentiel. Le seuil
# laisse passer ce qui n'a pas de territoire chez nous — Saint-Pierre-et-Miquelon,
# Wallis, la Polynésie et la Nouvelle-Calédonie ont des écoles et des logements
# sans être des départements français — sans laisser passer un format de code
# qui a glissé. Les deux défauts du 6 août tombaient à 3 % et 92,9 %.
COUVERTURE_MINIMALE = 0.95


class CouvertureInsuffisante(RuntimeError):
    """Trop de ce qui a été lu ne correspond à aucun territoire connu."""


def controler(
    lus: dict[str, int], reconnus: dict[str, int], minimum: float = COUVERTURE_MINIMALE
) -> dict[str, float]:
    """-> part reconnue par maille. Lève si l'une passe sous le seuil.

    `lus` et `reconnus` comptent la **même grandeur** — des établissements, des
    logements —, l'un tel que la source le donne, l'autre tel qu'il a été
    rattaché à un territoire du référentiel. Les comparer en nombre d'entités
    plutôt qu'en nombre de codes est délibéré : trois codes perdus ne pèsent
    rien s'ils portent trois logements, et tout s'ils portent Paris.
    """
    parts = {}
    for maille, total in lus.items():
        part = reconnus.get(maille, 0) / total if total else 1.0
        parts[maille] = part
        if part < minimum:
            raise CouvertureInsuffisante(
                f"{maille} : {reconnus.get(maille, 0)} sur {total} rattachés à un"
                f" territoire connu ({100 * part:.1f} %). Les codes de la source ne"
                " sont pas ceux du référentiel — format, millésime, ou"
                " arrondissements municipaux non rattachés à leur commune."
            )
    return parts
