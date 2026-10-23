import * as THREE from 'three';
import { C, anim, ball, box, cbox, cone, cyl, fire, flag, gable, lathe, person, rod, roof, shadeHex, slab, smoke, str, wheel, type Builder } from './prims.ts';

const ground = (p: THREE.Object3D, w: number, d: number, c: string = C.earth) => box(p, c, 0, -0.02, 0, w, 0.04, d);

/** Hall: platform, red columns, walls and a hip roof (optionally double-eaved). */
export function hall(p: THREE.Object3D, w: number, d: number, h: number, roofC: string, double = false, x = 0, y = 0, z = 0): void {
  box(p, C.white, x, y, z, w * 1.15, h * 0.18, d * 1.2);
  const cy = y + h * 0.18;
  box(p, C.vermilion, x, cy, z, w * 0.92, h * 0.5, d * 0.85);
  const cols = 6;
  for (let i = 0; i < cols; i++) {
    const cx = x - w * 0.48 + (i / (cols - 1)) * w * 0.96;
    cyl(p, C.vermilion, cx, cy, z + d * 0.5, w * 0.02, h * 0.5, 6);
  }
  // door/window bands
  box(p, C.gold, x, cy + h * 0.44, z + d * 0.43, w * 0.92, h * 0.06, 0.01);
  if (double) {
    roof(p, roofC, x, cy + h * 0.48, z, w * 1.25, d * 1.35, h * 0.2, 0.5, 0.75);
    box(p, C.vermilion, x, cy + h * 0.62, z, w * 0.75, h * 0.16, d * 0.7);
    roof(p, roofC, x, cy + h * 0.76, z, w * 1.12, d * 1.15, h * 0.32, 0.5, 0.35);
  } else {
    roof(p, roofC, x, cy + h * 0.48, z, w * 1.25, d * 1.35, h * 0.36, 0.5, 0.35);
  }
}

