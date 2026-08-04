"""L'entrepôt : un fichier DuckDB versionné sur R2.

**Pourquoi pas une base managée.** Le site ne lit jamais l'entrepôt — il lit des
fichiers JSON servis par le CDN (docs/03 §3). Rien n'interroge donc la base en
dehors du pipeline, une fois par jour, pour écrire en masse puis publier des
fichiers plats. C'est une charge d'entrepôt, pas de service : ni authentification,
ni temps réel, ni requête concurrente, ni latence à tenir. Faire porter cette
charge par un serveur Postgres managé revenait à payer un moteur transactionnel
pour exécuter un traitement par lots — et à en accepter le mode de panne, dont
l'incident D6quater est la démonstration : le site a servi des données figées
pendant trente-six heures parce qu'une base que personne ne lit s'était endormie,
et que seul le propriétaire du projet pouvait la réveiller depuis un tableau de
bord.

**Ce qui remplace.** Un fichier DuckDB unique, stocké sur le R2 qui sert déjà les
données publiées. Le job le télécharge, écrit dedans, le renvoie. Il n'y a plus
de serveur à réveiller, plus de plafond à arbitrer — quatorze millions de lignes
tiennent dans quelques centaines de mégaoctets de stockage objet — et la
sauvegarde est le fichier lui-même, versionné par le bucket.

**Ce qu'on perd, et comment on le compense.** DuckDB ne crée pas de clé étrangère
entre schémas : celles qui rattachaient une observation à son run d'ingestion
deviennent des colonnes simples, et `verifier_integrite()` recense les orphelins
après chaque chargement. Une contrainte devient une vérification ; elle n'est pas
abandonnée en silence.
"""

import datetime as _datetime
import hashlib
import json
import os
import tempfile
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb

SCHEMA = Path(__file__).resolve().parents[2] / "infra/entrepot/schema.sql"

# Clé du fichier d'entrepôt dans le bucket. Le nom porte la version du schéma :
# un changement de structure produit un nouveau fichier plutôt que d'écraser
# celui que l'ancien code sait encore lire.
CLE = "entrepot/plateforme-v2.duckdb"

# Emplacement local du fichier pendant un run. Le runner GitHub est éphémère :
# ce chemin ne survit pas au job, et c'est voulu — la seule copie qui fait foi
# est celle du bucket.
LOCAL = Path(os.environ.get("PLATEFORME_ENTREPOT", "/tmp/plateforme.duckdb"))


class SchemaDivergent(RuntimeError):
    """Le fichier ouvert n'a pas été créé par ce schéma-ci."""


def connect(chemin: Path | str | None = None) -> duckdb.DuckDBPyConnection:
    """Ouvre l'entrepôt, applique le schéma s'il manque, refuse s'il a changé.

    Le schéma est idempotent (`create ... if not exists`) : l'appliquer à chaque
    ouverture évite d'avoir à savoir si le fichier est neuf, et fait de
    `schema.sql` la seule description de la structure.

    Mais `if not exists` ne touche pas une table déjà là. Une contrainte retirée
    du fichier reste donc en place dans un entrepôt existant, et le code tourne
    contre une structure qui n'est plus celle qu'il décrit — c'est arrivé, et
    l'échec se lisait comme un bug du code alors que le schéma était bon.
    L'empreinte du fichier de schéma est donc enregistrée à la création et
    vérifiée à chaque ouverture. Un écart arrête net et dit quoi faire : DuckDB
    n'ayant pas de mécanisme de migration ici, un changement de structure demande
    un nouvel entrepôt — d'où la version dans le nom du fichier.
    """
    texte = SCHEMA.read_text(encoding="utf-8")
    connexion = duckdb.connect(str(chemin or LOCAL))
    connexion.execute(texte)
    connexion.execute(
        "create table if not exists meta.schema_version (empreinte text primary key)"
    )
    empreinte = hashlib.sha256(texte.encode("utf-8")).hexdigest()
    connues = [e for (e,) in connexion.execute("select empreinte from meta.schema_version").fetchall()]
    if not connues:
        connexion.execute("insert into meta.schema_version values (?)", [empreinte])
    elif empreinte not in connues:
        connexion.close()
        raise SchemaDivergent(
            f"l'entrepôt {chemin or LOCAL} a été créé par un autre schéma"
            f" (empreinte {connues[0][:12]}, attendue {empreinte[:12]}). DuckDB"
            " n'applique pas les changements de structure à une table existante :"
            " incrémenter `entrepot.CLE` pour repartir d'un entrepôt neuf, puis"
            " relancer le job « rechargement »."
        )
    return connexion


