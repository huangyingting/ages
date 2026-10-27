import { ERAS } from '../../shared/data/eras.ts';
import { tr, type Lang } from '../../shared/data/i18n.ts';
import { PLACE } from '../../shared/data/places.ts';
import type { Era, Year } from '../../shared/data/types.ts';
import { eraAt, formatYear } from '../../shared/lib/timeline.ts';
import type { Atlas } from '../scene/atlas.ts';

interface DustMote {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  phase: number;
  hue: 'gold' | 'amber' | 'zhu' | 'ivory';
}

interface FloatingGlyph {
  text: string;
  x: number;
  y: number;
  vy: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
  size: number;
}

interface RiverPulse {
  river: 0 | 1; // 0 = Yellow River (黄河几字弯), 1 = Yangtze River (长江水脉)
  u: number;
  speed: number;
  len: number;
  width: number;
  hue: 'gold' | 'zhu' | 'ivory';
}

interface StarNode {
  x: number;
  y: number;
  r: number;
  phase: number;
  linkTo: number;
}

const GLYPH_POOL = [
  '禹贡九州', '甲骨卜辞', '青铜铭文', '春秋笔法', '秦砖汉瓦', '丝绸之路',
  '唐风宋韵', '大运河', '浑天仪', '水运仪象', '千里江山', '资治通鉴',
  '前2070·夏', '前1600·商', '前1046·西周', '前221·秦', '前202·西汉',
  '618·唐', '960·北宋', '1271·元', '1368·明', '1644·清',
];

const COLORS: Record<DustMote['hue'], [number, number, number]> = {
  gold: [246, 208, 118],
  amber: [214, 162, 82],
  zhu: [218, 76, 56],
  ivory: [244, 234, 210],
};

/** Evaluates normalized geographic-inspired curves for the Yellow River (0) and Yangtze River (1). */
function sampleRiver(river: 0 | 1, u: number, w: number, h: number, t: number): { x: number; y: number } {
  const x = u * w;
  const wave = Math.sin(u * 6.0 - t * 0.55) * (h * 0.012);
  if (river === 0) {
    // Yellow River: rises in the west, climbs into the iconic northern "几" Ordos loop around u=0.36..0.58, then flows northeast to the sea
    const loop = Math.exp(-Math.pow((u - 0.45) / 0.11, 2)) * (-h * 0.19);
    const dip = Math.exp(-Math.pow((u - 0.64) / 0.08, 2)) * (h * 0.06);
    const base = h * (0.48 - u * 0.14);
    return { x, y: base + loop + dip + wave };
  }
  // Yangtze River: deep southern bend (Chuanjiang/Three Gorges) then broad undulating eastern course
  const bend = Math.sin((u - 0.12) * Math.PI * 2.1) * (h * 0.065);
  const base = h * (0.64 - u * 0.08);
  return { x, y: base + bend - wave * 0.9 };
}

/**
 * Manages the "山河舆图 · 浑天星盘" (Living Topographic Scroll & Celestial Chrono-Astrolabe) opening screen,
 * live chronicle ticker, per-dynasty streaming status, and unveiling transition into the 3D atlas.
 */
export class BootIntro {
  private boot: HTMLElement | null;
  private canvas: HTMLCanvasElement | null;
  private statusEl: HTMLElement | null;
  private verseEl: HTMLElement | null;
  private barFill: HTMLElement | null;
  private bcEraEl: HTMLElement | null;
  private bcYearEl: HTMLElement | null;
  private bcCapEl: HTMLElement | null;
  private dynSpans: HTMLElement[] = [];
  private raf = 0;
  private scattering = false;
  private scatterT = 0;
  private pointer = { x: -9999, y: -9999 };
  private motes: DustMote[] = [];
  private pulses: RiverPulse[] = [];
  private stars: StarNode[] = [];
  private glyphs: FloatingGlyph[] = [];
  private startTime = performance.now();

