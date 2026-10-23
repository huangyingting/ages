import * as THREE from 'three';

/**
 * Transferable form of a built model, so models can be built in a Web Worker and rebuilt on the main thread
 * (same idea as pocket-planet's pack.ts). Supports Group/Object3D/Mesh trees with plain BufferGeometry and
 * untextured MeshStandardMaterial; anything else throws and the caller builds on the main thread instead.
 */
interface PAttr { name: string; array: Float32Array | Uint16Array | Uint32Array; itemSize: number }
interface PGeo { attrs: PAttr[]; index?: Uint16Array | Uint32Array }
interface PNode { k: 0 | 1 | 2; n?: string; m?: number[]; ud?: Record<string, unknown>; g?: number; mt?: number; c?: PNode[] }
export interface PackedModel { root: PNode; geos: PGeo[]; mats: Record<string, unknown>[] }

const MAT_KEYS = ['color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'flatShading', 'vertexColors', 'transparent', 'opacity', 'side', 'depthWrite', 'toneMapped'] as const;
const IDENT = new THREE.Matrix4();

export function packModel(root: THREE.Object3D): { model: PackedModel; transfer: ArrayBuffer[] } {
  const geos: PGeo[] = [], mats: Record<string, unknown>[] = [], transfer: ArrayBuffer[] = [];
  const gi = new Map<THREE.BufferGeometry, number>(), mi = new Map<THREE.Material, number>();
  const geoIdx = (g: THREE.BufferGeometry) => {
    let i = gi.get(g);
    if (i !== undefined) return i;
    const attrs: PAttr[] = [];
    for (const [name, a] of Object.entries(g.attributes)) {
      const ba = a as THREE.BufferAttribute;
      if (!(ba.array instanceof Float32Array || ba.array instanceof Uint16Array || ba.array instanceof Uint32Array)) throw new Error('attribute type');
      const array = ba.array.slice();
      transfer.push(array.buffer);
      attrs.push({ name, array, itemSize: ba.itemSize });
    }
    const pg: PGeo = { attrs };
    if (g.index) { pg.index = (g.index.array as Uint16Array | Uint32Array).slice(); transfer.push(pg.index.buffer as ArrayBuffer); }
    gi.set(g, (i = geos.length));
    geos.push(pg);
    return i;
  };
  const matIdx = (m: THREE.Material) => {
    let i = mi.get(m);
    if (i !== undefined) return i;
    if (m.type !== 'MeshStandardMaterial') throw new Error('material ' + m.type);
    const rec = m as unknown as Record<string, unknown>, p: Record<string, unknown> = {};
    for (const k of MAT_KEYS) { const v = rec[k]; if (v !== undefined) p[k] = v instanceof THREE.Color ? v.getHex() : v; }
    mi.set(m, (i = mats.length));
    mats.push(p);
    return i;
  };
  const walk = (o: THREE.Object3D): PNode => {
    const mesh = o as THREE.Mesh;
    const k: PNode['k'] = mesh.isMesh ? 2 : (o as THREE.Group).isGroup ? 1 : 0;
    if (k === 0 && o.type !== 'Object3D') throw new Error('object ' + o.type);
    const n: PNode = { k };
    if (o.name) n.n = o.name;
    o.updateMatrix();
    if (!o.matrix.equals(IDENT)) n.m = o.matrix.toArray();
    if (Object.keys(o.userData).length) n.ud = { ...o.userData };
    if (k === 2) {
      if (Array.isArray(mesh.material)) throw new Error('multi-material');
      n.g = geoIdx(mesh.geometry);
      n.mt = matIdx(mesh.material);
    }
    if (o.children.length) n.c = o.children.map(walk);
    return n;
  };
  return { model: { root: walk(root), geos, mats }, transfer };
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function unpackModel(pm: PackedModel): THREE.Group {
  const geos = pm.geos.map(pg => {
    const g = new THREE.BufferGeometry();
    for (const a of pg.attrs) g.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize));
    if (pg.index) g.setIndex(new THREE.BufferAttribute(pg.index, 1));
    g.computeBoundingSphere();
    return g;
  });
  const mats = pm.mats.map(p => {
    const key = JSON.stringify(p);
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial();
      for (const [k, v] of Object.entries(p)) {
        const cur = (m as unknown as Record<string, unknown>)[k];
        if (cur instanceof THREE.Color) cur.setHex(v as number);
        else (m as unknown as Record<string, unknown>)[k] = v;
      }
      m.needsUpdate = true;
      matCache.set(key, m);
    }
    return m;
  });
  const build = (n: PNode): THREE.Object3D => {
    const o = n.k === 2 ? new THREE.Mesh(geos[n.g!], mats[n.mt!]) : n.k === 1 ? new THREE.Group() : new THREE.Object3D();
    if (n.n) o.name = n.n;
    if (n.m) { o.matrix.fromArray(n.m); o.matrix.decompose(o.position, o.quaternion, o.scale); }
    if (n.ud) o.userData = n.ud;
    if (n.c) for (const c of n.c) o.add(build(c));
    return o;
  };
  const root = build(pm.root);
  if ((root as THREE.Group).isGroup) return root as THREE.Group;
  const g = new THREE.Group();
  g.add(root);
  return g;
}
