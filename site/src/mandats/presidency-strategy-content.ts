import type { PressureSectorId } from './pressure-types.ts';

/** Fictional scenario parameters. Amounts are Md€, flows are simulated work
 * units per two-month period, teams are shared execution units, political costs
 * are support points. These are neither official French costs nor forecasts.
 * A negative need removes avoidable work or interruptions, never people's rights.
 * Annual operating rates and finite durations must be accounted for by the engine.
 * Nothing in this module advances time or applies an effect on inspection. */
export const STRATEGY_CONTENT_NOTICE = 'Coûts, délais, capacités et appuis : hypothèses de simulation, sans prévision sur la France.';
export const STRATEGY_SECTOR_IDS = ['health', 'housing', 'transport', 'energy', 'education', 'administration'] as const satisfies readonly PressureSectorId[];
export const STRATEGY_STAGES = ['warning', 'accumulation', 'organisation', 'conflict', 'national'] as const;
export const STRATEGY_ACTION_IDS = ['capacity', 'organisation', 'agreement', 'recovery', 'network'] as const;
export type StrategyStage = typeof STRATEGY_STAGES[number];
export type StrategyActionId = typeof STRATEGY_ACTION_IDS[number];
export type StrategySpillover = {
  sector: PressureSectorId; capacity?: number; need?: number; fatigue?: number; prevention?: number;
};
export type StrategyActionSpec = {
  id: StrategyActionId; title: string; description: string; problem: string;
  investment: number; annualOperating: number; delay: number; teams: number;
  capacity?: number; need?: number; fatigue?: number; duration?: number;
  supportCost: number; supportOnDelivery: number;
  /** Fraction reducing conditional vulnerability, bounded by the engine. */
  prevention: number;
  requires?: { transformation?: true; phase?: StrategyStage };
  spillovers?: readonly StrategySpillover[];
  sacrifice: string; unlocks: readonly StrategyActionId[];
};
export type StrategySectorSpec = {
  label: string; ministry: string; reason: string;
  warning: string; accumulation: string; organisation: string; conflict: string; national: string;
  /** Dependencies read the previous common period; wording must match effects. */
  links: readonly { sector: PressureSectorId; reason: string }[];
  capacity: StrategyActionSpec; organisationPlan: StrategyActionSpec;
  agreement: StrategyActionSpec; recovery: StrategyActionSpec; network: StrategyActionSpec;
  followup: { title: string; description: string; tradeoff: string };
};

/** Every sector has two durable foundations. Capacity delivers more
 * throughput at a higher financial cost; organisation avoids work and fatigue
 * with a larger political commitment. A network is a new, optional undertaking
 * after a delivered transformation, never a compulsory compensating catastrophe.
 * Compared with the initial calibration, 1.5 units of each foundation's gain
 * belong to its network instead. Either completed route retains its total gain;
 * buying both foundations does not duplicate the network's single gain.
 * Agreements settle conflict once; recovery is finite and not a renewable cure. */
