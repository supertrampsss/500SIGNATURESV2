"""Le téléchargement qui reprend, et le corps tronqué qui ne passe plus.

Le 5 août, le premier chargement des créations d'entreprises est mort sur
« File is not a zip file ». Le fichier de l'INSEE fait 43 Mo ; le serveur avait
coupé le flux à mi-parcours et rendu un corps court, sans erreur. Quatre minutes
de CI et un entrepôt de un gigaoctet rapatrié pour un zip amputé.

Ces tests montent un serveur httpx en mémoire — pas de réseau — et le font
couper exprès.
"""

from contextlib import contextmanager

import httpx
import pytest

from plateforme import http

FICHIER = b"".join(bytes([n % 251]) for n in range(30_000))


@pytest.fixture(autouse=True)
def sans_attente(monkeypatch):
    """Le backoff est vérifié ailleurs ; ici il ne ferait qu'allonger la suite."""
    monkeypatch.setattr(http.time, "sleep", lambda _: None)


def _brancher(monkeypatch, transport: httpx.MockTransport) -> None:
    """Fait passer `httpx.get` et `httpx.stream` par un transport en mémoire.

    Les fonctions de module d'httpx n'acceptent pas de transport : il faut un
    client. `stream` reste un gestionnaire de contexte, comme celui du vrai.
    """

    @contextmanager
    def stream(methode, url, **options):
        options.pop("follow_redirects", None)
        with httpx.Client(transport=transport, follow_redirects=True) as client:
            with client.stream(methode, url, **options) as reponse:
                yield reponse

    def get(url, **options):
        options.pop("follow_redirects", None)
        with httpx.Client(transport=transport, follow_redirects=True) as client:
            return client.get(url, **options)

    def head(url, **options):
        options.pop("follow_redirects", None)
        with httpx.Client(transport=transport, follow_redirects=True) as client:
            return client.head(url, **options)

    monkeypatch.setattr(http.httpx, "stream", stream)
    monkeypatch.setattr(http.httpx, "get", get)
    monkeypatch.setattr(http.httpx, "head", head)


def _serveur(coupe_a: int, appels: list):
    """Un serveur qui annonce la vraie taille et n'en sert qu'une partie.

    `coupe_a` octets au premier appel, puis tout le reste : c'est exactement le
    comportement observé sur l'API de l'INSEE, à ceci près qu'elle demande
    parfois plusieurs reprises.
    """

    def repondre(requete: httpx.Request) -> httpx.Response:
        appels.append((requete.method, requete.headers.get("range")))
        debut = 0
        plage = requete.headers.get("range")
        if plage:
            debut = int(plage.removeprefix("bytes=").rstrip("-"))
        corps = FICHIER[debut:]
        if not plage:
            corps = corps[:coupe_a]
        if plage:
            return httpx.Response(
                206,
                content=corps,
                headers={"content-range": f"bytes {debut}-{len(FICHIER) - 1}/{len(FICHIER)}"},
            )
        # Un 200 tronqué : `Content-Length` annonce le fichier entier, le corps
        # est court. httpx rend le corps tel quel, sans lever.
        return httpx.Response(
            200, content=corps, headers={"content-length": str(len(FICHIER))}
        )

    return httpx.MockTransport(repondre)


def test_un_corps_tronque_est_repris_par_range(monkeypatch):
    """Le défaut du 5 août. La taille annoncée fait foi : tant que le corps est
    plus court, la suite est redemandée."""
    appels: list = []
    _brancher(monkeypatch, _serveur(12_345, appels))
    recu = http.telecharger("https://exemple.test/fichier.zip")
    assert recu == FICHIER
    # Le `HEAD` fixe la taille, la première lecture est coupée, la seconde
    # reprend à l'octet exact.
    assert appels == [("HEAD", None), ("GET", None), ("GET", "bytes=12345-")]


def test_un_corps_tronque_qui_ne_se_repare_pas_leve(monkeypatch):
    """Un fichier amputé ne doit jamais arriver au connecteur : il y meurt sur
    un message qui ne parle pas du réseau — « File is not a zip file »."""

    def repondre(requete: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=FICHIER[:100], headers={"content-length": str(len(FICHIER))}
        )

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    with pytest.raises(http.Tronque) as erreur:
        http.telecharger("https://exemple.test/fichier.zip", essais=2)
    assert "100 octets" in str(erreur.value)
    assert str(len(FICHIER)) in str(erreur.value)


