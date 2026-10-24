import { describe, expect, it } from 'vitest';
import { readLink } from '../../src/client/lib/link.ts';
import { articleUrl, parseExtract } from '../../src/client/lib/wikipedia.ts';
import { deploy, shape } from '../../src/client/scene/formation.ts';
import { declutter, type LayoutItem } from '../../src/client/scene/layout.ts';
import { growthField } from '../../src/client/scene/morph.ts';

describe('shared map layout', () => {
  const item = (owner: string, x: number, prio = 10): LayoutItem => ({
    owner, prio, bounds: { left: x, right: x + 30, top: 0, bottom: 30 },
  });

  it('protects model footprints from unrelated text but keeps an attached name and keyboard target', () => {
    const model = item('site', 0);
    const otherText = item('city', 10, 80);
    const name = { ...item('site', 5), model };
    const hit = { ...item('site', 0), model, passive: true };
    declutter([model], [otherText, name, hit]);
    expect([model.shown, otherText.shown, name.shown, hit.shown]).toEqual([true, false, true, true]);
  });

  it('removes a crowded lower-priority model and its attached labels, not just its name', () => {
    const main = item('capital', 0, 90), detail = item('food', 20);
    const name = { ...item('food', 60), model: detail };
    declutter([detail, main], [name]);
    expect([main.shown, detail.shown, name.shown]).toEqual([true, false, false]);
    detail.bounds.left = 40; detail.bounds.right = 70;
    declutter([detail, main], [name]);
    expect([detail.shown, name.shown]).toEqual([true, true]);
  });

  it('keeps selected models or compact markers ahead of higher-ranked content', () => {
    const main = item('capital', 0, 90), selected = { ...item('food', 20), pinned: true };
    declutter([main, selected], []);
    expect([main.shown, selected.shown]).toEqual([false, true]);
    const badge = { ...item('event', 0), pinned: true };
    declutter([main], [badge]);
    expect([main.shown, badge.shown]).toEqual([false, true]);
  });

  it('keeps the main territory readable unless the selected object needs that space', () => {
    const model = item('person', 0, 64), territory = { ...item('polity', 10, 40), primary: true };
    declutter([model], [territory]);
    expect([model.shown, territory.shown]).toEqual([false, true]);
    model.pinned = true;
    declutter([model], [territory]);
    expect([model.shown, territory.shown]).toEqual([true, false]);
  });
});

describe('wikipedia extract parsing', () => {
  it('splits lead and sections and drops reference-style sections with their subsections', () => {
    const text = [
      'Lead one.', '', 'Lead two.',
      '== History ==', 'Para A.',
      '=== Early ===', 'Para B.',
      '== Empty ==',
      '== References ==', 'Ref 1.',
      '=== Notes ===', 'Ref 2.',
      '== 参考文献 ==', '文献。',
      '== Legacy ==', 'Para C.',
    ].join('\n');
    const { lead, sections } = parseExtract(text);
    expect(lead).toEqual(['Lead one.', 'Lead two.']);
    expect(sections.map(s => [s.title, s.level, s.paras])).toEqual([
      ['History', 2, ['Para A.']],
      ['Early', 3, ['Para B.']],
      ['Legacy', 2, ['Para C.']],
    ]);
  });

  it('keeps a heading whose only content is in its subsections', () => {
    const { sections } = parseExtract('== Parent ==\n=== Child ===\nText.');
    expect(sections.map(s => s.title)).toEqual(['Parent', 'Child']);
  });

  it('builds article URLs with the simplified-Chinese variant', () => {
    expect(articleUrl('zh', '郑和下西洋')).toBe('https://zh.wikipedia.org/wiki/%E9%83%91%E5%92%8C%E4%B8%8B%E8%A5%BF%E6%B4%8B?variant=zh-cn');
    expect(articleUrl('en', 'Ming treasure voyages')).toBe('https://en.wikipedia.org/wiki/Ming_treasure_voyages');
  });
});

describe('deep links', () => {
  it('reads event, year and language and ignores invalid values', () => {
    expect(readLink('#e=zhenghe&lang=zh')).toEqual({ event: 'zhenghe', lang: 'zh' });
    expect(readLink('#y=-221&lang=en')).toEqual({ year: -221, lang: 'en' });
    expect(readLink('#y=12abc&lang=fr')).toEqual({});
    expect(readLink('')).toEqual({});
  });

  it('reads places, people and journeys, from the hash or the query string', () => {
    expect(readLink('#p=kaifeng&y=1100', '')).toEqual({ place: 'kaifeng', year: 1100 });
    expect(readLink('#person=sushi', '')).toEqual({ person: 'sushi' });
    expect(readLink('', '?j=xuanzang&lang=en')).toEqual({ journey: 'xuanzang', lang: 'en' });
    expect(readLink('#e=chibi', '?year=208')).toEqual({ event: 'chibi', year: 208 });
  });
});

describe('battle formations', () => {
  const count = (sl: { t: string }[], t: string) => sl.filter(o => o.t === t).length;

  it('shapes a wedge point-first with ranks two wider and keeps the front rank at z = 0', () => {
    const sl = shape('wedge', 9);
    expect(sl).toHaveLength(9);
    expect(Math.min(...sl.map(o => o.z))).toBe(0);
    expect(sl.filter(o => o.z === 0)).toHaveLength(1);
    expect(new Set(sl.map(o => o.z)).size).toBe(3);
  });

  it('faces a circle outward', () => {
    const sl = shape('circle', 12);
    expect(sl[0].face).toBe(0);
    expect(sl[6].face).toBeCloseTo(Math.PI);
  });

  it('equips troops for the period', () => {
    // Zhou: chariots lead the infantry
    const zhou = deploy('line', 'mixed', 30, -1046);
    expect(count(zhou, 'chariot')).toBeGreaterThan(0);
    expect(count(zhou, 'horse')).toBe(0);
    // Tang combined arms: cavalry on the wings, archers in the rear ranks
    const tang = deploy('wings', 'mixed', 30, 750);
    expect(count(tang, 'horse')).toBe(9);
    expect(count(tang, 'archer')).toBe(6);
    const wing = Math.max(...tang.map(o => Math.abs(o.x)));
    expect(tang.find(o => Math.abs(o.x) === wing)!.t).toBe('horse');
    // after 1840 rifles replace spears and bows
    const late = deploy('line', 'foot', 20, 1911);
    expect(count(late, 'gun')).toBe(20);
  });
});

describe('border morph', () => {
  it('grows a conquering polity outward from its old border', () => {
    // 8×1 strip: red holds x < 2 and takes everything up to x < 6 from blue
    const w = 8, px = (red: number) => Array.from({ length: w }, (_, x) => (x < red ? [200, 0, 0, 255] : [0, 0, 200, 255])).flat();
    const f = growthField(new Uint8ClampedArray(px(2)), new Uint8ClampedArray(px(6)), w, 1);
    expect([f[0], f[1], f[6], f[7]]).toEqual([0, 0, 0, 0]);
    expect(f[2]).toBeLessThan(f[3]);
    expect(f[4]).toBeLessThan(f[5]);
    expect(f[5]).toBe(1);
  });
});
