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

## `observe` interdit n'est pas `valeur` interdite (revision Important 6)

La garde qui interdit `observe` sur `resultat_simulation`, `hypothese` et
`interpretation` existe pour empêcher un montant d'apparaître de nulle part —
pas pour empêcher le site d'énoncer une grandeur qu'il calcule lui-même. Ces
trois registres ne référencent aucune donnée *publiée*, donc `observe`
(qui pointe vers une série publiée) leur reste interdit ; mais un chiffre
peut porter une `valeur` déclarée en clair, au niveau du chiffre et non dans
`observe` — c'est cette déclaration, visible du lecteur comme relevant d'une
simulation, d'une hypothèse ou d'une interprétation plutôt que d'une
observation, qui constitue la divulgation. Une `valeur` déclarée entre alors
dans la liste de référence de la garde anti-invention (famille 4), pour que
la prose puisse citer ce chiffre. Ce qui reste interdit, c'est un montant en
prose qu'aucun chiffre ne déclare du tout. Pour `resultat_simulation`, une
`valeur` déclarée exige en plus `simulateur.budget` non vide : un résultat de
simulateur que le lecteur ne peut pas rejouer n'est pas un résultat.

**`valeur` est obligatoire sur ces trois registres, pas seulement licite
(Critical B).** Sans elle, un chiffre n'a ni observation ni valeur déclarée :
`dit` seul n'est vérifié par rien, et pourtant `site/src/analyse-rendu.ts`
l'affiche quand même — nu à l'étage 1, et sous le libellé « Résultat du
simulateur » (ou « Hypothèse », ou « Interprétation ») à l'étage 2 — comme si
le site l'avait lui-même calculé. Un chiffre de ces registres sans `valeur`
déclarée est donc une erreur, exactement comme `observe` manquant l'est pour
`fait_comptable`.

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
millions », « X milliers », « X M€ ») que si un marqueur d'échelle
l'accompagne dans le texte — un mot ou le symbole `M€`, la seule unité
d'affichage du site (`echelle.ts`, fonction `millions()`) : sans lui, un
nombre est lu en euros bruts, jamais deviné en millions au prétexte que
c'est l'unité d'affichage du site. `Md€` reste délibérément hors liste : les
règles d'affichage bannissent le milliard à l'écran, donc aucune prose
générée par le site ne peut légitimement le porter — le laisser
non reconnu, c'est garder cette interdiction effective plutôt que la
contourner en silence. Deviner l'échelle d'un nombre nu ferait accepter
n'importe quel montant à condition de tomber, par hasard d'ordre de
grandeur, dans une bonne fourchette — c'est l'inverse de ce que cette garde
doit empêcher.

Un nombre dont la valeur effective (après échelle) est inférieure à 1000
n'est jamais soumis à la garde — un pourcentage, un rang, un compte de
lignes. Un nombre entier, sans échelle ni décimale, compris entre 1900 et
2100 est traité comme un millésime et jamais comme un montant.

La garde scanne toute la prose que le site écrit et affiche : `titre`,
`verdict.phrase`, `chiffres[].lecture`, `hypotheses[]`, `simulateur.lecture`
et `effets_indirects[].texte`. Deux champs restent **délibérément exclus**,
parce que tous deux citent un chiffre tel qu'il circule plutôt que
d'affirmer une observation : `affirmation.texte` rapporte l'énoncé contesté
lui-même — l'exiger référencé rendrait impossible d'examiner un chiffre
faux, qui est précisément l'objet du produit — et `chiffres[].dit`, de la
même façon, rapporte le montant tel qu'on l'entend couramment, avant que
`lecture` n'en donne la lecture vérifiée. `effets_indirects[].texte` n'a pas
cette excuse : il est rendu sur la page (`site/src/analyse-rendu.ts`,
étage 2) accompagné d'un `auteur` et d'une `source` — exactement la forme
d'une citation fabriquée — donc un montant qui s'y trouve doit être adossé à
un chiffre référencé comme partout ailleurs (Critical A).

## Le signe fait partie du montant (Important C)

