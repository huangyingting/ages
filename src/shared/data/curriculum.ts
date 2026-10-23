import type { Book, I18n, Unit } from './types.ts';

/** Textbooks (统编版). Unit-level tags are used because lesson numbers differ between printings. */
export const BOOKS: Record<Book, { name: I18n; level: 'middle' | 'high' }> = {
  g7a: { name: { zh: '七年级上册', en: 'Grade 7, Vol. 1' }, level: 'middle' },
  g7b: { name: { zh: '七年级下册', en: 'Grade 7, Vol. 2' }, level: 'middle' },
  g8a: { name: { zh: '八年级上册', en: 'Grade 8, Vol. 1' }, level: 'middle' },
  g8b: { name: { zh: '八年级下册', en: 'Grade 8, Vol. 2' }, level: 'middle' },
  hs1: { name: { zh: '高中《中外历史纲要（上）》', en: 'High school: Outline of Chinese & World History I' }, level: 'high' },
};

const U = (book: Book, unit: number, zh: string, en: string, range: [number, number]): Unit => ({ book, unit, title: { zh, en }, range });

export const UNITS: Unit[] = [
  U('g7a', 1, '史前时期：中国境内早期人类与文明的起源', 'Prehistory: early humans and the origins of civilisation', [-1_700_000, -2070]),
  U('g7a', 2, '夏商周时期：早期国家与社会变革', 'Xia, Shang and Zhou: early states and social change', [-2070, -221]),
  U('g7a', 3, '秦汉时期：统一多民族国家的建立和巩固', 'Qin and Han: founding a unified multi-ethnic state', [-221, 220]),
  U('g7a', 4, '三国两晋南北朝时期：政权分立与民族交融', 'Three Kingdoms to Northern & Southern Dynasties: division and integration', [220, 589]),
  U('g7b', 1, '隋唐时期：繁荣与开放的时代', 'Sui and Tang: an age of prosperity and openness', [581, 907]),
  U('g7b', 2, '辽宋夏金元时期：民族关系发展和社会变化', 'Liao, Song, Xia, Jin and Yuan: ethnic relations and social change', [907, 1368]),
  U('g7b', 3, '明清时期：统一多民族国家的巩固与发展', 'Ming and Qing: consolidating the unified multi-ethnic state', [1368, 1840]),
  U('g8a', 1, '中国开始沦为半殖民地半封建社会', 'China begins to become semi-colonial and semi-feudal', [1840, 1864]),
  U('g8a', 2, '近代化的早期探索与民族危机的加剧', 'Early modernisation and a deepening national crisis', [1861, 1901]),
  U('g8a', 3, '资产阶级民主革命与中华民国的建立', 'The bourgeois democratic revolution and the Republic of China', [1894, 1916]),
  U('g8a', 4, '新民主主义革命的开始', 'The beginning of the New Democratic Revolution', [1915, 1921]),
  U('g8a', 5, '从国共合作到国共对立', 'From KMT–CPC cooperation to confrontation', [1924, 1936]),
  U('g8a', 6, '中华民族的抗日战争', 'The Chinese People’s War of Resistance against Japanese Aggression', [1931, 1945]),
  U('g8a', 7, '人民解放战争', 'The War of Liberation', [1945, 1949]),
  U('g8a', 8, '近代经济、社会生活与教育文化事业的发展', 'Modern economy, society, education and culture', [1840, 1949]),
  U('g8b', 1, '中华人民共和国的成立和巩固', 'Founding and consolidation of the People’s Republic of China', [1949, 1953]),
  U('g8b', 2, '社会主义制度的建立与社会主义建设的探索', 'Establishing socialism and exploring socialist construction', [1953, 1976]),
  U('g8b', 3, '中国特色社会主义道路', 'The path of socialism with Chinese characteristics', [1978, 2025]),
  U('g8b', 4, '民族团结与祖国统一', 'Ethnic unity and national reunification', [1947, 2025]),
  U('g8b', 5, '国防建设与外交成就', 'National defence and diplomatic achievements', [1949, 2025]),
  U('g8b', 6, '科技文化与社会生活', 'Science, culture and social life', [1949, 2025]),
  U('hs1', 1, '从中华文明起源到秦汉大一统封建国家的建立与巩固', 'From the origins of Chinese civilisation to the unified Qin–Han empire', [-1_700_000, 220]),
  U('hs1', 2, '三国两晋南北朝的民族交融与隋唐统一多民族封建国家的发展', 'Ethnic integration (220–589) and the Sui–Tang empire', [220, 907]),
  U('hs1', 3, '辽宋夏金多民族政权的并立与元朝的统一', 'Coexisting regimes of Liao, Song, Xia and Jin; Yuan unification', [907, 1368]),
  U('hs1', 4, '明清中国版图的奠定与面临的挑战', 'Ming and Qing: shaping China’s territory and facing new challenges', [1368, 1840]),
  U('hs1', 5, '晚清时期的内忧外患与救亡图存', 'Late Qing: crises at home and abroad, and the struggle for survival', [1840, 1901]),
  U('hs1', 6, '辛亥革命与中华民国的建立', 'The 1911 Revolution and the Republic of China', [1901, 1916]),
  U('hs1', 7, '中国共产党成立与新民主主义革命兴起', 'The founding of the CPC and the rise of the New Democratic Revolution', [1915, 1937]),
  U('hs1', 8, '中华民族的抗日战争和人民解放战争', 'The War of Resistance against Japan and the War of Liberation', [1931, 1949]),
  U('hs1', 9, '中华人民共和国成立和社会主义革命与建设', 'Founding of the PRC; socialist revolution and construction', [1949, 1976]),
  U('hs1', 10, '改革开放与社会主义现代化建设新时期', 'Reform and opening-up and the new era of modernisation', [1978, 2025]),
];

export const unitOf = (book: Book, unit: number): Unit | undefined => UNITS.find(u => u.book === book && u.unit === unit);
