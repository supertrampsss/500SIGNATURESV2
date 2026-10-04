import type { Analyse } from "./analyse-rendu.ts";
import { echapper } from "./texte.ts";

export type ReponseStatique = {
  slug: string;
  question: string;
  aliases: string[];
  motsCles: string[];
  reponse: string;
  analyseSlug: string;
  sourceRefs: { analyseId: string; sourceId: string }[];
};

export type SuggestionQuestion = Pick<ReponseStatique, "slug" | "question">;

export type ResolutionQuestion =
  | { statut: "exact"; reponse: ReponseStatique }
  | { statut: "matched"; reponse: SuggestionQuestion }
  | { statut: "ambiguous"; reponses: SuggestionQuestion[] }
  | { statut: "unsupported" };

export const REPONSES_STATIQUES: readonly ReponseStatique[] = [
  {
    slug: "electricite-vendue-moins-chere-etranger",
    question: "Vend-on notre électricité moins cher à l'étranger qu'aux Français ?",
    aliases: ["pourquoi on vend notre electricite moins cher aux autres pays", "pourquoi les francais paient plus cher l electricite", "est ce qu on rachete notre electricite", "electricite nucleaire vendue a l etranger"],
    motsCles: ["electricite", "export", "exportations", "etranger", "voisins", "facture", "francais", "rachat", "nucleaire"],
    reponse: "Cette comparaison mélange le prix de gros des échanges transfrontaliers et une facture résidentielle TTC. Les valeurs RTE portent sur toutes les exportations, pas sur un flux nucléaire isolé. En 2025, RTE valorise le MWh exporté à 59 € au prix français, près du spot français à 61 € ; la facture de détail ajoute approvisionnement lissé, réseau, commercialisation et prélèvements.",
    analyseSlug: "electricite-exportee-facture-francais",
    sourceRefs: [{analyseId: "electricite-exportee-facture-francais", sourceId: "rte-echanges-2025"}, {analyseId: "electricite-exportee-facture-francais", sourceId: "cre-trve"}]
  },
  {
    slug: "arenh-42-euros-etranger",
    question: "Le nucléaire à 42 €/MWh était-il vendu aux pays étrangers ?",
    aliases: ["arenh 42 euros", "nucleaire vendu 42 euros aux allemands", "electricite nucleaire bradee"],
    motsCles: ["arenh", "42", "nucleaire", "electricite", "fournisseurs"],
    reponse: "Les 42 €/MWh correspondaient à l'ARENH : un accès régulé accordé aux fournisseurs selon leurs portefeuilles de clients en France. Ce n'était pas un tarif d'exportation consenti aux États voisins, et le dispositif a pris fin le 31 décembre 2025.",
    analyseSlug: "electricite-exportee-facture-francais",
    sourceRefs: [{analyseId: "electricite-exportee-facture-francais", sourceId: "cre-arenh"}]
  },
  {
    slug: "prix-fournitures-scolaires",
    question: "Les fournitures scolaires ont-elles flambé ?",
    aliases: ["hausse fournitures scolaires", "cout rentree scolaire", "prix cartables cahiers"],
    motsCles: ["fournitures", "scolaires", "rentree", "cartables", "cahiers"],
    reponse: "Entre 1990 et 2025, les prix des « autres fournitures scolaires et de bureau » suivies par l’Insee ont augmenté d’environ 75 %, contre 79 % pour l’ensemble des prix. Dans cette catégorie, les prix ont peu bougé entre 2015 et 2021, avant une hausse de près de 12 % entre 2021 et 2025.",
    analyseSlug: "fournitures-scolaires-prix-1990-2025",
    sourceRefs: [{analyseId: "fournitures-scolaires-prix-1990-2025", sourceId: "insee-fournitures"}, {analyseId: "fournitures-scolaires-prix-1990-2025", sourceId: "insee-ipc-ensemble"}]
  },
  {
    slug: "hausse-prix-gaz",
    question: "Le prix du gaz a-t-il encore augmenté en France ?",
    aliases: ["hausse du gaz", "prix gaz menages", "prix gaz depuis 2022", "le prix du gaz a t il encore augmente"],
    motsCles: ["gaz", "d2"],
    reponse: "Dans la moyenne Eurostat retenue, le prix a augmenté : pour la bande résidentielle D2 en France, le TTC passe de 0,1008 €/kWh au second semestre 2022 à 0,1436 €/kWh au second semestre 2025. Le hors taxes augmente lui aussi.",
    analyseSlug: "prix-gaz-menages-2022-2025",
    sourceRefs: [{analyseId: "prix-gaz-menages-2022-2025", sourceId: "eurostat-gaz"}]
  },
  {
    slug: "age-premier-achat-residence-principale",
    question: "À quel âge achète-t-on sa première résidence principale ?",
    aliases: ["age moyen achat rp", "age primo accedant evolution", "age premier achat immobilier"],
    motsCles: ["age", "achat", "residence", "principale", "primo", "accedant", "immobilier", "propriete", "cohorte"],
    reponse: "Il n'existe pas de série annuelle homogène de l'âge moyen au premier achat. L'Insee publie deux moyennes ponctuelles non comparables directement, ainsi qu'un autre indicateur par génération : l'âge auquel la moitié d'une cohorte est devenue propriétaire. Ce dernier passe de 47 ans pour la cohorte 1924 à 33,5 ans pour 1952, puis 38 ans pour 1964.",
    analyseSlug: "age-achat-residence-principale",
    sourceRefs: [{analyseId: "age-achat-residence-principale", sourceId: "insee-enl-2002"}, {analyseId: "age-achat-residence-principale", sourceId: "insee-enl-2013"}, {analyseId: "age-achat-residence-principale", sourceId: "insee-cohortes-2017"}]
  },
  {
    slug: "qualite-vie-france",
    question: "La qualité de vie baisse-t-elle en France ?",
    aliases: ["evolution qualite de vie", "satisfaction vie france", "on vit moins bien en france"],
    motsCles: ["qualite", "vie", "satisfaction", "vivre"],
    reponse: "Une seule série ne permet pas de conclure sur toute la qualité de vie. L'indicateur officiel étudié ici est la satisfaction déclarée : 7,3/10 en 2010, 6,8 en 2021 et 7,2 en 2024. Il ne montre pas une baisse continue, et des ruptures de série imposent de la prudence.",
    analyseSlug: "satisfaction-vie-france-2010-2024",
    sourceRefs: [{analyseId: "satisfaction-vie-france-2010-2024", sourceId: "insee-satisfaction"}]
  }
] as const;

