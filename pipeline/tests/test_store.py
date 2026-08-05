import threading
import time

import pytest

from plateforme.store import Flux, ImmutabilityError, LocalStore


def test_put_get_roundtrip(tmp_path):
    store = LocalStore(tmp_path)
    store.put("raw/src/ds/2026/data.json", b"{}")
    assert store.get("raw/src/ds/2026/data.json") == b"{}"


def test_snapshots_are_immutable(tmp_path):
    store = LocalStore(tmp_path)
    store.put("raw/src/ds/2026/data.json", b"v1")
    with pytest.raises(ImmutabilityError):
        store.put("raw/src/ds/2026/data.json", b"v2")
    assert store.get("raw/src/ds/2026/data.json") == b"v1"


# ------------------------------------------------------------------ Flux
# Une publication écrit deux mille fichiers, chacun au prix de deux
# allers-retours réseau. Les mener un par un tenait la file d'ingestion une
# demi-heure sans jamais rien calculer — et c'est cette demi-heure, répétée à
# chaque chargement, qui a fini par épuiser le quota d'Actions.


class Lent:
    """Un magasin dont chaque écriture attend, comme le ferait le réseau."""

    def __init__(self, attente=0.02):
        self.attente = attente
        self.ecrites = {}
        self.simultanees = 0
        self.pointe = 0
        self._verrou = threading.Lock()

    def put(self, cle, contenu, overwrite=False):
        with self._verrou:
            self.simultanees += 1
            self.pointe = max(self.pointe, self.simultanees)
        time.sleep(self.attente)
        with self._verrou:
            self.simultanees -= 1
            self.ecrites[cle] = contenu
        return cle


def test_le_flux_ecrit_de_front():
    magasin = Lent()
    debut = time.monotonic()
    with Flux(magasin, parallelisme=8) as flux:
        for i in range(32):
            flux.deposer(f"data/x/{i}.json", b"{}")
    duree = time.monotonic() - debut
    assert len(magasin.ecrites) == 32
    assert flux.fichiers == 32
    # Trente-deux écritures de vingt millisecondes : 640 ms en série, moins de
    # 200 ms à huit de front. La borne est large — un runner chargé reste lent —
    # mais elle échoue si le parallélisme disparaît.
    assert duree < 0.35, duree
    assert magasin.pointe > 1


def test_le_flux_borne_ce_qu_il_garde_en_memoire():
    """Borner le *nombre* d'écritures ne suffirait pas : une fiche
    départementale pèse six mégaoctets, et sept d'entre elles tiendraient la
    mémoire du runner autant que mille fichiers de carte."""
    magasin = Lent(attente=0)
    with Flux(magasin, parallelisme=4, en_vol=1000) as flux:
        for i in range(10):
            flux.deposer(f"data/x/{i}.json", b"x" * 400)
            # Passé la borne, le flux a attendu : rien ne s'accumule.
            assert sum(poids for _, poids in flux._encours) <= 1000
    assert len(magasin.ecrites) == 10


def test_une_erreur_d_ecriture_interrompt_la_publication():
    """Un dépôt partiel derrière un pointeur non déplacé n'est pas un site
    cassé — c'est une version que personne ne lit. Mais elle ne doit jamais
    passer pour une publication réussie."""

    class Cassant(Lent):
        def put(self, cle, contenu, overwrite=False):
            if cle.endswith("7.json"):
                raise OSError("R2 a refusé")
            return super().put(cle, contenu, overwrite)

    with pytest.raises(OSError, match="R2 a refusé"):
        with Flux(Cassant(attente=0), parallelisme=4) as flux:
            for i in range(20):
                flux.deposer(f"data/x/{i}.json", b"{}")


def test_le_flux_attend_ses_ecritures_avant_de_rendre_la_main():
    """C'est ce qui autorise à déposer le pointeur juste après : sans cette
    attente, `derniere.json` pourrait désigner une version dont les fichiers
    n'ont pas fini d'arriver."""
    magasin = Lent(attente=0.05)
    with Flux(magasin, parallelisme=16) as flux:
        for i in range(16):
            flux.deposer(f"data/x/{i}.json", b"{}")
    assert len(magasin.ecrites) == 16
