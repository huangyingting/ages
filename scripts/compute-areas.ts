/**
 * Territory areas per snapshot (src/shared/data/gen/areas.json), in thousands of km²: `m` is the realm of the Chinese
 * dynasty (regions in the `main` or `protectorate` role, plus the Zhou vassal and warring states before 221 BC), `p` the area of each polity, most first (under 5,000 km²
 * dropped). Feeds the area readout, the legend and the timeline area curve without decoding geometry at runtime.
 *
 * Reads the imported geometry (public/data/atlas/shapes.json) and the curated snapshots; rerun after either changes:
 *   node scripts/compute-areas.ts   (npm run data:areas)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import pc from 'polygon-clipping';
import { POLITY } from '../src/shared/data/polities.ts';
import { SNAPSHOTS } from '../src/shared/data/territories.ts';
import type { LonLat } from '../src/shared/data/types.ts';
import { decodeRing } from '../src/shared/lib/rings.ts';

type Ring = [number, number][];
const raw = JSON.parse(readFileSync('public/data/atlas/shapes.json', 'utf8')) as {
  rings: string[];
  snaps: Record<string, { p: [string, string | null, string | null, LonLat | null, number[]][] }>;
};
const cache = new Map<number, Ring>();
const ring = (i: number): Ring => {
  let r = cache.get(i);
  if (!r) { r = decodeRing(raw.rings[i]) as Ring; cache.set(i, r); }
  return r;
};

/** Ring area in km² via the sinusoidal (equal-area) projection: x = lon·cos(lat), y = lat. */
function ringArea(r: Ring): number {
  let a = 0;
  const k = Math.PI / 180;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const x1 = r[j][0] * Math.cos(r[j][1] * k), y1 = r[j][1], x2 = r[i][0] * Math.cos(r[i][1] * k), y2 = r[i][1];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2) * 111.32 * 111.32;
}

/** Area of a multipolygon: outer rings minus holes. */
const mpArea = (mp: pc.MultiPolygon): number => mp.reduce((s, poly) => s + poly.reduce((t, r, k) => t + (k ? -1 : 1) * ringArea(r as Ring), 0), 0);

/** Fill area of a set of rings: evenodd regions XOR their rings (holes), the others union them (nonzero). */
function fillArea(rings: Ring[], evenodd: boolean): number {
  const polys = rings.filter(r => r.length > 2).map(r => [r] as pc.Polygon);
  if (!polys.length) return 0;
  try {
    return mpArea(evenodd ? pc.xor(polys[0], ...polys.slice(1)) : pc.union(polys[0], ...polys.slice(1)));
  } catch {
    return rings.reduce((s, r) => s + ringArea(r), 0);
  }
}

const out: Record<string, { m: number; p: [string, number][] }> = {};
for (const s of SNAPSHOTS) {
  const regions = s.shapes && raw.snaps[s.shapes]
    ? raw.snaps[s.shapes].p.map(([polity, , role, , rs]) => ({ polity, role, rings: rs.map(ring), evenodd: true }))
    : s.regions.map(r => ({ polity: r.polity, role: r.role, rings: r.rings as Ring[], evenodd: !!r.evenodd }));
  const by = new Map<string, number>();
  let m = 0;
  for (const r of regions) {
    const a = fillArea(r.rings, r.evenodd);
    by.set(r.polity, (by.get(r.polity) ?? 0) + a);
    const role = r.role ?? POLITY.get(r.polity)?.role;
    // before the Qin unification the Zhou vassal and warring states together form the realm
    if (role === 'main' || role === 'protectorate' || (role === 'rival' && s.year < -221)) m += a;
  }
  out[s.id] = { m: Math.round(m / 1000), p: [...by].map(([p, a]) => [p, Math.round(a / 1000)] as [string, number]).filter(([, a]) => a >= 5).sort((a, b) => b[1] - a[1]) };
}
writeFileSync('src/shared/data/gen/areas.json', JSON.stringify(out));
console.log(`areas: ${Object.keys(out).length} snapshots`);
