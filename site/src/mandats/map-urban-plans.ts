import { publicEsplanadeTerrainSite } from "./map-public-sites.ts";
import { mapRetainedTownPlanPoint } from "./map-camera-projection.ts";
import { MAP_PLACES, mapPosition } from "./map-state.ts";
import type { MapPlace } from "./map-state.ts";
import { NATIONAL_SETTLEMENTS } from "./map-city-national.ts";
import { PARIS_BLOCKS, PARIS_CATHEDRAL_SITE } from "./map-city-paris.ts";

export type UrbanRegion = "paris" | "north" | "breton" | "alsace" | "stone" | "south";
export type UrbanPlan = {
  region: UrbanRegion;
  width: number;
  rows: number[];
  angle: number;
  shiftX?: number;
  shiftZ?: number;
};

/** Streets and their buildable strips form the town, rather than circular pads. */
export const URBAN_PLANS: Record<MapPlace, UrbanPlan> = {
  paris: { region: "paris", width: 1.54, rows: [-.65, -.41, -.17, .17, .41, .65], angle: -.06, shiftZ: .04 },
  lyon: { region: "stone", width: 1.38, rows: [-.67, -.43, -.19, .05, .29, .53], angle: -.28 },
  lille: { region: "north", width: 1.30, rows: [-.70, -.46, -.22, .02, .26], angle: .20, shiftX: -.19, shiftZ: -.07 },
  rennes: { region: "breton", width: 1.18, rows: [-.36, -.12, .12, .36, .60], angle: .39, shiftX: -.04 },
  nantes: { region: "stone", width: 1.20, rows: [-.46, -.22, .02, .26, .50], angle: -.24, shiftX: -.04 },
  bordeaux: { region: "stone", width: 1.25, rows: [-.40, -.16, .08, .32, .56], angle: .37 },
  toulouse: { region: "south", width: 1.22, rows: [-.40, -.16, .08, .32, .56], angle: -.19 },
  montpellier: { region: "south", width: 1.16, rows: [-.20, .04, .28, .52, .76], angle: .21 },
  marseille: { region: "south", width: 1.18, rows: [.13, .35, .57, .79], angle: -.39, shiftX: -.05 },
  strasbourg: { region: "alsace", width: 1.10, rows: [-.33, -.10, .13, .36, .59], angle: .51, shiftX: -.17 },
  rouen: { region: "breton", width: 1.08, rows: [-.44, -.20, .04, .28, .52], angle: .28 },
  ajaccio: { region: "south", width: .50, rows: [.01, .23, .45, .67], angle: .42, shiftX: .16 },
};

