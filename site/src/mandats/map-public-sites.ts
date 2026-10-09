import { CORSE_REFERENCE_POSE, mapCorsicaLocalVector } from "./map-camera-projection.ts";

/** Shared authored footprint for the school shown in the Lyon subjects. */
export const LYON_SCHOOL_SITE = {
  town: "lyon",
  x: -.264,
  z: -.60,
  halfW: .155,
  halfD: .085,
  publicHalfW: .18,
  publicHalfD: .09,
  buildingWidth: .30,
  buildingDepth: .134,
  // Keep the established channel when relocating the building onto its dry
  // bank. The river survey still uses this fixed hydraulic clearance anchor.
  riverWidthAnchor: { x: -.22, z: -.60 },
} as const;


// The esplanade's rendered contour, collision rectangle and terrain support
// keep their existing dimensions. Ajaccio alone follows the island's rigid R.
const ESPLANADE_OUTLINE: readonly (readonly [number, number])[] = [
  [-.205, -.43], [-.18, -.255], [.12, -.247], [.23, -.29], [.223, -.428], [.085, -.47],
];
type PublicPlot = { x: number; z: number; halfX: number; halfZ: number;
  halfW?: number; halfD?: number; angle?: number };
export function publicEsplanadePoint(town: string, x: number, z: number) {
  return town === "ajaccio" ? mapCorsicaLocalVector(x, z) : { x, z };
}
export function publicEsplanadeOutline(town: string): number[][] {
  return ESPLANADE_OUTLINE.map(([x, z]) => {
    const point = publicEsplanadePoint(town, x, z); return [point.x, point.z];
  });
}
export function publicEsplanadePlot(town: string): PublicPlot {
  if (town !== "ajaccio") return { x: .02, z: -.36, halfX: .235, halfZ: .125 };
  const point = publicEsplanadePoint(town, .02, -.36), angle = -CORSE_REFERENCE_POSE.angle,
    c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  return { ...point, halfX: c * .235 + s * .125, halfZ: s * .235 + c * .125,
    halfW: .235, halfD: .125, angle };
}
export function publicEsplanadeTerrainSite(town: string) {
  const point = publicEsplanadePoint(town, .02, -.42);
  return { ...point, halfW: .23, halfD: .14,
    rotation: town === "ajaccio" ? -CORSE_REFERENCE_POSE.angle : 0 };
}
