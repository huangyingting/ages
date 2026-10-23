import * as THREE from 'three';
import {
  type Builder, type Paint, type V3, mat, add, box, cyl, cone, ellip, rbox, rod, strut, skin, sweep, tube, slab, lathe, prism,
  shade, mix, fbm, vnoise, worley, hash3,
} from './prims.ts';
import { pblob } from './animals.ts';
import { type HFn, island, sstep, ridged, ripple, strataSide, EARTH, pine, scatter, onGround } from './nature.ts';
import { hull } from './vehicles.ts';

// Discovery dioramas: every mystery / wreck / phenomenon sits on a sculpted terrain island with a story prop.
// Front is +z, base at y=0, ~1 unit across.

const ISL = { rings: 40, segs: 96 };
const glow = (c: string) => mat(c, { emissive: c });
const SEABED_SIDE = strataSide(['#3f4a52', '#4a5660', '#36424b', '#55606a']);

/** One merged mesh of tiny emissive octahedra (glowworms, sparks, lights) — a single draw call. */
function sparkles(p: THREE.Object3D, pts: V3[], r: number, c: string): void {
  const base = new THREE.OctahedronGeometry(r, 0).toNonIndexed();
  const bp = base.getAttribute('position');
  const out = new Float32Array(pts.length * bp.count * 3);
  pts.forEach((q, i) => { for (let k = 0; k < bp.count; k++) { out.set([bp.getX(k) + q[0], bp.getY(k) + q[1], bp.getZ(k) + q[2]], (i * bp.count + k) * 3); } });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
  geo.computeVertexNormals();
  add(p, geo, glow(c), 0, 0, 0, 1, 1, 1);
}

/** Group spinning about the model's vertical axis (scene animates rotation.z of groups named "spin"). */
function ySpin(p: THREE.Object3D): THREE.Group {
  const s = new THREE.Group(); s.name = 'spin'; s.rotation.x = -Math.PI / 2; p.add(s);
  const inner = new THREE.Group(); inner.rotation.x = Math.PI / 2; s.add(inner);
  return inner;
}

function fish(p: THREE.Object3D, x: number, y: number, z: number, s: number, ry: number, c = '#fbbf24'): void {
  const f = new THREE.Group(); f.position.set(x, y, z); f.rotation.y = ry; p.add(f);
  ellip(f, c, 0, 0, 0, s * 0.35, s * 0.45, s);
  const t = slab(f, [[0, 0], [-s * 0.5, s * 0.5], [-s * 0.5, -s * 0.5]], s * 0.08, shade(c, 0.85), 0, false);
  t.rotation.y = Math.PI / 2; t.position.z = -s * 0.9;
}

function bubbles(p: THREE.Object3D, seed: number, n: number, x: number, z: number, y0: number, y1: number): void {
  for (let i = 0; i < n; i++) {
    const t = i / n;
    ellip(p, '#e0f2fe', x + (hash3(i, seed, 1) - 0.5) * 0.06, y0 + (y1 - y0) * t, z + (hash3(i, seed, 2) - 0.5) * 0.06, 0.008 + 0.01 * hash3(i, seed, 3)).material = mat('#e0f2fe', { transparent: 0.55 });
  }
}

