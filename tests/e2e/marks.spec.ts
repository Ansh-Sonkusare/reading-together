import { expect, test, type Page } from '@playwright/test';
import { CHAPTER_1, locate, myPos, overlays, pairUp, paintAt, select, tap, thread, toChapter1, turn, uploadAndOpen, waitForSave } from './helpers';

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
  await expect(menuA.getByRole('button')).toHaveCount(11);
  for (const label of ['Highlight', 'Note', 'Bookmark', 'Send to Sam']) await expect(menuA.getByRole('button', { name: label, exact: true })).toBeVisible();
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

const selectedText = (page: Page) =>
  Promise.all(page.frames().filter((f) => f.url().startsWith('blob:')).map((f) => f.evaluate(() => document.getSelection()?.toString() ?? ''))).then((t) => t.join(''));

test('bookmarks are shared with a label; a sent passage lands in the partner inbox and opens there', async ({ browser }) => {
  const shots = '.verify/p21-p23';
  const { a, b } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);
  await toChapter1(a);
  await toChapter1(b);

  const menu = await select(a, P1);
  await menu.getByRole('button', { name: 'Bookmark' }).click();
  const labels = menu.getByRole('group', { name: 'Bookmark label' });
  for (const l of ['First quote we both loved', 'Favorite chapter', 'Funny part', 'Important conversation']) await expect(labels.getByRole('button', { name: l })).toBeVisible();
  await expect(labels.getByLabel('Custom label')).toBeVisible();
  await a.screenshot({ path: `${shots}/1-bookmark-labels-a-alex.png` });
  await labels.getByRole('button', { name: 'Funny part' }).click();
  await expect(menu).toBeHidden();
  await expect.poll(() => selectedText(a)).toBe('');

  const panel = (page: Page) => page.getByRole('region', { name: 'Bookmarks' });
  for (const page of [a, b]) {
    await page.getByRole('button', { name: 'Bookmarks' }).click();
    await expect(panel(page).getByRole('button', { name: /^Funny part/ })).toContainText(P1, { timeout: LIVE_MS });
  }
  expect(await paintAt(b, P1)).toEqual([]);
  await b.screenshot({ path: `${shots}/2-bookmarks-panel-b-sam.png` });
  await panel(b).getByRole('button', { name: 'Close' }).click();
  await turn(b, () => b.getByRole('button', { name: 'Next page' }).click());
  await b.getByRole('button', { name: 'Bookmarks' }).click();
  await panel(b).getByRole('button', { name: /^Funny part/ }).click();
  await expect(panel(b)).toBeHidden();
  await expect(myPos(b)).toHaveText(CHAPTER_1);

  await turn(b, () => b.getByRole('button', { name: 'Next page' }).click());
  const away = await waitForSave(b);
  expect(away).not.toBe(CHAPTER_1);
  await b.goto('/library');
  const inbox = b.getByRole('region', { name: 'From Alex' });
  await expect(inbox).toContainText('When Alex sends you a passage, it lands here.');

  const sendMenu = await select(a, P2);
  await sendMenu.getByRole('button', { name: 'Send to Sam' }).click();
  await expect(sendMenu).toContainText('This reminded me of you');
  await sendMenu.getByLabel('Add a message (optional)').fill('This reminds me of you');
  await a.screenshot({ path: `${shots}/3-send-a-alex.png` });
  await sendMenu.getByRole('button', { name: 'Send to Sam' }).last().click();
  await expect(sendMenu).toBeHidden();
  await expect.poll(() => selectedText(a)).toBe('');

  const item = inbox.getByRole('listitem');
  await expect(item).toHaveCount(1, { timeout: 3000 });
  await expect(item.locator('blockquote')).toHaveText(P2);
  await expect(item).toContainText('This reminds me of you');
  await b.screenshot({ path: `${shots}/4-inbox-b-sam.png` });
  await item.getByRole('link', { name: "Open in Alice's Adventures in Wonderland" }).click();
  await b.waitForURL(`**${bookPath}?mark=*`);
  await expect(myPos(b)).toHaveText(CHAPTER_1);
  await locate(b, P2);
  await b.screenshot({ path: `${shots}/5-opened-at-passage-b-sam.png` });
});
