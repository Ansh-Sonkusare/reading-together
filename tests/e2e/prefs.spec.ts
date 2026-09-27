import { expect, test, type Page } from '@playwright/test';
import type { Pos } from '../../src/features/reader';

// The spike's "ch3 mid" passage, pos 4.504220 at every layout (see reader.spec.ts).
declare global {
  interface Window {
    __selectedPos?: string;
  }
}

const NEEDLE = 'the Dodo replied very gravely';
const SPIKE_POS = '4.504220';

const bookFrame = async (page: Page) => {
  for (const f of page.frames()) if (await f.evaluate((n) => document.body?.textContent?.includes(n) ?? false, NEEDLE).catch(() => false)) return f;
  return null;
};

const bookStyle = async (page: Page) =>
  (await bookFrame(page))?.evaluate(() => {
    const body = getComputedStyle(document.body);
    return { background: body.backgroundColor, color: body.color, fontSize: getComputedStyle(document.documentElement).fontSize };
  }) ?? null;

async function selectNeedle(page: Page): Promise<string> {
  await page.evaluate(() => {
    delete window.__selectedPos;
    window.__reader!.on('select', (e) => (window.__selectedPos = e.pos.toFixed(6)));
  });
  const frame = await bookFrame(page);
  await frame!.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const at = n.data.indexOf(needle);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(n, at);
      range.setEnd(n, at + 20);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      return;
    }
  }, NEEDLE);
  return (await page.waitForFunction(() => window.__selectedPos)).jsonValue() as Promise<string>;
}

async function openAtPassage(page: Page) {
  await page.waitForFunction(() => window.__reader);
  await page.evaluate(() => window.__reader!.goTo(4.5 as Pos));
  await expect.poll(() => bookFrame(page).then(Boolean)).toBe(true);
}

test('reader theme and text size apply inside the book, keep pos stable and survive a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dev/reader');
  await openAtPassage(page);
  expect(await selectNeedle(page)).toBe(SPIKE_POS);

  for (const theme of ['light', 'sepia', 'dark', 'night']) {
    await page.getByLabel('Reading theme').selectOption(theme);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `.verify/p44/${theme}.png` });
  }
  await page.getByLabel('Text size').selectOption('1.4');

  await expect.poll(() => bookStyle(page)).toEqual({ background: 'rgb(0, 0, 0)', color: 'rgb(168, 162, 158)', fontSize: '22.4px' });
  expect(await selectNeedle(page)).toBe(SPIKE_POS);

  await page.reload();
  await expect(page.getByLabel('Reading theme')).toHaveValue('night');
  await expect(page.getByLabel('Text size')).toHaveValue('1.4');
  await openAtPassage(page);
  await expect.poll(() => bookStyle(page)).toEqual({ background: 'rgb(0, 0, 0)', color: 'rgb(168, 162, 158)', fontSize: '22.4px' });
  expect(await selectNeedle(page)).toBe(SPIKE_POS);

  await page.getByLabel('Reading background').fill('#203040');
  await expect.poll(() => bookStyle(page)).toEqual({ background: 'rgb(32, 48, 64)', color: 'rgb(168, 162, 158)', fontSize: '22.4px' });
  await page.getByLabel('Reading theme').selectOption('sepia');
  await expect.poll(() => bookStyle(page)).toEqual({ background: 'rgb(244, 236, 216)', color: 'rgb(91, 70, 54)', fontSize: '22.4px' });
});

test('app dark mode sets html.dark, restyles a Button and survives a reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/reader');
  const html = page.locator('html');
  const button = page.getByRole('button', { name: 'Sample' });
  const bg = () => button.evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(html).not.toHaveClass(/\bdark\b/);
  expect(await bg()).toBe('rgb(15, 23, 42)');

  await page.getByLabel('App theme').selectOption('dark');
  await expect(html).toHaveClass(/\bdark\b/);
  await expect.poll(bg).toBe('rgb(248, 250, 252)');

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect.poll(bg).toBe('rgb(248, 250, 252)');
  await expect(page.getByLabel('App theme')).toHaveValue('dark');

  await page.getByLabel('App theme').selectOption('system');
  await expect(html).not.toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(html).toHaveClass(/\bdark\b/);
});
