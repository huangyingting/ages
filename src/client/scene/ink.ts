import * as THREE from 'three';

/**
 * Draw order of "map ink": overlays painted on the map itself (routes, arrows, rings, battlefields). They render right
 * after the terrain and are never depth-tested, so the relief can't nick their shapes; 3D models draw after them
 * (depth-tested as usual) and so still stand on top.
 */
export const INK = {
  terrain: -9,
  field: -8,
  ribbon: -7,
  trail: -6,
  dartShadow: -5,
  dartRim: -4,
  dart: -3,
  ring: -2,
  halo: -1,
} as const;

/** Turns a material into map ink (see INK): no depth test, alpha-blended but sorted with the opaque pass. */
export function ink<M extends THREE.Material>(m: M, additive = false): M {
  m.transparent = false;
  m.depthTest = false;
  m.depthWrite = false;
  m.polygonOffset = false;
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
  // keep the canvas opaque (the renderer has an alpha channel)
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}