Un montant en prose peut être négatif — un déficit, un écart. Le tokeniseur
capture un signe (`-` ASCII ou le vrai signe moins U+2212) directement collé
à un nombre, à condition que ce signe ne soit pas lui-même précédé d'un
chiffre : "-59 946 M€" est un montant négatif, mais le tiret de "2019-2025"
ou d'"Article L. 132-1" reste un séparateur de plage ou de référence
légale, jamais un signe, parce qu'il est précédé d'un chiffre. La
comparaison contre la référence porte alors sur la valeur signée, pas sur sa
valeur absolue : un écart de -59 946 M€ ne correspond jamais à une référence
de +59 946 338 573.
"""

import argparse
import json
import re
import sys
from datetime import date
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
# Important D : liste fermée de docs/analyses-schema.md, colonne
# `budgets_concernes` — vérifiée nulle part avant ce correctif (« martiens »
# passait sans erreur).
BUDGETS = {"etat", "secu", "collectivites", "bareme"}
TYPES = {
    "verification_chiffre",
    "analyse_mesure",
    "decryptage",
    "comparaison",
    "analyse_programme",
    "mise_a_jour",
}

# Registres dont l'affirmation ne vient pas d'une écriture comptable propre à
# la plateforme : ils doivent pouvoir être vérifiés chez un tiers. `observe`
# y est optionnel — la source (famille 5) tient lieu de vérification quand il
# est absent — mais exact-checké quand un auteur choisit de le renseigner.
REGISTRES_A_SOURCER = {"donnee_officielle", "estimation_externe"}

# Registres qui ne référencent aucune donnée publiée par construction
# (docs/analyses-schema.md, section Registres) : un résultat de simulateur,
# une hypothèse ou une interprétation ne sont pas des observations. `observe`
# y est interdit — l'autoriser laisserait une valeur invérifiable entrer dans
# la liste de référence de la garde anti-invention (famille 4).
REGISTRES_OBSERVE_INTERDIT = {"resultat_simulation", "hypothese", "interpretation"}

# Champs obligatoires de niveau racine (docs/analyses-schema.md, colonne
# « Obligatoire » = oui), avec le type attendu et si une valeur vide est
# licite. `chiffres` en est exclu : son propre contrôle (plus bas) vérifie
# déjà l'absence aussi bien que la liste vide, sans doublon.
#
# La présence seule ne suffisait pas (Important 5) : `titre: null`,
# `titre: ""`, `publie_le: null` ou `affirmation: []` (mauvais type) étaient
# tous certifiés sans erreur, la boucle ne vérifiant que la clé. Un booléen
# n'a pas d'« état vide » — `mise_en_avant: false` est une valeur aussi
# licite que `true` — d'où `vide_autorise=True` pour ce seul champ non-liste.
CHAMPS_OBLIGATOIRES: dict[str, tuple[type, bool]] = {
    "slug": (str, False),
    "titre": (str, False),
    "type": (str, False),
    "publie_le": (str, False),
    "themes": (list, False),
    "budgets_concernes": (list, False),
    "mise_en_avant": (bool, True),
    "affirmation": (dict, False),
    "verdict": (dict, False),
    "hypotheses": (list, True),
    "effets_indirects": (list, True),
    "sources": (list, False),
    "simulateur": (dict, False),
    "mises_a_jour": (list, True),
    "verifie_contre": (str, True),
}

# Type attendu de chaque élément des champs listes ci-dessus (Critical 3) :
# `hypotheses` donnée comme une chaîne plutôt qu'une liste faisait
# `enumerate()` sur les caractères un par un, si bien qu'aucun regroupement
# de chiffres n'atteignait jamais le seuil de la garde anti-invention — le
# contrôle censé le détecter ne le voyait donc jamais passer.
_ELEMENT_ATTENDU: dict[str, type] = {
    "themes": str,
    "budgets_concernes": str,
    "hypotheses": str,
    "sources": dict,
    "effets_indirects": dict,
    "mises_a_jour": dict,
}

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _date_valide(valeur: object) -> bool:
    """AAAA-MM-JJ strict : le format d'abord (`date.fromisoformat` accepte
    aussi, depuis Python 3.11, des variantes ISO sans tiret), puis le
    calendrier réel (rejette « 2026-13-40 »)."""
    if not isinstance(valeur, str) or not _DATE_RE.match(valeur):
        return False
    try:
        date.fromisoformat(valeur)
    except ValueError:
        return False
    return True


def _dates_a_verifier(analyse: dict) -> list[tuple[str, object, bool]]:
    """-> [(champ, valeur, nullable), ...] pour chaque date du schéma
    (§15.3.1). `nullable` distingue le seul cas où le schéma autorise
    explicitement `None` — `affirmation.date`, nul si `auteur` est nul — de
    toutes les autres dates. `sources[].consulte_le` et `mises_a_jour[].date`
    sont marquées non nullables : une révision sans date (`mises_a_jour:
    [{"quoi": "x"}]`) ou une source sans date de consultation lisaient un
    `None` comme un skip silencieux plutôt qu'une erreur (Important 5)."""
    affirmation = analyse.get("affirmation") or {}
    dates: list[tuple[str, object, bool]] = [
        ("publie_le", analyse.get("publie_le"), True),
        ("affirmation.date", affirmation.get("date"), True),
        (
            "affirmation.source.consulte_le",
            (affirmation.get("source") or {}).get("consulte_le"),
            True,
        ),
    ]
    for i, source in enumerate(analyse.get("sources") or []):
        if isinstance(source, dict):
            dates.append((f"sources[{i}].consulte_le", source.get("consulte_le"), False))
    for i, effet in enumerate(analyse.get("effets_indirects") or []):
        if isinstance(effet, dict):
            src = effet.get("source") or {}
            dates.append((f"effets_indirects[{i}].source.consulte_le", src.get("consulte_le"), True))
    for i, maj in enumerate(analyse.get("mises_a_jour") or []):
        if isinstance(maj, dict):
            dates.append((f"mises_a_jour[{i}].date", maj.get("date"), False))
    return dates


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

    for champ, (type_attendu, vide_autorise) in CHAMPS_OBLIGATOIRES.items():
        if champ not in analyse:
            erreurs.append(Erreur(slug, champ, "champ obligatoire absent"))
            continue
        valeur = analyse[champ]
        if not isinstance(valeur, type_attendu):
            erreurs.append(
                Erreur(
                    slug,
                    champ,
                    f"type invalide, attendu {type_attendu.__name__} : reçu"
                    f" {type(valeur).__name__}",
                )
            )
            continue
        if not vide_autorise and not valeur:
            erreurs.append(Erreur(slug, champ, "champ obligatoire vide"))
            continue
        element_attendu = _ELEMENT_ATTENDU.get(champ)
        if element_attendu is not None and any(
            not isinstance(e, element_attendu) for e in valeur
        ):
            nom = "une chaîne" if element_attendu is str else "un objet"
            erreurs.append(Erreur(slug, champ, f"chaque élément doit être {nom}"))

    # `chiffres` reste hors de la table ci-dessus : son propre message
    # (« liste absente ou vide ») distingue l'absence de la liste vide sans
    # doublon, et son mauvais type (Critical 3 : une chaîne au lieu d'une
    # liste, comme pour `hypotheses`) est vérifié ici plutôt que d'être
    # laissée fragmenter en caractères par les familles suivantes.
    chiffres = analyse.get("chiffres")
    if not isinstance(chiffres, list) or not chiffres:
        erreurs.append(
            Erreur(slug, "chiffres", "liste absente ou vide : au moins un chiffre requis")
        )
    elif any(not isinstance(c, dict) for c in chiffres):
        erreurs.append(Erreur(slug, "chiffres", "chaque élément doit être un objet"))

    for champ, valeur, nullable in _dates_a_verifier(analyse):
        if valeur is None:
            if not nullable:
                erreurs.append(Erreur(slug, champ, "date manquante"))
            continue
        if not _date_valide(valeur):
            erreurs.append(
                Erreur(slug, champ, f"date invalide, attendu AAAA-MM-JJ : « {valeur} »")
            )

    # Minor : `affirmation.date` n'est nulle licitement que si `auteur` l'est
    # aussi (docs/analyses-schema.md) — une déclaration attribuée sans date
    # passait jusqu'ici sans erreur.
    affirmation = analyse.get("affirmation") or {}
    if affirmation.get("auteur") is not None and affirmation.get("date") is None:
        erreurs.append(
            Erreur(
                slug,
                "affirmation.date",
                "date absente alors que affirmation.auteur est renseigné",
            )
        )

    # Important D : `affirmation.texte` est obligatoire (docs/analyses-schema.md)
    # mais sa présence seule n'était vérifiée nulle part — un champ absent y
    # produisait un TypeError en aval plutôt qu'une erreur du contrôle.
    affirmation_texte = affirmation.get("texte")
    if not isinstance(affirmation_texte, str) or not affirmation_texte:
        erreurs.append(Erreur(slug, "affirmation.texte", "champ obligatoire absent ou vide"))

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

    # Important D : `verdict.phrase` est obligatoire, même défaut que
    # `affirmation.texte` ci-dessus.
    phrase = verdict.get("phrase")
    if not isinstance(phrase, str) or not phrase:
        erreurs.append(Erreur(slug, "verdict.phrase", "champ obligatoire absent ou vide"))

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
        if not isinstance(chiffre, dict):
            continue
        # Important D : `chiffres[].dit` et `chiffres[].lecture` sont tous
        # deux obligatoires (docs/analyses-schema.md) — absents jusqu'ici,
        # ils ne faisaient échouer que le pré-rendu du site (TypeError), pas
        # le contrôle censé les vérifier.
        dit = chiffre.get("dit")
        if not isinstance(dit, str) or not dit:
            erreurs.append(Erreur(slug, f"chiffres[{i}].dit", "champ obligatoire absent ou vide"))
        lecture = chiffre.get("lecture")
        if not isinstance(lecture, str) or not lecture:
            erreurs.append(
                Erreur(slug, f"chiffres[{i}].lecture", "champ obligatoire absent ou vide")
            )

    # Important D : chaque source doit porter `titre` et `url` — `consulte_le`
    # est déjà vérifiée par `_dates_a_verifier` ci-dessus.
    for i, source in enumerate(analyse.get("sources") or []):
        if not isinstance(source, dict):
            continue
        if not isinstance(source.get("titre"), str) or not source.get("titre"):
            erreurs.append(Erreur(slug, f"sources[{i}].titre", "champ obligatoire absent ou vide"))
        if not isinstance(source.get("url"), str) or not source.get("url"):
            erreurs.append(Erreur(slug, f"sources[{i}].url", "champ obligatoire absent ou vide"))

    # Important D : `simulateur` est un objet {budget, contrat, lecture} —
    # `{"x": 1}` passait la vérification de type (dict, non vide) sans que
    # ses trois sous-champs soient jamais regardés. `budget` et `contrat`
    # peuvent être des chaînes vides (docs/analyses-schema.md : aucun
    # réglage ne reproduit alors l'analyse) ; le schéma ne précise pas la
    # même exemption pour `lecture`, donc seule sa présence comme chaîne est
    # exigée ici — pas sa non-vacuité, faute d'indication explicite dans le
    # schéma sur ce point précis (voir le rapport de session).
    simulateur = analyse.get("simulateur")
    simulateur = simulateur if isinstance(simulateur, dict) else {}
    for champ_sim in ("budget", "contrat", "lecture"):
        if not isinstance(simulateur.get(champ_sim), str):
            erreurs.append(
                Erreur(
                    slug,
                    f"simulateur.{champ_sim}",
                    "champ obligatoire absent : doit être une chaîne (peut être vide)",
                )
            )

    # Important D : `budgets_concernes` est une liste fermée
    # (docs/analyses-schema.md), vérifiée nulle part avant ce correctif.
    budgets = analyse.get("budgets_concernes")
    if isinstance(budgets, list):
        for i, budget in enumerate(budgets):
            if budget not in BUDGETS:
                erreurs.append(
                    Erreur(slug, f"budgets_concernes[{i}]", f"budget hors liste : « {budget} »")
                )

    return erreurs


