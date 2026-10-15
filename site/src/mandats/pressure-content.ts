import type { NarrativeChoice, NarrativeEvent, NarrativeFamily } from './narrative-types.ts';
import type { PressureChoice, PressureSectorId } from './pressure-types.ts';
import type { Choice, Game } from './types.ts';
import { campaignCost } from './campaign-content.ts';

/** All envelopes, productivity and workload units below are simulation assumptions.
 * They describe national programmes, never observed local budgets or head counts.
 * One period is one of the six decisions of a year. Reading spends no period.
 */
export const PRESSURE_ASSUMPTION_NOTE = 'Enveloppes nationales et unités de besoin : hypothèses de simulation. Une période représente deux mois.';

export type PressureDossierContent = {
  family: NarrativeFamily;
  calmTitle: string;
  strainTitle: string;
  crisisTitle: string;
  problem: string;
  consequence: string;
  relief: { title: string; description: string; operating: number; capacity: number; sacrifice: string };
  programme: { title: string; description: string; investment: number; operating: number; capacity: number; delay: number; sacrifice: string };
  delegate: { title: string; description: string; operating: number; capacity: number; sacrifice: string };
};

export const PRESSURE_DOSSIERS: Record<PressureSectorId, PressureDossierContent> = {
  health: {
    family: { id: 'pression-sante', title: 'Accès aux soins', category: 'Santé', summary: 'Demandes de soins, équipes disponibles et retards accumulés.', art: 'hospital', urgency: 'Suivre les délais de soins' },
    calmTitle: 'Dégager une marge dans les soins', strainTitle: 'Les soins en attente s’accumulent', crisisTitle: 'Les équipes de soins ne rattrapent plus les retards',
    problem: 'Les nouvelles demandes arrivent pendant que les équipes traitent les patients déjà en attente. Un budget voté ne remplace pas les personnels absents.',
    consequence: 'Si la file continue de grossir, la surcharge fatigue les équipes et réduit les soins réellement assurés. Le manque de logements et les perturbations de transport peuvent compliquer les recrutements.',
    relief: { title: 'Mobiliser un renfort de soins temporaire', description: 'Contracter des vacations et organiser les sorties accompagnées pendant deux périodes.', operating: 0.48, capacity: 3.2, sacrifice: 'Le renfort s’arrête après quatre mois ; la capacité durable reste à construire.' },
    programme: { title: 'Recruter et former des équipes de soins', description: 'Financer les postes, le tutorat et les relais de soins à domicile. La montée en charge attend les recrutements et la capacité de mise en œuvre.', investment: 1.4, operating: 3.2, capacity: 1.8, delay: 3, sacrifice: 'Les recrutements prennent au moins six mois et les salaires reviennent chaque année.' },
    delegate: { title: 'Conventionner avec les équipes de proximité', description: 'Confier une partie des suivis à des équipes partenaires, avec un financement et des critères publics.', operating: 0.22, capacity: 1.35, sacrifice: 'Le relais reste limité et certains patients se déplacent davantage.' },
  },
  housing: {
    family: { id: 'pression-logement', title: 'Accès au logement', category: 'Logement', summary: 'Demandes non satisfaites et logements mobilisables.', art: 'housing', urgency: 'Suivre les attributions' },
    calmTitle: 'Préparer les prochaines attributions de logements', strainTitle: 'Les demandes de logement restent sans solution', crisisTitle: 'L’hébergement d’urgence ne suffit plus',
    problem: 'Les demandes s’ajoutent aux ménages déjà en attente. Les places temporaires protègent les urgences mais ne créent pas toutes un logement durable.',
    consequence: 'Une attente prolongée complique les prises de poste et augmente la pression sur les services. Les programmes de rénovation n’aident qu’après la remise en usage des logements.',
    relief: { title: 'Réserver des logements relais pour quatre mois', description: 'Conventionner des places temporaires pour les ménages prioritaires pendant deux périodes.', operating: 0.36, capacity: 2.8, sacrifice: 'Les places sont temporaires et l’accompagnement doit préparer une sortie.' },
    programme: { title: 'Remettre des logements vacants en usage', description: 'Financer les travaux par étapes, contre un calendrier d’attribution et des loyers publiés.', investment: 6.8, operating: 0.38, capacity: 1.9, delay: 3, sacrifice: 'Les ménages attendent les travaux ; le contrôle et la gestion restent financés.' },
    delegate: { title: 'Conventionner les attributions avec les bailleurs', description: 'Financer une équipe commune pour mobiliser les logements disponibles et accompagner les entrées.', operating: 0.16, capacity: 1.2, sacrifice: 'La convention facilite les attributions mais ne crée pas de nouveaux bâtiments.' },
  },
  transport: {
    family: { id: 'pression-transports', title: 'Transports et approvisionnements', category: 'Mobilité', summary: 'Services interrompus, maintenance et capacité des réseaux.', art: 'industry', urgency: 'Suivre les interruptions' },
    calmTitle: 'Entretenir les réseaux avant les interruptions', strainTitle: 'Les interruptions de transport s’accumulent', crisisTitle: 'Les perturbations touchent les services essentiels',
    problem: 'Les réparations différées réduisent la fiabilité des trajets et des livraisons. Réorienter un flux aide à passer un cap sans réparer le réseau.',
    consequence: 'Des perturbations durables compliquent les trajets des personnels de soins et des élèves, ainsi que les approvisionnements. Les équipes d’entretien ont elles aussi une capacité limitée.',
    relief: { title: 'Organiser des services de remplacement', description: 'Contracter des rotations et des itinéraires de secours pendant deux périodes.', operating: 0.3, capacity: 2.7, sacrifice: 'Les trajets sont plus longs et les marchés temporaires prennent fin après quatre mois.' },
    programme: { title: 'Rattraper la maintenance des réseaux', description: 'Programmer les chantiers prioritaires et former les équipes d’entretien avant de rétablir la capacité.', investment: 8.4, operating: 0.65, capacity: 1.8, delay: 3, sacrifice: 'Les chantiers mobilisent des équipes pendant au moins six mois.' },
    delegate: { title: 'Coordonner les dessertes avec les territoires', description: 'Financer une coordination des horaires et des itinéraires existants avec les autorités organisatrices.', operating: 0.14, capacity: 1.2, sacrifice: 'Le ciblage privilégie les trajets essentiels ; certains horaires restent réduits.' },
  },
  energy: {
    family: { id: 'pression-energie', title: 'Eau et énergie', category: 'Réseaux', summary: 'Maintenance des réseaux, besoins essentiels et résilience.', art: 'energy', urgency: 'Suivre les réseaux essentiels' },
    calmTitle: 'Sécuriser les réseaux d’eau et d’énergie', strainTitle: 'Les interventions sur les réseaux prennent du retard', crisisTitle: 'Les réseaux ne couvrent plus les besoins essentiels',
    problem: 'Les travaux attendent pendant que les équipements vieillissent. Un renfort de distribution soulage les usages sans résorber les défauts du réseau.',
    consequence: 'Les interruptions des réseaux compliquent le fonctionnement des établissements de soins et des transports. Les réparations ont besoin d’équipes et d’un gouvernement en fonction.',
    relief: { title: 'Prépositionner des moyens de distribution', description: 'Louer des moyens mobiles et des réserves d’urgence pendant deux périodes.', operating: 0.26, capacity: 3, sacrifice: 'La solution consomme des moyens temporaires et ne répare pas les réseaux.' },
    programme: { title: 'Réparer les points faibles des réseaux', description: 'Financer les réparations vérifiées et les équipes de maintenance sur les tronçons prioritaires.', investment: 4.6, operating: 0.42, capacity: 2.2, delay: 2, sacrifice: 'Les ouvrages restent fragiles pendant au moins quatre mois de travaux.' },
    delegate: { title: 'Organiser les usages avec les opérateurs', description: 'Financer un suivi partagé et réserver les capacités disponibles aux usages essentiels.', operating: 0.1, capacity: 1.15, sacrifice: 'Les restrictions ciblées limitent encore certains usages économiques.' },
  },
  education: {
    family: { id: 'pression-enseignement', title: 'Continuité des enseignements', category: 'Enseignement', summary: 'Cours non assurés, remplacements et conditions d’accueil.', art: 'school', urgency: 'Suivre les enseignements manquants' },
    calmTitle: 'Préparer les remplacements avant la rentrée', strainTitle: 'Les cours non assurés s’accumulent', crisisTitle: 'La continuité des enseignements est compromise',
    problem: 'Les remplacements et les salles disponibles déterminent les enseignements réellement assurés. Les heures manquées restent à rattraper.',
    consequence: 'Des absences durables augmentent la charge des équipes et perturbent les familles. Les difficultés de transport peuvent éloigner certains élèves des solutions disponibles.',
    relief: { title: 'Mobiliser un vivier de remplaçants', description: 'Financer des remplacements ciblés et du soutien au rattrapage pendant deux périodes.', operating: 0.34, capacity: 2.9, sacrifice: 'Le vivier est temporaire et ne règle pas les départs à venir.' },
    programme: { title: 'Former et affecter des enseignants supplémentaires', description: 'Ouvrir les postes, le tutorat et les moyens d’accueil pour une capacité durable.', investment: 0.85, operating: 2.4, capacity: 1.7, delay: 3, sacrifice: 'La formation et les affectations demandent au moins six mois.' },
    delegate: { title: 'Mutualiser les remplacements entre établissements', description: 'Financer un calendrier partagé et les déplacements des remplaçants disponibles.', operating: 0.12, capacity: 1.25, sacrifice: 'La mutualisation réduit certaines possibilités de remplacement simultané.' },
  },
  administration: {
    family: { id: 'pression-demarches', title: 'Démarches et capacité d’exécution', category: 'Services publics', summary: 'Demandes en attente, équipes et capacité de réalisation des programmes.', art: 'office', urgency: 'Suivre les délais des démarches' },
    calmTitle: 'Garder une marge pour les démarches et les projets', strainTitle: 'Les dossiers administratifs prennent du retard', crisisTitle: 'Les retards freinent aussi les programmes financés',
    problem: 'Les mêmes équipes instruisent les demandes, contrôlent les marchés et préparent les programmes. Le financement seul ne fait pas avancer tous les chantiers en même temps.',
    consequence: 'Une file trop importante ralentit l’exécution des programmes des autres secteurs. Multiplier les projets sans équipes disponibles allonge les délais.',
    relief: { title: 'Affecter une équipe temporaire aux dossiers urgents', description: 'Contracter un renfort formé aux demandes prioritaires pendant deux périodes.', operating: 0.24, capacity: 3.1, sacrifice: 'Le renfort se termine après quatre mois ; les demandes complexes restent encadrées.' },
    programme: { title: 'Former et renforcer les équipes d’instruction', description: 'Financer les postes, la formation et des procédures partagées en conservant le contrôle des décisions sensibles.', investment: 0.75, operating: 1.8, capacity: 1.9, delay: 2, sacrifice: 'La formation mobilise du temps avant de dégager une capacité durable.' },
    delegate: { title: 'Conventionner avec les guichets territoriaux', description: 'Financer l’accueil et l’instruction des démarches simples avec des partenaires publics identifiés.', operating: 0.18, capacity: 1.3, sacrifice: 'Le ministère conserve les dossiers complexes et le contrôle des décisions.' },
  },
};

