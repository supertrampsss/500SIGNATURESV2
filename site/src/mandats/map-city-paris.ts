/** Local Paris composition follows the cathedral, its banks and the reference's
 * continuous small roof volumes. Every frontage and corner is authored here. */
export type ParisPoint = readonly [number, number];
export type ParisModel = "immeuble_paris_01" | "hotel_angle_paris_01" | "front_mitoyen_paris_01" | "boutique_01" |
  "maison_paris_01" | "maison_paris_02" | "maison_paris_03" | "maison_pierre_01" | "maison_pierre_02";
export type ParisBuilding = { id: string; model: ParisModel; x: number; z: number; angle: number;
  width: number; depth: number; height: number; footprintOffset?: number };
export type ParisBlock = { id: string; outline: readonly ParisPoint[]; buildings: readonly ParisBuilding[] };
export type ParisSpace = { id: string; kind: "court" | "square" | "garden" | "field" | "wood"; outline: readonly ParisPoint[] };
export type ParisStreet = { id: string; width: number; points: readonly ParisPoint[]; quay?: boolean };
export type ParisTree = { x: number; z: number; height: number; model: "oak" | "beech" | "cypress" | "pine" };

/** Physical dimensions follow the widened source facade and its unchanged depth and height. */
export const PARIS_CATHEDRAL_SITE = {
  "x": 0.4000000000000001,
  "z": 0.7500000000000002,
  "angle": 3.541592653589793,
  "width": 1.1856,
  "depth": 1.526555846879916,
  "height": 1.5205978397552151
};