// ---------------------------------------------------------------------------------------------------------
const wreck: Builder = (gp, r) => {
  if (r.ice) {
    // Endurance: crushed barquentine locked in Weddell Sea pack ice, pressure ridges, open leads, emperor penguins
    const hf: HFn = (x, z) => {
      const ridge = Math.pow(ridged(x * 6 + 3, z * 6), 3) * 0.05;
      const [f1, f2] = worley(x * 7, 0, z * 7);
      const lead = f2 - f1 < 0.06 ? -0.02 : 0;
      return 0.02 + ridge + 0.006 * fbm(x * 20, 1, z * 20) + lead;
    };
    island(gp, 0.5, hf, '#e8f1f8', (x, y, z, _nx, ny) => {
      if (y < 0.04 && ny > 0.9) return '#1e3a52';
      if (ny < 0.75) return mix('#a5c8e1', '#7fb0d4', vnoise(x * 30, y * 30, z * 30));
      return hash3(Math.floor(x * 80), 0, Math.floor(z * 80)) > 0.85 ? '#ffffff' : mix('#eef5fb', '#d6e6f2', fbm(x * 12, 0, z * 12));
    }, { ...ISL, side: () => '#a9cde6' });
    const s = new THREE.Group(); s.position.set(0.02, 0.03, -0.02); s.rotation.set(0.06, 0.5, 0.32); gp.add(s);
    const H = hull(s, r.color!, { L: 0.6, B: 0.14, D: 0.11, wl: 0.03, fine: 0.45, deck: '#8b6a45', paint: (_x, y) => (y < 0.03 ? '#2a1d14' : null) });
    // Masts (foremast snapped), yards, bowsprit, rigging
    const masts: [number, number][] = [[0.17, 0.42], [0.0, 0.5], [-0.15, 0.38]];
    masts.forEach(([z, h], i) => {
      const y = H.deckY(z), top = i === 0 ? h * 0.55 : h;
      rod(s, [0, y, z], [0, y + top, z], 0.007, '#5b4030', 6);
      for (let k = 1; k <= (i === 0 ? 1 : 3); k++) rod(s, [-0.09 + k * 0.01, y + top * (0.35 + k * 0.18), z], [0.09 - k * 0.01, y + top * (0.35 + k * 0.18), z], 0.0035, '#4a3426', 4);
      rod(s, [0, y + top, z], [0.07, y, z - 0.02], 0.0012, '#1f2937', 3);
      rod(s, [0, y + top, z], [-0.07, y, z - 0.02], 0.0012, '#1f2937', 3);
    });
    rod(s, [0, H.deckY(0.3) + 0.01, 0.3], [0, H.deckY(0.3) + 0.06, 0.42], 0.005, '#5b4030', 5);
    rod(s, [0, H.deckY(0.17) + 0.23, 0.17], [0.05, H.deckY(0.17) + 0.02, 0.33], 0.006, '#5b4030', 5);
    box(s, '#e2e8f0', 0, H.deckY(-0.2), -0.2, 0.06, 0.04, 0.06);
    // Pressure ice slabs heaved against the hull
    for (let i = 0; i < 14; i++) {
      const a = hash3(i, 4, 1) * Math.PI * 2, d = 0.12 + hash3(i, 4, 2) * 0.12;
      const m = rbox(gp, i % 3 ? '#e6f1fa' : '#b9d7ec', Math.cos(a) * d * 1.4, 0.03, Math.sin(a) * d, 0.04 + hash3(i, 4, 3) * 0.06, 0.012, 0.05 + hash3(i, 4, 4) * 0.05, 0.004, a);
      m.rotation.x = (hash3(i, 4, 5) - 0.5) * 1.2; m.rotation.z = (hash3(i, 4, 6) - 0.5) * 1.2;
    }
    for (const [x, z, a] of [[0.3, 0.26, 0.4], [0.35, 0.18, -0.3], [0.26, 0.33, 1]] as const) {
      const pg = new THREE.Group(); pg.position.set(x, onGround(hf)(x, z), z); pg.rotation.y = a; gp.add(pg);
      ellip(pg, '#111827', 0, 0.035, 0, 0.018, 0.035, 0.016);
      ellip(pg, '#f8fafc', 0, 0.032, 0.006, 0.014, 0.028, 0.012);
      ellip(pg, '#111827', 0, 0.075, 0.004, 0.011);
      ellip(pg, '#f59e0b', 0.009, 0.07, 0.006, 0.004, 0.007, 0.004);
      ellip(pg, '#f59e0b', -0.009, 0.07, 0.006, 0.004, 0.007, 0.004);
    }
    return;
  }
  // Titanic: rust-streaked bow section nosed into a seabed scour, fallen funnel, boilers & debris field
  const hf: HFn = (x, z) => {
    let y = 0.02 + 0.012 * fbm(x * 6, 0, z * 6) + 0.003 * Math.sin(x * 70 + z * 30);
    const along = x * Math.sin(0.5) + z * Math.cos(0.5), across = x * Math.cos(0.5) - z * Math.sin(0.5);
    y += 0.04 * Math.exp(-(across * across) / 0.006) * sstep(-0.3, 0.2, along) * (Math.abs(across) > 0.06 ? 1 : -0.4);
    return y;
  };
  island(gp, 0.5, hf, '#9a9478', (x, y, z, _nx, ny) => {
    if (ny < 0.8) return '#6f6a58';
    const v = fbm(x * 14, y * 9, z * 14);
    return hash3(Math.floor(x * 70), 1, Math.floor(z * 70)) > 0.93 ? '#5b5646' : mix('#a39d80', '#7d7a66', v);
  }, { ...ISL, side: SEABED_SIDE });
  const s = new THREE.Group(); s.position.set(0, 0.012, 0.02); s.rotation.set(0.07, 0.5, -0.1); gp.add(s);
  const rust: Paint = (x, y, z) => {
    const v = fbm(x * 26, y * 40, z * 26);
    if (y < 0.035) return '#5a2a14';
    if (v > 0.62) return '#8a3b17';
    if (v > 0.55 && Math.sin(z * 120) > 0.5) return '#6e2f14';
    return null;
  };
  const H = hull(s, '#1c1917', { L: 0.78, B: 0.13, D: 0.12, wl: 0.035, fine: 0.42, deck: '#6b5a48', paint: rust });
  // Torn stern edge
  for (let i = 0; i < 7; i++) {
    const m = rbox(s, '#3b2a20', (hash3(i, 9, 1) - 0.5) * 0.12, 0.02 + hash3(i, 9, 2) * 0.08, -0.39 - hash3(i, 9, 3) * 0.03, 0.03, 0.03, 0.02, 0.004);
    m.rotation.set(hash3(i, 9, 4), hash3(i, 9, 5), hash3(i, 9, 6));
  }
  const dy = H.deckY(0);
  prism(s, [[-0.05, -0.3], [0.05, -0.3], [0.05, 0.12], [0, 0.15], [-0.05, 0.12]], dy, 0.03, '#d6c8ae');
  prism(s, [[-0.04, -0.24], [0.04, -0.24], [0.04, 0.08], [-0.04, 0.08]], dy + 0.03, 0.025, '#c8b898');
  for (const z of [0.04, -0.08]) {
    const fy = dy + 0.055;
    sweep(s, [{ p: [0, fy, z], w: 0.022, h: 0.028 }, { p: [0, fy + 0.12, z - 0.02], w: 0.021, h: 0.027 }], '#b86a24', {
      radial: 16, sub: 3, up: [0, 0, 1], paint: (_x, y) => (y > fy + 0.09 ? '#1a1a1a' : fbm(_x * 50, y * 50, z * 50) > 0.6 ? '#7c3a12' : null),
    });
  }
  // Fallen funnel & boilers on the seabed
  const ff = sweep(gp, [{ p: [-0.28, 0.06, -0.24], w: 0.022, h: 0.028 }, { p: [-0.15, 0.05, -0.32], w: 0.022, h: 0.028 }], '#a8611f', { radial: 16, sub: 2, up: [0, 1, 0] });
  void ff;
  for (const [x, z] of [[0.3, -0.2], [0.24, -0.3], [-0.32, 0.12]] as const) {
    const b = cyl(gp, '#4a3328', x, onGround(hf)(x, z) + 0.01, z, 0.035, 0.06, 14); b.rotation.z = Math.PI / 2; b.rotation.y = x * 4;
  }
  rod(gp, [0.32, 0.06, 0.26], [0.1, 0.05, 0.36], 0.006, '#4b3a2a', 6);
  for (const [x, y, z, ry] of [[-0.3, 0.3, 0.05, 1.2], [0.25, 0.36, 0.0, -2], [0.05, 0.42, -0.3, 0.3]] as const) fish(gp, x, y, z, 0.03, ry, '#94a3b8');
  bubbles(gp, 3, 6, 0.02, 0.2, 0.25, 0.6);
};

// ---------------------------------------------------------------------------------------------------------
function questionMark(p: THREE.Object3D, c: string, y: number, s: number): void {
  const pts: V3[] = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI * 1.05 - (i / 12) * Math.PI * 1.55; pts.push([Math.cos(a) * 0.1 * s, y + 0.16 * s + Math.sin(a) * 0.1 * s, 0]); }
  pts.push([0, y + 0.02 * s, 0]);
  const m = sweep(p, pts.map((q, i) => ({ p: q, w: 0.03 * s * (i === 0 ? 0.9 : 1) })), c, { radial: 12, sub: 3, up: [0, 0, 1] });
  m.material = glow(c);
  ellip(p, c, pts[0][0], pts[0][1], 0, 0.03 * s).material = glow(c);
  ellip(p, c, 0, y - 0.07 * s, 0, 0.034 * s).material = glow(c);
}

