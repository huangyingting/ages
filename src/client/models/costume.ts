import type { Era } from '../../shared/data/era.ts';
import type { PersonRole } from '../../shared/data/heroes.ts';
import type { FigureOpts } from './figure.ts';

export type Look = Omit<FigureOpts, 'top'> & { top: string };

const GOLD = '#d6b25e', INK = '#1c1917', STAR = '#e11d48';

/**
 * Period dress for the generic person figures: what a ruler, official/scholar, general, monk or woman of each era
 * wore (冕服, 圆领袍 with 幞头, 乌纱帽 and 补子, 马褂 and 辫子, 中山装 …).
 */
export function costume(role: PersonRole, era: Era): Look {
  switch (role) {
    case 'ruler': return RULER[era];
    case 'general': return GENERAL[era];
    case 'woman': return WOMAN[era];
    case 'monk': return { top: '#b45309', accent: '#7c2d12', outfit: 'robe', hairStyle: 'bald', wideSleeves: true };
    default: return SCHOLAR[era];
  }
}

/**
 * Historical portrait dress for a named figure (`person`), or the period/role default when unnamed.
 * Gives each figure in `PEOPLE` and `LIFE` period-authentic clothing, headwear, facial features, and build.
 */
export function personLook(role: PersonRole, era: Era, o: { person?: string; female?: boolean; eth?: string } = {}): Look {
  let look: Look = { ...costume(role, era) };
  if (o.eth === 'steppe') {
    look = {
      ...look, top: o.female ? '#b91c1c' : '#d6c8a8', bottom: '#27272a', accent: '#eab308',
      piling: '#991b1b', pattern: 'yuan', wideSleeves: false,
      hat: o.female ? 'khitan' : 'boli', hatColor: o.female ? '#eab308' : '#52341e',
    };
  }
  if (o.female && o.eth !== 'steppe') {
    const w = costume('woman', era);
    look = role === 'ruler' ? { ...w, top: '#d6a62a', accent: '#a8321f', hat: 'crown', hatColor: GOLD, cape: '#a8321f' }
      : role === 'general' ? { ...look, beard: 'none', hat: 'plume', hairStyle: 'bun' } : { ...w };
  } else if (o.female) {
    look = { ...look, beard: 'none', hairStyle: 'bun' };
  }
  const ov = o.person ? PERSON_LOOK[o.person] : undefined;
  return ov ? { ...look, ...ov } : look;
}

const RULER: Record<Era, Look> = {
  xianqin: { top: '#1e1b22', bottom: '#9e3822', accent: '#c84228', outfit: 'robe', pattern: 'mianfu', bixi: '#8c281c', wideSleeves: true, hat: 'mianguan', hatColor: INK, beard: 'long' },
  qinhan: { top: '#16151c', bottom: '#a82c1e', accent: '#b83020', outfit: 'robe', pattern: 'mianfu', bixi: '#991b1b', wideSleeves: true, hat: 'mianguan', hatColor: INK, beard: 'long' },
  weijin: { top: '#6e1e26', bottom: '#231c26', accent: '#d6a848', outfit: 'robe', pattern: 'weijin', wideSleeves: true, hat: 'tongtian', hatColor: INK, beard: 'long' },
  suitang: { top: '#c88a24', accent: '#7c2d12', outfit: 'roundrobe', pattern: 'tangrobe', badge: '#e8b948', badgeRound: true, hat: 'ruanjiao', hatColor: INK, beard: 'moustache', bottom: '#6b4a1e' },
  song: { top: '#a82820', accent: GOLD, outfit: 'roundrobe', pattern: 'songrobe', hat: 'zhanjiao', hatColor: INK, beard: 'goatee' },
  yuan: { top: '#e7dcc4', accent: GOLD, outfit: 'deel', pattern: 'yuan', badge: '#d8a638', hat: 'boli', hatColor: '#6b4a2e', hatBadge: '#f59e0b', beard: 'moustache', hairStyle: 'braid' },
  ming: { top: '#d49a1e', accent: '#8c2418', outfit: 'roundrobe', pattern: 'mingrobe', hat: 'yishan', hatColor: INK, beard: 'long', badge: '#ecc94b', badgeRound: true },
  qing: { top: '#e2ac18', accent: '#1e3a8a', outfit: 'changshan', pattern: 'qingdragon', piling: '#172554', chaozhu: true, hat: 'qingguan', hatColor: '#292018', hatBadge: '#ef4444', hairStyle: 'queue', beard: 'moustache' },
  minguo: { top: '#3f4a3a', accent: '#2f372b', outfit: 'zhongshan', pattern: 'zhongshan', bottom: '#3f4a3a', hairStyle: 'short', beard: 'moustache' },
  modern: { top: '#374151', accent: '#1f2937', outfit: 'zhongshan', pattern: 'zhongshan', bottom: '#374151', hairStyle: 'short' },
};

