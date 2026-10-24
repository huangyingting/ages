import { personModel } from './heroes.ts';
import { personNamed, type Person } from './jiangshan.ts';
import type { I18n, ModelRecipe, Wiki } from './types.ts';

/**
 * Everyday life of each dynasty on the map: its representative people, buildings, customs and foods, each with a
 * detailed model (hero packs `life-*`), a short description and a Wikipedia article. Curated by hand for every
 * China era (see `sceneryOf`, which stands them on the map ahead of the event-derived landmarks).
 */
export type LifeKind = 'person' | 'building' | 'custom' | 'food';
export interface LifeItem {
  id: string;
  /** era id (lane-0 China era) */
  era: string;
  kind: LifeKind;
  name: I18n;
  desc: I18n;
  lon: number;
  lat: number;
  model: ModelRecipe;
  wiki: Wiki;
  /** the person record, when the person is in the people index (opens the person card) */
  person?: Person;
  /** 1 headline (shown with the era at any zoom), 2 detail (shown once zoomed in) */
  tier: 1 | 2;
}

type At = [lon: number, lat: number];
type Txt = [zh: string, en: string];
interface Opt { tier?: 1 | 2; wiki?: Txt }

const LIFE_LIST: LifeItem[] = [];
let cur = '';
const era = (id: string) => { cur = id; };
const hero = (ref: string, kind: string, o: Record<string, unknown> = {}): ModelRecipe => ({ kind, hero: ref, ...o });

function thing(kind: Exclude<LifeKind, 'person'>, id: string, name: Txt, at: At, model: ModelRecipe, desc: Txt, o: Opt = {}): void {
  LIFE_LIST.push({
    id, era: cur, kind, name: { zh: name[0], en: name[1] }, desc: { zh: desc[0], en: desc[1] }, lon: at[0], lat: at[1], model,
    wiki: { zh: (o.wiki ?? name)[0], en: (o.wiki ?? name)[1] }, tier: o.tier ?? 1,
  });
}
const B = (id: string, name: Txt, at: At, model: ModelRecipe, desc: Txt, o?: Opt) => thing('building', id, name, at, model, desc, o);
const C = (id: string, name: Txt, at: At, model: ModelRecipe, desc: Txt, o?: Opt) => thing('custom', id, name, at, model, desc, o);
const F = (id: string, name: Txt, at: At, model: ModelRecipe, desc: Txt, o?: Opt) => thing('food', id, name, at, model, desc, o);

interface WhoOpt extends Opt { en?: string; role?: string; year?: number; prop?: string; female?: boolean; desc?: Txt }
/** A person: from the people index when listed there (their card, period dress, hero model), else described here. */
function P(zh: string, at: At, o: WhoOpt = {}): void {
  const p = personNamed(zh);
  const base: ModelRecipe = p ? personModel(p) : { kind: 'person', role: o.role ?? 'scholar', ...(o.year !== undefined ? { year: o.year } : {}) };
  const model: ModelRecipe = base.hero ? base : {
    ...base, ...(o.role ? { role: o.role } : {}), ...(o.year !== undefined ? { year: o.year } : {}),
    ...(o.prop ? { prop: o.prop } : {}), ...(o.female ? { female: true } : {}), bare: true,
  };
  const name = p?.name ?? { zh, en: o.en ?? zh };
  const desc = o.desc ? { zh: o.desc[0], en: o.desc[1] } : p ? p.title : { zh: '', en: '' };
  LIFE_LIST.push({
    id: 'p-' + (p?.id ?? zh), era: cur, kind: 'person', name, desc, lon: at[0], lat: at[1], model,
    wiki: o.wiki ? { zh: o.wiki[0], en: o.wiki[1] } : { zh: name.zh, en: name.en }, ...(p ? { person: p } : {}), tier: o.tier ?? 1,
  });
}

const A1 = 'life-arch1/', A2 = 'life-arch2/', C1 = 'life-custom1/', C2 = 'life-custom2/', FD = 'life-food/';

// ---------------------------------------------------------------------------------------------- prehistory
era('paleo');
P('北京人', [115.93, 39.69], { en: 'Peking Man', role: 'scholar', year: -500000,
  desc: ['约七十万至二十万年前生活在周口店的直立人，会打制石器、使用天然火。', 'Homo erectus of Zhoukoudian (c. 700,000–200,000 years ago) who made stone tools and kept fire.'] });
LIFE_LIST[LIFE_LIST.length - 1].model = hero(C1 + 'lf_pekingman', 'cave');
B('zhoukoudian', ['周口店洞穴', 'Zhoukoudian cave'], [115.2, 40.6], { kind: 'cave' },
  ['北京人与山顶洞人居住的石灰岩洞穴，出土头盖骨、石器与灰烬层。', 'Limestone caves of Peking Man and Upper Cave Man: skulls, stone tools and thick ash layers.'], { wiki: ['周口店北京人遗址', 'Zhoukoudian'] });
C('fire', ['钻木取火', 'Making fire'], [111.0, 38.2], hero(C1 + 'lf_fire', 'cave'),
  ['用火让先民熟食、取暖、驱兽，是人类进化的关键一步。', 'Fire let early people cook, keep warm and drive off beasts — a turning point in human evolution.'], { wiki: ['钻木取火', 'Fire making'] });
F('forage', ['采集与渔猎', 'Foraging and fishing'], [108.4, 31.6], hero(FD + 'lf_forage', 'hut'),
  ['旧石器时代人们以采集果实、根茎和渔猎为生，过着迁徙生活。', 'Palaeolithic people lived by gathering nuts, roots and berries, hunting and fishing.'], { wiki: ['狩猎采集社会', 'Hunter-gatherer'] });
P('元谋人', [101.87, 25.7], { en: 'Yuanmou Man', role: 'scholar', year: -1700000, tier: 2,
  desc: ['约一百七十万年前的直立人，是中国境内已知最早的古人类之一。', 'Homo erectus of about 1.7 million years ago, among the earliest humans known in China.'] });
LIFE_LIST[LIFE_LIST.length - 1].model = hero(C1 + 'lf_pekingman', 'cave', { style: 'yuanmou' });

era('neo');
B('banpo', ['半坡聚落', 'Banpo village'], [109.05, 34.27], hero(A1 + 'lf_banpo', 'hut'),
  ['仰韶文化的母系氏族村落：半地穴式圆屋、环壕、窑场与墓地。', 'A Yangshao village: half-sunken round huts, a ring ditch, pottery kilns and a cemetery.'], { wiki: ['半坡遗址', 'Banpo'] });
B('hemudu', ['河姆渡干栏', 'Hemudu stilt houses'], [121.35, 30.0], { kind: 'stilt' },
  ['河姆渡人在沼泽上建起榫卯结构的干栏式长屋，种植水稻。', 'Hemudu people built mortise-and-tenon stilt houses over marshland and grew rice.'], { wiki: ['河姆渡文化', 'Hemudu culture'] });
F('pottery', ['彩陶与粟', 'Painted pottery and millet'], [111.77, 34.77], hero(FD + 'lf_pottery', 'ding'),
  ['黄河流域种粟，烧制绘有鱼纹、几何纹的红色彩陶。', 'Along the Yellow River people grew millet and fired red pottery painted with fish and geometric patterns.'], { wiki: ['仰韶文化', 'Yangshao culture'] });
F('rice', ['稻作农业', 'Rice farming'], [116.0, 28.6], hero(FD + 'lf_rice', 'hut'),
  ['长江流域是世界稻作农业的起源地之一，上山、河姆渡均有稻谷遗存。', 'The Yangtze valley is one of the cradles of rice farming; Shangshan and Hemudu kept ancient rice grains.'], { wiki: ['稻作', 'Domestication of rice'] });
