"""Tests du contrôle déterministe des analyses (docs/analyses-schema.md, D11).

Chaque cas vient du brief de la tâche 2. Les fixtures utilisent des URL en
`example.invalid`, jamais une adresse plausible.
"""

import sys

from plateforme.controle_analyses import controler, main


class DonneesTest:
    """Double de test du protocole `Donnees` : dictionnaires en mémoire, pas de réseau."""

    def __init__(self, catalogue=None, series=None, version="v-test"):
        self._catalogue = CATALOGUE if catalogue is None else catalogue
        self._series = SERIES if series is None else series
        self._version = version

    def catalogue(self):
        return self._catalogue

    def serie(self, indicateur, niveau, code):
        return self._series.get((indicateur, niveau, code))

    def version(self):
        return self._version


# Deux indicateurs : un petit montant (pour les cas ordinaires) et un montant
# proche de celui de la vraie analyse Défense (pour tester l'arrondi en
# milliards, cas 7).
CATALOGUE = {
    "test_indicateur": {"niveaux": ["pays"]},
    "second_indicateur": {"niveaux": ["pays"]},
}

SERIES = {
    ("test_indicateur", "pays", "FR"): {"2025": 1234.0},
    ("second_indicateur", "pays", "FR"): {"2025": 59946338573.0},
}


def analyse_conforme() -> dict:
    """Une analyse qui satisfait tous les contrôles — copie de travail à muter par test."""
    return {
        "slug": "test-analyse",
        "_fichier": "test-analyse.json",
        "titre": "Un chiffre, une lecture",
        "type": "decryptage",
        "publie_le": "2026-01-01",
        "themes": ["budget_etat"],
        "budgets_concernes": ["etat"],
        "mise_en_avant": False,
        "affirmation": {
            # Grand nombre délibérément sans rapport avec les chiffres publiés :
            # ce champ est exempté de la garde anti-invention (cas 7).
            "texte": "On entend parler de 987 654 321 euros, sans rapport avec les chiffres publiés.",
            "auteur": None,
            "date": None,
            "source": {
                "titre": "Exemple",
                "url": "https://example.invalid/source",
                "consulte_le": "2026-01-01",
            },
        },
        "verdict": {
            "cran": "exact",
            "phrase": "Le montant correspond aux 1 234 euros publiés.",
        },
        "chiffres": [
            {
                "dit": "environ 1 234 euros",
                "observe": {
                    "indicateur": "test_indicateur",
                    "niveau": "pays",
                    "code": "FR",
                    "periode": "2025",
                    "valeur": 1234.0,
                },
                "registre": "fait_comptable",
                "lecture": "Le montant publié pour l'exercice 2025.",
            }
        ],
        "hypotheses": [],
        "effets_indirects": [],
        "sources": [
            {
                "titre": "Exemple",
                "url": "https://example.invalid/source",
                "consulte_le": "2026-01-01",
            }
        ],
        "simulateur": {"budget": "", "contrat": "", "lecture": ""},
        "mises_a_jour": [],
        "verifie_contre": "",
    }


def fake_donnees(**kwargs) -> DonneesTest:
    return DonneesTest(**kwargs)


# 1. Une analyse conforme passe sans erreur.


def test_analyse_conforme_passe():
    analyse = analyse_conforme()
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 2. Un slug différent du nom de fichier échoue.


def test_slug_different_du_fichier_echoue():
    analyse = analyse_conforme()
    analyse["_fichier"] = "autre-nom.json"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "slug" for e in erreurs)


# 3. Un cran hors liste échoue.


def test_cran_hors_liste_echoue():
    analyse = analyse_conforme()
    analyse["verdict"]["cran"] = "scandaleux"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.cran" for e in erreurs)


# 4. cran = hors_perimetre sans confusion échoue ; confusion hors liste
#    échoue ; confusion présente sur un autre cran échoue.


def test_hors_perimetre_sans_confusion_echoue():
    analyse = analyse_conforme()
    analyse["verdict"]["cran"] = "hors_perimetre"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.confusion" for e in erreurs)


