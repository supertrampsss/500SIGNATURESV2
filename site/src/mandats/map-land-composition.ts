/** Composed valley parcels and connected woodland groups, surveyed against the reference. */
export type NationalCompositionPoint = readonly [number, number];
export type NationalField = {
  id: string;
  region: "bretagne" | "loire" | "centre" | "sud-ouest" | "garonne" | "rhone" | "est";
  outline: readonly NationalCompositionPoint[];
  angle: number;
  /** Optional centreline for curved raised crop rows, in the same source frame as outline. */
  rowGuide?: readonly NationalCompositionPoint[];
  kind: "wheat" | "pasture" | "vines";
  color: string;
  hedgedEdges?: readonly number[];
  /** Small companion plots fill the authored valley between larger parcels. */
  infill?: boolean;
  /** Keep other basins' colour sequences stable when a composed sector replaces its grid. */
  paletteSlot?: number;
  /** A composed green/gold pan uses its authored tone directly. */
  composedPalette?: boolean;
};
export type NationalWood = {
  id: string;
  outline: readonly NationalCompositionPoint[];
  trees: number;
  geographic?: boolean;
  minHeight?: number;
  maxHeight?: number;
  maxSlope?: number;
  minSpacing?: number;
  species?: "pine";
  /** Centre x/z (or lon/lat), radii in world units. Groups join within the outline. */
  groups?: readonly (readonly [number, number, number, number])[];
};

/** Two continuous source-frame landforms own the contour fields and their wooded crests. */
export type CultivatedCoteau = {
  id: "touraine" | "berry" | "lorraine";
  spine: readonly NationalCompositionPoint[];
  section: readonly NationalCompositionPoint[];
};
export const TOURAINE_BERRY_COTEAUX: readonly CultivatedCoteau[] = [
  { id: "touraine", spine: [[-2.60,.73],[-2.05,.84],[-1.46,.75],[-.88,.60],[-.19,.66]],
    section: [[-.76,0],[-.58,.025],[-.34,.115],[-.10,.245],[.10,.285],[.32,.230],[.59,.055],[.82,0]] },
  { id: "berry", spine: [[-1.47,-.30],[-.92,-.35],[-.30,-.45],[.36,-.37],[.97,-.27],[1.56,-.39]],
    section: [[-.79,0],[-.58,.030],[-.35,.120],[-.11,.245],[.09,.290],[.32,.225],[.60,.050],[.83,0]] },
];
// The north-east sector is separate from the two unchanged Touraine/Berry surveys.
export const LORRAINE_COTEAUX: readonly CultivatedCoteau[] = [
  { id: "lorraine", spine: [[1.65,2.45],[2.13,2.38],[2.65,2.47],[3.13,2.37],[3.52,2.26]],
    section: [[-.78,0],[-.56,.035],[-.32,.120],[-.09,.225],[.11,.255],[.31,.205],[.58,.065],[.82,0]] },
];
export const COMPOSED_COTEAUX = [...TOURAINE_BERRY_COTEAUX, ...LORRAINE_COTEAUX];
export function coteauSourceZ(coteau: CultivatedCoteau, x: number) {
  const points = coteau.spine;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (x > b[0]) continue;
    const t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0]))),
      previous = points[Math.max(0, i - 2)], next = points[Math.min(points.length - 1, i + 1)],
      m0 = (b[1] - previous[1]) / (b[0] - previous[0]),
      m1 = (next[1] - a[1]) / (next[0] - a[0]), span = b[0] - a[0],
      t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a[1] + (t3 - 2 * t2 + t) * span * m0 +
      (-2 * t3 + 3 * t2) * b[1] + (t3 - t2) * span * m1;
  }
  return points[points.length - 1][1];
}
export function coteauContour(coteau: CultivatedCoteau, offset: number,
  start = coteau.spine[0][0], end = coteau.spine[coteau.spine.length - 1][0]) {
  const divisions = Math.max(1, Math.ceil((end - start) / .045));
  return Array.from({ length: divisions + 1 }, (_, i): NationalCompositionPoint => {
    const x = start + (end - start) * i / divisions;
    return [x, coteauSourceZ(coteau, x) + offset];
  });
}
function coteauField(id: string, region: NationalField["region"], coteauIndex: number,
  start: number, end: number, low: number, high: number, kind: NationalField["kind"], color: string): NationalField {
  const coteau = COMPOSED_COTEAUX[coteauIndex],
    lower = coteauContour(coteau, low, start, end),
    upper = coteauContour(coteau, high, start + .035, end - .055);
  return { id, region, kind, color, angle: 0, composedPalette: true,
    outline: [...lower, ...upper.reverse()],
    rowGuide: kind === "pasture" ? undefined : coteauContour(coteau, (low + high) / 2, start, end) };
}
function coteauWood(id: string, coteauIndex: number, low: number, high: number, trees: number): NationalWood {
  const coteau = COMPOSED_COTEAUX[coteauIndex],
    start = coteau.spine[0][0] + .20, end = coteau.spine[coteau.spine.length - 1][0] - .20,
    lower = coteauContour(coteau, low, start, end), upper = coteauContour(coteau, high, start, end),
    groups = coteauContour(coteau, (low + high) / 2, start + .10, end - .10)
      .filter((_, index) => index % 6 === 0).map(([x, z]): readonly [number, number, number, number] =>
        [x, z, .20, (high - low) * .55]);
  return { id, trees, outline: [...lower, ...upper.reverse()], groups, maxSlope: .62 };
}

function lorraineField(id: string, start: number, end: number, low: number, high: number,
  kind: NationalField["kind"], color: string): NationalField {
  return { ...coteauField(id, "est", 2, start, end, low, high, kind, color), composedPalette: true };
}
function lorraineBosquet(id: string, start: number, end: number,
  low: number, high: number, trees: number): NationalWood {
  const coteau = LORRAINE_COTEAUX[0], lower = coteauContour(coteau, low, start, end),
    upper = coteauContour(coteau, high, start + .03, end - .02),
    middle = (low + high) / 2,
    groups = [.22, .50, .78].map((t): readonly [number, number, number, number] => {
      const x = start + (end - start) * t;
      return [x, coteauSourceZ(coteau, x) + middle, (end - start) * .25, (high - low) * .53];
    });
  return { id, trees, outline: [...lower, ...upper.reverse()], groups, maxSlope: .62 };
}

