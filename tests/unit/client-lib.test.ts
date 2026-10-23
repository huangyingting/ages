import { describe, expect, it } from 'vitest';
import { readLink } from '../../src/client/lib/link.ts';
import { articleUrl, parseExtract } from '../../src/client/lib/wikipedia.ts';

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
