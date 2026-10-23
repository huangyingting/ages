import type { I18n, LonLat, StoryStep, Year } from './types.ts';

/**
 * Scripted animations for flagship events. Each step is plain data (see StoryStep in types.ts), so stories can be
 * authored, validated and unit-tested without the renderer. Events without a script get `autoStory()`.
 */
const cap = (zh: string, en: string, dur = 3.2): StoryStep => ({ do: 'caption', text: { zh, en }, dur });
const fly = (lon: number, lat: number, dist = 26, tilt = 0.9, dur = 2.2): StoryStep => ({ do: 'fly', lon, lat, dist, tilt, dur });
const year = (y: Year): StoryStep => ({ do: 'year', year: y });
const lbl = (zh: string, en: string): I18n => ({ zh, en });

const QIN = '#2c3e50';
const RED = '#c0392b';
const JP = '#566573';
const PLA = '#c0392b';

export const STORIES: Record<string, StoryStep[]> = {
  muye: [
    year(-1050), fly(111.5, 35.0, 22),
    cap('周武王联合各部落，从镐京出兵东进。', 'King Wu of Zhou leads his allies east from Haojing.'),
    { do: 'army', from: [108.85, 34.2], to: [113.9, 35.2], color: RED, dur: 4, count: 7 },
    { do: 'fx', lon: 113.9, lat: 35.2, fx: 'battle', dur: 2.5 },
    { do: 'spawn', lon: 113.9, lat: 35.2, model: { kind: 'chariot' }, label: lbl('牧野之战', 'Battle of Muye') },
    year(-1046),
    cap('前1046年牧野之战，商朝灭亡，西周建立。', '1046 BCE: Shang falls at Muye; the Western Zhou begins.'),
  ],

  qin_unify: [
    year(-231), fly(112.5, 34.5, 34, 0.85),
    cap('前230年起，秦王嬴政开始统一六国。', 'From 230 BCE King Zheng of Qin sets out to conquer the six states.'),
    { do: 'army', from: [108.71, 34.33], to: [113.7, 34.4], color: QIN, dur: 2.2 }, year(-230), cap('灭韩（前230年）', 'Han falls (230 BCE)', 1.6),
    { do: 'army', from: [108.71, 34.33], to: [114.49, 36.6], color: QIN, dur: 2.2 }, year(-228), cap('破赵（前228年）', 'Zhao falls (228 BCE)', 1.6),
    { do: 'army', from: [108.71, 34.33], to: [114.31, 34.8], color: QIN, dur: 2.2 }, year(-225), cap('灭魏（前225年）', 'Wei falls (225 BCE)', 1.6),
    { do: 'army', from: [108.71, 34.33], to: [116.78, 32.57], color: QIN, dur: 2.6 }, year(-223), cap('灭楚（前223年）', 'Chu falls (223 BCE)', 1.6),
    { do: 'army', from: [108.71, 34.33], to: [116.4, 39.9], color: QIN, dur: 2.6 }, year(-222), cap('灭燕（前222年）', 'Yan falls (222 BCE)', 1.6),
    { do: 'army', from: [108.71, 34.33], to: [118.31, 36.86], color: QIN, dur: 2.6 }, year(-221), cap('灭齐（前221年）', 'Qi falls (221 BCE)', 1.6),
    { do: 'highlight', polity: 'qin', dur: 3 },
    { do: 'spawn', lon: 108.71, lat: 34.33, model: { kind: 'warrior' }, label: lbl('咸阳', 'Xianyang') },
    cap('前221年，秦建立我国历史上第一个统一的多民族封建国家。', '221 BCE: Qin founds China’s first unified multi-ethnic empire.', 4),
  ],

  qin_wall: [
    year(-215), fly(112, 40.5, 40, 0.8),
    cap('蒙恬北击匈奴，把秦、赵、燕的旧长城连成一线。', 'Meng Tian drives back the Xiongnu and joins the old walls into one.'),
    { do: 'build', kind: 'wall', dur: 6, pts: [[103.9, 35.4], [104.6, 36.8], [105.8, 38.6], [105.8, 40.5], [106.8, 41.4], [109.5, 41.8],
      [112.0, 41.6], [114.5, 41.9], [117.0, 42.5], [120.0, 42.6], [122.5, 42.8], [124.5, 42.3], [125.6, 41.0]] },
    { do: 'spawn', lon: 109.5, lat: 41.8, model: { kind: 'beacon' } },
    cap('西起临洮，东至辽东，绵延万余里。', 'From Lintao in the west to Liaodong in the east.'),
  ],

  zhangqian: [
    year(-138), fly(92, 38, 70, 0.8),
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
    year(208), fly(113.6, 30.0, 14, 0.9),
    cap('208年，曹操率大军顺江东下。', '208: Cao Cao’s great army sails down the Yangtze.'),
    { do: 'army', from: [112.2, 30.35], to: [113.75, 29.9], color: '#2874a6', dur: 3, count: 8 },
    cap('孙刘联军以火船突袭，东南风起。', 'The Sun–Liu allies send fire ships on a south-east wind.'),
    { do: 'route', model: { kind: 'fireship' }, dur: 3, color: '#e67e22', pts: [[114.25, 30.4], [114.05, 30.12], [113.9, 29.92]] },
    { do: 'fx', lon: 113.82, lat: 29.88, fx: 'fire', dur: 4 },
    { do: 'army', from: [113.75, 29.9], to: [112.6, 30.6], color: '#2874a6', dur: 2.5, count: 4 },
    cap('曹军大败北撤，三国鼎立的局面由此奠定。', 'Cao Cao retreats north; the Three Kingdoms take shape.', 4),
  ],

  sanguo: [
    year(220), fly(110, 31, 46, 0.85),
    { do: 'highlight', polity: 'cao_wei', dur: 2 }, cap('220年 曹丕称帝，国号魏，都洛阳。', '220: Cao Pi founds Wei at Luoyang.', 2.4),
    year(221), { do: 'highlight', polity: 'shu_han', dur: 2 }, cap('221年 刘备称帝，国号汉（蜀），都成都。', '221: Liu Bei founds Shu Han at Chengdu.', 2.4),
    year(229), { do: 'highlight', polity: 'sun_wu', dur: 2 }, cap('229年 孙权称帝，国号吴，都建业。', '229: Sun Quan founds Wu at Jianye.', 2.4),
    year(262),
  ],

  feishui: [
    year(383), fly(114, 33, 30, 0.85),
    cap('383年，前秦苻坚号称百万大军南下。', '383: Fu Jian of Former Qin marches south with a vast army.'),
    { do: 'army', from: [108.94, 34.27], to: [116.6, 32.5], color: '#7b7d7d', dur: 4, count: 10 },
    { do: 'fx', lon: 116.8, lat: 32.3, fx: 'battle', dur: 2.5 },
    cap('东晋军渡淝水猛攻，秦军溃败，“风声鹤唳，草木皆兵”。', 'The Jin cross the Fei and the Qin army collapses in panic.'),
    { do: 'army', from: [116.6, 32.5], to: [112.4, 34.6], color: '#7b7d7d', dur: 2.5, count: 3 },
  ],

  xiaowendi: [
    year(493), fly(112.8, 37.3, 26),
    cap('494年，孝文帝从平城迁都洛阳。', '494: Emperor Xiaowen moves the capital from Pingcheng to Luoyang.'),
    { do: 'route', model: { kind: 'rider' }, dur: 5, color: '#5b2c6f', pts: [[113.3, 40.09], [112.7, 38.6], [112.55, 37.87], [112.6, 36.2], [112.45, 34.62]] },
    year(494),
    cap('推行汉化：穿汉服、说汉语、改汉姓、通婚。', 'He adopts Han dress, language, surnames and intermarriage.'),
  ],

  grand_canal: [
    year(604), fly(116.5, 34.5, 40, 0.8),
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
  ],

  xuanzang: [
    year(627), fly(88, 33, 85, 0.75),
    cap('玄奘从长安出发，西行求法。', 'Xuanzang leaves Chang’an to seek the scriptures.'),
    { do: 'route', model: { kind: 'camel' }, dur: 10, color: '#d68910', keep: true,
      pts: [[108.94, 34.27], [102.6, 37.9], [95.8, 40.5], [93.5, 42.8], [89.2, 42.9], [83.0, 41.7], [80.3, 41.2], [76.0, 42.4], [72.3, 42.5],
        [69.2, 41.3], [66.97, 39.65], [67.2, 36.7], [69.2, 34.5], [72.0, 34.0], [74.8, 34.1], [77.2, 28.6], [80.9, 26.8], [83.0, 25.3], [85.44, 25.14]] },
    { do: 'spawn', lon: 85.44, lat: 25.14, model: { kind: 'temple' }, label: lbl('那烂陀寺', 'Nalanda') },
    cap('他在天竺那烂陀寺学习多年。', 'He studies for years at Nalanda in India.'),
    { do: 'route', dur: 7, color: '#d68910', dashed: true, keep: true,
      pts: [[85.44, 25.14], [77.2, 28.6], [72.0, 34.0], [71.5, 37.0], [75.99, 39.47], [79.9, 37.1], [83.6, 37.0], [88.2, 39.0], [94.66, 40.14], [102.6, 37.9], [108.94, 34.27]] },
    year(645),
    cap('645年带回佛经657部，著《大唐西域记》。', 'In 645 he returns with 657 texts and writes his Records of the Western Regions.', 4),
  ],

  wencheng: [
    year(640), fly(100, 33, 40, 0.85),
    cap('641年，文成公主从长安出发远嫁吐蕃。', '641: Princess Wencheng travels from Chang’an to Tibet.'),
    { do: 'route', model: { kind: 'tent' }, dur: 7, color: '#c0392b', keep: true,
      pts: [[108.94, 34.27], [105.7, 34.6], [103.8, 36.06], [101.78, 36.62], [101.1, 36.4], [99.6, 35.3], [97.0, 33.0], [94.0, 31.5], [92.0, 30.8], [91.11, 29.65]] },
    year(641),
    { do: 'spawn', lon: 91.11, lat: 29.65, model: { kind: 'temple' }, label: lbl('逻些（拉萨）', 'Rasa (Lhasa)') },
    cap('她带去了中原的工艺、农技和典籍，唐蕃“和同为一家”。', 'She brought crafts, seeds and books; Tang and Tubo became “one family”.'),
  ],

  jianzhen: [
    year(753), fly(125, 32, 34, 0.85),
    cap('753年，鉴真第六次东渡。', '753: Jianzhen sets out on his sixth attempt.'),
    { do: 'route', model: { kind: 'junk' }, dur: 7, color: '#2e86c1', keep: true,
      pts: [[119.42, 32.39], [120.6, 31.9], [121.8, 31.3], [124.5, 30.6], [128.0, 30.0], [130.3, 31.4], [130.4, 33.6], [132.5, 34.0], [135.0, 34.5], [135.8, 34.68]] },
    { do: 'spawn', lon: 135.8, lat: 34.68, model: { kind: 'temple' }, label: lbl('唐招提寺', 'Tōshōdai-ji') },
    cap('双目失明的鉴真终于抵达日本，传播佛法与盛唐文化。', 'Blind but undaunted, Jianzhen reaches Japan and spreads Buddhism and Tang culture.'),
  ],

  anshi: [
    year(755), fly(113, 36.5, 34, 0.85),
    cap('755年，安禄山、史思明在范阳起兵。', '755: An Lushan and Shi Siming rebel at Fanyang.'),
    { do: 'army', from: [116.4, 39.9], to: [112.45, 34.62], color: '#7f8c8d', dur: 3.5, count: 8 },
    { do: 'army', from: [112.45, 34.62], to: [108.94, 34.27], color: '#7f8c8d', dur: 2.5, count: 6 },
    { do: 'fx', lon: 108.94, lat: 34.27, fx: 'fire', dur: 3 },
    cap('洛阳、长安相继失陷，唐玄宗逃往四川。', 'Luoyang and Chang’an fall; Emperor Xuanzong flees to Sichuan.'),
    year(763), cap('763年叛乱平定，唐朝由盛转衰。', 'The revolt ends in 763; the Tang never fully recovers.'),
  ],

  song_found: [
    year(960), fly(114.31, 34.8, 16),
    { do: 'spawn', lon: 114.31, lat: 34.8, model: { kind: 'palace' }, label: lbl('东京开封府', 'Kaifeng') },
    cap('960年，赵匡胤陈桥兵变，黄袍加身，建立宋朝。', '960: Zhao Kuangyin is proclaimed emperor at Chenqiao and founds the Song.'),
    year(1100), { do: 'highlight', polity: 'bsong', dur: 3 },
    cap('北宋与辽、西夏并立。', 'The Northern Song coexists with Liao and Western Xia.'),
  ],

  jingkang: [
    year(1126), fly(116, 33, 40, 0.85),
    { do: 'army', from: [116.4, 39.9], to: [114.31, 34.8], color: '#b7950b', dur: 3.5, count: 8 },
    { do: 'fx', lon: 114.31, lat: 34.8, fx: 'fire', dur: 3 },
    year(1127), cap('1127年金军攻破开封，北宋灭亡。', '1127: the Jin sack Kaifeng; the Northern Song ends.'),
    { do: 'route', dur: 4, color: '#2471a3', dashed: true, pts: [[115.6, 34.4], [117.5, 32.5], [118.78, 32.06], [120.16, 30.27]] },
    year(1142), { do: 'highlight', polity: 'nsong', dur: 3 },
    cap('南宋定都临安，宋金以淮河—大散关为界。', 'The Southern Song settles at Lin’an; the Huai River becomes the border.'),
  ],

  genghis: [
    year(1206), fly(108, 46, 50, 0.85),
    { do: 'spawn', lon: 109.0, lat: 48.0, model: { kind: 'yurt' }, label: lbl('斡难河源', 'Onon River') },
    cap('1206年，铁木真统一蒙古各部，号成吉思汗。', '1206: Temüjin unites the Mongols as Genghis Khan.'),
    { do: 'army', from: [109.0, 48.0], to: [106.23, 38.49], color: '#1e8449', dur: 3, count: 8 }, year(1227),
    cap('1227年灭西夏', 'Western Xia falls (1227)', 1.8),
    { do: 'army', from: [109.0, 48.0], to: [117.5, 34.3], color: '#1e8449', dur: 3, count: 8 }, year(1234),
    cap('1234年灭金', 'Jin falls (1234)', 1.8),
    year(1330), { do: 'highlight', polity: 'yuan', dur: 3 },
    cap('元朝疆域空前辽阔。', 'The Yuan becomes the largest empire China had seen.'),
  ],

  zhenghe: [
    year(1405), fly(98, 14, 110, 0.7),
    cap('1405年，郑和率二百余艘船、两万七千余人从刘家港起航。', '1405: Zheng He sails from Liujiagang with over 200 ships and 27,000 men.'),
    { do: 'route', model: { kind: 'junk', scale: 1.4 }, dur: 12, color: '#d4ac0d', keep: true, label: lbl('郑和航线', 'Zheng He’s route'),
      pts: [[118.78, 32.06], [121.1, 31.6], [122.5, 29.5], [119.9, 25.9], [117.0, 22.5], [112.0, 17.5], [109.2, 13.8], [106.5, 8.5],
        [104.5, 3.2], [102.25, 2.2], [99.5, 4.2], [95.3, 5.8], [88.0, 6.0], [81.5, 5.8], [80.2, 6.0], [77.0, 8.0], [75.78, 11.25]] },
    { do: 'spawn', lon: 75.78, lat: 11.25, model: { kind: 'flag' }, label: lbl('古里', 'Calicut') },
    year(1433),
    cap('28年间七下西洋，最远到达非洲东海岸和红海沿岸。', 'Seven voyages in 28 years, reaching East Africa and the Red Sea.', 4),
  ],

  ming_wall: [
    year(1570), fly(108, 39.5, 50, 0.8),
    cap('明朝为防御蒙古，大规模修筑长城。', 'The Ming rebuild the wall against the Mongols.'),
    { do: 'build', kind: 'wall', dur: 7, pts: [[98.3, 39.8], [100.6, 39.1], [102.6, 38.4], [103.9, 37.5], [104.8, 37.7], [106.2, 38.6], [107.6, 37.7],
      [109.7, 38.4], [111.1, 39.2], [112.4, 40.0], [113.3, 40.4], [114.9, 41.0], [116.4, 40.7], [117.6, 40.5], [118.9, 40.3], [119.75, 40.0],
      [120.5, 41.5], [122.0, 42.5], [123.6, 42.8], [124.6, 42.3], [125.5, 41.3], [124.4, 40.0]] },
    { do: 'spawn', lon: 98.21, lat: 39.8, model: { kind: 'gate' }, label: lbl('嘉峪关', 'Jiayu Pass') },
    { do: 'spawn', lon: 119.75, lat: 40.0, model: { kind: 'gate' }, label: lbl('山海关', 'Shanhai Pass') },
    cap('西起嘉峪关，东至鸭绿江。', 'From Jiayu Pass to the Yalu River.'),
  ],

  zheng_chenggong: [
    year(1661), fly(119.8, 23.8, 14, 0.9),
    cap('1661年，郑成功率军从金门出发，横渡台湾海峡。', '1661: Zheng Chenggong crosses the Taiwan Strait from Kinmen.'),
    { do: 'route', model: { kind: 'warship' }, dur: 4, color: '#a04000', pts: [[118.35, 24.45], [119.55, 23.6], [120.1, 23.05], [120.2, 22.99]] },
    { do: 'fx', lon: 120.2, lat: 22.99, fx: 'battle', dur: 2.5 },
    year(1662), { do: 'fx', lon: 120.2, lat: 22.99, fx: 'flag', color: '#a04000' },
    cap('1662年荷兰殖民者投降，台湾回到祖国怀抱。', '1662: the Dutch surrender and Taiwan is recovered.'),
  ],

  yaksa: [
    year(1685), fly(124.5, 51.5, 20),
    cap('沙俄侵占雅克萨，康熙帝派兵反击。', 'Russia occupies Albazin; the Kangxi Emperor strikes back.'),
    { do: 'army', from: [127.5, 50.2], to: [124.2, 53.4], color: '#a569bd', dur: 3.5, count: 6 },
    { do: 'fx', lon: 124.2, lat: 53.4, fx: 'battle', dur: 3 },
    year(1689), { do: 'spawn', lon: 116.6, lat: 51.98, model: { kind: 'scroll' }, label: lbl('尼布楚', 'Nerchinsk') },
    cap('1689年签订《尼布楚条约》，划定中俄东段边界。', '1689: the Treaty of Nerchinsk fixes the eastern border.'),
  ],

  humen: [
    year(1839), fly(113.67, 22.82, 8, 0.95),
    { do: 'spawn', lon: 113.67, lat: 22.82, model: { kind: 'cannon' }, label: lbl('虎门', 'Humen') },
    cap('1839年6月，林则徐在虎门海滩当众销毁鸦片。', 'June 1839: Lin Zexu destroys the opium on the beach at Humen.'),
    { do: 'fx', lon: 113.67, lat: 22.82, fx: 'smoke', dur: 5 },
    cap('历时23天，销毁鸦片两百多万斤。', 'Over 23 days more than 1,000 tonnes are destroyed.'),
  ],

  opium_war: [
    year(1840), fly(118, 28, 60, 0.8),
    cap('1840年6月，英国舰队封锁珠江口，鸦片战争爆发。', 'June 1840: a British fleet blockades the Pearl River; the Opium War begins.'),
    { do: 'route', model: { kind: 'warship' }, dur: 7, color: '#566573', keep: true,
      pts: [[114.2, 22.0], [117.5, 23.0], [120.0, 25.5], [122.1, 29.8], [123.2, 34.0], [122.4, 37.8], [117.7, 38.98]] },
    { do: 'fx', lon: 122.1, lat: 30.0, fx: 'battle', dur: 2 },
    year(1842),
    { do: 'route', model: { kind: 'warship' }, dur: 4, color: '#566573', pts: [[122.0, 31.3], [121.4, 31.5], [120.3, 31.95], [119.4, 32.2], [118.78, 32.06]] },
    { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'scroll' }, label: lbl('《南京条约》', 'Treaty of Nanking') },
    { do: 'fx', lon: 114.17, lat: 22.32, fx: 'flag', color: '#566573' },
    cap('1842年《南京条约》：割香港岛、赔款、五口通商、协定关税。', '1842 Treaty of Nanking: Hong Kong ceded, indemnity, five ports, fixed tariffs.', 4.5),
  ],

  yuanmingyuan: [
    year(1860), fly(117, 39.5, 14),
    { do: 'army', from: [117.7, 38.98], to: [116.3, 40.01], color: '#566573', dur: 3, count: 6 },
    { do: 'spawn', lon: 116.3, lat: 40.01, model: { kind: 'palace' }, label: lbl('圆明园', 'Yuanmingyuan') },
    { do: 'fx', lon: 116.3, lat: 40.01, fx: 'fire', dur: 5 },
    cap('1860年10月，英法联军洗劫并焚毁圆明园。', 'October 1860: Anglo-French troops loot and burn the Old Summer Palace.'),
  ],

  russia_land: [
    year(1857), fly(128, 47, 60, 0.85),
    cap('第二次鸦片战争期间，沙俄趁火打劫。', 'During the Second Opium War, Russia seizes its chance.'),
    year(1901), { do: 'highlight', polity: 'russia', dur: 4 },
    cap('通过不平等条约割占中国东北和西北领土150多万平方千米。', 'Unequal treaties take over 1.5 million km² in the north-east and north-west.', 4),
  ],

  jiawu: [
    year(1894), fly(122.5, 38.0, 22, 0.85),
    cap('1894年9月黄海海战，北洋舰队与日本联合舰队激战。', 'September 1894: the Beiyang Fleet meets the Japanese fleet in the Yellow Sea.'),
    { do: 'route', model: { kind: 'warship' }, dur: 3, color: '#a569bd', pts: [[121.6, 38.8], [122.4, 39.2], [123.0, 39.0]], par: true },
    { do: 'route', model: { kind: 'warship', color: '#cacfd2' }, dur: 3, color: JP, pts: [[124.5, 37.6], [123.6, 38.5], [123.2, 38.9]] },
    { do: 'fx', lon: 123.0, lat: 39.0, fx: 'battle', dur: 3 },
    cap('“致远”舰管带邓世昌壮烈殉国。', 'Captain Deng Shichang of the Zhiyuan dies heroically.'),
    year(1895), { do: 'fx', lon: 122.12, lat: 37.51, fx: 'smoke', dur: 3 },
    cap('1895年北洋舰队在威海卫全军覆没。', '1895: the Beiyang Fleet is destroyed at Weihaiwei.'),
  ],

  wuchang: [
    year(1911), fly(112, 30, 48, 0.85),
    { do: 'fx', lon: 114.3, lat: 30.59, fx: 'battle', dur: 2 },
    { do: 'fx', lon: 114.3, lat: 30.59, fx: 'flag', color: '#c0392b' },
    cap('1911年10月10日，武昌起义爆发。', '10 October 1911: the Wuchang Uprising.'),
    ...([[112.94, 28.23], [108.94, 34.27], [115.86, 28.68], [112.55, 37.87], [102.83, 24.88], [121.47, 31.23], [106.7, 26.6],
      [120.16, 30.27], [108.3, 22.8], [117.3, 31.9], [113.26, 23.13], [119.3, 26.08], [104.07, 30.67]] as LonLat[])
      .map(([lon, lat]): StoryStep => ({ do: 'fx', lon, lat, fx: 'flag', color: '#c0392b', par: true })),
    { do: 'wait', dur: 2 },
    cap('一个多月内十几个省宣布独立，清朝统治土崩瓦解。', 'Within weeks over a dozen provinces declare independence.'),
    year(1912), { do: 'spawn', lon: 118.78, lat: 32.06, model: { kind: 'flag' }, label: lbl('南京临时政府', 'Nanjing Provisional Government') },
    cap('1912年1月1日中华民国成立。', '1 January 1912: the Republic of China is founded.'),
  ],

  may4: [
    year(1919), fly(116.39, 39.9, 8, 0.95),
    { do: 'spawn', lon: 116.39, lat: 39.905, model: { kind: 'gate' }, label: lbl('天安门', 'Tiananmen') },
    { do: 'fx', lon: 116.39, lat: 39.9, fx: 'flag', color: '#ecf0f1' },
    cap('1919年5月4日，北京学生在天安门前集会游行。', '4 May 1919: Beijing students rally at Tiananmen.'),
    fly(118.8, 35.0, 40, 0.85),
    { do: 'fx', lon: 121.47, lat: 31.23, fx: 'flag', color: '#c0392b' },
    cap('6月，上海工人罢工，运动中心转向上海。', 'In June Shanghai workers strike and the movement’s centre moves to Shanghai.'),
  ],

  cpc_found: [
    year(1921), fly(121.1, 31.0, 8, 0.95),
    { do: 'spawn', lon: 121.47, lat: 31.23, model: { kind: 'monument' }, label: lbl('中共一大会址', 'Site of the 1st Congress') },
    cap('1921年7月，中共一大在上海召开。', 'July 1921: the CPC’s First Congress opens in Shanghai.'),
    { do: 'route', dur: 3, color: '#c0392b', dashed: true, pts: [[121.47, 31.23], [121.0, 31.0], [120.75, 30.75]] },
    { do: 'spawn', lon: 120.75, lat: 30.75, model: { kind: 'redboat' }, label: lbl('南湖红船', 'The Red Boat') },
    cap('会议最后一天转移到嘉兴南湖的游船上，宣告中国共产党成立。', 'The final session moves to a boat on South Lake, Jiaxing: the Party is founded.', 4),
  ],

  beifa: [
    year(1926), fly(114, 28, 48, 0.85),
    cap('1926年7月，国民革命军从广州出师北伐。', 'July 1926: the National Revolutionary Army marches north from Guangzhou.'),
    { do: 'army', from: [113.26, 23.13], to: [112.94, 28.23], color: '#2e86c1', dur: 2.5, count: 8 },
    { do: 'army', from: [112.94, 28.23], to: [114.3, 30.59], color: '#2e86c1', dur: 2.2, count: 8 },
    cap('叶挺独立团攻克武昌，被誉为“铁军”。', 'Ye Ting’s regiment takes Wuchang: the “Iron Army”.'),
    { do: 'army', from: [113.26, 23.13], to: [115.86, 28.68], color: '#2e86c1', dur: 2.5, count: 5, par: true },
    { do: 'army', from: [115.86, 28.68], to: [118.78, 32.06], color: '#2e86c1', dur: 2.5, count: 5 },
  ],

  long_march: [
    year(1934), fly(106, 30, 60, 0.85),
    cap('1934年10月，中央红军从瑞金出发长征。', 'October 1934: the Central Red Army leaves Ruijin.'),
    { do: 'route', model: { kind: 'flag', color: '#c0392b' }, dur: 4, color: '#c0392b', keep: true,
      pts: [[116.03, 25.89], [114.6, 25.3], [112.5, 25.4], [110.9, 25.7], [109.6, 26.2], [108.3, 26.6], [106.93, 27.73]] },
    year(1935), { do: 'spawn', lon: 106.93, lat: 27.73, model: { kind: 'monument' }, label: lbl('遵义会议', 'Zunyi Conference') },
    cap('1935年1月遵义会议，党的历史上生死攸关的转折点。', 'January 1935: the Zunyi Conference, a life-or-death turning point.'),
    { do: 'route', dur: 4, color: '#c0392b', keep: true,
      pts: [[106.93, 27.73], [105.7, 28.4], [106.2, 27.9], [105.6, 28.3], [106.5, 27.0], [105.0, 26.0], [103.5, 25.8], [102.6, 26.1]] },
    cap('四渡赤水、巧渡金沙江', 'Four crossings of the Chishui; across the Jinsha', 2.2),
    { do: 'route', dur: 3, color: '#c0392b', keep: true, pts: [[102.6, 26.1], [102.2, 27.9], [102.3, 29.3], [102.23, 29.92]] },
    { do: 'fx', lon: 102.23, lat: 29.92, fx: 'battle', dur: 2 },
    cap('强渡大渡河、飞夺泸定桥', 'Across the Dadu; seizing the Luding Bridge', 2.2),
    { do: 'route', dur: 5, color: '#c0392b', keep: true,
      pts: [[102.23, 29.92], [102.7, 30.8], [102.4, 31.9], [102.8, 33.0], [103.4, 33.9], [103.9, 34.1], [105.7, 35.5], [107.0, 36.4], [108.17, 36.93]] },
    cap('爬雪山、过草地，1935年10月到达陕北吴起镇。', 'Over snow mountains and grasslands to Wuqi, northern Shaanxi (October 1935).'),
    year(1936), { do: 'fx', lon: 105.05, lat: 35.7, fx: 'flag', color: '#c0392b' },
    cap('1936年10月，红军三大主力会宁会师，长征胜利结束。', 'October 1936: the three Red Armies meet at Huining. The Long March is over.', 4),
  ],

  sept18: [
    year(1931), fly(124, 44, 34, 0.85),
    { do: 'fx', lon: 123.43, lat: 41.85, fx: 'battle', dur: 2.5 },
    cap('1931年9月18日夜，日军炮轰沈阳北大营。', 'Night of 18 September 1931: Japanese troops attack the Beidaying barracks in Shenyang.'),
    { do: 'army', from: [123.43, 41.8], to: [125.32, 43.82], color: JP, dur: 2, count: 5, par: true },
    { do: 'army', from: [123.43, 41.8], to: [126.63, 45.75], color: JP, dur: 3, count: 5 },
    cap('不到半年，东北三省全部沦陷。', 'Within months all three north-eastern provinces fall.'),
  ],

  july7: [
    year(1937), fly(116.21, 39.85, 6, 0.95),
    { do: 'spawn', lon: 116.21, lat: 39.85, model: { kind: 'bridge' }, label: lbl('卢沟桥', 'Marco Polo Bridge') },
    { do: 'fx', lon: 116.23, lat: 39.85, fx: 'battle', dur: 3 },
    cap('1937年7月7日，日军炮轰宛平城，中国守军奋起抵抗。', '7 July 1937: Japanese guns shell Wanping and Chinese troops fight back.'),
    year(1940), fly(112, 33, 70, 0.85), { do: 'highlight', polity: 'jp_occ', dur: 3 },
    cap('全民族抗战开始。', 'The whole nation rises in resistance.'),
  ],

  sanda: [
    year(1948), fly(119, 37.5, 48, 0.85),
    { do: 'army', from: [125.32, 43.82], to: [121.1, 41.1], color: PLA, dur: 3, count: 6 },
    { do: 'fx', lon: 121.1, lat: 41.1, fx: 'battle', dur: 1.8 },
    cap('辽沈战役（1948年9—11月）', 'Liaoshen (Sep–Nov 1948)', 2),
    { do: 'army', from: [116.0, 36.0], to: [117.18, 34.26], color: PLA, dur: 2.5, count: 6, par: true },
    { do: 'army', from: [114.0, 33.0], to: [117.18, 34.26], color: PLA, dur: 2.5, count: 6 },
    { do: 'fx', lon: 117.18, lat: 34.26, fx: 'battle', dur: 1.8 },
    cap('淮海战役（1948年11月—1949年1月）', 'Huaihai (Nov 1948 – Jan 1949)', 2),
    { do: 'army', from: [119.75, 40.0], to: [117.2, 39.13], color: PLA, dur: 2.5, count: 6 },
    year(1949), { do: 'fx', lon: 116.4, lat: 39.9, fx: 'flag', color: PLA },
    cap('平津战役：天津解放，北平和平解放。', 'Pingjin: Tianjin is taken and Beiping liberated peacefully.'),
  ],

  dujiang: [
    year(1949), fly(118.5, 31.5, 22, 0.88),
    cap('1949年4月21日，人民解放军百万雄师横渡长江。', '21 April 1949: a million soldiers cross the Yangtze.'),
    ...([[[116.9, 30.9], [117.4, 30.4]], [[117.8, 31.4], [118.2, 31.0]], [[118.5, 32.0], [118.7, 31.7]], [[119.4, 32.4], [119.5, 32.05]],
      [[120.2, 32.1], [120.3, 31.85]]] as [LonLat, LonLat][])
      .map(([from, to]): StoryStep => ({ do: 'route', model: { kind: 'boat' }, dur: 3, color: PLA, pts: [from, to], par: true })),
    { do: 'wait', dur: 3.2 },
    { do: 'fx', lon: 118.78, lat: 32.06, fx: 'flag', color: PLA },
    cap('4月23日南京解放。', 'Nanjing is taken on 23 April.'),
  ],

  founding: [
    year(1949), fly(116.39, 39.9, 5, 0.97),
    { do: 'spawn', lon: 116.391, lat: 39.907, model: { kind: 'gate' }, label: lbl('天安门', 'Tiananmen') },
    cap('1949年10月1日下午3时，开国大典在天安门广场隆重举行。', '3 p.m., 1 October 1949: the founding ceremony at Tiananmen Square.'),
    { do: 'fx', lon: 116.391, lat: 39.905, fx: 'flag', color: '#de2910' },
    { do: 'fx', lon: 116.38, lat: 39.92, fx: 'firework', color: '#f1c40f', par: true },
    { do: 'fx', lon: 116.40, lat: 39.92, fx: 'firework', color: '#e74c3c', par: true },
    { do: 'fx', lon: 116.39, lat: 39.93, fx: 'firework', color: '#ecf0f1' },
    cap('中华人民共和国成立。', 'The People’s Republic of China is founded.', 4),
  ],

  kangmei: [
    year(1950), fly(126.5, 39.5, 24, 0.85),
    { do: 'army', from: [124.0, 41.0], to: [125.75, 39.03], color: PLA, dur: 3, count: 8 },
    cap('1950年10月，中国人民志愿军跨过鸭绿江。', 'October 1950: the Chinese People’s Volunteers cross the Yalu.'),
    { do: 'fx', lon: 127.5, lat: 38.3, fx: 'battle', dur: 3 },
    year(1953), cap('1953年7月签订停战协定。', 'An armistice is signed in July 1953.'),
  ],

  shenzhen: [
    year(1979), fly(114.06, 22.54, 6, 0.9),
    { do: 'spawn', lon: 114.06, lat: 22.54, model: { kind: 'hut' }, scale: 0.8, label: lbl('深圳（1979）', 'Shenzhen (1979)') },
    cap('1980年，深圳从一个边陲小镇成为经济特区。', '1980: the border town of Shenzhen becomes a Special Economic Zone.'),
    year(2000), { do: 'spawn', lon: 114.06, lat: 22.54, model: { kind: 'skyline' }, label: lbl('深圳', 'Shenzhen') },
    { do: 'fx', lon: 114.06, lat: 22.54, fx: 'glow', color: '#f1c40f', dur: 3 },
    cap('“深圳速度”：一座现代化大都市拔地而起。', '“Shenzhen speed”: a modern metropolis rises.'),
  ],

  hk_return: [
    year(1996), fly(114.17, 22.32, 6, 0.92),
    cap('1997年6月30日午夜，香港会议展览中心。', 'Midnight, 30 June 1997: the Hong Kong Convention Centre.'),
    year(1997),
    { do: 'fx', lon: 114.17, lat: 22.29, fx: 'flag', color: '#de2910' },
    { do: 'highlight', polity: 'prc', dur: 3, par: true },
    { do: 'fx', lon: 114.17, lat: 22.32, fx: 'firework', color: '#e74c3c' },
    cap('1997年7月1日，中国政府对香港恢复行使主权。', '1 July 1997: China resumes sovereignty over Hong Kong.', 4),
  ],

  macao_return: [
    year(1998), fly(113.54, 22.19, 5, 0.92),
    year(1999),
    { do: 'fx', lon: 113.54, lat: 22.19, fx: 'flag', color: '#de2910' },
    { do: 'fx', lon: 113.55, lat: 22.2, fx: 'firework', color: '#2ecc71' },
    cap('1999年12月20日，澳门回归祖国。', '20 December 1999: Macao returns to China.'),
  ],

  liangdan: [
    year(1964), fly(90.25, 40.6, 14, 0.85),
    { do: 'fx', lon: 90.25, lat: 40.6, fx: 'glow', color: '#f5b041', dur: 2.5 },
    { do: 'fx', lon: 90.25, lat: 40.6, fx: 'smoke', dur: 3 },
    cap('1964年10月16日，第一颗原子弹在罗布泊爆炸成功。', '16 October 1964: China’s first atomic bomb at Lop Nur.'),
    year(1970), fly(100.28, 40.96, 10, 0.85),
    { do: 'spawn', lon: 100.28, lat: 40.96, model: { kind: 'rocket' }, label: lbl('东方红一号', 'Dongfanghong-1') },
    cap('1970年4月24日，“东方红一号”卫星发射成功。', '24 April 1970: the Dongfanghong-1 satellite is launched.'),
  ],

  shenzhou5: [
    year(2003), fly(100.28, 40.96, 6, 0.85),
    { do: 'spawn', lon: 100.28, lat: 40.96, model: { kind: 'rocket' }, scale: 1.4, label: lbl('神舟五号', 'Shenzhou 5') },
    { do: 'fx', lon: 100.28, lat: 40.96, fx: 'smoke', dur: 4 },
    cap('2003年10月15日，杨利伟乘神舟五号飞向太空。', '15 October 2003: Yang Liwei rides Shenzhou 5 into space.', 4),
  ],
};

/** Default animation: fly in, set the year, raise the model, caption the summary. */
export function autoStory(e: { year: Year; lon: number; lat: number; weight: number; model?: { kind: string }; title: I18n; summary: I18n }): StoryStep[] {
  const dist = e.weight === 1 ? 14 : 18;
  return [
    { do: 'year', year: e.year },
    { do: 'fly', lon: e.lon, lat: e.lat, dist, tilt: 0.9, dur: 2 },
    ...(e.model ? [{ do: 'spawn', lon: e.lon, lat: e.lat, model: e.model, label: e.title } as StoryStep] : []),
    { do: 'fx', lon: e.lon, lat: e.lat, fx: 'glow', dur: 2, par: true },
    { do: 'caption', text: e.summary, dur: 5 },
  ];
}
