// One shared surface contract for every homestead world. Scene3D moves this
// whole coordinate space down by two units; assets in this folder should use
// this local height instead of approximating the old spherical terrain curve.
export const WORLD_GROUND_Y = 0.5;
export const WORLD_GROUND_RADIUS = 100;
export const WORLD_SURFACE_EPSILON = 0.035;

// Root anchors for the homestead assets. These values describe the model's
// contact point with the shared plane, so story controllers never need to
// carry terrain-era magic numbers again.
export const WORLD_HOUSE_ROOT_Y = WORLD_GROUND_Y;
export const WORLD_WINDMILL_ROOT_Y = WORLD_GROUND_Y;
export const WORLD_TRUCK_ROOT_Y = WORLD_GROUND_Y - 0.02;
export const WORLD_ACTOR_ROOT_Y = WORLD_GROUND_Y + 0.03;
export const WORLD_BUSH_ROOT_Y = WORLD_GROUND_Y + 0.18;

export function rootedCenterY(height, rootDepth = 0.3) {
  return WORLD_GROUND_Y - rootDepth + height * 0.5;
}
