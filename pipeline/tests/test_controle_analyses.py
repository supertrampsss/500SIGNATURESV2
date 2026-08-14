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


# Trois indicateurs : un petit montant (pour les cas ordinaires), un montant
# proche de celui de la vraie analyse Défense (pour tester l'arrondi en
# milliards, cas 7) et sa version négative (pour le signe, cas Important C).
CATALOGUE = {
    "test_indicateur": {"niveaux": ["pays"]},
    "second_indicateur": {"niveaux": ["pays"]},
    "troisieme_indicateur": {"niveaux": ["pays"]},
}

SERIES = {
    ("test_indicateur", "pays", "FR"): {"2025": 1234.0},
    ("second_indicateur", "pays", "FR"): {"2025": 59946338573.0},
    ("troisieme_indicateur", "pays", "FR"): {"2025": -59946338573.0},
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
            "texte": "On entend parler de 987 654 321 euros, sans rapport avec les chiffres"
            " publiés.",
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
    analyse["verdict"]["phrase"] = (
        "Le montant correspond aux 1 234 euros publiés pour l'exercice 2025."
    )
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
    # `dit` doit s'accorder avec `observe.valeur` (famille 6, revision
    # Critical finale).
    analyse["chiffres"][0]["dit"] = "environ 59,9 milliards d'euros"
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


# 13. Important 4 : champs obligatoires, `chiffres` non vide, dates valides
#     (§15.3.1).


def test_champs_obligatoires_manquants_echouent():
    analyse = analyse_conforme()
    for champ in [
        "titre",
        "publie_le",
        "themes",
        "budgets_concernes",
        "mise_en_avant",
        "hypotheses",
        "effets_indirects",
        "sources",
        "simulateur",
        "mises_a_jour",
        "verifie_contre",
    ]:
        del analyse[champ]
    donnees = fake_donnees(version="2026-08-11T0807")
    erreurs = controler([analyse], donnees)
    assert erreurs != []
    assert analyse.get("verifie_contre") != "2026-08-11T0807"


def test_chiffres_absent_echoue():
    analyse = analyse_conforme()
    del analyse["chiffres"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres" for e in erreurs)


def test_chiffres_vide_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"] = []
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres" for e in erreurs)


def test_publie_le_invalide_echoue():
    analyse = analyse_conforme()
    analyse["publie_le"] = "pas-une-date"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "publie_le" for e in erreurs)


def test_affirmation_date_invalide_echoue():
    analyse = analyse_conforme()
    analyse["affirmation"]["auteur"] = "Quelqu'un"
    analyse["affirmation"]["date"] = "2026-13-40"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "affirmation.date" for e in erreurs)


def test_affirmation_date_nulle_reste_valide():
    analyse = analyse_conforme()
    assert analyse["affirmation"]["date"] is None
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_consulte_le_invalide_echoue():
    analyse = analyse_conforme()
    analyse["sources"][0]["consulte_le"] = "14/08/2026"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "sources[0].consulte_le" for e in erreurs)


def test_mises_a_jour_date_invalide_echoue():
    analyse = analyse_conforme()
    analyse["mises_a_jour"] = [{"date": "2026-02-30", "quoi": "Correction"}]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "mises_a_jour[0].date" for e in erreurs)


# 14. Important 5 : la garde anti-invention scanne aussi `hypotheses[]` et
#     `simulateur.lecture`.


def test_montant_invente_dans_hypotheses_echoue():
    analyse = analyse_conforme()
    analyse["hypotheses"] = [
        "Hors du périmètre habituel, soit 45 000 000 000 euros non publiés."
    ]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "hypotheses[0]" for e in erreurs)


def test_montant_invente_dans_simulateur_lecture_echoue():
    analyse = analyse_conforme()
    analyse["simulateur"]["lecture"] = (
        "Réglez le curseur sur 45 000 000 000 euros pour reproduire ce calcul."
    )
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "simulateur.lecture" for e in erreurs)


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


