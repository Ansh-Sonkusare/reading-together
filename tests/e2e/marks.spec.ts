import { expect, test, type Page } from '@playwright/test';
import { myPos, pairUp, turn, uploadAndOpen, waitForSave } from './helpers';

const SHOTS = '.verify/p14b';
const CHAPTER_1 = '2.000087';
const ALEX = '#e11d48';
const BOTH = '#83409a';
const LIVE_MS = 2000;
const REACTION_LABELS = ['Love this', 'Funny', 'Emotional', 'Surprised', 'Interesting', 'Favorite', 'Made me think'];

const P1 = 'Alice was beginning to get very tired';
const P2 = 'So she was considering in her own mind';
const P3 = 'There was nothing so';

type Box = { x: number; y: number; width: number; height: number };
type Overlay = { id: string; fill: string | null; opacity: string; box: Box };

async function toChapter1(page: Page) {
  for (let i = 0; i < 8 && (await myPos(page).textContent()) !== CHAPTER_1; i++) {
    await turn(page, () => page.getByRole('button', { name: 'Next page' }).click());
  }
  await expect(myPos(page)).toHaveText(CHAPTER_1);
  await waitForSave(page);
}

// Finds the passage in the book's section iframe, optionally selects it, and returns its first line's centre in page coordinates.
type Spot = { x: number; y: number; top: number; bottom: number };

async function locate(page: Page, needle: string, selectIt = false): Promise<Spot> {
  let found: Spot | null = null;
  await expect
    .poll(async () => {
      for (const f of page.frames()) {
        if (!f.url().startsWith('blob:')) continue;
        found = await f
          .evaluate(
            ([n, sel]) => {
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
                const at = t.data.indexOf(n);
                if (at === -1) continue;
                const range = document.createRange();
                range.setStart(t, at);
                range.setEnd(t, at + n.length);
                if (sel) {
                  document.getSelection()!.removeAllRanges();
                  document.getSelection()!.addRange(range);
                }
                const r = range.getClientRects()[0];
                const frame = window.frameElement!.getBoundingClientRect();
                return { x: frame.x + r.x + r.width / 2, y: frame.y + r.y + r.height / 2, top: frame.y + r.top, bottom: frame.y + r.bottom };
              }
              return null;
            },
            [needle, selectIt] as const,
          )
          .catch(() => null);
        if (found) return true;
      }
      return false;
    })
    .toBe(true);
  return found!;
}

async function select(page: Page, needle: string) {
  await locate(page, needle, true);
  const menu = page.getByRole('group', { name: 'Mark this passage' });
  await expect(menu).toBeVisible();
  return menu;
}

async function tap(page: Page, needle: string) {
  const { x, y } = await locate(page, needle);
  await page.mouse.click(x, y);
}

async function overlays(page: Page): Promise<Overlay[]> {
  return page.evaluate(() => {
    type Contents = { overlayer?: { element: SVGElement } }[];
    const view = document.querySelector('foliate-view') as unknown as { renderer: { getContents(): Contents } };
    return view.renderer.getContents().flatMap((c) =>
      [...(c.overlayer?.element.querySelectorAll<SVGGElement>('[data-mark-id]') ?? [])].map((g) => {
        const r = g.getBoundingClientRect();
        return { id: g.dataset.markId!, fill: g.getAttribute('fill'), opacity: g.style.opacity, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
      }),
    );
  });
}

async function paintAt(page: Page, needle: string): Promise<Omit<Overlay, 'box'>[]> {
  const { x, top, bottom } = await locate(page, needle);
  const all = await overlays(page);
  // An underline sits under the line box rather than across its middle, so match on overlap with the line.
  const here = all.filter(({ box: b }) => x >= b.x && x <= b.x + b.width && b.y <= bottom + 4 && b.y + b.height >= top - 4);
  return here.map(({ id, fill, opacity }) => ({ id, fill, opacity, count: all.filter((o) => o.id === id).length }));
}

async function shoot(a: Page, b: Page, step: string) {
  await a.screenshot({ path: `${SHOTS}/${step}-a-alex.png` });
  await b.screenshot({ path: `${SHOTS}/${step}-b-sam.png` });
}

const thread = (page: Page) => page.getByRole('region', { name: 'Thread' });

test('marks: react, reply, note and a shared highlight reach the partner live', async ({ browser }) => {
  const { a, b } = await pairUp(browser, { viewport: { width: 390, height: 844 } });
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);
  await toChapter1(a);
  await toChapter1(b);

  const menuA = await select(a, P1);
  for (const label of REACTION_LABELS) await expect(menuA.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(menuA.getByRole('button')).toHaveCount(9);
  await expect(menuA.getByRole('button', { name: 'Highlight' })).toBeVisible();
  await expect(menuA.getByRole('button', { name: 'Note' })).toBeVisible();
  await shoot(a, b, '1-menu');
  await a.keyboard.press('Escape');
  await expect(menuA).toBeHidden();
  await select(a, P1);
  await a.getByRole('heading', { name: "Alice's Adventures in Wonderland" }).click();
  await expect(menuA).toBeHidden();
  await select(a, P1);
  await tap(a, P3);
  await expect(menuA).toBeHidden();

  await select(a, P1);
  await menuA.getByRole('button', { name: 'Emotional' }).click();
  await expect(menuA).toBeHidden();
  await expect.poll(() => paintAt(b, P1), { timeout: LIVE_MS }).toEqual([expect.objectContaining({ fill: ALEX, count: 1 })]);
  await shoot(a, b, '2-reacted');

  await tap(b, P1);
  await expect(thread(b)).toContainText('Alex: 😭 Emotional');
  await tap(a, P1);
  await expect(thread(a)).toContainText('You: 😭 Emotional');
  await thread(b).getByLabel('Reply').fill('I knowww 😭');
  await thread(b).getByRole('button', { name: 'Reply' }).click();
  await expect(thread(b)).toContainText('You: I knowww 😭');
  await expect(thread(a)).toContainText('Sam: I knowww 😭', { timeout: LIVE_MS });
  await shoot(a, b, '3-replied');

  await a.keyboard.press('Escape');
  await expect(thread(a)).toBeHidden();
  await thread(b).getByRole('button', { name: 'Close' }).click();
  const noteMenu = await select(a, P2);
  await noteMenu.getByRole('button', { name: 'Note' }).click();
  await noteMenu.getByLabel('Write a note').fill('This reminds me of you.');
  await noteMenu.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => paintAt(b, P2), { timeout: LIVE_MS }).toEqual([expect.objectContaining({ fill: ALEX, count: 1 })]);
  await tap(b, P2);
  await expect(thread(b)).toContainText('Alex: This reminds me of you.');
  await shoot(a, b, '4-note');

  await thread(b).getByRole('button', { name: 'Close' }).click();
  await (await select(a, P3)).getByRole('button', { name: 'Highlight' }).click();
  await expect.poll(() => paintAt(b, P3), { timeout: LIVE_MS }).toEqual([expect.objectContaining({ fill: ALEX, count: 1 })]);
  const menuB = await select(b, P3);
  const box = (await menuB.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await shoot(a, b, '5-menu-mobile');
  await menuB.getByRole('button', { name: 'Highlight' }).click();
  for (const page of [b, a]) {
    await expect
      .poll(() => paintAt(page, P3), { timeout: LIVE_MS })
      .toEqual([expect.objectContaining({ fill: BOTH, opacity: '', count: 1 })]);
  }
  await shoot(a, b, '6-both');
});
