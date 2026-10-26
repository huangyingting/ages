import type { HistEvent, ModelRecipe, Place } from './types.ts';

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

/** Explicit 1-to-1 landmark model per place ID (zero duplicates across all 180 named places). */
export const PLACE_ID_HERO: Record<string, ModelRecipe> = {
  // Prehistoric & Archaeological Sites
  yuanmou: { kind: 'cave', hero: 'places-sites/pl_yuanmou' },
  zhoukoudian: { kind: 'cave', hero: 'life-custom1/lf_pekingman' },
  hemudu: { kind: 'hut', hero: 'places-sites/pl_hemudu' },
  banpo: { kind: 'hut', hero: 'life-arch1/lf_banpo' },
  liangzhu: { kind: 'ding', hero: 'places-sites/pl_liangzhu' },
  dawenkou: { kind: 'ding', hero: 'places-sites/pl_dawenkou' },
  taosi: { kind: 'monument', hero: 'places-sites/pl_taosi' },
  shimao: { kind: 'wall', hero: 'places-sites/pl_shimao' },
  erlitou: { kind: 'palace', hero: 'capitals/cap_erlitou' },
  yin: { kind: 'palace', hero: 'capitals/cap_yinxu' },
  anyang: { kind: 'ding', hero: 'places-sites/pl_anyang' },
  sanxingdui: { kind: 'ding', hero: 'archaeology/ar_sanxingdui' },
  haojing: { kind: 'palace', hero: 'capitals/cap_zhou' },
  xianyang: { kind: 'palace', hero: 'capitals/cap_xianyang' },
  dujiangyan: { kind: 'bridge', hero: 'places-sites/pl_dujiangyan' },
  lingqu: { kind: 'bridge', hero: 'life-arch1/lf_lingqu' },
  zhaozhou: { kind: 'bridge', hero: 'life-arch1/lf_zhaozhou' },
  yungang: { kind: 'statue', hero: 'places-sites/pl_yungang' },
  longmen: { kind: 'statue', hero: 'life-arch1/lf_grotto' },
  dunhuang: { kind: 'gate', hero: 'places-sites/pl_dunhuang' },
  mogao: { kind: 'temple', hero: 'china/cn_mogao' },
  // Ancient & Modern Capitals / Major Cities
  xian: { kind: 'pagoda', hero: 'life-arch1/lf_dayan' },
  luoyang: { kind: 'palace', hero: 'capitals/cap_luoyang' },
  kaifeng: { kind: 'palace', hero: 'capitals/cap_song' },
  nanjing: { kind: 'palace', hero: 'capitals/cap_ming' },
  hangzhou: { kind: 'pagoda', hero: 'china/cn_westlake' },
  beijing: { kind: 'palace', hero: 'asia/forbidden' },
  shangjing: { kind: 'yurt', hero: 'sites-a/st_khitan' },
  xingqing: { kind: 'monument', hero: 'sites-a/st_xixia' },
  huining: { kind: 'palace', hero: 'capitals/cap_jin' },
  // Curated Chinese Cities
  zhengzhou: { kind: 'pagoda', hero: 'places-cities/pl_zhengzhou' },
  shenyang: { kind: 'palace', hero: 'places-cities/pl_shenyang' },
  dali: { kind: 'pagoda', hero: 'places-cities/pl_dali' },
  lhasa: { kind: 'temple', hero: 'asia2/potala' },
  chengdu: { kind: 'temple', hero: 'places-cities/pl_chengdu' },
  chongqing: { kind: 'palace', hero: 'places-cities/pl_chongqing' },
  wuhan: { kind: 'pagoda', hero: 'china/cn_yellowcrane' },
  wuchang: { kind: 'palace', hero: 'sites-b/st_wuchang' },
  changsha: { kind: 'ding', hero: 'archaeology/ar_mawangdui' },
  nanchang: { kind: 'palace', hero: 'sites-b/st_nanchang' },
  guangzhou: { kind: 'palace', hero: 'sites-b/st_canton' },
  quanzhou: { kind: 'pagoda', hero: 'places-cities/pl_quanzhou' },
  suzhou: { kind: 'pagoda', hero: 'life-arch2/lf_huqiu' },
  yangzhou: { kind: 'bridge', hero: 'places-cities/pl_yangzhou' },
  shanghai: { kind: 'skyline', hero: 'china/cn_bund' },
  tianjin: { kind: 'bridge', hero: 'places-cities/pl_tianjin' },
  jinan: { kind: 'temple', hero: 'places-cities/pl_jinan' },
  qufu: { kind: 'temple', hero: 'places-cities/pl_qufu' },
  linzi: { kind: 'palace', hero: 'places-cities/pl_linzi' },
  handan: { kind: 'palace', hero: 'places-cities/pl_handan' },
  ying: { kind: 'palace', hero: 'places-cities/pl_ying' },
  kuaiji: { kind: 'temple', hero: 'life-custom2/lf_lanting' },
  fuzhou: { kind: 'pagoda', hero: 'places-cities/pl_fuzhou' },
  kunming: { kind: 'gate', hero: 'places-cities/pl_kunming' },
  datong: { kind: 'temple', hero: 'china/cn_hangingtemple' },
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
  taipei: { kind: 'skyline', hero: 'asia/taipei101' },
  tainan: { kind: 'gate', hero: 'places-cities/pl_tainan' },
  hongkong: { kind: 'skyline', hero: 'places-cities/pl_hongkong' },
  macao: { kind: 'gate', hero: 'places-cities/pl_macao' },
  haikou: { kind: 'gate', hero: 'places-cities/pl_haikou' },
  shenzhen: { kind: 'skyline', hero: 'sites-b/st_shenzhen79' },
  xiongan: { kind: 'skyline', hero: 'places-sites/pl_xiongan' },
  // Passes & Great Wall
  yumenguan: { kind: 'gate', hero: 'places-sites/pl_yumenguan' },
  jiayuguan: { kind: 'gate', hero: 'sites-b/st_jiayuguan' },
  hanguguan: { kind: 'gate', hero: 'places-sites/pl_hanguguan' },
  tongguan: { kind: 'gate', hero: 'places-sites/pl_tongguan' },
  shanhaiguan: { kind: 'gate', hero: 'sites-b/st_shanhaiguan' },
  jianmenguan: { kind: 'gate', hero: 'places-sites/pl_jianmenguan' },
  pingxingguan: { kind: 'gate', hero: 'places-sites/pl_pingxingguan' },
  'pass-wuguan': { kind: 'gate', hero: 'places-sites/pl_pass_wuguan' },
  'pass-dasanguan': { kind: 'gate', hero: 'places-sites/pl_pass_dasanguan' },
  'pass-xiaoguan': { kind: 'gate', hero: 'places-sites/pl_pass_xiaoguan' },
  'pass-hulaoguan': { kind: 'gate', hero: 'places-sites/pl_pass_hulao' },
  'pass-yangpingguan': { kind: 'gate', hero: 'places-sites/pl_pass_yangping' },
  'pass-yanmenguan': { kind: 'gate', hero: 'places-sites/pl_pass_yanmen' },
  'pass-juyongguan': { kind: 'wall', hero: 'asia/greatwall' },
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
  luding: { kind: 'bridge', hero: 'places-sites/pl_luding' },
  yanan: { kind: 'pagoda', hero: 'places-sites/pl_yanan' },
  xibaipo: { kind: 'hut', hero: 'places-sites/pl_xibaipo' },
  lugouqiao: { kind: 'bridge', hero: 'places-sites/pl_lugouqiao' },
  taierzhuang: { kind: 'gate', hero: 'places-sites/pl_taierzhuang' },
  humen: { kind: 'cannon', hero: 'places-sites/pl_humen' },
  weihai: { kind: 'ship', hero: 'places-sites/pl_weihai' },
  xiaogang: { kind: 'hut', hero: 'places-sites/pl_xiaogang' },
  lop_nur: { kind: 'monument', hero: 'sites-b/st_lopnur' },
  jiuquan_lc: { kind: 'rocket', hero: 'places-sites/pl_jiuquan_lc' },
  wenchang: { kind: 'rocket', hero: 'places-sites/pl_wenchang' },
  dandong: { kind: 'bridge', hero: 'places-sites/pl_dandong' },
  // Mountains & Maritime Islands
  taishan: { kind: 'temple', hero: 'china/cn_taishan' },
  everest: { kind: 'mountain', hero: 'places-sites/pl_everest' },
  diaoyu: { kind: 'boat', hero: 'places-sites/pl_diaoyu' },
  nanhai: { kind: 'boat', hero: 'places-sites/pl_nanhai' },
  xisha: { kind: 'boat', hero: 'places-sites/pl_xisha' },
  nansha: { kind: 'boat', hero: 'places-sites/pl_nansha' },
  // Foreign Cities
  nara: { kind: 'temple', hero: 'sites-a/st_toshodaiji' },
  kyoto: { kind: 'temple', hero: 'asia/kinkakuji' },
  tokyo: { kind: 'skyline', hero: 'asia2/skytree' },
  seoul: { kind: 'palace', hero: 'asia/gyeongbok' },
  pyongyang: { kind: 'gate', hero: 'places-cities/pl_pyongyang' },
  albazin: { kind: 'wall', hero: 'places-cities/pl_albazin' },
  nerchinsk: { kind: 'hut', hero: 'places-cities/pl_nerchinsk' },
  vladivostok: { kind: 'ship', hero: 'places-cities/pl_vladivostok' },
  talas: { kind: 'wall', hero: 'places-cities/pl_talas' },
  samarkand: { kind: 'temple', hero: 'places-cities/pl_samarkand' },
  nalanda: { kind: 'temple', hero: 'sites-a/st_nalanda' },
  calicut: { kind: 'ship', hero: 'places-cities/pl_calicut' },
  malacca: { kind: 'gate', hero: 'places-cities/pl_malacca' },
  hanoi: { kind: 'pagoda', hero: 'places-cities/pl_hanoi' },
  // Famous Imported Cities (j* and settlement-*)
  j4: { kind: 'ding', hero: 'places-atlas/pl_baoji' },
  j12: { kind: 'ding', hero: 'places-atlas/pl_xinzheng' },
  j21: { kind: 'temple', hero: 'places-atlas/pl_taiyuan' },
  j31: { kind: 'gate', hero: 'places-atlas/pl_shouxian' },
  j34: { kind: 'warrior', hero: 'asia3/terracotta' },
  j36: { kind: 'wall', hero: 'sites-a/st_qinwall' },
  j46: { kind: 'temple', hero: 'places-atlas/pl_hotan' },
  j48: { kind: 'statue', hero: 'places-atlas/pl_wuwei' },
  j54: { kind: 'palace', hero: 'places-atlas/pl_xuzhou' },
  j58: { kind: 'monument', hero: 'places-atlas/pl_jian' },
  j64: { kind: 'palace', hero: 'life-arch1/lf_tongque' },
  j67: { kind: 'temple', hero: 'places-atlas/pl_fengjie' },
  j70: { kind: 'temple', hero: 'places-atlas/pl_kuqa' },
  j86: { kind: 'statue', hero: 'places-atlas/pl_tianshui' },
  j92: { kind: 'palace', hero: 'places-atlas/pl_shannan' },
  j97: { kind: 'temple', hero: 'life-arch1/lf_foguang' },
  j98: { kind: 'temple', hero: 'places-atlas/pl_zhengding' },
  j106: { kind: 'palace', hero: 'places-atlas/pl_ningan' },
  j108: { kind: 'statue', hero: 'asia3/leshan' },
  j114: { kind: 'temple', hero: 'life-arch2/lf_academy' },
  j118: { kind: 'pagoda', hero: 'life-arch2/lf_baisikou' },
  j119: { kind: 'pagoda', hero: 'life-arch2/lf_yingxian' },
  j121: { kind: 'temple', hero: 'places-atlas/pl_sakya' },
  j125: { kind: 'yurt', hero: 'places-atlas/pl_karakorum' },
  j129: { kind: 'gate', hero: 'places-atlas/pl_hechuan' },
  j135: { kind: 'monument', hero: 'life-arch2/lf_guanxing' },
  j148: { kind: 'temple', hero: 'life-arch2/lf_pavilion' },
  j149: { kind: 'hut', hero: 'life-custom2/lf_kiln' },
  j150: { kind: 'palace', hero: 'places-atlas/pl_ningbo' },
  j152: { kind: 'mountain', hero: 'china/cn_jiuzhaigou' },
  j154: { kind: 'mountain', hero: 'china/cn_danxia' },
  j155: { kind: 'boat', hero: 'china/cn_guilin' },
  j156: { kind: 'pagoda', hero: 'china/cn_huangshan' },
  j159: { kind: 'gate', hero: 'places-atlas/pl_xiangyang' },
  j160: { kind: 'mountain', hero: 'china/cn_yuanyang' },
  j161: { kind: 'pagoda', hero: 'places-atlas/pl_yueyang' },
  j165: { kind: 'palace', hero: 'places-atlas/pl_xiamen' },
  j169: { kind: 'pagoda', hero: 'places-atlas/pl_qingdao' },
  j170: { kind: 'temple', hero: 'places-atlas/pl_chengde' },
  'settlement-117.12-36.19': { kind: 'temple', hero: 'places-cities/pl_taian' },
  'settlement-112.2-30.35': { kind: 'gate', hero: 'places-atlas/pl_jingzhou' },
};