def telecharger(store, chemin: Path | str | None = None) -> bool:
    """Rapatrie l'entrepôt depuis le bucket. Faux s'il n'existe pas encore."""
    cible = Path(chemin or LOCAL)
    try:
        contenu = store.get(CLE)
    except Exception:  # noqa: BLE001
        # Les deux implémentations de magasin signalent l'absence par une
        # exception, chacune la sienne — FileNotFoundError en local, une erreur
        # boto3 sur R2. Le premier chargement d'un bucket neuf n'a pas d'entrepôt
        # à rapatrier : c'est un cas normal, pas une panne.
        return False
    if contenu is None:
        return False
    cible.parent.mkdir(parents=True, exist_ok=True)
    cible.write_bytes(contenu)
    return True


def televerser(store, chemin: Path | str | None = None) -> int:
    """Renvoie l'entrepôt au bucket. Retourne sa taille en octets.

    À n'appeler qu'après avoir fermé la connexion : DuckDB écrit son fichier à la
    fermeture, et téléverser avant reviendrait à publier un entrepôt tronqué.
    """
    source = Path(chemin or LOCAL)
    contenu = source.read_bytes()
    # `overwrite` : l'immutabilité protège les snapshots bruts, qui sont la
    # matière première de la reproductibilité. L'entrepôt, lui, est l'état
    # courant — il se réécrit à chaque run, et c'est le versionnement du bucket
    # qui en garde les états antérieurs.
    store.put(CLE, contenu, overwrite=True)
    return len(contenu)


def taille(conn: duckdb.DuckDBPyConnection) -> int:
    """Taille de l'entrepôt en octets, telle que DuckDB la connaît.

    Remplace `pg_database_size`. Elle ne sert plus de garde-fou d'arrêt — le
    stockage objet n'a pas de plafond à quelques centaines de mégaoctets — mais
    de mesure : le journal doit pouvoir dire de combien un chargement a fait
    grossir l'entrepôt.
    """
    lignes = conn.execute("pragma database_size").fetchall()
    if not lignes:
        return 0
    colonnes = [description[0] for description in conn.description]
    return _octets(dict(zip(colonnes, lignes[0], strict=False)).get("database_size"))


UNITES = {"bytes": 1, "kib": 1024, "mib": 1024**2, "gib": 1024**3, "tib": 1024**4}


def _octets(taille_lisible) -> int:
    """« 12.3 MiB » -> 12 897 484. DuckDB rend une taille lisible, pas un nombre."""
    if isinstance(taille_lisible, int):
        return taille_lisible
    morceaux = str(taille_lisible or "").split()
    if len(morceaux) != 2 or morceaux[1].lower() not in UNITES:
        return 0
    return int(float(morceaux[0]) * UNITES[morceaux[1].lower()])


def parametres_utiles(sql: str, parametres: dict) -> dict:
    """Ne garde que les paramètres nommés que cette requête cite vraiment.

    psycopg acceptait qu'on lui passe un dictionnaire plus large que la requête ;
    DuckDB refuse tout nom en trop. Or plusieurs requêtes du pipeline partagent un
    même dictionnaire et n'en utilisent chacune qu'une partie — c'est plus lisible
    que de le recomposer à chaque instruction, et ça reste vrai à condition de
    filtrer ici.
    """
    return {nom: valeur for nom, valeur in parametres.items() if f"${nom}" in sql}


