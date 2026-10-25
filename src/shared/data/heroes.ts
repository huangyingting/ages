import type { HistEvent, ModelRecipe, Place } from './types.ts';

/**
 * Detailed "hero" models (pocket-planet packs, src/client/models/heroes) for landmark events, places and people.
 * A recipe `{ kind, hero: 'pack/name' }` falls back to the generic `kind` model until its pack has loaded.
 */
const EVENT_HERO: Record<string, string> = {
  ming_wall: 'asia/greatwall', terracotta: 'asia3/terracotta', forbidden_city: 'asia/forbidden',
  confucius: 'people-a/pp_confucius', cailun: 'people-a/pp_cailun', zhangheng: 'people-a/pp_zhangheng',
  zuchongzhi: 'people-a/pp_zuchongzhi', ming_science: 'people-a/pp_lishizhen', tang_poetry: 'people-b/pp_libai',
  wangxizhi: 'people-b/pp_wangxizhi', xuanzang: 'people-c/pp_xuanzang', marco_polo: 'people-c/pp_marcopolo',
  zhenghe: 'journeys/vy_zhenghe', zhangqian: 'journeys/vy_silkroad', jianzhen: 'routes2/vy_jianzhen',
  zhuzang: 'asia2/potala', tibet1951: 'asia2/potala',
};

/** Title keywords of imported chronicle events → hero. */
const TITLE_HERO: [RegExp, string][] = [
  [/莫高窟|敦煌石窟/, 'china/cn_mogao'], [/黄鹤楼/, 'china/cn_yellowcrane'], [/乐山大佛/, 'asia3/leshan'],
  [/泰山|封禅/, 'china/cn_taishan'], [/天坛/, 'asia2/templeofheaven'], [/布达拉宫/, 'asia2/potala'],
  [/悬空寺/, 'china/cn_hangingtemple'], [/马王堆/, 'archaeology/ar_mawangdui'], [/三星堆/, 'archaeology/ar_sanxingdui'],
  [/兵马俑/, 'asia3/terracotta'], [/紫禁城|故宫/, 'asia/forbidden'], [/长城/, 'asia/greatwall'], [/青藏铁路/, 'routes2/vh_qinghaitibet'],
];

/** Landmark model per place (modern name). */
const PLACE_HERO: Record<string, ModelRecipe> = {
  拉萨: { kind: 'temple', hero: 'asia2/potala' }, 敦煌: { kind: 'temple', hero: 'china/cn_mogao' },
  杭州: { kind: 'pagoda', hero: 'china/cn_westlake' }, 武汉: { kind: 'pagoda', hero: 'china/cn_yellowcrane' },
  泰安: { kind: 'temple', hero: 'china/cn_taishan' }, 泰山: { kind: 'temple', hero: 'china/cn_taishan' },
  乐山: { kind: 'statue', hero: 'asia3/leshan' }, 桂林: { kind: 'boat', hero: 'china/cn_guilin' },
  北京: { kind: 'palace', hero: 'asia/forbidden' }, 西安: { kind: 'warrior', hero: 'asia3/terracotta' },
  广汉: { kind: 'ding', hero: 'archaeology/ar_sanxingdui' }, 长沙: { kind: 'ding', hero: 'archaeology/ar_mawangdui' },
  大同: { kind: 'temple', hero: 'china/cn_hangingtemple' }, 黄山: { kind: 'pagoda', hero: 'china/cn_huangshan' },
  上海: { kind: 'skyline', hero: 'china/cn_bund' }, 山海关: { kind: 'gate', hero: 'sites-b/st_shanhaiguan' },
  嘉峪关: { kind: 'gate', hero: 'sites-b/st_jiayuguan' }, 八达岭: { kind: 'wall', hero: 'asia/greatwall' },
};

/** People with their own detailed figure. */
const PERSON_HERO: Record<string, string> = {
  孔子: 'people-a/pp_confucius', 张衡: 'people-a/pp_zhangheng', 蔡伦: 'people-a/pp_cailun', 祖冲之: 'people-a/pp_zuchongzhi',
  李时珍: 'people-a/pp_lishizhen', 李白: 'people-b/pp_libai', 屈原: 'people-b/pp_quyuan', 王羲之: 'people-b/pp_wangxizhi',
  郑和: 'people-c/pp_zhenghe', 玄奘: 'people-c/pp_xuanzang', 华佗: 'people-c/pp_huatuo', 马可·波罗: 'people-c/pp_marcopolo',
};

/** Adds the hero landmark to an event's model recipe when one fits. */
export function withHero(e: HistEvent): HistEvent {
  const hero = EVENT_HERO[e.id] ?? TITLE_HERO.find(([re]) => re.test(e.title.zh))?.[1];
  if (!hero || (e.model && typeof e.model.hero === 'string')) return e;
  return { ...e, model: { kind: 'monument', ...e.model, hero } };
}

