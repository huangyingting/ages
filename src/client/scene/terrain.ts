import * as THREE from 'three';
import { Geo, heightOf } from './geo.ts';
import { INK } from './ink.ts';

/** Loads the stage heightmap PNG as raw bytes (no colour-space conversion or premultiplication). */
export async function loadHeightmap(url: string): Promise<{ rgba: Uint8Array; w: number; h: number }> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  return { rgba: new Uint8Array(d.buffer, d.byteOffset, d.byteLength), w: bmp.width, h: bmp.height };
}

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = vec2(uv.x, 1.0 - uv.y);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uElev;
uniform sampler2D uMask;
uniform sampler2D uTerrA;
uniform sampler2D uTerrB;
uniform sampler2D uHi;
uniform float uMix;
uniform vec4 uWipe; // centre x, z, radius, on
uniform vec3 uWipeColor;
uniform float uTerrOn;
uniform float uHiAmt;
uniform vec3 uHiColor;
uniform vec2 uTexel;
uniform float uRelief;
uniform float uTime;
uniform vec4 uBounds; // west, east, south, north
uniform vec3 uCam;
uniform vec3 uHaze;
uniform float uStyle; // 0 ink (dark relief), 1 scroll (parchment), 2 plain
// close-up relief streamed for the area in view (see detail.ts): box west, east, south, north
uniform sampler2D uDet;
uniform vec4 uDetBox;
uniform vec2 uDetTexel;
uniform vec2 uDetRelief;
uniform float uDetOn;
// close-up territory borders painted for the area in view (see territory-detail.ts); they refine uTerrA
uniform sampler2D uTD;
uniform vec4 uTDBox;
uniform float uTDOn;
varying vec2 vUv;
varying vec3 vWorld;