export const PRESSURE_FAMILIES = Object.values(PRESSURE_DOSSIERS).map(item => item.family);

/** Opportunities may lapse without a generic trust/cohesion penalty.
 * Structural needs in these sectors still evolve through the pressure engine.
 */
export const PRESSURE_OPPORTUNITY_EVENT_IDS = ['science-stockage', 'industrie-commandes-locales', 'ia-usine', 'ia-services'] as const;
export function isPressureOpportunity(event: Pick<NarrativeEvent, 'id' | 'familyId'>): boolean {
  return event.familyId === 'occasion-science' || PRESSURE_OPPORTUNITY_EVENT_IDS.some(id => id === event.id);
}

const response = (sector: PressureSectorId, label: string, effect: Omit<PressureChoice, 'sector' | 'label'>): PressureChoice => ({ sector, label, ...effect });

/** Explicit mappings connect existing authored decisions to the persistent world.
 * Unlisted options retain their already-authored financial, social and political
 * effects; a score gain is never silently reinterpreted as a physical capacity.
 */
export const AUTHORED_PRESSURE_EFFECTS: Readonly<Record<string, PressureChoice>> = {
  'soins-garde-nuit/financer-renforts': response('health', 'Renfort des gardes de nuit', { kind: 'relief', capacity: 2.8, duration: 3, fatigue: -8 }),
  'soins-garde-nuit/renover-service': response('health', 'Rénovation du service de soins', { kind: 'programme', capacity: 2.6, delay: 2, implementation: 2 }),
  'soins-garde-nuit/organiser-garde': response('health', 'Gardes mutualisées', { kind: 'delegate', capacity: 1.1, delay: 1, implementation: 1 }),
  'soins-lits-aval/equipe-domicile': response('health', 'Équipe de sortie et soins à domicile', { kind: 'programme', capacity: 2.1, delay: 2, implementation: 1, fatigue: -6 }),
  'soins-lits-aval/places-temporaire': response('health', 'Places de soins de suite', { kind: 'programme', capacity: 2.4, delay: 2, implementation: 2 }),
  'soins-lits-aval/lits-court-sejour': response('health', 'Coordination des transferts', { kind: 'delegate', backlog: -1, capacity: 0.5, implementation: 1 }),
  'soins-desert-medical/antenne-soins': response('health', 'Antenne de consultation', { kind: 'programme', capacity: 2.3, delay: 2, implementation: 2 }),
  'soins-desert-medical/equipe-mobile-soins': response('health', 'Équipe mobile de consultation', { kind: 'programme', capacity: 1.8, delay: 1, implementation: 1 }),
  'soins-desert-medical/teleconsultation-soins': response('health', 'Consultations à distance accompagnées', { kind: 'delegate', capacity: 0.9, delay: 1, implementation: 1 }),
  'energie-bus-usine/bus-soir': response('transport', 'Dessertes du soir financées', { kind: 'programme', capacity: 1.7, delay: 1, implementation: 1 }),
  'energie-bus-usine/horaires-pilote': response('transport', 'Pilote de dessertes tardives', { kind: 'relief', capacity: 1.3, duration: 3 }),
  'energie-menages-captifs/aide-ciblee-renovation': response('energy', 'Rénovation des équipements de chauffage', { kind: 'programme', need: -0.7, delay: 2, implementation: 1 }),
  'energie-menages-captifs/guichet-renovation': response('administration', 'Accompagnement des rénovations', { kind: 'delegate', capacity: 0.6, delay: 1, implementation: 1 }),
  'energie-reseau-partage/raccordement-partage': response('energy', 'Raccordement partagé', { kind: 'programme', capacity: 2.2, delay: 2, implementation: 2 }),
  'energie-reseau-partage/reseau-public-seul': response('energy', 'Renforcement du réseau public', { kind: 'programme', capacity: 2.6, delay: 2, implementation: 2 }),
  'energie-reseau-partage/renoncer-raccordement': response('energy', 'Sobriété des bâtiments publics', { kind: 'programme', need: -1.3, delay: 1, implementation: 1 }),
  'recrutement-postes-vacants/prime-installation': response('administration', 'Aide à l’installation des agents', { kind: 'programme', capacity: 1.2, delay: 2, implementation: 1 }),
  'recrutement-postes-vacants/simplifier-concours': response('administration', 'Procédures de recrutement mutualisées', { kind: 'programme', capacity: 1, delay: 2, implementation: 1 }),
  'recrutement-postes-vacants/reduire-horaires-vacants': response('administration', 'Horaires réduits aux personnels présents', { kind: 'maintain', capacity: -0.8, fatigue: -12 }),
  'integration-diplomes/parcours-reconnaissance': response('health', 'Parcours de reconnaissance des qualifications', { kind: 'programme', capacity: 1.2, delay: 3, implementation: 1 }),
  'integration-diplomes/cours-langue-metier': response('administration', 'Formation en langue professionnelle', { kind: 'programme', capacity: 0.7, delay: 2, implementation: 1 }),
  'integration-diplomes/recrutement-local-seul': response('administration', 'Formation des candidats locaux', { kind: 'programme', capacity: 0.6, delay: 3, implementation: 1 }),
  'integration-logement-travail/residence-mobilite': response('housing', 'Résidence temporaire pour salariés', { kind: 'programme', capacity: 1.6, delay: 2, implementation: 2 }),
  'integration-logement-travail/aide-mobilite-recrues': response('transport', 'Aide temporaire aux trajets des recrues', { kind: 'relief', capacity: 0.8, duration: 3 }),
  'logement-expulsions/mediation-impayes': response('housing', 'Médiation avant expulsion', { kind: 'programme', need: -0.65, delay: 1, implementation: 1 }),
  'logement-expulsions/hebergement-temporaire': response('housing', 'Places relais d’urgence', { kind: 'programme', capacity: 1.4, delay: 1, implementation: 1 }),
  'logement-vacants/remise-en-location': response('housing', 'Remise en usage des logements vacants', { kind: 'programme', capacity: 2.6, delay: 2, implementation: 2 }),
  'logement-vacants/garantie-bailleurs': response('housing', 'Logements remis en location sous garantie', { kind: 'programme', capacity: 1.8, delay: 1, implementation: 2 }),
  'logement-vacants/mediations-bailleurs': response('housing', 'Médiation avec les bailleurs', { kind: 'programme', capacity: 0.7, delay: 2, implementation: 1 }),
  'logement-construction/logements-gare': response('housing', 'Logements à loyers maîtrisés près de la gare', { kind: 'programme', capacity: 3, delay: 3, implementation: 2 }),
  'logement-construction/renover-avant-construire': response('energy', 'Rénovation du parc existant', { kind: 'programme', need: -1.1, delay: 2, implementation: 1 }),
  'education-lycees/preserver': response('education', 'Postes et classes maintenus', { kind: 'programme', capacity: 2.5, delay: 2, implementation: 2 }),
  'education-lycees/regrouper': response('education', 'Postes non remplacés et classes regroupées', { kind: 'maintain', capacity: -2.3, fatigue: 8 }),
  'education-lycees/accompagner': response('education', 'Spécialités mutualisées avec trajets accompagnés', { kind: 'delegate', capacity: -0.5, fatigue: 2 }),
  'eau-equipes/potable': response('energy', 'Distribution prioritaire d’eau potable', { kind: 'programme', capacity: 1.4, delay: 1, implementation: 1 }),
  'eau-equipes/fuite': response('energy', 'Réparation de la fuite du réseau', { kind: 'programme', capacity: 2.6, delay: 2, implementation: 2 }),
  'eau-equipes/prevention': response('energy', 'Protection préventive des infrastructures', { kind: 'programme', need: -0.6, delay: 1, implementation: 1 }),
  'cyber-hopital/isoler': response('health', 'Continuité des soins en mode de secours', { kind: 'delegate', capacity: 0.6, delay: 1, implementation: 1 }),
  'cyber-hopital/restaurer': response('health', 'Restauration des systèmes de soins', { kind: 'programme', capacity: 2.4, delay: 2, implementation: 2 }),
  'cyber-hopital/transferer': response('transport', 'Transports des patients réorientés', { kind: 'programme', capacity: 1.4, delay: 1, implementation: 1 }),
  'port-bloque/accord': response('transport', 'Accord sur les horaires et la sécurité', { kind: 'programme', capacity: 1.9, delay: 1, implementation: 1, fatigue: -8 }),
  'port-bloque/flux': response('transport', 'Flux logistiques alternatifs', { kind: 'delegate', capacity: 1.2, delay: 1, implementation: 1 }),
  'port-bloque/reserves': response('transport', 'Réserves essentielles mobilisées', { kind: 'relief', capacity: 2.2, duration: 2 }),
  'chaleur-ecoles/ombrage': response('education', 'Établissements protégés contre la chaleur', { kind: 'programme', capacity: 2.1, delay: 3, implementation: 2 }),
  'chaleur-ecoles/horaires': response('education', 'Horaires et salles de repli', { kind: 'programme', capacity: 0.9, delay: 1, implementation: 1 }),
  'chaleur-ecoles/renforts': response('education', 'Prévention pendant les fortes chaleurs', { kind: 'programme', capacity: 1.2, delay: 1, implementation: 1 }),
  'logements-vacants/location': response('housing', 'Garanties pour mobiliser le parc existant', { kind: 'programme', capacity: 1.4, delay: 1, implementation: 1 }),
  'logements-vacants/conversion': response('housing', 'Bâtiments convertis en logements', { kind: 'programme', capacity: 3.1, delay: 4, implementation: 2 }),
  'logements-vacants/trajets': response('transport', 'Dessertes des logements et emplois', { kind: 'programme', capacity: 1.4, delay: 1, implementation: 1 }),
  'ia-services/assister': response('administration', 'Assistant aux démarches contrôlé par les agents', { kind: 'programme', capacity: 2, delay: 2, implementation: 2 }),
  'ia-services/simples': response('administration', 'Automatisation des démarches simples avec recours', { kind: 'programme', capacity: 1.5, delay: 2, implementation: 1 }),
  'ia-services/guichets': response('administration', 'Équipes supplémentaires aux guichets', { kind: 'programme', capacity: 2.3, delay: 2, implementation: 2, fatigue: -8 }),
};