/** Landmark model per place (modern name fallback). */
const PLACE_HERO: Record<string, ModelRecipe> = {
  拉萨: { kind: 'temple', hero: 'asia2/potala' }, 敦煌: { kind: 'temple', hero: 'china/cn_mogao' },
  杭州: { kind: 'pagoda', hero: 'china/cn_westlake' }, 武汉: { kind: 'pagoda', hero: 'china/cn_yellowcrane' },
  泰安: { kind: 'temple', hero: 'places-cities/pl_taian' }, 泰山: { kind: 'temple', hero: 'china/cn_taishan' },
  乐山: { kind: 'statue', hero: 'asia3/leshan' }, 桂林: { kind: 'boat', hero: 'china/cn_guilin' },
  北京: { kind: 'palace', hero: 'asia/forbidden' }, 西安: { kind: 'pagoda', hero: 'life-arch1/lf_dayan' },
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
    xia: 'cap_erlitou', shang: 'cap_yinxu', wzhou: 'cap_zhou', chunqiu: 'cap_luoyi', zhanguo: 'cap_zhanguo',
    qin: 'cap_xianyang', whan: 'cap_qinhan', xin: 'cap_xin', ehan: 'cap_luoyang', wjin: 'cap_taiji',
    ejin: 'cap_jiankang', sui: 'cap_sui', tang: 'cap_tang', wudai: 'cap_wudai', bsong: 'cap_song',
    jin: 'cap_jin', nsong: 'cap_linan', yuan: 'cap_yuan', ming: 'cap_ming', roc: 'cap_nanjing_roc',
  };
  const h = by[era.id];
  if (h) return { kind: 'palace', hero: 'capitals/' + h };
  const eraHero: Record<string, ModelRecipe> = {
    paleo: { kind: 'cave' },
    neo: { kind: 'hut' },
    sanguo: { kind: 'palace', hero: 'life-arch1/lf_tongque' },
    nanbei: { kind: 'pagoda', hero: 'life-arch1/lf_songyue' },
    liao: { kind: 'yurt', hero: 'sites-a/st_khitan' },
    xixia: { kind: 'monument', hero: 'sites-a/st_xixia' },
  };
  if (eraHero[era.id]) return eraHero[era.id];
  if (era.start >= 1949) return { kind: 'monument' };
  if (era.start >= 1368) return { kind: 'palace', hero: 'asia/forbidden' };
  return { kind: 'palace', style: era.start < 581 ? 'han' : 'tang', year: era.start };
}

