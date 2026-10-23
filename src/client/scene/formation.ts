import type { Formation, Troops } from '../../shared/data/types.ts';
import { chariotAge, gunAge } from '../../shared/data/era.ts';
import type { UnitType } from './troops.ts';

/** A formation slot in file units: `x` across the front, `z` ranks behind it (≥ 0); `face` turns the soldier (a circle faces out). */
export interface Slot { x: number; z: number; face: number; t: UnitType }

/** Slot positions of a formation (阵型) for n soldiers, front rank at z = 0. */
export function shape(form: Formation, n: number): Omit<Slot, 't'>[] {
  const out: Omit<Slot, 't'>[] = [];
  const rows = (cols: number) => {
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), cnt = Math.min(cols, n - r * cols);
      out.push({ x: (i % cols) - (cnt - 1) / 2, z: r, face: 0 });
    }
  };
  switch (form) {
    case 'column': rows(n > 24 ? 4 : 3); break;
    case 'square': rows(Math.ceil(Math.sqrt(n))); break;
    case 'wedge':
      // 锋矢: the point leads, each rank two wider
      for (let r = 0, i = 0; i < n; r++) {
        const full = 2 * r + 1, cnt = Math.min(full, n - i);
        for (let c = 0; c < cnt; c++, i++) out.push({ x: cnt === full ? c - r : cnt > 1 ? -r + (c * 2 * r) / (cnt - 1) : 0, z: r * 0.85, face: 0 });
      }
      break;
    case 'wings': {
      // 鹤翼: the centre hangs back, two ranks of wings reach forward to envelop
      const m = Math.ceil(n / 4);
      for (let u = 0; u < m; u++) for (const rank of [0, 1]) for (const sd of [-1, 1]) out.push({ x: sd * (u + 0.6 + rank * 0.35), z: (m - 1 - u) * 0.55 + rank, face: 0 });
      out.length = n;
      break;
    }
    case 'circle': {
      // 圆阵: a ring facing outward
      const R = Math.max(1.4, (n / (2 * Math.PI)) * 1.1);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: R * Math.sin(a), z: R * (1 - Math.cos(a)), face: a }); }
      break;
    }
    default: rows(Math.max(4, Math.ceil(n / (n > 14 ? 3 : 2))));
  }
  const z0 = Math.min(...out.map(o => o.z));
  for (const o of out) o.z -= z0;
  return out;
}

/**
 * Deploys a troop mix in a formation for the period: spearmen with archers in the rear ranks (riflemen from 1840),
 * cavalry on the wings of combined arms (leading in a wedge or column), and before 307 BCE chariots in front of the
 * infantry instead of cavalry.
 */
export function deploy(form: Formation, t: Troops, n: number, year: number): Slot[] {
  const gun = gunAge(year);
  const foot: UnitType = gun ? 'gun' : 'spear', shot: UnitType = gun ? 'gun' : 'archer';
  if (t === 'chariot' || (chariotAge(year) && (t === 'horse' || t === 'mixed'))) {
    const nc = Math.max(2, Math.round(n / (t === 'mixed' ? 6 : 5)));
    const col = form === 'column';
    const out: Slot[] = [];
    for (let i = 0; i < nc; i++) out.push(col ? { x: ((i % 2) - 0.5) * 2.4, z: Math.floor(i / 2) * 1.6, face: 0, t: 'chariot' } : { x: (i - (nc - 1) / 2) * 2, z: 0, face: 0, t: 'chariot' });
    const z0 = col ? Math.ceil(nc / 2) * 1.6 + 0.4 : 1.8;
    for (const sl of deploy(col ? 'column' : 'line', 'foot', n - nc, year)) out.push({ ...sl, z: sl.z + z0 });
    return out;
  }
  const sl: Slot[] = shape(form, n).map(o => ({ ...o, t: foot }));
  const pick = (k: number, key: (o: Slot) => number) => sl.filter(o => o.t === foot).sort((a, b) => key(b) - key(a)).slice(0, k);
  switch (t) {
    case 'horse': for (const o of sl) o.t = 'horse'; break;
    case 'archer': case 'gun': for (const o of sl) o.t = shot; break;
    case 'mixed': {
      const lead = form === 'wedge' || form === 'column';
      for (const o of pick(Math.round(n * 0.3), o => (lead ? -o.z : Math.abs(o.x)))) o.t = 'horse';
      if (!gun) for (const o of pick(Math.round(n * 0.2), o => o.z)) o.t = shot;
      break;
    }
    default: if (!gun) for (const o of pick(Math.round(n * 0.25), o => o.z + Math.abs(o.x) * 0.01)) o.t = 'archer';
  }
  return sl;
}
