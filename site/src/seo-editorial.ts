/** Intentions éditoriales, pas des volumes de recherche mesurés. Les URL restent stables. */
export type LienEditorial = { chemin: string; titre: string; contexte: string };
type ProfilDossier = { titreRecherche: string; liens: readonly LienEditorial[] };
const dossier = (slug: string) => `/analyses/${slug}/`;
const question = (slug: string) => `/questions/${slug}/`;

export const SEO_DOSSIERS: Readonly<Record<string, ProfilDossier>> = {
  'age-achat-residence-principale': {
    titreRecherche: 'Premier achat immobilier : quel âge en France ?',
    liens: [
      {chemin: question('age-premier-achat-residence-principale'), titre: 'Âge des primo-accédants : les repères Insee', contexte: 'Une réponse courte pour distinguer âge moyen et parcours par génération.'},
      {chemin: dossier('satisfaction-vie-france-2010-2024'), titre: 'Revenus et satisfaction dans la vie', contexte: 'Les écarts de revenus éclairent aussi les différences de bien-être déclaré.'},
    ],
  },
  'championne-du-monde-prelevements-2024': {
    titreRecherche: 'Prélèvements obligatoires : France et Europe 2024',
    liens: [
      {chemin: dossier('cout-travail-cent-euros-net-2025'), titre: 'Du coût employeur au salaire net', contexte: 'Lire les prélèvements sur le travail avec un profil de salarié comparable.'},
      {chemin: dossier('la-depense-publique-baisse-2024'), titre: 'Que mesure la dépense publique ?', contexte: 'Mettre les recettes en regard des dépenses de l’ensemble des administrations.'},
    ],
  },
  'cout-travail-cent-euros-net-2025': {
    titreRecherche: 'Coût employeur, salaire brut et net : les écarts',
    liens: [
      {chemin: '/salaires/', titre: 'Explorer la répartition du coût du travail', contexte: 'Le repère OCDE est disponible dans l’outil Salaires, avec son profil et ses limites.'},
      {chemin: dossier('championne-du-monde-prelevements-2024'), titre: 'Impôts et cotisations en France et en Europe', contexte: 'Le taux rapporté au PIB complète la lecture d’une rémunération individuelle.'},
    ],
  },
  'defense-credits-votes-consommes-2025': {
    titreRecherche: 'Budget de la défense 2025 : voté et dépensé',
    liens: [
      {chemin: dossier('defense-europe-depenses-2024'), titre: 'Les dépenses de défense en Europe', contexte: 'Comparer les comptes publics européens en gardant leurs périmètres.'},
      {chemin: dossier('ukraine-pret-europeen-90-milliards'), titre: 'Le financement européen de l’aide à l’Ukraine', contexte: 'Distinguer l’effort militaire national du prêt accordé par l’Union européenne.'},
    ],
  },
  'defense-europe-depenses-2024': {
    titreRecherche: 'Dépenses de défense en Europe : chiffres 2024',
    liens: [
      {chemin: dossier('defense-credits-votes-consommes-2025'), titre: 'Défense française : du budget voté à l’exécution', contexte: 'Comprendre pourquoi une enveloppe initiale et une dépense consommée diffèrent.'},
      {chemin: dossier('groenland-accord-securite-europe'), titre: 'Le Groenland et la sécurité européenne', contexte: 'Un autre dossier sur les engagements de sécurité et leur mise en œuvre.'},
    ],
  },
  'electricite-exportee-facture-francais': {
    titreRecherche: 'Électricité : exportations et facture en France',
    liens: [
      {chemin: question('electricite-vendue-moins-chere-etranger'), titre: 'Exportations et facture : quels prix comparer ?', contexte: 'La réponse courte distingue le marché de gros de la facture résidentielle TTC.'},
      {chemin: question('arenh-42-euros-etranger'), titre: 'À qui était destiné l’ARENH à 42 €/MWh ?', contexte: 'Retrouver le rôle de cet ancien dispositif dans l’approvisionnement des fournisseurs.'},
      {chemin: dossier('prix-gaz-menages-2022-2025'), titre: 'Prix du gaz : coût hors taxes et prélèvements', contexte: 'Pour une autre énergie du logement, décomposer aussi le prix payé par les ménages.'},
    ],
  },
  'fournitures-scolaires-prix-1990-2025': {
    titreRecherche: 'Fournitures scolaires : prix et budget de rentrée',
    liens: [
      {chemin: question('prix-fournitures-scolaires'), titre: 'L’évolution du prix des fournitures scolaires', contexte: 'Les principaux repères historiques et les limites d’une comparaison de paniers.'},
      {chemin: dossier('la-depense-publique-baisse-2024'), titre: 'Prix, dépenses et services publics', contexte: 'Comprendre pourquoi les euros dépensés et le service financé ne progressent pas forcément ensemble.'},
    ],
  },
  'groenland-accord-securite-europe': {
    titreRecherche: 'Groenland : accord de sécurité et enjeux européens',
    liens: [
      {chemin: dossier('defense-europe-depenses-2024'), titre: 'La hausse des dépenses de défense en Europe', contexte: 'Les budgets donnent un autre éclairage sur les engagements de sécurité.'},
      {chemin: dossier('ukraine-pret-europeen-90-milliards'), titre: 'L’aide européenne à l’Ukraine : qui finance ?', contexte: 'Lire les engagements européens en distinguant prêt, versements et intérêts.'},
    ],
  },
  'la-depense-publique-baisse-2024': {
    titreRecherche: 'Dépense publique en France : montant et part du PIB',
    liens: [
      {chemin: '/bilan/', titre: 'Explorer le budget et la dette publique', contexte: 'Retrouver les recettes, les dépenses et les comparaisons dans la page France.'},
      {chemin: dossier('retraites-premier-poste-2024'), titre: 'Le poids des retraites dans les finances publiques', contexte: 'Un exemple concret de poste de dépense, avec sa définition et ses limites.'},
    ],
  },
  'prix-gaz-menages-2022-2025': {
    titreRecherche: 'Prix du gaz en France : hausse entre 2022 et 2025',
    liens: [
      {chemin: question('hausse-prix-gaz'), titre: 'De combien le prix du gaz a-t-il augmenté ?', contexte: 'Une réponse courte sur la période comparée et la catégorie de ménages étudiée.'},
      {chemin: dossier('electricite-exportee-facture-francais'), titre: 'Comprendre les composantes d’une facture d’électricité', contexte: 'Comparer la manière dont énergie, réseaux et prélèvements composent un prix de détail.'},
    ],
  },
  'retraites-premier-poste-2024': {
    titreRecherche: 'Retraites en France : dépenses et financement',
    liens: [
      {chemin: dossier('la-depense-publique-baisse-2024'), titre: 'La dépense publique en euros et en part du PIB', contexte: 'Situer les prestations de vieillesse dans un ensemble plus large.'},
      {chemin: dossier('cout-travail-cent-euros-net-2025'), titre: 'Les cotisations dans le coût du travail', contexte: 'Comprendre un canal de financement de la protection sociale à partir d’un profil OCDE.'},
    ],
  },
  'satisfaction-vie-france-2010-2024': {
    titreRecherche: 'Satisfaction de vie en France : évolution et écarts',
    liens: [
      {chemin: question('qualite-vie-france'), titre: 'La qualité de vie baisse-t-elle en France ?', contexte: 'Distinguer la satisfaction déclarée d’une appréciation de toute la qualité de vie.'},
      {chemin: dossier('age-achat-residence-principale'), titre: 'L’accès à la propriété selon les générations', contexte: 'Le logement et les revenus sont aussi des dimensions concrètes du quotidien.'},
    ],
  },
  'ukraine-pret-europeen-90-milliards': {
    titreRecherche: 'Prêt de 90 milliards à l’Ukraine : qui paie ?',
    liens: [
      {chemin: dossier('defense-europe-depenses-2024'), titre: 'La progression des dépenses de défense européennes', contexte: 'Situer le soutien à l’Ukraine dans les enjeux de sécurité du continent.'},
      {chemin: dossier('defense-credits-votes-consommes-2025'), titre: 'Les crédits de défense consommés en France', contexte: 'Distinguer un budget national d’un financement au niveau de l’Union européenne.'},
    ],
  },
};