# --- Famille 2 : exactitude ---------------------------------------------------


def _erreurs_exactitude(analyse: dict, donnees: Donnees) -> tuple[list[Erreur], list[float]]:
    """Exact match, sans tolérance — sous condition du registre (révision de
    Important 6, voir la docstring de tête) :

    - `fait_comptable` exige `observe` et le vérifie exactement : c'est le
      registre dont le sens même est « une observation que le pipeline a
      publiée ».
    - `donnee_officielle` et `estimation_externe` l'acceptent en option — la
      source (famille 5) tient lieu de vérification quand il est absent —
      mais un `observe` renseigné reste vérifié exactement : citer une
      observation ne dispense jamais de la citer juste.
    - `resultat_simulation`, `hypothese` et `interpretation` ne référencent
      aucune donnée publiée : `observe` y reste interdit. Un `valeur` déclaré
      au niveau du chiffre (pas dans `observe`) y est en revanche
      **obligatoire** (Critical B) — c'est la divulgation elle-même, sans
      laquelle `dit` seul serait publié comme si le site l'avait
      calculé — et entre dans la liste de référence. `resultat_simulation`
      exige en plus `simulateur.budget` non vide quand `valeur` est déclaré :
      un résultat non rejouable n'en est pas un.

    Un `chiffre` dont `observe` est présent mais sans `indicateur`, `niveau`
    ou `code` est une erreur ici, jamais un skip silencieux (Critical 1) —
    ces champs manquaient auparavant sans être signalés nulle part, ce qui
    laissait passer n'importe quelle `valeur`.

    -> (erreurs, valeurs effectivement vérifiées ou déclarées sous un typage
    licite) — ce second élément est la seule matière première légitime de la
    garde anti-invention (famille 4) : une valeur jamais vérifiée ni déclarée
    sous une forme prévue par le schéma ne doit jamais servir d'alibi à la
    prose (Critical 1).
    """
    slug = analyse.get("slug", "?")
    erreurs: list[Erreur] = []
    verifiees: list[float] = []
    simulateur_budget = (analyse.get("simulateur") or {}).get("budget")
    for i, chiffre in enumerate(analyse.get("chiffres") or []):
        if not isinstance(chiffre, dict):
            continue
        registre = chiffre.get("registre")
        observe = chiffre.get("observe")
        champ_observe = f"chiffres[{i}].observe"

        if registre in REGISTRES_OBSERVE_INTERDIT:
            if observe is not None:
                erreurs.append(
                    Erreur(
                        slug,
                        champ_observe,
                        f"registre « {registre} » ne référence aucune donnée publiée :"
                        " observe doit être absent",
                    )
                )
            valeur_declaree = chiffre.get("valeur")
            champ_valeur = f"chiffres[{i}].valeur"
            if valeur_declaree is None:
                # Critical B : sans valeur déclarée, ce chiffre n'a ni
                # observation ni valeur — `dit` seul n'est vérifié par rien,
                # et le rendu l'affiche pourtant comme si le site l'avait
                # calculé (voir la docstring de tête).
                erreurs.append(
                    Erreur(
                        slug,
                        champ_valeur,
                        f"registre « {registre} » interdit observe : une valeur déclarée"
                        " est obligatoire, sinon rien ne vérifie le chiffre affiché",
                    )
                )
            elif isinstance(valeur_declaree, bool) or not isinstance(
                valeur_declaree, (int, float)
            ):
                erreurs.append(Erreur(slug, champ_valeur, "doit être un nombre"))
            elif registre == "resultat_simulation" and not simulateur_budget:
                erreurs.append(
                    Erreur(
                        slug,
                        champ_valeur,
                        "une valeur déclarée pour resultat_simulation exige"
                        " simulateur.budget non vide",
                    )
                )
            else:
                verifiees.append(valeur_declaree)
            continue

        if observe is None:
            if registre in REGISTRES_A_SOURCER:
                continue  # optionnel pour ce registre : la source en tient lieu
            erreurs.append(Erreur(slug, champ_observe, "champ obligatoire absent"))
            continue
        if not isinstance(observe, dict):
            erreurs.append(Erreur(slug, champ_observe, "doit être un objet"))
            continue

        indicateur, niveau = observe.get("indicateur"), observe.get("niveau")
        code, periode, valeur = observe.get("code"), observe.get("periode"), observe.get("valeur")
        if indicateur is None or niveau is None or code is None:
            erreurs.append(
                Erreur(
                    slug,
                    champ_observe,
                    "indicateur, niveau et code sont tous requis pour vérifier une observation",
                )
            )
            continue
        serie = donnees.serie(indicateur, niveau, code)
        publiee = serie.get(periode) if serie else None
        champ = f"{champ_observe}.valeur"
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
        else:
            verifiees.append(valeur)
    return erreurs, verifiees


