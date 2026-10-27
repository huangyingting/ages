import type { HistEvent, ModelRecipe, Place } from './types.ts';
import { FIGURE_LOOK } from './figures.ts';

/**
 * Detailed "hero" models (pocket-planet packs, src/client/models/heroes) for landmark events, places and people.
 * A recipe `{ kind, hero: 'pack/name' }` falls back to the generic `kind` model until its pack has loaded.
 */
const EVENT_HERO: Record<string, string> = {
  ming_wall: 'asia/greatwall', terracotta: 'asia3/terracotta', forbidden_city: 'capitals/cap_ming',
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

/** Explicit 1-to-1 landmark model per place ID (zero duplicates across all named & imported places). */
export const PLACE_ID_HERO: Record<string, ModelRecipe> = {
  // Prehistoric & Archaeological Sites
  yuanmou: { kind: 'cave', hero: 'places-sites/pl_yuanmou' },
  zhoukoudian: { kind: 'cave', hero: 'places-sites/pl_zhoukoudian' },
  hemudu: { kind: 'hut', hero: 'places-sites/pl_hemudu' },
  banpo: { kind: 'hut', hero: 'places-sites/pl_banpo' },
  liangzhu: { kind: 'ding', hero: 'places-sites/pl_liangzhu' },
  dawenkou: { kind: 'ding', hero: 'places-sites/pl_dawenkou' },
  erlitou: { kind: 'palace', hero: 'places-sites/pl_erlitou' },
  anyang: { kind: 'ding', hero: 'places-sites/pl_anyang' },
  sanxingdui: { kind: 'ding', hero: 'places-sites/pl_sanxingdui' },
  xianyang: { kind: 'palace', hero: 'places-cities/pl_xianyang' },
  dujiangyan: { kind: 'bridge', hero: 'places-sites/pl_dujiangyan' },
  lingqu: { kind: 'bridge', hero: 'places-sites/pl_lingqu' },
  zhaozhou: { kind: 'bridge', hero: 'places-sites/pl_zhaozhou' },
  yungang: { kind: 'statue', hero: 'places-sites/pl_yungang' },
  longmen: { kind: 'statue', hero: 'places-sites/pl_longmen' },
  dunhuang: { kind: 'gate', hero: 'places-sites/pl_dunhuang' },
  mogao: { kind: 'temple', hero: 'places-sites/pl_mogao' },
  // Ancient & Modern Capitals / Major Cities
  xian: { kind: 'pagoda', hero: 'places-cities/pl_xian' },
  luoyang: { kind: 'palace', hero: 'places-cities/pl_luoyang' },
  kaifeng: { kind: 'palace', hero: 'places-cities/pl_kaifeng' },
  nanjing: { kind: 'palace', hero: 'places-cities/pl_nanjing' },
  hangzhou: { kind: 'pagoda', hero: 'places-cities/pl_hangzhou' },
  beijing: { kind: 'palace', hero: 'places-cities/pl_beijing' },
  shangjing: { kind: 'yurt', hero: 'places-sites/pl_shangjing' },
  xingqing: { kind: 'monument', hero: 'places-cities/pl_xingqing' },
  huining: { kind: 'palace', hero: 'places-sites/pl_huining' },
  // Curated Chinese Cities
  zhengzhou: { kind: 'pagoda', hero: 'places-cities/pl_zhengzhou' },
  shenyang: { kind: 'palace', hero: 'places-cities/pl_shenyang' },
  dali: { kind: 'pagoda', hero: 'places-cities/pl_dali' },
  lhasa: { kind: 'temple', hero: 'places-cities/pl_lhasa' },
  chengdu: { kind: 'temple', hero: 'places-cities/pl_chengdu' },
  chongqing: { kind: 'palace', hero: 'places-cities/pl_chongqing' },
  wuhan: { kind: 'pagoda', hero: 'places-cities/pl_wuhan' },
  changsha: { kind: 'ding', hero: 'places-cities/pl_changsha' },
  nanchang: { kind: 'palace', hero: 'places-cities/pl_nanchang' },
  guangzhou: { kind: 'palace', hero: 'places-cities/pl_guangzhou' },
  quanzhou: { kind: 'pagoda', hero: 'places-cities/pl_quanzhou' },
  suzhou: { kind: 'pagoda', hero: 'places-cities/pl_suzhou' },
  yangzhou: { kind: 'bridge', hero: 'places-cities/pl_yangzhou' },
  shanghai: { kind: 'skyline', hero: 'places-cities/pl_shanghai' },
  tianjin: { kind: 'bridge', hero: 'places-cities/pl_tianjin' },
  jinan: { kind: 'temple', hero: 'places-cities/pl_jinan' },
  qufu: { kind: 'temple', hero: 'places-cities/pl_qufu' },
  linzi: { kind: 'palace', hero: 'places-cities/pl_linzi' },
  handan: { kind: 'palace', hero: 'places-cities/pl_handan' },
  ying: { kind: 'palace', hero: 'places-cities/pl_ying' },
  fuzhou: { kind: 'pagoda', hero: 'places-cities/pl_fuzhou' },
  kunming: { kind: 'gate', hero: 'places-cities/pl_kunming' },
  datong: { kind: 'temple', hero: 'places-cities/pl_datong' },
  lanzhou: { kind: 'bridge', hero: 'places-cities/pl_lanzhou' },
  xining: { kind: 'temple', hero: 'places-cities/pl_xining' },
  urumqi: { kind: 'pagoda', hero: 'places-cities/pl_urumqi' },
  kashgar: { kind: 'temple', hero: 'places-cities/pl_kashgar' },
  luntai: { kind: 'gate', hero: 'places-cities/pl_luntai' },
  turpan: { kind: 'pagoda', hero: 'places-cities/pl_turpan' },
  jiuquan: { kind: 'gate', hero: 'places-cities/pl_jiuquan' },
  hohhot: { kind: 'temple', hero: 'places-cities/pl_hohhot' },
  harbin: { kind: 'temple', hero: 'places-cities/pl_harbin' },
  changchun: { kind: 'palace', hero: 'places-cities/pl_changchun' },
  dalian: { kind: 'monument', hero: 'places-cities/pl_dalian' },
  taipei: { kind: 'skyline', hero: 'places-cities/pl_taipei' },
  tainan: { kind: 'gate', hero: 'places-cities/pl_tainan' },
  hongkong: { kind: 'skyline', hero: 'places-cities/pl_hongkong' },
  macao: { kind: 'gate', hero: 'places-cities/pl_macao' },
  haikou: { kind: 'gate', hero: 'places-cities/pl_haikou' },
  shenzhen: { kind: 'skyline', hero: 'places-cities/pl_shenzhen' },
  // Passes & Great Wall
  yumenguan: { kind: 'gate', hero: 'places-sites/pl_yumenguan' },
  jiayuguan: { kind: 'gate', hero: 'places-sites/pl_jiayuguan' },
  hanguguan: { kind: 'gate', hero: 'places-sites/pl_hanguguan' },
  tongguan: { kind: 'gate', hero: 'places-sites/pl_tongguan' },
  shanhaiguan: { kind: 'gate', hero: 'places-sites/pl_shanhaiguan' },
  jianmenguan: { kind: 'gate', hero: 'places-sites/pl_jianmenguan' },
  pingxingguan: { kind: 'gate', hero: 'places-sites/pl_pingxingguan' },
  'pass-wuguan': { kind: 'gate', hero: 'places-sites/pl_pass_wuguan' },
  'pass-dasanguan': { kind: 'gate', hero: 'places-sites/pl_pass_dasanguan' },
  'pass-xiaoguan': { kind: 'gate', hero: 'places-sites/pl_pass_xiaoguan' },
  'pass-hulaoguan': { kind: 'gate', hero: 'places-sites/pl_pass_hulao' },
  'pass-yangpingguan': { kind: 'gate', hero: 'places-sites/pl_pass_yangping' },
  'pass-yanmenguan': { kind: 'gate', hero: 'places-sites/pl_pass_yanmen' },
  'pass-juyongguan': { kind: 'wall', hero: 'places-sites/pl_pass_juyong' },
  'pass-zijingguan': { kind: 'gate', hero: 'places-sites/pl_pass_zijing' },
  'pass-niangziguan': { kind: 'gate', hero: 'places-sites/pl_pass_niangzi' },
  'pass-gubeikou': { kind: 'gate', hero: 'places-sites/pl_pass_gubeikou' },
  'pass-yangguan': { kind: 'gate', hero: 'places-sites/pl_pass_yangguan' },
  'pass-wushengguan': { kind: 'gate', hero: 'places-sites/pl_pass_wusheng' },
  'pass-xianxiaguan': { kind: 'gate', hero: 'places-sites/pl_pass_xianxia' },
  'pass-meiguan': { kind: 'gate', hero: 'places-sites/pl_pass_meiguan' },
  // Famous Battlefields
  muye: { kind: 'chariot', hero: 'places-sites/pl_muye' },
  changping: { kind: 'battle', hero: 'places-sites/pl_changping' },
  julu: { kind: 'battle', hero: 'places-sites/pl_julu' },
  gaixia: { kind: 'battle', hero: 'places-sites/pl_gaixia' },
  dazexiang: { kind: 'battle', hero: 'places-sites/pl_dazexiang' },
  guandu: { kind: 'battle', hero: 'places-sites/pl_guandu' },
  chibi: { kind: 'ship', hero: 'places-sites/pl_chibi' },
  feishui: { kind: 'battle', hero: 'places-sites/pl_feishui' },
  yashan: { kind: 'ship', hero: 'places-sites/pl_yashan' },
  // Revolutionary & Modern Sites
  jiaxing: { kind: 'boat', hero: 'places-sites/pl_jiaxing' },
  jinggangshan: { kind: 'monument', hero: 'places-sites/pl_jinggangshan' },
  ruijin: { kind: 'temple', hero: 'places-sites/pl_ruijin' },
  zunyi: { kind: 'palace', hero: 'places-sites/pl_zunyi' },
  yanan: { kind: 'pagoda', hero: 'places-sites/pl_yanan' },
  xibaipo: { kind: 'hut', hero: 'places-sites/pl_xibaipo' },
  lugouqiao: { kind: 'bridge', hero: 'places-sites/pl_lugouqiao' },
  taierzhuang: { kind: 'gate', hero: 'places-sites/pl_taierzhuang' },
  humen: { kind: 'cannon', hero: 'places-sites/pl_humen' },
  weihai: { kind: 'ship', hero: 'places-sites/pl_weihai' },
  xiaogang: { kind: 'hut', hero: 'places-sites/pl_xiaogang' },
  lop_nur: { kind: 'monument', hero: 'places-sites/pl_lop_nur' },
  jiuquan_lc: { kind: 'rocket', hero: 'places-sites/pl_jiuquan_lc' },
  dandong: { kind: 'bridge', hero: 'places-sites/pl_dandong' },
  // Mountains & Maritime Islands
  taishan: { kind: 'temple', hero: 'places-sites/pl_taishan' },
  everest: { kind: 'mountain', hero: 'places-sites/pl_everest' },
  diaoyu: { kind: 'boat', hero: 'places-sites/pl_diaoyu' },
  nanhai: { kind: 'boat', hero: 'places-sites/pl_nanhai' },
  xisha: { kind: 'boat', hero: 'places-sites/pl_xisha' },
  nansha: { kind: 'boat', hero: 'places-sites/pl_nansha' },
  // Foreign Cities
  nara: { kind: 'temple', hero: 'places-cities/pl_nara' },
  kyoto: { kind: 'temple', hero: 'places-cities/pl_kyoto' },
  tokyo: { kind: 'skyline', hero: 'places-cities/pl_tokyo' },
  seoul: { kind: 'palace', hero: 'places-cities/pl_seoul' },
  pyongyang: { kind: 'gate', hero: 'places-cities/pl_pyongyang' },
  albazin: { kind: 'wall', hero: 'places-cities/pl_albazin' },
  nerchinsk: { kind: 'hut', hero: 'places-cities/pl_nerchinsk' },
  vladivostok: { kind: 'ship', hero: 'places-cities/pl_vladivostok' },
  talas: { kind: 'wall', hero: 'places-cities/pl_talas' },
  samarkand: { kind: 'temple', hero: 'places-cities/pl_samarkand' },
  nalanda: { kind: 'temple', hero: 'places-cities/pl_nalanda' },
  calicut: { kind: 'ship', hero: 'places-cities/pl_calicut' },
  malacca: { kind: 'gate', hero: 'places-cities/pl_malacca' },
  hanoi: { kind: 'pagoda', hero: 'places-cities/pl_hanoi' },
  // Famous Imported Cities (exact j* and settlement-* IDs)
  j0: { kind: 'ding', hero: 'places-atlas/pl_xinzheng' },
  j1: { kind: 'ding', hero: 'places-atlas/pl_baoji' },
  j3: { kind: 'temple', hero: 'places-atlas/pl_taiyuan' },
  j23: { kind: 'bridge', hero: 'places-atlas/pl_shaoxing' },
  j28: { kind: 'mountain', hero: 'places-atlas/pl_guilin' },
  j33: { kind: 'statue', hero: 'places-atlas/pl_wuwei' },
  j34: { kind: 'wall', hero: 'places-atlas/pl_shuofang' },
  j35: { kind: 'palace', hero: 'places-atlas/pl_xuzhou' },
  j36: { kind: 'temple', hero: 'places-atlas/pl_zhangye' },
  j54: { kind: 'temple', hero: 'places-atlas/pl_kuqa' },
  j55: { kind: 'temple', hero: 'places-atlas/pl_hotan' },
  j57: { kind: 'gate', hero: 'places-atlas/pl_xiangyang' },
  j63: { kind: 'monument', hero: 'places-atlas/pl_jian' },
  j64: { kind: 'temple', hero: 'places-atlas/pl_hefei' },
  j65: { kind: 'temple', hero: 'places-atlas/pl_ezhou' },
  j68: { kind: 'temple', hero: 'places-atlas/pl_fengjie' },
  j72: { kind: 'palace', hero: 'places-atlas/pl_linfen' },
  j73: { kind: 'statue', hero: 'places-atlas/pl_tianshui' },
  j74: { kind: 'pagoda', hero: 'places-atlas/pl_yueyang' },
  j79: { kind: 'wall', hero: 'places-atlas/pl_tongwan' },
  j97: { kind: 'temple', hero: 'places-atlas/pl_beiting' },
  j106: { kind: 'gate', hero: 'places-atlas/pl_huizhou' },
  j108: { kind: 'statue', hero: 'places-atlas/pl_leshan' },
  j114: { kind: 'temple', hero: 'places-atlas/pl_wudang' },
  j118: { kind: 'mountain', hero: 'places-atlas/pl_sanya' },
  j119: { kind: 'pagoda', hero: 'places-atlas/pl_daixian' },
  j120: { kind: 'palace', hero: 'places-atlas/pl_ningan' },
  j121: { kind: 'palace', hero: 'places-atlas/pl_shannan' },
  j127: { kind: 'temple', hero: 'places-atlas/pl_zhengding' },
  j130: { kind: 'hut', hero: 'places-atlas/pl_jingdezhen' },
  j135: { kind: 'gate', hero: 'places-atlas/pl_hechuan' },
  j137: { kind: 'yurt', hero: 'places-atlas/pl_karakorum' },
  j142: { kind: 'temple', hero: 'places-atlas/pl_sakya' },
  j148: { kind: 'pagoda', hero: 'places-atlas/pl_xuanhua' },
  j149: { kind: 'wall', hero: 'places-atlas/pl_yulin' },
  j152: { kind: 'palace', hero: 'places-atlas/pl_hetuala' },
  j154: { kind: 'mountain', hero: 'places-atlas/pl_chongzuo' },
  j155: { kind: 'monument', hero: 'places-atlas/pl_khorgos' },
  j156: { kind: 'pagoda', hero: 'places-atlas/pl_qingdao' },
  j157: { kind: 'temple', hero: 'places-atlas/pl_chengde' },
  j160: { kind: 'pagoda', hero: 'places-atlas/pl_heihe' },
  j172: { kind: 'palace', hero: 'places-atlas/pl_xiamen' },
  'settlement-117.12-36.19': { kind: 'temple', hero: 'places-cities/pl_taian' },
  'settlement-112.2-30.35': { kind: 'gate', hero: 'places-atlas/pl_jingzhou' },
  'settlement-116.78-32.58': { kind: 'gate', hero: 'places-atlas/pl_shouxian' },
  'settlement-121.55-29.87': { kind: 'palace', hero: 'places-atlas/pl_ningbo' },
};

/** People with their own detailed figure. */
const PERSON_HERO: Record<string, string> = {
  孔子: 'people-a/pp_confucius', 张衡: 'people-a/pp_zhangheng', 蔡伦: 'people-a/pp_cailun', 祖冲之: 'people-a/pp_zuchongzhi',
  李时珍: 'people-a/pp_lishizhen', 李白: 'people-b/pp_libai', 屈原: 'people-b/pp_quyuan', 王羲之: 'people-b/pp_wangxizhi',
  郑和: 'people-c/pp_zhenghe', 玄奘: 'people-c/pp_xuanzang', 华佗: 'people-c/pp_huatuo', 马可·波罗: 'people-c/pp_marcopolo',
};

const SPECIAL_CURATED_EVENT_STYLES = new Set(['tibet1951', 'nanxun', 'muye', 'dujiang', 'wto']);
const SHARED_CURATED_EVENT_KINDS = new Set(['flag', 'palace', 'army', 'scroll', 'warship', 'rider']);

/** Adds the hero landmark and a unique event style to an event's model recipe. */
export function withHero(e: HistEvent): HistEvent {
  const hero = EVENT_HERO[e.id] ?? TITLE_HERO.find(([re]) => re.test(e.title.zh))?.[1];
  const base: ModelRecipe = e.model
    ? (hero && typeof e.model.hero !== 'string' ? { ...e.model, hero } : { ...e.model })
    : { kind: hero ? 'monument' : 'flag', year: e.year, ...(hero ? { hero } : {}) };
  let style = base.style;
  if (base.hero === 'china/cn_taishan' && !style) {
    style = e.year < -200 ? 'qin' : e.year < 200 ? 'whan' : e.year < 900 ? 'tang' : 'bsong';
  } else if (base.hero === 'china/cn_mogao' && !style) {
    style = e.year >= 1800 ? 'cangjingdong' : 'early';
  } else if (SPECIAL_CURATED_EVENT_STYLES.has(e.id)) {
    style = e.id;
  } else if (e.source || (!base.hero && !style && SHARED_CURATED_EVENT_KINDS.has(base.kind))) {
    style = style ? `${style}__${e.id}` : e.id;
  }
  if (style === base.style && base === e.model) return e;
  return { ...e, model: { ...base, ...(style !== undefined ? { style } : {}) } };
}

/**
 * The capital's model: the seat's own palace, so every city stands as itself (one model, one subject) — Erlitou, Yinxu,
 * Zhou terraces, Eastern Zhou Luoyi, Qin Xianyang, Han Weiyang, Eastern Han and Wei–Jin Luoyang, Jiankang, the Tang
 * Hanyuan Hall, the Song Xuande Gate, Lin'an, Yuan Dadu, the Forbidden City (Ming–Qing, the same model as its landmark), Nanjing's Presidential
 * Palace and Beijing's monument. Periods without one capital show a generic hall of their age on the era card.
 */
export function capitalModel(era: { id: string; start: number }): ModelRecipe {
  const by: Record<string, string> = {
    paleo: 'cap_paleo', neo: 'cap_neo', xia: 'cap_erlitou', shang: 'cap_yinxu', wzhou: 'cap_zhou',
    chunqiu: 'cap_luoyi', zhanguo: 'cap_zhanguo', qin: 'cap_xianyang', whan: 'cap_qinhan', xin: 'cap_xin',
    ehan: 'cap_luoyang', sanguo: 'cap_sanguo', wjin: 'cap_taiji', ejin: 'cap_jiankang', nanbei: 'cap_nanbei',
    sui: 'cap_sui', tang: 'cap_tang', wudai: 'cap_wudai', bsong: 'cap_song', nsong: 'cap_linan',
    liao: 'cap_liao', xixia: 'cap_xixia', jin: 'cap_jin', yuan: 'cap_yuan', ming: 'cap_ming',
    qing: 'cap_qing', roc: 'cap_nanjing_roc', prc: 'cap_prc',
  };
  const h = by[era.id];
  if (h) return { kind: 'palace', hero: 'capitals/' + h };
  if (era.start >= 1949) return { kind: 'monument', hero: 'capitals/cap_prc' };
  if (era.start >= 1644) return { kind: 'palace', hero: 'capitals/cap_qing' };
  if (era.start >= 1368) return { kind: 'palace', hero: 'capitals/cap_ming' };
  return { kind: 'palace', style: era.start < 581 ? 'han' : 'tang', year: era.start };
}

/** Period-specific capital palace & landmark overrides for multi-era seats (each cap_* is unique to one city in that era). */
const PLACE_ERA_HERO: Record<string, Partial<Record<string, ModelRecipe>>> = {
  erlitou: { xia: { kind: 'palace', hero: 'capitals/cap_erlitou' } },
  anyang: { shang: { kind: 'palace', hero: 'capitals/cap_yinxu' } },
  xianyang: { qin: { kind: 'palace', hero: 'capitals/cap_xianyang' } },
  xian: {
    wzhou: { kind: 'palace', hero: 'capitals/cap_zhou' },
    whan: { kind: 'palace', hero: 'capitals/cap_qinhan' },
    xin: { kind: 'palace', hero: 'capitals/cap_xin' },
    sui: { kind: 'palace', hero: 'capitals/cap_sui' },
    tang: { kind: 'palace', hero: 'capitals/cap_tang' },
  },
  luoyang: {
    chunqiu: { kind: 'palace', hero: 'capitals/cap_luoyi' },
    ehan: { kind: 'palace', hero: 'capitals/cap_luoyang' },
    sanguo: { kind: 'palace', hero: 'capitals/cap_sanguo' },
    wjin: { kind: 'palace', hero: 'capitals/cap_taiji' },
    nanbei: { kind: 'palace', hero: 'capitals/cap_nanbei' },
  },
  nanjing: {
    ejin: { kind: 'palace', hero: 'capitals/cap_jiankang' },
    roc: { kind: 'palace', hero: 'capitals/cap_nanjing_roc' },
  },
  kaifeng: {
    wudai: { kind: 'palace', hero: 'capitals/cap_wudai' },
    bsong: { kind: 'palace', hero: 'capitals/cap_song' },
  },
  hangzhou: {
    nsong: { kind: 'palace', hero: 'capitals/cap_linan' },
  },
  xingqing: {
    xixia: { kind: 'palace', hero: 'capitals/cap_xixia' },
  },
  'settlement-119.38-43.97': {
    liao: { kind: 'palace', hero: 'capitals/cap_liao' },
  },
  'settlement-126.97-45.54': {
    jin: { kind: 'palace', hero: 'capitals/cap_jin' },
  },
  beijing: {
    zhanguo: { kind: 'palace', hero: 'capitals/cap_zhanguo' },
    yuan: { kind: 'palace', hero: 'capitals/cap_yuan' },
    ming: { kind: 'palace', hero: 'capitals/cap_ming' },
    qing: { kind: 'palace', hero: 'capitals/cap_qing' },
    prc: { kind: 'monument', hero: 'capitals/cap_prc' },
  },
};

/** Resolves the dynasty/era ID for a place at a given year, respecting simultaneous regimes (Liao/Xixia/Jin vs Song). */
export function placeEraId(p: Place, year: number): string {
  if (year >= 907 && year <= 1270) {
    const activeText = [
      p.id,
      ...(p.names ?? []).filter(n => year >= n.from && year <= n.to).map(n => n.name.zh),
      ...(p.periods ?? []).filter(n => year >= n.from && year <= n.to).map(n => n.name.zh),
      ...(p.notes ?? []).filter(n => year >= n.from && year <= n.to).map(n => n.text.zh),
    ].join(' ');
    if (year >= 1038 && year <= 1227 && (p.id === 'xingqing' || /西夏|兴庆府|党项/.test(activeText))) return 'xixia';
    if (year >= 916 && year <= 1125 && (/辽|契丹|临潢|析津/.test(activeText) || p.lat > 39.5)) return 'liao';
    if (year >= 1115 && year <= 1234 && (/金|女真|会宁|中都/.test(activeText) || p.lat > 34.5)) return 'jin';
  }
  if (year < -10_000) return 'paleo';
  if (year < -2070) return 'neo';
  if (year < -1600) return 'xia';
  if (year < -1046) return 'shang';
  if (year < -770) return 'wzhou';
  if (year < -475) return 'chunqiu';
  if (year < -221) return 'zhanguo';
  if (year < -202) return 'qin';
  if (year <= 8) return 'whan';
  if (year <= 24) return 'xin';
  if (year < 220) return 'ehan';
  if (year < 266) return 'sanguo';
  if (year <= 316) return 'wjin';
  if (year < 420) return 'ejin';
  if (year < 581) return 'nanbei';
  if (year < 618) return 'sui';
  if (year < 907) return 'tang';
  if (year < 960) return 'wudai';
  if (year < 1127) return 'bsong';
  if (year < 1271) return 'nsong';
  if (year < 1368) return 'yuan';
  if (year < 1644) return 'ming';
  if (year < 1912) return 'qing';
  if (year < 1949) return 'roc';
  return 'prc';
}

function basePlaceModel(p: Place): ModelRecipe {
  const byId = PLACE_ID_HERO[p.id];
  if (byId) return byId;
  if (p.id) {
    const text = [p.name.zh, p.modern?.zh ?? '', ...(p.names?.map(n => n.name.zh) ?? []), ...(p.notes?.map(n => n.text.zh) ?? []), p.lore?.tag.zh ?? '', p.lore?.desc.zh ?? ''].join(' ');
    const arch = /关|隘|塞|堡|卫|镇|戍|长城/.test(text) ? 0
      : /塔|寺|刹|禅|佛|藏/.test(text) ? 1
      : /港|津|渡|江|河|湖|海|渠|水|洲|浦|湾/.test(text) ? 2
      : /山|峰|岭|崖|洞|窟|峡|谷/.test(text) ? 3
      : /书院|文庙|学|儒|祠|阁|楼|亭/.test(text) ? 4
      : p.capital?.length ? 5
      : /陵|墓|冢|遗址|故城/.test(text) ? 6 : 7;
    const key = 'pl_' + p.id.replace(/[^a-z0-9]/gi, '_');
    const anc = (p.names?.map(n => n.name.zh) ?? []).join(',');
    const lore = (p.lore?.tag.zh ?? '') + ' ' + (p.notes?.[0]?.text.zh ?? '');
    return {
      kind: p.capital?.length ? 'palace' : p.kind === 'pass' ? 'gate' : p.kind === 'site' ? 'ding' : p.kind === 'water' ? 'boat' : p.kind === 'mountain' ? 'temple' : 'gate',
      hero: 'places-atlas/' + key,
      style: `${p.id}|${p.lon.toFixed(1)}|${p.lat.toFixed(1)}|${p.capital?.length ? 1 : 0}|${arch}|${p.name.zh}|${anc}|${lore}`,
    };
  }
  if (p.capital?.length) return { kind: 'palace' };
  return { kind: p.kind === 'pass' ? 'gate' : p.kind === 'site' ? 'ding' : p.kind === 'water' ? 'boat' : p.kind === 'mountain' ? 'temple' : 'gate' };
}

/** The 3D model shown on a place card: its unique 1-to-1 landmark model, differentiated by dynasty/era when `year` is supplied. */
export function placeModel(p: Place, year?: number): ModelRecipe {
  const base = basePlaceModel(p);
  if (year === undefined) return base;
  const eraId = placeEraId(p, year);
  const eraCap = PLACE_ERA_HERO[p.id]?.[eraId];
  const chosen = eraCap ?? base;
  const prefix = chosen.style ? `${chosen.style}|` : '';
  return {
    ...chosen,
    year,
    style: `${prefix}place:${p.id}|era:${eraId}`,
  };
}

export type PersonRole = 'ruler' | 'general' | 'monk' | 'woman' | 'scholar';

/** Explicit role, period costume year, and prop overrides for historical figures whose honorifics or life spans cross dynasty boundaries. */
const PERSON_OVERRIDE: Record<string, { role?: PersonRole; year?: number; prop?: string; female?: boolean; eth?: string }> = {
  // Prehistory & Pre-Qin
  北京人: { role: 'scholar', year: -500_000, prop: 'torch' },
  黄帝: { role: 'ruler', year: -2600 },
  晋文公: { role: 'ruler', year: -636, prop: 'sword' },
  大禹: { role: 'ruler', year: -2100, prop: 'spade' },
  妇好: { role: 'general', year: -1200, prop: 'axe', female: true },
  周公: { role: 'scholar', year: -1040, prop: 'bamboo_scroll' },
  孙武: { role: 'general', year: -510, prop: 'bamboo_scroll' },
  孟子: { role: 'scholar', prop: 'scroll' },
  商鞅: { role: 'scholar', prop: 'bamboo_scroll' },
  孙膑: { role: 'scholar', prop: 'bamboo_scroll' },
  白起: { role: 'general', prop: 'sword' },
  李牧: { role: 'general', prop: 'bow' },
  王翦: { role: 'general', prop: 'sword' },
  // Qin & Han
  李斯: { role: 'scholar', year: -215, prop: 'bamboo_scroll' },
  蒙恬: { role: 'general' },
  陈胜: { role: 'general' },
  项羽: { role: 'general', prop: 'halberd' },
  刘邦: { role: 'ruler' },
  萧何: { role: 'scholar', prop: 'bamboo_scroll' },
  韩信: { role: 'general', prop: 'sword' },
  张良: { role: 'scholar', prop: 'book' },
  汉文帝: { role: 'ruler' },
  汉武帝: { role: 'ruler' },
  张骞: { role: 'scholar', prop: 'staff' },
  苏武: { role: 'scholar', prop: 'staff' },
  卫青: { role: 'general', prop: 'sword' },
  霍去病: { role: 'general', prop: 'bow' },
  司马迁: { role: 'scholar', prop: 'brush' },
  王莽: { role: 'ruler' },
  刘秀: { role: 'ruler' },
  班超: { role: 'general', prop: 'sword' },
  张仲景: { role: 'scholar', year: 180, prop: 'herbs' },
  // Three Kingdoms, Jin & Northern and Southern Dynasties
  曹操: { role: 'ruler', prop: 'sword' },
  刘备: { role: 'ruler', prop: 'twin_swords' },
  孙权: { role: 'ruler', prop: 'sword' },
  诸葛亮: { role: 'scholar', prop: 'fan' },
  关羽: { role: 'general', prop: 'guandao' },
  张飞: { role: 'general', prop: 'serpent_spear' },
  赵云: { role: 'general' },
  吕布: { role: 'general', prop: 'halberd' },
  袁绍: { role: 'general', prop: 'sword' },
  周瑜: { role: 'general', prop: 'sword' },
  陆逊: { role: 'general', prop: 'sword' },
  姜维: { role: 'general' },
  邓艾: { role: 'general' },
  司马懿: { role: 'scholar', year: 235 },
  陈寿: { role: 'scholar', year: 280, prop: 'brush' },
  左思: { role: 'scholar', year: 290, prop: 'scroll' },
  裴秀: { role: 'scholar', year: 268, prop: 'map' },
  谢安: { role: 'scholar', prop: 'fan' },
  陶渊明: { role: 'scholar', prop: 'chrysanthemum' },
  顾恺之: { role: 'scholar', year: 380, prop: 'brush' },
  法显: { role: 'monk', year: 410, prop: 'staff' },
  王濬: { role: 'general', year: 280, prop: 'sword' },
  桓温: { role: 'general' },
  苻坚: { role: 'ruler' },
  谢玄: { role: 'general', prop: 'sword' },
  刘裕: { role: 'ruler', prop: 'sword' },
  花木兰: { role: 'general', year: 450, prop: 'sword', female: true },
  北魏孝文帝: { role: 'ruler' },
  贾思勰: { role: 'scholar', year: 540, prop: 'rice' },
  郦道元: { role: 'scholar', year: 515, prop: 'map' },
  // Sui, Tang & Five Dynasties
  杨坚: { role: 'ruler' },
  隋炀帝: { role: 'ruler' },
  李春: { role: 'scholar', year: 600, prop: 'map' },
  唐太宗: { role: 'ruler' },
  魏征: { role: 'scholar', prop: 'hu' },
  李靖: { role: 'general' },
  武则天: { role: 'ruler', female: true },
  狄仁杰: { role: 'scholar', prop: 'hu' },
  唐玄宗: { role: 'ruler' },
  鉴真: { role: 'monk', year: 740, prop: 'mala' },
  王维: { role: 'scholar', prop: 'pipa' },
  杜甫: { role: 'scholar', prop: 'brush' },
  郭子仪: { role: 'general' },
  安禄山: { role: 'general' },
  颜真卿: { role: 'scholar', prop: 'brush' },
  韩愈: { role: 'scholar', prop: 'scroll' },
  白居易: { role: 'scholar', prop: 'pipa' },
  柳宗元: { role: 'scholar', prop: 'brush' },
  刘禹锡: { role: 'scholar', prop: 'cup' },
  黄巢: { role: 'general', prop: 'sword' },
  李存勖: { role: 'ruler' },
  柴荣: { role: 'ruler' },
  李煜: { role: 'ruler', year: 965, prop: 'scroll' },
  // Song, Liao, Western Xia & Jin
  赵匡胤: { role: 'ruler' },
  寇准: { role: 'scholar', prop: 'hu' },
  包拯: { role: 'scholar', prop: 'hu' },
  范仲淹: { role: 'scholar', prop: 'scroll' },
  欧阳修: { role: 'scholar', prop: 'cup' },
  王安石: { role: 'scholar', prop: 'book' },
  司马光: { role: 'scholar', prop: 'book' },
  苏轼: { role: 'scholar', prop: 'cup' },
  李清照: { role: 'woman', female: true, prop: 'scroll' },
  岳飞: { role: 'general' },
  韩世忠: { role: 'general', prop: 'sword' },
  陆游: { role: 'scholar', prop: 'sword' },
  辛弃疾: { role: 'scholar', prop: 'sword' },
  朱熹: { role: 'scholar', year: 1170, prop: 'book' },
  文天祥: { role: 'scholar', year: 1270, prop: 'scroll' },
  耶律阿保机: { role: 'ruler', year: 916, eth: 'steppe' },
  萧绰: { role: 'general', year: 1004, prop: 'bow', female: true, eth: 'steppe' },
  李元昊: { role: 'ruler', year: 1038, eth: 'steppe' },
  野利仁荣: { role: 'scholar', year: 1038, prop: 'scroll', eth: 'steppe' },
  完颜阿骨打: { role: 'ruler', year: 1115, eth: 'steppe' },
  丘处机: { role: 'scholar', year: 1222, prop: 'staff' },
  元好问: { role: 'scholar', year: 1230, prop: 'brush' },
  // Yuan
  成吉思汗: { role: 'ruler', year: 1271, prop: 'bow' },
  忽必烈: { role: 'ruler', year: 1275 },
  关汉卿: { role: 'scholar', year: 1280, prop: 'scroll' },
  郭守敬: { role: 'scholar', year: 1280, prop: 'armillary' },
  脱脱: { role: 'scholar', year: 1344, prop: 'book' },
  // Ming
  朱元璋: { role: 'ruler' },
  徐达: { role: 'general' },
  朱棣: { role: 'ruler', prop: 'sword' },
  于谦: { role: 'scholar', prop: 'hu' },
  王阳明: { role: 'scholar', prop: 'book' },
  戚继光: { role: 'general', prop: 'sword' },
  张居正: { role: 'scholar', prop: 'hu' },
  徐霞客: { role: 'scholar', prop: 'staff' },
  袁崇焕: { role: 'general' },
  李自成: { role: 'general', year: 1640, prop: 'sword' },
  郑成功: { role: 'general', year: 1640, prop: 'sword' },
  // Qing
  努尔哈赤: { role: 'ruler', year: 1644 },
  皇太极: { role: 'ruler', year: 1644 },
  康熙帝: { role: 'ruler' },
  雍正帝: { role: 'ruler' },
  乾隆帝: { role: 'ruler' },
  曹雪芹: { role: 'scholar', year: 1750, prop: 'brush' },
  林则徐: { role: 'scholar', prop: 'scroll' },
  洪秀全: { role: 'ruler', year: 1640, prop: 'sword' },
  曾国藩: { role: 'scholar', prop: 'book' },
  左宗棠: { role: 'general', prop: 'sword' },
  李鸿章: { role: 'scholar', prop: 'staff' },
  // Republic & PRC
  孙中山: { role: 'ruler', year: 1912 },
  鲁迅: { role: 'scholar', year: 1925, prop: 'book' },
  蒋介石: { role: 'general' },
  毛泽东: { role: 'ruler', year: 1949 },
  邓小平: { role: 'ruler', year: 1978 },
  袁隆平: { role: 'scholar', year: 1975, prop: 'rice' },
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
  const ov = PERSON_OVERRIDE[p.name.zh] ?? FIGURE_LOOK[p.name.zh];
  // dressed for the prime of their life (period costume), with dynasty-boundary overrides when needed
  const year = ov?.year ?? (p.span ? Math.min(p.span[1], p.span[0] + 40) : undefined);
  const role = ov?.role ?? (/[帝汗]$/.test(p.name.zh) ? 'ruler' : personRole(p.title?.zh ?? ''));
  return {
    kind: 'person', role, person: p.name.zh,
    ...(year !== undefined ? { year } : {}),
    ...(ov?.prop ? { prop: ov.prop } : {}),
    ...(ov?.female ? { female: true } : {}),
    ...(ov?.eth ? { eth: ov.eth } : {}),
  };
}