def test_un_serveur_qui_ignore_la_reprise_repart_du_debut(monkeypatch):
    """Tous les serveurs ne gèrent pas `Range`. Celui qui l'ignore répond 200 et
    renvoie le fichier depuis le début : coller ce corps derrière le morceau
    déjà reçu ferait un fichier avec deux fois son propre préfixe."""
    appels: list = []

    def repondre(requete: httpx.Request) -> httpx.Response:
        appels.append((requete.method, requete.headers.get("range")))
        corps = FICHIER if len(appels) > 2 else FICHIER[:5000]
        return httpx.Response(
            200, content=corps, headers={"content-length": str(len(FICHIER))}
        )

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    assert http.telecharger("https://exemple.test/fichier.zip") == FICHIER
    assert appels == [("HEAD", None), ("GET", None), ("GET", "bytes=5000-")]


def test_une_coupure_reseau_reprend_aussi(monkeypatch):
    """La coupure franche, celle qui lève. Elle ne doit pas plus faire
    recommencer le téléchargement que la coupure silencieuse."""
    appels: list = []

    def repondre(requete: httpx.Request) -> httpx.Response:
        appels.append((requete.method, requete.headers.get("range")))
        if len(appels) == 1:
            raise httpx.ConnectError("connexion coupée")
        return httpx.Response(
            200, content=FICHIER, headers={"content-length": str(len(FICHIER))}
        )

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    assert http.telecharger("https://exemple.test/fichier.zip") == FICHIER


def test_un_fichier_complet_ne_demande_qu_une_requete(monkeypatch):
    """Le cas ordinaire : la reprise ne doit rien coûter quand tout va bien."""
    appels: list = []

    def repondre(requete: httpx.Request) -> httpx.Response:
        appels.append((requete.method, requete.headers.get("range")))
        return httpx.Response(
            200, content=FICHIER, headers={"content-length": str(len(FICHIER))}
        )

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    assert http.telecharger("https://exemple.test/fichier.zip") == FICHIER
    assert appels == [("HEAD", None), ("GET", None)]


def test_fetch_refuse_aussi_un_corps_tronque(monkeypatch):
    """`fetch` sert des réponses d'API, où redemander tout ne coûte rien — mais
    un JSON coupé se parserait mal ou, pire, se parserait."""
    appels: list = []

    def repondre(requete: httpx.Request) -> httpx.Response:
        appels.append(1)
        corps = FICHIER if len(appels) > 1 else FICHIER[:80]
        return httpx.Response(
            200, content=corps, headers={"content-length": str(len(FICHIER))}
        )

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    assert http.fetch("https://exemple.test/donnees.json").content == FICHIER
    assert len(appels) == 2


def test_sans_taille_annoncee_le_corps_est_rendu_tel_quel(monkeypatch):
    """Un serveur en `chunked` n'annonce rien : il n'y a alors rien à vérifier,
    et refuser par principe casserait des sources qui marchent."""

    def repondre(requete: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=FICHIER[:400])

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    assert http.telecharger("https://exemple.test/flux") == FICHIER[:400]


def test_la_taille_vient_du_head_quand_le_corps_n_en_annonce_pas(monkeypatch):
    """Le cas qui a failli faire passer le contrôle à côté du sujet.

    Derrière un proxy qui ré-encode, la réponse au `GET` arrive en `chunked` et
    gzippée : plus de `Content-Length`, donc plus rien à comparer, donc un corps
    tronqué qui repasse. Le `HEAD`, lui, répond sur le fichier."""
    appels: list = []

    def repondre(requete: httpx.Request) -> httpx.Response:
        appels.append(requete.method)
        if requete.method == "HEAD":
            return httpx.Response(200, headers={"content-length": str(len(FICHIER))})
        debut = 0
        plage = requete.headers.get("range")
        if plage:
            debut = int(plage.removeprefix("bytes=").rstrip("-"))
            return httpx.Response(
                206,
                content=FICHIER[debut:],
                headers={"content-range": f"bytes {debut}-{len(FICHIER) - 1}/{len(FICHIER)}"},
            )
        # Ni `Content-Length` ni `Content-Range` : le transport a tout mangé.
        return httpx.Response(200, content=FICHIER[:9_000])

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    assert http.telecharger("https://exemple.test/fichier.zip") == FICHIER
    assert appels == ["HEAD", "GET", "GET"]