export const NATIONAL_FIELDS: readonly NationalField[] = [
  {
    id: "bretagne-cereales-ouest",
    region: "bretagne",
    outline: [
      [-4.8993, 2.0281],
      [-4.8908, 2.0073],
      [-4.8116, 2.0001],
      [-4.7144, 2.01],
      [-4.2403, 2.0739],
      [-4.1418, 2.0915],
      [-4.0553, 2.1276],
      [-4.049, 2.1492],
      [-4.0997, 2.2363],
      [-4.2066, 2.2395],
      [-4.7649, 2.171],
      [-4.8684, 2.1394],
    ],
    angle: 0.1221,
    kind: "wheat",
    color: "#EAC153",
  },
  {
    id: "bretagne-patures-littorales",
    region: "bretagne",
    outline: [
      [-4.8692, 1.675],
      [-4.7775, 1.6388],
      [-4.2159, 1.5472],
      [-4.1102, 1.5519],
      [-4.0701, 1.6703],
      [-4.1618, 1.7065],
      [-4.7239, 1.7943],
      [-4.8296, 1.7896],
    ],
    angle: 2.9798,
    kind: "pasture",
    color: "#9FAC59",
  },
  {
    id: "bretagne-cereales-est",
    region: "bretagne",
    outline: [
      [-3.7228, 1.948],
      [-3.7095, 1.9327],
      [-3.6354, 1.9224],
      [-3.5327, 1.9395],
      [-3.0222, 2.0468],
      [-2.9395, 2.0811],
      [-2.9793, 2.1694],
      [-3.0823, 2.1659],
      [-3.6288, 2.0574],
      [-3.7245, 2.0248],
    ],
    angle: 0.196,
    kind: "wheat",
    color: "#F2C85A",
  },
  {
    id: "bretagne-patures-sud",
    region: "bretagne",
    outline: [
      [-3.7014, 1.1694],
      [-3.6093, 1.1588],
      [-3.0937, 1.165],
      [-2.991, 1.1745],
      [-2.9217, 1.2225],
      [-2.9152, 1.2433],
      [-2.9476, 1.3141],
      [-3.0397, 1.325],
      [-3.5315, 1.3158],
      [-3.6301, 1.3055],
      [-3.6994, 1.2563],
      [-3.71, 1.236],
    ],
    angle: 0.012,
    kind: "pasture",
    color: "#8EA149",
  },
  {
    id: "bretagne-cereales-interieures",
    region: "bretagne",
    outline: [
      [-3.9308, 1.5178],
      [-3.9228, 1.4957],
      [-3.8421, 1.4855],
      [-3.7426, 1.4926],
      [-3.2569, 1.5433],
      [-3.1559, 1.5583],
      [-3.0666, 1.5931],
      [-3.0595, 1.6155],
      [-3.1087, 1.7081],
      [-3.2178, 1.7152],
      [-3.7896, 1.6625],
      [-3.8962, 1.633],
    ],
    angle: 0.0918,
    kind: "wheat",
    color: "#E7BB49",
  },
  {
    id: "loire-grandes-cultures-ouest",
    region: "loire",
    outline: [
      [-2.9605, 1.5412],
      [-2.9502, 1.5192],
      [-2.8705, 1.4844],
      [-2.7504, 1.4729],
      [-2.1464, 1.4417],
      [-2.0434, 1.4565],
      [-2.0614, 1.5721],
      [-2.1777, 1.5996],
      [-2.8222, 1.6404],
      [-2.9391, 1.6316],
    ],
    angle: 3.0784,
    rowGuide: [[-2.99, 1.595], [-2.69, 1.582], [-2.35, 1.518], [-2.01, 1.511]],
    kind: "wheat",
    color: "#F1C450",
  },
  {
    id: "loire-patures-nord",
    region: "loire",
    outline: [
      [-2.7994, 0.9182],
      [-2.7014, 0.9175],
      [-2.1418, 1.02],
      [-2.0432, 1.0572],
      [-2.0416, 1.1664],
      [-2.1395, 1.1671],
      [-2.6985, 1.0613],
      [-2.7971, 1.0241],
    ],
    angle: 0.181,
    kind: "pasture",
    color: "#AFB56A",
  },
  {
    id: "loire-cereales-basse-vallee",
    region: "loire",
    outline: [
      [-2.9221, 0.5546],
      [-2.822, 0.53],
      [-2.252, 0.4604],
      [-2.1372, 0.4551],
      [-2.0539, 0.4946],
      [-2.0437, 0.5152],
      [-2.0694, 0.5934],
      [-2.1695, 0.6182],
      [-2.7137, 0.6812],
      [-2.8239, 0.6851],
      [-2.9074, 0.6444],
      [-2.9221, 0.6249],
    ],
    angle: 3.02,
    rowGuide: [[-2.96, 0.613], [-2.67, 0.613], [-2.35, 0.554], [-2.0, 0.536]],
    kind: "wheat",
    color: "#E7BC56",
  },
  coteauField("loire-grandes-cultures-est", "loire", 0, -2.23, -0.63, 0.055, 0.275, "wheat", "#D6B454"),
  coteauField("loire-patures-meandre", "loire", 0, -2.06, -0.43, -0.155, 0.025, "pasture", "#87A24B"),
  {
    id: "centre-cereales-nord-ouest",
    region: "centre",
    outline: [
      [-0.3584, 0.5362],
      [-0.3484, 0.5138],
      [-0.2576, 0.5082],
      [-0.1465, 0.522],
      [0.3952, 0.6059],
      [0.5077, 0.6281],
      [0.6061, 0.6701],
      [0.613, 0.6939],
      [0.5538, 0.7874],
      [0.4313, 0.7878],
      [-0.2066, 0.6963],
      [-0.3246, 0.6587],
    ],
    angle: 0.1425,
    kind: "wheat",
    color: "#EFC459",
  },
  {
    id: "centre-patures-nord-est",
    region: "centre",
    outline: [
      [0.8541, 0.7687],
      [0.944, 0.739],
      [1.4608, 0.6334],
      [1.5654, 0.6201],
      [1.6445, 0.6499],
      [1.6553, 0.6679],
      [1.6375, 0.7409],
      [1.5477, 0.7709],
      [1.0542, 0.8685],
      [0.9535, 0.8802],
      [0.8742, 0.8493],
      [0.8593, 0.8326],
    ],
    angle: 2.9402,
    kind: "pasture",
    color: "#829A43",
  },
  coteauField("centre-cereales-ouest", "centre", 1, -0.71, 0.96, 0.1, 0.31, "wheat", "#D9B752"),
  {
    id: "centre-cereales-est",
    region: "centre",
    outline: [
      [0.6327, 0.118],
      [0.7543, 0.106],
      [1.4632, 0.1641],
      [1.5906, 0.1972],
      [1.6068, 0.3277],
      [1.4852, 0.3397],
      [0.7767, 0.2775],
      [0.6493, 0.2444],
    ],
    angle: 0.0818,
    kind: "wheat",
    color: "#F3CA5B",
  },
  coteauField("centre-patures-sud", "centre", 1, -0.5, 1.3, -0.18, 0.025, "pasture", "#86A047"),
  {
    id: "sud-ouest-patures-nord",
    region: "sud-ouest",
    outline: [
      [-2.1168, -1.0619],
      [-1.997, -1.0965],
      [-1.2757, -1.161],
      [-1.1421, -1.1484],
      [-1.1028, -1.0121],
      [-1.2226, -0.9775],
      [-1.9442, -0.9173],
      [-2.0778, -0.9299],
    ],
    angle: 3.0523,
    kind: "pasture",
    color: "#9FAC59",
  },
  {
    id: "sud-ouest-cereales-centrales",
    region: "sud-ouest",
    outline: [
      [-1.8824, -1.6341],
      [-1.872, -1.6563],
      [-1.7852, -1.6598],
      [-1.6796, -1.6436],
      [-1.1651, -1.548],
      [-1.0585, -1.5234],
      [-0.966, -1.4792],
      [-0.9603, -1.4553],
      [-1.0203, -1.3633],
      [-1.1373, -1.3656],
      [-1.7434, -1.471],
      [-1.8547, -1.5111],
    ],
    angle: 0.1722,
    kind: "wheat",
    color: "#EEC057",
  },
  {
    id: "sud-ouest-cereales-ouest",
    region: "sud-ouest",
    outline: [
      [-2.3047, -1.9044],
      [-2.297, -1.9286],
      [-2.2274, -1.9686],
      [-2.1198, -1.9848],
      [-1.5767, -2.0369],
      [-1.4827, -2.024],
      [-1.4908, -1.8982],
      [-1.5939, -1.8649],
      [-2.1728, -1.8012],
      [-2.279, -1.8071],
    ],
    angle: 3.0319,
    kind: "wheat",
    color: "#E2BA4F",
  },
  {
    id: "sud-ouest-vignes-est",
    region: "sud-ouest",
    outline: [
      [-1.3309, -2.0519],
      [-1.2669, -2.082],
      [-0.8924, -2.1999],
      [-0.8156, -2.2169],
      [-0.7535, -2.196],
      [-0.7436, -2.1813],
      [-0.7493, -2.1185],
      [-0.8132, -2.0881],
      [-1.1712, -1.9783],
      [-1.2451, -1.9628],
      [-1.3075, -1.9847],
      [-1.3204, -1.998],
    ],
    angle: 2.8368,
    kind: "vines",
    color: "#D7B04D",
  },
  {
    id: "sud-ouest-vignes-sud",
    region: "sud-ouest",
    outline: [
      [-2.2627, -2.5158],
      [-2.1459, -2.5349],
      [-1.4611, -2.5078],
      [-1.3373, -2.4784],
      [-1.3177, -2.3381],
      [-1.4345, -2.319],
      [-2.119, -2.3505],
      [-2.2428, -2.3799],
    ],
    angle: 0.0396,
    kind: "vines",
    color: "#E3B852",
  },
  {
    id: "garonne-vignes-vallee",
    region: "garonne",
    outline: [
      [-0.9617, -2.612],
      [-0.9544, -2.6343],
      [-0.8695, -2.6483],
      [-0.7637, -2.6459],
      [-0.2462, -2.618],
      [-0.1383, -2.6078],
      [-0.0417, -2.5772],
      [-0.033, -2.5551],
      [-0.08, -2.4603],
      [-0.1952, -2.4482],
      [-0.8039, -2.474],
      [-0.9185, -2.4985],
    ],
    angle: 0.0423,
    kind: "vines",
    color: "#DFB552",
  },
  {
    id: "garonne-cereales-nord",
    region: "garonne",
    outline: [
      [-0.5775, -2.0433],
      [-0.5677, -2.0668],
      [-0.4851, -2.1073],
      [-0.3587, -2.1259],
      [0.2783, -2.191],
      [0.3879, -2.1811],
      [0.3749, -2.0597],
      [0.2532, -2.0248],
      [-0.4261, -1.9474],
      [-0.5502, -1.9502],
    ],
    angle: 3.0282,
    kind: "wheat",
    color: "#F2C65B",
  },
  {
    id: "garonne-cereales-sud-ouest",
    region: "garonne",
    outline: [
      [-1.2776, -3.0886],
      [-1.1679, -3.1073],
      [-0.5215, -3.0938],
      [-0.4041, -3.0697],
      [-0.3825, -2.946],
      [-0.4923, -2.9273],
      [-1.1386, -2.9446],
      [-1.2559, -2.9687],
    ],
    angle: 0.0208,
    kind: "wheat",
    color: "#E9BC4D",
  },
  {
    id: "garonne-patures-sud-est",
    region: "garonne",
    outline: [
      [-0.234, -2.9186],
      [-0.1472, -2.9412],
      [0.347, -3.0027],
      [0.4466, -3.0068],
      [0.5193, -2.9683],
      [0.5283, -2.9485],
      [0.5067, -2.8741],
      [0.42, -2.8513],
      [-0.0519, -2.7958],
      [-0.1476, -2.793],
      [-0.2204, -2.8327],
      [-0.2333, -2.8515],
    ],
    angle: 3.0178,
    kind: "pasture",
    color: "#8EA149",
  },
  {
    id: "rhone-patures-nord",
    region: "rhone",
    outline: [
      [1.6101, -1.0675],
      [1.616, -1.0896],
      [1.6821, -1.1328],
      [1.7877, -1.1594],
      [2.3223, -1.2677],
      [2.4164, -1.2672],
      [2.4174, -1.1556],
      [2.3176, -1.1145],
      [1.7482, -0.9918],
      [1.6425, -0.9848],
    ],
    angle: 2.9293,
    kind: "pasture",
    color: "#AFB56A",
  },
  {
    id: "rhone-cereales-vallee",
    region: "rhone",
    outline: [
      [1.5856, -1.7881],
      [1.5963, -1.8103],
      [1.6871, -1.813],
      [1.7977, -1.7959],
      [2.3366, -1.6958],
      [2.4484, -1.6703],
      [2.5456, -1.6253],
      [2.5517, -1.6013],
      [2.4898, -1.5097],
      [2.3673, -1.513],
      [1.7325, -1.6236],
      [1.6157, -1.6647],
    ],
    angle: 0.1724,
    rowGuide: [[1.54, -1.719], [1.85, -1.723], [2.18, -1.617], [2.6, -1.57]],
    kind: "wheat",
    color: "#EDC55B",
  },
  {
    id: "rhone-vignes-centrales",
    region: "rhone",
    outline: [
      [1.5533, -2.1322],
      [1.6608, -2.1689],
      [2.2796, -2.3016],
      [2.405, -2.3189],
      [2.5003, -2.2845],
      [2.5134, -2.2632],
      [2.4928, -2.176],
      [2.3853, -2.1391],
      [1.7943, -2.0161],
      [1.6737, -2.0008],
      [1.5782, -2.0366],
      [1.5602, -2.0562],
    ],
    angle: 2.9303,
    rowGuide: [[1.5, -2.085], [1.83, -2.082], [2.17, -2.234], [2.56, -2.211]],
    kind: "vines",
    color: "#D9AD55",
  },
  {
    id: "rhone-vignes-sud",
    region: "rhone",
    outline: [
      [1.5464, -2.6262],
      [1.645, -2.6433],
      [2.2269, -2.6366],
      [2.3327, -2.6165],
      [2.3534, -2.5091],
      [2.2548, -2.492],
      [1.6731, -2.5021],
      [1.5672, -2.5221],
    ],
    angle: 0.0116,
    rowGuide: [[1.49, -2.581], [1.79, -2.584], [2.1, -2.553], [2.39, -2.548]],
    kind: "vines",
    color: "#E4B754",
  },
  {
    id: "poitou-prairie-nord",
    region: "loire",
    kind: "pasture",
    color: "#A2B363",
    angle: 0.0713,
    outline: [
      [-2.5437, 0.1018],
      [-2.4317, 0.0892],
      [-1.7784, 0.1419],
      [-1.6598, 0.172],
      [-1.6379, 0.2905],
      [-1.75, 0.303],
      [-2.41, 0.2558],
      [-2.5286, 0.2258],
    ],
    hedgedEdges: [1, 5],
  },
  {
    id: "poitou-ble-nord",
    region: "loire",
    kind: "wheat",
    color: "#E5BB5B",
    angle: 3.0876,
    outline: [
      [-2.3418, -0.2586],
      [-2.2162, -0.2903],
      [-1.4687, -0.3307],
      [-1.3353, -0.3141],
      [-1.3232, -0.1792],
      [-1.4489, -0.1474],
      [-2.1762, -0.1016],
      [-2.3097, -0.1182],
    ],
  },
  {
    id: "poitou-bocage-ouest",
    region: "sud-ouest",
    kind: "pasture",
    color: "#829A43",
    angle: 0.0918,
    outline: [
      [-2.4305, -0.7431],
      [-2.3457, -0.7596],
      [-1.834, -0.7125],
      [-1.7389, -0.6804],
      [-1.7096, -0.5448],
      [-1.7943, -0.5282],
      [-2.306, -0.5697],
      [-2.401, -0.6018],
    ],
    hedgedEdges: [3, 5],
  },
  {
    id: "poitou-cereales-est",
    region: "centre",
    kind: "wheat",
    color: "#E8C060",
    angle: 3.0217,
    outline: [
      [-1.3521, -0.7272],
      [-1.2603, -0.7656],
      [-0.7014, -0.833],
      [-0.6014, -0.8211],
      [-0.5912, -0.686],
      [-0.6829, -0.6475],
      [-1.2153, -0.5638],
      [-1.3153, -0.5757],
    ],
  },
  coteauField("berry-prairie-ouest", "centre", 1, -1.25, -0.53, -0.31, -0.13, "pasture", "#9BB05B"),
  coteauField("berry-ble-central", "centre", 1, -0.49, 0.93, -0.435, -0.205, "wheat", "#D0AD4D"),
  {
    id: "limousin-prairie-nord",
    region: "centre",
    kind: "pasture",
    color: "#9FAC59",
    angle: 3.0298,
    outline: [
      [-0.4946, -1.0359],
      [-0.3805, -1.0707],
      [0.2655, -1.122],
      [0.3808, -1.1092],
      [0.3916, -0.9855],
      [0.2775, -0.9507],
      [-0.3824, -0.8766],
      [-0.4978, -0.8894],
    ],
    hedgedEdges: [1, 5],
  },
  {
    id: "limousin-ble-sud",
    region: "centre",
    kind: "wheat",
    color: "#DCB75D",
    angle: 0.0945,
    outline: [
      [-0.4037, -1.5215],
      [-0.2905, -1.5296],
      [0.3359, -1.4636],
      [0.4451, -1.4332],
      [0.4404, -1.3262],
      [0.3272, -1.3181],
      [-0.3126, -1.3787],
      [-0.4218, -1.4091],
    ],
  },
  {
    id: "limousin-prairie-est",
    region: "centre",
    kind: "pasture",
    color: "#8EA149",
    angle: 2.9442,
    outline: [
      [0.7635, -1.3125],
      [0.833, -1.3505],
      [1.2705, -1.4324],
      [1.3547, -1.4242],
      [1.3966, -1.2953],
      [1.3271, -1.2573],
      [0.8894, -1.1698],
      [0.8052, -1.178],
    ],
    hedgedEdges: [3],
  },
  {
    id: "perigord-prairie-est",
    region: "sud-ouest",
    kind: "pasture",
    color: "#AFB56A",
    angle: 0.1144,
    outline: [
      [-0.6211, -1.8158],
      [-0.5174, -1.8217],
      [0.0416, -1.7549],
      [0.139, -1.7254],
      [0.1345, -1.624],
      [0.0308, -1.618],
      [-0.555, -1.6853],
      [-0.6524, -1.7149],
    ],
    hedgedEdges: [1],
  },
  {
    id: "quercy-ble-est",
    region: "garonne",
    kind: "wheat",
    color: "#E5BE62",
    angle: 3.0693,
    outline: [
      [0.5983, -2.1325],
      [0.6755, -2.1611],
      [1.1401, -2.1947],
      [1.225, -2.1789],
      [1.2434, -2.0553],
      [1.1662, -2.0267],
      [0.7082, -1.9875],
      [0.6233, -2.0033],
    ],
  },
  {
    id: "quercy-prairie-sud",
    region: "garonne",
    kind: "pasture",
    color: "#A2B363",
    angle: 0.0959,
    outline: [
      [0.7033, -2.5688],
      [0.7668, -2.5836],
      [1.0969, -2.5446],
      [1.1529, -2.517],
      [1.1417, -2.3989],
      [1.0782, -2.3841],
      [0.7281, -2.4177],
      [0.672, -2.4453],
    ],
    hedgedEdges: [3, 5],
  },
  {
    id: "lorraine-ble-nord",
    region: "est",
    kind: "wheat",
    color: "#E5BC61",
    angle: 0.1049,
    outline: [
      [2.0293, 3.1682],
      [2.1141, 3.1578],
      [2.6259, 3.2117],
      [2.7198, 3.243],
      [2.7425, 3.3673],
      [2.6577, 3.3778],
      [2.1524, 3.3127],
      [2.0585, 3.2814],
    ],
  },
  lorraineField("lorraine-prairie-ouest", 1.89, 2.49, 0.025, 0.235, "pasture", "#7A9844"),
  lorraineField("lorraine-ble-central", 2.53, 3.3, 0.265, 0.525, "wheat", "#DDBA56"),
  lorraineField("lorraine-prairie-est", 2.58, 3.31, 0.025, 0.235, "pasture", "#86A14B"),
  {
    id: "bourgogne-ble-nord",
    region: "est",
    kind: "wheat",
    color: "#DDB756",
    angle: 0.1107,
    outline: [
      [1.981, 1.8143],
      [2.0457, 1.8026],
      [2.4093, 1.843],
      [2.4701, 1.8688],
      [2.4522, 1.9756],
      [2.3876, 1.9873],
      [2.0374, 1.9471],
      [1.9766, 1.9213],
    ],
  },
  {
    id: "bourgogne-prairie-centre",
    region: "est",
    kind: "pasture",
    color: "#9FAC59",
    angle: 3.0022,
    outline: [
      [1.9123, 1.3006],
      [1.9756, 1.2704],
      [2.3523, 1.2336],
      [2.4226, 1.2479],
      [2.4462, 1.3658],
      [2.383, 1.396],
      [1.9991, 1.4499],
      [1.9288, 1.4356],
    ],
    hedgedEdges: [1, 5],
  },
  {
    id: "bourgogne-ble-est",
    region: "est",
    kind: "wheat",
    color: "#E6BC65",
    angle: 3.0353,
    outline: [
      [2.6916, 1.1752],
      [2.7761, 1.1441],
      [3.2811, 1.0902],
      [3.3741, 1.1034],
      [3.3983, 1.2326],
      [3.3139, 1.2638],
      [2.8089, 1.312],
      [2.7159, 1.2988],
    ],
  },
  {
    id: "bourgogne-prairie-sud",
    region: "est",
    kind: "pasture",
    color: "#8EA149",
    angle: 0.1355,
    outline: [
      [2.2829, 0.6712],
      [2.3639, 0.6611],
      [2.8084, 0.7218],
      [2.8824, 0.7551],
      [2.8589, 0.8843],
      [2.7778, 0.8944],
      [2.3398, 0.8227],
      [2.2659, 0.7893],
    ],
    hedgedEdges: [3],
  },
  {
    id: "bourgogne-vignes-sud",
    region: "est",
    kind: "vines",
    color: "#CEA960",
    angle: 2.99,
    outline: [
      [2.3326, 0.2661],
      [2.4125, 0.2314],
      [2.8972, 0.163],
      [2.9876, 0.1726],
      [3.0175, 0.2961],
      [2.9376, 0.3308],
      [2.4527, 0.4049],
      [2.3623, 0.3952],
    ],
  },
  {
    id: "rhone-prairie-contreforts",
    region: "rhone",
    kind: "pasture",
    color: "#AFB56A",
    angle: 0.095,
    outline: [
      [1.5817, -0.5994],
      [1.6522, -0.6141],
      [2.0765, -0.5737],
      [2.1526, -0.5448],
      [2.1616, -0.4207],
      [2.091, -0.406],
      [1.6802, -0.4462],
      [1.6041, -0.4751],
    ],
    hedgedEdges: [1],
  },
  {
    id: "poitou-prairie-clairiere",
    region: "loire",
    kind: "pasture",
    color: "#A2B363",
    angle: 0.19,
    outline: [
      [-2.6212, -0.4477],
      [-2.5779, -0.4778],
      [-2.3561, -0.4377],
      [-2.1929, -0.3852],
      [-2.1756, -0.3289],
      [-2.2487, -0.29],
      [-2.4574, -0.3249],
      [-2.6239, -0.3847],
    ],
  },
  lorraineField("lorraine-prairie-replat", 1.89, 2.57, -0.385, -0.14, "pasture", "#91A854"),
  lorraineField("lorraine-ble-versant", 2.63, 3.3, -0.405, -0.135, "wheat", "#D5B351"),
  {
    id: "bretagne-prairie-pointe",
    region: "bretagne",
    kind: "pasture",
    color: "#B5BE73",
    angle: 0.18,
    outline: [
      [-4.436, 2.3564],
      [-4.387, 2.324],
      [-4.131, 2.3678],
      [-3.942, 2.4249],
      [-3.9208, 2.4857],
      [-4.0038, 2.5275],
      [-4.2447, 2.4894],
      [-4.4376, 2.4244],
    ],
  },
  {
    id: "bretagne-ble-pointe",
    region: "bretagne",
    kind: "wheat",
    color: "#E7BE5D",
    angle: -0.23,
    outline: [
      [-3.7988, 2.3652],
      [-3.7669, 2.319],
      [-3.5194, 2.2584],
      [-3.3273, 2.2348],
      [-3.2851, 2.2783],
      [-3.3441, 2.3455],
      [-3.5758, 2.4051],
      [-3.7744, 2.4236],
    ],
  },
  coteauField("touraine-ble-versant", "loire", 0, -2.31, -0.74, -0.435, -0.18, "wheat", "#DFBB59"),
  coteauField("touraine-vignes-occidentales", "loire", 0, -2.25, -1.55, 0.31, 0.55, "vines", "#89A045"),
  coteauField("touraine-prairie-orientale", "loire", 0, -1.48, -0.45, 0.31, 0.55, "pasture", "#7F9B43"),
  coteauField("berry-vignes-orientales", "centre", 1, 0.985, 1.39, -0.37, -0.15, "vines", "#829A46"),
  coteauField("berry-ble-haut-coteau", "centre", 1, -0.74, 1.12, 0.34, 0.555, "wheat", "#D7B052"),
  lorraineField("lorraine-ble-occidental", 1.89, 2.48, 0.265, 0.525, "wheat", "#E0BE5A"),
  lorraineField("lorraine-prairie-de-crete", 1.89, 3.3, -0.095, 0.005, "pasture", "#8CA54C"),
];