export const PARIS_BLOCKS: readonly ParisBlock[] = [
  {
    "id": "cloitre17-ouest-interieur",
    "outline": [
      [
        -0.5343468765869163,
        0.5913262648946788
      ],
      [
        -0.3869771175464547,
        0.5290193301252948
      ],
      [
        0.18546784564726154,
        1.8829789913095358
      ],
      [
        0.03809808660680003,
        1.9452859260789197
      ]
    ],
    "buildings": [
      {
        "id": "cloitre17-libraire-0",
        "model": "front_mitoyen_paris_01",
        "x": -0.40932649101963303,
        "z": 0.6687530250787898,
        "angle": -1.1707963267948966,
        "width": 0.195,
        "depth": 0.07460710944808234,
        "height": 0.1337121141253508
      },
      {
        "id": "cloitre17-libraire-1",
        "model": "immeuble_paris_01",
        "x": -0.37263318220409936,
        "z": 0.8312948691933681,
        "angle": 3.541592653589793,
        "width": 0.059,
        "depth": 0.040562499999999994,
        "height": 0.08066957799145298
      },
      {
        "id": "cloitre17-libraire-2",
        "model": "maison_paris_02",
        "x": -0.30843661517234733,
        "z": 0.8200703178991273,
        "angle": 3.541592653589793,
        "width": 0.058,
        "depth": 0.05853814432989691,
        "height": 0.0663998350515464,
        "footprintOffset": 0.0026608243431012657
      },
      {
        "id": "cloitre17-libraire-3",
        "model": "front_mitoyen_paris_01",
        "x": -0.2652417043654323,
        "z": 1.0095455928598571,
        "angle": -1.1707963267948966,
        "width": 0.205,
        "depth": 0.0784331150608045,
        "height": 0.14329864359214217
      },
      {
        "id": "cloitre17-libraire-4",
        "model": "maison_paris_01",
        "x": -0.23295001856639272,
        "z": 1.1616766195312636,
        "angle": 0.4,
        "width": 0.059,
        "depth": 0.04497456140350877,
        "height": 0.06106023859649123,
        "footprintOffset": 0.0023030706011412435
      },
      {
        "id": "cloitre17-libraire-5",
        "model": "hotel_angle_paris_01",
        "x": -0.172539756793953,
        "z": 1.1440645466041333,
        "angle": 0.4,
        "width": 0.059,
        "depth": 0.053653020892151335,
        "height": 0.0786655561829475
      },
      {
        "id": "cloitre17-libraire-6",
        "model": "hotel_angle_paris_01",
        "x": -0.12866083593863353,
        "z": 1.3274538601002381,
        "angle": -1.1707963267948966,
        "width": 0.105,
        "depth": 0.09548418972332015,
        "height": 0.139998023715415
      },
      {
        "id": "cloitre17-libraire-7",
        "model": "maison_paris_02",
        "x": -0.06832685495866284,
        "z": 1.4430866377722504,
        "angle": -1.1707963267948966,
        "width": 0.099,
        "depth": 0.09991855670103093,
        "height": 0.11549646185567013,
        "footprintOffset": 0.004541751895983195
      },
      {
        "id": "cloitre17-libraire-8",
        "model": "immeuble_paris_01",
        "x": 0.03036407203268149,
        "z": 1.7010152053231007,
        "angle": -1.1707963267948966,
        "width": 0.107,
        "depth": 0.07356249999999999,
        "height": 0.14203792735042733
      },
      {
        "id": "cloitre17-libraire-9",
        "model": "maison_paris_03",
        "x": 0.08230134912261586,
        "z": 1.8264263499875448,
        "angle": 3.541592653589793,
        "width": 0.11,
        "depth": 0.07716793893129771,
        "height": 0.0991183969465649,
        "footprintOffset": 0.0037366419120599295
      }
    ]
  },
  {
    "id": "cloitre17-ouest-jardin",
    "outline": [
      [
        -0.7061870093587004,
        0.5988368420346604
      ],
      [
        -0.54960664037821,
        0.5326357238421897
      ],
      [
        -0.4327811376856149,
        0.8089540220430551
      ],
      [
        -0.5893615066661052,
        0.8751551402355258
      ]
    ],
    "buildings": [
      {
        "id": "cloitre17-jardin-sud-1",
        "model": "maison_paris_03",
        "x": -0.5349612713320664,
        "z": 0.7598702132259588,
        "angle": 1.9707963267948965,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      }
    ]
  },
  {
    "id": "cloitre17-ouest-nord",
    "outline": [
      [
        -0.45060551091148643,
        1.4570556589173225
      ],
      [
        -0.2940251419309961,
        1.390854540724852
      ],
      [
        -0.021432302314940754,
        2.0355972365268715
      ],
      [
        -0.17801267129543108,
        2.1017983547193424
      ]
    ],
    "buildings": [
      {
        "id": "cloitre17-jardin-nord-0",
        "model": "immeuble_paris_01",
        "x": -0.33195124909652035,
        "z": 1.4937457959182316,
        "angle": 1.9707963267948965,
        "width": 0.122,
        "depth": 0.08387499999999999,
        "height": 0.17490576923076923
      },
      {
        "id": "cloitre17-jardin-nord-1",
        "model": "maison_paris_03",
        "x": -0.27937977288485255,
        "z": 1.618089030108621,
        "angle": 1.9707963267948965,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "cloitre17-jardin-nord-2",
        "model": "maison_pierre_02",
        "x": -0.2268082966731847,
        "z": 1.7424322642990107,
        "angle": 1.9707963267948965,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "cloitre17-jardin-nord-3",
        "model": "maison_paris_01",
        "x": -0.1742368204615169,
        "z": 1.8667754984894,
        "angle": 1.9707963267948965,
        "width": 0.12,
        "depth": 0.09147368421052632,
        "height": 0.13195221052631578,
        "footprintOffset": 0.004684210526315789
      }
    ]
  },
  {
    "id": "chevet17-est-interieur",
    "outline": [
      [
        0.7819820415454584,
        0.013077236111705158
      ],
      [
        0.9293518005859199,
        -0.04922969865767888
      ],
      [
        1.5017967637796361,
        1.3047299625265623
      ],
      [
        1.3544270047391747,
        1.3670368972959464
      ]
    ],
    "buildings": [
      {
        "id": "chevet17-atelier-1",
        "model": "front_mitoyen_paris_01",
        "x": 0.915852018531863,
        "z": 0.14430478375951974,
        "angle": 1.9707963267948965,
        "width": 0.202,
        "depth": 0.07728531337698787,
        "height": 0.1398568132210789
      },
      {
        "id": "chevet17-atelier-2",
        "model": "maison_paris_03",
        "x": 0.9468265529729043,
        "z": 0.2951180072272871,
        "angle": 3.541592653589793,
        "width": 0.058,
        "depth": 0.040688549618320614,
        "height": 0.055113105343511444,
        "footprintOffset": 0.0019702293718134173
      },
      {
        "id": "chevet17-atelier-3",
        "model": "hotel_angle_paris_01",
        "x": 1.0056438255083813,
        "z": 0.27245419421423744,
        "angle": 3.541592653589793,
        "width": 0.059,
        "depth": 0.053653020892151335,
        "height": 0.07943678712591758
      },
      {
        "id": "chevet17-atelier-4",
        "model": "front_mitoyen_paris_01",
        "x": 1.0562850824923333,
        "z": 0.46927000427807686,
        "angle": 1.9707963267948965,
        "width": 0.209,
        "depth": 0.07996351730589336,
        "height": 0.1419205799812909
      },
      {
        "id": "chevet17-atelier-5",
        "model": "immeuble_paris_01",
        "x": 1.086639331090388,
        "z": 0.6258063246387124,
        "angle": 0.4,
        "width": 0.059,
        "depth": 0.040562499999999994,
        "height": 0.0798863782051282
      },
      {
        "id": "chevet17-atelier-6",
        "model": "maison_paris_02",
        "x": 1.1416829081961613,
        "z": 0.5942168825889291,
        "angle": 0.4,
        "width": 0.058,
        "depth": 0.05853814432989691,
        "height": 0.07209124948453609,
        "footprintOffset": 0.0026608243431012657
      },
      {
        "id": "chevet17-atelier-7",
        "model": "hotel_angle_paris_01",
        "x": 1.1906344105888178,
        "z": 0.7870360472090722,
        "angle": 1.9707963267948965,
        "width": 0.1,
        "depth": 0.0909373235460192,
        "height": 0.13333145115753814
      },
      {
        "id": "chevet17-atelier-8",
        "model": "maison_paris_01",
        "x": 1.2340568709584419,
        "z": 0.8989618568298572,
        "angle": 1.9707963267948965,
        "width": 0.092,
        "depth": 0.07012982456140351,
        "height": 0.09351235087719298,
        "footprintOffset": 0.003591228733982956
      },
      {
        "id": "chevet17-atelier-9",
        "model": "front_mitoyen_paris_01",
        "x": 1.3541901143584512,
        "z": 1.1738816646902839,
        "angle": 1.9707963267948965,
        "width": 0.23,
        "depth": 0.08799812909260993,
        "height": 0.15311817898347363
      }
    ]
  },
  {
    "id": "chevet17-est-exterieur",
    "outline": [
      [
        1.06429391764016,
        0.013145176451773398
      ],
      [
        1.2208742866206506,
        -0.053055941740697145
      ],
      [
        1.7699541492758477,
        1.245640059803371
      ],
      [
        1.6133737802953574,
        1.3118411779958414
      ]
    ],
    "buildings": [
      {
        "id": "chevet17-rue-haute-0",
        "model": "front_mitoyen_paris_01",
        "x": 1.1863411807783597,
        "z": 0.08097190835354681,
        "angle": -1.1707963267948966,
        "width": 0.172,
        "depth": 0.06580729653882134,
        "height": 0.1202310570626754
      },
      {
        "id": "chevet17-rue-haute-1",
        "model": "hotel_angle_paris_01",
        "x": 1.2023851264005245,
        "z": 0.23704430120017753,
        "angle": 3.541592653589793,
        "width": 0.077,
        "depth": 0.07002173913043479,
        "height": 0.1016586956521739
      },
      {
        "id": "chevet17-rue-haute-2",
        "model": "maison_paris_02",
        "x": 1.2878758554657308,
        "z": 0.21327083420248708,
        "angle": 3.541592653589793,
        "width": 0.074,
        "depth": 0.07468659793814432,
        "height": 0.0871375175257732,
        "footprintOffset": 0.0033948448515429934
      },
      {
        "id": "chevet17-rue-haute-3",
        "model": "front_mitoyen_paris_01",
        "x": 1.3304259674325603,
        "z": 0.42176447613461426,
        "angle": -1.1707963267948966,
        "width": 0.186,
        "depth": 0.07116370439663237,
        "height": 0.1275407857811038
      },
      {
        "id": "chevet17-rue-haute-4",
        "model": "immeuble_paris_01",
        "x": 1.3514273817812004,
        "z": 0.5844265202486508,
        "angle": 0.4,
        "width": 0.079,
        "depth": 0.05431249999999999,
        "height": 0.10486912393162391
      },
      {
        "id": "chevet17-rue-haute-5",
        "model": "maison_paris_03",
        "x": 1.433398461220607,
        "z": 0.5600320964119809,
        "angle": 0.4,
        "width": 0.075,
        "depth": 0.052614503816793896,
        "height": 0.0749531679389313,
        "footprintOffset": 0.0025477103945863154
      },
      {
        "id": "chevet17-rue-haute-6",
        "model": "front_mitoyen_paris_01",
        "x": 1.478757101266308,
        "z": 0.7803043968346597,
        "angle": -1.1707963267948966,
        "width": 0.214,
        "depth": 0.08187652011225445,
        "height": 0.1453158091674462
      },
      {
        "id": "chevet17-rue-haute-7",
        "model": "maison_paris_01",
        "x": 1.5115247068498414,
        "z": 0.968228167800386,
        "angle": 3.541592653589793,
        "width": 0.073,
        "depth": 0.05564649122807018,
        "height": 0.08094547368421051,
        "footprintOffset": 0.0028495619302256066
      },
      {
        "id": "chevet17-rue-haute-8",
        "model": "hotel_angle_paris_01",
        "x": 1.594973167719699,
        "z": 0.9396242822793243,
        "angle": 3.541592653589793,
        "width": 0.078,
        "depth": 0.07093111236589497,
        "height": 0.10195934500282326
      }
    ]
  },
  {
    "id": "chevet17-traverse",
    "outline": [
      [
        0.3020011072040835,
        1.725139075727547
      ],
      [
        1.1770090515068243,
        1.355191650534329
      ],
      [
        1.250998536545468,
        1.5301932393948774
      ],
      [
        0.37599059224272713,
        1.9001406645880954
      ]
    ],
    "buildings": [
      {
        "id": "chevet17-passage-nord-0",
        "model": "maison_paris_01",
        "x": 0.40683945410900635,
        "z": 1.7676704878630858,
        "angle": 3.541592653589793,
        "width": 0.113,
        "depth": 0.08613771929824562,
        "height": 0.12529915789473683,
        "footprintOffset": 0.004410964912280702
      },
      {
        "id": "chevet17-passage-nord-1",
        "model": "immeuble_paris_01",
        "x": 0.5265773833293814,
        "z": 1.7170461033629614,
        "angle": 3.541592653589793,
        "width": 0.12,
        "depth": 0.08249999999999999,
        "height": 0.1911538461538461
      },
      {
        "id": "chevet17-passage-nord-2",
        "model": "maison_paris_03",
        "x": 0.6463153125497565,
        "z": 1.6664217188628367,
        "angle": 3.541592653589793,
        "width": 0.11,
        "depth": 0.07716793893129771,
        "height": 0.1081291603053435,
        "footprintOffset": 0.0037366412213740456
      },
      {
        "id": "chevet17-passage-nord-3",
        "model": "maison_pierre_02",
        "x": 0.7660532417701316,
        "z": 1.6157973343627123,
        "angle": 3.541592653589793,
        "width": 0.12,
        "depth": 0.08561904761904762,
        "height": 0.09768,
        "footprintOffset": 0.004238095238095238
      },
      {
        "id": "chevet17-passage-nord-4",
        "model": "maison_paris_01",
        "x": 0.8857911709905066,
        "z": 1.5651729498625877,
        "angle": 3.541592653589793,
        "width": 0.113,
        "depth": 0.08613771929824562,
        "height": 0.12529915789473683,
        "footprintOffset": 0.004410964912280702
      },
      {
        "id": "chevet17-passage-nord-5",
        "model": "immeuble_paris_01",
        "x": 1.0055291002108817,
        "z": 1.514548565362463,
        "angle": 3.541592653589793,
        "width": 0.12,
        "depth": 0.08249999999999999,
        "height": 0.1911538461538461
      },
      {
        "id": "chevet17-passage-nord-6",
        "model": "maison_paris_03",
        "x": 1.1252670294312568,
        "z": 1.4639241808623384,
        "angle": 3.541592653589793,
        "width": 0.11,
        "depth": 0.07716793893129771,
        "height": 0.1081291603053435,
        "footprintOffset": 0.0037366412213740456
      }
    ]
  },
  {
    "id": "quai-des-libraires",
    "outline": [
      [
        -0.94,
        0.73
      ],
      [
        -0.79,
        0.54
      ],
      [
        -0.66,
        0.41
      ],
      [
        -0.4,
        0.19
      ],
      [
        -0.18,
        0.13
      ],
      [
        -0.18,
        0.33
      ],
      [
        -0.56,
        0.6
      ],
      [
        -0.79,
        0.8
      ]
    ],
    "buildings": [
      {
        "id": "quai-maison-du-pont",
        "model": "immeuble_paris_01",
        "x": -0.845761205,
        "z": 0.735826834,
        "angle": 3.7815926535897932,
        "width": 0.138,
        "depth": 0.094875,
        "height": 0.18318910256410256
      },
      {
        "id": "quai-ardoise-du-libraire",
        "model": "maison_paris_03",
        "x": -0.73,
        "z": 0.617,
        "angle": 3.8415926535897933,
        "width": 0.135,
        "depth": 0.09470610687022901,
        "height": 0.12385703816793894,
        "footprintOffset": 0.00458587786259542
      },
      {
        "id": "quai-maison-du-relieur",
        "model": "immeuble_paris_01",
        "x": -0.617,
        "z": 0.526,
        "angle": 3.861592653589793,
        "width": 0.138,
        "depth": 0.094875,
        "height": 0.18318910256410256
      },
      {
        "id": "quai-logis-brique",
        "model": "maison_paris_01",
        "x": -0.505,
        "z": 0.426,
        "angle": 3.8215926535897933,
        "width": 0.135,
        "depth": 0.10290789473684211,
        "height": 0.13971410526315792,
        "footprintOffset": 0.005269736842105264
      },
      {
        "id": "quai-des-libraires-tissu14-2005",
        "model": "maison_paris_03",
        "x": -0.703018,
        "z": 0.732467,
        "angle": 3.7815926535897932,
        "width": 0.083,
        "depth": 0.058227,
        "height": 0.088822,
        "footprintOffset": 0.002819
      }
    ]
  },
  {
    "id": "rive-gauche-pont",
    "outline": [
      [
        -0.9,
        -0.08
      ],
      [
        -0.75,
        -0.39
      ],
      [
        -0.36,
        -0.28
      ],
      [
        -0.27,
        -0.11
      ],
      [
        -0.49,
        0.08
      ],
      [
        -0.77,
        0.15
      ]
    ],
    "buildings": [
      {
        "id": "rive-gauche-front-quai-gauche",
        "model": "maison_pierre_02",
        "x": -0.6742330552840232,
        "z": 0.05255291027288258,
        "angle": 0.55,
        "width": 0.1235,
        "depth": 0.08811626984126984,
        "height": 0.09382706666666667,
        "footprintOffset": 0.004361706349206349
      },
      {
        "id": "rive-gauche-front-quai-droite",
        "model": "maison_paris_01",
        "x": -0.5682033820394935,
        "z": -0.016526840473948444,
        "angle": 0.55,
        "width": 0.1235,
        "depth": 0.09414166666666668,
        "height": 0.12781253333333334,
        "footprintOffset": 0.004820833333333333
      },
      {
        "id": "rive-gauche-angle-pont",
        "model": "immeuble_paris_01",
        "x": -0.383,
        "z": -0.1,
        "angle": 0.55,
        "width": 0.135,
        "depth": 0.0928125,
        "height": 0.17920673076923077
      },
      {
        "id": "rive-gauche-toit-rouge",
        "model": "maison_paris_02",
        "x": -0.733,
        "z": -0.128,
        "angle": 1.8207963267948966,
        "width": 0.124,
        "depth": 0.1251505154639175,
        "height": 0.15142215257731964,
        "footprintOffset": 0.005688659793814433
      },
      {
        "id": "rive-gauche-petite-cour",
        "model": "immeuble_paris_01",
        "x": -0.705,
        "z": -0.275,
        "angle": 3.141592653589793,
        "width": 0.134,
        "depth": 0.092125,
        "height": 0.1778792735042735
      },
      {
        "id": "rive-gauche-rue-basse-gauche",
        "model": "maison_paris_03",
        "x": -0.4265,
        "z": -0.26629244210541353,
        "angle": 3.141592653589793,
        "width": 0.132,
        "depth": 0.09260152671755725,
        "height": 0.12110465954198474,
        "footprintOffset": 0.0044839694656488545
      },
      {
        "id": "rive-gauche-rue-basse-droite",
        "model": "maison_paris_01",
        "x": -0.5615,
        "z": -0.2616140170351041,
        "angle": 3.141592653589793,
        "width": 0.132,
        "depth": 0.10062105263157896,
        "height": 0.13660934736842106,
        "footprintOffset": 0.005152631578947369
      },
      {
        "id": "rive-gauche-atelier-angle",
        "model": "immeuble_paris_01",
        "x": -0.795,
        "z": 0.028,
        "angle": 1.5707963267948966,
        "width": 0.12,
        "depth": 0.08249999999999999,
        "height": 0.15929487179487176
      },
      {
        "id": "rive-gauche-pont-tissu14-29",
        "model": "maison_paris_03",
        "x": -0.557,
        "z": -0.149,
        "angle": 0.55,
        "width": 0.078,
        "depth": 0.054719,
        "height": 0.088009,
        "footprintOffset": 0.00265
      },
      {
        "id": "rive-gauche-pont-tissu14-2004",
        "model": "maison_paris_01",
        "x": -0.627748,
        "z": 0.128372,
        "angle": 0.55,
        "width": 0.102,
        "depth": 0.077753,
        "height": 0.149898,
        "footprintOffset": 0.003982
      },
      {
        "id": "rive-gauche-pont-tissu14-2007",
        "model": "maison_paris_02",
        "x": -0.723539,
        "z": 0.206021,
        "angle": 0.55,
        "width": 0.109,
        "depth": 0.110011,
        "height": 0.189009,
        "footprintOffset": 0.005001
      },
      {
        "id": "rive-gauche-pont-tissu14-2008",
        "model": "maison_paris_01",
        "x": -0.535893,
        "z": 0.065349,
        "angle": 0.55,
        "width": 0.087,
        "depth": 0.066318,
        "height": 0.105023,
        "footprintOffset": 0.003396
      },
      {
        "id": "rive-gauche-pont-tissu14-2009",
        "model": "maison_paris_03",
        "x": -0.876708,
        "z": 0.176691,
        "angle": 0.55,
        "width": 0.102,
        "depth": 0.071556,
        "height": 0.145936,
        "footprintOffset": 0.003465
      },
      {
        "id": "rive-gauche-pont-tissu14-2028",
        "model": "maison_paris_01",
        "x": -0.238531,
        "z": -0.088208,
        "angle": 0.55,
        "width": 0.087,
        "depth": 0.066318,
        "height": 0.127854,
        "footprintOffset": 0.003396
      },
      {
        "id": "rive-gauche-pont-tissu14-2033",
        "model": "maison_paris_03",
        "x": -0.829011,
        "z": -0.103484,
        "angle": 1.8207963267948966,
        "width": 0.087,
        "depth": 0.061033,
        "height": 0.124474,
        "footprintOffset": 0.002955
      },
      {
        "id": "rive-gauche-pont-tissu14-2036",
        "model": "maison_paris_01",
        "x": -0.863594,
        "z": -0.214376,
        "angle": 1.8207963267948966,
        "width": 0.096,
        "depth": 0.073179,
        "height": 0.154936,
        "footprintOffset": 0.003747
      },
      {
        "id": "rive-gauche-pont-tissu14-2053",
        "model": "maison_paris_03",
        "x": -0.4265,
        "z": -0.183475,
        "angle": 3.141592653589793,
        "width": 0.087,
        "depth": 0.061033,
        "height": 0.093104,
        "footprintOffset": 0.002955
      },
      {
        "id": "rive-gauche-pont-tissu14-2058",
        "model": "maison_pierre_02",
        "x": -0.542,
        "z": -0.34963,
        "angle": 3.141592653589793,
        "width": 0.087,
        "depth": 0.062074,
        "height": 0.093858,
        "footprintOffset": 0.003073
      },
      {
        "id": "rive-gauche-pont-tissu14-2073",
        "model": "maison_paris_03",
        "x": -0.872766,
        "z": 0.028,
        "angle": 1.5707963267948966,
        "width": 0.087,
        "depth": 0.061033,
        "height": 0.113343,
        "footprintOffset": 0.002955
      }
    ]
  },
  {
    "id": "quartier-rue-saint-germain",
    "outline": [
      [
        -0.88,
        -0.79
      ],
      [
        -0.36,
        -0.79
      ],
      [
        -0.36,
        -1.16
      ],
      [
        -0.88,
        -1.16
      ]
    ],
    "buildings": [
      {
        "id": "saint-germain-front-nord-gauche",
        "model": "maison_paris_01",
        "x": -0.68425,
        "z": -0.875818094054125,
        "angle": 0,
        "width": 0.1435,
        "depth": 0.1093872807017544,
        "height": 0.14851091929824561,
        "footprintOffset": 0.005601535087719298
      },
      {
        "id": "saint-germain-front-nord-droite",
        "model": "maison_paris_03",
        "x": -0.53775,
        "z": -0.870732078920872,
        "angle": 0,
        "width": 0.1435,
        "depth": 0.10066908396946565,
        "height": 0.13165544427480916,
        "footprintOffset": 0.004874618320610686
      },
      {
        "id": "saint-germain-pignon-ouest",
        "model": "immeuble_paris_01",
        "x": -0.8,
        "z": -0.956,
        "angle": 1.5707963267948966,
        "width": 0.134,
        "depth": 0.092125,
        "height": 0.1778792735042735
      },
      {
        "id": "saint-germain-front-sud-gauche",
        "model": "maison_paris_03",
        "x": -0.53775,
        "z": -1.030267921079128,
        "angle": 3.141592653589793,
        "width": 0.1435,
        "depth": 0.10066908396946565,
        "height": 0.13165544427480916,
        "footprintOffset": 0.004874618320610686
      },
      {
        "id": "saint-germain-front-sud-droite",
        "model": "maison_pierre_02",
        "x": -0.68425,
        "z": -1.0292159702733603,
        "angle": 3.141592653589793,
        "width": 0.1435,
        "depth": 0.10238611111111111,
        "height": 0.10902173333333333,
        "footprintOffset": 0.005068055555555555
      },
      {
        "id": "saint-germain-angle-est",
        "model": "immeuble_paris_01",
        "x": -0.422,
        "z": -0.956,
        "angle": -1.5707963267948966,
        "width": 0.134,
        "depth": 0.092125,
        "height": 0.1778792735042735
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2",
        "model": "maison_pierre_02",
        "x": -0.768,
        "z": -1.12,
        "angle": 0,
        "width": 0.086,
        "depth": 0.06136,
        "height": 0.080354,
        "footprintOffset": 0.003037
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-4",
        "model": "maison_paris_01",
        "x": -0.614,
        "z": -1.12,
        "angle": 0,
        "width": 0.07,
        "depth": 0.05336,
        "height": 0.110219,
        "footprintOffset": 0.002732
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-5",
        "model": "maison_paris_03",
        "x": -0.537,
        "z": -1.12,
        "angle": 0,
        "width": 0.078,
        "depth": 0.054719,
        "height": 0.088009,
        "footprintOffset": 0.00265
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2004",
        "model": "maison_paris_01",
        "x": -0.68425,
        "z": -0.776248,
        "angle": 0,
        "width": 0.102,
        "depth": 0.077753,
        "height": 0.149898,
        "footprintOffset": 0.003982
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2008",
        "model": "maison_paris_01",
        "x": -0.563,
        "z": -0.781965,
        "angle": 0,
        "width": 0.087,
        "depth": 0.066318,
        "height": 0.105023,
        "footprintOffset": 0.003396
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2013",
        "model": "maison_paris_03",
        "x": -0.53775,
        "z": -0.957583,
        "angle": 0,
        "width": 0.087,
        "depth": 0.061033,
        "height": 0.113343,
        "footprintOffset": 0.002955
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2018",
        "model": "maison_pierre_02",
        "x": -0.4165,
        "z": -0.783361,
        "angle": 0,
        "width": 0.087,
        "depth": 0.062074,
        "height": 0.103075,
        "footprintOffset": 0.003073
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2020",
        "model": "maison_paris_01",
        "x": -0.29925,
        "z": -0.870732,
        "angle": 0,
        "width": 0.083,
        "depth": 0.063269,
        "height": 0.100194,
        "footprintOffset": 0.00324
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2021",
        "model": "maison_paris_03",
        "x": -0.8,
        "z": -0.835,
        "angle": 1.5707963267948966,
        "width": 0.096,
        "depth": 0.067347,
        "height": 0.137351,
        "footprintOffset": 0.003261
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2025",
        "model": "maison_paris_03",
        "x": -0.881176,
        "z": -0.8415,
        "angle": 1.5707963267948966,
        "width": 0.083,
        "depth": 0.058227,
        "height": 0.108132,
        "footprintOffset": 0.002819
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2026",
        "model": "maison_pierre_02",
        "x": -0.88631,
        "z": -1.077,
        "angle": 1.5707963267948966,
        "width": 0.096,
        "depth": 0.068495,
        "height": 0.085072,
        "footprintOffset": 0.00339
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2037",
        "model": "maison_paris_03",
        "x": -0.4055,
        "z": -1.124836,
        "angle": 3.141592653589793,
        "width": 0.109,
        "depth": 0.076466,
        "height": 0.142004,
        "footprintOffset": 0.003703
      },
      {
        "id": "quartier-rue-saint-germain-tissu14-2039",
        "model": "maison_paris_02",
        "x": -0.28025,
        "z": -1.030268,
        "angle": 3.141592653589793,
        "width": 0.102,
        "depth": 0.102946,
        "height": 0.194242,
        "footprintOffset": 0.004679
      }
    ]
  }
];

