import { importedPlaces, type RiverLabel } from './jiangshan.ts';
import type { I18n, Place, Year } from './types.ts';

type Names = [from: Year, to: Year, zh: string, en: string][];
const pl = (id: string, lon: number, lat: number, zh: string, en: string, o: {
  kind?: Place['kind']; tier?: Place['tier']; names?: Names; capital?: [Year, Year][]; since?: Year; until?: Year;
} = {}): Place => ({
  id, scope: 'china', lon, lat, kind: o.kind ?? 'city', tier: o.tier ?? 2, name: { zh, en },
  names: o.names?.map(([from, to, z, e]) => ({ from, to, name: { zh: z, en: e } })),
  capital: o.capital, since: o.since, until: o.until,
});

/** Cities, passes and sites. Names change with the period (镐京 → 长安 → 大兴 → 西安); capitals get a marker. */
const CURATED: Place[] = [
  // ---- great capitals -------------------------------------------------------------------------------------------
  pl('xian', 108.94, 34.27, '西安', 'Xi’an', { tier: 1, since: 1369,
    names: [[-1046, -771, '镐京', 'Haojing'], [-202, 581, '长安', 'Chang’an'], [582, 617, '大兴', 'Daxing'], [618, 1368, '长安', 'Chang’an']],
    capital: [[-1046, -771], [-202, 8], [190, 195], [582, 904]] }),
  pl('xianyang', 108.71, 34.33, '咸阳', 'Xianyang', { tier: 2, capital: [[-350, -207]], since: -350 }),
  pl('luoyang', 112.45, 34.62, '洛阳', 'Luoyang', { tier: 1, since: -256, names: [[-770, -256, '洛邑', 'Luoyi']],
    capital: [[-770, -256], [25, 190], [220, 311], [494, 534], [605, 618], [690, 705], [923, 936]] }),
  pl('anyang', 114.32, 36.12, '安阳', 'Anyang', { tier: 2, names: [[-1300, -1046, '殷', 'Yin']], capital: [[-1300, -1046]], since: -257 }),
  pl('erlitou', 112.69, 34.69, '二里头', 'Erlitou', { kind: 'site', tier: 3, until: -1000 }),
  pl('zhengzhou', 113.65, 34.76, '郑州', 'Zhengzhou', { tier: 2, names: [[-1600, -1300, '亳', 'Bo']], since: 583 }),
  pl('kaifeng', 114.31, 34.8, '开封', 'Kaifeng', { tier: 1, since: 1368,
    names: [[-364, -225, '大梁', 'Daliang'], [578, 906, '汴州', 'Bianzhou'], [907, 1127, '东京（汴梁）', 'Bianjing'], [1128, 1367, '汴梁', 'Bianliang']], capital: [[907, 923], [936, 1127]] }),
  pl('hangzhou', 120.16, 30.27, '杭州', 'Hangzhou', { tier: 1, names: [[1129, 1276, '临安', 'Lin’an']], capital: [[907, 978], [1138, 1276]], since: 589 }),
  pl('nanjing', 118.78, 32.06, '南京', 'Nanjing', { tier: 1, since: 1421,
    names: [[229, 280, '建业', 'Jianye'], [317, 589, '建康', 'Jiankang'], [937, 975, '金陵', 'Jinling'], [1368, 1420, '应天府', 'Yingtian'],
      [1853, 1864, '天京', 'Tianjing']],
    capital: [[229, 280], [317, 589], [937, 975], [1368, 1420], [1853, 1864], [1912, 1912], [1927, 1949]] }),
  pl('beijing', 116.4, 39.9, '北京', 'Beijing', { tier: 1, since: 1403,
    names: [[-1045, -222, '蓟', 'Ji'], [-221, 937, '幽州', 'Youzhou'], [938, 1152, '燕京', 'Yanjing'], [1153, 1214, '中都', 'Zhongdu'],
      [1267, 1368, '大都', 'Dadu'], [1369, 1402, '北平', 'Beiping'], [1928, 1949, '北平', 'Beiping']],
    capital: [[1153, 1214], [1267, 1368], [1421, 1911], [1912, 1927], [1949, 2100]] }),
  pl('datong', 113.3, 40.09, '大同', 'Datong', { tier: 3, names: [[398, 494, '平城', 'Pingcheng']], capital: [[398, 494]], since: 1048 }),
  pl('shenyang', 123.43, 41.8, '沈阳', 'Shenyang', { tier: 2, names: [[1625, 1911, '盛京', 'Shengjing']], capital: [[1625, 1644]], since: 1296 }),
  pl('xingqing', 106.23, 38.49, '银川', 'Yinchuan', { tier: 3, names: [[1038, 1227, '兴庆府', 'Xingqing']], capital: [[1038, 1227]], since: 1945 }),
  pl('shangjing', 119.38, 43.95, '辽上京', 'Liao Supreme Capital', { kind: 'site', tier: 3, capital: [[918, 1120]], since: 918 }),
  pl('huining', 126.95, 45.5, '金上京', 'Jin Supreme Capital', { kind: 'site', tier: 3, capital: [[1115, 1153]], since: 1115 }),
  pl('dali', 100.16, 25.69, '大理', 'Dali', { tier: 3, names: [[738, 902, '太和城', 'Taihe']], capital: [[738, 1253]], since: 937 }),
  pl('chengdu', 104.07, 30.67, '成都', 'Chengdu', { tier: 1, capital: [[221, 263], [934, 965]], since: -316 }),
  pl('chongqing', 106.55, 29.56, '重庆', 'Chongqing', { tier: 2, capital: [[1937, 1946]], since: 1189 }),
  pl('wuhan', 114.3, 30.59, '武汉', 'Wuhan', { tier: 1, names: [[1911, 1949, '武昌', 'Wuchang']], since: 1949 }),
  pl('changsha', 112.94, 28.23, '长沙', 'Changsha', { tier: 2, since: -221 }),
  pl('guangzhou', 113.26, 23.13, '广州', 'Guangzhou', { tier: 1, names: [[-214, 226, '番禺', 'Panyu']], since: 226 }),
  pl('quanzhou', 118.59, 24.91, '泉州', 'Quanzhou', { tier: 2, since: 711 }),
  pl('yangzhou', 119.42, 32.39, '扬州', 'Yangzhou', { tier: 2, since: 589 }),
  pl('suzhou', 120.62, 31.3, '苏州', 'Suzhou', { tier: 3, since: 589 }),
  pl('shanghai', 121.47, 31.23, '上海', 'Shanghai', { tier: 1, since: 1292 }),
  pl('tianjin', 117.2, 39.13, '天津', 'Tianjin', { tier: 2, since: 1404 }),
  pl('jinan', 117.0, 36.67, '济南', 'Jinan', { tier: 3, since: -153 }),
  pl('qufu', 116.99, 35.6, '曲阜', 'Qufu', { tier: 2, capital: [[-1042, -256]], since: -1100 }),
  pl('linzi', 118.31, 36.86, '临淄', 'Linzi', { tier: 3, capital: [[-859, -221]], since: -900 }),
  pl('handan', 114.49, 36.6, '邯郸', 'Handan', { tier: 3, capital: [[-386, -228]], since: -500 }),
  pl('ying', 112.19, 30.35, '郢', 'Ying', { kind: 'site', tier: 3, capital: [[-689, -278]], since: -700 }),
  pl('fuzhou', 119.3, 26.08, '福州', 'Fuzhou', { tier: 3, since: 725 }),
  pl('kunming', 102.83, 24.88, '昆明', 'Kunming', { tier: 2, since: 1276 }),
  pl('lanzhou', 103.83, 36.06, '兰州', 'Lanzhou', { tier: 2, since: 581 }),
  pl('xining', 101.78, 36.62, '西宁', 'Xining', { tier: 3, since: 1104 }),
  pl('lhasa', 91.11, 29.65, '拉萨', 'Lhasa', { tier: 1, names: [[600, 1300, '逻些', 'Rasa']], capital: [[633, 842]], since: 1301 }),
  pl('urumqi', 87.62, 43.83, '乌鲁木齐', 'Ürümqi', { tier: 2, since: 1955, names: [[1763, 1954, '迪化', 'Dihua']] }),
  pl('kashgar', 75.99, 39.47, '喀什', 'Kashgar', { tier: 2, names: [[-200, 1700, '疏勒', 'Shule']], since: 1701 }),
  pl('luntai', 84.25, 41.78, '轮台', 'Luntai', { tier: 3, names: [[-60, 107, '乌垒（西域都护府）', 'Wulei']], since: -101 }),
  pl('turpan', 89.19, 42.95, '吐鲁番', 'Turpan', { tier: 3, names: [[-100, 1300, '高昌', 'Gaochang']], since: 1301 }),
  pl('dunhuang', 94.66, 40.14, '敦煌', 'Dunhuang', { tier: 1, since: -111 }),
  pl('jiuquan', 98.49, 39.73, '酒泉', 'Jiuquan', { tier: 3, since: -121 }),
  pl('hohhot', 111.75, 40.84, '呼和浩特', 'Hohhot', { tier: 2, since: 1954, names: [[1581, 1953, '归化城', 'Guihua']] }),
  pl('harbin', 126.63, 45.75, '哈尔滨', 'Harbin', { tier: 2, since: 1898 }),
  pl('changchun', 125.32, 43.82, '长春', 'Changchun', { tier: 3, since: 1800 }),
  pl('dalian', 121.61, 38.91, '大连', 'Dalian', { tier: 3, names: [[1898, 1945, '旅大', 'Port Arthur–Dalny']], since: 1946 }),
  pl('taipei', 121.56, 25.04, '台北', 'Taipei', { tier: 1, since: 1875 }),
  pl('tainan', 120.2, 22.99, '台南', 'Tainan', { tier: 3, since: 1887, names: [[1624, 1683, '赤嵌', 'Chikan'], [1684, 1886, '台湾府', 'Taiwan-fu']] }),
  pl('hongkong', 114.17, 22.32, '香港', 'Hong Kong', { tier: 1, since: 1842 }),
  pl('macao', 113.54, 22.19, '澳门', 'Macao', { tier: 2, since: 1557 }),
  pl('shenzhen', 114.06, 22.54, '深圳', 'Shenzhen', { tier: 2, since: 1979 }),
  pl('haikou', 110.35, 20.02, '海口', 'Haikou', { tier: 3, since: 1388 }),
  // ---- revolution and modern history sites ----------------------------------------------------------------------
  pl('jiaxing', 120.75, 30.75, '嘉兴南湖', 'South Lake, Jiaxing', { kind: 'site', tier: 3, since: 1921 }),
  pl('nanchang', 115.86, 28.68, '南昌', 'Nanchang', { tier: 2, since: 762 }),
  pl('jinggangshan', 114.17, 26.57, '井冈山', 'Jinggangshan', { kind: 'mountain', tier: 3, since: 1927 }),
  pl('ruijin', 116.03, 25.89, '瑞金', 'Ruijin', { tier: 3, since: 905 }),
  pl('zunyi', 106.93, 27.73, '遵义', 'Zunyi', { tier: 3, since: 639 }),
  pl('yanan', 109.49, 36.6, '延安', 'Yan’an', { tier: 2, since: 1089 }),
  pl('xibaipo', 113.94, 38.35, '西柏坡', 'Xibaipo', { kind: 'site', tier: 3, since: 1947 }),
  pl('lugouqiao', 116.21, 39.85, '卢沟桥', 'Marco Polo Bridge', { kind: 'site', tier: 3, since: 1192 }),
  pl('taierzhuang', 117.73, 34.56, '台儿庄', 'Tai’erzhuang', { kind: 'site', tier: 3, since: 1600 }),
  pl('pingxingguan', 113.93, 39.33, '平型关', 'Pingxingguan', { kind: 'pass', tier: 3, since: 1400 }),
  pl('humen', 113.67, 22.82, '虎门', 'Humen', { kind: 'site', tier: 3, since: 1800 }),
  pl('weihai', 122.12, 37.51, '威海卫', 'Weihaiwei', { tier: 3, since: 1398 }),
  pl('xiaogang', 117.85, 32.6, '小岗村', 'Xiaogang', { kind: 'site', tier: 3, since: 1978 }),
  pl('dandong', 124.38, 40.13, '丹东', 'Dandong', { tier: 3, names: [[1876, 1965, '安东', 'Andong']], since: 1966 }),
  pl('jiuquan_lc', 100.28, 40.96, '酒泉卫星发射中心', 'Jiuquan Satellite Launch Center', { kind: 'site', tier: 3, since: 1958 }),
  pl('lop_nur', 90.25, 40.6, '罗布泊', 'Lop Nur', { kind: 'site', tier: 3, since: 1959 }),
  // ---- passes ---------------------------------------------------------------------------------------------------
  pl('yumenguan', 93.86, 40.35, '玉门关', 'Yumen Pass', { kind: 'pass', tier: 2, since: -111 }),
  pl('jiayuguan', 98.21, 39.8, '嘉峪关', 'Jiayu Pass', { kind: 'pass', tier: 2, since: 1372 }),
  pl('shanhaiguan', 119.75, 40.0, '山海关', 'Shanhai Pass', { kind: 'pass', tier: 2, since: 1381 }),
  pl('hanguguan', 110.92, 34.63, '函谷关', 'Hangu Pass', { kind: 'pass', tier: 3, since: -700 }),
  pl('tongguan', 110.25, 34.54, '潼关', 'Tong Pass', { kind: 'pass', tier: 3, since: 200 }),
  pl('jianmenguan', 105.55, 32.2, '剑门关', 'Jianmen Pass', { kind: 'pass', tier: 3, since: 220 }),
  // ---- prehistoric and archaeological sites ---------------------------------------------------------------------
  pl('yuanmou', 101.87, 25.68, '元谋', 'Yuanmou', { kind: 'site', tier: 3, until: -1000 }),
  pl('zhoukoudian', 115.93, 39.69, '周口店', 'Zhoukoudian', { kind: 'site', tier: 3, until: -1000 }),
  pl('banpo', 109.05, 34.27, '半坡', 'Banpo', { kind: 'site', tier: 3, until: -1000 }),
  pl('hemudu', 121.35, 29.97, '河姆渡', 'Hemudu', { kind: 'site', tier: 3, until: -1000 }),
  pl('liangzhu', 119.99, 30.39, '良渚', 'Liangzhu', { kind: 'site', tier: 3, until: -1000 }),
  pl('dawenkou', 117.1, 35.95, '大汶口', 'Dawenkou', { kind: 'site', tier: 3, until: -1000 }),
  pl('sanxingdui', 104.21, 30.99, '三星堆', 'Sanxingdui', { kind: 'site', tier: 3, until: -800 }),
  pl('dujiangyan', 103.61, 31.0, '都江堰', 'Dujiangyan', { kind: 'site', tier: 3, since: 960, names: [[-256, 959, '都安堰', 'Du’an Weir']] }),
  pl('lingqu', 110.57, 25.6, '灵渠', 'Lingqu Canal', { kind: 'site', tier: 3, since: 618, names: [[-214, -207, '秦凿渠', 'Qin Canal'], [-206, 617, '零渠', 'Ling Canal']] }),
  pl('zhaozhou', 114.77, 37.71, '赵州桥', 'Zhaozhou Bridge', { kind: 'site', tier: 3, since: 605 }),
  pl('yungang', 113.12, 40.11, '云冈石窟', 'Yungang Grottoes', { kind: 'site', tier: 3, since: 1550, names: [[460, 1549, '武州山石窟寺', 'Wuzhou Shan Grottoes']] }),
  pl('longmen', 112.47, 34.56, '龙门石窟', 'Longmen Grottoes', { kind: 'site', tier: 3, since: 493 }),
  pl('mogao', 94.8, 40.04, '莫高窟', 'Mogao Caves', { kind: 'site', tier: 3, since: 698, names: [[366, 697, '鸣沙山石窟', 'Mingsha Shan Caves']] }),
  // ---- battlefields ---------------------------------------------------------------------------------------------
  pl('muye', 113.9, 35.2, '牧野', 'Muye', { kind: 'site', tier: 3, since: -1100 }),
  pl('changping', 112.9, 35.8, '长平', 'Changping', { kind: 'site', tier: 3, since: -300 }),
  pl('julu', 115.0, 37.2, '巨鹿', 'Julu', { kind: 'site', tier: 3, since: -300 }),
  pl('gaixia', 117.6, 33.3, '垓下', 'Gaixia', { kind: 'site', tier: 3, since: -250 }),
  pl('dazexiang', 117.0, 33.4, '大泽乡', 'Dazexiang', { kind: 'site', tier: 3, since: -250 }),
  pl('guandu', 114.1, 34.7, '官渡', 'Guandu', { kind: 'site', tier: 3, since: 150 }),
  pl('chibi', 113.9, 29.83, '赤壁', 'Red Cliffs', { kind: 'site', tier: 3, since: 150 }),
  pl('feishui', 116.8, 32.3, '淝水', 'Fei River', { kind: 'site', tier: 3, since: 350 }),
  pl('yashan', 113.07, 22.08, '崖山', 'Yamen', { kind: 'site', tier: 3, since: 1200 }),
  // ---- beyond the stage's centre --------------------------------------------------------------------------------
  pl('nara', 135.8, 34.68, '奈良', 'Nara', { tier: 3, names: [[710, 794, '平城京', 'Heijō-kyō']], since: 795 }),
  pl('kyoto', 135.77, 35.01, '京都', 'Kyoto', { tier: 3, since: 1869, names: [[794, 1868, '平安京', 'Heian-kyō']] }),
  pl('tokyo', 139.69, 35.69, '东京', 'Tokyo', { tier: 2, names: [[1600, 1867, '江户', 'Edo']], since: 1868 }),
  pl('seoul', 126.98, 37.57, '首尔', 'Seoul', { tier: 2, since: 2005, names: [[1394, 1909, '汉城', 'Hanseong'], [1910, 1945, '京城', 'Keijō'], [1946, 2004, '汉城', 'Seoul']] }),
  pl('pyongyang', 125.75, 39.03, '平壤', 'Pyongyang', { tier: 3, since: 427 }),
  pl('albazin', 124.2, 53.4, '雅克萨', 'Albazin', { kind: 'site', tier: 3, since: 1650 }),
  pl('nerchinsk', 116.6, 51.98, '尼布楚', 'Nerchinsk', { tier: 3, since: 1654 }),
  pl('vladivostok', 131.9, 43.12, '海参崴', 'Vladivostok', { tier: 3, since: 1860 }),
  pl('talas', 72.3, 42.5, '怛罗斯', 'Talas', { kind: 'site', tier: 3, since: -100 }),
  pl('samarkand', 66.97, 39.65, '撒马尔罕', 'Samarkand', { tier: 3, since: 1220, names: [[600, 900, '康国', 'Kang']] }),
  pl('nalanda', 85.44, 25.14, '那烂陀寺', 'Nalanda', { kind: 'site', tier: 3, since: 427 }),
  pl('calicut', 75.78, 11.25, '古里', 'Calicut', { tier: 3, since: 1405 }),
  pl('malacca', 102.25, 2.2, '满剌加', 'Malacca', { tier: 3, since: 1405 }),
  pl('hanoi', 105.85, 21.03, '河内', 'Hanoi', { tier: 3, names: [[-111, 938, '交趾', 'Jiaozhi'], [1010, 1831, '升龙', 'Thăng Long']], since: 1831 }),
  // ---- geography --------------------------------------------------------------------------------------------------
  pl('everest', 86.92, 27.99, '珠穆朗玛峰', 'Qomolangma (Everest)', { kind: 'mountain', tier: 2, since: 1719 }),
  pl('taishan', 117.1, 36.25, '泰山', 'Mount Tai', { kind: 'mountain', tier: 3 }),
  pl('diaoyu', 123.47, 25.75, '钓鱼岛', 'Diaoyu Islands', { kind: 'water', tier: 3, since: 1403 }),
  pl('nanhai', 114.0, 12.0, '南海诸岛', 'South China Sea Islands', { kind: 'water', tier: 2, since: 1947 }),
  pl('xisha', 112.3, 16.5, '西沙群岛', 'Paracel (Xisha) Islands', { kind: 'water', tier: 3, since: 1947 }),
  pl('nansha', 114.5, 9.5, '南沙群岛', 'Spratly (Nansha) Islands', { kind: 'water', tier: 3, since: 1947 }),
];

