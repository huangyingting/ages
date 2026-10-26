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
  liangzhu: [
    year(-3300), title('良渚古城', 'Liangzhu Ancient City', '约前3300—前2300年 · 中华五千年文明实证', 'c. 3300–2300 BCE · 5,000 years of civilisation'),
    fly(119.98, 30.39, 16, 0.88),
    cap('距今约五千年，太湖流域的良渚先民筑起规模宏大的内城与外郭。', 'Five thousand years ago, the Liangzhu people built a vast walled city in the Taihu basin.'),
    { do: 'build', kind: 'canal', dur: 4, pts: [[119.86, 30.46], [119.93, 30.43], [119.98, 30.40], [120.05, 30.38], [120.11, 30.35]] },
    cap('古城外围修筑11条水坝，构成中国最早的大型水利工程体系。', 'Eleven earthen dams around the city formed China’s earliest large-scale hydraulic system.'),
    { do: 'spawn', lon: 119.98, lat: 30.39, model: { kind: 'ding', hero: 'places-sites/pl_liangzhu', style: 'story_liangzhu' }, label: lbl('莫角山宫殿与玉琮', 'Mojiaoshan & Jade Cong') },
    { do: 'fx', lon: 119.98, lat: 30.39, fx: 'glow', color: '#7fb385', dur: 3.2 },
    banner(119.98, 30.39, '良渚古国', 'Sacred City of Liangzhu', '#2e8b57', lbl('水利系统 · 玉琮礼制', 'hydraulic dams · jade ritual')),
    orbit(42, 4.8, true),
    cap('瑶山与反山大墓出土的玉琮、玉璧，实证中华五千年文明史。', 'Jade cong and bi from elite tombs bear witness to five millennia of Chinese civilisation.', 4),
  ],

  huangdi: [
    year(-2600), title('炎黄联盟', 'Alliance of Yan and Huang', '阪泉之战 · 涿鹿之战', 'Banquan & Zhuolu · birth of the Huaxia'),
    fly(115.2, 39.8, 22, 0.86),
    cap('五六千年前，黄河流域的黄帝部落与炎帝部落在阪泉交战后结成联盟。', 'In the Yellow River basin, the Huangdi and Yandi tribes clash at Banquan and forge an alliance.'),
    { do: 'army', pts: [[113.8, 38.5], [114.6, 39.4], [115.2, 40.1]], color: '#d4ac0d', dur: 3, count: 24, unit: 'foot', label: lbl('黄帝部落', 'Huangdi'), par: true },
    { do: 'army', pts: [[112.5, 36.8], [113.8, 38.4], [115.1, 40.0]], color: '#c0392b', dur: 3, count: 22, unit: 'foot', label: lbl('炎帝部落', 'Yandi') },
    { do: 'fx', lon: 115.2, lat: 40.1, fx: 'glow', color: '#f1c40f', dur: 2.2 },
    banner(115.2, 40.1, '阪泉盟誓', 'Alliance at Banquan', '#d4ac0d', lbl('炎黄合流', 'Yan and Huang unite')),
    cap('炎黄部落联盟东进涿鹿，与东方蚩尤部落决战。', 'The united Yan–Huang tribes march to Zhuolu to meet Chiyou.'),
    { do: 'clash', lon: 115.22, lat: 40.38, a: '#d4ac0d', b: '#5b2c6f', winner: 'a', angle: 35, dur: 5.5, count: 28, labels: [lbl('炎黄联盟', 'Yan–Huang'), lbl('蚩尤部落', 'Chiyou')], units: ['mixed', 'foot'], formations: ['wings', 'wedge'] },
    { do: 'spawn', lon: 109.27, lat: 35.58, model: { kind: 'temple', style: 'story_huangdi_ling' }, label: lbl('人文初祖', 'Ancestors of Huaxia') },
    fly(112.0, 37.2, 28, 0.85, 2.0),
    banner(109.27, 35.58, '华夏族形成', 'Ethnogenesis of Huaxia', '#c0392b', lbl('炎帝 · 黄帝', 'Yandi & Huangdi')),
    cap('涿鹿之战后各部落逐渐融合为华夏族，炎帝与黄帝被尊为中华民族的人文初祖。', 'From this fusion the Huaxia people emerge, honouring Yan and Huang as their common ancestors.', 4.2),
  ],

  shanrang: [
    year(-2150), title('尧舜禹禅让', 'Abdication of Yao, Shun and Yu', '公天下 · 大禹治水', 'Meritocracy & Yu Taming the Floods'),
    fly(111.52, 36.09, 24, 0.86),
    cap('尧、舜、禹时期实行禅让制，推举品德才干兼备之人继任部落联盟首领。', 'Under the shanrang system, Yao, Shun and Yu pass leadership to the worthiest successor.'),
    { do: 'fx', lon: 111.52, lat: 36.09, fx: 'glow', color: '#f39c12', dur: 2.5 },
    banner(111.52, 36.09, '尧舜禅让', 'Abdication by Merit', '#d68910', lbl('选贤与能', 'choosing the worthy')),
    fly(112.8, 35.2, 26, 0.85, 1.8),
    cap('洪水泛滥，大禹改“堵”为“疏”，开凿龙门、疏通九河。', 'Facing great floods, Yu abandons blocking for dredging, cutting channels to guide the waters to the sea.'),
    { do: 'build', kind: 'canal', dur: 4.5, pts: [[110.6, 35.6], [111.3, 34.8], [112.8, 34.8], [114.5, 35.2], [116.2, 36.4], [117.8, 37.5]] },
    { do: 'spawn', lon: 111.52, lat: 36.09, model: { kind: 'dam', style: 'story_dayu' }, label: lbl('三过家门而不入', 'Yu Tames the Floods') },
    orbit(36, 4.2, true),
    cap('禹治水十三年，“三过家门而不入”，受舜禅让成为部落联盟首领。', 'For thirteen years Yu labours, passing his own home three times without entering, and earns Shun’s succession.', 4),
  ],

  xia_found: [
    year(-2070), title('夏朝建立', 'Founding of the Xia Dynasty', '约前2070年 · 家天下之始', 'c. 2070 BCE · China’s first dynasty'),
    fly(112.8, 34.5, 22, 0.87),
    cap('约前2070年，禹建立我国历史上第一个王朝——夏朝，定都阳城。', 'Around 2070 BCE, Yu founds the Xia at Yangcheng, China’s first dynasty.'),
    wipe(-2070, 113.03, 34.45, '#b5651d', 3.5),
    { do: 'highlight', polity: 'xia', dur: 3, par: true },
    { do: 'spawn', lon: 112.7, lat: 34.69, model: { kind: 'palace', hero: 'capitals/cap_erlitou', style: 'story_erlitou' }, label: lbl('二里头夏都遗址', 'Erlitou Palace Site') },
    banner(112.7, 34.69, '世袭制代替禅让制', 'Hereditary Rule Begins', '#b5651d', lbl('公天下 → 家天下', 'from merit to dynasty')),
    orbit(38, 4.5, true),
    cap('禹死后，其子启继位，“公天下”变为“家天下”，二里头遗址展现了夏代宫城气象。', 'Yu’s son Qi succeeds him, replacing abdication with hereditary succession; Erlitou reveals Xia’s palace grid.', 4.2),
  ],

  shang_found: [
    year(-1600), title('商汤灭夏', 'Tang Overthrows the Xia', '约前1600年 · 鸣条之战', 'c. 1600 BCE · Battle of Mingtiao'),
    fly(113.8, 34.7, 26, 0.86),
    cap('夏王桀暴虐无道，商部族首领汤任用伊尹，起兵伐夏。', 'As King Jie of Xia grows tyrannical, Tang of Shang and his minister Yi Yin march west.'),
    { do: 'army', pts: [[115.65, 34.44], [114.5, 34.6], [113.5, 34.7], [112.7, 34.7]], color: '#9c6b30', dur: 4, count: 32, unit: 'chariot', label: lbl('商汤大军', 'Tang of Shang'), follow: true },
    { do: 'clash', lon: 112.5, lat: 34.7, a: '#9c6b30', b: '#b5651d', winner: 'a', angle: 180, dur: 5, count: 26, labels: [lbl('商汤', 'Shang'), lbl('夏桀', 'Xia')], units: ['chariot', 'foot'], formations: ['wedge', 'line'] },
    banner(112.5, 34.7, '鸣条之战', 'Battle of Mingtiao', '#9c6b30', lbl('约前1600年', 'c. 1600 BCE')),
    wipe(-1600, 115.65, 34.44, '#9c6b30', 3.5),
    { do: 'highlight', polity: 'shang', dur: 3, par: true },
    { do: 'spawn', lon: 115.65, lat: 34.44, model: { kind: 'palace', style: 'story_bo_capital' }, label: lbl('商都亳', 'Capital at Bo') },
    cap('约前1600年，汤在鸣条击败夏桀，建立商朝，以亳为都。', 'Tang defeats Jie at Mingtiao around 1600 BCE and establishes the Shang dynasty at Bo.', 4),
  ],

  pangeng: [
    year(-1300), title('盘庚迁殷', 'Pan Geng Moves to Yin', '约前1300年 · 殷墟甲骨与青铜文明', 'c. 1300 BCE · Yinxu oracle bones & bronzes'),
    fly(114.2, 35.4, 22, 0.86),
    cap('商朝前期因水患与内乱多次迁都，约前1300年商王盘庚迁都于殷（今河南安阳）。', 'After repeated capital moves, King Pan Geng relocates the Shang court to Yin (modern Anyang).'),
    { do: 'route', model: { kind: 'chariot' }, dur: 4.5, color: '#9c6b30', keep: true, label: lbl('盘庚迁殷', 'Move to Yin'),
      pts: [[113.65, 34.76], [113.9, 35.2], [114.15, 35.65], [114.35, 36.12]] },
    { do: 'spawn', lon: 114.35, lat: 36.12, model: { kind: 'palace', hero: 'capitals/cap_yinxu', style: 'story_yinxu' }, label: lbl('殷墟宫殿与甲骨', 'Yinxu & Oracle Bones') },
    { do: 'fx', lon: 114.35, lat: 36.12, fx: 'glow', color: '#d4ac0d', dur: 3 },
    banner(114.35, 36.12, '定都于殷', 'Settled at Yin', '#9c6b30', lbl('甲骨卜辞 · 后母戊鼎', 'oracle bones · ritual bronzes')),
    orbit(40, 4.5, true),
    cap('此后商朝统治稳定近三百年，殷墟出土的甲骨文与后母戊鼎见证了商代文明高峰。', 'Yin remains the capital for nearly three centuries, yielding oracle-bone inscriptions and monumental bronzes.', 4.2),
  ],

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

  fenfeng: [
    year(-1046), title('西周分封制', 'Western Zhou Feudal Enfeoffment', '授民授疆土 · 封建亲戚以藩屏周', 'Granting lands & peoples to guard the Zhou house'),
    fly(113.5, 35.5, 38, 0.84),
    cap('西周建立后，周天子将宗亲与功臣分封到各地，授予土地和人民，建立诸侯国。', 'From Haojing, the Zhou king enfeoffs royal kinsmen and meritorious lords to guard the realm.'),
    { do: 'spawn', lon: 108.85, lat: 34.2, model: { kind: 'palace', hero: 'capitals/cap_zhou', style: 'story_haojing' }, label: lbl('宗周镐京', 'Haojing Capital') },
    ...([
      [[108.85, 34.2], [118.35, 36.82], '#117a65', '齐（吕尚）', 'Qi (Jiang Ziya)'],
      [[108.85, 34.2], [116.99, 35.60], '#27ae60', '鲁（伯禽）', 'Lu (Boqin)'],
      [[108.85, 34.2], [116.40, 39.90], '#2e86c1', '燕（召公）', 'Yan (Duke of Shao)'],
      [[108.85, 34.2], [111.52, 35.62], '#8e44ad', '晋（叔虞）', 'Jin (Shu Yu)'],
      [[108.85, 34.2], [115.65, 34.44], '#d68910', '宋（微子启）', 'Song (Weizi Qi)'],
    ] as [LonLat, LonLat, string, string, string][]).flatMap(([from, to, color, zh, en]): StoryStep[] => [
      { do: 'route', pts: [from, to], color, dur: 3.2, keep: true, model: { kind: 'chariot' }, par: true },
      { do: 'fx', lon: to[0], lat: to[1], fx: 'flag', color, par: true },
      { do: 'banner', lon: to[0], lat: to[1], text: lbl(zh, en), color, dur: 3.5, par: true },
    ]),
    { do: 'wait', dur: 3.6 },
    { do: 'highlight', polity: 'zhou', dur: 3, par: true },
    orbit(32, 4.5, true),
    cap('诸侯镇守疆土、随从作战、定期朝觐纳贡，形成“天子—诸侯—卿大夫—士”的等级秩序。', 'Feudal lords defend the frontiers, pay tribute and join royal campaigns in a graded hierarchy.', 4.5),
  ],

  pingwang: [
    year(-771), title('平王东迁', 'King Ping Moves East', '前770年 · 东周与春秋时代开启', '770 BCE · Eastern Zhou & Spring and Autumn begin'),
    fly(110.6, 34.4, 24, 0.86),
    cap('前771年，犬戎攻破镐京，周幽王被杀，西周灭亡。', '771 BCE: the Quanrong sack Haojing and kill King You; the Western Zhou falls.'),
    { do: 'army', pts: [[107.0, 35.2], [108.1, 34.6], [108.85, 34.2]], color: '#7f8c8d', dur: 3, count: 28, unit: 'horse', label: lbl('犬戎', 'Quanrong') },
    { do: 'fx', lon: 108.85, lat: 34.2, fx: 'fire', dur: 3.5, par: true },
    banner(108.85, 34.2, '镐京残破', 'Fall of Haojing', '#7b241c', lbl('前771年', '771 BCE')),
    year(-770),
    cap('前770年，周平王在晋、郑、秦等诸侯护卫下东迁洛邑，史称东周。', '770 BCE: escorted by feudal lords, King Ping moves the court east to Luoyi, beginning the Eastern Zhou.'),
    { do: 'route', model: { kind: 'chariot' }, dur: 4.5, color: '#d35400', keep: true, label: lbl('平王东迁', 'Eastward Move'),
      pts: [[108.85, 34.2], [109.8, 34.45], [110.9, 34.6], [112.45, 34.62]] },
    { do: 'spawn', lon: 112.45, lat: 34.62, model: { kind: 'palace', hero: 'capitals/cap_luoyi', style: 'story_luoyi' }, label: lbl('东周王城洛邑', 'Luoyi Royal City') },
    wipe(-770, 112.45, 34.62, '#d35400', 3.5),
    cap('周王室衰微，诸侯各自为政，历史进入“礼崩乐坏、诸侯争霸”的春秋时期。', 'Royal authority wanes and regional lords vie for hegemony in the Spring and Autumn period.', 4.2),
  ],

  kuiqiu: [
    year(-651), title('齐桓公称霸', 'Hegemony of Duke Huan of Qi', '尊王攘夷 · 前651年葵丘会盟', '651 BCE · Covenant at Kuiqiu'),
    fly(116.2, 35.6, 28, 0.86),
    cap('齐桓公任用管仲改革内政、发展渔盐，打出“尊王攘夷”旗号，九合诸侯。', 'Advised by Guan Zhong, Duke Huan reforms Qi and rallies the states under “Revere the King, Repel the Barbarians”.'),
    { do: 'spawn', lon: 118.35, lat: 36.82, model: { kind: 'palace', hero: 'places-cities/pl_linzi', style: 'story_linzi' }, label: lbl('齐都临淄', 'Linzi Capital') },
    ...([
      [[118.35, 36.82], [115.1, 34.6]],
      [[116.99, 35.60], [115.1, 34.6]],
      [[115.65, 34.44], [115.1, 34.6]],
      [[114.35, 35.75], [115.1, 34.6]],
      [[113.68, 34.40], [115.1, 34.6]],
    ] as [LonLat, LonLat][]).map(([from, to]): StoryStep => ({
      do: 'route', pts: [from, to], color: '#117a65', dur: 3.4, keep: true, model: { kind: 'chariot' }, par: true,
    })),
    { do: 'wait', dur: 3.5 },
    { do: 'fx', lon: 115.1, lat: 34.6, fx: 'glow', color: '#f1c40f', dur: 3 },
    { do: 'highlight', polity: 'qi_s', dur: 3, par: true },
    banner(115.1, 34.6, '葵丘会盟', 'Covenant of Kuiqiu', '#117a65', lbl('春秋首霸', 'First Hegemon of Spring & Autumn')),
    cap('前651年葵丘会盟，周襄王派人赐胙，齐桓公成为春秋时期第一位霸主。', 'At the 651 BCE Kuiqiu assembly, the Zhou king sends sacrificial meat, confirming Duke Huan as first Hegemon.', 4),
  ],

  confucius: [
    year(-500), title('孔子与儒家学说', 'Confucius & Confucianism', '仁者爱人 · 有教无类 · 周游列国', 'Benevolence, education for all & fourteen years abroad'),
    fly(116.0, 35.2, 20, 0.88),
    { do: 'spawn', lon: 116.99, lat: 35.6, model: { kind: 'statue', hero: 'people-a/pp_confucius', style: 'story_confucius' }, label: lbl('曲阜杏坛讲学', 'Apricot Altar at Qufu') },
    cap('孔子在鲁国曲阜创办私学，主张“有教无类”，核心思想为“仁”与“礼”。', 'In Qufu, Confucius opens private education to all, teaching benevolence (ren) and ritual propriety (li).'),
    { do: 'route', model: { kind: 'chariot' }, dur: 6.5, color: '#b9770e', keep: true, label: lbl('周游列国', 'Fourteen Years Abroad'),
      pts: [[116.99, 35.6], [114.35, 35.75], [115.65, 34.44], [114.89, 33.78], [114.02, 32.98], [115.65, 34.44], [114.35, 35.75], [116.99, 35.6]] },
    banner(116.99, 35.6, '万世师表', 'Teacher for All Ages', '#b9770e', lbl('《论语》 · 儒家学派', 'The Analects · Confucianism')),
    orbit(40, 4.5, true),
    cap('孔子率弟子周游列国十四年，晚年整理《诗》《书》等典籍，其言行由弟子辑为《论语》。', 'After fourteen years travelling the states, he edits the classics; his disciples compile The Analects.', 4.2),
  ],

  baijia: [
    year(-350), title('百家争鸣', 'Hundred Schools of Thought', '战国学术盛世 · 稷下学宫', 'China’s Axial Age at the Jixia Academy'),
    fly(116.5, 35.6, 26, 0.86),
    { do: 'spawn', lon: 118.35, lat: 36.82, model: { kind: 'palace', style: 'jixia' }, label: lbl('齐国稷下学宫', 'Jixia Academy in Linzi') },
    cap('战国时期社会大变革，儒、墨、道、法、兵诸家学派在齐国稷下学宫等地著书立说、激烈辩论。', 'Amid Warring States upheaval, Confucian, Mohist, Daoist, Legalist and Military thinkers debate at Jixia.'),
    ...([
      [[116.99, 35.60], [118.35, 36.82], '#c0392b'],
      [[114.31, 34.80], [118.35, 36.82], '#2980b9'],
      [[114.49, 36.60], [118.35, 36.82], '#8e44ad'],
      [[113.68, 34.40], [118.35, 36.82], '#d68910'],
    ] as [LonLat, LonLat, string][]).map(([from, to, color]): StoryStep => ({
      do: 'route', pts: [from, to], color, dur: 3.2, dashed: true, keep: true, par: true,
    })),
    { do: 'wait', dur: 3.3 },
    { do: 'fx', lon: 118.35, lat: 36.82, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(118.35, 36.82, '百家争鸣', 'Hundred Schools Contend', '#d68910', lbl('儒 · 墨 · 道 · 法 · 兵', 'Confucian · Mohist · Daoist · Legalist')),
    orbit(42, 4.5, true),
    cap('孟子、荀子、墨子、庄子、韩非子、孙膑等思想交锋，奠定了中国传统文化体系的根基。', 'Their debates trigger China’s first great intellectual flowering and shape its philosophical tradition.', 4.2),
  ],

  shangyang: [
    year(-356), title('商鞅变法', 'Shang Yang’s Legalist Reforms', '前356年起 · 立木取信 · 奖励耕战', 'from 356 BCE · Rule of Law, Farming & War'),
    fly(109.26, 34.68, 14, 0.9),
    { do: 'spawn', lon: 109.26, lat: 34.68, model: { kind: 'monument', style: 'story_shangyang' }, label: lbl('栎阳南门立木', 'Pillar of Trust at Yueyang') },
    { do: 'fx', lon: 109.26, lat: 34.68, fx: 'glow', color: '#d4ac0d', dur: 2.5 },
    cap('前356年，秦孝公任用商鞅变法，于城南门“立木取信”，颁布新法。', '356 BCE: backed by Duke Xiao of Qin, Shang Yang sets a wooden pole at the south gate to establish trust in the law.'),
    banner(109.26, 34.68, '废井田 · 奖军功 · 行县制', 'Fiefs Abolished · Merit in Battle · Counties', QIN, lbl('富国强兵', 'rich state and strong army')),
    { do: 'army', pts: [[107.4, 34.4], [109.26, 34.68], [110.2, 34.5]], color: QIN, dur: 3.5, count: 28, unit: 'mixed', label: lbl('秦国锐士', 'Qin New Army') },
    orbit(35, 4, true),
    cap('商鞅变法废除贵族世袭特权，奖励耕织与军功，使秦国国富兵强，为统一六国奠定基础。', 'Abolishing hereditary privilege and rewarding farming and battle merit, the reforms make Qin the strongest state.', 4.2),
  ],

  dujiangyan: [
    year(-256), title('都江堰', 'Dujiangyan Irrigation System', '前256年 · 李冰父子治水 · 天府之国', '256 BCE · Li Bing turns Sichuan into the Land of Abundance'),
    fly(103.62, 31.0, 12, 0.9),
    cap('前256年，蜀郡太守李冰主持修建都江堰，在岷江江心筑分水鱼嘴。', '256 BCE: Governor Li Bing builds the Yuzui levee in the Min River to divide inner and outer channels.'),
    { do: 'build', kind: 'canal', dur: 3.5, pts: [[103.55, 31.18], [103.62, 31.0], [103.85, 30.82], [104.07, 30.67], [104.35, 30.55]] },
    { do: 'build', kind: 'canal', dur: 2.8, pts: [[103.62, 31.0], [103.72, 30.72], [103.82, 30.45]] },
    { do: 'spawn', lon: 103.62, lat: 31.0, model: { kind: 'bridge', hero: 'places-sites/pl_dujiangyan', style: 'story_dujiangyan' }, label: lbl('鱼嘴 · 飞沙堰 · 宝瓶口', 'Yuzui, Feishayan & Baopingkou') },
    { do: 'fx', lon: 103.62, lat: 31.0, fx: 'glow', color: '#3498db', dur: 3 },
    banner(103.62, 31.0, '天府之国', 'Land of Abundance', '#2980b9', lbl('深淘滩 · 低作堰', 'dredge deep, keep weirs low')),
    orbit(42, 4.5, true),
    cap('鱼嘴分水、飞沙堰溢洪、宝瓶口引流，使成都平原成为“水旱从人，不知饥馑”的天府之国。', 'Diverting floods and irrigating the Chengdu Plain without a dam, Dujiangyan still waters Sichuan after 2,200 years.', 4.2),
  ],

  changping: [
    year(-260), title('长平之战', 'Battle of Changping', '前260年 · 白起破赵', '260 BCE · Bai Qi encircles the Zhao army'),
    fly(112.9, 35.8, 18, 0.88),
    cap('前260年，秦赵两军在长平对峙，赵王以纸上谈兵的赵括替下老将廉颇。', '260 BCE: Qin and Zhao face off at Changping; the King of Zhao replaces veteran Lian Po with Zhao Kuo.'),
    { do: 'army', pts: [[111.0, 35.0], [112.2, 35.5], [112.85, 35.78]], color: QIN, dur: 3.5, count: 38, unit: 'mixed', label: lbl('白起秦军', 'Bai Qi (Qin)'), par: true },
    { do: 'army', pts: [[114.49, 36.6], [113.6, 36.1], [113.0, 35.84]], color: '#b9770e', dur: 3.5, count: 36, unit: 'mixed', label: lbl('赵括赵军', 'Zhao Kuo (Zhao)') },
    fly(112.92, 35.8, 10, 0.92, 1.4),
    { do: 'clash', lon: 112.92, lat: 35.8, a: QIN, b: '#b9770e', winner: 'a', angle: 210, dur: 6, count: 34, siege: true, labels: [lbl('秦军奇兵包抄', 'Qin encirclement'), lbl('赵军被困绝粮', 'Zhao trapped')], units: ['horse', 'foot'], formations: ['wings', 'circle'] },
    banner(112.92, 35.8, '长平之战', 'Battle of Changping', QIN, lbl('赵军主力覆没', 'Zhao army destroyed')),
    cap('秦将白起佯败诱敌、绝赵粮道，围困赵军四十六日，东方六国再难单独抗秦。', 'Bai Qi feigns retreat, severs Zhao’s supply lines and traps its main force for 46 days; no eastern state can match Qin alone.', 4.2),
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
    title('秦长城', 'The Qin Great Wall', '前214年起 · 北击匈奴筑长城', 'from 214 BCE · Meng Tian secures the northern frontier'), year(-215), fly(110.5, 40.2, 38, 0.82),
    cap('秦始皇派大将蒙恬率三十万大军北击匈奴，收复河套地区。', 'The First Emperor sends General Meng Tian with 300,000 troops north to recover the Ordos Loop from the Xiongnu.'),
    { do: 'army', pts: [[108.71, 34.33], [109.2, 37.8], [108.8, 40.8]], color: QIN, dur: 3.5, count: 32, unit: 'horse', label: lbl('蒙恬北征', 'Meng Tian') },
    { do: 'clash', lon: 108.8, lat: 41.1, a: QIN, b: '#873600', winner: 'a', angle: 90, dur: 4, count: 22, labels: [lbl('秦军', 'Qin'), lbl('匈奴', 'Xiongnu')], units: ['horse', 'horse'] },
    year(-214),
    cap('把秦、赵、燕三国旧长城连接修缮，筑起西起临洮、东至辽东的万里长城。', 'Joining the old walls of Qin, Zhao and Yan, a rampart rises from Lintao in the west to Liaodong in the east.'),
    { do: 'build', kind: 'wall', dur: 6, pts: [[103.9, 35.4], [104.6, 36.8], [105.8, 38.6], [105.8, 40.5], [106.8, 41.4], [109.5, 41.8],
      [112.0, 41.6], [114.5, 41.9], [117.0, 42.5], [120.0, 42.6], [122.5, 42.8], [124.5, 42.3], [125.6, 41.0]] },
    { do: 'spawn', lon: 109.5, lat: 41.8, model: { kind: 'beacon' } },
    banner(109.5, 41.8, '万里长城', 'Ten-Thousand-Li Wall', QIN, lbl('西起临洮 · 东至辽东', 'Lintao to Liaodong')),
    orbit(35, 4),
  ],

  lingqu: [
    year(-214), title('开凿灵渠', 'Digging the Lingqu Canal', '前214年 · 沟通湘水与漓水', '214 BCE · Linking the Yangtze and Pearl River basins'),
    fly(110.69, 25.6, 12, 0.9),
    cap('前214年，秦始皇命史禄在今广西兴安开凿灵渠，以运送统一岭南的军粮。', '214 BCE: Engineer Shi Lu digs the Lingqu Canal at Xing’an to supply Qin armies campaigning in Lingnan.'),
    { do: 'build', kind: 'canal', dur: 4, pts: [[111.1, 26.1], [110.82, 25.78], [110.69, 25.6], [110.52, 25.42], [110.29, 25.27]] },
    { do: 'spawn', lon: 110.69, lat: 25.6, model: { kind: 'bridge', hero: 'places-sites/pl_lingqu', style: 'story_lingqu' }, label: lbl('灵渠铧嘴与陡门', 'Lingqu Ploughshare & Locks') },
    { do: 'route', model: { kind: 'boat' }, dur: 3.5, pts: [[111.1, 26.1], [110.69, 25.6], [110.29, 25.27]] },
    banner(110.69, 25.6, '沟通长江与珠江', 'Yangtze Meets Pearl River', '#2980b9', lbl('南渠 · 北渠 · 陡门', 'world’s earliest contour canal')),
    orbit(38, 4, true),
    cap('灵渠以铧嘴分湘水入漓水，沟通长江与珠江两大水系，促进了岭南与中原的融合。', 'Splitting the Xiang into the Li, Lingqu connects the Yangtze and Pearl River systems, integrating Lingnan.', 4),
  ],

  dazexiang: [
    year(-209), title('陈胜吴广起义', 'Dazexiang Uprising', '前209年 · 王侯将相宁有种乎', '209 BCE · “Are kings and generals born to their breed?”'),
    fly(116.8, 33.7, 16, 0.88),
    cap('前209年夏，九百戍卒在大泽乡遇大雨误期，按秦律当斩；陈胜、吴广揭竿而起。', 'Summer 209 BCE: delayed by torrential rains at Dazexiang and facing execution under Qin law, Chen Sheng and Wu Guang rise up.'),
    { do: 'spawn', lon: 117.15, lat: 33.6, model: { kind: 'warrior', hero: 'places-sites/pl_dazexiang', style: 'story_dazexiang' }, label: lbl('大泽乡揭竿起义', 'Uprising at Dazexiang') },
    { do: 'fx', lon: 117.15, lat: 33.6, fx: 'flag', color: RED },
    banner(117.15, 33.6, '王侯将相宁有种乎', 'Are Kings Born to Their Breed?', RED, lbl('中国第一次农民大起义', 'China’s first peasant uprising')),
    { do: 'army', pts: [[117.15, 33.6], [116.2, 33.68], [114.89, 33.78]], color: RED, dur: 4, count: 32, unit: 'foot', label: lbl('张楚义军', 'Zhangchu Rebels'), follow: true },
    { do: 'fx', lon: 114.89, lat: 33.78, fx: 'flag', color: RED },
    banner(114.89, 33.78, '张楚政权', 'Regime of Zhangchu', RED, lbl('攻占陈县', 'Chenxian taken')),
    cap('起义军攻占陈县建立“张楚”政权，揭开了秦末农民大起义的序幕。', 'Capturing Chenxian to proclaim the Zhangchu regime, they spark China’s first great peasant uprising.', 4),
  ],

  julu: [
    year(-207), title('巨鹿之战', 'Battle of Julu', '前207年 · 破釜沉舟 · 秦军主力覆没', '207 BCE · Xiang Yu sinks his boats and smashes his cauldrons'),
    fly(115.0, 36.8, 16, 0.88),
    cap('前207年，项羽率楚军北渡漳水援救巨鹿，下令砸锅沉船、只带三日口粮，以示死战。', '207 BCE: crossing the Zhang River to relieve Julu, Xiang Yu sinks his boats and smashes his cooking pots.'),
    { do: 'army', pts: [[115.6, 35.4], [115.2, 36.3], [115.03, 37.22]], color: RED, dur: 3.5, count: 30, unit: 'mixed', label: lbl('项羽楚军', 'Xiang Yu'), follow: true },
    { do: 'clash', lon: 115.03, lat: 37.22, a: RED, b: QIN, winner: 'a', angle: 90, dur: 6, count: 34, labels: [lbl('项羽楚军', 'Xiang Yu'), lbl('章邯·王离秦军', 'Qin Main Army')], units: ['mixed', 'mixed'], formations: ['wedge', 'square'] },
    banner(115.03, 37.22, '破釜沉舟', 'Sink the Boats, Smash the Pots', RED, lbl('九战九捷', 'nine battles, nine victories')),
    fly(109.5, 34.3, 18, 0.88, 2.0),
    { do: 'army', pts: [[111.2, 33.8], [109.8, 34.1], [108.71, 34.33]], color: '#a93226', dur: 3, count: 26, unit: 'mixed', label: lbl('刘邦入关', 'Liu Bang enters Guanzhong') },
    cap('项羽在巨鹿歼灭秦军主力，同时刘邦率军西入武关直逼咸阳，秦朝灭亡。', 'Xiang Yu crushes Qin’s main army at Julu while Liu Bang marches through Wu Pass to Xianyang; Qin falls.', 4.2),
  ],

  han_found: [
    year(-202), title('楚汉之争与西汉建立', 'Chu–Han Contention & Founding of Han', '前202年 · 垓下之围 · 定都长安', '202 BCE · Gaixia & Liu Bang founds the Western Han'),
    fly(116.5, 33.5, 22, 0.86),
    cap('秦亡后，刘邦与项羽展开四年“楚汉之争”，前202年汉军在垓下十面埋伏围困项羽。', 'After four years of Chu–Han war, Liu Bang’s forces encircle Xiang Yu at Gaixia with Chu songs on all sides.'),
    { do: 'clash', lon: 117.3, lat: 33.3, a: '#a93226', b: '#8e44ad', winner: 'a', angle: 45, dur: 5.5, count: 32, labels: [lbl('刘邦·韩信汉军', 'Han Army'), lbl('项羽楚军', 'Xiang Yu')], units: ['mixed', 'horse'], formations: ['circle', 'wedge'] },
    banner(117.3, 33.3, '四面楚歌', 'Songs of Chu on All Sides', '#a93226', lbl('垓下决战', 'Battle of Gaixia')),
    fly(108.94, 34.27, 26, 0.86, 2.2),
    wipe(-202, 108.94, 34.27, '#a93226', 3.8),
    { do: 'highlight', polity: 'whan', dur: 3, par: true },
    { do: 'spawn', lon: 108.94, lat: 34.27, model: { kind: 'palace', hero: 'capitals/cap_qinhan', style: 'story_weiyang' }, label: lbl('汉长安未央宫', 'Weiyang Palace, Chang’an') },
    banner(108.94, 34.27, '西汉建立', 'Western Han Founded', '#a93226', lbl('汉高祖刘邦 · 都长安', 'Emperor Gaozu · Chang’an')),
    cap('前202年刘邦称帝，建立汉朝，定都长安，推行休养生息政策。', '202 BCE: Liu Bang ascends the throne as Emperor Gaozu, founding the Han dynasty at Chang’an.', 4.2),
  ],

  hanwudi: [
    year(-127), title('汉武帝大一统', 'Emperor Wu’s Grand Unity', '推恩令 · 罢黜百家 · 卫青霍去病北击匈奴', 'Enfeoffment reform, Confucian orthodoxy & northern campaigns'),
    fly(106.5, 38.5, 38, 0.84),
    cap('汉武帝采纳主父偃“推恩令”、董仲舒“罢黜百家，尊崇儒术”，铸五铢钱、盐铁官营，巩固大一统。', 'Emperor Wu weakens feudal kings via the Grace Decree, elevates Confucianism, and mints Wuzhu coins.'),
    { do: 'army', pts: [[108.94, 34.27], [106.0, 36.5], [103.5, 38.2], [100.4, 39.2]], color: '#a93226', dur: 4.5, count: 38, unit: 'horse', label: lbl('霍去病河西铁骑', 'Huo Qubing'), par: true },
    { do: 'army', pts: [[108.94, 34.27], [109.5, 38.5], [108.0, 42.5], [106.9, 46.5]], color: '#a93226', dur: 4.5, count: 38, unit: 'horse', label: lbl('卫青漠北远征', 'Wei Qing') },
    year(-119),
    { do: 'clash', lon: 106.9, lat: 46.8, a: '#a93226', b: '#873600', winner: 'a', angle: 90, dur: 5.5, count: 30, labels: [lbl('汉军骑兵', 'Han Cavalry'), lbl('匈奴单于', 'Xiongnu')], units: ['horse', 'horse'], formations: ['wings', 'line'] },
    banner(106.9, 46.8, '漠北之战', 'Mobei Campaign', '#a93226', lbl('封狼居胥 · 匈奴远遁', 'Xiongnu driven beyond the Gobi')),
    { do: 'highlight', polity: 'whan', dur: 3, par: true },
    orbit(32, 4, true),
    cap('前119年卫青、霍去病大破匈奴于漠北，设河西四郡，西汉进入鼎盛时期。', '119 BCE: Wei Qing and Huo Qubing shatter Xiongnu power north of the Gobi and establish the Four Hexi Commanderies.', 4.2),
  ],

  zhangqian: [
    title('张骞通西域', 'Zhang Qian Opens the West', '前138年 · 丝绸之路凿空之旅', '138 BCE · Opening the Silk Road'), year(-138), fly(92, 37, 52, 0.84),
    cap('前138年，张骞奉汉武帝之命从长安出发，出使西域联络大月氏。', '138 BCE: Zhang Qian sets out from Chang’an as Emperor Wu’s envoy to the Yuezhi.'),
    { do: 'route', model: { kind: 'camel' }, dur: 9, color: '#b9770e', label: lbl('丝绸之路', 'Silk Road'), keep: true,
      pts: [[108.94, 34.27], [104.0, 35.6], [102.6, 37.9], [100.4, 38.9], [98.5, 39.7], [94.66, 40.14], [89.2, 42.9], [84.0, 41.7],
        [80.3, 41.2], [76.0, 39.5], [72.8, 40.6], [71.8, 40.4], [69.0, 39.0], [67.2, 37.0]] },
    { do: 'spawn', lon: 94.66, lat: 40.14, model: { kind: 'gate', hero: 'places-sites/pl_yumenguan', style: 'story_yumenguan' }, label: lbl('敦煌玉门关', 'Yumen Pass') },
    cap('他历经匈奴十余年扣留，持汉节不失，远达大宛、康居、大月氏。', 'Held over a decade by the Xiongnu yet keeping his imperial staff, he reaches Ferghana, Sogdiana and Bactria.'),
    { do: 'route', dur: 6, color: '#b9770e', dashed: true, keep: true,
      pts: [[67.2, 37.0], [71.0, 38.0], [75.99, 39.47], [79.9, 37.1], [84.0, 37.5], [88.2, 39.0], [94.66, 40.14], [98.5, 39.7], [102.6, 37.9], [108.94, 34.27]] },
    year(-119),
    banner(94.66, 40.14, '凿空西域', 'Blazing the Trail West', '#b9770e', lbl('丝绸之路贯通欧亚', 'linking China and Central Asia')),
    cap('前119年张骞第二次出使乌孙，中西陆上交通大动脉——丝绸之路正式开通。', 'His second mission in 119 BCE cements ties across the Tarim Basin, opening the Silk Road across Eurasia.', 4),
  ],

  xiyu_duhu: [
    year(-60), title('西域都护府设立', 'Protectorate of the Western Regions', '前60年 · 新疆正式归属中央政权', '60 BCE · Xinjiang enters central governance'),
    fly(86.5, 41.2, 34, 0.85),
    cap('前60年，西汉在乌垒城（今新疆轮台）设立西域都护府，作为管理西域的最高长官。', '60 BCE: the Western Han establishes the Protectorate of the Western Regions at Wulei (modern Luntai).'),
    { do: 'route', model: { kind: 'rider' }, dur: 4.5, color: '#a93226', keep: true, label: lbl('汉使护西域', 'Han Garrison Route'),
      pts: [[94.66, 40.14], [89.19, 42.95], [86.15, 41.77], [84.25, 41.78]] },
    { do: 'spawn', lon: 84.25, lat: 41.78, model: { kind: 'gate', hero: 'places-cities/pl_luntai', style: 'story_wulei' }, label: lbl('乌垒城都护府', 'Wulei Seat of Protector-General') },
    { do: 'fx', lon: 84.25, lat: 41.78, fx: 'flag', color: '#a93226' },
    { do: 'highlight', polity: 'whan', dur: 3.5, par: true },
    banner(84.25, 41.78, '西域都护府', 'Protectorate of the Western Regions', '#a93226', lbl('前60年 · 统辖西域三十六国', '60 BCE · governing the Tarim states')),
    orbit(35, 4, true),
    cap('西域都护颁行汉朝号令，屯田驻军、保障丝路畅通，标志西域正式归属中央政权。', 'Enforcing imperial decrees and protecting Silk Road garrisons, it marks Xinjiang’s formal inclusion in central rule.', 4.2),
  ],

  guangwu: [
    year(25), title('东汉建立与光武中兴', 'Eastern Han & Guangwu Restoration', '25年 · 定都洛阳 · 柔道治国', '25 CE · Liu Xiu restores the Han at Luoyang'),
    fly(112.45, 34.62, 22, 0.88),
    cap('25年，刘秀平定绿林、赤眉及各地割据势力，称帝重建汉朝，定都洛阳，史称东汉。', '25 CE: Liu Xiu reunites the empire and restores the Han dynasty with its capital at Luoyang.'),
    wipe(25, 112.45, 34.62, '#b03a2e', 3.5),
    { do: 'highlight', polity: 'ehan', dur: 3, par: true },
    { do: 'spawn', lon: 112.45, lat: 34.62, model: { kind: 'palace', hero: 'capitals/cap_luoyang', style: 'story_ehan_luoyang' }, label: lbl('东汉洛阳宫', 'Eastern Han Luoyang') },
    { do: 'fx', lon: 112.45, lat: 34.62, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(112.45, 34.62, '光武中兴', 'Guangwu Restoration', '#b03a2e', lbl('释放奴婢 · 减轻赋税 · 合并郡县', 'freeing slaves & lightening taxes')),
    orbit(38, 4.2, true),
    cap('光武帝多次下诏释放奴婢、三十税一、整顿吏治，社会经济恢复发展，史称“光武中兴”。', 'Freeing bondservants, cutting land tax to one-thirtieth and trimming bureaucracy, Emperor Guangwu ushers in renewal.', 4),
  ],

  guandu: [
    year(200), title('官渡之战', 'Battle of Guandu', '200年 · 奇袭乌巢 · 曹操统一北方', '200 CE · Raid on Wuchao & Cao Cao unites the north'),
    fly(114.0, 35.1, 16, 0.88),
    cap('200年，袁绍率十万大军南下攻曹，两军在官渡相持数月，曹军粮尽势危。', '200 CE: Yuan Shao marches south with 100,000 men; outnumbered at Guandu, Cao Cao runs low on grain.'),
    { do: 'army', pts: [[114.5, 36.3], [114.25, 35.5], [114.08, 34.92]], color: '#b7950b', dur: 3.5, count: 40, unit: 'mixed', label: lbl('袁绍大军', 'Yuan Shao') },
    { do: 'route', model: { kind: 'rider' }, dur: 2.8, color: '#2874a6', keep: true, label: lbl('夜袭乌巢', 'Night Raid on Wuchao'),
      pts: [[114.03, 34.72], [114.28, 34.95], [114.38, 35.15]] },
    { do: 'fx', lon: 114.38, lat: 35.15, fx: 'fire', dur: 4.5, par: true },
    banner(114.38, 35.15, '火烧乌巢', 'Burning the Wuchao Depot', '#d35400', lbl('断袁军粮草', 'Yuan’s grain depot torched')),
    { do: 'clash', lon: 114.05, lat: 34.78, a: '#2874a6', b: '#b7950b', winner: 'a', angle: 90, dur: 5.5, count: 30, labels: [lbl('曹军', 'Cao Cao'), lbl('袁军', 'Yuan Shao')], units: ['horse', 'mixed'], formations: ['wedge', 'line'] },
    cap('曹操率轻骑夜袭乌巢烧毁袁军粮草，以少胜多歼灭袁绍主力，为统一北方奠定基础。', 'Leading a night raid to burn Yuan Shao’s grain depot at Wuchao, Cao Cao wins a decisive victory and unites the north.', 4.2),
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

  wjin_unify: [
    year(266), title('西晋短期统一', 'Western Jin Reunification', '266—280年 · 王濬楼船下益州，金陵王气黯然收', '266–280 CE · Western Jin reunites the Three Kingdoms'),
    fly(114.5, 32.8, 32, 0.85),
    cap('263年魏灭蜀后，266年司马炎代魏建立西晋，定都洛阳；279年分兵水陆大举伐吴。', 'After conquering Shu, Sima Yan founds the Western Jin at Luoyang in 266 and launches the final campaign against Wu.'),
    { do: 'fleet', model: 'warship', dur: 5, color: '#1a5276', count: 7, keep: true, follow: true, label: lbl('王濬楼船水师', 'Wang Jun’s Fleet'),
      pts: [[111.3, 30.7], [113.5, 30.1], [116.0, 30.5], [117.8, 31.3], [118.78, 32.06]] },
    { do: 'clash', lon: 118.78, lat: 32.06, a: '#1a5276', b: '#c0392b', winner: 'a', siege: true, angle: 210, dur: 4.5, count: 24, labels: [lbl('西晋水陆大军', 'Western Jin'), lbl('东吴', 'Wu')] },
    wipe(280, 118.78, 32.06, '#1a5276', 3.5),
    { do: 'highlight', polity: 'wjin', dur: 3, par: true },
    banner(118.78, 32.06, '三国归晋', 'Three Kingdoms Reunited', '#1a5276', lbl('280年 · 西晋灭吴统一全国', '280 CE · Wu surrenders at Jianye')),
    cap('280年西晋水师攻克建业，东吴灭亡，结束了汉末以来近百年的分裂局面。', '280 CE: Jin warships break the iron chains on the Yangtze and take Jianye, ending nearly a century of division.', 4.2),
  ],

  dongjin: [
    year(316), title('衣冠南渡与东晋建立', 'Southward Migration & Eastern Jin', '317年 · 王与马，共天下 · 江南开发', '317 CE · Northern elites flee south and found the Eastern Jin'),
    fly(115.5, 33.2, 30, 0.85),
    cap('西晋末年“八王之乱”后北方战乱频仍，中原大批士族与百姓渡江南迁，史称“衣冠南渡”。', 'Following the War of the Eight Princes, northern gentry and commoners stream south across the Yangtze.'),
    { do: 'route', model: { kind: 'chariot' }, dur: 4.8, color: '#2471a3', keep: true, label: lbl('衣冠南渡', 'Southward Migration'),
      pts: [[112.45, 34.62], [114.5, 33.8], [116.8, 32.6], [118.78, 32.06]] },
    wipe(317, 118.78, 32.06, '#2471a3', 3.5),
    { do: 'highlight', polity: 'ejin', dur: 3, par: true },
    { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'palace', hero: 'capitals/cap_jiankang', style: 'story_jiankang' }, label: lbl('东晋都城建康', 'Jiankang Capital') },
    banner(118.78, 32.06, '东晋建立', 'Eastern Jin at Jiankang', '#2471a3', lbl('317年 · 司马睿称晋王', '317 CE · Sima Rui restores Jin')),
    cap('317年司马睿在建康（今南京）重建晋朝；北人南迁带来劳动力与先进农技，促进了江南开发。', '317 CE: Sima Rui establishes the Eastern Jin at Jiankang; northern migrants transform Jiangnan into a prosperous heartland.', 4.2),
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
    title('北魏孝文帝改革', 'Reforms of Emperor Xiaowen', '494年 · 迁都洛阳 · 民族大交融', '494 · Move to Luoyang & ethnic integration'), year(493), fly(112.8, 37.3, 26),
    cap('494年，北魏孝文帝力排众议，从塞北平城（今大同）南迁都城至洛阳。', '494: Emperor Xiaowen moves the Northern Wei capital south from Pingcheng (Datong) to Luoyang.'),
    { do: 'route', model: { kind: 'rider' }, dur: 5, color: '#5b2c6f', keep: true, label: lbl('南迁洛阳', 'Move to Luoyang'),
      pts: [[113.3, 40.09], [112.7, 38.6], [112.55, 37.87], [112.6, 36.2], [112.45, 34.62]] },
    year(494),
    { do: 'spawn', lon: 112.45, lat: 34.62, model: { kind: 'palace', hero: 'capitals/cap_nanbei', style: 'story_xiaowendi' }, label: lbl('北魏洛阳城', 'Northern Wei Luoyang') },
    { do: 'highlight', polity: 'beiwei', dur: 3, par: true },
    banner(112.45, 34.62, '汉化改革', 'Sinicisation Reforms', '#5b2c6f', lbl('说汉语 · 穿汉服 · 改汉姓 · 通汉婚', 'Han speech, dress, surnames & marriage')),
    orbit(35, 4, true),
    cap('孝文帝推行说汉语、穿汉服、改鲜卑姓为汉姓、鼓励鲜卑贵族与汉族联姻，极大促进了北方民族大交融。', 'Adopting Han speech, dress, surnames and intermarriage, his reforms accelerate ethnic integration across northern China.', 4.2),
  ],

  sui_unify: [
    year(581), title('隋朝建立与统一', 'Founding & Reunification of Sui', '581—589年 · 结束南北朝长期分裂', '581–589 CE · Ending three centuries of north–south division'),
    fly(114.0, 33.2, 34, 0.85),
    cap('581年，杨坚夺取北周政权建立隋朝，定都大兴（长安）；588年命晋王杨广统兵五十一万南下伐陈。', '581 CE: Yang Jian founds the Sui dynasty at Chang’an and in 588 sends 510,000 troops south against Chen.'),
    { do: 'army', pts: [[108.94, 34.27], [113.5, 33.6], [116.8, 32.5], [118.5, 32.1]], color: '#148f77', dur: 4, count: 38, unit: 'mixed', label: lbl('韩擒虎·贺若弼隋军', 'Sui Northern Force'), par: true },
    { do: 'fleet', model: 'warship', dur: 4, color: '#148f77', count: 6, label: lbl('杨素长江水师', 'Sui River Fleet'),
      pts: [[111.3, 30.7], [114.3, 30.6], [117.0, 30.5], [118.6, 31.9]] },
    { do: 'clash', lon: 118.78, lat: 32.06, a: '#148f77', b: '#c0392b', winner: 'a', siege: true, angle: 210, dur: 4.5, count: 26, labels: [lbl('隋军', 'Sui'), lbl('南朝陈', 'Chen')] },
    wipe(589, 118.78, 32.06, '#148f77', 3.8),
    { do: 'highlight', polity: 'sui', dur: 3, par: true },
    banner(118.78, 32.06, '隋灭陈统一全国', 'Sui Unites China', '#148f77', lbl('589年 · 结束三百年分裂', '589 CE · North and South reunited')),
    cap('589年隋军攻克建康灭陈，结束了自西晋末年以来近三百年的南北分裂局面。', '589 CE: Sui forces take Jiankang, ending nearly three centuries of division since the fall of Western Jin.', 4.2),
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

  zhenguan: [
    year(627), title('贞观之治', 'Rule of Zhenguan', '627—649年 · 兼听则明 · 天可汗', '627–649 CE · Emperor Taizong & the Heavenly Qaghan'),
    fly(108.94, 34.27, 26, 0.86),
    { do: 'spawn', lon: 108.94, lat: 34.27, model: { kind: 'palace', hero: 'capitals/cap_tang', style: 'story_zhenguan' }, label: lbl('唐长安太极宫', 'Taiji Palace, Chang’an') },
    { do: 'fx', lon: 108.94, lat: 34.27, fx: 'glow', color: '#f1c40f', dur: 3 },
    cap('唐太宗李世民吸取隋亡教训，完善三省六部制与科举制，重用房玄龄、杜如晦，虚心纳谏于魏征。', 'Emperor Taizong perfects the Three Departments and Six Ministries, expands civil exams, and heeds Wei Zheng’s remonstrances.'),
    fly(106.0, 39.0, 38, 0.84, 2.0),
    { do: 'army', pts: [[108.94, 34.27], [110.5, 38.0], [111.65, 40.82]], color: RED, dur: 3.5, count: 32, unit: 'horse', label: lbl('李靖北击东突厥', 'Li Jing') },
    { do: 'highlight', polity: 'tang', dur: 3, par: true },
    banner(108.94, 34.27, '贞观之治 · 天可汗', 'Zhenguan Era · Heavenly Qaghan', RED, lbl('轻徭薄赋 · 万国来朝', 'light taxes · envoys from across Asia')),
    orbit(35, 4.2, true),
    cap('唐军击败东突厥后，北方和西北各族尊奉唐太宗为“天可汗”，政治清明、经济复苏，史称“贞观之治”。', 'Northern and western peoples hail Taizong as “Heavenly Qaghan” as Chang’an becomes a cosmopolitan capital.', 4.2),
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
    title('文成公主入藏', 'Princess Wencheng', '641年 · 唐蕃和亲 · 促进吐蕃经济社会发展', '641 · Tang–Tibet alliance'), year(640), fly(100, 33, 40, 0.85),
    cap('641年，唐太宗以文成公主远嫁吐蕃赞普松赞干布，从长安踏上唐蕃古道。', '641: Princess Wencheng sets out from Chang’an along the Tang–Tubo road to wed Songtsen Gampo.'),
    { do: 'route', model: { kind: 'tent' }, dur: 7, color: '#c0392b', keep: true, label: lbl('唐蕃古道', 'Tang–Tubo Ancient Road'),
      pts: [[108.94, 34.27], [105.7, 34.6], [103.8, 36.06], [101.78, 36.62], [101.1, 36.4], [99.6, 35.3], [97.0, 33.0], [94.0, 31.5], [92.0, 30.8], [91.11, 29.65]] },
    year(641),
    { do: 'spawn', lon: 91.11, lat: 29.65, model: { kind: 'temple', hero: 'sites-a/st_jokhang' }, label: lbl('逻些（拉萨）', 'Rasa (Lhasa)') },
    { do: 'fx', lon: 91.11, lat: 29.65, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(91.11, 29.65, '和同为一家', 'United as One Family', '#c0392b', lbl('谷物种子 · 历法医书 · 百工技艺', 'seeds, calendars, medicine & crafts')),
    orbit(35, 4, true),
    cap('她带去谷物种子、药材、历法典籍与百工匠人，极大促进了吐蕃经济社会发展和汉藏友好关系。', 'She brings seeds, medical texts, calendars and artisans, fostering Tibetan development and lasting Tang–Tubo amity.', 4),
  ],

  kaiyuan: [
    year(713), title('开元盛世', 'Heyday of Kaiyuan', '713—741年 · 稻米流脂粟米白，公私仓廪俱丰实', '713–741 CE · Tang Empire at its zenith'),
    fly(108.94, 34.27, 34, 0.85),
    cap('唐玄宗统治前期任用姚崇、宋璟为相，整顿吏治、发展农桑，曲辕犁与筒车广泛推广。', 'Early in his reign, Emperor Xuanzong appoints capable chancellors Yao Chong and Song Jing; curved-beam ploughs and waterwheels spread.'),
    { do: 'spawn', lon: 108.94, lat: 34.27, model: { kind: 'palace', hero: 'places-cities/pl_xian', style: 'story_kaiyuan' }, label: lbl('盛唐长安大明宫', 'Daming Palace, Chang’an') },
    ...([
      [[94.66, 40.14], [108.94, 34.27], '#d68910'],
      [[119.42, 32.39], [108.94, 34.27], '#2980b9'],
      [[113.26, 23.13], [119.42, 32.39], '#1abc9c'],
    ] as [LonLat, LonLat, string][]).map(([from, to, color]): StoryStep => ({
      do: 'route', pts: [from, to], color, dur: 3.4, keep: true, par: true,
    })),
    { do: 'wait', dur: 3.5 },
    year(742),
    { do: 'highlight', polity: 'tang', dur: 3, par: true },
    { do: 'fx', lon: 108.94, lat: 34.27, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(108.94, 34.27, '开元盛世', 'Zenith of the Tang', RED, lbl('长安百万人口 · 国际大都会', 'Chang’an · metropolis of a million')),
    orbit(40, 4.5, true),
    cap('杜甫诗云“忆昔开元全盛日，小邑犹藏万家室”，唐朝进入全盛时期，长安成为当时世界上最大的国际大都会。', 'Du Fu wrote, “In the heyday of Kaiyuan even small towns held ten thousand households” — the Tang reaches its golden age.', 4.2),
  ],

  jianzhen: [
    title('鉴真东渡', 'Jianzhen Sails to Japan', '753年 · 六次东渡 · 唐招提寺', '753 · The sixth attempt reaches Nara'), year(753), fly(125, 32, 34, 0.85),
    cap('扬州大明寺高僧鉴真应日本留学僧邀请，历经十余年五次东渡失败、双目失明仍矢志不渝。', 'Invited by Japanese monks, Master Jianzhen of Yangzhou perseveres through five failed crossings and blindness.'),
    { do: 'route', model: { kind: 'junk' }, dur: 7, color: '#2e86c1', keep: true, label: lbl('第六次东渡航线', '6th Crossing'),
      pts: [[119.42, 32.39], [120.6, 31.9], [121.8, 31.3], [124.5, 30.6], [128.0, 30.0], [130.3, 31.4], [130.4, 33.6], [132.5, 34.0], [135.0, 34.5], [135.8, 34.68]] },
    { do: 'spawn', lon: 135.8, lat: 34.68, model: { kind: 'temple', hero: 'sites-a/st_toshodaiji' }, label: lbl('唐招提寺', 'Tōshōdai-ji') },
    { do: 'fx', lon: 135.8, lat: 34.68, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(135.8, 34.68, '唐招提寺', 'Tōshōdai-ji in Nara', '#2e86c1', lbl('传授律宗 · 医药 · 建筑与雕塑', 'Buddhism, medicine & Tang architecture')),
    orbit(35, 4, true),
    cap('753年鉴真第六次东渡终于抵达日本奈良，主持营造唐招提寺，传播佛法、医药与盛唐建筑艺术。', 'Reaching Nara in 753, Jianzhen builds Tōshōdai-ji and transmits Buddhist precepts, medicine and Tang architecture.', 4),
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

  chanyuan: [
    year(1004), title('澶渊之盟', 'Treaty of Chanyuan', '1004—1005年 · 宋辽百余年和平', '1004–1005 CE · A century of Song–Liao peace'),
    fly(115.2, 36.8, 22, 0.86),
    cap('1004年秋，辽萧太后与辽圣宗亲率大军南下，深入宋境直抵澶州（今河南濮阳）城下。', 'Autumn 1004: Empress Dowager Xiao and Emperor Shengzong of Liao lead a major invasion south to Chanzhou.'),
    { do: 'army', pts: [[116.4, 39.9], [115.8, 38.0], [115.03, 35.76]], color: '#5d6d7e', dur: 3.5, count: 34, unit: 'horse', label: lbl('辽军南下', 'Liao Cavalry'), par: true },
    { do: 'army', pts: [[114.31, 34.8], [114.7, 35.25], [115.0, 35.68]], color: '#2e86c1', dur: 3.5, count: 30, unit: 'mixed', label: lbl('宋真宗·寇准亲征', 'Song Imperial Army') },
    { do: 'clash', lon: 115.03, lat: 35.72, a: '#2e86c1', b: '#5d6d7e', winner: 'a', angle: 90, dur: 4.5, count: 24, labels: [lbl('宋军床子弩', 'Song Crossbows'), lbl('辽军先锋萧挞凛', 'Liao Vanguard')], units: ['archer', 'horse'] },
    year(1005),
    { do: 'spawn', lon: 115.03, lat: 35.76, model: { kind: 'scroll' }, label: lbl('澶渊盟约', 'Chanyuan Covenant') },
    banner(115.03, 35.76, '澶渊之盟', 'Treaty of Chanyuan', '#2e86c1', lbl('宋辽约为兄弟之国 · 互市贸易', 'brother states · border markets')),
    cap('宰相寇准力劝宋真宗渡河登澶州北城楼，宋军射杀辽将萧挞凛；1005年初双方议和，此后宋辽保持百余年和平。', 'Encouraged by Kou Zhun, Emperor Zhenzong crosses the Yellow River; the resulting 1005 treaty brings over a century of peace.', 4.2),
  ],

  bisheng: [
    year(1041), title('毕昇发明活字印刷术', 'Bi Sheng Invents Movable Type', '北宋庆历年间 · 胶泥活字 · 文明传播巨变', '1041–1048 CE · Clay movable type revolutionises printing'),
    fly(114.31, 34.8, 12, 0.9),
    { do: 'spawn', lon: 114.31, lat: 34.8, model: { kind: 'printing', style: 'movable' }, label: lbl('胶泥活字印书局', 'Clay Movable Type Workshop') },
    { do: 'fx', lon: 114.31, lat: 34.8, fx: 'glow', color: '#f1c40f', dur: 3 },
    cap('北宋庆历年间（1041—1048），布衣毕昇发明胶泥活字印刷术：刻字烧硬、密布铁范、松脂腊固、刷墨印书。', 'During the Qingli era, commoner Bi Sheng carves characters on clay cubes, fires them hard and sets them in an iron frame.'),
    fly(115.0, 32.0, 36, 0.84, 2.0),
    ...([
      [[114.31, 34.8], [126.97, 37.56], '#d68910'],
      [[114.31, 34.8], [135.76, 35.01], '#2980b9'],
      [[114.31, 34.8], [94.66, 40.14], '#8e44ad'],
      [[114.31, 34.8], [106.6, 10.8], '#1abc9c'],
    ] as [LonLat, LonLat, string][]).map(([from, to, color]): StoryStep => ({
      do: 'route', pts: [from, to], color, dur: 3.4, dashed: true, keep: true, par: true,
    })),
    { do: 'wait', dur: 3.5 },
    banner(114.31, 34.8, '活字印刷术', 'Movable-Type Printing', '#d68910', lbl('沈括《梦溪笔谈》记载 · 若止印三二本未为简易，若印数十百千本则极为神速', 'recorded in Shen Kuo’s Brush Talks')),
    cap('活字印刷术后来传到朝鲜、日本、东南亚，并经丝绸之路西传欧洲，对人类文明传播产生深远影响。', 'Spreading east to Korea and Japan and west toward Europe, movable type transforms the transmission of human knowledge.', 4.2),
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

  yuefei: [
    year(1140), title('岳飞抗金', 'Yue Fei’s Northern Campaign', '1140年 · 郾城大捷 · 撼山易，撼岳家军难', '1140 CE · Victory at Yancheng against the Jin'),
    fly(114.0, 33.2, 22, 0.87),
    cap('南宋初年，岳飞率“岳家军”从鄂州北伐收复失地，军纪严明，“冻死不拆屋，饿死不掳掠”。', 'General Yue Fei leads his disciplined army north from Ezhou to recover the Central Plains.'),
    { do: 'army', pts: [[114.3, 30.56], [114.1, 32.1], [114.02, 33.58]], color: '#21618c', dur: 4, count: 36, unit: 'mixed', label: lbl('岳家军北伐', 'Yue Fei’s Army'), follow: true },
    { do: 'clash', lon: 114.02, lat: 33.58, a: '#21618c', b: '#b7950b', winner: 'a', angle: 90, dur: 5.5, count: 30, labels: [lbl('岳家军背嵬军', 'Yue Fei'), lbl('金兀术铁浮图', 'Jin Heavy Cavalry')], units: ['foot', 'horse'], formations: ['line', 'wedge'] },
    banner(114.02, 33.58, '郾城大捷', 'Victory at Yancheng', '#21618c', lbl('大破金军“铁浮图”与“拐子马”', 'shattering Jin armoured cavalry')),
    cap('1140年岳飞在郾城大破金兀术主力，进逼朱仙镇；但宋高宗与秦桧急于求和，以十二道金牌召回岳飞。', 'After crushing Wuzhu’s armoured cavalry at Yancheng and nearing Kaifeng, Yue Fei is recalled by Emperor Gaozong and Qin Hui.', 4.2),
  ],

  south_shift: [
    year(1180), title('经济重心南移完成', 'Economic Centre Shifts South', '南宋 · 苏湖熟，天下足 · 海上丝绸之路繁荣', 'Southern Song · Jiangnan rice & maritime trade'),
    fly(119.5, 29.0, 28, 0.85),
    { do: 'spawn', lon: 120.16, lat: 30.27, model: { kind: 'palace', hero: 'capitals/cap_linan', style: 'story_linan_prosper' }, label: lbl('临安城与江南农桑', 'Lin’an & Jiangnan Rice Bowl') },
    cap('从唐朝中晚期至两宋，北方人口持续南迁，江南推广占城稻与稻麦复种，出现“苏湖熟，天下足”的谚语。', 'By the Southern Song, Champa rice and double-cropping make the Taihu basin the empire’s granary: “When Suzhou and Huzhou ripen, all under Heaven has enough.”'),
    { do: 'fleet', model: 'junk', dur: 6.5, color: '#2980b9', count: 5, keep: true, label: lbl('泉州海商番舶', 'Quanzhou Maritime Trade'),
      pts: [[118.68, 24.87], [116.5, 21.5], [113.2, 16.5], [109.5, 11.5], [104.5, 3.5]] },
    { do: 'spawn', lon: 118.68, lat: 24.87, model: { kind: 'pagoda', hero: 'places-cities/pl_quanzhou', style: 'story_quanzhou' }, label: lbl('泉州市舶司', 'Quanzhou Maritime Trade Office') },
    banner(118.68, 24.87, '国家根本，仰给东南', 'The Empire Relies on the South-East', '#21618c', lbl('制瓷 · 造船 · 指南针远航', 'porcelain, shipbuilding & compass navigation')),
    orbit(35, 4, true),
    cap('南宋时期全国经济重心南移最终完成，广州、泉州、明州设立市舶司，海外贸易远达阿拉伯与东非。', 'With the southward shift complete, Song merchant junks guided by the magnetic compass sail from Quanzhou and Guangzhou across the Indian Ocean.', 4.2),
  ],

  genghis: [
    year(1206), title('蒙古崛起', 'Rise of the Mongols', '1206—1279年', '1206–1279'), fly(108, 45, 50, 0.85),
    { do: 'spawn', lon: 109.0, lat: 48.0, model: { kind: 'yurt' }, label: lbl('斡难河源', 'Onon River') },
    banner(109.0, 48.0, '成吉思汗', 'Genghis Khan', '#1e8449', lbl('1206年 统一蒙古', '1206 · the Mongols united')),
    cap('1206年，铁木真统一蒙古各部，号成吉思汗。', '1206: Temüjin unites the Mongols as Genghis Khan.'),
    { do: 'army', pts: [[109.0, 48.0], [107.5, 44.5], [106.6, 41.5], [106.3, 38.7]], color: '#1e8449', dur: 4, count: 50, unit: 'horse', label: lbl('蒙古铁骑', 'Mongol horse'), follow: true },
    { do: 'clash', lon: 106.23, lat: 38.49, a: '#1e8449', b: '#a04000', winner: 'a', siege: true, angle: 90, dur: 4, count: 22, units: ['horse', 'mixed'] },
    year(1227), banner(106.23, 38.49, '西夏亡', 'Western Xia falls', '#1e8449', lbl('1227年', '1227')),
    { do: 'army', pts: [[109.0, 48.0], [112.5, 44.0], [115.0, 40.5], [115.0, 37.0], [114.5, 33.3]], color: '#1e8449', dur: 4.5, count: 50, unit: 'horse', follow: true },
    { do: 'clash', lon: 114.37, lat: 33.0, a: '#1e8449', b: '#b7950b', winner: 'a', angle: 90, dur: 4, count: 22, units: ['horse', 'mixed'], formations: ['wings', 'circle'] },
    year(1234), banner(114.37, 33.0, '金亡', 'Jin falls', '#1e8449', lbl('1234年', '1234')),
    fly(112, 32, 52, 0.84),
    { do: 'fleet', pts: [[114.2, 22.0], [113.4, 21.9], [113.08, 22.1]], model: 'warship', color: '#2471a3', count: 6, dur: 3, label: lbl('崖山', 'Yamen') },
    { do: 'fx', lon: 113.08, lat: 22.1, fx: 'fire', dur: 3, par: true },
    wipe(1280, 116.4, 39.9, '#1e8449', 4),
    year(1330), { do: 'highlight', polity: 'yuan', dur: 3, par: true }, orbit(30, 4, true),
    cap('1279年崖山海战后南宋灭亡，元朝疆域空前辽阔。', '1279: the Song’s last stand at Yamen; the Yuan becomes the largest empire China had seen.', 4),
  ],

  yuan_found: [
    year(1271), title('元朝建立与统一', 'Founding of the Yuan Dynasty', '1271年定国号大元 · 1279年统一全国', '1271 named Great Yuan · 1279 China unified'),
    fly(116.4, 39.9, 28, 0.86),
    { do: 'spawn', lon: 116.4, lat: 39.9, model: { kind: 'palace', hero: 'capitals/cap_yuan', style: 'story_dadu' }, label: lbl('元大都', 'Yuan Capital Dadu') },
    banner(116.4, 39.9, '大元建国', 'Proclamation of Great Yuan', '#1e8449', lbl('1271年 · 忽必烈定国号大元', '1271 · Kublai Khan names the Great Yuan')),
    cap('1271年，忽必烈取《易经》“大哉乾元”之意改国号为大元，次年定都大都（今北京）。', '1271: Kublai Khan proclaims the Great Yuan dynasty, after “great is the Qian origin” in the Book of Changes; the next year Dadu (modern Beijing) becomes his capital.'),
    fly(116.5, 32.0, 36, 0.85, 2.0),
    { do: 'army', pts: [[112.14, 32.01], [114.3, 30.56], [118.78, 32.06], [120.16, 30.27]], color: '#1e8449', dur: 4.5, count: 40, unit: 'mixed', label: lbl('伯颜南下灭宋', 'Bayan’s Campaign'), follow: true },
    wipe(1279, 120.16, 30.27, '#1e8449', 3.8),
    year(1280),
    { do: 'highlight', polity: 'yuan', dur: 3, par: true },
    cap('1276年元军攻占临安，文天祥等继续抗元；1279年元朝完成全国统一，结束了长期多政权并立局面。', 'Taking Lin’an in 1276 and completing unification in 1279, the Yuan reunites all of China under one rule.', 4.2),
  ],

  xingsheng: [
    year(1280), title('行省制度与边疆管辖', 'Provincial System & Frontier Governance', '中书省 · 十行省 · 宣政院辖西藏 · 澎湖巡检司', 'Ten Branch Secretariats, Tibet & Taiwan under Yuan rule'),
    fly(108.0, 34.5, 48, 0.84),
    cap('元朝创立行省制度，除中书省直辖“腹里”外，全国设岭北、辽阳、河南、陕西、四川、云南等十个行中书省。', 'The Yuan creates the xingsheng (provincial) system alongside central administration over the heartland.'),
    { do: 'spawn', lon: 91.11, lat: 29.65, model: { kind: 'temple', hero: 'places-atlas/pl_sakya', style: 'story_xuanzheng' }, label: lbl('宣政院管辖西藏', 'Bureau of Buddhist & Tibetan Affairs') },
    { do: 'spawn', lon: 119.58, lat: 23.57, model: { kind: 'gate', style: 'story_penghu' }, label: lbl('澎湖巡检司', 'Penghu Inspection Office') },
    ...([
      [[116.4, 39.9], [91.11, 29.65], '#c0392b'],
      [[116.4, 39.9], [119.58, 23.57], '#2980b9'],
      [[116.4, 39.9], [102.83, 24.88], '#1e8449'],
      [[116.4, 39.9], [89.19, 42.95], '#d68910'],
    ] as [LonLat, LonLat, string][]).map(([from, to, color]): StoryStep => ({
      do: 'route', pts: [from, to], color, dur: 3.5, dashed: true, keep: true, par: true,
    })),
    { do: 'wait', dur: 3.6 },
    { do: 'highlight', polity: 'yuan', dur: 3, par: true },
    banner(116.4, 39.9, '行省制开端', 'Origin of Modern Provinces', '#1e8449', lbl('西藏、台湾正式归属中央管辖', 'Tibet & Taiwan under central administration')),
    cap('元朝设宣政院直接统辖西藏，设澎湖巡检司管辖澎湖和琉球（台湾），设北庭都元帅府管辖西域。', 'Through the Bureau of Buddhist and Tibetan Affairs and the Penghu Inspection Office, Tibet and Taiwan are administered by the central court.', 4.2),
  ],

  ming_found: [
    year(1368), title('明朝建立', 'Founding of the Ming Dynasty', '1368年 · 朱元璋应天称帝 · 北伐克大都', '1368 CE · Zhu Yuanzhang founds the Ming at Nanjing'),
    fly(117.5, 34.5, 34, 0.85),
    { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'palace', hero: 'places-cities/pl_nanjing', style: 'story_yingtian' }, label: lbl('应天府（南京）', 'Yingtian (Nanjing)') },
    banner(118.78, 32.06, '大明建国', 'Founding of the Ming', '#d4ac0d', lbl('1368年正月 · 洪武帝朱元璋', 'Jan 1368 · Hongwu Emperor')),
    cap('1368年正月，朱元璋在应天府（今南京）称帝，建立明朝，年号洪武。', 'January 1368: Zhu Yuanzhang proclaims the Ming dynasty at Yingtian (Nanjing) as the Hongwu Emperor.'),
    { do: 'army', pts: [[118.78, 32.06], [117.2, 34.26], [117.0, 36.65], [116.4, 39.9]], color: '#d4ac0d', dur: 4.5, count: 40, unit: 'mixed', label: lbl('徐达·常遇春北伐', 'Xu Da’s Northern Expedition'), follow: true },
    wipe(1368, 116.4, 39.9, '#d4ac0d', 3.8),
    { do: 'highlight', polity: 'ming', dur: 3, par: true },
    cap('同年秋，徐达、常遇春率明军攻占大都，元朝在全国的统治结束；朱元璋随后废丞相、设三司，强化皇权。', 'That autumn Xu Da takes Dadu, ending Yuan rule; Hongwu abolishes the chancellorship to centralise imperial authority.', 4.2),
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

  forbidden_city: [
    year(1420), title('营建北京城与紫禁城', 'Building Beijing & the Forbidden City', '1406—1420年 · 永乐迁都 · 中轴对称皇家宫城', '1406–1420 CE · Yongle moves the capital to Beijing'),
    fly(116.4, 39.92, 18, 0.88),
    cap('明成祖朱棣自1406年起命蒯祥等能工巧匠以元大都为基础营建北京城，经十五年建成紫禁城。', 'From 1406 the Yongle Emperor commissions master builders including Kuai Xiang to construct the Forbidden City.'),
    { do: 'route', model: { kind: 'boat' }, dur: 4, color: '#d4ac0d', keep: true, label: lbl('永乐北迁北京', 'Move North along the Canal'),
      pts: [[118.78, 32.06], [119.42, 32.39], [117.9, 34.5], [116.6, 37.4], [116.4, 39.9]] },
    year(1421),
    { do: 'spawn', lon: 116.397, lat: 39.916, model: { kind: 'palace', hero: 'capitals/cap_ming', style: 'story_forbidden_city' }, label: lbl('北京紫禁城', 'The Forbidden City') },
    { do: 'fx', lon: 116.397, lat: 39.916, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(116.397, 39.916, '紫禁城建成', 'The Forbidden City Completed', '#d4ac0d', lbl('前朝后寝 · 左祖右社 · 中轴对称', 'axial symmetry · world’s largest palace complex')),
    orbit(45, 5, true),
    cap('1421年明朝正式迁都北京；紫禁城分外朝与内廷，严格依南北中轴线对称布局，是现存规模最大的木结构宫殿建筑群。', 'In 1421 Beijing becomes the Ming capital; the Forbidden City stands as the world’s largest surviving wooden palace complex.', 4.2),
  ],

  qijiguang: [
    year(1561), title('戚继光抗倭', 'Qi Jiguang Defeats the Wokou Pirates', '1561年台州九战九捷 · 鸳鸯阵 · 封侯非我意，但愿海波平', '1561 CE · Nine victories at Taizhou with the Mandarin-Duck Formation'),
    fly(120.5, 27.6, 20, 0.88),
    cap('明朝中期东南沿海倭患严重，戚继光招募义乌矿工农民组建“戚家军”，创制步兵协同的“鸳鸯阵”。', 'To counter Wokou pirate raids, Qi Jiguang recruits Yiwu miners and farmers into the Qi Army and devises the Mandarin-Duck formation.'),
    { do: 'army', pts: [[120.08, 29.3], [120.8, 28.9], [121.42, 28.66]], color: '#c0392b', dur: 3.2, count: 28, unit: 'foot', label: lbl('戚家军', 'Qi Jiguang’s Army'), follow: true },
    { do: 'clash', lon: 121.42, lat: 28.66, a: '#c0392b', b: '#566573', winner: 'a', angle: 300, dur: 5, count: 26, labels: [lbl('戚家军鸳鸯阵', 'Qi Jiguang'), lbl('倭寇', 'Wokou Pirates')], units: ['foot', 'foot'], formations: ['wedge', 'line'] },
    banner(121.42, 28.66, '台州九战九捷', 'Nine Victories at Taizhou', '#c0392b', lbl('1561年 · 平定浙东倭患', '1561 · Zhejiang coast cleared')),
    { do: 'army', pts: [[121.42, 28.66], [120.2, 27.0], [119.3, 26.08], [119.01, 25.43]], color: '#c0392b', dur: 3.5, count: 26, unit: 'foot', label: lbl('入闽粤平倭', 'South into Fujian') },
    cap('1561年戚继光在台州九战九捷，随后与俞大猷会师南下福建、广东，基本解除东南沿海倭患。', 'After nine straight victories at Taizhou in 1561, Qi Jiguang and Yu Dayou clear Fujian and Guangdong, restoring peace to the coast.', 4.2),
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

  li_zicheng: [
    year(1644), title('李自成起义与明亡清入关', 'Li Zicheng & the Ming–Qing Transition', '1644年 · 均田免赋 · 大顺军攻克北京', '1644 CE · Fall of the Ming and Qing entry through Shanhai Pass'),
    fly(113.5, 37.5, 28, 0.85),
    cap('明末政治腐败、灾荒连年，李自成提出“均田免赋”口号，1644年初在西安建立大顺政权，挥师东进。', 'Rallying peasants under “Equal Land and No Taxes”, Li Zicheng proclaims the Dashun regime at Xi’an and marches on Beijing.'),
    { do: 'army', pts: [[108.94, 34.27], [111.2, 36.0], [112.55, 37.87], [113.3, 40.09], [116.4, 39.9]], color: RED, dur: 4.5, count: 38, unit: 'mixed', label: lbl('李自成大顺军', 'Li Zicheng'), follow: true },
    { do: 'fx', lon: 116.4, lat: 39.9, fx: 'flag', color: RED },
    banner(116.4, 39.9, '甲申之变', 'Fall of Ming Beijing', RED, lbl('1644年4月 · 崇祯帝自缢煤山', 'April 1644 · Chongzhen Emperor dies on Jingshan')),
    fly(118.5, 40.2, 22, 0.88, 1.8),
    { do: 'army', pts: [[123.43, 41.8], [121.1, 41.1], [119.75, 40.0]], color: '#8e44ad', dur: 3.2, count: 36, unit: 'horse', label: lbl('多尔衮八旗清军', 'Qing Eight Banners') },
    { do: 'clash', lon: 119.75, lat: 40.0, a: '#8e44ad', b: RED, winner: 'a', angle: 210, dur: 4.8, count: 28, labels: [lbl('清军与吴三桂', 'Qing & Wu Sangui'), lbl('大顺军', 'Dashun')], units: ['horse', 'mixed'] },
    wipe(1644, 116.4, 39.9, '#8e44ad', 3.8),
    cap('1644年4月李自成攻占北京，明朝灭亡；镇守山海关的吴三桂降清，清军入关击败李自成并迁都北京。', 'After Li Zicheng takes Beijing, general Wu Sangui opens Shanhai Pass to the Manchu Eight Banners, who enter and make Beijing the Qing capital.', 4.2),
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

  zungar: [
    year(1690), title('平定准噶尔与大小和卓叛乱', 'Pacification of the Dzungars & Khojas', '康熙至乾隆 · 乌兰布通 · 设伊犁将军', '1690–1762 CE · Securing the Northwest & Establishing the General of Ili'),
    fly(102.0, 42.5, 46, 0.84),
    cap('清朝前期，漠西蒙古准噶尔部噶尔丹在沙俄唆使下叛乱；1690年康熙帝三次亲征，在乌兰布通、昭莫多击败噶尔丹。', 'When Galdan of the Dzungars rebels, the Kangxi Emperor personally leads three campaigns, defeating him at Ulan Butung and Jao Modo.'),
    { do: 'army', pts: [[116.4, 39.9], [116.8, 41.4], [117.1, 42.6]], color: '#8e44ad', dur: 3.2, count: 32, unit: 'horse', label: lbl('康熙亲征清军', 'Kangxi Campaign') },
    { do: 'clash', lon: 117.1, lat: 42.6, a: '#8e44ad', b: '#a04000', winner: 'a', angle: 90, dur: 4.5, count: 26, labels: [lbl('清军火器营', 'Qing'), lbl('噶尔丹', 'Galdan')], units: ['horse', 'horse'] },
    banner(117.1, 42.6, '乌兰布通之战', 'Battle of Ulan Butung', '#8e44ad', lbl('1690年 · 康熙亲征', '1690 · Kangxi defeats Galdan')),
    year(1757),
    fly(84.5, 42.5, 34, 0.85, 2.2),
    { do: 'army', pts: [[94.66, 40.14], [89.19, 42.95], [81.32, 43.92]], color: '#8e44ad', dur: 4, count: 34, unit: 'horse', label: lbl('乾隆平定西域', 'Qianlong Northwest Campaign') },
    year(1762),
    { do: 'spawn', lon: 81.32, lat: 43.92, model: { kind: 'gate', style: 'story_ili_general' }, label: lbl('伊犁将军府（惠远城）', 'General of Ili at Huiyuan') },
    { do: 'highlight', polity: 'qing', dur: 3.5, par: true },
    banner(81.32, 43.92, '设立伊犁将军', 'General of Ili Established', '#8e44ad', lbl('1762年 · 管辖包括巴尔喀什湖在内的整个新疆', '1762 · governing all of Xinjiang')),
    cap('乾隆帝彻底平定准噶尔部及回部大小和卓叛乱，1762年设伊犁将军，1771年土尔扈特部万里东归，西北边疆稳固。', 'Qianlong pacifies the Dzungars and Khojas, establishes the General of Ili in 1762, and welcomes the Torghuts home in 1771.', 4.5),
  ],

  humen: [
    title('虎门销烟', 'Destruction of Opium at Humen', '1839年6月 · 苟利国家生死以', 'June 1839 · Lin Zexu destroys the opium at Humen'), year(1839), fly(113.67, 22.82, 8, 0.95),
    { do: 'spawn', lon: 113.67, lat: 22.82, model: { kind: 'cannon' }, label: lbl('虎门', 'Humen') },
    cap('1839年6月3日至25日，钦差大臣林则徐在虎门海滩筑池引卤水、投石灰，当众销毁收缴的鸦片。', 'June 1839: Imperial Commissioner Lin Zexu dissolves over two million catties of confiscated opium in seawater-and-lime trenches at Humen.'),
    { do: 'fx', lon: 113.67, lat: 22.82, fx: 'smoke', dur: 5, par: true },
    banner(113.67, 22.82, '虎门销烟', 'Opium Destroyed at Humen', '#c0392b', lbl('销毁鸦片237万余斤', 'over 1,100 tonnes destroyed in 23 days')),
    orbit(45, 4, true),
    cap('历时23天，共销毁鸦片110多万千克，显示了中华民族反抗外来侵略的坚强意志。', 'Lasting 23 days, the destruction at Humen demonstrates the Chinese nation’s resolve to resist foreign aggression.', 4),
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

  taiping: [
    year(1851), title('太平天国运动', 'The Taiping Rebellion', '1851—1864年 · 金田起义 · 定都天京', '1851–1864 CE · Jintian Uprising to Tianjing'),
    fly(113.5, 27.5, 34, 0.85),
    cap('1851年1月，洪秀全在广西桂平金田村发动武装起义，建号太平天国。', 'January 1851: Hong Xiuquan launches the Jintian Uprising in Guangxi, proclaiming the Taiping Heavenly Kingdom.'),
    { do: 'fx', lon: 110.08, lat: 23.52, fx: 'flag', color: RED },
    banner(110.08, 23.52, '金田起义', 'Jintian Uprising', RED, lbl('1851年1月', 'January 1851')),
    { do: 'army', pts: [[110.08, 23.52], [110.29, 25.27], [112.94, 28.23], [114.3, 30.56], [117.0, 30.5], [118.78, 32.06]], color: RED, dur: 6, count: 40, unit: 'mixed', label: lbl('太平军北进东征', 'Taiping Army'), keep: true, follow: true },
    year(1853),
    { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'scroll' }, label: lbl('《天朝田亩制度》', 'Land System of the Heavenly Dynasty') },
    banner(118.78, 32.06, '定都天京', 'Capital at Tianjing', RED, lbl('1853年 · 颁布《天朝田亩制度》', '1853 · Nanjing renamed Tianjing')),
    year(1864),
    { do: 'clash', lon: 118.78, lat: 32.06, a: '#8e44ad', b: RED, winner: 'a', siege: true, angle: 45, dur: 4.5, count: 28, labels: [lbl('湘军·洋枪队', 'Qing & Ever-Victorious Army'), lbl('太平军', 'Taiping')] },
    cap('1853年太平军攻占南京改名天京；历经天京事变与中外反动势力联合镇压，1864年天京陷落，沉重打击了清朝统治和外国侵略势力。', 'Establishing their capital at Tianjing in 1853, the Taiping shake Qing rule across 18 provinces before falling in 1864.', 4.5),
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
    title('沙俄侵占中国领土', 'Russian Annexations', '1858—1881年 · 割占150多万平方千米', '1858–1881 · Over 1.5 million km² annexed'), year(1857), fly(124, 44, 48, 0.85),
    cap('第二次鸦片战争前后，沙俄趁火打劫，强迫清政府签订《瑷珲条约》《北京条约》等一系列不平等条约。', 'During the Second Opium War, Tsarist Russia forces the treaties of Aigun and Peking on the Qing court.'),
    { do: 'spawn', lon: 127.48, lat: 50.25, model: { kind: 'scroll' }, label: lbl('1858《瑷珲条约》', 'Treaty of Aigun (1858)') },
    banner(127.48, 50.25, '《瑷珲条约》与《北京条约》', 'Treaties of Aigun & Peking', '#566573', lbl('外兴安岭以南、乌苏里江以东', 'Amur & Maritime provinces')),
    year(1901), { do: 'highlight', polity: 'russia', dur: 4 },
    cap('沙俄共割占中国东北和西北领土150多万平方千米，是近代侵占中国领土最多的国家。', 'In all, Tsarist Russia annexes over 1.5 million km² of Chinese territory in the north-east and north-west.', 4),
  ],

  yangwu: [
    year(1865), title('洋务运动', 'Self-Strengthening Movement', '19世纪60—90年代 · 自强 · 求富', '1860s–1890s · “Self-Strengthening” & “Seeking Wealth”'),
    fly(118.5, 31.0, 32, 0.85),
    cap('19世纪60年代起，奕䜣、曾国藩、李鸿章、左宗棠、张之洞等以“自强”为口号创办近代军事工业。', 'From the 1860s, Zeng Guofan, Li Hongzhang, Zuo Zongtang and Zhang Zhidong launch modern arsenals and shipyards.'),
    { do: 'spawn', lon: 121.47, lat: 31.23, model: { kind: 'factory', style: 'story_jiangnan_arsenal' }, label: lbl('江南机器制造总局·轮船招商局', 'Jiangnan Arsenal & China Merchants') },
    { do: 'spawn', lon: 119.3, lat: 26.08, model: { kind: 'warship', style: 'story_fuzhou_shipyard' }, label: lbl('福州船政局', 'Fuzhou Navy Yard') },
    { do: 'spawn', lon: 114.3, lat: 30.56, model: { kind: 'train', style: 'story_hanyang_iron' }, label: lbl('汉阳铁厂', 'Hanyang Ironworks') },
    ...([
      [117.2, 39.13, '北洋水师', 'Beiyang Fleet'],
      [121.47, 31.23, '江南制造总局', 'Jiangnan Arsenal'],
      [119.3, 26.08, '福州船政局', 'Fuzhou Shipyard'],
      [114.3, 30.56, '汉阳铁厂', 'Hanyang Ironworks'],
    ] as [number, number, string, string][]).map(([lon, lat, zh, en]): StoryStep => ({
      do: 'banner', lon, lat, text: lbl(zh, en), color: '#2874a6', dur: 3.5, par: true,
    })),
    { do: 'wait', dur: 3.6 },
    orbit(35, 4.2, true),
    cap('70年代起又以“求富”为口号开办轮船招商局、开平煤矿、汉阳铁厂，筹建北洋舰队，客观上促进了中国民族资本主义产生。', 'Adding civilian steamships, mines and ironworks under “Seeking Wealth”, the movement lays the foundations of modern Chinese industry.', 4.2),
  ],

  zuo_xinjiang: [
    year(1876), title('左宗棠收复新疆', 'Zuo Zongtang Recovers Xinjiang', '1876—1878年 · 抬棺出征 · 1884年新疆建省', '1876–1884 CE · “First the North, Then the South” & Xinjiang Province'),
    fly(92.0, 40.5, 42, 0.84),
    cap('1865年阿古柏侵入新疆，沙俄强占伊犁；1875年清廷命左宗棠为钦差大臣督办新疆军务，年逾六旬的左宗棠抬棺西征。', 'When Yakub Beg invades Xinjiang and Russia seizes Ili, sixty-three-year-old Zuo Zongtang marches west with his own coffin.'),
    { do: 'army', pts: [[103.8, 36.06], [98.5, 39.7], [93.5, 42.8], [87.62, 43.82]], color: '#8e44ad', dur: 4.5, count: 36, unit: 'mixed', label: lbl('左宗棠·刘锦棠西征军', 'Zuo Zongtang’s Army'), keep: true, follow: true },
    banner(87.62, 43.82, '先北后南 · 缓进急战', 'North First, Then South', '#8e44ad', lbl('1876年收复乌鲁木齐', '1876 · Urumqi recovered')),
    { do: 'army', pts: [[87.62, 43.82], [86.15, 41.77], [80.26, 41.17], [75.99, 39.47]], color: '#8e44ad', dur: 4, count: 32, unit: 'horse', keep: true, follow: true },
    year(1878),
    { do: 'fx', lon: 75.99, lat: 39.47, fx: 'flag', color: '#8e44ad' },
    banner(75.99, 39.47, '收复新疆南北两路', 'Xinjiang Recovered', '#8e44ad', lbl('1884年设立新疆行省', '1884 · Xinjiang made a province')),
    year(1884),
    cap('清军采取“先北后南，缓进急战”方略收复除伊犁外新疆全境，1881年收回伊犁，1884年清政府在新疆建立行省。', 'Using “North first, then South; slow advance, swift battle”, Zuo recovers Xinjiang by 1878; Ili returns in 1881 and Xinjiang becomes a province in 1884.', 4.5),
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

  baguo: [
    year(1900), title('义和团运动与八国联军侵华', 'Boxer Movement & Eight-Nation Alliance', '1900—1901年 · 廊坊阻击战 · 《辛丑条约》', '1900–1901 · Invasion of Beijing & the Boxer Protocol'),
    fly(117.1, 39.4, 16, 0.88),
    cap('1900年夏，英、美、俄、日、法、德、意、奥八国联军由大沽口登陆进犯北京，义和团与清军在廊坊、天津浴血阻击。', 'Summer 1900: the Eight-Nation Alliance lands at Taku and marches on Beijing, met by fierce resistance at Langfang and Tianjin.'),
    { do: 'army', pts: [[117.7, 38.98], [117.2, 39.13], [116.7, 39.52]], color: '#566573', dur: 3.5, count: 32, unit: 'mixed', label: lbl('八国联军', 'Eight-Nation Alliance') },
    { do: 'clash', lon: 116.7, lat: 39.52, a: RED, b: '#566573', winner: 'a', angle: 140, dur: 4.5, count: 24, labels: [lbl('义和团与清军', 'Boxers & Qing'), lbl('西摩尔联军', 'Seymour Column')] },
    banner(116.7, 39.52, '廊坊大捷', 'Battle of Langfang', RED, lbl('挫败西摩尔联军', 'Seymour expedition forced back')),
    { do: 'army', pts: [[117.2, 39.13], [116.8, 39.6], [116.4, 39.9]], color: '#566573', dur: 3, count: 36, unit: 'mixed' },
    { do: 'fx', lon: 116.4, lat: 39.9, fx: 'fire', dur: 3.5, par: true },
    year(1901),
    { do: 'spawn', lon: 116.4, lat: 39.9, model: { kind: 'scroll' }, label: lbl('1901《辛丑条约》', 'Boxer Protocol (1901)') },
    banner(116.4, 39.9, '《辛丑条约》', 'The Boxer Protocol', '#7b241c', lbl('赔款白银4.5亿两 · 划定东交民巷使馆界', '450M taels indemnity · semi-colonial abyss')),
    cap('1900年8月八国联军攻陷北京；1901年清政府被迫签订《辛丑条约》，中国完全陷入半殖民地半封建社会的深渊。', 'Beijing falls in August 1900; the 1901 Boxer Protocol imposes a 450-million-tael indemnity, reducing China to complete semi-colonial status.', 4.5),
  ],

  jingzhang: [
    year(1905), title('詹天佑与京张铁路', 'Zhan Tianyou & the Jingzhang Railway', '1905—1909年 · 中国人自行设计修建的第一条干线铁路', '1905–1909 · First trunk railway designed and built by Chinese engineers'),
    fly(115.6, 40.35, 14, 0.88),
    cap('1905年，詹天佑任总工程师主持修建北京至张家口的京张铁路，穿越军都山崇山峻岭。', '1905: Chief Engineer Zhan Tianyou leads the construction of the Beijing–Zhangjiakou Railway across the rugged Jundu Mountains.'),
    { do: 'route', model: { kind: 'train', style: 'story_jingzhang_loco' }, dur: 6, color: '#2c3e50', keep: true, label: lbl('京张铁路“人”字形线路', 'Zigzag Switchback Track'),
      pts: [[116.35, 39.92], [116.12, 40.22], [116.01, 40.36], [115.98, 40.33], [115.88, 40.42], [115.4, 40.55], [114.88, 40.77]] },
    year(1909),
    { do: 'spawn', lon: 116.01, lat: 40.36, model: { kind: 'train', style: 'story_qinglongqiao' }, label: lbl('青龙桥车站', 'Qinglongqiao Station') },
    { do: 'fx', lon: 116.01, lat: 40.36, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(116.01, 40.36, '“人”字形轨道与竖井开凿法', 'Switchback Track & Vertical Shafts', '#2980b9', lbl('1909年提前两年全线通车', 'completed two years ahead of schedule in 1909')),
    orbit(40, 4.2, true),
    cap('詹天佑独创“竖井开凿法”打通居庸关与八达岭隧道，设计青龙桥“人”字形轨道，1909年提前两年全线通车。', 'Using vertical shafts for the Badaling tunnel and a clever zigzag switchback at Qinglongqiao, the line opens in 1909 ahead of schedule.', 4.2),
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
    title('五四运动', 'The May Fourth Movement', '1919年5月4日 · 新民主主义革命开端', '4 May 1919 · Dawn of New Democratic Revolution'), year(1919), fly(116.39, 39.9, 8, 0.95),
    { do: 'spawn', lon: 116.39, lat: 39.905, model: { kind: 'gate', style: 'tiananmen' }, label: lbl('天安门', 'Tiananmen') },
    { do: 'fx', lon: 116.39, lat: 39.9, fx: 'flag', color: '#ecf0f1' },
    banner(116.39, 39.905, '外争主权，内除国贼', 'Defend Sovereignty, Punish Traitors', '#c0392b', lbl('1919年5月4日 · 北京学生游行', '4 May 1919 · Beijing students rally')),
    cap('巴黎和会外交失败消息传来，1919年5月4日北京三千多名学生在天安门前集会游行。', '4 May 1919: outraged by the Paris Peace Conference decision on Shandong, Beijing students rally at Tiananmen.'),
    fly(118.8, 35.0, 36, 0.85, 2.0),
    { do: 'route', dur: 3, color: '#c0392b', dashed: true, keep: true, pts: [[116.39, 39.9], [117.2, 39.13], [117.0, 36.65], [121.47, 31.23]] },
    { do: 'fx', lon: 121.47, lat: 31.23, fx: 'flag', color: '#c0392b' },
    banner(121.47, 31.23, '工人罢工 · 商人罢市 · 学生罢课', 'Workers, Merchants & Students Unite', '#c0392b', lbl('6月运动中心移至上海', 'June · Shanghai becomes the centre')),
    cap('6月起上海工人罢工、商人罢市，工人阶级登上政治舞台，北洋政府被迫释放被捕学生并拒签和约。', 'In June Shanghai workers strike and merchants shutter shops; the Chinese delegation refuses to sign the Versailles Treaty.', 4.2),
  ],

  cpc_found: [
    title('中国共产党成立', 'Founding of the CPC', '1921年7月 · 开天辟地的大事变', 'July 1921 · Shanghai & the South Lake Red Boat'), year(1921), fly(121.1, 31.0, 8, 0.95),
    { do: 'spawn', lon: 121.47, lat: 31.23, model: { kind: 'monument', style: 'shikumen' }, label: lbl('中共一大会址', 'Site of the 1st Congress') },
    banner(121.47, 31.23, '上海望志路106号', '106 Wangzhi Road, Shanghai', '#c0392b', lbl('1921年7月23日开幕', '23 July 1921')),
    cap('1921年7月23日，中国共产党第一次全国代表大会在上海秘密召开。', '23 July 1921: the First National Congress of the CPC opens in a Shanghai shikumen house.'),
    { do: 'route', dur: 3, color: '#c0392b', dashed: true, keep: true, pts: [[121.47, 31.23], [121.0, 31.0], [120.75, 30.75]] },
    { do: 'spawn', lon: 120.75, lat: 30.75, model: { kind: 'redboat' }, label: lbl('南湖红船', 'The Red Boat') },
    { do: 'fx', lon: 120.75, lat: 30.75, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(120.75, 30.75, '开天辟地的大事变', 'An Epoch-Making Event', '#c0392b', lbl('嘉兴南湖红船', 'South Lake, Jiaxing')),
    orbit(35, 4, true),
    cap('会议最后一天转移到浙江嘉兴南湖的一艘游船上举行，庄严宣告中国共产党诞生，中国革命的面貌从此焕然一新。', 'Moving its final session to a boat on South Lake in Jiaxing, the Congress proclaims the founding of the Communist Party of China.', 4.2),
  ],

  beifa: [
    year(1926), title('北伐战争', 'The Northern Expedition', '1926—1928年 · 国共合作打倒列强除军阀', '1926–1928 · First United Front against the warlords'), fly(114, 27, 42, 0.85),
    cap('1926年7月，国民革命军十万人从广州誓师北伐，讨伐吴佩孚、孙传芳、张作霖三大军阀。', 'July 1926: 100,000 National Revolutionary Army troops march north from Guangzhou against the Beiyang warlords.'),
    { do: 'army', pts: [[113.26, 23.13], [113.0, 25.5], [112.94, 28.23], [113.6, 29.6], [114.2, 30.4]], color: '#2e86c1', dur: 5, count: 36, label: lbl('国民革命军', 'National Revolutionary Army'), follow: true },
    { do: 'clash', lon: 114.0, lat: 29.75, a: '#2e86c1', b: '#7f8c8d', winner: 'a', angle: 90, dur: 4.5, count: 24, labels: [lbl('叶挺独立团', 'Ye Ting’s Regiment'), lbl('吴佩孚主力', 'Wu Peifu')] },
    banner(114.0, 29.75, '汀泗桥·贺胜桥大捷', 'Tingsiqiao & Heshengqiao', '#2e86c1', lbl('第四军“铁军”威名远扬', 'the “Iron Army”')),
    { do: 'clash', lon: 114.3, lat: 30.56, a: '#2e86c1', b: '#7f8c8d', winner: 'a', siege: true, angle: 270, dur: 4.5, count: 24, labels: [lbl('北伐军', 'NRA'), lbl('武昌守军', 'Wuchang Garrison')] },
    banner(114.3, 30.59, '攻克武昌', 'Wuchang Captured', '#2e86c1'),
    { do: 'army', from: [113.26, 23.13], to: [115.86, 28.68], color: '#2e86c1', dur: 2.5, count: 20, par: true },
    { do: 'army', from: [115.86, 28.68], to: [118.78, 32.06], color: '#2e86c1', dur: 2.5, count: 20 },
    cap('叶挺独立团连克汀泗桥、贺胜桥并攻占武昌；北伐军不到半年从珠江流域推进到长江流域，基本推翻北洋军阀统治。', 'Winning key battles at Tingsiqiao and Wuchang, the expedition sweeps from the Pearl River to the Yangtze in months.', 4.2),
  ],

  nanchang: [
    year(1927), title('南昌起义', 'The Nanchang Uprising', '1927年8月1日 · 打响武装反抗国民党反动派第一枪', '1 August 1927 · Birth of the People’s Army'),
    fly(115.86, 28.68, 12, 0.9),
    cap('1927年8月1日凌晨，周恩来、贺龙、叶挺、朱德、刘伯承等领导革命军在南昌发动武装起义。', 'At dawn on 1 August 1927, Zhou Enlai, He Long, Ye Ting, Zhu De and Liu Bocheng lead an armed uprising in Nanchang.'),
    { do: 'clash', lon: 115.86, lat: 28.68, a: RED, b: '#2e86c1', winner: 'a', siege: true, angle: 220, dur: 5, count: 26, labels: [lbl('起义军', 'Insurgent Troops'), lbl('国民党守军', 'KMT Garrison')] },
    { do: 'fx', lon: 115.86, lat: 28.68, fx: 'flag', color: RED },
    banner(115.86, 28.68, '八一南昌起义', 'Nanchang Uprising', RED, lbl('人民军队诞生的标志', 'First shot of armed resistance')),
    { do: 'army', pts: [[115.86, 28.68], [116.35, 27.95], [116.6, 26.1], [116.63, 23.66]], color: RED, dur: 3.8, count: 24, unit: 'foot', label: lbl('起义军南下', 'March South') },
    cap('南昌起义打响了武装反抗国民党反动派的第一枪，标志着中国共产党独立领导革命战争、创建人民军队的开端。', 'Firing the first shot of armed resistance, 1 August becomes the founding day of the People’s Liberation Army.', 4.2),
  ],

  jinggang: [
    year(1927), title('秋收起义与井冈山会师', 'Autumn Harvest & Jinggangshan', '1927年10月—1928年4月 · 农村包围城市、武装夺取政权', '1927–1928 · The first rural revolutionary base & Zhu–Mao reunion'),
    fly(114.1, 27.3, 18, 0.88),
    cap('1927年9月毛泽东领导湘赣边界秋收起义，经三湾改编后率工农革命军向罗霄山脉中段的井冈山进军。', 'September 1927: after the Autumn Harvest Uprising and Sanwan Reorganisation, Mao Zedong leads his troops into the Jinggang Mountains.'),
    { do: 'army', pts: [[113.85, 28.15], [113.95, 27.62], [113.97, 26.86], [114.17, 26.57]], color: RED, dur: 4, count: 24, unit: 'foot', label: lbl('秋收起义部队（毛泽东）', 'Mao Zedong'), keep: true },
    year(1928),
    { do: 'army', pts: [[113.03, 25.8], [113.65, 26.25], [114.17, 26.57]], color: RED, dur: 3.5, count: 24, unit: 'foot', label: lbl('南昌起义余部（朱德·陈毅）', 'Zhu De & Chen Yi'), keep: true },
    { do: 'spawn', lon: 114.17, lat: 26.57, model: { kind: 'monument', hero: 'places-sites/pl_jinggangshan', style: 'story_jinggang' }, label: lbl('井冈山革命根据地', 'Jinggangshan Base Area') },
    { do: 'fx', lon: 114.17, lat: 26.57, fx: 'flag', color: RED },
    banner(114.17, 26.57, '井冈山会师', 'Reunion at Jinggangshan', RED, lbl('1928年4月 · 中国工农红军第四军', 'April 1928 · 4th Red Army formed')),
    orbit(36, 4, true),
    cap('1928年4月朱德、陈毅率部与毛泽东在井冈山胜利会师，合编为中国工农红军第四军，开辟了“农村包围城市、武装夺取政权”的道路。', 'In April 1928 Zhu De and Mao Zedong join forces to form the Fourth Red Army, pioneering the path of encircling cities from the countryside.', 4.5),
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
    year(1931), title('九一八事变', 'The Mukden Incident', '1931年9月18日 · 中国人民局部抗战的起点', '18 September 1931 · Start of China’s fourteen-year War of Resistance'), fly(123.6, 42.5, 22, 0.85),
    { do: 'fx', lon: 123.43, lat: 41.85, fx: 'battle', dur: 2.5 },
    banner(123.43, 41.85, '柳条湖事件 · 炮轰北大营', 'Liutiao Lake & Beidaying', JP, lbl('1931年9月18日夜', 'Night of 18 September 1931')),
    cap('1931年9月18日夜，日本关东军炸毁沈阳柳条湖附近南满铁路，反诬中国军队所为，悍然炮轰北大营。', 'Night of 18 September 1931: Japanese Kwantung troops blow up a railway track near Liutiao Lake and shell the Beidaying barracks in Shenyang.'),
    fly(125, 44, 38, 0.85, 1.6),
    { do: 'army', from: [123.43, 41.8], to: [125.32, 43.82], color: JP, dur: 3, count: 26, unit: 'mixed', label: lbl('日军关东军', 'Kwantung Army'), par: true },
    { do: 'army', from: [123.43, 41.8], to: [126.63, 45.75], color: JP, dur: 4, count: 26, unit: 'mixed' },
    { do: 'fx', lon: 126.63, lat: 45.75, fx: 'flag', color: RED },
    banner(126.63, 45.75, '东北抗日联军', 'Northeast Anti-Japanese United Army', RED, lbl('杨靖宇 · 赵尚志 · 白山黑水抗战', 'guerrilla resistance in the Northeast')),
    cap('短短四个多月东北三省沦陷；中国共产党派杨靖宇等组织东北抗日游击队，揭开了世界反法西斯战争的序幕。', 'As the three north-eastern provinces fall, Yang Jingyu and resistance fighters wage guerrilla war in the forests and snow.', 4.2),
  ],

  xian_incident: [
    year(1936), title('西安事变', 'The Xi’an Incident', '1936年12月12日 · 停止内战，一致抗日', '12 December 1936 · Turning point toward the Anti-Japanese United Front'),
    fly(109.1, 34.32, 12, 0.9),
    cap('1936年12月12日，张学良、杨虎城为挽救民族危亡，在西安华清池发动“兵谏”，扣留蒋介石，通电全国要求停止内战、联共抗日。', '12 December 1936: Generals Zhang Xueliang and Yang Hucheng detain Chiang Kai-shek at Lintong, demanding an end to civil war and united resistance against Japan.'),
    { do: 'fx', lon: 109.21, lat: 34.36, fx: 'battle', dur: 2.2 },
    banner(109.21, 34.36, '张学良·杨虎城发动兵谏', 'Remonstrance by Arms at Huaqing Pool', '#2e86c1', lbl('1936年12月12日', '12 December 1936')),
    fly(108.94, 34.8, 18, 0.86, 1.8),
    { do: 'route', dur: 3.2, color: RED, dashed: true, keep: true, label: lbl('周恩来率中共代表团赴西安谈判', 'Zhou Enlai flies to Xi’an'),
      pts: [[109.49, 36.59], [109.2, 35.4], [108.94, 34.27]] },
    { do: 'fx', lon: 108.94, lat: 34.27, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(108.94, 34.27, '西安事变和平解决', 'Peaceful Resolution', RED, lbl('抗日民族统一战线初步形成', 'United Front preliminarily formed')),
    cap('中国共产党从全民族利益出发，派周恩来等到西安调停；西安事变的和平解决，揭开了国共两党由内战到联合抗日的序幕。', 'With Zhou Enlai mediating on behalf of the CPC, the incident is resolved peacefully, forging the Anti-Japanese National United Front.', 4.5),
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

  pingxingguan: [
    year(1937), title('平型关大捷', 'Victory at Pingxingguan', '1937年9月25日 · 全民族抗战以来中国军队首个大捷', '25 September 1937 · The 115th Division shatters the myth of Japanese invincibility'),
    fly(113.9, 39.3, 12, 0.9),
    cap('1937年9月，日军板垣师团进犯山西平型关；八路军第115师在林彪率领下于平型关东北乔沟设伏。', 'September 1937: Lin Biao’s 115th Division of the Eighth Route Army lays an ambush along the Qiaogou ravine at Pingxing Pass.'),
    { do: 'spawn', lon: 113.96, lat: 39.3, model: { kind: 'gate', hero: 'places-sites/pl_pingxingguan', style: 'story_pingxingguan' }, label: lbl('平型关乔沟伏击阵地', 'Pingxing Pass Ravine') },
    { do: 'army', pts: [[114.4, 39.5], [114.15, 39.38], [113.96, 39.3]], color: JP, dur: 3, count: 24, unit: 'mixed', label: lbl('日军板垣师团第21旅团', 'Itagaki’s 5th Division, 21st Brigade') },
    { do: 'clash', lon: 113.96, lat: 39.3, a: RED, b: JP, winner: 'a', angle: 310, dur: 5.5, count: 30, labels: [lbl('八路军第115师', '8th Route Army 115th Div'), lbl('日军车队', 'Japanese Column')], units: ['foot', 'mixed'], formations: ['wings', 'line'] },
    banner(113.96, 39.3, '平型关大捷', 'Victory at Pingxingguan', RED, lbl('歼敌1000余人 · 打破日军“不可战胜”神话', 'over 1,000 enemy troops eliminated')),
    cap('八路军第115师居高临下猛攻，歼灭日军1000余人，取得全民族抗战爆发以来中国军队的第一个重大胜利。', 'Striking from the heights above the ravine, the 115th Division eliminates over 1,000 Japanese troops in China’s first major victory of the war.', 4.2),
  ],

  taierzhuang: [
    year(1938), title('台儿庄战役', 'Battle of Taierzhuang', '1938年3—4月 · 抗战以来中国正面战场最大一场胜仗', 'March–April 1938 · Li Zongren’s decisive victory at Taierzhuang'),
    fly(117.73, 34.56, 14, 0.88),
    cap('1938年春，日军南北夹击徐州；第五战区司令长官李宗仁指挥中国军队在山东枣庄台儿庄内外合围日军。', 'Spring 1938: defending Xuzhou, Fifth War Zone commander Li Zongren draws Japanese forces into a trap at the canal town of Taierzhuang.'),
    { do: 'army', pts: [[117.55, 35.1], [117.65, 34.8], [117.73, 34.58]], color: JP, dur: 3, count: 28, unit: 'mixed', label: lbl('日军矶谷·坂本支队', 'Japanese 10th Division') },
    { do: 'spawn', lon: 117.73, lat: 34.56, model: { kind: 'gate', hero: 'places-sites/pl_taierzhuang', style: 'story_taierzhuang' }, label: lbl('台儿庄古城', 'Taierzhuang Walled Town') },
    { do: 'clash', lon: 117.73, lat: 34.56, a: '#2e86c1', b: JP, winner: 'a', siege: true, angle: 90, dur: 6, count: 32, labels: [lbl('孙连仲·汤恩伯中国军队', 'Chinese 5th War Zone'), lbl('日军精锐', 'Japanese Forces')], units: ['mixed', 'mixed'], formations: ['circle', 'square'] },
    banner(117.73, 34.56, '台儿庄大捷', 'Victory at Taierzhuang', '#2e86c1', lbl('歼敌一万余人 · 振奋全国抗战信心', 'over 10,000 enemy casualties')),
    cap('中国守军在台儿庄城内逐街逐屋浴血巷战，外线部队完成反包围，共歼敌一万余人，极大振奋了全国军民抗战信心。', 'After weeks of house-to-house combat and an outer encirclement, Chinese forces inflict over 10,000 casualties on the Japanese.', 4.2),
  ],

  baituan: [
    year(1940), title('百团大战', 'The Hundred Regiments Offensive', '1940年8月—1941年1月 · 粉碎日军“囚笼政策”', 'Aug 1940 – Jan 1941 · 105 regiments strike across North China'),
    fly(113.5, 37.8, 22, 0.86),
    cap('1940年下半年，为粉碎日军对敌后抗日根据地的“囚笼政策”，彭德怀指挥八路军105个团在华北发动百团大战。', 'August 1940: to break Japan’s “cage policy”, Peng Dehuai orders 105 regiments of the Eighth Route Army into action across North China.'),
    ...([
      [113.86, 38.02, '娘子关正太铁路破袭', 'Niangzi Pass & Zhengtai Line'],
      [112.55, 37.87, '同蒲铁路破袭', 'Tongpu Railway Raid'],
      [114.51, 38.04, '平汉铁路破袭', 'Pinghan Railway Raid'],
      [112.95, 36.75, '关家垴激战', 'Battle of Guanjianao'],
    ] as [number, number, string, string][]).flatMap(([lon, lat, zh, en]): StoryStep[] => [
      { do: 'fx', lon, lat, fx: 'battle', dur: 3.5, par: true },
      { do: 'banner', lon, lat, text: lbl(zh, en), color: RED, dur: 3.8, par: true },
    ]),
    { do: 'clash', lon: 113.6, lat: 37.85, a: RED, b: JP, winner: 'a', angle: 270, dur: 5, count: 32, labels: [lbl('八路军百团雄师', '8th Route Army'), lbl('华北日军', 'North China Area Army')] },
    orbit(35, 4, true),
    cap('百团大战作战1800余次，毙伤日伪军2.5万多人，破坏交通线2000多千米，提高了共产党和八路军的威望。', 'In over 1,800 engagements, the Eighth Route Army destroys 2,000 km of rail and road lines, shattering Japan’s blockade of the base areas.', 4.2),
  ],

  victory1945: [
    year(1945), title('抗日战争伟大胜利', 'Victory in the War of Resistance', '1945年8月15日日本投降 · 9月2日签署投降书 · 台湾光复', 'August–October 1945 · Japan surrenders & Taiwan returns to China'),
    fly(114.5, 32.5, 44, 0.84),
    cap('1945年8月，中国抗日战场展开全面大反攻；8月15日日本天皇宣布无条件投降，9月9日中国战区受降仪式在南京举行。', 'August 1945: Chinese forces launch a general counter-offensive; Japan announces unconditional surrender on 15 August and signs at Nanjing on 9 September.'),
    ...([
      [109.49, 36.59, '#de2910'],
      [118.78, 32.06, '#e74c3c'],
      [106.55, 29.56, '#f1c40f'],
      [116.40, 39.90, '#e74c3c'],
      [121.47, 31.23, '#f1c40f'],
      [121.56, 25.03, '#de2910'],
    ] as [number, number, string][]).map(([lon, lat, color]): StoryStep => ({
      do: 'fx', lon, lat, fx: 'firework', color, par: true,
    })),
    { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'scroll' }, label: lbl('南京受降仪式', 'Surrender Ceremony at Nanjing') },
    { do: 'fx', lon: 121.56, lat: 25.03, fx: 'flag', color: '#c0392b' },
    banner(118.78, 32.06, '抗日战争伟大胜利', 'Victory After Fourteen Years', '#c0392b', lbl('1945年9月 · 台湾回到祖国怀抱', 'Sep–Oct 1945 · Taiwan restored to China')),
    orbit(35, 4.5, true),
    cap('十四年浴血抗战，中国人民赢得近代以来反抗外敌入侵第一次完全胜利，被日本侵占50年的台湾回到祖国怀抱。', 'After 14 years of sacrifice, China wins its first complete victory against foreign invasion in modern times, and Taiwan returns after 50 years of occupation.', 4.5),
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
    year(1950), title('抗美援朝', 'War to Resist US Aggression and Aid Korea', '1950—1953年 · 保家卫国 · 抗美援朝立国之战', '1950–1953 · Crossing the Yalu & defending peace'), fly(125.8, 40, 26, 0.85),
    { do: 'army', pts: [[124.4, 40.6], [124.9, 40.1], [125.4, 39.6], [125.75, 39.1]], color: PLA, dur: 4, count: 40, label: lbl('中国人民志愿军（彭德怀）', 'Chinese People’s Volunteers'), follow: true },
    cap('1950年10月，彭德怀率中国人民志愿军雄赳赳、气昂昂跨过鸭绿江，赴朝作战。', 'October 1950: commanded by Peng Dehuai, the Chinese People’s Volunteers cross the Yalu River.'),
    { do: 'clash', lon: 126.2, lat: 39.3, a: PLA, b: '#1f4e79', winner: 'a', angle: 120, dur: 5, count: 28, labels: [lbl('志愿军', 'Volunteers'), lbl('“联合国军”', '“UN Command”')], formations: ['wings', 'line'] },
    year(1952),
    { do: 'clash', lon: 127.47, lat: 38.32, a: PLA, b: '#1f4e79', winner: 'a', angle: 90, dur: 4.5, count: 24, labels: [lbl('上甘岭志愿军守军', 'Shangganling Defenders'), lbl('美军攻势', 'US Assault')] },
    banner(127.47, 38.32, '上甘岭战役 · 三八线', 'Triangle Hill & the 38th Parallel', PLA, lbl('黄继光 · 邱少云 · 最可爱的人', 'heroes of the Volunteers')),
    year(1953),
    { do: 'spawn', lon: 126.68, lat: 37.96, model: { kind: 'scroll' }, label: lbl('板门店停战协定', 'Panmunjom Armistice') },
    cap('志愿军连续发动五次战役并取得上甘岭战役胜利，1953年7月美国被迫在板门店签订停战协定。', 'After five offensives and the defence of Shangganling, the armistice is signed at Panmunjom in July 1953.', 4.2),
  ],

  five_year: [
    year(1953), title('第一个五年计划', 'The First Five-Year Plan', '1953—1957年 · 社会主义工业化起步 · 一桥飞架南北', '1953–1957 · Anshan Steel, Changchun Auto & the Wuhan Yangtze Bridge'),
    fly(118.0, 36.5, 42, 0.84),
    cap('1953年起我国开始执行第一个五年计划，集中主要力量发展重工业，奠定社会主义工业化初步基础。', 'From 1953 China launches its First Five-Year Plan, prioritising heavy industry and modern transport.'),
    { do: 'spawn', lon: 125.32, lat: 43.88, model: { kind: 'train', style: 'story_faw_jiefang' }, label: lbl('长春第一汽车制造厂', 'Changchun First Auto Works') },
    { do: 'spawn', lon: 114.3, lat: 30.55, model: { kind: 'bridge', style: 'story_wuhan_bridge' }, label: lbl('武汉长江大桥', 'Wuhan Yangtze River Bridge') },
    ...([
      [122.99, 41.11, '鞍山钢铁公司', 'Anshan Iron & Steel'],
      [125.32, 43.88, '长春一汽解放牌汽车', 'Changchun First Auto Works'],
      [123.43, 41.80, '沈阳第一机床厂·飞机制造厂', 'Shenyang Machine Tools & Aircraft'],
      [114.30, 30.55, '武汉长江大桥（1957）', 'Wuhan Yangtze Bridge (1957)'],
    ] as [number, number, string, string][]).map(([lon, lat, zh, en]): StoryStep => ({
      do: 'banner', lon, lat, text: lbl(zh, en), color: '#c0392b', dur: 3.6, par: true,
    })),
    { do: 'route', dur: 4.5, color: '#d35400', keep: true, label: lbl('川藏·青藏·新藏公路通达拉萨', 'Three Highways to Tibet'),
      pts: [[104.07, 30.67], [100.2, 30.0], [97.18, 31.15], [94.36, 29.65], [91.11, 29.65]] },
    year(1957),
    cap('鞍钢三大工程、长春一汽、沈阳飞机制造厂建成投产，1957年武汉长江大桥通车，“一桥飞架南北，天堑变通途”。', 'Anshan Steel, Changchun’s Jiefang trucks, Shenyang aircraft and the 1957 Wuhan Yangtze Bridge mark the dawn of socialist industrialisation.', 4.5),
  ],

  third_plenum: [
    year(1978), title('中共十一届三中全会与家庭联产承包', '3rd Plenary Session & Rural Reform', '1978年12月 · 伟大的历史转折 · 小岗村大包干', 'December 1978 · Reform and Opening-Up begins'),
    fly(116.4, 39.9, 20, 0.88),
    { do: 'fx', lon: 116.4, lat: 39.9, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(116.4, 39.9, '中共十一届三中全会', '11th Central Committee 3rd Plenum', '#de2910', lbl('1978年12月 · 解放思想，实事求是', 'Dec 1978 · Emancipate the mind, seek truth from facts')),
    cap('1978年12月，中共十一届三中全会在北京召开，作出把党和国家工作中心转移到经济建设上来、实行改革开放的历史性决策。', 'December 1978: the Third Plenum shifts the nation’s focus to economic construction and launches Reform and Opening-Up.'),
    fly(117.75, 32.82, 14, 0.88, 2.0),
    { do: 'spawn', lon: 117.75, lat: 32.82, model: { kind: 'hut', hero: 'places-sites/pl_xiaogang', style: 'story_xiaogang' }, label: lbl('安徽凤阳小岗村', 'Xiaogang Village, Anhui') },
    banner(117.75, 32.82, '家庭联产承包责任制', 'Household Responsibility System', '#d68910', lbl('小岗村十八枚红手印 · 包产到户', '18 red thumbprints at Xiaogang')),
    orbit(35, 4, true),
    cap('安徽凤阳小岗村18户农民按下红手印实行“包干到户”，家庭联产承包责任制迅速推广全国，农村生产力极大解放。', 'Eighteen peasant households in Xiaogang Village pioneer household contracting, sparking a nationwide agricultural revival.', 4.2),
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

  nanxun: [
    year(1992), title('邓小平南方谈话与社会主义市场经济', 'Deng Xiaoping’s Southern Tour', '1992年春 · 发展才是硬道理 · 浦东开发开放', 'Spring 1992 · “Development is the hard truth” & market economy'),
    fly(114.2, 26.5, 32, 0.85),
    cap('1992年初，邓小平先后视察武昌、深圳、珠海、上海等地，发表重要谈话：“计划和市场都是经济手段，发展才是硬道理。”', 'Early 1992: Deng Xiaoping visits Wuchang, Shenzhen, Zhuhai and Shanghai, declaring that both planning and markets are economic tools.'),
    { do: 'route', model: { kind: 'train', style: 'crh' }, dur: 5.5, color: '#de2910', keep: true, label: lbl('1992南方谈话足迹', '1992 Southern Tour'),
      pts: [[114.3, 30.56], [114.06, 22.54], [113.57, 22.27], [121.47, 31.23]] },
    { do: 'spawn', lon: 121.5, lat: 31.24, model: { kind: 'skyline', style: 'story_pudong' }, label: lbl('上海浦东陆家嘴', 'Pudong Lujiazui, Shanghai') },
    { do: 'fx', lon: 121.5, lat: 31.24, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(121.5, 31.24, '社会主义市场经济体制', 'Socialist Market Economy', '#de2910', lbl('1992年中共十四大确立目标', '14th Party Congress sets the goal')),
    orbit(42, 4.5, true),
    cap('南方谈话进一步解放了人们的思想；同年中共十四大明确提出建立社会主义市场经济体制，改革开放进入新阶段。', 'Emancipating minds across the country, the Southern Tour propels China’s 14th Congress to establish a socialist market economy.', 4.2),
  ],

  hk_return: [
    title('香港回归', 'Return of Hong Kong', '1997年7月1日 · 一国两制伟大实践', '1 July 1997 · One Country, Two Systems'), year(1996), fly(114.17, 22.32, 6, 0.92),
    cap('1997年6月30日午夜，中英香港政权交接仪式在香港会议展览中心庄严举行。', 'Midnight, 30 June 1997: the handover ceremony at the Hong Kong Convention and Exhibition Centre.'),
    year(1997),
    { do: 'spawn', lon: 114.17, lat: 22.28, model: { kind: 'skyline', hero: 'places-cities/pl_hongkong', style: 'story_hk1997' }, label: lbl('香港维多利亚港', 'Victoria Harbour, Hong Kong') },
    { do: 'fx', lon: 114.17, lat: 22.29, fx: 'flag', color: '#de2910' },
    { do: 'highlight', polity: 'prc', dur: 3, par: true },
    { do: 'fx', lon: 114.17, lat: 22.32, fx: 'firework', color: '#e74c3c', par: true },
    { do: 'fx', lon: 114.15, lat: 22.30, fx: 'firework', color: '#f1c40f' },
    banner(114.17, 22.30, '香港特别行政区成立', 'Hong Kong SAR Established', '#de2910', lbl('1997年7月1日 · 一国两制、港人治港', '1 July 1997 · Sovereignty resumed')),
    orbit(40, 4, true),
    cap('1997年7月1日零时，五星红旗和香港特区紫荆花区旗升起，中国政府对香港恢复行使主权，洗雪百年国耻。', 'At midnight on 1 July 1997, the Five-Star Red Flag rises as China resumes the exercise of sovereignty over Hong Kong.', 4),
  ],

  macao_return: [
    title('澳门回归', 'Return of Macao', '1999年12月20日 · 金莲花盛开', '20 December 1999 · Macao returns to the motherland'), year(1998), fly(113.54, 22.19, 5, 0.92),
    year(1999),
    { do: 'spawn', lon: 113.54, lat: 22.19, model: { kind: 'gate', hero: 'places-cities/pl_macao', style: 'story_macao1999' }, label: lbl('澳门大三巴与金莲花广场', 'Ruins of St. Paul’s & Lotus Square') },
    { do: 'fx', lon: 113.54, lat: 22.19, fx: 'flag', color: '#de2910' },
    { do: 'highlight', polity: 'prc', dur: 3, par: true },
    { do: 'fx', lon: 113.55, lat: 22.2, fx: 'firework', color: '#2ecc71', par: true },
    { do: 'fx', lon: 113.53, lat: 22.18, fx: 'firework', color: '#f1c40f' },
    banner(113.54, 22.19, '澳门特别行政区成立', 'Macao SAR Established', '#2ecc71', lbl('1999年12月20日 · 祖国统一大业重要一步', '20 December 1999')),
    orbit(40, 4, true),
    cap('1999年12月20日，中国政府对澳门恢复行使主权，中华人民共和国澳门特别行政区正式成立。', '20 December 1999: China resumes the exercise of sovereignty over Macao under “One Country, Two Systems”.', 4),
  ],

  liangdan: [
    title('两弹一星', 'Two Bombs and One Satellite', '1964—1970年 · 热爱祖国、无私奉献，自力更生、艰苦奋斗', '1964–1970 · Lop Nur & Jiuquan'), year(1964), fly(90.25, 40.6, 14, 0.85),
    { do: 'spawn', lon: 90.25, lat: 40.6, model: { kind: 'monument', hero: 'places-sites/pl_lop_nur', style: 'story_lopnur' }, label: lbl('罗布泊核试验基地', 'Lop Nur Test Site') },
    { do: 'fx', lon: 90.25, lat: 40.6, fx: 'glow', color: '#f5b041', dur: 2.5 },
    { do: 'fx', lon: 90.25, lat: 40.6, fx: 'smoke', dur: 3 },
    banner(90.25, 40.6, '第一颗原子弹与氢弹爆炸成功', 'Atomic (1964) & Hydrogen (1967) Bombs', '#e67e22', lbl('邓稼先 · 钱学森 · 打破核垄断', 'Deng Jiaxian & Qian Xuesen')),
    cap('1964年10月16日我国第一颗原子弹在罗布泊爆炸成功，1967年6月第一颗氢弹爆炸成功，打破了超级大国的核垄断。', '16 October 1964: China’s first atomic bomb detonates at Lop Nur, followed in 1967 by its first hydrogen bomb.'),
    year(1970), fly(100.28, 40.96, 10, 0.85),
    { do: 'spawn', lon: 100.28, lat: 40.96, model: { kind: 'rocket' }, label: lbl('东方红一号', 'Dongfanghong-1') },
    { do: 'fx', lon: 100.28, lat: 40.96, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(100.28, 40.96, '“东方红一号”人造卫星', 'Dongfanghong-1 Satellite', '#de2910', lbl('1970年4月24日 · 太空奏响《东方红》', '24 April 1970 · China’s first satellite')),
    orbit(35, 4, true),
    cap('1970年4月24日，“东方红一号”人造地球卫星在酒泉发射成功，我国成为世界上第五个能独立发射人造卫星的国家。', '24 April 1970: Dongfanghong-1 launches from Jiuquan, making China the fifth nation to independently place a satellite in orbit.', 4.2),
  ],

  un_seat: [
    year(1971), title('恢复在联合国的合法席位', 'Restoration of the UN Seat & 1970s Diplomacy', '1971年10月25日联大第2758号决议 · 1972年中美关系开始正常化', '1971–1979 · UN Resolution 2758 & diplomatic breakthroughs'),
    fly(116.4, 39.9, 32, 0.85),
    { do: 'fx', lon: 116.4, lat: 39.9, fx: 'flag', color: '#de2910' },
    { do: 'fx', lon: 116.4, lat: 39.9, fx: 'glow', color: '#f1c40f', dur: 3 },
    banner(116.4, 39.9, '联大第2758号决议', 'UN General Assembly Resolution 2758', '#de2910', lbl('1971年10月25日 · 恢复中华人民共和国一切合法权利', '25 Oct 1971 · lawful seat restored')),
    cap('1971年10月25日，第26届联合国大会以压倒多数通过第2758号决议，恢复中华人民共和国在联合国的一切合法权利。', '25 October 1971: the 26th UN General Assembly adopts Resolution 2758, restoring all lawful rights of the People’s Republic of China.'),
    year(1972),
    { do: 'spawn', lon: 121.47, lat: 31.23, model: { kind: 'scroll' }, label: lbl('1972《中美联合公报》', '1972 Shanghai Communiqué') },
    banner(121.47, 31.23, '乒乓外交与《上海公报》', 'Ping-Pong Diplomacy & Shanghai Communiqué', '#2980b9', lbl('1972年尼克松访华·田中角荣访华 · 1979年中美建交', '1972 Nixon visit · 1979 US–China diplomatic ties')),
    orbit(35, 4, true),
    cap('1972年尼克松访华签署《上海公报》、中日建交，1979年中美正式建交，我国外交工作打开崭新局面。', 'Followed by Nixon’s 1972 visit, China–Japan normalisation and formal US–China diplomatic relations in 1979, China enters a new diplomatic era.', 4.2),
  ],

  shenzhou5: [
    title('神舟五号载人航天', 'Shenzhou 5 Manned Spaceflight', '2003年10月15日 · 杨利伟太空首飞', '15 October 2003 · Yang Liwei becomes China’s first astronaut'), year(2003), fly(100.28, 40.96, 6, 0.85),
    { do: 'spawn', lon: 100.28, lat: 40.96, model: { kind: 'rocket', style: 'cz2f' }, scale: 1.4, label: lbl('神舟五号', 'Shenzhou 5') },
    { do: 'fx', lon: 100.28, lat: 40.96, fx: 'smoke', dur: 4, par: true },
    { do: 'fx', lon: 100.28, lat: 40.96, fx: 'glow', color: '#f39c12', dur: 3 },
    banner(100.28, 40.96, '长征二号F · 神舟五号', 'Long March 2F · Shenzhou 5', '#de2910', lbl('航天员杨利伟 · 绕地飞行14圈', 'Yang Liwei orbits Earth 14 times')),
    cap('2003年10月15日，航天员杨利伟乘坐神舟五号飞船从酒泉升空，绕地球飞行14圈后安全返回，我国成为世界上第三个独立掌握载人航天技术的国家。', '15 October 2003: Yang Liwei blasts off aboard Shenzhou 5 from Jiuquan and completes 14 orbits, making China the third nation to master human spaceflight.', 4.2),
    orbit(40, 4),
  ],

  olympics2008: [
    year(2008), title('北京奥运会', '2008 Beijing Olympic Games', '2008年8月8日 · 同一个世界，同一个梦想', '8 August 2008 · “One World, One Dream”'),
    fly(116.39, 39.99, 8, 0.92),
    { do: 'spawn', lon: 116.39, lat: 39.99, model: { kind: 'stadium', style: 'nest' }, label: lbl('国家体育场“鸟巢”', 'National Stadium (“Bird’s Nest”)') },
    { do: 'fx', lon: 116.39, lat: 39.99, fx: 'glow', color: '#f1c40f', dur: 3 },
    cap('2008年8月8日晚，第29届夏季奥林匹克运动会在北京国家体育场“鸟巢”盛大开幕，画卷徐徐展开中华五千年文明。', '8 August 2008: the 29th Summer Olympic Games open at Beijing’s “Bird’s Nest” Stadium on a giant unfurling scroll of Chinese civilisation.'),
    { do: 'fx', lon: 116.38, lat: 40.00, fx: 'firework', color: '#e74c3c', par: true },
    { do: 'fx', lon: 116.40, lat: 40.00, fx: 'firework', color: '#f1c40f', par: true },
    { do: 'fx', lon: 116.39, lat: 39.98, fx: 'firework', color: '#2ecc71', par: true },
    { do: 'fx', lon: 116.39, lat: 40.01, fx: 'firework', color: '#3498db' },
    banner(116.39, 39.99, '同一个世界，同一个梦想', 'One World, One Dream', '#de2910', lbl('百年奥运梦圆 · 展现了改革开放三十年辉煌成就', 'a century-old Olympic dream fulfilled')),
    orbit(50, 5, true),
    cap('北京奥运会圆满成功，中国代表团居金牌榜首位，向世界展现了改革开放三十年的蓬勃生机与大国风范。', 'China tops the gold-medal table as the Games showcase thirty years of reform, opening-up and cultural confidence to the world.', 4.2),
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
    case 'revolution': {
      const h = hue(id), ang = (h >> 5) % 360, r = (ang * Math.PI) / 180;
      const from: LonLat = [e.lon - Math.cos(r) * 0.85, e.lat + Math.sin(r) * 0.85];
      steps.push(
        { do: 'fly', lon: e.lon, lat: e.lat - 0.2, dist: close, tilt: 0.9, dur: 2 },
        { do: 'army', from, to: [e.lon, e.lat], color: '#c0392b', dur: 2.6, count: 22, unit: 'foot' },
        ...model,
        { do: 'fx', lon: e.lon, lat: e.lat, fx: 'flag', color: '#c0392b' },
        { do: 'banner', lon: e.lon, lat: e.lat, text: e.title, sub: when, color: '#c0392b', dur: 5 },
        { do: 'orbit', deg: 35, dur: 5, par: true }, say,
      );
      break;
    }
    case 'politics': case 'reform': case 'diplomacy':
      steps.push(
        { do: 'fly', lon: e.lon, lat: e.lat - 0.2, dist: close, tilt: 0.9, dur: 2 },
        ...(model.length ? model : [{ do: 'spawn', lon: e.lon, lat: e.lat, model: { kind: e.kind === 'diplomacy' ? 'scroll' : 'palace' } } as StoryStep]),
        { do: 'fx', lon: e.lon, lat: e.lat, fx: 'glow', dur: 2.4, par: true },
        { do: 'banner', lon: e.lon, lat: e.lat, text: e.title, sub: when, color: e.kind === 'diplomacy' ? '#1f5f8b' : e.kind === 'reform' ? '#1e8449' : '#7b241c', dur: 5 },
        { do: 'orbit', deg: 35, dur: 5, par: true }, say,
      );
      break;
    default:
      steps.push(
        { do: 'fly', lon: e.lon, lat: e.lat - 0.2, dist: close, tilt: 0.9, dur: 2 }, ...model,
        { do: 'fx', lon: e.lon, lat: e.lat, fx: 'glow', dur: 2.4, par: true },
        { do: 'banner', lon: e.lon, lat: e.lat, text: e.title, sub: when, color: '#b9770e', dur: 4.5, par: true },
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
export const TRAVELLER: Record<string, 'army' | { army: Troops } | Omit<ModelRecipe, 'kind'>> = {
  qinshihuang: { role: 'ruler', mount: 'horse', coat: '#1e1c1a', robe: '#1c1b20', trim: '#b83226', gear: 'sword' },
  zhugeliang: 'army',
  zhangqian: { role: 'scholar', mount: 'horse', coat: '#8a5a32', gear: 'jie', pack: true },
  xuanzang: { role: 'monk', mount: 'foot', gear: 'ji', robe: '#7a5c3e', trim: '#9b3a22' },
  libai: { role: 'scholar', mount: 'horse', coat: '#e6dccb', robe: '#ece6d6', trim: '#5b6472', gear: 'sword' },
  sushi: { role: 'scholar', mount: 'donkey', robe: '#5a4a3a', trim: '#2f3b45', hat: 'fangjin', gear: 'scroll' },
  wangyangming: { role: 'scholar', mount: 'horse', coat: '#5a3a22', robe: '#2f4a6b', trim: '#1f2937', hat: 'fangjin' },
  // curated journeys (journeys.ts): Peking Man with a firebrand, Yu with his spade, Fu Hao's war chariot with the 钺,
  // Liu Xiu on the ox he first rode to war, Jianzhen's ship, Marco Polo's camel, the Long March's rifle columns …
  paleo_trail: { role: 'scholar', mount: 'foot', gear: 'torch', person: '北京人', year: -500_000 },
  huangdi: { role: 'ruler', mount: 'chariot', gear: 'axe', person: '黄帝', year: -2600 },
  dayu: { role: 'ruler', mount: 'foot', gear: 'spade', person: '大禹', year: -2100 },
  fuhao: { role: 'general', mount: 'chariot', gear: 'axe', person: '妇好', female: true, year: -1200 },
  zhougong: { role: 'scholar', mount: 'chariot', gear: 'scroll', person: '周公', year: -1040 },
  kongzi: { role: 'scholar', mount: 'chariot', coat: '#7a5a3c', person: '孔子', year: -500 },
  chonger: { role: 'ruler', mount: 'chariot', gear: 'spear', person: '晋文公', year: -636 },
  quyuan: { role: 'scholar', mount: 'foot', robe: '#2f4f3a', trim: '#a3b18a', hat: 'tongtian', person: '屈原' },
  qinshihuang_east: { role: 'ruler', mount: 'chariot', coat: '#1e1c1a', trim: '#b83226', person: '秦始皇' },
  huoqubing: { army: 'horse' },
  simaqian: { role: 'scholar', mount: 'horse', gear: 'scroll', person: '司马迁', year: -110 },
  liuxiu: { role: 'ruler', mount: 'ox', person: '刘秀', year: 23 },
  banchao: { role: 'general', mount: 'horse', gear: 'jie', person: '班超' },
  caocao: { role: 'ruler', mount: 'horse', gear: 'sword', person: '曹操', year: 200 },
  wangjun: { role: 'general', mount: 'boat', gear: 'sword', person: '王濬' },
  faxian: { role: 'monk', mount: 'foot', gear: 'ji', robe: '#8a5a2e', person: '法显' },
  xiaowendi: { role: 'ruler', mount: 'horse', person: '北魏孝文帝', year: 494 },
  yangdi: { role: 'ruler', mount: 'boat', person: '隋炀帝' },
  jianzhen: { role: 'monk', mount: 'boat', person: '鉴真' },
  chairong: { role: 'ruler', mount: 'horse', gear: 'sword', person: '柴荣' },
  fanzhongyan: { role: 'scholar', mount: 'horse', gear: 'scroll', person: '范仲淹' },
  yuefei: { role: 'general', mount: 'horse', gear: 'spear', person: '岳飞' },
  wentianxiang: { role: 'scholar', mount: 'horse', gear: 'sword', person: '文天祥', year: 1270 },
  abaoji: { role: 'ruler', mount: 'horse', gear: 'sword', eth: 'steppe', person: '耶律阿保机' },
  xiaochuo: { role: 'ruler', mount: 'horse', female: true, eth: 'steppe', person: '萧绰' },
  yuanhao: { role: 'ruler', mount: 'camel', person: '李元昊' },
  aguda: { role: 'ruler', mount: 'horse', gear: 'spear', person: '完颜阿骨打' },
  qiuchuji: { role: 'scholar', mount: 'horse', coat: '#d6cfc2', person: '丘处机', year: 1222 },
  marcopolo: { role: 'scholar', mount: 'camel', hat: 'beret', robe: '#7f1d1d', trim: '#d6b25e', pack: true, person: '马可·波罗' },
  zhenghe: { role: 'scholar', mount: 'boat', person: '郑和' },
  xuxiake: { role: 'scholar', mount: 'foot', person: '徐霞客' },
  linzexu: { role: 'scholar', mount: 'horse', gear: 'scroll', person: '林则徐' },
  zuozongtang: { role: 'general', mount: 'horse', gear: 'sword', person: '左宗棠' },
  sunzhongshan: { role: 'ruler', mount: 'foot', person: '孙中山', year: 1912 },
  changzheng: { army: 'gun' },
  dengxiaoping_south: { role: 'ruler', mount: 'foot', person: '邓小平', year: 1992 },
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
      steps.push(who === 'army' || 'army' in who
        ? { do: 'army', pts, color: j.color, dur, count: 26, unit: who === 'army' ? 'mixed' : who.army as Troops, keep: true, trail: true, ...(i === 1 ? { label: j.short } : {}) }
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