/** Développements des réponses courtes. Chaque fait reste dans le périmètre des sources référencées. */
const EXPLICATIONS_QUESTIONS: Readonly<Record<string, readonly { titre: string; paragraphes: readonly string[] }[]>> = {
  'electricite-vendue-moins-chere-etranger': [
    {titre: 'Pourquoi le prix de gros diffère de la facture TTC', paragraphes: [
      'Le marché de gros rémunère une quantité d’énergie livrée à une échéance donnée. Un fournisseur peut acheter à l’avance et répartir son approvisionnement entre plusieurs contrats. Le prix facturé au ménage reflète donc des achats effectués à des dates différentes.',
      'La facture finance aussi l’utilisation des réseaux, la commercialisation et les prélèvements. Comparer uniquement un prix de marché à une facture TTC laisse ces coûts de côté. Un mégawattheure correspond à 1 000 kilowattheures : les unités doivent également être identiques.',
    ]},
    {titre: 'Comment lire les valeurs publiées par RTE', paragraphes: [
      'La valorisation des exportations applique des prix de marché aux flux échangés. Elle donne un repère pour lire les échanges électriques, sans reconstituer la recette exacte de chaque contrat. Les données concernent l’ensemble de l’électricité exportée, dont la production provient de plusieurs filières.',
    ]},
  ],
  'arenh-42-euros-etranger': [
    {titre: 'À qui l’accès régulé au nucléaire était-il destiné ?', paragraphes: [
      'L’ARENH permettait aux fournisseurs d’accéder à une part de la production nucléaire historique pour alimenter leurs clients en France. Le montant de 42 euros par mégawattheure concernait cette part régulée de l’approvisionnement.',
      'Une facture résidentielle comprend ensuite la fourniture d’énergie, les réseaux, la commercialisation et les prélèvements. Le montant de l’ARENH ne représentait donc pas une facture complète pour le consommateur.',
    ]},
    {titre: 'Quel lien avec les exportations d’électricité ?', paragraphes: [
      'Les exportations relèvent des échanges sur les marchés de gros entre zones de prix. Leurs prix dépendent des échanges et des contraintes d’interconnexion. La nationalité d’un fournisseur et la destination de ses clients sont deux informations différentes : l’accès régulé était fondé sur les clients desservis en France.',
      'Le dispositif ayant pris fin le 31 décembre 2025, cette réponse explique un mécanisme historique. Elle ne présente pas 42 €/MWh comme un tarif disponible aujourd’hui.',
    ]},
  ],
  'prix-fournitures-scolaires': [
    {titre: 'Que mesure l’indice des fournitures scolaires ?', paragraphes: [
      'La série Insee retenue porte sur les « autres fournitures scolaires et de bureau ». Elle suit l’évolution des prix de cette catégorie au fil du temps. La comparaison avec l’indice général permet de situer cette hausse par rapport à l’inflation de l’ensemble des biens et services.',
    ]},
    {titre: 'Pourquoi le budget de rentrée peut évoluer autrement', paragraphes: [
      'Une famille paie un panier concret : les quantités demandées par l’établissement, les marques choisies et le lieu d’achat modifient le total. Remplacer un article ou réutiliser du matériel change la dépense sans nécessairement changer le prix des produits suivis.',
      'Pour comparer des budgets de rentrée, il faut donc regarder les articles inclus, le niveau scolaire et l’année. Une variation d’indice et le coût d’un équipement complet répondent à des questions différentes.',
    ]},
  ],
  'hausse-prix-gaz': [
    {titre: 'Quels ménages et quelle période sont comparés ?', paragraphes: [
      'La bande D2 d’Eurostat regroupe les ménages consommant de 20 à moins de 200 gigajoules de gaz par an. La comparaison porte sur deux moyennes semestrielles, au second semestre 2022 et au second semestre 2025.',
      'Le prix TTC passe de 10,08 à 14,36 centimes par kilowattheure, soit environ 42 % de hausse. Ce repère décrit cette catégorie et cette période ; il ne donne pas le prix du contrat de chaque foyer ni le tarif du mois en cours.',
    ]},
    {titre: 'Quelle part vient des taxes et du coût hors taxes ?', paragraphes: [
      'Le prix hors taxes passe de 7,54 à 9,98 centimes par kilowattheure. Il progresse de 2,44 centimes, sur les 4,28 centimes de hausse TTC. L’écart entre TTC et hors taxes augmente de 1,84 centime.',
      'La consommation du logement reste déterminante pour la dépense annuelle. Un prix par kilowattheure et le total payé sur une facture doivent être lus séparément.',
    ]},
  ],
  'age-premier-achat-residence-principale': [
    {titre: 'Âge moyen des primo-accédants ou âge d’une génération ?', paragraphes: [
      'L’âge moyen des primo-accédants décrit les personnes qui achètent pour la première fois pendant une période d’enquête. L’indicateur par génération suit une cohorte jusqu’à l’âge où la moitié de ses membres est devenue propriétaire.',
      'Le premier repère dépend des acheteurs observés ; le second décrit une trajectoire d’accès à la propriété. Les réunir dans une même courbe ferait passer deux mesures différentes pour une seule série.',
    ]},
    {titre: 'Pourquoi les enquêtes ne donnent pas un âge actuel unique', paragraphes: [
      'L’enquête Logement 2002 porte sur des premières acquisitions réalisées entre 1998 et 2001, tandis que la publication issue de l’enquête 2013 observe une autre fenêtre. Leur comparaison ne permet pas de reconstruire une hausse régulière entre les deux dates.',
      'Pour apprécier l’accès à la propriété, le dossier examine aussi les revenus, les prix, l’apport et les conditions de crédit. Ces dimensions expliquent pourquoi des ménages du même âge peuvent avoir des possibilités d’achat différentes.',
    ]},
  ],
  'qualite-vie-france': [
    {titre: 'Que mesure la satisfaction dans la vie ?', paragraphes: [
      'L’enquête Insee demande aux personnes de 16 ans ou plus de noter la vie qu’elles mènent actuellement sur une échelle de 0 à 10. Cette réponse reflète une appréciation personnelle du quotidien.',
      'La qualité de vie comprend plusieurs dimensions, comme les revenus, le logement, la santé et les relations sociales. La note de satisfaction donne un éclairage sur cet ensemble, avec des écarts entre groupes sociaux.',
    ]},
    {titre: 'Comment interpréter l’évolution depuis 2010 ?', paragraphes: [
      'Entre le creux de 2021 et 2024, la note moyenne gagne 0,4 point. Le niveau de 2024 reste proche de celui de 2010. Une moyenne nationale peut toutefois masquer des situations différentes selon les revenus et les conditions de vie.',
      'La refonte de l’enquête en 2020 et une modification de pondération en 2022 créent des ruptures à prendre en compte. Les petites différences sur longue période doivent être interprétées avec cette précaution.',
    ]},
  ],
};