const mystery: Builder = (gp, r) => {
  const c = r.color!;
  if (r.ufo) {
    // Area 51: Groom Lake dry bed, runway, hangars, radar — and a saucer beaming up a cow
    const hf: HFn = (x, z) => {
      const rr = Math.hypot(x, z);
      return 0.015 + 0.11 * Math.pow(ridged(x * 5 + 1, z * 5), 2) * sstep(0.32, 0.48, rr) + 0.004 * fbm(x * 18, 0, z * 18);
    };
    const rw = (x: number, z: number) => Math.abs(x * 0.45 + z * 0.89 - 0.02) < 0.035 && Math.abs(-x * 0.89 + z * 0.45) < 0.36;
    island(gp, 0.5, hf, '#d8b98a', (x, y, z, _nx, ny) => {
      if (rw(x, z)) return Math.abs(x * 0.45 + z * 0.89 - 0.02) < 0.003 && Math.sin((-x * 0.89 + z * 0.45) * 120) > 0 ? '#f8fafc' : '#3f3f46';
      if (y > 0.07) return ny > 0.8 ? '#a07850' : '#8a6040';
      if (Math.hypot(x + 0.15, z - 0.1) < 0.16) return mix('#ece2cf', '#ddd0b5', fbm(x * 20, 0, z * 20));
      return hash3(Math.floor(x * 60), 0, Math.floor(z * 60)) > 0.9 ? '#7a8a50' : mix('#d8b98a', '#c9a676', fbm(x * 10, 0, z * 10));
    }, { ...ISL, side: strataSide(['#b08860', '#9a7550', '#c09a70']) });
    for (const [x, z] of [[-0.24, -0.1], [-0.16, -0.18], [-0.08, -0.26]] as const) {
      const hg = cyl(gp, '#cbd5e1', x, 0.06, z, 0.045, 0.1, 16); hg.rotation.set(0, 0.5, Math.PI / 2); hg.position.y = 0.04;
      box(gp, '#64748b', x + 0.04, 0.02, z + 0.025, 0.004, 0.04, 0.05, 0.5);
    }
    box(gp, '#e2e8f0', 0.2, 0.02, -0.22, 0.04, 0.12, 0.04);
    box(gp, '#0f172a', 0.2, 0.13, -0.22, 0.05, 0.025, 0.05);
    const dish = lathe(gp, [[0, 0], [0.04, 0.012], [0.05, 0.024]], '#f1f5f9', 0.3, 0.06, -0.08, 14); dish.rotation.x = -0.6;
    rod(gp, [0.3, 0.02, -0.08], [0.3, 0.06, -0.08], 0.005, '#94a3b8');
    for (let i = 0; i < 16; i++) { const a = -0.4 + i * 0.12; rod(gp, [Math.cos(a) * 0.44, 0.04, Math.sin(a) * 0.44], [Math.cos(a) * 0.44, 0.07, Math.sin(a) * 0.44], 0.002, '#64748b', 3); }
    // Saucer (spins), tractor beam, abducted cow
    const u = ySpin(gp);
    u.position.set(0.12, 0, 0.12);
    lathe(u, [[0, 0.5], [0.08, 0.505], [0.2, 0.53], [0.22, 0.545], [0.18, 0.565], [0.07, 0.58], [0, 0.585]], '#cbd5e1', 0, 0, 0, 32).material = mat('#cbd5e1', { metal: 0.85, rough: 0.25, flat: false });
    ellip(u, '#67e8f9', 0, 0.59, 0, 0.07, 0.05, 0.07).material = mat('#67e8f9', { transparent: 0.7, emissive: '#0891b2' });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; ellip(u, c, Math.cos(a) * 0.205, 0.538, Math.sin(a) * 0.205, 0.012).material = glow(i % 2 ? c : '#fde047'); }
    add(gp, new THREE.CylinderGeometry(0.06, 0.16, 0.46, 24, 1, true), mat('#a5f3fc', { transparent: 0.22, emissive: '#22d3ee' }), 0.12, 0.27, 0.12, 1, 1, 1);
    const cow = new THREE.Group(); cow.position.set(0.12, 0.22, 0.12); cow.rotation.set(0.3, 0.8, 0.4); gp.add(cow);
    pblob(cow, '#f8fafc', 0, 0, 0, 0.035, 0.024, 0.05, (x, _y, z) => (vnoise(x * 60, 0, z * 60) > 0.55 ? '#111827' : null), [0, 0, 0], 14);
    ellip(cow, '#f8fafc', 0, 0.012, 0.05, 0.016, 0.016, 0.018);
    for (const [x, z] of [[-0.02, -0.03], [0.02, -0.03], [-0.02, 0.03], [0.02, 0.03]] as const) rod(cow, [x, -0.01, z], [x, -0.04, z], 0.005, '#f8fafc', 4);
    return;
  }
  // Bermuda Triangle: whirlpool vortex with a sinking stern & a ditched plane's tail, triangle beacons, floating "?"
  const hf: HFn = (x, z) => { const rr = Math.hypot(x, z); return 0.03 - 0.07 * Math.exp(-(rr * rr) / 0.02) + 0.004 * Math.sin(rr * 60 - Math.atan2(z, x) * 3); };
  island(gp, 0.5, hf, '#1d6fa5', (x, y, z) => {
    const rr = Math.hypot(x, z), a = Math.atan2(z, x);
    const spiral = Math.sin(a * 3 + Math.log(rr + 0.02) * 9);
    if (rr < 0.3 && spiral > 0.75) return '#e0f2fe';
    if (rr < 0.3 && spiral > 0.2) return mix('#2b86bf', '#4fa8d8', rr / 0.3);
    if (rr < 0.06) return '#0b3d63';
    return ripple(mix('#1d6fa5', '#155e8c', fbm(x * 8, 0, z * 8)))(x, y, z, 0, 1, 0);
  }, { ...ISL, side: () => '#174f75' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3, b = ((i + 1) / 3) * Math.PI * 2 + 0.3, R = 0.42;
    const A: V3 = [Math.cos(a) * R, 0.06, Math.sin(a) * R], Bv: V3 = [Math.cos(b) * R, 0.06, Math.sin(b) * R];
    rod(gp, A, Bv, 0.003, c).material = glow(c);
    cyl(gp, '#f8fafc', A[0], 0.03, A[2], 0.012, 0.04, 8);
    ellip(gp, c, A[0], 0.075, A[2], 0.012).material = glow(c);
  }
  const st = new THREE.Group(); st.position.set(-0.14, 0.0, 0.08); st.rotation.set(-0.9, 0.6, 0.2); gp.add(st);
  hull(st, '#1f2937', { L: 0.3, B: 0.08, D: 0.06, wl: 0.02, fine: 0.35, paint: (_x, y) => (y < 0.02 ? '#991b1b' : null) });
  box(st, '#f8fafc', 0, 0.06, -0.06, 0.06, 0.04, 0.08);
  const tail = slab(gp, [[0, 0], [0.09, 0], [0.12, 0.12], [0.07, 0.12]], 0.01, '#e2e8f0', 0.003, false);
  tail.position.set(0.16, 0.02, -0.12); tail.rotation.set(0, 0.8, 0.25);
  slab(gp, [[0, 0], [0.12, 0], [0.1, 0.02], [0, 0.02]], 0.03, '#e2e8f0', 0.004, false).position.set(0.13, 0.02, -0.1);
  const q = ySpin(gp);
  questionMark(q, c, 0.42, 1);
};

