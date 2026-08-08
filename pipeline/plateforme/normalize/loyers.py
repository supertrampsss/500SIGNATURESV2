"""Carte des loyers : 34 900 communes affichées, 4 869 réellement mesurées (ANIL).

L'ANIL et la DGALN publient chaque année un loyer d'annonce au mètre carré pour
**toutes** les communes de France. Le fichier a une ligne par commune, une valeur
dans chaque ligne, et rien n'y signale que la plupart de ces valeurs ne viennent
pas de la commune qu'elles décrivent.

**La colonne qui décide est `TYPPRED`, pas `loypredm2`.** Sur les appartements,
elle vaut `"maille"` pour 30 029 communes sur 34 900 — 86 % —, `"commune"` pour
4 871 seulement ; le fichier maisons ajoute une modalité `"EPCI"`. Une valeur
`"maille"` est la prédiction d'une zone voisine recopiée à l'identique : 34 900
communes ne portent que 7 244 loyers distincts, tirés de 3 079 zones. Charger le
fichier entier publierait trente mille loyers communaux qui n'en sont pas, sur
une carte où rien ne les distinguerait des vrais.

**Ce connecteur ne publie donc que les communes mesurées chez elles** :
`TYPPRED = "commune"`, au moins 30 annonces observées, et un modèle qui explique
au moins la moitié de la variance (`R2_adj >= 0,5`). Il en reste 4 869 sur
34 900 pour les appartements (14,0 %) et 3 618 pour les maisons (10,4 %). Les
trois critères ne pèsent pas pareil : `TYPPRED` fait tout le travail — aucune
commune prédite chez elle ne descend sous 100 annonces — et le R² n'écarte que
deux communes de plus (Les Deux Alpes, Cazaubon). Ils sont gardés tous les trois
parce qu'ils coûtent une ligne et qu'ils tiendront si la source relâche
`TYPPRED` : 4 172 communes en `"maille"` dépassent déjà les 30 annonces, un
filtre sur le seul nombre d'annonces en laisserait passer autant.

**Paris, Lyon et Marseille n'existent ici que par arrondissement.** Les codes
75056, 69123 et 13055 sont absents du fichier, leurs 45 arrondissements y sont.
Ils sont publiés tels quels, au niveau `arrondissement_municipal` du référentiel.
Les agréger en une valeur communale demanderait une pondération — parc de
logements, surfaces — que la source ne publie pas ; la moyenne des vingt
arrondissements de Paris ne serait le loyer de personne. C'est le choix inverse
de celui du répertoire des logements sociaux, où l'on somme des logements : un
loyer au m² ne s'additionne pas.

**L'intervalle est large et il fait partie de la mesure.** La fourchette de
prédiction s'étend en médiane sur 46 % de la valeur — environ ±23 % autour du
loyer affiché, 55 % au neuvième décile. Les bornes ne sont pas publiées comme
des séries (une observation ne porte qu'une valeur) : la fiche technique dit
leur ampleur, faute de quoi le chiffre se lirait comme un relevé.

Usage : python -m plateforme.normalize.loyers [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
from collections import Counter, defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "anil-carte-des-loyers"
SOURCE = "data-gouv"
BASE = (
    "https://static.data.gouv.fr/resources"
    "/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025"
)

# Millésime de la carte : biens mis en location au 3e trimestre 2025.
PERIODE = "2025"

# Le fichier couvre les 34 952 communes du Code officiel géographique, moins
# Mayotte et les collectivités d'outre-mer, moins les trois communes à
# arrondissements, plus leurs 45 arrondissements. Le compte se refait :
# 34 952 − 90 (codes 98x) − 4 (COM) − 3 (Paris, Lyon, Marseille) + 45 = 34 900.
LIGNES_ATTENDUES = 34_900

# Les trois critères de fiabilité, dans l'ordre de leur poids réel.
PREDICTION_COMMUNALE = "commune"
ANNONCES_MINIMUM = 30
R2_MINIMUM = 0.5

# Part de communes mesurées attendue. Elle vaut 14,0 % pour les appartements et
# 10,4 % pour les maisons : si elle s'effondrait, la source aurait cessé de
# mesurer ; si elle passait à 100 %, `TYPPRED` aurait changé de sens et le
# connecteur publierait des prédictions de zone comme des loyers communaux.
PART_MESUREE = (0.05, 0.30)

THEME = "logement"

# Ni un montant sommable ni un taux : un prix unitaire. `site/src/echelle.ts`
# affiche une unité qu'il ne connaît pas telle quelle, à côté du nombre — d'où
# une unité déjà lisible pour un humain. `additive false` interdit en outre le
# rapport à l'habitant, qui n'aurait aucun sens sur un loyer au m².
UNITE = "€/m²/mois"

INDICATEURS = {
    "anil_loyer_appartement": (
        "Loyer d'annonce des appartements, au m²",
        "Ce qu'un appartement vide se loue au mètre carré chaque mois, charges"
        " comprises, d'après les annonces. Bien de référence : 52 m². Publié"
        " pour les seules communes où la source mesure un loyer sur place"
        " (14 % d'entre elles) ; ailleurs, elle recopie la zone voisine.",
        "20251211-145010/pred-app-mef-dhup.csv",
    ),
    "anil_loyer_maison": (
        "Loyer d'annonce des maisons, au m²",
        "Ce qu'une maison vide se loue au mètre carré chaque mois, charges"
        " comprises, d'après les annonces. Bien de référence : 92 m². Une"
        " commune sur dix seulement a un loyer mesuré chez elle ; pour les"
        " autres, la source recopie la prédiction d'une zone voisine.",
        "20251211-145039/pred-mai-mef-dhup.csv",
    ),
}

TECHNIQUE = (
    "Loyer d'**annonce** au mètre carré et par mois, **charges comprises**,"
    " pour un logement **vide** (non meublé) mis en location au 3e trimestre"
    " 2025 : appartement de référence de 52 m², maison de référence de 92 m². Ce"
    " n'est pas un loyer pratiqué (le parc en place se reloue moins souvent et"
    " moins cher que le parc annoncé), et le dédoublonnage des annonces est"
    " imparfait, l'ANIL le reconnaît. La valeur est **prédite par un modèle**,"
    " pas relevée : la source l'accompagne d'un intervalle de prédiction large"
    " de 46 % de la valeur en médiane, soit environ ±23 %, et de 55 % au"
    " neuvième décile. **Seules les communes dont la prédiction est estimée sur"
    " leurs propres annonces sont publiées (14 % des 34 900 communes du fichier"
    " pour les appartements, 10 % pour les maisons).** Pour les autres, la source"
    " recopie la prédiction de la zone voisine ou de l'EPCI, sans que la valeur"
    " affichée le signale. Paris, Lyon et Marseille ne figurent que par"
    " arrondissement et ne sont pas agrégées, faute de pondération publiée."
    " Mayotte est absente de la source. La comparaison d'un millésime à l'autre"
    " n'est valide que pour les communes mesurées chez elles sur toute la"
    " période, ce que la source rappelle."
)


class SourceInattendue(RuntimeError):
    """Le fichier n'a plus la forme sur laquelle ce connecteur a été écrit."""


