import type { Formation, I18n, Troops, Year } from './types.ts';

/**
 * Costume periods: what people wore and how armies were equipped. Drives the 3D figures (hats, robes, armour,
 * weapons) so a Han official, a Tang general and a Qing soldier each look like their own time.
 */
export type Era = 'xianqin' | 'qinhan' | 'weijin' | 'suitang' | 'song' | 'yuan' | 'ming' | 'qing' | 'minguo' | 'modern';

export const ERAS: Era[] = ['xianqin', 'qinhan', 'weijin', 'suitang', 'song', 'yuan', 'ming', 'qing', 'minguo', 'modern'];

export function eraOf(y: Year): Era {
  if (y < -221) return 'xianqin';
  if (y < 220) return 'qinhan';
  if (y < 581) return 'weijin';
  if (y < 960) return 'suitang';
  if (y < 1271) return 'song';
  if (y < 1368) return 'yuan';
  if (y < 1644) return 'ming';
  if (y < 1912) return 'qing';
  if (y < 1949) return 'minguo';
  return 'modern';
}

/** War chariots led armies until cavalry took over (赵武灵王胡服骑射, 307 BCE). */
export const chariotAge = (y: Year): boolean => y < -307;
/** Rifles replace spears and bows from the Opium War on. */
export const gunAge = (y: Year): boolean => y >= 1840;
/** Crossbows (弩) were the signature missile weapon of Qin/Han and Song armies. */
export const crossbowAge = (e: Era): boolean => e === 'qinhan' || e === 'song';

export const FORMATION_NAME: Record<Formation, I18n> = {
  line: { zh: '横阵', en: 'line' },
  column: { zh: '长蛇阵', en: 'column' },
  wedge: { zh: '锋矢阵', en: 'wedge' },
  wings: { zh: '鹤翼阵', en: 'crane wings' },
  square: { zh: '方阵', en: 'square' },
  circle: { zh: '圆阵', en: 'circle' },
};

export const TROOP_NAME: Record<Troops, I18n> = {
  foot: { zh: '步兵', en: 'infantry' },
  horse: { zh: '骑兵', en: 'cavalry' },
  mixed: { zh: '步骑', en: 'combined arms' },
  archer: { zh: '弓弩手', en: 'archers' },
  chariot: { zh: '战车', en: 'chariots' },
  gun: { zh: '火枪兵', en: 'riflemen' },
};

/** The usual formation of a troop mix: cavalry strike in a wedge, combined arms spread their wings, infantry hold a line. */
export const defaultFormation = (t: Troops): Formation => (t === 'horse' ? 'wedge' : t === 'mixed' ? 'wings' : 'line');