export const ANCIENT: Record<string, Builder> = {
  cave: p => {
    ball(p, '#8a7d6b', 0, 0.25, -0.1, 1.3, 0.85, 1.0);
    ball(p, '#7a6e5d', 0.35, 0.18, 0.1, 0.6, 0.45, 0.6);
    slab(p, '#2a221b', [[-0.18, 0], [0.18, 0], [0.14, 0.24], [0, 0.32], [-0.14, 0.24]], 0.2, 0, 0, 0.4);
    ground(p, 1.4, 1.2, '#9a8a6a');
    fire(p, 0.05, 0.02, 0.62, 0.09);
    for (let i = 0; i < 5; i++) rod(p, C.darkwood, [Math.cos(i) * 0.08, 0, 0.62 + Math.sin(i) * 0.08], [0.05, 0.06, 0.62], 0.01);
    person(p, -0.3, 0.6, 0.55, '#7a5a3a', null, 0.6);
    person(p, 0.38, 0.55, 0.5, '#6d4f33', null, -0.7);
  },

  hut: p => {
    ground(p, 1.2, 1.2);
    cyl(p, '#9b7b55', 0, 0, 0, 0.42, 0.18, 14);
    cone(p, C.thatch, 0, 0.18, 0, 0.55, 0.62, 14);
    cone(p, shadeHex(C.thatch, 0.8), 0, 0.72, 0, 0.08, 0.14, 8);
    box(p, '#3a2a1a', 0, 0, 0.4, 0.16, 0.22, 0.08);
    lathe(p, '#b5653a', [[0, 0], [0.06, 0.01], [0.09, 0.08], [0.06, 0.14], [0.04, 0.16]], 0.55, 0, 0.3, 10);
    person(p, -0.45, 0.4, 0.5, '#8a6a45', null);
  },

  stilt: p => {
    ground(p, 1.3, 1.0, '#7b9a6a');
    box(p, C.water, 0, -0.01, 0.35, 1.3, 0.02, 0.3, 0, { opacity: 0.8 });
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) cyl(p, C.darkwood, -0.4 + i * 0.2, 0, -0.2 + j * 0.2, 0.025, 0.28, 6);
    box(p, C.wood, 0, 0.28, 0, 1.0, 0.04, 0.55);
    box(p, '#a07a4a', 0, 0.32, -0.02, 0.8, 0.26, 0.4);
    gable(p, C.thatch, 0, 0.58, -0.02, 1.0, 0.62, 0.36);
    rod(p, C.wood, [0.45, 0, 0.35], [0.4, 0.3, 0.2], 0.02);
  },

  jade: p => {
    cyl(p, C.darkwood, 0, 0, 0, 0.3, 0.08, 16);
    lathe(p, C.jade, [[0.16, 0], [0.42, 0], [0.42, 0.06], [0.16, 0.06]], 0, 0, 0, 32, { smooth: true, rough: 0.3 }).rotation.x = Math.PI / 2;
    const disc = p.children[p.children.length - 1];
    disc.position.set(0, 0.52, 0);
    box(p, C.darkwood, 0, 0.08, 0, 0.12, 0.04, 0.12);
    // cong (tube) beside the bi
    box(p, shadeHex(C.jade, 0.85), 0.5, 0, 0.1, 0.18, 0.42, 0.18, 0, { smooth: true, rough: 0.3 });
    cyl(p, shadeHex(C.jade, 0.7), 0.5, 0.42, 0.1, 0.07, 0.04, 12);
  },

  ding: (p, r) => {
    const c = str(r.color, C.bronze);
    box(p, c, 0, 0.3, 0, 0.8, 0.5, 0.56, 0, { metal: 0.5, rough: 0.5 });
    box(p, shadeHex(c, 0.75), 0, 0.56, 0, 0.84, 0.06, 0.6, 0, { metal: 0.5 });
    box(p, shadeHex(c, 0.7), 0, 0.38, 0.285, 0.6, 0.18, 0.02);
    for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) cyl(p, c, x, 0, z, 0.06, 0.32, 8, { metal: 0.5 });
    for (const x of [-0.26, 0.26]) {
      slab(p, c, [[-0.1, 0], [0.1, 0], [0.1, 0.22], [-0.1, 0.22], [-0.1, 0], [-0.06, 0.04], [-0.06, 0.18], [0.06, 0.18], [0.06, 0.04], [-0.06, 0.04]], 0.04, x, 0.6, 0);
    }
  },

  oracle: p => {
    ball(p, '#d8c49a', 0, 0.06, 0, 0.9, 0.12, 1.1, { smooth: true });
    for (let i = 0; i < 9; i++) {
      const x = -0.25 + (i % 3) * 0.25, z = -0.3 + Math.floor(i / 3) * 0.3;
      cbox(p, '#5a3a1a', x, 0.12, z, 0.015, 0.01, 0.12, 0.3 * i);
      cbox(p, '#5a3a1a', x + 0.03, 0.12, z, 0.06, 0.01, 0.012);
    }
    for (let i = 0; i < 6; i++) cbox(p, '#2b1a0a', 0.36, 0.12, -0.3 + i * 0.1, 0.05, 0.01, 0.04, i);
  },

  chariot: p => {
    box(p, C.wood, 0, 0.3, -0.05, 0.5, 0.06, 0.4);
    for (const x of [-0.25, 0.25]) box(p, C.darkwood, x, 0.36, -0.05, 0.02, 0.16, 0.4);
    box(p, C.darkwood, 0, 0.36, -0.25, 0.5, 0.16, 0.02);
    rod(p, C.darkwood, [-0.36, 0.25, -0.05], [0.36, 0.25, -0.05], 0.02);
    wheel(p, -0.34, 0.25, -0.05, 0.25, C.darkwood, 12);
    wheel(p, 0.34, 0.25, -0.05, 0.25, C.darkwood, 12);
    rod(p, C.darkwood, [0, 0.33, 0.15], [0, 0.42, 0.85], 0.02);
    rod(p, C.darkwood, [-0.3, 0.42, 0.8], [0.3, 0.42, 0.8], 0.018);
    for (const x of [-0.16, 0.16]) horse(p, x, 0.75, 0.75, '#6b4a2b');
    person(p, 0.05, -0.05, 0.75, '#6d5a3a', C.bronze).position.y = 0.33;
    flag(p, -0.2, 0.33, -0.2, 0.7, C.red, 0.3);
  },

  bell: p => {
    for (const x of [-0.55, 0.55]) box(p, C.darkwood, x, 0, 0, 0.06, 0.85, 0.08);
    box(p, C.darkwood, 0, 0.82, 0, 1.25, 0.06, 0.1);
    box(p, C.darkwood, 0, 0.5, 0, 1.15, 0.05, 0.08);
    for (let row = 0; row < 2; row++) {
      const n = row ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const s = row ? 0.75 + 0.35 * (i / n) : 0.5 + 0.2 * (i / n);
        const x = -0.45 + (i / (n - 1)) * 0.9, top = row ? 0.5 : 0.82;
        lathe(p, C.bronzeGold, [[0, 0.24 * s], [0.05 * s, 0.24 * s], [0.08 * s, 0.12 * s], [0.1 * s, 0], [0, 0]], x, top - 0.25 * s, 0, 8, { metal: 0.5, rough: 0.45 });
      }
    }
    // bronze figure caryatids
    for (const x of [-0.55, 0.55]) person(p, x, 0.12, 0.6, C.bronzeGold, null);
  },

  wall: p => {
    // a wall segment climbing a ridge with a watchtower
    const seg = (x0: number, x1: number, y0: number, y1: number) => {
      const n = 4;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const xa = x0 + (x1 - x0) * t0, xb = x0 + (x1 - x0) * t1, ya = y0 + (y1 - y0) * t0;
        box(p, '#9a9285', (xa + xb) / 2, -0.4 + ya, 0, Math.abs(xb - xa) + 0.01, 0.62, 0.18);
        for (let k = 0; k < 2; k++) box(p, '#8c8478', xa + (xb - xa) * (0.25 + k * 0.5), 0.22 + ya, 0.07, 0.07, 0.06, 0.04);
      }
    };
    ball(p, '#7d8a5a', 0, -0.3, 0, 2.2, 0.8, 0.9);
    seg(-0.95, -0.15, 0.0, 0.18);
    seg(0.15, 0.95, 0.18, 0.02);
    box(p, '#a39a8c', 0, -0.2, 0, 0.32, 0.72, 0.3);
    box(p, '#8f877b', 0, 0.52, 0, 0.36, 0.05, 0.34);
    roof(p, C.tile, 0, 0.56, 0, 0.36, 0.34, 0.12, 0.4);
    flag(p, 0.12, 0.66, 0.1, 0.3, C.red, 0.16);
  },

  beacon: p => {
    ball(p, '#7d8a5a', 0, -0.2, 0, 1.0, 0.5, 1.0);
    lathe(p, '#a08a6a', [[0.3, 0], [0.24, 0.55], [0.26, 0.58], [0, 0.58]], 0, 0, 0, 10);
    fire(p, 0, 0.58, 0, 0.12);
    smoke(p, 0, 0.75, 0, 0.18, '#5a5a5a');
    person(p, 0.35, 0.2, 0.5, '#6a5a4a', C.red);
  },

  palace: (p, r) => {
    box(p, C.white, 0, 0, 0, 1.3, 0.08, 0.95);
    box(p, C.white, 0, 0.08, 0, 1.1, 0.08, 0.8);
    box(p, C.white, 0, 0.16, 0.05, 0.9, 0.06, 0.62);
    hall(p, 0.78, 0.42, 0.7, str(r.roof, C.glaze), true, 0, 0.22, 0);
    box(p, C.white, 0, 0, 0.55, 0.22, 0.2, 0.25);
  },

  gate: p => {
    box(p, C.vermilion, 0, 0, 0, 1.2, 0.32, 0.4);
    for (let i = -2; i <= 2; i++) slab(p, '#3a1a12', [[-0.05, 0], [0.05, 0], [0.05, 0.12], [0, 0.16], [-0.05, 0.12]], 0.02, i * 0.2, 0, 0.205);
    box(p, C.white, 0, 0.32, 0, 1.22, 0.03, 0.42);
    hall(p, 0.85, 0.3, 0.5, C.glaze, true, 0, 0.34, 0);
    for (const x of [-0.45, 0.45]) {
      box(p, C.white, x, 0, 0.55, 0.06, 0.3, 0.06);
      ball(p, C.white, x, 0.32, 0.55, 0.06);
    }
    box(p, '#c9c1b1', 0, -0.01, 0.55, 0.3, 0.02, 0.5);
  },

  pagoda: p => {
    const tiers = 7;
    box(p, C.stone, 0, 0, 0, 0.7, 0.08, 0.7);
    let y = 0.08;
    for (let i = 0; i < tiers; i++) {
      const s = 0.42 * (1 - i * 0.075), h = i === 0 ? 0.2 : 0.12;
      cyl(p, i % 2 ? '#c2a77a' : '#b8996a', 0, y, 0, s / 2, h, 8);
      roof(p, C.tile, 0, y + h, 0, s * 1.35, s * 1.35, 0.05, 0.6, 0.5);
      y += h + 0.05;
    }
    cyl(p, C.gold, 0, y, 0, 0.012, 0.18, 6);
    for (let i = 0; i < 4; i++) ball(p, C.gold, 0, y + 0.03 + i * 0.035, 0, 0.05 - i * 0.008);
  },

  warrior: p => {
    box(p, '#9c8a72', 0, 0, 0, 0.28, 0.04, 0.24);
    const g = person(p, 0, 0, 2.0, C.terracotta, C.terracotta, 0, '#b47c58');
    g.position.y = 0.04;
    box(g, '#8f5b3d', 0, 0.16, 0.04, 0.24, 0.12, 0.16);
    rod(g, C.terracotta, [0.12, 0.24, 0.04], [0.15, 0.13, 0.12], 0.025);
    rod(g, C.darkwood, [0.15, 0.0, 0.12], [0.15, 0.6, 0.12], 0.008);
    for (let i = 0; i < 4; i++) {
      const w = person(p, -0.45 + (i % 2) * 0.9, -0.35 - Math.floor(i / 2) * 0.3, 1.3, C.terracotta, C.terracotta, 0, '#b47c58');
      w.position.y = 0;
    }
  },

  camel: (p, r) => {
    const c = str(r.color, '#b88a52');
    ball(p, c, 0, 0.45, 0, 0.36, 0.26, 0.62);
    for (const z of [-0.12, 0.12]) ball(p, shadeHex(c, 0.9), 0, 0.6, z, 0.18, 0.2, 0.18);
    rod(p, c, [0, 0.5, 0.28], [0, 0.72, 0.42], 0.05);
    ball(p, c, 0, 0.74, 0.47, 0.1, 0.09, 0.16);
    for (const [x, z] of [[-0.1, -0.2], [0.1, -0.2], [-0.1, 0.2], [0.1, 0.2]]) rod(p, shadeHex(c, 0.85), [x, 0.4, z], [x, 0, z], 0.035);
    for (const x of [-0.2, 0.2]) box(p, '#7d3c2a', x, 0.42, 0, 0.1, 0.18, 0.3);
    box(p, '#c0a060', 0, 0.68, 0, 0.32, 0.06, 0.12);
    if (r.rider !== false) {
      const rd = person(p, 0, 0, 0.8, str(r.robe, '#5d4a7a'), C.black);
      rd.position.set(0, 0.62, 0.0);
    }
  },

  rider: (p, r) => {
    horse(p, 0, 0, 1.1, str(r.color, '#5a3a22'));
    const rd = person(p, 0, 0, 0.9, str(r.robe, C.red), C.black);
    rd.position.set(0, 0.42, -0.02);
    flag(p, 0.12, 0.42, -0.1, 0.55, str(r.flag, C.red), 0.22);
  },

  army: (p, r) => {
    const c = str(r.color, C.red);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
      const x = -0.36 + j * 0.24 + (i % 2) * 0.08, z = -0.3 + i * 0.28;
      person(p, x, z, 0.8, c, C.black);
      rod(p, C.darkwood, [x + 0.07, 0, z + 0.03], [x + 0.07, 0.62, z + 0.03], 0.008);
      cone(p, C.steel, x + 0.07, 0.62, z + 0.03, 0.015, 0.05, 4);
    }
    flag(p, 0, 0, -0.5, 0.9, c, 0.36);
  },

  boat: (p, r) => {
    const g = anim(p, 'bob', 0, 0, 0);
    slab(g, str(r.color, C.wood), [[-0.55, 0.14], [-0.45, 0], [0.45, 0], [0.6, 0.16], [0.4, 0.1], [-0.4, 0.1]], 0.28, 0, 0, 0, Math.PI / 2);
    box(g, '#c8a96a', 0, 0.1, -0.1, 0.22, 0.14, 0.3);
    gable(g, C.thatch, 0, 0.24, -0.1, 0.3, 0.26, 0.1);
    for (const x of [-0.18, 0.18]) {
      const o = anim(g, 'sway', x, 0.12, 0.15, { amp: 0.4, speed: 2.5 });
      rod(o, C.darkwood, [0, 0, 0], [x * 2, -0.1, 0.25], 0.01);
    }
    person(g, 0, 0.3, 0.6, '#3f5a7a', C.black).position.y = 0.1;
  },

  fireship: p => {
    const g = anim(p, 'bob', 0, 0, 0);
    slab(g, C.darkwood, [[-0.6, 0.14], [-0.5, 0], [0.5, 0], [0.65, 0.18], [0.45, 0.12], [-0.45, 0.12]], 0.34, 0, 0, 0, Math.PI / 2);
    for (let i = 0; i < 6; i++) box(g, '#8a7a4a', -0.15 + (i % 2) * 0.3, 0.12, -0.35 + i * 0.13, 0.18, 0.1, 0.1);
    rod(g, C.darkwood, [0, 0.12, 0], [0, 0.9, 0], 0.015);
    box(g, C.sail, 0, 0.35, 0.02, 0.4, 0.45, 0.01);
    for (let i = 0; i < 4; i++) fire(g, -0.12 + (i % 2) * 0.24, 0.2, -0.3 + i * 0.18, 0.12);
    smoke(g, 0, 0.6, -0.2, 0.2, '#555555');
  },

  junk: (p, r) => {
    const g = anim(p, 'bob', 0, 0, 0);
    const hull = str(r.color, '#7a4a2a');
    slab(g, hull, [[-0.62, 0.3], [-0.5, 0.04], [-0.3, 0], [0.3, 0], [0.52, 0.06], [0.66, 0.34], [0.4, 0.24], [-0.45, 0.24]], 0.36, 0, 0, 0, Math.PI / 2);
    box(g, C.vermilion, 0, 0.22, -0.48, 0.34, 0.16, 0.2);
    box(g, C.vermilion, 0, 0.22, 0.48, 0.3, 0.1, 0.14);
    box(g, C.gold, 0, 0.38, -0.48, 0.36, 0.02, 0.22);
    const masts: [number, number][] = [[0.36, 0.7], [0.08, 1.0], [-0.2, 0.86], [-0.42, 0.6]];
    for (const [z, h] of masts) {
      rod(g, C.darkwood, [0, 0.22, z], [0, 0.22 + h, z], 0.015);
      const s = anim(g, 'sway', 0, 0.22 + h * 0.55, z, { amp: 0.08, speed: 0.9 });
      box(s, '#b53a2a', 0, -h * 0.4, 0, h * 0.42, h * 0.75, 0.01, Math.PI / 2);
      for (let k = 0; k < 4; k++) box(s, '#7a2a1a', 0, -h * 0.35 + k * h * 0.18, 0, 0.008, 0.008, h * 0.44);
    }
    flag(g, 0, 0.38, -0.56, 0.3, C.red, 0.14);
  },

  weir: p => {
    box(p, C.water, 0, -0.02, 0, 1.6, 0.03, 1.2, 0, { opacity: 0.8 });
    slab(p, '#8a7a5a', [[0, 0.5], [0.12, 0.2], [0.14, -0.6], [-0.14, -0.6], [-0.12, 0.2]], 0.1, 0, 0, 0, 0);
    p.children[p.children.length - 1].rotation.x = -Math.PI / 2;
    for (let i = 0; i < 7; i++) {
      const z = 0.3 - i * 0.14;
      cyl(p, '#b39b6a', -0.05, 0.02, z, 0.045, 0.06, 8);
      cyl(p, '#b39b6a', 0.05, 0.02, z, 0.045, 0.06, 8);
    }
    ball(p, '#6b8a4a', -0.75, 0.05, -0.2, 0.4, 0.4, 1.2);
    ball(p, '#6b8a4a', 0.75, 0.05, -0.1, 0.4, 0.5, 1.4);
    hall(p, 0.22, 0.14, 0.2, C.tile, false, -0.6, 0.18, 0.35);
    person(p, 0.3, 0.4, 0.6, '#4a5a3a', C.black);
  },

  bridge: p => {
    box(p, C.water, 0, -0.04, 0, 1.4, 0.03, 0.8, 0, { opacity: 0.8 });
    const arch: [number, number][] = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); arch.push([-Math.cos(a) * 0.4, Math.sin(a) * 0.22]); }
    slab(p, '#b0a898', [[-0.75, -0.04], [0.75, -0.04], [0.75, 0.24], [0.4, 0.3], [-0.4, 0.3], [-0.75, 0.24]], 0.32, 0, 0, 0, 0,
      [[...arch.map(([x, y]): [number, number] => [x, y - 0.04]).reverse()]]);
    for (const x of [-0.6, 0.6]) slab(p, '#3a5a6a', [[-0.07, -0.04], [0.07, -0.04], [0.07, 0.07], [0, 0.11], [-0.07, 0.07]], 0.34, x, 0, 0);
    for (const z of [-0.15, 0.15]) {
      for (let i = 0; i < 9; i++) {
        const x = -0.6 + i * 0.15;
        const y = 0.24 + 0.06 * (1 - Math.pow(x / 0.75, 2));
        box(p, '#a39c8c', x, y, z, 0.03, 0.08, 0.03);
        ball(p, '#a39c8c', x, y + 0.1, z, 0.04);
      }
    }
  },

  scroll: p => {
    box(p, C.paper, 0, 0.02, 0, 1.0, 0.01, 0.5, 0, { smooth: true });
    for (const x of [-0.52, 0.52]) {
      cyl(p, '#7a2a1a', x, 0.04, 0, 0.04, 0.56, 10).rotation.x = Math.PI / 2;
      p.children[p.children.length - 1].position.set(x, 0.05, 0);
    }
    for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) box(p, C.ink, 0.38 - i * 0.09, 0.03, -0.18 + j * 0.06, 0.04, 0.004, 0.035);
    box(p, C.red, -0.38, 0.03, 0.16, 0.06, 0.005, 0.06);
  },

  temple: (p, r) => {
    box(p, C.stone, 0, 0, 0, 1.0, 0.1, 0.8);
    hall(p, 0.62, 0.4, 0.55, str(r.roof, C.tile), false, 0, 0.1, -0.05);
    // incense burner and stupa
    lathe(p, C.bronze, [[0, 0], [0.06, 0], [0.08, 0.06], [0.07, 0.12], [0.05, 0.14]], 0, 0.1, 0.35, 10);
    smoke(p, 0, 0.3, 0.35, 0.05, '#cfcfcf');
    lathe(p, C.white, [[0.12, 0], [0.12, 0.08], [0.1, 0.1], [0.12, 0.2], [0.04, 0.32], [0.02, 0.45], [0, 0.48]], 0.42, 0.1, 0.25, 12);
    for (const x of [-0.42, 0.42]) { rod(p, C.darkwood, [x, 0.1, 0.35], [x, 0.5, 0.35], 0.01); }
  },

  seismoscope: p => {
    box(p, C.darkwood, 0, 0, 0, 0.8, 0.05, 0.8);
    lathe(p, C.bronzeGold, [[0.2, 0], [0.32, 0.12], [0.34, 0.32], [0.28, 0.5], [0.18, 0.56], [0.2, 0.62], [0, 0.66]], 0, 0.05, 0, 16, { metal: 0.5, rough: 0.45 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      rod(p, C.bronze, [c * 0.3, 0.5, s * 0.3], [c * 0.42, 0.42, s * 0.42], 0.025);
      ball(p, C.bronzeGold, c * 0.43, 0.41, s * 0.43, 0.04);
      ball(p, C.bronze, c * 0.44, 0.1, s * 0.44, 0.09, 0.07, 0.09);
    }
  },

  printing: p => {
    box(p, C.darkwood, 0, 0, 0, 0.9, 0.06, 0.7);
    box(p, '#6b4a2a', 0, 0.06, 0, 0.8, 0.04, 0.6);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 7; j++) {
      if ((i * 7 + j) % 11 === 3) continue;
      box(p, '#c8a878', -0.36 + i * 0.08, 0.1, -0.24 + j * 0.08, 0.065, 0.06, 0.065);
    }
    box(p, C.paper, 0.6, 0.0, 0.1, 0.35, 0.01, 0.45, 0.2);
    person(p, -0.6, 0.2, 0.7, '#5a6a8a', C.black, 0.8);
  },

  compass: p => {
    box(p, C.bronzeGold, 0, 0, 0, 0.9, 0.05, 0.9, 0, { metal: 0.4 });
    cyl(p, '#c9a75a', 0, 0.05, 0, 0.26, 0.012, 24);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      box(p, C.ink, Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36, 0.03, 0.006, 0.02, -a);
    }
    const sp = new THREE.Group();
    sp.position.y = 0.09;
    ball(sp, '#3a3a3a', 0, 0, 0, 0.2, 0.08, 0.2, { smooth: true, metal: 0.6, rough: 0.3 });
    rod(sp, '#3a3a3a', [0, 0.01, 0.06], [0, 0.0, 0.3], 0.02, 6, { metal: 0.6 });
    p.add(sp);
  },

  tent: (p, r) => {
    const c = str(r.color, '#e8dcc0');
    box(p, '#a08a6a', 0, -0.01, 0, 1.2, 0.02, 1.0);
    cone(p, c, 0, 0, 0, 0.45, 0.55, 8);
    cyl(p, '#b03a2e', 0, 0.12, 0, 0.452, 0.04, 8);
    box(p, '#3a2a1a', 0, 0, 0.36, 0.14, 0.2, 0.06);
    flag(p, 0, 0.55, 0, 0.3, str(r.flag, C.red), 0.14);
    horse(p, 0.55, 0.25, 0.8, '#7a5a3a');
    person(p, -0.5, 0.3, 0.7, '#b03a2e', C.gold, 0.4);
  },

  yurt: p => {
    box(p, '#7d8a5a', 0, -0.01, 0, 1.2, 0.02, 1.2);
    cyl(p, '#efe7d6', 0, 0, 0, 0.42, 0.28, 18);
    lathe(p, '#e4dccb', [[0.43, 0], [0.3, 0.12], [0.1, 0.2], [0, 0.21]], 0, 0.28, 0, 18);
    cyl(p, '#2e5f8a', 0, 0.12, 0, 0.425, 0.04, 18);
    box(p, '#b03a2e', 0, 0, 0.41, 0.14, 0.2, 0.04);
    smoke(p, 0, 0.55, 0, 0.08);
    horse(p, 0.6, -0.2, 0.8, '#3a2a1a');
    flag(p, -0.55, 0, 0.4, 0.75, '#ecf0f1', 0.18);
  },
};

/** A simple horse facing +z; s scales it (≈ 0.75 tall at s = 1). */
export function horse(p: THREE.Object3D, x: number, z: number, s: number, c: string): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  ball(g, c, 0, 0.42, 0, 0.2, 0.2, 0.46);
  rod(g, c, [0, 0.46, 0.18], [0, 0.66, 0.3], 0.06);
  ball(g, c, 0, 0.66, 0.36, 0.09, 0.09, 0.2);
  box(g, '#222222', 0, 0.52, 0.2, 0.02, 0.18, 0.12);
  rod(g, '#222222', [0, 0.46, -0.22], [0, 0.3, -0.3], 0.02);
  for (const [lx, lz] of [[-0.06, -0.14], [0.06, -0.14], [-0.06, 0.14], [0.06, 0.14]]) rod(g, shadeHex(c, 0.85), [lx, 0.38, lz], [lx, 0, lz], 0.025);
  p.add(g);
}
