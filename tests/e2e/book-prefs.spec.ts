import { expect, test, type Page } from '@playwright/test';
import { pairUp, toChapter1, uploadAndOpen } from './helpers';

process.loadEnvFile('.env.local');

const bookBackgrounds = async (page: Page) => {
  const out: string[] = [];
  for (const f of page.frames()) {
    if (f === page.mainFrame()) continue;
    const bg = await f.evaluate(() => (document.body?.textContent?.trim() ? getComputedStyle(document.body).backgroundColor : null)).catch(() => null);
    if (bg) out.push(bg);
  }
  return out;
};

test('reading settings on the book page recolour the book and survive a reload', async ({ browser }) => {
  const { a } = await pairUp(browser);
  await uploadAndOpen(a);
  await toChapter1(a);
  await a.getByLabel('Reading settings').click();
  await a.getByLabel('Reading theme').selectOption('night');
  await expect.poll(() => bookBackgrounds(a)).toContain('rgb(0, 0, 0)');
  await a.reload();
  await expect.poll(() => bookBackgrounds(a), { timeout: 15_000 }).toContain('rgb(0, 0, 0)');
  await a.getByLabel('Reading settings').click();
  await expect(a.getByLabel('Reading theme')).toHaveValue('night');
});
