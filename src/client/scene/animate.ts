import type * as THREE from 'three';

/**
 * Generic animators for the named nodes that model builders leave unmerged (see ANIM_NAMES in models/prims.ts):
 * spin (wheels), flap (flag segments), sway (oars, sails), bob (boats), flicker (flames), smoke (rising puffs).
 */
interface Rig { node: THREE.Object3D; kind: string; base: { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number } }

export function rig(root: THREE.Object3D): Rig[] {
  const out: Rig[] = [];
  root.traverse(o => {
    if (['spin', 'flap', 'sway', 'bob', 'flicker', 'smoke'].includes(o.name)) {
      out.push({ node: o, kind: o.name, base: { x: o.position.x, y: o.position.y, z: o.position.z, rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z, s: o.scale.x } });
    }
  });
  return out;
}

export function animate(rigs: Rig[], t: number, seed = 0): void {
  for (const r of rigs) {
    const o = r.node, u = o.userData, b = r.base;
    const ph = (u.phase as number | undefined) ?? 0;
    switch (r.kind) {
      case 'spin': {
        const sp = (u.speed as number | undefined) ?? 2;
        const ax = (u.axis as string | undefined) ?? 'x';
        if (ax === 'x') o.rotation.x = b.rx + t * sp; else if (ax === 'y') o.rotation.y = b.ry + t * sp; else o.rotation.z = b.rz + t * sp;
        break;
      }
      case 'flap':
        o.rotation.y = b.ry + Math.sin(t * 5 + ph + seed) * ((u.amp as number | undefined) ?? 0.3);
        break;
      case 'sway':
        o.rotation.x = b.rx + Math.sin(t * ((u.speed as number | undefined) ?? 1.5) + seed) * ((u.amp as number | undefined) ?? 0.2);
        break;
      case 'bob':
        o.position.y = b.y + Math.sin(t * 1.6 + seed) * 0.025;
        o.rotation.z = b.rz + Math.sin(t * 1.1 + seed) * 0.04;
        o.rotation.x = b.rx + Math.sin(t * 0.9 + seed * 2) * 0.03;
        break;
      case 'flicker': {
        const f = 1 + 0.18 * Math.sin(t * 17 + seed) + 0.12 * Math.sin(t * 29 + seed * 3);
        o.scale.set(b.s * (2 - f) * 0.9 + 0.1 * b.s, b.s * f, b.s * (2 - f) * 0.9 + 0.1 * b.s);
        break;
      }
      case 'smoke': {
        const size = (u.size as number | undefined) ?? 0.12;
        o.children.forEach((c, i) => {
          const k = (t * 0.35 + i / o.children.length + seed) % 1;
          c.position.set(Math.sin(k * 5 + i) * size * 0.6, k * size * 7, Math.cos(k * 4 + i) * size * 0.4);
          c.scale.setScalar(size * (0.6 + k * 2.2) * (k > 0.85 ? (1 - k) / 0.15 : 1));
        });
        break;
      }
    }
  }
}
