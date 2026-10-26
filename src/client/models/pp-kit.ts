import * as THREE from 'three';
import { mat } from './prims.ts';
import { PBR_ATTR, inferPbr, useVertexPbr } from './pbr.ts';

export { mat };


// Shared vertex-colored materials for baked static meshes: smooth or flat; roughness / metalness ride per vertex.
const bakedMats = new Map<string, THREE.MeshStandardMaterial>();
function bakedMat(flat: boolean): THREE.MeshStandardMaterial {
  const k = `${flat}`;
  let m = bakedMats.get(k);
  if (!m) {
    // roughness / metalness come per vertex (see pbr.ts); these only seed the material
    m = useVertexPbr(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0.04, flatShading: flat }));
    bakedMats.set(k, m);
  }
  return m;
}

/** Triangle soup; `parts` holds the first vertex of every source mesh (for per-part simplification). */
interface Bucket { pos: number[]; norm: number[]; col: number[]; pbr: number[]; parts?: number[] }

// Cosine-weighted hemisphere ray set (z-up) for the ambient-occlusion bake.
const AO_DIRS: THREE.Vector3[] = (() => {
  const out: THREE.Vector3[] = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, phi = i * 2.399963;
    const r = Math.sqrt(u);
    out.push(new THREE.Vector3(Math.cos(phi) * r, Math.sin(phi) * r, Math.sqrt(1 - u)));
  }
  return out;
})();

/**
 * Bakes ambient occlusion into vertex colors: triangles are voxelised into an occupancy grid, then a short
 * cosine-weighted ray fan is marched from every vertex. Crevices, arcades, undersides and ground contact darken.
 */
function bakeAO(buckets: Bucket[], minY: number): void {
  const bb = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const b of buckets) for (let i = 0; i < b.pos.length; i += 3) bb.expandByPoint(v.set(b.pos[i], b.pos[i + 1], b.pos[i + 2]));
  if (bb.isEmpty()) return;
  const size = bb.getSize(new THREE.Vector3());
  const R = 44;
  const cs = Math.max(size.x, size.y, size.z) / R;
  const ox = bb.min.x - cs * 2, oy = bb.min.y - cs * 2, oz = bb.min.z - cs * 2;
  const nx = Math.ceil(size.x / cs) + 5, ny = Math.ceil(size.y / cs) + 5, nz = Math.ceil(size.z / cs) + 5;
  const grid = new Uint8Array(nx * ny * nz);
  const mark = (x: number, y: number, z: number) => {
    const ix = Math.floor((x - ox) / cs), iy = Math.floor((y - oy) / cs), iz = Math.floor((z - oz) / cs);
    if (ix >= 0 && iy >= 0 && iz >= 0 && ix < nx && iy < ny && iz < nz) grid[ix + nx * (iy + ny * iz)] = 1;
  };
  for (const b of buckets) {
    const P = b.pos;
    for (let t = 0; t < P.length; t += 9) {
      const ax = P[t], ay = P[t + 1], az = P[t + 2], bx = P[t + 3], by = P[t + 4], bz = P[t + 5], cx = P[t + 6], cy = P[t + 7], cz = P[t + 8];
      const e = Math.max(Math.hypot(bx - ax, by - ay, bz - az), Math.hypot(cx - ax, cy - ay, cz - az), Math.hypot(cx - bx, cy - by, cz - bz));
      const n = Math.min(160, Math.max(1, Math.ceil(e / (cs * 0.6))));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, w = j / n, s = 1 - u - w;
        mark(ax * s + bx * u + cx * w, ay * s + by * u + cy * w, az * s + bz * u + cz * w);
      }
    }
  }
  const occ = (x: number, y: number, z: number) => {
    if (y < minY - cs * 0.5) return true;
    const ix = Math.floor((x - ox) / cs), iy = Math.floor((y - oy) / cs), iz = Math.floor((z - oz) / cs);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return false;
    return grid[ix + nx * (iy + ny * iz)] === 1;
  };
  const N = new THREE.Vector3(), Tg = new THREE.Vector3(), Bt = new THREE.Vector3(), D = new THREE.Vector3();
  const cache = new Map<number, number>();
  const STEPS = 7;
  for (const b of buckets) {
    for (let i = 0; i < b.pos.length; i += 3) {
      const px = b.pos[i], py = b.pos[i + 1], pz = b.pos[i + 2];
      N.set(b.norm[i], b.norm[i + 1], b.norm[i + 2]);
      // Numeric spatial hash of (half-cell position, coarse normal) — vertices shared by faces reuse one sample
      const key = (Math.round(px / cs * 2) * 73856093) ^ (Math.round(py / cs * 2) * 19349663) ^ (Math.round(pz / cs * 2) * 83492791)
        ^ ((Math.round(N.x * 3) + 3) | ((Math.round(N.y * 3) + 3) << 3) | ((Math.round(N.z * 3) + 3) << 6)) * 2654435761;
      let ao = cache.get(key);
      if (ao === undefined) {
        Tg.set(Math.abs(N.y) < 0.9 ? 0 : 1, Math.abs(N.y) < 0.9 ? 1 : 0, 0).cross(N).normalize();
        Bt.crossVectors(N, Tg);
        let hit = 0;
        for (const d of AO_DIRS) {
          D.set(0, 0, 0).addScaledVector(Tg, d.x).addScaledVector(Bt, d.y).addScaledVector(N, d.z);
          for (let s = 1; s <= STEPS; s++) {
            const dist = cs * (0.9 + s * 1.3);
            if (occ(px + N.x * cs * 0.9 + D.x * dist, py + N.y * cs * 0.9 + D.y * dist, pz + N.z * cs * 0.9 + D.z * dist)) {
              hit += 1 - (s - 1) / (STEPS * 1.4);
              break;
            }
          }
        }
        ao = Math.max(0.34, 1 - 0.95 * (hit / AO_DIRS.length));
        cache.set(key, ao);
      }
      b.col[i] *= ao; b.col[i + 1] *= ao; b.col[i + 2] *= ao;
    }
  }
}