# --- Famille 3 : cohérence de catalogue --------------------------------------


def _erreurs_catalogue(analyse: dict, donnees: Donnees) -> list[Erreur]:
    slug = analyse.get("slug", "?")
    erreurs: list[Erreur] = []
    catalogue = donnees.catalogue()
    for i, chiffre in enumerate(analyse.get("chiffres") or []):
        # Minor : `(chiffre or {}).get("observe") or {}` laissait passer un
        # `observe: "texte"` tel quel (une chaîne non vide est truthy, donc
        # jamais remplacée par `{}`) — `.get()` levait alors AttributeError
        # avant que le typage erroné soit signalé par la famille 2.
        observe = chiffre.get("observe") if isinstance(chiffre, dict) else None
        if not isinstance(observe, dict):
            continue
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

# `M€` vaut « millions », au même titre que le mot : c'est le symbole que
# `millions()` (site/src/echelle.ts) appose à tout montant affiché à
# l'écran, et la seule échelle que le site rend jamais visible. `Md€` n'est
# délibérément pas un marqueur reconnu (voir la docstring de tête) : les
# règles d'affichage interdisent le milliard à l'écran, donc aucune prose
# légitime ne peut le porter.
SYMBOLE_MILLIONS = "M€"

# Espaces horizontales reconnues comme séparateur de milliers légitime en
# français : normale (U+0020), insécable (U+00A0), insécable fine (U+202F —
# celle que «millions()» de site/src/echelle.ts émet réellement), cadratin
# (U+2002), demi-cadratin (U+2003), tabulaire (U+2007), fine (U+2009) et
# mathématique moyenne (U+205F) — toutes se voient dans des textes copiés
# depuis des sources différentes (traitement de texte, export, PDF). C'est
# aussi l'ensemble que `_lisible` autorise à dépouiller avant `float()` :
# tout caractère ajouté ici doit pouvoir être strippé sans lever (garde-fou
# du réviseur, Critical 2 vague 3).
_ESPACES = "\u0020\u00a0\u2002\u2003\u2007\u2009\u202f\u205f"

