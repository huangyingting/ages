import { t } from '../lib/i18n.ts';
import { h, iconBtn, setIcon } from './dom.ts';

/** Story caption bar: subtitle text, step progress and playback controls. */
export class Caption {
  readonly el: HTMLElement;
  private text: HTMLElement;
  private bar: HTMLElement;
  readonly pauseBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private voiceBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;
  private stopBtn: HTMLButtonElement;
  private paused = false;
  onPause: () => void = () => {};
  onSkip: () => void = () => {};
  onStop: () => void = () => {};
  onSpeed: (v: number) => void = () => {};
  onVoice: (on: boolean) => void = () => {};
  private speeds = [1, 1.5, 2, 0.75];
  private si = 0;
  voice = false;

  constructor(canSpeak: boolean) {
    this.text = h('p', { class: 'cap-t', 'aria-live': 'polite' });
    this.bar = h('i', { class: 'cap-bar' });
    this.pauseBtn = iconBtn('pause', t('pause'), () => this.onPause());
    this.speedBtn = h('button', { type: 'button', class: 'ib sp', title: t('speed'), text: '1×', onclick: () => { this.si = (this.si + 1) % this.speeds.length; this.speedBtn.textContent = this.speeds[this.si] + '×'; this.onSpeed(this.speeds[this.si]); } });
    this.voiceBtn = iconBtn('mute', t('narrate'), () => { this.voice = !this.voice; setIcon(this.voiceBtn, this.voice ? 'sound' : 'mute'); this.voiceBtn.classList.toggle('on', this.voice); this.onVoice(this.voice); });
    this.el = h('div', { class: 'caption', hidden: true },
      this.text,
      h('div', { class: 'cap-ctl' }, this.pauseBtn, this.skipBtn = iconBtn('next', t('skip'), () => this.onSkip()), this.speedBtn, canSpeak ? this.voiceBtn : null, this.stopBtn = iconBtn('stop', t('stop'), () => this.onStop())),
      this.bar);
  }

  show(on: boolean): void { this.el.hidden = !on; if (!on) this.text.textContent = ''; }

  say(text: string, i: number, n: number): void {
    this.text.textContent = text;
    this.text.classList.remove('in');
    void this.text.offsetWidth;
    this.text.classList.add('in');
    this.bar.style.setProperty('--p', String(n ? (i + 1) / n : 0));
  }

  state(s: 'playing' | 'paused' | 'idle'): void {
    this.paused = s === 'paused';
    setIcon(this.pauseBtn, this.paused ? 'play' : 'pause');
    this.el.classList.toggle('paused', this.paused);
    this.relabel();
  }

  /** Button names in the current language (and Pause / Play by state). */
  relabel(): void {
    const label = (b: HTMLElement, s: string) => { b.title = s; b.setAttribute('aria-label', s); };
    label(this.pauseBtn, t(this.paused ? 'play' : 'pause'));
    label(this.skipBtn, t('skip'));
    this.speedBtn.title = t('speed');
    label(this.voiceBtn, t('narrate'));
    label(this.stopBtn, t('stop'));
  }
}
