import { C, anim, ball, box, cone, cyl, fire, flag, lathe, person, rod, roof, slab, smoke, str, wheel, type Builder } from './prims.ts';

export const MODERN: Record<string, Builder> = {
  warship: (p, r) => {
    const g = anim(p, 'bob', 0, 0, 0);
    const hull = str(r.color, '#3d4650');
    slab(g, hull, [[-0.7, 0.18], [-0.62, 0], [0.55, 0], [0.75, 0.2], [-0.7, 0.2]], 0.3, 0, 0, 0, Math.PI / 2);
    box(g, '#b8b0a0', 0, 0.2, 0, 0.26, 0.02, 1.2);
    box(g, '#d9d4c8', 0, 0.22, -0.05, 0.2, 0.14, 0.4);
    for (const z of [-0.12, 0.08]) { cyl(g, '#d9b44a', 0, 0.36, z, 0.045, 0.22, 10); cyl(g, C.black, 0, 0.58, z, 0.047, 0.03, 10); smoke(g, 0, 0.66, z, 0.08, '#3a3a3a'); }
    for (const z of [-0.45, 0.42]) {
      cyl(g, '#5a6068', 0, 0.22, z, 0.08, 0.06, 10);
      rod(g, '#2a2e33', [0, 0.26, z], [0, 0.26, z + (z > 0 ? 0.22 : -0.22)], 0.018);
    }
    rod(g, C.darkwood, [0, 0.36, 0.25], [0, 0.85, 0.25], 0.012);
    rod(g, C.darkwood, [0, 0.36, -0.3], [0, 0.75, -0.3], 0.012);
    flag(g, 0, 0.36, -0.62, 0.3, str(r.flag, '#d4ac0d'), 0.14);
  },

  cannon: p => {
    box(p, C.stone, 0, 0, 0, 1.0, 0.18, 0.6);
    box(p, C.darkwood, 0, 0.18, 0, 0.3, 0.1, 0.4);
    wheel(p, -0.18, 0.28, 0.05, 0.12, C.darkwood, 8, 0);
    wheel(p, 0.18, 0.28, 0.05, 0.12, C.darkwood, 8, 0);
    lathe(p, C.iron, [[0, 0], [0.1, 0], [0.11, 0.04], [0.085, 0.1], [0.065, 0.55], [0.075, 0.58], [0.04, 0.6], [0, 0.6]], 0, 0, 0, 12, { metal: 0.6, rough: 0.4 });
    const b = p.children[p.children.length - 1];
    b.rotation.x = Math.PI / 2 - 0.25;
    b.position.set(0, 0.33, -0.18);
    for (let i = 0; i < 4; i++) ball(p, C.black, 0.36 + (i % 2) * 0.08, 0.22, -0.15 + Math.floor(i / 2) * 0.08, 0.07);
    flag(p, -0.4, 0.18, -0.2, 0.7, C.red, 0.26);
  },

  flag: (p, r) => {
    cyl(p, C.stone, 0, 0, 0, 0.12, 0.06, 10);
    flag(p, 0, 0.06, 0, 1.0, str(r.color, '#de2910'), 0.6, '#cfcfcf');
  },

  train: (p, r) => {
    const c = str(r.color, '#2a2e33');
    for (const x of [-0.12, 0.12]) box(p, '#6a5a4a', x, 0, 0, 0.03, 0.02, 1.4);
    for (let i = 0; i < 9; i++) box(p, '#5a4a3a', 0, -0.01, -0.64 + i * 0.16, 0.36, 0.015, 0.05);
    cyl(p, c, 0, 0.2, 0.15, 0.14, 0.62, 14).rotation.x = Math.PI / 2;
    p.children[p.children.length - 1].position.set(0, 0.26, 0.15);
    box(p, c, 0, 0.12, -0.25, 0.32, 0.36, 0.26);
    box(p, '#7a1a1a', 0, 0.48, -0.25, 0.36, 0.03, 0.3);
    cyl(p, c, 0, 0.38, 0.36, 0.045, 0.16, 10);
    smoke(p, 0, 0.6, 0.36, 0.1, '#e8e8e8');
    box(p, '#c0392b', 0, 0.06, 0.48, 0.3, 0.08, 0.04);
    for (const z of [-0.25, 0.0, 0.25]) for (const x of [-0.17, 0.17]) wheel(p, x, 0.1, z, 0.1, '#7a1a1a', 8, 4);
    box(p, '#3a5a3a', 0, 0.05, -0.62, 0.3, 0.26, 0.34);
  },

  factory: p => {
    box(p, '#9a9590', 0, 0, 0, 1.4, 0.02, 1.0);
    box(p, '#a85a3a', -0.1, 0, 0, 0.9, 0.3, 0.6);
    for (let i = 0; i < 4; i++) slab(p, '#7a4a3a', [[0, 0], [0.22, 0], [0, 0.14]], 0.6, -0.55 + i * 0.22, 0.3, 0);
    for (let i = 0; i < 6; i++) box(p, '#d8c58a', -0.45 + i * 0.15, 0.1, 0.301, 0.08, 0.1, 0.01, 0, { emissive: true });
    cyl(p, '#8a4a3a', 0.5, 0, -0.15, 0.07, 0.95, 10);
    smoke(p, 0.5, 1.0, -0.15, 0.14, '#6a6a6a');
    cyl(p, '#8a4a3a', 0.5, 0, 0.2, 0.05, 0.6, 10);
    smoke(p, 0.5, 0.65, 0.2, 0.1, '#7a7a7a');
  },

  rocket: p => {
    box(p, '#7a7a78', 0, 0, 0, 0.9, 0.06, 0.9);
    for (const x of [-0.3, 0.3]) box(p, '#c0392b', x, 0.06, -0.25, 0.06, 1.1, 0.06);
    box(p, '#c0392b', 0, 1.1, -0.25, 0.66, 0.05, 0.06);
    lathe(p, C.white, [[0, 0], [0.09, 0], [0.09, 0.7], [0.075, 0.82], [0.06, 0.95], [0.03, 1.05], [0, 1.1]], 0, 0.1, 0, 14, { smooth: true });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      lathe(p, '#e8e4dc', [[0, 0], [0.045, 0], [0.045, 0.35], [0, 0.45]], Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.12, 10, { smooth: true });
    }
    box(p, '#c0392b', 0, 0.6, 0.085, 0.06, 0.12, 0.01);
    fire(p, 0, 0.0, 0, 0.16);
    smoke(p, 0, 0.05, 0, 0.3, '#f0ece4');
  },

  monument: p => {
    for (let i = 0; i < 3; i++) box(p, '#d8d2c4', 0, i * 0.05, 0, 0.9 - i * 0.18, 0.05, 0.9 - i * 0.18);
    box(p, '#cfc8b8', 0, 0.15, 0, 0.36, 0.14, 0.36);
    box(p, '#e0dacd', 0, 0.29, 0, 0.18, 0.62, 0.18);
    box(p, C.gold, 0, 0.55, 0.091, 0.08, 0.26, 0.004);
    roof(p, '#c9c1b1', 0, 0.91, 0, 0.24, 0.24, 0.08, 0.2, 0.2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cone(p, '#3f7d4e', Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55, 0.06, 0.2, 6);
    }
  },

  redboat: p => {
    const g = anim(p, 'bob', 0, 0, 0);
    slab(g, '#a0281e', [[-0.6, 0.16], [-0.5, 0], [0.5, 0], [0.62, 0.16], [-0.6, 0.16]], 0.3, 0, 0, 0, Math.PI / 2);
    box(g, '#d9c4a0', 0, 0.16, 0, 0.26, 0.18, 0.6);
    for (let i = 0; i < 5; i++) box(g, '#7a1a12', 0, 0.2, -0.24 + i * 0.12, 0.27, 0.08, 0.06);
    roof(g, '#2a2a2a', 0, 0.34, 0, 0.34, 0.68, 0.08, 0.15, 0.85);
    box(g, '#b03a2e', 0, 0.16, 0.38, 0.26, 0.03, 0.14);
    rod(g, C.darkwood, [0, 0.16, -0.48], [0, 0.6, -0.48], 0.008);
    box(p, C.water, 0, -0.03, 0, 1.6, 0.02, 1.2, 0, { opacity: 0.75 });
  },

  statue: (p, r) => {
    box(p, '#c9c1b1', 0, 0, 0, 0.4, 0.3, 0.4);
    const g = person(p, 0, 0, 1.6, str(r.color, '#8a8278'), str(r.color, '#8a8278'), 0, str(r.color, '#8a8278'));
    g.position.y = 0.3;
  },

  stadium: p => {
    box(p, '#8a9a7a', 0, -0.01, 0, 1.5, 0.02, 1.2);
    const shell = (rx: number, rz: number, h: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, b = a + 0.5;
        rod(p, '#9aa3ab', [Math.cos(a) * rx, 0, Math.sin(a) * rz], [Math.cos(b) * rx * 0.8, h, Math.sin(b) * rz * 0.8], 0.012, 4, { metal: 0.6 });
        rod(p, '#9aa3ab', [Math.cos(a) * rx, 0, Math.sin(a) * rz], [Math.cos(a - 0.5) * rx * 0.8, h, Math.sin(a - 0.5) * rz * 0.8], 0.012, 4, { metal: 0.6 });
      }
    };
    lathe(p, '#c0392b', [[0.5, 0], [0.5, 0.12], [0.3, 0.2], [0.28, 0.2]], 0, 0, 0, 24);
    p.children[p.children.length - 1].scale.set(1, 1, 0.8);
    cyl(p, '#5a9a4a', 0, 0.01, 0, 0.26, 0.01, 20).scale.set(0.52, 0.01, 0.4);
    shell(0.62, 0.5, 0.26, 26);
  },

  skyline: p => {
    box(p, '#7a8a8a', 0, -0.01, 0, 1.4, 0.02, 1.2);
    const towers: [number, number, number, number, string][] = [
      [-0.45, -0.2, 0.16, 0.55, '#7f9cb5'], [-0.2, 0.15, 0.14, 0.75, '#9fb8c8'], [0.05, -0.25, 0.18, 1.05, '#6f8fa8'], [0.3, 0.1, 0.12, 0.65, '#b8c8d0'],
      [0.48, -0.25, 0.14, 0.45, '#8aa0b0'], [-0.05, 0.35, 0.12, 0.38, '#a8b8c0'], [-0.5, 0.3, 0.12, 0.3, '#98a8b0'], [0.4, 0.4, 0.1, 0.28, '#90a0b0'],
    ];
    for (const [x, z, w, h, c] of towers) {
      box(p, c, x, 0, z, w, h, w, 0, { metal: 0.4, rough: 0.35 });
      for (let k = 1; k < h / 0.08; k++) box(p, '#f5e6a8', x, k * 0.08, z + w / 2 + 0.001, w * 0.8, 0.012, 0.002, 0, { emissive: true });
    }
    rod(p, '#cfd8dc', [0.05, 1.05, -0.25], [0.05, 1.25, -0.25], 0.008);
  },

  dam: p => {
    box(p, C.water, 0, -0.02, 0.4, 1.6, 0.03, 0.5, 0, { opacity: 0.85 });
    box(p, C.water, 0, 0.32, -0.45, 1.6, 0.03, 0.6, 0, { opacity: 0.85 });
    slab(p, '#c8c4b8', [[-0.18, 0], [0.12, 0], [0.04, 0.42], [-0.06, 0.42]], 1.5, 0, 0, -0.05, Math.PI / 2);
    for (let i = 0; i < 10; i++) box(p, '#e8f4f8', -0.6 + i * 0.13, 0.05, 0.12, 0.05, 0.3, 0.05, 0, { opacity: 0.7 });
    for (const x of [-0.85, 0.85]) ball(p, '#6b8a4a', x, 0.1, 0, 0.5, 0.7, 1.4);
  },
};