float el(vec2 uv) { return texture2D(uElev, uv).r; }
vec3 hex(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

vec3 hypso(float h) {
  vec3 c = hex(166.0, 184.0, 136.0);
  c = mix(c, hex(190.0, 196.0, 148.0), smoothstep(0.0, 0.25, h));
  c = mix(c, hex(212.0, 201.0, 155.0), smoothstep(0.25, 0.7, h));
  c = mix(c, hex(204.0, 177.0, 133.0), smoothstep(0.7, 1.5, h));
  c = mix(c, hex(180.0, 146.0, 108.0), smoothstep(1.5, 2.6, h));
  c = mix(c, hex(160.0, 134.0, 110.0), smoothstep(2.6, 3.8, h));
  c = mix(c, hex(150.0, 140.0, 128.0), smoothstep(3.8, 4.8, h));
  c = mix(c, hex(238.0, 236.0, 230.0), smoothstep(5.0, 5.9, h));
  return c;
}

// dusk-lit relief for the dark "ink" style: olive lowlands, umber uplands, grey peaks, pale snow
vec3 hypsoInk(float h) {
  vec3 c = hex(62.0, 70.0, 48.0);
  c = mix(c, hex(78.0, 82.0, 54.0), smoothstep(0.0, 0.25, h));
  c = mix(c, hex(98.0, 90.0, 60.0), smoothstep(0.25, 0.7, h));
  c = mix(c, hex(112.0, 92.0, 64.0), smoothstep(0.7, 1.5, h));
  c = mix(c, hex(104.0, 82.0, 60.0), smoothstep(1.5, 2.6, h));
  c = mix(c, hex(100.0, 88.0, 76.0), smoothstep(2.6, 3.8, h));
  c = mix(c, hex(118.0, 112.0, 104.0), smoothstep(3.8, 4.8, h));
  c = mix(c, hex(214.0, 208.0, 196.0), smoothstep(5.0, 5.9, h));
  return c;
}

vec3 hypsoPlain(float h) {
  return mix(hex(236.0, 231.0, 219.0), hex(214.0, 204.0, 186.0), smoothstep(0.3, 4.5, h));
}

void main() {
  float h = el(vUv);
  vec4 m = texture2D(uMask, vUv);
  float land = smoothstep(0.3, 0.7, m.g);
  float dx = el(vUv + vec2(uTexel.x, 0.0)) - el(vUv - vec2(uTexel.x, 0.0));
  float dz = el(vUv + vec2(0.0, uTexel.y)) - el(vUv - vec2(0.0, uTexel.y));
  vec3 n = normalize(vec3(-dx * uRelief, 1.0, -dz * uRelief));
  if (uDetOn > 0.001) {
    vec2 ll = vec2(mix(uBounds.x, uBounds.y, vUv.x), mix(uBounds.w, uBounds.z, vUv.y));
    vec2 du = vec2((ll.x - uDetBox.x) / (uDetBox.y - uDetBox.x), (uDetBox.w - ll.y) / (uDetBox.w - uDetBox.z));
    vec2 eg = min(du, 1.0 - du);
    float k = uDetOn * smoothstep(0.0, 0.12, min(eg.x, eg.y));
    if (k > 0.0) {
      float hd = texture2D(uDet, du).r;
      float ddx = texture2D(uDet, du + vec2(uDetTexel.x, 0.0)).r - texture2D(uDet, du - vec2(uDetTexel.x, 0.0)).r;
      float ddz = texture2D(uDet, du + vec2(0.0, uDetTexel.y)).r - texture2D(uDet, du - vec2(0.0, uDetTexel.y)).r;
      n = normalize(mix(n, normalize(vec3(-ddx * uDetRelief.x, 1.0, -ddz * uDetRelief.y)), k));
      h = mix(h, hd, k);
    }
  }
  // a low north-west sun: strong relief, warm lit slopes and cool shade (flat ground keeps its brightness)
  vec3 L = normalize(vec3(-0.9, 0.85, -0.8));
  float rel = dot(n, L) - L.y;
  bool ink = uStyle < 0.5, plain = uStyle > 1.5;
  float shade = ink ? 0.97 + 1.05 * rel : plain ? 1.0 + 0.32 * rel : 0.99 + 0.55 * rel;
  vec3 tint = mix(ink ? vec3(0.82, 0.88, 1.08) : vec3(0.95, 0.97, 1.03), ink ? vec3(1.12, 1.0, 0.84) : vec3(1.03, 1.0, 0.96), smoothstep(-0.35, 0.3, rel));
  if (plain) tint = vec3(1.0);

  float hp = max(h, 0.0);
  vec3 col = (ink ? hypsoInk(hp) : plain ? hypsoPlain(hp) : hypso(hp)) * shade * tint;
  // ocean: depth tint, gentle moving sheen
  float depth = smoothstep(0.0, 1.0, sqrt(clamp(-h / 4.5, 0.0, 1.0)));
  vec3 sea = ink ? mix(hex(34.0, 52.0, 60.0), hex(14.0, 24.0, 32.0), depth)
    : plain ? mix(hex(214.0, 222.0, 222.0), hex(190.0, 204.0, 210.0), depth)
    : mix(hex(172.0, 203.0, 205.0), hex(104.0, 144.0, 168.0), depth);
  float wave = sin(vWorld.x * 3.1 + uTime * 0.6) * sin(vWorld.z * 2.7 - uTime * 0.45);
  sea += (ink ? 0.012 : 0.018) * wave;
  col = mix(sea, col, land);

  // rivers
  col = mix(col, ink ? hex(96.0, 150.0, 170.0) : hex(88.0, 138.0, 172.0), clamp(m.r * 1.4, 0.0, 0.9) * land);

  // territories (cross-faded snapshots), land-masked
  vec4 ta = texture2D(uTerrA, vUv);
  if (uTDOn > 0.001) {
    vec2 ll = vec2(mix(uBounds.x, uBounds.y, vUv.x), mix(uBounds.w, uBounds.z, vUv.y));
    vec2 tu = vec2((ll.x - uTDBox.x) / (uTDBox.y - uTDBox.x), (uTDBox.w - ll.y) / (uTDBox.w - uTDBox.z));
    vec2 eg = min(tu, 1.0 - tu);
    float k = uTDOn * smoothstep(0.0, 0.1, min(eg.x, eg.y));
    if (k > 0.0) {
      vec4 td = texture2D(uTD, tu);
      // near the coast, outlines and the land mask disagree by a few km: fill such slivers from the nearest painted land
      if (td.a < 0.05 && land > 0.5 && m.g < 0.97) {
        vec2 r = 0.03 / vec2(uTDBox.y - uTDBox.x, uTDBox.w - uTDBox.z);
        vec4 acc = vec4(0.0);
        float n = 0.0;
        for (int i = 0; i < 16; i++) {
          float a = float(i) * 0.785398 + (i >= 8 ? 0.3927 : 0.0);
          vec4 s = texture2D(uTD, tu + vec2(cos(a), sin(a)) * r * (i >= 8 ? 2.0 : 1.0));
          if (s.a > 0.05) { acc += vec4(s.rgb * s.a, s.a); n += 1.0; }
        }
        if (n > 0.0) td = vec4(acc.rgb / acc.a, acc.a / n);
      }
      ta = mix(ta, td, k);
    }
  }
  vec4 tb = texture2D(uTerrB, vUv);
  float wd = distance(vWorld.xz, uWipe.xy) - uWipe.z;
  float mixK = uWipe.w > 0.5 ? 1.0 - smoothstep(-0.6, 0.0, wd) : uMix;
  vec4 t = mix(ta, tb, mixK);
  // the polity colour is lit like the ground beneath it, so mountains read through the fill
  vec3 lit = t.rgb * (ink ? 0.9 + 1.0 * rel : plain ? 1.0 + 0.35 * rel : 0.99 + 0.5 * rel) * tint;
  col = mix(col, lit, t.a * land * uTerrOn * (ink ? 0.92 : 1.0));
  // the conquest front: a glowing ink edge sweeping outwards
  if (uWipe.w > 0.5) col = mix(col, uWipeColor, (1.0 - smoothstep(0.0, 0.5, abs(wd + 0.25))) * 0.75 * land * smoothstep(0.0, 1.0, uWipe.z));

  // highlighted polity pulse
  float hi = texture2D(uHi, vUv).a;
  col = mix(col, uHiColor, hi * uHiAmt * land);

  // ink coastline
  float coast = 1.0 - smoothstep(0.0, 0.2, abs(m.g - 0.5));
  col = mix(col, ink ? hex(176.0, 146.0, 92.0) : hex(70.0, 92.0, 104.0), coast * (ink ? 0.55 : 0.45));

  // faint 10° graticule
  float lon = mix(uBounds.x, uBounds.y, vUv.x), lat = mix(uBounds.w, uBounds.z, vUv.y);
  vec2 g = abs(fract(vec2(lon, lat) / 10.0 + 0.5) - 0.5) * 10.0;
  vec2 fw = fwidth(vec2(lon, lat));
  float grid = 1.0 - smoothstep(0.0, 1.0, min(g.x / fw.x, g.y / fw.y));
  col = mix(col, ink ? hex(201.0, 164.0, 92.0) : hex(120.0, 110.0, 90.0), grid * (ink ? 0.16 : 0.12));

  // aerial perspective; the far edges of the stage dissolve into the haze of the sky dome
  float d = distance(uCam, vWorld);
  col = mix(col, uHaze, smoothstep(40.0, 150.0, d) * 0.75);
  vec2 e2 = min(vUv, 1.0 - vUv) * vec2(uBounds.y - uBounds.x, uBounds.w - uBounds.z);
  col = mix(uHaze, col, smoothstep(0.0, 4.0, min(e2.x, e2.y)));
  gl_FragColor = vec4(col, 1.0); // already sRGB
}`;

export interface Terrain {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
}

/** Haze colour shared by the terrain's aerial perspective and the horizon of the sky dome. */
export const HAZE = new THREE.Color().setHex(0xe4dccb, THREE.LinearSRGBColorSpace); // raw sRGB (shaders write sRGB)

export type Surface = 'ink' | 'paper' | 'plain';
export const SURFACES: Surface[] = ['paper', 'ink', 'plain'];
const raw = (hex: number) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
/** Per map style: shader index, horizon haze and sky zenith (raw sRGB). */
export const SURFACE: Record<Surface, { style: number; haze: THREE.Color; top: THREE.Color }> = {
  ink: { style: 0, haze: raw(0x2a251e), top: raw(0x0d0c0a) },
  paper: { style: 1, haze: HAZE, top: raw(0xa9c3d0) },
  plain: { style: 2, haze: raw(0xeceae4), top: raw(0xd6dde0) },
};

/** Builds the relief mesh and its shader. It fills the screen: the camera never shows its edges (see View.constrain). */
export function buildTerrain(geo: Geo, lowfx: boolean): Terrain {
  const sx = lowfx ? 450 : 900, sz = Math.round(sx * (geo.depth / geo.width));
  const pg = new THREE.PlaneGeometry(geo.width, geo.depth, sx, sz);
  pg.rotateX(-Math.PI / 2);
  const pos = pg.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const lon = geo.lon(pos.getX(i)), lat = geo.lat(pos.getZ(i));
    pos.setY(i, heightOf(geo.elevation(lon, lat), geo.isLand(lon, lat)));
  }
  pg.computeBoundingSphere();

  // elevation (km, half float) and mask (river, land) textures at full heightmap resolution
  const N = geo.w * geo.h;
  const half = new Uint16Array(N);
  const mask = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    half[i] = THREE.DataUtils.toHalfFloat(geo.elev[i] / 1000);
    const b = geo.rgba[i * 4 + 2];
    mask[i * 4] = b > 0 && b < 255 ? Math.min(255, b * 2) : 0;
    mask[i * 4 + 1] = b === 255 ? 0 : 255;
    mask[i * 4 + 3] = 255;
  }
  const elevTex = new THREE.DataTexture(half, geo.w, geo.h, THREE.RedFormat, THREE.HalfFloatType);
  const maskTex = new THREE.DataTexture(mask, geo.w, geo.h, THREE.RGBAFormat);
  for (const t of [elevTex, maskTex]) {
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
  }
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  blank.needsUpdate = true;
  const b = geo.stage.bounds;
  const texelKm = ((b.north - b.south) / geo.h) * 111;
  const uniforms: Record<string, THREE.IUniform> = {
    uElev: { value: elevTex }, uMask: { value: maskTex }, uTerrA: { value: blank }, uTerrB: { value: blank }, uHi: { value: blank },
    uMix: { value: 0 }, uWipe: { value: new THREE.Vector4(0, 0, 0, 0) }, uWipeColor: { value: new THREE.Color().setHex(0xc0392b, THREE.LinearSRGBColorSpace) }, uTerrOn: { value: 1 }, uHiAmt: { value: 0 }, uHiColor: { value: new THREE.Color('#fff3b0') },
    uTexel: { value: new THREE.Vector2(1 / geo.w, 1 / geo.h) }, uRelief: { value: 18 / (2 * texelKm) * 1.4 }, uTime: { value: 0 },
    uDet: { value: blank }, uDetBox: { value: new THREE.Vector4(0, 1, 0, 1) }, uDetTexel: { value: new THREE.Vector2(1, 1) }, uDetRelief: { value: new THREE.Vector2() }, uDetOn: { value: 0 },
    uTD: { value: blank }, uTDBox: { value: new THREE.Vector4(0, 1, 0, 1) }, uTDOn: { value: 0 },
    uBounds: { value: new THREE.Vector4(b.west, b.east, b.south, b.north) }, uCam: { value: new THREE.Vector3() }, uHaze: { value: HAZE.clone() }, uStyle: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, extensions: { derivatives: true } as never });
  const mesh = new THREE.Mesh(pg, mat);
  mesh.name = 'terrain';
  // drawn first so map ink (routes, rings) can paint over it without depth testing
  mesh.renderOrder = INK.terrain;

  return { mesh, uniforms };
}