/** Far level of detail: parts with more triangles than this are simplified; smaller ones are kept as they are. */
const LOD_KEEP_TRIS = 60;
/** ... by snapping their vertices to cells of 1/LOD_CELLS of the part's size (capped at R / LOD_CELLS). */
const LOD_CELLS = 7;
const LOD_DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function soupArea(pos: number[], v0: number, v1: number): number {
  let A = 0;
  for (let i = v0 * 3; i + 8 < v1 * 3; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    A += Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2;
  }
  return A;
}

/** Vertex clustering of vertices [s0, s1) of a soup on a grid of `cell` (origin x0,y0,z0) × 6 normal directions. */
function clusterPart(b: Bucket, s0: number, s1: number, x0: number, y0: number, z0: number, cell: number, withColor: boolean): Bucket {
  const out: Bucket = { pos: [], norm: [], col: [], pbr: [] };
  const ids = new Map<number, number>();
  const vert = new Int32Array(s1 - s0);
  const acc: number[] = []; // per cluster: x y z nx ny nz r g b count roughness metalness
  for (let i = s0; i < s1; i++) {
    const x = b.pos[i * 3], y = b.pos[i * 3 + 1], z = b.pos[i * 3 + 2];
    const nx = b.norm[i * 3], ny = b.norm[i * 3 + 1], nz = b.norm[i * 3 + 2];
    let d = 0, best = -2;
    for (let k = 0; k < 6; k++) {
      const v = LOD_DIRS[k][0] * nx + LOD_DIRS[k][1] * ny + LOD_DIRS[k][2] * nz;
      if (v > best) { best = v; d = k; }
    }
    const key = ((Math.floor((x - x0) / cell) * 128 + Math.floor((y - y0) / cell)) * 128 + Math.floor((z - z0) / cell)) * 6 + d;
    let c = ids.get(key);
    if (c === undefined) { c = ids.size; ids.set(key, c); acc.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); }
    const o = c * 12;
    acc[o] += x; acc[o + 1] += y; acc[o + 2] += z;
    acc[o + 3] += nx; acc[o + 4] += ny; acc[o + 5] += nz;
    if (withColor) { acc[o + 6] += b.col[i * 3]; acc[o + 7] += b.col[i * 3 + 1]; acc[o + 8] += b.col[i * 3 + 2]; }
    acc[o + 9]++;
    acc[o + 10] += b.pbr[i * 2]; acc[o + 11] += b.pbr[i * 2 + 1];
    vert[i - s0] = c;
  }
  const seen = new Set<number>();
  const nc = ids.size;
  const push = (c: number) => {
    const o = c * 12, k = acc[o + 9];
    out.pos.push(acc[o] / k, acc[o + 1] / k, acc[o + 2] / k);
    const l = Math.hypot(acc[o + 3], acc[o + 4], acc[o + 5]) || 1;
    out.norm.push(acc[o + 3] / l, acc[o + 4] / l, acc[o + 5] / l);
    if (withColor) out.col.push(acc[o + 6] / k, acc[o + 7] / k, acc[o + 8] / k);
    out.pbr.push(acc[o + 10] / k, acc[o + 11] / k);
  };
  for (let t = 0; t + 2 < s1 - s0; t += 3) {
    const a = vert[t], b2 = vert[t + 1], c = vert[t + 2];
    if (a === b2 || b2 === c || a === c) continue;
    // rotate so the smallest id leads: same winding ⇒ same key
    const [p, q, r] = a < b2 && a < c ? [a, b2, c] : b2 < c ? [b2, c, a] : [c, a, b2];
    const key = (p * nc + q) * nc + r;
    if (seen.has(key)) continue;
    seen.add(key);
    push(a); push(b2); push(c);
  }
  return out;
}