// Named cultivated basins join the miniature's settlements. Each basin has its
// own direction and staggered field ends; these are long, narrow strips rather
// than an undirected patchwork over the whole country. Actual urban, woodland,
// mineral, coast and river surveys clip their rendered surfaces.
const VALLEY_CROPS: readonly {
  id: string; region: NationalField["region"]; x: number; z: number;
  length: number; width: number; angle: number; columns: number; rows: number;
}[] = [
  { id: "flandres", region: "est", x: .48, z: 4.14, length: 1.86, width: 1.18, angle: -.10, columns: 4, rows: 7 },
  { id: "artois", region: "est", x: -.39, z: 3.39, length: 1.58, width: .68, angle: .13, columns: 3, rows: 4 },
  { id: "normandie", region: "loire", x: -1.74, z: 2.77, length: 2.35, width: .82, angle: -.17, columns: 4, rows: 5 },
  { id: "maine", region: "loire", x: -2.17, z: 1.95, length: 1.32, width: .62, angle: .18, columns: 3, rows: 4 },
  { id: "champagne", region: "est", x: 1.54, z: 2.70, length: 1.73, width: 1.18, angle: .21, columns: 4, rows: 7 },
  { id: "lorraine", region: "est", x: 2.83, z: 1.54, length: 1.22, width: 1.32, angle: -.23, columns: 3, rows: 7 },
  { id: "bretagne-nord", region: "bretagne", x: -4.09, z: 2.12, length: 2.20, width: .48, angle: .12, columns: 4, rows: 3 },
  { id: "touraine", region: "loire", x: -1.28, z: .47, length: 1.91, width: .74, angle: .02, columns: 4, rows: 4 },
  { id: "berry", region: "centre", x: .28, z: -.44, length: 2.01, width: .92, angle: -.10, columns: 4, rows: 5 },
  { id: "poitou", region: "sud-ouest", x: -1.59, z: -.53, length: 1.50, width: .88, angle: .16, columns: 3, rows: 5 },
  { id: "limousin", region: "centre", x: -.57, z: -1.33, length: 1.56, width: .66, angle: -.16, columns: 3, rows: 4 },
  { id: "aquitaine", region: "sud-ouest", x: -1.91, z: -1.89, length: 1.28, width: .81, angle: -.21, columns: 3, rows: 5 },
  { id: "garonne", region: "garonne", x: -.67, z: -2.47, length: 2.41, width: .87, angle: .12, columns: 5, rows: 5 },
  { id: "rhone", region: "rhone", x: 1.42, z: -1.49, length: 1.71, width: .72, angle: 1.35, columns: 4, rows: 4 },
  { id: "provence", region: "rhone", x: 2.05, z: -2.72, length: 1.48, width: .63, angle: .10, columns: 3, rows: 4 },
];

