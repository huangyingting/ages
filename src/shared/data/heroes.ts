import type { HistEvent, ModelRecipe, Place } from './types.ts';

/**
 * Detailed "hero" models (pocket-planet packs, src/client/models/heroes) for landmark events, places and people.
 * A recipe `{ kind, hero: 'pack/name' }` falls back to the generic `kind` model until its pack has loaded.
 */
const EVENT_HERO: Record<string, string> = {
  qin_wall: 'asia/greatwall', ming_wall: 'asia/greatwall', terracotta: 'asia3/terracotta', forbidden_city: 'asia/forbidden',
  confucius: 'people-a/pp_confucius', cailun: 'people-a/pp_cailun', zhangheng: 'people-a/pp_zhangheng',
  zuchongzhi: 'people-a/pp_zuchongzhi', ming_science: 'people-a/pp_lishizhen', tang_poetry: 'people-b/pp_libai',
  wangxizhi: 'people-b/pp_wangxizhi', xuanzang: 'people-c/pp_xuanzang', marco_polo: 'people-c/pp_marcopolo',
  zhenghe: 'journeys/vy_zhenghe', zhangqian: 'journeys/vy_silkroad', jianzhen: 'routes2/vy_jianzhen',
  wencheng: 'asia2/potala', zhuzang: 'asia2/potala', tibet1951: 'asia2/potala', neimenggu: 'festivals/fs_naadam',
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
  上海: { kind: 'skyline', hero: 'china/cn_bund' }, 山海关: { kind: 'gate', hero: 'asia/greatwall' },
  嘉峪关: { kind: 'gate', hero: 'asia/greatwall' }, 八达岭: { kind: 'wall', hero: 'asia/greatwall' },
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
 * The capital's model on the map, one per architectural period so each dynasty's seat looks like its own age: rammed-earth
 * halls of Erlitou, Zhou terraces, Qin–Han terrace palaces with que towers, the Tang Hanyuan Hall, the Song Xuande Gate,
 * Yuan Dadu, then the Forbidden City (Ming–Qing) and a monument for modern capitals.
 */
export function capitalModel(era: { id: string; start: number }): ModelRecipe {
  const by: Record<string, string> = {
    xia: 'cap_erlitou', shang: 'cap_erlitou', wzhou: 'cap_zhou', chunqiu: 'cap_zhou', zhanguo: 'cap_zhou',
    qin: 'cap_qinhan', whan: 'cap_qinhan', xin: 'cap_qinhan', ehan: 'cap_qinhan', sanguo: 'cap_qinhan', wjin: 'cap_qinhan', ejin: 'cap_qinhan', nanbei: 'cap_qinhan',
    sui: 'cap_tang', tang: 'cap_tang', wudai: 'cap_tang', liao: 'cap_tang', bsong: 'cap_song', nsong: 'cap_song', xixia: 'cap_song', jin: 'cap_song', yuan: 'cap_yuan',
  };
  if (era.start >= 1912) return { kind: 'monument' };
  const h = by[era.id];
  return h ? { kind: 'palace', hero: 'capitals/' + h } : { kind: 'palace' };
}

/** The 3D model shown on a place card: its landmark, else a generic one by kind. */
export function placeModel(p: Place): ModelRecipe {
  const hero = PLACE_HERO[p.name.zh];
  if (hero) return hero;
  if (p.capital?.length) return { kind: 'palace' };
  return { kind: p.kind === 'pass' ? 'gate' : p.kind === 'site' ? 'ding' : p.kind === 'water' ? 'boat' : p.kind === 'mountain' ? 'temple' : 'gate' };
}

export type PersonRole = 'ruler' | 'general' | 'monk' | 'woman' | 'scholar';

/** Rough role from a person's honorific line (帝/王 → ruler, 将/侯/都督 → general, 法师/僧 → monk …). */
export function personRole(title: string): PersonRole {
  if (/法师|禅师|僧|大师|和尚/.test(title)) return 'monk';
  if (/皇后|太后|公主|女皇|女|夫人|妃/.test(title)) return 'woman';
  if (/帝|皇|王(?!右军)|汗|天子|始皇|[高世圣太]祖|太宗/.test(title)) return 'ruler';
  if (/将|帅|都督|军神|兵|侯|元戎|统帅|武穆/.test(title)) return 'general';
  return 'scholar';
}

/** The 3D figure shown on a person card. */
export function personModel(p: { name: { zh: string }; title?: { zh: string }; span?: [number, number] }): ModelRecipe {
  const hero = PERSON_HERO[p.name.zh];
  // dressed for the prime of their life (period costume)
  const year = p.span ? Math.min(p.span[1], p.span[0] + 40) : undefined;
  return hero ? { kind: 'person', hero } : { kind: 'person', role: /[帝汗]$/.test(p.name.zh) ? 'ruler' : personRole(p.title?.zh ?? ''), ...(year !== undefined ? { year } : {}) };
}