export function authoredPressureEffects(g: Game, event: NarrativeEvent, choice: NarrativeChoice): PressureChoice | undefined {
  const socialResponse = choice.social?.response;
  if (event.familyId === 'mobilisations-sociales' && socialResponse) {
    const movement = g.social?.movements.find(item => item.id === socialResponse.movementId);
    // The commitment owns its implementation delay and its real success/failure.
    // A dialogue alone or a redistribution between territories adds no national capacity.
    if (movement?.actor === 'lyceens' && socialResponse.action === 'suspend' && movement.sourceChoice.endsWith('-education-lycees-regrouper')) {
      return response('education', 'Postes rétablis après suspension du regroupement', { kind: 'programme', capacity: 2.3, socialMovementId: movement.id });
    }
    if (movement?.actor === 'agents' && socialResponse.action === 'fund') {
      return response('administration', 'Recrutements dans les services mobilisés', { kind: 'programme', capacity: 1.5, socialMovementId: movement.id });
    }
    if (movement?.actor === 'menages' && choice.id === 'logement' && socialResponse.action === 'fund') {
      return response('housing', 'Prévention des impayés dans les bassins aidés', { kind: 'programme', need: -0.6, socialMovementId: movement.id });
    }
  }
  const mapped = AUTHORED_PRESSURE_EFFECTS[`${event.id}/${choice.id}`];
  if (!mapped) return undefined;
  return { ...mapped, ...(choice.project ? { projectId: choice.project.id } : {}) };
}