/**
 * Far level of detail for a triangle soup, part by part (so thin structures never vanish and colours never bleed
 * between parts). Low-poly parts are copied as they are; high-poly (curved) parts are vertex-clustered: vertices merge
 * per (grid cell × dominant normal direction), so faces pointing different ways stay apart and the silhouette and
 * shading survive. A part whose simplified surface area shrinks by more than 30% (thin lattices, leaf clumps) is
 * retried with half-size cells and otherwise kept as it is.
 */
function clusterLod(b: Bucket, R: number, withColor: boolean): Bucket {
  const out: Bucket = { pos: [], norm: [], col: [], pbr: [] };
  const n = b.pos.length / 3;
  const starts = b.parts?.length ? b.parts : [0];
  const copy = (v0: number, v1: number) => {
    for (let k = v0 * 3; k < v1 * 3; k++) { out.pos.push(b.pos[k]); out.norm.push(b.norm[k]); }
    if (withColor) for (let k = v0 * 3; k < v1 * 3; k++) out.col.push(b.col[k]);
    for (let k = v0 * 2; k < v1 * 2; k++) out.pbr.push(b.pbr[k]);
  };
  for (let pi = 0; pi < starts.length; pi++) {
    const s0 = starts[pi], s1 = pi + 1 < starts.length ? starts[pi + 1] : n;
    if (s1 - s0 <= LOD_KEEP_TRIS * 3) { copy(s0, s1); continue; }
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = s0; i < s1; i++) {
      const x = b.pos[i * 3], y = b.pos[i * 3 + 1], z = b.pos[i * 3 + 2];
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z);
    }
    const base = Math.max(1e-6, Math.min(R, Math.max(x1 - x0, y1 - y0, z1 - z0)) / LOD_CELLS);
    const area0 = soupArea(b.pos, s0, s1);
    let done = false;
    for (const cell of [base, base / 2]) {
      const part = clusterPart(b, s0, s1, x0, y0, z0, cell, withColor);
      // accept only if it actually saves triangles and keeps the surface (thin lattices collapse otherwise)
      if (part.pos.length < (s1 - s0) * 3 * 0.7 && soupArea(part.pos, 0, part.pos.length / 3) > area0 * 0.7) {
        for (const v of part.pos) out.pos.push(v);
        for (const v of part.norm) out.norm.push(v);
        for (const v of part.col) out.col.push(v);
        for (const v of part.pbr) out.pbr.push(v);
        done = true;
        break;
      }
    }
    if (!done) copy(s0, s1);
  }
  return out;
}

