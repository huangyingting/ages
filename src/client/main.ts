import { ERAS } from '../shared/data/eras.ts';
import { EVENT, EVENTS } from '../shared/data/events.ts';
import type { Lang } from '../shared/data/i18n.ts';
import { PLACE } from '../shared/data/places.ts';
import type { Era, HistEvent, Wiki, Year } from '../shared/data/types.ts';
import type { Hit } from '../shared/lib/search.ts';
import { lang, onLang, setLang, t } from './lib/i18n.ts';
import { readLink, writeLink } from './lib/link.ts';
import { canSpeak, speak } from './lib/speech.ts';
import { load, Progress } from './lib/storage.ts';
import { Atlas } from './scene/atlas.ts';
import { StoryPlayer } from './story/player.ts';
import { Caption } from './ui/caption.ts';
import { Card } from './ui/card.ts';
import { h, iconBtn } from './ui/dom.ts';
import { Learn } from './ui/learn.ts';
import { Help, LayersMenu } from './ui/menus.ts';
import { Quiz } from './ui/quiz.ts';
import { Reader } from './ui/reader.ts';
import { SearchBox } from './ui/searchbox.ts';
import { Timeline } from './ui/timeline.ts';

const params = new URLSearchParams(location.search);
const lowfx = params.has('lowfx') || (navigator.hardwareConcurrency ?? 4) <= 2;

/** Application shell: wires the atlas, timeline, cards, reader, story player, textbook drawer and quiz together. */
class App {
  atlas: Atlas;
  progress = new Progress();
  timeline = new Timeline();
  card: Card;
  reader = new Reader();
  caption = new Caption(canSpeak());
  search = new SearchBox();
  learn: Learn;
  layersMenu!: LayersMenu;
  help = new Help();
  quiz!: Quiz;
  player!: StoryPlayer;
  ready = false;
  private langBtn!: HTMLButtonElement;
  private bar!: HTMLElement;

  constructor(private root: HTMLElement, stage: HTMLElement) {
    this.atlas = new Atlas(stage, lowfx);
    this.card = new Card({
      play: e => this.playStory(e),
      read: (w, title) => this.read(w, title),
      open: e => this.openEvent(e),
      era: id => this.openEra(id),
      close: () => this.closeCard(),
      learned: () => { if (this.learn.open) this.learn.render(); },
    }, this.progress);
    this.learn = new Learn(this.progress);
  }

  async start(): Promise<void> {
    const link = readLink();
    const ev = link.event ? EVENT.get(link.event) : undefined;
    const year: Year = ev?.year ?? link.year ?? load<number>('year', -221);
    await this.atlas.init(year, lang);
    this.player = new StoryPlayer(this.atlas, {
      onCaption: (text, i, n) => this.caption.say(text, i, n),
      onYear: y => this.timeline.set(y, false, false),
      onState: s => { this.caption.state(s); this.root.classList.toggle('story-on', s !== 'idle'); },
      speak,
    });
    this.quiz = new Quiz(this.atlas, this.progress);
    this.layersMenu = new LayersMenu(this.atlas.layers);
    this.buildChrome();
    this.timeline.set(year, true, false);
    this.atlas.onPin = e => this.openEvent(e);
    if (ev) this.openEvent(ev, false);
    if (ev) this.atlas.view.jump({ lon: ev.lon, lat: ev.lat - 1.2, dist: 26, tilt: 0.85 });
    this.ready = true;
    document.getElementById('boot')?.classList.add('gone');
    setTimeout(() => document.getElementById('boot')?.remove(), 600);
  }

