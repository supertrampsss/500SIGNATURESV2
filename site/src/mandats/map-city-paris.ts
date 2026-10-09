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

/** A homogeneous monumental scale preserves the sculpted cathedral proportions. */
export const PARIS_CATHEDRAL_SITE = {
  "x": 0.4000000000000001,
  "z": 0.7500000000000002,
  "angle": 3.541592653589793,
  "width": 0.988,
  "depth": 1.526555846879916,
  "height": 1.9894703723125327
};

export const PARIS_BLOCKS: readonly ParisBlock[] = [
  {
    "id": "cloitre17-ouest-interieur",
    "outline": [
      [
        -0.4433460503794312,
        0.5528517326745841
      ],
      [
        -0.29597629133896963,
        0.4905447979052001
      ],
      [
        0.2764686718547466,
        1.8445044590894413
      ],
      [
        0.1290989128142851,
        1.9068113938588251
      ]
    ],
    "buildings": [
      {
        "id": "cloitre17-libraire-0",
        "model": "immeuble_paris_01",
        "x": -0.333902398504494,
        "z": 0.5934360530985797,
        "angle": -1.1707963267948966,
        "width": 0.122,
        "depth": 0.08387499999999999,
        "height": 0.17490576923076923
      },
      {
        "id": "cloitre17-libraire-1",
        "model": "maison_paris_03",
        "x": -0.28133092229282614,
        "z": 0.7177792872889692,
        "angle": -1.1707963267948966,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "cloitre17-libraire-2",
        "model": "maison_pierre_02",
        "x": -0.2287594460811583,
        "z": 0.8421225214793587,
        "angle": -1.1707963267948966,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "cloitre17-libraire-3",
        "model": "maison_paris_01",
        "x": -0.17618796986949048,
        "z": 0.9664657556697482,
        "angle": -1.1707963267948966,
        "width": 0.12,
        "depth": 0.09147368421052632,
        "height": 0.13195221052631578,
        "footprintOffset": 0.004684210526315789
      },
      {
        "id": "cloitre17-libraire-4",
        "model": "hotel_angle_paris_01",
        "x": -0.12361649365782268,
        "z": 1.0908089898601376,
        "angle": -1.1707963267948966,
        "width": 0.113,
        "depth": 0.10275917560700171,
        "height": 0.14475612648221345
      },
      {
        "id": "cloitre17-libraire-5",
        "model": "immeuble_paris_01",
        "x": -0.07104501744615485,
        "z": 1.2151522240505273,
        "angle": -1.1707963267948966,
        "width": 0.122,
        "depth": 0.08387499999999999,
        "height": 0.17490576923076923
      },
      {
        "id": "cloitre17-libraire-6",
        "model": "maison_paris_03",
        "x": -0.018473541234487023,
        "z": 1.3394954582409166,
        "angle": -1.1707963267948966,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "cloitre17-libraire-7",
        "model": "maison_pierre_02",
        "x": 0.03409793497718083,
        "z": 1.4638386924313063,
        "angle": -1.1707963267948966,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "cloitre17-libraire-8",
        "model": "maison_paris_01",
        "x": 0.08666941118884863,
        "z": 1.5881819266216959,
        "angle": -1.1707963267948966,
        "width": 0.12,
        "depth": 0.09147368421052632,
        "height": 0.13195221052631578,
        "footprintOffset": 0.004684210526315789
      },
      {
        "id": "cloitre17-libraire-9",
        "model": "hotel_angle_paris_01",
        "x": 0.1392408874005165,
        "z": 1.7125251608120853,
        "angle": -1.1707963267948966,
        "width": 0.113,
        "depth": 0.10275917560700171,
        "height": 0.14475612648221345
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
        -0.35960468470400136,
        1.418581126697228
      ],
      [
        -0.20302431572351104,
        1.3523800085047575
      ],
      [
        0.06956852389254431,
        1.997122704306777
      ],
      [
        -0.08701184508794602,
        2.063323822499248
      ]
    ],
    "buildings": [
      {
        "id": "cloitre17-jardin-nord-0",
        "model": "immeuble_paris_01",
        "x": -0.2409504228890353,
        "z": 1.455271263698137,
        "angle": 1.9707963267948965,
        "width": 0.122,
        "depth": 0.08387499999999999,
        "height": 0.17490576923076923
      },
      {
        "id": "cloitre17-jardin-nord-1",
        "model": "maison_paris_03",
        "x": -0.1883789466773675,
        "z": 1.5796144978885265,
        "angle": 1.9707963267948965,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "cloitre17-jardin-nord-2",
        "model": "maison_pierre_02",
        "x": -0.13580747046569963,
        "z": 1.703957732078916,
        "angle": 1.9707963267948965,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "cloitre17-jardin-nord-3",
        "model": "maison_paris_01",
        "x": -0.08323599425403183,
        "z": 1.8283009662693055,
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
        0.6909812153379733,
        0.05155176833179981
      ],
      [
        0.8383509743784349,
        -0.01075516643758423
      ],
      [
        1.410795937572151,
        1.3432044947466568
      ],
      [
        1.2634261785316896,
        1.405511429516041
      ]
    ],
    "buildings": [
      {
        "id": "chevet17-atelier-1",
        "model": "maison_paris_03",
        "x": 0.8437857334845494,
        "z": 0.22037350636927133,
        "angle": 1.9707963267948965,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "chevet17-atelier-2",
        "model": "maison_pierre_02",
        "x": 0.8963572096962172,
        "z": 0.34471674055966084,
        "angle": 1.9707963267948965,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "chevet17-atelier-3",
        "model": "maison_paris_01",
        "x": 0.948928685907885,
        "z": 0.46905997475005035,
        "angle": 1.9707963267948965,
        "width": 0.12,
        "depth": 0.09147368421052632,
        "height": 0.13195221052631578,
        "footprintOffset": 0.004684210526315789
      },
      {
        "id": "chevet17-atelier-4",
        "model": "hotel_angle_paris_01",
        "x": 1.001500162119553,
        "z": 0.5934032089404399,
        "angle": 1.9707963267948965,
        "width": 0.113,
        "depth": 0.10275917560700171,
        "height": 0.14475612648221345
      },
      {
        "id": "chevet17-atelier-5",
        "model": "immeuble_paris_01",
        "x": 1.0540716383312208,
        "z": 0.7177464431308294,
        "angle": 1.9707963267948965,
        "width": 0.122,
        "depth": 0.08387499999999999,
        "height": 0.17490576923076923
      },
      {
        "id": "chevet17-atelier-6",
        "model": "maison_paris_03",
        "x": 1.1066431145428886,
        "z": 0.8420896773212188,
        "angle": 1.9707963267948965,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "chevet17-atelier-7",
        "model": "maison_pierre_02",
        "x": 1.1592145907545564,
        "z": 0.9664329115116084,
        "angle": 1.9707963267948965,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "chevet17-atelier-8",
        "model": "maison_paris_01",
        "x": 1.2117860669662242,
        "z": 1.090776145701998,
        "angle": 1.9707963267948965,
        "width": 0.12,
        "depth": 0.09147368421052632,
        "height": 0.13195221052631578,
        "footprintOffset": 0.004684210526315789
      },
      {
        "id": "chevet17-atelier-9",
        "model": "hotel_angle_paris_01",
        "x": 1.264357543177892,
        "z": 1.2151193798923874,
        "angle": 1.9707963267948965,
        "width": 0.113,
        "depth": 0.10275917560700171,
        "height": 0.14475612648221345
      }
    ]
  },
  {
    "id": "chevet17-est-exterieur",
    "outline": [
      [
        0.9732930914326751,
        0.05161970867186805
      ],
      [
        1.1298734604131655,
        -0.014581409520602495
      ],
      [
        1.6789533230683626,
        1.2841145920234656
      ],
      [
        1.5223729540878723,
        1.350315710215936
      ]
    ],
    "buildings": [
      {
        "id": "chevet17-rue-haute-0",
        "model": "immeuble_paris_01",
        "x": 1.0781314383375977,
        "z": 0.09415112080740679,
        "angle": -1.1707963267948966,
        "width": 0.122,
        "depth": 0.08387499999999999,
        "height": 0.17490576923076923
      },
      {
        "id": "chevet17-rue-haute-1",
        "model": "maison_paris_03",
        "x": 1.1307029145492657,
        "z": 0.21849435499779632,
        "angle": -1.1707963267948966,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "chevet17-rue-haute-2",
        "model": "maison_pierre_02",
        "x": 1.1832743907609335,
        "z": 0.3428375891881858,
        "angle": -1.1707963267948966,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "chevet17-rue-haute-3",
        "model": "maison_paris_01",
        "x": 1.2358458669726013,
        "z": 0.4671808233785753,
        "angle": -1.1707963267948966,
        "width": 0.12,
        "depth": 0.09147368421052632,
        "height": 0.13195221052631578,
        "footprintOffset": 0.004684210526315789
      },
      {
        "id": "chevet17-rue-haute-4",
        "model": "hotel_angle_paris_01",
        "x": 1.2884173431842691,
        "z": 0.5915240575689649,
        "angle": -1.1707963267948966,
        "width": 0.113,
        "depth": 0.10275917560700171,
        "height": 0.14475612648221345
      },
      {
        "id": "chevet17-rue-haute-5",
        "model": "immeuble_paris_01",
        "x": 1.340988819395937,
        "z": 0.7158672917593543,
        "angle": -1.1707963267948966,
        "width": 0.122,
        "depth": 0.08387499999999999,
        "height": 0.17490576923076923
      },
      {
        "id": "chevet17-rue-haute-6",
        "model": "maison_paris_03",
        "x": 1.3935602956076047,
        "z": 0.8402105259497438,
        "angle": -1.1707963267948966,
        "width": 0.116,
        "depth": 0.08137709923664121,
        "height": 0.12162892213740457,
        "footprintOffset": 0.0039404580152671755
      },
      {
        "id": "chevet17-rue-haute-7",
        "model": "maison_pierre_02",
        "x": 1.4461317718192725,
        "z": 0.9645537601401333,
        "angle": -1.1707963267948966,
        "width": 0.128,
        "depth": 0.09132698412698413,
        "height": 0.10245546666666666,
        "footprintOffset": 0.004520634920634921
      },
      {
        "id": "chevet17-rue-haute-8",
        "model": "maison_paris_01",
        "x": 1.4987032480309403,
        "z": 1.0888969943305227,
        "angle": -1.1707963267948966,
        "width": 0.12,
        "depth": 0.09147368421052632,
        "height": 0.13195221052631578,
        "footprintOffset": 0.004684210526315789
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
        -0.37917638631764217,
        0.3194373924677385
      ],
      [
        -0.33772864158751226,
        0.3019135670638493
      ],
      [
        0.25613433043317974,
        1.7065315829182488
      ],
      [
        0.21468658570304983,
        1.7240554083221382
      ]
    ]
  },
  {
    "id": "passage17-est-cathedrale",
    "kind": "court",
    "outline": [
      [
        0.5925429623554017,
        -0.09139895866788783
      ],
      [
        0.6339907070855317,
        -0.10892278407177702
      ],
      [
        1.2278536791062238,
        1.2956952317826227
      ],
      [
        1.1864059343760935,
        1.3132190571865117
      ]
    ]
  },
  {
    "id": "parvis17-cathedrale",
    "kind": "square",
    "outline": [
      [
        -0.29358871342887716,
        0.13668140693105146
      ],
      [
        0.4524706917134597,
        -0.17874745033895545
      ],
      [
        0.4607839071773203,
        -0.1334055221857393
      ],
      [
        -0.2760648880249879,
        0.17812915166118115
      ]
    ]
  },
  {
    "id": "cour17-cloitre",
    "kind": "garden",
    "outline": [
      [
        -0.4664065453995375,
        0.7037431292796512
      ],
      [
        -0.3696951410292346,
        0.6628542033372431
      ],
      [
        0.089818502894973,
        1.7497061762606476
      ],
      [
        -0.006892901475329893,
        1.7905951022030557
      ]
    ]
  },
  {
    "id": "cour17-est",
    "kind": "garden",
    "outline": [
      [
        0.8893139345670064,
        0.17398188098068013
      ],
      [
        0.9952359488773382,
        0.12919877161518534
      ],
      [
        1.4430670425322865,
        1.1884189147185031
      ],
      [
        1.3371450282219546,
        1.233202024083998
      ]
    ]
  },
  {
    "id": "traverse17-chevet",
    "kind": "court",
    "outline": [
      [
        0.2694253967255357,
        1.6737695995104607
      ],
      [
        1.1720651708483631,
        1.2921396240479832
      ],
      [
        1.1915360879637955,
        1.3381926737481273
      ],
      [
        0.2888963138409682,
        1.7198226492106048
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
        -0.345,
        0.29
      ],
      [
        -0.258,
        0.254
      ],
      [
        -0.226,
        0.381
      ],
      [
        -0.309,
        0.418
      ]
    ]
  }
];

