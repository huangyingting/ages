/**
 * Wikipedia client for the background-reading panel. One CORS request per article to the MediaWiki action API
 * (plain-text extract + lead image + short description). Text is rendered with textContent only, never as HTML.
 * If an item only names an article in the other language, the title is resolved through interlanguage links.
 */
import type { Lang, Wiki } from '../../shared/data/types.ts';

export interface WikiSection { title: string; level: number; paras: string[] }
export interface WikiArticle {
  lang: Lang;
  title: string;
  url: string;
  description?: string;
  image?: { src: string; width: number; height: number };
  lead: string[];
  sections: WikiSection[];
  /** rough reading time in minutes */
  minutes: number;
}

const HOST: Record<Lang, string> = { en: 'en.wikipedia.org', zh: 'zh.wikipedia.org' };
const SKIP = new Set([
  'see also', 'references', 'external links', 'notes', 'further reading', 'bibliography', 'sources', 'citations', 'footnotes', 'gallery', 'explanatory notes',
  '参见', '参考文献', '外部链接', '注释', '延伸阅读', '参考资料', '参考', '注释和参考文献', '脚注', '相关条目', '外部連結', '參見', '參考文獻', '註釋', '图集', '画廊', '参考来源', '注解', '腳註', '扩展阅读',
]);

export function articleUrl(l: Lang, title: string): string {
  return `https://${HOST[l]}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}${l === 'zh' ? '?variant=zh-cn' : ''}`;
}

/** Splits an `exsectionformat=wiki` extract into lead paragraphs and sections, dropping reference-style sections. */
export function parseExtract(text: string): { lead: string[]; sections: WikiSection[] } {
  const lead: string[] = [];
  const sections: WikiSection[] = [];
  let cur: WikiSection | null = null;
  let skipBelow = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(={2,6})\s*(.+?)\s*\1$/.exec(line);
    if (m) {
      const level = m[1].length;
      if (skipBelow && level > skipBelow) continue;
      skipBelow = 0;
      if (SKIP.has(m[2].toLowerCase())) { skipBelow = level; cur = null; continue; }
      cur = { title: m[2], level, paras: [] };
      sections.push(cur);
      continue;
    }
    if (skipBelow) continue;
    (cur ? cur.paras : lead).push(line);
  }
  const hasBody = (i: number): boolean => {
    for (let j = i; j < sections.length && (j === i || sections[j].level > sections[i].level); j++) if (sections[j].paras.length) return true;
    return false;
  };
  return { lead, sections: sections.filter((_, i) => hasBody(i)) };
}

async function api(l: Lang, params: Record<string, string>): Promise<unknown> {
  const q = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', redirects: '1', ...params });
  if (l === 'zh') q.set('variant', 'zh-cn');
  const r = await fetch(`https://${HOST[l]}/w/api.php?${q}`);
  if (!r.ok) throw new Error('wikipedia ' + r.status);
  return r.json();
}

interface Page { title: string; missing?: boolean; extract?: string; description?: string; varianttitles?: Record<string, string>; thumbnail?: { source: string; width: number; height: number }; langlinks?: { lang: string; title: string }[] }

async function load(l: Lang, title: string): Promise<WikiArticle | null> {
  const j = await api(l, {
    prop: 'extracts|pageimages|description|info', inprop: 'varianttitles', explaintext: '1', exsectionformat: 'wiki',
    piprop: 'thumbnail', pithumbsize: '800', titles: title,
  }) as { query?: { pages?: Page[] } };
  const p = j.query?.pages?.[0];
  if (!p || p.missing || !p.extract) return null;
  const { lead, sections } = parseExtract(p.extract);
  // zh: characters (~400/min); en: words (~220/min)
  const units = [...lead, ...sections.flatMap(s => s.paras)].reduce((n, s) => n + (l === 'zh' ? s.length : s.split(/\s+/).length), 0);
  return {
    lang: l,
    title: (l === 'zh' && p.varianttitles?.['zh-cn']) || p.title,
    url: articleUrl(l, p.title),
    description: p.description,
    lead, sections,
    minutes: Math.max(1, Math.round(units / (l === 'zh' ? 400 : 220))),
    image: p.thumbnail ? { src: p.thumbnail.source, width: p.thumbnail.width, height: p.thumbnail.height } : undefined,
  };
}

/** The title of `title` (in `from`) on the `to` wiki, via interlanguage links. */
async function translateTitle(from: Lang, title: string, to: Lang): Promise<string | null> {
  const j = await api(from, { prop: 'langlinks', lllang: to, titles: title }) as { query?: { pages?: Page[] } };
  return j.query?.pages?.[0]?.langlinks?.[0]?.title ?? null;
}

const cache = new Map<string, Promise<WikiArticle | null>>();

/** Fetches (once per session) the article for an item in `l`; resolves null if none exists, rejects when offline. */
export function fetchArticle(wiki: Wiki, l: Lang): Promise<WikiArticle | null> {
  const k = `${l}:${wiki.zh ?? ''}|${wiki.en ?? ''}`;
  let p = cache.get(k);
  if (!p) {
    p = (async () => {
      const own = wiki[l];
      if (own) return load(l, own);
      const other: Lang = l === 'zh' ? 'en' : 'zh';
      const src = wiki[other];
      if (!src) return null;
      const t = await translateTitle(other, src, l);
      return t ? load(l, t) : null;
    })();
    cache.set(k, p);
    p.catch(() => cache.delete(k));
  }
  return p;
}

/** Link to the article (search link when only the other language's title is known). */
export function wikiLink(wiki: Wiki, l: Lang): string {
  if (wiki[l]) return articleUrl(l, wiki[l]!);
  const other: Lang = l === 'zh' ? 'en' : 'zh';
  return wiki[other] ? articleUrl(other, wiki[other]!) : `https://${HOST[l]}/`;
}
