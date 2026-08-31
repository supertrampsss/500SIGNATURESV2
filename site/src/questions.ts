import type { Analyse } from "./analyse-rendu.ts";
import { echapper } from "./texte.ts";

export type ReponseStatique = {
  slug: string;
  question: string;
  aliases: string[];
  reponse: string;
  analyseSlug: string;
  sourceRefs: { analyseId: string; sourceId: string }[];
};

export type ResolutionQuestion =
  | { statut: "exact" | "matched"; reponse: ReponseStatique }
  | { statut: "ambiguous"; reponses: ReponseStatique[] }
  | { statut: "unsupported" };

export const REPONSES_STATIQUES: readonly ReponseStatique[] = [
  {
    slug: "electricite-vendue-moins-chere-etranger",
    question: "Vend-on notre électricité moins cher à l'étranger qu'aux Français ?",
    aliases: ["pourquoi on vend notre electricite moins cher aux autres pays", "pourquoi les francais paient plus cher l electricite", "est ce qu on rachete notre electricite"],
    reponse: "Non : cette formule mélange le prix de gros des échanges transfrontaliers et une facture résidentielle TTC. En 2025, RTE valorise le MWh exporté à 59 € au prix français, près du spot français à 61 € ; la facture de détail ajoute approvisionnement lissé, réseau, commercialisation et prélèvements.",
    analyseSlug: "electricite-exportee-facture-francais",
    sourceRefs: [{analyseId: "electricite-exportee-facture-francais", sourceId: "rte-echanges-2025"}, {analyseId: "electricite-exportee-facture-francais", sourceId: "cre-trve"}]
  },
  {
    slug: "arenh-42-euros-etranger",
    question: "Le nucléaire à 42 €/MWh était-il vendu aux pays étrangers ?",
    aliases: ["arenh 42 euros", "nucleaire vendu 42 euros aux allemands", "electricite nucleaire bradee"],
    reponse: "Non. Les 42 €/MWh correspondaient à l'ARENH : un accès régulé accordé aux fournisseurs selon leurs portefeuilles de clients en France. Ce n'était pas un tarif d'exportation consenti aux États voisins, et le dispositif a pris fin le 31 décembre 2025.",
    analyseSlug: "electricite-exportee-facture-francais",
    sourceRefs: [{analyseId: "electricite-exportee-facture-francais", sourceId: "cre-arenh"}]
  },
  {
    slug: "prix-fournitures-scolaires",
    question: "Les fournitures scolaires ont-elles flambé ?",
    aliases: ["hausse fournitures scolaires", "cout rentree scolaire", "prix cartables cahiers"],
    reponse: "Le sous-panier Insee « autres fournitures scolaires et de bureau » atteint 113,02 en 2025, base 100 en 2015. Cela décrit une hausse de prix de 13,02 % depuis 2015, mais pas le coût total d'une rentrée ni la dépense d'une famille.",
    analyseSlug: "fournitures-scolaires-prix-1990-2025",
    sourceRefs: [{analyseId: "fournitures-scolaires-prix-1990-2025", sourceId: "insee-fournitures"}]
  },
  {
    slug: "hausse-prix-gaz",
    question: "Le prix du gaz a-t-il encore augmenté ?",
    aliases: ["hausse du gaz", "prix gaz menages", "gaz revenu prix avant crise"],
    reponse: "Oui dans la moyenne Eurostat retenue : pour la bande résidentielle D2 en France, le prix TTC passe de 0,1008 €/kWh au second semestre 2022 à 0,1436 €/kWh au second semestre 2025. Le hors taxes augmente lui aussi.",
    analyseSlug: "prix-gaz-menages-2022-2025",
    sourceRefs: [{analyseId: "prix-gaz-menages-2022-2025", sourceId: "eurostat-gaz"}]
  },
  {
    slug: "age-premier-achat-residence-principale",
    question: "À quel âge achète-t-on sa première résidence principale ?",
    aliases: ["age moyen achat rp", "age primo accedant evolution", "age premier achat immobilier"],
    reponse: "Les publications officielles identifiées donnent deux repères, pas une série annuelle : 36 ans pour les premières acquisitions de 1998 à 2001 dans l'enquête Logement 2002, puis 39 ans pour les primo-accédants dans l'enquête 2013.",
    analyseSlug: "age-achat-residence-principale",
    sourceRefs: [{analyseId: "age-achat-residence-principale", sourceId: "insee-enl-2002"}, {analyseId: "age-achat-residence-principale", sourceId: "insee-enl-2013"}]
  },
  {
    slug: "qualite-vie-france",
    question: "La qualité de vie baisse-t-elle en France ?",
    aliases: ["evolution qualite de vie", "satisfaction vie france", "on vit moins bien en france"],
    reponse: "L'indicateur officiel disponible ici est la satisfaction déclarée, pas toute la qualité de vie. Il vaut 7,3/10 en 2010, 6,8 en 2021 et 7,2 en 2024. Il ne montre donc pas une baisse continue, et des ruptures de série imposent de la prudence.",
    analyseSlug: "satisfaction-vie-france-2010-2024",
    sourceRefs: [{analyseId: "satisfaction-vie-france-2010-2024", sourceId: "insee-satisfaction"}]
  }
] as const;

