import { ERAS } from '../shared/data/eras.ts';
import { EVENT, EVENTS } from '../shared/data/events.ts';
import type { Lang } from '../shared/data/i18n.ts';
import { PLACE } from '../shared/data/places.ts';
import type { Era, HistEvent, Lesson, Place, Wiki, Year } from '../shared/data/types.ts';
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
import { LessonView } from './ui/lesson.ts';
import { LESSON } from '../shared/data/lessons/index.ts';
import { Help, HubMenu, SettingsMenu } from './ui/menus.ts';
import { SURFACES, type Surface } from './scene/terrain.ts';
import { save } from './lib/storage.ts';
import { journeyStory } from '../shared/data/stories.ts';
import { JOURNEYS, PERSON, type Journey, type Person } from '../shared/data/jiangshan.ts';
import { LIFE, type LifeItem } from '../shared/data/life.ts';
import { Quiz } from './ui/quiz.ts';
import { Reader } from './ui/reader.ts';
import { SearchBox } from './ui/searchbox.ts';
import { Timeline } from './ui/timeline.ts';
import { Chronicle } from './ui/chronicle.ts';
import { Period } from './ui/period.ts';
import { Panel } from './ui/panel.ts';
import { Music } from './ui/music.ts';
import { initTips } from './ui/tip.ts';
import { BootIntro } from './ui/intro.ts';

const params = new URLSearchParams(location.search);
const lowfx = params.has('lowfx') || (navigator.hardwareConcurrency ?? 4) <= 2;

/** Application shell: wires the atlas, timeline, side panel (lesson, quiz, card with its reader), popovers and story player together. */
class App {
  atlas: Atlas;
  progress = new Progress();
  timeline = new Timeline();
  card: Card;
  reader = new Reader();
  caption = new Caption(canSpeak());
  search = new SearchBox();
  chronicle = new Chronicle();
  period = new Period();
  panel!: Panel;
  music = new Music();
  learn: Learn;
  settings!: SettingsMenu;
  hub!: HubMenu;
  help = new Help();
  quiz!: Quiz;
  lesson!: LessonView;
  player!: StoryPlayer;
  ready = false;
  private hudTl!: HTMLElement;
  private hudBl!: HTMLElement;
  private hudBc!: HTMLElement;
  private brand!: HTMLElement;

  constructor(private root: HTMLElement, stage: HTMLElement) {
    this.atlas = new Atlas(stage, lowfx);
    this.card = new Card({
      play: e => this.playStory(e),
      read: (w, title) => this.read(w, title),
      open: e => this.openEvent(e),
      era: id => this.openEra(id),
      close: () => this.closeCard(),
      learned: () => { if (this.learn.open) this.learn.render(); },
      journey: j => this.playJourney(j),
      person: p => this.openPerson(p),
      life: l => this.openLife(l),
      year: y => { this.timeline.setPlaying(false); this.timeline.set(y, true); },
    }, this.progress, lowfx);
    this.learn = new Learn(this.progress);
  }