export const RURAL_SETTLEMENTS = [
  { name: "brest", lon: -4.49, lat: 48.39, region: "breton" },
  { name: "cherbourg", lon: -1.62, lat: 49.64, region: "stone" },
  { name: "morlaix", lon: -3.83, lat: 48.58, region: "breton" },
  { name: "quimper", lon: -4.10, lat: 47.99, region: "breton" },
  { name: "saint-brieuc", lon: -2.76, lat: 48.51, region: "breton" },
  { name: "vannes", lon: -2.76, lat: 47.70, region: "breton" },
  { name: "saint-malo", lon: -2.03, lat: 48.65, region: "breton" },
  { name: "caen", lon: -.37, lat: 49.18, region: "stone" },
  { name: "amiens", lon: 2.30, lat: 49.89, region: "north" },
  { name: "arras", lon: 2.77, lat: 50.28, region: "north" },
  { name: "reims", lon: 4.03, lat: 49.26, region: "stone" },
  { name: "metz", lon: 6.18, lat: 49.12, region: "north" },
  { name: "nancy", lon: 6.18, lat: 48.69, region: "north" },
  { name: "le-mans", lon: .20, lat: 48.01, region: "stone" },
  { name: "angers", lon: -.55, lat: 47.47, region: "stone" },
  { name: "tours", lon: .69, lat: 47.39, region: "stone" },
  { name: "orleans", lon: 1.91, lat: 47.90, region: "stone" },
  { name: "chartres", lon: 1.49, lat: 48.45, region: "stone" },
  { name: "blois", lon: 1.33, lat: 47.59, region: "stone" },
  { name: "poitiers", lon: .34, lat: 46.58, region: "stone" },
  { name: "la-rochelle", lon: -1.15, lat: 46.16, region: "stone" },
  { name: "niort", lon: -.46, lat: 46.32, region: "stone" },
  { name: "limoges", lon: 1.26, lat: 45.83, region: "stone" },
  { name: "brive", lon: 1.53, lat: 45.16, region: "stone" },
  { name: "perigueux", lon: .72, lat: 45.18, region: "stone" },
  { name: "agen", lon: .62, lat: 44.20, region: "south" },
  { name: "pau", lon: -.37, lat: 43.30, region: "south" },
  { name: "tarbes", lon: .07, lat: 43.24, region: "south" },
  { name: "foix", lon: 1.61, lat: 42.97, region: "south" },
  { name: "carcassonne", lon: 2.35, lat: 43.21, region: "south" },
  { name: "perpignan", lon: 2.89, lat: 42.70, region: "south" },
  { name: "albi", lon: 2.15, lat: 43.93, region: "south" },
  { name: "rodez", lon: 2.57, lat: 44.35, region: "stone" },
  { name: "clermont", lon: 3.08, lat: 45.78, region: "stone" },
  { name: "bourges", lon: 2.40, lat: 47.08, region: "stone" },
  { name: "dijon", lon: 5.04, lat: 47.32, region: "stone" },
  { name: "besancon", lon: 6.02, lat: 47.24, region: "alsace" },
  { name: "chambery", lon: 5.92, lat: 45.57, region: "stone" },
  { name: "annecy", lon: 6.13, lat: 45.90, region: "stone" },
  { name: "avignon", lon: 4.81, lat: 43.95, region: "south" },
  { name: "nimes", lon: 4.36, lat: 43.84, region: "south" },
  { name: "nice", lon: 7.26, lat: 43.70, region: "south" },
  { name: "bastia", lon: 9.45, lat: 42.70, region: "south" },
  { name: "corte", lon: 9.15, lat: 42.30, region: "south" },
  { name: "bonifacio", lon: 9.159, lat: 41.387, region: "south" },
] as const;

export type CityEnvelopeFootprint = {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  rotation: number;
  settlement: string;
  localLevel?: boolean;
};

export function cityEnvelopeFootprints(): CityEnvelopeFootprint[] {
  const strips: CityEnvelopeFootprint[] = [];
  // Foundations follow actual architecture; no old row envelope or town pad.
  const paris = mapPosition(MAP_PLACES.paris.lon, MAP_PLACES.paris.lat);
  for (const block of PARIS_BLOCKS) for (const house of block.buildings)
    strips.push({ x: paris.x + house.x + Math.sin(house.angle) * (house.footprintOffset ?? 0),
      z: paris.z + house.z + Math.cos(house.angle) * (house.footprintOffset ?? 0),
      halfW: house.width / 2 + .012, halfD: house.depth / 2 + .012,
      rotation: -house.angle, settlement: "paris" });
  strips.push({ x: paris.x + PARIS_CATHEDRAL_SITE.x, z: paris.z + PARIS_CATHEDRAL_SITE.z,
    halfW: PARIS_CATHEDRAL_SITE.width / 2 + .012, halfD: PARIS_CATHEDRAL_SITE.depth / 2 + .012,
    rotation: -PARIS_CATHEDRAL_SITE.angle, settlement: "paris" });
  strips.push({ x: paris.x + .02, z: paris.z - .42, halfW: .23, halfD: .14,
    rotation: 0, settlement: "paris" });
  for (const town of NATIONAL_SETTLEMENTS) {
    const point = mapPosition(town.lon, town.lat);
    for (const block of town.blocks) for (const house of block.buildings) {
      const s = Math.sin(house.angle), c = Math.cos(house.angle);
      strips.push({ x: point.x + house.x + s * house.footprintOffset,
        z: point.z + house.z + c * house.footprintOffset,
        halfW: house.width / 2 + .018, halfD: house.depth / 2 + .018,
        rotation: -house.angle, settlement: town.name, localLevel: true });
    }
    if (town.major && town.name === "ajaccio") {
      const site = publicEsplanadeTerrainSite(town.name);
      strips.push({ ...site, x: point.x + site.x, z: point.z + site.z, settlement: town.name });
    } else if (town.major) strips.push({ x: point.x + .02, z: point.z - .42,
      halfW: .23, halfD: .14, rotation: 0, settlement: town.name });
  }
  // One small service site in Montpellier supports the saved water/energy
  // works. Its reservation is surveyed by the same physical terrain as houses.
  const montpellier = mapPosition(MAP_PLACES.montpellier.lon, MAP_PLACES.montpellier.lat);
  strips.push({ x: montpellier.x - .80, z: montpellier.z + 1.25,
    halfW: .23, halfD: .22, rotation: 0, settlement: "montpellier-project", localLevel: true });
  return strips;
}