def test_confusion_hors_liste_echoue():
    analyse = analyse_conforme()
    analyse["verdict"]["cran"] = "hors_perimetre"
    analyse["verdict"]["confusion"] = "confusion_inventee"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.confusion" for e in erreurs)


def test_confusion_presente_sur_un_autre_cran_echoue():
    analyse = analyse_conforme()
    assert analyse["verdict"]["cran"] == "exact"
    analyse["verdict"]["confusion"] = "ae_cp"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.confusion" for e in erreurs)


# 5. Une observe.valeur qui diffère d'un centime de la valeur publiée échoue.


def test_valeur_differente_d_un_centime_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["valeur"] = 1234.01
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe.valeur" for e in erreurs)


# 6. Un indicateur absent du catalogue échoue ; un indicateur non publié à la
#    maille invoquée échoue.


def test_indicateur_absent_du_catalogue_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "indicateur_inconnu"
    erreurs = controler([analyse], fake_donnees())
    assert any("catalogue" in e.message for e in erreurs)


def test_indicateur_non_publie_a_la_maille_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["niveau"] = "departement"
    analyse["chiffres"][0]["observe"]["code"] = "33"
    # Le catalogue ne déclare "test_indicateur" qu'au niveau pays : la valeur
    # existe bien à ce niveau départemental (pour isoler ce contrôle de celui
    # de l'exactitude), mais le catalogue ne l'y autorise pas.
    donnees = fake_donnees(
        series={("test_indicateur", "departement", "33"): {"2025": 1234.0}},
    )
    erreurs = controler([analyse], donnees)
    assert any(e.champ.endswith("niveau") for e in erreurs)


# 7. Garde anti-invention : un nombre ≥ 1 000 dans titre / verdict.phrase /
#    lecture sans correspondance échoue ; un millésime ne déclenche pas
#    l'erreur ; un arrondi légitime en milliards est accepté ; un montant
#    formaté à la française sans correspondance échoue ; affirmation.texte
#    est exempté de la garde.


def test_montant_invente_dans_verdict_phrase_echoue():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant réel est de 4 500 000 euros, jamais publié."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_montant_invente_dans_titre_echoue():
    analyse = analyse_conforme()
    analyse["titre"] = "Un budget de 8 000 000 euros que personne n'a publié"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "titre" for e in erreurs)


def test_montant_invente_dans_lecture_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["lecture"] = "Un montant sans rapport : 12 345 678 euros."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].lecture" for e in erreurs)


def test_millesime_ne_declenche_pas_la_garde():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant correspond aux 1 234 euros publiés en 2025."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_montant_arrondi_en_milliards_est_accepte():
    # « 59,9 milliards » est une lecture arrondie légitime de 59 946 338 573 —
    # exactement le cas donné en exemple par le brief.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "second_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = 59946338573.0
    analyse["chiffres"][0]["dit"] = "environ 59,9 milliards d'euros"
    analyse["verdict"]["phrase"] = "Le montant correspond à 59,9 milliards d'euros publiés."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_montant_formate_a_la_francaise_sans_correspondance_echoue():
    # « 59 946,34 » — formaté à la française, mais sans mot d'échelle : lu
    # comme un montant brut en euros, il ne correspond à aucune observation
    # (la seule observation référencée vaut 1 234 €). C'est le cas que le
    # brief demande de refuser.
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant s'élèverait à 59 946,34 euros."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_affirmation_texte_est_exempte_de_la_garde():
    """Verrouille l'exemption : un très grand nombre dans affirmation.texte
    seul ne doit déclencher aucune erreur — c'est la citation de ce qui
    circule, pas une observation à référencer."""
    analyse = analyse_conforme()
    analyse["affirmation"]["texte"] = (
        "On parle parfois de 987 654 321 999 euros, un chiffre qui ne"
        " correspond à rien de publié."
    )
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 7bis. `M€` est reconnu comme marqueur d'échelle, au même titre que les mots
#       (le bug corrigé par la tâche 2 : le contrôle refusait la propre
#       notation d'affichage du site). Chaque cas reprend la table du brief,
#       référencée sur `second_indicateur` = 59 946 338 573 — le montant de
#       l'exemple Défense.