  private buildChrome(): void {
    const tl = this.timeline;
    let raf = 0, pending: Year | null = null;
    tl.onYear = (y, final) => {
      pending = y;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pending != null) this.atlas.setYear(pending); });
      if (final) { this.saveYear(y); }
    };
    tl.onEvent = e => this.openEvent(e);
    tl.onEra = id => this.openEra(id);
    tl.onPlay = on => { if (on) { this.player.stop(); this.closeCard(); } };

    this.search.onPick = (x: Hit) => {
      if (x.type === 'event') this.openEvent(EVENT.get(x.id)!);
      else if (x.type === 'era') { this.openEra(x.id); }
      else {
        const p = PLACE.get(x.id)!;
        this.atlas.flyTo({ lon: p.lon, lat: p.lat - 1, dist: 18, tilt: 0.85 }, 1.6);
      }
    };

    this.caption.onPause = () => this.player.toggle();
    this.caption.onSkip = () => this.player.skip();
    this.caption.onStop = () => this.stopStory();
    this.caption.onSpeed = v => (this.player.speed = v);
    this.caption.onVoice = on => { this.player.narrate = on; if (!on) speechSynthesis.cancel(); };

    this.learn.onOpen = e => { this.openEvent(e); if (matchMedia('(max-width: 720px)').matches) this.learn.toggle(false); };
    this.layersMenu.onChange = (k, on) => this.atlas.setLayer(k, on);
    this.quiz.onClose = () => {};
    this.reader.onClose = () => {};

    this.langBtn = h('button', { type: 'button', class: 'ib lang', 'data-act': 'lang', onclick: () => setLang(lang === 'zh' ? 'en' : 'zh') });
    const top = h('div', { class: 'top-r' },
      this.langBtn,
      iconBtn('book', t('learn'), () => this.toggle('learn'), 'b-learn'),
      iconBtn('quiz', t('quiz'), () => this.toggle('quiz'), 'b-quiz'),
      h('div', { class: 'pop-wrap' }, iconBtn('layers', t('layers'), () => this.layersMenu.toggle(), 'b-layers'), this.layersMenu.el),
      iconBtn('home', t('home'), () => this.atlas.home(), 'b-home'),
      iconBtn('help', t('help'), () => this.help.toggle(), 'b-help'));
    this.bar = h('div', { class: 'top-l' }, h('div', { class: 'brand' }, h('b', { text: t('brand') }), h('span', { text: t('brandSub') })), this.search.el);
    this.root.append(this.bar, top, this.learn.el, this.card.el, this.reader.el, this.quiz.el, this.caption.el, this.timeline.el, this.help.el,
      h('div', { class: 'disc', text: t('disclaimer') }));
    this.relabel();
    onLang(l => this.onLang(l));

    const inset = () => this.updateInset();
    const mo = new MutationObserver(inset);
    mo.observe(this.root, { attributes: true, attributeFilter: ['class'] });
    for (const el of [this.card.el, this.reader.el, this.learn.el]) mo.observe(el, { attributes: true, attributeFilter: ['hidden'] });
    const ro = new ResizeObserver(inset);
    ro.observe(this.card.el); ro.observe(this.reader.el); ro.observe(this.root);

    window.addEventListener('keydown', e => this.key(e));
    window.addEventListener('hashchange', () => {
      const l = readLink();
      if (l.lang && l.lang !== lang) setLang(l.lang);
      if (l.event && l.event !== this.card.event?.id) { const ev = EVENT.get(l.event); if (ev) this.openEvent(ev); }
      else if (!l.event && l.year != null) {
        this.timeline.set(l.year, true, false);
        this.atlas.setYear(l.year);
        this.closeCard();
      }
    });
  }

  private saveYear(y: Year): void {
    try { localStorage.setItem('ages:year', String(y)); } catch { /* ignore */ }
    if (!this.card.event) writeLink({ year: y, lang });
  }

  private toggle(which: 'learn' | 'quiz'): void {
    if (which === 'learn') { this.learn.toggle(); if (this.learn.open && this.quiz.open) this.quiz.toggle(false); }
    else { if (!this.quiz.open) { this.stopStory(); this.closeCard(); this.learn.toggle(false); } this.quiz.toggle(); }
  }

  openEvent(e: HistEvent, fly = true): void {
    if (this.quiz?.open) this.quiz.toggle(false);
    if (this.player.event?.id !== e.id) this.stopStory();
    this.timeline.setPlaying(false);
    this.timeline.set(e.year, true, false);
    this.atlas.setYear(e.year);
    this.atlas.select(e, fly);
    this.timeline.select(e.id);
    this.card.showEvent(e);
    this.root.classList.add('card-on');
    writeLink({ event: e.id, lang });
  }

  openEra(id: string): void {
    const era = ERAS.find(x => x.id === id) as Era | undefined;
    if (!era) return;
    this.stopStory();
    this.atlas.select(null);
    this.timeline.select(null);
    const y = Math.max(era.start, Math.min(era.end, era.start < -10000 ? era.start : era.start + 1));
    this.timeline.set(y, true, false);
    this.atlas.setYear(y);
    const cap = era.capital ? PLACE.get(era.capital) : undefined;
    if (cap) this.atlas.flyTo({ lon: cap.lon + 2, lat: cap.lat - 4, dist: 52, tilt: 0.9 }, 1.6);
    this.card.showEra(era);
    this.root.classList.add('card-on');
    writeLink({ year: y, lang });
  }

  closeCard(): void {
    this.stopStory();
    this.card.hide();
    this.reader.close();
    this.atlas.select(null);
    this.timeline.select(null);
    this.root.classList.remove('card-on');
    writeLink({ year: this.timeline.year, lang });
  }

  async playStory(e: HistEvent): Promise<void> {
    this.reader.close();
    this.caption.show(true);
    this.root.classList.add('story-on');
    // the card's Play button fades out; keep keyboard focus on the visible story controls
    this.caption.pauseBtn.focus({ preventScroll: true });
    const done = await this.player.play(e);
    if (done) {
      this.progress.watch(e.id);
      if (this.card.event?.id === e.id) this.card.render();
      setTimeout(() => {
        if (this.player.state !== 'idle') return;
        const hadFocus = this.caption.el.contains(document.activeElement);
        this.caption.show(false);
        if (hadFocus) this.card.el.querySelector<HTMLElement>('[data-act=play]')?.focus({ preventScroll: true });
      }, 2500);
    }
  }

  stopStory(): void {
    this.player?.stop();
    const hadFocus = this.caption.el.contains(document.activeElement);
    this.caption.show(false);
    this.root.classList.remove('story-on');
    if (hadFocus) this.card.el.querySelector<HTMLElement>('[data-act=play]')?.focus({ preventScroll: true });
    // the selected event's model was cleared by the story; restore it
    if (this.card.event) this.atlas.select(this.card.event, false);
  }

  read(w: Wiki, title: string): void {
    this.reader.show(w, title, lang);
  }

  private key(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === '/') { this.search.input.focus(); e.preventDefault(); return; }
    if (e.key === 'Escape') {
      if (!this.help.el.hidden) this.help.toggle(false);
      else if (this.reader.open) this.reader.close();
      else if (this.player.state !== 'idle') this.stopStory();
      else if (this.quiz.open) this.quiz.toggle(false);
      else if (this.card.open) this.closeCard();
      else if (this.learn.open) this.learn.toggle(false);
      return;
    }
    if (e.key === ' ' && !(e.target as HTMLElement).closest('button')) {
      if (this.player.state !== 'idle') this.player.toggle(); else this.timeline.setPlaying(!this.timeline.playing);
      e.preventDefault();
      return;
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && this.card.event) {
      const list = EVENTS.filter(x => x.scope === 'china');
      const i = list.indexOf(this.card.event) + (e.key === 'ArrowRight' ? 1 : -1);
      if (list[i]) this.openEvent(list[i]);
      e.preventDefault();
    }
  }

  private onLang(l: Lang): void {
    this.atlas.setLang(l);
    this.relabel();
    this.timeline.relabel();
    this.search.relabel();
    this.card.render();
    if (this.learn.open) this.learn.render();
    this.layersMenu.render();
    this.help.render();
    this.quiz.relabel();
    writeLink(this.card.event ? { event: this.card.event.id, lang: l } : { year: this.timeline.year, lang: l });
  }

  /** Tells the camera how much of the screen the card / reader cover so the subject stays visible. */
  private updateInset(): void {
    if (this.root.classList.contains('story-on')) return this.atlas.view.setInset(0, 0, 0);
    const W = this.root.clientWidth, H = this.root.clientHeight;
    if (matchMedia('(max-width: 720px)').matches) {
      const top = this.card.open ? this.card.el.getBoundingClientRect().top : H;
      return this.atlas.view.setInset(0, 0, Math.min(H * 0.6, H - top));
    }
    let left = W;
    for (const el of [this.card.el, this.reader.el]) if (!el.hidden) left = Math.min(left, el.getBoundingClientRect().left);
    const right = this.learn.el.hidden ? 0 : this.learn.el.getBoundingClientRect().right;
    this.atlas.view.setInset(Math.min(W * 0.3, right), Math.min(W * 0.5, W - left), 0);
  }

  private relabel(): void {
    this.langBtn.textContent = t('lang');
    this.langBtn.title = t('langTitle');
    this.langBtn.setAttribute('aria-label', t('langTitle'));
    const b = this.bar.querySelector('.brand')!;
    b.querySelector('b')!.textContent = t('brand');
    b.querySelector('span')!.textContent = t('brandSub');
    const set = (cls: string, k: Parameters<typeof t>[0]) => { const el = this.root.querySelector<HTMLElement>(cls); if (el) { el.title = t(k); el.setAttribute('aria-label', t(k)); } };
    set('.b-learn', 'learn'); set('.b-quiz', 'quiz'); set('.b-layers', 'layers'); set('.b-home', 'home'); set('.b-help', 'help');
    const d = this.root.querySelector('.disc');
    if (d) d.textContent = t('disclaimer');
    document.title = lang === 'zh' ? '长河 · 3D 中国历史地图' : 'Ages · 3D Atlas of Chinese History';
  }

  /** Test/automation hook: CSS-pixel position of a map point. */
  screenOf(lon: number, lat: number): { x: number; y: number } {
    const v = this.atlas.view.project(this.atlas.geo.pos(lon, lat, 0));
    const r = this.atlas.view.canvas.getBoundingClientRect();
    return { x: r.left + v.x, y: r.top + v.y };
  }

  /** Test/automation hooks. */
  state() {
    const v = this.atlas.view;
    return {
      ready: this.ready, year: this.timeline.year, lang, event: this.card.event?.id ?? null, era: this.card.era?.id ?? null,
      story: this.player.state, snapshot: this.atlas.snapshot?.id ?? null, frames: v.frames, pose: v.pose(),
      fx: { story: this.atlas.fx.count('story'), event: this.atlas.fx.count('event'), base: this.atlas.fx.count('base') },
      captions: this.caption.el.querySelector('.cap-t')?.textContent ?? '',
    };
  }
}

function webgl(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

const root = document.getElementById('app')!;
setLang(readLink().lang ?? lang);
if (!webgl()) {
  document.getElementById('boot')?.remove();
  root.append(h('div', { class: 'nogl', text: t('webgl') }));
} else {
  const app = new App(root, document.getElementById('stage')!);
  (window as unknown as { __atlas: unknown }).__atlas = app;
  app.start().catch(err => {
    console.error(err);
    root.append(h('div', { class: 'nogl', text: String(err) }));
  });
}

