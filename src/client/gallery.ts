import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildFresh, whenModelReady, BUILDERS } from './models/kit.ts';
import { troopMaterial, unitGeometry, type UnitType } from './scene/troops.ts';
import type { Era } from '../shared/data/era.ts';
import { outdoorEnvironment } from './models/environment.ts';
import type { ModelRecipe } from '../shared/data/types.ts';
import { TRAVELLER } from '../shared/data/stories.ts';

// Dev-only model gallery: /gallery.html?k=army,rider,troop:horse@yuan,person:general@1600 (default: every kind). Not part of
// the production build. `troop:<spear|archer|horse|chariot|gun>@<era>` shows instanced troops, `person:<role>@<year>[+prop][+female]` a costumed person,
// `traveller:<journey>@<year>` a journey's traveller (e.g. traveller:xuanzang@630).
const q = new URLSearchParams(location.search);
const journey = (k: string): ModelRecipe => { const [id, y] = k.slice(10).split('@'), t = TRAVELLER[id]; return { kind: 'traveller', year: Number(y ?? 1000), ...(typeof t === 'object' && !('army' in t) ? t : {}), label: k }; };
/** `person:<role>@<year>+<prop>+female` */
const person = (k: string): ModelRecipe => {
  const [head, ...flags] = k.slice(7).split('+'), [role, y] = head.split('@');
  const prop = flags.find(f => f !== 'female');
  return { kind: 'person', role, ...(y ? { year: Number(y) } : {}), ...(prop ? { prop } : {}), ...(flags.includes('female') ? { female: true } : {}) };
};
const list: ModelRecipe[] = (q.get('k')?.split(',') ?? Object.keys(BUILDERS)).map(k => (k.startsWith('traveller:') ? journey(k) : k.includes('/') ? (() => { const [hero, style] = k.split(':'); return { kind: 'palace', hero, ...(style ? { style } : {}), label: k }; })() : k.startsWith('person:') ? person(k) : k.includes(':') && !k.startsWith('troop:') ? (() => { const [kind, style] = k.split(':'); return { kind, style, label: k }; })() : { kind: k }));
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
  let m: THREE.Object3D;
  if (r.kind.startsWith('troop:')) {
    // a 3×3 block of instanced troops in two team colours
    const [t, era] = r.kind.slice(6).split('@');
    const geo = unitGeometry((t === 'rider' ? 'horse' : t === 'soldier' ? 'spear' : t) as UnitType, (era || 'suitang') as Era);
    const im = new THREE.InstancedMesh(geo, troopMaterial(), 9);
    for (let k = 0; k < 9; k++) {
      const sp = t === 'chariot' ? 1 : t === 'horse' || t === 'rider' ? 0.6 : 0.45;
      im.setMatrixAt(k, new THREE.Matrix4().makeTranslation((k % 3 - 1) * sp, 0, (Math.floor(k / 3) - 1) * sp * 1.1));
      im.setColorAt(k, new THREE.Color(k < 5 ? '#b8322a' : '#2f4f8a'));
    }
    m = new THREE.Group().add(im);
  } else {
    await whenModelReady(r);
    m = buildFresh(r);
  }
  const x = ((i % cols) - (cols - 1) / 2) * gap, z = (Math.floor(i / cols) - (rows - 1) / 2) * gap;
  m.position.set(x, 0, z);
  scene.add(m);
  const el = document.createElement('div');
  el.textContent = (r.label as string) ?? (r.hero as string) ?? (r.role ? `person:${r.role}${r.year !== undefined ? '@' + r.year : ''}` : r.kind);
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
