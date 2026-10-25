import type { Lang, Wiki } from '../../shared/data/types.ts';
import { lang, t } from '../lib/i18n.ts';
import { fetchArticle, wikiLink, type WikiArticle } from '../lib/wikipedia.ts';
import { h, icon, iconBtn } from './dom.ts';

/**
 * Background reading: the Wikipedia article for the card's subject, in Chinese or English (switchable independently of
 * the UI language, so students can compare). It unfolds beside the card, widening the side panel, and folds back into
 * it. Shows the lead first, then collapsible sections.
 */
export class Reader {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private titleEl: HTMLElement;
  private seg: HTMLElement;
  private wiki: Wiki | null = null;
  private lang: Lang = 'zh';
  private req = 0;
  /** Called when the reader unfolds or folds back. */
  onToggle: (open: boolean) => void = () => {};

  constructor() {
    this.titleEl = h('div', { class: 'rd-title' });
    this.seg = h('div', { class: 'seg', role: 'group' });
    this.body = h('div', { class: 'rd-body' });
    this.el = h('section', { class: 'reader', hidden: true, role: 'region', 'aria-label': t('readTitle') },
      h('header', {}, h('b', { class: 'w', text: 'W' }), this.titleEl, this.seg, iconBtn('chevL', t('fold'), () => this.close(), 'rd-fold')),
      this.body);
  }

  get open(): boolean { return !this.el.hidden; }
  /** The article being read, if any. */
  get current(): Wiki | null { return this.open ? this.wiki : null; }
  /** The reading language, which may differ from the UI's. */
  get readLang(): Lang { return this.lang; }

  show(wiki: Wiki, title: string, l: Lang = lang): void {
    const same = this.open && this.wiki?.zh === wiki.zh && this.wiki?.en === wiki.en && this.lang === l;
    this.wiki = wiki;
    this.lang = l;
    this.titleEl.textContent = title;
    if (same) return;
    const was = this.open;
    this.el.hidden = false;
    this.load();
    if (!was) this.onToggle(true);
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.req++;
    this.onToggle(false);
  }

  relabel(): void {
    const b = this.el.querySelector<HTMLElement>('.rd-fold');
    if (b) { b.title = t('fold'); b.setAttribute('aria-label', t('fold')); }
    this.el.setAttribute('aria-label', t('readTitle'));
  }

  private renderSeg(): void {
    this.seg.replaceChildren(...(['zh', 'en'] as Lang[]).map(l => h('button', {
      type: 'button', class: l === this.lang ? 'on' : '', 'aria-pressed': String(l === this.lang), text: l === 'zh' ? '中文' : 'English',
      onclick: () => { if (this.lang !== l) { this.lang = l; this.load(); } },
    })));
  }

  private async load(): Promise<void> {
    const my = ++this.req;
    const wiki = this.wiki!;
    this.renderSeg();
    this.body.replaceChildren(h('div', { class: 'skel', 'aria-label': t('loading') }, h('i'), h('i'), h('i'), h('i', { class: 's' })));
    try {
      const a = await fetchArticle(wiki, this.lang);
      if (my !== this.req) return;
      if (!a) {
        this.body.replaceChildren(h('p', { class: 'rd-msg', text: t('missing') }), this.link(wikiLink(wiki, this.lang)));
        return;
      }
      this.render(a);
    } catch {
      if (my !== this.req) return;
      this.body.replaceChildren(
        h('p', { class: 'rd-msg', text: t('offline') }),
        h('button', { type: 'button', class: 'btn', onclick: () => this.load(), text: t('retry') }),
        this.link(wikiLink(wiki, this.lang)));
    }
  }

  private link(href: string): HTMLElement {
    return h('a', { class: 'btn ghost', href, target: '_blank', rel: 'noopener' }, h('span', { text: t('openWiki') }), icon('ext'));
  }

  private render(a: WikiArticle): void {
    const L = a.lang === 'zh' ? 'zh-CN' : 'en';
    const lead = a.lead.slice(0, 4);
    const restLead = a.lead.slice(4);
    const secs = a.sections.filter(s => s.level === 2 || s.paras.length);
    this.titleEl.textContent = a.title;
    const body = h('article', { lang: L },
      a.image ? h('figure', {}, h('img', { src: a.image.src, alt: a.title, loading: 'lazy', width: a.image.width, height: a.image.height })) : null,
      h('h2', { text: a.title }),
      h('div', { class: 'rd-meta' }, a.description ? h('span', { text: a.description }) : null, h('span', { text: `${a.minutes} ${t('minutes')}` })),
      ...lead.map(p => h('p', { text: p })),
      ...restLead.map(p => h('p', { text: p })),
    );
    if (secs.length) {
      body.append(h('h3', { class: 'toc', text: t('contents') }));
      for (const s of secs) {
        const d = h('details', { class: `lv${s.level}` }, h('summary', { text: s.title }), ...s.paras.map(p => h('p', { text: p })));
        body.append(d);
      }
    }
    body.append(
      h('div', { class: 'rd-foot' }, this.link(a.url)),
      h('p', { class: 'rd-note', text: t('wikiNote') }),
      h('p', { class: 'rd-lic' }, h('span', { text: t('license') + ' ' }), h('a', { href: a.url, target: '_blank', rel: 'noopener', text: a.title })),
    );
    this.body.replaceChildren(body);
    this.body.scrollTop = 0;
  }
}
