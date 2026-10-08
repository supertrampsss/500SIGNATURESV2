import type { Effect, Game } from "./types.ts";
import type {
  NarrativeChoice,
  NarrativeEvent,
  NarrativeFamily,
} from "./narrative-types.ts";
import type { SocialActor, SocialMovement } from "./social-types.ts";
import {
  activeSocialMovements,
  movementPhase,
  SOCIAL_ACTORS,
} from "./social-engine.ts";

export const EDUCATION_FAMILY: NarrativeFamily = {
  id: "enseignement-lycees",
  title: "Les moyens des lycées",
  category: "Enseignement",
  summary: "Postes, classes et accès aux enseignements.",
  art: "school",
  urgency: "Préparer la rentrée",
};
export const EDUCATION_EVENT: NarrativeEvent = {
  id: "education-lycees",
  familyId: EDUCATION_FAMILY.id,
  title: "Des classes à regrouper à la rentrée",
  body: "Dans les lycées du bassin des Tilleuls, des postes d’enseignement partent à la retraite. Le ministère propose de regrouper des classes pour ne pas tous les remplacer. Les équipes craignent des classes plus chargées ; les lycéens demandent de garder les enseignements de proximité.",
  choices: [
    {
      id: "preserver",
      title: "Remplacer les postes et maintenir les classes",
      description:
        "Financer les recrutements et conserver les enseignements du bassin.",
      cost: "2 Md€ par an",
      benefit: "Les équipes et les classes gardent leurs moyens.",
      sacrifice:
        "Cette dépense durable réduit la marge pour les autres priorités.",
      effect: { operating: 2, services: 2, society: { publicStaff: 2 } },
      relationships: { social: 5, regional: 4 },
    },
    {
      id: "regrouper",
      title: "Regrouper les classes et réduire les postes",
      description:
        "Ne pas remplacer une partie des départs et répartir les élèves entre les classes restantes.",
      cost: "2 Md€ de charges en moins par an",
      benefit: "Le déficit annuel diminue si le texte est adopté.",
      sacrifice:
        "Les classes se chargent davantage et des enseignements de proximité disparaissent.",
      effect: { operating: -2, services: -3, society: { publicStaff: -4 } },
      relationships: {
        presidential: 3,
        conservative: 8,
        social: -8,
        regional: -5,
      },
      social: {
        trigger: {
          actor: "lyceens",
          demand: "Classes moins chargées et maintien des enseignements",
          grievance:
            "Le regroupement de classes est adopté. Un collectif lycéen fictif demande le maintien des enseignements et prépare des rassemblements.",
          pressure: 34,
        },
      },
    },
    {
      id: "accompagner",
      title: "Réorganiser avec une garantie de proximité",
      description:
        "Mutualiser certaines spécialités et financer les trajets et l’accompagnement des élèves.",
      cost: "0,5 Md€ de charges en moins par an",
      benefit: "Les enseignements restent accessibles dans le bassin.",
      sacrifice:
        "Certains élèves se déplacent davantage et l’économie est plus faible.",
      effect: { operating: -0.5, services: -1, society: { publicStaff: -1 } },
      relationships: { reformist: 4, regional: 2 },
    },
  ],
};

