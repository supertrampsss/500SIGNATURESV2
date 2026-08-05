"""Dépôt de snapshots immuables.

Les snapshots bruts sont la matière première de la reproductibilité
(docs/03-architecture.md §1) : une clé écrite ne peut jamais être réécrite.
Implémentation locale pour le développement et les tests ; l'implémentation R2
arrive au ticket T-02 derrière la même interface.
"""

from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path

# Écritures menées de front. Un dépôt R2 est une attente réseau, pas un calcul :
# la publication passait une demi-heure à regarder passer des allers-retours, un
# fichier à la fois, sur deux mille fichiers — et c'est cette demi-heure,
# répétée à chaque chargement, qui a fini par épuiser le quota d'Actions.
PARALLELISME = 16

# Octets en vol au maximum. Borner le *nombre* d'écritures ne suffirait pas :
# une fiche départementale pèse six mégaoctets et sept d'entre elles tiendraient
# la mémoire du runner autant que mille fichiers de carte. C'est le poids qui
# décide quand attendre.
EN_VOL = 64 * 1024 * 1024


class ImmutabilityError(Exception):
    """Tentative d'écraser un snapshot existant."""


class LocalStore:
    def __init__(self, root: str | Path):
        self.root = Path(root)

    def put(self, key: str, content: bytes, overwrite: bool = False) -> str:
        path = self.root / key
        if path.exists() and not overwrite:
            raise ImmutabilityError(f"snapshot déjà présent : {key}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return str(path)

    def get(self, key: str) -> bytes:
        return (self.root / key).read_bytes()


class R2Store:
    """Store R2 via l'API S3 de Cloudflare.

    Credentials dérivés du token API Cloudflare (mécanique documentée par R2) :
    access_key_id = id du token, secret_access_key = SHA-256 hex du token.
    Un seul secret (CLOUDFLARE_API_TOKEN) alimente donc management ET stockage.

    L'immutabilité est vérifiée par head-then-put : fenêtre de course acceptée,
    chaque dataset n'a qu'un écrivain à la fois (queue d'ingestion, docs/03 §1).
    """

    def __init__(self, bucket: str, account_id: str, token_id: str, token: str):
        import hashlib

        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=token_id,
            aws_secret_access_key=hashlib.sha256(token.encode()).hexdigest(),
            region_name="auto",
            # Un client boto3 se partage entre fils d'exécution ; son *pool* de
            # connexions, lui, plafonne à dix par défaut. Seize écritures de
            # front sur dix connexions passeraient leur temps à faire la queue
            # dans le client au lieu d'attendre le réseau : le parallélisme
            # serait annoncé et pas obtenu.
            config=Config(max_pool_connections=PARALLELISME + 4),
        )

    @classmethod
    def from_env(cls, bucket: str) -> "R2Store":
        import os

        return cls(
            bucket=bucket,
            account_id=os.environ["CLOUDFLARE_ACCOUNT_ID"],
            token_id=os.environ["CLOUDFLARE_TOKEN_ID"],
            token=os.environ["CLOUDFLARE_API_TOKEN"],
        )

    def _exists(self, key: str) -> bool:
        import botocore.exceptions

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except botocore.exceptions.ClientError as error:
            if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 404:
                return False
            raise

    def put(self, key: str, content: bytes, overwrite: bool = False) -> str:
        """`overwrite` n'est légitime que pour les pointeurs de version publiés
        (data/derniere.json) : tout le reste est immuable par principe."""
        if not overwrite and self._exists(key):
            raise ImmutabilityError(f"snapshot déjà présent : {key}")
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=content,
            ContentType="application/json" if key.endswith(".json") else "application/octet-stream",
        )
        return f"r2://{self.bucket}/{key}"

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()


class Flux:
    """Dépôt en parallèle, avec un poids borné d'écritures en vol.

    Une publication écrit deux mille fichiers. Chacun coûtait deux allers-retours
    — un `HEAD` pour le contrôle d'immutabilité, un `PUT` pour le corps — et ils
    se suivaient : la publication tenait la file d'ingestion une demi-heure sans
    jamais rien calculer. Les mener de front ne change ni ce qui est écrit ni
    l'ordre dans lequel un lecteur le verra : le pointeur `derniere.json` n'est
    déposé qu'après, et c'est lui seul qui rend une publication visible.

    Une erreur n'est pas avalée : elle est remontée à la première attente qui
    suit, et elle interrompt la publication. Un dépôt partiel derrière un
    pointeur non déplacé n'est pas un site cassé — c'est une version que
    personne ne lit.

    À utiliser en gestionnaire de contexte : la sortie attend les écritures
    restantes, y compris quand le bloc part en erreur.
    """

    def __init__(
        self,
        store,
        parallelisme: int = PARALLELISME,
        en_vol: int = EN_VOL,
        overwrite: bool = False,
    ):
        self.store = store
        self.en_vol = en_vol
        self.overwrite = overwrite
        self._pool = ThreadPoolExecutor(max_workers=parallelisme)
        self._encours: list[tuple[Future, int]] = []
        self.fichiers = 0
        self.octets = 0

    def __enter__(self) -> "Flux":
        return self

    def __exit__(self, type_erreur, *_) -> None:
        try:
            self.attendre()
        except Exception:  # noqa: BLE001 — voir juste en dessous
            # Le bloc est déjà en train d'échouer : une écriture qui rate en
            # même temps n'est pas la cause, c'est une conséquence. La remonter
            # remplacerait le vrai motif — « colonne inconnue » — par un
            # « R2 a refusé » qui n'apprend rien.
            if type_erreur is None:
                raise
        finally:
            self._pool.shutdown(wait=True)

    def deposer(self, cle: str, contenu: bytes) -> None:
        self._encours.append(
            (self._pool.submit(self.store.put, cle, contenu, self.overwrite), len(contenu))
        )
        self.fichiers += 1
        self.octets += len(contenu)
        if sum(poids for _, poids in self._encours) > self.en_vol:
            self.attendre()

    def attendre(self) -> None:
        """Bloque jusqu'à ce que tout soit écrit, et remonte la première erreur."""
        encours, self._encours = self._encours, []
        erreur: BaseException | None = None
        for future, _ in encours:
            try:
                future.result()
            except BaseException as souci:  # noqa: BLE001 — remontée telle quelle après
                erreur = erreur or souci
        if erreur is not None:
            raise erreur