C('liangzhu', ['良渚玉琮', 'Liangzhu jade'], [119.99, 30.39], { kind: 'jade' },
  ['良渚文化以玉琮、玉璧为礼器，刻神人兽面纹，并建有巨大古城与水坝。', 'Liangzhu culture made jade cong and bi with mask motifs, and built a walled city with dams.'], { wiki: ['良渚文化', 'Liangzhu culture'] });
P('黄帝', [113.7, 34.4], { en: 'Yellow Emperor', role: 'ruler', year: -2600, tier: 2,
  desc: ['传说中的华夏人文始祖，与炎帝并称“炎黄”。', 'Legendary ancestor of the Chinese, honoured with the Yan Emperor as "Yan-Huang".'] });

// ---------------------------------------------------------------------------------------------- Xia Shang Zhou
era('xia');
P('大禹', [111.3, 35.6], { en: 'Yu the Great', role: 'ruler', year: -2100, prop: 'spade',
  desc: ['疏导洪水十三年、三过家门而不入，其子启建立夏朝。', 'Tamed the great flood by dredging channels for 13 years; his son Qi founded the Xia.'] });
B('erlitou', ['二里头宫殿', 'Erlitou palace'], [113.6, 35.4], hero(A1 + 'lf_hangtu', 'palace'),
  ['二里头遗址有中国最早的宫城与夯土台基宫殿，可能是夏都斟鄩。', 'Erlitou has China\'s earliest palace city with rammed-earth halls — perhaps the Xia capital Zhenxun.'], { wiki: ['二里头文化', 'Erlitou culture'] });
C('jue', ['青铜爵', 'Bronze jue'], [112.0, 33.6], hero(C1 + 'lf_jue', 'ding'),
  ['二里头出土中国最早的青铜容器“爵”，用于饮酒祭祀。', 'Erlitou yielded China\'s earliest bronze vessels — the tripod jue for ritual wine.'], { wiki: ['爵', 'Jue (vessel)'] });
F('wine', ['杜康酿酒', 'Grain wine'], [112.47, 34.15], hero(FD + 'lf_wine', 'ding'),
  ['传说杜康始造秫酒；夏商贵族盛行以谷物酿酒、以铜爵饮酒。', 'Legend credits Du Kang with brewing; Xia and Shang nobles drank grain wine from bronze cups.'], { wiki: ['杜康', 'Du Kang'], tier: 2 });

era('shang');
P('妇好', [115.4, 36.9], { en: 'Fu Hao', role: 'general', year: -1200, female: true, prop: 'axe',
  desc: ['商王武丁之妻、女将军，曾率万余人出征，墓中出土大量青铜器与玉器。', 'Wife of King Wu Ding and a general who led 13,000 troops; her tomb held hundreds of bronzes and jades.'] });
C('oracle', ['甲骨占卜', 'Oracle bones'], [114.3, 35.0], { kind: 'oracle' },
  ['商人用龟甲兽骨占卜并刻下卜辞，甲骨文是成熟的汉字体系。', 'Shang diviners cracked turtle shells and ox bones and carved the answers — the earliest mature Chinese script.'], { wiki: ['甲骨文', 'Oracle bone script'] });
B('houmuwu', ['后母戊鼎', 'Houmuwu ding'], [113.0, 36.6], { kind: 'ding' },
  ['重八百三十二千克，是现存最重的商代青铜器。', 'At 832 kg, the heaviest Shang bronze vessel ever found.'], { wiki: ['后母戊鼎', 'Houmuwu ding'] });
B('sanxingdui', ['三星堆', 'Sanxingdui'], [104.2, 31.0], hero('archaeology/ar_sanxingdui', 'monument'),
  ['古蜀国的青铜纵目面具、神树与金杖，风格神秘独特。', 'Bronze masks with protruding eyes, sacred trees and a gold staff of the ancient Shu kingdom.'], { wiki: ['三星堆遗址', 'Sanxingdui'] });
F('cauldron', ['鼎烹', 'Cooking in the ding'], [116.6, 34.4], hero(FD + 'lf_cauldron', 'ding'),
  ['鼎与鬲最初是炊具，用来煮肉羹；后来成为“列鼎而食”的礼器。', 'The ding and li were first cooking pots for meat stews, later ritual symbols of rank.'], { wiki: ['鼎', 'Ding (vessel)'], tier: 2 });

era('wzhou');
P('周公', [112.45, 34.62], { en: 'Duke of Zhou', role: 'scholar', year: -1040, prop: 'scroll',
  desc: ['辅佐成王，营建东都洛邑，制礼作乐，奠定周代礼乐制度。', 'Regent for King Cheng; built Luoyi and set down the rites and music of Zhou.'], wiki: ['周公旦', 'Duke of Zhou'] });
C('bell', ['礼乐编钟', 'Ritual bells'], [110.4, 33.4], { kind: 'bell' },
  ['周代以礼乐治国，编钟、编磬奏雅乐，按等级列鼎。', 'Zhou ruled by rites and music: chime bells and stones played court music, vessels marked rank.'], { wiki: ['礼乐', 'Rites and music'] });
C('jingtian', ['井田制', 'Well-field system'], [107.9, 34.4], hero(C1 + 'lf_jingtian', 'hut'),
  ['土地划成“井”字九块，八家各耕私田、共耕中间公田。', 'Land cut into nine squares like the character 井: eight families farmed their own and shared the middle field.'], { wiki: ['井田制', 'Well-field system'] });
B('beacon', ['烽火台', 'Beacon tower'], [109.2, 35.6], { kind: 'beacon' },
  ['骊山烽火传警；周幽王“烽火戏诸侯”导致西周灭亡。', 'Beacons on Mount Li sent alarms; King You\'s false alarms led to the fall of Western Zhou.'], { wiki: ['烽火戏诸侯', 'King You of Zhou'], tier: 2 });
F('bazhen', ['列鼎而食', 'Zhou ritual banquet'], [111.6, 35.9], hero(FD + 'lf_bazhen', 'ding'),
  ['周代贵族按等级列鼎而食，天子九鼎八簋，“八珍”有炮豚、淳熬等。', 'Zhou nobles ate by rank — nine ding and eight gui for the king; the Eight Delicacies included roast suckling pig.'], { wiki: ['列鼎', 'Ding (vessel)'] });

era('chunqiu');
P('老子', [110.9, 34.6], { en: 'Laozi', desc: ['道家创始人，著《道德经》，传说骑青牛西出函谷关。', 'Founder of Daoism and author of the Tao Te Ching; legend has him ride an ox west through Hangu Pass.'] });
LIFE_LIST[LIFE_LIST.length - 1].model = hero(C1 + 'lf_laozi', 'person', { role: 'scholar', year: -500 });
P('孔子', [117.0, 35.6], { desc: ['儒家创始人，兴办私学，有弟子三千。', 'Founder of Confucianism, who opened private schooling to some 3,000 students.'], wiki: ['孔子', 'Confucius'], en: 'Confucius' });
LIFE_LIST[LIFE_LIST.length - 1].model = hero('people-a/pp_confucius', 'person', { role: 'scholar', year: -500 });
P('孙武', [120.6, 31.3], { en: 'Sun Tzu', role: 'general', year: -510, prop: 'book',
  desc: ['春秋末吴国将领，著《孙子兵法》，被尊为“兵圣”。', 'General of Wu who wrote The Art of War, honoured as the Sage of War.'], wiki: ['孙武', 'Sun Tzu'] });
C('goujian', ['越王勾践剑', 'Sword of Goujian'], [120.58, 29.6], hero(C1 + 'lf_sword', 'warrior'),
  ['越王勾践的青铜剑，两千多年仍锋利无锈，剑身满饰菱形暗纹。', 'King Goujian\'s bronze sword, still sharp and untarnished after 2,500 years, covered in diamond patterns.'], { wiki: ['越王勾践剑', 'Sword of Goujian'] });
