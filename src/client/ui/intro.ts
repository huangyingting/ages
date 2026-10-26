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

const GLYPH_POOL = [
  '远古', '夏', '商', '西周', '春秋', '战国', '秦', '西汉', '东汉',
  '三国', '两晋', '南北朝', '隋', '唐', '五代', '北宋', '南宋', '元', '明', '清',
  '甲骨卜辞', '青铜铭文', '竹简千秋', '秦砖汉瓦', '唐风宋韵', '万里山河', '岁月如尘', '二十四史',
];

const COLORS: Record<DustMote['hue'], [number, number, number]> = {
  gold: [246, 208, 118],
  amber: [212, 158, 78],
  zhu: [218, 78, 58],
  ivory: [242, 230, 204],
};

/**
 * Manages the "历史的尘埃" (Dust of History) opening screen canvas, dynasty ticker, live per-dynasty loading status,
 * and the dust-dispersion + 3D camera descent transition when entering the atlas.
 */
export class BootIntro {
  private boot: HTMLElement | null;
  private canvas: HTMLCanvasElement | null;
  private statusEl: HTMLElement | null;
  private verseEl: HTMLElement | null;
  private barFill: HTMLElement | null;
  private dynSpans: HTMLElement[] = [];
  private raf = 0;
  private scattering = false;
  private scatterT = 0;
  private pointer = { x: -9999, y: -9999 };
  private motes: DustMote[] = [];
  private glyphs: FloatingGlyph[] = [];
  private startTime = performance.now();

  constructor(private year: Year, private lang: Lang, private lowfx: boolean) {
    this.boot = document.getElementById('boot');
    this.canvas = document.getElementById('boot-dust') as HTMLCanvasElement | null;
    this.statusEl = this.boot?.querySelector<HTMLElement>('.boot-status') ?? null;
    this.verseEl = this.boot?.querySelector<HTMLElement>('.boot-verse') ?? null;
    this.barFill = this.boot?.querySelector<HTMLElement>('.boot-bar i') ?? null;
    this.dynSpans = [...(this.boot?.querySelectorAll<HTMLElement>('.boot-dynasties span[data-era]') ?? [])];

    const era = eraAt(year) ?? ERAS.find(e => e.id === 'qin')!;
    this.highlightDynasty(era);
    this.setProgress(era, 0, 1, true);

    if (this.verseEl && lang === 'en') {
      this.verseEl.textContent = 'Every grain of history’s dust settles into mountains and rivers';
    }
    if (!lowfx && this.canvas && this.boot) {
      this.initCanvas();
    }
  }

  private highlightDynasty(era: Era): void {
    for (const s of this.dynSpans) {
      s.classList.toggle('hi', s.dataset.era === era.id || (era.id.includes('han') && s.dataset.era === 'han') || (era.id.includes('song') && s.dataset.era === 'song') || (era.id.includes('zhou') && s.dataset.era === 'zhou'));
    }
  }

  /** Updates the dynasty-by-dynasty loading status on the opening screen (and HUD badge if already open). */
  setProgress(era: Era, done: number, total: number, initial = false): void {
    this.highlightDynasty(era);
    const pct = initial ? 28 : Math.min(100, Math.round(35 + (done / Math.max(1, total)) * 65));
    if (this.barFill) {
      this.barFill.style.width = `${pct}%`;
      this.barFill.style.animation = 'none';
    }
    if (this.statusEl) {
      const eraName = tr(era.name, this.lang);
      const yr = formatYear(this.year, this.lang);
      if (this.lang === 'en') {
        this.statusEl.textContent = initial
          ? `Sweeping the dust of ages · Awakening ${eraName} (${yr})…`
          : `Loading ${eraName} (${yr}) dynasty relics · ${done}/${total}`;
      } else {
        this.statusEl.textContent = initial
          ? `正在拂去历史尘埃 · 唤醒【${eraName} · ${yr}】山河疆域…`
          : `正在逐朝加载【${eraName}】都城与风物模型 · ${done}/${total}`;
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

    for (let i = 0; i < 170; i++) {
      const z = 0.25 + Math.random() * 0.75;
      this.motes.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        z,
        vx: (0.18 + Math.random() * 0.45) * z,
        vy: (-0.08 - Math.random() * 0.22) * z,
        r: (0.9 + Math.random() * 2.4) * z,
        alpha: 0.2 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
        hue: hues[i % hues.length],
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
      const cx = w * 0.5, cy = h * 0.46;

      ctx.clearRect(0, 0, w, h);

      // Subtle glowing river of time ("历史长河") ribbon across the void
      ctx.save();
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const u = x / Math.max(1, w);
        const y = cy + Math.sin(u * 4.2 - t * 0.45) * (h * 0.16) + Math.cos(u * 2.1 + t * 0.25) * (h * 0.06);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(0, cy - 80, w, cy + 80);
      grad.addColorStop(0, 'rgba(201, 154, 60, 0)');
      grad.addColorStop(0.3, 'rgba(218, 168, 76, 0.08)');
      grad.addColorStop(0.5, 'rgba(216, 82, 56, 0.12)');
      grad.addColorStop(0.7, 'rgba(218, 168, 76, 0.08)');
      grad.addColorStop(1, 'rgba(201, 154, 60, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 56;
      ctx.stroke();
      ctx.restore();

      if (this.scattering) this.scatterT += dt;

      // Drifting ancient glyphs in the dust haze
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
        const scatterFade = this.scattering ? Math.max(0, 1 - this.scatterT * 1.6) : 1;
        g.y += g.vy * dt * (this.scattering ? 4 : 1);
        ctx.font = `600 ${g.size}px "Noto Serif SC", "Songti SC", "STSong", serif`;
        ctx.fillStyle = `rgba(228, 196, 136, ${(g.maxAlpha * fade * scatterFade).toFixed(3)})`;
        ctx.fillText(g.text, g.x, g.y);
      }
      ctx.restore();

      // Golden & cinnabar dust motes ("历史的尘埃")
      for (const m of this.motes) {
        if (this.scattering) {
          const dx = m.x - cx, dy = m.y - cy;
          const dist = Math.hypot(dx, dy) || 1;
          const push = (180 + 260 * m.z) * dt;
          m.x += (dx / dist) * push + m.vx * 2;
          m.y += (dy / dist) * push + m.vy * 2;
        } else {
          // Gentle river-of-time wave + subtle orbital pull around the seal
          const dx = cx - m.x, dy = cy - m.y;
          const dist = Math.hypot(dx, dy) || 1;
          const swirl = Math.max(0, 1 - dist / (Math.min(w, h) * 0.55)) * 0.35 * m.z;
          m.x += m.vx + (-dy / dist) * swirl + Math.sin(t * 0.9 + m.phase) * 0.22 * m.z;
          m.y += m.vy + (dx / dist) * swirl * 0.65 + Math.cos(t * 0.7 + m.phase) * 0.18 * m.z;

          // Pointer gently parts the historical dust
          const pdx = m.x - this.pointer.x, pdy = m.y - this.pointer.y;
          const pdist = Math.hypot(pdx, pdy);
          if (pdist > 1 && pdist < 110) {
            const rep = (1 - pdist / 110) * 1.8 * m.z;
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