/** Parts smaller than this fraction of the model's radius are "detail": dropped at the far level of detail. */
export const LOD_DETAIL = 0.045;
const KEEP = new Set(['spin', 'flap', 'sway', 'bob', 'flicker', 'smoke']);

/**
 * Merges static child meshes of a built model group into a few vertex-colored meshes (smooth / flat) that keep each
 * part's roughness and metalness per vertex, baking ambient occlusion, while preserving animated sub-groups (`spin`, `flap`). Remaining emissive/transparent
 * static meshes that share a material are merged too, so a model costs only a handful of draw calls.
 *
 * Level of detail: every merged geometry holds the full-detail triangles (large parts, then small parts with
 * radius < LOD_DETAIL × model radius) followed by a coarse vertex-clustered copy of the large parts.
 * `geometry.userData.lod = [start, count]` is that far range, so a far-away instance draws only a fraction of the
 * triangles from the same GPU buffers. Small unmerged meshes get `userData.lodHide`. The model radius is stored as
 * `gp.userData.radius`.
 */
export function bakeStaticMeshes(gp: THREE.Group): void {
  gp.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gp);
  const R = Math.max(1e-6, bounds.getSize(new THREE.Vector3()).length() / 2);
  gp.userData.radius = R;
  const isDetail = (mesh: THREE.Mesh) => {
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    return geo.boundingSphere!.radius * mesh.matrixWorld.getMaxScaleOnAxis() < R * LOD_DETAIL;
  };
  type Pair = { main: Bucket; detail: Bucket };
  const newPair = (): Pair => ({ main: { pos: [], norm: [], col: [], pbr: [] }, detail: { pos: [], norm: [], col: [], pbr: [] } });
  const buckets = new Map<string, Pair>();
  const toRemove: THREE.Mesh[] = [];
  // other static meshes (emissive / transparent), grouped by material for merging
  const extra = new Map<THREE.Material, THREE.Mesh[]>();
  const tmpV = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const tmpC = new THREE.Color();
  const normMat = new THREE.Matrix3();

  const append = (b: Bucket, mesh: THREE.Mesh, color: THREE.Color | null, rough: number, metal: number, autoVertPbr = false) => {
    let g0 = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    if (!g0.getAttribute('normal')) { g0 = g0 === mesh.geometry ? g0.clone() : g0; g0.computeVertexNormals(); }
    const pAttr = g0.getAttribute('position');
    const nAttr = g0.getAttribute('normal');
    const cAttr = g0.getAttribute('color');
    normMat.getNormalMatrix(mesh.matrixWorld);
    const flipped = mesh.matrixWorld.determinant() < 0;
    (b.parts ??= []).push(b.pos.length / 3);
    for (let i = 0; i < pAttr.count; i++) {
      const vi = flipped ? i - (i % 3) + (2 - (i % 3)) : i;
      tmpV.fromBufferAttribute(pAttr, vi).applyMatrix4(mesh.matrixWorld);
      tmpN.fromBufferAttribute(nAttr, vi).applyMatrix3(normMat).normalize();
      b.pos.push(tmpV.x, tmpV.y, tmpV.z);
      b.norm.push(tmpN.x, tmpN.y, tmpN.z);
      if (color) {
        if (cAttr) tmpC.fromBufferAttribute(cAttr as THREE.BufferAttribute, vi).multiply(color);
        else tmpC.copy(color);
        b.col.push(tmpC.r, tmpC.g, tmpC.b);
      } else if (cAttr) {
        tmpC.fromBufferAttribute(cAttr as THREE.BufferAttribute, vi);
        b.col.push(tmpC.r, tmpC.g, tmpC.b);
      }
      if (autoVertPbr) {
        const [vr, vm] = inferPbr(tmpC);
        b.pbr.push(vr, vm);
      } else {
        b.pbr.push(rough, metal);
      }
    }
  };

  const walk = (obj: THREE.Object3D, animated: boolean) => {
    const isAnim = animated || KEEP.has(obj.name);
    if (!isAnim && (obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m && !Array.isArray(m) && !m.transparent && (!m.emissive || m.emissive.getHex() === 0)) {
        const key = `${m.flatShading}`;
        let b = buckets.get(key);
        if (!b) { b = newPair(); buckets.set(key, b); }
        const hasVC = !!mesh.geometry.getAttribute('color');
        const [rough, metal] = m.userData.autoPbr && !hasVC ? inferPbr(m.color) : [m.roughness ?? 0.66, m.metalness ?? 0];
        append(isDetail(mesh) ? b.detail : b.main, mesh, m.color, rough, metal, !!m.userData.autoPbr && hasVC);
        toRemove.push(mesh);
      } else if (m && !Array.isArray(m) && mesh.parent === gp && !mesh.geometry.morphAttributes.position) {
        let l = extra.get(m);
        if (!l) extra.set(m, (l = []));
        l.push(mesh);
      }
    }
    for (const ch of obj.children) walk(ch, isAnim);
  };
  walk(gp, false);
  for (const m of toRemove) m.parent?.remove(m);

  const minY = new THREE.Box3().setFromObject(gp).min.y;
  const list = [...buckets.values()].flatMap(b => [b.main, b.detail]);
  let lo = Infinity;
  for (const b of list) for (let i = 1; i < b.pos.length; i += 3) lo = Math.min(lo, b.pos[i]);
  bakeAO(list, Math.min(minY, lo));

  const toGeo = ({ main, detail }: Pair, withColor: boolean, withPbr = true) => {
    const near = main.pos.length + detail.pos.length;
    const far = main.pos.length ? clusterLod(main, R, withColor) : null;
    const useFar = far && far.pos.length < main.pos.length * 0.8;
    const cat = (k: 'pos' | 'norm' | 'col' | 'pbr') => main[k].concat(detail[k], useFar ? far[k] : []);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(cat('pos'), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(cat('norm'), 3));
    if (withColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(cat('col'), 3));
    if (withPbr) geo.setAttribute(PBR_ATTR, new THREE.BufferAttribute(Uint8Array.from(cat('pbr'), v => Math.round(Math.min(1, Math.max(0, v)) * 255)), 2, true));
    if (useFar) geo.userData.lod = [near / 3, far.pos.length / 3];
    else if (detail.pos.length && main.pos.length) geo.userData.lod = [0, main.pos.length / 3];
    geo.userData.near = [0, near / 3];
    geo.userData.fresh = true;
    geo.setDrawRange(0, near / 3);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  };
  for (const [key, b] of buckets) {
    if (!b.main.pos.length && !b.detail.pos.length) continue;
    const mesh = new THREE.Mesh(toGeo(b, true), bakedMat(key === 'true'));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    gp.add(mesh);
  }

  // Merge same-material emissive / transparent meshes that sit directly under the root (keeps nested groups intact).
  for (const [m, meshes] of extra) {
    if (meshes.length < 2) {
      if (isDetail(meshes[0])) meshes[0].userData.lodHide = true;
      continue;
    }
    const vc = !!(m as THREE.MeshStandardMaterial).vertexColors;
    if (vc && meshes.some(x => !x.geometry.getAttribute('color'))) continue;
    const pair = newPair();
    for (const x of meshes) append(isDetail(x) ? pair.detail : pair.main, x, null, 0, 0);
    const merged = new THREE.Mesh(toGeo(pair, vc, false), m);
    const first = meshes[0];
    merged.renderOrder = first.renderOrder;
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.frustumCulled = meshes.every(x => x.frustumCulled);
    if (!pair.main.pos.length) merged.userData.lodHide = true;
    for (const x of meshes) gp.remove(x);
    gp.add(merged);
  }
}

