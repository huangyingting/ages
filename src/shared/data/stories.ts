import { formatYear } from '../lib/timeline.ts';
import type { Journey } from './jiangshan.ts';
import type { Formation, I18n, LonLat, ModelRecipe, StoryStep, Troops, Year } from './types.ts';

/**
 * Scripted animations for flagship events. Each step is plain data (see StoryStep in types.ts), so stories can be
 * authored, validated and unit-tested without the renderer. Events without a script get `autoStory()`.
 */
const cap = (zh: string, en: string, dur = 3.2, par = false): StoryStep => ({ do: 'caption', text: { zh, en }, dur, ...(par ? { par } : {}) });
const fly = (lon: number, lat: number, dist = 26, tilt = 0.9, dur = 2.2): StoryStep => ({ do: 'fly', lon, lat, dist, tilt, dur });
const year = (y: Year): StoryStep => ({ do: 'year', year: y });
const lbl = (zh: string, en: string): I18n => ({ zh, en });
/** cinematic opening title; runs alongside the first camera move */
const title = (zh: string, en: string, subZh?: string, subEn?: string): StoryStep =>
  ({ do: 'title', text: { zh, en }, ...(subZh ? { sub: { zh: subZh, en: subEn ?? subZh } } : {}), dur: 3.2, par: true });
const banner = (lon: number, lat: number, zh: string, en: string, color?: string, sub?: I18n): StoryStep =>
  ({ do: 'banner', lon, lat, text: { zh, en }, ...(color ? { color } : {}), ...(sub ? { sub } : {}), dur: 4.5 });
/** the map of year `y` spreads out from lon/lat */
const wipe = (y: Year, lon: number, lat: number, color?: string, dur = 3.5): StoryStep => ({ do: 'wipe', year: y, lon, lat, dur, ...(color ? { color } : {}) });
const orbit = (deg = 40, dur = 5, par = false): StoryStep => ({ do: 'orbit', deg, dur, par });

const QIN = '#1c2833';
const RED = '#c0392b';
const JP = '#566573';
const PLA = '#c0392b';
const XIANYANG: LonLat = [108.71, 34.33];

