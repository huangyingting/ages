import type { Era } from '../../shared/data/era.ts';
import type { PersonRole } from '../../shared/data/heroes.ts';
import type { FigureOpts } from './figure.ts';

type Look = Omit<FigureOpts, 'top'> & { top: string };

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