/**
 * The capital's model: the seat's own palace, so every city stands as itself (one model, one subject) — Erlitou, Yinxu,
 * Zhou terraces, Eastern Zhou Luoyi, Qin Xianyang, Han Weiyang, Eastern Han and Wei–Jin Luoyang, Jiankang, the Tang
 * Hanyuan Hall, the Song Xuande Gate, Lin'an, Yuan Dadu, the Forbidden City (Ming–Qing, the same model as its landmark), Nanjing's Presidential
 * Palace and Beijing's monument. Periods without one capital show a generic hall of their age on the era card.
 */
export function capitalModel(era: { id: string; start: number }): ModelRecipe {
  const by: Record<string, string> = {
    xia: 'cap_erlitou', shang: 'cap_yinxu', wzhou: 'cap_zhou', chunqiu: 'cap_luoyi', qin: 'cap_xianyang', whan: 'cap_qinhan', xin: 'cap_qinhan',
    ehan: 'cap_luoyang', wjin: 'cap_taiji', ejin: 'cap_jiankang', sui: 'cap_tang', tang: 'cap_tang', bsong: 'cap_song', nsong: 'cap_linan',
    yuan: 'cap_yuan', roc: 'cap_nanjing_roc',
  };
  const h = by[era.id];
  if (h) return { kind: 'palace', hero: 'capitals/' + h };
  const eraHero: Record<string, ModelRecipe> = {
    paleo: { kind: 'cave' },
    neo: { kind: 'hut' },
    zhanguo: { kind: 'palace', style: 'han', year: -350 },
    sanguo: { kind: 'palace', hero: 'life-arch1/lf_tongque' },
    nanbei: { kind: 'pagoda', hero: 'life-arch1/lf_songyue' },
    wudai: { kind: 'palace', style: 'tang', year: 930 },
    liao: { kind: 'yurt', hero: 'sites-a/st_khitan' },
    xixia: { kind: 'monument', hero: 'sites-a/st_xixia' },
    jin: { kind: 'temple', hero: 'life-arch1/lf_foguang', style: 'jin' },
  };
  if (eraHero[era.id]) return eraHero[era.id];
  if (era.start >= 1949) return { kind: 'monument' };
  if (era.start >= 1368) return { kind: 'palace', hero: 'asia/forbidden' };
  return { kind: 'palace', style: era.start < 581 ? 'han' : 'tang', year: era.start };
}

/** The 3D model shown on a place card: its period-appropriate capital or landmark, else a generic one by kind. */
export function placeModel(p: Place, year?: number): ModelRecipe {
  if (year !== undefined) {
    if (p.id === 'erlitou') return { kind: 'palace', hero: 'capitals/cap_erlitou' };
    if (p.id === 'yin') return { kind: 'palace', hero: 'capitals/cap_yinxu' };
    if (p.id === 'haojing') return { kind: 'palace', hero: 'capitals/cap_zhou' };
    if (p.id === 'xianyang') return { kind: 'palace', hero: 'capitals/cap_xianyang' };
    if (p.id === 'shangjing') return { kind: 'yurt', hero: 'sites-a/st_khitan' };
    if (p.id === 'xingqing') return { kind: 'monument', hero: 'sites-a/st_xixia' };
    if (p.id === 'huining') return { kind: 'rider', style: 'heavy' };
    if (p.id === 'xian') {
      if (year < -221) return { kind: 'palace', hero: 'capitals/cap_zhou' };
      if (year < 581) return { kind: 'palace', hero: 'capitals/cap_qinhan' };
      if (year <= 907) return { kind: 'palace', hero: 'capitals/cap_tang' };
    }
    if (p.id === 'luoyang') {
      if (year < -221) return { kind: 'palace', hero: 'capitals/cap_luoyi' };
      if (year < 220) return { kind: 'palace', hero: 'capitals/cap_luoyang' };
      if (year < 581) return { kind: 'palace', hero: 'capitals/cap_taiji' };
      if (year <= 907) return { kind: 'palace', hero: 'capitals/cap_tang' };
    }
    if (p.id === 'kaifeng' && year >= 907 && year <= 1234) return { kind: 'palace', hero: 'capitals/cap_song' };
    if (p.id === 'nanjing') {
      if (year >= 1912 && year < 1949) return { kind: 'palace', hero: 'capitals/cap_nanjing_roc' };
      if (year < 1368) return { kind: 'palace', hero: 'capitals/cap_jiankang' };
    }
    if (p.id === 'hangzhou' && year >= 1127 && year <= 1279) return { kind: 'palace', hero: 'capitals/cap_linan' };
    if (p.id === 'beijing') {
      if (year < 1260) return { kind: 'palace', year };
      if (year < 1368) return { kind: 'palace', hero: 'capitals/cap_yuan' };
    }
    if (p.name.zh === '上海' && year < 1949) return { kind: 'skyline', hero: 'china/cn_bund', style: 'roc' };
  }
  const hero = PLACE_HERO[p.name.zh];
  if (hero) return hero;
  if (p.capital?.length) return { kind: 'palace', ...(year !== undefined ? { year } : {}) };
  return { kind: p.kind === 'pass' ? 'gate' : p.kind === 'site' ? 'ding' : p.kind === 'water' ? 'boat' : p.kind === 'mountain' ? 'temple' : 'gate', ...(year !== undefined ? { year } : {}) };
}

