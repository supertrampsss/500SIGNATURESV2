import pytest

from plateforme.store import ImmutabilityError, LocalStore


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