const footprints = cityEnvelopeFootprints();
// Narrow settlement lanes clear vegetation and crops without levelling a
// whole street. Their slopes keep the shared terrain's native survey.
const streetFootprints: CityEnvelopeFootprint[] = NATIONAL_SETTLEMENTS.flatMap(town => {
  const origin = mapPosition(town.lon, town.lat);
  return (town.streets ?? []).flatMap(street => street.points.slice(1).map((b, i) => {
    const a = street.points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    return { x: origin.x + (a[0] + b[0]) / 2, z: origin.z + (a[1] + b[1]) / 2,
      halfW: Math.hypot(dx, dz) / 2 + .016, halfD: street.width / 2 + .016,
      rotation: Math.atan2(dz, dx), settlement: town.name };
  }));
});
// Gardens clear crops and woodland without levelling their native ground.
const gardenFootprints: CityEnvelopeFootprint[] = NATIONAL_SETTLEMENTS.flatMap(town => {
  const origin = mapPosition(town.lon, town.lat);
  return (town.gardens ?? []).map(garden => ({ x: origin.x + garden.x, z: origin.z + garden.z,
    halfW: garden.width / 2, halfD: garden.depth / 2, rotation: -garden.angle, settlement: town.name }));
});
const occupiedFootprints = [...footprints, ...streetFootprints, ...gardenFootprints].map(footprint => ({
  ...footprint, cosine: Math.cos(footprint.rotation), sine: Math.sin(footprint.rotation),
}));
const footprintCells = new Map<string, typeof occupiedFootprints>(), cellSize = .50, indexedReach = .25;
const groupedFootprints = new Map<string, typeof occupiedFootprints>();
for (const footprint of occupiedFootprints) {
  const group = groupedFootprints.get(footprint.settlement) ?? [];
  group.push(footprint); groupedFootprints.set(footprint.settlement, group);
}
const footprintGroups = [...groupedFootprints.values()].map(group => {
  const bounds = group.map(footprint => {
    const halfX = Math.abs(footprint.cosine) * footprint.halfW + Math.abs(footprint.sine) * footprint.halfD,
      halfZ = Math.abs(footprint.sine) * footprint.halfW + Math.abs(footprint.cosine) * footprint.halfD;
    for (let x = Math.floor((footprint.x - halfX - indexedReach) / cellSize);
      x <= Math.floor((footprint.x + halfX + indexedReach) / cellSize); x++)
      for (let z = Math.floor((footprint.z - halfZ - indexedReach) / cellSize);
        z <= Math.floor((footprint.z + halfZ + indexedReach) / cellSize); z++) {
        const key = `${x}:${z}`, cell = footprintCells.get(key) ?? [];
        cell.push(footprint); footprintCells.set(key, cell);
      }
    return { minX: footprint.x - halfX, maxX: footprint.x + halfX,
      minZ: footprint.z - halfZ, maxZ: footprint.z + halfZ };
  });
  return { footprints: group, minX: Math.min(...bounds.map(bound => bound.minX)),
    maxX: Math.max(...bounds.map(bound => bound.maxX)), minZ: Math.min(...bounds.map(bound => bound.minZ)),
    maxZ: Math.max(...bounds.map(bound => bound.maxZ)) };
});