  constructor(private year: Year, private lang: Lang, private lowfx: boolean) {
    this.boot = document.getElementById('boot');
    this.canvas = document.getElementById('boot-dust') as HTMLCanvasElement | null;
    this.statusEl = this.boot?.querySelector<HTMLElement>('.boot-status') ?? null;
    this.verseEl = this.boot?.querySelector<HTMLElement>('.boot-verse') ?? null;
    this.barFill = this.boot?.querySelector<HTMLElement>('.boot-bar i') ?? null;
    this.bcEraEl = this.boot?.querySelector<HTMLElement>('.bc-era') ?? null;
    this.bcYearEl = this.boot?.querySelector<HTMLElement>('.bc-year') ?? null;
    this.bcCapEl = this.boot?.querySelector<HTMLElement>('.bc-cap') ?? null;
    this.dynSpans = [...(this.boot?.querySelectorAll<HTMLElement>('.boot-dynasties span[data-era]') ?? [])];

    const era = eraAt(year) ?? ERAS.find(e => e.id === 'qin')!;
    this.highlightDynasty(era);
    this.updateChronicleBadge(era, this.year);
    this.setProgress(era, 0, 1, true);

    if (lang === 'en') for (const el of [this.verseEl, this.statusEl]) if (el) el.lang = 'en';
    if (this.verseEl && lang === 'en') {
      this.verseEl.textContent = 'Mountains and rivers unscroll · Four millennia under one celestial compass';
    }
    if (!lowfx && this.canvas && this.boot) {
      this.initCanvas();
    }
  }

  private highlightDynasty(era: Era): void {
    for (const s of this.dynSpans) {
      const k = s.dataset.era ?? '';
      const match =
        k === era.id ||
        (era.id.includes('han') && k === 'han') ||
        (era.id.includes('song') && k === 'song') ||
        ((era.id.includes('zhou') || era.id === 'spring_autumn' || era.id === 'warring_states') && k === 'zhou') ||
        ((era.id.includes('jin') || era.id === 'north_south' || era.id === 'sixteen_kingdoms') && k === 'jin');
      s.classList.toggle('hi', match);
    }
  }

  private updateChronicleBadge(era: Era, displayYear: Year): void {
    if (this.bcEraEl) this.bcEraEl.textContent = tr(era.name, this.lang);
    if (this.bcYearEl) this.bcYearEl.textContent = formatYear(displayYear, this.lang);
    if (this.bcCapEl) {
      const cap = era.capital ? PLACE.get(era.capital) : undefined;
      const capName = cap ? tr(cap.modern, this.lang) : '';
      this.bcCapEl.textContent = capName
        ? (this.lang === 'en' ? `Capital · ${capName}` : `都城 · ${capName}`)
        : (this.lang === 'en' ? 'Historical Realm' : '九州疆域');
    }
  }

  /** Updates the dynasty-by-dynasty loading status on the opening screen. */
  setProgress(era: Era, done: number, total: number, initial = false): void {
    this.highlightDynasty(era);
    this.updateChronicleBadge(era, this.year);
    const pct = initial ? 32 : Math.min(100, Math.round(36 + (done / Math.max(1, total)) * 64));
    if (this.barFill) {
      this.barFill.style.width = `${pct}%`;
      this.barFill.style.animation = 'none';
    }
    if (this.statusEl) {
      const eraName = tr(era.name, this.lang);
      const yr = formatYear(this.year, this.lang);
      if (this.lang === 'en') {
        this.statusEl.textContent = initial
          ? `Unscrolling topographic relief · Aligning ${eraName} (${yr})…`
          : `Forging ${eraName} (${yr}) capitals & monuments · ${done}/${total}`;
      } else {
        this.statusEl.textContent = initial
          ? `正在展卷山河等高线 · 校准【${eraName} · ${yr}】疆域星盘…`
          : `正在逐朝构筑【${eraName}】都城与古迹模型 · ${done}/${total}`;
      }
    }
  }

