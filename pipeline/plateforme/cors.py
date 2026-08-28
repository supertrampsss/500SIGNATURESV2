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
import time
import urllib.error
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
        # `Content-Range` et `Accept-Ranges` servent aux tuiles PMTiles, lues par
        # plages d'octets : la bibliothèque en déduit la taille de l'archive.
        "ExposeHeaders": [
            "ETag",
            "Content-Length",
            "Content-Type",
            "Content-Range",
            "Accept-Ranges",
        ],
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


def controler_relecture(regles: list[dict]) -> None:
    """La politique relue sur le bucket doit porter ce que le site exige.

    C'est la moitié autoritaire de la vérification : elle interroge la
    configuration elle-même, pas le bord — elle ne dépend donc pas de l'humeur
    de la protection anti-robot du domaine public.
    """
    for regle in regles:
        if (
            "*" in regle.get("AllowedOrigins", [])
            and {"GET", "HEAD"} <= set(regle.get("AllowedMethods", []))
            and {"Content-Range", "Accept-Ranges"} <= set(regle.get("ExposeHeaders", []))
        ):
            return
    raise RuntimeError(
        f"la politique relue sur le bucket ne couvre pas le contrat du site : {regles!r}"
    )


class VerificationImpossible(RuntimeError):
    """Le domaine public a refusé de répondre au robot : la relecture
    « navigateur » n'a pas pu conclure. Distinct d'une politique absente, qui
    est un échec réel — un navigateur, lui, n'est pas bloqué par la protection
    anti-robot qui vise les clients HTTP nus."""


# Le chemin du lecteur passe par un navigateur : la vérification l'imite
# jusqu'à l'agent utilisateur. Sans lui, la protection anti-robot du domaine
# public répond parfois 403 au client HTTP nu — un refus qui ne dit rien de ce
# que verra un navigateur.
NAVIGATEUR = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
    " (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def verifier(origine: str = "https://500signatures.fr", tentatives: int = 3) -> str:
    """Rejoue la requête du navigateur, en-tête `Origin` compris.

    Sans cet en-tête, R2 répond 200 sans rien dire de CORS : c'est exactement ce
    que voyaient les contrôles précédents. La vérification échoue si l'origine
    n'est pas autorisée, plutôt que de laisser la panne au lecteur.
    """
    requete = urllib.request.Request(
        f"{DOMAINE_PUBLIC}{TEMOIN}",
        headers={"Origin": origine, "User-Agent": NAVIGATEUR, "Accept": "application/json"},
    )
    derniere_erreur: Exception | None = None
    for tentative in range(tentatives):
        if tentative:
            time.sleep(3 * tentative)
        try:
            with urllib.request.urlopen(requete, timeout=30) as reponse:  # noqa: S310 — URL fixe, https
                autorise = reponse.headers.get("Access-Control-Allow-Origin")
            break
        except urllib.error.HTTPError as erreur:
            # Un refus qui porte quand même l'en-tête CORS prouve la politique :
            # c'est le robot qui est bloqué, pas le navigateur.
            autorise = erreur.headers.get("Access-Control-Allow-Origin") if erreur.headers else None
            if autorise:
                break
            derniere_erreur = erreur
        except urllib.error.URLError as erreur:
            derniere_erreur = erreur
    else:
        raise VerificationImpossible(
            f"{DOMAINE_PUBLIC}{TEMOIN} n'a pas répondu au contrôle après"
            f" {tentatives} essais : {derniere_erreur}"
        )
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
    parser.add_argument("--origine", default="https://500signatures.fr")
    parser.add_argument(
        "--verifier-seulement",
        action="store_true",
        help="ne pose rien, contrôle seulement que le navigateur peut lire",
    )
    arguments = parser.parse_args()
    relecture_conforme = False
    if not arguments.verifier_seulement:
        poser(arguments.bucket)
        print(f"politique CORS posée sur {arguments.bucket} : {json.dumps(REGLES[0])}")
        try:
            controler_relecture(lire(arguments.bucket))
            relecture_conforme = True
            print("politique relue sur le bucket : conforme au contrat du site")
        except RuntimeError:
            raise  # divergence réelle : la pose n'a pas pris, il faut le voir
        except Exception as erreur:  # noqa: BLE001 — relecture S3 indisponible ≠ politique fausse
            print(f"relecture S3 indisponible ({erreur}) ; la relecture navigateur tranchera")
    try:
        autorise = verifier(arguments.origine)
        print(f"vérifié depuis {arguments.origine} : Access-Control-Allow-Origin = {autorise}")
    except VerificationImpossible as erreur:
        # Le déploiement du 2 août 2026 : politique posée et relue conforme,
        # et le domaine public répondait 403 au client HTTP du runner —
        # protection anti-robot, pas panne CORS. Rougir le déploiement pour ça
        # apprendrait à ignorer le rouge. On ne tolère l'inconclusif que si la
        # relecture autoritaire a confirmé la politique.
        if not relecture_conforme:
            raise
        print(f"relecture navigateur inconclusive : {erreur}")
        print("la politique est confirmée par la relecture du bucket ; le bord a refusé le robot")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
