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
