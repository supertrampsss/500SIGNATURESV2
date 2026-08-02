/**
 * Questions d'entrée.
 *
 * Le moteur de questions en langage naturel est prévu pour la phase 3, et il
 * suppose un corpus d'évaluation qui n'existe pas encore (décision D10). En
 * attendant, ce n'est pas une raison pour laisser le lecteur deviner ce que le
 * site sait faire : les questions auxquelles il répond **réellement** sont
 * écrites, avec la réponse courte et le lien vers l'endroit qui la détaille.
 *
 * La règle est la même que partout ailleurs : une question à laquelle le site
 * ne sait pas répondre n'est pas listée, et une réponse partielle le dit.
 */

export type Question = {
  question: string;
  reponse: string;
  cible: string;
};

export const QUESTIONS: Question[] = [
  {
    question: "Où va l'argent de l'État ?",
    reponse:
      "La part de chaque poste dans 100 € encaissés puis dépensés, sur le dernier" +
      " exercice clos. Une proportion, pas le trajet d'un euro.",
    cible: "#bloc-cent-euros",
  },
  {
    question: "Combien pour la santé, l'école, la défense ?",
    reponse:
      "La dépense de toutes les administrations publiques par fonction, en part" +
      " du PIB, face à l'Allemagne et à la zone euro. La santé est surtout payée" +
      " par la Sécurité sociale, pas par le budget de l'État.",
    cible: "#bloc-fonctions",
  },
  {
    question: "La Sécu est-elle en déficit ?",
    reponse:
      "Dépenses, recettes et solde des administrations de sécurité sociale en" +
      " part du PIB, année par année et face à l'Allemagne — en disant pourquoi" +
      " ce chiffre n'est pas le « trou de la Sécu » des débats parlementaires.",
    cible: "#bloc-secu",
  },
  {
    question: "Ce qui a été voté a-t-il été dépensé ?",
    reponse:
      "Le budget de l'État à trois moments du même exercice — voté, rectifié," +
      " exécuté — sur la même nomenclature.",
    cible: "#bloc-etat",
  },
  {
    question: "Ma commune dépense-t-elle plus que les communes comparables ?",
    reponse:
      "Sa position parmi les communes de mêmes critères, publiés avec le résultat." +
      " Une position basse ne signifie pas une meilleure gestion.",
    cible: "#recherche",
  },
  {
    question: "Comment la France se compare-t-elle à ses voisins ?",
    reponse:
      "Dette, déficit, chômage et PIB par habitant, sur les définitions" +
      " harmonisées d'Eurostat — les seules qui rendent la comparaison honnête.",
    cible: "#bloc-europe",
  },
  {
    question: "Qui porte la dette publique ?",
    reponse:
      "Sa répartition entre l'État, les organismes centraux, les collectivités et" +
      " la Sécurité sociale. Qui la détient n'est pas une donnée publique détaillée.",
    cible: "#bloc-dette",
  },
  {
    question: "Ces chiffres sont-ils à jour ?",
    reponse:
      "La date de dernière lecture de chaque source, son retard éventuel, et ce" +
      " que les contrôles ont relevé.",
    cible: "#etat-donnees",
  },
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(questions: Question[] = QUESTIONS): string {
  return `<ul class="questions">
    ${questions
      .map(
        (q) => `<li>
          <a href="${echapper(q.cible)}">${echapper(q.question)}</a>
          <span>${echapper(q.reponse)}</span>
        </li>`,
      )
      .join("")}
  </ul>`;
}

export function afficherQuestions(bloc: HTMLElement): void {
  bloc.innerHTML = rendu();
}