export const PARIS_SPACES: readonly ParisSpace[] = [
  {
    "id": "passage17-ouest-cathedrale",
    "kind": "court",
    "outline": [
      [
        0.1651335042256945,
        1.7450061151383434
      ],
      [
        0.1236857594955646,
        1.7625299405422328
      ],
      [
        -0.384505177217224,
        0.5605453433684677
      ],
      [
        -0.38410690411046855,
        0.4952346904967313
      ],
      [
        -0.4464138388798526,
        0.34786493145626973
      ],
      [
        -0.42872946779499715,
        0.34038809928394365
      ]
    ]
  },
  {
    "id": "passage17-est-cathedrale",
    "kind": "court",
    "outline": [
      [
        0.6835437885628868,
        -0.12987349088798247
      ],
      [
        0.7249915332930168,
        -0.14739731629187167
      ],
      [
        1.3188545053137088,
        1.2572206995625281
      ],
      [
        1.2774067605835786,
        1.274744524966417
      ]
    ]
  },
  {
    "id": "parvis17-cathedrale",
    "kind": "square",
    "outline": [
      [
        -0.38458953963636217,
        0.17515593915114602
      ],
      [
        0.5434715179209448,
        -0.21722198255905012
      ],
      [
        0.5517847333848054,
        -0.17188005440583398
      ],
      [
        -0.36706571423247303,
        0.21660368388127582
      ]
    ]
  },
  {
    "id": "cour17-cloitre",
    "kind": "garden",
    "outline": [
      [
        -0.5574073716070226,
        0.7422176614997459
      ],
      [
        -0.4606959672367197,
        0.7013287355573378
      ],
      [
        -0.001182323312512057,
        1.7881807084807422
      ],
      [
        -0.09789372768281496,
        1.8290696344231503
      ]
    ]
  },
  {
    "id": "cour17-est",
    "kind": "garden",
    "outline": [
      [
        0.9803147607744914,
        0.13550734876058548
      ],
      [
        1.0862367750848234,
        0.0907242393950907
      ],
      [
        1.5340678687397715,
        1.1499443824984086
      ],
      [
        1.4281458544294396,
        1.1947274918639035
      ]
    ]
  },
  {
    "id": "traverse17-chevet",
    "kind": "court",
    "outline": [
      [
        0.17842457051805066,
        1.7122441317305555
      ],
      [
        1.2630659970558482,
        1.2536650918278887
      ],
      [
        1.2825369141712804,
        1.2997181415280328
      ],
      [
        0.19789548763348314,
        1.7582971814306996
      ]
    ]
  },
  {
    "id": "cour-pont-rive-gauche",
    "kind": "court",
    "outline": [
      [
        -0.734,
        -0.162
      ],
      [
        -0.529,
        -0.122
      ],
      [
        -0.41,
        -0.189
      ],
      [
        -0.659,
        -0.199
      ]
    ]
  },
  {
    "id": "cour-saint-germain",
    "kind": "court",
    "outline": [
      [
        -0.754,
        -0.926
      ],
      [
        -0.468,
        -0.926
      ],
      [
        -0.468,
        -0.974
      ],
      [
        -0.754,
        -0.974
      ]
    ]
  },
  {
    "id": "passage-quai-cloitre",
    "kind": "court",
    "outline": [
      [
        -0.38273522844308827,
        0.44917470539172377
      ],
      [
        -0.4004195995279437,
        0.45665153756404986
      ],
      [
        -0.4517896422699208,
        0.33514996075235803
      ],
      [
        -0.43410527118506537,
        0.32767312858003195
      ]
    ]
  }
];

