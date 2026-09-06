import { longDossiers, campaignCost } from './campaign-content.ts';
import { NATIONAL_COPY } from './novice-national.ts';
import type { Choice, Dossier, Effect } from './types.ts';

/** National rules v5. Amounts are synthetic annual Md€, never official yields.
 * Each saving concerns a distinct part of the inherited operating budget.
 * It cannot cancel an unchosen project or the scheduled expiry of temporary aid.
 * v3/v4 content remains frozen for deterministic save and challenge replay. */
type Policy = { title: string; description: string; sacrifice: string; effect: Effect; delayed?: Choice['delayed'] };
const saving = (title: string, description: string, amount: number, sacrifice: string, effect: Effect): Policy =>
  ({ title, description, sacrifice, effect: { ...effect, operating: -amount } });

// One distinct expenditure lever for each of the 45 dossiers, in campaign order.
const savings: readonly Policy[] = [
  saving('Réduire les campagnes de communication', 'Diminuer les achats d’espace publicitaire des administrations centrales.', 1, 'Les informations publiques atteignent moins de personnes.', { services: -1 }),
  saving('Plafonner le recours aux cabinets de conseil', 'Réduire les missions externes et recentrer les équipes sur les dossiers prioritaires.', 2, 'Certains projets prennent du retard faute de renfort spécialisé.', { assets: -1, trust: -1 }),
  saving('Regrouper les guichets les moins fréquentés', 'Fermer certains petits points d’accueil en transférant leurs dossiers aux guichets voisins.', 1, 'Les habitants concernés doivent aller plus loin pour leurs démarches.', { services: -2, cohesion: -1, area: 'rural' }),
  saving('Acheter moins cher les fournitures hospitalières', 'Standardiser les consommables et regrouper les commandes des établissements.', 2, 'Les soignants ont moins de choix de matériel et dépendent de moins de fournisseurs.', { resilience: -1 }),
  saving('Regrouper les options scolaires peu suivies', 'Réunir certaines options dans moins d’établissements pour réduire les heures financées.', 2, 'Certains élèves perdent une option de proximité ou doivent changer d’établissement.', { services: -2, cohesion: -1 }),
  saving('Chauffer moins les locaux administratifs', 'Réduire les températures et les plages de chauffage dans les bureaux publics.', 1, 'Les agents et les usagers acceptent un confort moindre.', { services: -1 }),
  saving('Réduire les études de projets non engagés', 'Couper une partie du budget récurrent consacré à préparer de nouveaux grands ouvrages.', 1, 'Les futurs chantiers seront moins prêts. Les travaux déjà signés continuent.', { assets: -1 }),
  saving('Remplacer moins de véhicules de fonction', 'Allonger la durée d’usage des véhicules et réduire les locations administratives.', 1, 'Les déplacements des équipes deviennent moins souples.', { services: -1 }),
  saving('Réduire les subventions aux événements', 'Diminuer les aides récurrentes aux salons et manifestations de représentation.', 1, 'Des organisateurs réduisent leurs événements et contestent le choix.', { trust: -1 }),
  saving('Limiter les envois fiscaux sur papier', 'Réserver les courriers aux usagers qui en ont besoin et réduire les autres impressions.', .5, 'Certains contribuables doivent consulter leurs documents en ligne.', { services: -1 }),
  saving('Ne pas remplacer certains départs administratifs', 'Supprimer des postes vacants sur les fonctions de soutien, avec moins de recrutements.', 2, 'Les dossiers non urgents prennent davantage de temps.', { services: -2 }),
  saving('Quitter des bureaux publics loués', 'Regrouper les équipes dans le parc occupé et réduire les loyers du budget hérité.', 1, 'Les espaces de travail sont plus serrés et certains services moins proches.', { services: -1 }),
  saving('Réduire les aides aux raccordements peu utilisés', 'Diminuer les subventions courantes aux usages électriques à faible fréquentation.', 1, 'Les usagers concernés paient davantage ou renoncent au raccordement.', { resilience: -1, trust: -1 }),
  saving('Retirer les aides sans contrepartie industrielle', 'Supprimer une partie des subventions de fonctionnement aux PME non conditionnées à un investissement.', 2, 'Les entreprises concernées perdent un soutien et peuvent réduire leur activité.', { cohesion: -1, area: 'industrie' }),
  saving('Arrêter de financer les formations peu suivies', 'Fermer des sessions sous-remplies et concentrer les financements sur les autres parcours.', 1, 'Certains candidats doivent attendre une session ou se déplacer.', { services: -1, cohesion: -1 }),
  saving('Réserver davantage les aides au logement', 'Abaisser le plafond de ressources d’une partie des aides déjà inscrites au budget.', 2, 'Des ménages proches du plafond perdent une aide pour payer leur logement.', { cohesion: -2, area: 'metropoles' }),
  saving('Réduire les aides aux territoires les mieux dotés', 'Réduire les prestations financées par une enveloppe de péréquation dans les territoires les mieux dotés.', 1, 'Les collectivités qui perdent cette aide réduisent certaines prestations.', { services: -1, trust: -1 }),
  saving('Réduire les subventions aux grandes entreprises', 'Plafonner une enveloppe d’aides générales aux entreprises au-dessus d’une taille donnée.', 3, 'Les entreprises concernées ont moins de moyens pour leurs projets.', { trust: -2, area: 'industrie' }),
  saving('Durcir les conditions des aides à l’emploi', 'Réduire une enveloppe récurrente pour les employeurs qui ne maintiennent pas les postes.', 2, 'Moins d’employeurs sont aidés pendant le ralentissement.', { cohesion: -2 }),
  saving('Réserver certaines prestations aux plus modestes', 'Réduire la couverture d’une prestation héritée pour les ménages aux revenus intermédiaires.', 2, 'Ces ménages perdent une protection en pleine crise.', { cohesion: -2, trust: -1 }),
  saving('Réduire les aides aux usages fossiles', 'Supprimer une partie des subventions courantes à la consommation de combustibles.', 2, 'Les usagers sans solution de remplacement absorbent une facture plus lourde.', { cohesion: -2, area: 'industrie' }),
  saving('Réduire les horaires des accueils peu fréquentés', 'Fermer des créneaux sur les services à faible affluence et diminuer les renforts correspondants.', 1, 'Les usagers disposent de moins de créneaux pour leurs démarches.', { services: -2 }),
  saving('Baisser les aides aux opérateurs culturels', 'Réduire une part des subventions annuelles aux structures culturelles du scénario.', 1, 'Des spectacles et activités disparaissent ou deviennent plus chers.', { services: -1, cohesion: -1 }),
  saving('Réduire le nombre de dépôts logistiques', 'Regrouper les stocks dans moins de sites pour diminuer leurs frais récurrents.', 1, 'Une panne sur un dépôt touche davantage de livraisons.', { resilience: -2 }),
  saving('Cibler les aides à la prévention littorale', 'Réserver les subventions de fonctionnement aux zones les plus exposées du scénario.', 1, 'Les zones moins prioritaires disposent de moins de préparation.', { resilience: -1, area: 'littoraux' }),
  saving('Réduire les dépenses de représentation', 'Couper les budgets de réceptions et de déplacements protocolaires.', .5, 'Les institutions organisent moins de rencontres avec leurs partenaires.', { trust: -1 }),
  saving('Réduire les aides sectorielles de fonctionnement', 'Retirer une partie des subventions héritées aux secteurs qui ont repris leur activité.', 2, 'Certaines entreprises encore fragiles perdent ce soutien.', { cohesion: -1, trust: -1 }),
  saving('Mutualiser la maintenance des équipements', 'Passer à des contrats communs pour les installations existantes du budget de départ.', 1, 'Les interventions deviennent moins personnalisées et parfois plus lentes.', { services: -1 }),
  saving('Supprimer des niveaux de validation interne', 'Retirer des contrôles administratifs redondants et les moyens dédiés à ces tâches.', 2, 'Moins de relectures internes peuvent laisser passer des erreurs.', { trust: -1 }),
  saving('Réduire les achats de logiciels redondants', 'Résilier des licences faisant double emploi dans les fonctions centrales.', 1, 'Les agents concernés doivent changer leurs habitudes et perdre certaines fonctions.', { services: -1 }),
  saving('Limiter les remboursements de frais professionnels', 'Abaisser les plafonds de déplacement et d’hébergement des agents.', 1, 'Les agents renoncent à certaines missions ou voyagent dans de moins bonnes conditions.', { services: -1 }),
  saving('Réduire les tournées administratives peu utilisées', 'Supprimer certaines tournées mobiles du réseau hérité, sans annuler les guichets déjà financés.', 1, 'Des villages reçoivent moins souvent une équipe publique.', { services: -1, cohesion: -1, area: 'rural' }),
  saving('Espacer l’entretien des installations secondaires', 'Allonger les cycles de maintenance des ouvrages non prioritaires du parc hérité.', 2, 'L’usure s’accumule et les pannes futures deviennent plus difficiles à éviter.', { assets: -2, resilience: -1 }),
  saving('Réduire les crédits des programmes de recherche', 'Arrêter une partie des financements récurrents aux programmes exploratoires hérités.', 2, 'Des équipes interrompent leurs travaux, sans savoir quelles découvertes sont perdues.', { resilience: -2 }),
  saving('Plafonner davantage les pensions les plus élevées', 'Réduire la dépense annuelle sur les pensions au-dessus d’un seuil dans ce scénario.', 3, 'Les retraités concernés perdent du revenu et contestent la mesure.', { cohesion: -1, trust: -2 }),
  saving('Réduire les missions de préparation de futurs travaux', 'Diminuer le budget des missions foncières sur les programmes encore non engagés.', 1, 'Les prochains projets auront moins de terrains et de diagnostics prêts.', { assets: -1 }),
  saving('Resserrer l’accès aux aides d’action sociale', 'Abaisser le plafond d’une enveloppe permanente distincte des aides temporaires du mandat.', 1, 'Des ménages jusque-là éligibles perdent ce soutien.', { cohesion: -2 }),
  saving('Réduire les rapports de suivi externalisés', 'Supprimer des prestations de reporting répétitives sur les programmes publics.', .5, 'Le prochain gouvernement dispose de moins d’évaluations indépendantes.', { trust: -1 }),
  saving('Regrouper les centres d’appel publics', 'Réunir plusieurs plateformes téléphoniques et réduire leurs frais de fonctionnement.', 1, 'Les réponses sont moins spécialisées et les délais peuvent s’allonger.', { services: -2 }),
  saving('Fermer des équipements publics peu utilisés', 'Retirer du service une partie du parc secondaire pour supprimer ses frais de fonctionnement.', 2, 'Les usagers perdent ces équipements et doivent en rejoindre d’autres.', { services: -2, assets: -1 }),
  saving('Espacer les exercices de préparation aux crises', 'Réduire la fréquence des entraînements financés dans le budget hérité.', .5, 'Les équipes sont moins entraînées lorsque la crise survient.', { resilience: -2 }),
  saving('Réduire les subventions de promotion touristique', 'Plafonner une enveloppe de promotion déjà financée dans le scénario consolidé.', 1, 'Les destinations aidées disposent de moins de visibilité.', { trust: -1 }),
  saving('Réduire les dotations de fonctionnement des agences', 'Diminuer une enveloppe de fonctionnement des opérateurs hors postes déjà révisés.', 2, 'Les agences réduisent une partie de leurs interventions.', { services: -2 }),
  saving('Réduire la location de matériel peu utilisé', 'Restituer des équipements loués du parc existant, sans annuler les chantiers signés.', 1, 'Les équipes doivent davantage partager le matériel disponible.', { services: -1 }),
  saving('Réduire les aides aux associations non prioritaires', 'Concentrer une enveloppe annuelle sur moins d’associations bénéficiaires.', 1, 'Certaines activités locales cessent faute de subvention.', { cohesion: -2 }),
];

