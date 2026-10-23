import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import type { Geo } from './geo.ts';
import { HAZE } from './terrain.ts';

export interface CamPose { lon: number; lat: number; dist: number; tilt: number; heading?: number }
type FrameFn = (dt: number, t: number) => void;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Renderer, camera, map controls, fly-to animation and the frame loop. */
export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: MapControls;
  private hooks = new Set<FrameFn>();
  private flight: { from: Required<CamPose>; to: Required<CamPose>; t: number; dur: number; done: () => void } | null = null;
  private last = -1;
  private elapsed = 0;
  private raycaster = new THREE.Raycaster();
  /** screen-space shift of the projection centre so subjects stay clear of side panels / bottom sheets */
  private inset = { x: 0, y: 0, tx: 0, ty: 0 };
  frames = 0;

  constructor(readonly canvas: HTMLCanvasElement, readonly geo: Geo, readonly lowfx: boolean) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowfx, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowfx ? 1 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
    this.controls = new MapControls(this.camera, canvas);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.minDistance = 2.2;
    c.maxDistance = 120;
    c.maxPolarAngle = 1.25;
    c.zoomSpeed = 1.2;
    c.zoomToCursor = true;
    c.addEventListener('start', () => this.cancelFlight());

    this.scene.add(this.sky);

    this.scene.add(new THREE.HemisphereLight('#fff6e0', '#7a6a50', 1.7));
    const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
    sun.position.set(-30, 50, -25);
    this.scene.add(sun);

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  onFrame(fn: FrameFn): () => void {
    this.hooks.add(fn);
    return () => this.hooks.delete(fn);
  }

  private resize(): void {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // narrow portrait screens: widen the view so the map still fits
    this.camera.fov = w / h < 0.8 ? 52 : 36;
    this.camera.updateProjectionMatrix();
    this.applyInset();
  }

  /** Keeps the scene centred in the screen area not covered by `left` / `right` / `bottom` px of UI panels. */
  setInset(left: number, right: number, bottom: number): void {
    this.inset.tx = (Math.max(0, right) - Math.max(0, left)) / 2;
    this.inset.ty = Math.max(0, bottom) / 2;
  }

  private applyInset(): void {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    const { x, y } = this.inset;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, x, y, w, h);
  }

  private stepInset(dt: number): void {
    const i = this.inset;
    if (i.x === i.tx && i.y === i.ty) return;
    const k = 1 - Math.exp(-dt * 7);
    i.x += (i.tx - i.x) * k;
    i.y += (i.ty - i.y) * k;
    if (Math.abs(i.tx - i.x) < 0.5 && Math.abs(i.ty - i.y) < 0.5) { i.x = i.tx; i.y = i.ty; }
    this.applyInset();
  }

  private readonly sky = skyDome();
  private ndc = [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1]] as const;
  private hit = new THREE.Vector3();

  /**
   * Keeps the map filling the screen: the ground under every screen corner must lie inside the stage. Too wide a view
   * pulls the camera in; a view over an edge slides back. Near-horizontal rays (looking at the horizon) are left to the
   * haze of the sky dome, so tilted views still show a horizon.
   */
  constrain(): void {
    const t = this.controls.target, cam = this.camera, g = this.geo;
    const W = g.width / 2, D = g.depth / 2;
    cam.updateMatrixWorld();
    for (let iter = 0; iter < 4; iter++) {
      cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      const dist = cam.position.distanceTo(t);
      for (const [nx, ny] of this.ndc) {
        this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), cam);
        const r = this.raycaster.ray;
        if (r.direction.y > -1e-3) continue;
        const k = -r.origin.y / r.direction.y;
        if (ny > 0 && k > dist * 2.6) continue;
        r.at(k, this.hit);
        x0 = Math.min(x0, this.hit.x); x1 = Math.max(x1, this.hit.x);
        z0 = Math.min(z0, this.hit.z); z1 = Math.max(z1, this.hit.z);
      }
      if (!isFinite(x0)) return;
      const fit = Math.min(1, (2 * W) / (x1 - x0), (2 * D) / (z1 - z0));
      if (fit < 0.999) {
        cam.position.sub(t).multiplyScalar(fit * 0.995).add(t);
        continue;
      }
      const dx = x0 < -W ? -W - x0 : x1 > W ? W - x1 : 0;
      const dz = z0 < -D ? -D - z0 : z1 > D ? D - z1 : 0;
      if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) return;
      t.x += dx; t.z += dz;
      cam.position.x += dx; cam.position.z += dz;
    }
  }

  /** Current pose as lon/lat/dist/tilt/heading. */
  pose(): Required<CamPose> {
    const t = this.controls.target;
    const off = this.camera.position.clone().sub(t);
    const s = new THREE.Spherical().setFromVector3(off);
    return { lon: this.geo.lon(t.x), lat: this.geo.lat(t.z), dist: s.radius, tilt: s.phi, heading: s.theta };
  }

  private apply(p: Required<CamPose>): void {
    const tgt = new THREE.Vector3(this.geo.x(p.lon), Math.max(0, this.geo.height(p.lon, p.lat)) * 0.6, this.geo.z(p.lat));
    this.controls.target.copy(tgt);
    this.camera.position.copy(tgt).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(p.dist, p.tilt, p.heading)));
    this.camera.lookAt(tgt);
  }

  jump(p: CamPose): void {
    this.cancelFlight();
    this.apply({ heading: 0, ...p });
    this.controls.update();
  }

  /** Smoothly flies to a pose; the arc rises when travelling far. Resolves when done (or when interrupted). */
  flyTo(p: CamPose, dur = 2): Promise<void> {
    this.cancelFlight();
    const from = this.pose();
    let heading = p.heading ?? 0;
    // take the short way round
    while (heading - from.heading > Math.PI) heading -= Math.PI * 2;
    while (heading - from.heading < -Math.PI) heading += Math.PI * 2;
    const to = { ...p, heading };
    return new Promise(done => { this.flight = { from, to, t: 0, dur: Math.max(0.01, dur), done }; });
  }

  cancelFlight(): void {
    const f = this.flight;
    this.flight = null;
    f?.done();
  }

  private stepFlight(dt: number): void {
    const f = this.flight;
    if (!f) return;
    f.t = Math.min(1, f.t + dt / f.dur);
    const k = ease(f.t);
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const travel = Math.hypot((f.to.lon - f.from.lon) * this.geo.kx, f.to.lat - f.from.lat);
    const hop = Math.sin(Math.PI * k) * Math.min(40, travel * 0.6) * (travel > 6 ? 1 : 0);
    this.apply({
      lon: lerp(f.from.lon, f.to.lon), lat: lerp(f.from.lat, f.to.lat),
      dist: lerp(f.from.dist, f.to.dist) + hop, tilt: lerp(f.from.tilt, f.to.tilt), heading: lerp(f.from.heading, f.to.heading),
    });
    if (f.t >= 1) { this.flight = null; f.done(); }
  }

  get flying(): boolean { return !!this.flight; }

  /** lon/lat under a client-space point, or null. */
  pick(clientX: number, clientY: number): [number, number] | null {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.geo.pick(this.raycaster.ray);
  }

  /** Projects a world point to CSS pixels in the canvas; z > 1 means behind the camera. */
  project(v: THREE.Vector3, out: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    out.copy(v).project(this.camera);
    const el = this.canvas;
    out.x = (out.x * 0.5 + 0.5) * el.clientWidth;
    out.y = (-out.y * 0.5 + 0.5) * el.clientHeight;
    return out;
  }

  private frame(): void {
    const now = performance.now() / 1000;
    const dt = this.last < 0 ? 0 : Math.min(0.25, now - this.last);
    this.last = now;
    this.elapsed += dt;
    this.stepInset(dt);
    this.stepFlight(dt);
    if (!this.flight) this.controls.update(dt);
    this.constrain();
    this.sky.position.copy(this.camera.position);
    for (const h of this.hooks) h(dt, this.elapsed);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
  }
}

/** A gradient sky around the camera: haze at the horizon (matching the terrain's aerial perspective), soft blue above. */
function skyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { uHaze: { value: HAZE }, uTop: { value: new THREE.Color().setHex(0xa9c3d0, THREE.LinearSRGBColorSpace) } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uHaze; uniform vec3 uTop; varying vec3 vDir; void main() { float h = clamp(vDir.y, 0.0, 1.0); gl_FragColor = vec4(mix(uHaze, uTop, smoothstep(0.02, 0.45, h)), 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  m.name = 'sky';
  return m;
}