def test_resultat_simulation_sans_observe_ni_valeur_echoue():
    """Révision Critical B : cette fonction s'appelait
    `test_resultat_simulation_sans_observe_passe` et verrouillait
    `erreurs == []` ici — c'était le défaut (un `dit` non vérifié, affiché
    quand même comme un résultat du simulateur), pas la règle. Sans `observe`
    ET sans `valeur` déclarée, ce chiffre n'est vérifié par rien : c'est
    maintenant une erreur, symétrique à `test_resultat_simulation_avec_valeur_et_budget_entre_dans_les_references`
    (section 22) qui verrouille le cas qui passe."""
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    analyse["chiffres"][0]["observe"] = None
    analyse["verdict"]["phrase"] = "Le simulateur produit ce résultat sous ces réglages."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].valeur" for e in erreurs)


def test_hypothese_sans_observe_ni_valeur_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "hypothese"
    analyse["chiffres"][0]["observe"] = None
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].valeur" for e in erreurs)


def test_interpretation_sans_observe_ni_valeur_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "interpretation"
    analyse["chiffres"][0]["observe"] = None
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].valeur" for e in erreurs)


def test_donnee_officielle_sans_observe_passe_si_source_et_valeur():
    """Révision Critical (finale) : cette fonction s'appelait
    `test_donnee_officielle_sans_observe_passe_si_source` et ne déclarait
    aucune `valeur` — c'était le défaut (un `dit` non vérifié par rien),
    exactement symétrique au défaut fermé par Critical B pour
    `resultat_simulation`/`hypothese`/`interpretation`. Sans `observe` ET sans
    `valeur`, ce chiffre n'a aucun nombre que le contrôle connaît ; `valeur`
    est donc désormais obligatoire ici aussi, en plus de la source déjà
    exigée."""
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "donnee_officielle"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = 1234.0
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


# 16. Critical A / Important D : le tokeniseur reconnaît TOUTE espace
#     horizontale comme séparateur de milliers légitime, et TOUTE autre
#     ponctuation de groupement (points, apostrophes sous toutes leurs
#     formes, point médian, joints invisibles) comme un séparateur non
#     reconnu qui rend le token illisible plutôt que de le fragmenter en
#     silence. Table plutôt que trois instances (Important D) : la
#     référence vaut exactement 59946338573.0, donc les chiffres concaténés
#     de « 59{sep}946{sep}338{sep}573 » redonneraient exactement la
#     référence si le drapeau `lisible` était supprimé — seul ce drapeau
#     fait échouer ce test, pas l'absence de correspondance numérique.

_SEPARATEURS_ILLISIBLES = {
    "apostrophe ASCII '": "'",
    "apostrophe typographique U+2019 ’": "’",
    "lettre modificative U+02BC ʼ": "ʼ",
    "point .": ".",
    "point médian U+00B7 ·": "·",
    "soudeur de mots U+2060 (invisible)": "⁠",
    "espace de largeur nulle U+200B (invisible)": "​",
}

_SEPARATEURS_LISIBLES = {
    "espace normale U+0020": " ",
    "espace insécable U+00A0": " ",
    "espace cadratin U+2002": " ",
    "espace demi-cadratin U+2003": " ",
    "espace tabulaire U+2007": " ",
    "espace fine U+2009": " ",
    "espace fine insécable U+202F": " ",
    "espace mathématique moyenne U+205F": " ",
}


def _analyse_avec_second_indicateur_et_phrase(phrase: str) -> dict:
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "second_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = 59946338573.0
    # `dit` doit s'accorder avec `observe.valeur` (famille 6, revision
    # Critical finale) : le `dit` par défaut de `analyse_conforme`
    # (« environ 1 234 euros ») ne le fait plus une fois l'indicateur changé.
    analyse["chiffres"][0]["dit"] = "environ 59,9 milliards d'euros"
    analyse["verdict"]["phrase"] = phrase
    return analyse


