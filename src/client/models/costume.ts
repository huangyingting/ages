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
  xianqin: { top: '#1f1a24', accent: '#9b2c1f', outfit: 'robe', wideSleeves: true, hat: 'mianguan', hatColor: INK, beard: 'long' },
  qinhan: { top: '#16141a', accent: '#a8321f', outfit: 'robe', wideSleeves: true, hat: 'mianguan', hatColor: INK, beard: 'long' },
  weijin: { top: '#2a2230', accent: '#a8321f', outfit: 'robe', wideSleeves: true, hat: 'mianguan', hatColor: INK, beard: 'long' },
  suitang: { top: '#c08a2a', accent: '#7c2d12', outfit: 'roundrobe', hat: 'ruanjiao', hatColor: INK, beard: 'moustache', bottom: '#6b4a1e' },
  song: { top: '#a8321f', accent: GOLD, outfit: 'roundrobe', hat: 'zhanjiao', hatColor: INK, beard: 'goatee' },
  yuan: { top: '#e7dcc4', accent: GOLD, outfit: 'deel', hat: 'boli', hatColor: '#6b4a2e', beard: 'moustache', hairStyle: 'braid' },
  ming: { top: '#d9a321', accent: '#7c2d12', outfit: 'roundrobe', hat: 'yishan', hatColor: INK, beard: 'long', badge: '#e8c24a', badgeRound: true },
  qing: { top: '#e0b020', accent: '#1e3a8a', outfit: 'changshan', hat: 'qingguan', hatColor: '#3b2a1f', hatBadge: '#f2c94c', hairStyle: 'queue', beard: 'moustache' },
  minguo: { top: '#3f4a3a', outfit: 'zhongshan', bottom: '#3f4a3a', hairStyle: 'short', beard: 'moustache' },
  modern: { top: '#4b5563', outfit: 'zhongshan', bottom: '#4b5563', hairStyle: 'short' },
};

const SCHOLAR: Record<Era, Look> = {
  xianqin: { top: '#5b4636', accent: '#1f1a17', outfit: 'robe', wideSleeves: true, hairStyle: 'topknot', hat: 'scholar', hatColor: INK, beard: 'long' },
  qinhan: { top: '#3a2f3f', accent: '#8a2a20', outfit: 'robe', wideSleeves: true, hat: 'jinxian', hatColor: INK, beard: 'long' },
  weijin: { top: '#e2dccd', accent: '#4b5563', outfit: 'robe', wideSleeves: true, hairStyle: 'topknot', hat: 'scholar', hatColor: INK, beard: 'long' },
  suitang: { top: '#7b3f8a', accent: '#3b2a1f', outfit: 'roundrobe', hat: 'ruanjiao', hatColor: INK, beard: 'goatee' },
  song: { top: '#2f5d7c', accent: '#1f2937', outfit: 'roundrobe', hat: 'zhanjiao', hatColor: INK, beard: 'long' },
  yuan: { top: '#6b5a3a', accent: '#3b2a1f', outfit: 'roundrobe', hat: 'ruanjiao', hatColor: INK, beard: 'long' },
  ming: { top: '#a3262a', accent: '#1f1a17', outfit: 'roundrobe', hat: 'wusha', hatColor: INK, beard: 'long', badge: '#2f4f6f' },
  qing: { top: '#3b5574', jacket: '#1f1a17', outfit: 'magua', hat: 'qingguan', hatColor: '#1f1a17', hatBadge: '#2563eb', hairStyle: 'queue', beard: 'moustache' },
  minguo: { top: '#56606b', accent: '#3a424a', outfit: 'changshan', hairStyle: 'short', glasses: true },
  modern: { top: '#4b5563', outfit: 'zhongshan', bottom: '#4b5563', hairStyle: 'short' },
};

const GENERAL: Record<Era, Look> = {
  xianqin: { top: '#7a2318', outfit: 'tunic', bottom: '#3a3128', armor: '#8a6a3a', hat: 'helmet', hatColor: '#8a6a3a', beard: 'full', stance: 'wide' },
  qinhan: { top: '#6b2a20', outfit: 'tunic', bottom: '#3a3128', armor: '#4a3a2e', hairStyle: 'topknot', beard: 'moustache', cape: '#7f1d1d', stance: 'wide' },
  weijin: { top: '#7a2318', outfit: 'tunic', bottom: '#3a3128', armor: '#6b6f76', discs: true, hat: 'plume', hatColor: '#5b6068', beard: 'full', cape: '#7f1d1d', stance: 'wide' },
  suitang: { top: '#8a2a1e', outfit: 'tunic', bottom: '#3a3128', armor: '#a8883a', discs: true, hat: 'plume', hatColor: '#9a7a32', beard: 'full', cape: '#7f1d1d', stance: 'wide' },
  song: { top: '#7a2318', outfit: 'tunic', bottom: '#3a3128', armor: '#5b6068', hat: 'plume', hatColor: '#4b5056', beard: 'full', cape: '#7f1d1d', stance: 'wide' },
  yuan: { top: '#5a3a26', outfit: 'deel', accent: '#3a2a1c', armor: '#6b4a2e', hat: 'boli', hatColor: '#4a3524', beard: 'moustache', hairStyle: 'braid' },
  ming: { top: '#8a1c1c', outfit: 'tunic', bottom: '#3a3128', armor: '#9b1c1c', hat: 'doumou', hatColor: '#4b5056', beard: 'long', cape: '#5a1010', stance: 'wide' },
  qing: { top: '#b7791f', outfit: 'tunic', bottom: '#3a3128', armor: '#c9a227', hat: 'doumou', hatColor: '#3f4247', hairStyle: 'queue', beard: 'moustache', stance: 'wide' },
  minguo: { top: '#56604a', outfit: 'zhongshan', bottom: '#56604a', hat: 'peaked', hatColor: '#4f5944', hatBadge: '#f2c94c', stance: 'wide' },
  modern: { top: '#55663a', outfit: 'zhongshan', bottom: '#55663a', hat: 'peaked', hatColor: '#4f6034', hatBadge: STAR, stance: 'wide' },
};

const WOMAN: Record<Era, Look> = {
  xianqin: { top: '#7a2a2a', accent: '#1f1a17', outfit: 'dress', wideSleeves: true, hairStyle: 'bun' },
  qinhan: { top: '#8a2a2a', accent: '#1f1a17', outfit: 'dress', wideSleeves: true, hairStyle: 'bun' },
  weijin: { top: '#c8b0c0', accent: '#6b4a6a', outfit: 'dress', wideSleeves: true, hairStyle: 'highbun' },
  suitang: { top: '#c23a4a', accent: '#e8c24a', outfit: 'dress', wideSleeves: true, hairStyle: 'highbun', cape: '#e8b7c8' },
  song: { top: '#7f9e8e', accent: '#e8e2d4', outfit: 'dress', hairStyle: 'bun' },
  yuan: { top: '#8a2a2a', accent: GOLD, outfit: 'deel', hat: 'gugu', hatColor: '#7f1d1d' },
  ming: { top: '#a8456a', accent: '#e8c24a', outfit: 'dress', wideSleeves: true, hairStyle: 'bun' },
  qing: { top: '#6a3a7a', accent: '#e8c24a', outfit: 'changshan', hat: 'liangba', hatColor: INK, hairStyle: 'bun' },
  minguo: { top: '#2a5a8a', accent: '#1e3a5f', outfit: 'changshan', hairStyle: 'bob' },
  modern: { top: '#4a6a8a', outfit: 'zhongshan', bottom: '#3a4a5a', hairStyle: 'bob' },
};
