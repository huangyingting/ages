import * as THREE from 'three';
import type { Geo } from './geo.ts';
import { INK, ink } from './ink.ts';

interface Part { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; alpha: number }

/**
 * One thin ground ring with a faint tint, shared by hover and selection. Map ink keeps it unbroken by relief.
 */
export class Halo {
  readonly obj = new THREE.Group();
  private parts: Part[] = [];
  private r = 1;
  private k = 0;
  /** fade target: 1 shown, 0 hidden */
  on = false;

  constructor(private geo: Geo, color: string, disc = 0.06) {
    this.add(0, 0.96, color, disc);
    this.add(0.96, 1, color, 0.95);
    this.obj.visible = false;
  }

  private add(r0: number, r1: number, color: string, alpha: number): void {
    const g = new THREE.RingGeometry(r0, r1, 96, 1).rotateX(-Math.PI / 2);
    const mat = ink(new THREE.MeshBasicMaterial({ color, opacity: 0, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(g, mat);
    mesh.renderOrder = INK.halo;
    mesh.frustumCulled = false;
    this.obj.add(mesh);
    this.parts.push({ mesh, mat, alpha });
  }

  /** Centres the halo on world x/z with radius r (world units). */
  place(x: number, z: number, r: number): void {
    this.r = r;
    this.obj.position.set(x, Math.max(0, this.geo.height(this.geo.lon(x), this.geo.lat(z))) + 0.01, z);
  }

  tick(dt: number): void {
    this.k += ((this.on ? 1 : 0) - this.k) * Math.min(1, dt * 10);
    this.obj.visible = this.k > 0.01;
    if (!this.obj.visible) return;
    for (const p of this.parts) {
      p.mesh.scale.setScalar(this.r);
      p.mat.opacity = p.alpha * this.k;
    }
  }

  dispose(): void {
    for (const p of this.parts) { p.mesh.geometry.dispose(); p.mat.dispose(); }
  }
}
