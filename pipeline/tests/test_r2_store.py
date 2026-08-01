"""Test réel du store R2 (jamais en CI) : exige PLATEFORME_TEST_R2=1 et les
variables CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_TOKEN_ID / CLOUDFLARE_API_TOKEN.
Écrit sous test/ dans plateforme-raw et nettoie derrière lui."""

import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("PLATEFORME_TEST_R2"), reason="PLATEFORME_TEST_R2 non défini"
)


def test_r2_put_get_immutable_cleanup():
    from plateforme.store import ImmutabilityError, R2Store

    store = R2Store.from_env("plateforme-raw")
    key = f"test/{uuid.uuid4()}/data.json"
    payload = b'{"essai": true}'

    assert store.put(key, payload) == f"r2://plateforme-raw/{key}"
    assert store.get(key) == payload
    with pytest.raises(ImmutabilityError):
        store.put(key, b"autre contenu")

    store.client.delete_object(Bucket=store.bucket, Key=key)
