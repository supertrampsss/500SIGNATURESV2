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
      " du PIB, face à l'Allemagne et à la zone euro.",
    cible: "#bloc-fonctions",
  },
  {
    question: "La Sécu est-elle en déficit ?",
    reponse:
      "Dépenses, recettes et solde des administrations de sécurité sociale en" +
      " part du PIB, année par année et face à l'Allemagne.",
    cible: "#bloc-secu",
  },
  {
    question: "Ce qui a été voté a-t-il été dépensé ?",
    reponse:
      "Le budget de l'État à trois moments du même exercice (voté, rectifié," +
      " exécuté), sur la même nomenclature.",
    cible: "#bloc-etat",
  },
  {
    question: "Ma commune est-elle plus cambriolée qu'ailleurs ?",
    reponse:
      "Les cambriolages pour 1 000 logements et cinq autres séries de délinquance" +
      " enregistrée par la police et la gendarmerie (SSMSI), par commune. Des faits" +
      " enregistrés, pas l'intégralité des faits commis, ni des condamnations.",
    // L'état du site vit dans l'URL : ce lien ouvre la carte directement sur
    // la bonne couche, sans mécanique supplémentaire.
    cible: "?theme=securite&indicateur=ssmsi_cambriolages_taux&niveau=commune",
  },
  {
    question: "Y a-t-il assez de médecins près de chez moi ?",
    reponse:
      "Les consultations de généraliste réellement accessibles par an et par" +
      " habitant (APL, DREES), commune par commune, sur trois millésimes. Un" +
      " indicateur modélisé (distance, activité des cabinets, âge de la" +
      " population), pas un simple comptage de médecins.",
    cible: "?theme=sante&indicateur=drees_apl_generalistes&niveau=commune",
  },
  {
    question: "Ma commune a-t-elle encore son école ?",
    reponse:
      "Le nombre d'écoles, de collèges et de lycées ouverts, commune par" +
      " commune, d'après l'annuaire de l'éducation nationale. Zéro est une" +
      " information ; et pour un collège, la carte scolaire dépasse la commune.",
    cible: "?theme=education&indicateur=menj_ecoles&niveau=commune",
  },
  {
    question: "Combien de logements vides dans ma commune ?",
    reponse:
      "Les logements inoccupés au recensement, proposés à la vente ou à la" +
      " location, en attente d'occupation, ou gardés vides par leur propriétaire." +
      " Ce n'est pas le comptage fiscal de la DGFiP, qui part des locaux non" +
      " soumis à taxe d'habitation et donne un autre chiffre.",
    cible: "?theme=logement&indicateur=insee_logements_vacants&niveau=commune",
  },
  {
    question: "Qui habite ma commune ?",
    reponse:
      "La répartition des habitants par catégorie sociale (cadres, employés," +
      " ouvriers, retraités) et par tranche d'âge. La statistique commence à" +
      " quinze ans : ce n'est pas la population entière, et il y manque tous les" +
      " enfants.",
    cible: "?theme=professions&indicateur=insee_pcs_cadres&niveau=commune",
  },
  {
    question: "Combien de familles élèvent seules leurs enfants ?",
    reponse:
      "Les familles monoparentales, commune par commune, sur trois millésimes du" +
      " recensement. Est enfant celui qui vit chez un parent sans conjoint ni" +
      " enfant à lui, quel que soit son âge : un adulte resté au domicile compte.",
    cible: "?theme=famille&indicateur=insee_familles_monoparentales&niveau=commune",
  },
  {
    question: "Se marie-t-on encore ?",
    reponse:
      "Mariages, pacs et taux de nuptialité par département, depuis 1975 pour les" +
      " mariages. Ils sont comptés là où les époux habitent et non là où la" +
      " cérémonie a eu lieu ; les pacs s'arrêtent en 2016 hors France entière.",
    cible: "?theme=famille&indicateur=insee_mariages&niveau=departement",
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
      " harmonisées d'Eurostat, les seules qui rendent la comparaison honnête.",
    cible: "#bloc-europe",
  },
  {
    question: "Qui porte la dette publique ?",
    reponse:
      "Sa répartition entre l'État, les organismes centraux, les collectivités et" +
      " la Sécurité sociale. Qui la détient n'est pas une donnée publique détaillée.",
    cible: "#bloc-dette",
  },
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Rendu pur, sans DOM : c'est lui qui est testé.
 *
 * Chaque question tenait sur trois lignes — l'intitulé, sa réponse courte, son
 * lien — soit 1 700 px sur un téléphone : deux écrans de sommaire avant le
 * premier chiffre. La réponse dit pourtant quelque chose d'essentiel, ce que le
 * site sait et ne sait pas répondre ; elle n'est donc pas supprimée, elle
 * attend qu'on ouvre la question. Le sommaire redevient un sommaire.
 */
export function rendu(questions: Question[] = QUESTIONS): string {
  return `<ul class="questions">
    ${questions
      .map(
        (q) => `<li>
          <details>
            <summary>${echapper(q.question)}</summary>
            <span>${echapper(q.reponse)}</span>
            <a href="${echapper(q.cible)}">Voir la réponse</a>
          </details>
        </li>`,
      )
      .join("")}
  </ul>`;
}

export function afficherQuestions(bloc: HTMLElement): void {
  bloc.innerHTML = rendu();
}
