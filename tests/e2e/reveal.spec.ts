import { expect, test, type Page } from '@playwright/test';
import { locate, myPos, overlays, pairUp, paintAt, select, thread, toChapter1, turn, uploadAndOpen, waitForSave } from './helpers';

const SHOTS = '.verify/p21-p23';
const ALEX = '#d6336c';
const CHAPTER_3_TEXT = 'They were indeed a queer-looking party';
const inChapter3 = (pos: string | null) => pos?.startsWith('4.') ?? false;
const toast = (page: Page) => page.getByRole('status').filter({ hasText: 'New from' });

async function pageUntil(page: Page, done: (pos: string | null) => boolean, beforeEachTurn = async () => {}) {
  for (let i = 0; i < 40 && !done(await myPos(page).textContent()); i++) {
    await beforeEachTurn();
    await turn(page, () => page.getByRole('button', { name: 'Next page' }).click());
  }
  expect(done(await myPos(page).textContent())).toBe(true);
}

test('a partner mark ahead is invisible, then revealed with a toast once reached', async ({ browser }) => {
  const { a, b } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);

  await pageUntil(a, inChapter3);
  await waitForSave(a);
  await (await select(a, CHAPTER_3_TEXT)).getByRole('button', { name: 'Emotional' }).click();
  await expect.poll(() => paintAt(a, CHAPTER_3_TEXT)).toEqual([expect.objectContaining({ fill: ALEX, count: 1 })]);

  await toChapter1(b);
  const noTrace = async () => {
    await waitForSave(b);
    await expect(toast(b)).toHaveCount(0);
    expect((await overlays(b)).filter((o) => o.fill === ALEX)).toEqual([]);
    await expect(thread(b)).toHaveCount(0);
    await expect(b.locator('body')).not.toContainText('Emotional');
  };
  await noTrace();
  await b.screenshot({ path: `${SHOTS}/r1-hidden-b-sam.png` });

  await pageUntil(b, inChapter3, noTrace);
  await expect(toast(b)).toHaveText(/✨ New from Alex: 😭/, { timeout: 3000 });
  await expect.poll(() => paintAt(b, CHAPTER_3_TEXT), { timeout: 3000 }).toEqual([expect.objectContaining({ fill: ALEX, count: 1 })]);
  await b.screenshot({ path: `${SHOTS}/r2-revealed-b-sam.png` });
  await toast(b).getByRole('button', { name: 'Show' }).click();
  await expect(toast(b)).toHaveCount(0);
  await expect(thread(b)).toContainText('Alex: 😭 Emotional');
  await locate(b, CHAPTER_3_TEXT);
  await b.screenshot({ path: `${SHOTS}/r3-thread-b-sam.png` });
});