export const PARIS_STREETS: readonly ParisStreet[] = [
  {
    "id": "venelle17-ouest-cathedrale",
    "width": 0.012,
    "points": [
      [
        -0.4387690326296287,
        0.34463275921510794
      ],
      [
        0.15509393939106297,
        1.7492507750695077
      ]
    ]
  },
  {
    "id": "venelle17-est-cathedrale",
    "width": 0.015,
    "points": [
      [
        0.7019650084429445,
        -0.13766185773415537
      ],
      [
        1.2958279804636363,
        1.2669561581202444
      ]
    ]
  },
  {
    "id": "rue17-chevet",
    "width": 0.016,
    "points": [
      [
        0.18816002907576684,
        1.7352706565806273
      ],
      [
        0.7304807423446655,
        1.505981136629294
      ],
      [
        1.2728014556135645,
        1.2766916166779603
      ]
    ]
  },
  {
    "id": "quai-libraires",
    "quay": true,
    "width": 0.014,
    "points": [
      [
        -0.889,
        0.645
      ],
      [
        -0.761,
        0.555
      ],
      [
        -0.649,
        0.451
      ],
      [
        -0.542124876900025,
        0.32805241415592495
      ],
      [
        -0.41712487690002487,
        0.22105241415592497
      ],
      [
        -0.25,
        0.145
      ]
    ]
  },
  {
    "id": "quai-rive-gauche",
    "quay": true,
    "width": 0.014,
    "points": [
      [
        -0.891,
        0.46
      ],
      [
        -0.702,
        0.312
      ],
      [
        -0.546,
        0.161
      ],
      [
        -0.337,
        0.033
      ],
      [
        -0.165,
        -0.045
      ]
    ]
  },
  {
    "id": "rue-rive-gauche",
    "width": 0.014,
    "points": [
      [
        -0.92,
        -0.09
      ],
      [
        -0.89,
        -0.33
      ],
      [
        -0.45,
        -0.43
      ],
      [
        -0.25,
        -0.2
      ]
    ]
  },
  {
    "id": "rue-saint-germain",
    "width": 0.014,
    "points": [
      [
        -0.94,
        -0.79
      ],
      [
        -0.94,
        -0.98
      ],
      [
        -0.94,
        -1.18
      ],
      [
        -0.41,
        -1.18
      ]
    ]
  },
  {
    "id": "venelle29-cloitre-1",
    "width": 0.009,
    "points": [
      [
        -0.36570835226525017,
        0.9054521124695177
      ],
      [
        -0.22653603607141426,
        0.8466110009466805
      ]
    ]
  },
  {
    "id": "venelle29-cloitre-2",
    "width": 0.009,
    "points": [
      [
        -0.21889763721488895,
        1.2526921072086052
      ],
      [
        -0.07972532102105313,
        1.1938509956857681
      ]
    ]
  },
  {
    "id": "venelle29-cloitre-3",
    "width": 0.009,
    "points": [
      [
        -0.0674139020568239,
        1.6109848338757276
      ],
      [
        0.07175841413701184,
        1.5521437223528904
      ]
    ]
  },
  {
    "id": "venelle29-chevet-1",
    "width": 0.009,
    "points": [
      [
        0.914198005001159,
        0.3643163839974169
      ],
      [
        1.0440676051555657,
        0.3094083977318971
      ]
    ]
  },
  {
    "id": "venelle29-chevet-2",
    "width": 0.009,
    "points": [
      [
        1.0649029034746067,
        0.7207669886765334
      ],
      [
        1.1947725036290135,
        0.6658590024110137
      ]
    ]
  },
  {
    "id": "venelle29-chevet-3",
    "width": 0.009,
    "points": [
      [
        1.2089876901288075,
        1.061559556457601
      ],
      [
        1.3388572902832143,
        1.0066515701920813
      ]
    ]
  },
  {
    "id": "venelle29-rue-haute-1",
    "width": 0.008,
    "points": [
      [
        1.195280704965252,
        0.32039013010642836
      ],
      [
        1.3463347079817252,
        0.2565255219678097
      ]
    ]
  },
  {
    "id": "venelle29-rue-haute-2",
    "width": 0.008,
    "points": [
      [
        1.347932695150243,
        0.6814460397555594
      ],
      [
        1.4989866981667161,
        0.6175814316169407
      ]
    ]
  },
  {
    "id": "venelle29-rue-haute-3",
    "width": 0.008,
    "points": [
      [
        1.5216132758199012,
        1.0922392430808463
      ],
      [
        1.6726672788363743,
        1.0283746349422276
      ]
    ]
  }
];

