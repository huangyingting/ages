import * as THREE from 'three';
import type { Snapshot } from '../../shared/data/types.ts';
import { texture, type PaintFrame, type PaintOpts, type TerritoryPainter } from './territory.ts';
import type { View } from './view.ts';

/** Closer than this camera distance borders are repainted for the area in view. */
const DIST = 30;
const SIZE = 2048;

/**
 * Close-up borders: the stage-wide territory texture is ~4 km a pixel, so near the ground borders blur into wide
 * bands. Once the camera settles, the current snapshot is repainted for just the area in view at a finer scale and
 * the terrain shader blends it over the base texture. Off with `lowfx`.
 */
export class TerritoryDetail {
  private src: { key: string; snap: Snapshot | null; opts: PaintOpts } | null = null;
  private cur: { key: string; box: PaintFrame['box']; dist: number } | null = null;
  private tex: THREE.CanvasTexture | null = null;
  private acc = 0;
  private still = 0;
  private last = { lon: 0, lat: 0, dist: 0 };

  constructor(private view: View, private painter: TerritoryPainter, private u: Record<string, THREE.IUniform>) {
    view.onFrame(dt => this.tick(dt));
  }

  /** The snapshot shown in the base texture changed: drop the old close-up at once (it would show stale borders). */
  source(key: string, snap: Snapshot | null, opts: PaintOpts): void {
    if (this.src?.key === key) return;
    this.src = { key, snap, opts };
    this.cur = null;
    this.u.uTDOn.value = 0;
  }

  private static reach(dist: number): number { return Math.max(1.2, dist * 0.8); }

  private tick(dt: number): void {
    const p = this.view.pose();
    const k = this.u.uTDOn;
    const on = this.cur && p.dist <= DIST ? 1 : 0;
    k.value += (on - k.value) * Math.min(1, dt * 4);
    if ((this.acc += dt) < 0.2) return;
    this.acc = 0;
    const R = TerritoryDetail.reach(p.dist), l = this.last;
    const moved = Math.abs(p.lon - l.lon) > R * 0.03 || Math.abs(p.lat - l.lat) > R * 0.03 || Math.abs(p.dist / (l.dist || 1) - 1) > 0.03;
    this.last = { lon: p.lon, lat: p.lat, dist: p.dist };
    this.still = moved ? 0 : this.still + 0.2;
    if (!this.src || p.dist > DIST || this.still < 0.2) return;
    const c = this.cur, cos = Math.cos((p.lat * Math.PI) / 180), half = R * 0.55;
    const covers = c && c.key === this.src.key && c.dist / p.dist < 1.6 && p.dist / c.dist < 1.6
      && c.box[0] <= p.lon - half / cos && c.box[1] >= p.lon + half / cos && c.box[2] <= p.lat - half && c.box[3] >= p.lat + half;
    if (covers) return;
    const box: PaintFrame['box'] = [p.lon - R / cos, p.lon + R / cos, p.lat - R, p.lat + R];
    const canvas = this.painter.paint(this.src.snap, this.src.opts, { box, w: SIZE, h: SIZE });
    const tex = texture(canvas);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex?.dispose();
    this.tex = tex;
    this.u.uTD.value = tex;
    (this.u.uTDBox.value as THREE.Vector4).set(...box);
    // a moved box switches in at once; a first paint fades in
    this.cur = { key: this.src.key, box, dist: p.dist };
  }
}
