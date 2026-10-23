import * as THREE from 'three';
import { POLITY } from '../../shared/data/polities.ts';
import type { LonLat, Polity, Region, Snapshot } from '../../shared/data/types.ts';
import type { Geo } from './geo.ts';

/**
 * Paints territorial snapshots into canvas textures in the heightmap's pixel space. The terrain shader land-masks
 * them, so polygons may run loosely offshore. Regions are painted in order and later ones replace earlier ones.
 */
const FILL_ALPHA: Record<Polity['role'], number> = { main: 0.62, rival: 0.55, neighbor: 0.38, occupied: 0.5 };

export class TerritoryPainter {
  private readonly W: number;
  private readonly H: number;
  private hatch = new Map<string, CanvasPattern>();

  constructor(private geo: Geo) {
    this.W = Math.min(1600, geo.w);
    this.H = Math.round(this.W * (geo.h / geo.w));
  }

  private px(p: LonLat): [number, number] {
    const [u, v] = this.geo.uv(p[0], p[1]);
    return [u * this.W, v * this.H];
  }

  private path(ctx: CanvasRenderingContext2D, r: Region): void {
    ctx.beginPath();
    for (const ring of r.rings) {
      ring.forEach((p, i) => { const [x, y] = this.px(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
    }
  }

  private pattern(ctx: CanvasRenderingContext2D, color: string): CanvasPattern {
    let p = this.hatch.get(color);
    if (!p) {
      const c = document.createElement('canvas');
      c.width = c.height = 10;
      const x = c.getContext('2d')!;
      x.fillStyle = withAlpha(color, 0.25);
      x.fillRect(0, 0, 10, 10);
      x.strokeStyle = withAlpha(color, 0.85);
      x.lineWidth = 2.2;
      x.beginPath();
      x.moveTo(-2, 12); x.lineTo(12, -2); x.moveTo(8, 12); x.lineTo(12, 8); x.moveTo(-2, 2); x.lineTo(2, -2);
      x.stroke();
      p = ctx.createPattern(c, 'repeat')!;
      this.hatch.set(color, p);
    }
    return p;
  }

  /** Paints a snapshot into a new canvas. */
  paint(s: Snapshot | null): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    if (!s) return c;
    const ctx = c.getContext('2d')!;
    ctx.lineJoin = 'round';
    for (const r of s.regions) {
      const pol = POLITY.get(r.polity);
      if (!pol) continue;
      this.path(ctx, r);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fill('nonzero');
      ctx.globalCompositeOperation = 'source-over';
      if (r.hatch || pol.role === 'occupied') ctx.fillStyle = this.pattern(ctx, pol.color);
      else ctx.fillStyle = withAlpha(pol.color, FILL_ALPHA[pol.role]);
      ctx.fill('nonzero');
      // watercolour edge: a soft darker band just inside the border
      ctx.save();
      ctx.clip('nonzero');
      ctx.strokeStyle = withAlpha(shade(pol.color, 0.75), 0.45);
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.restore();
    }
    for (const r of s.regions) {
      const pol = POLITY.get(r.polity);
      if (!pol) continue;
      this.path(ctx, r);
      ctx.strokeStyle = withAlpha(shade(pol.color, 0.55), pol.role === 'neighbor' ? 0.55 : 0.85);
      ctx.lineWidth = pol.role === 'main' ? 2.6 : 1.8;
      ctx.setLineDash(pol.role === 'neighbor' ? [6, 4] : []);
      ctx.stroke();
    }
    return c;
  }

  /** White mask of one polity's regions in a snapshot (for the highlight pulse). */
  mask(s: Snapshot | null, polity: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const ctx = c.getContext('2d')!;
    for (const r of s?.regions ?? []) {
      this.path(ctx, r);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill('nonzero');
      ctx.globalCompositeOperation = 'source-over';
      if (r.polity === polity) { ctx.fillStyle = '#fff'; ctx.fill('nonzero'); }
    }
    return c;
  }
}

export function texture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  // rows match the heightmap (v = 0 at the north edge)
  t.flipY = false;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  return t;
}

/** Label anchor and size for a region: its explicit label point or the centroid of its largest ring. */
export function regionAnchor(r: Region, kx: number): { lon: number; lat: number; area: number } {
  let best: LonLat[] = r.rings[0], bestA = 0, total = 0;
  for (const ring of r.rings) {
    const a = Math.abs(ringArea(ring)) * kx;
    total += a;
    if (a > bestA) { bestA = a; best = ring; }
  }
  if (r.label) return { lon: r.label[0], lat: r.label[1], area: total };
  const [lon, lat] = centroid(best);
  return { lon, lat, area: total };
}

function ringArea(ring: LonLat[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}
function centroid(ring: LonLat[]): LonLat {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return ring[0];
  return [cx / (3 * a), cy / (3 * a)];
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex: string, f: number): string {
  return '#' + rgb(hex).map(v => Math.round(Math.min(255, v * f)).toString(16).padStart(2, '0')).join('');
}
