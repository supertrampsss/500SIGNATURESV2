"""Redéclarer sans réingérer : la signature de chaque declarer se résout avant
d'écrire quoi que ce soit.

Le run du 7 août est la leçon : cinq modules redéclarés, puis
`macro.declarer(conn, plan)` a levé TypeError — une redéclaration à moitié
faite, découverte en production. La résolution des signatures doit se faire
entière, en amont, et refuser ce qu'elle ne sait pas servir.
"""

import pytest

from plateforme import redeclarer
from plateforme.normalize import macro, subventions


def test_un_declarer_ordinaire_ne_demande_rien():
    assert redeclarer._arguments(subventions) == []


def test_le_plan_de_macro_est_construit_sans_reseau():
    (plan,) = redeclarer._arguments(macro)
    assert isinstance(plan, dict) and "insee_dette_apu_part_pib" in plan


def test_une_signature_inconnue_refuse_avant_d_ecrire():
    class Inconnu:
        __name__ = "plateforme.normalize.inconnu"

        @staticmethod
        def declarer(conn, catalogue):
            raise AssertionError("ne doit jamais être appelé")

    with pytest.raises(SystemExit, match="signature"):
        redeclarer._arguments(Inconnu)
