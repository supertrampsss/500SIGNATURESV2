"""Redéclarer des indicateurs sans réingérer leur donnée.

Un libellé corrigé, une unité précisée, un indicateur dépublié : tout cela vit
dans `declarer()`, pas dans la donnée. Relancer le connecteur entier pour un
libellé ferait payer un téléchargement de source — parfois des centaines de
mégaoctets — pour une mise à jour qui n'en dépend pas. Ce module appelle le
seul `declarer(conn)` des connecteurs nommés, dans l'ordre donné.

Usage : python -m plateforme.redeclarer securite subventions ...
"""

import argparse
import importlib
import inspect

from plateforme import entrepot


# Les mailles que l'OFGL déclare, reprises du workflow d'ingestion. La
# publication recalcule de toute façon `geo_levels` depuis les observations.
NIVEAUX_OFGL = ["commune", "departement", "region"]


def _appel(module) -> tuple:
    """-> (fonction de déclaration, arguments), ou l'échec avant toute écriture.

    La plupart des connecteurs déclarent depuis leurs constantes ; `macro`
    construit d'abord un plan, sans réseau, via `_plan()` ; `ofgl` n'a pas de
    `declarer` du tout mais un `declarer_indicateurs(conn, niveaux)`, et son
    seul point d'entrée retéléchargerait la source entière. Une signature qu'on
    ne sait pas servir doit se voir avant d'écrire quoi que ce soit : c'est elle
    qui a fait échouer le run du 7 août.
    """
    if not hasattr(module, "declarer") and hasattr(module, "declarer_indicateurs"):
        return (module.declarer_indicateurs, [NIVEAUX_OFGL])
    parametres = list(inspect.signature(module.declarer).parameters)[1:]
    if not parametres:
        return (module.declarer, [])
    if parametres == ["plan"] and hasattr(module, "_plan"):
        return (module.declarer, [module._plan()])
    raise SystemExit(
        f"{module.__name__}.declarer({', '.join(['conn', *parametres])}) :"
        " signature que ce module ne sait pas servir"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("modules", nargs="+",
                        help="noms de modules sous plateforme.normalize")
    noms = parser.parse_args().modules
    # Tout importer et résoudre toutes les signatures avant d'écrire quoi que
    # ce soit : une faute dans le dernier nom ne doit pas laisser une
    # redéclaration à moitié faite.
    modules = [importlib.import_module(f"plateforme.normalize.{nom}") for nom in noms]
    appels = [(module, *_appel(module)) for module in modules]
    conn = entrepot.connect()
    for module, declarer, arguments in appels:
        declarer(conn, *arguments)
        entrepot.etape(f"redéclaré : {module.__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