def test_separateurs_illisibles_sont_tous_refuses():
    for nom, sep in _SEPARATEURS_ILLISIBLES.items():
        phrase = f"Le montant atteint 59{sep}946{sep}338{sep}573 euros."
        analyse = _analyse_avec_second_indicateur_et_phrase(phrase)
        erreurs = controler([analyse], fake_donnees())
        assert any(e.champ == "verdict.phrase" for e in erreurs), (
            f"{nom} aurait dû être refusé (phrase : « {phrase} »)"
        )


def test_separateurs_lisibles_sont_tous_acceptes():
    for nom, sep in _SEPARATEURS_LISIBLES.items():
        phrase = f"Le montant atteint 59{sep}946{sep}338{sep}573 euros."
        analyse = _analyse_avec_second_indicateur_et_phrase(phrase)
        erreurs = controler([analyse], fake_donnees())
        assert erreurs == [], f"{nom} aurait dû être accepté : {erreurs}"


# 17. Important 3 (numérotation du brief : bloc « Important C ») : une
#     partie décimale qui contient elle-même un séparateur ne doit ni lever
#     ni être acceptée telle quelle.


def test_decimale_avec_separateur_ne_leve_pas_et_reste_refusee():
    # « 1 234,5 678 » : une seule virgule (donc « lisible » avant ce
    # correctif) mais une espace dans la partie décimale — float("1234.5
    # 678") levait ValueError et tuait tout le run, laissant les analyses
    # suivantes non contrôlées.
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Le montant s'élèverait à 1 234,5 678 euros."
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ == "verdict.phrase" for e in erreurs)


# 18. Important F : le message d'un token illisible cite le token brut, pas
#     une valeur reconstruite que l'auteur n'a jamais écrite.


def test_message_illisible_cite_le_token_brut_pas_une_valeur_inventee():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Voir la section 15.3.1 du document."
    erreurs = controler([analyse], fake_donnees())
    messages = [e.message for e in erreurs if e.champ == "verdict.phrase"]
    assert messages, "le token illisible aurait dû être signalé"
    assert "15.3.1" in messages[0]
    assert "1531" not in messages[0]


# 19. Critical B : un champ liste donné comme une chaîne (ou tout autre
#     type) doit être une erreur — pas un skip silencieux qui prive la garde
#     anti-invention de ses éléments (`hypotheses` comme chaîne fait
#     `enumerate()` caractère par caractère, aucun regroupement de chiffres
#     n'atteint alors jamais le seuil).


def test_hypotheses_chaine_est_une_erreur():
    analyse = analyse_conforme()
    analyse["hypotheses"] = "45 000 000 000 euros"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "hypotheses" for e in erreurs)
    assert analyse["verifie_contre"] == ""


def test_hypotheses_element_non_chaine_est_une_erreur():
    analyse = analyse_conforme()
    analyse["hypotheses"] = [123]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "hypotheses" for e in erreurs)


def test_champs_listes_donnes_comme_chaine_sont_des_erreurs():
    for champ, mauvaise_valeur in [
        ("themes", "budget_etat"),
        ("budgets_concernes", "etat"),
        ("sources", "https://example.invalid"),
        ("effets_indirects", "texte"),
        ("mises_a_jour", "texte"),
        ("chiffres", "texte"),
    ]:
        analyse = analyse_conforme()
        analyse[champ] = mauvaise_valeur
        erreurs = controler([analyse], fake_donnees())
        assert any(e.champ == champ for e in erreurs), f"{champ} aurait dû être une erreur"


def test_sources_element_non_objet_est_une_erreur():
    analyse = analyse_conforme()
    analyse["sources"] = ["https://example.invalid"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "sources" for e in erreurs)


