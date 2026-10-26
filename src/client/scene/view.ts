import * as THREE from 'three';
import { outdoorEnvironment } from '../models/environment.ts';
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
  private inset = { x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, t: 1 };
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
    c.minDistance = 1.4;
    c.maxDistance = 120;
    c.maxPolarAngle = 1.25;
    c.zoomSpeed = 1.2;
    c.zoomToCursor = true;
    c.addEventListener('start', () => this.cancelFlight());

    this.scene.add(this.sky);

    // studio-style lighting for the miniatures (the terrain shader does its own hillshade and ignores these):
    // a warm key from the front-left over the camera's shoulder (the default view looks north), a cool fill from
    // the other side, a rim from behind, and the procedural sky environment for soft light and real reflections
    this.scene.add(new THREE.HemisphereLight('#eef4ff', '#5a4c38', 0.9));
    const key = new THREE.DirectionalLight('#fff4e0', 2.8);
    key.position.set(-24, 46, 34);
    const fill = new THREE.DirectionalLight('#c7d6ff', 0.9);
    fill.position.set(30, 22, 18);
    const rim = new THREE.DirectionalLight('#ffe7b0', 1.1);
    rim.position.set(6, 30, -40);
    this.scene.add(key, fill, rim);
    this.scene.environment = outdoorEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.7;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;

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

  /** Recolours the sky dome (horizon haze and zenith, raw sRGB). */
  setSky(haze: THREE.Color, top: THREE.Color): void {
    const u = (this.sky.material as THREE.ShaderMaterial).uniforms;
    (u.uHaze.value as THREE.Color).copy(haze);
    (u.uTop.value as THREE.Color).copy(top);
  }

  /** Dollies the camera towards (k < 1) or away from (k > 1) the target. */
  zoomBy(k: number): Promise<void> {
    const p = this.pose();
    return this.flyTo({ ...p, dist: Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, p.dist * k)) }, 0.45);
  }

  /** Keeps the scene centred in the screen area not covered by `left` / `right` / `bottom` px of UI panels. */
  setInset(left: number, right: number, bottom: number): void {
    const tx = (Math.max(0, right) - Math.max(0, left)) / 2;
    const ty = Math.max(0, bottom) / 2;
    if (Math.abs(tx - this.inset.tx) < 0.5 && Math.abs(ty - this.inset.ty) < 0.5) return;
    this.inset.sx = this.inset.x;
    this.inset.sy = this.inset.y;
    this.inset.tx = tx;
    this.inset.ty = ty;
    this.inset.t = 0;
  }

  private applyInset(): void {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    const { x, y } = this.inset;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(w, h, x, y, w, h);
    this.constrainDirty = true;
  }

  private stepInset(dt: number): void {
    const i = this.inset;
    if (i.t >= 1) return;
    i.t = Math.min(1, i.t + dt / 0.6);
    const k = ease(i.t);
    i.x = i.sx + (i.tx - i.sx) * k;
    i.y = i.sy + (i.ty - i.sy) * k;
    this.applyInset();
  }

  private readonly sky = skyDome();
  private ndc = [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1]] as const;
  private ndcVec = new THREE.Vector2();
  private hit = new THREE.Vector3();
  private lastCamPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastCamQuat = new THREE.Quaternion();
  private lastTarget = new THREE.Vector3(Infinity, Infinity, Infinity);
  private constrainDirty = true;

  /**
   * Keeps the map filling the screen: the ground under every screen corner must lie inside the stage. Too wide a view
   * pulls the camera in; a view over an edge slides back. Near-horizontal rays (looking at the horizon) are left to the
   * haze of the sky dome, so tilted views still show a horizon.
   */
  constrain(): void {
    const t = this.controls.target, cam = this.camera, g = this.geo;
    if (
      !this.constrainDirty &&
      cam.position.distanceToSquared(this.lastCamPos) < 1e-8 &&
      t.distanceToSquared(this.lastTarget) < 1e-8 &&
      Math.abs(cam.quaternion.dot(this.lastCamQuat)) > 1 - 1e-8
    ) return;
    this.constrainDirty = false;
    const W = g.width / 2, D = g.depth / 2;
    const hadOffset = Math.abs(this.inset.x) >= 0.5 || Math.abs(this.inset.y) >= 0.5;
    if (hadOffset) cam.clearViewOffset();
    const sph = new THREE.Spherical().setFromVector3(cam.position.clone().sub(t));
    const rotated = Math.abs(sph.theta) > 1e-4;
    if (rotated) {
      cam.position.set(t.x, sph.radius * Math.cos(sph.phi), t.z + sph.radius * Math.sin(sph.phi));
      cam.lookAt(t);
    }
    for (let iter = 0; iter < 4; iter++) {
      cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      const dist = cam.position.distanceTo(t);
      for (const [nx, ny] of this.ndc) {
        this.raycaster.setFromCamera(this.ndcVec.set(nx, ny), cam);
        const r = this.raycaster.ray;
        if (r.direction.y > -1e-3) continue;
        const k = -r.origin.y / r.direction.y;
        const kCap = ny > 0 ? dist * 1.45 : ny === 0 ? dist * 1.85 : dist * 2.4;
        r.at(Math.min(k, kCap), this.hit);
        x0 = Math.min(x0, this.hit.x); x1 = Math.max(x1, this.hit.x);
        z0 = Math.min(z0, this.hit.z); z1 = Math.max(z1, this.hit.z);
      }
      if (!isFinite(x0)) break;
      const fit = Math.min(1, (2 * W) / (x1 - x0), (2 * D) / (z1 - z0));
      if (fit < 0.999) {
        const s = fit * 0.995;
        cam.position.sub(t).multiplyScalar(s).add(t);
        x0 = t.x + (x0 - t.x) * s; x1 = t.x + (x1 - t.x) * s;
        z0 = t.z + (z0 - t.z) * s; z1 = t.z + (z1 - t.z) * s;
      }
      const dx = x0 < -W && x1 > W ? -0.5 * (x0 + x1) : x0 < -W ? -W - x0 : x1 > W ? W - x1 : 0;
      const dz = z0 < -D && z1 > D ? -0.5 * (z0 + z1) : z0 < -D ? -D - z0 : z1 > D ? D - z1 : 0;
      if (fit >= 0.999 && Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4) break;
      t.x += dx; t.z += dz;
      cam.position.x += dx; cam.position.z += dz;
    }
    if (rotated) {
      sph.radius = cam.position.distanceTo(t);
      cam.position.setFromSpherical(sph).add(t);
      cam.lookAt(t);
    }
    if (hadOffset) {
      const el = this.canvas.parentElement ?? this.canvas;
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
      cam.setViewOffset(w, h, this.inset.x, this.inset.y, w, h);
    }
    cam.updateMatrixWorld();
    this.lastCamPos.copy(cam.position);
    this.lastCamQuat.copy(cam.quaternion);
    this.lastTarget.copy(t);
  }

  /** Current pose as lon/lat/dist/tilt/heading. */
  pose(): Required<CamPose> {
    const t = this.controls.target;
    const off = this.camera.position.clone().sub(t);
    const s = new THREE.Spherical().setFromVector3(off);
    return { lon: this.geo.lon(t.x), lat: this.geo.lat(t.z), dist: s.radius, tilt: s.phi, heading: s.theta };
  }

  private apply(p: Required<CamPose>): void {
    const tgt = new THREE.Vector3(this.geo.x(p.lon), 0, this.geo.z(p.lat));
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
    this.apply({ ...p, heading });
    this.constrainDirty = true;
    this.constrain();
    const to = this.pose();
    while (to.heading - from.heading > Math.PI) to.heading -= Math.PI * 2;
    while (to.heading - from.heading < -Math.PI) to.heading += Math.PI * 2;
    this.apply(from);
    this.constrainDirty = true;
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
    const lon = lerp(f.from.lon, f.to.lon), lat = lerp(f.from.lat, f.to.lat);
    const travel = Math.hypot((f.to.lon - f.from.lon) * this.geo.kx, f.to.lat - f.from.lat);
    const baseDist = lerp(f.from.dist, f.to.dist);
    const edgeClear = Math.max(0, Math.min(1, (28 - Math.abs(this.geo.x(lon))) / 12, (20 - Math.abs(this.geo.z(lat))) / 10, (38 - baseDist) / 12));
    const hop = Math.sin(Math.PI * k) * Math.min(18, travel * 0.35) * (travel > 6 ? edgeClear : 0);
    this.apply({
      lon, lat,
      dist: baseDist + hop, tilt: lerp(f.from.tilt, f.to.tilt), heading: lerp(f.from.heading, f.to.heading),
    });
    if (f.t >= 1) { this.flight = null; this.controls.update(); f.done(); }
  }

  get flying(): boolean { return !!this.flight; }

  /** Viewing distance the camera is at, or flying to. */
  get goalDist(): number { return this.flight ? this.flight.to.dist : this.camera.position.distanceTo(this.controls.target); }

  /** Shakes the camera for `dur` seconds by `amp` × the viewing distance, easing out (impacts, charges). */
  shake(_amp: number, _dur: number): void { /* disabled to keep story animations steady */ }

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
    for (const h of this.hooks) h(dt, this.elapsed);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
  }
}

/** A gradient sky around the camera: haze at the horizon (matching the terrain's aerial perspective), soft blue above. */
function skyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { uHaze: { value: HAZE.clone() }, uTop: { value: new THREE.Color().setHex(0xa9c3d0, THREE.LinearSRGBColorSpace) } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uHaze; uniform vec3 uTop; varying vec3 vDir; void main() { float h = clamp(vDir.y, 0.0, 1.0); gl_FragColor = vec4(mix(uHaze, uTop, smoothstep(0.02, 0.45, h)), 1.0); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  m.name = 'sky';
  return m;
}
