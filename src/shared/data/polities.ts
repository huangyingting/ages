import { IMPORTED_POLITIES } from './jiangshan.ts';
import type { Polity } from './types.ts';

const P = (id: string, zh: string, en: string, color: string, role: Polity['role'] = 'main', wiki?: Polity['wiki']): Polity =>
  ({ id, name: { zh, en }, color, role, wiki });

/** Every polity that appears in a territorial snapshot. Colours are tuned for the parchment map (muted, distinct). */
export const POLITIES: Polity[] = [
  // early states
  P('xia', '夏', 'Xia', '#c0703a'),
  P('shang', '商', 'Shang', '#b4793a'),
  P('zhou', '周', 'Zhou', '#9a7d3a'),
  P('zhouwang', '周王畿', 'Zhou royal domain', '#8e3b5c'),
  // Spring & Autumn / Warring States
  P('qin_s', '秦', 'Qin', '#34495e', 'rival'),
  P('jin_s', '晋', 'Jin', '#7d5ba6', 'rival'),
  P('qi_s', '齐', 'Qi', '#2e86c1', 'rival'),
  P('chu_s', '楚', 'Chu', '#c0392b', 'rival'),
  P('yan_s', '燕', 'Yan', '#17a589', 'rival'),
  P('lu_s', '鲁', 'Lu', '#d68910', 'rival'),
  P('song_s', '宋', 'Song', '#a04000', 'rival'),
  P('zheng_s', '郑', 'Zheng', '#c47c9a', 'rival'),
  P('wey_s', '卫', 'Wey', '#48a99a', 'rival'),
  P('wu_s', '吴', 'Wu', '#16a085', 'rival'),
  P('yue_s', '越', 'Yue', '#229954', 'rival'),
  P('zhao_s', '赵', 'Zhao', '#7d3c98', 'rival'),
  P('wei_s', '魏', 'Wei', '#d4ac0d', 'rival'),
  P('han_s', '韩', 'Han', '#dc7633', 'rival'),
  P('shu_s', '蜀', 'Shu', '#6e2c00', 'neighbor'),
  P('ba_s', '巴', 'Ba', '#935116', 'neighbor'),
  P('chen_s', '陈', 'Chen', '#5b7f95', 'rival'),
  P('cai_s', '蔡', 'Cai', '#148f77', 'rival'),
  P('xu_s', '许', 'Xu', '#8d8741', 'rival'),
  P('cao_s', '曹', 'Cao', '#1a5276', 'rival'),
  P('ju_s', '莒', 'Ju', '#6c3483', 'rival'),
  P('zhongshan_s', '中山', 'Zhongshan', '#b9770e', 'rival'),
  // early non-Zhou peoples (regions override the name: 鬼方, 犬戎, 狄, 山戎, 淮夷, 莱 …)
  P('rongdi', '戎狄', 'Rong and Di', '#a6a28a', 'neighbor'),
  P('dongyi', '东夷', 'Dong Yi', '#a3b5a0', 'neighbor'),
  // empires
  P('qin', '秦朝', 'Qin Empire', '#34495e'),
  P('whan', '西汉', 'Western Han', '#b03a2e'),
  P('ehan', '东汉', 'Eastern Han', '#b03a2e'),
  P('cao_wei', '魏', 'Cao Wei', '#2874a6', 'main'),
  P('shu_han', '蜀', 'Shu Han', '#b9770e', 'main'),
  P('sun_wu', '吴', 'Eastern Wu', '#1e8449', 'main'),
  P('wjin', '西晋', 'Western Jin', '#1a5276'),
  P('ejin', '东晋', 'Eastern Jin', '#2471a3'),
  P('qianqin', '前秦', 'Former Qin', '#7b7d7d', 'rival'),
  P('beiwei', '北魏', 'Northern Wei', '#5b2c6f', 'main'),
  P('liusong', '宋（南朝）', 'Liu Song', '#2e86c1', 'main'),
  P('sui', '隋', 'Sui', '#148f77'),
  P('tang', '唐', 'Tang', '#c0392b'),
  P('houjin', '后晋', 'Later Jin', '#7d6608'),
  P('nantang', '南唐', 'Southern Tang', '#2e86c1', 'rival'),
  P('wuyue', '吴越', 'Wuyue', '#17a589', 'rival'),
  P('min', '闽', 'Min', '#a569bd', 'rival'),
  P('chu5', '楚（马楚）', 'Ma Chu', '#dc7633', 'rival'),
  P('nanhan', '南汉', 'Southern Han', '#d4ac0d', 'rival'),
  P('houshu', '后蜀', 'Later Shu', '#6e2c00', 'rival'),
  P('jingnan', '荆南', 'Jingnan', '#cd6155', 'rival'),
  P('bsong', '北宋', 'Northern Song', '#2e86c1'),
  P('nsong', '南宋', 'Southern Song', '#2471a3'),
  P('liao', '辽', 'Liao', '#7f8c8d', 'main'),
  P('xixia', '西夏', 'Western Xia', '#ba4a00', 'main'),
  P('jin', '金', 'Jin', '#b7950b', 'main'),
  P('dali', '大理', 'Dali', '#8e44ad', 'main'),
  P('yuan', '元', 'Yuan', '#1e8449'),
  P('ming', '明', 'Ming', '#d4ac0d'),
  P('qing', '清', 'Qing', '#a569bd'),
  P('roc', '中华民国', 'Republic of China', '#5dade2'),
  P('prc', '中华人民共和国', 'People’s Republic of China', '#e74c3c'),
  // neighbours and others
  P('xiongnu', '匈奴', 'Xiongnu', '#a6acaf', 'neighbor'),
  P('yuezhi', '月氏', 'Yuezhi', '#c5b4a0', 'neighbor'),
  P('wusun', '乌孙', 'Wusun', '#b8b09a', 'neighbor'),
  P('xianbei', '鲜卑', 'Xianbei', '#a6acaf', 'neighbor'),
  P('gojoseon', '卫氏朝鲜', 'Wiman Joseon', '#bfc9ca', 'neighbor'),
  P('goguryeo', '高句丽', 'Goguryeo', '#bfc9ca', 'neighbor'),
  P('silla', '新罗', 'Silla', '#bfc9ca', 'neighbor'),
  P('rouran', '柔然', 'Rouran', '#a6acaf', 'neighbor'),
  P('tujue', '突厥', 'Göktürks', '#a6acaf', 'neighbor'),
  P('tuyuhun', '吐谷浑', 'Tuyuhun', '#c5b4a0', 'neighbor'),
  P('tubo', '吐蕃', 'Tibetan Empire (Tubo)', '#c39b77', 'neighbor'),
  P('huihe', '回纥', 'Uyghur Khaganate', '#a6acaf', 'neighbor'),
  P('nanzhao', '南诏', 'Nanzhao', '#b39ddb', 'neighbor'),
  P('bohai', '渤海', 'Balhae', '#b2babb', 'neighbor'),
  P('gaoli', '高丽', 'Goryeo', '#bfc9ca', 'neighbor'),
  P('xiliao', '西辽', 'Western Liao (Qara Khitai)', '#99a3a4', 'neighbor'),
  P('huihu_w', '西州回鹘', 'Qocho Uyghurs', '#b8b09a', 'neighbor'),
  P('karakhan', '喀喇汗王朝', 'Kara-Khanid Khanate', '#c5b4a0', 'neighbor'),
  P('tubo_bu', '吐蕃诸部', 'Tibetan tribes', '#c39b77', 'neighbor'),
  P('mongol', '蒙古', 'Mongols', '#a6acaf', 'neighbor'),
  P('chagatai', '察合台汗国', 'Chagatai Khanate', '#c5b4a0', 'neighbor'),
  P('tatar', '鞑靼', 'Northern Yuan (Tatars)', '#a6acaf', 'neighbor'),
  P('oirat', '瓦剌', 'Oirats', '#b8b09a', 'neighbor'),
  P('moghul', '东察合台汗国', 'Moghulistan', '#c5b4a0', 'neighbor'),
  P('joseon', '朝鲜', 'Joseon', '#bfc9ca', 'neighbor'),
  P('annam', '安南', 'Annam (Đại Việt)', '#bfc9ca', 'neighbor'),
  P('russia', '俄国', 'Russian Empire', '#aab7b8', 'neighbor'),
  P('japan', '日本', 'Japan', '#cacfd2', 'neighbor'),
  P('jp_occ', '日军占领区', 'Japanese-occupied area', '#566573', 'occupied'),
  P('colony_uk', '英国占领（香港）', 'British-ruled (Hong Kong)', '#566573', 'occupied'),
  P('colony_pt', '葡萄牙占领（澳门）', 'Portuguese-ruled (Macao)', '#566573', 'occupied'),
  P('jp_taiwan', '日本占据（台湾）', 'Japanese-occupied Taiwan', '#566573', 'occupied'),
  P('mongolia', '蒙古国', 'Mongolia', '#b8b09a', 'neighbor'),
  P('ussr', '苏联', 'Soviet Union', '#aab7b8', 'neighbor'),
  ...IMPORTED_POLITIES,
];

