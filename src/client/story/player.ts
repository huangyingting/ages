import { tr, type Lang } from '../../shared/data/i18n.ts';
import type { Formation, HistEvent, StoryStep, Year } from '../../shared/data/types.ts';
import { FORMATION_NAME, defaultFormation } from '../../shared/data/era.ts';
import { storyOf } from '../../shared/data/events.ts';
import type { Atlas } from '../scene/atlas.ts';

export interface PlayerHooks {
  onCaption(text: string, i: number, n: number): void;
  onYear(y: Year): void;
  onState(s: 'playing' | 'paused' | 'idle'): void;
  onTitle?(text: string, sub: string, dur: number): void;
  speak?(text: string, lang: Lang): Promise<void> | void;
}

/**
 * Runs an event's story (StoryStep[]) against the atlas. Steps run in order; `par` steps start without waiting.
 * Playback can be paused, sped up, skipped (to the next caption) or stopped at any time.
 */
export class StoryPlayer {
  private token = 0;
  state: 'playing' | 'paused' | 'idle' = 'idle';
  event: HistEvent | null = null;
  narrate = false;

  constructor(private atlas: Atlas, private hooks: PlayerHooks) {}

  get speed(): number { return this.atlas.fx.speed; }
  set speed(v: number) { this.atlas.fx.speed = v; }

  private set(s: StoryPlayer['state']): void {
    this.state = s;
    this.atlas.fx.paused = s === 'paused';
    // narration follows the player (partial Web Speech implementations throw)
    try { if (s === 'paused') window.speechSynthesis?.pause(); else if (s === 'playing') window.speechSynthesis?.resume(); } catch { /* ignore */ }
    this.hooks.onState(s);
  }

  async play(e: HistEvent): Promise<boolean> {
    return this.playSteps(storyOf(e), e);
  }

  /** Plays any script (event stories, journeys). */
  async playSteps(steps: StoryStep[], e: HistEvent | null = null): Promise<boolean> {
    this.stop();
    const my = ++this.token;
    this.event = e;
    if (e) this.atlas.fx.year = e.year;
    const caps = steps.filter(s => s.do === 'caption').length;
    let ci = 0;
    this.set('playing');
    this.atlas.fx.clear('event');
    const pending: Promise<unknown>[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (my !== this.token) return false;
      while (this.state === 'paused' && my === this.token) await sleep(100);
      const st = steps[i];
      const p = this.run(st, () => ci++, caps);
      if ('par' in st && st.par) pending.push(p); else await p;
    }
    await Promise.race([Promise.all(pending), sleep(4000)]);
    if (my !== this.token) return false;
    this.set('idle');
    return true;
  }

  private async run(st: StoryStep, nextCap: () => number, caps: number): Promise<void> {
    const a = this.atlas, fx = a.fx, L = this.atlas.lang;
    const sp = () => Math.max(0.25, fx.speed);
    switch (st.do) {
      case 'year':
        a.setYear(st.year);
        this.hooks.onYear(st.year);
        return;
      case 'fly':
        fx.dustOfAges(st.lon, st.lat, Math.min(18, Math.max(8, (st.dist ?? 24) * 0.45)), 0.5);
        return a.flyTo({ lon: st.lon, lat: st.lat - (st.dist ?? 24) * 0.04, dist: st.dist ?? 24, tilt: st.tilt ?? 0.9 }, (st.dur ?? 2) / sp());
      case 'caption': {
        const text = tr(st.text, L);
        this.hooks.onCaption(text, nextCap(), caps);
        const read = Math.max(st.dur ?? 3, L === 'zh' ? text.length * 0.16 : text.split(/\s+/).length * 0.3);
        const said = this.narrate && this.hooks.speak ? this.hooks.speak(text, L) : null;
        await Promise.all([fx.wait(read), said]);
        return;
      }
      case 'route':
        return fx.route({ ...st, label: st.label ? tr(st.label, L) : undefined, dur: st.dur });
      case 'build':
        return fx.build({ ...st, dur: st.dur });
      case 'spawn':
        await fx.spawn({ lon: st.lon, lat: st.lat, model: st.model, scale: st.scale, label: st.label ? tr(st.label, L) : undefined });
        return fx.wait(0.5);
      case 'fx':
        return fx.fx({ ...st, dur: st.dur });
      case 'army':
        return fx.army({ ...st, label: st.label ? tr(st.label, L) : undefined });
      case 'clash': {
        // each side's banner names its formation (阵型)
        const forms = ([0, 1] as const).map(i => st.formations?.[i] ?? (st.siege && i ? 'line' : defaultFormation(st.units?.[i] ?? 'foot'))) as [Formation, Formation];
        const lab = (i: 0 | 1) => [st.labels ? tr(st.labels[i], L) : '', tr(FORMATION_NAME[forms[i]], L)].filter(Boolean).join(' · ');
        return fx.clash({ ...st, formations: forms, labels: [lab(0), lab(1)] });
      }
      case 'shot':
        return fx.shot(st);
      case 'fleet':
        return fx.fleet({ ...st, label: st.label ? tr(st.label, L) : undefined });
      case 'wipe':
        this.hooks.onYear(st.year);
        return a.wipeTo(st.year, st.lon, st.lat, st.dur ?? 3, st.color);
      case 'title': {
        const dur = st.dur ?? 2.6;
        this.hooks.onTitle?.(tr(st.text, L), st.sub ? tr(st.sub, L) : '', dur / sp());
        return fx.wait(dur);
      }
      case 'banner':
        return fx.banner({ lon: st.lon, lat: st.lat, text: tr(st.text, L), sub: st.sub ? tr(st.sub, L) : undefined, color: st.color, dur: st.dur });
      case 'orbit':
        return fx.orbit(st.deg, st.dur);
      case 'highlight':
        a.highlight(st.polity, (st.dur ?? 3) / sp());
        return fx.wait(Math.min(1.2, st.dur ?? 3));
      case 'wait':
        return fx.wait(st.dur);
    }
  }

  pause(): void { if (this.state === 'playing') this.set('paused'); }
  resume(): void { if (this.state === 'paused') this.set('playing'); }
  toggle(): void { if (this.state === 'paused') this.resume(); else this.pause(); }

  /** Finishes the current step's waiting immediately (skips to the next caption). */
  skip(): void {
    if (this.state === 'idle') return;
    this.resume();
    // completing pending tweens lets awaiting steps return; story items stay on the map
    this.atlas.fx.finishTweens();
    this.atlas.view.cancelFlight();
    // a caption waits for its narration too: cut the sentence short so Skip moves on at once
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }

  stop(): void {
    this.token++;
    this.atlas.fx.clear('story');
    if (this.state !== 'idle') this.set('idle');
    window.speechSynthesis?.cancel();
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