def test_chiffres_element_non_objet_est_une_erreur():
    analyse = analyse_conforme()
    analyse["chiffres"] = ["texte"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres" for e in erreurs)


# 20. Important E : la présence seule d'un champ obligatoire ne suffit pas —
#     il doit être non vide et du bon type. Une date manquante dans
#     `mises_a_jour` ou `sources` est une erreur, pas un skip.


def test_titre_nul_est_une_erreur():
    analyse = analyse_conforme()
    analyse["titre"] = None
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "titre" for e in erreurs)
    assert analyse["verifie_contre"] == ""


def test_titre_vide_est_une_erreur():
    analyse = analyse_conforme()
    analyse["titre"] = ""
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "titre" for e in erreurs)


def test_publie_le_nul_est_une_erreur():
    analyse = analyse_conforme()
    analyse["publie_le"] = None
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "publie_le" for e in erreurs)


def test_affirmation_liste_au_lieu_d_objet_est_une_erreur():
    analyse = analyse_conforme()
    analyse["affirmation"] = []
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "affirmation" for e in erreurs)


def test_mises_a_jour_sans_date_est_une_erreur():
    analyse = analyse_conforme()
    analyse["mises_a_jour"] = [{"quoi": "Correction"}]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "mises_a_jour[0].date" for e in erreurs)


def test_sources_sans_consulte_le_est_une_erreur():
    analyse = analyse_conforme()
    analyse["sources"][0]["consulte_le"] = None
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "sources[0].consulte_le" for e in erreurs)


def test_mise_en_avant_false_reste_valide():
    # Garde-fou explicite : un booléen n'a pas d'« état vide », `false` est
    # une valeur aussi licite que `true` — ne doit jamais être confondu avec
    # un champ manquant.
    analyse = analyse_conforme()
    analyse["mise_en_avant"] = False
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 21. Minor : `affirmation.date` n'est nulle licitement que si `auteur`
#     l'est aussi.


def test_affirmation_auteur_sans_date_est_une_erreur():
    analyse = analyse_conforme()
    analyse["affirmation"]["auteur"] = "Quelqu'un"
    analyse["affirmation"]["date"] = None
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "affirmation.date" for e in erreurs)


# 22. Important G (revision de Important 6) : `observe` reste interdit pour
#     resultat_simulation / hypothese / interpretation, mais une `valeur`
#     déclarée au niveau du chiffre y est licite et entre dans la liste de
#     référence — la prose peut alors citer ce chiffre. resultat_simulation
#     exige en plus `simulateur.budget` non vide.


def test_resultat_simulation_avec_valeur_et_budget_entre_dans_les_references():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = 12300.0
    # `dit` doit s'accorder avec la `valeur` propre à ce chiffre (famille 6,
    # revision Critical finale) : le `dit` par défaut de `analyse_conforme`
    # (« environ 1 234 euros ») ne le fait plus.
    analyse["chiffres"][0]["dit"] = "environ 12 300 euros selon le simulateur"
    analyse["simulateur"]["budget"] = "etat"
    analyse["verdict"]["phrase"] = "Le simulateur produit 12 300 euros sous ces réglages."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_resultat_simulation_avec_valeur_sans_budget_echoue():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = 12300.0
    analyse["simulateur"]["budget"] = ""
    analyse["verdict"]["phrase"] = "Le simulateur produit 12 300 euros sous ces réglages."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].valeur" for e in erreurs)


def test_hypothese_avec_valeur_entre_dans_les_references():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "hypothese"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = 12300.0
    analyse["chiffres"][0]["dit"] = "environ 12 300 euros sous cette hypothèse"
    analyse["verdict"]["phrase"] = "Sous cette hypothèse, le montant atteindrait 12 300 euros."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_interpretation_avec_valeur_entre_dans_les_references():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "interpretation"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = 12300.0
    analyse["chiffres"][0]["dit"] = "environ 12 300 euros selon cette lecture"
    analyse["verdict"]["phrase"] = "Cette lecture chiffre l'effet à 12 300 euros."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_chiffre_valeur_type_invalide_est_une_erreur():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "hypothese"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = "12300"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].valeur" for e in erreurs)


