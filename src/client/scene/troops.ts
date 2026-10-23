import * as THREE from 'three';
import { human } from '../models/human.ts';
import { box, cone, cyl, rod, sweep, tube } from '../models/prims.ts';

/**
 * Instanced troop figures for formations: a pocket-planet `human` soldier with spear and shield, and a low-poly horse
 * with rider. Parts painted in the TEAM marker colour (and shades of it) take the formation's instance colour; the rest
 * keeps its own colours. Each figure faces +z with its feet at y = 0 and stands about 0.8 (soldier) / 1.05 (rider) tall.
 */
const TEAM = '#ff00ff';
const WOOD = '#5b3a23', IRON = '#55585e', STEEL = '#a8adb3', SKIN = '#c99a72', LEG = '#3a3128', BOOT = '#2a2018';

/** Bakes a built group into one non-indexed geometry with `color` and a per-vertex `team` weight. */
function bake(build: (g: THREE.Group) => void, scale = 1): THREE.BufferGeometry {
  const root = new THREE.Group();
  build(root);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const pos: number[] = [], nor: number[] = [], col: number[] = [], team: number[] = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color(), nm = new THREE.Matrix3();
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    if (!geo.getAttribute('normal')) { geo = geo.clone(); geo.computeVertexNormals(); }
    const P = geo.getAttribute('position'), N = geo.getAttribute('normal'), C = geo.getAttribute('color');
    const base = (m.material as THREE.MeshStandardMaterial).color;
    // the marker is pure magenta in any shade: no green, equal red and blue
    const isTeam = base.g < 1e-3 && base.r > 1e-3 && Math.abs(base.r - base.b) < 1e-3;
    nm.getNormalMatrix(m.matrixWorld);
    const flip = m.matrixWorld.determinant() < 0;
    for (let i = 0; i < P.count; i++) {
      const k = flip ? i - (i % 3) + (2 - (i % 3)) : i;
      v.fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld);
      n.fromBufferAttribute(N, k).applyMatrix3(nm).normalize();
      pos.push(v.x, v.y, v.z);
      nor.push(n.x, n.y, n.z);
      if (isTeam) c.setRGB(base.r, base.r, base.r);
      else if (C) c.fromBufferAttribute(C as THREE.BufferAttribute, k).multiply(base);
      else c.copy(base);
      col.push(c.r, c.g, c.b);
      team.push(isTeam ? 1 : 0);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('team', new THREE.Float32BufferAttribute(team, 1));
  out.computeBoundingSphere();
  return out;
}

function spearman(g: THREE.Group): void {
  const h = 0.8;
  const r = human(g, 0, 0, 0, { h, pose: 'walk', phase: 0.15, top: TEAM, bottom: LEG, skin: SKIN, hair: '#1c1714', hat: IRON, hatStyle: 'helmet', shoes: BOOT, detail: 'lo', build: 1.08 });
  const [hx, hy, hz] = r.handR;
  rod(g, [hx, hy - h * 0.4, hz - 0.04], [hx, hy + h * 0.72, hz + 0.06], h * 0.012, WOOD, 4);
  cone(g, STEEL, hx, hy + h * 0.72, hz + 0.06, h * 0.022, h * 0.09, 4);
  box(g, '#8a1c1c', hx, hy + h * 0.66, hz + 0.055, h * 0.02, h * 0.04, h * 0.02);
  const [lx, ly, lz] = r.handL;
  box(g, TEAM, lx - 0.01, ly - h * 0.1, lz + 0.04, h * 0.03, h * 0.3, h * 0.17);
  box(g, '#b08a3a', lx - 0.03, ly + h * 0.02, lz + 0.04, h * 0.01, h * 0.05, h * 0.05);
}

/** Low-poly horse facing +z; returns the saddle height. */
function lowHorse(g: THREE.Group, coat: string, mane: string): number {
  sweep(g, [
    { p: [0, 0.37, -0.25], w: 0.045, h: 0.05 }, { p: [0, 0.37, -0.17], w: 0.085, h: 0.1 },
    { p: [0, 0.35, 0.02], w: 0.08, h: 0.095 }, { p: [0, 0.38, 0.17], w: 0.08, h: 0.1 }, { p: [0, 0.41, 0.24], w: 0.05, h: 0.07 },
  ], coat, { radial: 7, sub: 2 });
  tube(g, [[0, 0.4, 0.2], [0, 0.51, 0.28], [0, 0.61, 0.32]], 0.05, 0.034, coat, { radial: 6, sub: 2 });
  tube(g, [[0, 0.63, 0.31], [0, 0.59, 0.39], [0, 0.55, 0.45]], 0.036, 0.024, coat, { radial: 6, sub: 1 });
  for (const sx of [-1, 1]) cone(g, coat, sx * 0.018, 0.65, 0.31, 0.01, 0.04, 4);
  tube(g, [[0, 0.66, 0.3], [0, 0.59, 0.27], [0, 0.49, 0.21]], 0.016, 0.012, mane, { radial: 4, sub: 1 });
  tube(g, [[0, 0.39, -0.25], [0, 0.31, -0.3], [0, 0.19, -0.31]], 0.022, 0.012, mane, { radial: 4, sub: 1 });
  const legs: [number, number, number][] = [[-0.05, 0.17, 0.05], [0.05, 0.17, -0.06], [-0.05, -0.18, -0.05], [0.05, -0.18, 0.06]];
  for (const [x, z, sw] of legs) {
    tube(g, [[x, 0.35, z], [x, 0.18, z + sw * 0.6], [x, 0.03, z + sw]], 0.03, 0.016, coat, { radial: 5, sub: 1 });
    cyl(g, '#1c1917', x, 0, z + sw, 0.02, 0.03, 5);
  }
  box(g, TEAM, 0, 0.42, 0.0, 0.175, 0.03, 0.2);
  return 0.46;
}

function horseman(g: THREE.Group): void {
  const seat = lowHorse(g, '#6b4426', '#2a1a10');
  const h = 0.5;
  const r = human(g, 0, seat - h * 0.45, -0.02, {
    h, pose: 'sit', top: TEAM, bottom: LEG, skin: SKIN, hair: '#1c1714', hat: IRON, hatStyle: 'helmet', shoes: BOOT, detail: 'lo',
    feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: [[-0.1, 0.42, 0.3], [0.12, 0.45, 0.25]],
  });
  const [hx, hy, hz] = r.handR;
  rod(g, [hx, hy - 0.14, hz - 0.14], [hx, hy + 0.34, hz + 0.2], 0.006, WOOD, 4);
  cone(g, STEEL, hx, hy + 0.34, hz + 0.2, 0.01, 0.05, 4).rotation.x = 0.62;
  }

let soldierGeo: THREE.BufferGeometry | null = null;
let riderGeo: THREE.BufferGeometry | null = null;
export const soldierGeometry = (): THREE.BufferGeometry => (soldierGeo ??= bake(spearman));
export const riderGeometry = (): THREE.BufferGeometry => (riderGeo ??= bake(horseman, 1.25));

/** Vertex-coloured standard material whose instance colour tints only the `team` parts. */
export function troopMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05, transparent: true });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float team;')
      .replace('#include <color_vertex>', `vColor = vColor - vColor + 1.0;
#ifdef USE_COLOR
  vColor.rgb *= color.rgb;
#endif
#ifdef USE_INSTANCING_COLOR
  vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, team);
#endif`);
  };
  m.customProgramCacheKey = () => 'troop-team';
  return m;
}
