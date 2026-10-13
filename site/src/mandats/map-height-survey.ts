export type BakedHeightSurvey = {
  minimumX: number; minimumZ: number; width: number; height: number;
  values: Float64Array;
};
let survey: BakedHeightSurvey | undefined;

/** Static numeric samples from the same authored survey as the land mesh.
 * Missing cells retain the original analytic calculation; no game state is cached. */
export function installBakedHeightSurvey(next: BakedHeightSurvey): void {
  if (![next.minimumX, next.minimumZ, next.width, next.height].every(Number.isInteger) ||
      next.width <= 0 || next.height <= 0 || next.width > 4096 || next.height > 4096 ||
      next.values.length !== next.width * next.height)
    throw new Error("Invalid baked height survey.");
  survey = next;
}

export function bakedHeightAt(x: number, z: number): number | undefined {
  if (!survey) return undefined;
  const column = x - survey.minimumX, row = z - survey.minimumZ;
  if (column < 0 || row < 0 || column >= survey.width || row >= survey.height) return undefined;
  const value = survey.values[row * survey.width + column];
  return Number.isFinite(value) ? value : undefined;
}