  async start(): Promise<void> {
    const link = readLink();
    const ev = link.event ? EVENT.get(link.event) : undefined;
    const linkPlace = link.place ? PLACE.get(link.place) : undefined;
    const linkPerson = link.person ? PERSON.get(link.person) : undefined;
    const year: Year = ev?.year ?? link.year ?? (linkPerson ? Math.round((linkPerson.span[0] + linkPerson.span[1]) / 2) : undefined) ?? load<number>('year', -221);
    const intro = new BootIntro(year, lang, lowfx);
    this.atlas.onEraProgress = (era, done, total) => intro.setProgress(era, done, total);
    await this.atlas.init(year, lang);
    this.player = new StoryPlayer(this.atlas, {
      onCaption: (text, i, n) => this.caption.say(text, i, n),
      onYear: y => this.timeline.set(y, false, false),
      onState: s => {
        this.caption.state(s);
        if (s !== 'idle') this.root.classList.add('story-on');
        this.atlas.setStoryMode(s !== 'idle');
        this.card.setActive(s === 'idle');
        if (s === 'idle') { this.cine?.classList.remove('on'); this.root.classList.remove('cine-on'); }
      },
      onTitle: (text, sub, dur) => this.showTitle(text, sub, dur),
      speak,
    });
    this.quiz = new Quiz(this.atlas, this.progress);
    this.lesson = new LessonView(this.atlas, this.progress, {
      year: y => { this.timeline.setPlaying(false); this.timeline.set(y, true, false); this.atlas.setYear(y); },
      play: e => void this.playStory(e),
      open: e => this.openEvent(e),
      change: id => {
        this.root.classList.toggle('lesson-on', !!id || this.lesson.open);
        writeLink(id ? { lesson: id, lang } : { year: this.timeline.year, lang });
      },
    });
    const surf = load<Surface>('surface', 'paper');
    const surface: Surface = SURFACES.includes(params.get('map') as Surface) ? params.get('map') as Surface : SURFACES.includes(surf) ? surf : 'paper';
    this.atlas.setSurface(surface);
    this.settings = new SettingsMenu(this.atlas.layers, surface);
    this.hub = new HubMenu();
    this.buildChrome();
    this.timeline.set(year, true, false);
    this.atlas.onPin = e => this.openEvent(e);
    this.atlas.onPlace = p => this.openPlace(p);
    this.atlas.onPerson = p => this.openPerson(p);
    this.atlas.onLife = l => this.openLife(l);
    if (ev) this.openEvent(ev, false);
    if (ev) this.atlas.view.jump({ lon: ev.lon, lat: ev.lat - 1.2, dist: 26, tilt: 0.85 });
    else if (linkPlace) { this.atlas.view.jump({ lon: linkPlace.lon, lat: linkPlace.lat - 1, dist: 18, tilt: 0.85 }); this.openPlace(linkPlace, false); }
    else if (linkPerson) this.openPerson(linkPerson);
    else if (link.life) {
      const x = LIFE.find(i => i.id === link.life);
      if (x) { this.atlas.view.jump({ lon: x.lon, lat: x.lat - 0.6, dist: 14, tilt: 0.85 }); this.openLife(x); }
    }
    const linkLesson = link.lesson ? LESSON.get(link.lesson) : undefined;
    if (linkLesson) this.startLesson(linkLesson);
    const linkJourney = link.journey ? JOURNEYS.find(j => j.id === link.journey) : undefined;
    if (linkJourney) setTimeout(() => void this.playJourney(linkJourney), 600);
    this.ready = true;
    intro.finish(this.atlas, Boolean(ev || linkPlace || linkPerson || link.life || linkLesson || linkJourney));
  }

  private cine?: HTMLElement;
  private cineTimer = 0;
  /** Cinematic title card over the scene (story openings, battles, new dynasties). */
  private showTitle(text: string, sub: string, dur: number): void {
    if (!this.cine) {
      this.cine = document.createElement('div');
      this.cine.className = 'cine';
      this.cine.setAttribute('aria-live', 'polite');
      this.root.append(this.cine);
    }
    const c = this.cine;
    c.replaceChildren(Object.assign(document.createElement('h2'), { textContent: text }));
    if (sub) c.append(Object.assign(document.createElement('p'), { textContent: sub }));
    c.classList.remove('on');
    void c.offsetWidth;
    c.classList.add('on');
    this.root.classList.add('cine-on');
    clearTimeout(this.cineTimer);
    this.cineTimer = window.setTimeout(() => { c.classList.remove('on'); this.root.classList.remove('cine-on'); }, Math.max(1200, dur * 1000));
  }