export function normaliserQuestion(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-FR").replace(/[^a-z0-9]+/g, " ").trim();
}

function mots(texte: string): Set<string> {
  return new Set(normaliserQuestion(texte).split(" ").filter((mot) => mot.length > 2 || /^\d+$/.test(mot)));
}

function suggestion(reponse: ReponseStatique): SuggestionQuestion {
  return { slug: reponse.slug, question: reponse.question };
}

export function resoudreQuestion(texte: string): ResolutionQuestion {
  const normalisee = normaliserQuestion(texte);
  if (!normalisee) return { statut: "unsupported" };
  const exact = REPONSES_STATIQUES.find((item) => [item.question, ...item.aliases].some((candidate) => normaliserQuestion(candidate) === normalisee));
  if (exact) return { statut: "exact", reponse: exact };
  const demandes = mots(texte);
  if (demandes.size < 2) return { statut: "unsupported" };
  const scores = REPONSES_STATIQUES.map((reponse) => {
    const motsCles = mots(reponse.motsCles.join(" "));
    const sujetTrouve = [...demandes].some((mot) => motsCles.has(mot));
    const correspondances = [reponse.question, ...reponse.aliases].map((candidate) => {
      const candidats = mots(candidate);
      return [...demandes].filter((mot) => candidats.has(mot)).length;
    });
    const communs = Math.max(0, ...correspondances);
    return { reponse, score: communs / demandes.size, communs, sujetTrouve };
  }).filter((item) => item.communs >= 2 && item.sujetTrouve && item.score >= 0.5)
    .sort((a, b) => b.score - a.score);
  if (!scores[0]) return { statut: "unsupported" };
  const proches = scores.filter((item) => scores[0]!.score - item.score <= 0.1).slice(0, 3);
  if (proches.length > 1) return { statut: "ambiguous", reponses: proches.map((item) => suggestion(item.reponse)) };
  return { statut: "matched", reponse: suggestion(scores[0].reponse) };
}