export const STRATEGY_SECTORS: Record<PressureSectorId, StrategySectorSpec> = {
  health: {
    label: 'Accès aux soins', ministry: 'Santé',
    reason: 'Les admissions arrivent plus vite que les créneaux disponibles ; les reports et la fatigue réduisent ensuite le service rendu.',
    warning: 'Des rendez-vous se décalent', accumulation: 'Les soins reportés s’accumulent',
    organisation: 'Les gardes épuisent les équipes', conflict: 'Le conflit porte sur les horaires et les effectifs',
    national: 'Garantir l’organisation et le financement des soins',
    links: [{ sector: 'housing', reason: 'Le logement conditionne l’installation des équipes de soins.' },
      { sector: 'transport', reason: 'Des trajets fiables évitent des créneaux de soins perdus.' },
      { sector: 'energy', reason: 'Les équipements ont besoin d’une alimentation fiable.' }],
    capacity: {
      id: 'capacity', title: 'Former et installer des équipes de soins',
      problem: 'Les créneaux manquent malgré une organisation fonctionnelle.',
      description: 'Financer les formations déjà préparées, les équipements et les postes qui permettent d’ouvrir des créneaux durables.',
      investment: 4.2, annualOperating: .78, delay: 2, teams: 2, capacity: 1.5, fatigue: -8,
      supportCost: 3, supportOnDelivery: 3, prevention: .2,
      sacrifice: 'L’investissement et les postes restent à financer ; deux équipes de mise en œuvre sont mobilisées pendant la préparation.', unlocks: ['network'],
    },
    organisationPlan: {
      id: 'organisation', title: 'Organiser les parcours et les gardes',
      problem: 'Les actes répétés, orientations tardives et gardes déséquilibrées absorbent les moyens.',
      description: 'Négocier les horaires, partager les informations et orienter les patients sans supprimer leur accès aux soins. Les doublons évitables diminuent.',
      investment: 1.1, annualOperating: .3, delay: 3, teams: 1, need: -.7, fatigue: -13,
      supportCost: 10, supportOnDelivery: 3, prevention: .35,
      sacrifice: 'Le résultat demande des consultations et six mois minimum de transition ; les appuis engagés ne sont pas disponibles pour une autre réforme.', unlocks: ['network'],
    },
    agreement: {
      id: 'agreement', title: 'Conclure un accord sur les gardes et les repos',
      problem: 'Le conflit empêche les équipes de tenir les horaires promis.',
      description: 'Financer les remplacements prévus par l’accord et installer des repos garantis. Le conflit ne recule qu’après sa mise en œuvre.',
      investment: .45, annualOperating: .38, delay: 2, teams: 1, capacity: .35, need: -.65, fatigue: -18,
      supportCost: 6, supportOnDelivery: 5, prevention: .1, requires: { phase: 'conflict' },
      sacrifice: 'Les engagements sur les effectifs et les repos créent une charge durable ; l’accord ne remplace pas une transformation des soins.', unlocks: [],
    },
    recovery: {
      id: 'recovery', title: 'Ouvrir un plan exceptionnel de soins reportés',
      problem: 'Le retard est trop important pour disparaître avec les seules améliorations de flux.',
      description: 'Mobiliser une capacité supplémentaire pendant huit mois après préparation pour traiter les soins déjà reportés.',
      investment: 1.6, annualOperating: .9, delay: 1, teams: 3, capacity: 5, fatigue: -10, duration: 4,
      supportCost: 4, supportOnDelivery: 1, prevention: 0, requires: { phase: 'organisation' },
      sacrifice: 'Trois équipes sont retirées aux autres chantiers ; le renfort expire et ne constitue pas une solution permanente.', unlocks: [],
    },
    network: {
      id: 'network', title: 'Garantir un réseau territorial de soins',
      problem: 'Les moyens livrés doivent être partagés entre établissements et accessibles sans transferts inutiles.',
      description: 'Engager les établissements et les transports sanitaires dans une permanence commune, financée et suivie dans la durée.',
      investment: 2.1, annualOperating: .55, delay: 3, teams: 2, capacity: 2.2, need: -.3, fatigue: -3,
      supportCost: 8, supportOnDelivery: 4, prevention: .2, requires: { transformation: true },
      spillovers: [{ sector: 'transport', need: -.65, prevention: .12 }, { sector: 'administration', fatigue: -3 }],
      sacrifice: 'Le réseau engage un financement annuel et un compromis entre établissements ; sa préparation concurrence les autres projets nationaux.', unlocks: [],
    },
    followup: { title: 'Qui garantit la permanence des soins ?',
      description: 'La première transformation est en service. Le Président peut maintenant organiser son financement durable et le partage territorial des moyens.',
      tradeoff: 'Étendre le réseau réduit les transferts et la vulnérabilité, mais engage de nouveaux crédits et un accord entre établissements.' },
  },
  housing: {
    label: 'Accès au logement', ministry: 'Logement',
    reason: 'Les parcours locatifs interrompus et les mises en service trop lentes allongent l’attente, puis saturent les solutions provisoires.',
    warning: 'Des ménages attendent une solution', accumulation: 'L’hébergement provisoire se remplit',
    organisation: 'Les équipes traitent les mêmes urgences', conflict: 'Bailleurs et collectivités contestent la répartition',
    national: 'Répartir les logements et leur financement',
    links: [{ sector: 'administration', reason: 'L’instruction des dossiers conditionne les remises en service et les attributions.' }],
    capacity: {
      id: 'capacity', title: 'Réhabiliter les logements déjà disponibles',
      problem: 'Des logements ne peuvent pas être proposés sans remise en état.',
      description: 'Financer les rénovations préparées et leur gestion pour augmenter durablement les solutions proposées.',
      investment: 4.6, annualOperating: .62, delay: 3, teams: 2, capacity: 1.5, fatigue: -5,
      supportCost: 4, supportOnDelivery: 3, prevention: .18,
      sacrifice: 'Six mois minimum de travaux et une charge de gestion durable ; les équipes ne peuvent pas ouvrir tous les chantiers simultanément.', unlocks: ['network'],
    },
    organisationPlan: {
      id: 'organisation', title: 'Prévenir les ruptures de parcours locatif',
      problem: 'Des impayés non traités, des mutations bloquées et des dossiers répétés alimentent les demandes urgentes.',
      description: 'Organiser les médiations précoces, les mutations et la remise en location pour éviter des passages inutiles par l’hébergement d’urgence.',
      investment: .95, annualOperating: .22, delay: 2, teams: 1, need: -.5, fatigue: -10,
      supportCost: 10, supportOnDelivery: 3, prevention: .32,
      sacrifice: 'Les bailleurs et collectivités doivent accepter des règles communes ; cette voie ne construit pas de logements supplémentaires.', unlocks: ['network'],
    },
    agreement: {
      id: 'agreement', title: 'Accorder bailleurs et collectivités sur les attributions',
      problem: 'Le conflit sur les contingents bloque des solutions pourtant disponibles.',
      description: 'Financer le suivi des engagements et une répartition négociée, avec recours pour les ménages concernés.',
      investment: .35, annualOperating: .3, delay: 2, teams: 1, capacity: .4, need: -.6, fatigue: -15,
      supportCost: 8, supportOnDelivery: 5, prevention: .15, requires: { phase: 'conflict' },
      sacrifice: 'Le compromis limite la liberté d’attribution de chaque acteur et maintient une dépense de suivi.', unlocks: [],
    },
    recovery: {
      id: 'recovery', title: 'Résorber exceptionnellement les dossiers en attente',
      problem: 'Les solutions disponibles n’absorbent plus l’ancien retard.',
      description: 'Financer huit mois d’équipes de traitement et de solutions relais pendant la livraison des mesures durables.',
      investment: 1.8, annualOperating: 1.05, delay: 1, teams: 3, capacity: 5.2, fatigue: -8, duration: 4,
      supportCost: 3, supportOnDelivery: 1, prevention: 0, requires: { phase: 'organisation' },
      sacrifice: 'Les relais et équipes prennent fin après huit mois ; sans transformation durable, le flux de demandes reste présent.', unlocks: [],
    },
    network: {
      id: 'network', title: 'Partager le logement des agents essentiels',
      problem: 'Les services transformés peinent encore à installer les personnes qu’ils recrutent.',
      description: 'Conclure un pacte de mobilité entre logements disponibles, établissements de soins et établissements scolaires.',
      investment: 2.2, annualOperating: .4, delay: 3, teams: 2, capacity: 2, need: -.5,
      supportCost: 9, supportOnDelivery: 4, prevention: .25, requires: { transformation: true },
      spillovers: [{ sector: 'health', capacity: .45, prevention: .15 }, { sector: 'education', capacity: .35, prevention: .1 }],
      sacrifice: 'Des logements sont réservés à ces mobilités ; le compromis territorial et leur gestion demandent un financement durable.', unlocks: [],
    },
    followup: { title: 'À qui réserver les nouvelles solutions ?',
      description: 'Le parc fonctionne mieux. Son affectation devient un choix national entre demandes locales et mobilité des équipes de services publics.',
      tradeoff: 'Un pacte intersectoriel aide les soins et les écoles, avec des engagements d’attribution et de gestion supplémentaires.' },
  },
  transport: {
    label: 'Fiabilité des transports', ministry: 'Transports',
    reason: 'Les trajets perturbés et l’entretien reporté épuisent les marges du réseau, puis désorganisent les autres services.',
    warning: 'Des trajets deviennent incertains', accumulation: 'L’entretien et les correspondances prennent du retard',
    organisation: 'Les équipes cumulent les rotations', conflict: 'Le conflit porte sur les horaires et le repos',
    national: 'Choisir les liaisons et les services à garantir',
    links: [{ sector: 'energy', reason: 'Les équipements et le réseau de transport dépendent d’une alimentation fiable.' }],
    capacity: {
      id: 'capacity', title: 'Renouveler les équipements et les équipes de maintenance',
      problem: 'Le réseau manque de moyens pour assurer ses rotations et son entretien.',
      description: 'Remplacer les équipements prêts à être commandés et former les équipes de maintenance supplémentaires.',
      investment: 4, annualOperating: .6, delay: 2, teams: 2, capacity: 1.3, fatigue: -7,
      supportCost: 3, supportOnDelivery: 3, prevention: .2,
      sacrifice: 'Le matériel et les postes ont un coût durable ; deux équipes d’exécution sont mobilisées pendant la préparation.', unlocks: ['network'],
    },
    organisationPlan: {
      id: 'organisation', title: 'Coordonner les horaires et la maintenance',
      problem: 'Les correspondances manquées, déplacements à vide et interventions dispersées absorbent les moyens.',
      description: 'Accorder les opérateurs sur les rotations et les créneaux d’entretien pour réduire le travail évitable sans supprimer les dessertes.',
      investment: 1, annualOperating: .25, delay: 3, teams: 1, need: -.4, fatigue: -11,
      supportCost: 9, supportOnDelivery: 3, prevention: .35,
      sacrifice: 'Six mois minimum de concertation ; les opérateurs renoncent à fixer seuls certains horaires.', unlocks: ['network'],
    },
    agreement: {
      id: 'agreement', title: 'Négocier les rotations et les repos',
      problem: 'Les horaires contestés empêchent d’utiliser les moyens disponibles.',
      description: 'Financer les rotations convenues et rendre les repos applicables avant la reprise complète.',
      investment: .5, annualOperating: .3, delay: 2, teams: 1, capacity: .5, need: -.6, fatigue: -16,
      supportCost: 6, supportOnDelivery: 5, prevention: .12, requires: { phase: 'conflict' },
      sacrifice: 'Les engagements de service et de repos ont une charge durable ; l’accord ne renouvelle pas les équipements.', unlocks: [],
    },
    recovery: {
      id: 'recovery', title: 'Rattraper l’entretien avec une mobilisation exceptionnelle',
      problem: 'Le retard accumulé empêche les nouveaux moyens de rétablir rapidement le réseau.',
      description: 'Concentrer pendant huit mois des équipes et du matériel sur les opérations déjà en attente.',
      investment: 1.7, annualOperating: .96, delay: 1, teams: 3, capacity: 5, fatigue: -9, duration: 4,
      supportCost: 4, supportOnDelivery: 1, prevention: 0, requires: { phase: 'organisation' },
      sacrifice: 'Trois équipes sont mobilisées et le renfort expire ; les besoins futurs demandent toujours une solution durable.', unlocks: [],
    },
    network: {
      id: 'network', title: 'Garantir les liaisons vers les services essentiels',
      problem: 'Un réseau plus fiable doit répartir ses créneaux entre établissements et territoires.',
      description: 'Contractualiser les correspondances et dessertes qui rendent les soins, écoles et guichets effectivement accessibles.',
      investment: 2.4, annualOperating: .5, delay: 3, teams: 2, capacity: 2.1, need: -.3,
      supportCost: 8, supportOnDelivery: 4, prevention: .25, requires: { transformation: true },
      spillovers: [{ sector: 'health', capacity: .45 }, { sector: 'education', capacity: .4 }, { sector: 'administration', capacity: .35 }],
      sacrifice: 'Le contrat engage les horaires et le financement annuel ; certaines rotations commerciales disposent de moins de liberté.', unlocks: [],
    },
    followup: { title: 'Quelles liaisons garantir dans la durée ?',
      description: 'La fiabilité est améliorée. Le nouvel arbitrage porte sur les territoires desservis et les contrats entre opérateurs et services publics.',
      tradeoff: 'Garantir l’accès aux services produit des gains ailleurs, mais engage les horaires, les crédits futurs et un compromis territorial.' },
  },
  energy: {
    label: 'Continuité énergétique', ministry: 'Énergie',
    reason: 'Une maintenance trop tardive et des pointes mal absorbées réduisent les marges, avant de perturber les équipements des autres secteurs.',
    warning: 'La marge du réseau se réduit', accumulation: 'Des travaux attendent et les secours sont sollicités',
    organisation: 'Les astreintes s’accumulent', conflict: 'Équipes et usagers contestent les priorités',
    national: 'Financer la fiabilité et les usages prioritaires',
    links: [{ sector: 'administration', reason: 'Les autorisations instruites à temps permettent les travaux du réseau.' }],
    capacity: {
      id: 'capacity', title: 'Renforcer les équipements et la maintenance du réseau',
      problem: 'Le réseau manque de moyens durables pour absorber les pointes et les indisponibilités.',
      description: 'Financer les équipements préparés, les pièces et les équipes qui augmentent la capacité disponible.',
      investment: 5, annualOperating: .72, delay: 3, teams: 2, capacity: 1.5, fatigue: -7,
      supportCost: 4, supportOnDelivery: 3, prevention: .25,
      sacrifice: 'L’investissement est élevé et les postes restent financés après livraison ; les travaux utilisent les équipes communes.', unlocks: ['network'],
    },
    organisationPlan: {
      id: 'organisation', title: 'Piloter les consommations et l’entretien',
      problem: 'Des consommations évitables et des interventions mal coordonnées réduisent les marges.',
      description: 'Accorder les usages flexibles, supprimer les consommations inutiles et planifier les interventions sans couper les services essentiels.',
      investment: 1.25, annualOperating: .18, delay: 2, teams: 1, need: -.3, fatigue: -10,
      supportCost: 8, supportOnDelivery: 2, prevention: .38,
      sacrifice: 'Les grands usagers acceptent des horaires et des engagements contrôlés ; la puissance installée reste inchangée.', unlocks: ['network'],
    },
    agreement: {
      id: 'agreement', title: 'Accorder les astreintes et les priorités de service',
      problem: 'La contestation empêche une mobilisation fiable des équipes et des réserves.',
      description: 'Financer les astreintes négociées et une règle publique sur les équipements prioritaires.',
      investment: .4, annualOperating: .3, delay: 2, teams: 1, capacity: .4, need: -.6, fatigue: -16,
      supportCost: 7, supportOnDelivery: 5, prevention: .12, requires: { phase: 'conflict' },
      sacrifice: 'Les engagements d’astreinte et de priorité restent dus ; l’accord ne remplace pas les équipements vieillissants.', unlocks: [],
    },
    recovery: {
      id: 'recovery', title: 'Résorber le retard critique du réseau',
      problem: 'Les travaux en attente entretiennent des indisponibilités qui empêchent la reprise.',
      description: 'Mobiliser pour huit mois des équipes spécialisées et des pièces de réserve afin de traiter les travaux déjà reportés.',
      investment: 1.9, annualOperating: .9, delay: 1, teams: 3, capacity: 5.4, fatigue: -9, duration: 4,
      supportCost: 4, supportOnDelivery: 1, prevention: 0, requires: { phase: 'organisation' },
      sacrifice: 'La mobilisation retire trois équipes aux autres investissements et expire après huit mois.', unlocks: [],
    },
    network: {
      id: 'network', title: 'Sécuriser l’alimentation des services essentiels',
      problem: 'Le réseau transformé doit garantir une continuité commune aux soins, écoles et transports.',
      description: 'Financer les raccordements de secours et les contrats de continuité entre opérateurs et établissements.',
      investment: 2.6, annualOperating: .48, delay: 3, teams: 2, capacity: 2.3, need: -.2,
      supportCost: 10, supportOnDelivery: 5, prevention: .3, requires: { transformation: true },
      spillovers: [{ sector: 'health', capacity: .5, prevention: .12 }, { sector: 'education', capacity: .4 }, { sector: 'transport', capacity: .4 }],
      sacrifice: 'Ces garanties demandent des contrats et des charges annuelles ; leur priorité doit être acceptée par les autres usagers.', unlocks: [],
    },
    followup: { title: 'Quels usages garantir, et qui les finance ?',
      description: 'La marge du réseau s’est améliorée. Le Président peut organiser des garanties intersectorielles et assumer leurs engagements futurs.',
      tradeoff: 'Le contrat protège plusieurs services, avec une enveloppe supplémentaire et un arbitrage politique sur les usages prioritaires.' },
  },
  education: {
    label: 'Continuité des enseignements', ministry: 'Éducation',
    reason: 'Les heures non assurées et les remplacements tardifs augmentent la charge des équipes, puis désorganisent les familles et les autres services.',
    warning: 'Des heures de cours ne sont pas assurées', accumulation: 'Les absences et les rattrapages se cumulent',
    organisation: 'Les équipes n’absorbent plus les remplacements', conflict: 'Le conflit porte sur les affectations et le temps de travail',
    national: 'Garantir les enseignements et les parcours de formation',
    links: [{ sector: 'transport', reason: 'Les trajets fiables permettent aux élèves et équipes d’être présents.' },
      { sector: 'energy', reason: 'L’alimentation des bâtiments conditionne leur ouverture.' }],
    capacity: {
      id: 'capacity', title: 'Former un vivier durable de remplacement',
      problem: 'Les établissements ne disposent pas de remplaçants préparés en nombre suffisant.',
      description: 'Financer les formations déjà organisées, les postes et les moyens qui assurent durablement les remplacements.',
      investment: 3.8, annualOperating: .82, delay: 3, teams: 2, capacity: 1.2, fatigue: -8,
      supportCost: 4, supportOnDelivery: 3, prevention: .2,
      sacrifice: 'Six mois minimum de préparation et des postes à financer chaque année ; les équipes de mise en œuvre restent partagées.', unlocks: ['network'],
    },
    organisationPlan: {
      id: 'organisation', title: 'Partager les remplacements et les temps de préparation',
      problem: 'Les affectations tardives et les démarches dispersées font perdre des heures pourtant disponibles.',
      description: 'Négocier un fonctionnement commun entre établissements pour anticiper les absences et réduire les heures perdues, sans diminuer les enseignements dus.',
      investment: .9, annualOperating: .28, delay: 2, teams: 1, need: -.5, fatigue: -12,
      supportCost: 10, supportOnDelivery: 3, prevention: .32,
      sacrifice: 'Les établissements acceptent une coordination des affectations ; le compromis mobilise des appuis politiques.', unlocks: ['network'],
    },
    agreement: {
      id: 'agreement', title: 'Conclure un accord sur les affectations et les repos',
      problem: 'Le conflit empêche les établissements de mobiliser leurs moyens.',
      description: 'Financer les remplacements convenus et des temps de préparation garantis avant la reprise du service.',
      investment: .35, annualOperating: .32, delay: 2, teams: 1, capacity: .3, need: -.6, fatigue: -18,
      supportCost: 7, supportOnDelivery: 5, prevention: .12, requires: { phase: 'conflict' },
      sacrifice: 'L’accord engage durablement des moyens de remplacement ; il ne crée pas à lui seul un vivier formé.', unlocks: [],
    },
    recovery: {
      id: 'recovery', title: 'Rattraper les enseignements interrompus',
      problem: 'Les heures déjà perdues restent à traiter même lorsque les prochains cours sont mieux organisés.',
      description: 'Ouvrir huit mois de moyens supplémentaires pour les enseignements reportés et l’accompagnement des élèves concernés.',
      investment: 1.5, annualOperating: 1.02, delay: 1, teams: 3, capacity: 4.8, fatigue: -10, duration: 4,
      supportCost: 4, supportOnDelivery: 1, prevention: 0, requires: { phase: 'organisation' },
      sacrifice: 'Le programme expire après huit mois et mobilise trois équipes ; le fonctionnement futur demande toujours une transformation.', unlocks: [],
    },
    network: {
      id: 'network', title: 'Partager un réseau de formation des services publics',
      problem: 'Les capacités de formation livrées peuvent servir la stabilité des autres services.',
      description: 'Engager les établissements et administrations dans des parcours communs de formation et de remplacement.',
      investment: 1.9, annualOperating: .45, delay: 3, teams: 2, capacity: 2.1, need: -.3,
      supportCost: 9, supportOnDelivery: 5, prevention: .22, requires: { transformation: true },
      spillovers: [{ sector: 'administration', capacity: .6, prevention: .15 }, { sector: 'health', fatigue: -4 }],
      sacrifice: 'Des créneaux de formation sont partagés avec d’autres métiers ; les engagements annuels et la coalition doivent soutenir ce choix.', unlocks: [],
    },
    followup: { title: 'À quels métiers ouvrir les capacités de formation ?',
      description: 'La continuité des cours s’améliore. L’enjeu devient la répartition de capacités durables entre enseignement et autres services publics.',
      tradeoff: 'Un réseau commun aide les administrations et les équipes de soins, avec un nouveau budget et un engagement entre métiers.' },
  },
  administration: {
    label: 'Délais des services publics', ministry: 'Services publics',
    reason: 'Les démarches répétées et les décisions en attente occupent les équipes, puis retardent les projets des ménages et des autres ministères.',
    warning: 'Des réponses administratives tardent', accumulation: 'Les demandes reviennent et les délais s’allongent',
    organisation: 'Les permanences travaillent en surcharge', conflict: 'Usagers, agents et collectivités contestent les fermetures',
    national: 'Garantir l’accès aux droits et la mise en œuvre des projets',
    links: [{ sector: 'transport', reason: 'Les trajets fiables rendent les permanences accessibles.' },
      { sector: 'education', reason: 'Les interruptions de cours réduisent la disponibilité des parents aux guichets.' }],
    capacity: {
      id: 'capacity', title: 'Former et affecter des équipes d’instruction',
      problem: 'Les équipes ne peuvent pas traiter le volume de dossiers disponibles.',
      description: 'Financer les postes, la formation préparée et les outils nécessaires pour renforcer durablement l’instruction.',
      investment: 3.4, annualOperating: .6, delay: 2, teams: 2, capacity: 1.1, fatigue: -7,
      supportCost: 3, supportOnDelivery: 3, prevention: .18,
      sacrifice: 'Les postes demandent une charge annuelle ; la préparation mobilise deux équipes partagées avec les autres chantiers.', unlocks: ['network'],
    },
    organisationPlan: {
      id: 'organisation', title: 'Unifier les dossiers avec un recours accessible',
      problem: 'Les justificatifs répétés et les transmissions entre organismes alimentent l’attente.',
      description: 'Négocier une instruction commune, conserver l’accueil humain et le recours, puis supprimer les démarches en double.',
      investment: 1.3, annualOperating: .16, delay: 3, teams: 1, need: -.7, fatigue: -10,
      supportCost: 11, supportOnDelivery: 4, prevention: .38,
      sacrifice: 'Six mois minimum de transition ; les organismes abandonnent une partie de leur autonomie et les appuis sont engagés dans cet accord.', unlocks: ['network'],
    },
    agreement: {
      id: 'agreement', title: 'Accorder les permanences et les garanties d’accès',
      problem: 'Le conflit bloque la répartition des horaires et des agents.',
      description: 'Financer des horaires négociés, des recours et des remplacements qui rendent les permanences réellement accessibles.',
      investment: .3, annualOperating: .26, delay: 2, teams: 1, capacity: .35, need: -.6, fatigue: -16,
      supportCost: 6, supportOnDelivery: 5, prevention: .12, requires: { phase: 'conflict' },
      sacrifice: 'La garantie d’accueil engage des équipes et une dépense annuelle ; le stock de dossiers ne disparaît pas par la signature.', unlocks: [],
    },
    recovery: {
      id: 'recovery', title: 'Traiter exceptionnellement les dossiers accumulés',
      problem: 'Le stock ancien ne peut pas être résorbé par la seule amélioration des prochains flux.',
      description: 'Mobiliser huit mois d’équipes supplémentaires sur les dossiers déjà prêts, avec contrôle des décisions et maintien des recours.',
      investment: 1.4, annualOperating: .78, delay: 1, teams: 3, capacity: 4.6, fatigue: -8, duration: 4,
      supportCost: 3, supportOnDelivery: 1, prevention: 0, requires: { phase: 'organisation' },
      sacrifice: 'Trois équipes sont mobilisées et le renfort expire ; il ne supprime pas les démarches futures en double.', unlocks: [],
    },
    network: {
      id: 'network', title: 'Garantir l’instruction des projets entre ministères',
      problem: 'Les projets de logement et d’énergie attendent encore des décisions prises par plusieurs organismes.',
      description: 'Engager une instruction partagée et contrôlée pour les projets prêts, sans supprimer les exigences de sécurité ni les recours.',
      investment: 2.3, annualOperating: .38, delay: 3, teams: 2, capacity: 2.1, need: -.35,
      supportCost: 10, supportOnDelivery: 4, prevention: .25, requires: { transformation: true },
      spillovers: [{ sector: 'housing', capacity: .5, prevention: .1 }, { sector: 'energy', capacity: .45, prevention: .1 }],
      sacrifice: 'L’accord partage les compétences et engage un financement durable ; tous les ministères doivent respecter le suivi commun.', unlocks: [],
    },
    followup: { title: 'Qui décide des projets transversaux ?',
      description: 'L’instruction s’améliore. Le Président peut désormais engager les administrations dans une garantie commune sur les projets de logement et d’énergie.',
      tradeoff: 'Le réseau rend les autres investissements plus efficaces, avec une nouvelle enveloppe et un compromis sur les compétences de chaque organisme.' },
  },
};

export function strategyActionFor(sector: PressureSectorId, id: StrategyActionId): StrategyActionSpec {
  const content = STRATEGY_SECTORS[sector];
  return id === 'organisation' ? content.organisationPlan : content[id];
}
