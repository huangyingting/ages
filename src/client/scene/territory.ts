import * as THREE from 'three';
import { POLITY, polityMatches } from '../../shared/data/polities.ts';
import type { AdminUnit, LonLat, Polity, Region, Snapshot } from '../../shared/data/types.ts';
import type { Geo } from './geo.ts';
import type { Lake } from './shapes.ts';

/**
 * Paints territorial snapshots into canvas textures in the heightmap's pixel space. The terrain shader land-masks
 * them, so polygons may run loosely offshore. Regions are painted in order and later ones replace earlier ones.
 */
const FILL_ALPHA: Record<Polity['role'], number> = { main: 0.52, rival: 0.46, neighbor: 0.3, occupied: 0.5, protectorate: 0.34 };

export interface PaintOpts {
  /** administrative divisions of the period (郡 / 州 / 府 …) */
  admin?: boolean;
  /** modern provincial boundaries as a reference overlay */
  provinces?: AdminUnit[] | null;
  /** lakes of the period */
  lakes?: Lake[];
}

export class TerritoryPainter {
  readonly W: number;
  readonly H: number;
  /** line widths were tuned for a 1600 px canvas */
  private k: number;
  private hatch = new Map<string, CanvasPattern>();

  constructor(private geo: Geo, size = 3072) {
    this.W = size;
    this.H = Math.round(this.W * ((geo.stage.bounds.north - geo.stage.bounds.south) / (geo.stage.bounds.east - geo.stage.bounds.west)));
    this.k = (size / 1600) * (80 / (geo.stage.bounds.east - geo.stage.bounds.west));
  }

  private px(p: LonLat): [number, number] {
    const [u, v] = this.geo.uv(p[0], p[1]);
    return [u * this.W, v * this.H];
  }

  private path(ctx: CanvasRenderingContext2D, rings: LonLat[][]): void {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach((p, i) => { const [x, y] = this.px(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
    }
  }

  private pattern(ctx: CanvasRenderingContext2D, color: string, light = false): CanvasPattern {
    const key = color + light;
    let p = this.hatch.get(key);
    if (!p) {
      const c = document.createElement('canvas');
      const n = Math.round(10 * Math.max(1, this.k));
      c.width = c.height = n;
      const x = c.getContext('2d')!;
      x.fillStyle = withAlpha(color, light ? 0.16 : 0.25);
      x.fillRect(0, 0, n, n);
      x.strokeStyle = withAlpha(color, light ? 0.5 : 0.85);
      x.lineWidth = 0.22 * n;
      x.beginPath();
      x.moveTo(-0.2 * n, 1.2 * n); x.lineTo(1.2 * n, -0.2 * n); x.moveTo(0.8 * n, 1.2 * n); x.lineTo(1.2 * n, 0.8 * n); x.moveTo(-0.2 * n, 0.2 * n); x.lineTo(0.2 * n, -0.2 * n);
      x.stroke();
      p = ctx.createPattern(c, 'repeat')!;
      this.hatch.set(key, p);
    }
    return p;
  }

  private style(r: Region): { color: string; role: Polity['role'] } | null {
    const pol = POLITY.get(r.polity);
    if (!pol) return null;
    return { color: r.color ?? pol.color, role: r.role ?? pol.role };
  }

  /** Paints a snapshot into a new canvas. */
  paint(s: Snapshot | null, o: PaintOpts = {}): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const ctx = c.getContext('2d')!;
    ctx.lineJoin = 'round';
    const k = this.k;
    for (const r of s?.regions ?? []) {
      const st = this.style(r);
      if (!st) continue;
      const rule: CanvasFillRule = r.evenodd ? 'evenodd' : 'nonzero';
      this.path(ctx, r.rings);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fill(rule);
      ctx.globalCompositeOperation = 'source-over';
      if (r.hatch || st.role === 'occupied') ctx.fillStyle = this.pattern(ctx, st.color);
      else if (st.role === 'protectorate') ctx.fillStyle = this.pattern(ctx, st.color, true);
      else ctx.fillStyle = withAlpha(fillTone(st.color), FILL_ALPHA[st.role]);
      ctx.fill(rule);
      // watercolour edge: a soft darker band just inside the border
      ctx.save();
      ctx.clip(rule);
      ctx.strokeStyle = withAlpha(shade(st.color, 0.75), st.role === 'neighbor' ? 0.25 : 0.45);
      ctx.lineWidth = 9 * k;
      ctx.stroke();
      ctx.restore();
    }
    for (const r of s?.regions ?? []) {
      const st = this.style(r);
      if (!st) continue;
      this.path(ctx, r.rings);
      ctx.strokeStyle = withAlpha(shade(st.color, 0.55), st.role === 'neighbor' ? 0.45 : 0.85);
      ctx.lineWidth = (st.role === 'main' ? 2.6 : st.role === 'neighbor' ? 1.2 : 1.8) * k;
      ctx.setLineDash(st.role === 'neighbor' || st.role === 'protectorate' ? [6 * k, 4 * k] : []);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (o.admin && s?.admin?.length) {
      for (const a of s.admin) {
        this.path(ctx, a.rings);
        ctx.strokeStyle = a.level === 1 ? 'rgba(70,50,30,0.6)' : 'rgba(70,50,30,0.38)';
        ctx.lineWidth = (a.level === 1 ? 1.6 : 0.9) * k;
        ctx.setLineDash(a.level === 1 ? [] : [3 * k, 2.5 * k]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (o.provinces) {
      ctx.strokeStyle = 'rgba(40,40,60,0.5)';
      ctx.lineWidth = 1.1 * k;
      ctx.setLineDash([2 * k, 3 * k]);
      for (const p of o.provinces) { this.path(ctx, p.rings); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    for (const l of o.lakes ?? []) {
      this.path(ctx, l.rings);
      ctx.fillStyle = 'rgba(112,158,184,0.95)';
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(70,92,104,0.6)';
      ctx.lineWidth = 0.8 * k;
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
      const rule: CanvasFillRule = r.evenodd ? 'evenodd' : 'nonzero';
      this.path(ctx, r.rings);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill(rule);
      ctx.globalCompositeOperation = 'source-over';
      if (polityMatches(r.polity, polity)) { ctx.fillStyle = '#fff'; ctx.fill(rule); }
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
/** Very dark tints (e.g. Qin black) would bury the relief: lift them towards a warm grey for the fill. */
function fillTone(hex: string): string {
  const [r, g, b] = rgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum >= 0.5) return hex;
  const k = (0.5 - lum) / 0.5 * 0.75;
  return '#' + [r, g, b].map((v, i) => Math.round(v + ([196, 176, 150][i] - v) * k).toString(16).padStart(2, '0')).join('');
}
function shade(hex: string, f: number): string {
  return '#' + rgb(hex).map(v => Math.round(Math.min(255, v * f)).toString(16).padStart(2, '0')).join('');
}