export const POLITY = new Map(POLITIES.map(p => [p.id, p]));

/** Imported polities that story highlights of a curated polity should also match (by name). */
const ALIAS: Record<string, RegExp> = {
  qin: /^秦$/, whan: /^汉$|^汉（/, ehan: /^东汉$/, cao_wei: /^魏$|^曹操/, shu_han: /^蜀汉?$|^刘备/, sun_wu: /^吴$|^孙权/, wjin: /^晋$/, ejin: /^东晋$/,
  bsong: /^宋$/, nsong: /^南宋/, yuan: /^元$|^大蒙古国$/, russia: /沙皇俄国|俄罗斯帝国/, jp_occ: /日占|日军侵占/, roc: /^中华民国|^国民政府/,
  tang: /^唐$/, sui: /^隋$/, ming: /^明$/, qing: /^清$/, liao: /^辽$/, jin: /^金$/, xixia: /^西夏$/, tubo: /^吐蕃$/, xiongnu: /^匈奴/,
  beiwei: /^北魏$/, qianqin: /^前秦$/,
};
const bare = (zh: string) => zh.replace(/[（(].*$/, '').replace(/朝$/, '').trim();
/** Whether a region's polity counts as `wanted` (same id, alias pattern or same bare name). */
export function polityMatches(regionPolity: string, wanted: string): boolean {
  if (regionPolity === wanted) return true;
  const a = POLITY.get(regionPolity), w = POLITY.get(wanted);
  if (!a || !w || !a.id.startsWith('j') || w.id.startsWith('j')) return false;
  const re = ALIAS[wanted];
  return re ? re.test(a.name.zh) : bare(a.name.zh) === bare(w.name.zh);
}