// ---------------------------------------------------------------------------------------------------------
const serpent: Builder = (gp, r) => {
  const c = r.color!;
  if (r.tentacles) {
    // Kraken: storm swell, a three-masted ship seized by giant suckered tentacles, mantle & eye breaching
    const hf: HFn = (x, z) => 0.03 + 0.012 * Math.sin(x * 14 + z * 6) + 0.008 * fbm(x * 9, 0, z * 9);
    island(gp, 0.5, hf, '#1e5f8a', (x, y, z, _nx, ny) => (ny < 0.95 && y > 0.045 ? '#e0f2fe' : ripple(mix('#1e5f8a', '#174e73', fbm(x * 6, 0, z * 6)))(x, y, z, 0, 1, 0)), { ...ISL, side: () => '#174e73' });
    const sh = new THREE.Group(); sh.position.set(0.08, 0.03, 0.06); sh.rotation.set(0.25, -0.6, 0.35); gp.add(sh);
    const H = hull(sh, '#5b3a22', { L: 0.36, B: 0.1, D: 0.07, wl: 0.025, fine: 0.4, deck: '#a47a52', paint: (_x, y) => (y < 0.025 ? '#2a1a10' : y > 0.06 ? '#e8c06a' : null) });
    for (const [z, h] of [[0.08, 0.3], [-0.02, 0.36], [-0.11, 0.26]] as const) {
      const y = H.deckY(z);
      rod(sh, [0, y, z], [0, y + h, z], 0.004, '#4a3426', 5);
      for (const k of [0.45, 0.75]) {
        const sl = slab(sh, [[-0.07, 0], [0.07, 0], [0.06, h * 0.26], [-0.06, h * 0.26]], 0.004, '#f1ead8', 0, false);
        sl.position.set(0, y + h * (k - 0.2), z + 0.004); sl.rotation.x = -0.12;
      }
    }
    pblob(gp, c, -0.18, 0.06, -0.12, 0.12, 0.09, 0.14, (x, y, z) => (vnoise(x * 50, y * 50, z * 50) > 0.65 ? shade(c, 0.8) : null), [0.3, 0.6, 0], 22);
    ellip(gp, '#fde047', -0.1, 0.11, -0.04, 0.026, 0.026, 0.016, 0.7).material = glow('#fde047');
    ellip(gp, '#111827', -0.095, 0.112, -0.03, 0.008, 0.02, 0.008, 0.7);
    const T: V3[][] = [
      [[-0.05, 0.03, 0.1], [0.0, 0.22, 0.16], [0.12, 0.3, 0.14], [0.18, 0.22, 0.05], [0.13, 0.14, 0.03]],
      [[0.12, 0.03, 0.3], [0.2, 0.2, 0.25], [0.12, 0.33, 0.14], [0.04, 0.3, 0.1]],
      [[0.3, 0.03, 0.0], [0.32, 0.25, -0.04], [0.2, 0.36, 0.0], [0.15, 0.3, 0.06]],
      [[-0.3, 0.03, 0.2], [-0.34, 0.24, 0.24], [-0.28, 0.38, 0.18], [-0.22, 0.34, 0.1]],
      [[-0.12, 0.03, -0.32], [-0.06, 0.22, -0.34], [0.0, 0.3, -0.24], [-0.02, 0.24, -0.18]],
    ];
    T.forEach((pts, ti) => {
      const st = pts.map((p, i) => ({ p, w: 0.032 * (1 - (i / (pts.length - 1)) * 0.85) }));
      sweep(gp, st, c, { radial: 12, sub: 6, paint: (_x, y, _z, _nx, ny) => (ny < -0.2 ? mix(c, '#fecaca', 0.5) : null) });
      for (let i = 0; i < 6; i++) {
        const t = 0.15 + i * 0.13, k = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), f = t * (pts.length - 1) - k;
        const a = pts[k], b = pts[k + 1];
        ellip(gp, '#fde2e2', a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - 0.025 * (1 - t), a[2] + (b[2] - a[2]) * f, 0.006 * (1.2 - t));
      }
      void ti;
    });
    return;
  }
  // Loch Ness: long glacial loch between heather hills, Urquhart Castle on its promontory, Nessie's neck & humps
  const hf: HFn = (x, z) => {
    const loch = 1 - ((x - 0.02) / 0.2) ** 2 - (z / 0.62) ** 2;
    const hills = 0.04 + 0.14 * Math.pow(ridged(x * 4 + 2, z * 4), 1.5) * sstep(0.15, 0.4, Math.abs(x));
    const prom = Math.exp(-(((x + 0.27) / 0.09) ** 2 + ((z - 0.18) / 0.08) ** 2)) * 0.06;
    return loch > 0 ? Math.max(0.004, hills * (1 - sstep(0, 0.25, loch)) - 0.03 * sstep(0, 0.2, loch) + prom) : hills + prom;
  };
  island(gp, 0.5, hf, '#5d7f45', (x, y, z, _nx, ny) => {
    const t = y - 0.035;
    if (t < 0.008 && ny > 0.97) return ripple('#1f4e6b')(x, y, z, 0, 1, 0);
    if (t < 0.02) return '#8a7a5a';
    if (ny < 0.7) return '#6b6458';
    const v = fbm(x * 12, y * 10, z * 12);
    return t > 0.1 ? (v > 0.55 ? '#7a4f78' : '#6a7a48') : v > 0.6 ? '#4a6a38' : '#5d7f45';
  }, { ...ISL, side: strataSide(EARTH) });
  const gy = onGround(hf);
  const cx = -0.29, cz = 0.18, by = gy(cx, cz);
  rbox(gp, '#8b8578', cx, by, cz, 0.06, 0.13, 0.06, 0.003);
  for (const [dx, dz] of [[-0.025, -0.025], [0.025, -0.025], [-0.025, 0.025], [0.025, 0.025]] as const) box(gp, '#8b8578', cx + dx, by + 0.13, cz + dz, 0.014, 0.022, 0.014);
  for (const k of [0.04, 0.085]) box(gp, '#1f2937', cx + 0.031, by + k, cz, 0.003, 0.018, 0.01);
  for (const [dx, dz, w, h] of [[0.05, 0.05, 0.1, 0.04], [-0.02, 0.08, 0.06, 0.03], [0.08, -0.02, 0.04, 0.05]] as const) rbox(gp, '#9a9384', cx + dx, gy(cx + dx, cz + dz), cz + dz, w, h, 0.016, 0.003, dx * 8);
  scatter(14, 21, (x, z) => { if (hf(x, z) > 0.06 && Math.abs(x) > 0.22) pine(gp, x, gy(x, z), z, 0.06, '#2f5a3a'); }, 0.47);
  // Nessie
  const belly = mix(c, '#c8d8a8', 0.45);
  const neck: V3[] = [[0.06, 0.02, -0.02], [0.06, 0.15, 0.0], [0.07, 0.25, 0.05], [0.08, 0.3, 0.12], [0.085, 0.29, 0.17]];
  sweep(gp, neck.map((p, i) => ({ p, w: 0.04 - i * 0.006 })), c, { radial: 14, sub: 6, paint: (_x, _y, _z, _nx, _ny, nz) => (nz > 0.5 ? belly : null) });
  pblob(gp, c, 0.085, 0.29, 0.2, 0.024, 0.02, 0.04, undefined, [0.1, 0, 0], 16);
  ellip(gp, '#111827', 0.105, 0.3, 0.205, 0.005);
  ellip(gp, '#111827', 0.065, 0.3, 0.205, 0.005);
  for (const [z, s] of [[-0.13, 1], [-0.24, 0.8], [-0.33, 0.55]] as const) {
    const pts: V3[] = []; for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; pts.push([0.06, 0.03 + Math.sin(a) * 0.06 * s, z + 0.05 * s - Math.cos(a) * -0.05 * s]); }
    sweep(gp, pts.map(p => ({ p, w: 0.032 * s })), c, { radial: 12, sub: 3 });
    add(gp, new THREE.TorusGeometry(0.05 * s, 0.004, 4, 24).rotateX(Math.PI / 2), mat('#e0f2fe', { transparent: 0.7 }), 0.06, 0.037, z, 1, 1, 1);
  }
  add(gp, new THREE.TorusGeometry(0.05, 0.004, 4, 24).rotateX(Math.PI / 2), mat('#e0f2fe', { transparent: 0.7 }), 0.06, 0.037, -0.02, 1, 1, 1);
};

