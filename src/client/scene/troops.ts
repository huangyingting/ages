import * as THREE from 'three';
import { human, type HumanOpts } from '../models/human.ts';
import type { Era } from '../../shared/data/era.ts';
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

/** Troop types drawn in formations. */
export type UnitType = 'spear' | 'archer' | 'horse' | 'chariot' | 'gun';

/** Dark team colour: armour and trousers take a darker shade of the side's colour. */
const TEAM_DK = '#990099', TEAM_MID = '#bb00bb';

interface Kit {
  hat: string; hatStyle: HumanOpts['hatStyle']; hatBadge?: string; armor?: string; armorTrim?: string; badge?: string;
  bottom: string; shield: boolean; missile: 'bow' | 'crossbow'; pole: 'spear' | 'ji'; boots: string;
}

/** How soldiers of each period were equipped: helmets, armour, shields, polearms and missile weapons. */
function kit(e: Era): Kit {
  const base = { bottom: LEG, shield: true, missile: 'bow' as const, pole: 'spear' as const, boots: BOOT };
  switch (e) {
    case 'xianqin': return { ...base, hat: '#8a6a3a', hatStyle: 'helmet', armor: '#6b4a2e', armorTrim: '#4a3220', pole: 'ji' };
    case 'qinhan': return { ...base, hat: '#1c1714', hatStyle: 'knot', armor: '#3a3128', armorTrim: '#b08a3a', missile: 'crossbow', pole: 'ji' };
    case 'weijin': return { ...base, hat: IRON, hatStyle: 'helmet', armor: TEAM_DK, armorTrim: '#3a3a40' };
    case 'suitang': return { ...base, hat: '#8a8f96', hatStyle: 'plume', armor: TEAM_DK, armorTrim: '#c9a227' };
    case 'song': return { ...base, hat: IRON, hatStyle: 'plume', armor: TEAM_DK, armorTrim: '#4a4d52', missile: 'crossbow' };
    case 'yuan': return { ...base, hat: '#6b6f76', hatStyle: 'fur', armor: '#6b4a2e', armorTrim: '#3a2a1c', shield: false };
    case 'ming': return { ...base, hat: '#5b6068', hatStyle: 'bowl', armor: TEAM_MID, armorTrim: '#d6b25e' };
    case 'qing': return { ...base, hat: '#2a2420', hatStyle: 'qing', badge: '#f1ece0', shield: false };
    case 'minguo': return { ...base, hat: TEAM_DK, hatStyle: 'peaked', bottom: TEAM_DK, shield: false, boots: '#3a3128' };
    default: return { ...base, hat: TEAM_DK, hatStyle: 'peaked', hatBadge: '#e11d48', bottom: TEAM_DK, shield: false, boots: '#3a3128' };
  }
}

function trooper(g: THREE.Group, e: Era, k: Kit, o: Partial<HumanOpts> & { h: number }) {
  return human(g, 0, 0, 0, {
    top: TEAM, bottom: k.bottom, skin: SKIN, hair: '#1c1714', hat: k.hat, hatStyle: k.hatStyle, hatBadge: k.hatBadge,
    armor: k.armor, armorTrim: k.armorTrim, badge: k.badge, shoes: k.boots, detail: 'lo', build: 1.08, ...o,
  });
}

function spearman(g: THREE.Group, e: Era): void {
  const k = kit(e), h = 0.8;
  const r = trooper(g, e, k, { h, pose: 'walk', phase: 0.15 });
  const [hx, hy, hz] = r.handR;
  rod(g, [hx, hy - h * 0.4, hz - 0.04], [hx, hy + h * 0.72, hz + 0.06], h * 0.012, WOOD, 4);
  cone(g, STEEL, hx, hy + h * 0.72, hz + 0.06, h * 0.022, h * 0.09, 4);
  if (k.pole === 'ji') box(g, STEEL, hx, hy + h * 0.64, hz + 0.08, h * 0.01, h * 0.025, h * 0.08); // 戟 side blade
  else box(g, '#8a1c1c', hx, hy + h * 0.66, hz + 0.055, h * 0.02, h * 0.04, h * 0.02);
  if (k.shield) {
    const [lx, ly, lz] = r.handL;
    box(g, TEAM, lx - 0.01, ly - h * 0.1, lz + 0.04, h * 0.03, h * 0.3, h * 0.17);
    box(g, '#b08a3a', lx - 0.03, ly + h * 0.02, lz + 0.04, h * 0.01, h * 0.05, h * 0.05);
  }
}