// Neighbouring plots form a crop family within each valley. The authored
// sequences give bocage, cereal plains and vineyards distinct visible patterns.
const VALLEY_MIX: Readonly<Record<string, readonly string[]>> = {
  flandres: ["WWPP", "WWWP", "PPWW", "WPWW", "PWWW", "WWPP", "WPWP"],
  artois: ["WWP", "WPW", "PWW", "WPP"],
  normandie: ["PPWW", "PWPP", "WPPW", "PPPW", "PWWP"],
  maine: ["PWW", "WPP", "PWP", "WWP"],
  champagne: ["WWVV", "WVVW", "VWWP", "WWPP", "PPWW", "VWWV", "WVVP"],
  lorraine: ["PPW", "WWP", "PWP", "WPP", "PWW", "PPW", "WPW"],
  "bretagne-nord": ["PPWP", "PWPP", "WPPW"],
  touraine: ["WWVP", "WPPW", "VPWW", "PVWP"],
  berry: ["WWPP", "WPPP", "PPWW", "PWWW", "WWPW"],
  poitou: ["WPP", "PWW", "WWW", "PPW", "WPW"],
  limousin: ["PPW", "PPP", "WPP", "PWP"],
  aquitaine: ["VPW", "VVW", "WPV", "PVV", "WPP"],
  garonne: ["WWVPP", "PWWVP", "VPPWW", "WWWPP", "PVVWW"],
  rhone: ["WVVW", "VPWP", "VVWW", "PPVW"],
  provence: ["VVP", "PVV", "WVV", "VPW"],
};

