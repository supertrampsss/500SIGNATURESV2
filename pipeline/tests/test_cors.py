"""La panne du 1er août : les fichiers répondaient, le navigateur ne pouvait pas
les lire. Ces tests portent sur ce que la vérification doit refuser."""

import io
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