def annuler(conn: duckdb.DuckDBPyConnection) -> None:
    """Annule ce qui est en cours, sans exiger qu'il y ait quelque chose.

    psycopg acceptait un `rollback()` hors transaction ; DuckDB lève. Or ces
    appels disent tous « repars propre », jamais « il y avait forcément une
    transaction ouverte » — n'en avoir aucune est le cas normal.
    """
    try:
        conn.rollback()
    except Exception:  # noqa: BLE001 — voir la docstring
        pass


def get_dataset(conn: duckdb.DuckDBPyConnection, dataset_id: str) -> dict:
    ligne = conn.execute(
        """
        select d.dataset_id, d.source_id, d.external_id, d.endpoint_url,
               d.ingestion_mode, s.base_url
        from meta.dataset_registry d
        join meta.source_registry s using (source_id)
        where d.dataset_id = ?
        """,
        [dataset_id],
    ).fetchone()
    if ligne is None:
        raise KeyError(f"dataset inconnu du registre : {dataset_id}")
    cles = ["dataset_id", "source_id", "external_id", "endpoint_url", "ingestion_mode", "base_url"]
    return dict(zip(cles, ligne, strict=True))


def start_run(conn: duckdb.DuckDBPyConnection, dataset_id: str, trigger: str = "manual") -> str:
    """L'identifiant est tiré côté Python : le reste du pipeline le cite avant
    même que la ligne soit écrite, et un `returning` ne le rendrait qu'après."""
    run_id = str(uuid.uuid4())
    conn.execute(
        """
        insert into meta.ingestion_runs (run_id, dataset_id, status, trigger, connector_version)
        values (?, ?, 'running', ?, ?)
        """,
        [run_id, dataset_id, trigger, os.environ.get("GITHUB_SHA", "dev")],
    )
    return run_id


def finish_run(
    conn: duckdb.DuckDBPyConnection,
    run_id: str,
    status: str,
    rows_read: int = 0,
    rows_written: int = 0,
    error: str | None = None,
) -> None:
    # Une écriture ratée laisse la transaction avortée : sans ce rollback, tracer
    # l'échec échouerait à son tour et masquerait l'erreur d'origine.
    try:
        conn.rollback()
    except Exception:  # noqa: BLE001
        # DuckDB refuse un rollback hors transaction là où psycopg l'acceptait.
        # Ce rollback ne sert qu'à sortir d'une transaction avortée : n'en avoir
        # aucune est le cas normal, pas une erreur à propager.
        pass
    details = json.dumps({"message": error}) if error is not None else None
    conn.execute(
        """
        update meta.ingestion_runs
        set finished_at = now(), status = ?, rows_read = ?, rows_written = ?,
            error_details = ?
        where run_id = ?
        """,
        [status, rows_read, rows_written, details, run_id],
    )


@dataclass
class AssetResult:
    unchanged: bool
    asset_id: str | None
    key: str | None


def record_asset(
    conn: duckdb.DuckDBPyConnection,
    store,
    run_id: str,
    dataset_id: str,
    source_id: str,
    filename: str,
    content: bytes,
    source_url: str,
    content_type: str | None = None,
) -> AssetResult:
    """Enregistre un snapshot : d'abord le lineage, puis le fichier.

    L'ordre compte. Le conflit d'unicité sur (dataset_id, content_sha256) est la
    détection de changement du projet : si le contenu est déjà archivé, on ne
    réécrit ni le fichier ni la suite du traitement.
    """
    sha = hashlib.sha256(content).hexdigest()
    horodatage = datetime.now(UTC).strftime("%Y-%m-%dT%H%M%SZ")
    # L'empreinte entre dans la clé. Sans elle, deux snapshots différents du même
    # jeu pris dans la même seconde — ce qui arrive quand un connecteur enchaîne
    # quatre mailles — s'écrivaient sous la même clé, et le second écrasait le
    # premier dans le bucket. Le lineage, lui, portait bien deux lignes : on
    # aurait donc cru archiver deux fichiers et n'en garder qu'un, sans qu'aucune
    # erreur ne le dise. Défaut hérité de l'ancien `db.py`, trouvé en écrivant le
    # test qui vérifie que deux contenus distincts font deux objets.
    cle = f"raw/{source_id}/{dataset_id}/{horodatage}-{sha[:12]}/{filename}"
    asset_id = f"{dataset_id}:{sha}"
    ligne = conn.execute(
        """
        insert into meta.raw_assets
            (asset_id, run_id, dataset_id, r2_key, source_url, content_sha256,
             size_bytes, content_type)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict do nothing
        returning asset_id
        """,
        [asset_id, run_id, dataset_id, cle, source_url, sha, len(content), content_type],
    ).fetchone()
    if ligne is None:  # contenu identique déjà archivé : rien à retraiter
        return AssetResult(unchanged=True, asset_id=None, key=None)
    store.put(cle, content)
    return AssetResult(unchanged=False, asset_id=ligne[0], key=cle)