# Ponctuation qui peut apparaître comme séparateur de groupement dans un
# nombre recopié mais n'est jamais un séparateur français légitime : les
# regroupements anglo-saxon (`.`) et suisse (`'`, et son autocorrection en
# apostrophe typographique U+2019 — la plus probable des deux en pratique,
# un traitement de texte la substitue systématiquement à l'ASCII), la
# variante U+02BC (lettre modificative), le point médian U+00B7, et deux
# joints invisibles qui se glissent dans du texte copié sans y laisser de
# trace visible (le soudeur de mots U+2060, l'espace de largeur nulle
# U+200B). Capturés par le tokeniseur pour ne jamais fragmenter un nombre en
# morceaux sous le seuil de la garde (Critical 2), mais jamais dans
# `_ESPACES` : `_lisible` les refuse tous, la virgule y comprise au-delà
# d'une seule occurrence.
_SEPARATEURS_MECONNUS = ".'\u2019\u02bc\u00b7\u2060\u200b"
_SEPARATEURS = _ESPACES + _SEPARATEURS_MECONNUS + ","

# Un nombre est un groupe de chiffres, suivi de zéro ou plusieurs groupes
# introduits par n'importe lequel de ces séparateurs — reconnu ou non : c'est
# ce qui permet de voir « 87.000.000.000 » (ou « 87\u2019000\u2019000\u2019000 », ou tout
# regroupement à espace non standard) comme UN seul nombre illisible plutôt
# que des fragments sous le seuil de la garde, qui passaient inaperçus avant
# ce correctif. Seuls les chiffres bornent le nombre (`(?<!\d)` / `(?!\d)`) —
# un séparateur peut légitimement continuer en un mot ordinaire de la phrase
# (l'espace qui suit « 87 000 000 000 » avant « euros », par exemple), donc
# l'exclure de la frontière casserait la lecture des nombres suivis de
# texte, pas seulement celle des illisibles. Ni `\s` (qui avalerait `\n` et
# `\t`, fusionnant deux nombres distincts au travers d'un saut de ligne dans
# `hypotheses[]`), ni `-` ni `/` (qui casseraient « Article L. 132-1 » et
# « 2019-2025 » en un seul nombre) ne sont dans cette classe.
#
# Important C : un signe moins directement collé au nombre en fait partie —
# `-` ASCII ou le vrai signe moins U+2212 (substitué automatiquement par
# certains éditeurs). Groupe nommé `signe`, optionnel, capturé seulement
# quand il n'est PAS lui-même précédé d'un chiffre (`(?<![\d…])`) : c'est ce
# qui distingue « -59 946 M€ » (un montant négatif) du tiret de plage
# « 2019-2025 » ou de référence légale « Article L. 132-1 », où le tiret
# suit un chiffre et reste un simple séparateur entre deux nombres positifs
# distincts.
_SIGNES = "-−"
_NOMBRE_RE = re.compile(
    r"(?:(?<![\d" + re.escape(_SIGNES) + r"])(?P<signe>[" + re.escape(_SIGNES) + r"])(?=\d))?"
    r"(?<!\d)\d+(?:[" + re.escape(_SEPARATEURS) + r"]\d+)*(?!\d)"
)
_ECHELLE_MOT_RE = re.compile(r"^\s*(" + "|".join(ECHELLES) + r")\b")
# Pas de \b final ici : « € » n'est pas un caractère de mot, donc un \b
# juste après ne matcherait jamais quand « M€ » est suivi d'une espace ou
# de la fin du texte — précisément le cas courant (« 59 946 M€ » en fin de
# phrase).
_ECHELLE_SYMBOLE_RE = re.compile(r"^\s*" + re.escape(SYMBOLE_MILLIONS))


