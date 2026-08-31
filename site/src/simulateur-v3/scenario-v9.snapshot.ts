import type { Scenario } from "./types.ts";

// Generated once from the pre-V10 scenario. Keep this file self-contained.
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    for (const nestedValue of Object.values(value)) deepFreeze(nestedValue, seen);
    Object.freeze(value);
  }
  return value;
}

// Historical JSON remains byte-for-byte unchanged; this is the only V9 type bridge.
export const SCENARIO_V9_SNAPSHOT: Scenario = deepFreeze(
{
  "version": 9,
  "title": "La France à l'épreuve des comptes",
  "chapters": [
    {
      "id": "taxes-assets-transmission",
      "title": "Impôts, patrimoine et transmission",
      "domains": [
        "Impôt sur le revenu",
        "Patrimoine",
        "Consommation",
        "Entreprises"
      ],
      "opening": "Le mandat commence par la question la plus immédiate : qui finance l'action publique et selon quelles règles.",
      "tension": "Chaque recette protège un budget, mais déplace l'effort vers un groupe précis.",
      "decisionIds": [
        "geler-le-bareme-de-l-impot-sur",
        "porter-le-taux-normal-de-tva-a",
        "tranche-a-50-au-dela-de-250",
        "retablir-un-impot-sur-la-fortune-financiere",
        "soumettre-les-revenus-du-capital-au-bareme",
        "exonerer-de-droits-de-succession-jusqu-a",
        "flat-tax-a-20-des-le-premier",
        "abolir-les-droits-de-succession"
      ]
    },
    {
      "id": "work-wages-pensions",
      "title": "Travail, salaires et retraites",
      "domains": [
        "Emploi",
        "Salaires",
        "Retraites",
        "Assurance chômage"
      ],
      "opening": "Le financement du modèle social dépend du travail, des cotisations et de la durée d'activité.",
      "tension": "Redresser les comptes sociaux modifie directement les revenus et les parcours de vie.",
      "decisionIds": [
        "supprimer-les-allegements-de-cotisations-entre-2",
        "repousser-l-age-legal-a-65-ans",
        "revenir-a-62-ans",
        "desindexer-les-pensions-d-un-point",
        "durcir-l-assurance-chomage-degressivite-duree",
        "retablir-la-semaine-de-39-heures",
        "augmenter-le-smic-de-10",
        "allocation-sociale-unique"
      ]
    },
    {
      "id": "health-social-protection",
      "title": "Santé et protection sociale",
      "domains": [
        "Hôpital",
        "Soins de ville",
        "Prestations",
        "Solidarité"
      ],
      "opening": "Les besoins progressent plus vite que certaines ressources et rendent les arbitrages immédiatement visibles.",
      "tension": "Réduire la dépense peut déplacer le coût vers les patients, les familles ou les professionnels.",
      "decisionIds": [
        "doubler-les-franchises-medicales",
        "renforcer-le-controle-des-arrets-de-travail",
        "creer-5-000-postes-de-soignants",
        "loi-grand-age-50-000-recrutements",
        "supprimer-l-aide-medicale-d-etat",
        "verser-le-rsa-automatiquement-fin-du-non",
        "porter-le-rsa-au-seuil-de",
        "assurance-maladie-publique-unique"
      ]
    },
    {
      "id": "security-immigration-justice",
      "title": "Sécurité, immigration et justice",
      "domains": [
        "Police",
        "Justice",
        "Immigration",
        "Prisons"
      ],
      "opening": "L'autorité publique se mesure à ses moyens, mais aussi aux règles qu'elle accepte de s'imposer.",
      "tension": "Les décisions les plus visibles sont souvent celles dont les effets budgétaires et juridiques sont les plus discutés.",
      "decisionIds": [
        "recruter-10-000-policiers-et-gendarmes",
        "construire-15-000-places-de-prison-supplementaires",
        "recruter-3-000-magistrats-et-greffiers",
        "doubler-l-execution-des-eloignements-oqtf",
        "supprimer-l-allocation-pour-demandeurs-d",
        "reserver-les-prestations-non-contributives-aux-nationaux",
        "quotas-annuels-d-immigration",
        "legaliser-et-taxer-le-cannabis"
      ]
    },
    {
      "id": "defence-europe-sovereignty",
      "title": "Défense, Europe et souveraineté",
      "domains": [
        "Armées",
        "Europe",
        "Diplomatie",
        "Industrie stratégique"
      ],
      "opening": "La souveraineté exige des capacités coûteuses et des alliances qui limitent parfois la liberté de décision.",
      "tension": "Préparer les crises futures oblige à financer aujourd'hui des résultats difficiles à observer immédiatement.",
      "decisionIds": [
        "porter-l-effort-de-defense-vers-3",
        "doubler-la-reserve-operationnelle",
        "service-militaire-volontaire-de-50-000",
        "doubler-les-moyens-du-renseignement-interieur",
        "sortir-de-l-euro",
        "referendum-sur-la-sortie-de-l-ue",
        "creer-une-armee-europeenne"
      ]
    },
    {
      "id": "energy-climate-transport-agriculture",
      "title": "Énergie, climat, transports et agriculture",
      "domains": [
        "Électricité",
        "Climat",
        "Mobilités",
        "Agriculture"
      ],
      "opening": "La transition transforme les infrastructures, les prix et l'aménagement du territoire.",
      "tension": "Accélérer coûte maintenant. Attendre reporte le coût et augmente certains risques.",
      "decisionIds": [
        "doubler-maprimerenov",
        "plan-ferroviaire-3-000-m-de-plus",
        "engager-six-epr2-part-annuelle-de-l",
        "retablir-une-trajectoire-carbone-recettes-redistribuees",
        "sortie-du-nucleaire-en-2040",
        "moratoire-sur-les-renouvelables",
        "interdire-les-voitures-thermiques-en-2030"
      ]
    },
    {
      "id": "education-housing-family",
      "title": "Éducation, logement et famille",
      "domains": [
        "École",
        "Université",
        "Logement",
        "Famille"
      ],
      "opening": "Ces politiques déterminent les possibilités offertes aux générations présentes et futures.",
      "tension": "Les économies rapides peuvent produire des coûts durables sur l'égalité et l'attractivité.",
      "decisionIds": [
        "revaloriser-les-enseignants-de-5",
        "doubler-les-bourses-etudiantes-sur-criteres",
        "financer-100-000-logements-sociaux-de-plus",
        "revaloriser-les-apl-de-5",
        "cheque-education-par-eleve",
        "supprimer-le-financement-public-du-prive",
        "autonomie-complete-des-etablissements"
      ]
    },
    {
      "id": "state-institutions-territories",
      "title": "État, institutions et territoires",
      "domains": [
        "Administration",
        "Institutions",
        "Collectivités",
        "Services publics"
      ],
      "opening": "Le dernier chapitre interroge la machine publique elle-même et la manière dont le pouvoir est réparti.",
      "tension": "Transformer l'État peut dégager des marges, mais fragilise les équilibres qui permettent encore d'agir.",
      "decisionIds": [
        "reduire-de-5-les-dotations-aux-collectivites",
        "regle-d-or-constitutionnelle",
        "geler-le-point-d-indice-en-2026",
        "ne-pas-remplacer-un-depart-administratif-sur",
        "fermer-un-tiers-des-agences-et-operateurs",
        "diviser-par-deux-le-nombre-de-parlementaires",
        "proportionnelle-integrale"
      ]
    }
  ],
  "decisions": [
    {
      "id": "geler-le-bareme-de-l-impot-sur",
      "version": 3,
      "kind": "gestion",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il geler le barème de l'impôt sur le revenu ?",
      "context": "Sans indexation, l'inflation fait entrer des foyers dans l'impôt ou dans une tranche supérieure, même si leur pouvoir d'achat ne progresse pas.",
      "options": [
        {
          "id": "geler-le-bareme-de-l-impot-sur:adopt",
          "label": "Geler le barème",
          "summary": "Le rendement augmente mécaniquement, au prix d'une hausse d'impôt diffuse pour les foyers imposables.",
          "mechanism": "Laisser les seuils nominaux inchangés pendant une année fiscale afin que l'inflation augmente l'impôt dû à revenu réel constant.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de finances",
            "Définir la référence d'inflation et la période de non-indexation",
            "Contrôler l'égalité devant les charges publiques"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "foyers imposables"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "geler-le-bareme-de-l-impot-sur:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1700,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Laisser les seuils nominaux inchangés pendant une année fiscale afin que l'inflation augmente l'impôt dû à revenu réel constant. Impact budgétaire retenu par le jeu : 1700 millions d'euros."
            },
            {
              "id": "geler-le-bareme-de-l-impot-sur:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Laisser les seuils nominaux inchangés pendant une année fiscale afin que l'inflation augmente l'impôt dû à revenu réel constant."
            },
            {
              "id": "geler-le-bareme-de-l-impot-sur:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Laisser les seuils nominaux inchangés pendant une année fiscale afin que l'inflation augmente l'impôt dû à revenu réel constant."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "flat-tax-a-20-des-le-premier"
          ],
          "unlocks": []
        },
        {
          "id": "geler-le-bareme-de-l-impot-sur:keep",
          "label": "Indexer sur l'inflation",
          "summary": "Le pouvoir d'achat fiscal est protégé, mais l'État renonce à la recette supplémentaire.",
          "mechanism": "Relever les seuils selon l'inflation observée afin de neutraliser la progression purement nominale des revenus.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "foyers imposables",
            "classes moyennes"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "geler-le-bareme-de-l-impot-sur:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les seuils selon l'inflation observée afin de neutraliser la progression purement nominale des revenus."
            },
            {
              "id": "geler-le-bareme-de-l-impot-sur:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les seuils selon l'inflation observée afin de neutraliser la progression purement nominale des revenus."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Évaluations des voies et moyens : la hausse d'impôt que personne ne vote : l'inflation fait monter tout le monde d'une tranche.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "Évaluation des recettes de l'État annexée au projet de loi de finances pour 2026."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "flat-tax-a-20-des-le-premier",
        "flat-tax-a-20-avec-abattement-protegeant"
      ]
    },
    {
      "id": "porter-le-taux-normal-de-tva-a",
      "version": 3,
      "kind": "gestion",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il porter le taux normal de TVA à 21 % ?",
      "context": "Un point de TVA fournit une recette massive et rapide, mais renchérit les achats au taux normal si les entreprises le répercutent.",
      "options": [
        {
          "id": "porter-le-taux-normal-de-tva-a:adopt",
          "label": "Passer la TVA à 21 %",
          "summary": "Le déficit baisse rapidement, tandis que consommateurs et entreprises absorbent la hausse des prix.",
          "mechanism": "Relever à 21 % le taux appliqué à l'assiette actuellement au taux normal, avec des règles transitoires de facturation.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de finances",
            "Directive TVA",
            "Définir la date d'exigibilité et les règles transitoires"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "consommateurs"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "porter-le-taux-normal-de-tva-a:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 9800,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Relever à 21 % le taux appliqué à l'assiette actuellement au taux normal, avec des règles transitoires de facturation. Impact budgétaire retenu par le jeu : 9800 millions d'euros."
            },
            {
              "id": "porter-le-taux-normal-de-tva-a:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -5,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Relever à 21 % le taux appliqué à l'assiette actuellement au taux normal, avec des règles transitoires de facturation."
            },
            {
              "id": "porter-le-taux-normal-de-tva-a:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -4,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Relever à 21 % le taux appliqué à l'assiette actuellement au taux normal, avec des règles transitoires de facturation."
            },
            {
              "id": "porter-le-taux-normal-de-tva-a:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Relever à 21 % le taux appliqué à l'assiette actuellement au taux normal, avec des règles transitoires de facturation."
            },
            {
              "id": "porter-le-taux-normal-de-tva-a:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Relever à 21 % le taux appliqué à l'assiette actuellement au taux normal, avec des règles transitoires de facturation."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "porter-le-taux-normal-de-tva-a:keep",
          "label": "Maintenir la TVA à 20 %",
          "summary": "Les prix ne subissent pas cette hausse fiscale, mais près de dix milliards d'euros restent à trouver.",
          "mechanism": "Conserver le taux normal à 20 % et éviter le choc de prix associé au point supplémentaire.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "consommateurs",
            "ménages modestes",
            "classes moyennes"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "porter-le-taux-normal-de-tva-a:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le taux normal à 20 % et éviter le choc de prix associé au point supplémentaire."
            },
            {
              "id": "porter-le-taux-normal-de-tva-a:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le taux normal à 20 % et éviter le choc de prix associé au point supplémentaire."
            },
            {
              "id": "porter-le-taux-normal-de-tva-a:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le taux normal à 20 % et éviter le choc de prix associé au point supplémentaire."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Rendement d'un point de TVA, évaluations des voies et moyens.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "Évaluation des recettes de l'État annexée au projet de loi de finances pour 2026."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "tranche-a-50-au-dela-de-250",
      "version": 3,
      "kind": "transformation",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il créer une tranche à 50 % au-delà de 250 000 euros ?",
      "context": "La mesure augmente la progressivité sur les très hauts revenus. Son rendement dépend de l'assiette réellement maintenue et des comportements d'optimisation.",
      "options": [
        {
          "id": "tranche-a-50-au-dela-de-250:adopt",
          "label": "Créer la tranche à 50 %",
          "summary": "Les très hauts revenus paient davantage et le barème devient plus progressif.",
          "mechanism": "Appliquer 50 % uniquement à la fraction du revenu imposable dépassant 250 000 euros selon une unité fiscale définie.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de finances",
            "Préciser si le seuil est individuel ou par foyer",
            "Quotient familial",
            "Caractère non confiscatoire"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "progressivité fiscale"
          ],
          "contributors": [
            "très hauts revenus"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "tranche-a-50-au-dela-de-250:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1200,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Appliquer 50 % uniquement à la fraction du revenu imposable dépassant 250 000 euros selon une unité fiscale définie. Impact budgétaire retenu par le jeu : 1200 millions d'euros."
            },
            {
              "id": "tranche-a-50-au-dela-de-250:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Appliquer 50 % uniquement à la fraction du revenu imposable dépassant 250 000 euros selon une unité fiscale définie."
            },
            {
              "id": "tranche-a-50-au-dela-de-250:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -1,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Appliquer 50 % uniquement à la fraction du revenu imposable dépassant 250 000 euros selon une unité fiscale définie."
            },
            {
              "id": "tranche-a-50-au-dela-de-250:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Appliquer 50 % uniquement à la fraction du revenu imposable dépassant 250 000 euros selon une unité fiscale définie."
            }
          ],
          "scheduledEvents": [
            {
              "id": "tax-base-reaction",
              "title": "Stress de scénario sur l'assiette",
              "body": "Dans le stress retenu par le jeu, certains contribuables adaptent leurs versements ou leur résidence, ce qui fragilise le rendement attendu sans le prédire avec certitude.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "tax-base-reaction:indicator:financialCredibility",
                  "target": "indicator",
                  "key": "financialCredibility",
                  "delta": -2,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Dans le stress retenu par le jeu, certains contribuables adaptent leurs versements ou leur résidence, ce qui fragilise le rendement attendu sans le prédire avec certitude."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "flat-tax-a-20-des-le-premier"
          ],
          "unlocks": []
        },
        {
          "id": "tranche-a-50-au-dela-de-250:keep",
          "label": "Conserver le taux supérieur actuel",
          "summary": "Les très hauts revenus évitent la nouvelle tranche, mais le budget renonce à son rendement.",
          "mechanism": "Conserver la tranche supérieure et l'incitation marginale actuelle au-delà du seuil proposé.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "très hauts revenus"
          ],
          "contributors": [
            "finances publiques",
            "progressivité fiscale"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "tranche-a-50-au-dela-de-250:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la tranche supérieure et l'incitation marginale actuelle au-delà du seuil proposé."
            },
            {
              "id": "tranche-a-50-au-dela-de-250:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la tranche supérieure et l'incitation marginale actuelle au-delà du seuil proposé."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Amendements PLF chiffrés par la commission des finances.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "Évaluation des recettes de l'État annexée au projet de loi de finances pour 2026."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "flat-tax-a-20-des-le-premier",
        "flat-tax-a-20-avec-abattement-protegeant"
      ]
    },
    {
      "id": "retablir-un-impot-sur-la-fortune-financiere",
      "version": 3,
      "kind": "transformation",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il rétablir un impôt sur la fortune financière ?",
      "context": "Un impôt sur les actifs financiers élargit la taxation du patrimoine au-delà de l'immobilier. Son assiette est mobile et sensible aux exemptions.",
      "options": [
        {
          "id": "retablir-un-impot-sur-la-fortune-financiere:adopt",
          "label": "Rétablir l'impôt",
          "summary": "Les grands patrimoines financiers contribuent à nouveau, avec un risque d'optimisation accru.",
          "mechanism": "Taxer le patrimoine financier net au-dessus d'un seuil avec des règles de dette, valorisation, liquidité et actifs professionnels. Les 4 500 millions d'euros et l'effet d'investissement sont les hypothèses centrales du jeu, pas une prévision.",
          "horizon": {
            "kind": "mandate_year",
            "year": 2
          },
          "legalConstraints": [
            "Loi de finances définissant seuil, assiette nette, dettes déductibles, actifs professionnels, exonérations, valorisation et plafonnement",
            "Respecter l'égalité devant les charges publiques et prévenir une charge confiscatoire, notamment pour les actifs illiquides",
            "Assurer une valorisation contradictoire des titres non cotés et permettre un paiement différé si la liquidité est insuffisante",
            "Respecter les libertés de circulation, la non-discrimination, les conventions fiscales et la double imposition",
            "Si une exit tax accompagne la réforme, la limiter à l'anti-évitement proportionné avec sursis, garanties et dégrèvement compatibles avec l'Union"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "grands patrimoines financiers"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "retablir-un-impot-sur-la-fortune-financiere:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 4500,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Taxer le patrimoine financier net au-dessus d'un seuil avec des règles de dette, valorisation, liquidité et actifs professionnels. Les 4 500 millions d'euros et l'effet d'investissement sont les hypothèses centrales du jeu, pas une prévision. Impact budgétaire retenu par le jeu : 4500 millions d'euros."
            },
            {
              "id": "retablir-un-impot-sur-la-fortune-financiere:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Taxer le patrimoine financier net au-dessus d'un seuil avec des règles de dette, valorisation, liquidité et actifs professionnels. Les 4 500 millions d'euros et l'effet d'investissement sont les hypothèses centrales du jeu, pas une prévision."
            },
            {
              "id": "retablir-un-impot-sur-la-fortune-financiere:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Taxer le patrimoine financier net au-dessus d'un seuil avec des règles de dette, valorisation, liquidité et actifs professionnels. Les 4 500 millions d'euros et l'effet d'investissement sont les hypothèses centrales du jeu, pas une prévision."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "retablir-un-impot-sur-la-fortune-financiere:keep",
          "label": "Conserver l'impôt immobilier",
          "summary": "La fiscalité reste concentrée sur l'immobilier et aucune recette nouvelle n'est créée.",
          "mechanism": "Laisser les actifs financiers hors de l'impôt sur la fortune et conserver l'imposition immobilière actuelle.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "grands patrimoines financiers"
          ],
          "contributors": [
            "finances publiques",
            "égalité de traitement entre patrimoines mobiliers et immobiliers"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "retablir-un-impot-sur-la-fortune-financiere:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Laisser les actifs financiers hors de l'impôt sur la fortune et conserver l'imposition immobilière actuelle."
            },
            {
              "id": "retablir-un-impot-sur-la-fortune-financiere:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Laisser les actifs financiers hors de l'impôt sur la fortune et conserver l'imposition immobilière actuelle."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Chiffrages parlementaires, selon l'assiette retenue.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "Évaluation des recettes de l'État annexée au projet de loi de finances pour 2026."
        },
        {
          "label": "Chiffrages parlementaires, selon l'assiette retenue.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "Situation et trajectoire des finances publiques françaises."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "soumettre-les-revenus-du-capital-au-bareme",
      "version": 3,
      "kind": "transformation",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il soumettre les revenus du capital au barème ?",
      "context": "Le prélèvement forfaitaire limite aujourd'hui le taux sur les revenus financiers. Le supprimer rétablit le barème progressif, avec une assiette plus sensible aux arbitrages.",
      "options": [
        {
          "id": "soumettre-les-revenus-du-capital-au-bareme:adopt",
          "label": "Supprimer le prélèvement forfaitaire",
          "summary": "Les détenteurs de capital imposés dans les tranches hautes paient davantage.",
          "mechanism": "Remplacer la composante d'impôt sur le revenu du prélèvement forfaitaire par le barème progressif pour les revenus financiers couverts.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de finances",
            "Définir le champ dividendes, intérêts et plus-values",
            "Préciser abattements, moins-values et prélèvements sociaux"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "progressivité fiscale"
          ],
          "contributors": [
            "détenteurs de capital"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "soumettre-les-revenus-du-capital-au-bareme:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Remplacer la composante d'impôt sur le revenu du prélèvement forfaitaire par le barème progressif pour les revenus financiers couverts. Impact budgétaire retenu par le jeu : 1000 millions d'euros."
            },
            {
              "id": "soumettre-les-revenus-du-capital-au-bareme:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Remplacer la composante d'impôt sur le revenu du prélèvement forfaitaire par le barème progressif pour les revenus financiers couverts."
            },
            {
              "id": "soumettre-les-revenus-du-capital-au-bareme:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Remplacer la composante d'impôt sur le revenu du prélèvement forfaitaire par le barème progressif pour les revenus financiers couverts."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "flat-tax-a-20-des-le-premier"
          ],
          "unlocks": []
        },
        {
          "id": "soumettre-les-revenus-du-capital-au-bareme:keep",
          "label": "Conserver le prélèvement forfaitaire",
          "summary": "Le taux reste lisible et stable pour l'épargne, sans recette supplémentaire.",
          "mechanism": "Conserver le taux forfaitaire et la lisibilité du rendement après impôt de l'épargne financière.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "détenteurs de capital",
            "épargnants imposés dans les tranches hautes"
          ],
          "contributors": [
            "finances publiques",
            "progressivité entre revenus du travail et du capital"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "soumettre-les-revenus-du-capital-au-bareme:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le taux forfaitaire et la lisibilité du rendement après impôt de l'épargne financière."
            },
            {
              "id": "soumettre-les-revenus-du-capital-au-bareme:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le taux forfaitaire et la lisibilité du rendement après impôt de l'épargne financière."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Évaluations du PLF, comportements de versement compris.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "Évaluation des recettes de l'État annexée au projet de loi de finances pour 2026."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "flat-tax-a-20-des-le-premier",
        "flat-tax-a-20-avec-abattement-protegeant"
      ]
    },
    {
      "id": "exonerer-de-droits-de-succession-jusqu-a",
      "version": 3,
      "kind": "transformation",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il exonérer jusqu'à 300 000 euros transmis par enfant ?",
      "context": "L'abattement faciliterait les transmissions familiales, mais concentrerait l'avantage sur les héritages les plus élevés et réduirait les recettes.",
      "options": [
        {
          "id": "exonerer-de-droits-de-succession-jusqu-a:adopt",
          "label": "Porter l'abattement à 300 000 euros",
          "summary": "Davantage d'héritages échappent aux droits, au prix d'une perte de recettes durable.",
          "mechanism": "Relever à 300 000 euros l'abattement en ligne directe par enfant et par donateur en précisant la période de rappel.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de finances",
            "Distinguer dons et successions",
            "Préciser la période de rappel",
            "Égalité entre situations familiales"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "héritiers de patrimoines élevés"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "exonerer-de-droits-de-succession-jusqu-a:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -2500,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Relever à 300 000 euros l'abattement en ligne directe par enfant et par donateur en précisant la période de rappel. Impact budgétaire retenu par le jeu : -2500 millions d'euros."
            },
            {
              "id": "exonerer-de-droits-de-succession-jusqu-a:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Relever à 300 000 euros l'abattement en ligne directe par enfant et par donateur en précisant la période de rappel."
            },
            {
              "id": "exonerer-de-droits-de-succession-jusqu-a:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Relever à 300 000 euros l'abattement en ligne directe par enfant et par donateur en précisant la période de rappel."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "abolir-les-droits-de-succession"
          ],
          "unlocks": []
        },
        {
          "id": "exonerer-de-droits-de-succession-jusqu-a:keep",
          "label": "Conserver les abattements actuels",
          "summary": "Les recettes sont préservées et les transmissions supérieures restent taxées.",
          "mechanism": "Conserver les seuils et la progressivité actuels des transmissions.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "non-héritiers"
          ],
          "contributors": [
            "héritiers de patrimoines taxables"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "exonerer-de-droits-de-succession-jusqu-a:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les seuils et la progressivité actuels des transmissions."
            },
            {
              "id": "exonerer-de-droits-de-succession-jusqu-a:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les seuils et la progressivité actuels des transmissions."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Chiffrages parlementaires des propositions déposées.",
          "sourceName": "France Stratégie",
          "sourceUrl": "https://www.strategie.gouv.fr/files/files/Publications/Rapport/ns-fiscalite-heritages-26-janvier-2018.pdf",
          "publishedAt": "2018-01-26",
          "note": "Fiscalité des héritages et effets des règles de transmission."
        },
        {
          "label": "Chiffrages parlementaires des propositions déposées.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "Évaluation des recettes de l'État annexée au projet de loi de finances pour 2026."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "abolir-les-droits-de-succession"
      ]
    },
    {
      "id": "flat-tax-a-20-des-le-premier",
      "version": 3,
      "kind": "rupture",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il remplacer le barème par une flat tax à 20 % dès le premier euro ?",
      "context": "Le barème progressif disparaît. Tous les revenus déclarés sont taxés au même taux et les foyers aujourd'hui non imposables entrent dans l'impôt.",
      "options": [
        {
          "id": "flat-tax-a-20-des-le-premier:adopt",
          "label": "Passer à 20 % dès le premier euro",
          "summary": "L'impôt est simplifié et rapporte beaucoup plus, mais près de six foyers sur dix passent de zéro à 20 %.",
          "mechanism": "Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée. Le rendement de 150 000 millions d'euros est l'arithmétique brute du jeu, sans comportement, fraude ni adaptation; ce n'est pas une prévision.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de finances",
            "Risque constitutionnel sur les facultés contributives",
            "Traiter les charges de famille et le revenu minimum",
            "Préciser assiette et prélèvements sociaux"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "hauts revenus"
          ],
          "contributors": [
            "foyers aujourd'hui non imposables",
            "classes moyennes"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "flat-tax-a-20-des-le-premier:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 150000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée. Le rendement de 150 000 millions d'euros est l'arithmétique brute du jeu, sans comportement, fraude ni adaptation; ce n'est pas une prévision. Impact budgétaire retenu par le jeu : 150000 millions d'euros."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -12,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée. Le rendement de 150 000 millions d'euros est l'arithmétique brute du jeu, sans comportement, fraude ni adaptation; ce n'est pas une prévision."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -6,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée. Le rendement de 150 000 millions d'euros est l'arithmétique brute du jeu, sans comportement, fraude ni adaptation; ce n'est pas une prévision."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -10,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée. Le rendement de 150 000 millions d'euros est l'arithmétique brute du jeu, sans comportement, fraude ni adaptation; ce n'est pas une prévision."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -8,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée. Le rendement de 150 000 millions d'euros est l'arithmétique brute du jeu, sans comportement, fraude ni adaptation; ce n'est pas une prévision."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée. Le rendement de 150 000 millions d'euros est l'arithmétique brute du jeu, sans comportement, fraude ni adaptation; ce n'est pas une prévision."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "geler-le-bareme-de-l-impot-sur",
            "tranche-a-50-au-dela-de-250",
            "soumettre-les-revenus-du-capital-au-bareme"
          ],
          "unlocks": []
        },
        {
          "id": "flat-tax-a-20-des-le-premier:keep",
          "label": "Garder le barème progressif",
          "summary": "Les foyers modestes restent protégés et la progressivité demeure, au prix d'un rendement inférieur.",
          "mechanism": "Conserver le seuil d'entrée, les charges de famille et la progressivité des taux.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "foyers aujourd'hui non imposables",
            "classes moyennes",
            "progressivité fiscale"
          ],
          "contributors": [
            "finances publiques",
            "hauts revenus soumis au barème actuel"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "flat-tax-a-20-des-le-premier:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil d'entrée, les charges de famille et la progressivité des taux."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil d'entrée, les charges de famille et la progressivité des taux."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil d'entrée, les charges de famille et la progressivité des taux."
            },
            {
              "id": "flat-tax-a-20-des-le-premier:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil d'entrée, les charges de famille et la progressivité des taux."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Arithmétique sur les revenus déclarés : 20 % de l'assiette rapportent bien plus que les ~90 000 M€ nets de l'IR actuel. Mais près de 6 foyers sur 10 ne paient rien aujourd'hui : pour eux ce n'est pas une économie, c'est 0 → 20 %. Personne ne la propose telle quelle.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "arithmétique brute"
        },
        {
          "label": "Arithmétique sur les revenus déclarés : 20 % de l'assiette rapportent bien plus que les ~90 000 M€ nets de l'IR actuel. Mais près de 6 foyers sur 10 ne paient rien aujourd'hui : pour eux ce n'est pas une économie, c'est 0 → 20 %. Personne ne la propose telle quelle.",
          "sourceName": "Insee",
          "sourceUrl": "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
          "publishedAt": "2025-11-20",
          "note": "arithmétique brute"
        }
      ],
      "dependencies": [],
      "conflicts": [
        "flat-tax-a-20-avec-abattement-protegeant",
        "geler-le-bareme-de-l-impot-sur",
        "tranche-a-50-au-dela-de-250",
        "soumettre-les-revenus-du-capital-au-bareme"
      ]
    },
    {
      "id": "abolir-les-droits-de-succession",
      "version": 3,
      "kind": "rupture",
      "chapterId": "taxes-assets-transmission",
      "title": "Faut-il abolir les droits de succession ?",
      "context": "La transmission familiale ne serait plus taxée, quelle que soit la taille du patrimoine. Le manque à gagner doit être financé ailleurs et les inégalités de patrimoine se transmettent davantage.",
      "options": [
        {
          "id": "abolir-les-droits-de-succession:adopt",
          "label": "Abolir les droits",
          "summary": "Tous les héritages sont transmis sans impôt et le budget perd une recette importante.",
          "mechanism": "Fixer à zéro les taux des droits de succession tout en conservant la déclaration et la valorisation des actifs.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de finances",
            "Préciser le sort des donations",
            "Régimes transfrontaliers et conventions fiscales"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "héritiers",
            "grands patrimoines"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "abolir-les-droits-de-succession:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -18000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Fixer à zéro les taux des droits de succession tout en conservant la déclaration et la valorisation des actifs. Impact budgétaire retenu par le jeu : -18000 millions d'euros."
            },
            {
              "id": "abolir-les-droits-de-succession:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -5,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Fixer à zéro les taux des droits de succession tout en conservant la déclaration et la valorisation des actifs."
            },
            {
              "id": "abolir-les-droits-de-succession:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Fixer à zéro les taux des droits de succession tout en conservant la déclaration et la valorisation des actifs."
            },
            {
              "id": "abolir-les-droits-de-succession:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Fixer à zéro les taux des droits de succession tout en conservant la déclaration et la valorisation des actifs."
            }
          ],
          "scheduledEvents": [
            {
              "id": "inheritance-wealth-gap",
              "title": "L'écart patrimonial se creuse",
              "body": "Les transmissions nettes d'impôt accroissent l'écart relatif entre héritiers et ménages sans patrimoine transmis.",
              "afterDecisions": 4,
              "effects": [
                {
                  "id": "inheritance-wealth-gap:group:lowIncomeHouseholds",
                  "target": "group",
                  "key": "lowIncomeHouseholds",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les transmissions nettes d'impôt accroissent l'écart relatif entre héritiers et ménages sans patrimoine transmis."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "exonerer-de-droits-de-succession-jusqu-a"
          ],
          "unlocks": []
        },
        {
          "id": "abolir-les-droits-de-succession:keep",
          "label": "Maintenir les droits",
          "summary": "Les héritages restent taxés avec abattements et progressivité, et la recette est conservée.",
          "mechanism": "Conserver les abattements, la progressivité et la recette sur les transmissions taxables.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "non-héritiers"
          ],
          "contributors": [
            "héritiers"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "abolir-les-droits-de-succession:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les abattements, la progressivité et la recette sur les transmissions taxables."
            },
            {
              "id": "abolir-les-droits-de-succession:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les abattements, la progressivité et la recette sur les transmissions taxables."
            },
            {
              "id": "abolir-les-droits-de-succession:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les abattements, la progressivité et la recette sur les transmissions taxables."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Recettes des droits de mutation et distribution des héritages.",
          "sourceName": "France Stratégie",
          "sourceUrl": "https://www.strategie.gouv.fr/files/files/Publications/Rapport/ns-fiscalite-heritages-26-janvier-2018.pdf",
          "publishedAt": "2018-01-26",
          "note": "Le coût retenu par le jeu est un ordre de grandeur annuel construit à partir des recettes observées."
        },
        {
          "label": "Recettes des droits de mutation et distribution des héritages.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30583",
          "publishedAt": "2025-10-14",
          "note": "Le coût retenu par le jeu est un ordre de grandeur annuel construit à partir des recettes observées."
        },
        {
          "label": "Recettes des droits de mutation et distribution des héritages.",
          "sourceName": "Institut Thomas More",
          "sourceUrl": "https://institut-thomas-more.org/2026/06/25/rapport36/",
          "publishedAt": "2026-06-25",
          "note": "Le coût retenu par le jeu est un ordre de grandeur annuel construit à partir des recettes observées."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "exonerer-de-droits-de-succession-jusqu-a",
        "raboter-l-avantage-successoral-de-l-assurance"
      ]
    },
    {
      "id": "supprimer-les-allegements-de-cotisations-entre-2",
      "version": 3,
      "kind": "gestion",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il supprimer les allègements au-dessus de 2,5 SMIC ?",
      "context": "Les allègements réduisent le coût du travail. Leur effet sur l'emploi est mieux établi près du SMIC et plus discuté pour les salaires élevés.",
      "options": [
        {
          "id": "supprimer-les-allegements-de-cotisations-entre-2:adopt",
          "label": "Supprimer les allègements supérieurs",
          "summary": "Les entreprises cotisent davantage sur les hauts salaires et le budget social récupère une recette.",
          "mechanism": "Supprimer les allègements de cotisations spécifiquement entre 2,5 et 3,5 SMIC.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de financement de la sécurité sociale",
            "Définir la bande 2,5 à 3,5 SMIC",
            "Prévoir la transition de paie"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances sociales"
          ],
          "contributors": [
            "employeurs de salariés au-dessus de 2,5 SMIC"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "supprimer-les-allegements-de-cotisations-entre-2:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 2000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Supprimer les allègements de cotisations spécifiquement entre 2,5 et 3,5 SMIC. Impact budgétaire retenu par le jeu : 2000 millions d'euros."
            },
            {
              "id": "supprimer-les-allegements-de-cotisations-entre-2:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": -1,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Supprimer les allègements de cotisations spécifiquement entre 2,5 et 3,5 SMIC."
            },
            {
              "id": "supprimer-les-allegements-de-cotisations-entre-2:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Supprimer les allègements de cotisations spécifiquement entre 2,5 et 3,5 SMIC."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "supprimer-les-allegements-de-cotisations-entre-2:keep",
          "label": "Conserver les allègements",
          "summary": "Le coût du travail reste inchangé pour les entreprises, sans économie budgétaire.",
          "mechanism": "Conserver le coût du travail actuel dans la bande de salaires concernée.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "employeurs de salariés entre 2,5 et 3,5 SMIC"
          ],
          "contributors": [
            "finances sociales"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "supprimer-les-allegements-de-cotisations-entre-2:keep:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le coût du travail actuel dans la bande de salaires concernée."
            },
            {
              "id": "supprimer-les-allegements-de-cotisations-entre-2:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le coût du travail actuel dans la bande de salaires concernée."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Rapports sur les allègements généraux (LFSS).",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "repousser-l-age-legal-a-65-ans",
      "version": 3,
      "kind": "transformation",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il porter l'âge légal de départ à 65 ans ?",
      "context": "Le système gagne des cotisations et verse certaines pensions plus tard. L'effort se concentre sur les actifs qui ne peuvent pas partir avant l'âge légal.",
      "options": [
        {
          "id": "repousser-l-age-legal-a-65-ans:adopt",
          "label": "Porter l'âge légal à 65 ans",
          "summary": "L'équilibre des retraites s'améliore à terme et les actifs concernés travaillent plus longtemps.",
          "mechanism": "Prolonger par cohorte la trajectoire actuelle vers 65 ans avec des règles de carrière longue, handicap, incapacité et pénibilité.",
          "horizon": {
            "kind": "mandate_year",
            "year": 5
          },
          "legalConstraints": [
            "Loi ordinaire et sécurité sociale",
            "Transition par génération",
            "Égalité entre cohortes",
            "Carrières longues, handicap et pénibilité"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "mandate_year",
            "year": 5
          },
          "beneficiaries": [
            "finances sociales",
            "cotisants futurs"
          ],
          "contributors": [
            "actifs proches de la retraite"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "repousser-l-age-legal-a-65-ans:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 8500,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "annual",
              "explanation": "Prolonger par cohorte la trajectoire actuelle vers 65 ans avec des règles de carrière longue, handicap, incapacité et pénibilité. Impact budgétaire retenu par le jeu : 8500 millions d'euros."
            },
            {
              "id": "repousser-l-age-legal-a-65-ans:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Prolonger par cohorte la trajectoire actuelle vers 65 ans avec des règles de carrière longue, handicap, incapacité et pénibilité."
            },
            {
              "id": "repousser-l-age-legal-a-65-ans:adopt:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": -5,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Prolonger par cohorte la trajectoire actuelle vers 65 ans avec des règles de carrière longue, handicap, incapacité et pénibilité."
            },
            {
              "id": "repousser-l-age-legal-a-65-ans:adopt:group:unions",
              "target": "group",
              "key": "unions",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Prolonger par cohorte la trajectoire actuelle vers 65 ans avec des règles de carrière longue, handicap, incapacité et pénibilité."
            }
          ],
          "scheduledEvents": [
            {
              "id": "senior-employment-test",
              "title": "L'emploi des seniors devient le juge de paix",
              "body": "Une partie des seniors bascule vers le chômage, l'invalidité ou la maladie et réduit l'effet emploi attendu.",
              "afterDecisions": 12,
              "effects": [
                {
                  "id": "senior-employment-test:indicator:employment",
                  "target": "indicator",
                  "key": "employment",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Une partie des seniors bascule vers le chômage, l'invalidité ou la maladie et réduit l'effet emploi attendu."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "revenir-a-62-ans"
          ],
          "unlocks": []
        },
        {
          "id": "repousser-l-age-legal-a-65-ans:keep",
          "label": "Ne pas aller jusqu'à 65 ans",
          "summary": "L'âge actuel est conservé et le besoin de financement reste plus élevé.",
          "mechanism": "Poursuivre la montée en charge de la règle actuelle vers 64 ans.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "actifs proches de la retraite",
            "salariés du privé",
            "syndicats"
          ],
          "contributors": [
            "finances sociales",
            "cotisants futurs"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "repousser-l-age-legal-a-65-ans:keep:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre la montée en charge de la règle actuelle vers 64 ans."
            },
            {
              "id": "repousser-l-age-legal-a-65-ans:keep:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre la montée en charge de la règle actuelle vers 64 ans."
            },
            {
              "id": "repousser-l-age-legal-a-65-ans:keep:group:unions",
              "target": "group",
              "key": "unions",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre la montée en charge de la règle actuelle vers 64 ans."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Ordres de grandeur du COR ; presque rien les premières années.",
          "sourceName": "Conseil d'orientation des retraites",
          "sourceUrl": "https://www.cor-retraites.fr/rapports-du-cor/rapport-annuel-cor-juin-2025-evolutions-perspectives-retraites-france",
          "publishedAt": "2025-06-12",
          "note": "en croisière"
        }
      ],
      "dependencies": [],
      "conflicts": [
        "revenir-a-62-ans"
      ]
    },
    {
      "id": "revenir-a-62-ans",
      "version": 3,
      "kind": "transformation",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il rétablir l'âge légal à 62 ans ?",
      "context": "Le départ plus précoce rend du temps aux actifs concernés, mais accroît le nombre d'années de pension et le besoin de financement.",
      "options": [
        {
          "id": "revenir-a-62-ans:adopt",
          "label": "Rétablir 62 ans",
          "summary": "Les générations concernées partent plus tôt et les comptes de retraite se dégradent durablement.",
          "mechanism": "Inverser le calendrier par cohorte et rétablir l'éligibilité à 62 ans sans diminuer les droits acquis.",
          "horizon": {
            "kind": "mandate_year",
            "year": 5
          },
          "legalConstraints": [
            "Loi ordinaire et sécurité sociale",
            "Transition par génération",
            "Droits acquis",
            "Carrières longues et durée de cotisation"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "mandate_year",
            "year": 5
          },
          "beneficiaries": [
            "actifs proches de la retraite"
          ],
          "contributors": [
            "finances sociales",
            "cotisants futurs"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "revenir-a-62-ans:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -13000,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "annual",
              "explanation": "Inverser le calendrier par cohorte et rétablir l'éligibilité à 62 ans sans diminuer les droits acquis. Impact budgétaire retenu par le jeu : -13000 millions d'euros."
            },
            {
              "id": "revenir-a-62-ans:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Inverser le calendrier par cohorte et rétablir l'éligibilité à 62 ans sans diminuer les droits acquis."
            },
            {
              "id": "revenir-a-62-ans:adopt:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": 4,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Inverser le calendrier par cohorte et rétablir l'éligibilité à 62 ans sans diminuer les droits acquis."
            },
            {
              "id": "revenir-a-62-ans:adopt:group:retirees",
              "target": "group",
              "key": "retirees",
              "delta": 3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Inverser le calendrier par cohorte et rétablir l'éligibilité à 62 ans sans diminuer les droits acquis."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "repousser-l-age-legal-a-65-ans"
          ],
          "unlocks": []
        },
        {
          "id": "revenir-a-62-ans:keep",
          "label": "Conserver l'âge actuel",
          "summary": "La réforme en vigueur poursuit sa montée en charge et limite le déficit futur.",
          "mechanism": "Poursuivre la montée vers 64 ans et les cotisations supplémentaires attendues.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances sociales",
            "cotisants futurs"
          ],
          "contributors": [
            "actifs proches de la retraite"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "revenir-a-62-ans:keep:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre la montée vers 64 ans et les cotisations supplémentaires attendues."
            },
            {
              "id": "revenir-a-62-ans:keep:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre la montée vers 64 ans et les cotisations supplémentaires attendues."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Chiffrages COR de l'abrogation, horizon 2030.",
          "sourceName": "Conseil d'orientation des retraites",
          "sourceUrl": "https://www.cor-retraites.fr/rapports-du-cor/rapport-annuel-cor-juin-2025-evolutions-perspectives-retraites-france",
          "publishedAt": "2025-06-12",
          "note": "à terme"
        }
      ],
      "dependencies": [],
      "conflicts": [
        "repousser-l-age-legal-a-65-ans"
      ]
    },
    {
      "id": "desindexer-les-pensions-d-un-point",
      "version": 3,
      "kind": "transformation",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il indexer les pensions un point sous l'inflation ?",
      "context": "La désindexation produit une économie immédiate et cumulative. Elle réduit le pouvoir d'achat de tous les retraités, y compris les petites pensions si aucune compensation n'est prévue.",
      "options": [
        {
          "id": "desindexer-les-pensions-d-un-point:adopt",
          "label": "Sous-indexer d'un point",
          "summary": "Les pensions progressent moins vite que les prix et les comptes sociaux économisent plusieurs milliards.",
          "mechanism": "Appliquer inflation moins un point à la revalorisation annuelle des pensions en précisant un éventuel plancher.",
          "horizon": {
            "kind": "mandate_year",
            "year": 1
          },
          "legalConstraints": [
            "Loi de financement de la sécurité sociale",
            "Date de revalorisation",
            "Égalité en cas de plancher ou compensation"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances sociales"
          ],
          "contributors": [
            "retraités"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "desindexer-les-pensions-d-un-point:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 3600,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Appliquer inflation moins un point à la revalorisation annuelle des pensions en précisant un éventuel plancher. Impact budgétaire retenu par le jeu : 3600 millions d'euros."
            },
            {
              "id": "desindexer-les-pensions-d-un-point:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Appliquer inflation moins un point à la revalorisation annuelle des pensions en précisant un éventuel plancher."
            },
            {
              "id": "desindexer-les-pensions-d-un-point:adopt:group:retirees",
              "target": "group",
              "key": "retirees",
              "delta": -6,
              "timing": {
                "kind": "mandate_year",
                "year": 1
              },
              "duration": "once",
              "explanation": "Appliquer inflation moins un point à la revalorisation annuelle des pensions en précisant un éventuel plancher."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "desindexer-les-pensions-d-un-point:keep",
          "label": "Indexer sur l'inflation",
          "summary": "Le pouvoir d'achat des pensions est préservé et l'économie disparaît.",
          "mechanism": "Appliquer la formule légale et préserver le pouvoir d'achat nominal relatif des pensions.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "retraités"
          ],
          "contributors": [
            "finances sociales",
            "cotisants futurs"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "desindexer-les-pensions-d-un-point:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer la formule légale et préserver le pouvoir d'achat nominal relatif des pensions."
            },
            {
              "id": "desindexer-les-pensions-d-un-point:keep:group:retirees",
              "target": "group",
              "key": "retirees",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer la formule légale et préserver le pouvoir d'achat nominal relatif des pensions."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Un point sur 362 178 M€ de pensions (2024, publié).",
          "sourceName": "Conseil d'orientation des retraites",
          "sourceUrl": "https://www.cor-retraites.fr/rapports-du-cor/rapport-annuel-cor-juin-2025-evolutions-perspectives-retraites-france",
          "publishedAt": "2025-06-12",
          "note": "Évolutions et perspectives du système de retraite français."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "durcir-l-assurance-chomage-degressivite-duree",
      "version": 3,
      "kind": "transformation",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il raccourcir et rendre dégressive l'assurance chômage ?",
      "context": "Des droits plus courts réduisent la dépense et renforcent l'incitation à reprendre un emploi. Ils diminuent aussi la protection quand les offres manquent.",
      "options": [
        {
          "id": "durcir-l-assurance-chomage-degressivite-duree:adopt",
          "label": "Durcir les droits",
          "summary": "Les allocations baissent plus vite et l'Unédic économise, au risque d'augmenter la précarité.",
          "mechanism": "Définir la cohorte, la réduction de durée, le seuil de dégressivité, son rythme, son plancher et la condition conjoncturelle.",
          "horizon": {
            "kind": "mandate_year",
            "year": 2
          },
          "legalConstraints": [
            "Négociation des partenaires sociaux et agrément",
            "À défaut d'accord, décret de l'État",
            "Droits transitoires",
            "Plancher de revenu"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "mandate_year",
            "year": 2
          },
          "beneficiaries": [
            "finances sociales",
            "employeurs qui recrutent"
          ],
          "contributors": [
            "demandeurs d'emploi de longue durée"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 2200,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "annual",
              "explanation": "Définir la cohorte, la réduction de durée, le seuil de dégressivité, son rythme, son plancher et la condition conjoncturelle. Impact budgétaire retenu par le jeu : 2200 millions d'euros."
            },
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 1,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Définir la cohorte, la réduction de durée, le seuil de dégressivité, son rythme, son plancher et la condition conjoncturelle."
            },
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:adopt:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Définir la cohorte, la réduction de durée, le seuil de dégressivité, son rythme, son plancher et la condition conjoncturelle."
            },
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:adopt:group:unions",
              "target": "group",
              "key": "unions",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Définir la cohorte, la réduction de durée, le seuil de dégressivité, son rythme, son plancher et la condition conjoncturelle."
            },
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Définir la cohorte, la réduction de durée, le seuil de dégressivité, son rythme, son plancher et la condition conjoncturelle."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "durcir-l-assurance-chomage-degressivite-duree:keep",
          "label": "Conserver les droits",
          "summary": "La protection des demandeurs d'emploi est maintenue et l'économie n'est pas réalisée.",
          "mechanism": "Maintenir la convention et la fonction d'assurance du revenu pendant la recherche d'emploi.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "demandeurs d'emploi",
            "salariés du privé",
            "syndicats"
          ],
          "contributors": [
            "finances de l'Unédic",
            "employeurs cotisants"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir la convention et la fonction d'assurance du revenu pendant la recherche d'emploi."
            },
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:keep:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir la convention et la fonction d'assurance du revenu pendant la recherche d'emploi."
            },
            {
              "id": "durcir-l-assurance-chomage-degressivite-duree:keep:group:unions",
              "target": "group",
              "key": "unions",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir la convention et la fonction d'assurance du revenu pendant la recherche d'emploi."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Études d'impact des réformes successives (Unédic).",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        },
        {
          "label": "Études d'impact des réformes successives (Unédic).",
          "sourceName": "Insee",
          "sourceUrl": "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
          "publishedAt": "2025-11-20",
          "note": "Revenus, emploi et inégalités dans France, portrait social."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "retablir-la-semaine-de-39-heures",
      "version": 3,
      "kind": "rupture",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il rétablir la durée légale à 39 heures ?",
      "context": "La durée légale passe de 35 à 39 heures. Sans hausse proportionnelle du salaire mensuel, le coût horaire baisse. Avec compensation, le gain de compétitivité se réduit.",
      "options": [
        {
          "id": "retablir-la-semaine-de-39-heures:adopt",
          "label": "Passer à 39 heures",
          "summary": "Quatre heures redeviennent ordinaires et le partage du gain entre salariés et employeurs devient central.",
          "mechanism": "Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent. Les 2 000 millions d'euros et +0,12 point de croissance nominale sont des hypothèses du jeu; une compensation salariale intégrale en annulerait une large part.",
          "horizon": {
            "kind": "mandate_year",
            "year": 2
          },
          "legalConstraints": [
            "Loi modifiant la durée légale du travail et les seuils de déclenchement des heures supplémentaires",
            "Respecter la directive 2003/88/CE et le Code du travail : 48 heures au plus sur une semaine, 44 heures en moyenne sur douze semaines, repos quotidien et hebdomadaire",
            "Le relèvement de la durée légale ne permet ni de réduire unilatéralement le salaire contractuel ni de modifier sans accord les conventions et accords collectifs plus favorables",
            "Définir le traitement transitoire des contrats, forfaits, temps partiels et contingents d'heures supplémentaires"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "mandate_year",
            "year": 2
          },
          "beneficiaries": [
            "employeurs",
            "finances publiques"
          ],
          "contributors": [
            "salariés sans compensation intégrale"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "retablir-la-semaine-de-39-heures:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 2000,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "annual",
              "explanation": "Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent. Les 2 000 millions d'euros et +0,12 point de croissance nominale sont des hypothèses du jeu; une compensation salariale intégrale en annulerait une large part. Impact budgétaire retenu par le jeu : 2000 millions d'euros."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:adopt:indicator:growth",
              "target": "indicator",
              "key": "growth",
              "delta": 0.12,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent. Les 2 000 millions d'euros et +0,12 point de croissance nominale sont des hypothèses du jeu; une compensation salariale intégrale en annulerait une large part."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent. Les 2 000 millions d'euros et +0,12 point de croissance nominale sont des hypothèses du jeu; une compensation salariale intégrale en annulerait une large part."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 5,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent. Les 2 000 millions d'euros et +0,12 point de croissance nominale sont des hypothèses du jeu; une compensation salariale intégrale en annulerait une large part."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:adopt:group:unions",
              "target": "group",
              "key": "unions",
              "delta": -8,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent. Les 2 000 millions d'euros et +0,12 point de croissance nominale sont des hypothèses du jeu; une compensation salariale intégrale en annulerait une large part."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:adopt:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": -5,
              "timing": {
                "kind": "mandate_year",
                "year": 2
              },
              "duration": "once",
              "explanation": "Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent. Les 2 000 millions d'euros et +0,12 point de croissance nominale sont des hypothèses du jeu; une compensation salariale intégrale en annulerait une large part."
            }
          ],
          "scheduledEvents": [
            {
              "id": "hours-wage-bargain",
              "title": "Les négociations salariales mettent le scénario à l'épreuve",
              "body": "Dans le stress retenu par le jeu, les conflits sur la compensation des quatre heures retardent l'organisation du travail et certaines embauches.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "hours-wage-bargain:indicator:employment",
                  "target": "indicator",
                  "key": "employment",
                  "delta": -2,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Dans le stress retenu par le jeu, les conflits sur la compensation des quatre heures retardent l'organisation du travail et certaines embauches."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "retablir-la-semaine-de-39-heures:keep",
          "label": "Conserver 35 heures",
          "summary": "Les heures au-delà de 35 restent supplémentaires et le droit actuel ne change pas.",
          "mechanism": "Conserver le seuil de déclenchement des heures supplémentaires et leur majoration actuelle.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "salariés"
          ],
          "contributors": [
            "employeurs"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "retablir-la-semaine-de-39-heures:keep:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil de déclenchement des heures supplémentaires et leur majoration actuelle."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:keep:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil de déclenchement des heures supplémentaires et leur majoration actuelle."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:keep:group:unions",
              "target": "group",
              "key": "unions",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil de déclenchement des heures supplémentaires et leur majoration actuelle."
            },
            {
              "id": "retablir-la-semaine-de-39-heures:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le seuil de déclenchement des heures supplémentaires et leur majoration actuelle."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Durée du travail, salaires et emploi.",
          "sourceName": "Insee",
          "sourceUrl": "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
          "publishedAt": "2025-11-20",
          "note": "Revenus, emploi et inégalités dans France, portrait social."
        },
        {
          "label": "Durée du travail, salaires et emploi.",
          "sourceName": "Institut Thomas More",
          "sourceUrl": "https://institut-thomas-more.org/2026/06/25/rapport36/",
          "publishedAt": "2026-06-25",
          "note": "Contrepoint éditorial libéral-conservateur. Cette source ne fonde jamais seule un chiffrage."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "augmenter-le-smic-de-10",
      "version": 3,
      "kind": "rupture",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il augmenter immédiatement le SMIC de 10 % ?",
      "context": "La hausse augmente le salaire brut au bas de l'échelle. Son coût se partage entre employeurs, prix, emploi et allègements de cotisations.",
      "options": [
        {
          "id": "augmenter-le-smic-de-10:adopt",
          "label": "Augmenter le SMIC de 10 %",
          "summary": "Les salariés au SMIC gagnent davantage et les secteurs à faible marge absorbent le choc.",
          "mechanism": "Relever de 10 % le SMIC horaire par décret en conservant inchangé le barème des allègements de cotisations retenu par le chiffrage.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Décret selon le Code du travail",
            "Loi de financement si les allègements changent",
            "Rattrapage des minima conventionnels",
            "Préciser les régimes territoriaux"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "salariés au SMIC"
          ],
          "contributors": [
            "employeurs",
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "augmenter-le-smic-de-10:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -3000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Relever de 10 % le SMIC horaire par décret en conservant inchangé le barème des allègements de cotisations retenu par le chiffrage. Impact budgétaire retenu par le jeu : -3000 millions d'euros."
            },
            {
              "id": "augmenter-le-smic-de-10:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever de 10 % le SMIC horaire par décret en conservant inchangé le barème des allègements de cotisations retenu par le chiffrage."
            },
            {
              "id": "augmenter-le-smic-de-10:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 8,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever de 10 % le SMIC horaire par décret en conservant inchangé le barème des allègements de cotisations retenu par le chiffrage."
            },
            {
              "id": "augmenter-le-smic-de-10:adopt:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever de 10 % le SMIC horaire par décret en conservant inchangé le barème des allègements de cotisations retenu par le chiffrage."
            },
            {
              "id": "augmenter-le-smic-de-10:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -6,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever de 10 % le SMIC horaire par décret en conservant inchangé le barème des allègements de cotisations retenu par le chiffrage."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "augmenter-le-smic-de-10:keep",
          "label": "Conserver l'indexation actuelle",
          "summary": "Le SMIC suit les prix et les salaires, sans coup de pouce exceptionnel.",
          "mechanism": "Appliquer la formule légale fondée sur les prix et les salaires sans coup de pouce discrétionnaire.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "employeurs"
          ],
          "contributors": [
            "salariés au SMIC"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "augmenter-le-smic-de-10:keep:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer la formule légale fondée sur les prix et les salaires sans coup de pouce discrétionnaire."
            },
            {
              "id": "augmenter-le-smic-de-10:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer la formule légale fondée sur les prix et les salaires sans coup de pouce discrétionnaire."
            },
            {
              "id": "augmenter-le-smic-de-10:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer la formule légale fondée sur les prix et les salaires sans coup de pouce discrétionnaire."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Salaires, emploi et allègements au voisinage du SMIC.",
          "sourceName": "Insee",
          "sourceUrl": "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
          "publishedAt": "2025-11-20",
          "note": "Revenus, emploi et inégalités dans France, portrait social."
        },
        {
          "label": "Salaires, emploi et allègements au voisinage du SMIC.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "allocation-sociale-unique",
      "version": 3,
      "kind": "rupture",
      "chapterId": "work-wages-pensions",
      "title": "Faut-il fusionner les aides dans une allocation sociale unique ?",
      "context": "RSA, prime d'activité et aides au logement seraient regroupés dans un barème unique. La simplicité crée nécessairement des gagnants et des perdants si l'enveloppe reste constante.",
      "options": [
        {
          "id": "allocation-sociale-unique:adopt",
          "label": "Créer l'allocation unique",
          "summary": "Le versement devient automatique et lisible, mais certains ménages perdent au nouveau barème.",
          "mechanism": "Remplacer RSA, prime d'activité et APL par un barème de ménage publié avec calcul et versement automatiques. Le gain de 1 000 millions d'euros suppose dans le jeu que baisses de droits et gestion dépassent non-recours résorbé et transition; le signe distributif reste provisoire sans microsimulation.",
          "horizon": {
            "kind": "mandate_year",
            "year": 3
          },
          "legalConstraints": [
            "Lois modifiant les régimes du RSA, de la prime d'activité et des aides personnelles au logement, avec barème, unité de ressources, période de référence et transition explicitement définis",
            "Respecter la libre administration et l'autonomie financière des départements ; compenser toute charge nouvelle ou tout transfert relatif au RSA dans les conditions de l'article 72-2 de la Constitution",
            "Respecter le règlement (CE) n° 883/2004, l'égalité de traitement et les règles de coordination européenne applicables aux prestations fusionnées",
            "Donner au croisement de données une base légale conforme au RGPD : finalités déterminées, minimisation, durée de conservation, information et sécurité",
            "Pour toute décision entièrement automatisée produisant un effet juridique, garantir explication, intervention humaine, rectification et recours ; définir aussi la récupération des indus et le maintien temporaire des droits"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "mandate_year",
            "year": 3
          },
          "beneficiaries": [
            "allocataires en non-recours",
            "administration"
          ],
          "contributors": [
            "perdants du nouveau barème"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "allocation-sociale-unique:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1000,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "annual",
              "explanation": "Remplacer RSA, prime d'activité et APL par un barème de ménage publié avec calcul et versement automatiques. Le gain de 1 000 millions d'euros suppose dans le jeu que baisses de droits et gestion dépassent non-recours résorbé et transition; le signe distributif reste provisoire sans microsimulation. Impact budgétaire retenu par le jeu : 1000 millions d'euros."
            },
            {
              "id": "allocation-sociale-unique:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Remplacer RSA, prime d'activité et APL par un barème de ménage publié avec calcul et versement automatiques. Le gain de 1 000 millions d'euros suppose dans le jeu que baisses de droits et gestion dépassent non-recours résorbé et transition; le signe distributif reste provisoire sans microsimulation."
            },
            {
              "id": "allocation-sociale-unique:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Remplacer RSA, prime d'activité et APL par un barème de ménage publié avec calcul et versement automatiques. Le gain de 1 000 millions d'euros suppose dans le jeu que baisses de droits et gestion dépassent non-recours résorbé et transition; le signe distributif reste provisoire sans microsimulation."
            },
            {
              "id": "allocation-sociale-unique:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -1,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Remplacer RSA, prime d'activité et APL par un barème de ménage publié avec calcul et versement automatiques. Le gain de 1 000 millions d'euros suppose dans le jeu que baisses de droits et gestion dépassent non-recours résorbé et transition; le signe distributif reste provisoire sans microsimulation."
            }
          ],
          "scheduledEvents": [
            {
              "id": "single-benefit-losers",
              "title": "Le premier versement révèle des perdants",
              "body": "Certaines configurations familiales reçoivent moins avec le barème provisoire de la prestation unique.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "single-benefit-losers:group:lowIncomeHouseholds",
                  "target": "group",
                  "key": "lowIncomeHouseholds",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Certaines configurations familiales reçoivent moins avec le barème provisoire de la prestation unique."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "verser-le-rsa-automatiquement-fin-du-non",
            "porter-le-rsa-au-seuil-de"
          ],
          "unlocks": []
        },
        {
          "id": "allocation-sociale-unique:keep",
          "label": "Conserver des aides distinctes",
          "summary": "Chaque prestation garde son objectif, avec les mêmes démarches et effets de seuil.",
          "mechanism": "Maintenir les objectifs, formulaires, effets de seuil et non-recours propres à chaque prestation.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "allocataires protégés par les règles actuelles"
          ],
          "contributors": [
            "non-recourants",
            "administration"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "allocation-sociale-unique:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les objectifs, formulaires, effets de seuil et non-recours propres à chaque prestation."
            },
            {
              "id": "allocation-sociale-unique:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les objectifs, formulaires, effets de seuil et non-recours propres à chaque prestation."
            },
            {
              "id": "allocation-sociale-unique:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les objectifs, formulaires, effets de seuil et non-recours propres à chaque prestation."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Montants, publics et articulation des prestations de solidarité.",
          "sourceName": "DREES",
          "sourceUrl": "https://www.drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/251204-minima-sociaux-et-prestations-de-solidarite",
          "publishedAt": "2025-12-04",
          "note": "Bénéficiaires, montants et non-recours aux minima sociaux."
        },
        {
          "label": "Montants, publics et articulation des prestations de solidarité.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "verser-le-rsa-automatiquement-fin-du-non",
        "porter-le-rsa-au-seuil-de"
      ]
    },
    {
      "id": "doubler-les-franchises-medicales",
      "version": 3,
      "kind": "gestion",
      "chapterId": "health-social-protection",
      "title": "Faut-il doubler les franchises médicales ?",
      "context": "Le reste à charge augmente sur les médicaments et actes concernés. L'Assurance maladie économise, mais les patients fréquents paient davantage.",
      "options": [
        {
          "id": "doubler-les-franchises-medicales:adopt",
          "label": "Doubler les franchises",
          "summary": "Les patients financent une part plus élevée des soins et les comptes sociaux économisent.",
          "mechanism": "Doubler les montants unitaires facturés aux patients sur les actes et produits concernés en conservant plafonds et exemptions.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Modifier le régime en LFSS ou par le texte d'application approprié",
            "Respecter exemptions et plafonds annuels",
            "Concilier la mesure avec la protection de la santé"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "Assurance maladie"
          ],
          "contributors": [
            "patients réguliers",
            "malades chroniques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-les-franchises-medicales:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 800,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Doubler les montants unitaires facturés aux patients sur les actes et produits concernés en conservant plafonds et exemptions. Impact budgétaire retenu par le jeu : 800 millions d'euros."
            },
            {
              "id": "doubler-les-franchises-medicales:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Doubler les montants unitaires facturés aux patients sur les actes et produits concernés en conservant plafonds et exemptions."
            },
            {
              "id": "doubler-les-franchises-medicales:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Doubler les montants unitaires facturés aux patients sur les actes et produits concernés en conservant plafonds et exemptions."
            },
            {
              "id": "doubler-les-franchises-medicales:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -5,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Doubler les montants unitaires facturés aux patients sur les actes et produits concernés en conservant plafonds et exemptions."
            },
            {
              "id": "doubler-les-franchises-medicales:adopt:group:retirees",
              "target": "group",
              "key": "retirees",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Doubler les montants unitaires facturés aux patients sur les actes et produits concernés en conservant plafonds et exemptions."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "doubler-les-franchises-medicales:keep",
          "label": "Conserver les franchises",
          "summary": "Le reste à charge ne monte pas et l'économie prévue disparaît.",
          "mechanism": "Conserver les montants, plafonds et exemptions actuels.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "patients soumis aux franchises",
            "malades chroniques",
            "retraités"
          ],
          "contributors": [
            "finances de l'Assurance maladie"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-les-franchises-medicales:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les montants, plafonds et exemptions actuels."
            },
            {
              "id": "doubler-les-franchises-medicales:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les montants, plafonds et exemptions actuels."
            },
            {
              "id": "doubler-les-franchises-medicales:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les montants, plafonds et exemptions actuels."
            },
            {
              "id": "doubler-les-franchises-medicales:keep:group:retirees",
              "target": "group",
              "key": "retirees",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les montants, plafonds et exemptions actuels."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Évaluations LFSS.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "renforcer-le-controle-des-arrets-de-travail",
      "version": 3,
      "kind": "gestion",
      "chapterId": "health-social-protection",
      "title": "Faut-il renforcer le contrôle des arrêts de travail ?",
      "context": "Des contrôles supplémentaires peuvent réduire les abus et les prescriptions évitables. Ils mobilisent des médecins contrôleurs et exposent les malades à des erreurs.",
      "options": [
        {
          "id": "renforcer-le-controle-des-arrets-de-travail:adopt",
          "label": "Renforcer les contrôles",
          "summary": "Les arrêts injustifiés reculent, avec davantage de contrôles pour les salariés et prescripteurs.",
          "mechanism": "Cibler les contrôles selon le risque avec examen médical indépendant, notification contradictoire et voie de recours.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Secret médical",
            "RGPD et finalité du profilage",
            "Procédure contradictoire et recours",
            "Codes du travail et de la sécurité sociale"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "Assurance maladie",
            "employeurs"
          ],
          "contributors": [
            "salariés contrôlés",
            "médecins"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 300,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Cibler les contrôles selon le risque avec examen médical indépendant, notification contradictoire et voie de recours. Impact budgétaire retenu par le jeu : 300 millions d'euros."
            },
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Cibler les contrôles selon le risque avec examen médical indépendant, notification contradictoire et voie de recours."
            },
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -1,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Cibler les contrôles selon le risque avec examen médical indépendant, notification contradictoire et voie de recours."
            },
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:adopt:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Cibler les contrôles selon le risque avec examen médical indépendant, notification contradictoire et voie de recours."
            },
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Cibler les contrôles selon le risque avec examen médical indépendant, notification contradictoire et voie de recours."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "renforcer-le-controle-des-arrets-de-travail:keep",
          "label": "Conserver le contrôle actuel",
          "summary": "Les malades évitent une procédure supplémentaire et l'économie attendue n'est pas réalisée.",
          "mechanism": "Conserver l'échantillonnage, la prescription et les recours actuels.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "salariés en arrêt maladie"
          ],
          "contributors": [
            "employeurs",
            "finances sociales"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver l'échantillonnage, la prescription et les recours actuels."
            },
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver l'échantillonnage, la prescription et les recours actuels."
            },
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:keep:group:privateEmployees",
              "target": "group",
              "key": "privateEmployees",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver l'échantillonnage, la prescription et les recours actuels."
            },
            {
              "id": "renforcer-le-controle-des-arrets-de-travail:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver l'échantillonnage, la prescription et les recours actuels."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Plans d'économies LFSS successifs.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "creer-5-000-postes-de-soignants",
      "version": 3,
      "kind": "transformation",
      "chapterId": "health-social-protection",
      "title": "Faut-il créer 5 000 postes de soignants ?",
      "context": "Les postes améliorent les équipes si les recrutements aboutissent. Le salaire annuel est certain, l'effet sur l'accès aux soins dépend de la pénurie locale.",
      "options": [
        {
          "id": "creer-5-000-postes-de-soignants:adopt",
          "label": "Créer 5 000 postes",
          "summary": "Les établissements gagnent des effectifs et le budget assume leur masse salariale chaque année.",
          "mechanism": "Financer 5 000 emplois permanents, leur formation et leur affectation vers les territoires ou spécialités en pénurie.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Crédits LFSS et loi de finances",
            "Statuts de l'emploi hospitalier",
            "Diplômes, autorisations d'exercice et capacités de formation"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "patients",
            "équipes hospitalières"
          ],
          "contributors": [
            "finances sociales"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "creer-5-000-postes-de-soignants:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -350,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Financer 5 000 emplois permanents, leur formation et leur affectation vers les territoires ou spécialités en pénurie. Impact budgétaire retenu par le jeu : -350 millions d'euros."
            },
            {
              "id": "creer-5-000-postes-de-soignants:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 4,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Financer 5 000 emplois permanents, leur formation et leur affectation vers les territoires ou spécialités en pénurie."
            },
            {
              "id": "creer-5-000-postes-de-soignants:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Financer 5 000 emplois permanents, leur formation et leur affectation vers les territoires ou spécialités en pénurie."
            },
            {
              "id": "creer-5-000-postes-de-soignants:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Financer 5 000 emplois permanents, leur formation et leur affectation vers les territoires ou spécialités en pénurie."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "creer-5-000-postes-de-soignants:keep",
          "label": "Maintenir les effectifs prévus",
          "summary": "La dépense n'augmente pas et les tensions d'effectifs persistent.",
          "mechanism": "Maintenir la trajectoire d'effectifs financée sans cohorte supplémentaire.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "patients hospitaliers",
            "équipes soignantes"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "creer-5-000-postes-de-soignants:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir la trajectoire d'effectifs financée sans cohorte supplémentaire."
            },
            {
              "id": "creer-5-000-postes-de-soignants:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir la trajectoire d'effectifs financée sans cohorte supplémentaire."
            },
            {
              "id": "creer-5-000-postes-de-soignants:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir la trajectoire d'effectifs financée sans cohorte supplémentaire."
            },
            {
              "id": "creer-5-000-postes-de-soignants:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir la trajectoire d'effectifs financée sans cohorte supplémentaire."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Coût salarial moyen, année pleine.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "loi-grand-age-50-000-recrutements",
      "version": 3,
      "kind": "transformation",
      "chapterId": "health-social-protection",
      "title": "Faut-il recruter 50 000 professionnels du grand âge ?",
      "context": "Ehpad et domicile manquent de bras. Le recrutement améliore l'accompagnement si les métiers deviennent attractifs, avec un coût récurrent élevé.",
      "options": [
        {
          "id": "loi-grand-age-50-000-recrutements:adopt",
          "label": "Recruter 50 000 professionnels",
          "summary": "Le taux d'encadrement augmente et les finances sociales portent la dépense durablement.",
          "mechanism": "Attribuer des subventions pluriannuelles conditionnées aux recrutements nets, à la formation et à la rétention en établissement et à domicile.",
          "horizon": {
            "kind": "after_decisions",
            "count": 4
          },
          "legalConstraints": [
            "LFSS et concours CNSA",
            "Compétences et autonomie financière des départements",
            "Conventions collectives, statuts et qualifications"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "personnes âgées",
            "aidants",
            "professionnels"
          ],
          "contributors": [
            "finances sociales"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "loi-grand-age-50-000-recrutements:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -2500,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Attribuer des subventions pluriannuelles conditionnées aux recrutements nets, à la formation et à la rétention en établissement et à domicile. Impact budgétaire retenu par le jeu : -2500 millions d'euros."
            },
            {
              "id": "loi-grand-age-50-000-recrutements:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 6,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Attribuer des subventions pluriannuelles conditionnées aux recrutements nets, à la formation et à la rétention en établissement et à domicile."
            },
            {
              "id": "loi-grand-age-50-000-recrutements:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Attribuer des subventions pluriannuelles conditionnées aux recrutements nets, à la formation et à la rétention en établissement et à domicile."
            },
            {
              "id": "loi-grand-age-50-000-recrutements:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 6,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Attribuer des subventions pluriannuelles conditionnées aux recrutements nets, à la formation et à la rétention en établissement et à domicile."
            },
            {
              "id": "loi-grand-age-50-000-recrutements:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Attribuer des subventions pluriannuelles conditionnées aux recrutements nets, à la formation et à la rétention en établissement et à domicile."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "loi-grand-age-50-000-recrutements:keep",
          "label": "Conserver les moyens programmés",
          "summary": "Aucune dépense nouvelle n'est engagée et le sous-effectif perdure.",
          "mechanism": "Conserver les enveloppes et ratios d'encadrement programmés.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "personnes âgées dépendantes",
            "proches aidants",
            "personnels du grand âge"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "loi-grand-age-50-000-recrutements:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les enveloppes et ratios d'encadrement programmés."
            },
            {
              "id": "loi-grand-age-50-000-recrutements:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les enveloppes et ratios d'encadrement programmés."
            },
            {
              "id": "loi-grand-age-50-000-recrutements:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les enveloppes et ratios d'encadrement programmés."
            },
            {
              "id": "loi-grand-age-50-000-recrutements:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les enveloppes et ratios d'encadrement programmés."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Rapports publics sur les besoins en personnel du grand âge.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "supprimer-l-aide-medicale-d-etat",
      "version": 3,
      "kind": "rupture",
      "chapterId": "health-social-protection",
      "title": "Faut-il supprimer l'aide médicale d'État ?",
      "context": "La couverture dédiée disparaît pour les étrangers sans titre. Une partie des soins est reportée, retardée ou prise en charge par les urgences.",
      "options": [
        {
          "id": "supprimer-l-aide-medicale-d-etat:adopt",
          "label": "Supprimer l'aide médicale d'État",
          "summary": "Le crédit dédié disparaît, tandis que les hôpitaux reprennent une partie des soins non évitables.",
          "mechanism": "Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Protection de la santé et de la dignité",
            "Obligations de soins urgents",
            "Protection des mineurs et engagements internationaux",
            "Modifier la facturation hospitalière"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "budget de l'État à court terme"
          ],
          "contributors": [
            "personnes sans titre",
            "hôpitaux"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "supprimer-l-aide-medicale-d-etat:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1200,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires. Impact budgétaire retenu par le jeu : 1200 millions d'euros."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -7,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires."
            }
          ],
          "scheduledEvents": [
            {
              "id": "ame-emergency-transfer",
              "title": "Les urgences absorbent les soins retardés",
              "body": "Les soins retardés se reportent vers l'hôpital et saturent davantage les services d'urgence.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "ame-emergency-transfer:indicator:publicServices",
                  "target": "indicator",
                  "key": "publicServices",
                  "delta": -4,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les soins retardés se reportent vers l'hôpital et saturent davantage les services d'urgence."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "supprimer-l-aide-medicale-d-etat:keep",
          "label": "Maintenir l'aide médicale d'État",
          "summary": "Les soins restent accessibles dans le cadre actuel et la dépense demeure au budget.",
          "mechanism": "Maintenir l'éligibilité, le panier de soins et le canal de facturation existants.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "personnes étrangères sans titre éligibles",
            "hôpitaux publics",
            "santé publique"
          ],
          "contributors": [
            "finances de l'Assurance maladie"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "supprimer-l-aide-medicale-d-etat:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'éligibilité, le panier de soins et le canal de facturation existants."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'éligibilité, le panier de soins et le canal de facturation existants."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'éligibilité, le panier de soins et le canal de facturation existants."
            },
            {
              "id": "supprimer-l-aide-medicale-d-etat:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'éligibilité, le panier de soins et le canal de facturation existants."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Crédits votés de l'AME ; une partie se reporte sur les urgences.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Rapport annuel sur l'application des lois de financement de la Sécurité sociale."
        },
        {
          "label": "Crédits votés de l'AME ; une partie se reporte sur les urgences.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-04/NEB-2024-Immigration.pdf",
          "publishedAt": "2025-04-15",
          "note": "Exécution budgétaire de la mission Immigration, asile et intégration."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "verser-le-rsa-automatiquement-fin-du-non",
      "version": 3,
      "kind": "rupture",
      "chapterId": "health-social-protection",
      "title": "Faut-il verser automatiquement le RSA aux personnes éligibles ?",
      "context": "Le versement automatique réduit le non-recours et rend le droit effectif. Il augmente mécaniquement la dépense puisque davantage d'éligibles perçoivent l'aide.",
      "options": [
        {
          "id": "verser-le-rsa-automatiquement-fin-du-non:adopt",
          "label": "Automatiser le versement",
          "summary": "Les personnes éligibles reçoivent leur droit sans demande et les départements financent davantage d'allocataires.",
          "mechanism": "Croiser les données fiscales et sociales, prénotifier l'éligibilité, ouvrir le droit puis permettre correction, refus et recours.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Base législative et financement départemental",
            "RGPD, minimisation et finalité",
            "Notification, correction, recours et récupération des indus"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "personnes pauvres en non-recours"
          ],
          "contributors": [
            "finances sociales",
            "départements"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -2600,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Croiser les données fiscales et sociales, prénotifier l'éligibilité, ouvrir le droit puis permettre correction, refus et recours. Impact budgétaire retenu par le jeu : -2600 millions d'euros."
            },
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Croiser les données fiscales et sociales, prénotifier l'éligibilité, ouvrir le droit puis permettre correction, refus et recours."
            },
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Croiser les données fiscales et sociales, prénotifier l'éligibilité, ouvrir le droit puis permettre correction, refus et recours."
            },
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 8,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Croiser les données fiscales et sociales, prénotifier l'éligibilité, ouvrir le droit puis permettre correction, refus et recours."
            },
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Croiser les données fiscales et sociales, prénotifier l'éligibilité, ouvrir le droit puis permettre correction, refus et recours."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "verser-le-rsa-automatiquement-fin-du-non:keep",
          "label": "Conserver la demande",
          "summary": "La dépense reste plus basse, mais une part importante des éligibles ne reçoit toujours rien.",
          "mechanism": "Maintenir une demande initiée par l'allocataire et les échanges de données actuels.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances départementales"
          ],
          "contributors": [
            "personnes éligibles en non-recours"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir une demande initiée par l'allocataire et les échanges de données actuels."
            },
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir une demande initiée par l'allocataire et les échanges de données actuels."
            },
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir une demande initiée par l'allocataire et les échanges de données actuels."
            },
            {
              "id": "verser-le-rsa-automatiquement-fin-du-non:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir une demande initiée par l'allocataire et les échanges de données actuels."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Taux de non-recours mesuré (~un tiers) × montant moyen.",
          "sourceName": "DREES",
          "sourceUrl": "https://www.drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/251204-minima-sociaux-et-prestations-de-solidarite",
          "publishedAt": "2025-12-04",
          "note": "Bénéficiaires, montants et non-recours aux minima sociaux."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "porter-le-rsa-au-seuil-de",
      "version": 3,
      "kind": "rupture",
      "chapterId": "health-social-protection",
      "title": "Faut-il porter le RSA au seuil de pauvreté ?",
      "context": "Le minimum augmente d'environ 30 %. La pauvreté monétaire recule pour les bénéficiaires, mais l'écart avec les bas salaires se resserre.",
      "options": [
        {
          "id": "porter-le-rsa-au-seuil-de:adopt",
          "label": "Porter le RSA au seuil de pauvreté",
          "summary": "Le revenu des allocataires augmente fortement et la dépense sociale progresse chaque année.",
          "mechanism": "Relever le barème national et l'indexer sur le seuil de pauvreté publié.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Barème légal du RSA",
            "Financement et compensation des départements",
            "Principe d'égalité"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "allocataires du RSA"
          ],
          "contributors": [
            "finances sociales"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "porter-le-rsa-au-seuil-de:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -3500,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Relever le barème national et l'indexer sur le seuil de pauvreté publié. Impact budgétaire retenu par le jeu : -3500 millions d'euros."
            },
            {
              "id": "porter-le-rsa-au-seuil-de:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever le barème national et l'indexer sur le seuil de pauvreté publié."
            },
            {
              "id": "porter-le-rsa-au-seuil-de:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever le barème national et l'indexer sur le seuil de pauvreté publié."
            },
            {
              "id": "porter-le-rsa-au-seuil-de:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 9,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever le barème national et l'indexer sur le seuil de pauvreté publié."
            },
            {
              "id": "porter-le-rsa-au-seuil-de:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -6,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever le barème national et l'indexer sur le seuil de pauvreté publié."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "porter-le-rsa-au-seuil-de:keep",
          "label": "Conserver le barème actuel",
          "summary": "L'écart avec le salaire minimum est maintenu et les allocataires restent sous le seuil de pauvreté.",
          "mechanism": "Conserver le barème et l'indexation actuels.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances départementales",
            "contribuables"
          ],
          "contributors": [
            "allocataires à bas revenus"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "porter-le-rsa-au-seuil-de:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le barème et l'indexation actuels."
            },
            {
              "id": "porter-le-rsa-au-seuil-de:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le barème et l'indexation actuels."
            },
            {
              "id": "porter-le-rsa-au-seuil-de:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le barème et l'indexation actuels."
            },
            {
              "id": "porter-le-rsa-au-seuil-de:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le barème et l'indexation actuels."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Chiffrages associatifs et parlementaires de la revalorisation, non-recours constant.",
          "sourceName": "DREES",
          "sourceUrl": "https://www.drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/251204-minima-sociaux-et-prestations-de-solidarite",
          "publishedAt": "2025-12-04",
          "note": "Bénéficiaires, montants et non-recours aux minima sociaux."
        },
        {
          "label": "Chiffrages associatifs et parlementaires de la revalorisation, non-recours constant.",
          "sourceName": "Insee",
          "sourceUrl": "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
          "publishedAt": "2025-11-20",
          "note": "Revenus, emploi et inégalités dans France, portrait social."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "assurance-maladie-publique-unique",
      "version": 3,
      "kind": "rupture",
      "chapterId": "health-social-protection",
      "title": "Faut-il remplacer les complémentaires par une assurance maladie publique unique ?",
      "context": "La Sécurité sociale reprend la couverture aujourd'hui assurée par les complémentaires. Les primes privées baissent ou disparaissent, mais cotisations et dépenses publiques augmentent.",
      "options": [
        {
          "id": "assurance-maladie-publique-unique:adopt",
          "label": "Créer l'assurance publique unique",
          "summary": "La couverture devient commune: 24 milliards d'euros par an basculent vers le solde public en transfert brut, tandis que les primes privées ont vocation à baisser.",
          "mechanism": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale.",
          "horizon": {
            "kind": "mandate_year",
            "year": 4
          },
          "legalConstraints": [
            "LFSS et loi ordinaire",
            "Contrats d'assurance existants",
            "Liberté d'entreprendre et propriété",
            "Droit européen de l'assurance et de la concurrence",
            "Transfert des personnels et données de santé"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "mandate_year",
            "year": 4
          },
          "beneficiaries": [
            "assurés aux contrats coûteux",
            "patients chroniques"
          ],
          "contributors": [
            "finances sociales",
            "organismes complémentaires"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "assurance-maladie-publique-unique:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -24000,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "annual",
              "explanation": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale. Impact budgétaire retenu par le jeu : -24000 millions d'euros."
            },
            {
              "id": "assurance-maladie-publique-unique:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 6,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale."
            },
            {
              "id": "assurance-maladie-publique-unique:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -5,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale."
            },
            {
              "id": "assurance-maladie-publique-unique:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale."
            },
            {
              "id": "assurance-maladie-publique-unique:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 4,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale."
            },
            {
              "id": "assurance-maladie-publique-unique:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 4,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale."
            },
            {
              "id": "assurance-maladie-publique-unique:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -6,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels. Les 24 000 millions d'euros sont un transfert brut vers le solde public, pas une perte nette nationale."
            }
          ],
          "scheduledEvents": [
            {
              "id": "health-transition-billing",
              "title": "La bascule administrative retarde les remboursements",
              "body": "Les systèmes de facturation peinent à absorber le transfert et les délais de remboursement augmentent.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "health-transition-billing:indicator:publicServices",
                  "target": "indicator",
                  "key": "publicServices",
                  "delta": -4,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les systèmes de facturation peinent à absorber le transfert et les délais de remboursement augmentent."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "assurance-maladie-publique-unique:keep",
          "label": "Conserver le système à deux étages",
          "summary": "Assurance maladie et complémentaires continuent de se partager la couverture.",
          "mechanism": "Maintenir l'assurance maladie obligatoire et les complémentaires régulées.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "organismes complémentaires"
          ],
          "contributors": [
            "assurés payant une prime"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "assurance-maladie-publique-unique:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'assurance maladie obligatoire et les complémentaires régulées."
            },
            {
              "id": "assurance-maladie-publique-unique:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'assurance maladie obligatoire et les complémentaires régulées."
            },
            {
              "id": "assurance-maladie-publique-unique:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'assurance maladie obligatoire et les complémentaires régulées."
            },
            {
              "id": "assurance-maladie-publique-unique:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'assurance maladie obligatoire et les complémentaires régulées."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Répartition des remboursements entre Assurance maladie, complémentaires et ménages.",
          "sourceName": "Haut Conseil pour l'avenir de l'assurance maladie",
          "sourceUrl": "https://www.securite-sociale.fr/home/hcaam/zone-main-content/rapports-et-avis-1/rapport-du-hcaam-quatre-scenario.html",
          "publishedAt": "2022-01-14",
          "note": "Les 24 000 millions d'euros par an mesurent dans le jeu un transfert brut des remboursements privés vers les comptes publics. Ce n'est pas une perte nette nationale: les primes complémentaires ont vocation à baisser."
        },
        {
          "label": "Répartition des remboursements entre Assurance maladie, complémentaires et ménages.",
          "sourceName": "DREES",
          "sourceUrl": "https://drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/240710_Panorama_ComplementaireSante2024",
          "publishedAt": "2024-07-10",
          "note": "Les 24 000 millions d'euros par an mesurent dans le jeu un transfert brut des remboursements privés vers les comptes publics. Ce n'est pas une perte nette nationale: les primes complémentaires ont vocation à baisser."
        },
        {
          "label": "Répartition des remboursements entre Assurance maladie, complémentaires et ménages.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/fr/documents/75392",
          "publishedAt": "2025-05-26",
          "note": "Les 24 000 millions d'euros par an mesurent dans le jeu un transfert brut des remboursements privés vers les comptes publics. Ce n'est pas une perte nette nationale: les primes complémentaires ont vocation à baisser."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "recruter-10-000-policiers-et-gendarmes",
      "version": 3,
      "kind": "gestion",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il recruter 10 000 policiers et gendarmes ?",
      "context": "Les recrutements renforcent les effectifs disponibles, mais leur impact dépend de la formation, de l'affectation et du temps réellement passé sur le terrain.",
      "options": [
        {
          "id": "recruter-10-000-policiers-et-gendarmes:adopt",
          "label": "Recruter 10 000 agents",
          "summary": "Les forces de sécurité gagnent des effectifs et l'État assume la masse salariale chaque année.",
          "mechanism": "Créer des emplois permanents, ouvrir les cohortes d'école et affecter des effectifs nets aux unités sous-dotées.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Crédits de la loi de finances et LOPMI",
            "Statuts civil et militaire",
            "Égalité de recrutement et formation"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "forces de sécurité",
            "territoires sous-dotés"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "recruter-10-000-policiers-et-gendarmes:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -600,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Créer des emplois permanents, ouvrir les cohortes d'école et affecter des effectifs nets aux unités sous-dotées. Impact budgétaire retenu par le jeu : -600 millions d'euros."
            },
            {
              "id": "recruter-10-000-policiers-et-gendarmes:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 4,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Créer des emplois permanents, ouvrir les cohortes d'école et affecter des effectifs nets aux unités sous-dotées."
            },
            {
              "id": "recruter-10-000-policiers-et-gendarmes:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -1,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Créer des emplois permanents, ouvrir les cohortes d'école et affecter des effectifs nets aux unités sous-dotées."
            },
            {
              "id": "recruter-10-000-policiers-et-gendarmes:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Créer des emplois permanents, ouvrir les cohortes d'école et affecter des effectifs nets aux unités sous-dotées."
            },
            {
              "id": "recruter-10-000-policiers-et-gendarmes:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Créer des emplois permanents, ouvrir les cohortes d'école et affecter des effectifs nets aux unités sous-dotées."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "recruter-10-000-policiers-et-gendarmes:keep",
          "label": "Maintenir les recrutements prévus",
          "summary": "La dépense n'augmente pas et les tensions d'effectifs restent inchangées.",
          "mechanism": "Conserver la trajectoire de recrutement et d'attrition actuelle.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "habitants des zones sous-dotées",
            "policiers et gendarmes"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "recruter-10-000-policiers-et-gendarmes:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la trajectoire de recrutement et d'attrition actuelle."
            },
            {
              "id": "recruter-10-000-policiers-et-gendarmes:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la trajectoire de recrutement et d'attrition actuelle."
            },
            {
              "id": "recruter-10-000-policiers-et-gendarmes:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la trajectoire de recrutement et d'attrition actuelle."
            },
            {
              "id": "recruter-10-000-policiers-et-gendarmes:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la trajectoire de recrutement et d'attrition actuelle."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Coût moyen chargé ; la mission Sécurités porte 25 215 M€ votés.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/27959",
          "publishedAt": "2024-10-10",
          "note": "Projet annuel de performances 2025 du programme Police nationale."
        },
        {
          "label": "Coût moyen chargé ; la mission Sécurités porte 25 215 M€ votés.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/27911",
          "publishedAt": "2024-10-10",
          "note": "Projet annuel de performances 2025 du programme Gendarmerie nationale."
        },
        {
          "label": "Coût moyen chargé ; la mission Sécurités porte 25 215 M€ votés.",
          "sourceName": "Légifrance",
          "sourceUrl": "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047046768",
          "publishedAt": "2023-01-24",
          "note": "Loi d'orientation et de programmation du ministère de l'Intérieur."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "construire-15-000-places-de-prison-supplementaires",
      "version": 3,
      "kind": "gestion",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il construire 15 000 places de prison supplémentaires ?",
      "context": "Les nouvelles places réduisent la surpopulation si les incarcérations n'augmentent pas au même rythme. Construction et fonctionnement engagent plusieurs années de crédits.",
      "options": [
        {
          "id": "construire-15-000-places-de-prison-supplementaires:adopt",
          "label": "Construire 15 000 places",
          "summary": "La capacité pénitentiaire augmente progressivement; le jeu retient 500 millions d'euros par an pendant dix ans pour les sites, travaux, surveillants et entretien.",
          "mechanism": "Acquérir les sites, passer les marchés, construire, recruter les surveillants et ouvrir progressivement les places pour 500 millions d'euros par an pendant dix ans dans le scénario.",
          "horizon": {
            "kind": "mandate_year",
            "year": 4
          },
          "legalConstraints": [
            "Commande publique",
            "Urbanisme et environnement",
            "Normes constitutionnelles et CEDH de détention",
            "Crédits de fonctionnement et de personnel"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "détenus",
            "personnels pénitentiaires",
            "justice"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "construire-15-000-places-de-prison-supplementaires:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -500,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Acquérir les sites, passer les marchés, construire, recruter les surveillants et ouvrir progressivement les places pour 500 millions d'euros par an pendant dix ans dans le scénario. Impact budgétaire retenu par le jeu : -500 millions d'euros."
            },
            {
              "id": "construire-15-000-places-de-prison-supplementaires:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 3,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Acquérir les sites, passer les marchés, construire, recruter les surveillants et ouvrir progressivement les places pour 500 millions d'euros par an pendant dix ans dans le scénario."
            },
            {
              "id": "construire-15-000-places-de-prison-supplementaires:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Acquérir les sites, passer les marchés, construire, recruter les surveillants et ouvrir progressivement les places pour 500 millions d'euros par an pendant dix ans dans le scénario."
            },
            {
              "id": "construire-15-000-places-de-prison-supplementaires:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 3,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Acquérir les sites, passer les marchés, construire, recruter les surveillants et ouvrir progressivement les places pour 500 millions d'euros par an pendant dix ans dans le scénario."
            },
            {
              "id": "construire-15-000-places-de-prison-supplementaires:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 4
              },
              "duration": "once",
              "explanation": "Acquérir les sites, passer les marchés, construire, recruter les surveillants et ouvrir progressivement les places pour 500 millions d'euros par an pendant dix ans dans le scénario."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "construire-15-000-places-de-prison-supplementaires:keep",
          "label": "Ne pas lancer le programme",
          "summary": "La dépense est évitée et la surpopulation continue de peser sur les établissements.",
          "mechanism": "Ne pas lancer le programme supplémentaire et conserver le parc programmé.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "collectivités accueillant les sites"
          ],
          "contributors": [
            "personnels pénitentiaires",
            "personnes détenues"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "construire-15-000-places-de-prison-supplementaires:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas lancer le programme supplémentaire et conserver le parc programmé."
            },
            {
              "id": "construire-15-000-places-de-prison-supplementaires:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas lancer le programme supplémentaire et conserver le parc programmé."
            },
            {
              "id": "construire-15-000-places-de-prison-supplementaires:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas lancer le programme supplémentaire et conserver le parc programmé."
            },
            {
              "id": "construire-15-000-places-de-prison-supplementaires:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas lancer le programme supplémentaire et conserver le parc programmé."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Coût par place des programmes immobiliers pénitentiaires.",
          "sourceName": "Ministère de la Justice",
          "sourceUrl": "https://www.justice.gouv.fr/sites/default/files/2026-01/RSJ2025%20ouvrage%20complet.pdf",
          "publishedAt": "2026-04-29",
          "note": "Le coût du scénario est de 500 millions d'euros par an pendant dix ans; les nouvelles places ouvrent progressivement."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "recruter-3-000-magistrats-et-greffiers",
      "version": 3,
      "kind": "gestion",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il recruter 3 000 magistrats et greffiers ?",
      "context": "Davantage de personnels peut réduire les stocks et délais. L'effet n'est réel que si locaux, outils et chaîne pénale suivent.",
      "options": [
        {
          "id": "recruter-3-000-magistrats-et-greffiers:adopt",
          "label": "Recruter 3 000 personnels",
          "summary": "Les juridictions renforcent leurs équipes et le budget porte les emplois durablement.",
          "mechanism": "Ouvrir des cohortes de magistrats et greffiers, les former puis les affecter aux juridictions à stocks élevés.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Statut organique de la magistrature",
            "Indépendance judiciaire",
            "Concours, formation et crédits"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "justiciables",
            "juridictions"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "recruter-3-000-magistrats-et-greffiers:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -300,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Ouvrir des cohortes de magistrats et greffiers, les former puis les affecter aux juridictions à stocks élevés. Impact budgétaire retenu par le jeu : -300 millions d'euros."
            },
            {
              "id": "recruter-3-000-magistrats-et-greffiers:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Ouvrir des cohortes de magistrats et greffiers, les former puis les affecter aux juridictions à stocks élevés."
            },
            {
              "id": "recruter-3-000-magistrats-et-greffiers:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Ouvrir des cohortes de magistrats et greffiers, les former puis les affecter aux juridictions à stocks élevés."
            },
            {
              "id": "recruter-3-000-magistrats-et-greffiers:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Ouvrir des cohortes de magistrats et greffiers, les former puis les affecter aux juridictions à stocks élevés."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "recruter-3-000-magistrats-et-greffiers:keep",
          "label": "Maintenir la trajectoire actuelle",
          "summary": "La dépense n'augmente pas et les délais restent sous tension.",
          "mechanism": "Conserver la trajectoire d'effectifs et d'affectation actuelle.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "justiciables",
            "magistrats et greffiers"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "recruter-3-000-magistrats-et-greffiers:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la trajectoire d'effectifs et d'affectation actuelle."
            },
            {
              "id": "recruter-3-000-magistrats-et-greffiers:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la trajectoire d'effectifs et d'affectation actuelle."
            },
            {
              "id": "recruter-3-000-magistrats-et-greffiers:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la trajectoire d'effectifs et d'affectation actuelle."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Trajectoire de la loi de programmation justice.",
          "sourceName": "Ministère de la Justice",
          "sourceUrl": "https://www.justice.gouv.fr/sites/default/files/2026-01/RSJ2025%20ouvrage%20complet.pdf",
          "publishedAt": "2026-04-29",
          "note": "Activité des juridictions, administration pénitentiaire et moyens de la justice."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "doubler-l-execution-des-eloignements-oqtf",
      "version": 3,
      "kind": "transformation",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il doubler les éloignements effectivement exécutés ?",
      "context": "L'objectif exige escortes, places, accords consulaires et vols. Le coût est immédiat, le résultat dépend aussi des pays d'origine et des décisions de justice.",
      "options": [
        {
          "id": "doubler-l-execution-des-eloignements-oqtf:adopt",
          "label": "Doubler les éloignements",
          "summary": "L'État mobilise davantage de moyens pour exécuter les décisions, sans garantie de doubler le résultat.",
          "mechanism": "Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Recours individuel",
            "Non-refoulement",
            "Vie privée et familiale CEDH",
            "Directive Retour",
            "Coopération consulaire"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "exécution des décisions"
          ],
          "contributors": [
            "finances publiques",
            "personnes éloignées"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -400,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats. Impact budgétaire retenu par le jeu : -400 millions d'euros."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -1,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats."
            }
          ],
          "scheduledEvents": [
            {
              "id": "consular-bottleneck",
              "title": "Les laissez-passer limitent les éloignements",
              "body": "La coopération consulaire ne suit pas le rythme des moyens administratifs engagés.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "consular-bottleneck:indicator:reformCapacity",
                  "target": "indicator",
                  "key": "reformCapacity",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "La coopération consulaire ne suit pas le rythme des moyens administratifs engagés."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "doubler-l-execution-des-eloignements-oqtf:keep",
          "label": "Conserver les moyens actuels",
          "summary": "La dépense supplémentaire est évitée et l'écart entre décisions et exécutions persiste.",
          "mechanism": "Conserver les moyens et priorités d'exécution actuels.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "personnes protégées par l'examen individuel",
            "partenaires européens"
          ],
          "contributors": [
            "services chargés des éloignements"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les moyens et priorités d'exécution actuels."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les moyens et priorités d'exécution actuels."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les moyens et priorités d'exécution actuels."
            },
            {
              "id": "doubler-l-execution-des-eloignements-oqtf:keep:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les moyens et priorités d'exécution actuels."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Coût unitaire d'un éloignement établi par la Cour des comptes, multiplié par le volume visé, rétention et laissez-passer compris. Éloigner coûte avant d'économiser.",
          "sourceName": "Union européenne",
          "sourceUrl": "https://eur-lex.europa.eu/eli/dir/2008/115/oj?locale=fr",
          "publishedAt": "2008-12-16",
          "note": "Cadre européen des décisions de retour, de leur exécution et de la rétention."
        },
        {
          "label": "Coût unitaire d'un éloignement établi par la Cour des comptes, multiplié par le volume visé, rétention et laissez-passer compris. Éloigner coûte avant d'économiser.",
          "sourceName": "Légifrance",
          "sourceUrl": "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070158/",
          "publishedAt": "2026-08-30",
          "note": "Code consolidé de l'entrée et du séjour des étrangers et du droit d'asile."
        },
        {
          "label": "Coût unitaire d'un éloignement établi par la Cour des comptes, multiplié par le volume visé, rétention et laissez-passer compris. Éloigner coûte avant d'économiser.",
          "sourceName": "Ministère de l'Intérieur",
          "sourceUrl": "https://www.immigration.interieur.gouv.fr/chiffres-de-limmigration-en-france/eloignements-detrangers-en-situation-irreguliere-en-2025-dynamique-ascendante",
          "publishedAt": "2026-02-12",
          "note": "Éloignements exécutés et moyens mobilisés en 2025."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "supprimer-l-allocation-pour-demandeurs-d",
      "version": 3,
      "kind": "transformation",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il supprimer l'allocation pour demandeurs d'asile ?",
      "context": "L'allocation couvre les besoins élémentaires pendant la procédure. Sa suppression réduit le crédit, mais reporte une partie du coût vers l'urgence sociale et les collectivités.",
      "options": [
        {
          "id": "supprimer-l-allocation-pour-demandeurs-d:adopt",
          "label": "Supprimer l'allocation",
          "summary": "Le budget de l'asile baisse et les demandeurs sans ressources se reportent vers d'autres aides.",
          "mechanism": "Supprimer l'allocation monétaire tout en fournissant les conditions matérielles d'accueil légalement obligatoires.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Directive européenne sur les conditions d'accueil",
            "Dignité et subsistance",
            "Protection de l'enfance",
            "Droits attachés à la procédure d'asile"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "budget de l'État à court terme"
          ],
          "contributors": [
            "demandeurs d'asile",
            "urgence sociale"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 350,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Supprimer l'allocation monétaire tout en fournissant les conditions matérielles d'accueil légalement obligatoires. Impact budgétaire retenu par le jeu : 350 millions d'euros."
            },
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Supprimer l'allocation monétaire tout en fournissant les conditions matérielles d'accueil légalement obligatoires."
            },
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Supprimer l'allocation monétaire tout en fournissant les conditions matérielles d'accueil légalement obligatoires."
            },
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -6,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Supprimer l'allocation monétaire tout en fournissant les conditions matérielles d'accueil légalement obligatoires."
            },
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -5,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Supprimer l'allocation monétaire tout en fournissant les conditions matérielles d'accueil légalement obligatoires."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "supprimer-l-allocation-pour-demandeurs-d:keep",
          "label": "Maintenir l'allocation",
          "summary": "Le minimum de subsistance reste financé pendant la procédure.",
          "mechanism": "Maintenir le montant, les critères et les sanctions actuels de l'allocation.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "demandeurs d'asile éligibles",
            "collectivités d'accueil"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le montant, les critères et les sanctions actuels de l'allocation."
            },
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le montant, les critères et les sanctions actuels de l'allocation."
            },
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le montant, les critères et les sanctions actuels de l'allocation."
            },
            {
              "id": "supprimer-l-allocation-pour-demandeurs-d:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le montant, les critères et les sanctions actuels de l'allocation."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Budget voté de l'ADA. Petite ligne, gros totem : la carte donne l'échelle.",
          "sourceName": "Légifrance",
          "sourceUrl": "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070158/",
          "publishedAt": "2026-08-30",
          "note": "Code consolidé de l'entrée et du séjour des étrangers et du droit d'asile."
        },
        {
          "label": "Budget voté de l'ADA. Petite ligne, gros totem : la carte donne l'échelle.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-04/NEB-2024-Immigration.pdf",
          "publishedAt": "2025-04-15",
          "note": "Exécution budgétaire de la mission Immigration, asile et intégration."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "reserver-les-prestations-non-contributives-aux-nationaux",
      "version": 3,
      "kind": "rupture",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il réserver les prestations non contributives après cinq ans de résidence ?",
      "context": "Le délai exclut temporairement des étrangers en séjour régulier de prestations financées par l'impôt. Son rendement et sa conformité aux normes supérieures sont très contestés.",
      "options": [
        {
          "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt",
          "label": "Imposer cinq ans de résidence",
          "summary": "L'accès aux prestations est retardé et le contentieux juridique devient immédiat.",
          "mechanism": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Égalité constitutionnelle des étrangers résidant durablement",
            "Libre circulation et coordination sociale européenne",
            "Égalité des réfugiés",
            "Dignité et non-discrimination"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances sociales selon le chiffrage haut"
          ],
          "contributors": [
            "étrangers récemment installés",
            "collectivités"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 9000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet. Impact budgétaire retenu par le jeu : 9000 millions d'euros."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -6,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -8,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": -5,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet."
            }
          ],
          "scheduledEvents": [
            {
              "id": "benefits-constitutional-review",
              "title": "Les recours retardent l'application",
              "body": "Les recours imposent de reprendre la motivation et le traitement de certains dossiers. Le périmètre chiffré du scénario reste inchangé.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "benefits-constitutional-review:indicator:reformCapacity",
                  "target": "indicator",
                  "key": "reformCapacity",
                  "delta": -4,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les recours imposent de reprendre la motivation et le traitement de certains dossiers. Le périmètre chiffré du scénario reste inchangé."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "reserver-les-prestations-non-contributives-aux-nationaux:keep",
          "label": "Conserver les conditions actuelles",
          "summary": "Les résidents éligibles gardent leurs droits et aucune économie incertaine n'est comptée.",
          "mechanism": "Maintenir les conditions de résidence et d'éligibilité propres à chaque prestation.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "résidents étrangers régulièrement éligibles",
            "ménages modestes",
            "collectivités"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les conditions de résidence et d'éligibilité propres à chaque prestation."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les conditions de résidence et d'éligibilité propres à chaque prestation."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les conditions de résidence et d'éligibilité propres à chaque prestation."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:keep:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les conditions de résidence et d'éligibilité propres à chaque prestation."
            },
            {
              "id": "reserver-les-prestations-non-contributives-aux-nationaux:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les conditions de résidence et d'éligibilité propres à chaque prestation."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Fourchette du débat : ~16 000 revendiqués par ses promoteurs, 2 000 à 9 000 dans les contre-chiffrages une fois retiré ce que la Constitution et les traités interdisent en l'état. Retenu : le milieu, affiché avec sa fourchette et sa condition juridique : l'essentiel suppose une révision constitutionnelle.",
          "sourceName": "DREES",
          "sourceUrl": "https://www.drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/251204-minima-sociaux-et-prestations-de-solidarite",
          "publishedAt": "2025-12-04",
          "note": "Le gain de 9 000 millions d'euros est une hypothèse forte et contestée du jeu. Les règles doivent être examinées prestation par prestation et catégorie par catégorie; les recours retardent l'application sans réduire ici le périmètre chiffré."
        },
        {
          "label": "Fourchette du débat : ~16 000 revendiqués par ses promoteurs, 2 000 à 9 000 dans les contre-chiffrages une fois retiré ce que la Constitution et les traités interdisent en l'état. Retenu : le milieu, affiché avec sa fourchette et sa condition juridique : l'essentiel suppose une révision constitutionnelle.",
          "sourceName": "Légifrance",
          "sourceUrl": "https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006070158/",
          "publishedAt": "2026-08-30",
          "note": "Le gain de 9 000 millions d'euros est une hypothèse forte et contestée du jeu. Les règles doivent être examinées prestation par prestation et catégorie par catégorie; les recours retardent l'application sans réduire ici le périmètre chiffré."
        },
        {
          "label": "Fourchette du débat : ~16 000 revendiqués par ses promoteurs, 2 000 à 9 000 dans les contre-chiffrages une fois retiré ce que la Constitution et les traités interdisent en l'état. Retenu : le milieu, affiché avec sa fourchette et sa condition juridique : l'essentiel suppose une révision constitutionnelle.",
          "sourceName": "Ministère de l'Intérieur",
          "sourceUrl": "https://www.immigration.interieur.gouv.fr/documentation/etudes-et-statistiques/lessentiel-de-limmigration-donnees-2025.html",
          "publishedAt": "2026-08-25",
          "note": "Le gain de 9 000 millions d'euros est une hypothèse forte et contestée du jeu. Les règles doivent être examinées prestation par prestation et catégorie par catégorie; les recours retardent l'application sans réduire ici le périmètre chiffré."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "quotas-annuels-d-immigration",
      "version": 3,
      "kind": "rupture",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il faire voter des quotas annuels d'immigration ?",
      "context": "Le Parlement fixerait des objectifs par motif ou métier. Les quotas peuvent orienter l'immigration de travail, mais l'asile et la vie familiale obéissent à des droits distincts.",
      "options": [
        {
          "id": "quotas-annuels-d-immigration:adopt",
          "label": "Faire voter les quotas",
          "summary": "Le Parlement fixe chaque année les volumes recherchés, sous contrôle du juge et des engagements internationaux.",
          "mechanism": "Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit.",
          "horizon": {
            "kind": "mandate_year",
            "year": 3
          },
          "legalConstraints": [
            "Séparation des pouvoirs et examen individuel",
            "Convention de Genève",
            "Vie familiale CEDH",
            "Libre circulation et droit d'asile européen"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "métiers en tension",
            "pilotage parlementaire"
          ],
          "contributors": [
            "administration",
            "candidats hors quota"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "quotas-annuels-d-immigration:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -200,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit. Impact budgétaire retenu par le jeu : -200 millions d'euros."
            },
            {
              "id": "quotas-annuels-d-immigration:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 3,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit."
            },
            {
              "id": "quotas-annuels-d-immigration:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 3,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit."
            },
            {
              "id": "quotas-annuels-d-immigration:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -1,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit."
            },
            {
              "id": "quotas-annuels-d-immigration:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit."
            },
            {
              "id": "quotas-annuels-d-immigration:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 3
              },
              "duration": "once",
              "explanation": "Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "quotas-annuels-d-immigration:keep",
          "label": "Conserver les règles par droit et motif",
          "summary": "Les admissions continuent de dépendre des titres, de l'asile, de la famille et du travail.",
          "mechanism": "Maintenir les admissions par titre, motif et droit individuel.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "candidats remplissant les règles actuelles"
          ],
          "contributors": [
            "pilotage politique"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "quotas-annuels-d-immigration:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les admissions par titre, motif et droit individuel."
            },
            {
              "id": "quotas-annuels-d-immigration:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les admissions par titre, motif et droit individuel."
            },
            {
              "id": "quotas-annuels-d-immigration:keep:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les admissions par titre, motif et droit individuel."
            },
            {
              "id": "quotas-annuels-d-immigration:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les admissions par titre, motif et droit individuel."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Flux d'entrée par motif et contraintes juridiques des politiques migratoires.",
          "sourceName": "Ministère de l'Intérieur",
          "sourceUrl": "https://www.immigration.interieur.gouv.fr/documentation/etudes-et-statistiques/lessentiel-de-limmigration-donnees-2025.html",
          "publishedAt": "2026-08-25",
          "note": "Titres, asile, éloignements, acquisitions et intégration en 2025."
        },
        {
          "label": "Flux d'entrée par motif et contraintes juridiques des politiques migratoires.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-04/NEB-2024-Immigration.pdf",
          "publishedAt": "2025-04-15",
          "note": "Exécution budgétaire de la mission Immigration, asile et intégration."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "legaliser-et-taxer-le-cannabis",
      "version": 3,
      "kind": "rupture",
      "chapterId": "security-immigration-justice",
      "title": "Faut-il légaliser et taxer le cannabis ?",
      "context": "La vente passe dans un marché réglementé et taxé. Une partie du trafic disparaît, tandis que santé publique, prix et accès deviennent des choix de régulation.",
      "options": [
        {
          "id": "legaliser-et-taxer-le-cannabis:adopt",
          "label": "Légaliser et taxer",
          "summary": "L'État régule le produit et encaisse une taxe, avec un nouveau marché légal à surveiller.",
          "mechanism": "Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité.",
          "horizon": {
            "kind": "after_decisions",
            "count": 4
          },
          "legalConstraints": [
            "Conventions des Nations unies sur les stupéfiants",
            "Cadre européen de lutte contre le trafic",
            "Modifier les lois pénales, sanitaires et fiscales"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "consommateurs sortant du marché clandestin"
          ],
          "contributors": [
            "trafiquants",
            "acteurs de santé publique"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "legaliser-et-taxer-le-cannabis:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 2800,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité. Impact budgétaire retenu par le jeu : 2800 millions d'euros."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 4,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "legaliser-et-taxer-le-cannabis:keep",
          "label": "Maintenir l'interdiction",
          "summary": "La prohibition et les sanctions demeurent, ainsi que le marché clandestin.",
          "mechanism": "Maintenir l'interdiction, les sanctions et les exceptions médicales actuelles.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "riverains des points de vente illicites",
            "personnes souhaitant éviter la banalisation"
          ],
          "contributors": [
            "consommateurs de cannabis",
            "finances publiques",
            "forces de sécurité"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "legaliser-et-taxer-le-cannabis:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'interdiction, les sanctions et les exceptions médicales actuelles."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'interdiction, les sanctions et les exceptions médicales actuelles."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'interdiction, les sanctions et les exceptions médicales actuelles."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'interdiction, les sanctions et les exceptions médicales actuelles."
            },
            {
              "id": "legaliser-et-taxer-le-cannabis:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'interdiction, les sanctions et les exceptions médicales actuelles."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Travaux du Conseil d'analyse économique : recettes fiscales d'un marché légal, plus les économies de répression.",
          "sourceName": "Conseil d'analyse économique",
          "sourceUrl": "https://cae-eco.fr/Cannabis-comment-reprendre-le-controle",
          "publishedAt": "2019-06-20",
          "note": "Les recettes et économies sont un scénario d'expertise repris par le jeu, pas un rendement garanti."
        },
        {
          "label": "Travaux du Conseil d'analyse économique : recettes fiscales d'un marché légal, plus les économies de répression.",
          "sourceName": "Ministère de la Justice",
          "sourceUrl": "https://www.justice.gouv.fr/sites/default/files/2026-01/RSJ2025%20ouvrage%20complet.pdf",
          "publishedAt": "2026-04-29",
          "note": "Les recettes et économies sont un scénario d'expertise repris par le jeu, pas un rendement garanti."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "porter-l-effort-de-defense-vers-3",
      "version": 3,
      "kind": "gestion",
      "chapterId": "defence-europe-sovereignty",
      "title": "Faut-il porter l'effort de défense à 3 % du PIB ?",
      "context": "La hausse accélère munitions, équipements et disponibilité. Elle représente plusieurs milliards récurrents à trouver dans un budget déjà déficitaire.",
      "options": [
        {
          "id": "porter-l-effort-de-defense-vers-3:adopt",
          "label": "Viser 3 % du PIB",
          "summary": "Les armées reçoivent des moyens supplémentaires et le déficit se creuse sans financement associé.",
          "mechanism": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Loi de finances et programmation militaire",
            "Commande publique et contrats en cours"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "armées",
            "industrie de défense",
            "alliés"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "porter-l-effort-de-defense-vers-3:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -6000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire. Impact budgétaire retenu par le jeu : -6000 millions d'euros."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:adopt:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:adopt:group:creditors",
              "target": "group",
              "key": "creditors",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "porter-l-effort-de-defense-vers-3:keep",
          "label": "Suivre la trajectoire actuelle",
          "summary": "La marche budgétaire reste plus basse et certaines capacités arrivent plus tard.",
          "mechanism": "Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Loi de finances et programmation militaire",
            "Commande publique et contrats en cours"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "contribuables",
            "créanciers publics"
          ],
          "contributors": [
            "forces armées",
            "industrie de défense",
            "partenaires européens"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "porter-l-effort-de-defense-vers-3:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:keep:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire."
            },
            {
              "id": "porter-l-effort-de-defense-vers-3:keep:group:creditors",
              "target": "group",
              "key": "creditors",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Écart entre la LPM votée (60 004 M€ en 2025) et la cible.",
          "sourceName": "Ministère des Armées",
          "sourceUrl": "https://www.defense.gouv.fr/actualites/lpm-2024-2030-accroitre-forces-morales",
          "publishedAt": "2024-02-19",
          "note": "1re marche"
        },
        {
          "label": "Écart entre la LPM votée (60 004 M€ en 2025) et la cible.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "1re marche"
        }
      ],
      "dependencies": [],
      "conflicts": [
        "etaler-la-marche-2026-de-la-programmation"
      ]
    },
    {
      "id": "doubler-la-reserve-operationnelle",
      "version": 3,
      "kind": "gestion",
      "chapterId": "defence-europe-sovereignty",
      "title": "Faut-il doubler la réserve opérationnelle ?",
      "context": "La réserve renforce les effectifs mobilisables sans créer autant de postes permanents. Formation, équipement et disponibilité des employeurs restent nécessaires.",
      "options": [
        {
          "id": "doubler-la-reserve-operationnelle:adopt",
          "label": "Doubler la réserve",
          "summary": "Les armées disposent de davantage de renforts et financent leur formation et leurs périodes d'activité.",
          "mechanism": "Signer davantage de contrats, former, équiper et convoquer les nouveaux réservistes.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Loi de finances et programmation militaire",
            "Statut, disponibilité et protection des réservistes"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "armées",
            "résilience nationale"
          ],
          "contributors": [
            "finances publiques",
            "employeurs"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-la-reserve-operationnelle:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -400,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Signer davantage de contrats, former, équiper et convoquer les nouveaux réservistes. Impact budgétaire retenu par le jeu : -400 millions d'euros."
            },
            {
              "id": "doubler-la-reserve-operationnelle:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Signer davantage de contrats, former, équiper et convoquer les nouveaux réservistes."
            },
            {
              "id": "doubler-la-reserve-operationnelle:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 1,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Signer davantage de contrats, former, équiper et convoquer les nouveaux réservistes."
            },
            {
              "id": "doubler-la-reserve-operationnelle:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Signer davantage de contrats, former, équiper et convoquer les nouveaux réservistes."
            },
            {
              "id": "doubler-la-reserve-operationnelle:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 1,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Signer davantage de contrats, former, équiper et convoquer les nouveaux réservistes."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "doubler-la-reserve-operationnelle:keep",
          "label": "Conserver la cible actuelle",
          "summary": "La dépense reste contenue et la capacité de mobilisation progresse moins vite.",
          "mechanism": "Conserver le volume actuel de contrats et de journées de formation.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Loi de finances et programmation militaire",
            "Statut des réservistes"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "employeurs de réservistes"
          ],
          "contributors": [
            "forces armées",
            "réservistes candidats"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-la-reserve-operationnelle:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le volume actuel de contrats et de journées de formation."
            },
            {
              "id": "doubler-la-reserve-operationnelle:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le volume actuel de contrats et de journées de formation."
            },
            {
              "id": "doubler-la-reserve-operationnelle:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver le volume actuel de contrats et de journées de formation."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Cible et coût inscrits dans la LPM.",
          "sourceName": "Ministère des Armées",
          "sourceUrl": "https://www.defense.gouv.fr/actualites/lpm-2024-2030-accroitre-forces-morales",
          "publishedAt": "2024-02-19",
          "note": "Objectifs, effectifs et trajectoire de la loi de programmation militaire 2024-2030."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "service-militaire-volontaire-de-50-000",
      "version": 3,
      "kind": "transformation",
      "chapterId": "defence-europe-sovereignty",
      "title": "Faut-il créer un service militaire volontaire de 50 000 jeunes ?",
      "context": "Le dispositif forme et encadre une classe de volontaires. Il coûte bien plus qu'une réserve ciblée et ne devient une capacité militaire qu'après formation.",
      "options": [
        {
          "id": "service-militaire-volontaire-de-50-000:adopt",
          "label": "Créer le service volontaire",
          "summary": "Cinquante mille jeunes suivent une formation militaire et l'État finance encadrement, solde et infrastructures.",
          "mechanism": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Loi de finances et programmation militaire",
            "Volontariat, statut, droits et encadrement"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "jeunes volontaires",
            "armées",
            "cohésion"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "service-militaire-volontaire-de-50-000:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -2000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures. Impact budgétaire retenu par le jeu : -2000 millions d'euros."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 4,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 1,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "service-militaire-volontaire-de-50-000:keep",
          "label": "Conserver les dispositifs actuels",
          "summary": "La dépense est évitée et les armées restent concentrées sur recrutement et réserve.",
          "mechanism": "Concentrer les moyens sur les forces professionnelles et la réserve existante.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Loi de finances et programmation militaire",
            "Statut des réservistes"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "employeurs civils"
          ],
          "contributors": [
            "jeunes candidats",
            "forces armées"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "service-militaire-volontaire-de-50-000:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Concentrer les moyens sur les forces professionnelles et la réserve existante."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Concentrer les moyens sur les forces professionnelles et la réserve existante."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Concentrer les moyens sur les forces professionnelles et la réserve existante."
            },
            {
              "id": "service-militaire-volontaire-de-50-000:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Concentrer les moyens sur les forces professionnelles et la réserve existante."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Annonce de 2025 : environ 800 M€ la première année, 2 000 en régime de croisière. Remplace le SNU.",
          "sourceName": "Ministère des Armées",
          "sourceUrl": "https://www.defense.gouv.fr/actualites/lpm-2024-2030-accroitre-forces-morales",
          "publishedAt": "2024-02-19",
          "note": "en régime"
        }
      ],
      "dependencies": [],
      "conflicts": [
        "generaliser-le-service-national-universel"
      ]
    },
    {
      "id": "doubler-les-moyens-du-renseignement-interieur",
      "version": 3,
      "kind": "transformation",
      "chapterId": "defence-europe-sovereignty",
      "title": "Faut-il doubler les moyens du renseignement intérieur ?",
      "context": "Effectifs, technologies et surveillance augmentent. La capacité de prévention progresse, avec des enjeux plus lourds de contrôle démocratique et de recrutement.",
      "options": [
        {
          "id": "doubler-les-moyens-du-renseignement-interieur:adopt",
          "label": "Doubler les moyens",
          "summary": "Le renseignement gagne des capacités humaines et techniques sous un contrôle à renforcer.",
          "mechanism": "Recruter des personnels habilités, acheter les systèmes nécessaires et renforcer simultanément les contrôles.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Crédits de la loi de finances",
            "Code de la sécurité intérieure et finalités légales des techniques de renseignement",
            "Autorisation, nécessité et proportionnalité des techniques",
            "Contrôle de la CNCTR et recours juridictionnel",
            "Protection des données, habilitations et secret de la défense nationale"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "services de renseignement",
            "sécurité nationale"
          ],
          "contributors": [
            "finances publiques",
            "vie privée"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-les-moyens-du-renseignement-interieur:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -300,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Recruter des personnels habilités, acheter les systèmes nécessaires et renforcer simultanément les contrôles. Impact budgétaire retenu par le jeu : -300 millions d'euros."
            },
            {
              "id": "doubler-les-moyens-du-renseignement-interieur:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 4,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Recruter des personnels habilités, acheter les systèmes nécessaires et renforcer simultanément les contrôles."
            },
            {
              "id": "doubler-les-moyens-du-renseignement-interieur:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Recruter des personnels habilités, acheter les systèmes nécessaires et renforcer simultanément les contrôles."
            },
            {
              "id": "doubler-les-moyens-du-renseignement-interieur:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Recruter des personnels habilités, acheter les systèmes nécessaires et renforcer simultanément les contrôles."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "doubler-les-moyens-du-renseignement-interieur:keep",
          "label": "Maintenir la trajectoire",
          "summary": "La dépense reste contenue et la montée en puissance demeure progressive.",
          "mechanism": "Poursuivre les recrutements et équipements déjà programmés sans doublement.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Contrôle du renseignement, libertés fondamentales et données"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "personnes attachées aux garanties de la vie privée"
          ],
          "contributors": [
            "services de renseignement",
            "population exposée aux menaces"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-les-moyens-du-renseignement-interieur:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre les recrutements et équipements déjà programmés sans doublement."
            },
            {
              "id": "doubler-les-moyens-du-renseignement-interieur:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre les recrutements et équipements déjà programmés sans doublement."
            },
            {
              "id": "doubler-les-moyens-du-renseignement-interieur:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Poursuivre les recrutements et équipements déjà programmés sans doublement."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Budgets votés des services.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/27959",
          "publishedAt": "2024-10-10",
          "note": "Les 300 millions d'euros par an sont une hypothèse incrémentale du jeu; les périmètres budgétaires du renseignement sont éclatés ou protégés et les sources ne chiffrent pas un doublement littéral."
        },
        {
          "label": "Budgets votés des services.",
          "sourceName": "Légifrance",
          "sourceUrl": "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047046768",
          "publishedAt": "2023-01-24",
          "note": "Les 300 millions d'euros par an sont une hypothèse incrémentale du jeu; les périmètres budgétaires du renseignement sont éclatés ou protégés et les sources ne chiffrent pas un doublement littéral."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "sortir-de-l-euro",
      "version": 3,
      "kind": "rupture",
      "chapterId": "defence-europe-sovereignty",
      "title": "Faut-il sortir de l'euro et rétablir une monnaie nationale ?",
      "context": "La France récupère son taux de change et une politique monétaire nationale. Contrats, dépôts, dette, inflation et relations européennes entrent dans une transition sans précédent.",
      "options": [
        {
          "id": "sortir-de-l-euro:adopt",
          "label": "Rétablir une monnaie nationale",
          "summary": "Les contrats sont convertis et la nouvelle monnaie flotte, avec un risque immédiat sur les prix et le financement.",
          "mechanism": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie.",
          "horizon": {
            "kind": "after_decisions",
            "count": 1
          },
          "legalConstraints": [
            "Les traités ne prévoient aucune procédure autonome de sortie du seul euro pour un État sans dérogation",
            "Obtenir un accord de droit primaire, par révision des traités ou retrait de l'Union selon l'option politique",
            "Traiter constitutionnalité, statut de la banque centrale et relations avec l'Eurosystème",
            "Garantir paiements, dépôts, conversion des contrats et dettes, notamment sous droit étranger",
            "Encadrer les mouvements de capitaux dans le respect du droit de l'Union et protéger les déposants"
          ],
          "budgetDuration": "once",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "secteurs exportateurs après dépréciation",
            "politique monétaire nationale"
          ],
          "contributors": [
            "épargnants",
            "importateurs",
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "sortir-de-l-euro:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -35000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie. Impact budgétaire retenu par le jeu : -35000 millions d'euros."
            },
            {
              "id": "sortir-de-l-euro:adopt:indicator:interestCost",
              "target": "indicator",
              "key": "interestCost",
              "delta": 12000,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "annual",
              "explanation": "Le scénario retient une hausse annuelle hypothétique de 12 000 millions d'euros de la charge d'intérêt; ce stress n'est pas une prévision officielle."
            },
            {
              "id": "sortir-de-l-euro:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -15,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie."
            },
            {
              "id": "sortir-de-l-euro:adopt:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": -20,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie."
            },
            {
              "id": "sortir-de-l-euro:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -8,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie."
            },
            {
              "id": "sortir-de-l-euro:adopt:group:creditors",
              "target": "group",
              "key": "creditors",
              "delta": -20,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie."
            },
            {
              "id": "sortir-de-l-euro:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": -15,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie."
            },
            {
              "id": "sortir-de-l-euro:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -12,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie."
            },
            {
              "id": "sortir-de-l-euro:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -8,
              "timing": {
                "kind": "after_decisions",
                "count": 1
              },
              "duration": "once",
              "explanation": "Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie."
            }
          ],
          "scheduledEvents": [
            {
              "id": "currency-conversion",
              "title": "La conversion perturbe les paiements",
              "body": "Dans le stress du jeu, les banques limitent temporairement certains mouvements et les importations renchérissent.",
              "afterDecisions": 1,
              "effects": [
                {
                  "id": "currency-conversion:indicator:institutionalTrust",
                  "target": "indicator",
                  "key": "institutionalTrust",
                  "delta": -10,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Dans le stress du jeu, les banques limitent temporairement certains mouvements et les importations renchérissent."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "sortir-de-l-euro:keep",
          "label": "Rester dans l'euro",
          "summary": "La monnaie unique et la politique de la BCE restent le cadre monétaire français.",
          "mechanism": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Cadre de l'Union économique et monétaire"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "épargnants",
            "importateurs",
            "stabilité financière"
          ],
          "contributors": [
            "autonomie monétaire nationale"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "sortir-de-l-euro:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE."
            },
            {
              "id": "sortir-de-l-euro:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE."
            },
            {
              "id": "sortir-de-l-euro:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE."
            },
            {
              "id": "sortir-de-l-euro:keep:group:creditors",
              "target": "group",
              "key": "creditors",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE."
            },
            {
              "id": "sortir-de-l-euro:keep:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE."
            },
            {
              "id": "sortir-de-l-euro:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE."
            },
            {
              "id": "sortir-de-l-euro:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Fonctionnement de l'euro, dette publique et intégration financière.",
          "sourceName": "Banque centrale européenne",
          "sourceUrl": "https://www.ecb.europa.eu/euro/html/index.fr.html",
          "publishedAt": "2026-01-01",
          "note": "Le choc ponctuel de 35 milliards d'euros et la charge d'intérêt de 12 milliards par an sont des hypothèses de stress du jeu, pas des prévisions officielles."
        },
        {
          "label": "Fonctionnement de l'euro, dette publique et intégration financière.",
          "sourceName": "Eurostat",
          "sourceUrl": "https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Government_finance_statistics",
          "publishedAt": "2026-04-22",
          "note": "Le choc ponctuel de 35 milliards d'euros et la charge d'intérêt de 12 milliards par an sont des hypothèses de stress du jeu, pas des prévisions officielles."
        },
        {
          "label": "Fonctionnement de l'euro, dette publique et intégration financière.",
          "sourceName": "Institut Thomas More",
          "sourceUrl": "https://institut-thomas-more.org/2026/06/25/rapport36/",
          "publishedAt": "2026-06-25",
          "note": "Le choc ponctuel de 35 milliards d'euros et la charge d'intérêt de 12 milliards par an sont des hypothèses de stress du jeu, pas des prévisions officielles."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "referendum-sur-la-sortie-de-l-ue",
      "version": 3,
      "kind": "rupture",
      "chapterId": "defence-europe-sovereignty",
      "title": "Faut-il organiser un référendum sur la sortie de l'Union européenne ?",
      "context": "Le vote tranche l'appartenance de la France à l'Union. La campagne ouvre immédiatement l'incertitude sur marché unique, budget, droit, frontières et monnaie.",
      "options": [
        {
          "id": "referendum-sur-la-sortie-de-l-ue:adopt",
          "label": "Organiser le référendum",
          "summary": "La souveraineté européenne est remise au vote et l'incertitude économique commence avant même le résultat.",
          "mechanism": "Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Base constitutionnelle du référendum",
            "Organisation du scrutin",
            "La procédure de retrait ne commence qu'après un éventuel vote favorable"
          ],
          "budgetDuration": "once",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "souveraineté populaire"
          ],
          "contributors": [
            "stabilité politique",
            "entreprises exposées au marché unique"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "referendum-sur-la-sortie-de-l-ue:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -500,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote. Impact budgétaire retenu par le jeu : -500 millions d'euros."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:adopt:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": -10,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -8,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": -12,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote."
            }
          ],
          "scheduledEvents": [
            {
              "id": "eu-referendum-market",
              "title": "Les investissements attendent le vote",
              "body": "Plusieurs décisions industrielles sont suspendues jusqu'au résultat et à ses suites.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "eu-referendum-market:indicator:investment",
                  "target": "indicator",
                  "key": "investment",
                  "delta": -8,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Plusieurs décisions industrielles sont suspendues jusqu'au résultat et à ses suites."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "referendum-sur-la-sortie-de-l-ue:keep",
          "label": "Rester dans l'Union sans référendum",
          "summary": "L'appartenance à l'Union n'est pas remise en jeu pendant le mandat.",
          "mechanism": "Ne pas ouvrir de procédure référendaire ou de retrait pendant le mandat.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "stabilité juridique",
            "entreprises européennes"
          ],
          "contributors": [
            "partisans du référendum"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "referendum-sur-la-sortie-de-l-ue:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas ouvrir de procédure référendaire ou de retrait pendant le mandat."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas ouvrir de procédure référendaire ou de retrait pendant le mandat."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:keep:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas ouvrir de procédure référendaire ou de retrait pendant le mandat."
            },
            {
              "id": "referendum-sur-la-sortie-de-l-ue:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne pas ouvrir de procédure référendaire ou de retrait pendant le mandat."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Intégration budgétaire et économique de la France dans l'Union européenne.",
          "sourceName": "Commission européenne",
          "sourceUrl": "https://european-union.europa.eu/institutions-law-budget/budget/spending_en",
          "publishedAt": "2025-01-01",
          "note": "Architecture et affectation du budget de l'Union européenne."
        },
        {
          "label": "Intégration budgétaire et économique de la France dans l'Union européenne.",
          "sourceName": "Eurostat",
          "sourceUrl": "https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Government_finance_statistics",
          "publishedAt": "2026-04-22",
          "note": "Comparaisons européennes des recettes, dépenses, déficits et dettes publics."
        },
        {
          "label": "Intégration budgétaire et économique de la France dans l'Union européenne.",
          "sourceName": "Institut Thomas More",
          "sourceUrl": "https://institut-thomas-more.org/2026/06/25/rapport36/",
          "publishedAt": "2026-06-25",
          "note": "Contrepoint éditorial libéral-conservateur. Cette source ne fonde jamais seule un chiffrage."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "creer-une-armee-europeenne",
      "version": 3,
      "kind": "rupture",
      "chapterId": "defence-europe-sovereignty",
      "title": "Faut-il intégrer une partie des armées dans une armée européenne ?",
      "context": "Commandement, doctrine et capacités deviennent communs. L'échelle augmente, mais la France ne décide plus seule de l'emploi des unités intégrées.",
      "options": [
        {
          "id": "creer-une-armee-europeenne:adopt",
          "label": "Créer l'armée européenne",
          "summary": "Des forces passent sous commandement commun et les États partagent dépenses et décisions d'engagement.",
          "mechanism": "Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros.",
          "horizon": {
            "kind": "after_decisions",
            "count": 4
          },
          "legalConstraints": [
            "Décision du Conseil européen à l'unanimité pour une défense commune selon l'article 42 paragraphe 2 TUE",
            "Adoption par chaque État membre conformément à ses règles constitutionnelles",
            "Respect des obligations découlant de l'OTAN et unanimité des décisions PSDC selon l'article 42 paragraphe 4",
            "Définir contrôle démocratique, règles d'engagement et chaîne nationale de décision nucléaire"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "capacités européennes",
            "mutualisation"
          ],
          "contributors": [
            "autonomie militaire nationale"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "creer-une-armee-europeenne:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 3000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros. Impact budgétaire retenu par le jeu : 3000 millions d'euros."
            },
            {
              "id": "creer-une-armee-europeenne:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros."
            },
            {
              "id": "creer-une-armee-europeenne:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 4,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros."
            },
            {
              "id": "creer-une-armee-europeenne:adopt:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros."
            },
            {
              "id": "creer-une-armee-europeenne:adopt:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": 10,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros."
            },
            {
              "id": "creer-une-armee-europeenne:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "creer-une-armee-europeenne:keep",
          "label": "Conserver des armées nationales",
          "summary": "Les coopérations continuent sans transfert permanent du commandement.",
          "mechanism": "Maintenir le commandement national tout en poursuivant les coopérations et forces multinationales existantes.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Règles nationales et engagements internationaux des forces"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "souveraineté militaire"
          ],
          "contributors": [
            "mutualisation européenne"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "creer-une-armee-europeenne:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le commandement national tout en poursuivant les coopérations et forces multinationales existantes."
            },
            {
              "id": "creer-une-armee-europeenne:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le commandement national tout en poursuivant les coopérations et forces multinationales existantes."
            },
            {
              "id": "creer-une-armee-europeenne:keep:group:europeanPartners",
              "target": "group",
              "key": "europeanPartners",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le commandement national tout en poursuivant les coopérations et forces multinationales existantes."
            },
            {
              "id": "creer-une-armee-europeenne:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir le commandement national tout en poursuivant les coopérations et forces multinationales existantes."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Capacités militaires françaises et financement commun européen.",
          "sourceName": "Union européenne",
          "sourceUrl": "https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:12012M042",
          "publishedAt": "2012-10-26",
          "note": "Le gain français de 3 000 millions d'euros par an est une hypothèse de mutualisation du jeu; il dépend des dépenses nationales réellement substituées et des coûts de transition."
        },
        {
          "label": "Capacités militaires françaises et financement commun européen.",
          "sourceName": "Ministère des Armées",
          "sourceUrl": "https://www.defense.gouv.fr/actualites/lpm-2024-2030-accroitre-forces-morales",
          "publishedAt": "2024-02-19",
          "note": "Le gain français de 3 000 millions d'euros par an est une hypothèse de mutualisation du jeu; il dépend des dépenses nationales réellement substituées et des coûts de transition."
        },
        {
          "label": "Capacités militaires françaises et financement commun européen.",
          "sourceName": "Commission européenne",
          "sourceUrl": "https://european-union.europa.eu/institutions-law-budget/budget/spending_en",
          "publishedAt": "2025-01-01",
          "note": "Le gain français de 3 000 millions d'euros par an est une hypothèse de mutualisation du jeu; il dépend des dépenses nationales réellement substituées et des coûts de transition."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "doubler-maprimerenov",
      "version": 3,
      "kind": "gestion",
      "chapterId": "energy-climate-transport-agriculture",
      "title": "Faut-il doubler MaPrimeRénov' ?",
      "context": "L'aide accélère les rénovations si artisans, contrôles et ménages suivent. Le coût budgétaire arrive avant les économies d'énergie.",
      "options": [
        {
          "id": "doubler-maprimerenov:adopt",
          "label": "Doubler l'enveloppe",
          "summary": "Davantage de ménages sont aidés et l'État double presque sa dépense annuelle.",
          "mechanism": "Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Loi de finances",
            "Règles d'attribution, contrôle et lutte contre la fraude"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "ménages rénovant",
            "artisans"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-maprimerenov:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -2300,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles. Impact budgétaire retenu par le jeu : -2300 millions d'euros."
            },
            {
              "id": "doubler-maprimerenov:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles."
            },
            {
              "id": "doubler-maprimerenov:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 1,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles."
            },
            {
              "id": "doubler-maprimerenov:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles."
            },
            {
              "id": "doubler-maprimerenov:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles."
            },
            {
              "id": "doubler-maprimerenov:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "doubler-maprimerenov:keep",
          "label": "Conserver l'enveloppe",
          "summary": "Le coût reste contenu et les rénovations avancent au rythme actuel.",
          "mechanism": "Conserver les critères, plafonds et rythme de traitement actuels.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Règles existantes du dispositif"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "ménages rénovateurs",
            "entreprises du bâtiment"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-maprimerenov:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les critères, plafonds et rythme de traitement actuels."
            },
            {
              "id": "doubler-maprimerenov:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les critères, plafonds et rythme de traitement actuels."
            },
            {
              "id": "doubler-maprimerenov:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les critères, plafonds et rythme de traitement actuels."
            },
            {
              "id": "doubler-maprimerenov:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les critères, plafonds et rythme de traitement actuels."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Crédits votés du programme.",
          "sourceName": "Anah",
          "sourceUrl": "https://www.anah.gouv.fr/presse/maprimerenov-reouverture-du-guichet-la-promulgation-de-la-loi-de-finances",
          "publishedAt": "2026-02-06",
          "note": "Les 2 300 millions d'euros par an sont l'hypothèse du jeu; ils ne correspondent pas au doublement mécanique du budget d'intervention 2026 publié par l'Anah."
        },
        {
          "label": "Crédits votés du programme.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30586",
          "publishedAt": "2025-10-14",
          "note": "Les 2 300 millions d'euros par an sont l'hypothèse du jeu; ils ne correspondent pas au doublement mécanique du budget d'intervention 2026 publié par l'Anah."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "plan-ferroviaire-3-000-m-de-plus",
      "version": 3,
      "kind": "gestion",
      "chapterId": "energy-climate-transport-agriculture",
      "title": "Faut-il ajouter trois milliards d'euros par an au ferroviaire ?",
      "context": "Le réseau a besoin de renouvellement avant les nouvelles lignes. L'investissement améliore la capacité à terme et pèse immédiatement sur les crédits.",
      "options": [
        {
          "id": "plan-ferroviaire-3-000-m-de-plus:adopt",
          "label": "Financer le plan ferroviaire",
          "summary": "Le réseau reçoit trois milliards de plus par an et les chantiers montent en charge.",
          "mechanism": "Contractualiser le renouvellement du réseau avant de lancer les chantiers de capacité.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Loi de finances",
            "Contrats de performance, commande publique et règles ferroviaires"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "voyageurs",
            "fret",
            "territoires"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -3000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Contractualiser le renouvellement du réseau avant de lancer les chantiers de capacité. Impact budgétaire retenu par le jeu : -3000 millions d'euros."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 6,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Contractualiser le renouvellement du réseau avant de lancer les chantiers de capacité."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Contractualiser le renouvellement du réseau avant de lancer les chantiers de capacité."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Contractualiser le renouvellement du réseau avant de lancer les chantiers de capacité."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Contractualiser le renouvellement du réseau avant de lancer les chantiers de capacité."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "plan-ferroviaire-3-000-m-de-plus:keep",
          "label": "Conserver les crédits actuels",
          "summary": "La dépense n'augmente pas et les renouvellements restent priorisés dans l'enveloppe existante.",
          "mechanism": "Prioriser les renouvellements dans l'enveloppe existante.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Contrats et règles ferroviaires existants"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "voyageurs ferroviaires",
            "entreprises ferroviaires",
            "collectivités"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prioriser les renouvellements dans l'enveloppe existante."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prioriser les renouvellements dans l'enveloppe existante."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prioriser les renouvellements dans l'enveloppe existante."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prioriser les renouvellements dans l'enveloppe existante."
            },
            {
              "id": "plan-ferroviaire-3-000-m-de-plus:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prioriser les renouvellements dans l'enveloppe existante."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Scénarios d'investissement du COI et de SNCF Réseau.",
          "sourceName": "SNCF Réseau",
          "sourceUrl": "https://www.sncf-reseau.com/fr/finances",
          "publishedAt": "2026-08-30",
          "note": "SNCF Réseau documente 1,5 milliard d'euros supplémentaire par an pour régénération et modernisation; les 3 milliards retenus ici forment un paquet de scénario plus large."
        },
        {
          "label": "Scénarios d'investissement du COI et de SNCF Réseau.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "SNCF Réseau documente 1,5 milliard d'euros supplémentaire par an pour régénération et modernisation; les 3 milliards retenus ici forment un paquet de scénario plus large."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "engager-six-epr2-part-annuelle-de-l",
      "version": 3,
      "kind": "transformation",
      "chapterId": "energy-climate-transport-agriculture",
      "title": "Quel avenir pour le nucléaire ?",
      "context": "Le parc actuel vieillit. Six, quatorze ou aucun nouveau réacteur engagent coûts, industrie et système électrique pour plusieurs décennies.",
      "options": [
        {
          "id": "engager-six-epr2-part-annuelle-de-l:six",
          "label": "Engager six EPR2",
          "summary": "Le premier programme est lancé et sa montée en charge industrielle est financée.",
          "mechanism": "Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Loi de finances",
            "Autorisations nucléaires, sûreté, sites et commande"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "filière nucléaire",
            "sécurité d'approvisionnement future"
          ],
          "contributors": [
            "finances publiques",
            "consommateurs futurs"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "engager-six-epr2-part-annuelle-de-l:six:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -2000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat. Impact budgétaire retenu par le jeu : -2000 millions d'euros."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:six:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:six:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:six:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:six:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 4,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:six:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "sortie-du-nucleaire-en-2040"
          ],
          "unlocks": []
        },
        {
          "id": "engager-six-epr2-part-annuelle-de-l:fourteen",
          "label": "Engager quatorze EPR2",
          "summary": "Le programme maximal accélère le renouvellement du parc et concentre un risque industriel beaucoup plus élevé.",
          "mechanism": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Loi de finances",
            "Autorisations nucléaires, sûreté, sites et commande"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "filière nucléaire",
            "production pilotable future"
          ],
          "contributors": [
            "finances publiques",
            "consommateurs futurs"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "engager-six-epr2-part-annuelle-de-l:fourteen:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -4000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat. Impact budgétaire retenu par le jeu : -4000 millions d'euros."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:fourteen:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 8,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:fourteen:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:fourteen:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": -4,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:fourteen:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:fourteen:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 6,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:fourteen:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat."
            }
          ],
          "scheduledEvents": [
            {
              "id": "epr-supply-chain",
              "title": "La chaîne industrielle sature",
              "body": "Les carnets de commandes dépassent les capacités disponibles et le calendrier glisse.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "epr-supply-chain:indicator:financialCredibility",
                  "target": "indicator",
                  "key": "financialCredibility",
                  "delta": -4,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les carnets de commandes dépassent les capacités disponibles et le calendrier glisse."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "sortie-du-nucleaire-en-2040"
          ],
          "unlocks": []
        },
        {
          "id": "engager-six-epr2-part-annuelle-de-l:none",
          "label": "Ne lancer aucun nouveau réacteur",
          "summary": "La France mise sur le parc existant, les renouvelables, les flexibilités et de futurs choix technologiques.",
          "mechanism": "Ne prendre aucun engagement de construction tout en exploitant le parc existant sous contrôle de sûreté.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Contrôle de sûreté et programmation du parc existant"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques à court terme"
          ],
          "contributors": [
            "filière nucléaire",
            "sécurité d'approvisionnement à long terme"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "engager-six-epr2-part-annuelle-de-l:none:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne prendre aucun engagement de construction tout en exploitant le parc existant sous contrôle de sûreté."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:none:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne prendre aucun engagement de construction tout en exploitant le parc existant sous contrôle de sûreté."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:none:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne prendre aucun engagement de construction tout en exploitant le parc existant sous contrôle de sûreté."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:none:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne prendre aucun engagement de construction tout en exploitant le parc existant sous contrôle de sûreté."
            },
            {
              "id": "engager-six-epr2-part-annuelle-de-l:none:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Ne prendre aucun engagement de construction tout en exploitant le parc existant sous contrôle de sûreté."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Trajectoires de production, calendrier industriel et besoins du système électrique.",
          "sourceName": "RTE",
          "sourceUrl": "https://assets.rte-france.com/prod/public/2026-04/RTE-Reactualisation-FE-2050-consultation-publique-2026-propositions-detaillees.pdf",
          "publishedAt": "2026-04-30",
          "note": "Les montants annuels sont des hypothèses de montée en charge du jeu, distinctes du coût complet des programmes."
        },
        {
          "label": "Trajectoires de production, calendrier industriel et besoins du système électrique.",
          "sourceName": "RTE",
          "sourceUrl": "https://www.rte-france.com/donnees-publications/etudes-prospectives/futurs-energetique-2050",
          "publishedAt": "2021-10-25",
          "note": "Les montants annuels sont des hypothèses de montée en charge du jeu, distinctes du coût complet des programmes."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "sortie-du-nucleaire-en-2040"
      ]
    },
    {
      "id": "retablir-une-trajectoire-carbone-recettes-redistribuees",
      "version": 3,
      "kind": "transformation",
      "chapterId": "energy-climate-transport-agriculture",
      "title": "Faut-il rétablir une trajectoire de taxe carbone ?",
      "context": "Le prix des énergies fossiles augmente. Le jeu crédite 4 milliards d'euros de recette brute avant tout remboursement, qui devrait être décidé et modélisé séparément.",
      "options": [
        {
          "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt",
          "label": "Rétablir la trajectoire carbone",
          "summary": "Les énergies fossiles coûtent plus cher et le budget reçoit une recette brute avant toute redistribution séparément décidée.",
          "mechanism": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Loi de finances",
            "Assiette carbone et barème de remboursement",
            "Égalité et articulation européenne"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "ménages sobres",
            "transition climatique"
          ],
          "contributors": [
            "ménages dépendants des fossiles"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 4000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution. Impact budgétaire retenu par le jeu : 4000 millions d'euros."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution."
            }
          ],
          "scheduledEvents": [
            {
              "id": "carbon-rural-revolt",
              "title": "La facture précède le remboursement",
              "body": "Les ménages dépendants de la voiture voient la hausse avant le versement et la contestation s'étend.",
              "afterDecisions": 1,
              "effects": [
                {
                  "id": "carbon-rural-revolt:indicator:opinion",
                  "target": "indicator",
                  "key": "opinion",
                  "delta": -6,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les ménages dépendants de la voiture voient la hausse avant le versement et la contestation s'étend."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:keep",
          "label": "Ne pas relever la taxe",
          "summary": "Le prix fiscal des carburants reste stable et l'incitation supplémentaire disparaît.",
          "mechanism": "Geler la composante carbone supplémentaire et ne créer aucun nouveau remboursement.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Règles fiscales carbone existantes"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "automobilistes",
            "ménages chauffés aux énergies fossiles",
            "entreprises",
            "collectivités"
          ],
          "contributors": [
            "finances publiques",
            "transition climatique"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Geler la composante carbone supplémentaire et ne créer aucun nouveau remboursement."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Geler la composante carbone supplémentaire et ne créer aucun nouveau remboursement."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Geler la composante carbone supplémentaire et ne créer aucun nouveau remboursement."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Geler la composante carbone supplémentaire et ne créer aucun nouveau remboursement."
            },
            {
              "id": "retablir-une-trajectoire-carbone-recettes-redistribuees:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Geler la composante carbone supplémentaire et ne créer aucun nouveau remboursement."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Trajectoire abandonnée en 2018 ; la redistribution en rend une partie.",
          "sourceName": "Conseil des prélèvements obligatoires",
          "sourceUrl": "https://www.ccomptes.fr/fr/publications/la-fiscalite-environnementale-au-defi-de-lurgence-climatique",
          "publishedAt": "2019-09-18",
          "note": "Les 4 000 millions d'euros sont une recette brute hypothétique du jeu. Une redistribution intégrale ramènerait le solde net près de zéro hors administration et comportements."
        },
        {
          "label": "Trajectoire abandonnée en 2018 ; la redistribution en rend une partie.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "Les 4 000 millions d'euros sont une recette brute hypothétique du jeu. Une redistribution intégrale ramènerait le solde net près de zéro hors administration et comportements."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "sortie-du-nucleaire-en-2040",
      "version": 3,
      "kind": "rupture",
      "chapterId": "energy-climate-transport-agriculture",
      "title": "Faut-il fermer tous les réacteurs nucléaires d'ici 2040 ?",
      "context": "La production nucléaire est remplacée en quinze ans par renouvelables, stockage, réseaux, sobriété ou centrales d'appoint. Le calendrier concentre le risque de capacité.",
      "options": [
        {
          "id": "sortie-du-nucleaire-en-2040:adopt",
          "label": "Sortir du nucléaire en 2040",
          "summary": "Les réacteurs ferment selon un calendrier contraint et les alternatives doivent être construites avant chaque arrêt.",
          "mechanism": "Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement.",
          "horizon": {
            "kind": "after_decisions",
            "count": 4
          },
          "legalConstraints": [
            "Loi de finances",
            "Programmation du parc nucléaire",
            "Autorisations et développement des capacités de remplacement"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "filières renouvelables",
            "opposants au nucléaire"
          ],
          "contributors": [
            "finances publiques",
            "filière nucléaire",
            "réseau électrique"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "sortie-du-nucleaire-en-2040:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -12000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement. Impact budgétaire retenu par le jeu : -12000 millions d'euros."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 8,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:adopt:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": -7,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -4,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -6,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 4
              },
              "duration": "once",
              "explanation": "Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement."
            }
          ],
          "scheduledEvents": [
            {
              "id": "winter-capacity-gap",
              "title": "Un hiver met les capacités sous tension",
              "body": "Le retard des réseaux et du stockage réduit la marge disponible pendant un hiver de forte demande.",
              "afterDecisions": 4,
              "effects": [
                {
                  "id": "winter-capacity-gap:indicator:publicServices",
                  "target": "indicator",
                  "key": "publicServices",
                  "delta": -8,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Le retard des réseaux et du stockage réduit la marge disponible pendant un hiver de forte demande."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "engager-six-epr2-part-annuelle-de-l",
            "moratoire-sur-les-renouvelables"
          ],
          "unlocks": []
        },
        {
          "id": "sortie-du-nucleaire-en-2040:keep",
          "label": "Conserver une part nucléaire",
          "summary": "Le parc est prolongé ou renouvelé selon les contrôles de sûreté et les besoins du réseau.",
          "mechanism": "Prolonger ou renouveler les capacités uniquement après les contrôles de sûreté et selon les besoins du réseau.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Contrôle de sûreté et programmation du parc"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "filière nucléaire",
            "production pilotable"
          ],
          "contributors": [
            "gestion des déchets",
            "investissements de sûreté"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "sortie-du-nucleaire-en-2040:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prolonger ou renouveler les capacités uniquement après les contrôles de sûreté et selon les besoins du réseau."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prolonger ou renouveler les capacités uniquement après les contrôles de sûreté et selon les besoins du réseau."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prolonger ou renouveler les capacités uniquement après les contrôles de sûreté et selon les besoins du réseau."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prolonger ou renouveler les capacités uniquement après les contrôles de sûreté et selon les besoins du réseau."
            },
            {
              "id": "sortie-du-nucleaire-en-2040:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Prolonger ou renouveler les capacités uniquement après les contrôles de sûreté et selon les besoins du réseau."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Scénarios de mix électrique, besoins de réseau et sécurité d'approvisionnement.",
          "sourceName": "RTE",
          "sourceUrl": "https://www.rte-france.com/donnees-publications/etudes-prospectives/futurs-energetique-2050",
          "publishedAt": "2021-10-25",
          "note": "Scénarios comparés du système électrique français jusqu'en 2050."
        },
        {
          "label": "Scénarios de mix électrique, besoins de réseau et sécurité d'approvisionnement.",
          "sourceName": "RTE",
          "sourceUrl": "https://assets.rte-france.com/prod/public/2026-04/RTE-Reactualisation-FE-2050-consultation-publique-2026-propositions-detaillees.pdf",
          "publishedAt": "2026-04-30",
          "note": "Réactualisation des hypothèses de demande, de production et de nouveaux réacteurs."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "engager-six-epr2-part-annuelle-de-l",
        "moratoire-sur-les-renouvelables"
      ]
    },
    {
      "id": "moratoire-sur-les-renouvelables",
      "version": 3,
      "kind": "rupture",
      "chapterId": "energy-climate-transport-agriculture",
      "title": "Faut-il suspendre tout nouveau parc éolien et solaire ?",
      "context": "Le moratoire stoppe les nouveaux projets pour protéger paysages et terres. La demande future doit alors être couverte par nucléaire, fossiles, importations ou sobriété.",
      "options": [
        {
          "id": "moratoire-sur-les-renouvelables:adopt",
          "label": "Suspendre les nouveaux projets",
          "summary": "Les paysages sont gelés et la trajectoire électrique perd ses nouvelles capacités renouvelables.",
          "mechanism": "Réviser régulièrement la PPE et arrêter prospectivement les nouveaux appels d'offres, sans annuler indistinctement permis, droits ou contrats acquis.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Réviser la programmation pluriannuelle de l'énergie selon le Code de l'énergie",
            "Respecter les objectifs européens renouvelables et les procédures accélérées de permis prévues par RED III",
            "Instruire les autorisations selon les procédures et délais applicables",
            "Honorer ou retirer sur une base légale les autorisations définitives, lauréats et contrats de soutien, avec procédure et indemnisation éventuelle"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "riverains opposés aux projets"
          ],
          "contributors": [
            "filières renouvelables",
            "sécurité d'approvisionnement"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "moratoire-sur-les-renouvelables:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1200,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Réviser régulièrement la PPE et arrêter prospectivement les nouveaux appels d'offres, sans annuler indistinctement permis, droits ou contrats acquis. Impact budgétaire retenu par le jeu : 1200 millions d'euros."
            },
            {
              "id": "moratoire-sur-les-renouvelables:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -8,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Réviser régulièrement la PPE et arrêter prospectivement les nouveaux appels d'offres, sans annuler indistinctement permis, droits ou contrats acquis."
            },
            {
              "id": "moratoire-sur-les-renouvelables:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -5,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Réviser régulièrement la PPE et arrêter prospectivement les nouveaux appels d'offres, sans annuler indistinctement permis, droits ou contrats acquis."
            },
            {
              "id": "moratoire-sur-les-renouvelables:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Réviser régulièrement la PPE et arrêter prospectivement les nouveaux appels d'offres, sans annuler indistinctement permis, droits ou contrats acquis."
            },
            {
              "id": "moratoire-sur-les-renouvelables:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -5,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Réviser régulièrement la PPE et arrêter prospectivement les nouveaux appels d'offres, sans annuler indistinctement permis, droits ou contrats acquis."
            },
            {
              "id": "moratoire-sur-les-renouvelables:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Réviser régulièrement la PPE et arrêter prospectivement les nouveaux appels d'offres, sans annuler indistinctement permis, droits ou contrats acquis."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "sortie-du-nucleaire-en-2040"
          ],
          "unlocks": []
        },
        {
          "id": "moratoire-sur-les-renouvelables:keep",
          "label": "Poursuivre les appels d'offres",
          "summary": "Les projets continuent sous autorisations locales et environnementales.",
          "mechanism": "Continuer les appels d'offres et autorisations locales et environnementales.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Règles d'autorisation des renouvelables"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "filières renouvelables",
            "collectivités accueillantes"
          ],
          "contributors": [
            "riverains",
            "paysages"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "moratoire-sur-les-renouvelables:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Continuer les appels d'offres et autorisations locales et environnementales."
            },
            {
              "id": "moratoire-sur-les-renouvelables:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Continuer les appels d'offres et autorisations locales et environnementales."
            },
            {
              "id": "moratoire-sur-les-renouvelables:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Continuer les appels d'offres et autorisations locales et environnementales."
            },
            {
              "id": "moratoire-sur-les-renouvelables:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Continuer les appels d'offres et autorisations locales et environnementales."
            },
            {
              "id": "moratoire-sur-les-renouvelables:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Continuer les appels d'offres et autorisations locales et environnementales."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Besoins de nouvelles capacités électriques selon les scénarios.",
          "sourceName": "Ministère de la Transition écologique",
          "sourceUrl": "https://www.ecologie.gouv.fr/politiques-publiques/programmations-pluriannuelles-lenergie-ppe",
          "publishedAt": "2026-02-13",
          "note": "Les 1 200 millions d'euros par an représentent dans le jeu de nouveaux soutiens évités; un moratoire prospectif ne supprime ni les contrats existants ni leur charge."
        },
        {
          "label": "Besoins de nouvelles capacités électriques selon les scénarios.",
          "sourceName": "RTE",
          "sourceUrl": "https://www.rte-france.com/donnees-publications/etudes-prospectives/futurs-energetique-2050",
          "publishedAt": "2021-10-25",
          "note": "Les 1 200 millions d'euros par an représentent dans le jeu de nouveaux soutiens évités; un moratoire prospectif ne supprime ni les contrats existants ni leur charge."
        },
        {
          "label": "Besoins de nouvelles capacités électriques selon les scénarios.",
          "sourceName": "RTE",
          "sourceUrl": "https://assets.rte-france.com/prod/public/2026-04/RTE-Reactualisation-FE-2050-consultation-publique-2026-propositions-detaillees.pdf",
          "publishedAt": "2026-04-30",
          "note": "Les 1 200 millions d'euros par an représentent dans le jeu de nouveaux soutiens évités; un moratoire prospectif ne supprime ni les contrats existants ni leur charge."
        },
        {
          "label": "Besoins de nouvelles capacités électriques selon les scénarios.",
          "sourceName": "Institut Thomas More",
          "sourceUrl": "https://institut-thomas-more.org/2026/06/25/rapport36/",
          "publishedAt": "2026-06-25",
          "note": "Les 1 200 millions d'euros par an représentent dans le jeu de nouveaux soutiens évités; un moratoire prospectif ne supprime ni les contrats existants ni leur charge."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "sortie-du-nucleaire-en-2040"
      ]
    },
    {
      "id": "interdire-les-voitures-thermiques-en-2030",
      "version": 3,
      "kind": "rupture",
      "chapterId": "energy-climate-transport-agriculture",
      "title": "Faut-il interdire la vente de voitures thermiques dès 2030 ?",
      "context": "L'échéance avance de cinq ans la bascule des ventes neuves. Bornes, production électrique, offre abordable et industrie automobile doivent suivre au même rythme.",
      "options": [
        {
          "id": "interdire-les-voitures-thermiques-en-2030:adopt",
          "label": "Interdire les ventes en 2030",
          "summary": "Les constructeurs basculent plus vite vers l'électrique et les acheteurs perdent l'option thermique neuve.",
          "mechanism": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Loi de finances",
            "Le règlement (UE) 2023/851 fixe pour 2035 un objectif de réduction de 100 % des émissions moyennes des voitures neuves, pas une interdiction nationale simple",
            "Respecter les règles européennes de réception des véhicules, la libre circulation, la notification et la proportionnalité"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "filière électrique",
            "qualité de l'air"
          ],
          "contributors": [
            "automobilistes contraints",
            "industrie thermique"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "interdire-les-voitures-thermiques-en-2030:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -4000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées. Impact budgétaire retenu par le jeu : -4000 millions d'euros."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 6,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": -7,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -4,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": -4,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "interdire-les-voitures-thermiques-en-2030:keep",
          "label": "Conserver l'échéance européenne",
          "summary": "La transition reste fixée à 2035 et laisse cinq années supplémentaires d'adaptation.",
          "mechanism": "Maintenir l'adaptation industrielle sur l'horizon européen 2035.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Cadre européen des émissions des véhicules"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "automobilistes",
            "industrie thermique"
          ],
          "contributors": [
            "vitesse de décarbonation"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "interdire-les-voitures-thermiques-en-2030:keep:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'adaptation industrielle sur l'horizon européen 2035."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'adaptation industrielle sur l'horizon européen 2035."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'adaptation industrielle sur l'horizon européen 2035."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'adaptation industrielle sur l'horizon européen 2035."
            },
            {
              "id": "interdire-les-voitures-thermiques-en-2030:keep:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir l'adaptation industrielle sur l'horizon européen 2035."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Électrification des transports et demande d'électricité associée.",
          "sourceName": "Union européenne",
          "sourceUrl": "https://eur-lex.europa.eu/eli/reg/2023/851/oj/fra",
          "publishedAt": "2023-04-19",
          "note": "Le règlement européen fixe une cible de 100 % de réduction moyenne en 2035, pas une interdiction nationale simple en 2030. Les 4 milliards d'euros sont un accompagnement hypothétique du jeu."
        },
        {
          "label": "Électrification des transports et demande d'électricité associée.",
          "sourceName": "RTE",
          "sourceUrl": "https://www.rte-france.com/donnees-publications/etudes-prospectives/futurs-energetique-2050",
          "publishedAt": "2021-10-25",
          "note": "Le règlement européen fixe une cible de 100 % de réduction moyenne en 2035, pas une interdiction nationale simple en 2030. Les 4 milliards d'euros sont un accompagnement hypothétique du jeu."
        },
        {
          "label": "Électrification des transports et demande d'électricité associée.",
          "sourceName": "RTE",
          "sourceUrl": "https://assets.rte-france.com/prod/public/2026-04/RTE-Reactualisation-FE-2050-consultation-publique-2026-propositions-detaillees.pdf",
          "publishedAt": "2026-04-30",
          "note": "Le règlement européen fixe une cible de 100 % de réduction moyenne en 2035, pas une interdiction nationale simple en 2030. Les 4 milliards d'euros sont un accompagnement hypothétique du jeu."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "revaloriser-les-enseignants-de-5",
      "version": 3,
      "kind": "gestion",
      "chapterId": "education-housing-family",
      "title": "Faut-il augmenter tous les enseignants de 5 % ?",
      "context": "La hausse améliore immédiatement les rémunérations. Son effet sur l'attractivité dépend aussi des débuts de carrière, des conditions de travail et des affectations.",
      "options": [
        {
          "id": "revaloriser-les-enseignants-de-5:adopt",
          "label": "Augmenter de 5 %",
          "summary": "Tous les enseignants gagnent davantage et l'État finance la hausse chaque année.",
          "mechanism": "Relever de 5 % la rémunération de tous les enseignants; l'effet de fidélisation apparaît après les premières affectations.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Décrets indiciaires ou indemnitaires",
            "Crédits annuels en loi de finances",
            "Dialogue social",
            "Régime du privé sous contrat"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "enseignants"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "revaloriser-les-enseignants-de-5:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -3000,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Relever de 5 % la rémunération de tous les enseignants; l'effet de fidélisation apparaît après les premières affectations. Impact budgétaire retenu par le jeu : -3000 millions d'euros."
            },
            {
              "id": "revaloriser-les-enseignants-de-5:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Relever de 5 % la rémunération de tous les enseignants; l'effet de fidélisation apparaît après les premières affectations."
            },
            {
              "id": "revaloriser-les-enseignants-de-5:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Relever de 5 % la rémunération de tous les enseignants; l'effet de fidélisation apparaît après les premières affectations."
            },
            {
              "id": "revaloriser-les-enseignants-de-5:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 7,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Relever de 5 % la rémunération de tous les enseignants; l'effet de fidélisation apparaît après les premières affectations."
            },
            {
              "id": "revaloriser-les-enseignants-de-5:adopt:group:unions",
              "target": "group",
              "key": "unions",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Relever de 5 % la rémunération de tous les enseignants; l'effet de fidélisation apparaît après les premières affectations."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "revaloriser-les-enseignants-de-5:keep",
          "label": "Conserver la grille actuelle",
          "summary": "La masse salariale n'augmente pas et le décrochage d'attractivité reste à traiter autrement.",
          "mechanism": "Maintenir la grille; les difficultés de recrutement et d'affectation restent sans réponse salariale générale.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "enseignants",
            "élèves",
            "établissements scolaires"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "revaloriser-les-enseignants-de-5:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir la grille; les difficultés de recrutement et d'affectation restent sans réponse salariale générale."
            },
            {
              "id": "revaloriser-les-enseignants-de-5:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir la grille; les difficultés de recrutement et d'affectation restent sans réponse salariale générale."
            },
            {
              "id": "revaloriser-les-enseignants-de-5:keep:group:unions",
              "target": "group",
              "key": "unions",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir la grille; les difficultés de recrutement et d'affectation restent sans réponse salariale générale."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "5 % de la masse salariale de l'enseignement scolaire (88 817 M€ votés).",
          "sourceName": "Direction des affaires financières de l'Éducation nationale",
          "sourceUrl": "https://www.education.gouv.fr/sites/default/files/document/la-direction-des-affaires-financi-res-du-minist-re-charg-de-l-education-nationale-pr-sentation-476861.pdf",
          "publishedAt": "2025-12-01",
          "note": "Le jeu retient 3 000 millions d'euros par an, soit environ 5 % d'une assiette arrondie à 60 milliards. La DAF indique 58 milliards hors CAS Pensions en LFI 2025; les 88 817 millions couvrent un périmètre plus large et ne servent pas de multiplicande."
        },
        {
          "label": "5 % de la masse salariale de l'enseignement scolaire (88 817 M€ votés).",
          "sourceName": "DEPP",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-etat-de-l-ecole-2025-467767",
          "publishedAt": "2025-11-01",
          "note": "Le jeu retient 3 000 millions d'euros par an, soit environ 5 % d'une assiette arrondie à 60 milliards. La DAF indique 58 milliards hors CAS Pensions en LFI 2025; les 88 817 millions couvrent un périmètre plus large et ne servent pas de multiplicande."
        },
        {
          "label": "5 % de la masse salariale de l'enseignement scolaire (88 817 M€ votés).",
          "sourceName": "Ministère de l'Éducation nationale",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-education-nationale-en-chiffres-edition-2025-452838",
          "publishedAt": "2025-09-01",
          "note": "Le jeu retient 3 000 millions d'euros par an, soit environ 5 % d'une assiette arrondie à 60 milliards. La DAF indique 58 milliards hors CAS Pensions en LFI 2025; les 88 817 millions couvrent un périmètre plus large et ne servent pas de multiplicande."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "doubler-les-bourses-etudiantes-sur-criteres",
      "version": 3,
      "kind": "gestion",
      "chapterId": "education-housing-family",
      "title": "Faut-il doubler les bourses étudiantes sur critères sociaux ?",
      "context": "La hausse réduit le besoin de travailler pendant les études pour les boursiers. Elle crée un coût récurrent et des écarts plus nets autour des seuils.",
      "options": [
        {
          "id": "doubler-les-bourses-etudiantes-sur-criteres:adopt",
          "label": "Doubler les bourses",
          "summary": "Les étudiants modestes reçoivent davantage et le budget de l'État augmente fortement.",
          "mechanism": "Doubler chaque échelon du barème social sans modifier les seuils d'entrée.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Modifier le barème réglementaire",
            "Ouvrir les crédits",
            "Traiter effets de seuil et égalité"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "étudiants boursiers"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-les-bourses-etudiantes-sur-criteres:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -2400,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Doubler chaque échelon du barème social sans modifier les seuils d'entrée. Impact budgétaire retenu par le jeu : -2400 millions d'euros."
            },
            {
              "id": "doubler-les-bourses-etudiantes-sur-criteres:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Doubler chaque échelon du barème social sans modifier les seuils d'entrée."
            },
            {
              "id": "doubler-les-bourses-etudiantes-sur-criteres:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 8,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Doubler chaque échelon du barème social sans modifier les seuils d'entrée."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "doubler-les-bourses-etudiantes-sur-criteres:keep",
          "label": "Conserver le barème",
          "summary": "La dépense reste stable et les boursiers gardent le niveau d'aide actuel.",
          "mechanism": "Maintenir les montants et seuils; la contrainte financière de poursuite des études persiste.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "étudiants boursiers"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "doubler-les-bourses-etudiantes-sur-criteres:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir les montants et seuils; la contrainte financière de poursuite des études persiste."
            },
            {
              "id": "doubler-les-bourses-etudiantes-sur-criteres:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -4,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir les montants et seuils; la contrainte financière de poursuite des études persiste."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Budget voté des bourses, doublé.",
          "sourceName": "Ministère de l'Éducation nationale",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-education-nationale-en-chiffres-edition-2025-452838",
          "publishedAt": "2025-09-01",
          "note": "Effectifs, personnels et budgets de l'Éducation nationale."
        },
        {
          "label": "Budget voté des bourses, doublé.",
          "sourceName": "Insee",
          "sourceUrl": "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
          "publishedAt": "2025-11-20",
          "note": "Revenus, emploi et inégalités dans France, portrait social."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "financer-100-000-logements-sociaux-de-plus",
      "version": 3,
      "kind": "transformation",
      "chapterId": "education-housing-family",
      "title": "Faut-il financer 100 000 logements sociaux supplémentaires par an ?",
      "context": "L'aide accélère la construction si foncier, permis et entreprises suivent. Les crédits sont immédiats, les logements arrivent plusieurs années plus tard.",
      "options": [
        {
          "id": "financer-100-000-logements-sociaux-de-plus:adopt",
          "label": "Financer 100 000 logements",
          "summary": "Les bailleurs lancent davantage de programmes et l'État augmente ses aides à la pierre.",
          "mechanism": "Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers.",
          "horizon": {
            "kind": "mandate_year",
            "year": 5
          },
          "legalConstraints": [
            "Voter crédits et avantages en loi de finances",
            "Urbanisme, permis et foncier",
            "Financement du logement social et commande publique"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "demandeurs de logement social",
            "bâtiment",
            "collectivités"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "financer-100-000-logements-sociaux-de-plus:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -1500,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers. Impact budgétaire retenu par le jeu : -1500 millions d'euros."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 7,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:adopt:indicator:employment",
              "target": "indicator",
              "key": "employment",
              "delta": 2,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 4,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 4,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers."
            }
          ],
          "scheduledEvents": [
            {
              "id": "social-housing-delivery-gap",
              "title": "Les agréments ne deviennent pas tous des logements",
              "body": "Le foncier, les permis et les capacités de chantier retardent une partie des livraisons attendues.",
              "afterDecisions": 4,
              "effects": [
                {
                  "id": "social-housing-delivery-gap:indicator:investment",
                  "target": "indicator",
                  "key": "investment",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Le foncier, les permis et les capacités de chantier retardent une partie des livraisons attendues."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "financer-100-000-logements-sociaux-de-plus:keep",
          "label": "Conserver la programmation",
          "summary": "La dépense n'augmente pas et la production reste au rythme actuel.",
          "mechanism": "Maintenir les agréments actuels et éviter la charge locale supplémentaire tout en laissant la production sous la cible.",
          "horizon": {
            "kind": "mandate_year",
            "year": 5
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques",
            "collectivités"
          ],
          "contributors": [
            "demandeurs de logement social",
            "entreprises du bâtiment"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "financer-100-000-logements-sociaux-de-plus:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Maintenir les agréments actuels et éviter la charge locale supplémentaire tout en laissant la production sous la cible."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Maintenir les agréments actuels et éviter la charge locale supplémentaire tout en laissant la production sous la cible."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Maintenir les agréments actuels et éviter la charge locale supplémentaire tout en laissant la production sous la cible."
            },
            {
              "id": "financer-100-000-logements-sociaux-de-plus:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 1,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Maintenir les agréments actuels et éviter la charge locale supplémentaire tout en laissant la production sous la cible."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Aides à la pierre et TVA réduite, coûts constatés par logement.",
          "sourceName": "Direction du Budget",
          "sourceUrl": "https://www.budget.gouv.fr/documentation/file-download/30586",
          "publishedAt": "2025-10-14",
          "note": "Dépenses fiscales recensées dans les voies et moyens du projet de loi de finances pour 2026."
        },
        {
          "label": "Aides à la pierre et TVA réduite, coûts constatés par logement.",
          "sourceName": "Observatoire des finances et de la gestion publique locales",
          "sourceUrl": "https://www.collectivites-locales.gouv.fr/etudes-et-statistiques/rapports-de-lobservatoire-des-finances-et-de-la-gestion-publique-locales-ofgl",
          "publishedAt": "2026-07-15",
          "note": "Finances, investissements et effectifs des collectivités locales."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "revaloriser-les-apl-de-5",
      "version": 3,
      "kind": "transformation",
      "chapterId": "education-housing-family",
      "title": "Faut-il augmenter les aides au logement de 5 % ?",
      "context": "L'aide augmente le revenu disponible des locataires éligibles. Dans les zones tendues, une partie peut être absorbée par les loyers si l'offre ne suit pas.",
      "options": [
        {
          "id": "revaloriser-les-apl-de-5:adopt",
          "label": "Revaloriser les APL",
          "summary": "Les allocataires reçoivent davantage et l'État augmente sa dépense annuelle.",
          "mechanism": "Augmenter de 5 % le barème versé aux bénéficiaires existants avant toute réaction des loyers.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [
            "Modifier le barème réglementaire",
            "Ouvrir les crédits nécessaires"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "locataires allocataires"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "revaloriser-les-apl-de-5:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -700,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Augmenter de 5 % le barème versé aux bénéficiaires existants avant toute réaction des loyers. Impact budgétaire retenu par le jeu : -700 millions d'euros."
            },
            {
              "id": "revaloriser-les-apl-de-5:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Augmenter de 5 % le barème versé aux bénéficiaires existants avant toute réaction des loyers."
            },
            {
              "id": "revaloriser-les-apl-de-5:adopt:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": 6,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Augmenter de 5 % le barème versé aux bénéficiaires existants avant toute réaction des loyers."
            },
            {
              "id": "revaloriser-les-apl-de-5:adopt:group:middleClasses",
              "target": "group",
              "key": "middleClasses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Augmenter de 5 % le barème versé aux bénéficiaires existants avant toute réaction des loyers."
            }
          ],
          "scheduledEvents": [
            {
              "id": "housing-rent-capture",
              "title": "Une partie de la hausse est absorbée par les loyers",
              "body": "Dans les zones tendues, la faible offre permet à certains nouveaux loyers d'absorber une partie du gain versé.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "housing-rent-capture:group:lowIncomeHouseholds",
                  "target": "group",
                  "key": "lowIncomeHouseholds",
                  "delta": -2,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Dans les zones tendues, la faible offre permet à certains nouveaux loyers d'absorber une partie du gain versé."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "revaloriser-les-apl-de-5:keep",
          "label": "Conserver le barème",
          "summary": "La dépense reste stable et les aides ne rattrapent pas davantage les loyers.",
          "mechanism": "Maintenir le barème; l'aide perd du terrain pour les ménages dont le loyer progresse.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "locataires allocataires"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "revaloriser-les-apl-de-5:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -1,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir le barème; l'aide perd du terrain pour les ménages dont le loyer progresse."
            },
            {
              "id": "revaloriser-les-apl-de-5:keep:group:lowIncomeHouseholds",
              "target": "group",
              "key": "lowIncomeHouseholds",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir le barème; l'aide perd du terrain pour les ménages dont le loyer progresse."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "5 % des aides personnalisées au logement versées.",
          "sourceName": "DREES",
          "sourceUrl": "https://www.drees.solidarites-sante.gouv.fr/publications-communique-de-presse/panoramas-de-la-drees/251204-minima-sociaux-et-prestations-de-solidarite",
          "publishedAt": "2025-12-04",
          "note": "Bénéficiaires, montants et non-recours aux minima sociaux."
        },
        {
          "label": "5 % des aides personnalisées au logement versées.",
          "sourceName": "Insee",
          "sourceUrl": "https://www.insee.fr/fr/statistiques/8612544?sommaire=8612596",
          "publishedAt": "2025-11-20",
          "note": "Revenus, emploi et inégalités dans France, portrait social."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "cheque-education-par-eleve",
      "version": 3,
      "kind": "rupture",
      "chapterId": "education-housing-family",
      "title": "Faut-il financer chaque élève par un chèque éducation ?",
      "context": "La dotation suit l'élève vers l'établissement public ou privé choisi. La concurrence augmente, mais la ségrégation et la survie des écoles peu demandées deviennent des choix explicites.",
      "options": [
        {
          "id": "cheque-education-par-eleve:adopt",
          "label": "Créer le chèque éducation",
          "summary": "Le financement suit le choix des familles et les établissements perdant des élèves perdent aussi des moyens.",
          "mechanism": "Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Modifier le Code de l'éducation et le financement",
            "Égalité, laïcité et liberté d'enseignement",
            "Obligations scolaires et immobilières locales",
            "Conditions d'aide au privé"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "after_decisions",
            "count": 3
          },
          "beneficiaries": [
            "familles mobiles",
            "établissements attractifs"
          ],
          "contributors": [
            "établissements évités",
            "mixité scolaire"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "cheque-education-par-eleve:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": -1000,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "annual",
              "explanation": "Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi. Impact budgétaire retenu par le jeu : -1000 millions d'euros."
            },
            {
              "id": "cheque-education-par-eleve:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi."
            },
            {
              "id": "cheque-education-par-eleve:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi."
            },
            {
              "id": "cheque-education-par-eleve:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi."
            },
            {
              "id": "cheque-education-par-eleve:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi."
            },
            {
              "id": "cheque-education-par-eleve:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -4,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi."
            }
          ],
          "scheduledEvents": [
            {
              "id": "school-closures",
              "title": "Le maillage scolaire se rétracte",
              "body": "Des établissements perdent assez d'élèves et de dotations pour menacer la continuité scolaire dans des territoires fragiles.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "school-closures:indicator:publicServices",
                  "target": "indicator",
                  "key": "publicServices",
                  "delta": -5,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Des établissements perdent assez d'élèves et de dotations pour menacer la continuité scolaire dans des territoires fragiles."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "supprimer-le-financement-public-du-prive"
          ],
          "unlocks": []
        },
        {
          "id": "cheque-education-par-eleve:keep",
          "label": "Conserver le financement des établissements",
          "summary": "Les moyens restent attribués par réseau, territoire et caractéristiques des élèves.",
          "mechanism": "Conserver une allocation par réseau, territoire et besoins des élèves, indépendante des seuls flux d'inscription.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "maillage scolaire",
            "établissements fragiles"
          ],
          "contributors": [
            "liberté de financement des familles"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "cheque-education-par-eleve:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver une allocation par réseau, territoire et besoins des élèves, indépendante des seuls flux d'inscription."
            },
            {
              "id": "cheque-education-par-eleve:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver une allocation par réseau, territoire et besoins des élèves, indépendante des seuls flux d'inscription."
            },
            {
              "id": "cheque-education-par-eleve:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver une allocation par réseau, territoire et besoins des élèves, indépendante des seuls flux d'inscription."
            },
            {
              "id": "cheque-education-par-eleve:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver une allocation par réseau, territoire et besoins des élèves, indépendante des seuls flux d'inscription."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Dépense par élève, résultats et écarts sociaux entre établissements.",
          "sourceName": "DEPP",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-etat-de-l-ecole-2025-467767",
          "publishedAt": "2025-11-01",
          "note": "Résultats, moyens et inégalités du système éducatif français."
        },
        {
          "label": "Dépense par élève, résultats et écarts sociaux entre établissements.",
          "sourceName": "Ministère de l'Éducation nationale",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-education-nationale-en-chiffres-edition-2025-452838",
          "publishedAt": "2025-09-01",
          "note": "Effectifs, personnels et budgets de l'Éducation nationale."
        },
        {
          "label": "Dépense par élève, résultats et écarts sociaux entre établissements.",
          "sourceName": "Institut Thomas More",
          "sourceUrl": "https://institut-thomas-more.org/2026/06/25/rapport36/",
          "publishedAt": "2026-06-25",
          "note": "Contrepoint éditorial libéral-conservateur. Cette source ne fonde jamais seule un chiffrage."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "supprimer-le-financement-public-du-prive"
      ]
    },
    {
      "id": "supprimer-le-financement-public-du-prive",
      "version": 3,
      "kind": "rupture",
      "chapterId": "education-housing-family",
      "title": "Faut-il supprimer le financement public de l'enseignement privé ?",
      "context": "L'État ne paie plus les enseignants des établissements sous contrat. Les familles, fermetures ou transferts d'élèves vers le public absorbent le changement.",
      "options": [
        {
          "id": "supprimer-le-financement-public-du-prive:adopt",
          "label": "Supprimer le financement",
          "summary": "Les établissements privés financent seuls leur fonctionnement et le public doit accueillir les élèves transférés.",
          "mechanism": "Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Modifier les dispositions L442 du Code de l'éducation",
            "Traiter contrats et droits des personnels",
            "Garantir liberté d'enseignement et continuité",
            "Financer locaux et accueil publics"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "after_decisions",
            "count": 2
          },
          "beneficiaries": [
            "finances publiques selon le transfert"
          ],
          "contributors": [
            "familles du privé",
            "établissements privés",
            "écoles publiques d'accueil"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "supprimer-le-financement-public-du-prive:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 3000,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "annual",
              "explanation": "Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil. Impact budgétaire retenu par le jeu : 3000 millions d'euros."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -4,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil."
            }
          ],
          "scheduledEvents": [
            {
              "id": "private-school-transfer-capacity",
              "title": "Les transferts saturent une partie du public",
              "body": "Les établissements publics d'accueil manquent temporairement de salles et de personnels dans plusieurs territoires.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "private-school-transfer-capacity:indicator:publicServices",
                  "target": "indicator",
                  "key": "publicServices",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les établissements publics d'accueil manquent temporairement de salles et de personnels dans plusieurs territoires."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [
            "cheque-education-par-eleve"
          ],
          "unlocks": []
        },
        {
          "id": "supprimer-le-financement-public-du-prive:keep",
          "label": "Maintenir les contrats",
          "summary": "L'État continue de payer les enseignants en échange des obligations du contrat.",
          "mechanism": "Maintenir rémunération publique et forfaits en contrepartie des obligations du contrat.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "familles du privé",
            "continuité scolaire"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "supprimer-le-financement-public-du-prive:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir rémunération publique et forfaits en contrepartie des obligations du contrat."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir rémunération publique et forfaits en contrepartie des obligations du contrat."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir rémunération publique et forfaits en contrepartie des obligations du contrat."
            },
            {
              "id": "supprimer-le-financement-public-du-prive:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir rémunération publique et forfaits en contrepartie des obligations du contrat."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Effectifs et financement des établissements publics et privés sous contrat.",
          "sourceName": "DEPP",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-etat-de-l-ecole-2025-467767",
          "publishedAt": "2025-11-01",
          "note": "Résultats, moyens et inégalités du système éducatif français."
        },
        {
          "label": "Effectifs et financement des établissements publics et privés sous contrat.",
          "sourceName": "Ministère de l'Éducation nationale",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-education-nationale-en-chiffres-edition-2025-452838",
          "publishedAt": "2025-09-01",
          "note": "Effectifs, personnels et budgets de l'Éducation nationale."
        }
      ],
      "dependencies": [],
      "conflicts": [
        "cheque-education-par-eleve"
      ]
    },
    {
      "id": "autonomie-complete-des-etablissements",
      "version": 3,
      "kind": "rupture",
      "chapterId": "education-housing-family",
      "title": "Faut-il donner aux établissements la maîtrise du recrutement et des rémunérations ?",
      "context": "Chefs d'établissement et conseils locaux recrutent et rémunèrent dans une enveloppe. L'adaptation locale augmente, tout comme les écarts entre établissements attractifs et difficiles.",
      "options": [
        {
          "id": "autonomie-complete-des-etablissements:adopt",
          "label": "Donner l'autonomie complète",
          "summary": "Chaque établissement compose son équipe et ses primes dans son budget.",
          "mechanism": "Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Modifier Code de l'éducation et statuts",
            "Fonction publique, égalité et non-discrimination",
            "Dialogue social et recours"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "after_decisions",
            "count": 3
          },
          "beneficiaries": [
            "établissements attractifs",
            "directions locales"
          ],
          "contributors": [
            "statut national",
            "établissements difficiles"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "autonomie-complete-des-etablissements:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 500,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "annual",
              "explanation": "Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée. Impact budgétaire retenu par le jeu : 500 millions d'euros."
            },
            {
              "id": "autonomie-complete-des-etablissements:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 7,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée."
            },
            {
              "id": "autonomie-complete-des-etablissements:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée."
            },
            {
              "id": "autonomie-complete-des-etablissements:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée."
            },
            {
              "id": "autonomie-complete-des-etablissements:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -8,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée."
            },
            {
              "id": "autonomie-complete-des-etablissements:adopt:group:unions",
              "target": "group",
              "key": "unions",
              "delta": -9,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée."
            }
          ],
          "scheduledEvents": [
            {
              "id": "teacher-market",
              "title": "Les écarts de recrutement se creusent",
              "body": "Les établissements difficiles doivent payer davantage sans toujours disposer de la même enveloppe.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "teacher-market:indicator:publicServices",
                  "target": "indicator",
                  "key": "publicServices",
                  "delta": -6,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les établissements difficiles doivent payer davantage sans toujours disposer de la même enveloppe."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "autonomie-complete-des-etablissements:keep",
          "label": "Conserver l'affectation nationale",
          "summary": "Les carrières et rémunérations restent nationales, avec des marges locales limitées.",
          "mechanism": "Maintenir corps, affectations et rémunérations nationaux avec des marges locales limitées.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "égalité statutaire",
            "enseignants"
          ],
          "contributors": [
            "autonomie locale"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "autonomie-complete-des-etablissements:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir corps, affectations et rémunérations nationaux avec des marges locales limitées."
            },
            {
              "id": "autonomie-complete-des-etablissements:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir corps, affectations et rémunérations nationaux avec des marges locales limitées."
            },
            {
              "id": "autonomie-complete-des-etablissements:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir corps, affectations et rémunérations nationaux avec des marges locales limitées."
            },
            {
              "id": "autonomie-complete-des-etablissements:keep:group:unions",
              "target": "group",
              "key": "unions",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir corps, affectations et rémunérations nationaux avec des marges locales limitées."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Affectation des enseignants, résultats et inégalités territoriales.",
          "sourceName": "DEPP",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-etat-de-l-ecole-2025-467767",
          "publishedAt": "2025-11-01",
          "note": "Résultats, moyens et inégalités du système éducatif français."
        },
        {
          "label": "Affectation des enseignants, résultats et inégalités territoriales.",
          "sourceName": "Ministère de l'Éducation nationale",
          "sourceUrl": "https://www.education.gouv.fr/depp/l-education-nationale-en-chiffres-edition-2025-452838",
          "publishedAt": "2025-09-01",
          "note": "Effectifs, personnels et budgets de l'Éducation nationale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "reduire-de-5-les-dotations-aux-collectivites",
      "version": 3,
      "kind": "transformation",
      "chapterId": "state-institutions-territories",
      "title": "Faut-il réduire de 5 % les dotations aux collectivités ?",
      "context": "L'État améliore son solde, mais communes, départements et régions doivent réduire les dépenses, les investissements ou augmenter leurs recettes.",
      "options": [
        {
          "id": "reduire-de-5-les-dotations-aux-collectivites:adopt",
          "label": "Réduire les dotations",
          "summary": "Le budget de l'État économise et les collectivités répercutent la coupe sur leurs choix locaux.",
          "mechanism": "Réduire les concours en loi de finances; les exécutifs locaux arbitrent ensuite entre investissement, service et recettes.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Voter la baisse en loi de finances",
            "Libre administration et autonomie financière",
            "Compensation des compétences transférées"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "after_decisions",
            "count": 3
          },
          "beneficiaries": [
            "budget de l'État"
          ],
          "contributors": [
            "collectivités",
            "usagers locaux"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 2200,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "annual",
              "explanation": "Réduire les concours en loi de finances; les exécutifs locaux arbitrent ensuite entre investissement, service et recettes. Impact budgétaire retenu par le jeu : 2200 millions d'euros."
            },
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:adopt:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Réduire les concours en loi de finances; les exécutifs locaux arbitrent ensuite entre investissement, service et recettes."
            },
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Réduire les concours en loi de finances; les exécutifs locaux arbitrent ensuite entre investissement, service et recettes."
            },
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -9,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Réduire les concours en loi de finances; les exécutifs locaux arbitrent ensuite entre investissement, service et recettes."
            },
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:adopt:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Réduire les concours en loi de finances; les exécutifs locaux arbitrent ensuite entre investissement, service et recettes."
            }
          ],
          "scheduledEvents": [
            {
              "id": "local-investment-cut",
              "title": "L'investissement local devient la variable d'ajustement",
              "body": "Une partie des collectivités concentre la baisse sur les chantiers et commandes locales plutôt que sur les services courants.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "local-investment-cut:indicator:investment",
                  "target": "indicator",
                  "key": "investment",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Une partie des collectivités concentre la baisse sur les chantiers et commandes locales plutôt que sur les services courants."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "reduire-de-5-les-dotations-aux-collectivites:keep",
          "label": "Maintenir les dotations",
          "summary": "Les budgets locaux sont préservés et l'État ne réalise pas l'économie.",
          "mechanism": "Maintenir les concours et les programmes locaux déjà financés.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "collectivités",
            "usagers locaux",
            "entreprises locales"
          ],
          "contributors": [
            "finances de l'État"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:keep:indicator:investment",
              "target": "indicator",
              "key": "investment",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les concours et les programmes locaux déjà financés."
            },
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les concours et les programmes locaux déjà financés."
            },
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 4,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les concours et les programmes locaux déjà financés."
            },
            {
              "id": "reduire-de-5-les-dotations-aux-collectivites:keep:group:businesses",
              "target": "group",
              "key": "businesses",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les concours et les programmes locaux déjà financés."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Concours financiers de l'État aux collectivités.",
          "sourceName": "Observatoire des finances et de la gestion publique locales",
          "sourceUrl": "https://www.collectivites-locales.gouv.fr/etudes-et-statistiques/rapports-de-lobservatoire-des-finances-et-de-la-gestion-publique-locales-ofgl",
          "publishedAt": "2026-07-15",
          "note": "Finances, investissements et effectifs des collectivités locales."
        },
        {
          "label": "Concours financiers de l'État aux collectivités.",
          "sourceName": "DGCL",
          "sourceUrl": "https://www.collectivites-locales.gouv.fr/les-collectivites-locales-en-chiffres-2025",
          "publishedAt": "2025-07-10",
          "note": "Organisation territoriale, personnels, budgets et fiscalité locale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "regle-d-or-constitutionnelle",
      "version": 3,
      "kind": "rupture",
      "chapterId": "state-institutions-territories",
      "title": "Faut-il inscrire l'équilibre budgétaire dans la Constitution ?",
      "context": "Une règle d'or limite le déficit hors circonstances exceptionnelles. Elle impose de décider à l'avance comment traiter récession, guerre et investissement.",
      "options": [
        {
          "id": "regle-d-or-constitutionnelle:adopt",
          "label": "Inscrire la règle d'or",
          "summary": "Gouvernement et Parlement doivent financer toute dépense nouvelle ou déclencher une clause d'exception.",
          "mechanism": "Adopter la révision puis appliquer, au premier budget contrôlé par la règle, une correction de scénario de 8 000 millions d'euros; ce montant n'est pas une économie constitutionnelle automatique.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Révision constitutionnelle",
            "Définir solde, méthode et exceptions",
            "Articuler les règles européennes",
            "Désigner le contrôle et les conséquences"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "after_decisions",
            "count": 3
          },
          "beneficiaries": [
            "créanciers",
            "générations futures"
          ],
          "contributors": [
            "marge budgétaire en crise",
            "majorités politiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "regle-d-or-constitutionnelle:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 8000,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "annual",
              "explanation": "Adopter la révision puis appliquer, au premier budget contrôlé par la règle, une correction de scénario de 8 000 millions d'euros; ce montant n'est pas une économie constitutionnelle automatique. Impact budgétaire retenu par le jeu : 8000 millions d'euros."
            },
            {
              "id": "regle-d-or-constitutionnelle:adopt:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": 8,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Adopter la révision puis appliquer, au premier budget contrôlé par la règle, une correction de scénario de 8 000 millions d'euros; ce montant n'est pas une économie constitutionnelle automatique."
            },
            {
              "id": "regle-d-or-constitutionnelle:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -6,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Adopter la révision puis appliquer, au premier budget contrôlé par la règle, une correction de scénario de 8 000 millions d'euros; ce montant n'est pas une économie constitutionnelle automatique."
            },
            {
              "id": "regle-d-or-constitutionnelle:adopt:group:creditors",
              "target": "group",
              "key": "creditors",
              "delta": 7,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Adopter la révision puis appliquer, au premier budget contrôlé par la règle, une correction de scénario de 8 000 millions d'euros; ce montant n'est pas une économie constitutionnelle automatique."
            },
            {
              "id": "regle-d-or-constitutionnelle:adopt:group:parliamentaryMajority",
              "target": "group",
              "key": "parliamentaryMajority",
              "delta": -6,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Adopter la révision puis appliquer, au premier budget contrôlé par la règle, une correction de scénario de 8 000 millions d'euros; ce montant n'est pas une économie constitutionnelle automatique."
            }
          ],
          "scheduledEvents": [
            {
              "id": "golden-rule-recession",
              "title": "Un ralentissement met la règle à l'épreuve",
              "body": "Dans ce stress de scénario, la baisse des recettes force une correction procyclique faute de clause d'exception suffisante.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "golden-rule-recession:indicator:growth",
                  "target": "indicator",
                  "key": "growth",
                  "delta": -0.35,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Dans ce stress de scénario, la baisse des recettes force une correction procyclique faute de clause d'exception suffisante."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "regle-d-or-constitutionnelle:keep",
          "label": "Conserver les règles actuelles",
          "summary": "Les objectifs restent législatifs et européens, avec une flexibilité politique plus large.",
          "mechanism": "Maintenir les règles européennes et législatives avec une marge contracyclique plus large.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "politique contracyclique"
          ],
          "contributors": [
            "crédibilité budgétaire"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "regle-d-or-constitutionnelle:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les règles européennes et législatives avec une marge contracyclique plus large."
            },
            {
              "id": "regle-d-or-constitutionnelle:keep:indicator:financialCredibility",
              "target": "indicator",
              "key": "financialCredibility",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les règles européennes et législatives avec une marge contracyclique plus large."
            },
            {
              "id": "regle-d-or-constitutionnelle:keep:group:parliamentaryMajority",
              "target": "group",
              "key": "parliamentaryMajority",
              "delta": 3,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les règles européennes et législatives avec une marge contracyclique plus large."
            },
            {
              "id": "regle-d-or-constitutionnelle:keep:group:creditors",
              "target": "group",
              "key": "creditors",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les règles européennes et législatives avec une marge contracyclique plus large."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Déficit structurel, dette et règles budgétaires européennes.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "Les 8 000 millions d'euros par an sont une forte hypothèse de correction du scénario au premier budget contrôlé par la règle, après adoption de la révision. Les sources ne documentent pas un rendement automatique de ce montant."
        },
        {
          "label": "Déficit structurel, dette et règles budgétaires européennes.",
          "sourceName": "Eurostat",
          "sourceUrl": "https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Government_finance_statistics",
          "publishedAt": "2026-04-22",
          "note": "Les 8 000 millions d'euros par an sont une forte hypothèse de correction du scénario au premier budget contrôlé par la règle, après adoption de la révision. Les sources ne documentent pas un rendement automatique de ce montant."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "geler-le-point-d-indice-en-2026",
      "version": 3,
      "kind": "gestion",
      "chapterId": "state-institutions-territories",
      "title": "Faut-il geler le point d'indice de la fonction publique ?",
      "context": "Le gel économise par rapport à une revalorisation, mais réduit le salaire réel des agents lorsque les prix montent.",
      "options": [
        {
          "id": "geler-le-point-d-indice-en-2026:adopt",
          "label": "Geler le point",
          "summary": "La masse salariale progresse moins vite et les agents perdent du pouvoir d'achat réel.",
          "mechanism": "Maintenir la valeur du point pendant l'année; la rétention se dégrade lors des recrutements suivants.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Fixer la valeur du point",
            "Traduire l'effet dans les budgets publics",
            "Dialogue social",
            "Autonomie des employeurs territoriaux"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "agents publics"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "geler-le-point-d-indice-en-2026:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 3400,
              "timing": {
                "kind": "immediate"
              },
              "duration": "annual",
              "explanation": "Maintenir la valeur du point pendant l'année; la rétention se dégrade lors des recrutements suivants. Impact budgétaire retenu par le jeu : 3400 millions d'euros."
            },
            {
              "id": "geler-le-point-d-indice-en-2026:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir la valeur du point pendant l'année; la rétention se dégrade lors des recrutements suivants."
            },
            {
              "id": "geler-le-point-d-indice-en-2026:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir la valeur du point pendant l'année; la rétention se dégrade lors des recrutements suivants."
            },
            {
              "id": "geler-le-point-d-indice-en-2026:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -8,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir la valeur du point pendant l'année; la rétention se dégrade lors des recrutements suivants."
            },
            {
              "id": "geler-le-point-d-indice-en-2026:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Maintenir la valeur du point pendant l'année; la rétention se dégrade lors des recrutements suivants."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "geler-le-point-d-indice-en-2026:keep",
          "label": "Revaloriser selon la trajectoire",
          "summary": "Les rémunérations suivent davantage les prix et l'économie disparaît.",
          "mechanism": "Revaloriser selon la trajectoire retenue et financer la hausse chez les employeurs publics.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "agents publics"
          ],
          "contributors": [
            "finances publiques",
            "collectivités employeuses"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "geler-le-point-d-indice-en-2026:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Revaloriser selon la trajectoire retenue et financer la hausse chez les employeurs publics."
            },
            {
              "id": "geler-le-point-d-indice-en-2026:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Revaloriser selon la trajectoire retenue et financer la hausse chez les employeurs publics."
            },
            {
              "id": "geler-le-point-d-indice-en-2026:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 5,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Revaloriser selon la trajectoire retenue et financer la hausse chez les employeurs publics."
            },
            {
              "id": "geler-le-point-d-indice-en-2026:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -1,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Revaloriser selon la trajectoire retenue et financer la hausse chez les employeurs publics."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Un point sur 370 016 M€ de rémunérations publiques (2025).",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "Situation et trajectoire des finances publiques françaises."
        },
        {
          "label": "Un point sur 370 016 M€ de rémunérations publiques (2025).",
          "sourceName": "DGCL",
          "sourceUrl": "https://www.collectivites-locales.gouv.fr/les-collectivites-locales-en-chiffres-2025",
          "publishedAt": "2025-07-10",
          "note": "Organisation territoriale, personnels, budgets et fiscalité locale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "ne-pas-remplacer-un-depart-administratif-sur",
      "version": 3,
      "kind": "gestion",
      "chapterId": "state-institutions-territories",
      "title": "Faut-il ne pas remplacer un départ administratif sur trois ?",
      "context": "La règle réduit progressivement les fonctions support. Sans suppression préalable de tâches, le travail se reporte sur les agents ou les usagers.",
      "options": [
        {
          "id": "ne-pas-remplacer-un-depart-administratif-sur:adopt",
          "label": "Ne pas remplacer un départ sur trois",
          "summary": "Les effectifs administratifs diminuent et les services absorbent la charge restante.",
          "mechanism": "Supprimer un poste support sur trois au départ, hors enseignants et soignants; les tâches maintenues créent des files de traitement.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [
            "Plafonds d'emplois en loi de finances",
            "Droits statutaires et mobilités",
            "Ne pas étendre automatiquement aux employeurs autonomes"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "after_decisions",
            "count": 3
          },
          "beneficiaries": [
            "finances publiques"
          ],
          "contributors": [
            "agents restants",
            "usagers"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "ne-pas-remplacer-un-depart-administratif-sur:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1500,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "annual",
              "explanation": "Supprimer un poste support sur trois au départ, hors enseignants et soignants; les tâches maintenues créent des files de traitement. Impact budgétaire retenu par le jeu : 1500 millions d'euros."
            },
            {
              "id": "ne-pas-remplacer-un-depart-administratif-sur:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Supprimer un poste support sur trois au départ, hors enseignants et soignants; les tâches maintenues créent des files de traitement."
            },
            {
              "id": "ne-pas-remplacer-un-depart-administratif-sur:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Supprimer un poste support sur trois au départ, hors enseignants et soignants; les tâches maintenues créent des files de traitement."
            },
            {
              "id": "ne-pas-remplacer-un-depart-administratif-sur:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Supprimer un poste support sur trois au départ, hors enseignants et soignants; les tâches maintenues créent des files de traitement."
            }
          ],
          "scheduledEvents": [
            {
              "id": "administrative-backlog",
              "title": "Les dossiers s'accumulent",
              "body": "Les tâches non supprimées se reportent sur moins d'agents et les délais de traitement augmentent.",
              "afterDecisions": 3,
              "effects": [
                {
                  "id": "administrative-backlog:indicator:institutionalTrust",
                  "target": "indicator",
                  "key": "institutionalTrust",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Les tâches non supprimées se reportent sur moins d'agents et les délais de traitement augmentent."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "ne-pas-remplacer-un-depart-administratif-sur:keep",
          "label": "Remplacer selon les besoins",
          "summary": "Les postes sont arbitrés service par service et l'économie automatique disparaît.",
          "mechanism": "Arbitrer chaque remplacement selon la charge et préserver la capacité de traitement.",
          "horizon": {
            "kind": "after_decisions",
            "count": 3
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "agents publics",
            "usagers des services"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "ne-pas-remplacer-un-depart-administratif-sur:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Arbitrer chaque remplacement selon la charge et préserver la capacité de traitement."
            },
            {
              "id": "ne-pas-remplacer-un-depart-administratif-sur:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -1,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Arbitrer chaque remplacement selon la charge et préserver la capacité de traitement."
            },
            {
              "id": "ne-pas-remplacer-un-depart-administratif-sur:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "after_decisions",
                "count": 3
              },
              "duration": "once",
              "explanation": "Arbitrer chaque remplacement selon la charge et préserver la capacité de traitement."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Masse salariale des fonctions support ; hors enseignants et soignants.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "montée"
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "fermer-un-tiers-des-agences-et-operateurs",
      "version": 3,
      "kind": "gestion",
      "chapterId": "state-institutions-territories",
      "title": "Faut-il fermer un tiers des agences et opérateurs ?",
      "context": "Le nombre de structures baisse vite sur le papier. Les missions, agents, contrats et dettes doivent être supprimés ou repris pour produire une économie réelle.",
      "options": [
        {
          "id": "fermer-un-tiers-des-agences-et-operateurs:adopt",
          "label": "Fermer un tiers des structures",
          "summary": "Les fonctions sont supprimées ou réintégrées et la transition engage des coûts avant les économies.",
          "mechanism": "Identifier les structures, supprimer ou transférer chaque mission puis reprendre contrats, dettes et agents.",
          "horizon": {
            "kind": "after_decisions",
            "count": 2
          },
          "legalConstraints": [
            "Acte adapté au texte de création",
            "Transférer actifs, passifs, contrats et contentieux",
            "Droits des agents et continuité"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "after_decisions",
            "count": 2
          },
          "beneficiaries": [
            "finances publiques",
            "lisibilité administrative"
          ],
          "contributors": [
            "agents",
            "usagers des agences fermées"
          ],
          "uncertainty": "forte",
          "effects": [
            {
              "id": "fermer-un-tiers-des-agences-et-operateurs:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 1800,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "annual",
              "explanation": "Identifier les structures, supprimer ou transférer chaque mission puis reprendre contrats, dettes et agents. Impact budgétaire retenu par le jeu : 1800 millions d'euros."
            },
            {
              "id": "fermer-un-tiers-des-agences-et-operateurs:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 3,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Identifier les structures, supprimer ou transférer chaque mission puis reprendre contrats, dettes et agents."
            },
            {
              "id": "fermer-un-tiers-des-agences-et-operateurs:adopt:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": -5,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Identifier les structures, supprimer ou transférer chaque mission puis reprendre contrats, dettes et agents."
            },
            {
              "id": "fermer-un-tiers-des-agences-et-operateurs:adopt:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": -6,
              "timing": {
                "kind": "after_decisions",
                "count": 2
              },
              "duration": "once",
              "explanation": "Identifier les structures, supprimer ou transférer chaque mission puis reprendre contrats, dettes et agents."
            }
          ],
          "scheduledEvents": [
            {
              "id": "agency-mission-transfer",
              "title": "Les missions changent d'adresse sans disparaître",
              "body": "Plusieurs fonctions sont reprises par les ministères avec des coûts de transition et des délais pour les usagers.",
              "afterDecisions": 2,
              "effects": [
                {
                  "id": "agency-mission-transfer:indicator:institutionalTrust",
                  "target": "indicator",
                  "key": "institutionalTrust",
                  "delta": -3,
                  "timing": {
                    "kind": "immediate"
                  },
                  "duration": "once",
                  "explanation": "Plusieurs fonctions sont reprises par les ministères avec des coûts de transition et des délais pour les usagers."
                }
              ]
            }
          ],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "fermer-un-tiers-des-agences-et-operateurs:keep",
          "label": "Examiner agence par agence",
          "summary": "Les missions restent stables et les économies arrivent plus lentement.",
          "mechanism": "Conserver les opérateurs et poursuivre les revues structure par structure.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "agents des opérateurs",
            "usagers des agences"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "fermer-un-tiers-des-agences-et-operateurs:keep:indicator:publicServices",
              "target": "indicator",
              "key": "publicServices",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les opérateurs et poursuivre les revues structure par structure."
            },
            {
              "id": "fermer-un-tiers-des-agences-et-operateurs:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les opérateurs et poursuivre les revues structure par structure."
            },
            {
              "id": "fermer-un-tiers-des-agences-et-operateurs:keep:group:publicEmployees",
              "target": "group",
              "key": "publicEmployees",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Conserver les opérateurs et poursuivre les revues structure par structure."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Revues parlementaires des opérateurs, hors coûts de transition.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "Situation et trajectoire des finances publiques françaises."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "diviser-par-deux-le-nombre-de-parlementaires",
      "version": 3,
      "kind": "transformation",
      "chapterId": "state-institutions-territories",
      "title": "Faut-il diviser par deux le nombre de parlementaires ?",
      "context": "La réforme est spectaculaire et l'économie minuscule face au déficit. Chaque élu représente davantage d'habitants et le travail en commission se concentre.",
      "options": [
        {
          "id": "diviser-par-deux-le-nombre-de-parlementaires:adopt",
          "label": "Diviser le nombre par deux",
          "summary": "Le Parlement rétrécit fortement et l'économie reste surtout symbolique.",
          "mechanism": "Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions.",
          "horizon": {
            "kind": "mandate_year",
            "year": 5
          },
          "legalConstraints": [
            "Révision constitutionnelle et lois organiques",
            "Lois électorales et redécoupage",
            "Égalité du suffrage et représentation territoriale"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "mandate_year",
            "year": 5
          },
          "beneficiaries": [
            "symbole de sobriété",
            "finances publiques"
          ],
          "contributors": [
            "représentation territoriale",
            "pluralisme"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:adopt:indicator:annualBalance",
              "target": "indicator",
              "key": "annualBalance",
              "delta": 150,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "annual",
              "explanation": "Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions. Impact budgétaire retenu par le jeu : 150 millions d'euros."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:adopt:indicator:opinion",
              "target": "indicator",
              "key": "opinion",
              "delta": 3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:adopt:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": -4,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:adopt:group:parliamentaryMajority",
              "target": "group",
              "key": "parliamentaryMajority",
              "delta": -3,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "diviser-par-deux-le-nombre-de-parlementaires:keep",
          "label": "Conserver les deux assemblées actuelles",
          "summary": "La représentation territoriale et les effectifs parlementaires restent inchangés.",
          "mechanism": "Maintenir les effectifs, commissions et représentation territoriale actuels.",
          "horizon": {
            "kind": "immediate"
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "territoires",
            "électeurs",
            "parlementaires"
          ],
          "contributors": [
            "finances publiques"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les effectifs, commissions et représentation territoriale actuels."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:keep:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les effectifs, commissions et représentation territoriale actuels."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:keep:group:localAuthorities",
              "target": "group",
              "key": "localAuthorities",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les effectifs, commissions et représentation territoriale actuels."
            },
            {
              "id": "diviser-par-deux-le-nombre-de-parlementaires:keep:group:parliamentaryMajority",
              "target": "group",
              "key": "parliamentaryMajority",
              "delta": 2,
              "timing": {
                "kind": "immediate"
              },
              "duration": "once",
              "explanation": "Maintenir les effectifs, commissions et représentation territoriale actuels."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Budgets des assemblées ; symbolique face aux masses, et le jeu l'affichera tel quel.",
          "sourceName": "Cour des comptes",
          "sourceUrl": "https://www.ccomptes.fr/sites/default/files/2025-02/20250213-synthese-Situation-des-finances-publiques-debut-2025.pdf",
          "publishedAt": "2025-02-13",
          "note": "Situation et trajectoire des finances publiques françaises."
        },
        {
          "label": "Budgets des assemblées ; symbolique face aux masses, et le jeu l'affichera tel quel.",
          "sourceName": "DGCL",
          "sourceUrl": "https://www.collectivites-locales.gouv.fr/les-collectivites-locales-en-chiffres-2025",
          "publishedAt": "2025-07-10",
          "note": "Organisation territoriale, personnels, budgets et fiscalité locale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    },
    {
      "id": "proportionnelle-integrale",
      "version": 3,
      "kind": "rupture",
      "chapterId": "state-institutions-territories",
      "title": "Faut-il élire l'Assemblée nationale à la proportionnelle intégrale ?",
      "context": "Les sièges reflètent les voix nationales. La représentation gagne en fidélité et les majorités absolues deviennent plus rares.",
      "options": [
        {
          "id": "proportionnelle-integrale:adopt",
          "label": "Passer à la proportionnelle intégrale",
          "summary": "Chaque courant obtient des sièges proches de son poids et les gouvernements doivent former des coalitions.",
          "mechanism": "Élire la prochaine Assemblée sur des listes proportionnelles nationales avec seuil et règles de répartition explicites.",
          "horizon": {
            "kind": "mandate_year",
            "year": 5
          },
          "legalConstraints": [
            "Loi électorale et dispositions organiques",
            "Définir seuil, listes et répartition",
            "Égalité du suffrage, pluralisme et parité",
            "Application à la prochaine élection"
          ],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "petits partis",
            "pluralisme"
          ],
          "contributors": [
            "stabilité majoritaire"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "proportionnelle-integrale:adopt:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": 5,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Élire la prochaine Assemblée sur des listes proportionnelles nationales avec seuil et règles de répartition explicites."
            },
            {
              "id": "proportionnelle-integrale:adopt:indicator:majority",
              "target": "indicator",
              "key": "majority",
              "delta": -10,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Élire la prochaine Assemblée sur des listes proportionnelles nationales avec seuil et règles de répartition explicites."
            },
            {
              "id": "proportionnelle-integrale:adopt:indicator:reformCapacity",
              "target": "indicator",
              "key": "reformCapacity",
              "delta": -4,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Élire la prochaine Assemblée sur des listes proportionnelles nationales avec seuil et règles de répartition explicites."
            },
            {
              "id": "proportionnelle-integrale:adopt:group:parliamentaryMajority",
              "target": "group",
              "key": "parliamentaryMajority",
              "delta": -8,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Élire la prochaine Assemblée sur des listes proportionnelles nationales avec seuil et règles de répartition explicites."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        },
        {
          "id": "proportionnelle-integrale:keep",
          "label": "Conserver le scrutin majoritaire",
          "summary": "Les circonscriptions et la prime aux grands blocs sont maintenues.",
          "mechanism": "Conserver les circonscriptions et le scrutin majoritaire à la prochaine élection.",
          "horizon": {
            "kind": "mandate_year",
            "year": 5
          },
          "legalConstraints": [],
          "budgetDuration": "annual",
          "budgetTiming": {
            "kind": "immediate"
          },
          "beneficiaries": [
            "majorités cohérentes",
            "ancrage local"
          ],
          "contributors": [
            "représentation proportionnelle"
          ],
          "uncertainty": "moyenne",
          "effects": [
            {
              "id": "proportionnelle-integrale:keep:indicator:majority",
              "target": "indicator",
              "key": "majority",
              "delta": 4,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Conserver les circonscriptions et le scrutin majoritaire à la prochaine élection."
            },
            {
              "id": "proportionnelle-integrale:keep:indicator:institutionalTrust",
              "target": "indicator",
              "key": "institutionalTrust",
              "delta": -2,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Conserver les circonscriptions et le scrutin majoritaire à la prochaine élection."
            },
            {
              "id": "proportionnelle-integrale:keep:group:parliamentaryMajority",
              "target": "group",
              "key": "parliamentaryMajority",
              "delta": 5,
              "timing": {
                "kind": "mandate_year",
                "year": 5
              },
              "duration": "once",
              "explanation": "Conserver les circonscriptions et le scrutin majoritaire à la prochaine élection."
            }
          ],
          "scheduledEvents": [],
          "promises": [],
          "fulfillsPromises": [],
          "locks": [],
          "unlocks": []
        }
      ],
      "evidence": [
        {
          "label": "Architecture institutionnelle et représentation politique.",
          "sourceName": "DGCL",
          "sourceUrl": "https://www.collectivites-locales.gouv.fr/les-collectivites-locales-en-chiffres-2025",
          "publishedAt": "2025-07-10",
          "note": "Organisation territoriale, personnels, budgets et fiscalité locale."
        }
      ],
      "dependencies": [],
      "conflicts": []
    }
  ]
} as unknown as Scenario
);