export const TITRES_QUESTIONS: Readonly<Record<string, string>> = {
  'age-premier-achat-residence-principale': 'Âge du premier achat immobilier : les repères Insee',
  'arenh-42-euros-etranger': 'ARENH à 42 €/MWh : fournisseurs ou exportations ?',
  'electricite-vendue-moins-chere-etranger': 'Électricité exportée : moins chère que la facture ?',
  'hausse-prix-gaz': 'Hausse du prix du gaz : comparaison 2022 et 2025',
  'prix-fournitures-scolaires': 'Prix des fournitures scolaires : quelle hausse ?',
  'qualite-vie-france': 'Qualité de vie en France : que montrent les chiffres ?',
};

/** Un lien absent de la publication bloque le build, au lieu de créer une impasse. */
export function validerMaillageEditorial(slugs: readonly string[], questions: readonly string[]): void {
  const adresses = new Set(['/bilan/', '/salaires/', ...slugs.map(dossier), ...questions.map(question)]);
  for (const slug of slugs) {
    const profil = SEO_DOSSIERS[slug];
    if (!profil) throw new Error(`Intention éditoriale absente : ${slug}`);
    const rencontres = new Set<string>();
    for (const lien of profil.liens) {
      if (!adresses.has(lien.chemin) || lien.chemin === dossier(slug) || rencontres.has(lien.chemin)) {
        throw new Error(`Lien éditorial invalide : ${slug} vers ${lien.chemin}`);
      }
      rencontres.add(lien.chemin);
    }
  }
}
