import type { NationalBuilding, NationalSettlement } from "./map-city-national.ts";

/** Small terracotta quarters composed in the retained island frame. They pass
 * through the common island transport and the normal land/grade/overlap checks. */
const houses: Record<string, readonly (readonly [number, number, number])[]> = {
  ajaccio: [[.31,.045,.15],[.31,-.04,.13],[.40,.135,.14],[.40,-.11,.12],[.552,.197,.19]],
  bastia: [[-.19,-.04,.13],[-.22,-.125,.15],[-.245,-.21,.12],[-.27,-.295,.14],
    [.012,.107,.20]],
  corte: [[.245,.255,.13],[.265,.165,.15],[.245,-.075,.12],[.22,-.16,.14]],
  bonifacio: [[-.085,.255,.14],[.005,.255,.12],[-.09,.34,.15],[.005,.345,.13]],
};

// Individually surveyed island terraces. Heights and depths express the
// original GLB proportions after the existing street-width composition.
const terraceBuildings: Record<string, readonly NationalBuilding[]> = {
  "corte": [
    {
      "model": "cathedrale_paris",
      "x": -0.14,
      "z": -0.105,
      "height": 0.2094179339,
      "width": 0.13,
      "depth": 0.1989197693,
      "angle": 0.18,
      "footprintOffset": 0,
      "id": "corte-eglise-reference",
      "rigidModel": true
    }
  ],
  "ajaccio": [
    {
      "model": "maison_sud_01",
      "x": 0.28,
      "z": -0.14,
      "height": 0.0487865983,
      "width": 0.088,
      "depth": 0.0728820513,
      "angle": 0.42,
      "footprintOffset": 0.0029453671,
      "id": "ajaccio-quartier-terrasse-reference-7",
      "rigidModel": true
    }
  ]
};

export function addReferenceIslandQuarter(town: NationalSettlement): NationalSettlement {
  const points = houses[town.name];
  if (!points) return town;
  const buildings: NationalBuilding[] = points.map(([x, z, height], index) => ({
    id: `${town.name}-quartier-reference-${index + 1}`,
    model: index === 4 ? "maison_sud_01_dominante" : index % 2 ? "maison_sud_02" : "maison_sud_01",
    x, z, height, width: .074, depth: .055, angle: .12 + index * .13,
    footprintOffset: 0,
  })).concat(terraceBuildings[town.name] ?? []);
  return { ...town, blocks: [...town.blocks, ...buildings.map(house => ({
    id: `${house.id}-parcelle`,
    outline: !house.rigidModel ? [[house.x - .046, house.z - .037],
      [house.x + .046, house.z - .037], [house.x + .046, house.z + .037],
      [house.x - .046, house.z + .037]] as const : [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz]) => {
      const width = house.width / 2 + .008, depth = house.depth / 2 + .008,
        c = Math.cos(house.angle), sn = Math.sin(house.angle);
      return [house.x + sx * width * c + sz * depth * sn,
        house.z - sx * width * sn + sz * depth * c] as const;
    }),
    buildings: [house],
  }))], trees: [...town.trees,
    { x: points[0][0] - .07, z: points[0][1] + .045, height: .21, model: "cypress" },
    { x: points[2][0] + .055, z: points[2][1] + .08, height: .23, model: "pine" },
  ] };
}