  private buildChrome(): void {
    const tl = this.timeline;
    let raf = 0, pending: Year | null = null;
    tl.onYear = (y, final) => {
      pending = y;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (pending != null) this.atlas.setYear(pending); });
      if (final) {
        this.saveYear(y);
        if (this.card.open && this.card.place) this.card.showPlace(this.card.place.p, y);
      }
    };
    tl.onEvent = e => this.openEvent(e);
    this.chronicle.onOpen = e => this.openEvent(e);
    this.period.onYear = y => { tl.setPlaying(false); tl.set(y, true); };
    this.period.onHold = p => this.atlas.hold(p);
    this.period.onPolity = p => this.atlas.flyToPolity(p);
    this.period.onEra = id => this.openEra(id);
    this.period.onDetails = () => this.pop(this.period.view.hidden ? 'details' : null);
    tl.onEra = id => this.openEra(id);
    tl.onPlay = on => { if (on) { this.player.stop(); this.closeCard(); } };

    this.search.onPick = (x: Hit) => {
      if (x.type === 'event') this.openEvent(EVENT.get(x.id)!);
      else if (x.type === 'era') { this.openEra(x.id); }
      else if (x.type === 'person') this.openPerson(PERSON.get(x.id)!);
      else if (x.type === 'journey') this.playJourney(JOURNEYS.find(j => j.id === x.id)!);
      else {
        const p = PLACE.get(x.id)!;
        this.atlas.flyTo({ lon: p.lon, lat: p.lat - 1, dist: 18, tilt: 0.85 }, 1.6);
        this.openPlace(p, false);
      }
    };

    this.caption.onPause = () => this.player.toggle();
    this.caption.onSkip = () => this.player.skip();
    this.caption.onStop = () => this.stopStory(true);
    this.caption.onSpeed = v => (this.player.speed = v);
    this.caption.onVoice = on => { this.player.narrate = on; if (!on) speechSynthesis.cancel(); };

    this.learn.onLesson = l => this.startLesson(l);
    this.learn.onTest = (b, u) => { this.leaveForLesson(); this.lesson.startTest(b, u); };
    this.settings.onChange = (k, on) => this.atlas.setLayer(k, on);
    this.settings.onSurface = s => { this.atlas.setSurface(s); save('surface', s); };
    this.settings.onLang = l => setLang(l);
    this.settings.onHelp = () => { this.pop(null); this.help.toggle(true); };
    this.hub.onPlay = j => this.playJourney(j);
    this.hub.onPick = w => { this.pop(null); this.toggle(w); };
    this.hub.stat = () => { const [n, m] = this.learn.done(); return n ? `✓ ${n}/${m}` : ''; };
    this.quiz.onClose = () => this.root.classList.remove('quiz-on');
    this.quiz.onYear = y => { this.timeline.set(y, true, false); this.atlas.setYear(y); };
    // the reader unfolds beside the card and follows it to the next subject
    this.card.attach(this.reader.el);
    this.reader.onToggle = () => this.card.setReading(this.reader.current);
    this.card.onShow = () => {
      if (!this.reader.open) return;
      const w = this.card.wiki;
      if (w) this.reader.show(w.w, w.title, this.reader.readLang); else this.reader.close();
      this.card.setReading(this.reader.current);
    };

    this.period.mount(this.chronicle.el);
    this.timeline.onRender = y => { this.chronicle.update(y); this.period.setYear(y); };

    // Level 1 — the map overlay: headline (brand · era · year · reign) top left, one grouped toolbar fixed top right
    // (search · 时期详情 | study hall · settings) with the period's figures under it, the line key bottom left, the phase
    // line / story caption and the timeline bottom centre.
    // Level 2 — the side panel, between the headline and the line key: what is being studied — a lesson, the quiz, the
    // card with its 3D view, which unfolds the Wikipedia reader to its right.
    // Level 3 — popovers under the tools, one at a time (时期详情, study hall, settings), and dialogs (course picker, help).
    const hubBtn = iconBtn('grid', t('hub'), () => this.pop(this.hub.el.hidden ? 'hub' : null), 'b-hub');
    const setBtn = iconBtn('sliders', t('settings'), () => this.pop(this.settings.el.hidden ? 'settings' : null), 'b-settings');
    const fullBtn = iconBtn('full', t('fullscreen'), () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen?.().catch(() => {}); }, 'b-full');
    fullBtn.hidden = !document.fullscreenEnabled;
    document.addEventListener('fullscreenchange', () => fullBtn.classList.toggle('on', !!document.fullscreenElement));
    this.settings.extra = h('div', { class: 'set-extra' }, this.music.el, fullBtn);
    this.settings.render();
    const tools = h('div', { class: 'tools' }, this.search.el, this.period.btn, h('i', { class: 'tools-sep', 'aria-hidden': 'true' }), hubBtn, setBtn);
    const pops = [this.period.view, this.hub.el, this.settings.el];
    const bar = h('div', { class: 'bar' }, tools, ...pops);
    this.brand = h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }), h('b', { text: 'Ages' }), h('span', { class: 'brand-k' }));
    this.hudTl = h('div', { class: 'hud-tl' }, this.brand, this.timeline.head);
    this.hudBl = h('div', { class: 'hud-bl' }, this.period.key);
    const hud = h('div', { class: 'hud' },
      this.hudTl,
      h('div', { class: 'hud-tr' }, this.period.stats),
      h('div', { class: 'hud-bot' },
        this.hudBl,
        this.hudBc = h('div', { class: 'hud-bc' }, this.period.line, this.caption.el, this.timeline.el)));
    this.panel = new Panel([this.lesson.el, this.quiz.el, this.card.el]);
    this.panel.onChange = () => {
      this.root.classList.toggle('dock-on', this.panel.open);
      this.updateInset();
    };
    // a popover closes on a click anywhere else (the phase line toggles 时期详情 itself)
    document.addEventListener('pointerdown', e => {
      const n = e.target as Node;
      if (pops.some(p => !p.hidden) && !tools.contains(n) && !this.period.line.contains(n) && !pops.some(p => p.contains(n))) this.pop(null);
    });

    this.root.append(hud, this.panel.el, bar, this.learn.el, this.help.el);
    this.relabel();
    onLang(l => this.onLang(l));

    const inset = () => this.updateInset();
    new MutationObserver(inset).observe(this.root, { attributes: true, attributeFilter: ['class'] });
    const ro = new ResizeObserver(inset);
    ro.observe(this.root); ro.observe(this.panel.el); ro.observe(this.timeline.el); ro.observe(this.hudTl); ro.observe(this.hudBl); ro.observe(this.hudBc);

    window.addEventListener('keydown', e => this.key(e));
    window.addEventListener('hashchange', () => {
      const l = readLink();
      if (l.lang && l.lang !== lang) setLang(l.lang);
      if (l.event && l.event !== this.card.event?.id) { const ev = EVENT.get(l.event); if (ev) this.openEvent(ev); }
      else if (l.place && l.place !== this.card.place?.p.id) { const p = PLACE.get(l.place); if (p) this.openPlace(p); }
      else if (l.person && l.person !== this.card.person?.id) { const p = PERSON.get(l.person); if (p) this.openPerson(p); }
      else if (l.life && l.life !== this.card.life?.id) { const x = LIFE.find(i => i.id === l.life); if (x) this.openLife(x); }
      else if (l.lesson && l.lesson !== this.lesson.id) { const x = LESSON.get(l.lesson); if (x) this.startLesson(x); }
      else if (l.journey) { const j = JOURNEYS.find(x => x.id === l.journey); if (j) void this.playJourney(j); }
      else if (!l.event && !l.place && !l.person && !l.life && l.year != null) {
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

  /** Opens one toolbar popover (or none): 时期详情, the study hall and settings are mutually exclusive. */
  private pop(which: 'details' | 'hub' | 'settings' | null): void {
    this.period.view.hidden = which !== 'details';
    this.period.pressed(which === 'details');
    if (which === 'hub') this.hub.show(); else this.hub.toggle(false);
    this.settings.toggle(which === 'settings');
    this.root.querySelector('.b-hub')?.classList.toggle('on', which === 'hub');
    this.root.querySelector('.b-settings')?.classList.toggle('on', which === 'settings');
  }

  private toggle(which: 'learn' | 'quiz'): void {
    if (which === 'learn') this.learn.toggle();
    else { if (!this.quiz.open) { this.stopStory(); this.closeCard(); this.learn.toggle(false); this.lesson.stop(); } this.quiz.toggle(); this.root.classList.toggle('quiz-on', this.quiz.open); }
  }

  /** Leaves the course picker for the lesson scene. */
  startLesson(l: Lesson): void {
    this.leaveForLesson();
    this.lesson.start(l);
  }

  private leaveForLesson(): void {
    this.learn.toggle(false);
    this.stopStory();
    this.closeCard();
    if (this.quiz.open) this.toggle('quiz');
    this.timeline.setPlaying(false);
  }

  openEvent(e: HistEvent, fly = true): void {
    if (this.quiz?.open) this.quiz.toggle(false);
    if (this.player.event?.id !== e.id) this.stopStory();
    this.timeline.setPlaying(false);
    this.timeline.set(e.year, true, false);
    this.atlas.setYear(e.year);
    this.atlas.select(e, fly);
    this.timeline.select(e.id);
    this.chronicle.select(e.id);
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

  openPlace(p: Place, fly = true): void {
    if (this.player.state !== 'idle') return;
    this.atlas.select(null);
    this.timeline.select(null);
    if (fly) this.atlas.flyTo({ lon: p.lon, lat: p.lat - 0.6, dist: Math.min(this.atlas.view.pose().dist, 22), tilt: 0.85 }, 1.2);
    this.card.showPlace(p, this.timeline.year);
    this.atlas.focus(`place:${p.id}`, [p.lon, p.lat]);
    this.root.classList.add('card-on');
    writeLink({ place: p.id, year: this.timeline.year, lang });
  }

  /** A building, custom, food or figure standing on the map: jumps time into its dynasty, flies there and opens its card. */
  openLife(x: LifeItem): void {
    this.stopStory();
    this.atlas.select(null);
    this.timeline.select(null);
    const era = ERAS.find(e => e.id === x.era);
    if (era && (this.timeline.year < era.start || this.timeline.year > era.end)) {
      const y = Math.round((era.start + Math.min(era.end, 2020)) / 2);
      this.timeline.set(y, true, false);
      this.atlas.setYear(y);
    }
    this.atlas.flyTo({ lon: x.lon, lat: x.lat - 0.6, dist: Math.min(this.atlas.view.pose().dist, 14), tilt: 0.85 }, 1.2);
    this.card.showLife(x);
    this.atlas.focus(`life:${x.id}`, [x.lon, x.lat]);
    this.root.classList.add('card-on');
    writeLink({ life: x.id, lang });
  }

  openPerson(p: Person): void {
    // a figure who stands on the map as one of the dynasty's people has a single card: theirs there
    const li = LIFE.find(x => x.person === p);
    if (li) return this.openLife(li);
    this.stopStory();
    this.atlas.select(null);
    this.timeline.select(null);
    this.card.showPerson(p);
    this.atlas.focus(`person:${p.id}`);
    this.root.classList.add('card-on');
    writeLink({ person: p.id, lang });
  }

  closeCard(): void {
    this.stopStory();
    this.card.hide();
    this.reader.close();
    this.atlas.select(null);
    this.timeline.select(null);
    this.chronicle.select(null);
    this.root.classList.remove('card-on');
    // back to the lesson underneath, if any
    const id = this.lesson?.open ? this.lesson.id : null;
    writeLink(id && !id.startsWith('test:') ? { lesson: id, lang } : { year: this.timeline.year, lang });
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
        this.root.classList.remove('story-on');
        if (hadFocus) this.card.el.querySelector<HTMLElement>('[data-act=play]')?.focus({ preventScroll: true });
      }, 2500);
    }
  }

  /** Plays a journey (traveller crossing the 3D map stop by stop). */
  async playJourney(j: Journey): Promise<void> {
    this.closeCard();
    this.learn.toggle(false);
    this.reader.close();
    this.caption.show(true);
    this.root.classList.add('story-on');
    this.caption.pauseBtn.focus({ preventScroll: true });
    const done = await this.player.playSteps(journeyStory(j));
    if (done) setTimeout(() => {
      if (this.player.state === 'idle') {
        this.caption.show(false);
        this.root.classList.remove('story-on');
      }
    }, 2500);
  }

  /** `back`: the user stopped the story themselves, so the map returns to the card event's own year. */
  stopStory(back = false): void {
    back &&= !!this.player && this.player.state !== 'idle' && !!this.player.event && this.player.event === this.card.event;
    this.player?.stop();
    const hadFocus = this.caption.el.contains(document.activeElement);
    this.caption.show(false);
    this.root.classList.remove('story-on');
    if (hadFocus) this.card.el.querySelector<HTMLElement>('[data-act=play]')?.focus({ preventScroll: true });
    // the selected event's model was cleared by the story; restore it (and, when stopped mid-way, the event's year,
    // so the map is not left in an earlier/later period than the card)
    const e = this.card.event;
    if (e) {
      if (back && this.timeline.year !== e.year) { this.timeline.set(e.year, true, false); this.atlas.setYear(e.year); }
      this.atlas.select(e, false);
    }
  }

  /** The card's W button: unfolds its article beside the card, or folds it back. */
  read(w: Wiki, title: string): void {
    const cur = this.reader.current;
    if (cur && cur.zh === w.zh && cur.en === w.en) this.reader.close();
    else this.reader.show(w, title, lang);
  }

  private key(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === '/') { this.search.input.focus(); e.preventDefault(); return; }
    if (e.key === 'Escape') {
      if (!this.hub.el.hidden || !this.settings.el.hidden || !this.period.view.hidden) this.pop(null);
      else if (!this.help.el.hidden) this.help.toggle(false);
      else if (this.learn.open) this.learn.toggle(false);
      else if (this.reader.open && this.panel.top === this.card.el) this.reader.close();
      else if (this.player.state !== 'idle') this.stopStory(true);
      else if (this.quiz.open) this.quiz.toggle(false);
      else if (this.card.open) this.closeCard();
      else if (this.lesson.open) this.lesson.stop();
      return;
    }
    if ((e.key === 'r' || e.key === 'R') && !e.altKey && !e.metaKey && !e.ctrlKey && this.player.state === 'idle') {
      void this.atlas.home();
      return;
    }
    if (e.key === ' ' && !(e.target as HTMLElement).closest('button')) {
      if (this.player.state !== 'idle') this.player.toggle(); else this.timeline.setPlaying(!this.timeline.playing);
      e.preventDefault();
      return;
    }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.altKey && !e.metaKey && !e.ctrlKey) {
      if ((e.target as HTMLElement).closest('.tl-track')) return;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (this.lesson.open && !this.card.open && this.player.state === 'idle') this.lesson.step(dir);
      else if (this.card.event) {
        const list = EVENTS.filter(x => x.scope === 'china');
        const i = list.indexOf(this.card.event) + dir;
        if (list[i]) this.openEvent(list[i]);
      } else if (this.player.state === 'idle' && !this.quiz.open) {
        if (e.shiftKey) { this.timeline.setPlaying(false); this.timeline.set(this.timeline.year + dir * 10, true); } else this.timeline.step(dir);
      }
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
    this.settings.render();
    this.hub.render();
    this.help.render();
    this.quiz.relabel();
    this.lesson.relabel();
    this.chronicle.relabel();
    this.period.relabel();
    this.reader.relabel();
    this.music.relabel();
    writeLink(this.card.event ? { event: this.card.event.id, lang: l } : this.lesson.open && this.lesson.id && !this.lesson.id.startsWith('test:') ? { lesson: this.lesson.id, lang: l } : { year: this.timeline.year, lang: l });
  }

  /** Fits the side panel between the headline and the line key, and tells the camera how much of the screen it (or the
   * phone's bottom sheet) and the timeline cover so the subject stays visible. */
  private updateInset(): void {
    if (!this.panel) return;
    const H = this.root.clientHeight;
    const top = this.root.getBoundingClientRect().top;
    // (on phones the transport buttons sit just above the track)
    const ctl = this.timeline.el.querySelector('.tl-ctl');
    const tl = Math.min(this.timeline.el.getBoundingClientRect().top, ctl?.getClientRects().length ? ctl.getBoundingClientRect().top : Infinity) - top;
    // the phone's bottom sheet sits right above the timeline
    this.root.style.setProperty('--tl-b', `${Math.round(H - tl)}px`);
    // the left column: under the headline, above the line key (or the timeline, where the key is folded away)
    const head = this.hudTl.getBoundingClientRect().bottom - top;
    const foot = Math.min(tl, this.hudBl.getClientRects().length ? this.hudBl.getBoundingClientRect().top - top : tl);
    this.root.style.setProperty('--lt', `${Math.ceil(head + 6)}px`);
    this.root.style.setProperty('--lb', `${Math.ceil(H - foot + 6)}px`);
    // reading, the widened panel reaches over the foot's centre: stop above the phase line too
    const line = this.hudBc.getBoundingClientRect().top - top;
    // 时期详情 runs from under the toolbar down to just above the foot's centre
    this.root.style.setProperty('--bc-t', `${Math.round(line)}px`);
    this.root.style.setProperty('--lb-read', `${Math.ceil(H - Math.min(foot, line) + 6)}px`);
    if (this.root.classList.contains('story-on')) return this.atlas.view.setInset(0, 0, 0);
    if (matchMedia('(max-width: 720px)').matches) {
      const sheet = this.panel.open ? tl - this.panel.el.offsetHeight : tl;
      return this.atlas.view.setInset(0, 0, Math.min(H * 0.62, H - Math.min(sheet, tl)));
    }
    const l = this.panel.el;
    this.atlas.view.setInset(this.panel.open ? l.offsetLeft + l.offsetWidth : 0, 0, 0);
  }

  private relabel(): void {
    this.brand.querySelector('.brand-k')!.textContent = `${lang === 'zh' ? '长河' : 'Changhe'} · ${t('kicker')}`;
    this.brand.title = `Ages · ${t('brandSub')}`;
    const set = (cls: string, k: Parameters<typeof t>[0]) => { const el = this.root.querySelector<HTMLElement>(cls); if (el) { el.title = t(k); el.setAttribute('aria-label', t(k)); } };
    set('.b-hub', 'hub'); set('.b-settings', 'settings'); set('.b-full', 'fullscreen');
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
      fx: { story: this.atlas.fx.count('story'), event: this.atlas.fx.count('event'), base: this.atlas.fx.count('base'), scenery: this.atlas.fx.count('scenery'), works: this.atlas.fx.count('works') },
      captions: this.caption.el.querySelector('.cap-t')?.textContent ?? '',
    };
  }
}

function webgl(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

const root = document.getElementById('app')!;
setLang(readLink().lang ?? lang);
initTips();
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