def test_resultat_simulation_observe_et_valeur_tous_deux_signales():
    # `observe` reste interdit même quand `valeur` est déclaré : les deux
    # contrôles sont indépendants, pas mutuellement exclusifs.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    analyse["chiffres"][0]["valeur"] = 12300.0
    analyse["simulateur"]["budget"] = "etat"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].observe" for e in erreurs)


# 23. Minor : `observe` mal typé ne doit jamais lever avant que le type
#     erroné soit signalé — ni dans `_erreurs_catalogue`, ni dans
#     `_erreurs_invention`.


def test_observe_texte_ne_leve_pas_et_reste_une_erreur():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"] = "texte"
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ == "chiffres[0].observe" for e in erreurs)


# 24. Critical A : `effets_indirects[].texte` est rendu sur la page
#     (site/src/analyse-rendu.ts, étage 2) avec un auteur et une source — la
#     forme d'une citation fabriquée. Un montant inventé y est refusé comme
#     dans les autres champs de prose ; une valeur adossée à un chiffre
#     référencé y est acceptée.


def _effet_indirect(texte: str) -> dict:
    return {
        "texte": texte,
        "auteur": "Un organisme cité",
        "source": {
            "titre": "Exemple",
            "url": "https://example.invalid/effet",
            "consulte_le": "2026-01-01",
        },
    }


def test_montant_invente_dans_effets_indirects_texte_echoue():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [
        _effet_indirect("Cela entraînerait une économie de 45 000 000 000 euros, jamais publiée.")
    ]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "effets_indirects[0].texte" for e in erreurs)


def test_montant_reference_dans_effets_indirects_texte_est_accepte():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [_effet_indirect("Cela représente environ 1 234 euros publiés.")]
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 25. Important C : le signe fait partie du montant. Probe verbatim du
#     brief : un écart affiché négatif ne doit jamais correspondre à une
#     référence positive. Le tiret d'une plage de dates ou d'une référence
#     légale, précédé d'un chiffre, n'est jamais lu comme un signe.


def test_signe_negatif_non_capture_etait_le_bug_ecart_positif_rejete():
    analyse = _analyse_avec_verdict_defense("L'écart est de -59 946 M€.")
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_signe_negatif_correspond_a_une_reference_negative():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "troisieme_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = -59946338573.0
    analyse["chiffres"][0]["dit"] = "environ -59,9 milliards d'euros"
    analyse["verdict"]["phrase"] = "L'écart est de -59 946 M€ publié."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_signe_vrai_moins_u2212_est_reconnu():
    # Le vrai signe moins U+2212, que certains traitements de texte
    # substituent au tiret ASCII.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "troisieme_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = -59946338573.0
    analyse["chiffres"][0]["dit"] = "environ −59,9 milliards d'euros"
    analyse["verdict"]["phrase"] = "L'écart est de −59 946 M€ publié."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_plage_millesimes_avec_tiret_reste_deux_nombres_positifs():
    # « 2019-2025 » : le tiret est précédé d'un chiffre (le « 9 » de 2019),
    # donc ce n'est jamais un signe — les deux millésimes restent positifs
    # et exemptés par la règle du millésime, indépendamment du signe.
    analyse = _analyse_avec_verdict_defense(
        "Sur la période 2019-2025, le montant correspond à 59 946 M€ publiés."
    )
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_reference_legale_avec_tiret_ne_declenche_pas_la_garde():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = "Voir l'article L. 132-1 du code applicable."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 26. Important D : les sous-champs obligatoires du schéma, jusqu'ici
#     vérifiés nulle part — leur absence ne faisait échouer que le
#     pré-rendu du site (TypeError), pas ce contrôle. Table verbatim du
#     brief.