def _lisible(brut: str) -> bool:
    """Un token est lisible seulement si tous ses séparateurs de
    regroupement sont des espaces reconnues (`_ESPACES`), avec au plus une
    virgule décimale à la française — et, quand cette virgule existe, sa
    partie décimale ne contient elle-même aucun séparateur.

    Ce dernier point ferme Important 3 : « 1 234,5 678 » n'a qu'une seule
    virgule (donc passait la seule garde d'avant) mais une espace dans la
    partie décimale, et `float("1234.5 678")` lève — un token qui ressemble
    à un nombre valide faisait alors mourir tout le run sans diagnostic pour
    les analyses restantes."""
    if brut.count(",") > 1:
        return False
    entier, _, decimale = brut.partition(",")
    if set(decimale) - set("0123456789"):
        return False
    return set(entier) - set("0123456789") <= set(_ESPACES)


def _candidats(texte: str) -> list[tuple[float, int, float, bool, str]]:
    """-> [(valeur, décimales écrites, échelle, lisible, brut), ...] pour
    chaque nombre du texte. `brut` est le texte exact du token — la seule
    chose qu'un message d'erreur sur un token illisible peut citer sans
    inventer une valeur que l'auteur n'a pas écrite (Important 6).

    Un nombre illisible n'est jamais parsé « au mieux » : sa valeur
    reconstituée n'a alors aucun sens fiable, et n'est conservée que pour
    compatibilité de forme du tuple — jamais affichée (Critical 2).

    `brut` inclut le signe quand `_NOMBRE_RE` en a capturé un (Important C) ;
    `corps` en est la partie numérique seule, la seule que `_lisible` et le
    parsing doivent voir — un « - » ou un « − » en tête ferait échouer
    `_lisible` (ni chiffre, ni espace reconnue) pour un token pourtant
    parfaitement lisible."""
    candidats = []
    for match in _NOMBRE_RE.finditer(texte):
        brut = match.group()
        signe = match.group("signe")
        corps = brut[len(signe) :] if signe else brut
        if not _lisible(corps):
            valeur = float(re.sub(r"[^0-9]", "", corps) or 0)
            if signe:
                valeur = -valeur
            candidats.append((valeur, 0, 1.0, False, brut))
            continue
        entier, _, decimale = corps.partition(",")
        for espace in _ESPACES:
            entier = entier.replace(espace, "")
        valeur = float(f"{entier}.{decimale}") if decimale else float(entier)
        if signe:
            valeur = -valeur
        suite_texte = texte[match.end() :]
        suite_mot = _ECHELLE_MOT_RE.match(suite_texte)
        if suite_mot:
            echelle = ECHELLES[suite_mot.group(1)]
        elif _ECHELLE_SYMBOLE_RE.match(suite_texte):
            echelle = 1e6
        else:
            echelle = 1.0
        candidats.append((valeur, len(decimale), echelle, True, brut))
    return candidats