C('touhu', ['投壶', 'Pitch-pot'], [118.35, 36.85], hero(C1 + 'lf_touhu', 'bell'),
  ['宴饮时把箭投入壶中的礼仪游戏，源自射礼。', 'A banquet game of tossing arrows into a pot, a gentler form of the archery rite.'], { wiki: ['投壶', 'Touhu'] });
C('archery', ['射礼', 'Archery rite'], [114.0, 33.2], hero(C1 + 'lf_archery', 'bell'),
  ['“六艺”之一，以射箭观德行，宾主揖让而升。', 'One of the Six Arts: archery judged a gentleman\'s virtue, with bows and courtesies.'], { wiki: ['射礼', 'Archery rite'], tier: 2 });
F('salt', ['煮海为盐', 'Sea salt of Qi'], [119.6, 37.2], hero(FD + 'lf_salt', 'boat'),
  ['管仲“官山海”，齐国煮海水制盐、捕鱼，富甲天下。', 'Guan Zhong put salt and iron under the state; Qi boiled sea water for salt and grew rich.'], { wiki: ['管仲', 'Guan Zhong'] });
B('qiwall', ['齐长城', 'Great Wall of Qi'], [117.4, 36.3], { kind: 'wall' },
  ['春秋战国时齐国修筑，是中国现存最早的长城。', 'Built by Qi in the Spring and Autumn period — the oldest surviving great wall in China.'], { wiki: ['齐长城', 'Great Wall of Qi'], tier: 2 });

era('zhanguo');
P('屈原', [113.1, 28.8], { desc: ['楚国诗人，作《离骚》，投汨罗江而死，端午节由此纪念。', 'Poet of Chu who wrote Li Sao and drowned himself in the Miluo; the Dragon Boat Festival remembers him.'] });
B('dujiangyan', ['都江堰', 'Dujiangyan'], [103.6, 31.0], { kind: 'weir' },
  ['李冰父子修建的无坝引水工程，鱼嘴分水、宝瓶口引水，至今仍在使用。', 'Li Bing\'s dam-free irrigation: the Fish Mouth splits the Min River, still watering Chengdu today.'], { wiki: ['都江堰', 'Dujiangyan'] });
C('dragonboat', ['端午赛龙舟', 'Dragon boat racing'], [112.2, 30.3], hero('festivals/fs_dragonboat', 'boat'),
  ['五月初五赛龙舟、吃粽子、挂艾草，纪念屈原。', 'On the 5th day of the 5th month people race dragon boats, eat zongzi and hang mugwort for Qu Yuan.'], { wiki: ['端午节', 'Dragon Boat Festival'] });
F('zongzi', ['粽子', 'Zongzi'], [114.3, 30.6], hero(FD + 'lf_zongzi', 'ding'),
  ['竹叶包裹糯米蒸煮，传说投江喂鱼以护屈原。', 'Sticky rice wrapped in bamboo leaves — legend says thrown into the river to protect Qu Yuan.'], { wiki: ['粽子', 'Zongzi'], tier: 2 });
C('hufu', ['胡服骑射', 'Hu dress and mounted archery'], [114.5, 36.6], hero(C1 + 'lf_hufu', 'rider'),
  ['赵武灵王改穿短衣长裤、学习骑射，赵国由此强盛。', 'King Wuling of Zhao put his army in nomad trousers on horseback archery, making Zhao strong.'], { wiki: ['胡服骑射', 'King Wuling of Zhao'] });
P('孟子', [116.98, 35.4], { prop: 'book', tier: 2, desc: ['儒家“亚圣”，主张仁政与“民为贵”。', 'Confucianism\'s Second Sage, who preached benevolent rule: "the people matter most".'] });

era('qin');
B('taishan-qin', ['泰山', 'Mount Tai'], [117.1, 36.25], hero('china/cn_taishan', 'temple'),
  ['秦始皇东巡登泰山封禅，刻石颂秦德，开历代帝王泰山封禅之先。', 'The First Emperor climbed Mount Tai to perform the feng and shan rites, the first of the imperial sacrifices to Heaven there.'], { wiki: ['封禅', 'Feng Shan'] });
P('李斯', [108.2, 33.8], { prop: 'brush', desc: ['秦朝丞相，推行小篆“书同文”，统一文字。', 'Qin chancellor who standardised writing in small seal script.'] });
C('banliang', ['统一度量衡与半两钱', 'Standard measures and coins'], [110.6, 35.2], hero(C1 + 'lf_coins', 'scroll', { style: 'banliang' }),
  ['秦始皇统一货币为圆形方孔“半两”钱，统一度量衡与车轨。', 'The First Emperor made the round, square-holed banliang the only coin and unified weights, measures and axles.'], { wiki: ['半两钱', 'Ban Liang'] });
B('lingqu', ['灵渠', 'Lingqu Canal'], [110.6, 25.6], hero(A1 + 'lf_lingqu', 'weir'),
  ['秦朝为进军岭南开凿的运河，沟通湘江与漓江，铧嘴分水。', 'Canal dug to supply the conquest of Lingnan, joining the Xiang and Li rivers.'], { wiki: ['灵渠', 'Lingqu'] });
F('mill', ['石转磨与面食', 'Rotary mill'], [108.0, 35.6], hero(FD + 'lf_mill', 'hut'),
  ['战国秦汉推广石转磨，小麦磨成面粉，面食由此兴起。', 'Rotary stone mills spread in the Qin and Han, turning wheat into flour for buns and noodles.'], { wiki: ['磨', 'Quern-stone'] });
P('蒙恬', [109.7, 38.3], { prop: 'sword', tier: 2, desc: ['秦大将，北击匈奴，修筑长城与直道。', 'Qin general who drove back the Xiongnu and built the Great Wall and the Straight Road.'] });

era('whan');
B('taishan-whan', ['泰山', 'Mount Tai'], [117.1, 36.25], hero('china/cn_taishan', 'temple'),
  ['汉武帝八次东巡泰山，封禅告成功，泰山成为“五岳独尊”。', 'Emperor Wu came to Mount Tai eight times to report his achievements to Heaven, making it the foremost of the Five Peaks.'], { wiki: ['封禅', 'Feng Shan'] });
P('张骞', [103.8, 36.06], { prop: 'staff', desc: ['两次出使西域，“凿空”丝绸之路。', 'Envoy who twice crossed to the Western Regions, opening the Silk Road.'] });
P('司马迁', [110.4, 35.47], { prop: 'brush', desc: ['著《史记》，中国第一部纪传体通史。', 'Author of the Records of the Grand Historian, China\'s first comprehensive history.'] });
B('que', ['汉阙', 'Han que towers'], [107.6, 33.6], hero(A1 + 'lf_que', 'gate'),
  ['宫殿、陵墓前成对的阙楼，是汉代建筑的标志。', 'Paired gate towers before Han palaces and tombs — the signature of Han architecture.'], { wiki: ['阙', 'Que (tower)'] });
C('cuju', ['蹴鞠', 'Cuju football'], [118.3, 36.8], hero(C1 + 'lf_cuju', 'bell'),
  ['起源于齐国临淄的古代足球，汉代用于军中练兵。', 'Ancient football from Linzi in Qi, played to train Han soldiers.'], { wiki: ['蹴鞠', 'Cuju'] });
F('tofu', ['豆腐', 'Tofu'], [116.8, 32.6], hero(FD + 'lf_tofu', 'ding'),
  ['传说淮南王刘安炼丹时发明豆腐。', 'Legend says Liu An, Prince of Huainan, invented tofu while making elixirs.'], { wiki: ['豆腐', 'Tofu'] });