// ---------------------------------------------------------------------------------------------------------
const vent: Builder = (gp, r) => {
  const c = r.color!;
  // Challenger Deep: hadal trench walls, black-smoker chimneys with plumes, tube-worm colonies, Trieste bathyscaphe
  const hf: HFn = (x, z) => {
    const trench = sstep(0.06, 0.26, Math.abs(x * 0.9 + z * 0.3));
    return 0.01 + trench * 0.14 * (0.7 + 0.5 * ridged(x * 5, z * 5 + 4)) + 0.006 * fbm(x * 20, 0, z * 20);
  };
  island(gp, 0.5, hf, '#3b4654', (x, y, z, _nx, ny) => {
    const v = fbm(x * 18, y * 18, z * 18);
    if (y < 0.06 && Math.hypot(x - 0.02, z) < 0.18 && v > 0.55) return v > 0.65 ? '#d4a017' : '#b45309';
    if (ny < 0.7) return v > 0.5 ? '#2c3540' : '#3a444f';
    return mix('#4b5868', '#38424e', v);
  }, { ...ISL, side: SEABED_SIDE });
  const gy = onGround(hf);
  for (const [x, z, h] of [[0.0, 0.02, 0.3], [0.1, -0.08, 0.22], [-0.08, 0.1, 0.17]] as const) {
    const y = gy(x, z), prof: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([0.035 * (1 - t * 0.55) * (0.85 + 0.3 * hash3(i, x * 9, 2)), t * h]); }
    prof.push([0.012, h], [0, h]);
    lathe(gp, prof, '#26221f', x, y, z, 10);
    for (let i = 1; i < 5; i++) cyl(gp, i % 2 ? '#7c4a1e' : '#c2a043', x, y + h * (i / 5), z, 0.03 * (1 - (i / 5) * 0.5), 0.006, 10);
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      ellip(gp, '#1c1917', x + t * 0.04, y + h + 0.03 + t * 0.2, z - t * 0.02, 0.025 + t * 0.05).material = mat('#1c1917', { transparent: 0.55 - t * 0.4 });
    }
  }
  for (let i = 0; i < 26; i++) {
    const a = hash3(i, 5, 1) * Math.PI * 2, d = 0.06 + hash3(i, 5, 2) * 0.14, x = Math.cos(a) * d, z = Math.sin(a) * d, y = gy(x, z), h = 0.03 + hash3(i, 5, 3) * 0.05;
    rod(gp, [x, y, z], [x + (hash3(i, 5, 4) - 0.5) * 0.02, y + h, z], 0.0035, '#f1f5f9', 4);
    ellip(gp, '#dc2626', x, y + h + 0.004, z, 0.006, 0.01, 0.006).material = mat('#ef4444', { emissive: '#7f1d1d' });
  }
  // Trieste: float, observation sphere, ballast tubs and lamp beam
  const tr = new THREE.Group(); tr.position.set(-0.12, 0.5, -0.06); tr.rotation.y = 0.6; gp.add(tr);
  sweep(tr, [{ p: [0, 0, -0.16], w: 0.01 }, { p: [0, 0, -0.12], w: 0.045, h: 0.05 }, { p: [0, 0.005, 0.1], w: 0.05, h: 0.055 }, { p: [0, 0, 0.16], w: 0.012 }], '#e2e8f0', {
    radial: 18, sub: 5, paint: (_x, y) => (y > 0.04 ? '#94a3b8' : y < -0.02 ? '#cbd5e1' : null),
  });
  box(tr, '#64748b', 0, 0.045, -0.02, 0.03, 0.03, 0.06);
  rod(tr, [0, -0.05, 0], [0, -0.09, 0], 0.01, '#475569');
  ellip(tr, '#94a3b8', 0, -0.12, 0, 0.04).material = mat('#94a3b8', { metal: 0.7, rough: 0.3, flat: false });
  ellip(tr, c, 0, -0.12, 0.038, 0.01).material = glow(c);
  add(tr, new THREE.ConeGeometry(0.08, 0.3, 18, 1, true).rotateX(-Math.PI / 2 - 0.6), mat(c, { transparent: 0.16, emissive: c }), 0, -0.2, 0.15, 1, 1, 1);
  sparkles(gp, Array.from({ length: 30 }, (_, i) => [(hash3(i, 7, 1) - 0.5) * 0.8, 0.12 + hash3(i, 7, 2) * 0.55, (hash3(i, 7, 3) - 0.5) * 0.8] as V3), 0.006, c);
};