  private initCanvas(): void {
    const canvas = this.canvas!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', e => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    }, { passive: true });

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const hues: DustMote['hue'][] = ['gold', 'gold', 'amber', 'amber', 'ivory', 'zhu'];

    for (let i = 0; i < 150; i++) {
      const z = 0.25 + Math.random() * 0.75;
      this.motes.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        z,
        vx: (0.16 + Math.random() * 0.42) * z,
        vy: (-0.06 - Math.random() * 0.18) * z,
        r: (0.85 + Math.random() * 2.2) * z,
        alpha: 0.22 + Math.random() * 0.62,
        phase: Math.random() * Math.PI * 2,
        hue: hues[i % hues.length],
      });
    }

    for (let i = 0; i < 18; i++) {
      const pulseHues: RiverPulse['hue'][] = ['gold', 'gold', 'zhu', 'ivory'];
      this.pulses.push({
        river: (i % 2) as 0 | 1,
        u: Math.random(),
        speed: 0.08 + Math.random() * 0.09,
        len: 0.08 + Math.random() * 0.09,
        width: 1.4 + Math.random() * 1.8,
        hue: pulseHues[i % pulseHues.length],
      });
    }

    const starCount = 28; // 二十八宿 (28 Lunar Mansions)
    for (let i = 0; i < starCount; i++) {
      const ang = (i / starCount) * Math.PI * 2;
      const rad = 0.28 + (i % 3) * 0.08 + Math.sin(i * 1.7) * 0.04;
      this.stars.push({
        x: 0.5 + Math.cos(ang) * rad * 1.15,
        y: 0.46 + Math.sin(ang) * rad * 0.85,
        r: 1.2 + (i % 3) * 0.65,
        phase: i * 0.7,
        linkTo: (i + (i % 4 === 0 ? 3 : 1)) % starCount,
      });
    }

    for (let i = 0; i < 14; i++) {
      this.glyphs.push(this.spawnGlyph(W(), H(), true));
    }

    let last = performance.now();
    const tick = (now: number) => {
      if (!this.boot || !this.boot.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - this.startTime) / 1000;
      const w = W(), h = H();
      const cx = w * 0.5, cy = h * 0.44;
      if (this.scattering) this.scatterT += dt;
      const scatterFade = this.scattering ? Math.max(0, 1 - this.scatterT * 1.35) : 1;

      // Subtle pointer parallax offset
      const px = this.pointer.x > -900 ? (this.pointer.x - cx) * 0.018 : 0;
      const py = this.pointer.y > -900 ? (this.pointer.y - cy) * 0.018 : 0;

      ctx.clearRect(0, 0, w, h);

      // 1. Living Topographic Contour Lines (九州山河等高线)
      ctx.save();
      const contourCenters = [
        { x: cx - px * 0.6, y: cy - py * 0.6, rx: Math.min(w, h) * 0.22, ry: Math.min(w, h) * 0.16, rings: 7 },
        { x: w * 0.22 - px * 0.4, y: h * 0.36 - py * 0.4, rx: w * 0.16, ry: h * 0.12, rings: 4 },
        { x: w * 0.78 - px * 0.4, y: h * 0.58 - py * 0.4, rx: w * 0.15, ry: h * 0.11, rings: 4 },
      ];
      for (const cc of contourCenters) {
        for (let r = 1; r <= cc.rings; r++) {
          const scale = 0.55 + r * 0.26 + (this.scattering ? this.scatterT * 0.45 : 0);
          const alpha = (0.11 - r * 0.011) * scatterFade;
          if (alpha <= 0.005) continue;
          ctx.beginPath();
          const steps = 64;
          for (let s = 0; s <= steps; s++) {
            const a = (s / steps) * Math.PI * 2;
            const warp =
              1 +
              0.08 * Math.sin(a * 3 + t * 0.35 + r * 0.6) +
              0.05 * Math.cos(a * 5 - t * 0.28 + r);
            const x = cc.x + Math.cos(a) * cc.rx * scale * warp;
            const y = cc.y + Math.sin(a) * cc.ry * scale * warp;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = r % 2 === 0
            ? `rgba(218, 174, 92, ${alpha.toFixed(3)})`
            : `rgba(200, 72, 54, ${(alpha * 0.75).toFixed(3)})`;
          ctx.lineWidth = r % 3 === 0 ? 1.15 : 0.75;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 2. Twenty-Eight Lunar Mansions Constellation Web (二十八宿星野连线)
      ctx.save();
      for (let i = 0; i < this.stars.length; i++) {
        const s1 = this.stars[i];
        const s2 = this.stars[s1.linkTo];
        const x1 = s1.x * w + px * 0.9, y1 = s1.y * h + py * 0.9;
        const x2 = s2.x * w + px * 0.9, y2 = s2.y * h + py * 0.9;
        const tw = 0.55 + 0.45 * Math.sin(t * 1.8 + s1.phase);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(226, 192, 124, ${(0.085 * tw * scatterFade).toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x1, y1, s1.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(248, 224, 156, ${(0.42 * tw * scatterFade).toFixed(3)})`;
        ctx.fill();
      }
      ctx.restore();

      // 3. Twin Arterial Rivers of Chinese History (黄河“几”字金脉 & 长江水脉)
      ctx.save();
      for (const river of [0, 1] as const) {
        // Base luminous river bed
        ctx.beginPath();
        const segs = 72;
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const pt = sampleRiver(river, u, w, h, t);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = river === 0
          ? `rgba(232, 178, 78, ${(0.18 * scatterFade).toFixed(3)})`
          : `rgba(138, 196, 224, ${(0.15 * scatterFade).toFixed(3)})`;
        ctx.lineWidth = river === 0 ? 2.2 : 1.8;
        ctx.stroke();

        // Soft atmospheric river halo
        ctx.strokeStyle = river === 0
          ? `rgba(218, 142, 58, ${(0.055 * scatterFade).toFixed(3)})`
          : `rgba(116, 172, 208, ${(0.045 * scatterFade).toFixed(3)})`;
        ctx.lineWidth = 22;
        ctx.stroke();
      }

      // Flowing golden & vermilion light pulses along the two rivers
      for (const p of this.pulses) {
        p.u = (p.u + p.speed * dt * (this.scattering ? 2.8 : 1)) % 1;
        const steps = 14;
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const u = Math.max(0, Math.min(1, p.u - (1 - s / steps) * p.len));
          const pt = sampleRiver(p.river, u, w, h, t);
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        const [r, g, b] = COLORS[p.hue];
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(0.52 * scatterFade).toFixed(3)})`;
        ctx.lineWidth = p.width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();

      // 4. Drifting Chronicle Inscriptions (古籍竹简纪年铭文)
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < this.glyphs.length; i++) {
        const g = this.glyphs[i];
        g.life += dt;
        if (g.life >= g.maxLife) {
          this.glyphs[i] = this.spawnGlyph(w, h, false);
          continue;
        }
        const u = g.life / g.maxLife;
        const fade = Math.sin(u * Math.PI);
        g.y += g.vy * dt * (this.scattering ? 4 : 1);
        ctx.font = `600 ${g.size}px "Noto Serif SC", "Songti SC", "STSong", serif`;
        ctx.fillStyle = `rgba(236, 206, 146, ${(g.maxAlpha * fade * scatterFade).toFixed(3)})`;
        ctx.fillText(g.text, g.x + px * 0.5, g.y + py * 0.5);
      }
      ctx.restore();

      // 5. Golden & Cinnabar Historical Dust Motes (流金岁月星尘)
      for (const m of this.motes) {
        if (this.scattering) {
          const dx = m.x - cx, dy = m.y - cy;
          const dist = Math.hypot(dx, dy) || 1;
          const push = (210 + 290 * m.z) * dt;
          m.x += (dx / dist) * push + m.vx * 2;
          m.y += (dy / dist) * push + m.vy * 2;
        } else {
          const dx = cx - m.x, dy = cy - m.y;
          const dist = Math.hypot(dx, dy) || 1;
          const swirl = Math.max(0, 1 - dist / (Math.min(w, h) * 0.58)) * 0.42 * m.z;
          m.x += m.vx + (-dy / dist) * swirl + Math.sin(t * 0.9 + m.phase) * 0.22 * m.z;
          m.y += m.vy + (dx / dist) * swirl * 0.65 + Math.cos(t * 0.7 + m.phase) * 0.18 * m.z;

          const pdx = m.x - this.pointer.x, pdy = m.y - this.pointer.y;
          const pdist = Math.hypot(pdx, pdy);
          if (pdist > 1 && pdist < 120) {
            const rep = (1 - pdist / 120) * 2.1 * m.z;
            m.x += (pdx / pdist) * rep;
            m.y += (pdy / pdist) * rep;
          }

          if (m.x > w + 20) m.x = -20;
          if (m.x < -20) m.x = w + 20;
          if (m.y < -20) m.y = h + 20;
          if (m.y > h + 20) m.y = -20;
        }

        const shimmer = 0.65 + 0.35 * Math.sin(t * 2.4 + m.phase);
        const scatterAlpha = this.scattering ? Math.max(0, 1 - this.scatterT * 1.1) : 1;
        const a = m.alpha * shimmer * scatterAlpha;
        if (a <= 0.01) continue;

        const [r, g, b] = COLORS[m.hue];
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
        ctx.fill();

        if (m.r > 1.8) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(a * 0.16).toFixed(3)})`;
          ctx.fill();
        }
      }

      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private spawnGlyph(w: number, h: number, initial: boolean): FloatingGlyph {
    const text = GLYPH_POOL[Math.floor(Math.random() * GLYPH_POOL.length)];
    const maxLife = 4.5 + Math.random() * 4.5;
    return {
      text,
      x: w * (0.1 + Math.random() * 0.8),
      y: h * (0.12 + Math.random() * 0.76),
      vy: -6 - Math.random() * 10,
      alpha: 0,
      maxAlpha: 0.06 + Math.random() * 0.11,
      life: initial ? Math.random() * maxLife : 0,
      maxLife,
      size: text.length > 2 ? 15 + Math.floor(Math.random() * 6) : 20 + Math.floor(Math.random() * 14),
    };
  }

  /**
   * Disperses the opening dust screen and triggers the 3D historical dust awakening & camera descent.
   * Immediately sets `.gone` (`pointer-events: none`) so UI interaction is never blocked.
   */
  finish(atlas: Atlas, hasDeepLink: boolean): void {
    const boot = this.boot;
    if (!boot) return;
    if ( this.barFill ) this.barFill.style.width = '100%';
    this.scattering = true;
    boot.classList.add('gone');

    const era = eraAt(this.year);
    const cap = era?.capital ? PLACE.get(era.capital) : undefined;
    if (!this.lowfx) {
      const lon = cap?.lon ?? 108.9, lat = cap?.lat ?? 34.26;
      atlas.fx.dustOfAges(lon, lat, 22, 1.35);
      if (!hasDeepLink) {
        const home = atlas.geo.stage.home;
        atlas.view.jump({
          lon: home.lon,
          lat: home.lat - 1.5,
          dist: Math.min(115, home.dist * 1.28),
          tilt: 0.52,
          heading: -0.1,
        });
        void atlas.view.flyTo(home, 1.8);
      }
    }

    const removeDelay = this.lowfx ? 300 : 1350;
    setTimeout(() => {
      if (this.raf) cancelAnimationFrame(this.raf);
      boot.remove();
    }, removeDelay);
  }
}
