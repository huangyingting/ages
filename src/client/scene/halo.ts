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
  get radius(): number { return this.r; }

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

/**
 * A soft upright light over the selected event, so the one open event stands out from far away. It belongs to the
 * selection ring: same colour, same fade, no pulsing; width and height follow the ring's screen-constant radius.
 */
export class Beam {
  readonly obj: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private k = 0;
  on = false;

  constructor(private geo: Geo, color: string) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0);
    this.mat = ink(new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 } },
      vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          vH = position.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          // brightest at the ground, gone at the top; the core reads stronger than the rim
          float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
          gl_FragColor = vec4(uColor, uAlpha * pow(1.0 - vH, 1.8) * (0.25 + 0.75 * core));
        }`,
      side: THREE.DoubleSide,
    }));
    // a 3D object: hidden behind ridges and models, drawn after them
    this.mat.depthTest = true;
    this.mat.transparent = true;
    this.obj = new THREE.Mesh(g, this.mat);
    this.obj.frustumCulled = false;
    this.obj.visible = false;
  }

  /** Stands the beam at world x/z for a ring of radius r. */
  place(x: number, z: number, r: number): void {
    this.obj.position.set(x, Math.max(0, this.geo.height(this.geo.lon(x), this.geo.lat(z))), z);
    this.obj.scale.set(r * 0.14, r * 6, r * 0.14);
  }

  tick(dt: number): void {
    this.k += ((this.on ? 1 : 0) - this.k) * Math.min(1, dt * 6);
    this.obj.visible = this.k > 0.01;
    this.mat.uniforms.uAlpha.value = 0.6 * this.k;
  }

  dispose(): void {
    this.obj.geometry.dispose();
    this.mat.dispose();
  }
}
