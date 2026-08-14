"""Le contrôle qui remplace la relecture humaine des analyses éditoriales (D11).

docs/09 §D11 : un relecteur ne peut pas vérifier à la main chaque montant cité
dans une analyse contre les fichiers publiés, alors qu'une machine le fait
intégralement et à chaque publication de données. Ce module est cette
machine — `python -m plateforme.controle_analyses <répertoire>`.

**Ce que ce contrôle garantit** : que chaque montant `chiffres[].observe.valeur`
d'une analyse est exactement — au centime, sans tolérance — la valeur publiée
pour cet indicateur, ce niveau, ce code et cette période dans le millésime de
données contrôlé ; que le vocabulaire fermé du schéma (crans, confusions,
registres) est respecté ; que l'indicateur cité existe et est publié à la
maille invoquée ; que tout montant significatif écrit en prose est adossé à
l'un des chiffres référencés, jamais inventé ; que les chiffres de registre
« donnée officielle » ou « estimation externe » portent une source vérifiable.

**Ce que ce contrôle ne garantit pas** : que le sujet choisi est pertinent, que
le raisonnement du verdict est juste, qu'aucune source n'est fabriquée (une URL
plausible mais fictive passe le contrôle — seule une relecture humaine du lien
lui-même le détecterait), ou que la prose est bien écrite. Il vérifie
l'arithmétique et les références, pas le jugement.

## La frontière de l'arrondi (garde anti-invention)

Un montant écrit en prose peut légitimement arrondir ce qu'il désigne — « 59,9
milliards » est une lecture honnête de 59 946 338 573 — mais ne peut désigner
que ça. La règle retenue, unique et symétrique : on ARRONDIT LA VALEUR
PUBLIÉE À LA MÊME PRÉCISION QUE CELLE ÉCRITE DANS LA PROSE, et on compare.

- « 59,9 milliards » : un chiffre après la virgule, échelle milliard.
  round(59 946 338 573 / 1e9, 1) = 59.9 → correspond.
- « 59 946,34 » (aucun mot d'échelle, donc lu en euros bruts) : deux chiffres
  après la virgule, aucune échelle. round(59 946 338 573, 2) = 59 946 338 573.00
  ≠ 59 946,34 → ne correspond à rien, la garde refuse.
- « 59 946 338 573 » (citation exacte, aucune échelle) : zéro décimale.
  round(59 946 338 573, 0) = 59 946 338 573 → correspond : citer le montant
  exact reste toujours permis.

Cette règle n'autorise donc un montant scaladé (« X milliards », « X
millions », « X milliers ») que si un mot d'échelle l'accompagne dans le
texte : sans lui, un nombre est lu en euros bruts, jamais deviné en millions
au prétexte que c'est l'unité d'affichage du site. Deviner l'échelle d'un
nombre nu ferait accepter n'importe quel montant à condition de tomber, par
hasard d'ordre de grandeur, dans une bonne fourchette — c'est l'inverse de ce
que cette garde doit empêcher.

Un nombre dont la valeur effective (après échelle) est inférieure à 1000
n'est jamais soumis à la garde — un pourcentage, un rang, un compte de
lignes. Un nombre entier, sans échelle ni décimale, compris entre 1900 et
2100 est traité comme un millésime et jamais comme un montant.

`affirmation.texte` est **délibérément exclu** de cette garde : ce champ cite
l'énoncé tel qu'il circule, et il contient par nature le chiffre contesté —
l'exiger référencé rendrait impossible d'examiner un chiffre faux, qui est
précisément l'objet du produit.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import NamedTuple, Protocol

import httpx

from plateforme import http

BASE_URL = "https://pub-fc39d357004540a182a907aed4875ef5.r2.dev"

# Les trois listes fermées du schéma (docs/analyses-schema.md).
CRANS = {"exact", "hors_perimetre", "introuvable"}
CONFUSIONS = {
    "ae_cp",
    "brut_net",
    "vote_execute",
    "stock_flux",
    "etat_apu",
    "annuel_cumule",
    "perimetre_geographique",
}
REGISTRES = {
    "fait_comptable",
    "donnee_officielle",
    "resultat_simulation",
    "estimation_externe",
    "hypothese",
    "interpretation",
}
TYPES = {
    "verification_chiffre",
    "analyse_mesure",
    "decryptage",
    "comparaison",
    "analyse_programme",
    "mise_a_jour",
}

# Registres dont l'affirmation ne vient pas d'une écriture comptable propre à
# la plateforme : ils doivent pouvoir être vérifiés chez un tiers.
REGISTRES_A_SOURCER = {"donnee_officielle", "estimation_externe"}


class Erreur(NamedTuple):
    slug: str
    champ: str
    message: str


class Donnees(Protocol):
    """Ce dont le contrôle a besoin des données publiées — injectable, pour tester hors réseau."""

    def catalogue(self) -> dict[str, dict]:
        """-> {indicateur_id: {"niveaux": [...], ...}} du catalogue publié."""
        ...

    def serie(self, indicateur: str, niveau: str, code: str) -> dict[str, float] | None:
        """-> {periode: valeur} pour ce territoire, ou None si rien n'est publié."""
        ...

    def version(self) -> str:
        """-> le millésime de données contrôlé, écrit dans `verifie_contre`."""
        ...