/** Bowman (bow held out in the left hand, quiver on the back) or crossbowman (弩 levelled at the chest). */
function archer(g: THREE.Group, e: Era): void {
  const k = kit(e), h = 0.8;
  if (k.missile === 'crossbow') {
    const r = trooper(g, e, k, { h, pose: 'stand', hands: [[-0.04, 0.6, 0.2], [0.05, 0.56, 0.12]] });
    const [hx, hy, hz] = r.handL;
    box(g, WOOD, hx + 0.03, hy, hz - 0.06, h * 0.02, h * 0.02, h * 0.3);
    tube(g, [[hx + 0.03 - h * 0.17, hy, hz - 0.02], [hx + 0.03, hy, hz + 0.05], [hx + 0.03 + h * 0.17, hy, hz - 0.02]], h * 0.009, h * 0.007, WOOD, { radial: 4, sub: 2 });
  } else {
    const r = trooper(g, e, k, { h, pose: 'stand', hands: [[-0.02, 0.66, 0.3], [0.04, 0.62, 0.06]] });
    const [lx, ly, lz] = r.handL;
    tube(g, [[lx, ly - h * 0.28, lz - 0.04], [lx, ly, lz + 0.05], [lx, ly + h * 0.28, lz - 0.04]], h * 0.01, h * 0.008, WOOD, { radial: 4, sub: 3 });
  }
  // quiver
  rod(g, [0.04, 0.42, -0.07], [-0.02, 0.66, -0.08], 0.024, '#5a3d24', 5);
}

/** Rifleman at port arms with a fixed bayonet. */
function rifleman(g: THREE.Group, e: Era): void {
  const k = kit(e), h = 0.8;
  const r = trooper(g, e, k, { h, pose: 'walk', phase: 0.2, hands: [[-0.06, 0.55, 0.16], [0.07, 0.42, 0.1]] });
  const [lx, ly, lz] = r.handL, [rx, ry, rz] = r.handR;
  const d = new THREE.Vector3(lx - rx, ly - ry, lz - rz).normalize();
  const a: [number, number, number] = [rx - d.x * 0.08, ry - d.y * 0.08, rz - d.z * 0.08];
  const b: [number, number, number] = [lx + d.x * 0.32, ly + d.y * 0.32, lz + d.z * 0.32];
  rod(g, a, [rx + d.x * 0.1, ry + d.y * 0.1, rz + d.z * 0.1], 0.016, WOOD, 4);
  rod(g, [rx + d.x * 0.1, ry + d.y * 0.1, rz + d.z * 0.1], b, 0.008, '#2a2a2e', 4);
  rod(g, b, [b[0] + d.x * 0.12, b[1] + d.y * 0.12, b[2] + d.z * 0.12], 0.004, STEEL, 3);
  // pack
  box(g, '#5a5040', 0, 0.6, -0.085, 0.14, 0.14, 0.06);
}

/** Low-poly horse facing +z; returns the saddle height. */
function lowHorse(g: THREE.Group, coat: string, mane: string, z0 = 0): number {
  const Z = (p: [number, number, number]): [number, number, number] => [p[0], p[1], p[2] + z0];
  sweep(g, [
    { p: Z([0, 0.37, -0.25]), w: 0.045, h: 0.05 }, { p: Z([0, 0.37, -0.17]), w: 0.085, h: 0.1 },
    { p: Z([0, 0.35, 0.02]), w: 0.08, h: 0.095 }, { p: Z([0, 0.38, 0.17]), w: 0.08, h: 0.1 }, { p: Z([0, 0.41, 0.24]), w: 0.05, h: 0.07 },
  ], coat, { radial: 7, sub: 2 });
  tube(g, [Z([0, 0.4, 0.2]), Z([0, 0.51, 0.28]), Z([0, 0.61, 0.32])], 0.05, 0.034, coat, { radial: 6, sub: 2 });
  tube(g, [Z([0, 0.63, 0.31]), Z([0, 0.59, 0.39]), Z([0, 0.55, 0.45])], 0.036, 0.024, coat, { radial: 6, sub: 1 });
  for (const sx of [-1, 1]) cone(g, coat, sx * 0.018, 0.65, 0.31 + z0, 0.01, 0.04, 4);
  tube(g, [Z([0, 0.66, 0.3]), Z([0, 0.59, 0.27]), Z([0, 0.49, 0.21])], 0.016, 0.012, mane, { radial: 4, sub: 1 });
  tube(g, [Z([0, 0.39, -0.25]), Z([0, 0.31, -0.3]), Z([0, 0.19, -0.31])], 0.022, 0.012, mane, { radial: 4, sub: 1 });
  const legs: [number, number, number][] = [[-0.05, 0.17, 0.05], [0.05, 0.17, -0.06], [-0.05, -0.18, -0.05], [0.05, -0.18, 0.06]];
  for (const [x, z, sw] of legs) {
    tube(g, [Z([x, 0.35, z]), Z([x, 0.18, z + sw * 0.6]), Z([x, 0.03, z + sw])], 0.03, 0.016, coat, { radial: 5, sub: 1 });
    cyl(g, '#1c1917', x, 0, z + sw + z0, 0.02, 0.03, 5);
  }
  return 0.46;
}

