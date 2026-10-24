import * as THREE from 'three';
import type { Geo } from './geo.ts';
import type { View } from './view.ts';
import type { DetailJob, DetailResult } from './detail.worker.ts';

/** Closer than this camera distance the terrain shader blends in streamed close-up relief. */
export const DETAIL_DIST = 26;
const SIZE = 1024;
/** relief exaggeration of the base heightmap (see buildTerrain's uRelief) */
const BASE_EXAG = 18 * 1.4;

/**
 * Close-up terrain: once the camera settles near the ground, a worker fetches finer elevation tiles for the area in
 * view and the terrain shader shades hills and valleys from them (the mesh, and so everything standing on it, keeps
 * the base heights). Off with `lowfx` or when the tiles cannot be fetched; the base relief then shows as before.
 */
export class TerrainDetail {
  private worker = new Worker(new URL('./detail.worker.ts', import.meta.url), { type: 'module' });
  private tex = new THREE.DataTexture(new Uint16Array(SIZE * SIZE), SIZE, SIZE, THREE.RedFormat, THREE.HalfFloatType);
  private cur: { box: DetailJob['box']; z: number } | null = null;
  private busy = 0;
  private pending: { box: DetailJob['box']; z: number } | null = null;
  private seq = 0;
  private acc = 0;
  private still = 0;
  private last = { lon: 0, lat: 0, dist: 0 };
  private baseKm: number;

  constructor(private view: View, geo: Geo, private u: Record<string, THREE.IUniform>) {
    const t = this.tex;
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    u.uDet.value = t;
    this.baseKm = ((geo.stage.bounds.north - geo.stage.bounds.south) / geo.h) * 111;
    this.worker.onmessage = (ev: MessageEvent<DetailResult>) => this.done(ev.data);
    view.onFrame(dt => this.tick(dt));
  }

  /** Half-size (degrees of latitude) of the box worth detailing at camera distance `dist`. */
  private static reach(dist: number): number { return dist * 0.75; }

  private want(lon: number, lat: number, dist: number): { box: DetailJob['box']; z: number } {
    const R = TerrainDetail.reach(dist), cos = Math.cos((lat * Math.PI) / 180);
    const box: DetailJob['box'] = [lon - R / cos, lon + R / cos, lat - R, lat + R];
    const pxDeg = (box[1] - box[0]) / SIZE;
    let z = THREE.MathUtils.clamp(Math.round(Math.log2(360 / (256 * pxDeg))), 5, 12);
    const tiles = (zz: number) => (((box[1] - box[0]) / 360) * 2 ** zz + 1) * (((box[3] - box[2]) / (360 * cos)) * 2 ** zz + 1);
    while (z > 5 && tiles(z) > 42) z--;
    return { box, z };
  }

  private tick(dt: number): void {
    const p = this.view.pose();
    const on = this.cur && p.dist <= DETAIL_DIST ? 1 : 0;
    const k = this.u.uDetOn;
    k.value += (on - k.value) * Math.min(1, dt * 3);
    if ((this.acc += dt) < 0.25) return;
    this.acc = 0;
    const R = TerrainDetail.reach(p.dist), l = this.last;
    const moved = Math.abs(p.lon - l.lon) > R * 0.03 || Math.abs(p.lat - l.lat) > R * 0.03 || Math.abs(p.dist / (l.dist || 1) - 1) > 0.03;
    this.last = { lon: p.lon, lat: p.lat, dist: p.dist };
    this.still = moved ? 0 : this.still + 0.25;
    if (p.dist > DETAIL_DIST || this.busy || this.still < 0.25) return;
    const w = this.want(p.lon, p.lat, p.dist), c = this.cur;
    const half = R * 0.5, cos = Math.cos((p.lat * Math.PI) / 180);
    const covers = c && c.z === w.z && c.box[0] <= p.lon - half / cos && c.box[1] >= p.lon + half / cos && c.box[2] <= p.lat - half && c.box[3] >= p.lat + half;
    if (covers) return;
    this.busy = ++this.seq;
    this.pending = w;
    this.worker.postMessage({ id: this.busy, box: w.box, z: w.z, size: SIZE } satisfies DetailJob);
  }

  private done(r: DetailResult): void {
    if (r.id !== this.busy) return;
    this.busy = 0;
    const w = this.pending!;
    this.pending = null;
    if (!r.data) return; // offline or missing tiles: keep what we have
    this.tex.image.data = r.data;
    this.tex.needsUpdate = true;
    const [W, E, S, N] = w.box, u = this.u;
    (u.uDetBox.value as THREE.Vector4).set(W, E, S, N);
    (u.uDetTexel.value as THREE.Vector2).set(1 / SIZE, 1 / SIZE);
    // finer grids see steeper slopes, so they get less exaggeration than the base relief
    const kmZ = ((N - S) / SIZE) * 111, kmX = ((E - W) / SIZE) * 111 * Math.cos((((N + S) / 2) * Math.PI) / 180);
    const exag = BASE_EXAG * Math.sqrt(kmZ / this.baseKm);
    (u.uDetRelief.value as THREE.Vector2).set(exag / (2 * kmX), exag / (2 * kmZ));
    this.cur = w;
  }
}
