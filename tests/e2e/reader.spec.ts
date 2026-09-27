import { expect, test, type Page } from '@playwright/test';
import type { Locator as BookLocator, Pos } from '../../src/features/reader';

declare global {
  interface Window {
    __selected?: { locator: BookLocator; pos: Pos };
  }
}

// The spike's "ch3 mid" passage: spine 4, offset 4839, pos 4.504220 at every layout (docs/research/reader-spike.md).
const NEEDLE = 'the Dodo replied very gravely';
const SPIKE_POS = '4.504220';

async function selectFirst20Chars(page: Page): Promise<string> {
  await page.evaluate(() => {
    delete window.__selected;
    window.__reader!.on('select', (e) => (window.__selected = { locator: e.locator, pos: e.pos }));
  });
  const selectInAnyFrame = async () => {
    for (const f of page.frames()) {
      const ok = await f
        .evaluate((needle) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
            const at = n.data.indexOf(needle);
            if (at === -1) continue;
            const range = document.createRange();
            range.setStart(n, at);
            range.setEnd(n, at + 20);
            document.getSelection()!.removeAllRanges();
            document.getSelection()!.addRange(range);
            return true;
          }
          return false;
        }, NEEDLE)
        .catch(() => false);
      if (ok) return true;
    }
    return false;
  };
  await expect.poll(selectInAnyFrame).toBe(true);
  await page.waitForFunction(() => window.__selected);
  const pos = await page.evaluate(() => window.__selected!.pos.toFixed(6));
  await expect(page.getByTestId('selection-pos')).toHaveText(pos);
  return pos;
}

const readPos = async (page: Page) => Number(await page.getByTestId('pos').textContent());

test('pos is layout-stable and the ReaderHandle works inside the Next app', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dev/reader');
  await page.waitForFunction(() => window.__reader);

  await page.evaluate(() => window.__reader!.goTo(4.5 as Pos));
  await expect(page.getByTestId('pos')).toHaveText(/^4\./);
  expect(await readPos(page)).toBeLessThanOrEqual(4.5);
  expect(Number(await page.getByTestId('page-end-pos').textContent())).toBeGreaterThanOrEqual(4.5);

  const before = await selectFirst20Chars(page);
  expect(before).toBe(SPIKE_POS);

  const posBeforeLayout = await page.getByTestId('pos').textContent();
  await page.getByLabel('Font size').selectOption('1.6');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('pos')).not.toHaveText(posBeforeLayout!);
  const after = await selectFirst20Chars(page);
  expect(after).toBe(SPIKE_POS);

  let prev = await readPos(page);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__reader!.next());
    await expect.poll(() => readPos(page)).toBeGreaterThan(prev);
    prev = await readPos(page);
    expect(Number(await page.getByTestId('page-end-pos').textContent())).toBeGreaterThan(prev);
  }

  const locator = await page.evaluate(() => window.__selected!.locator);
  await page.evaluate(async (loc) => {
    await window.__reader!.goTo(loc);
    window.__reader!.paint([{ id: 'm1', locator: loc, color: '#e11d48', kind: 'highlight' }]);
  }, locator);
  const box = (await (
    await page.waitForFunction(() => {
      type Contents = { overlayer?: { element: SVGElement } }[];
      const view = document.querySelector('foliate-view') as unknown as { renderer: { getContents(): Contents } };
      const r = view.renderer.getContents()[0]?.overlayer?.element.querySelector('[data-mark-id="m1"]')?.getBoundingClientRect();
      return r && r.width > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    })
  ).jsonValue())!;
  await page.mouse.click(box.x, box.y);
  await expect(page.getByTestId('mark-clicked')).toHaveText('m1');

  for (let i = 0; i < 15; i++) await page.evaluate((s) => window.__reader!.goTo(s as Pos), i);
  expect(await page.evaluate(() => window.__lengthMismatches)).toEqual([]);
});
