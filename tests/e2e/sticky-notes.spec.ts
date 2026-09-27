import { expect, test, type Page } from '@playwright/test';
import { locate, pairUp, select, thread, toChapter1, uploadAndOpen } from './helpers';

const SHOTS = '.verify/sticky';
const ALEX_RGB = 'rgb(214, 51, 108)';

const P1 = 'Alice was beginning to get very tired';
const P2 = 'So she was considering in her own mind';
const SHORT = 'This reminds me of you.';
const LONG = Array.from({ length: 24 }, (_, i) => `Line ${i + 1}: the rabbit hole goes on and on, like our talks.`).join(' ');

const settled = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);

async function writeNote(page: Page, needle: string, body: string) {
  const menu = await select(page, needle);
  await menu.getByRole('button', { name: 'Note' }).click();
  await menu.getByLabel('Write a note').fill(body);
  await menu.getByRole('button', { name: 'Save' }).click();
  await expect(menu).toBeHidden();
}

test('notes stick in the margin beside their passage, in the author ink, and a long one scrolls', async ({ browser }) => {
  const { a, b } = await pairUp(browser, { viewport: { width: 1280, height: 800 } });
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);
  await toChapter1(a);
  await toChapter1(b);

  expect(LONG.length).toBeGreaterThan(1200);
  await writeNote(a, P1, SHORT);
  await writeNote(a, P2, LONG);

  const notes = b.getByRole('note', { name: "Alex's note" });
  await expect(notes).toHaveCount(2, { timeout: 5000 });
  const short = notes.filter({ hasText: SHORT });
  const long = notes.filter({ hasText: 'Line 1:' });
  await expect(short.getByRole('button', { name: "Open the thread on Alex's note" })).toHaveText('AAlex');

  for (const [note, needle] of [
    [short, P1],
    [long, P2],
  ] as const) {
    const line = await locate(b, needle);
    const box = (await note.boundingBox())!;
    expect(Math.abs(box.y - line.top)).toBeLessThanOrEqual(40);
    // In the outer margin: clear of the text column on its side of the spread.
    if (line.x < 640) expect(box.x + box.width).toBeLessThan(line.x);
    else expect(box.x).toBeGreaterThan(line.x);
    expect(await note.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(ALEX_RGB);
  }
  const [s, l] = [(await short.boundingBox())!, (await long.boundingBox())!];
  const apart = s.x + s.width <= l.x || l.x + l.width <= s.x || s.y + s.height <= l.y || l.y + l.height <= s.y;
  expect(apart).toBe(true);

  const body = long.locator('p');
  const sizes = await body.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  await body.focus();
  await b.keyboard.press('PageDown');
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await body.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(body).toContainText('Line 24:');

  await b.screenshot({ path: `${SHOTS}/desktop-light.png` });

  await b.getByLabel('Reading settings').click();
  await b.getByLabel('Reading theme').selectOption('dark');
  await b.getByLabel('App theme').selectOption('dark');
  await b.getByLabel('Text size').selectOption('1.2');
  await b.getByLabel('Reading settings').click();
  await expect
    .poll(async () => Math.abs((await short.boundingBox())!.y - (await locate(b, P1)).top))
    .toBeLessThanOrEqual(40);
  await settled(b);
  await b.screenshot({ path: `${SHOTS}/desktop-dark.png` });
  await b.getByLabel('Reading settings').click();
  await b.getByLabel('Reading theme').selectOption('light');
  await b.getByLabel('App theme').selectOption('light');
  await b.getByLabel('Text size').selectOption('1');
  await b.getByLabel('Reading settings').click();

  await short.click();
  await expect(thread(b)).toContainText(`Alex: ${SHORT}`);
  await thread(b).getByRole('button', { name: 'Close' }).click();
  await expect(thread(b)).toBeHidden();

  await b.setViewportSize({ width: 390, height: 844 });
  await expect(notes).toHaveCount(0);
  const tabs = b.getByRole('button', { name: "Alex's note" });
  await expect(tabs).toHaveCount(2);
  const tab = tabs.first();
  const tabBox = (await tab.boundingBox())!;
  expect(tabBox.x + tabBox.width).toBe(390);
  const p1 = await locate(b, P1);
  expect(Math.abs(tabBox.y - p1.top)).toBeLessThanOrEqual(40);

  await tab.click();
  await expect(tab).toHaveAttribute('aria-expanded', 'true');
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText(SHORT);
  await settled(b);
  await b.screenshot({ path: `${SHOTS}/phone.png` });
  await b.keyboard.press('Escape');
  await expect(notes).toHaveCount(0);

  await tabs.last().click();
  await expect(notes).toContainText('Line 1:');
  const card = notes.locator('p');
  expect(await card.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await settled(b);
  await b.screenshot({ path: `${SHOTS}/phone-long.png` });
  await b.mouse.click(200, 150);
  await expect(notes).toHaveCount(0);
});