// Tax measures change different bases and affected groups, not just their titles.
// Fixed yields are scenario parameters; no claim about current law or behavioural forecasts.
const tax = (title: string, description: string, revenue: number, sacrifice: string, effect: Effect = {}): Policy =>
  ({ title, description, sacrifice, effect: { revenue, ...effect } });
const fiscal: Record<number, { title: string; story: string; choices: Record<number, Policy> }> = {
  1: { title: 'Faut-il revoir les avantages fiscaux ?', story: 'Réduire des niches apporte des recettes ; baisser l’impôt sur les bas revenus leur laisse plus d’argent. Vous pouvez aussi économiser sur la communication publique.', choices: {
    0: tax('Plafonner les niches fiscales des hauts revenus', 'Limiter le cumul de réductions d’impôt au-dessus d’un revenu élevé.', 4, 'Les ménages concernés paient plus d’impôt et peuvent réduire les dépenses aidées.', { trust: -2 }),
    1: tax('Baisser l’impôt sur les premiers revenus imposables', 'Alléger les premières tranches du barème dans le scénario.', -3, 'Les foyers non imposables ne bénéficient pas de la baisse et le déficit augmente.', { trust: 2, cohesion: 1 }),
  } },
  8: { title: 'Faut-il davantage taxer les grandes fortunes ?', story: 'Une contribution sur les patrimoines élevés limite l’emprunt mais touche un groupe précis. Réduire le parc automobile administratif offre un autre effort.', choices: {
    0: tax('Créer une contribution sur les très grands patrimoines', 'Appliquer un prélèvement annuel au patrimoine net au-dessus d’un seuil élevé.', 3, 'Les contribuables concernés doivent mobiliser de la trésorerie ; certains réorganisent leurs avoirs.', { trust: -2 }),
  } },
  10: { title: 'Contrôler la fraude ou simplifier la fiscalité ?', story: 'Le contrôle demande des agents avant de rapporter. Supprimer une petite taxe simplifie les démarches mais réduit les recettes ; moins de courrier réduit une dépense.', choices: {
    0: { title: 'Renforcer le contrôle de la fraude fiscale', description: 'Financer des équipes de contrôle avant de récupérer des recettes dans le scénario.', sacrifice: 'Les contrôles coûtent dès cette année. Les recouvrements prennent du temps et leur rendement réel est incertain.', effect: { operating: .5, trust: -1 }, delayed: { after: 1, label: 'Les équipes de contrôle atteignent le rendement fiscal hypothétique prévu par le scénario.', effect: { revenue: 2 } } },
    1: tax('Supprimer des petites taxes coûteuses à gérer', 'Retirer des prélèvements à faible rendement et leurs coûts de gestion dédiés.', -.8, 'Les recettes perdues dépassent les frais de gestion évités dans le scénario.', { operating: -.2, trust: 1 }),
  } },
  18: { title: 'Quel effort demander aux entreprises ?', story: 'Vous pouvez réduire des subventions, limiter un crédit d’impôt ou garder le programme. Réduire une dépense et supprimer un avantage fiscal ne touchent pas le même budget.', choices: {
    1: tax('Plafonner le crédit d’impôt recherche des grands groupes', 'Limiter le soutien fiscal au-delà d’un volume de dépenses de recherche.', 2, 'Les groupes concernés reçoivent moins de soutien pour leur recherche.', { resilience: -1, trust: -1 }),
  } },
  23: { title: 'Faut-il changer la TVA pendant le ralentissement ?', story: 'La TVA touche les achats. Une hausse sur certains biens rapporte ; une baisse sur les produits essentiels coûte, sans garantir sa répercussion dans les prix.', choices: {
    0: tax('Relever la TVA sur certains achats de luxe', 'Augmenter le prélèvement sur un panier de biens haut de gamme défini dans le scénario.', 2, 'Les acheteurs concernés paient davantage et l’activité de ces commerces peut reculer.', { trust: -1 }),
    2: tax('Baisser la TVA sur les produits essentiels', 'Réduire le prélèvement sur un panier de première nécessité.', -3, 'Le déficit augmente et les commerçants peuvent conserver une partie de la baisse.', { cohesion: 1, trust: 1 }),
  } },
  26: { title: 'Comment répartir le financement de la crise ?', story: 'Une taxe temporaire sur les profits exceptionnels peut aider pendant la crise. Son extinction laisse ensuite le budget sans cette recette ; réduire la représentation crée une économie durable.', choices: {
    1: { ...tax('Taxer les bénéfices exceptionnels pendant un an', 'Prélever une contribution limitée aux profits dépassant un niveau de référence.', 3, 'Les entreprises concernées ont moins de trésorerie. La recette disparaît l’année suivante.', { trust: -1 }), delayed: { after: 1, label: 'La contribution temporaire sur les bénéfices exceptionnels prend fin.', effect: { revenue: -3 } } },
  } },
  30: { title: 'Faut-il taxer davantage les grandes successions ?', story: 'L’effort peut porter sur les transmissions de patrimoine plutôt que sur tous les revenus. Une économie sur les logiciels réduit une autre composante du déficit.', choices: {
    0: tax('Relever les droits sur les très grandes successions', 'Augmenter le prélèvement au-delà d’un seuil élevé de patrimoine transmis.', 2, 'Les héritiers concernés reçoivent moins et peuvent devoir vendre des actifs.', { trust: -2 }),
  } },
  31: { title: 'Faut-il faire payer davantage les émissions ?', story: 'Une contribution sur les émissions industrielles apporte des recettes et renchérit les activités concernées. Réduire les frais de déplacement constitue un autre arbitrage.', choices: {
    1: tax('Taxer davantage les émissions industrielles', 'Ajouter une contribution aux émissions d’un périmètre industriel défini dans le scénario.', 2, 'Les entreprises peuvent reporter le coût sur leurs prix ; la transition n’est pas immédiate.', { trust: -1, cohesion: -1, area: 'industrie' }),
  } },
  35: { title: 'Comment financer les retraites et la protection sociale ?', story: 'Renforcer les aides, prélever davantage sur les revenus du capital ou limiter les plus grosses pensions répartit différemment l’effort entre ménages.', choices: {
    1: tax('Augmenter la contribution sociale sur le capital', 'Relever le prélèvement social sur les dividendes et intérêts du scénario.', 2, 'Les épargnants concernés conservent moins de revenus de leurs placements.', { trust: -1 }),
  } },
  42: { title: 'Faut-il alléger le travail ou taxer les transactions ?', story: 'La fiscalité peut cibler les transactions financières ou réduire le coût des bas salaires. Ces deux leviers ne financent pas la même trajectoire.', choices: {
    0: tax('Élargir la taxe sur les transactions financières', 'Soumettre davantage d’achats de titres à un prélèvement dans le scénario.', 2, 'Les transactions coûtent plus cher et certaines peuvent se déplacer ailleurs.', { trust: -1 }),
    1: tax('Baisser les cotisations sur les bas salaires', 'Réduire les cotisations employeur sur les rémunérations les plus faibles.', -2, 'Le budget social perd des recettes sans garantie de nouvelles embauches.', { trust: 1 }),
  } },
  43: { title: 'Quel effort pour limiter les prochains emprunts ?', story: 'Une taxe sur les transports aériens les plus émetteurs ajoute une recette ciblée. Réduire les dotations des agences agit sur la dépense et leurs interventions.', choices: {
    1: tax('Relever la taxe sur les vols les plus émetteurs', 'Augmenter le prélèvement sur les vols privés et une catégorie de vols long-courriers.', 1, 'Les passagers concernés paient plus cher et certains transporteurs perdent de l’activité.', { trust: -1 }),
  } },
  45: { title: 'Quel dernier arbitrage transmettre ?', story: 'Vous pouvez renforcer l’aide, taxer certaines boissons ou réduire des subventions associatives. Ce dernier choix prolonge les conséquences des quarante-quatre précédents.', choices: {
    1: tax('Augmenter la taxe sur les boissons très sucrées', 'Relever le prélèvement selon la teneur en sucre dans le scénario.', 1, 'Ces boissons coûtent plus cher ; aucun gain de santé immédiat n’est garanti.', { trust: -1 }),
  } },
};