def _champ(valeur) -> str:
    """Une valeur Python en un champ CSV que DuckDB relit à l'identique.

    Deux conventions, et elles se tiennent l'une l'autre : `None` s'écrit champ
    vide **non quoté**, tout le reste s'écrit **quoté**. C'est ce qui permet de
    distinguer le nul de la chaîne vide — sans quoi `entity_siren`, dont la
    valeur par défaut est la chaîne vide, reviendrait nul et violerait sa propre
    contrainte. Côté lecture, `allow_quoted_nulls false` interdit à DuckDB de
    reprendre un champ quoté vide pour un nul.

    (`csv.QUOTE_NOTNULL` fait exactement cela, mais n'existe qu'à partir de
    Python 3.12, et le paquet se veut compatible 3.11.)
    """
    if valeur is None:
        return ""
    if isinstance(valeur, (list, tuple)):
        # Littéral de liste DuckDB, quoté élément par élément. Deux niveaux de
        # quotage se superposent ici — celui de la liste et celui du CSV — et un
        # guillemet à l'intérieur d'un élément ne survit pas au retour : il
        # ressort effacé. Plutôt que d'altérer une valeur en silence, on
        # s'arrête. Les seules listes qui passent par là sont des drapeaux de
        # qualité, un vocabulaire fermé de jetons sans ponctuation ; qu'il en
        # arrive un avec un guillemet signalerait un défaut en amont, pas un cas
        # à absorber.
        elements = [str(e) for e in valeur]
        fautifs = [e for e in elements if '"' in e]
        if fautifs:
            raise ValueError(
                f"guillemet dans un élément de liste : {fautifs[0]!r}. Le double"
                " quotage du CSV et du littéral DuckDB ne le rend pas à"
                " l'identique — corriger la valeur en amont plutôt que la perdre."
            )
        texte = "[" + ",".join(f'"{e}"' for e in elements) + "]"
    elif isinstance(valeur, (_datetime.date, _datetime.datetime)):
        texte = valeur.isoformat()
    else:
        texte = str(valeur)
    return '"' + texte.replace('"', '""') + '"'


def copier(
    conn: duckdb.DuckDBPyConnection,
    table: str,
    colonnes: list[str],
    lignes,
    lot: int = 200_000,
) -> int:
    """Charge en masse, par un fichier CSV temporaire et un `COPY`.

    L'implémentation précédente enchaînait des `executemany`. Mesuré le 4 août
    sur un lot réel de 2 240 000 lignes : **381 lignes par seconde**, soit
    98 minutes — DuckDB lie et exécute la requête préparée ligne à ligne, sans
    rien vectoriser. Écrire le même lot en CSV puis le charger par `COPY` :
    **289 688 lignes par seconde**, soit huit secondes. Le même travail, sept
    cent soixante fois plus vite, à l'octet près (mêmes comptes, mêmes sommes).

    C'est ce qui faisait qu'un lot d'agrégats OFGL communaux coûtait plus d'une
    heure quand son téléchargement en coûtait trois minutes.

    Le découpage en lots borne ce qui est matérialisé à la fois : le fichier
    temporaire d'un lot de 200 000 lignes pèse une dizaine de mégaoctets, et il
    est effacé dès qu'il est lu.
    """
    entete = f"copy {table} ({', '.join(colonnes)}) from '%s'"
    options = " (format csv, header false, allow_quoted_nulls false)"

    def vider(tampon: list[str]) -> None:
        with tempfile.NamedTemporaryFile(
            "w", suffix=".csv", encoding="utf-8", delete=False
        ) as fichier:
            fichier.writelines(tampon)
            chemin = fichier.name
        try:
            conn.execute((entete % chemin.replace("'", "''")) + options)
        finally:
            Path(chemin).unlink(missing_ok=True)

    total, tampon = 0, []
    for ligne in lignes:
        tampon.append(",".join(map(_champ, ligne)) + "\n")
        if len(tampon) >= lot:
            vider(tampon)
            total += len(tampon)
            tampon = []
    if tampon:
        vider(tampon)
        total += len(tampon)
    return total