def test_verdict_phrase_absente_echoue():
    analyse = analyse_conforme()
    del analyse["verdict"]["phrase"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_affirmation_texte_absent_echoue():
    analyse = analyse_conforme()
    del analyse["affirmation"]["texte"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "affirmation.texte" for e in erreurs)


def test_chiffres_lecture_absente_echoue():
    analyse = analyse_conforme()
    del analyse["chiffres"][0]["lecture"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].lecture" for e in erreurs)


def test_chiffres_dit_absent_echoue():
    analyse = analyse_conforme()
    del analyse["chiffres"][0]["dit"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].dit" for e in erreurs)


def test_sources_url_absente_echoue():
    analyse = analyse_conforme()
    del analyse["sources"][0]["url"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "sources[0].url" for e in erreurs)


def test_simulateur_remplace_par_un_objet_hors_schema_echoue():
    analyse = analyse_conforme()
    analyse["simulateur"] = {"x": 1}
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "simulateur.budget" for e in erreurs)
    assert any(e.champ == "simulateur.contrat" for e in erreurs)
    assert any(e.champ == "simulateur.lecture" for e in erreurs)


def test_budgets_concernes_hors_liste_echoue():
    analyse = analyse_conforme()
    analyse["budgets_concernes"] = ["martiens"]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "budgets_concernes[0]" for e in erreurs)


# 27. Minor 4 : la vague précédente ne testait que `{"etat"}` — narrower la
#     liste `BUDGETS` à ce seul budget passait toute la suite. Les trois
#     autres budgets doivent être acceptés.


def test_budgets_concernes_accepte_les_autres_budgets():
    for budget in ("secu", "collectivites", "bareme"):
        analyse = analyse_conforme()
        analyse["budgets_concernes"] = [budget]
        erreurs = controler([analyse], fake_donnees())
        assert not any(e.champ.startswith("budgets_concernes") for e in erreurs), (
            f"{budget} aurait dû être accepté, erreurs : {erreurs}"
        )


# 28. Important 3 : les sous-champs de `effets_indirects` — `texte`, `auteur`
#     et `source` (avec `titre`/`url`) — étaient déclarés obligatoires par le
#     schéma mais jamais vérifiés. Le rendu (étage 2) écrit alors `undefined`
#     dans le slot même qu'une citation fabriquée occuperait (Critical A).


def test_effets_indirects_sans_texte_echoue():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [
        {
            "texte": "",
            "auteur": "Un organisme",
            "source": {
                "titre": "Exemple",
                "url": "https://example.invalid/effet",
                "consulte_le": "2026-01-01",
            },
        }
    ]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "effets_indirects[0].texte" for e in erreurs)


def test_effets_indirects_sans_auteur_echoue():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [
        {
            "texte": "Une conséquence rapportée.",
            "source": {
                "titre": "Exemple",
                "url": "https://example.invalid/effet",
                "consulte_le": "2026-01-01",
            },
        }
    ]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "effets_indirects[0].auteur" for e in erreurs)


def test_effets_indirects_sans_source_echoue():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [
        {"texte": "Une conséquence rapportée.", "auteur": "Un organisme"}
    ]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "effets_indirects[0].source" for e in erreurs)


def test_effets_indirects_source_sans_titre_ni_url_echoue():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [
        {
            "texte": "Une conséquence rapportée.",
            "auteur": "Un organisme",
            "source": {"titre": "", "url": "", "consulte_le": "2026-01-01"},
        }
    ]
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "effets_indirects[0].source.titre" for e in erreurs)
    assert any(e.champ == "effets_indirects[0].source.url" for e in erreurs)


def test_effets_indirects_complet_passe():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [_effet_indirect("Cela représente environ 1 234 euros publiés.")]
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 29. Important 2 (revision) : une classe entière de fail-hard fermait déjà
#     le tokeniseur (vague 3) ; cette vague ajoutait une sixième instance
#     (`effets_indirects[].texte`) plutôt que de fermer la classe elle-même.
#     Chaque champ scanné par la famille 4 doit tolérer un type invalide —
#     jamais lever — et le signaler comme une erreur du contrôle.


