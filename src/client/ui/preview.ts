import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import { outdoorEnvironment } from '../models/environment.ts';
import { instance } from '../models/library.ts';

/**
 * The turntable at the top of the info panel: the subject's 3D model (landmark, figure, army …) on a bronze plinth,
 * slowly turning; drag to spin it. One small renderer, shared by every card and only running while visible.
 */
export class Preview {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 2, 0.05, 100);
  private turn = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private key = '';
  private req = 0;
  private spin = 0.6;
  private angle = -0.5;
  private last = 0;
  private dirty = true;
  active = false;

  constructor(private still: boolean) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pv-gl';
    this.scene.add(this.turn);
    // pocket-planet's 3-point studio rig: warm key (casts the shadow), cool fill, golden rim, dim sky/ground bounce
    const key = new THREE.DirectionalLight('#fffbeb', 3.0);
    key.position.set(2.8, 4.2, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const c = key.shadow.camera;
    c.left = c.bottom = -2.2; c.right = c.top = 2.2; c.near = 1; c.far = 12;
    key.shadow.normalBias = 0.01;
    key.shadow.intensity = 0.8;
    const fill = new THREE.DirectionalLight('#c7d2fe', 0.9);
    fill.position.set(-3.2, 1.8, -2.0);
    const rim = new THREE.DirectionalLight('#fde68a', 0.9);
    rim.position.set(0.5, 2.5, -3.5);
    this.scene.add(key, fill, rim, new THREE.HemisphereLight('#e0f2fe', '#2a2219', 0.35));
    // a stepped bronze plinth with a hairline ring, so every model sits on the same stage
    const plinth = new THREE.Group();
    const m1 = new THREE.MeshStandardMaterial({ color: '#2a2219', roughness: 0.8, metalness: 0.2 });
    const m2 = new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 0.45, metalness: 0.75 });
    const a = new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.3, 0.08, 64), m1);
    a.position.y = -0.04;
    a.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.012, 6, 96), m2);
    ring.rotation.x = Math.PI / 2;
    plinth.add(a, ring);
    this.scene.add(plinth);
    this.bindDrag();
  }

  private ensure(): THREE.WebGLRenderer | null {
    if (this.renderer) return this.renderer;
    try {
      const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.NeutralToneMapping;
      r.toneMappingExposure = 0.95;
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFShadowMap;
      this.scene.environment = outdoorEnvironment(r);
      this.scene.environmentIntensity = 0.55;
      this.renderer = r;
      r.setAnimationLoop(t => this.frame(t));
    } catch { this.renderer = null; }
    return this.renderer;
  }

  /** Shows a model (built off-thread through the shared library). */
  async show(recipe: ModelRecipe | null): Promise<void> {
    const key = recipe ? JSON.stringify(recipe) : '';
    if (key === this.key) return;
    this.key = key;
    const id = ++this.req;
    if (this.model) { this.turn.remove(this.model); this.model = null; }
    this.canvas.parentElement?.classList.add('pv-loading');
    this.dirty = true;
    if (!recipe || !this.ensure()) return;
    let g: THREE.Group;
    try { g = await instance(recipe, true); } catch { return; }
    if (id !== this.req) return;
    // frame the model: normalise to the plinth and aim the camera at its middle
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const k = 1.9 / Math.max(size.x, size.z, size.y * 0.9, 0.01);
    g.scale.multiplyScalar(k);
    g.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
    this.model = g;
    this.turn.add(g);
    const h = size.y * k;
    this.cam.position.set(0, 0.9 + h * 0.55, 3.9 + h * 0.35);
    this.cam.lookAt(0, h * 0.42, 0);
    this.angle = -0.5;
    this.dirty = true;
    this.canvas.parentElement?.classList.remove('pv-loading');
  }

  private bindDrag(): void {
    let x0 = -1;
    this.canvas.addEventListener('pointerdown', e => { x0 = e.clientX; this.canvas.setPointerCapture(e.pointerId); this.spin = 0; });
    this.canvas.addEventListener('pointermove', e => {
      if (x0 < 0) return;
      this.angle += (e.clientX - x0) * 0.012;
      x0 = e.clientX;
      this.dirty = true;
    });
    const up = () => { x0 = -1; this.spin = 0.6; };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    // cap at ~24 fps; idle (hidden card, background tab, low-end) costs nothing
    if (!this.active || document.hidden || (!this.dirty && (this.still || now - this.last < 40))) { if (!this.active) this.last = now; return; }
    this.last = now;
    if (!this.still) this.angle += dt * this.spin;
    this.turn.rotation.y = this.angle;
    const r = this.renderer!;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const s = r.getSize(new THREE.Vector2());
    if (s.x !== w || s.y !== h) { r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    r.render(this.scene, this.cam);
    this.dirty = false;
  }
}
