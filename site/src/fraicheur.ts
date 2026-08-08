/**
 * État des données : quand chaque jeu a été lu pour la dernière fois, s'il a
 * pris du retard sur sa fréquence annoncée, et ce que les contrôles ont relevé.
 *
 * La transparence opérationnelle fait partie du produit (docs/03 §6). Un
 * chiffre vieux de deux ans doit se voir plutôt que se deviner, et une anomalie
 * trouvée dans un fichier source doit être lisible par le public — c'est ce qui
 * distingue un site qui republie de la donnée d'un site qui la garantit.
 */

import type { Fraicheur } from "./donnees.ts";

const SEVERITES: Record<string, string> = {
  blocker: "bloquant",
  warning: "signalement",
  info: "information",
};

const CONTROLES: Record<string, string> = {
  identite_solde_budgetaire: "identité du solde budgétaire",
  decomposition_des_totaux: "décomposition des totaux",
  execution_recoupee_entre_fichiers: "recoupement de l'exécution entre fichiers",
  epargne_brute_egale_recettes_moins_depenses: "épargne brute = recettes − dépenses",
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";
}

function retard(jours: number | null, frequence: string | null): string {
  if (jours === null) return frequence ? echapper(frequence) : "—";
  if (jours === 0) return `à jour (${echapper(frequence ?? "")})`;
  return `${jours} j de retard sur une mise à jour ${echapper(frequence ?? "attendue")}`;
}

/** Ce que les contrôles ont relevé, en français et sans jargon d'identifiant.
 *  « Rien à signaler » et « on ne sait pas » sont deux réponses différentes :
 *  une publication antérieure à ce champ ne doit pas se lire comme un feu vert. */
function anomalies(jeu: Fraicheur): string {
  if (jeu.anomalies === undefined) return "non renseigné pour cette publication";
  if (!jeu.anomalies.length) return "aucune anomalie relevée";
  return jeu.anomalies
    .map((a) => {
      const cas = Object.keys(a.constat ?? {}).filter((c) => c.includes("/") || /^\d{4}$/.test(c));
      const portee = cas.length ? ` : ${cas.sort().join(", ")}` : "";
      return `<span class="anomalie anomalie--${echapper(a.severite)}">${echapper(
        SEVERITES[a.severite] ?? a.severite,
      )}</span> ${echapper(CONTROLES[a.nom] ?? a.nom)}${echapper(portee)}`;
    })
    .join("<br />");
}

/** Un chiffre déjà publié qui bouge au rechargement suivant est une révision :
 *  un fait normal de la statistique publique, à afficher plutôt qu'à taire.
 *  Trois réponses distinctes : non suivi (publication antérieure au champ),
 *  aucune, ou n valeurs révisées. */
function revisions(jeu: Fraicheur): string {
  if (jeu.valeurs_revisees_90j === undefined) return "non suivi pour cette publication";
  if (jeu.valeurs_revisees_90j === 0) return "aucune sur 90 jours";
  return `${jeu.valeurs_revisees_90j.toLocaleString("fr-FR")} valeur${
    jeu.valeurs_revisees_90j > 1 ? "s" : ""
  } révisée${jeu.valeurs_revisees_90j > 1 ? "s" : ""} sur 90 jours`;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(jeux: Fraicheur[]): string {
  const lignes = [...jeux]
    .sort((a, b) => (b.derniere_extraction ?? "").localeCompare(a.derniere_extraction ?? ""))
    .map(
      (jeu) => `<tr>
        <th scope="row">${echapper(jeu.titre)}</th>
        <td>${date(jeu.derniere_extraction)}</td>
        <td>${retard(jeu.retard_jours, jeu.frequence)}</td>
        <td>${
          jeu.dernier_run === "success"
            ? "réussi"
            : jeu.dernier_run === "failed"
              ? "<strong>en échec</strong>"
              : echapper(jeu.dernier_run ?? "—")
        }</td>
        <td>${anomalies(jeu)}</td>
        <td>${revisions(jeu)}</td>
      </tr>`,
    )
    .join("");
  return `
    <h2>État des données</h2>
    <p class="tableau__aide">
      Chaque jeu avec sa dernière lecture, son retard éventuel et ce que les contrôles
      ont relevé. Un signalement veut dire qu'une partie du fichier source n'a pas été
      publiée, pas que les chiffres affichés sont douteux : ce qui ne passe pas un
      contrôle bloquant n'est jamais publié. Une révision est un chiffre déjà publié
      que le producteur a réestimé depuis : c'est la vie normale de la statistique,
      et l'ancienne valeur reste archivée.
    </p>
    <div class="tableau__cadre">
      <table class="fraicheur">
        <thead><tr>
          <th scope="col">Jeu de données</th>
          <th scope="col">Dernière lecture</th>
          <th scope="col">Fréquence</th>
          <th scope="col">Dernier chargement</th>
          <th scope="col">Contrôles</th>
          <th scope="col">Révisions</th>
        </tr></thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>`;
}

export function afficherFraicheur(bloc: HTMLElement, jeux: Fraicheur[]): boolean {
  if (!jeux.length) return false;
  bloc.innerHTML = rendu(jeux);
  return true;
}
