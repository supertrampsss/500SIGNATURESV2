import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { geometryContactFrame } from "./map-geometry-cache.ts";
import type { GroundSurvey } from "./map-ground-survey.ts";

/** Move the whole tree onto actual land without changing its proportions.
 * The lowest stem section is conservative and shared by the support audit. */
export function seatTreeOnGround(root: TransformNode, survey: GroundSurvey, height: number): boolean {
  const frames = root.getChildMeshes().map(geometryContactFrame),
    bottom = Math.min(...frames.map(frame => frame.minimumY)),
    foot = frames.flatMap(frame => frame.below(bottom + Math.abs(root.scaling.y) * .01));
  if (!foot.length || !Number.isFinite(bottom)) return false;
  let clearance = -Infinity;
  for (const point of foot) {
    const ground = survey.heightAt(point.x, point.z);
    if (!Number.isFinite(ground)) return false;
    clearance = Math.max(clearance, point.y - ground);
  }
  const descent = Math.max(0, clearance + .001);
  if (descent > height * .25) return false;
  root.position.y -= descent;
  root.metadata = { ...root.metadata, renderedStemSeat: { samples: foot.length, descent } };
  return true;
}