/** Exact signed distance to inhabited street strips; positive means outside. */
export function urbanFootprint(x: number, z: number): number {
  let clearance = Infinity;
  const distance = (footprint: typeof occupiedFootprints[number]) => {
    const dx = x - footprint.x, dz = z - footprint.z,
      px = Math.abs(dx * footprint.cosine + dz * footprint.sine) - footprint.halfW,
      pz = Math.abs(-dx * footprint.sine + dz * footprint.cosine) - footprint.halfD;
    return Math.hypot(Math.max(0, px), Math.max(0, pz)) + Math.min(0, Math.max(px, pz));
  };
  for (const footprint of footprintCells.get(`${Math.floor(x / cellSize)}:${Math.floor(z / cellSize)}`) ?? [])
    clearance = Math.min(clearance, distance(footprint));
  // Every footprint nearer than this reach is in the point's cell. Distant
  // queries use group bounds to retain the exact distance, rather than a cap.
  if (clearance < indexedReach) return clearance;
  const groups = footprintGroups.map(group => ({ group,
    lowerBound: Math.hypot(Math.max(group.minX - x, 0, x - group.maxX),
      Math.max(group.minZ - z, 0, z - group.maxZ)) })).sort((a, b) => a.lowerBound - b.lowerBound);
  for (const { group, lowerBound } of groups) {
    if (lowerBound > Math.max(0, clearance)) break;
    for (const footprint of group.footprints) clearance = Math.min(clearance, distance(footprint));
  }
  return clearance;
}

/** Accepted construction reservations remain open while the surrounding town grows.
 * Each point is re-surveyed against the current physical terrain before use. */
const RETAINED_PROJECT_RESERVATIONS: Partial<Record<MapPlace, readonly { x: number; z: number }[]>> = {
  "paris": [
    {
      "x": 0.734731565,
      "z": -1.011271243
    },
    {
      "x": -0.6249999999999998,
      "z": 1.0825317547305484
    },
    {
      "x": 1.1888206453689418,
      "z": -0.38627124296868454
    }
  ],
  "lyon": [
    {
      "x": -0.339918694,
      "z": -1.046162168
    },
    {
      "x": -0.7,
      "z": 1.212435565
    },
    {
      "x": -0.353449874,
      "z": 1.662850921
    }
  ],
  "lille": [
    {
      "x": -0.647213595,
      "z": 0.470228202
    },
    {
      "x": 0.339918693812442,
      "z": -1.046162167924669
    },
    {
      "x": -1.188820645,
      "z": 0.386271243
    }
  ],
  "rennes": [
    {
      "x": 0.5500000000000002,
      "z": 0.9526279441628825
    },
    {
      "x": 1.3923306535155826,
      "z": -0.14633984857471477
    },
    {
      "x": 1.9562952014676114,
      "z": 0.41582338163551863
    }
  ],
  "nantes": [
    {
      "x": 1.151874479,
      "z": 1.03715244
    },
    {
      "x": 1.5415089378208235,
      "z": -0.1620191180648628
    }
  ],
  "bordeaux": [
    {
      "x": 0.6250000000000001,
      "z": 1.0825317547305482
    },
    {
      "x": -0.130660579,
      "z": -1.243152369
    },
    {
      "x": 1.2226845009172571,
      "z": -0.25988961352219875
    }
  ],
  "toulouse": [
    {
      "x": -0.197516106,
      "z": 0.929240221
    },
    {
      "x": -0.7,
      "z": 1.212435565
    },
    {
      "x": -1.9890437907365468,
      "z": 0.20905692653530658
    }
  ],
  "montpellier": [
    {
      "x": -0.8,
      "z": 1.25
    },
    {
      "x": 0.384636628,
      "z": 1.809573061
    },
    {
      "x": -0.618033989,
      "z": 1.902113033
    }
  ],
  "marseille": [],
  "strasbourg": [
    {
      "x": -0.635674076,
      "z": 0.705987584
    },
    {
      "x": -1.0371524398562306,
      "z": -1.1518744794899607
    },
    {
      "x": -1.093974085,
      "z": 0.11498131
    }
  ],
  "rouen": [
    {
      "x": 0.072769092,
      "z": 0.34235166
    },
    {
      "x": 0.497260948,
      "z": 0.052264232
    },
    {
      "x": 0.535304485,
      "z": 0.59451586
    }
  ],
  "ajaccio": []
};


/** Project placement, exclusion and terrain protection share the same F22
 * centre transport as the surrounding authored neighbourhoods. */
export const AUTHORED_PROJECT_RESERVATIONS: Partial<Record<MapPlace, readonly { x: number; z: number }[]>> =
  Object.fromEntries(Object.entries(RETAINED_PROJECT_RESERVATIONS).map(([name, sites]) => {
    const town = name as MapPlace, origin = MAP_PLACES[town];
    return [town, sites!.map(site => mapRetainedTownPlanPoint(origin.lon, origin.lat, site.x, site.z))];
  }));
