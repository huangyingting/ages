import { importedPlaces } from './jiangshan.ts';
import type { I18n, Place, Year } from './types.ts';

type Names = [from: Year, to: Year, zh: string, en: string][];
const pl = (id: string, lon: number, lat: number, zh: string, en: string, o: {
  kind?: Place['kind']; tier?: Place['tier']; names?: Names; capital?: [Year, Year][];
} = {}): Place => ({
  id, scope: 'china', lon, lat, kind: o.kind ?? 'city', tier: o.tier ?? 2, name: { zh, en },
  names: o.names?.map(([from, to, z, e]) => ({ from, to, name: { zh: z, en: e } })),
  capital: o.capital,
});

/** Cities, passes and sites. Names change with the period (镐京 → 长安 → 大兴 → 西安); capitals get a marker. */
const CURATED: Place[] = [
  // ---- great capitals -------------------------------------------------------------------------------------------
  pl('xian', 108.94, 34.27, '西安', 'Xi’an', { tier: 1,
    names: [[-1046, -771, '镐京', 'Haojing'], [-202, 581, '长安', 'Chang’an'], [582, 617, '大兴', 'Daxing'], [618, 1368, '长安', 'Chang’an']],
    capital: [[-1046, -771], [-202, 8], [190, 195], [582, 904]] }),
  pl('xianyang', 108.71, 34.33, '咸阳', 'Xianyang', { tier: 2, capital: [[-350, -207]] }),
  pl('luoyang', 112.45, 34.62, '洛阳', 'Luoyang', { tier: 1, names: [[-770, -256, '洛邑', 'Luoyi']],
    capital: [[-770, -256], [25, 190], [220, 311], [494, 534], [605, 618], [690, 705], [923, 936]] }),
  pl('anyang', 114.32, 36.12, '安阳', 'Anyang', { tier: 2, names: [[-1300, -1046, '殷', 'Yin']], capital: [[-1300, -1046]] }),
  pl('erlitou', 112.69, 34.69, '二里头', 'Erlitou', { kind: 'site', tier: 3 }),
  pl('zhengzhou', 113.65, 34.76, '郑州', 'Zhengzhou', { tier: 2, names: [[-1600, -1300, '亳', 'Bo']] }),
  pl('kaifeng', 114.31, 34.8, '开封', 'Kaifeng', { tier: 1,
    names: [[-364, -225, '大梁', 'Daliang'], [907, 1127, '东京（汴梁）', 'Bianjing']], capital: [[907, 923], [936, 1127]] }),
  pl('hangzhou', 120.16, 30.27, '杭州', 'Hangzhou', { tier: 1, names: [[1129, 1276, '临安', 'Lin’an']], capital: [[907, 978], [1138, 1276]] }),
  pl('nanjing', 118.78, 32.06, '南京', 'Nanjing', { tier: 1,
    names: [[229, 280, '建业', 'Jianye'], [317, 589, '建康', 'Jiankang'], [937, 975, '金陵', 'Jinling'], [1368, 1420, '应天府', 'Yingtian'],
      [1853, 1864, '天京', 'Tianjing']],
    capital: [[229, 280], [317, 589], [937, 975], [1368, 1420], [1853, 1864], [1912, 1912], [1927, 1949]] }),
  pl('beijing', 116.4, 39.9, '北京', 'Beijing', { tier: 1,
    names: [[-1045, -222, '蓟', 'Ji'], [-221, 937, '幽州', 'Youzhou'], [938, 1152, '燕京', 'Yanjing'], [1153, 1214, '中都', 'Zhongdu'],
      [1267, 1368, '大都', 'Dadu'], [1369, 1402, '北平', 'Beiping'], [1928, 1949, '北平', 'Beiping']],
    capital: [[1153, 1214], [1267, 1368], [1421, 1911], [1912, 1927], [1949, 2100]] }),
  pl('datong', 113.3, 40.09, '大同', 'Datong', { tier: 3, names: [[398, 494, '平城', 'Pingcheng']], capital: [[398, 494]] }),
  pl('shenyang', 123.43, 41.8, '沈阳', 'Shenyang', { tier: 2, names: [[1625, 1911, '盛京', 'Shengjing']], capital: [[1625, 1644]] }),
  pl('xingqing', 106.23, 38.49, '银川', 'Yinchuan', { tier: 3, names: [[1038, 1227, '兴庆府', 'Xingqing']], capital: [[1038, 1227]] }),
  pl('shangjing', 119.38, 43.95, '辽上京', 'Liao Supreme Capital', { kind: 'site', tier: 3, capital: [[918, 1120]] }),
  pl('huining', 126.95, 45.5, '金上京', 'Jin Supreme Capital', { kind: 'site', tier: 3, capital: [[1115, 1153]] }),
  pl('dali', 100.16, 25.69, '大理', 'Dali', { tier: 3, names: [[738, 902, '太和城', 'Taihe']], capital: [[738, 1253]] }),
  pl('chengdu', 104.07, 30.67, '成都', 'Chengdu', { tier: 1, capital: [[221, 263], [934, 965]] }),
  pl('chongqing', 106.55, 29.56, '重庆', 'Chongqing', { tier: 2, capital: [[1937, 1946]] }),
  pl('wuhan', 114.3, 30.59, '武汉', 'Wuhan', { tier: 1, names: [[1911, 1949, '武昌', 'Wuchang']] }),
  pl('changsha', 112.94, 28.23, '长沙', 'Changsha', { tier: 2 }),
  pl('guangzhou', 113.26, 23.13, '广州', 'Guangzhou', { tier: 1, names: [[-214, 226, '番禺', 'Panyu']] }),
  pl('quanzhou', 118.59, 24.91, '泉州', 'Quanzhou', { tier: 2 }),
  pl('yangzhou', 119.42, 32.39, '扬州', 'Yangzhou', { tier: 2 }),
  pl('suzhou', 120.62, 31.3, '苏州', 'Suzhou', { tier: 3 }),
  pl('shanghai', 121.47, 31.23, '上海', 'Shanghai', { tier: 1 }),
  pl('tianjin', 117.2, 39.13, '天津', 'Tianjin', { tier: 2 }),
  pl('jinan', 117.0, 36.67, '济南', 'Jinan', { tier: 3 }),
  pl('qufu', 116.99, 35.6, '曲阜', 'Qufu', { tier: 2, capital: [[-1042, -256]] }),
  pl('linzi', 118.31, 36.86, '临淄', 'Linzi', { tier: 3, capital: [[-859, -221]] }),
  pl('handan', 114.49, 36.6, '邯郸', 'Handan', { tier: 3, capital: [[-386, -228]] }),
  pl('ying', 112.19, 30.35, '郢', 'Ying', { kind: 'site', tier: 3, capital: [[-689, -278]] }),
  pl('fuzhou', 119.3, 26.08, '福州', 'Fuzhou', { tier: 3 }),
  pl('kunming', 102.83, 24.88, '昆明', 'Kunming', { tier: 2 }),
  pl('lanzhou', 103.83, 36.06, '兰州', 'Lanzhou', { tier: 2 }),
  pl('xining', 101.78, 36.62, '西宁', 'Xining', { tier: 3 }),
  pl('lhasa', 91.11, 29.65, '拉萨', 'Lhasa', { tier: 1, names: [[600, 1300, '逻些', 'Rasa']], capital: [[633, 842]] }),
  pl('urumqi', 87.62, 43.83, '乌鲁木齐', 'Ürümqi', { tier: 2, names: [[1763, 1884, '迪化', 'Dihua']] }),
  pl('kashgar', 75.99, 39.47, '喀什', 'Kashgar', { tier: 2, names: [[-200, 1700, '疏勒', 'Shule']] }),
  pl('luntai', 84.25, 41.78, '轮台', 'Luntai', { tier: 3, names: [[-60, 107, '乌垒（西域都护府）', 'Wulei']] }),
  pl('turpan', 89.19, 42.95, '吐鲁番', 'Turpan', { tier: 3, names: [[-100, 1300, '高昌', 'Gaochang']] }),
  pl('dunhuang', 94.66, 40.14, '敦煌', 'Dunhuang', { tier: 1 }),
  pl('jiuquan', 98.49, 39.73, '酒泉', 'Jiuquan', { tier: 3 }),
  pl('hohhot', 111.75, 40.84, '呼和浩特', 'Hohhot', { tier: 2 }),
  pl('harbin', 126.63, 45.75, '哈尔滨', 'Harbin', { tier: 2 }),
  pl('changchun', 125.32, 43.82, '长春', 'Changchun', { tier: 3 }),
  pl('dalian', 121.61, 38.91, '大连', 'Dalian', { tier: 3, names: [[1898, 1945, '旅大', 'Port Arthur–Dalny']] }),
  pl('taipei', 121.56, 25.04, '台北', 'Taipei', { tier: 1 }),
  pl('tainan', 120.2, 22.99, '台南', 'Tainan', { tier: 3, names: [[1624, 1683, '赤嵌', 'Chikan']] }),
  pl('hongkong', 114.17, 22.32, '香港', 'Hong Kong', { tier: 1 }),
  pl('macao', 113.54, 22.19, '澳门', 'Macao', { tier: 2 }),
  pl('shenzhen', 114.06, 22.54, '深圳', 'Shenzhen', { tier: 2 }),
  pl('haikou', 110.35, 20.02, '海口', 'Haikou', { tier: 3 }),
  // ---- revolution and modern history sites ----------------------------------------------------------------------
  pl('jiaxing', 120.75, 30.75, '嘉兴南湖', 'South Lake, Jiaxing', { kind: 'site', tier: 3 }),
  pl('nanchang', 115.86, 28.68, '南昌', 'Nanchang', { tier: 2 }),
  pl('jinggangshan', 114.17, 26.57, '井冈山', 'Jinggangshan', { kind: 'mountain', tier: 3 }),
  pl('ruijin', 116.03, 25.89, '瑞金', 'Ruijin', { tier: 3 }),
  pl('zunyi', 106.93, 27.73, '遵义', 'Zunyi', { tier: 3 }),
  pl('yanan', 109.49, 36.6, '延安', 'Yan’an', { tier: 2 }),
  pl('xibaipo', 113.94, 38.35, '西柏坡', 'Xibaipo', { kind: 'site', tier: 3 }),
  pl('lugouqiao', 116.21, 39.85, '卢沟桥', 'Marco Polo Bridge', { kind: 'site', tier: 3 }),
  pl('taierzhuang', 117.73, 34.56, '台儿庄', 'Tai’erzhuang', { kind: 'site', tier: 3 }),
  pl('pingxingguan', 113.93, 39.33, '平型关', 'Pingxingguan', { kind: 'pass', tier: 3 }),
  pl('humen', 113.67, 22.82, '虎门', 'Humen', { kind: 'site', tier: 3 }),
  pl('weihai', 122.12, 37.51, '威海卫', 'Weihaiwei', { tier: 3 }),
  pl('xiaogang', 117.85, 32.6, '小岗村', 'Xiaogang', { kind: 'site', tier: 3 }),
  pl('dandong', 124.38, 40.13, '丹东', 'Dandong', { tier: 3, names: [[1876, 1965, '安东', 'Andong']] }),
  pl('jiuquan_lc', 100.28, 40.96, '酒泉卫星发射中心', 'Jiuquan Satellite Launch Center', { kind: 'site', tier: 3 }),
  pl('lop_nur', 90.25, 40.6, '罗布泊', 'Lop Nur', { kind: 'water', tier: 3 }),
  // ---- passes ---------------------------------------------------------------------------------------------------
  pl('yumenguan', 93.86, 40.35, '玉门关', 'Yumen Pass', { kind: 'pass', tier: 2 }),
  pl('jiayuguan', 98.21, 39.8, '嘉峪关', 'Jiayu Pass', { kind: 'pass', tier: 2 }),
  pl('shanhaiguan', 119.75, 40.0, '山海关', 'Shanhai Pass', { kind: 'pass', tier: 2 }),
  pl('hanguguan', 110.92, 34.63, '函谷关', 'Hangu Pass', { kind: 'pass', tier: 3 }),
  pl('tongguan', 110.25, 34.54, '潼关', 'Tong Pass', { kind: 'pass', tier: 3 }),
  pl('jianmenguan', 105.55, 32.2, '剑门关', 'Jianmen Pass', { kind: 'pass', tier: 3 }),
  // ---- prehistoric and archaeological sites ---------------------------------------------------------------------
  pl('yuanmou', 101.87, 25.68, '元谋', 'Yuanmou', { kind: 'site', tier: 3 }),
  pl('zhoukoudian', 115.93, 39.69, '周口店', 'Zhoukoudian', { kind: 'site', tier: 3 }),
  pl('banpo', 109.05, 34.27, '半坡', 'Banpo', { kind: 'site', tier: 3 }),
  pl('hemudu', 121.35, 29.97, '河姆渡', 'Hemudu', { kind: 'site', tier: 3 }),
  pl('liangzhu', 119.99, 30.39, '良渚', 'Liangzhu', { kind: 'site', tier: 3 }),
  pl('dawenkou', 117.1, 35.95, '大汶口', 'Dawenkou', { kind: 'site', tier: 3 }),
  pl('sanxingdui', 104.21, 30.99, '三星堆', 'Sanxingdui', { kind: 'site', tier: 3 }),
  pl('dujiangyan', 103.61, 31.0, '都江堰', 'Dujiangyan', { kind: 'site', tier: 3 }),
  pl('lingqu', 110.57, 25.6, '灵渠', 'Lingqu Canal', { kind: 'site', tier: 3 }),
  pl('zhaozhou', 114.77, 37.71, '赵州桥', 'Zhaozhou Bridge', { kind: 'site', tier: 3 }),
  pl('yungang', 113.12, 40.11, '云冈石窟', 'Yungang Grottoes', { kind: 'site', tier: 3 }),
  pl('longmen', 112.47, 34.56, '龙门石窟', 'Longmen Grottoes', { kind: 'site', tier: 3 }),
  pl('mogao', 94.8, 40.04, '莫高窟', 'Mogao Caves', { kind: 'site', tier: 3 }),
  // ---- battlefields ---------------------------------------------------------------------------------------------
  pl('muye', 113.9, 35.2, '牧野', 'Muye', { kind: 'site', tier: 3 }),
  pl('changping', 112.9, 35.8, '长平', 'Changping', { kind: 'site', tier: 3 }),
  pl('julu', 115.0, 37.2, '巨鹿', 'Julu', { kind: 'site', tier: 3 }),
  pl('gaixia', 117.6, 33.3, '垓下', 'Gaixia', { kind: 'site', tier: 3 }),
  pl('dazexiang', 117.0, 33.4, '大泽乡', 'Dazexiang', { kind: 'site', tier: 3 }),
  pl('guandu', 114.1, 34.7, '官渡', 'Guandu', { kind: 'site', tier: 3 }),
  pl('chibi', 113.9, 29.83, '赤壁', 'Red Cliffs', { kind: 'site', tier: 3 }),
  pl('feishui', 116.8, 32.3, '淝水', 'Fei River', { kind: 'site', tier: 3 }),
  pl('yashan', 113.07, 22.08, '崖山', 'Yamen', { kind: 'site', tier: 3 }),
  // ---- beyond the stage's centre --------------------------------------------------------------------------------
  pl('nara', 135.8, 34.68, '奈良', 'Nara', { tier: 3, names: [[710, 794, '平城京', 'Heijō-kyō']] }),
  pl('kyoto', 135.77, 35.01, '京都', 'Kyoto', { tier: 3 }),
  pl('tokyo', 139.69, 35.69, '东京', 'Tokyo', { tier: 2, names: [[1600, 1867, '江户', 'Edo']] }),
  pl('seoul', 126.98, 37.57, '首尔', 'Seoul', { tier: 2, names: [[1394, 1910, '汉城', 'Hanseong']] }),
  pl('pyongyang', 125.75, 39.03, '平壤', 'Pyongyang', { tier: 3 }),
  pl('albazin', 124.2, 53.4, '雅克萨', 'Albazin', { kind: 'site', tier: 3 }),
  pl('nerchinsk', 116.6, 51.98, '尼布楚', 'Nerchinsk', { tier: 3 }),
  pl('vladivostok', 131.9, 43.12, '海参崴', 'Vladivostok', { tier: 3 }),
  pl('talas', 72.3, 42.5, '怛罗斯', 'Talas', { kind: 'site', tier: 3 }),
  pl('samarkand', 66.97, 39.65, '撒马尔罕', 'Samarkand', { tier: 3 }),
  pl('nalanda', 85.44, 25.14, '那烂陀寺', 'Nalanda', { kind: 'site', tier: 3 }),
  pl('calicut', 75.78, 11.25, '古里', 'Calicut', { tier: 3 }),
  pl('malacca', 102.25, 2.2, '满剌加', 'Malacca', { tier: 3 }),
  pl('hanoi', 105.85, 21.03, '河内', 'Hanoi', { tier: 3, names: [[-111, 938, '交趾', 'Jiaozhi'], [1010, 1831, '升龙', 'Thăng Long']] }),
  // ---- geography --------------------------------------------------------------------------------------------------
  pl('everest', 86.92, 27.99, '珠穆朗玛峰', 'Mount Everest', { kind: 'mountain', tier: 2 }),
  pl('taishan', 117.1, 36.25, '泰山', 'Mount Tai', { kind: 'mountain', tier: 3 }),
  pl('diaoyu', 123.47, 25.75, '钓鱼岛', 'Diaoyu Islands', { kind: 'water', tier: 3 }),
  pl('nanhai', 114.0, 12.0, '南海诸岛', 'South China Sea Islands', { kind: 'water', tier: 2 }),
  pl('xisha', 112.3, 16.5, '西沙群岛', 'Paracel (Xisha) Islands', { kind: 'water', tier: 3 }),
  pl('nansha', 114.5, 9.5, '南沙群岛', 'Spratly (Nansha) Islands', { kind: 'water', tier: 3 }),
];

/** Curated places first, then the imported settlements, passes and city lore (which also enrich curated places). */
export const PLACES: Place[] = [...CURATED, ...importedPlaces(CURATED)];

export const PLACE = new Map(PLACES.map(p => [p.id, p]));

/** Whether a place exists in `year` (period-only places vanish outside their named periods). */
export const placeExists = (p: Place, year: Year): boolean => !p.periodOnly || !!p.names?.some(n => year >= n.from && year <= n.to);

/** The name a place had in `year` (falls back to the modern name). */
export function placeName(p: Place, year: Year): I18n {
  const n = p.names?.find(n => year >= n.from && year <= n.to);
  return n?.name ?? p.name;
}

export function isCapital(p: Place, year: Year): boolean {
  return !!p.capital?.some(([a, b]) => year >= a && year <= b);
}