def _analyse_avec_verdict_defense(phrase: str) -> dict:
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "second_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = 59946338573.0
    analyse["chiffres"][0]["dit"] = "environ 59 946 M€"
    analyse["verdict"]["phrase"] = phrase
    return analyse


def test_montant_en_millions_mot_est_accepte():
    # Table du brief, ligne 1 : le mot « millions » était déjà reconnu.
    analyse = _analyse_avec_verdict_defense(
        "Le montant correspond à 59 946 millions d'euros publiés."
    )
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_montant_en_M_euros_espace_fine_insecable_est_accepte():
    # Table du brief, ligne 3 (le bug) : « 59 946 M€ » avec l'espace fine
    # insécable U+202F que `millions()` (echelle.ts) émet réellement comme
    # séparateur de milliers — un test à espace normale aurait passé alors
    # que le rendu réel échouait toujours, ce qui a laissé vivre le bug.
    phrase = "Le montant correspond à 59 946 M€ publiés."
    analyse = _analyse_avec_verdict_defense(phrase)
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_montant_en_M_euros_espace_normale_est_accepte():
    analyse = _analyse_avec_verdict_defense("Le montant correspond à 59 946 M€ publiés.")
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_montant_en_M_euros_sans_espace_est_accepte():
    analyse = _analyse_avec_verdict_defense("Le montant correspond à 59946M€ publiés.")
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_montant_en_M_euros_avec_decimales_est_accepte():
    # Table du brief, ligne 4 : même valeur, précision plus fine.
    analyse = _analyse_avec_verdict_defense("Le montant correspond à 59 946,34 M€ publiés.")
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_montant_invente_en_M_euros_echoue():
    # Table du brief, ligne 5 : reconnaître `M€` comme échelle ne dispense
    # pas de la correspondance — un montant en M€ qui ne correspond à aucune
    # référence reste refusé.
    analyse = _analyse_avec_verdict_defense(
        "Les opposants évoquent un total de 87 000 M€, jamais publié."
    )
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_millesime_dans_l_exercice_est_accepte():
    # Table du brief, ligne 6 : un millésime reste un millésime, avec ou
    # sans montant en M€ dans la même phrase.
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant correspond aux 1 234 euros publiés pour l'exercice 2025."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 8. Un registre valant donnee_officielle ou estimation_externe sans URL ni
#    date de consultation échoue.


def test_registre_officiel_sans_source_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "donnee_officielle"
    analyse["sources"] = []
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "sources" for e in erreurs)


def test_registre_estimation_externe_sans_url_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "estimation_externe"
    analyse["sources"] = [{"titre": "Exemple", "url": "", "consulte_le": ""}]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "sources" for e in erreurs)


def test_registre_officiel_avec_source_valide_passe():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "donnee_officielle"
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 9. Une analyse conforme rend verifie_contre égal à la version contrôlée.


def test_analyse_conforme_rend_verifie_contre():
    analyse = analyse_conforme()
    donnees = fake_donnees(version="2026-08-11T0807")
    controler([analyse], donnees)
    assert analyse["verifie_contre"] == "2026-08-11T0807"


def test_analyse_non_conforme_ne_rend_pas_verifie_contre():
    analyse = analyse_conforme()
    analyse["verdict"]["cran"] = "scandaleux"
    donnees = fake_donnees(version="2026-08-11T0807")
    controler([analyse], donnees)
    assert analyse["verifie_contre"] == ""


# 10. Critical 1 : un chiffre dont `observe` n'a ni indicateur ni niveau ni
#     code n'était vérifié nulle part — et sa `valeur`, jamais vérifiée,
#     alimentait quand même la garde anti-invention comme référence légitime.
#     Probe donnée verbatim par le brief.


