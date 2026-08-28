from plateforme.domaine import associations, rattacher


class FauxCloudflare:
    def __init__(self):
        self.appels = []
        self.domaines = {
            "ancien-site": [{"name": "500signatures.fr"}],
            "plateforme": [{"name": "www.500signatures.fr"}],
        }

    def appeler(self, chemin, methode="GET", corps=None):
        self.appels.append((chemin, methode, corps))
        if chemin == "/projects?per_page=100":
            return [{"name": nom} for nom in self.domaines]
        if chemin.endswith("/domains") and methode == "GET":
            projet = chemin.split("/")[2]
            return self.domaines[projet]
        if methode == "DELETE":
            return None
        if methode == "POST":
            return {"name": corps["name"], "status": "initializing"}
        raise AssertionError((chemin, methode, corps))


def test_associations_retrouve_le_projet_qui_sert_chaque_domaine():
    api = FauxCloudflare()
    assert associations(api) == {
        "500signatures.fr": "ancien-site",
        "www.500signatures.fr": "plateforme",
    }


def test_rattacher_transfere_l_apex_sans_recreer_le_www_deja_conforme():
    api = FauxCloudflare()
    rattacher(api, "plateforme", ["500signatures.fr", "www.500signatures.fr"])
    mutations = [appel for appel in api.appels if appel[1] != "GET"]
    assert mutations == [
        ("/projects/ancien-site/domains/500signatures.fr", "DELETE", None),
        ("/projects/plateforme/domains", "POST", {"name": "500signatures.fr"}),
    ]