export const STORIES: Record<string, StoryStep[]> = {
  muye: [
    year(-1050), title('牧野之战', 'Battle of Muye', '约前1046年 · 商周之变', 'c. 1046 BCE · Zhou replaces Shang'), fly(111.2, 34.7, 26),
    cap('周武王联合各部落，从镐京出兵东进。', 'King Wu of Zhou leads his allies east from Haojing.'),
    { do: 'army', pts: [[108.85, 34.2], [110.3, 34.55], [111.9, 34.75], [113.3, 35.05], [113.75, 35.2]], color: RED, dur: 5.5, count: 40, unit: 'mixed', label: lbl('周军', 'Zhou'), follow: true },
    fly(113.9, 35.25, 11, 0.92, 1.4),
    { do: 'shot', shot: 'wide', lon: 113.95, lat: 35.25, dur: 1.6 },
    cap('周军以战车为先锋，虎贲甲士随后列阵；商军阵前倒戈。', 'Zhou war chariots lead, armoured infantry behind; the Shang ranks turn their spears.'),
    { do: 'clash', lon: 113.95, lat: 35.25, a: RED, b: '#4a235a', winner: 'a', angle: 0, dur: 6.5, count: 34, labels: [lbl('周', 'Zhou'), lbl('商', 'Shang')], units: ['chariot', 'foot'], formations: ['line', 'square'] },
    banner(113.95, 35.25, '牧野之战', 'Battle of Muye', RED, lbl('商军阵前倒戈', 'Shang troops turn their spears')),
    { do: 'spawn', lon: 113.9, lat: 35.2, model: { kind: 'chariot' } },
    wipe(-1046, 113.95, 35.25, RED),
    cap('前1046年牧野之战，商朝灭亡，西周建立。', '1046 BCE: Shang falls at Muye; the Western Zhou begins.'),
  ],

  qin_unify: [
    year(-231), title('秦灭六国', 'Qin Conquers the Six States', '前230—前221年', '230–221 BCE'), fly(113.2, 35.2, 40, 0.82),
    cap('前230年起，秦王嬴政开始统一六国。', 'From 230 BCE King Zheng of Qin sets out to conquer the six states.'),
    { do: 'fly', lon: 113.7, lat: 33.2, dist: 24, tilt: 0.86, dur: 2.4, par: true },
    { do: 'army', from: XIANYANG, to: [113.7, 34.4], color: QIN, dur: 3, count: 30, unit: 'mixed', label: lbl('秦军', 'Qin') },
    { do: 'clash', lon: 113.7, lat: 34.4, a: QIN, b: '#8e44ad', winner: 'a', angle: 0, dur: 4.2, count: 20, siege: true },
    year(-230), banner(113.7, 34.4, '灭韩', 'Han falls', QIN, lbl('前230年', '230 BCE')),
    cap('灭韩（前230年）', 'Han falls (230 BCE)', 1.8, true),
    { do: 'fly', lon: 114.49, lat: 35.4, dist: 24, tilt: 0.86, dur: 2.4, par: true },
    { do: 'army', from: XIANYANG, to: [114.49, 36.6], color: QIN, dur: 3, count: 30, unit: 'mixed', label: lbl('秦军', 'Qin') },
    { do: 'clash', lon: 114.49, lat: 36.6, a: QIN, b: '#b9770e', winner: 'a', angle: 330, dur: 4.2, count: 20, siege: true },
    year(-228), banner(114.49, 36.6, '破赵', 'Zhao falls', QIN, lbl('前228年', '228 BCE')),
    cap('破赵（前228年）', 'Zhao falls (228 BCE)', 1.8, true),
    { do: 'fly', lon: 114.31, lat: 33.6, dist: 24, tilt: 0.86, dur: 2.4, par: true },
    { do: 'army', from: XIANYANG, to: [114.31, 34.8], color: QIN, dur: 3, count: 30, unit: 'mixed', label: lbl('秦军', 'Qin') },
    { do: 'clash', lon: 114.31, lat: 34.8, a: QIN, b: '#1abc9c', winner: 'a', angle: 0, dur: 4.2, count: 20, siege: true },
    year(-225), banner(114.31, 34.8, '灭魏', 'Wei falls', QIN, lbl('前225年', '225 BCE')),
    cap('灭魏（前225年）', 'Wei falls (225 BCE)', 1.8, true),
    { do: 'fly', lon: 116.78, lat: 31.37, dist: 24, tilt: 0.86, dur: 2.4, par: true },
    { do: 'army', from: XIANYANG, to: [116.78, 32.57], color: QIN, dur: 3, count: 30, unit: 'mixed', label: lbl('秦军', 'Qin') },
    { do: 'clash', lon: 116.78, lat: 32.57, a: QIN, b: '#a04000', winner: 'a', angle: 320, dur: 4.2, count: 20, siege: true },
    year(-223), banner(116.78, 32.57, '灭楚', 'Chu falls', QIN, lbl('前223年', '223 BCE')),
    cap('灭楚（前223年）', 'Chu falls (223 BCE)', 1.8, true),
    { do: 'fly', lon: 116.4, lat: 38.7, dist: 24, tilt: 0.86, dur: 2.4, par: true },
    { do: 'army', from: XIANYANG, to: [116.4, 39.9], color: QIN, dur: 3, count: 30, unit: 'mixed', label: lbl('秦军', 'Qin') },
    { do: 'clash', lon: 116.4, lat: 39.9, a: QIN, b: '#2e86c1', winner: 'a', angle: 20, dur: 4.2, count: 20, siege: true },
    year(-222), banner(116.4, 39.9, '灭燕', 'Yan falls', QIN, lbl('前222年', '222 BCE')),
    cap('灭燕（前222年）', 'Yan falls (222 BCE)', 1.8, true),
    { do: 'fly', lon: 118.31, lat: 35.66, dist: 24, tilt: 0.86, dur: 2.4, par: true },
    { do: 'army', from: XIANYANG, to: [118.31, 36.86], color: QIN, dur: 3, count: 30, unit: 'mixed', label: lbl('秦军', 'Qin') },
    { do: 'clash', lon: 118.31, lat: 36.86, a: QIN, b: '#117a65', winner: 'a', angle: 0, dur: 4.2, count: 20, siege: true },
    year(-221), banner(118.31, 36.86, '灭齐', 'Qi falls', QIN, lbl('前221年', '221 BCE')),
    cap('灭齐（前221年）', 'Qi falls (221 BCE)', 1.8, true),
    fly(112, 34, 46, 0.8, 1.6),
    wipe(-221, 108.71, 34.33, QIN, 4),
    { do: 'highlight', polity: 'qin', dur: 3, par: true },
    banner(108.71, 34.33, '始皇帝', 'The First Emperor', QIN, lbl('书同文 · 车同轨', 'one script · one axle width')),
    { do: 'spawn', lon: 108.71, lat: 34.33, model: { kind: 'warrior' }, label: lbl('咸阳', 'Xianyang') },
    orbit(40, 5, true),
    cap('前221年，秦建立我国历史上第一个统一的多民族封建国家。', '221 BCE: Qin founds China’s first unified multi-ethnic empire.', 5),
  ],

  qin_wall: [
    title('秦长城', 'The Qin Great Wall', '前214年起', 'from 214 BCE'), year(-215), fly(112, 40.5, 40, 0.8),
    cap('蒙恬北击匈奴，把秦、赵、燕的旧长城连成一线。', 'Meng Tian drives back the Xiongnu and joins the old walls into one.'),
    { do: 'build', kind: 'wall', dur: 6, pts: [[103.9, 35.4], [104.6, 36.8], [105.8, 38.6], [105.8, 40.5], [106.8, 41.4], [109.5, 41.8],
      [112.0, 41.6], [114.5, 41.9], [117.0, 42.5], [120.0, 42.6], [122.5, 42.8], [124.5, 42.3], [125.6, 41.0]] },
    { do: 'spawn', lon: 109.5, lat: 41.8, model: { kind: 'beacon' } },
    cap('西起临洮，东至辽东，绵延万余里。', 'From Lintao in the west to Liaodong in the east.'),
    orbit(35, 4),
  ],

  zhangqian: [
    title('张骞通西域', 'Zhang Qian Opens the West', '前138年 · 丝绸之路', '138 BCE · the Silk Road'), year(-138), fly(92, 37, 54, 0.84),
    cap('前138年，张骞从长安出发出使西域。', '138 BCE: Zhang Qian sets out from Chang’an.'),
    { do: 'route', model: { kind: 'camel' }, dur: 9, color: '#b9770e', label: lbl('丝绸之路', 'Silk Road'), keep: true,
      pts: [[108.94, 34.27], [104.0, 35.6], [102.6, 37.9], [100.4, 38.9], [98.5, 39.7], [94.66, 40.14], [89.2, 42.9], [84.0, 41.7],
        [80.3, 41.2], [76.0, 39.5], [72.8, 40.6], [71.8, 40.4], [69.0, 39.0], [67.2, 37.0]] },
    cap('他到达大宛、大月氏，途中两次被匈奴扣留。', 'He reached Dayuan (Ferghana) and the Yuezhi, captured twice by the Xiongnu on the way.'),
    { do: 'route', dur: 6, color: '#b9770e', dashed: true, keep: true,
      pts: [[67.2, 37.0], [71.0, 38.0], [75.99, 39.47], [79.9, 37.1], [84.0, 37.5], [88.2, 39.0], [94.66, 40.14], [98.5, 39.7], [102.6, 37.9], [108.94, 34.27]] },
    year(-119),
    cap('前119年第二次出使乌孙。丝绸之路从此开通。', 'His second mission (119 BCE) reached the Wusun. The Silk Road opened.', 4),
  ],

  chibi: [
    year(208), title('赤壁之战', 'Battle of the Red Cliffs', '208年 · 三分天下由此定', '208 CE · the Three Kingdoms take shape'), fly(113.4, 30.05, 16, 0.9),
    cap('208年，曹操率大军顺江东下，战船首尾相连。', '208: Cao Cao’s great fleet sails down the Yangtze, ships chained together.'),
    { do: 'fleet', pts: [[112.2, 30.35], [112.8, 30.15], [113.4, 29.98], [113.72, 29.9]], model: 'warship', color: '#2874a6', count: 8, dur: 5, label: lbl('曹军水师', 'Cao Cao’s fleet'), keep: true },
    cap('孙刘联军以火船突袭，东南风起。', 'The Sun–Liu allies send fire ships on a south-east wind.'),
    fly(113.85, 29.95, 9, 0.9, 1.4),
    { do: 'fleet', pts: [[114.3, 30.35], [114.1, 30.12], [113.88, 29.94]], model: 'fireship', color: '#e67e22', count: 5, dur: 3.5, label: lbl('周瑜·黄盖', 'Zhou Yu & Huang Gai') },
    { do: 'fx', lon: 113.78, lat: 29.9, fx: 'fire', dur: 6, par: true },
    { do: 'fx', lon: 113.62, lat: 29.95, fx: 'fire', dur: 6, par: true },
    banner(113.75, 29.92, '火烧赤壁', 'Red Cliffs ablaze', '#d35400'),
    orbit(35, 4),
    { do: 'army', pts: [[113.6, 29.98], [113.2, 30.3], [112.8, 30.5], [112.25, 30.9]], color: '#2874a6', dur: 3.5, count: 18, unit: 'mixed', retreat: true, label: lbl('曹军败退', 'Cao Cao retreats') },
    cap('曹军大败北撤，三国鼎立的局面由此奠定。', 'Cao Cao retreats north; the Three Kingdoms take shape.', 4),
  ],

  sanguo: [
    year(219), title('三国鼎立', 'The Three Kingdoms', '220—280年', '220–280'), fly(110, 31, 46, 0.85),
    wipe(220, 112.45, 34.62, '#2874a6', 3), { do: 'highlight', polity: 'cao_wei', dur: 2, par: true },
    banner(112.45, 34.62, '魏', 'Wei', '#2874a6', lbl('曹丕 · 都洛阳', 'Cao Pi · Luoyang')),
    cap('220年 曹丕称帝，国号魏，都洛阳。', '220: Cao Pi founds Wei at Luoyang.', 2.4),
    wipe(221, 104.07, 30.67, '#27ae60', 3), { do: 'highlight', polity: 'shu_han', dur: 2, par: true },
    banner(104.07, 30.67, '蜀汉', 'Shu Han', '#27ae60', lbl('刘备 · 都成都', 'Liu Bei · Chengdu')),
    cap('221年 刘备称帝，国号汉（蜀），都成都。', '221: Liu Bei founds Shu Han at Chengdu.', 2.4),
    year(229), { do: 'highlight', polity: 'sun_wu', dur: 2, par: true },
    banner(118.78, 32.06, '吴', 'Wu', '#c0392b', lbl('孙权 · 都建业', 'Sun Quan · Jianye')),
    cap('229年 孙权称帝，国号吴，都建业。', '229: Sun Quan founds Wu at Jianye.', 2.4),
    orbit(30, 4, true),
    year(262),
  ],

  feishui: [
    year(383), title('淝水之战', 'Battle of the Fei River', '383年 · 以少胜多', '383 CE · the few defeat the many'), fly(113.5, 33.3, 34, 0.85),
    cap('383年，前秦苻坚号称百万大军南下。', '383: Fu Jian of Former Qin marches south with a vast army.'),
    { do: 'army', pts: [[108.94, 34.27], [110.8, 34.1], [112.9, 33.6], [114.8, 33.0], [116.45, 32.55]], color: '#7b7d7d', dur: 6, count: 70, unit: 'mixed', label: lbl('前秦大军', 'Former Qin'), follow: true },
    fly(116.7, 32.4, 11, 0.92, 1.4),
    { do: 'clash', lon: 116.72, lat: 32.42, a: '#2e86c1', b: '#7b7d7d', winner: 'a', angle: 225, dur: 7, count: 26, labels: [lbl('东晋北府兵', 'Jin Beifu army'), lbl('前秦', 'Former Qin')], units: ['foot', 'mixed'], formations: ['wedge', 'wings'] },
    banner(116.72, 32.42, '风声鹤唳', 'Every rustle an enemy', '#2e86c1', lbl('草木皆兵', 'every tree a soldier')),
    cap('东晋军渡淝水猛攻，秦军溃败，“风声鹤唳，草木皆兵”。', 'The Jin cross the Fei and the Qin army collapses in panic.'),
    { do: 'army', pts: [[116.5, 32.55], [115.0, 33.2], [113.6, 34.0], [112.45, 34.6]], color: '#7b7d7d', dur: 3.5, count: 14, unit: 'mixed', retreat: true },
  ],

  xiaowendi: [
    title('北魏孝文帝改革', 'Reforms of Emperor Xiaowen', '494年 · 迁都洛阳', '494 · the move to Luoyang'), year(493), fly(112.8, 37.3, 26),
    cap('494年，孝文帝从平城迁都洛阳。', '494: Emperor Xiaowen moves the capital from Pingcheng to Luoyang.'),
    { do: 'route', model: { kind: 'rider' }, dur: 5, color: '#5b2c6f', pts: [[113.3, 40.09], [112.7, 38.6], [112.55, 37.87], [112.6, 36.2], [112.45, 34.62]] },
    year(494),
    cap('推行汉化：穿汉服、说汉语、改汉姓、通婚。', 'He adopts Han dress, language, surnames and intermarriage.'),
  ],

  grand_canal: [
    title('隋朝大运河', 'The Grand Canal', '605—610年', '605–610'), year(604), fly(116.5, 34.5, 40, 0.8),
    cap('隋炀帝开通大运河，以洛阳为中心。', 'Emperor Yang digs the Grand Canal, centred on Luoyang.'),
    { do: 'build', kind: 'canal', dur: 3, pts: [[112.45, 34.62], [113.6, 35.1], [114.5, 36.0], [115.5, 37.3], [116.1, 38.4], [116.4, 39.6]] },
    cap('永济渠：北达涿郡', 'Yongji Canal: north to Zhuojun', 1.8),
    { do: 'build', kind: 'canal', dur: 3, pts: [[112.45, 34.62], [113.65, 34.76], [114.31, 34.8], [116.0, 34.0], [117.4, 33.6], [119.0, 33.6]] },
    cap('通济渠：连接黄河与淮河', 'Tongji Canal: Yellow River to the Huai', 1.8),
    { do: 'build', kind: 'canal', dur: 1.6, pts: [[119.0, 33.6], [119.42, 32.39]] },
    cap('邗沟：淮河至长江', 'Hangou: the Huai to the Yangtze', 1.6),
    { do: 'build', kind: 'canal', dur: 2.2, pts: [[119.45, 32.2], [119.95, 31.8], [120.62, 31.3], [120.4, 30.8], [120.16, 30.27]] },
    cap('江南河：南至余杭', 'Jiangnan Canal: south to Yuhang', 1.8),
    { do: 'route', model: { kind: 'boat' }, dur: 4, pts: [[120.16, 30.27], [120.62, 31.3], [119.42, 32.39], [119.0, 33.6], [116.0, 34.0], [112.45, 34.62]] },
    cap('全长两千多千米，连接五大水系。', 'Over 2,000 km long, linking five river systems.', 3.5),
    orbit(40, 5),
  ],

  xuanzang: [
    title('玄奘西行', 'Xuanzang’s Journey West', '627—645年', '627–645'), year(627), fly(92, 33, 54, 0.84),
    cap('玄奘从长安出发，西行求法。', 'Xuanzang leaves Chang’an to seek the scriptures.'),
    { do: 'route', model: { kind: 'camel' }, dur: 10, color: '#d68910', keep: true,
      pts: [[108.94, 34.27], [102.6, 37.9], [95.8, 40.5], [93.5, 42.8], [89.2, 42.9], [83.0, 41.7], [80.3, 41.2], [76.0, 42.4], [72.3, 42.5],
        [69.2, 41.3], [66.97, 39.65], [67.2, 36.7], [69.2, 34.5], [72.0, 34.0], [74.8, 34.1], [77.2, 28.6], [80.9, 26.8], [83.0, 25.3], [85.44, 25.14]] },
    { do: 'spawn', lon: 85.44, lat: 25.14, model: { kind: 'temple', hero: 'sites-a/st_nalanda' }, label: lbl('那烂陀寺', 'Nalanda') },
    cap('他在天竺那烂陀寺学习多年。', 'He studies for years at Nalanda in India.'),
    { do: 'route', dur: 7, color: '#d68910', dashed: true, keep: true,
      pts: [[85.44, 25.14], [77.2, 28.6], [72.0, 34.0], [71.5, 37.0], [75.99, 39.47], [79.9, 37.1], [83.6, 37.0], [88.2, 39.0], [94.66, 40.14], [102.6, 37.9], [108.94, 34.27]] },
    year(645),
    cap('645年带回佛经657部，著《大唐西域记》。', 'In 645 he returns with 657 texts and writes his Records of the Western Regions.', 4),
  ],

  wencheng: [
    title('文成公主入藏', 'Princess Wencheng', '641年 · 唐蕃和亲', '641 · Tang–Tibet alliance'), year(640), fly(100, 33, 40, 0.85),
    cap('641年，文成公主从长安出发远嫁吐蕃。', '641: Princess Wencheng travels from Chang’an to Tibet.'),
    { do: 'route', model: { kind: 'tent' }, dur: 7, color: '#c0392b', keep: true,
      pts: [[108.94, 34.27], [105.7, 34.6], [103.8, 36.06], [101.78, 36.62], [101.1, 36.4], [99.6, 35.3], [97.0, 33.0], [94.0, 31.5], [92.0, 30.8], [91.11, 29.65]] },
    year(641),
    { do: 'spawn', lon: 91.11, lat: 29.65, model: { kind: 'temple', hero: 'sites-a/st_jokhang' }, label: lbl('逻些（拉萨）', 'Rasa (Lhasa)') },
    cap('她带去了中原的工艺、农技和典籍，唐蕃“和同为一家”。', 'She brought crafts, seeds and books; Tang and Tubo became “one family”.'),
  ],

  jianzhen: [
    title('鉴真东渡', 'Jianzhen Sails to Japan', '753年 · 六次东渡', '753 · the sixth attempt'), year(753), fly(125, 32, 34, 0.85),
    cap('753年，鉴真第六次东渡。', '753: Jianzhen sets out on his sixth attempt.'),
    { do: 'route', model: { kind: 'junk' }, dur: 7, color: '#2e86c1', keep: true,
      pts: [[119.42, 32.39], [120.6, 31.9], [121.8, 31.3], [124.5, 30.6], [128.0, 30.0], [130.3, 31.4], [130.4, 33.6], [132.5, 34.0], [135.0, 34.5], [135.8, 34.68]] },
    { do: 'spawn', lon: 135.8, lat: 34.68, model: { kind: 'temple', hero: 'sites-a/st_toshodaiji' }, label: lbl('唐招提寺', 'Tōshōdai-ji') },
    cap('双目失明的鉴真终于抵达日本，传播佛法与盛唐文化。', 'Blind but undaunted, Jianzhen reaches Japan and spreads Buddhism and Tang culture.'),
  ],

  anshi: [
    year(755), title('安史之乱', 'An Lushan Rebellion', '755—763年 · 唐由盛转衰', '755–763 · the Tang’s turning point'), fly(113, 36.5, 36, 0.85),
    cap('755年，安禄山、史思明在范阳起兵。', '755: An Lushan and Shi Siming rebel at Fanyang.'),
    { do: 'army', pts: [[116.4, 39.9], [115.5, 38.2], [114.5, 36.6], [113.4, 35.2], [112.45, 34.62]], color: '#7f8c8d', dur: 5, count: 50, unit: 'horse', label: lbl('安史叛军', 'An–Shi rebels'), follow: true },
    { do: 'army', pts: [[112.45, 34.62], [111.2, 34.65], [110.35, 34.6]], color: '#7f8c8d', dur: 2.5, count: 40, unit: 'horse' },
    { do: 'clash', lon: 110.3, lat: 34.6, a: '#7f8c8d', b: '#d4ac0d', winner: 'a', siege: true, angle: 180, dur: 5.5, count: 26, labels: [lbl('叛军', 'Rebels'), lbl('唐军', 'Tang')], units: ['horse', 'archer'], formations: ['wedge', 'line'] },
    banner(110.3, 34.6, '潼关失守', 'Tong Pass falls', '#7f8c8d'),
    { do: 'fx', lon: 108.94, lat: 34.27, fx: 'fire', dur: 4, par: true },
    cap('洛阳、长安相继失陷，唐玄宗逃往四川。', 'Luoyang and Chang’an fall; Emperor Xuanzong flees to Sichuan.'),
    { do: 'army', pts: [[108.94, 34.27], [108.4, 34.25], [107.1, 33.1], [105.8, 32.4], [105.0, 31.5], [104.07, 30.67]], color: '#d4ac0d', dur: 4, count: 10, unit: 'horse', retreat: true, label: lbl('玄宗入蜀', 'Xuanzong flees') },
    year(763), cap('763年叛乱平定，唐朝由盛转衰。', 'The revolt ends in 763; the Tang never fully recovers.'),
  ],

  song_found: [
    year(959), title('北宋建立', 'Founding of the Song', '960年 · 陈桥兵变', '960 · the Chenqiao mutiny'), fly(114.4, 34.95, 14),
    { do: 'army', pts: [[114.62, 35.1], [114.5, 34.98], [114.35, 34.82]], color: RED, dur: 3, count: 24, unit: 'horse', label: lbl('赵匡胤', 'Zhao Kuangyin') },
    banner(114.62, 35.1, '黄袍加身', 'The yellow robe', '#d4ac0d', lbl('陈桥驿', 'Chenqiao')),
    { do: 'spawn', lon: 114.31, lat: 34.8, model: { kind: 'palace', hero: 'capitals/cap_song' }, label: lbl('东京开封府', 'Kaifeng') },
    wipe(960, 114.31, 34.8, RED),
    cap('960年，赵匡胤陈桥兵变，黄袍加身，建立宋朝。', '960: Zhao Kuangyin is proclaimed emperor at Chenqiao and founds the Song.'),
    fly(110, 36, 52, 0.84), year(1100), { do: 'highlight', polity: 'bsong', dur: 3 },
    cap('北宋与辽、西夏并立。', 'The Northern Song coexists with Liao and Western Xia.'),
  ],

  jingkang: [
    year(1126), title('靖康之变', 'The Jingkang Incident', '1127年 · 北宋灭亡', '1127 · fall of the Northern Song'), fly(116, 36, 40, 0.85),
    { do: 'army', pts: [[116.4, 39.9], [115.9, 38.3], [115.2, 36.6], [114.5, 35.3]], color: '#b7950b', dur: 4.5, count: 50, unit: 'horse', label: lbl('金军铁骑', 'Jin cavalry'), follow: true },
    { do: 'clash', lon: 114.31, lat: 34.85, a: '#b7950b', b: '#2471a3', winner: 'a', siege: true, angle: 90, dur: 5, count: 26, labels: [lbl('金', 'Jin'), lbl('宋', 'Song')], units: ['horse', 'foot'] },
    { do: 'fx', lon: 114.31, lat: 34.8, fx: 'fire', dur: 4, par: true },
    banner(114.31, 34.8, '靖康之耻', 'The Jingkang humiliation', '#7b241c', lbl('徽钦二帝被掳', 'two emperors carried off')),
    year(1127), cap('1127年金军攻破开封，北宋灭亡。', '1127: the Jin sack Kaifeng; the Northern Song ends.'),
    { do: 'army', pts: [[115.6, 34.4], [117.5, 32.5], [118.78, 32.06], [120.16, 30.27]], color: '#2471a3', dur: 4, count: 14, retreat: true, label: lbl('宋室南渡', 'The court flees south') },
    year(1142), { do: 'highlight', polity: 'nsong', dur: 3 },
    cap('南宋定都临安，宋金以淮河—大散关为界。', 'The Southern Song settles at Lin’an; the Huai River becomes the border.'),
  ],

  genghis: [
    year(1206), title('蒙古崛起', 'Rise of the Mongols', '1206—1279年', '1206–1279'), fly(108, 45, 50, 0.85),
    { do: 'spawn', lon: 109.0, lat: 48.0, model: { kind: 'yurt' }, label: lbl('斡难河源', 'Onon River') },
    banner(109.0, 48.0, '成吉思汗', 'Genghis Khan', '#1e8449', lbl('1206年 统一蒙古', '1206 · the Mongols united')),
    cap('1206年，铁木真统一蒙古各部，号成吉思汗。', '1206: Temüjin unites the Mongols as Genghis Khan.'),
    { do: 'army', pts: [[109.0, 48.0], [107.5, 44.5], [106.6, 41.5], [106.3, 38.7]], color: '#1e8449', dur: 4, count: 50, unit: 'horse', label: lbl('蒙古铁骑', 'Mongol horse'), follow: true },
    { do: 'clash', lon: 106.23, lat: 38.49, a: '#1e8449', b: '#a04000', winner: 'a', siege: true, angle: 90, dur: 4, count: 22, units: ['horse', 'mixed'] },
    year(1227), banner(106.23, 38.49, '西夏亡', 'Western Xia falls', '#1e8449', lbl('1227年', '1227')),
    { do: 'army', pts: [[109.0, 48.0], [112.5, 44.0], [115.0, 40.5], [116.6, 37.0], [117.4, 34.5]], color: '#1e8449', dur: 4.5, count: 50, unit: 'horse', follow: true },
    { do: 'clash', lon: 117.5, lat: 34.3, a: '#1e8449', b: '#b7950b', winner: 'a', angle: 90, dur: 4, count: 22, units: ['horse', 'mixed'], formations: ['wings', 'circle'] },
    year(1234), banner(117.5, 34.3, '金亡', 'Jin falls', '#1e8449', lbl('1234年', '1234')),
    fly(112, 32, 52, 0.84),
    { do: 'fleet', pts: [[114.2, 22.0], [113.4, 21.9], [113.08, 22.1]], model: 'warship', color: '#2471a3', count: 6, dur: 3, label: lbl('崖山', 'Yamen') },
    { do: 'fx', lon: 113.08, lat: 22.1, fx: 'fire', dur: 3, par: true },
    wipe(1280, 116.4, 39.9, '#1e8449', 4),
    year(1330), { do: 'highlight', polity: 'yuan', dur: 3, par: true }, orbit(30, 4, true),
    cap('1279年崖山海战后南宋灭亡，元朝疆域空前辽阔。', '1279: the Song’s last stand at Yamen; the Yuan becomes the largest empire China had seen.', 4),
  ],

  zhenghe: [
    year(1405), title('郑和下西洋', 'Zheng He’s Voyages', '1405—1433年 · 七下西洋', '1405–1433 · seven voyages'), fly(118, 25, 36, 0.84),
    cap('1405年，郑和率二百余艘船、两万七千余人从刘家港起航。', '1405: Zheng He sails from Liujiagang with over 200 ships and 27,000 men.'),
    { do: 'fleet', model: 'junk', dur: 14, color: '#d4ac0d', count: 7, keep: true, follow: true, label: lbl('郑和宝船', 'Treasure fleet'),
      pts: [[121.1, 31.6], [122.5, 29.5], [119.9, 25.9], [117.0, 22.5], [112.0, 17.5], [109.2, 13.8], [106.5, 8.5],
        [104.5, 3.2], [102.25, 2.2], [99.5, 4.2], [95.3, 5.8], [88.0, 6.0], [81.5, 5.8], [80.2, 6.0], [77.0, 8.0], [75.78, 11.25]] },
    { do: 'spawn', lon: 75.78, lat: 11.25, model: { kind: 'flag' }, label: lbl('古里', 'Calicut') },
    banner(75.78, 11.25, '古里', 'Calicut', '#d4ac0d', lbl('“西洋大国”', 'the great port of the western ocean')),
    fly(100, 20, 54, 0.84, 2.4),
    year(1433),
    cap('28年间七下西洋，最远到达非洲东海岸和红海沿岸。', 'Seven voyages in 28 years, reaching East Africa and the Red Sea.', 4),
  ],

  ming_wall: [
    title('明长城', 'The Ming Great Wall', '万里长城', 'ten thousand li'), year(1570), fly(108, 39.5, 50, 0.8),
    cap('明朝为防御蒙古，大规模修筑长城。', 'The Ming rebuild the wall against the Mongols.'),
    { do: 'build', kind: 'wall', dur: 7, pts: [[98.3, 39.8], [100.6, 39.1], [102.6, 38.4], [103.9, 37.5], [104.8, 37.7], [106.2, 38.6], [107.6, 37.7],
      [109.7, 38.4], [111.1, 39.2], [112.4, 40.0], [113.3, 40.4], [114.9, 41.0], [116.4, 40.7], [117.6, 40.5], [118.9, 40.3], [119.75, 40.0],
      [120.5, 41.5], [122.0, 42.5], [123.6, 42.8], [124.6, 42.3], [125.5, 41.3], [124.4, 40.0]] },
    { do: 'spawn', lon: 98.21, lat: 39.8, model: { kind: 'gate', hero: 'sites-b/st_jiayuguan' }, label: lbl('嘉峪关', 'Jiayu Pass') },
    { do: 'spawn', lon: 119.75, lat: 40.0, model: { kind: 'gate', hero: 'sites-b/st_shanhaiguan' }, label: lbl('山海关', 'Shanhai Pass') },
    cap('西起嘉峪关，东至鸭绿江。', 'From Jiayu Pass to the Yalu River.'),
    orbit(35, 4),
  ],

  zheng_chenggong: [
    year(1661), title('郑成功收复台湾', 'Zheng Chenggong Recovers Taiwan', '1661—1662年', '1661–1662'), fly(119.6, 23.8, 16, 0.9),
    cap('1661年，郑成功率军从金门出发，横渡台湾海峡。', '1661: Zheng Chenggong crosses the Taiwan Strait from Kinmen.'),
    { do: 'fleet', model: 'warship', dur: 5, color: '#a04000', count: 7, follow: true, label: lbl('郑军水师', 'Zheng’s fleet'), pts: [[118.35, 24.45], [118.9, 24.0], [119.55, 23.6], [120.05, 23.1]] },
    { do: 'clash', lon: 120.22, lat: 23.0, a: '#a04000', b: '#e67e22', winner: 'a', siege: true, angle: 270, dur: 5, count: 20, labels: [lbl('郑成功', 'Zheng'), lbl('荷兰', 'Dutch')] },
    year(1662), { do: 'fx', lon: 120.2, lat: 22.99, fx: 'flag', color: '#a04000' },
    banner(120.2, 22.99, '收复台湾', 'Taiwan recovered', '#a04000', lbl('1662年', '1662')),
    cap('1662年荷兰殖民者投降，台湾回到祖国怀抱。', '1662: the Dutch surrender and Taiwan is recovered.'),
  ],

  yaksa: [
    year(1685), title('雅克萨之战', 'Siege of Albazin', '1685—1686年', '1685–1686'), fly(124.8, 51.8, 22),
    cap('沙俄侵占雅克萨，康熙帝派兵反击。', 'Russia occupies Albazin; the Kangxi Emperor strikes back.'),
    { do: 'army', pts: [[127.5, 50.2], [126.2, 51.6], [124.9, 52.9], [124.35, 53.3]], color: '#a569bd', dur: 4, count: 30, unit: 'mixed', label: lbl('清军', 'Qing'), follow: true },
    { do: 'clash', lon: 124.2, lat: 53.4, a: '#a569bd', b: '#566573', winner: 'a', siege: true, angle: 200, dur: 5, count: 20, labels: [lbl('清军', 'Qing'), lbl('沙俄', 'Russia')] },
    year(1689), { do: 'spawn', lon: 116.6, lat: 51.98, model: { kind: 'scroll' }, label: lbl('尼布楚', 'Nerchinsk') },
    banner(116.6, 51.98, '《尼布楚条约》', 'Treaty of Nerchinsk', '#a569bd', lbl('1689年', '1689')),
    cap('1689年签订《尼布楚条约》，划定中俄东段边界。', '1689: the Treaty of Nerchinsk fixes the eastern border.'),
  ],

  humen: [
    title('虎门销烟', 'Destruction of Opium at Humen', '1839年6月', 'June 1839'), year(1839), fly(113.67, 22.82, 8, 0.95),
    { do: 'spawn', lon: 113.67, lat: 22.82, model: { kind: 'cannon' }, label: lbl('虎门', 'Humen') },
    cap('1839年6月，林则徐在虎门海滩当众销毁鸦片。', 'June 1839: Lin Zexu destroys the opium on the beach at Humen.'),
    { do: 'fx', lon: 113.67, lat: 22.82, fx: 'smoke', dur: 5 },
    cap('历时23天，销毁鸦片两百多万斤。', 'Over 23 days more than 1,000 tonnes are destroyed.'),
    orbit(45, 4),
  ],

  opium_war: [
    year(1840), title('鸦片战争', 'The Opium War', '1840—1842年 · 中国近代史的开端', '1840–1842 · the start of modern Chinese history'), fly(118, 28, 38, 0.85),
    cap('1840年6月，英国舰队封锁珠江口，鸦片战争爆发。', 'June 1840: a British fleet blockades the Pearl River; the Opium War begins.'),
    { do: 'fleet', model: 'warship', dur: 8, color: '#566573', count: 6, keep: true, follow: true, label: lbl('英国舰队', 'British fleet'),
      pts: [[114.2, 22.0], [117.5, 23.0], [120.0, 25.5], [122.1, 29.8]] },
    { do: 'fx', lon: 122.1, lat: 30.0, fx: 'battle', dur: 2.5 },
    banner(122.1, 30.0, '定海失陷', 'Dinghai falls', '#566573'),
    year(1842),
    { do: 'fleet', model: 'warship', dur: 5, color: '#566573', count: 5, pts: [[122.0, 31.3], [121.4, 31.5], [120.3, 31.95], [119.4, 32.2], [118.85, 32.1]] },
    { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'scroll' }, label: lbl('《南京条约》', 'Treaty of Nanking') },
    banner(118.78, 32.06, '《南京条约》', 'Treaty of Nanking', '#7b241c', lbl('中国第一个不平等条约', 'China’s first unequal treaty')),
    { do: 'fx', lon: 114.17, lat: 22.32, fx: 'flag', color: '#566573' },
    cap('1842年《南京条约》：割香港岛、赔款、五口通商、协定关税。', '1842 Treaty of Nanking: Hong Kong ceded, indemnity, five ports, fixed tariffs.', 4.5),
  ],

  yuanmingyuan: [
    year(1860), title('火烧圆明园', 'Burning of the Old Summer Palace', '1860年10月', 'October 1860'), fly(117, 39.5, 16),
    { do: 'army', pts: [[117.7, 38.98], [117.3, 39.3], [116.8, 39.75], [116.35, 39.98]], color: '#566573', dur: 4, count: 30, unit: 'mixed', label: lbl('英法联军', 'Anglo-French force'), follow: true },
    { do: 'spawn', lon: 116.3, lat: 40.01, model: { kind: 'palace', hero: 'sites-b/st_yuanmingyuan' }, label: lbl('圆明园', 'Yuanmingyuan') },
    { do: 'fx', lon: 116.3, lat: 40.01, fx: 'fire', dur: 6, par: true },
    banner(116.3, 40.01, '万园之园', 'Garden of gardens', '#7b241c', lbl('毁于一炬', 'reduced to ashes')),
    orbit(40, 4, true),
    cap('1860年10月，英法联军洗劫并焚毁圆明园。', 'October 1860: Anglo-French troops loot and burn the Old Summer Palace.', 4),
  ],

  russia_land: [
    title('沙俄侵占中国领土', 'Russian Annexations', '1858—1864年', '1858–1864'), year(1857), fly(124, 44, 48, 0.85),
    cap('第二次鸦片战争期间，沙俄趁火打劫。', 'During the Second Opium War, Russia seizes its chance.'),
    year(1901), { do: 'highlight', polity: 'russia', dur: 4 },
    cap('通过不平等条约割占中国东北和西北领土150多万平方千米。', 'Unequal treaties take over 1.5 million km² in the north-east and north-west.', 4),
  ],

  jiawu: [
    year(1894), title('甲午中日战争', 'First Sino-Japanese War', '1894—1895年', '1894–1895'), fly(122.6, 38.6, 22, 0.85),
    cap('1894年9月黄海海战，北洋舰队与日本联合舰队激战。', 'September 1894: the Beiyang Fleet meets the Japanese fleet in the Yellow Sea.'),
    { do: 'fleet', model: 'warship', dur: 4, color: '#a569bd', count: 6, label: lbl('北洋舰队', 'Beiyang Fleet'), pts: [[121.6, 38.8], [122.2, 39.1], [122.85, 39.0]], par: true },
    { do: 'fleet', model: 'warship', dur: 4, color: JP, count: 6, label: lbl('日本联合舰队', 'Japanese fleet'), pts: [[124.5, 37.6], [123.8, 38.3], [123.25, 38.85]] },
    { do: 'fx', lon: 123.05, lat: 38.95, fx: 'battle', dur: 3.5, par: true },
    { do: 'fx', lon: 122.95, lat: 38.9, fx: 'fire', dur: 3.5, par: true },
    banner(123.0, 38.95, '黄海海战', 'Battle of the Yalu', '#a569bd', lbl('邓世昌与“致远”舰', 'Deng Shichang and the Zhiyuan')),
    orbit(30, 3.5),
    cap('“致远”舰管带邓世昌壮烈殉国。', 'Captain Deng Shichang of the Zhiyuan dies heroically.'),
    year(1895), fly(122.12, 37.51, 14, 0.88), { do: 'fx', lon: 122.12, lat: 37.51, fx: 'smoke', dur: 3 },
    cap('1895年北洋舰队在威海卫全军覆没，清政府被迫签订《马关条约》。', '1895: the Beiyang Fleet is destroyed at Weihaiwei; the Treaty of Shimonoseki follows.'),
  ],

  wuchang: [
    year(1911), title('辛亥革命', 'The 1911 Revolution', '1911年10月10日 · 武昌起义', '10 October 1911 · the Wuchang Uprising'), fly(114.3, 30.6, 12, 0.9),
    { do: 'clash', lon: 114.3, lat: 30.56, a: '#c0392b', b: '#d4ac0d', winner: 'a', siege: true, angle: 270, dur: 5, count: 22, labels: [lbl('新军', 'New Army'), lbl('清军', 'Qing')] },
    { do: 'fx', lon: 114.3, lat: 30.59, fx: 'flag', color: '#c0392b' },
    banner(114.3, 30.59, '武昌起义', 'Wuchang Uprising', '#c0392b', lbl('首义之区', 'where it began')),
    fly(112, 30, 50, 0.85),
    ...([[112.94, 28.23], [108.94, 34.27], [115.86, 28.68], [112.55, 37.87], [102.83, 24.88], [121.47, 31.23], [106.7, 26.6],
      [120.16, 30.27], [108.3, 22.8], [117.3, 31.9], [113.26, 23.13], [119.3, 26.08], [104.07, 30.67]] as LonLat[])
      .map(([lon, lat]): StoryStep => ({ do: 'fx', lon, lat, fx: 'flag', color: '#c0392b', par: true })),
    { do: 'wait', dur: 2 },
    cap('一个多月内十几个省宣布独立，清朝统治土崩瓦解。', 'Within weeks over a dozen provinces declare independence.'),
    wipe(1912, 118.78, 32.06, '#c0392b', 4),
    { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'flag' }, label: lbl('南京临时政府', 'Nanjing Provisional Government') },
    cap('1912年1月1日中华民国成立，两千多年的君主专制制度结束。', '1 January 1912: the Republic of China is founded, ending two thousand years of monarchy.', 4),
  ],

  may4: [
    title('五四运动', 'The May Fourth Movement', '1919年5月4日', '4 May 1919'), year(1919), fly(116.39, 39.9, 8, 0.95),
    { do: 'spawn', lon: 116.39, lat: 39.905, model: { kind: 'gate', style: 'tiananmen' }, label: lbl('天安门', 'Tiananmen') },
    { do: 'fx', lon: 116.39, lat: 39.9, fx: 'flag', color: '#ecf0f1' },
    cap('1919年5月4日，北京学生在天安门前集会游行。', '4 May 1919: Beijing students rally at Tiananmen.'),
    fly(118.8, 35.0, 40, 0.85),
    { do: 'fx', lon: 121.47, lat: 31.23, fx: 'flag', color: '#c0392b' },
    cap('6月，上海工人罢工，运动中心转向上海。', 'In June Shanghai workers strike and the movement’s centre moves to Shanghai.'),
  ],

  cpc_found: [
    title('中国共产党成立', 'Founding of the CPC', '1921年7月', 'July 1921'), year(1921), fly(121.1, 31.0, 8, 0.95),
    { do: 'spawn', lon: 121.47, lat: 31.23, model: { kind: 'monument', style: 'shikumen' }, label: lbl('中共一大会址', 'Site of the 1st Congress') },
    cap('1921年7月，中共一大在上海召开。', 'July 1921: the CPC’s First Congress opens in Shanghai.'),
    { do: 'route', dur: 3, color: '#c0392b', dashed: true, pts: [[121.47, 31.23], [121.0, 31.0], [120.75, 30.75]] },
    { do: 'spawn', lon: 120.75, lat: 30.75, model: { kind: 'redboat' }, label: lbl('南湖红船', 'The Red Boat') },
    cap('会议最后一天转移到嘉兴南湖的游船上，宣告中国共产党成立。', 'The final session moves to a boat on South Lake, Jiaxing: the Party is founded.', 4),
  ],

  beifa: [
    year(1926), title('北伐战争', 'The Northern Expedition', '1926—1928年', '1926–1928'), fly(114, 27, 44, 0.85),
    cap('1926年7月，国民革命军从广州出师北伐。', 'July 1926: the National Revolutionary Army marches north from Guangzhou.'),
    { do: 'army', pts: [[113.26, 23.13], [113.0, 25.5], [112.94, 28.23], [113.6, 29.6], [114.2, 30.4]], color: '#2e86c1', dur: 5, count: 36, label: lbl('国民革命军', 'National Revolutionary Army'), follow: true },
    { do: 'clash', lon: 114.3, lat: 30.56, a: '#2e86c1', b: '#7f8c8d', winner: 'a', siege: true, angle: 270, dur: 5, count: 24, labels: [lbl('叶挺独立团', 'Ye Ting’s regiment'), lbl('吴佩孚', 'Wu Peifu')] },
    banner(114.3, 30.59, '铁军', 'The Iron Army', '#2e86c1'),
    cap('叶挺独立团攻克武昌，被誉为“铁军”。', 'Ye Ting’s regiment takes Wuchang: the “Iron Army”.'),
    { do: 'army', from: [113.26, 23.13], to: [115.86, 28.68], color: '#2e86c1', dur: 2.5, count: 20, par: true },
    { do: 'army', from: [115.86, 28.68], to: [118.78, 32.06], color: '#2e86c1', dur: 2.5, count: 20 },
  ],

  long_march: [
    year(1934), title('红军长征', 'The Long March', '1934—1936年 · 二万五千里', '1934–1936 · 12,500 km'), fly(108, 27, 40, 0.85),
    cap('1934年10月，中央红军从瑞金出发长征。', 'October 1934: the Central Red Army leaves Ruijin.'),
    { do: 'army', color: '#c0392b', dur: 5, count: 30, keep: true, follow: true, label: lbl('中央红军', 'Central Red Army'),
      pts: [[116.03, 25.89], [114.6, 25.3], [112.5, 25.4], [110.9, 25.7], [109.6, 26.2], [108.3, 26.6], [106.93, 27.73]] },
    year(1935), { do: 'spawn', lon: 106.93, lat: 27.73, model: { kind: 'monument', style: 'zunyi' }, label: lbl('遵义会议', 'Zunyi Conference') },
    banner(106.93, 27.73, '遵义会议', 'Zunyi Conference', '#c0392b', lbl('生死攸关的转折点', 'a life-or-death turning point')),
    cap('1935年1月遵义会议，党的历史上生死攸关的转折点。', 'January 1935: the Zunyi Conference, a life-or-death turning point.'),
    { do: 'army', color: '#c0392b', dur: 4.5, count: 26, keep: true, follow: true,
      pts: [[106.93, 27.73], [105.7, 28.4], [106.2, 27.9], [105.6, 28.3], [106.5, 27.0], [105.0, 26.0], [103.5, 25.8], [102.6, 26.1]] },
    cap('四渡赤水、巧渡金沙江', 'Four crossings of the Chishui; across the Jinsha', 2.2),
    { do: 'army', color: '#c0392b', dur: 3, count: 24, keep: true, follow: true, pts: [[102.6, 26.1], [102.2, 27.9], [102.3, 29.3], [102.2, 29.88]] },
    { do: 'clash', lon: 102.23, lat: 29.92, a: '#c0392b', b: '#2e86c1', winner: 'a', angle: 270, dur: 4, count: 14 },
    banner(102.23, 29.92, '飞夺泸定桥', 'Seizing the Luding Bridge', '#c0392b'),
    cap('强渡大渡河、飞夺泸定桥', 'Across the Dadu; seizing the Luding Bridge', 2.2),
    { do: 'army', color: '#c0392b', dur: 6, count: 22, keep: true, follow: true,
      pts: [[102.23, 29.92], [102.7, 30.8], [102.4, 31.9], [102.8, 33.0], [103.4, 33.9], [103.9, 34.1], [105.7, 35.5], [107.0, 36.4], [108.17, 36.93]] },
    cap('爬雪山、过草地，1935年10月到达陕北吴起镇。', 'Over snow mountains and grasslands to Wuqi, northern Shaanxi (October 1935).'),
    year(1936), fly(106, 31, 52, 0.85), { do: 'fx', lon: 105.05, lat: 35.7, fx: 'flag', color: '#c0392b' },
    banner(105.05, 35.7, '会宁会师', 'Reunion at Huining', '#c0392b', lbl('1936年10月', 'October 1936')),
    orbit(30, 4, true),
    cap('1936年10月，红军三大主力会宁会师，长征胜利结束。', 'October 1936: the three Red Armies meet at Huining. The Long March is over.', 4),
  ],

  sept18: [
    year(1931), title('九一八事变', 'The Mukden Incident', '1931年9月18日', '18 September 1931'), fly(123.6, 42.5, 22, 0.85),
    { do: 'fx', lon: 123.43, lat: 41.85, fx: 'battle', dur: 2.5 },
    banner(123.43, 41.85, '北大营', 'Beidaying', JP, lbl('柳条湖事件', 'the Liutiao Lake incident')),
    cap('1931年9月18日夜，日军炮轰沈阳北大营。', 'Night of 18 September 1931: Japanese troops attack the Beidaying barracks in Shenyang.'),
    fly(125, 44, 40, 0.85, 1.6),
    { do: 'army', from: [123.43, 41.8], to: [125.32, 43.82], color: JP, dur: 3, count: 26, unit: 'mixed', label: lbl('日军', 'Japanese army'), par: true },
    { do: 'army', from: [123.43, 41.8], to: [126.63, 45.75], color: JP, dur: 4, count: 26, unit: 'mixed' },
    cap('不到半年，东北三省全部沦陷。', 'Within months all three north-eastern provinces fall.'),
  ],

  july7: [
    year(1936), title('七七事变', 'The Marco Polo Bridge Incident', '1937年7月7日 · 全民族抗战开始', '7 July 1937 · the War of Resistance begins'), fly(116.21, 39.85, 7, 0.95),
    { do: 'spawn', lon: 116.21, lat: 39.85, model: { kind: 'bridge', style: 'lugou' }, label: lbl('卢沟桥', 'Marco Polo Bridge') },
    { do: 'clash', lon: 116.23, lat: 39.85, a: '#2e86c1', b: JP, angle: 270, dur: 5, count: 18, labels: [lbl('第29军', '29th Army'), lbl('日军', 'Japanese')] },
    banner(116.21, 39.85, '卢沟桥', 'Marco Polo Bridge', '#7b241c', lbl('“卢沟桥即其坟墓”', '“Lugou Bridge shall be our grave”')),
    cap('1937年7月7日，日军炮轰宛平城，中国守军奋起抵抗。', '7 July 1937: Japanese guns shell Wanping and Chinese troops fight back.'),
    fly(112, 34, 52, 0.85),
    wipe(1937, 116.21, 39.85, JP, 4.5),
    { do: 'highlight', polity: 'jp_occ', dur: 3 },
    cap('日本发动全面侵华战争，全民族抗战开始。', 'Japan launches full-scale invasion; the whole nation rises in resistance.'),
  ],

  sanda: [
    year(1948), title('三大战役', 'The Three Great Campaigns', '1948年9月—1949年1月', 'Sep 1948 – Jan 1949'), fly(121, 41.5, 30, 0.85),
    { do: 'army', from: [125.32, 43.82], to: [121.25, 41.2], color: PLA, dur: 3.5, count: 40, unit: 'mixed', label: lbl('东北野战军', 'Northeast Field Army'), follow: true },
    { do: 'clash', lon: 121.1, lat: 41.1, a: PLA, b: '#2e86c1', winner: 'a', angle: 120, dur: 4, count: 22 },
    banner(121.1, 41.1, '辽沈战役', 'Liaoshen', PLA, lbl('1948年9—11月', 'Sep–Nov 1948')),
    fly(117.2, 34.3, 26, 0.85),
    { do: 'army', from: [116.0, 36.0], to: [117.1, 34.45], color: PLA, dur: 3, count: 30, label: lbl('华东野战军', 'East China FA'), par: true },
    { do: 'army', from: [114.0, 33.0], to: [116.95, 34.2], color: PLA, dur: 3, count: 30, label: lbl('中原野战军', 'Central Plains FA') },
    { do: 'clash', lon: 117.18, lat: 34.26, a: PLA, b: '#2e86c1', winner: 'a', angle: 200, dur: 4, count: 24 },
    banner(117.18, 34.26, '淮海战役', 'Huaihai', PLA, lbl('1948年11月—1949年1月', 'Nov 1948 – Jan 1949')),
    fly(117, 39.6, 22, 0.85),
    { do: 'army', from: [119.75, 40.0], to: [117.35, 39.2], color: PLA, dur: 3, count: 30, unit: 'mixed' },
    { do: 'clash', lon: 117.2, lat: 39.13, a: PLA, b: '#2e86c1', winner: 'a', siege: true, angle: 160, dur: 3.5, count: 20 },
    year(1949), { do: 'fx', lon: 116.4, lat: 39.9, fx: 'flag', color: PLA },
    banner(116.4, 39.9, '平津战役', 'Pingjin', PLA, lbl('北平和平解放', 'Beiping liberated peacefully')),
    cap('平津战役：天津解放，北平和平解放。', 'Pingjin: Tianjin is taken and Beiping liberated peacefully.'),
  ],

  dujiang: [
    year(1948), title('渡江战役', 'Crossing the Yangtze', '1949年4月21日', '21 April 1949'), fly(118.5, 31.5, 22, 0.88),
    cap('1949年4月21日，人民解放军百万雄师横渡长江。', '21 April 1949: a million soldiers cross the Yangtze.'),
    ...([[[116.9, 30.95], [117.4, 30.4]], [[117.8, 31.45], [118.2, 31.0]], [[118.5, 32.05], [118.7, 31.7]], [[119.4, 32.45], [119.5, 32.05]],
      [[120.2, 32.15], [120.3, 31.85]]] as [LonLat, LonLat][])
      .map(([from, to]): StoryStep => ({ do: 'fleet', model: 'boat', dur: 3.5, color: PLA, count: 4, pts: [from, to], par: true })),
    { do: 'wait', dur: 3.6 },
    { do: 'fx', lon: 118.78, lat: 32.06, fx: 'flag', color: PLA },
    banner(118.78, 32.06, '解放南京', 'Nanjing liberated', PLA, lbl('4月23日', '23 April')),
    fly(114, 33, 52, 0.85),
    wipe(1949, 118.78, 32.06, PLA, 4),
    cap('4月23日南京解放，国民党在大陆的统治宣告结束。', 'Nanjing is taken on 23 April; Nationalist rule on the mainland ends.'),
  ],

  founding: [
    year(1949), title('开国大典', 'The Founding Ceremony', '1949年10月1日', '1 October 1949'), fly(116.39, 39.9, 5, 0.97),
    { do: 'spawn', lon: 116.391, lat: 39.907, model: { kind: 'gate', style: 'tiananmen' }, label: lbl('天安门', 'Tiananmen') },
    cap('1949年10月1日下午3时，开国大典在天安门广场隆重举行。', '3 p.m., 1 October 1949: the founding ceremony at Tiananmen Square.'),
    { do: 'fx', lon: 116.391, lat: 39.905, fx: 'flag', color: '#de2910' },
    banner(116.391, 39.907, '中华人民共和国成立了', 'The People’s Republic is founded', '#de2910'),
    orbit(60, 7, true),
    { do: 'fx', lon: 116.38, lat: 39.92, fx: 'firework', color: '#f1c40f', par: true },
    { do: 'fx', lon: 116.40, lat: 39.92, fx: 'firework', color: '#e74c3c', par: true },
    { do: 'fx', lon: 116.39, lat: 39.93, fx: 'firework', color: '#ecf0f1' },
    cap('中华人民共和国成立。', 'The People’s Republic of China is founded.', 4),
  ],

  kangmei: [
    year(1950), title('抗美援朝', 'The Korean War', '1950—1953年', '1950–1953'), fly(125.8, 40, 26, 0.85),
    { do: 'army', pts: [[124.4, 40.6], [124.9, 40.1], [125.4, 39.6], [125.75, 39.1]], color: PLA, dur: 4, count: 40, label: lbl('中国人民志愿军', 'Chinese People’s Volunteers'), follow: true },
    cap('1950年10月，中国人民志愿军跨过鸭绿江。', 'October 1950: the Chinese People’s Volunteers cross the Yalu.'),
    { do: 'clash', lon: 126.2, lat: 39.3, a: PLA, b: '#1f4e79', winner: 'a', angle: 120, dur: 5, count: 26, labels: [lbl('志愿军', 'Volunteers'), lbl('“联合国军”', '“UN Command”')], formations: ['wings', 'line'] },
    banner(127.5, 38.3, '三八线', '38th parallel', '#7f8c8d'),
    year(1953), cap('1953年7月签订停战协定。', 'An armistice is signed in July 1953.'),
  ],

  shenzhen: [
    title('改革开放', 'Reform and Opening Up', '经济特区', 'special economic zones'), year(1979), fly(114.06, 22.54, 6, 0.9),
    { do: 'spawn', lon: 114.06, lat: 22.54, model: { kind: 'hut', hero: 'sites-b/st_shenzhen79' }, scale: 0.8, label: lbl('深圳（1979）', 'Shenzhen (1979)') },
    cap('1980年，深圳从一个边陲小镇成为经济特区。', '1980: the border town of Shenzhen becomes a Special Economic Zone.'),
    year(2000), { do: 'spawn', lon: 114.06, lat: 22.54, model: { kind: 'skyline', style: 'shenzhen' }, label: lbl('深圳', 'Shenzhen') },
    { do: 'fx', lon: 114.06, lat: 22.54, fx: 'glow', color: '#f1c40f', dur: 3 },
    cap('“深圳速度”：一座现代化大都市拔地而起。', '“Shenzhen speed”: a modern metropolis rises.'),
    orbit(50, 5),
  ],

  hk_return: [
    title('香港回归', 'Return of Hong Kong', '1997年7月1日', '1 July 1997'), year(1996), fly(114.17, 22.32, 6, 0.92),
    cap('1997年6月30日午夜，香港会议展览中心。', 'Midnight, 30 June 1997: the Hong Kong Convention Centre.'),
    year(1997),
    { do: 'fx', lon: 114.17, lat: 22.29, fx: 'flag', color: '#de2910' },
    { do: 'highlight', polity: 'prc', dur: 3, par: true },
    { do: 'fx', lon: 114.17, lat: 22.32, fx: 'firework', color: '#e74c3c' },
    cap('1997年7月1日，中国政府对香港恢复行使主权。', '1 July 1997: China resumes sovereignty over Hong Kong.', 4),
  ],

  macao_return: [
    title('澳门回归', 'Return of Macao', '1999年12月20日', '20 December 1999'), year(1998), fly(113.54, 22.19, 5, 0.92),
    year(1999),
    { do: 'fx', lon: 113.54, lat: 22.19, fx: 'flag', color: '#de2910' },
    { do: 'fx', lon: 113.55, lat: 22.2, fx: 'firework', color: '#2ecc71' },
    cap('1999年12月20日，澳门回归祖国。', '20 December 1999: Macao returns to China.'),
  ],

  liangdan: [
    title('两弹一星', 'Bombs and a Satellite', '1964—1970年', '1964–1970'), year(1964), fly(90.25, 40.6, 14, 0.85),
    { do: 'fx', lon: 90.25, lat: 40.6, fx: 'glow', color: '#f5b041', dur: 2.5 },
    { do: 'fx', lon: 90.25, lat: 40.6, fx: 'smoke', dur: 3 },
    cap('1964年10月16日，第一颗原子弹在罗布泊爆炸成功。', '16 October 1964: China’s first atomic bomb at Lop Nur.'),
    year(1970), fly(100.28, 40.96, 10, 0.85),
    { do: 'spawn', lon: 100.28, lat: 40.96, model: { kind: 'rocket' }, label: lbl('东方红一号', 'Dongfanghong-1') },
    cap('1970年4月24日，“东方红一号”卫星发射成功。', '24 April 1970: the Dongfanghong-1 satellite is launched.'),
  ],

  shenzhou5: [
    title('神舟五号', 'Shenzhou 5', '2003年10月15日', '15 October 2003'), year(2003), fly(100.28, 40.96, 6, 0.85),
    { do: 'spawn', lon: 100.28, lat: 40.96, model: { kind: 'rocket', style: 'cz2f' }, scale: 1.4, label: lbl('神舟五号', 'Shenzhou 5') },
    { do: 'fx', lon: 100.28, lat: 40.96, fx: 'smoke', dur: 4 },
    cap('2003年10月15日，杨利伟乘神舟五号飞向太空。', '15 October 2003: Yang Liwei rides Shenzhou 5 into space.', 4),
    orbit(40, 4),
  ],
};