export function normaliserQuestion(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, " ").trim();
}

function mots(texte: string): Set<string> {
  return new Set(normaliserQuestion(texte).split(" ").filter((mot) => mot.length > 2));
}

export function resoudreQuestion(texte: string): ResolutionQuestion {
  const normalisee = normaliserQuestion(texte);
  if (!normalisee) return { statut: "unsupported" };
  const exact = REPONSES_STATIQUES.find((item) => [item.question, ...item.aliases].some((candidate) => normaliserQuestion(candidate) === normalisee));
  if (exact) return { statut: "exact", reponse: exact };
  const demandes = mots(texte);
  const scores = REPONSES_STATIQUES.map((reponse) => {
    const candidats = mots([reponse.question, ...reponse.aliases].join(" "));
    const communs = [...demandes].filter((mot) => candidats.has(mot)).length;
    return { reponse, score: communs / Math.max(1, demandes.size) };
  }).sort((a, b) => b.score - a.score);
  if (!scores[0] || scores[0].score < 0.45) return { statut: "unsupported" };
  const exaequo = scores.filter((item) => item.score === scores[0]!.score && item.score >= 0.45);
  if (exaequo.length > 1) return { statut: "ambiguous", reponses: exaequo.map((item) => item.reponse) };
  return { statut: "matched", reponse: scores[0].reponse };
}

export function validerCorpusQuestions(analyses: readonly Analyse[]): void {
  const parSlug = new Map(analyses.map((analyse) => [analyse.slug, analyse]));
  for (const reponse of REPONSES_STATIQUES) {
    const analyse = parSlug.get(reponse.analyseSlug);
    if (!analyse) throw new Error(`Question ${reponse.slug} : analyse absente ${reponse.analyseSlug}`);
    const sourceIds = new Set(analyse.sources.map((source) => source.id));
    for (const ref of reponse.sourceRefs) {
      if (ref.analyseId !== reponse.analyseSlug || !sourceIds.has(ref.sourceId)) {
        throw new Error(`Question ${reponse.slug} : source non résolue ${ref.analyseId}/${ref.sourceId}`);
      }
    }
  }
}

export function renduQuestionsIndex(): string {
  return `<article class="questions"><header><p class="questions__eyebrow">Réponses vérifiées, sans IA en direct</p><h1>Posez une question sur les dossiers</h1><p>Le site cherche dans des réponses écrites, sourcées et pré-rendues. Aucune question n'est envoyée à un modèle, enregistrée ou ajoutée à l'adresse.</p></header><form class="questions__form" id="questions-form"><label for="questions-saisie">Votre question</label><div><input id="questions-saisie" name="question" autocomplete="off" maxlength="180"><button type="submit">Chercher</button></div></form><div id="questions-resultat" class="questions__resultat" aria-live="polite"></div><section aria-labelledby="questions-disponibles"><h2 id="questions-disponibles">Questions déjà documentées</h2><ul class="questions__liste">${REPONSES_STATIQUES.map((item) => `<li><a href="/questions/${echapper(item.slug)}/">${echapper(item.question)}</a></li>`).join("")}</ul></section></article>`;
}

export function renduReponseQuestion(item: ReponseStatique): string {
  return `<article class="questions questions--reponse"><nav aria-label="Fil d’Ariane"><a href="/questions/">Questions</a><span aria-hidden="true">›</span><span aria-current="page">Réponse</span></nav><header><p class="questions__eyebrow">Réponse pré-rendue</p><h1>${echapper(item.question)}</h1></header><p class="questions__reponse">${echapper(item.reponse)}</p><p><a class="questions__preuve" href="/analyses/${echapper(item.analyseSlug)}/">Voir l'analyse, les limites et les sources</a></p><p class="questions__note">Cette réponse est éditoriale et déterministe : aucun modèle n'est appelé à l'ouverture de la page.</p></article>`;
}