function applyPolicy(original: Choice, policy: Policy): Choice {
  const result: Choice = { id: original.id, ...policy, effect: { ...policy.effect }, benefit: (policy.effect.operating ?? 0) < 0 && (policy.effect.revenue ?? 0) >= 0 ? 'Dépense annuelle réduite' : (policy.effect.revenue ?? 0) > 0 ? 'Recettes accrues' : policy.delayed ? 'Effet différé' : 'Prélèvements réduits', cost: '' };
  result.cost = campaignCost(result.effect, result.delayed, 'Md€');
  return result;
}

export function nationalPolicyDossiers(): Dossier[] {
  return longDossiers('national').map((dossier, index) => {
    const copy = NATIONAL_COPY[index];
    const choices = dossier.choices.map((c, rank) => ({ ...c, title: copy[2][rank], sacrifice: copy[3][rank] }));
    // Replace an existing cut if present, otherwise replace the passive third card.
    const cut = choices.findIndex(c => (c.effect.operating ?? 0) < 0);
    const rank = cut < 0 ? 2 : cut;
    choices[rank] = applyPolicy(choices[rank], savings[index]);
    const taxDossier = fiscal[index + 1];
    for (const [slot, policy] of Object.entries(taxDossier?.choices ?? {})) choices[Number(slot)] = applyPolicy(choices[Number(slot)], policy);
    return { ...dossier, title: taxDossier?.title ?? copy[0], story: taxDossier?.story ?? copy[1], advisor: `${dossier.advisor} Montants et effets hypothétiques de jeu ; aucune économie gratuite ni rendement fiscal officiel.`, choices };
  });
}
