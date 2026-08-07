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

from plateforme import entrepot


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("modules", nargs="+",
                        help="noms de modules sous plateforme.normalize")
    noms = parser.parse_args().modules
    # Tout importer avant d'écrire quoi que ce soit : une faute de frappe dans
    # le dernier nom ne doit pas laisser une redéclaration à moitié faite.
    modules = [importlib.import_module(f"plateforme.normalize.{nom}") for nom in noms]
    conn = entrepot.connect()
    for module in modules:
        module.declarer(conn)
        entrepot.etape(f"redéclaré : {module.__name__}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