def test_titre_type_invalide_ne_leve_pas_et_reste_une_erreur():
    analyse = analyse_conforme()
    analyse["titre"] = ["pas une chaîne"]
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ == "titre" for e in erreurs)


def test_verdict_phrase_type_invalide_ne_leve_pas_et_reste_une_erreur():
    analyse = analyse_conforme()
    analyse["verdict"]["phrase"] = 12345
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_chiffres_lecture_type_invalide_ne_leve_pas_et_reste_une_erreur():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["lecture"] = {"pas": "une chaîne"}
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ == "chiffres[0].lecture" for e in erreurs)


def test_simulateur_lecture_type_invalide_ne_leve_pas_et_reste_une_erreur():
    analyse = analyse_conforme()
    analyse["simulateur"]["lecture"] = 42
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ == "simulateur.lecture" for e in erreurs)


def test_effets_indirects_texte_type_invalide_ne_leve_pas_et_reste_une_erreur():
    analyse = analyse_conforme()
    analyse["effets_indirects"] = [
        {
            "texte": 45000000000,
            "auteur": "Un organisme",
            "source": {
                "titre": "Exemple",
                "url": "https://example.invalid/effet",
                "consulte_le": "2026-01-01",
            },
        }
    ]
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ == "effets_indirects[0].texte" for e in erreurs)


def test_simulateur_non_dict_ne_leve_pas_et_reste_une_erreur():
    # `simulateur` mal typé faisait lever AttributeError sur `.get("lecture")`
    # dans la famille 4 (`_erreurs_schema` était déjà protégée).
    analyse = analyse_conforme()
    analyse["simulateur"] = "pas un objet"
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever
    assert any(e.champ.startswith("simulateur.") for e in erreurs)


# 30. Important 1 (revision du signe, Important C) : la vague précédente ne
#     couvrait que `-` ASCII et U+2212. « – » (U+2013) et « — » (U+2014), la
#     substitution la plus courante d'un traitement de texte, passaient un
#     écart négatif comme une valeur positive ; un espace entre le signe et
#     le nombre n'était pas davantage reconnu.


def test_tiret_demi_cadratin_u2013_est_reconnu_comme_signe():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "troisieme_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = -59946338573.0
    analyse["chiffres"][0]["dit"] = "environ –59,9 milliards d'euros"
    analyse["verdict"]["phrase"] = "L'écart est de –59 946 M€ publié."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_tiret_demi_cadratin_u2013_contre_reference_positive_echoue():
    # Probe verbatim du brief : « –59 946 M€ » (U+2013) contre une référence
    # positive ne doit jamais correspondre.
    analyse = _analyse_avec_verdict_defense("L'écart est de –59 946 M€.")
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_tiret_cadratin_u2014_contre_reference_positive_echoue():
    # Probe verbatim du brief : « —59 946 M€ » (U+2014).
    analyse = _analyse_avec_verdict_defense("L'écart est de —59 946 M€.")
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_signe_suivi_d_une_espace_avant_le_nombre_est_reconnu():
    # Probe verbatim du brief : « - 59 946 M€ » (espace entre le signe et le
    # nombre) contre une référence positive ne doit jamais correspondre.
    analyse = _analyse_avec_verdict_defense("L'écart est de - 59 946 M€.")
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "verdict.phrase" for e in erreurs)


def test_signe_suivi_d_une_espace_correspond_a_une_reference_negative():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["observe"]["indicateur"] = "troisieme_indicateur"
    analyse["chiffres"][0]["observe"]["valeur"] = -59946338573.0
    analyse["chiffres"][0]["dit"] = "environ - 59,9 milliards d'euros"
    analyse["verdict"]["phrase"] = "L'écart est de - 59 946 M€ publié."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_plage_millesimes_avec_tiret_demi_cadratin_reste_deux_nombres_positifs():
    # Le tiret de plage reste `-` ASCII dans la pratique, mais la garde ne
    # doit pas non plus casser un vrai tiret demi-cadratin précédé d'un
    # chiffre (même raisonnement que pour `-`) : « 2019–2025 ».
    analyse = _analyse_avec_verdict_defense(
        "Sur la période 2019–2025, le montant correspond à 59 946 M€ publiés."
    )
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