const SCHOLAR: Record<Era, Look> = {
  xianqin: { top: '#5b4636', bottom: '#3e3025', accent: '#1f1a17', outfit: 'robe', pattern: 'weijin', wideSleeves: true, hairStyle: 'topknot', hat: 'scholar', hatColor: INK, beard: 'long' },
  qinhan: { top: '#352b3b', bottom: '#8a2a20', accent: '#9e2a20', outfit: 'robe', pattern: 'mianfu', wideSleeves: true, hat: 'jinxian', hatColor: INK, beard: 'long' },
  weijin: { top: '#e2dccd', bottom: '#525b66', accent: '#3f4a5a', outfit: 'robe', pattern: 'weijin', wideSleeves: true, hairStyle: 'topknot', hat: 'scholar', hatColor: INK, beard: 'long' },
  suitang: { top: '#682d78', accent: '#d6a848', outfit: 'roundrobe', pattern: 'tangrobe', hat: 'ruanjiao', hatColor: INK, beard: 'goatee' },
  song: { top: '#2b5470', accent: '#1e293b', outfit: 'roundrobe', pattern: 'songrobe', hat: 'zhanjiao', hatColor: INK, beard: 'long' },
  yuan: { top: '#6b5335', accent: '#c99a3e', outfit: 'deel', pattern: 'yuan', hat: 'boli', hatColor: '#3b2a1f', beard: 'long' },
  ming: { top: '#9e2426', accent: '#1f1a17', outfit: 'roundrobe', pattern: 'mingrobe', hat: 'wusha', hatColor: INK, beard: 'long', badge: '#2b4c7e' },
  qing: { top: '#2f4b6c', jacket: '#171922', outfit: 'magua', pattern: 'qingmagua', badge: '#2563eb', chaozhu: true, feathers: true, hat: 'qingguan', hatColor: '#1c1917', hatBadge: '#3b82f6', hairStyle: 'queue', beard: 'moustache' },
  minguo: { top: '#4a5568', accent: '#2d3748', outfit: 'changshan', hairStyle: 'short', glasses: true },
  modern: { top: '#4b5563', outfit: 'zhongshan', pattern: 'zhongshan', bottom: '#4b5563', hairStyle: 'short' },
};

