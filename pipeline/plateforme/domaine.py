"""Rattache les domaines publics au projet Cloudflare Pages de production.

La commande est idempotente et sait reprendre un domaine encore associé à un
ancien projet Pages. Elle est exécutée après chaque publication afin que le DNS
et le projet servi ne puissent plus diverger silencieusement.
"""

import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request


class Cloudflare:
    def __init__(self, compte: str, token: str) -> None:
        self.base = f"https://api.cloudflare.com/client/v4/accounts/{compte}/pages"
        self.token = token

    def appeler(self, chemin: str, methode: str = "GET", corps: dict | None = None):
        donnees = json.dumps(corps).encode() if corps is not None else None
        requete = urllib.request.Request(
            f"{self.base}{chemin}",
            data=donnees,
            method=methode,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(requete, timeout=30) as reponse:  # noqa: S310
                charge = json.loads(reponse.read() or b"{}")
        except urllib.error.HTTPError as erreur:
            charge = json.loads(erreur.read() or b"{}")
            messages = "; ".join(item.get("message", "") for item in charge.get("errors", []))
            raise RuntimeError(
                f"Cloudflare {methode} {chemin} ({erreur.code}) : {messages}"
            ) from erreur
        if not charge.get("success", False):
            raise RuntimeError(f"Cloudflare {methode} {chemin} : {charge.get('errors')}")
        return charge.get("result")


def associations(api: Cloudflare) -> dict[str, str]:
    """Retourne domaine -> projet pour tous les projets Pages du compte."""
    trouves: dict[str, str] = {}
    projets = api.appeler("/projects?per_page=100") or []
    for projet in projets:
        nom = projet["name"]
        chemin = urllib.parse.quote(nom, safe="")
        for domaine in api.appeler(f"/projects/{chemin}/domains") or []:
            trouves[domaine["name"]] = nom
    return trouves


def rattacher(api: Cloudflare, projet: str, domaines: list[str]) -> None:
    existantes = associations(api)
    projet_encode = urllib.parse.quote(projet, safe="")
    for domaine in domaines:
        ancien = existantes.get(domaine)
        domaine_encode = urllib.parse.quote(domaine, safe="")
        if ancien and ancien != projet:
            ancien_encode = urllib.parse.quote(ancien, safe="")
            api.appeler(
                f"/projects/{ancien_encode}/domains/{domaine_encode}",
                methode="DELETE",
            )
            print(f"{domaine} détaché de {ancien}")
        if ancien != projet:
            api.appeler(
                f"/projects/{projet_encode}/domains",
                methode="POST",
                corps={"name": domaine},
            )
            print(f"{domaine} rattaché à {projet}")
        else:
            print(f"{domaine} déjà rattaché à {projet}")


def attendre(api: Cloudflare, projet: str, domaines: list[str], tentatives: int = 36) -> None:
    projet_encode = urllib.parse.quote(projet, safe="")
    restants = set(domaines)
    derniers: dict[str, str] = {}
    for _ in range(tentatives):
        for domaine in list(restants):
            domaine_encode = urllib.parse.quote(domaine, safe="")
            resultat = api.appeler(f"/projects/{projet_encode}/domains/{domaine_encode}")
            statut = resultat.get("status", "inconnu")
            derniers[domaine] = statut
            if statut == "active":
                restants.remove(domaine)
        if not restants:
            print("domaines Cloudflare Pages actifs : " + ", ".join(domaines))
            return
        time.sleep(5)
    raise RuntimeError(f"domaines non actifs après attente : {derniers}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default="plateforme")
    parser.add_argument("--domain", action="append", required=True)
    arguments = parser.parse_args()
    api = Cloudflare(
        os.environ["CLOUDFLARE_ACCOUNT_ID"],
        os.environ["CLOUDFLARE_API_TOKEN"],
    )
    rattacher(api, arguments.project, arguments.domain)
    attendre(api, arguments.project, arguments.domain)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