/** The older scripts expressed a six-month grant as recurring operating and
 * removed it after one decision. New campaigns use the true finite duration,
 * without altering explicit older campaigns or losing the cost after expiry.
 */
export function authoredPressureChoice(g: Game, event: NarrativeEvent, choice: NarrativeChoice): NarrativeChoice {
  if (g.version < 13) return choice;
  const pressure = choice.pressure ?? authoredPressureEffects(g, event, choice);
  const amendment = choice.amendment?.effect;
  const paidAmendment = amendment && (amendment.operating || amendment.investment || amendment.revenue || amendment.grants || amendment.repayment);
  const cost = paidAmendment ? `${choice.cost} · En plus pour l’amendement : ${campaignCost(amendment, undefined, 'Md€')}` : choice.cost;
  const temporaryTotals: Record<string, number> = {
    'soins-garde-nuit/financer-renforts': 0.4,
    'energie-bus-usine/horaires-pilote': 0.04,
    'integration-logement-travail/aide-mobilite-recrues': 0.06,
  };
  const total = temporaryTotals[`${event.id}/${choice.id}`];
  if (total === undefined) return { ...choice, cost, ...(pressure ? { pressure } : {}) };
  const { operating: _operating, ...effect } = choice.effect;
  return { ...choice, cost, effect: { ...effect, temporaryOperating: total * 2 }, delayed: undefined, pressure };
}