function horseman(g: THREE.Group, e: Era): void {
  const k = kit(e);
  const seat = lowHorse(g, '#6b4426', '#2a1a10');
  box(g, TEAM, 0, 0.42, 0.0, 0.175, 0.03, 0.2);
  const h = 0.5;
  const r = human(g, 0, seat - h * 0.45, -0.02, {
    h, pose: 'sit', top: TEAM, bottom: k.bottom, skin: SKIN, hair: '#1c1714', hat: k.hat, hatStyle: k.hatStyle, hatBadge: k.hatBadge,
    armor: k.armor, armorTrim: k.armorTrim, badge: k.badge, shoes: k.boots, detail: 'lo',
    feet: [[-0.2, 0.05, 0.12], [0.2, 0.05, 0.12]], hands: [[-0.1, 0.42, 0.3], [0.12, 0.45, 0.25]],
  });
  const [hx, hy, hz] = r.handR;
  if (e === 'yuan') {
    // Mongol horse archer
    tube(g, [[hx, hy - 0.12, hz + 0.02], [hx + 0.02, hy, hz + 0.08], [hx, hy + 0.12, hz + 0.02]], 0.006, 0.005, WOOD, { radial: 4, sub: 2 });
  } else if (e === 'minguo' || e === 'modern' || e === 'qing') {
    rod(g, [hx, hy - 0.1, hz], [hx, hy + 0.2, hz + 0.05], 0.004, '#c9ced6', 3); // sabre
  } else {
    rod(g, [hx, hy - 0.14, hz - 0.14], [hx, hy + 0.34, hz + 0.2], 0.006, WOOD, 4);
    cone(g, STEEL, hx, hy + 0.34, hz + 0.2, 0.01, 0.05, 4).rotation.x = 0.62;
  }
}

/** Shang/Zhou war chariot: two horses, a yoke pole, a railed box on two big spoked wheels, driver and halberdier. */
function chariot(g: THREE.Group, e: Era): void {
  for (const sx of [-1, 1]) {
    const H = new THREE.Group();
    H.position.x = sx * 0.11;
    lowHorse(H, sx < 0 ? '#6b4426' : '#4a3020', '#1c140c', 0.3);
    g.add(H);
  }
  rod(g, [0, 0.36, -0.28], [0, 0.48, 0.42], 0.012, WOOD, 4); // shaft
  rod(g, [-0.2, 0.47, 0.36], [0.2, 0.47, 0.36], 0.01, WOOD, 4); // yoke
  rod(g, [-0.36, 0.22, -0.32], [0.36, 0.22, -0.32], 0.012, WOOD, 4); // axle
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 4, 16), new THREE.MeshStandardMaterial({ color: WOOD }));
    w.position.set(sx * 0.3, 0.22, -0.32); w.rotation.y = Math.PI / 2; g.add(w);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; rod(g, [sx * 0.3, 0.22 + Math.cos(a) * 0.2, -0.32 + Math.sin(a) * 0.2], [sx * 0.3, 0.22 - Math.cos(a) * 0.2, -0.32 - Math.sin(a) * 0.2], 0.005, WOOD, 3); }
  }
  box(g, WOOD, 0, 0.27, -0.32, 0.4, 0.03, 0.26); // floor
  box(g, TEAM, 0, 0.36, -0.2, 0.4, 0.15, 0.02); // front rail
  for (const sx of [-1, 1]) box(g, TEAM, sx * 0.2, 0.36, -0.32, 0.02, 0.15, 0.26);
  const k = kit(e);
  for (const [x, z, pole] of [[-0.08, -0.3, false], [0.1, -0.36, true]] as const) {
    const r = human(g, x, 0.285, z, { h: 0.5, pose: 'stand', top: TEAM, bottom: k.bottom, skin: SKIN, hair: '#1c1714', hat: k.hat, hatStyle: k.hatStyle, armor: k.armor, armorTrim: k.armorTrim, shoes: k.boots, detail: 'lo', hands: pole ? undefined : [[-0.08, 0.6, 0.25], [0.08, 0.6, 0.25]] });
    if (pole) {
      const [hx, hy, hz] = r.handR;
      rod(g, [hx, hy - 0.15, hz], [hx, hy + 0.45, hz + 0.05], 0.006, WOOD, 4);
      box(g, STEEL, hx, hy + 0.42, hz + 0.08, 0.006, 0.015, 0.06);
    }
  }
}

const BUILD: Record<UnitType, (g: THREE.Group, e: Era) => void> = { spear: spearman, archer, horse: horseman, chariot, gun: rifleman };
const SCALE: Record<UnitType, number> = { spear: 1, archer: 1, horse: 1.25, chariot: 1.25, gun: 1 };
const cache = new Map<string, THREE.BufferGeometry>();

/** Baked troop geometry for a unit type in a period (cached). */
export function unitGeometry(type: UnitType, era: Era): THREE.BufferGeometry {
  const key = `${type}|${era}`;
  let geo = cache.get(key);
  if (!geo) cache.set(key, (geo = bake(gr => BUILD[type](gr, era), SCALE[type])));
  return geo;
}
export const soldierGeometry = (era: Era = 'suitang'): THREE.BufferGeometry => unitGeometry('spear', era);
export const riderGeometry = (era: Era = 'suitang'): THREE.BufferGeometry => unitGeometry('horse', era);

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