B('mawangdui', ['马王堆汉墓', 'Mawangdui tombs'], [113.0, 28.2], hero('archaeology/ar_mawangdui', 'monument'),
  ['长沙国丞相家族墓，出土素纱襌衣、帛画与保存完好的女尸。', 'Tombs of a Changsha chancellor\'s family: a gauze robe, silk paintings and a preserved lady.'], { wiki: ['马王堆汉墓', 'Mawangdui'], tier: 2 });

era('xin');
P('王莽', [108.0, 34.0], {});
C('xinmoney', ['王莽钱币', 'Wang Mang\'s coins'], [110.8, 34.6], hero(C1 + 'lf_coins', 'scroll', { style: 'knife' }),
  ['王莽多次改币，铸造金错刀、货泉、布币，铸工精美却扰乱经济。', 'Wang Mang reissued money again and again — gold-inlaid knife coins, spade and huoquan coins — beautiful but ruinous.'], { wiki: ['王莽钱币', 'Wang Mang'] });
B('mingtang', ['明堂辟雍', 'Mingtang and Biyong'], [109.6, 33.2], hero(A1 + 'lf_mingtang', 'palace'),
  ['王莽在长安南郊建明堂、辟雍，上圆下方，象征天地。', 'Wang Mang built the Hall of Light ringed by water south of Chang\'an — round above, square below, like heaven and earth.'], { wiki: ['明堂', 'Mingtang'] });
C('lulin', ['绿林赤眉起义', 'Lülin and Red Eyebrows'], [112.6, 31.0], { kind: 'flag', color: '#16a34a' },
  ['王莽改制失败，饥民在绿林山与赤眉军中起义，新朝灭亡。', 'When Wang Mang\'s reforms failed, starving peasants rose as the Lülin and Red Eyebrows and ended Xin.'], { wiki: ['绿林军', 'Lülin'], tier: 2 });

era('ehan');
P('张仲景', [112.53, 32.99], { prop: 'herbs', year: 180, en: 'Zhang Zhongjing',
  desc: ['“医圣”，著《伤寒杂病论》，相传冬至做“娇耳”为百姓治冻耳。', 'The Sage of Medicine who wrote the Treatise on Cold Damage; he is said to have made "tender ears" dumplings for frostbite.'] });
P('蔡伦', [107.4, 33.3], { desc: ['改进造纸术，用树皮、麻头、破布、渔网造出“蔡侯纸”。', 'Improved papermaking with bark, hemp, rags and fishnets.'], en: 'Cai Lun' });
LIFE_LIST[LIFE_LIST.length - 1].model = hero('people-a/pp_cailun', 'person', { role: 'scholar', year: 100 });
P('华佗', [115.8, 33.85], { desc: ['神医，发明麻沸散施行外科手术，创五禽戏。', 'Physician who used mafeisan anaesthesia for surgery and created the Five Animals exercises.'], en: 'Hua Tuo' });
LIFE_LIST[LIFE_LIST.length - 1].model = hero('people-c/pp_huatuo', 'person', { role: 'scholar', year: 200 });
B('baimasi', ['白马寺', 'White Horse Temple'], [113.6, 35.4], { kind: 'temple' },
  ['佛教传入中国后的第一座官办寺院，以白马驮经得名。', 'The first Buddhist temple in China, named after the white horse that carried the sutras.'], { wiki: ['白马寺', 'White Horse Temple'] });
F('jiaozi', ['饺子', 'Jiaozi dumplings'], [113.8, 32.0], hero(FD + 'lf_jiaozi', 'ding'),
  ['相传张仲景以面皮包羊肉驱寒药材，即“娇耳”，后成为饺子。', 'Zhang Zhongjing\'s "tender ears" — mutton and warming herbs in dough — became jiaozi.'], { wiki: ['饺子', 'Jiaozi'] });
C('baixi', ['百戏', 'Han acrobatics'], [111.0, 35.8], hero(C1 + 'lf_acrobats', 'bell'),
  ['汉代盛行走索、跳丸、寻橦、角抵等杂技表演，统称“百戏”。', 'Tightrope walking, juggling, pole balancing and wrestling — the Han "hundred entertainments".'], { wiki: ['百戏', 'Baixi'], tier: 2 });

era('sanguo');
P('诸葛亮', [104.07, 30.66], { prop: 'fan', desc: ['蜀汉丞相，羽扇纶巾，鞠躬尽瘁，死而后已。', 'Chancellor of Shu Han with his feather fan — devoted to the last.'] });
P('关羽', [112.2, 30.35], { prop: 'guandao', desc: ['蜀汉名将，忠义勇武，后世尊为“武圣”。', 'Shu general famed for loyalty and valour, later worshipped as the God of War.'] });
P('曹操', [114.4, 36.3], {});
B('tongque', ['铜雀台', 'Bronze Sparrow Terrace'], [115.6, 35.4], hero(A1 + 'lf_tongque', 'palace'),
  ['曹操在邺城筑三台，铜雀台高十丈，楼顶立铜雀。', 'Cao Cao\'s terrace at Ye, ten zhang high and crowned with a bronze sparrow.'], { wiki: ['铜雀台', 'Bronze Sparrow Terrace'] });
C('muniu', ['木牛流马', 'Wooden ox'], [106.0, 32.6], hero(C2 + 'lf_muniu', 'chariot'),
  ['诸葛亮北伐时发明的运粮器械，行于秦岭栈道。', 'Zhuge Liang\'s wheeled transport carrying grain along the Qinling plank roads.'], { wiki: ['木牛流马', 'Wooden ox'] });
F('mantou', ['馒头', 'Mantou buns'], [102.3, 26.6], hero(FD + 'lf_mantou', 'ding'),
  ['相传诸葛亮南征渡泸水时以面裹肉代替人头祭祀，称“蛮头”。', 'Legend: crossing the Lu River, Zhuge Liang offered meat in dough instead of heads — "mantou".'], { wiki: ['馒头', 'Mantou'], tier: 2 });

era('wjin');
C('qixian', ['竹林七贤', 'Seven Sages of the Bamboo Grove'], [113.4, 35.26], hero(C2 + 'lf_qixian', 'scroll'),
  ['嵇康、阮籍等七人常聚于竹林，饮酒弹琴、清谈玄理。', 'Ji Kang, Ruan Ji and five friends met in a bamboo grove to drink, play the qin and talk philosophy.'], { wiki: ['竹林七贤', 'Seven Sages of the Bamboo Grove'] });
P('陈寿', [106.1, 30.8], { prop: 'brush', year: 280, en: 'Chen Shou',
  desc: ['西晋史学家，著《三国志》。', 'Western Jin historian who wrote the Records of the Three Kingdoms.'] });
B('jingu', ['金谷园', 'Golden Valley Garden'], [111.6, 35.0], hero(A2 + 'lf_pavilion', 'temple', { style: 'jingu' }),
  ['富豪石崇在洛阳的别墅园林，斗富奢华，西晋风气的缩影。', 'Shi Chong\'s lavish villa garden at Luoyang, emblem of Western Jin luxury.'], { wiki: ['金谷园', 'Jingu Garden'] });
F('tangbing', ['汤饼', 'Noodle soup'], [114.6, 34.2], hero(FD + 'lf_noodles', 'ding'),
  ['束皙《饼赋》记载的汤饼即面片汤，是面条的前身。', 'The "soup cakes" praised in Shu Xi\'s Rhapsody on Bread — forerunner of noodles.'], { wiki: ['汤饼', 'Chinese noodles'] });
P('左思', [112.0, 33.8], { prop: 'scroll', year: 290, en: 'Zuo Si', tier: 2,
  desc: ['作《三都赋》，豪贵之家竞相传写，“洛阳纸贵”。', 'His Rhapsody on the Three Capitals was copied so much that "paper grew dear in Luoyang".'] });

