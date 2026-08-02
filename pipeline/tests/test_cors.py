"""La panne du 1er août : les fichiers répondaient, le navigateur ne pouvait pas
les lire. Ces tests portent sur ce que la vérification doit refuser."""

import io
import urllib.error
import urllib.request

import pytest

from plateforme import cors


class FausseReponse(io.BytesIO):
    def __init__(self, entetes: dict):
        super().__init__(b"{}")
        self.headers = entetes

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def repondre(monkeypatch, entetes: dict) -> None:
    monkeypatch.setattr(
        urllib.request, "urlopen", lambda requete, timeout=None: FausseReponse(entetes)
    )


def test_une_reponse_sans_en_tete_cors_echoue(monkeypatch):
    """C'est l'état exact du bucket pendant la panne : 200, contenu correct,
    et aucun navigateur capable de le lire."""
    repondre(monkeypatch, {})
    with pytest.raises(RuntimeError, match="Access-Control-Allow-Origin"):
        cors.verifier()


def test_le_message_dit_quoi_lancer(monkeypatch):
    repondre(monkeypatch, {})
    with pytest.raises(RuntimeError, match="plateforme.cors"):
        cors.verifier()


def test_une_origine_etrangere_echoue(monkeypatch):
    repondre(monkeypatch, {"Access-Control-Allow-Origin": "https://exemple.test"})
    with pytest.raises(RuntimeError, match="origine autorisée"):
        cors.verifier("https://plateforme-9sz.pages.dev")


def test_l_etoile_et_l_origine_exacte_passent(monkeypatch):
    repondre(monkeypatch, {"Access-Control-Allow-Origin": "*"})
    assert cors.verifier() == "*"
    repondre(monkeypatch, {"Access-Control-Allow-Origin": "https://plateforme-9sz.pages.dev"})
    assert cors.verifier("https://plateforme-9sz.pages.dev").endswith("pages.dev")


def test_la_requete_porte_bien_un_en_tete_origine(monkeypatch):
    """Sans `Origin`, R2 répond 200 sans rien dire de CORS — c'est ce que
    voyaient `curl` et les contrôles précédents."""
    vues = {}

    def espion(requete, timeout=None):
        vues["origin"] = requete.headers.get("Origin")
        return FausseReponse({"Access-Control-Allow-Origin": "*"})

    monkeypatch.setattr(urllib.request, "urlopen", espion)
    cors.verifier("https://plateforme-9sz.pages.dev")
    assert vues["origin"] == "https://plateforme-9sz.pages.dev"


def test_seules_la_lecture_et_la_prelecture_sont_ouvertes():
    [regle] = cors.REGLES
    assert set(regle["AllowedMethods"]) == {"GET", "HEAD"}
    assert regle["AllowedOrigins"] == ["*"]  # docs/10 : lisible sans clé ni compte


def test_les_en_tetes_de_plage_sont_exposes_pour_les_tuiles():
    """PMTiles lit l'archive par plages d'octets et se sert de `Content-Range`
    pour en déduire la taille : non exposé, il n'est pas lisible par le JS."""
    [regle] = cors.REGLES
    assert {"Content-Range", "Accept-Ranges"} <= set(regle["ExposeHeaders"])


def test_la_requete_se_presente_en_navigateur(monkeypatch):
    """Le déploiement du 2 août : le domaine public répondait 403 au client
    HTTP nu du runner — protection anti-robot. Le chemin du lecteur passe par
    un navigateur ; la vérification doit s'annoncer comme lui."""
    vues = {}

    def espion(requete, timeout=None):
        vues["ua"] = requete.headers.get("User-agent")
        return FausseReponse({"Access-Control-Allow-Origin": "*"})

    monkeypatch.setattr(urllib.request, "urlopen", espion)
    cors.verifier()
    assert vues["ua"] and vues["ua"].startswith("Mozilla/5.0")


def test_un_refus_qui_porte_l_en_tete_cors_prouve_la_politique(monkeypatch):
    """403 anti-robot avec `Access-Control-Allow-Origin` : la politique est là,
    c'est le robot qui est refusé — la vérification conclut au lieu d'échouer."""

    def refuser(requete, timeout=None):
        raise urllib.error.HTTPError(
            requete.full_url, 403, "Forbidden", {"Access-Control-Allow-Origin": "*"}, None
        )

    monkeypatch.setattr(urllib.request, "urlopen", refuser)
    assert cors.verifier() == "*"


def test_un_refus_nu_et_persistant_est_inconclusif_pas_une_panne_cors(monkeypatch):
    """Un 403 sans en-tête CORS ne dit rien de ce que verra un navigateur :
    l'erreur est distincte (`VerificationImpossible`) pour que l'appelant
    décide — le déploiement ne rougit que si la relecture du bucket n'a pas
    confirmé la politique."""
    essais = []

    def refuser(requete, timeout=None):
        essais.append(1)
        raise urllib.error.HTTPError(requete.full_url, 403, "Forbidden", {}, None)

    monkeypatch.setattr(urllib.request, "urlopen", refuser)
    monkeypatch.setattr(cors.time, "sleep", lambda _: None)
    with pytest.raises(cors.VerificationImpossible):
        cors.verifier(tentatives=3)
    assert len(essais) == 3  # le refus transitoire a bien été réessayé


def test_la_relecture_du_bucket_exige_le_contrat_du_site():
    cors.controler_relecture(cors.REGLES)
    with pytest.raises(RuntimeError, match="contrat du site"):
        cors.controler_relecture(
            [{"AllowedOrigins": ["*"], "AllowedMethods": ["GET"], "ExposeHeaders": []}]
        )
    with pytest.raises(RuntimeError, match="contrat du site"):
        cors.controler_relecture([])
