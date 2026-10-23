import * as THREE from 'three';

/**
 * Per-vertex surface response for merged models: a normalized `pbr` attribute (x = roughness, y = metalness) keeps
 * every part's own material (glossy water, brushed steel, matte stone) after many parts are merged into one mesh.
 */
export const PBR_ATTR = 'pbr';

export function useVertexPbr(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec2 ${PBR_ATTR};\nvarying vec2 vPbr;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvPbr = ${PBR_ATTR};`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPbr;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(vPbr.x, 0.04);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vPbr.y;');
  };
  m.customProgramCacheKey = () => 'vertex-pbr';
  m.userData.vertexPbr = true;
  return m;
}

const variants = new WeakMap<THREE.Material, THREE.MeshStandardMaterial>();
/** The vertex-PBR twin of a material (for meshes rebuilt from a worker, where shader hooks do not travel). */
export function vertexPbrOf(m: THREE.Material): THREE.Material {
  if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial || m.userData.vertexPbr) return m;
  let v = variants.get(m);
  if (!v) { v = useVertexPbr((m as THREE.MeshStandardMaterial).clone()); variants.set(m, v); }
  return v;
}

const hsl = { h: 0, s: 0, l: 0 };
/**
 * A plausible [roughness, metalness] for a part that never chose its own finish, guessed from its colour:
 * foliage and earth are matte, painted surfaces have a satin sheen, bright blues read as wet glossy water,
 * deep golds are gilded metal and cool slate greys are weathered steel or polished stone.
 */
export function inferPbr(c: THREE.Color): [number, number] {
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const { h, s, l } = hsl;
  if (l > 0.9 && s < 0.3) return [0.55, 0]; // plaster, marble, snow
  if (s < 0.12) return l < 0.14 ? [0.45, 0.05] : [0.74, 0]; // black gloss / grey stone & concrete
  if (h > 0.52 && h < 0.7 && s < 0.32 && l > 0.3 && l < 0.85) return [0.5, 0.22]; // slate: steel, zinc, granite
  if (h >= 0.2 && h <= 0.47) return [0.86, 0]; // leaves, grass, moss
  if (h >= 0.11 && h <= 0.16 && s > 0.75 && l > 0.4 && l < 0.66) return [0.36, 0.38]; // gilded gold
  if (h > 0.02 && h < 0.16 && s < 0.78 && l < 0.82) return [0.84, 0]; // wood, sand, brick, earth
  if (h > 0.5 && h < 0.6 && s > 0.6 && l > 0.42 && l < 0.78) return [0.16, 0]; // water, glazing
  if (s > 0.45) return [0.48, 0.02]; // paint, enamel, fabric dyes
  return [0.65, 0.08];
}
