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

export function addReferenceIslandQuarter(town: NationalSettlement): NationalSettlement {
  const points = houses[town.name];
  if (!points) return town;
  const buildings: NationalBuilding[] = points.map(([x, z, height], index) => ({
    id: `${town.name}-quartier-reference-${index + 1}`,
    model: index === 4 ? "maison_sud_01_dominante" : index % 2 ? "maison_sud_02" : "maison_sud_01",
    x, z, height, width: .074, depth: .055, angle: .12 + index * .13,
    footprintOffset: 0,
  }));
  return { ...town, blocks: [...town.blocks, ...buildings.map(house => ({
    id: `${house.id}-parcelle`,
    outline: [[house.x - .046, house.z - .037], [house.x + .046, house.z - .037],
      [house.x + .046, house.z + .037], [house.x - .046, house.z + .037]] as const,
    buildings: [house],
  }))], trees: [...town.trees,
    { x: points[0][0] - .07, z: points[0][1] + .045, height: .21, model: "cypress" },
    { x: points[2][0] + .055, z: points[2][1] + .08, height: .23, model: "pine" },
  ] };
}