// ---------------------------------------------------------------------------------------------------------
const footprints: Builder = (gp, r) => {
  const c = r.color!;
  // Bigfoot: Pacific Northwest rainforest, muddy creek trail with huge prints, and the famous mid-stride glance back
  const path = (z: number) => Math.sin(z * 5) * 0.1;
  const hf: HFn = (x, z) => {
    const onPath = Math.exp(-((x - path(z)) ** 2) / 0.003);
    return 0.02 + 0.09 * Math.pow(fbm(x * 4 + 7, 0, z * 4), 2) * (1 - onPath) + 0.006 * fbm(x * 25, 0, z * 25) - 0.006 * onPath;
  };
  island(gp, 0.5, hf, '#4f6b3a', (x, y, z) => {
    if (Math.abs(x - path(z)) < 0.045) return mix('#6b4f35', '#5a4029', fbm(x * 30, 0, z * 30));
    const v = fbm(x * 14, y * 10, z * 14);
    return hash3(Math.floor(x * 70), 0, Math.floor(z * 70)) > 0.88 ? '#7a8a40' : v > 0.55 ? '#3f5a30' : '#4f6b3a';
  }, { ...ISL, side: strataSide(EARTH) });
  const gy = onGround(hf);
  for (let i = 0; i < 7; i++) {
    const z = -0.36 + i * 0.1, x = path(z) + (i % 2 ? 0.018 : -0.018), y = gy(x, z) + 0.004, ry = Math.atan(Math.cos(z * 5) * 0.5);
    const fp = new THREE.Group(); fp.position.set(x, y, z); fp.rotation.y = ry; gp.add(fp);
    ellip(fp, c, 0, 0, 0, 0.014, 0.003, 0.03);
    for (let k = 0; k < 5; k++) ellip(fp, c, -0.012 + k * 0.006, 0, 0.034 - Math.abs(k - 1.5) * 0.002, 0.0035, 0.003, 0.004);
  }
  scatter(34, 31, (x, z) => { if (Math.abs(x - path(z)) > 0.09) pine(gp, x, gy(x, z), z, 0.08 + hash3(x * 50, z * 50, 1) * 0.08, hash3(x * 9, z * 9, 2) > 0.5 ? '#264d34' : '#2f5e3f'); }, 0.46);
  scatter(10, 32, (x, z) => { if (Math.abs(x - path(z)) > 0.06) for (let k = 0; k < 4; k++) { const l = slab(gp, [[0, 0], [0.006, 0.03], [0, 0.05], [-0.006, 0.03]], 0.002, '#5f8f3e'); l.position.set(x, gy(x, z), z); l.rotation.set(-0.7, (k / 4) * Math.PI * 2, 0); } }, 0.44);
  // Sasquatch, mid-stride, glancing back over the shoulder
  const bf = new THREE.Group(); const bx = path(0.2) + 0.01; bf.position.set(bx, gy(bx, 0.2), 0.2); bf.rotation.y = 0.4; gp.add(bf);
  const fur: Paint = (x, y, z) => (vnoise(x * 120, y * 120, z * 120) > 0.6 ? '#3b2a1e' : null);
  pblob(bf, '#4a3426', 0, 0.16, 0, 0.05, 0.075, 0.04, fur, [0.15, 0, 0], 18, true);
  pblob(bf, '#4a3426', 0, 0.105, -0.004, 0.042, 0.03, 0.034, fur, [0, 0, 0], 14);
  pblob(bf, '#4a3426', -0.012, 0.25, 0.006, 0.03, 0.032, 0.03, fur, [0, 0, 0], 16, true);
  ellip(bf, '#2b1d14', -0.024, 0.252, 0.03, 0.014, 0.012, 0.008, -0.6);
  tube(bf, [[-0.026, 0.11, 0.0], [-0.03, 0.06, 0.03], [-0.03, 0.0, 0.01]], 0.018, 0.013, '#4a3426');
  tube(bf, [[0.026, 0.11, 0.0], [0.028, 0.06, -0.03], [0.03, 0.01, -0.05]], 0.018, 0.013, '#4a3426');
  tube(bf, [[-0.052, 0.21, 0], [-0.065, 0.14, -0.03], [-0.06, 0.08, -0.05]], 0.013, 0.011, '#4a3426');
  tube(bf, [[0.052, 0.21, 0], [0.065, 0.14, 0.03], [0.062, 0.08, 0.05]], 0.013, 0.011, '#4a3426');
  rod(gp, [-0.3, gy(-0.3, -0.05) + 0.012, -0.05], [-0.16, gy(-0.16, -0.12) + 0.012, -0.12], 0.014, '#5b4030', 8);
};

// ---------------------------------------------------------------------------------------------------------
const sunkencity: Builder = (gp, r) => {
  const c = r.color!;
  // Atlantis: Plato's concentric rings of land and water, a drowned temple acropolis, fallen columns, kelp & bubbles
  const ringLand = (rr: number) => (rr < 0.12 ? 1 : (rr > 0.2 && rr < 0.26) || (rr > 0.33 && rr < 0.39) ? 0.55 : 0);
  const hf: HFn = (x, z) => {
    const rr = Math.hypot(x, z);
    let land = 0;
    for (const [a, b, h] of [[0, 0.12, 1], [0.2, 0.26, 0.55], [0.33, 0.39, 0.55]] as const) land = Math.max(land, h * sstep(a - 0.015, a + 0.005, rr) * (1 - sstep(b - 0.005, b + 0.015, rr)) + (a === 0 ? h * (1 - sstep(b - 0.005, b + 0.015, rr)) : 0));
    return 0.012 + Math.min(1, land) * 0.07 + 0.004 * fbm(x * 20, 0, z * 20);
  };
  island(gp, 0.5, hf, '#b9c7bf', (x, y, z, _nx, ny) => {
    const rr = Math.hypot(x, z);
    if (ringLand(rr) && ny > 0.9) return (Math.floor(x * 70) + Math.floor(z * 70)) % 2 ? '#d6d0bf' : '#c8c1ae';
    if (ny < 0.8) return '#9aa59c';
    return hash3(Math.floor(x * 60), 0, Math.floor(z * 60)) > 0.9 ? '#6b8f71' : mix('#a9bcb4', '#8fa69f', fbm(x * 10, 0, z * 10));
  }, { ...ISL, side: SEABED_SIDE });
  const top = 0.035 + 0.082;
  prism(gp, [[-0.09, -0.07], [0.09, -0.07], [0.09, 0.07], [-0.09, 0.07]], top - 0.005, 0.02, '#e7e1d0', 0.003);
  prism(gp, [[-0.075, -0.055], [0.075, -0.055], [0.075, 0.055], [-0.075, 0.055]], top + 0.015, 0.015, '#efe9da', 0.003);
  const colH = 0.14, ty = top + 0.03;
  for (let i = 0; i < 6; i++) for (const zz of [-0.045, 0.045]) {
    const x = -0.06 + i * 0.024, broken = hash3(i, zz * 100, 1) > 0.6, h = broken ? colH * (0.3 + hash3(i, zz * 100, 2) * 0.4) : colH;
    lathe(gp, [[0.009, 0], [0.008, h * 0.9], [0.011, h * 0.95], [0.011, h]], '#f1ece0', x, ty, zz, 10);
  }
  rbox(gp, '#e9e3d4', 0.012, ty + colH, 0.0, 0.12, 0.018, 0.11, 0.003);
  const ped = slab(gp, [[-0.06, 0], [0.06, 0], [0, 0.035]], 0.1, '#ebe5d6', 0.002, false);
  ped.rotation.y = Math.PI / 2; ped.position.set(0.012, ty + colH + 0.018, 0); ped.rotation.z = 0.12;
  for (const [x, z, a] of [[0.15, 0.06, 0.3], [-0.14, -0.1, 1.4], [0.24, -0.16, 2.1]] as const) {
    const m = cyl(gp, '#e5dfd0', x, hf(x, z) + 0.045, z, 0.011, 0.11, 10); m.rotation.set(0, a, Math.PI / 2);
  }
  const crystal = lathe(gp, [[0, 0], [0.018, 0.02], [0, 0.06]], c, 0.012, ty + colH + 0.05, 0, 6);
  crystal.material = glow(c);
  scatter(30, 41, (x, z) => { const rr = Math.hypot(x, z); if (!ringLand(rr)) { const y = hf(x, z) + 0.035, h = 0.06 + hash3(x * 40, z * 40, 3) * 0.1; tube(gp, [[x, y, z], [x + 0.01, y + h * 0.5, z], [x - 0.006, y + h, z + 0.01]], 0.004, 0.002, '#3f7a4a'); } }, 0.47);
  for (const [x, y, z, ry] of [[-0.3, 0.3, 0.1, 1], [0.28, 0.25, -0.2, -1.5], [0.1, 0.4, 0.3, 2.5], [-0.2, 0.42, -0.28, 0.4]] as const) fish(gp, x, y, z, 0.026, ry, ry > 1 ? '#f97316' : '#38bdf8');
  bubbles(gp, 8, 7, 0.02, 0.0, 0.32, 0.65);
};

