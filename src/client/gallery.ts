import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildFresh, whenModelReady, BUILDERS } from './models/kit.ts';
import { outdoorEnvironment } from './models/environment.ts';
import type { ModelRecipe } from '../shared/data/types.ts';

// Dev-only model gallery: /gallery.html?k=army,rider (default: every kind). Not part of the production build.
const q = new URLSearchParams(location.search);
const list: ModelRecipe[] = (q.get('k')?.split(',') ?? Object.keys(BUILDERS)).map(k => (k.includes('/') ? { kind: 'palace', hero: k } : k.startsWith('person:') ? { kind: 'person', role: k.slice(7) } : { kind: k }));
const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a241e');
scene.environment = outdoorEnvironment(renderer);
scene.environmentIntensity = 0.6;
scene.add(new THREE.HemisphereLight('#fff6e0', '#7a6a50', 1.2));
const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
sun.position.set(3, 6, 4);
scene.add(sun);
const cols = Math.ceil(Math.sqrt(list.length)), gap = 1.8;
const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
const rows = Math.ceil(list.length / cols);
const span = Math.max(cols, rows) * gap;
cam.position.set(0, span * 0.75, span * 0.95);
if (q.get('side')) cam.position.set(span * 1.1, span * 0.35, span * 0.2);
const ctl = new OrbitControls(cam, canvas);
const labels = document.getElementById('l')!;
const tags: { el: HTMLElement; p: THREE.Vector3 }[] = [];
let pending = list.length;
list.forEach(async (r, i) => {
  await whenModelReady(r);
  const m = buildFresh(r);
  const x = ((i % cols) - (cols - 1) / 2) * gap, z = (Math.floor(i / cols) - (rows - 1) / 2) * gap;
  m.position.set(x, 0, z);
  scene.add(m);
  const el = document.createElement('div');
  el.textContent = (r.hero as string) ?? (r.role ? 'person:' + r.role : r.kind);
  labels.append(el);
  tags.push({ el, p: new THREE.Vector3(x, 0, z + 0.7) });
  if (--pending === 0) document.body.dataset.ready = '1';
});
const v = new THREE.Vector3();
let still = 0;
ctl.addEventListener('change', () => (still = 0));
renderer.setAnimationLoop(() => {
  if (document.body.dataset.ready && still++ > 2) return;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  cam.aspect = w / h; cam.updateProjectionMatrix();
  ctl.update();
  renderer.render(scene, cam);
  for (const t of tags) { v.copy(t.p).project(cam); t.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`; t.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`; }
});
