"""Consolide www vers le domaine canonique par une règle Cloudflare de zone.

La règle ne concerne que www.500signatures.fr, conserve chemin et paramètres,
et s'exécute avant Pages. Les autres règles restent intactes. Aucun secret
n'est écrit dans les journaux ni dans le dépôt.
"""

import os

from plateforme.domaine import Cloudflare

PHASE = "http_request_dynamic_redirect"
REFERENCE = "500signatures_www_canonical"
REGLE = {
    "ref": REFERENCE,
    "description": "500 Signatures : www vers le domaine canonique",
    "expression": '(http.host eq "www.500signatures.fr")',
    "action": "redirect",
    "enabled": True,
    "action_parameters": {
        "from_value": {
            "target_url": {
                "expression": 'concat("https://500signatures.fr", http.request.uri.path)',
            },
            "status_code": 301,
            "preserve_query_string": True,
        },
    },
}


def conforme(regle: dict) -> bool:
    return all(regle.get(cle) == valeur for cle, valeur in REGLE.items())


def assurer_redirection(api: Cloudflare) -> None:
    domaine = api.appeler("/projects/plateforme/domains/www.500signatures.fr")
    zone = domaine.get("zone_tag")
    if not zone:
        raise RuntimeError("La zone du domaine www de production est absente de Cloudflare Pages")
    base = f"/zones/{zone}/rulesets"
    listes = api.appeler_global(base) or []
    entrees = [
        item for item in listes if item.get("kind") == "zone" and item.get("phase") == PHASE
    ]
    if len(entrees) > 1:
        raise RuntimeError("Plusieurs rulesets de redirection de zone : configuration ambiguë")
    if not entrees:
        cree = api.appeler_global(
            base,
            methode="POST",
            corps={
                "name": "Redirect rules",
                "kind": "zone",
                "phase": PHASE,
                "rules": [REGLE],
            },
        )
        identifiant = cree["id"]
        print("Règle canonique www créée")
    else:
        identifiant = entrees[0]["id"]
        ruleset = api.appeler_global(f"{base}/{identifiant}")
        regles = ruleset.get("rules", [])
        propres = [item for item in regles if item.get("ref") == REFERENCE]
        if len(propres) > 1:
            raise RuntimeError("Plusieurs règles canoniques www : configuration ambiguë")
        if not propres:
            api.appeler_global(
                f"{base}/{identifiant}/rules",
                methode="POST",
                corps={**REGLE, "position": {"index": 1}},
            )
            print("Règle canonique www ajoutée sans modifier les autres règles")
        elif not conforme(propres[0]) or regles[0].get("ref") != REFERENCE:
            api.appeler_global(
                f"{base}/{identifiant}/rules/{propres[0]['id']}",
                methode="PATCH",
                corps={**REGLE, "position": {"index": 1}},
            )
            print("Règle canonique www remise en conformité")
        else:
            print("Règle canonique www déjà conforme")
    relues = api.appeler_global(f"{base}/{identifiant}").get("rules", [])
    if not relues or not conforme(relues[0]):
        raise RuntimeError("La relecture Cloudflare ne confirme pas la redirection canonique www")
    print("Relecture Cloudflare : www redirige en 301, chemin et paramètres conservés")


def main() -> int:
    api = Cloudflare(os.environ["CLOUDFLARE_ACCOUNT_ID"], os.environ["CLOUDFLARE_API_TOKEN"])
    assurer_redirection(api)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