def url(chemin: str) -> str:
    return f"{BASE}/{chemin}"


def nombre(brut: str | None) -> float | None:
    """Décimale à la virgule ; une cellule vide n'est pas un zéro."""
    texte = (brut or "").strip()
    if not texte:
        return None
    return float(texte.replace(",", "."))


def lire(contenu: bytes) -> list[dict]:
    """CSV de la carte des loyers -> une entrée par commune.

    Latin-1, séparateur point-virgule, décimale à la virgule. Lu en UTF-8, le
    fichier ne se décode même pas : « La Bâtie-des-Fonds » y casse le flux.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("latin-1")), delimiter=";")
    lignes = []
    for rang in lecteur:
        code = (rang.get("INSEE_C") or "").strip()
        loyer = nombre(rang.get("loypredm2"))
        if len(code) != 5 or loyer is None:
            continue
        lignes.append({
            "code": code,
            "nom": (rang.get("LIBGEO") or "").strip(),
            "loyer": loyer,
            "basse": nombre(rang.get("lwr.IPm2")),
            "haute": nombre(rang.get("upr.IPm2")),
            "typpred": (rang.get("TYPPRED") or "").strip(),
            "annonces": int((rang.get("nbobs_com") or "0").strip() or 0),
            "r2": nombre(rang.get("R2_adj")),
        })
    return lignes


def mesuree(ligne: dict) -> bool:
    """La commune a-t-elle un loyer estimé sur ses propres annonces ?

    `TYPPRED` tranche : une valeur `"maille"` ou `"EPCI"` est la prédiction
    d'une zone voisine, recopiée telle quelle. Les deux autres critères ne
    retirent presque rien — aucune prédiction communale ne repose sur moins de
    100 annonces — mais ils tiennent si la source relâche `TYPPRED`.
    """
    return (
        ligne["typpred"] == PREDICTION_COMMUNALE
        and ligne["annonces"] >= ANNONCES_MINIMUM
        and (ligne["r2"] or 0.0) >= R2_MINIMUM
    )


def controler(lignes: list[dict], indicateur: str) -> dict:
    """Contrôle bloquant : le fichier entier, et la part qu'on en publie.

    Deux choses peuvent tourner sans prévenir. Le périmètre : 34 900 communes,
    autant de codes distincts — un doublon ou une commune perdue et l'exhaustivité
    n'est plus vraie. Et le sens de `TYPPRED` : c'est lui qui décide de ce qui est
    publié, et une part mesurée qui s'effondre ou qui saute à 100 % dit qu'il ne
    veut plus dire la même chose.
    """
    if len(lignes) != LIGNES_ATTENDUES:
        raise SourceInattendue(
            f"{indicateur} : {len(lignes)} communes lues au lieu de"
            f" {LIGNES_ATTENDUES}. Le périmètre du fichier a bougé — le contrôle"
            " ne peut plus affirmer qu'il couvre toutes les communes."
        )
    codes = {ligne["code"] for ligne in lignes}
    if len(codes) != LIGNES_ATTENDUES:
        raise SourceInattendue(
            f"{indicateur} : {len(codes)} codes communes distincts pour"
            f" {len(lignes)} lignes — une commune est décrite deux fois."
        )
    fiables = [ligne for ligne in lignes if mesuree(ligne)]
    part = len(fiables) / len(lignes)
    bas, haut = PART_MESUREE
    if not bas <= part <= haut:
        raise SourceInattendue(
            f"{indicateur} : {len(fiables)} communes mesurées chez elles sur"
            f" {len(lignes)} ({100 * part:.1f} %), hors de la plage attendue"
            f" {100 * bas:.0f}–{100 * haut:.0f} %. TYPPRED a changé de sens :"
            " publier sur cette base recopierait des prédictions de zone."
        )
    largeurs = sorted(
        (ligne["haute"] - ligne["basse"]) / ligne["loyer"]
        for ligne in lignes
        if ligne["basse"] is not None and ligne["haute"] is not None and ligne["loyer"]
    )
    return {
        "communes_lues": len(lignes),
        "communes_mesurees": len(fiables),
        "part_mesuree": round(part, 4),
        "typpred": dict(sorted(Counter(ligne["typpred"] for ligne in lignes).items())),
        "loyers_distincts": len({ligne["loyer"] for ligne in lignes}),
        "sans_aucune_annonce": sum(1 for ligne in lignes if ligne["annonces"] == 0),
        "largeur_relative_mediane": round(largeurs[len(largeurs) // 2], 3),
    }


def niveau(code: str) -> str:
    """Un arrondissement municipal est publié à son niveau, pas à celui de sa
    commune : le référentiel l'y connaît, et un loyer au m² ne s'agrège pas."""
    return "arrondissement_municipal" if commune_mere(code) else "commune"


def observations(lignes: list[dict], indicateur: str) -> list[tuple]:
    """-> les observations des seules communes mesurées chez elles."""
    return [
        (indicateur, niveau(ligne["code"]), ligne["code"], PERIODE, round(ligne["loyer"], 2))
        for ligne in sorted(lignes, key=lambda ligne: ligne["code"])
        if mesuree(ligne)
    ]


def compter_par_maille(candidates: list[tuple]) -> dict[str, int]:
    """La couverture se mesure sur ce qui est publié, pas sur les 34 900 lues :
    les 30 000 communes écartées ne sont pas une couverture manquante, c'est une
    décision. Ce qui doit se retrouver au référentiel, ce sont les 8 487 lignes
    des deux indicateurs — dont les 57 arrondissements, que le référentiel ne
    connaît qu'à leur propre niveau."""
    comptes: dict[str, int] = defaultdict(int)
    for _, maille, _, _, _ in candidates:
        comptes[maille] += 1
    return dict(comptes)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique, _) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Loyer d''annonce prédit au m² (modèle ANIL/DGALN)',
                        'euros par m² et par mois, charges comprises', 'estimated',
                        array['Officiel','Estimation'])
                returning definition_id
                """,
                (publique, TECHNIQUE),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, false, 'current',
                        array['commune','arrondissement_municipal'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, libelle, UNITE),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


COLONNES = ("value",)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        lus, verifies, candidates = 0, {}, []
        for identifiant, (_, _, chemin) in sorted(INDICATEURS.items()):
            adresse = url(chemin)
            contenu = telecharger(adresse, timeout=600)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, chemin.rsplit("/", 1)[-1],
                contenu, adresse, "text/csv",
            )
            lignes = lire(contenu)
            verifies[identifiant] = controler(lignes, identifiant)
            lus += len(lignes)
            candidates.extend(observations(lignes, identifiant))
            entrepot.etape(
                f"{identifiant} : {verifies[identifiant]['communes_mesurees']} communes"
                f" mesurées sur {len(lignes)}"
            )
        gardees, hors_referentiel = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES,
            [
                (identifiant, maille, code, MILLESIME, periode, valeur)
                for identifiant, maille, code, periode, valeur in gardees
            ],
        )
        parts = couverture.controler(
            compter_par_maille(candidates), compter_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'fichier_complet_et_part_mesuree_par_commune',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "hors_referentiel": sorted(hors_referentiel),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=lus, rows_written=ecrites)
        print(
            f"loyers d'annonce {PERIODE} : {ecrites} observations écrites, soit"
            f" {verifies['anil_loyer_appartement']['communes_mesurees']} communes"
            f" mesurées pour les appartements et"
            f" {verifies['anil_loyer_maison']['communes_mesurees']} pour les maisons"
            f" sur {LIGNES_ATTENDUES} — le reste du fichier recopie la prédiction"
            f" d'une zone voisine et n'est pas publié. {revisees} révisées."
        )
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
