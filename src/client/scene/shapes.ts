import type { AdminUnit, I18n, LonLat, Region, Snapshot, Year } from '../../shared/data/types.ts';
import { decodeRing } from '../../shared/lib/rings.ts';

/** Admin entry: [name index, category index, anchor, ring indices]. */
type RawAdmin = [number, number, LonLat | null, number[]];
interface RawShapes {
  rings: string[];
  /** flat [zh, en, zh, en, …] */
  names: string[];
  snaps: Record<string, { p: [string, string | null, string | null, LonLat | null, number[]][]; g: RawAdmin[] | string; f: RawAdmin[] | string }>;
  provinces: [number, LonLat | null, number[]][];
  lakes: [string, number, Year | null, Year | null, number[]][];
}

export interface Lake { name: string; rank: number; from: Year; to: Year; rings: LonLat[][] }

/**
 * Imported boundary geometry (public/data/atlas/shapes.json, see scripts/import-jiangshan.ts), decoded lazily:
 * fills a snapshot's polity regions and administrative units the first time it is shown.
 */
export class ShapeStore {
  private cache = new Map<number, LonLat[]>();
  private constructor(private raw: RawShapes) {}

  static async load(url: string): Promise<ShapeStore | null> {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return new ShapeStore(await r.json() as RawShapes);
    } catch (e) {
      console.warn('territory shapes unavailable', e);
      return null;
    }
  }

  private ring(i: number): LonLat[] {
    let r = this.cache.get(i);
    if (!r) { r = decodeRing(this.raw.rings[i]); this.cache.set(i, r); }
    return r;
  }
  private name(i: number): I18n { return { zh: this.raw.names[i * 2], en: this.raw.names[i * 2 + 1] }; }

  private admin(list: RawAdmin[] | string | undefined, level: 1 | 2): AdminUnit[] {
    const l = typeof list === 'string' ? (level === 1 ? this.raw.snaps[list]?.g : this.raw.snaps[list]?.f) : list;
    if (!Array.isArray(l)) return [];
    return l.map(([n, c, a, rs]) => ({ name: this.name(n), category: this.name(c), anchor: a ?? undefined, rings: rs.map(i => this.ring(i)), level }));
  }

  private done = new WeakSet<Snapshot>();

  /**
   * Fills `regions` and `admin` of a snapshot that names stored geometry: imported phases, and our modern maps whose
   * schematic regions are replaced by precise ones (no-op otherwise or when already done).
   */
  hydrate(s: Snapshot | null): void {
    if (!s?.shapes || this.done.has(s)) return;
    const raw = this.raw.snaps[s.shapes];
    if (!raw) return;
    this.done.add(s);
    s.regions = raw.p.map(([polity, color, role, label, rs]): Region => ({
      polity, color: color ?? undefined, role: (role ?? undefined) as Region["role"], label: label ?? undefined, rings: rs.map(i => this.ring(i)), evenodd: true,
    }));
    s.admin = [...this.admin(raw.g, 1), ...this.admin(raw.f, 2)];
  }

  /** Modern provincial boundaries (reference overlay). */
  provinces(): AdminUnit[] {
    return this.raw.provinces.map(([n, hub, rs]) => ({ name: this.name(n), category: { zh: '省级行政区', en: 'province' }, anchor: hub ?? undefined, rings: rs.map(i => this.ring(i)), level: 1 }));
  }

  /** Lakes present in a year (historic lakes such as 云梦泽 and 巨野泽 come and go). */
  lakes(year: Year): Lake[] {
    return this.raw.lakes
      .filter(([, , a, v]) => (a ?? -9999) <= year && year <= (v ?? 9999))
      .map(([name, rank, a, v, rs]) => ({ name, rank, from: a ?? -9999, to: v ?? 9999, rings: rs.map(i => this.ring(i)) }));
  }
}