export function validerCorpusQuestions(analyses: readonly Analyse[]): void {
  const parSlug = new Map(analyses.map((analyse) => [analyse.slug, analyse]));
  for (const reponse of REPONSES_STATIQUES) {
    const analyse = parSlug.get(reponse.analyseSlug);
    if (!analyse) throw new Error(`Question ${reponse.slug} : analyse absente ${reponse.analyseSlug}`);
    if (!EXPLICATIONS_QUESTIONS[reponse.slug]?.length) throw new Error(`Question ${reponse.slug} : développement absent`);
    const sourceIds = new Set(analyse.sources.map((source) => source.id));
    for (const ref of reponse.sourceRefs) {
      if (ref.analyseId !== reponse.analyseSlug || !sourceIds.has(ref.sourceId)) {
        throw new Error(`Question ${reponse.slug} : source non résolue ${ref.analyseId}/${ref.sourceId}`);
      }
    }
  }
}

export function renduQuestionsIndex(): string {
  return `<article class="questions"><header><p class="questions__eyebrow">Questions du quotidien</p><h1>Comprendre les chiffres du quotidien</h1><p>Pourquoi l’électricité exportée et votre facture n’ont-elles pas le même prix ? À quel âge devient-on propriétaire ? Retrouvez des réponses documentées sur l’énergie, le logement, la rentrée scolaire et la qualité de vie.</p></header><form class="questions__form" id="questions-form"><label for="questions-saisie">Votre question</label><div><input id="questions-saisie" name="question" autocomplete="off" maxlength="180"><button type="submit">Chercher</button></div></form><div id="questions-resultat" class="questions__resultat" aria-live="polite"></div><section aria-labelledby="questions-disponibles"><h2 id="questions-disponibles">Les questions documentées</h2><ul class="questions__liste">${REPONSES_STATIQUES.map((item) => `<li><a href="/questions/${echapper(item.slug)}/">${echapper(item.question)}</a></li>`).join("")}</ul></section><p><a href="/analyses/">Lire les dossiers complets et leurs graphiques</a></p></article>`;
}

export function renduReponseQuestion(item: ReponseStatique, analyses: readonly Analyse[] = []): string {
  const analyse = analyses.find(a => a.slug === item.analyseSlug);
  const sources = item.sourceRefs.flatMap(ref => analyse?.sources.filter(s => s.id === ref.sourceId) ?? []);
  const developpement = (EXPLICATIONS_QUESTIONS[item.slug] ?? []).map(section => `<section class="questions__explication"><h2>${echapper(section.titre)}</h2>${section.paragraphes.map(p => `<p>${echapper(p)}</p>`).join("")}</section>`).join("");
  return `<article class="questions questions--reponse"><nav aria-label="Fil d’Ariane"><a href="/">Accueil</a><span aria-hidden="true"> · </span><a href="/questions/">Questions</a></nav><header><p class="questions__eyebrow">Comprendre les chiffres</p><h1>${echapper(item.question)}</h1></header><p class="questions__reponse">${echapper(item.reponse)}</p>${developpement}<footer class="questions__sources"><h2>Sources et dossier complet</h2><p><a class="questions__preuve" href="/analyses/${echapper(item.analyseSlug)}/">${echapper(analyse?.titre ?? 'Lire le dossier et ses limites')}</a></p>${sources.length ? `<ol>${sources.map(s => `<li><a href="${echapper(s.url)}" target="_blank" rel="noopener">${echapper(s.titre)}</a></li>`).join("")}</ol>` : ''}</footer></article>`;
}