def test_le_corps_est_demande_sans_compression_de_transport(monkeypatch):
    """Un proxy qui gzippe rendrait des octets décompressés, dont le nombre ne
    se compare plus à la taille annoncée : le contrôle mesurerait autre chose
    que ce qu'il croit mesurer."""
    entetes: list = []

    def repondre(requete: httpx.Request) -> httpx.Response:
        entetes.append(requete.headers.get("accept-encoding"))
        return httpx.Response(
            200, content=FICHIER, headers={"content-length": str(len(FICHIER))}
        )

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    http.telecharger("https://exemple.test/fichier.zip")
    assert entetes == ["identity", "identity"]


def test_une_tentative_qui_traine_est_abandonnee_et_reprise(monkeypatch):
    """La seule façon dont ce téléchargement puisse pendre au lieu d'échouer.

    Le délai de lecture ne voit que le silence : un serveur qui envoie un octet
    juste avant chaque expiration ne le déclenche jamais. Rien n'échoue, rien
    n'avance, et le run tient la file d'ingestion des heures — c'est ce qui a
    motivé ce garde-fou.
    """
    appels: list = []
    horloge = {"t": 0.0}

    def maintenant() -> float:
        # Le temps n'avance qu'à la lecture d'un morceau : chacun coûte le tiers
        # du budget, donc la tentative est coupée au quatrième.
        horloge["t"] += http.TENTATIVE / 3
        return horloge["t"]

    monkeypatch.setattr(http.time, "monotonic", maintenant)

    def morceaux(depuis: int):
        # Un serveur qui n'envoie jamais rien ne déclencherait pas le délai de
        # lecture : il parle, il est simplement trop lent pour aboutir.
        for debut in range(depuis, len(FICHIER), 1000):
            yield FICHIER[debut : debut + 1000]

    def repondre(requete: httpx.Request) -> httpx.Response:
        appels.append((requete.method, requete.headers.get("range")))
        plage = requete.headers.get("range")
        if requete.method == "HEAD":
            return httpx.Response(200, headers={"content-length": str(len(FICHIER))})
        if plage:
            debut = int(plage.removeprefix("bytes=").rstrip("-"))
            return httpx.Response(
                206,
                content=morceaux(debut),
                headers={"content-range": f"bytes {debut}-{len(FICHIER) - 1}/{len(FICHIER)}"},
            )
        return httpx.Response(200, content=morceaux(0))

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    recu = http.telecharger("https://exemple.test/fichier.zip")
    assert recu == FICHIER
    # La première tentative a été coupée en route ; les suivantes ont repris à
    # l'octet exact plutôt que de tout redemander.
    assert appels[0] == ("HEAD", None)
    assert appels[1] == ("GET", None)
    assert len(appels) > 2
    assert all(m == "GET" and p.startswith("bytes=") for m, p in appels[2:])


def test_un_flux_qui_n_avance_jamais_finit_par_lever(monkeypatch):
    """Abandonner une tentative ne suffit pas : il faut que l'échec arrive."""
    horloge = {"t": 0.0}

    def maintenant() -> float:
        horloge["t"] += http.TENTATIVE
        return horloge["t"]

    monkeypatch.setattr(http.time, "monotonic", maintenant)

    def repondre(requete: httpx.Request) -> httpx.Response:
        if requete.method == "HEAD":
            return httpx.Response(200, headers={"content-length": str(len(FICHIER))})
        # Toujours le même préfixe, jamais la suite : le serveur ignore `Range`.
        return httpx.Response(
            200, content=FICHIER[:1000], headers={"content-length": str(len(FICHIER))}
        )

    _brancher(monkeypatch, httpx.MockTransport(repondre))
    with pytest.raises(http.Tronque):
        http.telecharger("https://exemple.test/fichier.zip", essais=3)