/** These IDs already belong to the national agenda. A financing option that
 * preserves existing means does not also create a new physical capacity. Fiscal
 * and sector consequences share the same recorded adoption/rejection result.
 */
export const POLICY_PRESSURE_EFFECTS: Readonly<Record<string, PressureChoice>> = {
  r01c: response('health', 'Aide à domicile renforcée', { kind: 'programme', need: -0.8, delay: 2, implementation: 1 }),
  r02a: response('administration', 'Réduction des effectifs publics sur deux ans', { kind: 'programme', capacity: -2.1, delay: 12, implementation: 0.25 }),
  r02c: response('administration', 'Postes remplacés et guichets supplémentaires', { kind: 'programme', capacity: 2.2, delay: 2, implementation: 2 }),
  r05a: response('health', 'Fermeture des établissements et accès réduit aux soins', { kind: 'maintain', capacity: -1.4, fatigue: 5 }),
  r05c: response('health', 'Soins de proximité supplémentaires', { kind: 'programme', capacity: 2.1, delay: 2, implementation: 2 }),
  r10a: response('health', 'Fermeture de sites hospitaliers', { kind: 'maintain', capacity: -2.4, fatigue: 7 }),
  r10c: response('health', 'Consultations hospitalières supplémentaires', { kind: 'programme', capacity: 2.6, delay: 2, implementation: 2 }),
  r11a: response('administration', 'Attractivité dégradée après le gel salarial', { kind: 'programme', capacity: -0.6, delay: 3, implementation: 0.25, fatigue: 4 }),
  r11c: response('administration', 'Formation d’agents supplémentaires', { kind: 'programme', capacity: 1.6, delay: 3, implementation: 1 }),
  r13c: response('energy', 'Remplacement des équipements fossiles', { kind: 'programme', need: -1.2, delay: 3, implementation: 2 }),
  r14a: response('housing', 'Demandes urgentes après réduction des aides au logement', { kind: 'maintain', need: 1.4 }),
  r14c: response('housing', 'Remise en location de logements supplémentaires', { kind: 'programme', capacity: 2.4, delay: 3, implementation: 2 }),
  r15a: response('administration', 'Réduction des permanences locales', { kind: 'maintain', capacity: -0.9 }),
  r15c: response('administration', 'Permanences communales renforcées', { kind: 'programme', capacity: 1.6, delay: 1, implementation: 1 }),
  u00a: response('health', 'Aide à domicile réservée aux dépendances lourdes', { kind: 'programme', need: 0.65, delay: 2, implementation: 0.25 }),
  u00c: response('health', 'Accompagnement à domicile renforcé', { kind: 'programme', need: -0.8, delay: 2, implementation: 1 }),
  u01a: response('administration', 'Permanences regroupées', { kind: 'maintain', capacity: -0.8 }),
  u01c: response('administration', 'Accueil administratif renforcé', { kind: 'programme', capacity: 1.5, delay: 1, implementation: 1 }),
  u04a: response('health', 'Couverture de prévention réduite', { kind: 'programme', need: 0.7, delay: 3, implementation: 0.25 }),
  u04c: response('health', 'Prévention renforcée', { kind: 'programme', need: -0.7, delay: 3, implementation: 1 }),
  u05a: response('administration', 'Transition des guichets sociaux fusionnés', { kind: 'relief', capacity: -0.5, duration: 2 }),
  u05c: response('administration', 'Accès aux droits accompagné', { kind: 'programme', capacity: 1.1, delay: 2, implementation: 1 }),
  u09a: response('transport', 'Trajets sanitaires regroupés avec davantage d’attente', { kind: 'maintain', capacity: -0.6 }),
  u09c: response('transport', 'Transports sanitaires renforcés', { kind: 'programme', capacity: 1.4, delay: 1, implementation: 1 }),
  u10a: response('administration', 'Dispositifs de recrutement public réduits', { kind: 'programme', capacity: -0.6, delay: 3, implementation: 0.25 }),
  u10c: response('administration', 'Recrutements publics renforcés', { kind: 'programme', capacity: 1.8, delay: 3, implementation: 1 }),
  u12c: response('energy', 'Conversion des équipements énergétiques', { kind: 'programme', need: -0.9, delay: 3, implementation: 2 }),
  u13a: response('housing', 'Moins de logements remis en location', { kind: 'programme', capacity: -0.7, delay: 2, implementation: 0.25 }),
  u13c: response('housing', 'Logements vacants remis en location', { kind: 'programme', capacity: 1.8, delay: 3, implementation: 2 }),
  u21a: response('education', 'Soutien scolaire concentré sur moins d’établissements', { kind: 'maintain', capacity: -0.5 }),
  u21c: response('education', 'Soutien scolaire renforcé', { kind: 'programme', capacity: 1.5, delay: 2, implementation: 1 }),
  u22a: response('energy', 'Rénovations des réseaux d’eau reportées', { kind: 'programme', capacity: -0.7, delay: 2, implementation: 0.25 }),
  u22c: response('energy', 'Réseaux d’eau rénovés', { kind: 'programme', capacity: 1.8, delay: 3, implementation: 2 }),
  k1b: response('administration', 'Moyens financés pour les guichets débordés', { kind: 'programme', capacity: 1.6, delay: 2, implementation: 1 }),
  k1c: response('administration', 'Renfort aux guichets débordés', { kind: 'programme', capacity: 2.1, delay: 2, implementation: 2 }),
  k4b: response('health', 'Accès aux soins financé par une contribution', { kind: 'programme', capacity: 1.6, delay: 2, implementation: 1 }),
  k4c: response('health', 'Accès aux soins renforcé', { kind: 'programme', capacity: 2.2, delay: 2, implementation: 2 }),
  k9b: response('health', 'Consultations de proximité financées', { kind: 'programme', capacity: 1.8, delay: 2, implementation: 1 }),
  k9c: response('health', 'Renfort de proximité pour l’hôpital', { kind: 'programme', capacity: 2.4, delay: 2, implementation: 2 }),
  k10b: response('administration', 'Recrutements publics ciblés', { kind: 'programme', capacity: 1.5, delay: 3, implementation: 1 }),
  k10c: response('administration', 'Postes publics vacants pourvus', { kind: 'programme', capacity: 2.1, delay: 3, implementation: 2 }),
  k12b: response('energy', 'Conversion énergétique ciblée', { kind: 'programme', need: -0.7, delay: 3, implementation: 1 }),
  k12c: response('energy', 'Conversion énergétique renforcée', { kind: 'programme', need: -1, delay: 3, implementation: 2 }),
  k13b: response('housing', 'Prévention ciblée des impayés', { kind: 'programme', need: -0.8, delay: 1, implementation: 1 }),
  k13c: response('housing', 'Prévention renforcée des impayés', { kind: 'programme', need: -1.1, delay: 1, implementation: 1 }),
  k14b: response('administration', 'Permanences de proximité ciblées', { kind: 'programme', capacity: 1.3, delay: 1, implementation: 1 }),
  k14c: response('administration', 'Permanences de proximité renforcées', { kind: 'programme', capacity: 1.8, delay: 1, implementation: 1 }),
};

export function policyPressureEffects(choice: Choice): PressureChoice | undefined {
  const mapped = POLICY_PRESSURE_EFFECTS[choice.id];
  return mapped ? { ...mapped } : undefined;
}