/** The 3D model shown on a place card: its period-appropriate capital or unique landmark. */
export function placeModel(p: Place, year?: number): ModelRecipe {
  if (year !== undefined) {
    if (p.id === 'xian') {
      if (year < -221) return { kind: 'palace', hero: 'capitals/cap_zhou' };
      if (year >= 8 && year <= 23) return { kind: 'palace', hero: 'capitals/cap_xin' };
      if (year < 581) return { kind: 'palace', hero: 'capitals/cap_qinhan' };
      if (year < 618) return { kind: 'palace', hero: 'capitals/cap_sui' };
      if (year <= 907) return { kind: 'palace', hero: 'capitals/cap_tang' };
    }
    if (p.id === 'luoyang') {
      if (year < -221) return { kind: 'palace', hero: 'capitals/cap_luoyi' };
      if (year < 220) return { kind: 'palace', hero: 'capitals/cap_luoyang' };
      if (year < 581) return { kind: 'palace', hero: 'capitals/cap_taiji' };
      if (year <= 907) return { kind: 'palace', hero: 'capitals/cap_tang' };
    }
    if (p.id === 'kaifeng') {
      if (year >= 907 && year < 960) return { kind: 'palace', hero: 'capitals/cap_wudai' };
      if (year >= 960 && year <= 1234) return { kind: 'palace', hero: 'capitals/cap_song' };
    }
    if (p.id === 'nanjing') {
      if (year >= 1912 && year < 1949) return { kind: 'palace', hero: 'capitals/cap_nanjing_roc' };
      if (year >= 1368 && year < 1644) return { kind: 'palace', hero: 'capitals/cap_ming' };
      if (year < 1368) return { kind: 'palace', hero: 'capitals/cap_jiankang' };
    }
    if (p.id === 'hangzhou' && year >= 1127 && year <= 1279) return { kind: 'palace', hero: 'capitals/cap_linan' };
    if (p.id === 'beijing') {
      if (year >= 1260 && year < 1368) return { kind: 'palace', hero: 'capitals/cap_yuan' };
    }
    if (p.name.zh === '上海' && year < 1949) return { kind: 'skyline', hero: 'china/cn_bund', style: 'roc' };
  }
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
    return {
      kind: p.capital?.length ? 'palace' : p.kind === 'pass' ? 'gate' : p.kind === 'site' ? 'ding' : p.kind === 'water' ? 'boat' : p.kind === 'mountain' ? 'temple' : 'gate',
      hero: 'places-atlas/pl_gazetteer',
      style: `${p.id}|${p.lon.toFixed(1)}|${p.lat.toFixed(1)}|${p.capital?.length ? 1 : 0}|${arch}|${p.name.zh}`,
    };
  }
  const hero = PLACE_HERO[p.name.zh];
  if (hero) return hero;
  if (p.capital?.length) return { kind: 'palace', ...(year !== undefined ? { year } : {}) };
  return { kind: p.kind === 'pass' ? 'gate' : p.kind === 'site' ? 'ding' : p.kind === 'water' ? 'boat' : p.kind === 'mountain' ? 'temple' : 'gate', ...(year !== undefined ? { year } : {}) };
}

export type PersonRole = 'ruler' | 'general' | 'monk' | 'woman' | 'scholar';

/** Explicit role, period costume year, and prop overrides for historical figures whose honorifics or life spans cross dynasty boundaries. */
const PERSON_OVERRIDE: Record<string, { role?: PersonRole; year?: number; prop?: string; female?: boolean; eth?: string }> = {
  // Pre-Qin
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
  const ov = PERSON_OVERRIDE[p.name.zh];
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