def _correspond(valeur: float, decimales: int, echelle: float, reference: float) -> bool:
    return abs(round(reference / echelle, decimales) - valeur) < 1e-6


def _nombre_non_reference(texte: str, references: list[float]) -> tuple[str, str] | None:
    """-> (raison, texte) pour le premier nombre du texte qui échoue la
    garde, ou None si tout correspond. `raison` vaut :

    - `"illisible"` : un séparateur de groupement non reconnu fragmente ou
      pollue le token — `texte` est alors le token brut recopié tel quel
      (Important 6), jamais une valeur reconstruite à partir de lui.
    - `"invente"` : le nombre se lit sans ambiguïté (≥ 1000, hors millésime)
      mais ne correspond à aucune référence — `texte` est alors sa valeur.

    Un nombre illisible échoue toujours, quelle que soit sa valeur apparente
    — le tokeniseur ne peut pas savoir ce qu'il désigne, et un tokeniseur qui
    ne peut pas lire un chiffre avec confiance doit refuser, pas laisser
    passer (Critical 2)."""
    for valeur, decimales, echelle, lisible, brut in _candidats(texte):
        if not lisible:
            return "illisible", brut
        # Important C : le seuil porte sur l'ampleur du montant, jamais sur
        # son signe — un écart de -1 234 M€ franchit le seuil tout autant
        # qu'un écart de +1 234 M€.
        effective = abs(valeur) * echelle
        if effective < SEUIL_GARDE:
            continue
        if decimales == 0 and echelle == 1.0 and MILLESIME_MIN <= valeur <= MILLESIME_MAX:
            continue
        if not any(_correspond(valeur, decimales, echelle, ref) for ref in references):
            return "invente", str(valeur)
    return None


