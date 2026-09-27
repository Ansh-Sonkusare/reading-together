import { expect, test, type Page } from '@playwright/test';
import { pairUp, paintAt, select, tap, thread, toChapter1, uploadAndOpen } from './helpers';

const SHOTS = '.verify/p14b';
const ALEX = '#e11d48';
const BOTH = '#83409a';
const LIVE_MS = 2000;
const REACTION_LABELS = ['Love this', 'Funny', 'Emotional', 'Surprised', 'Interesting', 'Favorite', 'Made me think'];

const P1 = 'Alice was beginning to get very tired';
const P2 = 'So she was considering in her own mind';
const P3 = 'There was nothing so';

async function shoot(a: Page, b: Page, step: string) {
  await a.screenshot({ path: `${SHOTS}/${step}-a-alex.png` });
  await b.screenshot({ path: `${SHOTS}/${step}-b-sam.png` });
}

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