export const VALLEY_FIELDS: readonly NationalField[] = VALLEY_CROPS.flatMap((basin, basinIndex) => {
  if (basin.id === "touraine" || basin.id === "berry" || basin.id === "lorraine") return [];
  const paletteBase = NATIONAL_FIELDS.length - 7 + VALLEY_CROPS.slice(0, basinIndex)
    .reduce((sum, previous) => sum + previous.rows * previous.columns, 0);
  const dx = Math.cos(basin.angle), dz = Math.sin(basin.angle), nx = -dz, nz = dx;
  const point = (u: number, v: number): NationalCompositionPoint =>
    [basin.x + dx * u + nx * v, basin.z + dz * u + nz * v];
  const palettes = {
    wheat: ["#EABC4D", "#F1C758", "#D9AD45", "#E7BF5B", "#D4B050", "#F0CC68"],
    pasture: ["#9EAD55", "#89A04B", "#AEB768", "#A1B363", "#7D9745", "#B0BB70"],
    vines: ["#C4AE59", "#D9BE66", "#AFA451", "#9DA453", "#C6B675", "#B4A563"],
  };
  const fields: NationalField[] = [];
  for (let row = 0; row < basin.rows; row++) {
    const v = (row / basin.rows - .5) * basin.width,
      bend = Math.sin(row * .83 + basinIndex) * .038,
      breadth = basin.width / basin.rows * .86;
    for (let column = 0; column < basin.columns; column++) {
      const u = (column / basin.columns - .5) * basin.length,
        length = basin.length / basin.columns * (.86 + ((row + column) % 3) * .028),
        serial = row * basin.columns + column + basinIndex * 7,
        symbol = VALLEY_MIX[basin.id][row][column],
        kind = symbol === "P" ? "pasture" : symbol === "V" ? "vines" : "wheat",
        palette = palettes[kind];
      fields.push({ id: `${basin.id}-parcelle-${row}-${column}`, region: basin.region,
        outline: [point(u + bend + .015, v), point(u + length + bend, v + .008),
          point(u + length + bend - .018, v + breadth), point(u + bend - .008, v + breadth - .009)],
        angle: basin.angle, kind,
        color: palette[serial % palette.length], infill: true,
        paletteSlot: paletteBase + row * basin.columns + column,
        hedgedEdges: serial % 9 === 0 ? [0] : undefined });
    }
  }
  return fields;
});

