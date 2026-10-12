import type { Scene } from "@babylonjs/core/scene";

/** Let saved decisions and navigation run between bounded scenery batches.
 * Placement order and authored geometry remain deterministic. */
export function sceneConstructionCheckpoint(scene: Scene): () => Promise<boolean> {
  let started = performance.now();
  return async () => {
    if (scene.isDisposed) return false;
    if (performance.now() - started < 8) return true;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    started = performance.now();
    return !scene.isDisposed;
  };
}
