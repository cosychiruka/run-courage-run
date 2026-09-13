// One shared surface contract for every homestead world. Scene3D moves this
// whole coordinate space down by two units; assets in this folder should use
// this local height instead of approximating the old spherical terrain curve.
export const WORLD_GROUND_Y = 0.5;
export const WORLD_GROUND_RADIUS = 100;
export const WORLD_SURFACE_EPSILON = 0.035;

export function rootedCenterY(height, rootDepth = 0.3) {
  return WORLD_GROUND_Y - rootDepth + height * 0.5;
}
