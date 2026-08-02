"""Politique CORS du bucket public, posée puis vérifiée depuis un navigateur.

Le site et les données ne partagent pas la même origine : la page est servie par
Cloudflare Pages, les fichiers par le domaine public du bucket R2. Un `fetch`
d'une origine vers l'autre est refusé par le navigateur tant que le bucket ne
déclare pas qui a le droit de le lire.

**C'est la panne qui a rendu le site inutilisable le 1er août 2026** : les
fichiers répondaient parfaitement — `curl` les téléchargeait, les contrôles de
cohérence les validaient, 160 couches sur 160 résolvaient — et la page
n'affichait que « Les données n'ont pas pu être chargées ». `curl` ne vérifie
aucune origine ; seul un navigateur le fait. Un contrôle qui n'exerce pas le
même chemin que le lecteur ne prouve rien.

`AllowedOrigins: ["*"]` n'est pas un relâchement : docs/10 promet des fichiers
lisibles « sans clé ni compte », réutilisables par des tiers. Restreindre à
l'origine du site contredirait ce contrat. Seules la lecture et la pré-lecture
sont autorisées — le bucket reste en écriture fermée.

Usage : python -m plateforme.cors --bucket plateforme-published [--verifier-seulement]
"""

import argparse
import json
import os
import urllib.request

from plateforme.store import R2Store

# Le domaine public du bucket : celui que le site interroge, et donc celui sur
# lequel la vérification doit porter.
DOMAINE_PUBLIC = "https://pub-fc39d357004540a182a907aed4875ef5.r2.dev"
TEMOIN = "/data/derniere.json"

REGLES = [
    {
        "AllowedOrigins": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
        "MaxAgeSeconds": 86400,
    }
]


def _poser_par_api_cloudflare(bucket: str) -> None:
    """Repli quand l'API S3 refuse la configuration CORS.

    R2 expose la même politique sous un schéma différent de celui de S3 ; mieux
    vaut deux chemins qui marchent qu'un seul dont on suppose qu'il marche.
    """
    corps = json.dumps(
        {
            "rules": [
                {
                    "allowed": {
                        "origins": REGLES[0]["AllowedOrigins"],
                        "methods": REGLES[0]["AllowedMethods"],
                        "headers": REGLES[0]["AllowedHeaders"],
                    },
                    "exposeHeaders": REGLES[0]["ExposeHeaders"],
                    "maxAgeSeconds": REGLES[0]["MaxAgeSeconds"],
                }
            ]
        }
    ).encode()
    compte = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    requete = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{compte}/r2/buckets/{bucket}/cors",
        data=corps,
        method="PUT",
        headers={
            "Authorization": f"Bearer {os.environ['CLOUDFLARE_API_TOKEN']}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(requete, timeout=30) as reponse:  # noqa: S310 — URL fixe, https
        charge = json.loads(reponse.read())
    if not charge.get("success", False):
        raise RuntimeError(f"API Cloudflare : {charge.get('errors')}")


def poser(bucket: str) -> None:
    store = R2Store.from_env(bucket)
    try:
        store.client.put_bucket_cors(Bucket=bucket, CORSConfiguration={"CORSRules": REGLES})
        return
    except Exception as erreur:  # noqa: BLE001 — le repli couvre tout refus de l'API S3
        print(f"API S3 refuse la politique CORS ({erreur}) ; passage par l'API Cloudflare")
    _poser_par_api_cloudflare(bucket)


def lire(bucket: str) -> list[dict]:
    store = R2Store.from_env(bucket)
    return store.client.get_bucket_cors(Bucket=bucket).get("CORSRules", [])


def verifier(origine: str = "https://plateforme-9sz.pages.dev") -> str:
    """Rejoue la requête du navigateur, en-tête `Origin` compris.

    Sans cet en-tête, R2 répond 200 sans rien dire de CORS : c'est exactement ce
    que voyaient les contrôles précédents. La vérification échoue si l'origine
    n'est pas autorisée, plutôt que de laisser la panne au lecteur.
    """
    requete = urllib.request.Request(f"{DOMAINE_PUBLIC}{TEMOIN}", headers={"Origin": origine})
    with urllib.request.urlopen(requete, timeout=30) as reponse:  # noqa: S310 — URL fixe, https
        autorise = reponse.headers.get("Access-Control-Allow-Origin")
    if not autorise:
        raise RuntimeError(
            f"{TEMOIN} répond sans `Access-Control-Allow-Origin` :"
            f" un navigateur sur {origine} ne peut pas le lire, et le site reste vide."
            " Lancer `python -m plateforme.cors --bucket plateforme-published`."
        )
    if autorise not in ("*", origine):
        raise RuntimeError(f"origine autorisée « {autorise} », attendue « {origine} » ou « * »")
    return autorise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bucket", default="plateforme-published")
    parser.add_argument("--origine", default="https://plateforme-9sz.pages.dev")
    parser.add_argument(
        "--verifier-seulement",
        action="store_true",
        help="ne pose rien, contrôle seulement que le navigateur peut lire",
    )
    arguments = parser.parse_args()
    if not arguments.verifier_seulement:
        poser(arguments.bucket)
        print(f"politique CORS posée sur {arguments.bucket} : {json.dumps(REGLES[0])}")
    autorise = verifier(arguments.origine)
    print(f"vérifié depuis {arguments.origine} : Access-Control-Allow-Origin = {autorise}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