# Les rattachements que DuckDB ne sait pas contraindre, et qu'on vérifie donc
# après coup. Chaque entrée : (table, colonne, table référencée, colonne).
RATTACHEMENTS = [
    ("meta.dataset_registry", "source_id", "meta.source_registry", "source_id"),
    ("meta.ingestion_runs", "dataset_id", "meta.dataset_registry", "dataset_id"),
    ("meta.raw_assets", "dataset_id", "meta.dataset_registry", "dataset_id"),
    ("meta.data_quality_checks", "dataset_id", "meta.dataset_registry", "dataset_id"),
    ("meta.change_log", "dataset_id", "meta.dataset_registry", "dataset_id"),
    ("core.indicators", "definition_id", "core.indicator_definitions", "definition_id"),
    ("core.observations", "indicator_id", "core.indicators", "indicator_id"),
    ("core.observations", "run_id", "meta.ingestion_runs", "run_id"),
    ("core.observations_revisions", "run_id", "meta.ingestion_runs", "run_id"),
    ("core.indicators", "dataset_id", "meta.dataset_registry", "dataset_id"),
    ("geo.commune_officials", "run_id", "meta.ingestion_runs", "run_id"),
    ("fin.public_budgets", "run_id", "meta.ingestion_runs", "run_id"),
    ("fin.public_budgets", "dataset_id", "meta.dataset_registry", "dataset_id"),
    ("fin.public_employment", "run_id", "meta.ingestion_runs", "run_id"),
]


def verifier_integrite(conn: duckdb.DuckDBPyConnection) -> list[tuple[str, str, int]]:
    """Les orphelins : ce que la clé étrangère garantissait sous Postgres.

    Retourne (table, colonne, nombre d'orphelins) pour tout rattachement rompu.
    Une liste vide vaut la contrainte. Un run qui en produit doit échouer plutôt
    que publier : une observation sans run d'ingestion est un chiffre dont on ne
    sait plus d'où il vient, ce qui est exactement ce que ce projet refuse.
    """
    manquants = []
    for table, colonne, cible, cle in RATTACHEMENTS:
        (n,) = conn.execute(
            f"""
            select count(*) from {table} t
            where t.{colonne} is not null
              and not exists (select 1 from {cible} c where c.{cle} = t.{colonne})
            """
        ).fetchone()
        if n:
            manquants.append((table, colonne, n))
    return manquants


def _store(spec: str):
    """Le magasin d'objets, résolu tard pour ne pas créer de cycle d'import."""
    from plateforme.normalize.geo import make_store

    return make_store(spec)


def main() -> int:
    """Aller-retour de l'entrepôt, appelé au début et à la fin de chaque job.

    Le runner GitHub est éphémère : sans ces deux appels, chaque exécution
    repartirait d'un entrepôt vide et republierait un catalogue amputé.
    """
    import argparse

    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("action", choices=["telecharger", "televerser"])
    analyseur.add_argument("--store", default="r2:plateforme-raw")
    arguments = analyseur.parse_args()
    magasin = _store(arguments.store)
    if arguments.action == "telecharger":
        present = telecharger(magasin)
        print(
            f"entrepôt rapatrié ({LOCAL.stat().st_size // 1024 // 1024} Mo)"
            if present
            else "aucun entrepôt dans le bucket : le premier chargement le créera"
        )
        return 0
    octets = televerser(magasin)
    print(f"entrepôt renvoyé au bucket ({octets // 1024 // 1024} Mo)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
