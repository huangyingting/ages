import { expect, type Page } from '@playwright/test';

export const SHOTS = 'docs/assets/screenshots';

export interface AppState {
  ready: boolean; year: number; lang: 'zh' | 'en'; event: string | null; era: string | null;
  story: 'idle' | 'playing' | 'paused'; snapshot: string | null; frames: number;
  pose: { lon: number; lat: number; dist: number }; fx: { story: number; event: number; base: number; works: number }; captions: string;
}

/** Collects page errors and console errors so every test can assert a clean run. */
export function watchErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/wikipedia|Failed to load resource/i.test(m.text())) errs.push(m.text()); });
  return errs;
}

/** Opens the app (low-fx mode for software GL) and waits until the scene has rendered. */
export async function openApp(page: Page, hash = '', query = 'lowfx=1'): Promise<void> {
  await page.goto(`/?${query}${hash ? '#' + hash : ''}`);
  await expect.poll(() => page.evaluate(() => !!(window as any).__atlas?.ready), { timeout: 120_000 }).toBe(true);
  await expect.poll(() => state(page).then(s => s.frames), { timeout: 60_000 }).toBeGreaterThan(2);
}

export function state(page: Page): Promise<AppState> {
  return page.evaluate(() => (window as any).__atlas.state());
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 80, timeout: 150_000 });
}

/** Serves canned MediaWiki responses so reader tests don't depend on the network. */
export async function mockWikipedia(page: Page, mode: 'ok' | 'offline' = 'ok'): Promise<string[]> {
  const seen: string[] = [];
  await page.route(/https:\/\/(zh|en)\.wikipedia\.org\/w\/api\.php.*/, async route => {
    const u = new URL(route.request().url());
    seen.push(`${u.hostname.slice(0, 2)}:${u.searchParams.get('titles')}`);
    if (mode === 'offline') return route.abort('internetdisconnected');
    const zh = u.hostname.startsWith('zh');
    const title = u.searchParams.get('titles') ?? '';
    if (u.searchParams.get('prop') === 'langlinks') {
      return route.fulfill({ json: { query: { pages: [{ title, langlinks: [{ lang: zh ? 'en' : 'zh', title: zh ? 'Mock article' : '模拟条目' }] }] } } });
    }
    const extract = zh
      ? `${title}是一个用于测试的条目。\n这是第二段导言。\n\n== 背景 ==\n背景段落。\n\n== 参考文献 ==\n不应显示。`
      : `${title} is a mock article used in tests.\nA second lead paragraph.\n\n== Background ==\nBackground paragraph.\n\n== References ==\nShould not be shown.`;
    return route.fulfill({ json: { query: { pages: [{ title, extract, description: zh ? '测试描述' : 'Test description' }] } } });
  });
  return seen;
}
