import * as THREE from 'three';
import type { Stage } from '../../shared/data/stage.ts';

/**
 * Stage geometry: plate carrée scaled by cos(refLat), 1 world unit = 1° of latitude, x east, z south, y up.
 * The heightfield comes from the stage PNG (see scripts/fetch-terrain.ts): elevation = R·256 + G − 11000 m,
 * B = 255 for ocean, 1–254 for river strength.
 */
export const EXAG = 18; // vertical exaggeration
const M_PER_UNIT = 111_000;

export class Geo {
  readonly kx: number;
  readonly lon0: number;
  readonly lat0: number;
  readonly width: number;
  readonly depth: number;
  w = 0;
  h = 0;
  /** elevation in metres per pixel */
  elev = new Float32Array(0);
  /** 1 for land, 0 for ocean, per pixel */
  land = new Uint8Array(0);
  rgba: Uint8Array<ArrayBufferLike> = new Uint8Array(0);

  constructor(readonly stage: Stage) {
    const b = stage.bounds;
    this.kx = Math.cos((stage.refLat * Math.PI) / 180);
    this.lon0 = (b.west + b.east) / 2;
    this.lat0 = (b.south + b.north) / 2;
    this.width = (b.east - b.west) * this.kx;
    this.depth = b.north - b.south;
  }

  setHeightmap(rgba: Uint8Array, w: number, h: number): void {
    this.rgba = rgba;
    this.w = w;
    this.h = h;
    this.elev = new Float32Array(w * h);
    this.land = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      this.elev[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] - 11000;
      this.land[i] = rgba[i * 4 + 2] === 255 ? 0 : 1;
    }
  }

  x(lon: number): number { return (lon - this.lon0) * this.kx; }
  z(lat: number): number { return -(lat - this.lat0); }
  lon(x: number): number { return x / this.kx + this.lon0; }
  lat(z: number): number { return -z + this.lat0; }

  /** uv in [0,1]² (v = 0 at the north edge, matching image rows). */
  uv(lon: number, lat: number): [number, number] {
    const b = this.stage.bounds;
    return [(lon - b.west) / (b.east - b.west), (b.north - lat) / (b.north - b.south)];
  }

  /** Bilinear elevation in metres at lon/lat. */
  elevation(lon: number, lat: number): number {
    if (!this.w) return 0;
    const [u, v] = this.uv(lon, lat);
    const fx = Math.min(this.w - 1.001, Math.max(0, u * this.w - 0.5)), fy = Math.min(this.h - 1.001, Math.max(0, v * this.h - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const e = this.elev, W = this.w;
    const a = e[y0 * W + x0], b = e[y0 * W + x0 + 1], c = e[(y0 + 1) * W + x0], d = e[(y0 + 1) * W + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  isLand(lon: number, lat: number): boolean {
    if (!this.w) return true;
    const [u, v] = this.uv(lon, lat);
    const px = Math.min(this.w - 1, Math.max(0, Math.floor(u * this.w))), py = Math.min(this.h - 1, Math.max(0, Math.floor(v * this.h)));
    return this.land[py * this.w + px] === 1;
  }

  /** World height of the ground (or water surface) at lon/lat. */
  height(lon: number, lat: number): number {
    return heightOf(this.elevation(lon, lat), this.isLand(lon, lat));
  }

  /** World position on the surface, lifted by `lift` units. */
  pos(lon: number, lat: number, lift = 0, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(this.x(lon), Math.max(0, this.height(lon, lat)) + lift, this.z(lat));
  }

  inBounds(lon: number, lat: number): boolean {
    const b = this.stage.bounds;
    return lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;
  }

  /** Intersects a ray with the heightfield (ray-march + bisection). Returns lon/lat or null. */
  pick(ray: THREE.Ray): [number, number] | null {
    const p = new THREE.Vector3();
    const maxT = 400;
    let prev = 0;
    const above = (t: number) => {
      ray.at(t, p);
      return p.y - Math.max(0, this.height(this.lon(p.x), this.lat(p.z)));
    };
    if (ray.direction.y >= 0) return null;
    // start where the ray comes down to the highest possible terrain
    let t = Math.max(0, (ray.origin.y - 1.8) / -ray.direction.y);
    prev = t;
    const step = 0.15;
    for (; t < maxT; t += step) {
      if (above(t) <= 0) {
        let lo = prev, hi = t;
        for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (above(m) > 0) lo = m; else hi = m; }
        ray.at(hi, p);
        const lon = this.lon(p.x), lat = this.lat(p.z);
        return this.inBounds(lon, lat) ? [lon, lat] : null;
      }
      prev = t;
    }
    return null;
  }
}

export function heightOf(elev: number, land: boolean): number {
  if (land) return Math.max(0.004, (elev * EXAG) / M_PER_UNIT);
  return -0.03 + (Math.max(elev, -6000) * EXAG * 0.08) / M_PER_UNIT;
}