export type PersonRole = 'ruler' | 'general' | 'monk' | 'woman' | 'scholar';

/** Explicit role, period costume year, and prop overrides for historical figures whose honorifics or life spans cross dynasty boundaries. */
const PERSON_OVERRIDE: Record<string, { role?: PersonRole; year?: number; prop?: string; female?: boolean; eth?: string }> = {
  项羽: { role: 'general' },
  陈胜: { role: 'general' },
  李斯: { role: 'scholar', year: -215 },
  张良: { role: 'scholar' },
  张骞: { role: 'scholar' },
  诸葛亮: { role: 'scholar', prop: 'fan' },
  陆逊: { role: 'general' },
  司马懿: { role: 'scholar', year: 235 },
  邓艾: { role: 'general' },
  桓温: { role: 'general' },
  武则天: { role: 'ruler', female: true },
  郭子仪: { role: 'general' },
  安禄山: { role: 'general' },
  黄巢: { role: 'general' },
  李存勖: { role: 'ruler' },
  柴荣: { role: 'ruler' },
  李煜: { role: 'ruler', year: 965 },
  李清照: { role: 'woman', female: true },
  韩世忠: { role: 'general' },
  文天祥: { role: 'scholar', year: 1270 },
  成吉思汗: { role: 'ruler', year: 1271 },
  忽必烈: { role: 'ruler', year: 1275 },
  徐达: { role: 'general' },
  王阳明: { role: 'scholar' },
  袁崇焕: { role: 'general' },
  努尔哈赤: { role: 'ruler', year: 1644 },
  皇太极: { role: 'ruler', year: 1644 },
  李自成: { role: 'general', year: 1640 },
  郑成功: { role: 'general', year: 1640 },
  洪秀全: { role: 'ruler', year: 1640 },
  左宗棠: { role: 'general' },
  孙中山: { role: 'ruler', year: 1912 },
  毛泽东: { role: 'ruler', year: 1949 },
  邓小平: { role: 'ruler', year: 1978 },
};

/** Rough role from a person's honorific line (帝/王 → ruler, 将/侯/都督 → general, 法师/僧 → monk …). */
export function personRole(title: string): PersonRole {
  if (/法师|禅师|僧|大师|和尚/.test(title)) return 'monk';
  if (/皇后|太后|公主|女皇|女|夫人|妃/.test(title)) return 'woman';
  if (/帝|皇|(?<!勤|郡|霸|闯|楚|延平|中山|蕲)王(?!右军|守仁|安石|羲之)|汗|天子|始皇|[高世圣太]祖|[太世庄]宗|后主/.test(title)) return 'ruler';
  if (/将|帅|都督|督师|军神|兵|(?<!武乡|留|博望)侯|元戎|统帅|武穆|武毅|霸王|闯王|郡王|中山王|延平王|蕲王|太尉|大司马/.test(title)) return 'general';
  return 'scholar';
}

/** The 3D figure shown on a person card. */
export function personModel(p: { name: { zh: string }; title?: { zh: string }; span?: [number, number] }): ModelRecipe {
  const hero = PERSON_HERO[p.name.zh];
  if (hero) return { kind: 'person', hero };
  const ov = PERSON_OVERRIDE[p.name.zh];
  // dressed for the prime of their life (period costume), with dynasty-boundary overrides when needed
  const year = ov?.year ?? (p.span ? Math.min(p.span[1], p.span[0] + 40) : undefined);
  const role = ov?.role ?? (/[帝汗]$/.test(p.name.zh) ? 'ruler' : personRole(p.title?.zh ?? ''));
  return {
    kind: 'person', role,
    ...(year !== undefined ? { year } : {}),
    ...(ov?.prop ? { prop: ov.prop } : {}),
    ...(ov?.female ? { female: true } : {}),
    ...(ov?.eth ? { eth: ov.eth } : {}),
  };
}