/** Curated places first, then the imported settlements, passes and city lore (which also enrich curated places). */
export const PLACES: Place[] = [...CURATED, ...importedPlaces(CURATED)];

export const PLACE = new Map(PLACES.map(p => [p.id, p]));

/** Whether a place exists in `year` (period-only places vanish outside their named periods). */
export const placeExists = (p: Place, year: Year): boolean => !p.periodOnly || !!p.names?.some(n => year >= n.from && year <= n.to);

const named = (p: Place, year: Year): I18n | undefined =>
  (p.names?.find(n => year >= n.from && year <= n.to) ?? p.periods?.find(n => year >= n.from && year <= n.to))?.name;

/** The name a place had in `year` (falls back to the modern name). */
export function placeName(p: Place, year: Year): I18n {
  return named(p, year) ?? p.name;
}

/**
 * The name to print on the map in `year`, or null: only names in use at the time (curated, then imported periods),
 * the modern name only from `since` on, and nothing after `until`. Places without either keep their (historic) name.
 */
export function mapName(p: Place, year: Year): I18n | null {
  if (!placeExists(p, year) || (p.until != null && year > p.until)) return null;
  const n = named(p, year);
  if (n) return n;
  if (p.periodOnly) return null;
  if (p.since != null) return year >= p.since ? p.name : null;
  return p.kind === 'city' ? null : p.name;
}

