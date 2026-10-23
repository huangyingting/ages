import * as THREE from 'three';
import { ANIM_NAMES } from './prims.ts';

const ANIM = new Set<string>(ANIM_NAMES);
let bakedFlat: THREE.MeshStandardMaterial | null = null;
let bakedSmooth: THREE.MeshStandardMaterial | null = null;
export function bakedMat(flat: boolean): THREE.MeshStandardMaterial {
  if (flat) return (bakedFlat ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0.04, side: THREE.DoubleSide }));
  return (bakedSmooth ??= new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide }));
}

/**
 * Merges every static, opaque, non-emissive mesh of a model into one vertex-coloured mesh per shading mode, with a
 * cheap height-based ambient occlusion (darker near the ground, lighter on top). Animated subtrees (named in
 * ANIM_NAMES) and emissive/transparent meshes are left as they are. A model ends up as 1–2 draw calls plus its
 * animated parts. Stores the model's height in `root.userData.height`.
 */
export function bake(root: THREE.Group): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const minY = box.min.y, H = Math.max(1e-3, box.max.y - box.min.y);
  root.userData.height = box.max.y;
  root.userData.radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  const buckets = { flat: { pos: [] as number[], col: [] as number[] }, smooth: { pos: [] as number[], col: [] as number[], nrm: [] as number[] } };
  const remove: THREE.Mesh[] = [];
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3(), col = new THREE.Color();
  const walk = (o: THREE.Object3D) => {
    if (o !== root && ANIM.has(o.name)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (!m.transparent && (!m.emissive || m.emissive.getHex() === 0)) {
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        const pa = g.getAttribute('position');
        let na = g.getAttribute('normal');
        if (!na) { g.computeVertexNormals(); na = g.getAttribute('normal'); }
        const b = m.flatShading ? buckets.flat : buckets.smooth;
        nm.getNormalMatrix(mesh.matrixWorld);
        const flip = mesh.matrixWorld.determinant() < 0;
        for (let i = 0; i < pa.count; i++) {
          const vi = flip ? i - (i % 3) + (2 - (i % 3)) : i;
          v.fromBufferAttribute(pa, vi).applyMatrix4(mesh.matrixWorld);
          b.pos.push(v.x, v.y, v.z);
          const t = Math.min(1, (v.y - minY) / (H * 0.45));
          const ao = 0.62 + 0.38 * t * t * (3 - 2 * t);
          col.copy(m.color).multiplyScalar(ao);
          b.col.push(col.r, col.g, col.b);
          if (b === buckets.smooth) { n.fromBufferAttribute(na, vi).applyMatrix3(nm).normalize(); buckets.smooth.nrm.push(n.x, n.y, n.z); }
        }
        remove.push(mesh);
      }
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  for (const m of remove) m.parent?.remove(m);
  // drop groups emptied by the merge
  const prune = (o: THREE.Object3D) => {
    for (const c of [...o.children]) prune(c);
    if (o !== root && !ANIM.has(o.name) && !(o as THREE.Mesh).isMesh && !o.children.length) o.parent?.remove(o);
  };
  prune(root);
  for (const [k, b] of Object.entries(buckets)) {
    if (!b.pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    if ('nrm' in b) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    else g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, bakedMat(k === 'flat'));
    mesh.castShadow = true;
    root.add(mesh);
  }
}