const GENERAL: Record<Era, Look> = {
  xianqin: { top: '#7a2318', outfit: 'tunic', bottom: '#3a3128', armor: '#8a6838', armorStyle: 'bronze', hat: 'helmet', hatColor: '#8a6838', beard: 'full', stance: 'wide' },
  qinhan: { top: '#6e261c', outfit: 'tunic', bottom: '#342c24', armor: '#3e322a', armorStyle: 'qinhan', hat: 'qinhan_helm', hatColor: '#3a2e26', beard: 'moustache', cape: '#7f1d1d', stance: 'wide' },
  weijin: { top: '#7a2318', outfit: 'tunic', bottom: '#3a3128', armor: '#646970', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#555a62', beard: 'full', cape: '#7f1d1d', stance: 'wide' },
  suitang: { top: '#8a261c', outfit: 'tunic', bottom: '#3a3128', armor: '#b08b36', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#9e7c2e', beard: 'full', cape: '#881b1b', stance: 'wide' },
  song: { top: '#7a2318', outfit: 'tunic', bottom: '#322b24', armor: '#525760', armorStyle: 'song', hat: 'plume', hatColor: '#454a52', beard: 'full', cape: '#7f1d1d', stance: 'wide' },
  yuan: { top: '#5c3824', outfit: 'deel', accent: '#c99a3e', armor: '#6b482c', armorStyle: 'yuan', hat: 'boli', hatColor: '#4a3524', hatBadge: '#dc2626', beard: 'moustache', hairStyle: 'braid', stance: 'wide' },
  ming: { top: '#8a1c1c', outfit: 'tunic', bottom: '#322b24', armor: '#9b2020', armorStyle: 'ming', discs: true, hat: 'doumou', hatColor: '#4b5056', beard: 'long', cape: '#5a1010', stance: 'wide' },
  qing: { top: '#1e3a8a', outfit: 'tunic', bottom: '#292524', armor: '#d4a628', armorStyle: 'brigandine', hat: 'doumou', hatColor: '#383b40', feathers: true, hairStyle: 'queue', beard: 'moustache', stance: 'wide' },
  minguo: { top: '#56604a', outfit: 'zhongshan', pattern: 'zhongshan', bottom: '#56604a', hat: 'peaked', hatColor: '#4f5944', hatBadge: '#f2c94c', stance: 'wide' },
  modern: { top: '#55663a', outfit: 'zhongshan', pattern: 'zhongshan', bottom: '#55663a', hat: 'peaked', hatColor: '#4f6034', hatBadge: STAR, stance: 'wide' },
};

const WOMAN: Record<Era, Look> = {
  xianqin: { top: '#2b242c', bottom: '#8c2822', accent: '#c84228', outfit: 'dress', pattern: 'mianfu', wideSleeves: true, hairStyle: 'bun' },
  qinhan: { top: '#8a2422', bottom: '#221c22', accent: '#d4a23e', outfit: 'dress', pattern: 'mianfu', wideSleeves: true, hairStyle: 'bun' },
  weijin: { top: '#d8c2d0', bottom: '#6b4266', accent: '#583556', outfit: 'dress', pattern: 'weijin', wideSleeves: true, hairStyle: 'highbun' },
  suitang: { top: '#c23a4a', bottom: '#e6cfa8', accent: '#e8c24a', outfit: 'dress', pattern: 'tangdress', pibo: '#60a5fa', wideSleeves: true, hairStyle: 'highbun', cape: '#e8b7c8' },
  song: { top: '#6d9082', bottom: '#ece5d5', accent: '#3b4d46', outfit: 'dress', pattern: 'songdress', hairStyle: 'bun' },
  yuan: { top: '#942828', bottom: '#6e1c1c', accent: GOLD, outfit: 'deel', pattern: 'yuan', hat: 'gugu', hatColor: '#7f1d1d' },
  ming: { top: '#c85a70', bottom: '#9e2428', accent: '#e8c24a', outfit: 'dress', pattern: 'mamian', wideSleeves: true, hairStyle: 'bun' },
  qing: { top: '#6a3478', bottom: '#4c2258', accent: '#e8c24a', outfit: 'changshan', pattern: 'qizhuang', hat: 'liangba', hatColor: INK, hairStyle: 'bun' },
  minguo: { top: '#2b5b84', bottom: '#1e3a5f', accent: '#e2c066', outfit: 'changshan', pattern: 'qizhuang', hairStyle: 'bob' },
  modern: { top: '#4a6a8a', outfit: 'zhongshan', pattern: 'zhongshan', bottom: '#3a4a5a', hairStyle: 'bob' },
};

/**
 * Per-person historical portrait overrides so characters do not share generic era clones.
 */
const PERSON_LOOK: Record<string, Partial<Look>> = {
  // ---- Pre-Qin (先秦) ----
  黄帝: { top: '#1c1917', bottom: '#b45309', accent: '#eab308', bixi: '#b45309', hat: 'mianguan', beard: 'long' },
  大禹: { top: '#786248', bottom: '#4a3c2c', accent: '#9a7b56', outfit: 'tunic', pattern: undefined, bixi: undefined, wideSleeves: false, sleeve: 0.45, skin: '#d49e7a', hat: 'douli', hatColor: '#b8945a', beard: 'full', stance: 'wide' },
  妇好: { top: '#8c1d1d', bottom: '#2b2420', accent: '#2dd4bf', armor: '#8a6838', armorStyle: 'bronze', hat: 'none', hairStyle: 'highbun', cape: '#991b1b' },
  周公: { top: '#1c2536', bottom: '#991b1b', accent: '#d6b25e', bixi: '#991b1b', hat: 'mianguan', beard: 'long' },
  孙武: { top: '#7f1d1d', bottom: '#292524', armor: '#7c5e34', armorStyle: 'bronze', hat: 'helmet', hatColor: '#7c5e34', cape: '#991b1b', beard: 'long' },
  孟子: { top: '#d6cbb5', bottom: '#4a3b2c', accent: '#7c2d12', hat: 'scholar', hatColor: '#292524', hair: '#4b5563', beardColor: '#6b7280', beard: 'long' },
  商鞅: { top: '#27171a', bottom: '#7f1d1d', accent: '#b91c1c', hat: 'jinxian', hatColor: '#1c1917', beard: 'goatee' },
  孙膑: { top: '#284b5a', bottom: '#1e293b', accent: '#d6b25e', outfit: 'robe', pattern: 'weijin', wideSleeves: true, armor: undefined, hat: 'fujin', hatColor: '#1e3a5f', beard: 'goatee', stance: 'relax' },
  白起: { top: '#1f1918', bottom: '#18181b', armor: '#272422', armorStyle: 'qinhan', hat: 'qinhan_helm', hatColor: '#1c1917', hatBadge: '#dc2626', cape: '#7f1d1d', beard: 'goatee' },
  李牧: { top: '#3b424c', bottom: '#27272a', armor: '#5a4634', armorStyle: 'bronze', piling: '#52341e', hat: 'qinhan_helm', hatColor: '#4a3728', hatBadge: '#eab308', cape: '#57534e', beard: 'full' },
  王翦: { top: '#292524', bottom: '#1c1917', armor: '#4a3b2c', armorStyle: 'qinhan', hat: 'qinhan_helm', hatColor: '#292524', cape: '#991b1b', hair: '#9ca3af', beardColor: '#d1d5db', beard: 'long' },

  // ---- Qin & Han (秦汉) ----
  李斯: { top: '#18181b', bottom: '#7f1d1d', accent: '#dc2626', hat: 'jinxian', hatColor: '#18181b', beard: 'goatee' },
  蒙恬: { top: '#991b1b', bottom: '#292524', armor: '#2e2622', armorStyle: 'qinhan', hat: 'qinhan_helm', hatColor: '#2e2622', cape: '#b91c1c', beard: 'full' },
  陈胜: { top: '#8c6d46', bottom: '#3f3428', accent: '#dc2626', outfit: 'tunic', sleeve: 0.55, armor: undefined, cape: undefined, hat: 'turban', hatColor: '#dc2626', beard: 'short', skin: '#d49e7a' },
  项羽: { w: 1.12, h: 0.65, top: '#18181b', bottom: '#18181b', armor: '#27272a', armorStyle: 'mingguang', discs: true, hat: 'pheasant', hatBadge: '#eab308', cape: '#991b1b', beard: 'full' },
  刘邦: { top: '#1c1917', bottom: '#991b1b', accent: '#dc2626', bixi: '#b91c1c', hat: 'mianguan', beard: 'full' },
  萧何: { top: '#2e1d28', bottom: '#7f1d1d', accent: '#d6b25e', hat: 'jinxian', beard: 'long' },
  韩信: { top: '#7f1d1d', bottom: '#1e293b', armor: '#475569', armorStyle: 'qinhan', hat: 'qinhan_helm', hatColor: '#334155', hatBadge: '#ef4444', cape: '#b91c1c', beard: 'moustache' },
  张良: { top: '#d6d3d1', bottom: '#1e293b', accent: '#334155', pattern: 'weijin', hat: 'guanjin', hatColor: '#1e293b', beard: 'goatee' },
  汉文帝: { top: '#1f2937', bottom: '#374151', accent: '#9ca3af', bixi: '#374151', hat: 'tongtian', hatColor: '#1f2937', beard: 'goatee' },
  汉武帝: { top: '#141418', bottom: '#b91c1c', accent: '#eab308', bixi: '#dc2626', hat: 'mianguan', beard: 'full' },
  张骞: { top: '#92400e', bottom: '#451a03', accent: '#d97706', piling: '#5c4028', hat: 'jinxian', hatColor: '#451a03', beard: 'full' },
  苏武: { top: '#786854', bottom: '#3f352a', accent: '#574838', outfit: 'deel', pattern: 'yuan', wideSleeves: false, piling: '#a89882', hat: 'boli', hatColor: '#574838', hair: '#e5e7eb', beardColor: '#f3f4f6', beard: 'long' },
  卫青: { top: '#7f1d1d', bottom: '#292524', armor: '#3a3028', armorStyle: 'qinhan', hat: 'qinhan_helm', cape: '#7f1d1d', beard: 'moustache' },
  霍去病: { top: '#b91c1c', bottom: '#1e293b', armor: '#64748b', armorStyle: 'qinhan', hat: 'plume', hatColor: '#475569', cape: '#dc2626', beard: 'none' },
  司马迁: { top: '#3f2e26', bottom: '#1c1917', accent: '#991b1b', hat: 'jinxian', hatColor: '#1c1917', beard: 'none' },
  王莽: { top: '#2e1065', bottom: '#7f1d1d', accent: '#eab308', bixi: '#7f1d1d', hat: 'mianguan', beard: 'long' },
  刘秀: { top: '#7f1d1d', bottom: '#1c1917', accent: '#eab308', bixi: '#b91c1c', hat: 'mianguan', beard: 'goatee' },
  班超: { top: '#7c2d12', bottom: '#292524', armor: '#524132', armorStyle: 'qinhan', hat: 'qinhan_helm', cape: '#991b1b', beard: 'full' },
  张仲景: { top: '#6b4c35', bottom: '#d6cbb5', accent: '#3f6212', hat: 'fujin', hatColor: '#57412d', beard: 'long' },

  // ---- Three Kingdoms, Jin & Northern and Southern Dynasties (魏晋南北朝) ----
  曹操: { top: '#450a0a', bottom: '#18181b', accent: '#eab308', hat: 'tongtian', hatColor: '#18181b', beard: 'long' },
  刘备: { top: '#991b1b', bottom: '#1f2937', accent: '#eab308', hat: 'tongtian', hatColor: '#1c1917', beard: 'goatee' },
  孙权: { top: '#1e3a5f', bottom: '#0f172a', accent: '#eab308', hat: 'tongtian', hatColor: '#1e293b', hair: '#4a2518', beardColor: '#8c381c', beard: 'full' },
  诸葛亮: { top: '#f1ede4', bottom: '#334155', accent: '#1e293b', outfit: 'robe', pattern: 'weijin', wideSleeves: true, hat: 'guanjin', hatColor: '#1e3a5f', beard: 'long' },
  关羽: { w: 1.08, h: 0.65, skin: '#b85442', top: '#166534', bottom: '#14532d', accent: '#eab308', armor: '#b8860b', armorStyle: 'mingguang', discs: true, hat: 'turban', hatColor: '#166534', cape: '#15803d', beard: 'long' },
  张飞: { w: 1.14, h: 0.64, skin: '#a86b56', top: '#18181b', bottom: '#27272a', armor: '#27272a', armorStyle: 'mingguang', discs: true, hat: 'turban', hatColor: '#18181b', cape: '#7f1d1d', hairStyle: 'wild', beard: 'full' },
  赵云: { top: '#f8fafc', bottom: '#e2e8f0', accent: '#38bdf8', armor: '#cbd5e1', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#cbd5e1', hatBadge: '#ef4444', cape: '#f1f5f9', beard: 'none' },
  吕布: { w: 1.1, h: 0.65, top: '#991b1b', bottom: '#1c1917', armor: '#d97706', armorStyle: 'mingguang', discs: true, hat: 'pheasant', hatBadge: '#ef4444', cape: '#dc2626', beard: 'none' },
  袁绍: { top: '#eab308', bottom: '#292524', armor: '#8a6838', armorStyle: 'qinhan', hat: 'tongtian', hatColor: '#292524', cape: '#ca8a04', beard: 'full' },
  周瑜: { top: '#991b1b', bottom: '#1e293b', accent: '#eab308', armor: '#94a3b8', armorStyle: 'mingguang', discs: false, hat: 'guanjin', hatColor: '#1e293b', cape: '#b91c1c', beard: 'none' },
  陆逊: { top: '#115e59', bottom: '#134e4a', accent: '#eab308', armor: '#64748b', armorStyle: 'mingguang', discs: false, hat: 'guanjin', hatColor: '#134e4a', cape: '#0f766e', beard: 'goatee' },
  姜维: { top: '#b91c1c', bottom: '#292524', armor: '#b48a3e', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#926c28', cape: '#7f1d1d', beard: 'goatee' },
  邓艾: { top: '#1e3a5f', bottom: '#1e293b', armor: '#475569', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#334155', cape: '#1e293b', beard: 'full' },
  司马懿: { top: '#2e2638', bottom: '#18181b', accent: '#94a3b8', hat: 'jinxian', hatColor: '#18181b', hair: '#6b7280', beardColor: '#9ca3af', beard: 'long' },
  陈寿: { top: '#785a3c', bottom: '#3b2f24', accent: '#d6b25e', hat: 'jinxian', hatColor: '#292524', beard: 'goatee' },
  左思: { top: '#52796f', bottom: '#2f3e46', accent: '#cad2c5', hat: 'scholar', hatColor: '#1e293b', beard: 'moustache' },
  裴秀: { top: '#2b4c7e', bottom: '#1e293b', accent: '#d6b25e', hat: 'jinxian', hatColor: '#1e293b', beard: 'goatee' },
  谢安: { top: '#e7e5e4', bottom: '#44403c', accent: '#57534e', hat: 'fujin', hatColor: '#44403c', beard: 'long' },
  陶渊明: { top: '#d6cfc2', bottom: '#6b6356', accent: '#847968', hat: 'fujin', hatColor: '#78716c', beard: 'long' },
  顾恺之: { top: '#dcc7aa', bottom: '#5c4738', accent: '#9a3412', hat: 'fujin', hatColor: '#5c4738', beard: 'goatee' },
  法显: { top: '#b45309', bottom: '#78350f', accent: '#92400e', hat: 'douli', hatColor: '#b8945a', hairStyle: 'bald' },
  桓温: { top: '#7c2d12', bottom: '#292524', armor: '#6b5b45', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#574838', cape: '#7f1d1d', beard: 'full' },
  苻坚: { top: '#7f1d1d', bottom: '#1c1917', accent: '#eab308', piling: '#451a03', hat: 'tongtian', beard: 'full' },
  谢玄: { top: '#1e3a8a', bottom: '#1e293b', armor: '#64748b', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#475569', cape: '#1d4ed8', beard: 'moustache' },
  刘裕: { top: '#881337', bottom: '#1f2937', accent: '#eab308', armor: '#785a32', armorStyle: 'mingguang', discs: true, hat: 'tongtian', beard: 'full' },
  花木兰: { top: '#b91c1c', bottom: '#292524', armor: '#71717a', armorStyle: 'mingguang', discs: true, cape: '#dc2626', hat: 'plume', hatColor: '#52525b', beard: 'none', hairStyle: 'bun' },
  北魏孝文帝: { top: '#991b1b', bottom: '#18181b', accent: '#eab308', bixi: '#dc2626', pattern: 'mianfu', wideSleeves: true, hat: 'mianguan', beard: 'none' },
  贾思勰: { top: '#4d6b45', bottom: '#2f3e2b', accent: '#a3b18a', hat: 'fujin', hatColor: '#3a4f36', beard: 'long' },
  郦道元: { top: '#2b5876', bottom: '#1e293b', accent: '#93c5fd', hat: 'jinxian', hatColor: '#1e293b', beard: 'goatee' },

  // ---- Sui, Tang & Five Dynasties (隋唐五代) ----
  杨坚: { top: '#ca8a04', bottom: '#422006', accent: '#7f1d1d', hat: 'ruanjiao', beard: 'long' },
  隋炀帝: { top: '#6b21a8', bottom: '#3b0764', accent: '#eab308', badge: '#facc15', badgeRound: true, hat: 'tongtian', beard: 'goatee' },
  李春: { top: '#785538', bottom: '#3f3125', accent: '#d6cbb5', outfit: 'tunic', sleeve: 0.65, hat: 'fujin', hatColor: '#4a3728', beard: 'short' },
  唐太宗: { top: '#d49a1e', bottom: '#6b4a1e', accent: '#7c2d12', badge: '#eab308', badgeRound: true, hat: 'ruanjiao', beard: 'full' },
  魏征: { top: '#4c1d95', accent: '#eab308', hat: 'ruanjiao', beard: 'long' },
  李靖: { top: '#7f1d1d', armor: '#ca8a04', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#a16207', cape: '#b91c1c', beard: 'long' },
  武则天: { top: '#b91c1c', bottom: '#d97706', accent: '#facc15', pibo: '#eab308', cape: '#7f1d1d', hat: 'crown', hatColor: '#eab308', hairStyle: 'highbun', beard: 'none' },
  狄仁杰: { top: '#581c87', accent: '#eab308', hat: 'ruanjiao', beard: 'long' },
  唐玄宗: { top: '#d97706', accent: '#991b1b', badge: '#facc15', badgeRound: true, hat: 'ruanjiao', beard: 'goatee' },
  鉴真: { top: '#9a3412', bottom: '#57534e', accent: '#d97706', hat: 'douli', hatColor: '#c29d64', hairStyle: 'bald', blind: true },
  王维: { top: '#5f7d6b', bottom: '#e7e5e4', accent: '#3f5a4a', hat: 'ruanjiao', beard: 'goatee' },
  杜甫: { top: '#64748b', bottom: '#334155', accent: '#475569', hat: 'fujin', hatColor: '#334155', beard: 'long' },
  郭子仪: { top: '#991b1b', armor: '#d4a017', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#b48a3e', cape: '#991b1b', hair: '#d1d5db', beardColor: '#f3f4f6', beard: 'long' },
  安禄山: { w: 1.32, top: '#7c2d12', bottom: '#292524', armor: '#785538', armorStyle: 'yuan', piling: '#52341e', hat: 'boli', hatColor: '#451a03', hatBadge: '#dc2626', hair: '#4a3222', beardColor: '#4a3222', beard: 'full' },
  颜真卿: { top: '#991b1b', accent: '#eab308', hat: 'ruanjiao', beard: 'long' },
  韩愈: { top: '#4a1d66', accent: '#d6b25e', hat: 'ruanjiao', beard: 'long' },
  白居易: { top: '#285e61', accent: '#1d4044', hat: 'ruanjiao', beard: 'goatee' },
  柳宗元: { top: '#334155', accent: '#1e293b', hat: 'ruanjiao', beard: 'goatee' },
  刘禹锡: { top: '#b45309', accent: '#78350f', hat: 'ruanjiao', beard: 'goatee' },
  黄巢: { top: '#ca8a04', armor: '#eab308', armorStyle: 'mingguang', discs: true, hat: 'plume', hatColor: '#eab308', cape: '#b91c1c', beard: 'full' },
  李存勖: { top: '#991b1b', armor: '#b48a3e', armorStyle: 'song', hat: 'ruanjiao', hatColor: '#1c1917', beard: 'moustache' },
  柴荣: { top: '#b47818', accent: '#7f1d1d', hat: 'zhanjiao', beard: 'goatee' },
  李煜: { top: '#d4af37', bottom: '#1e293b', accent: '#991b1b', hat: 'ruanjiao', beard: 'none' },

  // ---- Song, Liao, Western Xia & Jin (宋辽夏金) ----
  赵匡胤: { top: '#b91c1c', accent: '#eab308', hat: 'zhanjiao', beard: 'full' },
  寇准: { top: '#991b1b', accent: '#eab308', hat: 'zhanjiao', beard: 'long' },
  包拯: { skin: '#7c5640', crescent: true, top: '#1e1b4b', accent: '#eab308', hat: 'zhanjiao', hatColor: '#0f172a', beard: 'long' },
  范仲淹: { top: '#881337', accent: '#d6b25e', hat: 'zhanjiao', beard: 'long' },
  欧阳修: { top: '#3b6e78', accent: '#1e293b', hat: 'zhanjiao', beard: 'long' },
  王安石: { top: '#1e293b', accent: '#475569', hat: 'zhanjiao', beard: 'goatee' },
  司马光: { top: '#4a1d4a', accent: '#d6b25e', hat: 'zhanjiao', hair: '#6b7280', beardColor: '#9ca3af', beard: 'long' },
  苏轼: { top: '#3d6b66', bottom: '#e7e5e4', accent: '#1f2937', outfit: 'robe', pattern: 'weijin', wideSleeves: true, hat: 'dongpo', hatColor: '#1e293b', beard: 'goatee' },
  李清照: { top: '#84a59d', bottom: '#f5ebe0', accent: '#52796f', hairStyle: 'highbun', beard: 'none' },
  岳飞: { top: '#991b1b', armor: '#64748b', armorStyle: 'song', hat: 'plume', hatColor: '#475569', cape: '#b91c1c', beard: 'none' },
  韩世忠: { top: '#7f1d1d', armor: '#3f3f46', armorStyle: 'song', hat: 'plume', hatColor: '#27272a', cape: '#7f1d1d', beard: 'full' },
  陆游: { top: '#334155', bottom: '#cbd5e1', accent: '#1e293b', outfit: 'robe', pattern: 'weijin', wideSleeves: true, hat: 'dongpo', hatColor: '#1e293b', hair: '#d1d5db', beardColor: '#e5e7eb', beard: 'long' },
  辛弃疾: { top: '#5c1d24', bottom: '#1e293b', accent: '#d6b25e', hat: 'dongpo', hatColor: '#1c1917', beard: 'full' },
  朱熹: { top: '#e7e5e4', bottom: '#d6d3d1', accent: '#1c1917', outfit: 'robe', pattern: 'weijin', wideSleeves: true, hat: 'fangjin', hatColor: '#1c1917', beard: 'long' },
  文天祥: { top: '#991b1b', accent: '#eab308', hat: 'zhanjiao', beard: 'goatee' },
  耶律阿保机: { top: '#d6c8a8', bottom: '#27272a', accent: '#eab308', outfit: 'deel', pattern: 'yuan', piling: '#991b1b', hat: 'khitan', hatColor: '#ca8a04', beard: 'moustache', hairStyle: 'braid' },
  萧绰: { top: '#b91c1c', bottom: '#27272a', armor: '#b48a3e', armorStyle: 'yuan', hat: 'khitan', hatColor: '#eab308', cape: '#991b1b', beard: 'none', hairStyle: 'bun' },
  李元昊: { top: '#f5f5f4', bottom: '#292524', accent: '#eab308', outfit: 'deel', pattern: 'yuan', piling: '#b91c1c', hat: 'khitan', hatColor: '#f5f5f4', hatBadge: '#dc2626', beard: 'moustache' },
  野利仁荣: { top: '#78350f', bottom: '#292524', accent: '#eab308', outfit: 'deel', pattern: 'yuan', hat: 'khitan', hatColor: '#3f2e21', beard: 'long' },
  完颜阿骨打: { top: '#4a3525', bottom: '#1c1917', accent: '#eab308', outfit: 'deel', pattern: 'yuan', armor: '#5c4028', armorStyle: 'yuan', piling: '#7f1d1d', hat: 'boli', hatColor: '#3b2818', beard: 'full', hairStyle: 'braid' },
  元好问: { top: '#44403c', bottom: '#292524', accent: '#a8a29e', hat: 'dongpo', hatColor: '#1c1917', beard: 'long' },

  // ---- Yuan (元) ----
  成吉思汗: { top: '#f5f0e6', bottom: '#292524', accent: '#eab308', outfit: 'deel', pattern: 'yuan', armor: '#6b482c', armorStyle: 'yuan', piling: '#7f1d1d', hat: 'boli', hatColor: '#3b2818', hatBadge: '#eab308', beard: 'full', hairStyle: 'braid' },
  忽必烈: { w: 1.12, top: '#e7dcc4', bottom: '#292524', accent: '#eab308', outfit: 'deel', pattern: 'yuan', piling: '#991b1b', badge: '#eab308', hat: 'boli', hatColor: '#5c3a21', hatBadge: '#ef4444', beard: 'full', hairStyle: 'braid' },
  关汉卿: { top: '#2c5e6b', accent: '#c99a3e', outfit: 'deel', pattern: 'yuan', hat: 'boli', hatColor: '#3b2a1f', beard: 'goatee' },
  郭守敬: { top: '#1e3a5f', accent: '#eab308', outfit: 'deel', pattern: 'yuan', hat: 'boli', hatColor: '#292524', beard: 'long' },
  脱脱: { top: '#881337', accent: '#eab308', outfit: 'deel', pattern: 'yuan', badge: '#eab308', hat: 'boli', hatColor: '#451a03', hatBadge: '#eab308', beard: 'moustache', hairStyle: 'braid' },

  // ---- Ming (明) ----
  朱元璋: { top: '#d49a1e', accent: '#991b1b', badge: '#facc15', badgeRound: true, hat: 'yishan', hatColor: '#1c1917', beard: 'goatee' },
  徐达: { top: '#7f1d1d', armor: '#9b2020', armorStyle: 'ming', discs: true, hat: 'doumou', hatColor: '#52525b', cape: '#991b1b', beard: 'full' },
  朱棣: { top: '#d49a1e', armor: '#b48a3e', armorStyle: 'ming', discs: true, hat: 'yishan', hatColor: '#ca8a04', cape: '#991b1b', beard: 'long' },
  于谦: { top: '#b91c1c', accent: '#1e3a8a', badge: '#2563eb', hat: 'wusha', beard: 'long' },
  王阳明: { top: '#f1f5f9', bottom: '#1e293b', accent: '#1e3a8a', outfit: 'robe', pattern: 'weijin', badge: undefined, wideSleeves: true, hat: 'fangjin', hatColor: '#1e293b', beard: 'long' },
  戚继光: { top: '#991b1b', armor: '#3f3f46', armorStyle: 'ming', discs: true, hat: 'doumou', hatColor: '#27272a', cape: '#7f1d1d', beard: 'full' },
  张居正: { top: '#dc2626', accent: '#eab308', badge: '#eab308', hat: 'wusha', beard: 'long' },
  徐霞客: { top: '#2b4c6f', bottom: '#334155', accent: '#e2e8f0', badge: undefined, hat: 'douli', hatColor: '#b8945a', beard: 'goatee' },
  袁崇焕: { top: '#991b1b', armor: '#52525b', armorStyle: 'ming', discs: true, piling: '#451a03', hat: 'doumou', hatColor: '#3f3f46', cape: '#7f1d1d', beard: 'goatee' },
  李自成: { top: '#1e3a8a', armor: '#57534e', armorStyle: 'ming', hat: 'doumou', hatColor: '#3f3f46', cape: '#b91c1c', beard: 'moustache' },
  郑成功: { top: '#b91c1c', armor: '#94a3b8', armorStyle: 'ming', discs: true, hat: 'doumou', hatColor: '#64748b', cape: '#dc2626', hairStyle: 'bun', beard: 'none' },

  // ---- Qing (清) ----
  努尔哈赤: { top: '#ca8a04', armor: '#eab308', armorStyle: 'brigandine', piling: '#1e293b', hat: 'doumou', hatColor: '#27272a', feathers: true, hairStyle: 'queue', beard: 'full' },
  皇太极: { w: 1.08, top: '#d97706', accent: '#1e3a8a', piling: '#172554', chaozhu: true, hat: 'qingguan', hatColor: '#292018', hatBadge: '#ef4444', hairStyle: 'queue', beard: 'full' },
  康熙帝: { top: '#eab308', accent: '#1e3a8a', piling: '#172554', chaozhu: true, hat: 'qingguan', beard: 'goatee' },
  雍正帝: { top: '#eab308', jacket: '#172554', outfit: 'magua', pattern: 'qingmagua', badge: '#eab308', badgeRound: true, chaozhu: true, hat: 'qingguan', beard: 'moustache' },
  乾隆帝: { top: '#f59e0b', accent: '#1e3a8a', piling: '#1e1b4b', badge: '#eab308', badgeRound: true, chaozhu: true, hat: 'qingguan', beard: 'goatee' },
  曹雪芹: { top: '#3b5978', bottom: '#27384c', accent: '#1e293b', outfit: 'changshan', pattern: undefined, jacket: undefined, badge: undefined, chaozhu: false, feathers: false, hat: 'guapi', hatColor: '#1f2937', hairStyle: 'queue', beard: 'none' },
  林则徐: { top: '#1e3a5f', jacket: '#171922', outfit: 'magua', pattern: 'qingmagua', badge: '#dc2626', chaozhu: true, feathers: true, hat: 'qingguan', beard: 'long' },
  洪秀全: { top: '#eab308', bottom: '#b91c1c', accent: '#dc2626', outfit: 'roundrobe', pattern: 'mingrobe', piling: undefined, chaozhu: false, hat: 'taiping', hairStyle: 'long', beard: 'full' },
  曾国藩: { top: '#2b4560', jacket: '#18181b', outfit: 'magua', pattern: 'qingmagua', armor: undefined, badge: '#38bdf8', chaozhu: true, feathers: true, hat: 'qingguan', hairStyle: 'queue', beard: 'long', stance: 'relax' },
  左宗棠: { top: '#1e293b', jacket: '#eab308', outfit: 'magua', pattern: 'qingmagua', armor: undefined, badge: '#dc2626', chaozhu: true, feathers: true, hat: 'qingguan', hairStyle: 'queue', beard: 'full' },
  李鸿章: { top: '#312e81', jacket: '#eab308', outfit: 'magua', pattern: 'qingmagua', badge: '#38bdf8', chaozhu: true, feathers: true, hat: 'qingguan', hair: '#9ca3af', beardColor: '#e5e7eb', beard: 'long', hairStyle: 'queue' },

  // ---- Republic & PRC (民国 / 现代) ----
  孙中山: { top: '#4a5546', bottom: '#4a5546', outfit: 'zhongshan', pattern: 'zhongshan', hairStyle: 'short', beard: 'moustache' },
  鲁迅: { top: '#374151', bottom: '#1f2937', outfit: 'changshan', piling: '#7f1d1d', glasses: false, hairStyle: 'short', beard: 'moustache' },
  蒋介石: { top: '#56604a', bottom: '#56604a', outfit: 'zhongshan', pattern: 'zhongshan', cape: '#27272a', hat: 'peaked', hatColor: '#4f5944', hatBadge: '#3b82f6', hairStyle: 'bald', beard: 'moustache' },
  毛泽东: { top: '#64748b', bottom: '#64748b', outfit: 'zhongshan', pattern: 'zhongshan', hairStyle: 'short', beard: 'none' },
  邓小平: { h: 0.56, top: '#334155', bottom: '#334155', outfit: 'zhongshan', pattern: 'zhongshan', hairStyle: 'short', beard: 'none' },
  袁隆平: { top: '#94a3b8', bottom: '#334155', outfit: 'tunic', pattern: undefined, sleeve: 0.45, skin: '#d49e7a', hat: 'straw', hatColor: '#dfc17b', hairStyle: 'short', beard: 'none' },
};