export const NATIONAL_WOODS: readonly NationalWood[] = [
  {
    id: "lisiere-normandie-bocage", trees: 126,
    outline: [[-2.92,2.62],[-2.52,2.54],[-2.07,2.62],[-1.64,2.74],[-1.34,2.71],
      [-1.35,2.93],[-1.71,2.93],[-2.12,2.81],[-2.57,2.77],[-2.95,2.83]],
    groups: [[-2.65,2.68,.29,.15],[-2.20,2.73,.30,.16],[-1.74,2.84,.31,.14],[-1.43,2.82,.20,.14]],
  },
  {
    id: "bois-artois-picardie", trees: 138,
    outline: [[-.89,3.63],[-.49,3.69],[-.15,3.93],[.19,4.03],[.54,4.20],
      [.63,4.39],[.40,4.43],[.02,4.26],[-.31,4.12],[-.62,3.92],[-.98,3.86]],
    groups: [[-.74,3.77,.23,.16],[-.37,3.96,.25,.18],[.02,4.15,.26,.17],[.42,4.30,.25,.16]],
  },
  lorraineBosquet("lisiere-champagne-ardenne", 1.82, 2.5, 0.58, 0.8, 146),
  {
    id: "bois-pays-de-caux", trees: 96,
    outline: [[-1.77,3.28],[-1.57,3.23],[-1.31,3.37],[-1.09,3.58],[-.85,3.63],
      [-.78,3.82],[-1.03,3.88],[-1.29,3.67],[-1.58,3.49],[-1.81,3.48]],
    groups: [[-1.56,3.38,.24,.14],[-1.22,3.57,.24,.17],[-.94,3.75,.19,.14]],
  },
  coteauWood("lisiere-berry-bourbonnais", 1, -0.7, -0.55, 119),
  {
    id: "bocage-gascogne", trees: 122,
    outline: [[-1.99,-2.45],[-1.75,-2.48],[-1.35,-2.35],[-.93,-2.26],[-.50,-2.25],
      [-.17,-2.08],[-.20,-1.90],[-.59,-2.04],[-1.02,-2.05],[-1.48,-2.13],[-1.98,-2.24]],
    groups: [[-1.76,-2.33,.26,.14],[-1.29,-2.21,.29,.15],[-.79,-2.16,.31,.14],[-.31,-2.01,.23,.14]],
  },
  {
    id: "bois-bretagne-interieur",
    outline: [
      [-4.99, 1.62],
      [-4.55, 1.55],
      [-4.08, 1.62],
      [-3.66, 1.59],
      [-3.04, 1.66],
      [-3.06, 1.87],
      [-3.65, 1.9],
      [-4.09, 1.88],
      [-4.54, 1.83],
      [-4.98, 1.84],
    ],
    trees: 87,
    groups: [
      [-4.63, 1.72, 0.33, 0.16],
      [-4.01, 1.73, 0.36, 0.17],
      [-3.42, 1.77, 0.36, 0.16],
    ],
  },
  {
    id: "lisiere-bretagne-est",
    outline: [
      [-3.05, 1.1],
      [-2.83, 1.12],
      [-2.78, 1.47],
      [-2.81, 1.84],
      [-2.77, 2.21],
      [-2.88, 2.3],
      [-3.09, 2.21],
      [-3.08, 1.84],
      [-3.03, 1.51],
    ],
    trees: 67,
    groups: [
      [-2.91, 1.3, 0.15, 0.25],
      [-2.93, 1.79, 0.15, 0.28],
      [-2.89, 2.11, 0.14, 0.19],
    ],
  },
  {
    id: "bois-loire-ouest",
    outline: [
      [-3.02, 1.15],
      [-2.69, 1.12],
      [-2.34, 1.15],
      [-1.9, 1.12],
      [-1.89, 1.36],
      [-2.34, 1.45],
      [-2.69, 1.38],
      [-2.99, 1.39],
    ],
    trees: 81,
    groups: [
      [-2.78, 1.26, 0.27, 0.16],
      [-2.39, 1.28, 0.29, 0.17],
      [-2.03, 1.25, 0.2, 0.14],
    ],
  },
  coteauWood("lisiere-loire-centre", 0, 0.6, 0.76, 91),
  coteauWood("bois-centre-sud", 1, 0.61, 0.78, 94),
  {
    id: "lisiere-sud-ouest",
    outline: [
      [-2.63, -0.87],
      [-2.42, -0.91],
      [-2.45, -1.38],
      [-2.39, -1.78],
      [-2.37, -2.22],
      [-2.41, -2.56],
      [-2.65, -2.52],
      [-2.68, -2.21],
      [-2.65, -1.77],
      [-2.66, -1.35],
    ],
    trees: 91,
    groups: [
      [-2.52, -1.13, 0.15, 0.28],
      [-2.53, -1.65, 0.16, 0.32],
      [-2.51, -2.24, 0.16, 0.32],
    ],
  },
  {
    id: "bois-garonne-sud",
    outline: [
      [-1.34, -2.95],
      [-1.05, -2.96],
      [-0.78, -3],
      [-0.36, -2.93],
      [-0.32, -2.73],
      [-0.78, -2.7],
      [-1.04, -2.69],
      [-1.31, -2.71],
    ],
    trees: 97,
    groups: [
      [-1.17, -2.83, 0.22, 0.14],
      [-0.8, -2.84, 0.24, 0.17],
      [-0.43, -2.82, 0.18, 0.14],
    ],
  },
  {
    id: "lisiere-rhone-ouest",
    outline: [
      [1.18, -0.89],
      [1.4, -0.87],
      [1.49, -1.3],
      [1.44, -1.74],
      [1.51, -2.18],
      [1.42, -2.68],
      [1.2, -2.65],
      [1.2, -2.19],
      [1.12, -1.74],
      [1.22, -1.31],
    ],
    trees: 101,
    groups: [
      [1.32, -1.13, 0.17, 0.28],
      [1.3, -1.65, 0.18, 0.31],
      [1.35, -2.17, 0.17, 0.28],
      [1.34, -2.5, 0.13, 0.19],
    ],
  },
  {
    id: "bois-centre-est",
    outline: [
      [1.76, 0.87],
      [1.98, 0.89],
      [2.06, 0.45],
      [2.02, 0.08],
      [2.13, -0.36],
      [2.04, -0.79],
      [1.82, -0.77],
      [1.82, -0.35],
      [1.7, 0.07],
      [1.78, 0.46],
    ],
    trees: 97,
    groups: [
      [1.91, 0.65, 0.17, 0.27],
      [1.88, 0.16, 0.17, 0.29],
      [1.96, -0.34, 0.18, 0.3],
      [1.96, -0.66, 0.12, 0.18],
    ],
  },
  {
    id: "lisiere-poitou",
    trees: 64,
    outline: [
      [-2.13, -0.03],
      [-1.95, -0.01],
      [-1.92, -0.2],
      [-1.95, -0.38],
      [-1.88, -0.59],
      [-1.94, -0.79],
      [-2.11, -0.8],
      [-2.17, -0.61],
      [-2.12, -0.38],
      [-2.16, -0.21],
    ],
    groups: [
      [-2.04, -0.18, 0.13, 0.21],
      [-2.04, -0.52, 0.16, 0.25],
    ],
  },
  {
    id: "bois-limousin-haut",
    trees: 71,
    outline: [
      [-1.06, -0.42],
      [-0.87, -0.45],
      [-0.82, -0.68],
      [-0.88, -0.91],
      [-0.8, -1.17],
      [-0.88, -1.39],
      [-1.05, -1.36],
      [-1.1, -1.15],
      [-1.03, -0.9],
      [-1.09, -0.68],
    ],
    groups: [
      [-0.97, -0.65, 0.14, 0.25],
      [-0.95, -1.1, 0.15, 0.27],
    ],
  },
  lorraineBosquet("lisiere-lorraine", 2.92, 3.45, 0.57, 0.8, 74),
];

