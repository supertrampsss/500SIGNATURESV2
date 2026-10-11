import type { NationalSettlement } from "./map-city-national.ts";

/** The reference's northern cape has a compact settlement above the Lille quarter.
 * This is decorative geography, with no subject, marker or game action. */
export const REFERENCE_NORTH_SETTLEMENTS: readonly NationalSettlement[] = [{
  name: "dunkerque", lon: 2.40, lat: 51.025, region: "north", major: false,
  blocks: [{
    id: "dunkerque-hauts-quartiers",
    outline: [[-.30,-.25],[.32,-.25],[.34,.28],[-.28,.30]],
    buildings: [
      { id: "dunkerque-maison-ouest", model: "maison_brique_01", x: -.20, z: -.13,
        angle: -.21, width: .13, depth: .09, height: .19, footprintOffset: 0 },
      { id: "dunkerque-maison-place", model: "maison_brique_02", x: -.025, z: -.17,
        angle: .10, width: .14, depth: .10, height: .23, footprintOffset: 0 },
      { id: "dunkerque-maison-est", model: "maison_brique_01", x: .17, z: -.13,
        angle: .32, width: .12, depth: .085, height: .18, footprintOffset: 0 },
      { id: "dunkerque-maison-cour", model: "maison_ardoise_01", x: -.17, z: .08,
        angle: 2.90, width: .12, depth: .09, height: .17, footprintOffset: 0 },
      { id: "dunkerque-ferme", model: "ferme_02", x: .075, z: .12,
        angle: 3.20, width: .17, depth: .13, height: .14, footprintOffset: 0 },
      { id: "dunkerque-annexe", model: "maison_brique_02", x: .245, z: .13,
        angle: 3.45, width: .10, depth: .078, height: .16, footprintOffset: 0 },
    ],
  }],
  streets: [{ id: "dunkerque-venelle", width: .014,
    points: [[-.29,-.015],[-.09,-.018],[.11,-.010],[.30,.04]] }],
  trees: [{ x: -.28, z: .16, height: .24, model: "beech" },
    { x: .29, z: -.20, height: .20, model: "oak" }],
}];