const hue = (id: string, salt = 0): number => { let h = salt; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const SIDES = ['#8e2b20', '#2e5e8b', '#5b2c6f', '#1e8449', '#b7950b', '#7f8c8d', '#a04000', '#117a65'];

/**
 * Default animation, shaped by the kind of event: wars get two armies and a pitched battle, political turns a seat of
 * power and a banner, culture and science a model the camera circles. Used by all events without a script.
 */
export function autoStory(e: {
  id?: string; year: Year; end?: Year; lon: number; lat: number; weight: number; kind?: string; model?: { kind: string };
  title: I18n; summary: I18n;
}): StoryStep[] {
  const close = e.weight === 1 ? 12 : 15;
  const id = e.id ?? `${e.year}${e.title.zh}`;
  const when = { zh: formatYear(e.year, 'zh') + (e.end && e.end !== e.year ? `—${formatYear(e.end, 'zh')}` : ''),
    en: formatYear(e.year, 'en') + (e.end && e.end !== e.year ? `–${formatYear(e.end, 'en')}` : '') };
  const steps: StoryStep[] = [
    { do: 'year', year: e.year },
    { do: 'title', text: e.title, sub: when, dur: 2.6, par: true },
  ];
  const model = e.model ? [{ do: 'spawn', lon: e.lon, lat: e.lat, model: e.model, label: e.title } as StoryStep] : [];
  const say: StoryStep = { do: 'caption', text: e.summary, dur: 5 };
  switch (e.kind) {
    case 'war': {
      const h = hue(id), a = SIDES[h % SIDES.length], b = SIDES[(h >> 3) % SIDES.length] === a ? '#566573' : SIDES[(h >> 3) % SIDES.length];
      const ang = (h >> 6) % 360, r = (ang * Math.PI) / 180, d = 1.1;
      // A marches in from its side; the battle then plays out where the event happened
      const from: LonLat = [e.lon - Math.cos(r) * d, e.lat + Math.sin(r) * d];
      const unit: Troops = h % 3 === 0 ? 'horse' : 'mixed', foe: Troops = (['foot', 'mixed', 'archer', 'foot'] as const)[(h >> 9) % 4];
      const forms: [Formation, Formation] = [(['line', 'wedge', 'wings'] as const)[(h >> 11) % 3], (['line', 'square', 'circle', 'line'] as const)[(h >> 13) % 4]];
      steps.push(
        { do: 'fly', lon: e.lon, lat: e.lat - 0.2, dist: 20, tilt: 0.88, dur: 2 },
        { do: 'army', from, to: [e.lon - Math.cos(r) * 0.25, e.lat + Math.sin(r) * 0.25], color: a, dur: 3, count: 26, unit },
        { do: 'clash', lon: e.lon, lat: e.lat, a, b, winner: 'a', angle: ang, dur: 5.5, count: 22, units: [unit, foe], formations: forms, ...(/[攻破陷围克]/.test(e.title.zh) ? { siege: true } : {}) },
        { do: 'banner', lon: e.lon, lat: e.lat, text: e.title, color: a, dur: 5 },
        ...model, say,
      );
      break;
    }
    case 'revolution':
      steps.push(
        { do: 'fly', lon: e.lon, lat: e.lat - 0.2, dist: close, tilt: 0.9, dur: 2 }, ...model,
        { do: 'fx', lon: e.lon, lat: e.lat, fx: 'flag', color: '#c0392b' },
        { do: 'banner', lon: e.lon, lat: e.lat, text: e.title, color: '#c0392b', dur: 5 },
        { do: 'orbit', deg: 30, dur: 5, par: true }, say,
      );
      break;
    case 'politics': case 'reform': case 'diplomacy':
      steps.push(
        { do: 'fly', lon: e.lon, lat: e.lat - 0.2, dist: close, tilt: 0.9, dur: 2 },
        ...(model.length ? model : [{ do: 'spawn', lon: e.lon, lat: e.lat, model: { kind: e.kind === 'diplomacy' ? 'scroll' : 'palace' } } as StoryStep]),
        { do: 'fx', lon: e.lon, lat: e.lat, fx: 'glow', dur: 2, par: true },
        { do: 'banner', lon: e.lon, lat: e.lat, text: e.title, color: e.kind === 'diplomacy' ? '#1f5f8b' : '#7b241c', dur: 5 },
        { do: 'orbit', deg: 35, dur: 5, par: true }, say,
      );
      break;
    default:
      steps.push(
        { do: 'fly', lon: e.lon, lat: e.lat - 0.2, dist: close, tilt: 0.9, dur: 2 }, ...model,
        { do: 'fx', lon: e.lon, lat: e.lat, fx: 'glow', dur: 2, par: true },
        { do: 'orbit', deg: model.length ? 50 : 25, dur: 6, par: true }, say,
      );
  }
  return steps;
}

/**
 * Who travels on a journey: marching armies for campaigns, otherwise one traveller dressed for the period (the
 * `traveller` model takes its costume from the role and the stop's year): Zhang Qian as a Han envoy holding the 节 with
 * a pack camel, Xuanzang as a pilgrim monk on foot under a bamboo 笈, Li Bai in 软脚幞头 with sword and wine gourd, Su
 * Shi in a tall 东坡巾 on a donkey, Wang Yangming in a Ming scholar's 四方平定巾.
 */
export const TRAVELLER: Record<string, 'army' | Omit<ModelRecipe, 'kind'>> = {
  qinshihuang: { role: 'ruler', mount: 'horse', coat: '#1e1c1a', robe: '#1c1b20', trim: '#b83226', gear: 'sword' },
  zhugeliang: 'army',
  zhangqian: { role: 'scholar', mount: 'horse', coat: '#8a5a32', gear: 'jie', pack: true },
  xuanzang: { role: 'monk', mount: 'foot', gear: 'ji', robe: '#7a5c3e', trim: '#9b3a22' },
  libai: { role: 'scholar', mount: 'horse', coat: '#e6dccb', robe: '#ece6d6', trim: '#5b6472', gear: 'sword' },
  sushi: { role: 'scholar', mount: 'donkey', robe: '#5a4a3a', trim: '#2f3b45', hat: 'fangjin', gear: 'scroll' },
  wangyangming: { role: 'scholar', mount: 'horse', coat: '#5a3a22', robe: '#2f4a6b', trim: '#1f2937', hat: 'fangjin' },
};

/**
 * A journey (张骞通西域, 玄奘西行, 苏轼贬谪 …) as a 3D story: the traveller crosses the map stop by stop, leaving a
 * trail; each stop raises a banner, tells what happened there and quotes the sources.
 */
export function journeyStory(j: Journey): StoryStep[] {
  const who = TRAVELLER[j.id] ?? { role: 'scholar', mount: 'horse' };
  const st = j.stops;
  const read = (t: I18n, min = 4): number => Math.min(9, Math.max(min, t.zh.length / 15));
  const steps: StoryStep[] = [
    { do: 'year', year: st[0].year },
    { do: 'title', text: j.title, sub: j.span, dur: 3.6, par: true },
    { do: 'fly', lon: st[0].lon, lat: st[0].lat - 0.8, dist: 24, tilt: 0.86, dur: 2.6 },
  ];
  st.forEach((s, i) => {
    if (i > 0) {
      const prev = st[i - 1];
      const pts: LonLat[] = [s.from ?? [prev.lon, prev.lat], ...(s.via ?? []), [s.lon, s.lat]];
      const lons = pts.map(p => p[0]), lats = pts.map(p => p[1]);
      const span = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.8, Math.max(...lats) - Math.min(...lats));
      const dur = Math.min(7, Math.max(2.5, span * 0.6));
      steps.push({ do: 'fly', lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 - span * 0.12,
        dist: Math.min(56, Math.max(16, span * 2.2 + 10)), tilt: 0.85, dur: 2, par: true });
      if (s.year !== prev.year) steps.push({ do: 'year', year: s.year });
      steps.push(who === 'army'
        ? { do: 'army', pts, color: j.color, dur, count: 26, unit: 'mixed', keep: true, trail: true, ...(i === 1 ? { label: j.short } : {}) }
        : { do: 'route', pts, color: j.color, dur, keep: true, trail: true, model: { kind: 'traveller', year: s.year, ...who }, ...(i === 1 ? { label: j.short } : {}) });
    }
    steps.push(
      { do: 'banner', lon: s.lon, lat: s.lat, text: s.name, sub: s.title, color: j.color, dur: 6 },
      { do: 'caption', text: s.desc, dur: read(s.desc, 5) },
    );
    if (s.quote) steps.push({ do: 'caption', text: s.quote, dur: read(s.quote) });
  });
  const lons = st.map(s => s.lon), lats = st.map(s => s.lat);
  const span = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.8, Math.max(...lats) - Math.min(...lats));
  steps.push(
    { do: 'fly', lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 - span * 0.12,
      dist: Math.min(58, Math.max(24, span * 1.9 + 12)), tilt: 0.84, dur: 2.6 },
    { do: 'orbit', deg: 25, dur: 5, par: true },
    { do: 'caption', text: j.title, dur: 4 },
  );
  return steps;
}