type Period = [from: Year, to: Year, zh: string, en: string];
const ANY = -2_000_000;
/**
 * Period names of rivers and lakes, keyed by the label's name: an older name inside its years, `now` (the current
 * name) from `since`, and nothing in between (a modern name such as 塔里木河 or 斋桑泊 is not printed in antiquity).
 */
const WATER: Record<string, { names?: Period[]; since?: Year; now?: [string, string] }> = {
  黄河: { names: [[ANY, -207, '河水', 'He (Yellow R.)']] },
  长江: { names: [[ANY, 219, '江水', 'Jiang (Yangtze R.)']] },
  珠江: { names: [[ANY, 959, '郁水', 'Yu R.'], [960, 1643, '西江', 'Xi R.']] },
  赣江: { names: [[ANY, 588, '赣水', 'Gan R.']] },
  辽河: { names: [[ANY, 906, '辽水', 'Liao R.']] },
  松花江: { names: [[ANY, 906, '粟末水', 'Sumo R.'], [907, 1367, '宋瓦江', 'Songwa R.']] },
  黑龙江: { names: [[ANY, 906, '黑水', 'Heishui (Amur)']] },
  伊犁河: { names: [[ANY, 617, '伊列水', 'Yilie R.'], [618, 1643, '伊丽水', 'Yili R.']] },
  塔里木河: { since: 1700 },
  雅鲁藏布江: { since: 1700 },
  '彭蠡·鄱阳': { names: [[ANY, 588, '彭蠡泽', 'Pengli Marsh']], now: ['鄱阳湖', 'Poyang L.'] },
  青海: { names: [[ANY, 385, '西海', 'Xihai (Qinghai L.)']] },
  '北海（贝加尔）': { names: [[ANY, 1699, '北海', 'Beihai (L. Baikal)']], now: ['贝加尔湖', 'L. Baikal'] },
  '蒲昌海·罗布泊': { names: [[ANY, 1299, '蒲昌海', 'Puchang Sea']], now: ['罗布泊', 'Lop Nur'] },
  博斯腾湖: { since: 1700 },
  '热海（伊塞克）': { names: [[ANY, 1699, '热海', 'Rehai (Issyk-Kul)']], now: ['伊塞克湖', 'Issyk-Kul'] },
  '夷播海（巴尔喀什）': { names: [[ANY, 1699, '夷播海', 'Yibo Sea (L. Balkhash)']], now: ['巴尔喀什湖', 'L. Balkhash'] },
  斋桑泊: { since: 1700 },
  洪泽: { now: ['洪泽湖', 'Hongze L.'] },
};

/** The name a river or lake label shows in `year`, or null while it did not exist or had no name we can print. */
export function riverName(r: RiverLabel, year: Year): I18n | null {
  if ((r.from != null && year < r.from) || (r.to != null && year > r.to)) return null;
  const w = WATER[r.name.zh];
  if (!w) return r.name;
  const n = w.names?.find(([a, b]) => year >= a && year <= b);
  if (n) return { zh: n[2], en: n[3] };
  if (w.since != null && year < w.since) return null;
  return w.now ? { zh: w.now[0], en: w.now[1] } : r.name;
}

export function isCapital(p: Place, year: Year): boolean {
  return !!p.capital?.some(([a, b]) => year >= a && year <= b);
}
