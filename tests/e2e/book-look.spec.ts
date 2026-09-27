import { expect, test, type Page } from '@playwright/test';
import { CHAPTER_1, myPos, pairUp, paintAt, select, tap, thread, toChapter1, turn, uploadAndOpen } from './helpers';

const SHOTS = '.verify/u1';
const P1 = 'Alice was beginning to get very tired';
const P2 = 'So she was considering in her own mind';
const P3 = 'There was nothing so';
const P4 = 'when suddenly a White Rabbit with pink eyes ran close by her';

const header = (page: Page) => page.locator('header');

async function mark(page: Page, needle: string, ink: string, action: 'Highlight' | 'Note' | 'Bookmark', text = '') {
  const menu = await select(page, needle);
  await menu.getByLabel(ink).check({ force: true });
  await menu.getByRole('button', { name: action }).click();
  if (action === 'Note') {
    await menu.getByLabel('Write a note').fill(text);
    await menu.getByRole('button', { name: 'Save' }).click();
  } else if (action === 'Bookmark') {
    await menu.getByRole('button', { name: text }).click();
  }
  await expect(menu).toBeHidden();
}

async function appDark(page: Page, dark: boolean) {
  await page.getByLabel('Reading settings').click();
  await page.getByLabel('App theme').selectOption(dark ? 'dark' : 'light');
  await page.getByLabel('Reading theme').selectOption(dark ? 'dark' : 'light');
  await page.getByLabel('Reading settings').click();
}

test('the book page: edge tap zones and arrow keys turn pages, the bar recedes while reading, marks in several inks', async ({ browser }) => {
  const { a, b } = await pairUp(browser, { viewport: { width: 390, height: 844 } });
  await a.setViewportSize({ width: 1280, height: 800 });
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);
  await toChapter1(b);

  await expect(header(a)).toHaveCSS('opacity', '1');
  await turn(a, () => a.mouse.click(1270, 400));
  await expect(header(a)).toHaveAttribute('data-reading', 'true');
  await expect(header(a)).toHaveCSS('opacity', '0.35');
  await a.getByRole('heading', { name: "Alice's Adventures in Wonderland" }).hover();
  await expect(header(a)).toHaveCSS('opacity', '1');
  await a.mouse.move(640, 400);
  const beforeKey = await myPos(a).textContent();
  await turn(a, () => a.keyboard.press('ArrowRight'));
  await turn(a, () => a.mouse.click(10, 400));
  await expect(myPos(a)).toHaveText(beforeKey!);
  await toChapter1(a);

  await mark(b, P4, 'Cobalt', 'Highlight');
  await mark(a, P1, 'Violet', 'Bookmark', 'Funny part');
  await mark(a, P2, 'Jade', 'Note', 'Green like the garden.');
  await mark(a, P3, 'Amber', 'Highlight');
  await expect.poll(() => paintAt(a, P4)).toEqual(expect.arrayContaining([expect.objectContaining({ fill: '#3b5bdb' })]));
  await expect.poll(() => paintAt(a, P3)).toEqual(expect.arrayContaining([expect.objectContaining({ fill: '#e8890c' })]));
  await expect(myPos(a)).toHaveText(CHAPTER_1);

  for (const dark of [false, true]) {
    const theme = dark ? 'dark' : 'light';
    for (const page of [a, b]) await appDark(page, dark);
    await a.mouse.move(640, 400);
    await a.screenshot({ path: `${SHOTS}/book-${theme}-1280.png` });
    await b.screenshot({ path: `${SHOTS}/book-${theme}-390.png` });
    await select(a, P4);
    await a.screenshot({ path: `${SHOTS}/menu-${theme}-1280.png` });
    await a.keyboard.press('Escape');
    await select(b, P1);
    await b.screenshot({ path: `${SHOTS}/menu-${theme}-390.png` });
    await b.keyboard.press('Escape');
    await tap(a, P2);
    await expect(thread(a)).toContainText('You: Green like the garden.');
    await a.screenshot({ path: `${SHOTS}/thread-${theme}-1280.png` });
    await a.keyboard.press('Escape');
    await tap(b, P2);
    await expect(thread(b)).toContainText('Alex: Green like the garden.');
    await b.screenshot({ path: `${SHOTS}/thread-${theme}-390.png` });
    await b.keyboard.press('Escape');
  }
});
