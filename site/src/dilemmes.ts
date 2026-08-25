/** Les deux coûts politiques explicités pour les dossiers de la campagne express. */

export type CoteDilemme = {
  libelle: string;
  argument: string;
  gagnants: string[];
  perdants: string[];
};

export type DilemmeEditorial = {
  question: string;
  contradiction: string;
  adopter: CoteDilemme;
  rejeter: CoteDilemme;
};

function cote(libelle: string, gagnants: string[], perdants: string[]): CoteDilemme {
  return {
    libelle,
    argument: `${gagnants.join(" et ")} en bénéficient ; ${perdants.join(" et ")} en supportent le coût.`,
    gagnants,
    perdants,
  };
}

export const DILEMMES: Record<string, DilemmeEditorial> = {
  "flat-tax-a-20-avec-abattement-protegeant": {
    question: "Remplacer le barème de l'impôt sur le revenu par un taux unique de 20 % avec abattement ?",
    contradiction: "Le taux unique s'applique à tous les revenus imposables ; l'abattement laisse les foyers non imposables à zéro, tandis que les tranches supérieures paient moins au prix d'une baisse des recettes publiques.",
    adopter: cote("Passer à 20 %", ["foyers imposés dans les tranches supérieures"], ["budget public"]),
    rejeter: cote("Garder le barème", ["budget public et progressivité"], ["foyers imposés dans les tranches supérieures"]),
  },
  "exonerer-de-droits-de-succession-jusqu-a": {
    question: "Exonérer les successions jusqu'au seuil prévu par enfant ?",
    contradiction: "Faciliter la transmission aux héritiers concernés réduit en même temps la ressource commune disponible.",
    adopter: cote("Exonérer", ["héritiers concernés"], ["budget public"]),
    rejeter: cote("Conserver", ["budget public"], ["héritiers concernés"]),
  },
  "raboter-de-5-les-subventions-directes-aux": {
    question: "Réduire de 5 % les subventions directes aux entreprises ?",
    contradiction: "Alléger la dépense publique préserve le budget, mais retire un soutien direct aux entreprises aidées.",
    adopter: cote("Réduire", ["budget public"], ["entreprises aidées"]),
    rejeter: cote("Maintenir", ["entreprises aidées"], ["contribuables"]),
  },
  "achever-la-suppression-de-la-cvae": {
    question: "Achever la suppression de la CVAE ?",
    contradiction: "Soulager les entreprises redevables transfère la pression vers les finances publiques et les territoires.",
    adopter: cote("Supprimer", ["entreprises redevables"], ["finances publiques et territoires"]),
    rejeter: cote("Conserver", ["finances publiques et territoires"], ["entreprises redevables"]),
  },
  "aligner-la-csg-des-retraites-aises-sur": {
    question: "Aligner la CSG des retraités aisés sur celle des actifs ?",
    contradiction: "Faire contribuer davantage les retraités aisés soutient les actifs et le budget social, au prix de leur revenu net.",
    adopter: cote("Aligner", ["actifs et budget social"], ["retraités aisés"]),
    rejeter: cote("Refuser", ["retraités aisés"], ["actifs et budget social"]),
  },
  "reconduire-la-surtaxe-des-grandes-entreprises": {
    question: "Reconduire la surtaxe des grandes entreprises ?",
    contradiction: "Préserver la ressource budgétaire fait porter l'effort sur les grandes entreprises plutôt que sur les contribuables.",
    adopter: cote("Reconduire", ["budget public"], ["grandes entreprises"]),
    rejeter: cote("Arrêter", ["grandes entreprises"], ["contribuables"]),
  },
  "desindexer-les-pensions-d-un-point": {
    question: "Désindexer les pensions d'un point ?",
    contradiction: "Contenir la progression des pensions soulage le budget social, mais diminue le pouvoir d'achat des retraités.",
    adopter: cote("Désindexer", ["budget social"], ["retraités"]),
    rejeter: cote("Indexer", ["retraités"], ["futurs budgets sociaux"]),
  },
  "repousser-l-age-legal-a-65-ans": {
    question: "Repousser l'âge légal à 65 ans ?",
    contradiction: "Améliorer les finances sociales demande aux actifs proches de la retraite de travailler plus longtemps.",
    adopter: cote("Repousser", ["finances sociales"], ["actifs proches de la retraite"]),
    rejeter: cote("Maintenir", ["actifs proches de la retraite"], ["finances sociales"]),
  },
  "supprimer-l-aide-medicale-d-etat": {
    question: "Supprimer l'aide médicale d'État ?",
    contradiction: "Réduire la dépense immédiate fragilise l'accès aux soins des bénéficiaires et complique le travail des hôpitaux.",
    adopter: cote("Supprimer", ["budget à court terme"], ["bénéficiaires et hôpitaux"]),
    rejeter: cote("Conserver", ["bénéficiaires et prévention"], ["budget public"]),
  },
  "porter-l-effort-de-defense-vers-3": {
    question: "Porter l'effort de défense vers 3 % du PIB ?",
    contradiction: "Renforcer les armées et l'industrie de défense impose de moins financer les autres budgets publics.",
    adopter: cote("Porter", ["armées et industrie de défense"], ["autres budgets"]),
    rejeter: cote("Maintenir", ["autres budgets"], ["armées et industrie de défense"]),
  },
  "plan-ferroviaire-3-000-m-de-plus": {
    question: "Ajouter le plan ferroviaire prévu ?",
    contradiction: "Investir davantage dans le ferroviaire sert les voyageurs et les territoires, mais prélève sur le budget public.",
    adopter: cote("Ajouter", ["voyageurs et territoires"], ["budget public"]),
    rejeter: cote("Refuser", ["budget public"], ["voyageurs et territoires"]),
  },
  "privatiser-l-audiovisuel-public": {
    question: "Privatiser l'audiovisuel public ?",
    contradiction: "Réduire la charge publique ouvre un espace aux acteurs privés, mais transforme le service public audiovisuel.",
    adopter: cote("Privatiser", ["budget public et acteurs privés"], ["service public audiovisuel"]),
    rejeter: cote("Conserver", ["service public audiovisuel"], ["budget public"]),
  },
  "doubler-les-franchises-medicales": {
    question: "Doubler les franchises médicales ?",
    contradiction: "Limiter la dépense de l'assurance maladie reporte une part plus lourde du coût des soins sur les patients.",
    adopter: cote("Doubler", ["assurance maladie"], ["patients"]),
    rejeter: cote("Maintenir", ["patients"], ["assurance maladie"]),
  },
  "revaloriser-les-enseignants-de-5": {
    question: "Revaloriser les enseignants de 5 % ?",
    contradiction: "Rendre le métier plus attractif soutient les enseignants, mais appelle une dépense publique supplémentaire.",
    adopter: cote("Revaloriser", ["enseignants et attractivité scolaire"], ["budget public"]),
    rejeter: cote("Refuser", ["budget public"], ["enseignants et attractivité scolaire"]),
  },
  "geler-le-point-d-indice-en-2026": {
    question: "Geler le point d'indice en 2026 ?",
    contradiction: "Freiner la masse salariale publique protège le budget, mais laisse les agents publics supporter l'effort.",
    adopter: cote("Geler", ["budget public"], ["agents publics"]),
    rejeter: cote("Revaloriser", ["agents publics"], ["budget public"]),
  },
  "fermer-un-tiers-des-agences-et-operateurs": {
    question: "Fermer un tiers des agences et opérateurs ?",
    contradiction: "Réduire les structures publiques allège le budget, mais désorganise les agents et les services concernés.",
    adopter: cote("Fermer", ["budget public"], ["agents et services concernés"]),
    rejeter: cote("Conserver", ["services concernés"], ["budget public"]),
  },
  "ceder-des-participations-non-strategiques-de-l": {
    question: "Céder des participations non stratégiques de l'État ?",
    contradiction: "Réduire la dette à court terme renonce à la fois aux dividendes futurs et à une part du contrôle public.",
    adopter: cote("Céder", ["dette à court terme"], ["dividendes futurs et contrôle public"]),
    rejeter: cote("Conserver", ["dividendes futurs et contrôle public"], ["dette à court terme"]),
  },
  "doubler-les-moyens-contre-la-fraude-fiscale": {
    question: "Doubler les moyens contre la fraude fiscale et sociale ?",
    contradiction: "Mieux contrôler la fraude protège les contribuables conformes et le budget, mais pénalise les fraudeurs.",
    adopter: cote("Doubler", ["contribuables conformes et budget public"], ["fraudeurs"]),
    rejeter: cote("Maintenir", ["fraudeurs"], ["budget public et contribuables conformes"]),
  },
  "reduire-l-aide-publique-au-developpement-de": {
    question: "Réduire de moitié l'aide publique au développement ?",
    contradiction: "Préserver le budget national réduit le soutien aux pays bénéficiaires et l'influence diplomatique qui l'accompagne.",
    adopter: cote("Réduire", ["budget national"], ["pays bénéficiaires et influence diplomatique"]),
    rejeter: cote("Maintenir", ["pays bénéficiaires et influence diplomatique"], ["budget national"]),
  },
  "porter-le-taux-normal-de-tva-a": {
    question: "Porter le taux normal de TVA à 21 % ?",
    contradiction: "Augmenter la TVA finance le budget public, mais pèse directement sur les consommateurs dans leurs achats courants.",
    adopter: cote("Augmenter", ["budget public"], ["consommateurs"]),
    rejeter: cote("Maintenir", ["consommateurs"], ["budget public"]),
  },
  "reduire-de-5-les-dotations-aux-collectivites": {
    question: "Réduire de 5 % les dotations aux collectivités ?",
    contradiction: "Soulager le budget de l'État déplace l'effort sur les collectivités et les services locaux qu'elles assurent.",
    adopter: cote("Réduire", ["budget de l'État"], ["collectivités et services locaux"]),
    rejeter: cote("Maintenir", ["collectivités et services locaux"], ["budget de l'État"]),
  },
};

export function dilemmeDe(id: string): DilemmeEditorial | undefined {
  return DILEMMES[id];
}
