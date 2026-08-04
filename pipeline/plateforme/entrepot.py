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

import hashlib
import json
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import duckdb

SCHEMA = Path(__file__).resolve().parents[2] / "infra/entrepot/schema.sql"

# Clé du fichier d'entrepôt dans le bucket. Le nom porte la version du schéma :
# un changement de structure produit un nouveau fichier plutôt que d'écraser
# celui que l'ancien code sait encore lire.
CLE = "entrepot/plateforme-v1.duckdb"

# Emplacement local du fichier pendant un run. Le runner GitHub est éphémère :
# ce chemin ne survit pas au job, et c'est voulu — la seule copie qui fait foi
# est celle du bucket.
LOCAL = Path(os.environ.get("PLATEFORME_ENTREPOT", "/tmp/plateforme.duckdb"))


def connect(chemin: Path | str | None = None) -> duckdb.DuckDBPyConnection:
    """Ouvre l'entrepôt et applique le schéma s'il manque.

    Le schéma est idempotent (`create ... if not exists`) : l'appliquer à chaque
    ouverture évite d'avoir à savoir si le fichier est neuf, et fait de
    `schema.sql` la seule description de la structure.
    """
    connexion = duckdb.connect(str(chemin or LOCAL))
    connexion.execute(SCHEMA.read_text(encoding="utf-8"))
    return connexion


def telecharger(store, chemin: Path | str | None = None) -> bool:
    """Rapatrie l'entrepôt depuis le bucket. Faux s'il n'existe pas encore."""
    cible = Path(chemin or LOCAL)
    contenu = store.get(CLE)
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
    store.put(CLE, contenu)
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
    except duckdb.Error:
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


def copier(
    conn: duckdb.DuckDBPyConnection,
    table: str,
    colonnes: list[str],
    lignes,
    lot: int = 50_000,
) -> int:
    """Charge en masse. Remplace `curseur.copy()` de psycopg.

    DuckDB n'a pas de protocole de copie en flux : `executemany` sur des lots
    fait le même travail, et sur un moteur en mémoire partagée il n'y a pas de
    réseau à amortir. Le découpage en lots évite de matérialiser plusieurs
    millions de tuples d'un coup dans le processus Python.
    """
    marques = ", ".join("?" for _ in colonnes)
    sql = f"insert into {table} ({', '.join(colonnes)}) values ({marques})"
    total, tampon = 0, []
    for ligne in lignes:
        tampon.append(list(ligne))
        if len(tampon) >= lot:
            conn.executemany(sql, tampon)
            total += len(tampon)
            tampon = []
    if tampon:
        conn.executemany(sql, tampon)
        total += len(tampon)
    return total


# Les rattachements que DuckDB ne sait pas contraindre, et qu'on vérifie donc
# après coup. Chaque entrée : (table, colonne, table référencée, colonne).
RATTACHEMENTS = [
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