export const PARIS_TREES: readonly ParisTree[] = [
  {
    "x": -0.755,
    "z": 0.777,
    "height": 0.15,
    "model": "beech"
  },
  {
    "x": -0.788,
    "z": 0.797,
    "height": 0.17,
    "model": "oak"
  },
  {
    "x": -0.819,
    "z": 0.762,
    "height": 0.16,
    "model": "beech"
  },
  {
    "x": -0.48,
    "z": -0.815,
    "height": 0.095,
    "model": "beech"
  },
  {
    "x": -0.507,
    "z": -0.817,
    "height": 0.115,
    "model": "oak"
  },
  {
    "x": -0.61,
    "z": -0.164,
    "height": 0.105,
    "model": "beech"
  },
  {
    "x": -0.4787786114283304,
    "z": 0.7741162206014001,
    "height": 0.17,
    "model": "pine"
  },
  {
    "x": -0.36974147558190823,
    "z": 1.032013298922208,
    "height": 0.23,
    "model": "pine"
  },
  {
    "x": -0.26070433973548607,
    "z": 1.2899103772430156,
    "height": 0.19,
    "model": "pine"
  },
  {
    "x": -0.15166720388906393,
    "z": 1.5478074555638235,
    "height": 0.25,
    "model": "pine"
  },
  {
    "x": -0.05041843488881481,
    "z": 1.7872833140045736,
    "height": 0.18,
    "model": "pine"
  },
  {
    "x": 1.0433667872608374,
    "z": 0.13056346810212419,
    "height": 0.17,
    "model": "cypress"
  },
  {
    "x": 1.1524039231072596,
    "z": 0.388460546422932,
    "height": 0.23,
    "model": "cypress"
  },
  {
    "x": 1.2614410589536817,
    "z": 0.6463576247437398,
    "height": 0.19,
    "model": "cypress"
  },
  {
    "x": 1.370478194800104,
    "z": 0.9042547030645477,
    "height": 0.25,
    "model": "cypress"
  },
  {
    "x": 1.471726963800353,
    "z": 1.143730561505298,
    "height": 0.18,
    "model": "cypress"
  }
];

