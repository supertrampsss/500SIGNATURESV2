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


def _arguments(module) -> list:
    """Ce que `declarer` attend en plus de la connexion.

    La plupart des connecteurs déclarent depuis leurs constantes ; quelques-uns
    (macro) construisent d'abord un plan, sans réseau, via `_plan()`. Une
    signature qu'on ne sait pas servir doit se voir avant d'écrire quoi que ce
    soit — c'est elle qui a fait échouer le run du 7 août.
    """
    parametres = list(inspect.signature(module.declarer).parameters)[1:]
    if not parametres:
        return []
    if parametres == ["plan"] and hasattr(module, "_plan"):
        return [module._plan()]
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
    appels = [(module, _arguments(module)) for module in modules]
    conn = entrepot.connect()
    for module, arguments in appels:
        module.declarer(conn, *arguments)
        entrepot.etape(f"redéclaré : {module.__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