// ---------------------------------------------------------------------------------------------------------
const crater: Builder = (gp, r) => {
  const c = r.color!;
  if (r.trees) {
    // Tunguska 1908: radial blow-down of the taiga around a charred "telegraph-pole" forest at ground zero
    const hf: HFn = (x, z) => 0.02 + 0.06 * Math.pow(fbm(x * 3 + 5, 0, z * 3), 2) + 0.006 * fbm(x * 20, 1, z * 20);
    island(gp, 0.5, hf, '#56703f', (x, y, z) => {
      const rr = Math.hypot(x, z), v = fbm(x * 14, y * 9, z * 14);
      if (rr < 0.12) return v > 0.5 ? '#3a332c' : '#4a4036';
      if (rr < 0.36) return mix(v > 0.55 ? '#7a6a48' : '#8a7a50', '#56703f', sstep(0.22, 0.36, rr));
      return v > 0.55 ? '#46613a' : '#56703f';
    }, { ...ISL, side: strataSide(EARTH) });
    const gy = onGround(hf);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + hash3(i, 2, 1) * 0.1, d0 = 0.13 + hash3(i, 2, 2) * 0.18, L = 0.07 + hash3(i, 2, 3) * 0.04;
      const x0 = Math.cos(a) * d0, z0 = Math.sin(a) * d0, x1 = Math.cos(a) * (d0 + L), z1 = Math.sin(a) * (d0 + L);
      strut(gp, [x0, gy(x0, z0) + 0.005, z0], [x1, gy(x1, z1) + 0.004, z1], 0.006, 0.0035, i % 3 ? '#5b4636' : '#3f3128', 5);
    }
    for (let i = 0; i < 9; i++) { const a = hash3(i, 3, 1) * Math.PI * 2, d = hash3(i, 3, 2) * 0.09, x = Math.cos(a) * d, z = Math.sin(a) * d; rod(gp, [x, gy(x, z), z], [x, gy(x, z) + 0.06 + hash3(i, 3, 3) * 0.05, z], 0.004, '#1f1a17', 5); }
    scatter(30, 51, (x, z) => { if (Math.hypot(x, z) > 0.37) pine(gp, x, gy(x, z), z, 0.07 + hash3(x * 30, z * 30, 1) * 0.04, '#2a5236'); }, 0.47);
    const m = sweep(gp, [{ p: [-0.4, 0.75, -0.3], w: 0.002 }, { p: [-0.12, 0.5, -0.1], w: 0.02 }, { p: [-0.04, 0.42, -0.04], w: 0.03 }], c, { radial: 10, sub: 4 });
    m.material = mat('#fdba74', { transparent: 0.55, emissive: '#f97316' });
    ellip(gp, '#fef3c7', -0.035, 0.415, -0.035, 0.03).material = glow('#fde68a');
    return;
  }
  // Darvaza "Door to Hell": Karakum dunes around a collapsed gas crater burning since 1971
  const hf: HFn = (x, z) => {
    const rr = Math.hypot(x * 1.1, z);
    const dunes = 0.03 + 0.03 * Math.sin(x * 9 + fbm(x * 3, 0, z * 3) * 4) * sstep(0.22, 0.4, rr);
    const rim = 0.025 * Math.exp(-((rr - 0.19) ** 2) / 0.002);
    const pit = -0.13 * (1 - sstep(0.12, 0.18, rr));
    return Math.max(-0.03, dunes + rim + pit + 0.004 * fbm(x * 30, 0, z * 30));
  };
  island(gp, 0.5, hf, '#d9b77e', (x, y, z, _nx, ny) => {
    const rr = Math.hypot(x * 1.1, z), t = y - 0.15;
    if (rr < 0.17) return t < -0.022 ? (hash3(Math.floor(x * 80), Math.floor(y * 80), Math.floor(z * 80)) > 0.6 ? '#f97316' : '#7c2d12') : ny < 0.6 ? '#57402c' : '#6b4a2e';
    return ny < 0.85 ? '#c49a62' : mix('#e2c38c', '#cfa86e', fbm(x * 12, 0, z * 12));
  }, { rings: 56, segs: 96, base: 0.15, side: strataSide(['#c49a62', '#b0874f', '#d2aa70']) });
  ellip(gp, '#fb923c', 0, 0.123, 0, 0.12, 0.006, 0.11).material = glow('#f97316');
  for (let i = 0; i < 26; i++) {
    const a = hash3(i, 6, 1) * Math.PI * 2, d = 0.03 + hash3(i, 6, 2) * 0.1, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.05 + hash3(i, 6, 3) * 0.09;
    cone(gp, i % 3 ? '#fbbf24' : '#f97316', x, 0.118, z, 0.012 + hash3(i, 6, 4) * 0.012, h, 6).material = glow(i % 3 ? '#fbbf24' : c);
  }
  sparkles(gp, Array.from({ length: 24 }, (_, i) => [(hash3(i, 8, 1) - 0.5) * 0.3, 0.24 + hash3(i, 8, 2) * 0.25, (hash3(i, 8, 3) - 0.5) * 0.3] as V3), 0.005, '#fde047');
  // Expedition camp: yurt-style tent, jeep
  const gyv = onGround(hf, 0.15);
  lathe(gp, [[0.045, 0], [0.045, 0.03], [0.02, 0.05], [0, 0.055]], '#f1ece0', 0.3, gyv(0.3, 0.18), 0.18, 12);
  rbox(gp, '#4d6b3a', -0.3, gyv(-0.3, 0.2) + 0.01, 0.2, 0.05, 0.03, 0.08, 0.006, 0.4);
  rbox(gp, '#3f5a30', -0.3, gyv(-0.3, 0.2) + 0.04, 0.19, 0.045, 0.02, 0.045, 0.006, 0.4);
  for (const [dx, dz] of [[-0.022, -0.03], [0.022, -0.03], [-0.022, 0.03], [0.022, 0.03]] as const) {
    const w = cyl(gp, '#111827', -0.3 + dx * Math.cos(0.4) + dz * Math.sin(0.4), gyv(-0.3, 0.2) + 0.012, 0.2 - dx * Math.sin(0.4) + dz * Math.cos(0.4), 0.012, 0.01, 10);
    w.rotation.set(0, 0.4, Math.PI / 2); w.position.y = gyv(-0.3, 0.2) + 0.012;
  }
};

