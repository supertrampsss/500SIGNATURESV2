"""Ce qui mérite qu'on soit prévenu.

Le tableau de fraîcheur montre l'état des sources à qui vient le regarder.
Personne ne vient le regarder. T-23 demande qu'une source coupée se signale en
moins de 24 h : ce module produit ce signalement, et le workflow le porte dans
une issue GitHub.

**Une alerte qui se répète cesse d'être une alerte.** Le module n'écrit donc
rien lui-même : il rend l'état courant, et le workflow tient *une* issue à jour
— ouverte quand il y a quelque chose, fermée quand il n'y a plus rien. Un
message par run produirait un fil que personne ne lirait, ce qui revient au même
que pas d'alerte du tout.

Trois motifs, et seulement ceux-là :

- **retard** : le producteur n'a rien publié depuis plus longtemps que la
  fréquence déclarée dans le registre. C'est le seul motif qui vienne du monde
  extérieur.
- **échec** : le dernier chargement a échoué. Les données affichées sont celles
  d'avant, ce qui ne se voit pas sans venir ici.
- **contrôle bloquant** : quelque chose n'a pas été publié faute d'avoir passé
  un contrôle. Le site le dit déjà au lecteur ; l'exploitant doit le savoir
  aussi.

Un retard n'est pas une panne : une source annuelle publie une fois l'an, et
le registre porte la tolérance (`expected_freshness_days`). L'alerte ne se
déclenche qu'au-delà.

Usage : python -m plateforme.alertes [--format markdown|json]
"""

import argparse
import json

from plateforme import entrepot

REQUETE = """
select d.dataset_id, d.title, d.update_frequency,
       max(a.fetched_at) as extraction,
       case when d.expected_freshness_days is null then null
            else greatest(0, extract(day from now() - max(a.fetched_at))::int
                           - d.expected_freshness_days) end as retard,
       (select r.status from meta.ingestion_runs r
         where r.dataset_id = d.dataset_id order by r.started_at desc limit 1) as statut,
       (select count(*) from meta.data_quality_checks c
         where c.dataset_id = d.dataset_id and not c.passed and c.severity = 'blocker'
           and c.run_id = (select r.run_id from meta.ingestion_runs r
                             where r.dataset_id = d.dataset_id
                             order by r.started_at desc limit 1)) as bloquants
from meta.dataset_registry d
join meta.raw_assets a on a.dataset_id = d.dataset_id
group by d.dataset_id, d.title, d.update_frequency, d.expected_freshness_days
order by d.dataset_id
"""


def collecter(conn) -> list[dict]:
    """Ne remonte que ce qui appelle une action. Un jeu en ordre n'est pas listé :
    une alerte qui énumère tout ne dit plus rien."""
    alertes = []
    for jeu, titre, frequence, extraction, retard, statut, bloquants in conn.execute(REQUETE):
        motifs = []
        if retard:
            motifs.append(
                f"aucune publication depuis {retard} j de plus que la tolérance"
                f" (fréquence déclarée : {frequence or 'non déclarée'})"
            )
        if statut == "failed":
            motifs.append("le dernier chargement a échoué")
        if bloquants:
            motifs.append(
                f"{bloquants} contrôle{'s' if bloquants > 1 else ''} bloquant"
                f"{'s' if bloquants > 1 else ''} en échec au dernier chargement"
            )
        if motifs:
            alertes.append(
                {
                    "jeu": jeu,
                    "titre": titre,
                    "derniere_extraction": extraction.date().isoformat() if extraction else None,
                    "motifs": motifs,
                }
            )
    return alertes


def markdown(alertes: list[dict]) -> str:
    if not alertes:
        return "Toutes les sources sont dans leur fenêtre de fraîcheur déclarée."
    lignes = [
        "Les jeux ci-dessous demandent un regard. Un retard n'est pas forcément une",
        "panne : le producteur peut avoir décalé sa publication. Un échec de",
        "chargement, si.",
        "",
    ]
    for alerte in alertes:
        lignes.append(f"### {alerte['titre']} (`{alerte['jeu']}`)")
        lignes.append(f"Dernière lecture : {alerte['derniere_extraction'] or 'jamais'}")
        lignes.extend(f"- {motif}" for motif in alerte["motifs"])
        lignes.append("")
    lignes.append("_État publié dans `fraicheur.json` et sur la page « État des données »._")
    return "\n".join(lignes)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=["markdown", "json"], default="markdown")
    arguments = parser.parse_args()
    conn = entrepot.connect()
    try:
        alertes = collecter(conn)
    finally:
        conn.close()
    print(json.dumps(alertes, ensure_ascii=False) if arguments.format == "json" else markdown(alertes))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