class DonneesReseau:
    """Lit `data/derniere.json` puis les fichiers de la version sur le bucket public.

    Toutes les lectures sont mises en cache pour la durée du contrôle : un même
    fichier de territoire est demandé une fois, même s'il est référencé par
    plusieurs chiffres de plusieurs analyses.
    """

    def __init__(self, version: str | None = None, base_url: str = BASE_URL):
        self._base_url = base_url.rstrip("/")
        self._version = version or self._derniere_version()
        self._cache: dict[str, dict | list | None] = {}
        self._catalogue: dict[str, dict] | None = None

    def _derniere_version(self) -> str:
        reponse = http.fetch(f"{self._base_url}/data/derniere.json")
        return reponse.json()["version"]

    def _charger(self, chemin: str) -> dict | list | None:
        if chemin not in self._cache:
            url = f"{self._base_url}/data/{self._version}/{chemin}"
            try:
                reponse = http.fetch(url)
            except httpx.HTTPStatusError:
                self._cache[chemin] = None
            else:
                self._cache[chemin] = reponse.json()
        return self._cache[chemin]

    def catalogue(self) -> dict[str, dict]:
        if self._catalogue is None:
            lignes = self._charger("indicateurs.json") or []
            self._catalogue = {ligne["id"]: ligne for ligne in lignes}
        return self._catalogue

    def _lot(self, niveau: str, code: str) -> str:
        # Seule la commune répartit ses territoires en plusieurs fichiers, un
        # par département (publish.py : `groupes[lot][code]`). Les autres
        # mailles tiennent dans un unique fichier "tous".
        if niveau != "commune":
            return "tous"
        index = self._charger(f"territoires/{niveau}/index.json")
        if not index:
            return "tous"
        try:
            position = index["codes"].index(code)
        except ValueError:
            return "tous"
        return index["parents"][position] or "tous"

    def serie(self, indicateur: str, niveau: str, code: str) -> dict[str, float] | None:
        lot = self._lot(niveau, code)
        contenu = self._charger(f"territoires/{niveau}/{lot}.json")
        if not contenu or code not in contenu:
            return None
        return contenu[code].get("series", {}).get(indicateur)

    def version(self) -> str:
        return self._version


def charger_repertoire(repertoire: Path) -> list[dict]:
    """Charge chaque `*.json` du répertoire, marqué du nom de fichier lu.

    La clé `_fichier`, ajoutée ici, n'appartient pas au schéma de la tâche 1 :
    elle ne sert qu'à ce contrôle (comparaison avec `slug`) et n'est jamais
    réécrite sur disque — ce module ne modifie aucun fichier d'analyse.
    """
    return [
        {**json.loads(chemin.read_text(encoding="utf-8")), "_fichier": chemin.name}
        for chemin in sorted(repertoire.glob("*.json"))
    ]


# --- Famille 1 : schéma ------------------------------------------------------


def _erreurs_schema(analyse: dict) -> list[Erreur]:
    slug = analyse.get("slug", "?")
    erreurs: list[Erreur] = []

    fichier = analyse.get("_fichier")
    if fichier is not None and Path(fichier).stem != slug:
        erreurs.append(
            Erreur(slug, "slug", f"le slug « {slug} » ne correspond pas au fichier « {fichier} »")
        )

    type_ = analyse.get("type")
    if type_ not in TYPES:
        erreurs.append(Erreur(slug, "type", f"type hors liste : « {type_} »"))

    verdict = analyse.get("verdict") or {}
    cran = verdict.get("cran")
    if cran not in CRANS:
        erreurs.append(Erreur(slug, "verdict.cran", f"cran hors liste : « {cran} »"))

    confusion = verdict.get("confusion")
    if cran == "hors_perimetre":
        if confusion is None:
            erreurs.append(
                Erreur(slug, "verdict.confusion", "cran hors_perimetre sans confusion déclarée")
            )
        elif confusion not in CONFUSIONS:
            erreurs.append(
                Erreur(slug, "verdict.confusion", f"confusion hors liste : « {confusion} »")
            )
    elif confusion is not None:
        erreurs.append(
            Erreur(
                slug,
                "verdict.confusion",
                f"confusion présente hors du cran hors_perimetre (cran = « {cran} »)",
            )
        )

    for i, chiffre in enumerate(analyse.get("chiffres") or []):
        registre = chiffre.get("registre") if isinstance(chiffre, dict) else None
        if registre not in REGISTRES:
            erreurs.append(
                Erreur(
                    slug,
                    f"chiffres[{i}].registre",
                    f"registre hors liste : « {registre} »",
                )
            )

    return erreurs