export function socialMovementFront(
  game: Game,
):
  | { event: NarrativeEvent; family: NarrativeFamily; movement: SocialMovement }
  | undefined {
  const movement = activeSocialMovements(game).find(
    (item) => item.commitment?.status !== "pending",
  );
  if (!movement) return undefined;
  const actor = SOCIAL_ACTORS[movement.actor];
  const staffBoost = Math.max(3, 38 - (game.society?.publicStaff ?? 65));
  const serviceBoost = Math.max(3, 43 - game.metrics.services);
  const operating =
    Math.round(
      (2 + Math.max(0, staffBoost - 3) * 0.5 + Math.max(0, serviceBoost - 3)) *
        100,
    ) / 100;
  const family: NarrativeFamily = {
    id: "mobilisations-sociales",
    title: "Mobilisations sociales",
    category:
      movement.actor === "lyceens"
        ? "Enseignement · mobilisation lycéenne"
        : `Mobilisation · ${actor.label}`,
    summary: movement.demand,
    art: actor.art,
    urgency: movementPhase(movement),
  };
  const due =
    movement.dialogueDueTurn && !movement.dialogueExpired
      ? ` La réponse à la concertation est attendue à la décision ${movement.dialogueDueTurn}.`
      : "";
  const schoolChoices: NarrativeEvent["choices"] = [
    {
      id: "suspendre",
      title: "Suspendre le regroupement",
      description:
        "Rétablir les crédits retirés et ouvrir une évaluation datée avant de reprendre la réforme.",
      cost: "2 Md€ par an rétablis",
      benefit: "Le regroupement est suspendu pendant l’évaluation.",
      sacrifice: "La réforme prend du retard et les économies sont annulées.",
      effect: { operating: 2 },
      relationships: { social: 7, conservative: -4 },
      social: {
        response: {
          movementId: movement.id,
          action: "suspend",
          deliveryEffect: { services: 3, society: { publicStaff: 4 } },
        },
      },
    },
    {
      id: "financer",
      title: "Redéployer les enseignants",
      description:
        "Affecter des personnels disponibles aux classes concernées, en réduisant les moyens d’autres bassins.",
      cost: "0,35 Md€ par an de coordination",
      benefit:
        "Un redéploiement est engagé ; ses effets attendent la mise en place.",
      sacrifice: "Les autres bassins disposent de moins d’enseignants.",
      effect: { operating: 0.35 },
      relationships: { social: 5, regional: -2 },
      social: {
        response: {
          movementId: movement.id,
          action: "redeploy",
          deliveryEffect: {
            areaEffects: {
              metropoles: { services: 3 },
              rural: { services: -3 },
            },
          },
        },
      },
    },
    {
      id: "tester",
      title: "Tester dans un bassin",
      description:
        "Limiter la réforme à un bassin pilote et publier ses résultats avant la généralisation.",
      cost: "0,25 Md€ par an d’évaluation",
      benefit: "Un essai limité est engagé avec un calendrier.",
      sacrifice: "La réforme reste locale pendant l’essai.",
      effect: { operating: 0.25 },
      relationships: { reformist: 5, regional: 2 },
      social: {
        response: {
          movementId: movement.id,
          action: "pilot",
          deliveryEffect: { services: 1, trust: 1 },
        },
      },
    },
  ];
  const concession = (
    id: string,
    title: string,
    description: string,
    cost: number,
    sacrifice: string,
    deliveryEffect: Effect,
    action: "fund" | "redeploy" | "pilot" = "fund",
  ): NarrativeChoice => ({
    id,
    title,
    description,
    cost: `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(cost)} Md€ par an`,
    benefit: "Les moyens votés seront vérifiés à leur mise en place.",
    sacrifice,
    effect: { operating: cost },
    relationships:
      id === "financer"
        ? { social: 10, reformist: 5, regional: 5 }
        : { social: 5, reformist: 4, regional: -2 },
    social: { response: { movementId: movement.id, action, deliveryEffect } },
  });
  const dialogue = (title: string, description: string): NarrativeChoice => ({
    id: "dialoguer",
    title:
      movement.dialogueDueTurn === undefined
        ? title
        : "Respecter l’échéance de négociation",
    description,
    cost: "0,15 Md€ par an de coordination",
    benefit:
      "Deux décisions pour préparer une réponse ; une réunion ne règle pas la revendication.",
    sacrifice: "Sans accord financé à l’échéance, la mobilisation repart.",
    effect: { operating: 0.15 },
    political: { action: "confidence" },
    social: { response: { movementId: movement.id, action: "dialogue" } },
  });
  const responses: Record<
    Exclude<SocialActor, "lyceens">,
    NarrativeChoice[]
  > = {
    salaries: [
      concession(
        "financer",
        "Financer les reconversions locales",
        "Ouvrir des formations rémunérées et accompagner les reclassements dans les bassins touchés.",
        2,
        "Les revenus sont soutenus, mais le retour à l’emploi prend du temps.",
        { society: { workers: 5 } },
      ),
      concession(
        "partager",
        "Partager le temps de travail",
        "Aider les entreprises à répartir les heures disponibles en maintenant une partie des revenus.",
        1,
        "Les employeurs financent une partie du maintien des revenus et réduisent leurs marges.",
        { society: { workers: 3, businesses: -2 } },
      ),
      dialogue(
        "Négocier un accord de branche",
        "Réunir syndicats et employeurs pour négocier salaires et reclassements avant l’échéance.",
      ),
    ],
    retraites: [
      concession(
        "financer",
        "Rétablir l’indexation des pensions",
        "Financer une revalorisation des pensions pour compenser la perte de pouvoir d’achat.",
        2,
        "La dépense augmente durablement, y compris pour les pensions élevées.",
        { society: { pensioners: 5 } },
      ),
      concession(
        "cibler",
        "Relever les petites pensions",
        "Réserver la revalorisation aux petites pensions et aux retraités disposant de peu de ressources.",
        1,
        "Les pensions au-dessus du seuil ne sont pas revalorisées.",
        { society: { pensioners: 3, vulnerable: 2 } },
      ),
      dialogue(
        "Négocier une revalorisation progressive",
        "Recevoir les associations de retraités et fixer un calendrier de revalorisation à financer.",
      ),
    ],
    agents: [
      concession(
        "financer",
        "Recruter dans les services concernés",
        "Financer les postes manquants et leur prise de fonction dans les services mobilisés.",
        operating,
        "Les recrutements coûtent chaque année et les équipes attendent les arrivées.",
        { services: serviceBoost, society: { publicStaff: staffBoost } },
      ),
      concession(
        "reaffecter",
        "Réaffecter les équipes disponibles",
        "Renforcer les services urbains concernés en transférant des personnels d’autres bassins.",
        0.35,
        "Les services ruraux disposent de moins d’équipes.",
        {
          areaEffects: { metropoles: { services: 3 }, rural: { services: -3 } },
        },
        "redeploy",
      ),
      concession(
        "tester",
        "Tester une nouvelle organisation",
        "Expérimenter les horaires et la répartition des tâches dans un service avant extension.",
        0.25,
        "Les autres services attendent les résultats de trois décisions d’essai.",
        { services: 1, society: { publicStaff: 1 } },
        "pilot",
      ),
    ],
    menages: [
      concession(
        "financer",
        "Financer un tarif de première nécessité",
        "Aider les ménages modestes à payer une première tranche d’énergie et les services essentiels.",
        2,
        "Le tarif réduit reste à financer chaque année.",
        { society: { vulnerable: 5 } },
      ),
      concession(
        "logement",
        "Cibler l’aide sur le logement",
        "Renforcer l’aide au loyer et l’accès aux services dans les bassins ruraux les plus touchés.",
        1,
        "L’aide reste limitée au logement et aux territoires retenus.",
        { society: { vulnerable: 3 }, areaEffects: { rural: { services: 2 } } },
      ),
      {
        id: "maintenir",
        title: "Conserver les économies sur les aides",
        description:
          "Garder les économies votées et appliquer les nouveaux critères sans compensation.",
        cost: "Aucun crédit supplémentaire",
        benefit: "Les économies restent dans le budget.",
        sacrifice: "Les difficultés d’accès et la mobilisation s’aggravent.",
        effect: { trust: -1 },
        political: { action: "confidence" },
        social: { response: { movementId: movement.id, action: "maintain" } },
      },
    ],
  };
  return {
    movement,
    family,
    event: {
      id: movement.id,
      familyId: family.id,
      title:
        movement.actor === "lyceens"
          ? "Les lycéens se mobilisent"
          : `${actor.label} : ${movement.demand.toLocaleLowerCase("fr")}`,
      body: `${movement.actor === "lyceens" ? "Les lycéens demandent de conserver les enseignements de proximité après le regroupement des classes." : `Les ${actor.label.toLocaleLowerCase("fr")} contestent la décision « ${movement.sourceTitle} ».`} ${movement.grievance} ${movementPhase(movement)} : ${movement.lastDetail}${due} Le collectif et cette mobilisation sont fictifs.`,
      choices:
        movement.actor === "lyceens"
          ? schoolChoices
          : responses[movement.actor],
    },
  };
}