# 31. Critical (revision finale) : chaque `chiffre` porte exactement un
#     nombre que le contrôle connaît — `observe` vérifiée ou `valeur`
#     déclarée — jamais aucun des deux ; et tout nombre écrit dans `dit` doit
#     s'accorder avec le nombre propre à ce chiffre, jamais avec la liste
#     entière des références. Les deux probes verbatim du brief.


def test_probe_resultat_simulation_valeur_sans_rapport_avec_dit_echoue():
    # Probe 1 du brief : registre resultat_simulation, valeur: 1234.0,
    # simulateur.budget: "etat", dit: "environ 45 milliards d'euros" — la
    # vague précédente acceptait ce chiffre et le rendu affichait `dit` nu.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = 1234.0
    analyse["chiffres"][0]["dit"] = "environ 45 milliards d'euros"
    analyse["simulateur"]["budget"] = "etat"
    analyse["verdict"]["phrase"] = "Le simulateur produit ce résultat sous ces réglages."
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].dit" for e in erreurs)


def test_probe_donnee_officielle_sans_observe_ni_valeur_echoue():
    # Probe 2 du brief : registre donnee_officielle, observe absent, aucune
    # valeur, dit: "45 000 000 000 euros" — la vague précédente acceptait ce
    # chiffre faute de vérifier `valeur` quand `observe` est absent pour ce
    # registre.
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "donnee_officielle"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["dit"] = "45 000 000 000 euros"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].valeur" for e in erreurs)


def test_dit_qui_contredit_observe_echoue_meme_si_observe_est_juste():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["dit"] = "environ 45 milliards d'euros"
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[0].dit" for e in erreurs)


def test_dit_arrondit_legitimement_le_nombre_propre_est_accepte():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["registre"] = "resultat_simulation"
    analyse["chiffres"][0]["observe"] = None
    analyse["chiffres"][0]["valeur"] = 59946338573.0
    analyse["chiffres"][0]["dit"] = "environ 59,9 milliards d'euros"
    analyse["simulateur"]["budget"] = "etat"
    analyse["verdict"]["phrase"] = "Le simulateur produit ce résultat sous ces réglages."
    erreurs = controler([analyse], fake_donnees())
    assert erreurs == []


def test_dit_ne_compare_qu_a_son_propre_chiffre_meme_valide_ailleurs():
    """Verrouille : `dit` est comparé au nombre de SON chiffre, jamais à la
    liste entière des références (contrairement à la famille 4). 1234 est
    une référence légitime ailleurs dans cette analyse (le nombre propre du
    chiffre 0), mais le nombre propre du chiffre 1 est 59 946 338 573 —
    citer le nombre du chiffre 0 dans le `dit` du chiffre 1 doit échouer,
    même si la famille 4 seule l'aurait accepté."""
    analyse = analyse_conforme()
    analyse["chiffres"].append(
        {
            "dit": "environ 1234 euros",  # le nombre du chiffre 0, pas le sien
            "observe": {
                "indicateur": "second_indicateur",
                "niveau": "pays",
                "code": "FR",
                "periode": "2025",
                "valeur": 59946338573.0,
            },
            "registre": "fait_comptable",
            "lecture": "Un second chiffre, sans rapport avec le premier.",
        }
    )
    erreurs = controler([analyse], fake_donnees())
    assert any(e.champ == "chiffres[1].dit" for e in erreurs)


def test_dit_type_invalide_ne_leve_pas():
    analyse = analyse_conforme()
    analyse["chiffres"][0]["dit"] = 1234
    erreurs = controler([analyse], fake_donnees())  # ne doit pas lever ; déjà
    # signalé par la famille 1 (Important D), pas re-signalé ici.
    assert any(e.champ == "chiffres[0].dit" for e in erreurs)