# --- Famille 2 : exactitude ---------------------------------------------------


def _erreurs_exactitude(analyse: dict, donnees: Donnees) -> list[Erreur]:
    """Exact match, sans tolérance : une analyse recopie ce qui est publié."""
    slug = analyse.get("slug", "?")
    erreurs: list[Erreur] = []
    for i, chiffre in enumerate(analyse.get("chiffres") or []):
        observe = (chiffre or {}).get("observe") or {}
        indicateur, niveau = observe.get("indicateur"), observe.get("niveau")
        code, periode, valeur = observe.get("code"), observe.get("periode"), observe.get("valeur")
        if indicateur is None or niveau is None or code is None:
            continue  # champ manquant : signalé ailleurs, pas de valeur à comparer
        serie = donnees.serie(indicateur, niveau, code)
        publiee = serie.get(periode) if serie else None
        champ = f"chiffres[{i}].observe.valeur"
        if publiee is None:
            erreurs.append(
                Erreur(
                    slug,
                    champ,
                    f"aucune valeur publiée pour {indicateur}/{niveau}/{code}/{periode}",
                )
            )
        elif publiee != valeur:
            erreurs.append(
                Erreur(slug, champ, f"{valeur} ne correspond pas à la valeur publiée {publiee}")
            )
    return erreurs


# --- Famille 3 : cohérence de catalogue --------------------------------------


def _erreurs_catalogue(analyse: dict, donnees: Donnees) -> list[Erreur]:
    slug = analyse.get("slug", "?")
    erreurs: list[Erreur] = []
    catalogue = donnees.catalogue()
    for i, chiffre in enumerate(analyse.get("chiffres") or []):
        observe = (chiffre or {}).get("observe") or {}
        indicateur, niveau = observe.get("indicateur"), observe.get("niveau")
        if indicateur is None:
            continue
        entree = catalogue.get(indicateur)
        if entree is None:
            erreurs.append(
                Erreur(
                    slug,
                    f"chiffres[{i}].observe.indicateur",
                    f"« {indicateur} » absent du catalogue publié",
                )
            )
        elif niveau not in (entree.get("niveaux") or []):
            erreurs.append(
                Erreur(
                    slug,
                    f"chiffres[{i}].observe.niveau",
                    f"« {indicateur} » n'est pas publié à la maille « {niveau} »",
                )
            )
    return erreurs


# --- Famille 4 : garde anti-invention -----------------------------------------

# Voir la docstring de tête pour la justification de cette frontière.
SEUIL_GARDE = 1000
MILLESIME_MIN, MILLESIME_MAX = 1900, 2100

ECHELLES = {
    "milliard": 1e9,
    "milliards": 1e9,
    "million": 1e6,
    "millions": 1e6,
    "millier": 1e3,
    "milliers": 1e3,
}

# Groupes de trois chiffres séparés par une espace (normale, insécable ou fine
# insécable — les trois se voient dans des textes copiés depuis des sources
# différentes), avec une décimale à la française introduite par une virgule.
_NOMBRE_RE = re.compile(r"(?<!\d)(?:\d{1,3}(?:[   ]\d{3})+|\d+)(?:,\d+)?(?!\d)")
_ECHELLE_RE = re.compile(r"^\s*(" + "|".join(ECHELLES) + r")\b")


def _candidats(texte: str) -> list[tuple[float, int, float]]:
    """-> [(valeur, décimales écrites, échelle), ...] pour chaque nombre du texte."""
    candidats = []
    for match in _NOMBRE_RE.finditer(texte):
        entier, _, decimale = match.group().partition(",")
        entier = entier.replace(" ", "").replace(" ", "").replace(" ", "")
        valeur = float(f"{entier}.{decimale}") if decimale else float(entier)
        suite = _ECHELLE_RE.match(texte[match.end() :])
        echelle = ECHELLES[suite.group(1)] if suite else 1.0
        candidats.append((valeur, len(decimale), echelle))
    return candidats