export const MOUNTAIN_WOODS: readonly NationalWood[] = [
  {
    id: "avant-pays-alpin",
    geographic: true,
    minHeight: 0.16,
    maxHeight: 0.52,
    trees: 101,
    outline: [
      [5.38, 46.1],
      [5.65, 46.12],
      [5.91, 45.91],
      [6.04, 45.71],
      [5.95, 45.5],
      [5.75, 45.29],
      [5.49, 45.31],
      [5.53, 45.64],
      [5.31, 45.9],
    ],
    groups: [
      [5.58, 45.92, 0.19, 0.24],
      [5.82, 45.63, 0.18, 0.27],
      [5.64, 45.39, 0.17, 0.22],
    ],
  },
  {
    id: "versants-belledonne-ecrins",
    geographic: true,
    minHeight: 0.18,
    maxHeight: 0.54,
    trees: 118,
    outline: [
      [5.3, 45.36],
      [5.63, 45.4],
      [5.98, 45.17],
      [6.14, 44.93],
      [5.98, 44.74],
      [5.91, 44.52],
      [5.65, 44.28],
      [5.38, 44.4],
      [5.44, 44.74],
      [5.19, 45.03],
    ],
    groups: [
      [5.6, 45.19, 0.2, 0.25],
      [5.86, 44.92, 0.18, 0.27],
      [5.67, 44.57, 0.2, 0.28],
    ],
  },
  {
    id: "versants-mercantour",
    geographic: true,
    minHeight: 0.17,
    maxHeight: 0.5,
    trees: 101,
    outline: [
      [5.99, 44.62],
      [6.24, 44.65],
      [6.5, 44.46],
      [6.78, 44.2],
      [6.92, 43.9],
      [6.68, 43.84],
      [6.37, 44.06],
      [6.11, 44.21],
      [5.9, 44.38],
    ],
    groups: [
      [6.21, 44.43, 0.19, 0.24],
      [6.47, 44.23, 0.18, 0.25],
      [6.7, 44.05, 0.15, 0.2],
    ],
  },
  {
    id: "piedmont-pyrenees-ouest",
    geographic: true,
    minHeight: 0.16,
    maxHeight: 0.49,
    trees: 84,
    outline: [
      [-0.96, 43.15],
      [-0.65, 43.43],
      [-0.24, 43.34],
      [0.2, 43.32],
      [0.34, 43.14],
      [0.16, 43.04],
      [-0.17, 43.13],
      [-0.48, 43.02],
      [-0.75, 43.04],
    ],
    groups: [
      [-0.64, 43.22, 0.19, 0.2],
      [-0.21, 43.2, 0.2, 0.2],
      [0.16, 43.17, 0.14, 0.17],
    ],
  },
  {
    id: "piedmont-pyrenees-central",
    geographic: true,
    minHeight: 0.16,
    maxHeight: 0.49,
    trees: 101,
    outline: [
      [0.39, 43.11],
      [0.65, 43.26],
      [0.9, 43.2],
      [1.25, 43.25],
      [1.51, 43.08],
      [1.33, 42.92],
      [1.02, 42.96],
      [0.78, 42.9],
      [0.53, 42.97],
    ],
    groups: [
      [0.67, 43.13, 0.18, 0.22],
      [0.98, 43.08, 0.18, 0.23],
      [1.29, 43.08, 0.17, 0.21],
    ],
  },
  {
    id: "piedmont-pyrenees-est",
    geographic: true,
    minHeight: 0.16,
    maxHeight: 0.49,
    trees: 84,
    outline: [
      [1.68, 43.02],
      [1.92, 43.18],
      [2.18, 43.11],
      [2.47, 43.05],
      [2.55, 42.86],
      [2.27, 42.88],
      [2.09, 42.81],
      [1.84, 42.91],
    ],
    groups: [
      [1.9, 43.03, 0.17, 0.22],
      [2.21, 42.96, 0.17, 0.21],
      [2.4, 42.95, 0.13, 0.15],
    ],
  },
  {
    id: "bois-corse-vallons-interieurs",
    geographic: true, minHeight: .115, maxHeight: .95, maxSlope: 3.45,
    minSpacing: .023, species: "pine", trees: 54,
    outline: [[8.70,41.62],[9.13,41.62],[9.41,42.02],[9.47,42.54],
      [9.32,42.78],[8.91,42.76],[8.67,42.36],[8.58,42.03]],
    groups: [[8.91,41.78,.105,.14],[9.10,42.01,.11,.15],
      [9.02,42.31,.13,.15],[9.13,42.53,.10,.13]],
  },
  {
    id: "bois-corse-piemont-ouest",
    geographic: true,
    minHeight: .115,
    maxHeight: .84,
    maxSlope: 2.65,
    minSpacing: .026,
    species: "pine",
    trees: 52,
    outline: [[8.59,42.03],[8.71,41.92],[8.90,41.99],[9.02,42.18],
      [8.92,42.39],[8.75,42.48],[8.59,42.35]],
    groups: [[8.75,42.07,.11,.15],[8.82,42.24,.12,.16],[8.73,42.38,.10,.12]],
  },
  {
    id: "bois-corse-piemont-nord-est",
    geographic: true,
    minHeight: .115,
    maxHeight: .84,
    maxSlope: 2.65,
    minSpacing: .026,
    species: "pine",
    trees: 48,
    outline: [[9.02,42.24],[9.26,42.22],[9.42,42.43],[9.43,42.66],
      [9.21,42.76],[8.95,42.62],[8.98,42.44]],
    groups: [[9.25,42.40,.13,.15],[9.16,42.58,.13,.13],[9.33,42.64,.09,.10]],
  },
];

