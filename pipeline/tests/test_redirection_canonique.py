"""Défauts d'infrastructure impossibles à couvrir par un parcours de lecteur :

ne jamais remplacer les autres règles, ne pas dupliquer la nôtre au redéploiement,
réparer une règle désactivée et refuser une relecture divergente de Cloudflare.
Le comportement HTTP est contrôlé séparément sur la production réelle.
"""

from copy import deepcopy

import pytest

from plateforme.redirection_canonique import assurer_redirection


class FauxCloudflare:
    def __init__(self, regles=None, divergence=False):
        self.regles = deepcopy(regles)
        self.divergence = divergence
        self.mutations = []

    def appeler(self, chemin, methode="GET", corps=None):
        assert chemin == "/projects/plateforme/domains/www.500signatures.fr"
        return {"zone_tag": "zone-1", "name": "www.500signatures.fr"}

    def appeler_global(self, chemin, methode="GET", corps=None):
        if methode == "GET":
            if chemin == "/zones/zone-1/rulesets":
                return [] if self.regles is None else [
                    {"id": "rs-1", "kind": "zone", "phase": "http_request_dynamic_redirect"}
                ]
            assert chemin == "/zones/zone-1/rulesets/rs-1"
            regles = deepcopy(self.regles)
            if self.divergence:
                regles[0]["enabled"] = False
            return {"id": "rs-1", "rules": regles}
        self.mutations.append((chemin, methode, deepcopy(corps)))
        if chemin == "/zones/zone-1/rulesets" and methode == "POST":
            self.regles = [{**corps["rules"][0], "id": "ours"}]
        elif chemin.endswith("/rules") and methode == "POST":
            regle = {k: v for k, v in corps.items() if k != "position"}
            self.regles.insert(0, {**regle, "id": "ours"})
        elif chemin.endswith("/rules/ours") and methode == "PATCH":
            regle = {k: v for k, v in corps.items() if k != "position"}
            self.regles = [{**regle, "id": "ours"}] + [
                item for item in self.regles if item["id"] != "ours"
            ]
        else:
            raise AssertionError((chemin, methode, corps))
        return {"id": "rs-1", "rules": deepcopy(self.regles)}


def test_premiere_creation_et_redeployment_ne_duplique_pas_la_regle():
    api = FauxCloudflare()
    assurer_redirection(api)
    assert len(api.mutations) == 1
    regle = api.regles[0]
    assert regle["expression"] == '(http.host eq "www.500signatures.fr")'
    valeur = regle["action_parameters"]["from_value"]
    assert valeur["status_code"] == 301
    assert valeur["preserve_query_string"] is True
    assert valeur["target_url"]["expression"] == (
        'concat("https://500signatures.fr", http.request.uri.path)'
    )
    assurer_redirection(api)
    assert len(api.mutations) == 1


def test_ajout_conserve_les_regles_existantes_et_prend_la_premiere_position():
    existante = {"id": "autre", "ref": "autre", "action": "redirect", "enabled": True}
    api = FauxCloudflare([existante])
    assurer_redirection(api)
    assert api.regles[1] == existante
    assert api.mutations[0][1] == "POST"
    assert api.mutations[0][2]["position"] == {"index": 1}


def test_repare_notre_regle_desactivee_sans_remplacer_les_autres():
    api = FauxCloudflare()
    assurer_redirection(api)
    autre = {"id": "autre", "ref": "autre", "action": "redirect"}
    api.regles[0]["enabled"] = False
    api.regles.insert(0, autre)
    assurer_redirection(api)
    assert api.mutations[-1][0].endswith("/rules/ours")
    assert api.mutations[-1][1] == "PATCH"
    assert api.regles[0]["enabled"] is True
    assert api.regles[1] == autre


def test_relecture_non_conforme_est_un_echec():
    api = FauxCloudflare(divergence=True)
    with pytest.raises(RuntimeError, match="relecture"):
        assurer_redirection(api)
