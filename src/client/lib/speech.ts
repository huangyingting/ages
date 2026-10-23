/** Optional narration via the Web Speech API (zh-CN / en). Resolves when the utterance ends (or right away if unsupported). */
import type { Lang } from '../../shared/data/types.ts';

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string, lang: Lang): Promise<void> {
  if (!canSpeak()) return Promise.resolve();
  return new Promise(done => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    const v = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    u.rate = lang === 'zh' ? 1.05 : 1;
    const t = setTimeout(done, 20000);
    u.onend = u.onerror = () => { clearTimeout(t); done(); };
    speechSynthesis.speak(u);
  });
}
