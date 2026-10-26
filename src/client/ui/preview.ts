import * as THREE from 'three';
import type { ModelRecipe } from '../../shared/data/types.ts';
import { outdoorEnvironment } from '../models/environment.ts';
import { instance } from '../models/library.ts';

/**
 * The turntable at the top of the info panel: the subject's 3D model (landmark, figure, army …) on its own base,
 * slowly turning; drag to spin it. One small renderer, shared by every card and only running while visible.
 */
/** Idle turntable speed (rad/s). */
const SPIN = 0.3;
/** Intro: the camera glides in from INTRO_FAR × the resting distance and INTRO_RISE rad higher while the model turns INTRO_YAW into place. */
const INTRO_MS = 750, INTRO_FAR = 1.25, INTRO_RISE = 0.16, INTRO_YAW = 0.45;

export class Preview {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(28, 2, 0.05, 100);
  private turn = new THREE.Group();
  private model: THREE.Object3D | null = null;
  private key = '';
  private req = 0;
  private spin = SPIN;
  private angle = -0.5;
  /** Final framing (orbit distance, elevation, look-at height) and the intro start time (−1: on the next frame, Infinity: done). */
  private pose = { d: 4, e: 0.3, y: 0.5 };
  private introAt = Infinity;
  private last = 0;
  private dirty = true;
  private _active = false;
  get active(): boolean { return this._active; }
  set active(on: boolean) {
    if (on === this._active) return;
    this._active = on;
    if (on) {
      this.dirty = true;
      this.last = 0;
      this.renderer?.setAnimationLoop(t => this.frame(t));
    } else {
      this.renderer?.setAnimationLoop(null);
    }
  }

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
    // models bring their own base; an invisible floor only catches a soft contact shadow
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.18 }));
    floor.receiveShadow = true;
    this.scene.add(floor);
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
      if (this._active) r.setAnimationLoop(t => this.frame(t));
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
    // nothing to show, or it failed (e.g. offline): drop the spinner, and forget the key so reopening retries
    const fail = () => { if (id !== this.req) return; this.canvas.parentElement?.classList.remove('pv-loading'); this.key = ''; };
    if (!recipe || !this.ensure()) return fail();
    let g: THREE.Group;
    try { g = await instance(recipe, true); } catch { return fail(); }
    if (id !== this.req) return;
    g.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const near = mesh.geometry.userData.near as [number, number] | undefined;
      if (near && mesh.geometry.userData.lod) {
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.setDrawRange(near[0], near[1]);
      }
    });
    // frame the model tightly inside the compact hero strip so there is minimal dead space around it
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3());
    const k = 2.0 / Math.max(size.x, size.z, size.y * 0.85, 0.01);
    g.scale.multiplyScalar(k);
    g.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
    this.model = g;
    this.turn.add(g);
    const h = size.y * k, w = Math.hypot(size.x, size.z) * k * 0.78;
    const el = 0.25, ly = h * 0.48;
    const aspect = (this.canvas.clientWidth && this.canvas.clientHeight) ? this.canvas.clientWidth / this.canvas.clientHeight : 2.3;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.cam.fov * 0.5));
    const projH = h * Math.cos(el) + w * Math.sin(el);
    const dv = (projH * 0.53) / tanHalf;
    const dh = (w * 0.54) / (tanHalf * aspect);
    this.pose = { d: Math.max(1.8, dv, dh), e: el, y: ly };
    this.angle = -0.5;
    this.introAt = this.still || matchMedia('(prefers-reduced-motion: reduce)').matches ? Infinity : -1;
    this.place(1);
    this.dirty = true;
    this.canvas.parentElement?.classList.remove('pv-loading');
  }

  /** Camera on its intro path: k = 0 far and a little higher, k = 1 the resting framing. */
  private place(k: number): void {
    const { d, e, y } = this.pose;
    const dist = d * (INTRO_FAR + (1 - INTRO_FAR) * k), el = e + INTRO_RISE * (1 - k);
    this.cam.position.set(0, y + dist * Math.sin(el), dist * Math.cos(el));
    this.cam.lookAt(0, y, 0);
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
    const up = () => { x0 = -1; this.spin = SPIN; };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    if (this.model && this.active && this.introAt < 0) this.introAt = now;
    const intro = this.introAt < Infinity;
    // cap at ~24 fps outside the intro; idle (hidden card, background tab, low-end) costs nothing
    if (!this.active || document.hidden || (!this.dirty && !intro && (this.still || now - this.last < 40))) { if (!this.active) this.last = now; return; }
    this.last = now;
    if (!this.still) this.angle += dt * this.spin;
    let yaw = 0;
    if (intro) {
      const t = Math.min(1, (now - this.introAt) / INTRO_MS), k = 1 - (1 - t) ** 3;
      this.place(k);
      yaw = -INTRO_YAW * (1 - k);
      if (t >= 1) this.introAt = Infinity;
    }
    this.turn.rotation.y = this.angle + yaw;
    const r = this.renderer!;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const s = r.getSize(new THREE.Vector2());
    if (s.x !== w || s.y !== h) { r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    r.render(this.scene, this.cam);
    this.dirty = false;
  }
}