export const PARIS_STREETS: readonly ParisStreet[] = [
  {
    "id": "venelle17-ouest-cathedrale",
    "width": 0.015,
    "points": [
      [
        -0.35614986146757,
        0.3097019339100222
      ],
      [
        0.237713110553122,
        1.714319949764422
      ]
    ]
  },
  {
    "id": "venelle17-est-cathedrale",
    "width": 0.015,
    "points": [
      [
        0.6109641822354595,
        -0.09918732551406073
      ],
      [
        1.2048271542561513,
        1.305430690340339
      ]
    ]
  },
  {
    "id": "rue17-chevet",
    "width": 0.016,
    "points": [
      [
        0.2791608552832519,
        1.6967961243605325
      ],
      [
        0.7304807423446655,
        1.505981136629294
      ],
      [
        1.1818006294060792,
        1.315166148898055
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
        -0.532,
        0.352
      ],
      [
        -0.407,
        0.245
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
    "x": -0.38777778522084533,
    "z": 0.7356416883813054,
    "height": 0.17,
    "model": "pine"
  },
  {
    "x": -0.27874064937442317,
    "z": 0.9935387667021133,
    "height": 0.23,
    "model": "pine"
  },
  {
    "x": -0.169703513528001,
    "z": 1.251435845022921,
    "height": 0.19,
    "model": "pine"
  },
  {
    "x": -0.06066637768157887,
    "z": 1.509332923343729,
    "height": 0.25,
    "model": "pine"
  },
  {
    "x": 0.04058239131867025,
    "z": 1.748808781784479,
    "height": 0.18,
    "model": "pine"
  },
  {
    "x": 0.9523659610533524,
    "z": 0.16903800032221883,
    "height": 0.17,
    "model": "cypress"
  },
  {
    "x": 1.0614030968997745,
    "z": 0.42693507864302666,
    "height": 0.23,
    "model": "cypress"
  },
  {
    "x": 1.1704402327461967,
    "z": 0.6848321569638345,
    "height": 0.19,
    "model": "cypress"
  },
  {
    "x": 1.2794773685926188,
    "z": 0.9427292352846424,
    "height": 0.25,
    "model": "cypress"
  },
  {
    "x": 1.3807261375928679,
    "z": 1.1822050937253925,
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
