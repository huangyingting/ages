import * as THREE from 'three';
import type { Geo } from './geo.ts';
import { INK, ink } from './ink.ts';

interface Part { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; pulse: boolean; alpha: number }

/**
 * A glowing ground ring under a map object (hover and selection, after pocket-planet's globe): a soft disc, a crisp
 * ring and a breathing outer ring. It is drawn as map ink, flat at the object's foot, so it stays a perfect circle that
 * hills never cut through.
 */
export class Halo {
  readonly obj = new THREE.Group();
  private parts: Part[] = [];
  private r = 1;
  private k = 0;
  /** fade target: 1 shown, 0 hidden */
  on = false;

  constructor(private geo: Geo, color: string, accent: string, private speed = 4.5, disc = 0.3) {
    this.add(0, 0.88, color, disc, false);
    this.add(0.88, 1, color, 0.95, false);
    this.add(1.08, 1.15, accent, 0.7, true);
    this.obj.visible = false;
  }

  private add(r0: number, r1: number, color: string, alpha: number, pulse: boolean): void {
    const g = new THREE.RingGeometry(r0, r1, 96, 1).rotateX(-Math.PI / 2);
    const mat = ink(new THREE.MeshBasicMaterial({ color, opacity: 0, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = INK.halo;
    mesh.frustumCulled = false;
    this.obj.add(mesh);
    this.parts.push({ mesh, mat, pulse, alpha });
  }

  /** Centres the halo on world x/z with radius r (world units). */
  place(x: number, z: number, r: number): void {
    this.r = r;
    this.obj.position.set(x, Math.max(0, this.geo.height(this.geo.lon(x), this.geo.lat(z))) + 0.01, z);
  }

  tick(dt: number, t: number): void {
    this.k += ((this.on ? 1 : 0) - this.k) * Math.min(1, dt * 10);
    this.obj.visible = this.k > 0.01;
    if (!this.obj.visible) return;
    const breathe = 1 + Math.sin(t * this.speed) * 0.07;
    const wave = (t * 0.6) % 1;
    for (const p of this.parts) {
      p.mesh.scale.setScalar(this.r * (p.pulse ? breathe + wave * 0.35 : breathe));
      p.mat.opacity = p.alpha * this.k * (p.pulse ? 1 - wave : 1);
    }
  }

  dispose(): void {
    for (const p of this.parts) { p.mesh.geometry.dispose(); p.mat.dispose(); }
  }
}
