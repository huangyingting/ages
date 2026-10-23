/** Bilingual text. Every user-facing string in the content model carries both Chinese and English. */
export type Lang = 'zh' | 'en';
export const LANGS: Lang[] = ['zh', 'en'];
export interface I18n { zh: string; en: string }

export const tr = (s: I18n | undefined, l: Lang): string => (s ? s[l] || s.zh || s.en : '');
