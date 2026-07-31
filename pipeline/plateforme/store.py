"""Dépôt de snapshots immuables.

Les snapshots bruts sont la matière première de la reproductibilité
(docs/03-architecture.md §1) : une clé écrite ne peut jamais être réécrite.
Implémentation locale pour le développement et les tests ; l'implémentation R2
arrive au ticket T-02 derrière la même interface.
"""

from pathlib import Path


class ImmutabilityError(Exception):
    """Tentative d'écraser un snapshot existant."""


class LocalStore:
    def __init__(self, root: str | Path):
        self.root = Path(root)

    def put(self, key: str, content: bytes) -> str:
        path = self.root / key
        if path.exists():
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

        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=token_id,
            aws_secret_access_key=hashlib.sha256(token.encode()).hexdigest(),
            region_name="auto",
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

    def put(self, key: str, content: bytes) -> str:
        if self._exists(key):
            raise ImmutabilityError(f"snapshot déjà présent : {key}")
        self.client.put_object(Bucket=self.bucket, Key=key, Body=content)
        return f"r2://{self.bucket}/{key}"

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