function parcelEdge(id: string, edge: number, from: number, to: number, offset: number) {
  const parcel = NATIONAL_FIELDS.find(field => field.id === id)!;
  const a = parcel.outline[edge], b = parcel.outline[(edge + 1) % parcel.outline.length],
    dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const winding = Math.sign(parcel.outline.reduce((area, p, i) => {
    const q = parcel.outline[(i + 1) % parcel.outline.length];
    return area + p[0] * q[1] - q[0] * p[1];
  }, 0));
  const point = (t: number): NationalCompositionPoint =>
    [a[0] + dx * t + dz / length * winding * offset,
      a[1] + dz * t - dx / length * winding * offset];
  return [point(from), point(to)] as const;
}

function parcelWood(id: string, parcel: string, edge: number, from: number, to: number,
  breadth: number, trees: number): NationalWood {
  const inner = parcelEdge(parcel, edge, from, to, .014),
    outer = parcelEdge(parcel, edge, from, to, .014 + breadth),
    dx = inner[1][0] - inner[0][0], dz = inner[1][1] - inner[0][1], length = Math.hypot(dx, dz),
    rx = Math.abs(dx) * .32 + Math.abs(dz / length) * breadth * .41,
    rz = Math.abs(dz) * .32 + Math.abs(dx / length) * breadth * .41;
  return { id, outline: [inner[0], inner[1], outer[1], outer[0]], trees,
    minSpacing: .032, maxHeight: .72, maxSlope: 1.35,
    groups: [.24, .70].map(t => [
      (inner[0][0] + outer[0][0]) / 2 + dx * t,
      (inner[0][1] + outer[0][1]) / 2 + dz * t, rx, rz] as const) };
}

/** Four small copses occupy the outside edges of existing Limousin parcels. */
export const CENTRAL_WOODS: readonly NationalWood[] = [
  parcelWood("bosquet-limousin-prairie-nord", "limousin-prairie-nord", 1, .18, .88, .115, 28),
  parcelWood("bosquet-limousin-ble-ouest", "limousin-ble-sud", 7, .02, .98, .13, 14),
  parcelWood("bosquet-limousin-prairie-est", "limousin-prairie-est", 5, .60, .95, .10, 12),
  parcelWood("bosquet-perigord-prairie-nord", "perigord-prairie-est", 5, .08, .82, .12, 24),
];

export const CENTRAL_FIELD_EDGES = [
  parcelEdge("limousin-prairie-nord", 1, .02, .98, .001),
  parcelEdge("limousin-ble-sud", 1, .02, .98, .006),
  parcelEdge("limousin-ble-sud", 5, .02, .98, .005),
  parcelEdge("limousin-prairie-est", 5, .60, .95, .006),
  parcelEdge("perigord-prairie-est", 5, .05, .90, .004),
] as const;