era('ejin');
P('王羲之', [120.58, 30.0], { desc: ['“书圣”，《兰亭集序》被誉为“天下第一行书”。', 'The Sage of Calligraphy; his Lanting Preface is the finest running script.'] });
C('lanting', ['兰亭曲水流觞', 'Orchid Pavilion gathering'], [119.4, 29.0], hero(C2 + 'lf_lanting', 'scroll'),
  ['上巳节文人临溪而坐，酒杯顺流而下，停在谁前谁就饮酒赋诗。', 'At the spring purification festival scholars floated wine cups down a stream; whoever a cup stopped by drank and wrote a poem.'], { wiki: ['兰亭集序', 'Lantingji Xu'] });
P('陶渊明', [115.97, 29.7], { prop: 'cup', desc: ['田园诗人，“不为五斗米折腰”，“采菊东篱下”。', 'The poet of fields and gardens who would not "bow for five pecks of rice".'] });
B('mogao', ['莫高窟', 'Mogao Caves'], [94.8, 40.04], hero('china/cn_mogao', 'temple'),
  ['366年乐僔开凿第一窟，千年间凿成七百多窟，壁画与彩塑辉煌。', 'Begun in 366 by the monk Le Zun; over a thousand years 700 caves of murals and statues were cut.'], { wiki: ['莫高窟', 'Mogao Caves'] });
P('顾恺之', [118.0, 31.2], { prop: 'brush', year: 380, en: 'Gu Kaizhi', tier: 2,
  desc: ['画家，作《洛神赋图》《女史箴图》，主张“以形写神”。', 'Painter of Nymph of the Luo River, who held that form must convey spirit.'] });

era('nanbei');
B('yungang', ['云冈石窟', 'Yungang Grottoes'], [113.13, 40.11], hero(A1 + 'lf_grotto', 'temple', { style: 'yungang' }),
  ['北魏在平城开凿的石窟，第20窟露天大佛高近14米。', 'Northern Wei cave temples at Pingcheng; the open-air Buddha of Cave 20 is nearly 14 m tall.'], { wiki: ['云冈石窟', 'Yungang Grottoes'] });
P('祖冲之', [118.8, 31.4], { desc: ['把圆周率精确到小数点后七位，制《大明历》。', 'Worked out π to seven decimal places and wrote the Daming calendar.'], en: 'Zu Chongzhi' });
LIFE_LIST[LIFE_LIST.length - 1].model = hero('people-a/pp_zuchongzhi', 'person', { role: 'scholar', year: 470 });
P('花木兰', [115.6, 34.4], { en: 'Hua Mulan', role: 'general', year: 450, female: true, prop: 'sword',
  desc: ['北朝民歌《木兰辞》中替父从军的女英雄。', 'Heroine of the Ballad of Mulan who went to war in her father\'s place.'] });
B('songyue', ['嵩岳寺塔', 'Songyue Pagoda'], [113.0, 34.5], hero(A1 + 'lf_songyue', 'pagoda'),
  ['523年建成，十二边形密檐砖塔，是中国现存最古老的砖塔。', 'Built in 523: a twelve-sided brick pagoda, the oldest standing in China.'], { wiki: ['嵩岳寺塔', 'Songyue Pagoda'] });
B('xuankong', ['悬空寺', 'Hanging Temple'], [113.7, 39.66], hero('china/cn_hangingtemple', 'temple'),
  ['北魏始建于恒山峭壁之上，佛道儒三教合一。', 'Begun in the Northern Wei, clinging to a cliff of Mount Heng, shared by three faiths.'], { wiki: ['悬空寺', 'Hanging Temple'], tier: 2 });
F('sushi', ['寺院素斋', 'Temple vegetarian food'], [118.8, 32.06], hero(FD + 'lf_vegetarian', 'temple'),
  ['梁武帝崇佛，颁《断酒肉文》，僧人从此素食，“南朝四百八十寺”。', 'Emperor Wu of Liang banned meat and wine for monks — Chinese Buddhist vegetarian cooking began.'], { wiki: ['素食', 'Buddhist cuisine'] });
P('贾思勰', [118.5, 36.7], { prop: 'herbs', year: 540, en: 'Jia Sixie', tier: 2,
  desc: ['著《齐民要术》，中国现存最早最完整的农书。', 'Wrote Essential Techniques for the Welfare of the People, the oldest complete Chinese farming manual.'] });

// ---------------------------------------------------------------------------------------------- Sui Tang
era('sui');
B('zhaozhou', ['赵州桥', 'Zhaozhou Bridge'], [114.77, 37.7], hero(A1 + 'lf_zhaozhou', 'bridge'),
  ['李春设计的敞肩石拱桥，距今一千四百年，仍屹立不倒。', 'Li Chun\'s open-spandrel stone arch, standing for 1,400 years.'], { wiki: ['赵州桥', 'Anji Bridge'] });
C('keju', ['科举考试', 'Imperial examination'], [113.2, 33.6], hero(C2 + 'lf_keju', 'scroll'),
  ['隋炀帝设进士科，以考试选拔官员，延续一千三百年。', 'Emperor Yang created the jinshi exam: officials chosen by examination for 1,300 years.'], { wiki: ['科举', 'Imperial examination'] });
P('李春', [115.4, 38.6], { prop: 'book', year: 600, en: 'Li Chun', desc: ['隋代工匠，主持建造赵州桥。', 'Sui craftsman who built the Zhaozhou Bridge.'] });
P('隋炀帝', [119.4, 32.4], { tier: 2 });

era('tang');
B('taishan-tang', ['泰山', 'Mount Tai'], [117.1, 36.25], hero('china/cn_taishan', 'temple'),
  ['725年唐玄宗泰山封禅，御书《纪泰山铭》刻于岱顶石壁。', 'In 725 Emperor Xuanzong held the feng-shan rites and carved his Inscription on Mount Tai into the summit cliff.'], { wiki: ['封禅', 'Feng Shan'] });
P('武则天', [112.45, 34.62], { role: 'ruler', female: true, desc: ['中国历史上唯一的正统女皇帝，以洛阳为神都。', 'China\'s only reigning empress, who made Luoyang her Divine Capital.'] });
P('杜甫', [104.03, 30.66], { prop: 'brush', desc: ['“诗圣”，其诗被称为“诗史”，居成都草堂。', 'The Poet Sage whose verse is called "poetic history"; he lived in a thatched cottage in Chengdu.'] });
P('鉴真', [119.4, 32.4], { role: 'monk', year: 740, en: 'Jianzhen',
  desc: ['扬州高僧，六次东渡终抵日本，传播佛法与唐文化。', 'Yangzhou monk who reached Japan on his sixth try, bringing Buddhism and Tang culture.'] });
B('dayanta', ['大雁塔', 'Giant Wild Goose Pagoda'], [109.6, 35.3], hero(A1 + 'lf_dayan', 'pagoda'),
  ['玄奘为存放取回的佛经而建，方形楼阁式砖塔。', 'Built for the sutras Xuanzang brought back — a square, storeyed brick pagoda.'], { wiki: ['大雁塔', 'Giant Wild Goose Pagoda'] });
B('longmen', ['龙门石窟', 'Longmen Grottoes'], [112.47, 33.7], hero(A1 + 'lf_grotto', 'temple', { style: 'longmen' }),
  ['奉先寺卢舍那大佛高17米，相传依武则天容貌雕刻。', 'The 17 m Vairocana Buddha of Fengxian Temple, said to bear Wu Zetian\'s face.'], { wiki: ['龙门石窟', 'Longmen Grottoes'] });
B('foguang', ['佛光寺东大殿', 'Foguang Temple'], [113.58, 38.9], hero(A1 + 'lf_foguang', 'temple'),
  ['857年建，斗拱硕大、出檐深远，是现存最大的唐代木构建筑。', 'Built in 857 with huge brackets and deep eaves — the largest surviving Tang timber hall.'], { wiki: ['佛光寺', 'Foguang Temple'] });
