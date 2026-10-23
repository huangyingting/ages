import { tr } from '../../shared/data/i18n.ts';
import { MUSIC } from '../../shared/data/jiangshan.ts';
import { lang, t } from '../lib/i18n.ts';
import { load, save } from '../lib/storage.ts';
import { h, icon } from './dom.ts';

/** 雅乐: guqin recordings from Wikimedia Commons, played in turn (ogg where supported, else mp3). Off by default. */
export class Music {
  readonly el: HTMLButtonElement;
  private audio: HTMLAudioElement | null = null;
  private i = load<number>('track', 0) % MUSIC.length;
  private name: HTMLElement;
  playing = false;

  constructor() {
    this.name = h('span', { class: 'mu-t' });
    this.el = h('button', { type: 'button', class: 'ib b-music', 'aria-pressed': 'false', onclick: () => this.toggle() }, icon('music'), this.name);
    this.relabel();
  }

  private src(): string {
    const m = MUSIC[this.i];
    return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? m.ogg : m.mp3;
  }

  toggle(on = !this.playing): void {
    this.playing = on;
    if (on) {
      if (!this.audio) {
        this.audio = new Audio();
        this.audio.volume = 0.5;
        this.audio.addEventListener('ended', () => this.next());
        this.audio.addEventListener('error', () => { if (this.playing) this.next(); });
        this.audio.src = this.src();
      }
      void this.audio.play().catch(() => { this.playing = false; this.relabel(); });
    } else this.audio?.pause();
    this.relabel();
  }

  next(): void {
    this.i = (this.i + 1) % MUSIC.length;
    save('track', this.i);
    if (!this.audio) return;
    this.audio.src = this.src();
    if (this.playing) void this.audio.play().catch(() => {});
    this.relabel();
  }

  relabel(): void {
    const title = this.playing ? `${t('music')} · ${tr(MUSIC[this.i].name, lang)}` : t('musicOn');
    this.el.title = title;
    this.el.setAttribute('aria-label', title);
    this.el.setAttribute('aria-pressed', String(this.playing));
    this.el.classList.toggle('on', this.playing);
    this.name.textContent = this.playing ? tr(MUSIC[this.i].name, lang) : '';
  }
}