// ---------------------------------------------------------------------------------------------------------
/** Half-dome cave shell (open toward +z), rough rock, rendered on both faces. */
function caveShell(gp: THREE.Object3D, R: number, H: number, rock: string, paint: Paint): (u: number, v: number) => V3 {
  const at = (u: number, v: number): V3 => {
    // u: azimuth 0..1 across the back (−x → +x via −z), v: 0 floor .. 1 crown
    const az = Math.PI * (0.02 + u * 0.96), el = v * Math.PI * 0.5;
    const n = 1 + 0.14 * (fbm(u * 6, v * 5, 3) - 0.5) * 2;
    return [-Math.cos(az) * Math.cos(el) * R * n, 0.03 + Math.sin(el) * H * n, -Math.sin(az) * Math.cos(el) * R * n * 0.9];
  };
  const rings: V3[][] = [];
  for (let i = 0; i <= 18; i++) { const ring: V3[] = []; for (let j = 0; j <= 28; j++) ring.push(at(j / 28, i / 18)); rings.push(ring); }
  skin(gp, rings, rock, { closed: false, paint, rough: 0.95 });
  skin(gp, rings.map(rg => rg.map(([x, y, z]) => [x * 1.04, y * 1.02 + 0.002, z * 1.04] as V3)), shade(rock, 0.8), { closed: false, inward: true, paint, rough: 0.95 });
  return at;
}

const crystals: Builder = (gp, r) => {
  const c = r.color!;
  if (r.glow) {
    // Waitomo: limestone grotto, underground river with a punt of visitors, ceiling of glowworm "stars"
    const hf: HFn = (x, z) => { const river = Math.exp(-((x - Math.sin(z * 4) * 0.06) ** 2) / 0.012); return 0.03 + 0.03 * fbm(x * 8, 0, z * 8) - 0.03 * river; };
    island(gp, 0.5, hf, '#5b5f63', (x, y, z, _nx, ny) => (y < 0.05 && ny > 0.97 ? ripple('#164e63')(x, y, z, 0, 1, 0) : mix('#6b6f73', '#4b4f53', fbm(x * 20, y * 20, z * 20))), { ...ISL, side: strataSide(['#5b5f63', '#4b4f53', '#6b6f73']) });
    const at = caveShell(gp, 0.47, 0.5, '#4b5056', (x, y, z) => (fbm(x * 30, y * 30, z * 30) > 0.6 ? '#3a3f45' : null));
    const pts: V3[] = [];
    for (let i = 0; i < 160; i++) { const [x, y, z] = at(0.08 + hash3(i, 1, 1) * 0.84, 0.35 + hash3(i, 1, 2) * 0.6); pts.push([x * 0.95, y * 0.97, z * 0.95]); }
    sparkles(gp, pts, 0.006, c);
    for (let i = 0; i < 18; i++) { const [x, y, z] = at(0.1 + hash3(i, 2, 1) * 0.8, 0.55 + hash3(i, 2, 2) * 0.35); cone(gp, '#c9c2b0', x * 0.93, y * 0.95 - 0.06, z * 0.93, 0.008, 0.06, 6).rotation.x = Math.PI; }
    const bt = new THREE.Group(); bt.position.set(0.02, 0.022, 0.12); bt.rotation.y = 0.15; gp.add(bt);
    hull(bt, '#8b6a45', { L: 0.2, B: 0.07, D: 0.025, wl: 0.006, fine: 0.3, deck: '#a47a52' });
    for (const z of [-0.05, 0, 0.05]) { ellip(bt, '#334155', 0, 0.045, z, 0.012, 0.02, 0.012); ellip(bt, '#f1c27d', 0, 0.072, z, 0.009); }
    return;
  }
  // Naica Cave of Crystals: 11-metre selenite beams criss-crossing a hot gypsum cave, a suited explorer for scale
  const hf: HFn = (x, z) => 0.025 + 0.04 * Math.pow(fbm(x * 5, 0, z * 5), 2) + 0.004 * fbm(x * 30, 0, z * 30);
  island(gp, 0.5, hf, '#b07a4a', (x, y, z) => mix('#c08a55', '#8a5a34', fbm(x * 18, y * 18, z * 18)), { ...ISL, side: strataSide(['#a06a3a', '#8a5a34', '#b07a4a']) });
  caveShell(gp, 0.47, 0.52, '#9a6a40', (x, y, z) => (fbm(x * 25, y * 25, z * 25) > 0.6 ? '#7a4f2c' : null));
  const beams: [V3, V3, number][] = [
    [[-0.38, 0.04, -0.2], [0.3, 0.42, 0.05], 0.032], [[0.36, 0.05, -0.25], [-0.25, 0.32, 0.18], 0.028], [[-0.1, 0.04, -0.38], [0.05, 0.5, 0.0], 0.03],
    [[0.2, 0.04, 0.2], [-0.05, 0.22, -0.2], 0.02], [[-0.3, 0.3, -0.25], [0.12, 0.06, 0.25], 0.022], [[0.05, 0.45, -0.32], [0.38, 0.12, -0.05], 0.024],
  ];
  for (const [a, b, rr] of beams) {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
    const geo = new THREE.CylinderGeometry(rr, rr, len, 6, 1);
    const tip = new THREE.ConeGeometry(rr, rr * 2.2, 6).translate(0, len / 2 + rr * 1.1, 0);
    const m = new THREE.Mesh(geo, mat(c, { transparent: 0.82, emissive: shade(c, 0.35), rough: 0.15 }));
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.add(new THREE.Mesh(tip, m.material));
    gp.add(m);
  }
  for (let i = 0; i < 10; i++) { const x = (hash3(i, 3, 1) - 0.5) * 0.6, z = (hash3(i, 3, 2) - 0.5) * 0.4; cone(gp, c, x, hf(x, z) + 0.03, z, 0.012, 0.05 + hash3(i, 3, 3) * 0.06, 6).material = mat(c, { transparent: 0.85, emissive: shade(c, 0.3) }); }
  const ex = new THREE.Group(); ex.position.set(0.16, hf(0.16, 0.22) + 0.035, 0.22); ex.rotation.y = -0.6; gp.add(ex);
  pblob(ex, '#f97316', 0, 0.05, 0, 0.016, 0.025, 0.013, undefined, [0, 0, 0], 12);
  ellip(ex, '#f8fafc', 0, 0.085, 0, 0.012);
  ellip(ex, '#fef9c3', 0, 0.09, 0.012, 0.004).material = glow('#fef9c3');
  tube(ex, [[-0.007, 0.03, 0], [-0.008, 0.0, 0.004]], 0.006, 0.005, '#f97316');
  tube(ex, [[0.007, 0.03, 0], [0.008, 0.0, -0.004]], 0.006, 0.005, '#f97316');
  box(ex, '#e2e8f0', 0, 0.04, -0.016, 0.022, 0.03, 0.01);
};

export const DISCOVERY_BUILDERS: Record<string, Builder> = { wreck, mystery, serpent, vent, footprints, sunkencity, crater, crystals };
