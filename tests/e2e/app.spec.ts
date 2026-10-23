import { expect, test } from '@playwright/test';
import { mockWikipedia, openApp, shot, state, watchErrors } from './helpers.ts';

test.describe('Ages atlas', () => {
  test('boots into the map and switches between English and Chinese', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'y=-221&lang=en');
    let s = await state(page);
    expect(s).toMatchObject({ ready: true, year: -221, lang: 'en', snapshot: expect.stringMatching(/qin/) });
    await expect(page.locator('.tl-year')).toHaveText('221 BCE');
    await expect(page.locator('.brand b')).toHaveText('Ages');
    await expect(page.locator('.labels .polity', { hasText: /^Qin$/ }).first()).toBeVisible();
    await shot(page, 'desktop-home-en');

    await page.locator('[data-act=lang]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', /^zh/);
    await expect(page.locator('.tl-year')).toHaveText('前221年');
    await expect(page.locator('.search .q')).toHaveAttribute('placeholder', /搜索/);
    await expect(page.locator('.tl-band', { hasText: '唐' })).toBeVisible();
    await expect(page.locator('.labels .polity', { hasText: /^秦$/ }).first()).toBeVisible();
    expect(page.url()).toContain('lang=zh');
    s = await state(page);
    expect(s.lang).toBe('zh');
    await shot(page, 'desktop-home-zh');

    // the choice persists across reloads
    await page.goto('/?lowfx=1');
    await expect.poll(() => page.evaluate(() => (window as any).__atlas?.ready)).toBe(true);
    expect((await state(page)).lang).toBe('zh');
    expect(errs).toEqual([]);
  });

  test('search opens an event card with key points, people and textbook units', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'y=1000&lang=en');
    await page.keyboard.press('/');
    await expect(page.locator('.search .q')).toBeFocused();
    await page.keyboard.type('Zheng He');
    const hit = page.locator('.hits li', { hasText: 'Zheng He' }).first();
    await expect(hit).toBeVisible();
    await hit.click();
    const card = page.locator('.card');
    await expect(card).toBeVisible();
    await expect(card.locator('h2')).toContainText('Zheng He');
    await expect(card).toContainText('Key points');
    await expect(card).toContainText('Grade');
    await expect.poll(async () => (await state(page)).event).toBe('zhenghe');
    const s = await state(page);
    expect(s.year).toBe(1405);
    expect(s.snapshot).toMatch(/ming/);
    expect(s.fx.event).toBeGreaterThan(0);
    expect(page.url()).toContain('e=zhenghe');

    // next / previous event, then close with Escape
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await state(page)).event).not.toBe('zhenghe');
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await state(page)).event).toBe('zhenghe');
    await shot(page, 'desktop-event-card');
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    expect(errs).toEqual([]);
  });

  test('plays an animated story with captions, pause and stop', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'e=qin_unify&lang=zh');
    await page.locator('[data-act=play]').click();
    await page.evaluate(() => { (window as any).__atlas.player.speed = 4; });
    await expect(page.locator('.caption')).toBeVisible();
    await expect(page.locator('.card')).toHaveCSS('opacity', '0');
    await expect.poll(async () => (await state(page)).captions, { timeout: 60_000 }).toMatch(/秦|韩/);
    await expect.poll(async () => (await state(page)).fx.story, { timeout: 90_000 }).toBeGreaterThan(0);
    await shot(page, 'desktop-story-qin');

    await page.keyboard.press('Space');
    await expect.poll(async () => (await state(page)).story).toBe('paused');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await state(page)).story).toBe('playing');
    await page.locator('.caption [aria-label="停止"]').click();
    await expect.poll(async () => (await state(page)).story).toBe('idle');
    await expect(page.locator('.caption')).toBeHidden();
    await expect(page.locator('.card')).toHaveCSS('opacity', '1');
    expect((await state(page)).fx.story).toBe(0);
    expect(errs).toEqual([]);
  });

  test('timeline scrubbing and deep links change the territory map', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'y=1405&lang=en');
    expect((await state(page)).snapshot).toMatch(/ming/);
    await expect(page.locator('.tl-era')).toHaveText('Ming dynasty');

    const track = page.locator('.tl-track');
    await track.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await state(page)).year).toBe(1415);

    const box = (await page.locator('.tl-axis').boundingBox())!;
    const before = (await state(page)).year;
    await page.mouse.click(box.x + box.width * 0.97, box.y + box.height / 2);
    await expect.poll(async () => (await state(page)).year).toBeGreaterThan(before);
    await expect.poll(async () => (await state(page)).snapshot).toMatch(/^prc/);
    expect((await state(page)).year).toBeGreaterThan(1949);
    expect(page.url()).toContain('y=');

    await page.goto('/?lowfx=1#y=-260&lang=en');
    await expect.poll(async () => (await state(page)).snapshot).toMatch(/zhanguo/);
    expect(errs).toEqual([]);
  });

  test('Wikipedia reader shows the article, switches language and handles offline', async ({ page }) => {
    const errs = watchErrors(page);
    const seen = await mockWikipedia(page);
    await openApp(page, 'e=zhenghe&lang=en');
    await page.locator('.card [data-act=wiki]').click();
    const reader = page.locator('.reader');
    await expect(reader).toBeVisible();
    await expect(reader).toContainText('is a mock article used in tests.');
    await expect(reader).toContainText('Background');
    await expect(reader).not.toContainText('Should not be shown');
    await expect(reader).toContainText('CC BY-SA');
    await expect(reader.locator('a[href^="https://en.wikipedia.org/wiki/"]').first()).toBeVisible();
    await shot(page, 'desktop-wikipedia');

    await reader.locator('.seg button', { hasText: '中文' }).click();
    await expect(reader).toContainText('是一个用于测试的条目');
    expect(seen.some(x => x.startsWith('zh:'))).toBe(true);
    await reader.locator('header [aria-label=Close]').click();
    await expect(reader).toBeHidden();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockWikipedia(page, 'offline');
    await page.goto('/?lowfx=1#e=qin_unify&lang=en');
    await expect.poll(() => page.evaluate(() => (window as any).__atlas?.ready)).toBe(true);
    await page.locator('.card [data-act=wiki]').click();
    await expect(reader.locator('.rd-msg')).toBeVisible();
    await expect(reader.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(errs).toEqual([]);
  });

  test('quiz: answers when / where / order questions and shows the score', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'y=700&lang=en');
    await page.locator('.b-hub').click();
    await page.locator('.b-quiz').click();
    await page.locator('[data-act=start]').click();
    const quiz = page.locator('.quiz');
    const total = await page.evaluate(() => (window as any).__atlas.quiz.qs.length);
    expect(total).toBeGreaterThan(3);
    const kinds = new Set<string>();
    for (let i = 0; i < total; i++) {
      const q = await page.evaluate(() => { const z = (window as any).__atlas.quiz; return z.qs[z.i]; });
      kinds.add(q.type);
      if (q.type === 'when') {
        await quiz.locator('.qz-opts .opt').nth(q.options.indexOf(q.answer)).click();
      } else if (q.type === 'where') {
        await expect.poll(() => page.evaluate(() => (window as any).__atlas.atlas.view.flying), { timeout: 30_000 }).toBe(false);
        const pt = await page.evaluate(([lon, lat]) => (window as any).__atlas.screenOf(lon, lat), [q.lon, q.lat]);
        await page.mouse.click(pt.x, pt.y);
      } else {
        for (const id of q.answer) await quiz.locator(`.qz-opts .opt[data-id="${id}"]`).click();
        await quiz.locator('[data-act=check]').click();
      }
      await expect(quiz.locator('.qz-fb')).toContainText(/Correct/);
      if (i === 0) await shot(page, 'desktop-quiz');
      await quiz.locator('[data-act=next]').click();
    }
    await expect(quiz.locator('.qz-done')).toContainText(`${total}/${total}`);
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(errs).toEqual([]);
  });

  test('journeys play as 3D stories; places and people open their own cards', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'y=1085&lang=zh');
    await expect(page.locator('.tl-ruler')).toHaveText('北宋神宗 · 元丰八年');
    await page.locator('.b-hub').click();
    await page.locator('.b-journeys').click();
    await expect(page.locator('.journeys .jn')).toHaveCount(7);
    await page.locator('[data-journey=sushi]').click();
    await expect(page.locator('.caption')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__atlas.player.state)).toBe('playing');
    await page.locator('.caption [aria-label=停止]').click();
    await expect.poll(() => page.evaluate(() => (window as any).__atlas.player.state)).toBe('idle');

    await page.locator('.search .q').fill('汴梁');
    await page.locator('.hits li', { hasText: '开封' }).first().click();
    const card = page.locator('.card');
    await expect(card.locator('h2')).toHaveText('东京（汴梁）');
    await expect(card).toContainText('历代名称');
    await expect(card).toContainText('今 开封');

    await page.locator('.search .q').fill('苏东坡');
    await page.locator('.hits li', { hasText: '苏轼' }).first().click();
    await expect(card.locator('h2')).toHaveText('苏轼');
    await expect(card.locator('[data-act=journey]')).toBeVisible();
    expect(errs).toEqual([]);
  });

  test('learn drawer lists textbook units and opens events', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'y=1950&lang=zh');
    await page.locator('.b-hub').click();
    await page.locator('.b-learn').click();
    const drawer = page.locator('.drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.tabs button')).toHaveCount(5);
    await drawer.locator('.u-head').nth(2).click();
    const first = drawer.locator('.u-evs button').first();
    await expect(first).toBeVisible();
    await shot(page, 'desktop-learn');
    await first.click();
    await expect(page.locator('.card')).toBeVisible();
    await page.locator('.card .btn', { hasText: '已掌握' }).click();
    await expect(drawer.locator('.u-head').nth(2).locator('.u-p')).toHaveText(/^1\//);
    expect(errs).toEqual([]);
  });

  test('mobile layout keeps the map in focus @mobile', async ({ page }) => {
    const errs = watchErrors(page);
    await openApp(page, 'e=chibi&lang=zh');
    const card = page.locator('.card');
    await expect(card).toBeVisible();
    const vp = page.viewportSize()!;
    await card.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished))); // slide-in animation
    const cb = (await card.boundingBox())!;
    const tb = (await page.locator('.tl').boundingBox())!;
    expect(cb.y).toBeGreaterThan(vp.height * 0.4);
    expect(cb.y + cb.height).toBeLessThanOrEqual(tb.y + 1);
    expect(tb.y + tb.height).toBeLessThanOrEqual(vp.height);
    // the selected place is framed above the bottom sheet
    const pt = await page.evaluate(() => (window as any).__atlas.screenOf(113.9, 29.83));
    await expect.poll(async () => (await page.evaluate(() => (window as any).__atlas.screenOf(113.9, 29.83))).y, { timeout: 30_000 }).toBeLessThan(cb.y);
    expect(pt.x).toBeGreaterThan(0);
    await shot(page, 'mobile-event');
    await page.locator('[data-act=play]').click();
    await expect(page.locator('.caption')).toBeVisible();
    await expect(card).toHaveCSS('opacity', '0');
    await shot(page, 'mobile-story');
    expect(errs).toEqual([]);
  });
});