C('polo', ['马球', 'Polo'], [107.8, 33.9], hero(C2 + 'lf_polo', 'rider'),
  ['唐代宫廷与军中盛行马球，长安宫中建有球场。', 'Polo was the passion of the Tang court and army; Chang\'an\'s palaces had polo fields.'], { wiki: ['马球', 'Polo'] });
C('tea', ['陆羽煎茶', 'Tea of Lu Yu'], [119.9, 30.9], hero(FD + 'lf_tea', 'ding', { style: 'tang' }),
  ['陆羽著《茶经》，饮茶之风遍及全国，茶圣之名由此而来。', 'Lu Yu wrote The Classic of Tea and tea drinking spread across the empire.'], { wiki: ['茶经', 'The Classic of Tea'] });
F('hubing', ['胡饼', 'Hu flatbread'], [103.8, 36.06], hero(FD + 'lf_hubing', 'ding'),
  ['从西域传入的芝麻烤饼，长安街头胡饼店随处可见。', 'Sesame flatbread from the Western Regions, baked in clay ovens all over Chang\'an.'], { wiki: ['胡饼', 'Hubing'], tier: 2 });
C('sancai', ['唐三彩', 'Sancai pottery'], [113.0, 34.75], hero(C2 + 'lf_sancai', 'camel'),
  ['以黄、绿、白为主的低温釉陶，骆驼载乐俑最为著名。', 'Low-fired amber, green and cream glazed pottery; the camel carrying musicians is the most famous.'], { wiki: ['唐三彩', 'Tang dynasty tomb figures'], tier: 2 });
C('lantern', ['上元灯会', 'Lantern Festival'], [108.1, 34.8], hero('festivals/fs_lantern', 'monument'),
  ['唐代正月十五长安取消宵禁，全城张灯观灯。', 'On the 15th of the first month Chang\'an lifted its curfew and the whole city came out for lanterns.'], { wiki: ['元宵节', 'Lantern Festival'], tier: 2 });

era('wudai');
P('李煜', [118.78, 32.04], { prop: 'brush', desc: ['南唐后主、词人，“问君能有几多愁”。', 'Last ruler of Southern Tang and great ci poet: "How much sorrow can one hold?"'] });
B('huqiu', ['虎丘塔', 'Tiger Hill Pagoda'], [120.58, 31.34], hero(A2 + 'lf_huqiu', 'pagoda'),
  ['959年建成的八角七层砖塔，因地基不均而倾斜，被称为“中国斜塔”。', 'Octagonal seven-storey brick pagoda of 959, leaning on its uneven footing — China\'s leaning tower.'], { wiki: ['云岩寺塔', 'Huqiu Tower'] });
C('yeyan', ['韩熙载夜宴', 'Night revels of Han Xizai'], [117.2, 31.0], hero(C2 + 'lf_yeyan', 'bell'),
  ['顾闳中画南唐大臣韩熙载家宴：听琵琶、观舞、清吹、宴散。', 'Gu Hongzhong painted the Southern Tang minister\'s party: pipa, dance, flutes and farewells.'], { wiki: ['韩熙载夜宴图', 'The Night Revels of Han Xizai'] });
C('print', ['雕版印刷九经', 'Printing the Classics'], [114.36, 34.8], { kind: 'printing' },
  ['后唐宰相冯道主持雕版刊印儒家九经，开官刻书籍之先。', 'Chancellor Feng Dao had the Nine Classics carved on woodblocks — the first official printed books.'], { wiki: ['雕版印刷', 'Woodblock printing'] });
P('赵匡胤', [114.6, 35.6], { tier: 2 });

// ---------------------------------------------------------------------------------------------- Song
era('bsong');
B('taishan-bsong', ['泰山', 'Mount Tai'], [117.1, 36.25], hero('china/cn_taishan', 'temple'),
  ['1008年宋真宗封禅泰山，扩建岱庙天贶殿，此后再无帝王封禅。', 'In 1008 Emperor Zhenzong held the last feng-shan rites and enlarged the Temple of Mount Tai (Dai Miao).'], { wiki: ['封禅', 'Feng Shan'] });
P('苏轼', [114.87, 30.45], { prop: 'brush', desc: ['文学家、书画家，贬黄州作《赤壁赋》，发明东坡肉。', 'Poet, painter and calligrapher; exiled to Huangzhou he wrote the Red Cliff odes.'] });
P('李清照', [117.0, 36.67], { desc: ['婉约派女词人，“寻寻觅觅，冷冷清清”。', 'Greatest woman poet of the Song: "Searching, seeking, cold and lonely."'] });
LIFE_LIST[LIFE_LIST.length - 1].model = { kind: 'person', role: 'woman', year: 1110, prop: 'brush', bare: true };
B('tieta', ['开封铁塔', 'Iron Pagoda'], [113.4, 35.4], hero(A2 + 'lf_tieta', 'pagoda'),
  ['1049年建，通体褐色琉璃砖，远看如铁铸。', 'Built in 1049 of rust-brown glazed bricks that look like iron.'], { wiki: ['开封铁塔', 'Iron Pagoda'] });
C('washe', ['瓦舍勾栏', 'Pleasure quarters'], [115.6, 34.0], hero(C2 + 'lf_washe', 'temple'),
  ['东京汴梁的瓦舍里说书、杂剧、傀儡戏昼夜不绝。', 'In Kaifeng\'s pleasure quarters storytellers, plays and puppets ran day and night.'], { wiki: ['瓦舍', 'Wazi'] });
F('dongpo', ['东坡肉', 'Dongpo pork'], [120.15, 30.25], hero(FD + 'lf_dongpo', 'ding'),
  ['苏轼在杭州治理西湖时创制的红烧肉。', 'Braised pork belly said to come from Su Shi\'s time in Hangzhou.'], { wiki: ['东坡肉', 'Dongpo pork'] });
C('jiaozi-note', ['交子', 'Jiaozi paper money'], [104.07, 30.67], hero(C1 + 'lf_coins', 'scroll', { style: 'jiaozi' }),
  ['北宋成都发行的交子是世界上最早的纸币。', 'Jiaozi notes issued in Chengdu were the world\'s first paper money.'], { wiki: ['交子', 'Jiaozi (currency)'] });
C('diancha', ['点茶斗茶', 'Whisked tea'], [118.3, 27.0], hero(FD + 'lf_tea', 'ding', { style: 'song' }),
  ['宋人用建盏点茶，比拼茶汤白沫，宋徽宗亦精于此道。', 'Song people whisked powdered tea in black Jian bowls and competed over the white froth.'], { wiki: ['点茶', 'Song dynasty tea culture'], tier: 2 });
C('midautumn', ['中秋赏月', 'Mid-Autumn'], [116.6, 33.0], hero('festivals/fs_midautumn', 'monument'),
  ['宋代中秋成为正式节日，赏月、吃月饼。', 'Mid-Autumn became a full festival in the Song: moon-viewing and mooncakes.'], { wiki: ['中秋节', 'Mid-Autumn Festival'], tier: 2 });
P('包拯', [117.27, 31.86], { tier: 2 });

era('nsong');
P('岳飞', [114.3, 32.2], { desc: ['抗金名将，“精忠报国”，冤死风波亭。', 'General against the Jin, "serve the country with utmost loyalty", wrongly executed.'] });
P('朱熹', [117.97, 27.7], { prop: 'book', year: 1170, en: 'Zhu Xi',
  desc: ['理学集大成者，著《四书章句集注》，复兴白鹿洞书院。', 'Master of Neo-Confucianism who annotated the Four Books and revived the White Deer Grotto Academy.'] });
B('academy', ['岳麓书院', 'Yuelu Academy'], [112.93, 28.18], hero(A2 + 'lf_academy', 'temple'),
  ['宋代四大书院之一，朱熹、张栻曾在此会讲。', 'One of the four great Song academies, where Zhu Xi and Zhang Shi debated.'], { wiki: ['岳麓书院', 'Yuelu Academy'] });
