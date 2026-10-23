import * as THREE from 'three';
import type { Geo } from './geo.ts';

const SEG = 56;

interface Part { geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial; r0: number; r1: number; pulse: boolean; alpha: number }

/**
 * A glowing ground ring under a map object (hover and selection, after pocket-planet's globe): a soft disc, a crisp
 * ring and a breathing outer ring. It is draped over the relief vertex by vertex so hills never cut through it.
 */
export class Halo {
  readonly obj = new THREE.Group();
  private parts: Part[] = [];
  private x = 0;
  private z = 0;
  private r = 1;
  private k = 0;
  /** fade target: 1 shown, 0 hidden */
  on = false;

  constructor(private geo: Geo, color: string, accent: string, private speed = 4.5) {
    this.add(0, 0.78, color, 0.3, false);
    this.add(0.78, 1, color, 1, false);
    this.add(1.06, 1.2, accent, 0.75, true);
    this.obj.visible = false;
    this.obj.renderOrder = 4;
  }

  private add(r0: number, r1: number, color: string, alpha: number, pulse: boolean): void {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < SEG; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    g.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
    });
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 4;
    m.frustumCulled = false;
    this.obj.add(m);
    this.parts.push({ geo: g, mat, r0, r1, pulse, alpha });
  }

  /** Centres the halo on world x/z with radius r (world units). */
  place(x: number, z: number, r: number): void {
    this.x = x; this.z = z; this.r = r;
  }

  tick(dt: number, t: number): void {
    this.k += ((this.on ? 1 : 0) - this.k) * Math.min(1, dt * 10);
    this.obj.visible = this.k > 0.01;
    if (!this.obj.visible) return;
    const breathe = 1 + Math.sin(t * this.speed) * 0.07;
    const wave = (t * 0.6) % 1;
    for (const p of this.parts) {
      const s = p.pulse ? breathe + wave * 0.35 : breathe;
      p.mat.opacity = p.alpha * this.k * (p.pulse ? 1 - wave : 1);
      this.drape(p, p.r0 * this.r * s, p.r1 * this.r * s);
    }
  }

  private drape(p: Part, r0: number, r1: number): void {
    const a = p.geo.attributes.position as THREE.BufferAttribute;
    const lift = 0.01 + this.r * 0.15;
    for (let i = 0; i <= SEG; i++) {
      const th = (i / SEG) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      for (let j = 0; j < 2; j++) {
        const r = j ? r1 : r0;
        const x = this.x + c * r, z = this.z + s * r;
        a.setXYZ(i * 2 + j, x, Math.max(0, this.geo.height(this.geo.lon(x), this.geo.lat(z))) + lift, z);
      }
    }
    a.needsUpdate = true;
  }

  dispose(): void {
    for (const p of this.parts) { p.geo.dispose(); p.mat.dispose(); }
  }
}