def _erreurs_invention(analyse: dict, references: list[float]) -> list[Erreur]:
    """`references` ne contient que des valeurs vérifiées contre une série
    publiée, ou déclarées sous un registre qui l'autorise explicitement, par
    `_erreurs_exactitude` (Critical 1) : une `observe.valeur` jamais
    vérifiée — champ manquant, indicateur inconnu, valeur fausse — ne peut
    plus servir d'alibi à un montant inventé dans la prose."""
    slug = analyse.get("slug", "?")
    erreurs: list[Erreur] = []

    def verifier(champ: str, texte: str) -> None:
        # `affirmation.texte` et `chiffres[].dit` ne sont jamais passés ici :
        # c'est ce qui verrouille leur exemption, documentée dans la
        # docstring de tête — tous deux citent le chiffre tel qu'il circule,
        # pas une observation que l'analyse affirme.
        resultat = _nombre_non_reference(texte or "", references)
        if resultat is None:
            return
        raison, valeur = resultat
        if raison == "illisible":
            # Important 6 : router ce cas par le message d'invention citait
            # une valeur que l'auteur n'a jamais écrite (« 1531.0 » pour
            # « 15.3.1 ») — sans indice que la cause est un séparateur de
            # groupement, pas un montant inventé.
            message = f"séparateur de groupement non reconnu dans « {valeur} »"
        else:
            message = f"« {valeur} » ne correspond à aucun chiffre référencé"
        erreurs.append(Erreur(slug, champ, message))

    verifier("titre", analyse.get("titre"))
    verifier("verdict.phrase", (analyse.get("verdict") or {}).get("phrase"))
    for i, chiffre in enumerate(analyse.get("chiffres") or []):
        lecture = chiffre.get("lecture") if isinstance(chiffre, dict) else None
        verifier(f"chiffres[{i}].lecture", lecture)
    for i, hypothese in enumerate(analyse.get("hypotheses") or []):
        verifier(f"hypotheses[{i}]", hypothese if isinstance(hypothese, str) else None)
    verifier("simulateur.lecture", (analyse.get("simulateur") or {}).get("lecture"))
    for i, effet in enumerate(analyse.get("effets_indirects") or []):
        # Critical A : rendu à l'étage 2 (`site/src/analyse-rendu.ts`) avec un
        # `auteur` et une `source` — la forme d'une citation fabriquée si un
        # montant y est inventé. Contrairement à `affirmation.texte`, ce
        # champ n'a pas vocation à rapporter un chiffre tel qu'il circule :
        # il affirme une conséquence, donc il est scanné comme le reste.
        texte = effet.get("texte") if isinstance(effet, dict) else None
        verifier(f"effets_indirects[{i}].texte", texte)

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
        erreurs_exactitude, valeurs_verifiees = _erreurs_exactitude(analyse, donnees)
        erreurs = [
            *_erreurs_schema(analyse),
            *erreurs_exactitude,
            *_erreurs_catalogue(analyse, donnees),
            *_erreurs_invention(analyse, valeurs_verifiees),
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
        "--version",
        default=None,
        help="millésime de données à contrôler (défaut : le dernier publié)",
    )
    args = parser.parse_args()

    # Un répertoire inexistant ou une liste vide sortaient à 0 sans avoir rien
    # contrôlé — un typo dans l'invocation CI transformait la porte en
    # passoire silencieuse (Critical 3). Vérifiés avant tout appel réseau :
    # un mauvais chemin ne doit pas dépendre du réseau pour être détecté.
    if not args.repertoire.is_dir():
        print(f"ERREUR : « {args.repertoire} » n'est pas un répertoire")
        return 1

    analyses = charger_repertoire(args.repertoire)
    if not analyses:
        print(f"ERREUR : aucune analyse trouvée dans « {args.repertoire} »")
        return 1

    donnees = DonneesReseau(version=args.version)
    erreurs = controler(analyses, donnees)

    for erreur in erreurs:
        print(f"ERREUR [{erreur.slug}] {erreur.champ} : {erreur.message}")
    if erreurs:
        print(
            f"{len(erreurs)} erreur(s) sur {len(analyses)} analyse(s) (version {donnees.version()})"
        )
        return 1
    print(f"{len(analyses)} analyse(s) contrôlée(s), aucune erreur (version {donnees.version()})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