C('celadon', ['龙泉青瓷', 'Longquan celadon'], [119.13, 28.08], hero(C2 + 'lf_kiln', 'pagoda', { style: 'celadon' }),
  ['南宋龙泉窑青瓷如玉，依山而建的龙窑长数十米。', 'Jade-like celadon from Longquan, fired in hillside dragon kilns tens of metres long.'], { wiki: ['龙泉窑', 'Longquan celadon'] });
F('tangyuan', ['汤圆', 'Tangyuan'], [121.55, 29.87], hero(FD + 'lf_tangyuan', 'ding'),
  ['宋代元宵节吃“浮圆子”，象征团圆。', 'Floating rice balls eaten at the Lantern Festival since the Song, a sign of reunion.'], { wiki: ['汤圆', 'Tangyuan (food)'] });
P('陆游', [120.58, 30.0], { prop: 'brush', tier: 2 });
P('辛弃疾', [117.0, 36.4], { prop: 'sword', tier: 2 });

// ---------------------------------------------------------------------------------------------- Yuan Ming Qing
era('yuan');
P('关汉卿', [115.48, 38.87], { prop: 'scroll', year: 1260, en: 'Guan Hanqing',
  desc: ['元曲四大家之首，作《窦娥冤》。', 'Foremost of the Yuan dramatists, author of The Injustice to Dou E.'] });
C('zaju', ['元杂剧', 'Yuan zaju drama'], [111.5, 36.08], hero(C2 + 'lf_opera', 'temple', { style: 'yuan' }),
  ['元代杂剧兴盛，山西临汾牛王庙戏台是现存元代戏台。', 'Yuan zaju plays flourished; the Niuwang Temple stage in Linfen still stands.'], { wiki: ['元杂剧', 'Zaju'] });
B('guanxing', ['登封观星台', 'Dengfeng Observatory'], [113.14, 34.4], hero(A2 + 'lf_guanxing', 'monument'),
  ['郭守敬主持建造，以“量天尺”测日影，编成《授时历》。', 'Built under Guo Shoujing to measure the sun\'s shadow for the Shoushi calendar.'], { wiki: ['登封观星台', 'Gaocheng Astronomical Observatory'] });
P('郭守敬', [114.5, 37.1], { prop: 'book', year: 1280, en: 'Guo Shoujing', tier: 2,
  desc: ['天文学家、水利学家，制《授时历》，开通惠河。', 'Astronomer and engineer: the Shoushi calendar and the Tonghui canal in Dadu.'] });
C('spinning', ['黄道婆纺织', 'Huang Daopo\'s cotton'], [121.45, 31.15], hero(C2 + 'lf_spinning', 'hut'),
  ['黄道婆从海南黎族学来棉纺技术，改进三锭脚踏纺车。', 'Huang Daopo brought cotton skills from the Li people of Hainan and improved the treadle spinning wheel.'], { wiki: ['黄道婆', 'Huang Daopo'] });
B('baita', ['妙应寺白塔', 'White Dagoba'], [117.0, 41.2], hero(A2 + 'lf_baita', 'pagoda'),
  ['尼泊尔匠师阿尼哥设计的藏式白塔，是元大都的地标。', 'Tibetan-style white stupa by the Nepali master Araniko, the landmark of Dadu.'], { wiki: ['妙应寺', 'Miaoying Temple'] });
F('shuanrou', ['涮羊肉', 'Mutton hotpot'], [111.7, 40.8], hero(FD + 'lf_hotpot', 'ding', { style: 'mutton' }),
  ['蒙古人带来的吃法，铜锅炭火涮薄切羊肉。', 'A Mongol way of eating: thin-sliced mutton swished in a charcoal brass pot.'], { wiki: ['涮羊肉', 'Instant-boiled mutton'], tier: 2 });
C('naadam', ['那达慕', 'Naadam'], [116.18, 42.36], hero('festivals/fs_naadam', 'yurt'),
  ['蒙古族的赛马、摔跤、射箭盛会，上都草原年年举行。', 'The Mongol festival of horse racing, wrestling and archery on the grasslands of Shangdu.'], { wiki: ['那达慕', 'Naadam'], tier: 2 });

era('ming');
P('李时珍', [115.3, 30.4], { desc: ['医药学家，历时27年著《本草纲目》。', 'Physician who spent 27 years writing the Compendium of Materia Medica.'], en: 'Li Shizhen' });
LIFE_LIST[LIFE_LIST.length - 1].model = hero('people-a/pp_lishizhen', 'person', { role: 'scholar', year: 1560 });
P('戚继光', [121.4, 28.7], { prop: 'sword', desc: ['抗倭名将，创“鸳鸯阵”，著《纪效新书》。', 'General who beat the wokou pirates with the mandarin-duck formation.'] });
P('徐霞客', [110.3, 25.3], { prop: 'staff', desc: ['地理学家，游历三十年写成《徐霞客游记》。', 'Geographer who travelled 30 years and wrote his famous travel diaries.'] });
B('tulou', ['福建土楼', 'Fujian Tulou'], [117.0, 24.6], hero(A2 + 'lf_tulou', 'wall'),
  ['客家人聚族而居的圆形夯土楼，防御坚固。', 'Round rammed-earth fortresses where whole Hakka clans lived together.'], { wiki: ['福建土楼', 'Fujian tulou'] });
B('zhuozheng', ['拙政园', 'Humble Administrator\'s Garden'], [120.63, 31.32], hero(A2 + 'lf_pavilion', 'temple', { style: 'zhuozheng' }),
  ['明代苏州园林代表，亭台楼阁、假山池沼，移步换景。', 'Finest of the Ming gardens of Suzhou: halls, rockeries and ponds that change at every step.'], { wiki: ['拙政园', 'Humble Administrator\'s Garden'] });
C('qinghua', ['景德镇青花瓷', 'Blue-and-white porcelain'], [117.2, 29.27], hero(C2 + 'lf_kiln', 'pagoda', { style: 'qinghua' }),
  ['景德镇御窑烧造的青花瓷远销海外，“瓷都”闻名世界。', 'Blue-and-white from the imperial kilns of Jingdezhen, the Porcelain Capital, sold worldwide.'], { wiki: ['青花瓷', 'Blue and white pottery'] });
F('duck', ['北京烤鸭', 'Peking duck'], [117.6, 39.1], hero(FD + 'lf_duck', 'ding'),
  ['明代随迁都传入北京，便宜坊始于1416年。', 'Came north with the capital; the Bianyifang restaurant opened in 1416.'], { wiki: ['北京烤鸭', 'Peking duck'] });
C('kunqu', ['昆曲', 'Kunqu opera'], [121.2, 31.7], hero(C2 + 'lf_opera', 'temple', { style: 'kunqu' }),
  ['魏良辅改良的昆山腔，汤显祖《牡丹亭》盛演不衰，“百戏之祖”。', 'Wei Liangfu\'s refined Kunshan melodies; The Peony Pavilion made it the mother of Chinese operas.'], { wiki: ['昆曲', 'Kunqu'], tier: 2 });
C('lanternming', ['秦淮灯会', 'Qinhuai lanterns'], [118.79, 32.02], hero('festivals/fs_lantern', 'monument', { style: 'qinhuai' }),
  ['朱元璋定都南京，元宵张灯十日，秦淮灯彩由此兴盛。', 'Zhu Yuanzhang made the Lantern Festival ten days long in Nanjing; the Qinhuai lanterns date from then.'], { wiki: ['秦淮灯会', 'Qinhuai Lantern Fair'], tier: 2 });
P('王阳明', [106.7, 26.6], { prop: 'book', tier: 2 });