def _correspond(valeur: float, decimales: int, echelle: float, reference: float) -> bool:
    return abs(round(reference / echelle, decimales) - valeur) < 1e-6


def _nombre_non_reference(texte: str, references: list[float]) -> float | None:
    """-> le premier nombre ≥ 1000 (hors millésime) du texte qui ne correspond
    à aucune référence, ou None si tout correspond."""
    for valeur, decimales, echelle in _candidats(texte):
        effective = valeur * echelle
        if effective < SEUIL_GARDE:
            continue
        if decimales == 0 and echelle == 1.0 and MILLESIME_MIN <= valeur <= MILLESIME_MAX:
            continue
        if not any(_correspond(valeur, decimales, echelle, ref) for ref in references):
            return valeur
    return None


def _erreurs_invention(analyse: dict) -> list[Erreur]:
    slug = analyse.get("slug", "?")
    references = [
        (chiffre.get("observe") or {}).get("valeur")
        for chiffre in (analyse.get("chiffres") or [])
        if isinstance(chiffre, dict)
    ]
    references = [v for v in references if isinstance(v, int | float)]

    erreurs: list[Erreur] = []

    def verifier(champ: str, texte: str) -> None:
        # `affirmation.texte` n'est jamais passé ici : c'est ce qui verrouille
        # son exemption, documentée dans la docstring de tête.
        invente = _nombre_non_reference(texte or "", references)
        if invente is not None:
            erreurs.append(
                Erreur(slug, champ, f"« {invente} » ne correspond à aucun chiffre référencé")
            )

    verifier("titre", analyse.get("titre"))
    verifier("verdict.phrase", (analyse.get("verdict") or {}).get("phrase"))
    for i, chiffre in enumerate(analyse.get("chiffres") or []):
        verifier(f"chiffres[{i}].lecture", (chiffre or {}).get("lecture"))

    return erreurs


# --- Famille 5 : sources -------------------------------------------------------


def _erreurs_sources(analyse: dict) -> list[Erreur]:
    slug = analyse.get("slug", "?")
    a_sourcer = any(
        isinstance(chiffre, dict) and chiffre.get("registre") in REGISTRES_A_SOURCER
        for chiffre in (analyse.get("chiffres") or [])
    )
    if not a_sourcer:
        return []
    sources = analyse.get("sources") or []
    valides = [s for s in sources if isinstance(s, dict) and s.get("url") and s.get("consulte_le")]
    if not valides:
        return [
            Erreur(
                slug,
                "sources",
                "un chiffre de registre donnee_officielle ou estimation_externe exige"
                " une source avec URL et date de consultation dans `sources`",
            )
        ]
    return []


def controler(analyses: list[dict], donnees: Donnees) -> list[Erreur]:
    """Applique les cinq familles de contrôle (spec §15.3) à chaque analyse.

    Une analyse sans aucune erreur voit son `verifie_contre` écrit à la
    version contrôlée — en mémoire seulement : ce module ne réécrit jamais un
    fichier sur disque, `main()` ne fait qu'imprimer et sortir en erreur.
    """
    toutes: list[Erreur] = []
    for analyse in analyses:
        erreurs = [
            *_erreurs_schema(analyse),
            *_erreurs_exactitude(analyse, donnees),
            *_erreurs_catalogue(analyse, donnees),
            *_erreurs_invention(analyse),
            *_erreurs_sources(analyse),
        ]
        toutes += erreurs
        if not erreurs:
            analyse["verifie_contre"] = donnees.version()
    return toutes


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Contrôle déterministe des analyses éditoriales (docs/analyses-schema.md)."
    )
    parser.add_argument("repertoire", type=Path, help="répertoire des fichiers d'analyse (*.json)")
    parser.add_argument(
        "--version", default=None, help="millésime de données à contrôler (défaut : le dernier publié)"
    )
    args = parser.parse_args()

    analyses = charger_repertoire(args.repertoire)
    donnees = DonneesReseau(version=args.version)
    erreurs = controler(analyses, donnees)

    for erreur in erreurs:
        print(f"ERREUR [{erreur.slug}] {erreur.champ} : {erreur.message}")
    if erreurs:
        print(f"{len(erreurs)} erreur(s) sur {len(analyses)} analyse(s) (version {donnees.version()})")
        return 1
    print(f"{len(analyses)} analyse(s) contrôlée(s), aucune erreur (version {donnees.version()})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