def test_chiffre_sans_champs_identifiants_est_une_erreur():
    analyse = analyse_conforme()
    analyse["chiffres"][0] = {
        "dit": "environ 87 milliards",
        "observe": {"valeur": 87_000_000_000.0, "periode": "2025"},
        "registre": "fait_comptable",
        "lecture": "Le budget total.",
    }
    analyse["verdict"]["phrase"] = "Le budget atteint 87 000 M€ selon les comptes."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs != []
    assert analyse["verifie_contre"] == ""


def test_valeur_non_verifiee_ne_licencie_pas_la_prose():
    # Même probe, formulée comme régression ciblée : le champ manquant doit
    # lui-même être signalé (pas seulement « ailleurs »), et 87 000 M€ dans
    # verdict.phrase doit être refusé faute de référence vérifiée.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"] = {"valeur": 87_000_000_000.0, "periode": "2025"}
    analyse["verdict"]["phrase"] = "Le budget atteint 87 000 M€ selon les comptes."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe" for e in erreurs)
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_fait_comptable_sans_observe_est_une_erreur():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"] = None
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe" for e in erreurs)


# 11. Critical 2 : un séparateur de milliers non reconnu par le tokeniseur
#     fragmente un grand nombre en morceaux sous le seuil, qui passent
#     inaperçus. Table du brief, reproduite verbatim.


def test_montant_groupe_par_points_est_refuse():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant atteint 87.000.000.000 euros."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_montant_groupe_par_virgules_est_refuse():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant atteint 87,000,000,000 euros."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_montant_groupe_par_apostrophes_est_refuse():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant atteint 87'000'000'000 euros."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_montant_groupe_par_espaces_reste_refuse_pour_la_bonne_raison():
    # Ligne REFUSÉ de la table du brief : déjà correcte avant ce correctif,
    # verrouillée en régression pour ne pas dépendre d'un accident de
    # tokenisation plutôt que de l'absence de correspondance.
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant atteint 87 000 000 000 euros."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_decimale_francaise_simple_reste_lisible():
    # Garde-fou explicite du brief : une seule virgule reste un séparateur
    # décimal légitime, jamais un séparateur de milliers illisible.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "second_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = 59946338573.0
    analyse["verdict"]["phrase"] = "Le montant correspond à 59,9 milliards d'euros publiés."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 12. Critical 3 : un répertoire inexistant, ou sans aucune analyse, doit
#     faire échouer main() plutôt que sortir 0 sans avoir rien contrôlé.


def test_main_repertoire_inexistant_echoue(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["controle_analyses", str(tmp_path / "n-existe-pas")])
    assert main() == 1


def test_main_repertoire_vide_echoue(tmp_path, monkeypatch):
    monkeypatch.setattr(sys, "argv", ["controle_analyses", str(tmp_path)])
    assert main() == 1


# 15. Important 6 : `observe` est interdit pour resultat_simulation,
#     hypothese et interpretation ; optionnel (mais vérifié si présent) pour
#     donnee_officielle et estimation_externe ; obligatoire pour
#     fait_comptable.


def test_resultat_simulation_avec_observe_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe" for e in erreurs)


def test_hypothese_avec_observe_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "hypothese"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe" for e in erreurs)


def test_interpretation_avec_observe_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "interpretation"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe" for e in erreurs)


def test_resultat_simulation_sans_observe_passe():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    analyse["chiffres"][0]["observe"] = None
    analyse["verdict"]["phrase"] = "Le simulateur produit ce résultat sous ces réglages."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_donnee_officielle_sans_observe_passe_si_source():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "donnee_officielle"
    analyse["chiffres"][0]["observe"] = None
    analyse["verdict"]["phrase"] = (
        "Le montant correspond à la donnée publiée par la source citée."
    )
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_donnee_officielle_avec_observe_faux_echoue():
    # « portent une source vérifiable » ne dispense pas d'être juste quand
    # l'auteur choisit quand même de citer une observation.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "donnee_officielle"
    analyse["chiffres"][0]["observe"]["valeur"] = 1234.01
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe.valeur" for e in erreurs)