era('qing');
P('曹雪芹', [116.2, 40.0], { prop: 'brush', year: 1750, en: 'Cao Xueqin',
  desc: ['《红楼梦》作者，晚年居北京西山著书。', 'Author of Dream of the Red Chamber, written in the Western Hills of Beijing.'] });
P('林则徐', [113.67, 22.8], {});
B('yiheyuan', ['颐和园', 'Summer Palace'], [115.3, 39.3], hero(A2 + 'lf_yiheyuan', 'palace'),
  ['乾隆修建、慈禧重修的皇家园林，佛香阁俯瞰昆明湖。', 'Imperial garden built by Qianlong and rebuilt by Cixi; the Tower of Buddhist Incense overlooks Kunming Lake.'], { wiki: ['颐和园', 'Summer Palace'] });
C('jingju', ['京剧', 'Peking opera'], [117.2, 40.4], hero(C2 + 'lf_opera', 'temple', { style: 'jingju' }),
  ['1790年徽班进京，融合昆曲、汉调形成京剧，被誉为“国粹”。', 'Anhui troupes came to Beijing in 1790 and blended styles into Peking opera, the national art.'], { wiki: ['京剧', 'Peking opera'] });
F('feast', ['满汉全席', 'Manchu-Han Imperial Feast'], [117.94, 40.99], hero(FD + 'lf_feast', 'palace'),
  ['集满族与汉族菜肴之精华的宫廷大宴，菜品多达百余道。', 'Court banquet of over a hundred Manchu and Han dishes.'], { wiki: ['满汉全席', 'Manchu Han Imperial Feast'] });
B('pingyao', ['平遥日升昌票号', 'Rishengchang bank'], [112.17, 37.2], hero(A2 + 'lf_siheyuan', 'gate', { style: 'pingyao' }),
  ['晋商创办的中国第一家票号，“汇通天下”。', 'China\'s first draft bank, founded by Shanxi merchants: "remittances across the realm".'], { wiki: ['日升昌', 'Rishengchang'] });
C('springfest', ['春节', 'Spring Festival'], [113.26, 23.13], hero('festivals/fs_springfestival', 'monument'),
  ['贴春联、放爆竹、逛庙会、吃年夜饭，广州有迎春花市。', 'Couplets, firecrackers, temple fairs and the reunion dinner; Guangzhou holds its flower fair.'], { wiki: ['春节', 'Chinese New Year'], tier: 2 });
C('jingzhang', ['京张铁路', 'Beijing–Zhangjiakou Railway'], [115.95, 40.45], { kind: 'train' },
  ['詹天佑主持修建的第一条中国人自建铁路，1909年通车，青龙桥用“人”字形线路爬坡。', 'The first railway built by Chinese engineers (Zhan Tianyou, 1909), climbing Qinglongqiao on a switchback.'], { wiki: ['京张铁路', 'Imperial Peking–Kalgan Railway'], tier: 2 });

// ---------------------------------------------------------------------------------------------- modern
era('roc');
B('zhongshanling', ['中山陵', 'Sun Yat-sen Mausoleum'], [119.2, 32.8], hero(A2 + 'lf_zhongshanling', 'monument'),
  ['孙中山陵墓，蓝色琉璃瓦象征青天白日，392级台阶。', 'Sun Yat-sen\'s tomb, roofed in blue glazed tiles, up 392 steps on Purple Mountain.'], { wiki: ['中山陵', 'Sun Yat-sen Mausoleum'] });
B('bund', ['上海外滩', 'The Bund'], [121.49, 31.24], hero('china/cn_bund', 'skyline'),
  ['万国建筑博览群，近代上海金融中心。', 'The "museum of world architecture", Shanghai\'s financial heart.'], { wiki: ['外滩', 'The Bund'] });
B('honglou', ['北大红楼', 'Red Building of Peking University'], [116.4, 39.92], hero(A2 + 'lf_honglou', 'factory'),
  ['新文化运动与五四运动的发源地，1918年建成。', 'Cradle of the New Culture and May Fourth movements, built in 1918.'], { wiki: ['北京大学红楼', 'Red Building (Peking University)'] });
P('鲁迅', [120.58, 30.0], { prop: 'book', year: 1925, en: 'Lu Xun',
  desc: ['现代文学奠基人，作《狂人日记》《阿Q正传》。', 'Founder of modern Chinese literature: A Madman\'s Diary, The True Story of Ah Q.'] });
C('dasheng', ['大生纱厂', 'Dasheng cotton mill'], [120.86, 32.0], { kind: 'factory' },
  ['状元张謇“实业救国”，在南通创办纱厂，民族工业兴起。', 'Zhang Jian, a top-scoring scholar, built mills in Nantong to save the nation through industry.'], { wiki: ['大生纱厂', 'Zhang Jian'] });

era('prc');
P('袁隆平', [112.9, 28.2], { prop: 'herbs', year: 1975, en: 'Yuan Longping',
  desc: ['“杂交水稻之父”，让亿万人吃饱饭。', 'Father of hybrid rice, who helped feed hundreds of millions.'] });
F('hybridrice', ['杂交水稻', 'Hybrid rice'], [111.3, 27.3], hero(FD + 'lf_rice', 'hut', { style: 'modern' }),
  ['1973年籼型杂交水稻研制成功，单产大幅提高。', 'Indica hybrid rice succeeded in 1973, raising yields dramatically.'], { wiki: ['杂交水稻', 'Hybrid rice'] });
B('sanxia', ['三峡大坝', 'Three Gorges Dam'], [111.0, 30.82], { kind: 'dam' },
  ['世界最大水电站，2006年大坝建成。', 'The world\'s largest hydropower station; the dam was finished in 2006.'], { wiki: ['三峡大坝', 'Three Gorges Dam'] });
C('dongfanghong', ['东方红一号', 'Dong Fang Hong I'], [100.3, 40.96], { kind: 'rocket' },
  ['1970年长征一号从酒泉发射中国第一颗人造卫星。', 'In 1970 a Long March 1 from Jiuquan put China\'s first satellite in orbit.'], { wiki: ['东方红一号', 'Dong Fang Hong I'] });
B('pudong', ['浦东陆家嘴', 'Lujiazui'], [122.3, 31.0], { kind: 'skyline' },
  ['改革开放后崛起的金融城，东方明珠与上海中心大厦。', 'The finance district risen since reform: the Oriental Pearl and Shanghai Tower.'], { wiki: ['陆家嘴', 'Lujiazui'] });
B('niaochao', ['国家体育场“鸟巢”', 'Bird\'s Nest'], [116.39, 40.0], { kind: 'stadium' },
  ['2008年北京奥运会主体育场，钢结构如鸟巢交织。', 'Main stadium of the 2008 Beijing Olympics, a woven steel nest.'], { wiki: ['国家体育场', 'Beijing National Stadium'] });
F('hotpot', ['重庆火锅', 'Chongqing hotpot'], [106.55, 29.56], hero(FD + 'lf_hotpot', 'ding', { style: 'chongqing' }),
  ['麻辣红油九宫格火锅，从江边码头走向全国。', 'Fiery red-oil hotpot in a nine-grid pot, from the riverside docks to the whole country.'], { wiki: ['重庆火锅', 'Hot pot'], tier: 2 });
C('crh', ['高速铁路', 'High-speed rail'], [116.0, 36.0], { kind: 'train', style: 'crh' },
  ['2008年京津城际开通，中国建成世界最大的高铁网。', 'From the Beijing–Tianjin line in 2008, China built the world\'s largest high-speed network.'], { wiki: ['中国高速铁路', 'High-speed rail in China'], tier: 2 });

export const LIFE: readonly LifeItem[] = LIFE_LIST;
/** Life items of an era, headliners first. */
export const lifeOf = (eraId: string): LifeItem[] => LIFE_LIST.filter(l => l.era === eraId).sort((a, b) => a.tier - b.tier);