export const PARIS_LAND_ZONES: readonly ParisSpace[] = [
  {
    "id": "champ-sud-ouest",
    "kind": "field",
    "outline": [
      [
        -1.64,
        -0.7
      ],
      [
        -1.15,
        -0.57
      ],
      [
        -1.15,
        -1.16
      ],
      [
        -1.65,
        -1.12
      ]
    ]
  },
  {
    "id": "bois-cour-ouest",
    "kind": "wood",
    "outline": [
      [
        -1.04,
        0.82
      ],
      [
        -0.91,
        0.85
      ],
      [
        -0.81,
        1.06
      ],
      [
        -1.01,
        1.16
      ],
      [
        -1.2,
        1.04
      ]
    ]
  },
  {
    "id": "bois-rive-sud",
    "kind": "wood",
    "outline": [
      [
        -0.16,
        -0.72
      ],
      [
        0.045,
        -0.77
      ],
      [
        0.055,
        -1.13
      ],
      [
        -0.19,
        -1.1
      ],
      [
        -0.26,
        -0.91
      ]
    ]
  }
];

export function parisBuildingFootprint(building: ParisBuilding, margin = 0): ParisPoint[] {
  const c = Math.cos(building.angle), s = Math.sin(building.angle), w = building.width / 2 + margin, d = building.depth / 2 + margin,
    x = building.x + s * (building.footprintOffset ?? 0), z = building.z + c * (building.footprintOffset ?? 0);
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(([px, pz]) => [x + px * c + pz * s, z - px * s + pz * c]);
}
export function parisBuiltContains(x: number, z: number): boolean {
  return [...PARIS_BLOCKS, ...PARIS_SPACES].some(({ outline }) => {
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[i], b = outline[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  });
}
