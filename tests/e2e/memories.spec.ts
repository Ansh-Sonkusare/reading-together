import { expect, test, type Page } from '@playwright/test';
import { pairUp, paintAt, select, tap, thread, toChapter1, uploadAndOpen } from './helpers';

const SHOTS = '.verify/p43';
const P1 = 'Alice was beginning to get very tired';
const CAPTION = 'Dinner at our favorite restaurant';

const photoWidth = (page: Page) =>
  thread(page)
    .getByRole('img', { name: 'Memory photo' })
    .evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0))
    .catch(() => 0);

test('memories: a photo and caption on a highlight reach the partner, in the thread and on the timeline', async ({ browser }) => {
  const { a, b } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);
  await toChapter1(a);
  await toChapter1(b);

  await (await select(a, P1)).getByRole('button', { name: 'Highlight' }).click();
  await expect.poll(() => paintAt(b, P1), { timeout: 3000 }).toHaveLength(1);
  await tap(a, P1);
  await thread(a).getByRole('button', { name: 'Add a memory 📸' }).click();
  const form = thread(a).getByRole('form', { name: 'Add a memory' });
  await form.getByLabel('Photo').setInputFiles('fixtures/memory.jpg');
  await form.getByLabel('Caption').fill(CAPTION);
  await a.screenshot({ path: `${SHOTS}/1-add-memory-a-alex.png` });
  await form.getByRole('button', { name: 'Save memory' }).click();
  await expect(form).toBeHidden();
  await expect(thread(a).getByRole('listitem', { name: 'Memory' })).toContainText(`📸 You: ${CAPTION}`);
  await expect.poll(() => photoWidth(a)).toBe(500);
  await a.screenshot({ path: `${SHOTS}/2-memory-a-alex.png` });

  await tap(b, P1);
  const card = thread(b).getByRole('listitem', { name: 'Memory' });
  await expect(card).toContainText(`📸 Alex: ${CAPTION}`, { timeout: 3000 });
  await expect.poll(() => photoWidth(b), { timeout: 3000 }).toBe(500);
  await expect(thread(b).getByRole('listitem')).toHaveText(['Alex: highlighted this', `📸 Alex: ${CAPTION}`]);
  await b.screenshot({ path: `${SHOTS}/3-memory-b-sam.png` });

  const bookId = bookPath.split('/').at(-1);
  await b.goto(`/together/book/${bookId}`);
  const timeline = b.getByRole('list', { name: 'Timeline' });
  await expect(timeline).toContainText('📸 Alex added a memory');
  await expect(b.getByText(/memories created$/)).toHaveText('❤️ 2 memories created');
  await b.screenshot({ path: `${SHOTS}/4-timeline-b-sam.png`, fullPage: true });
  await a.goto(`/together/book/${bookId}`);
  await expect(a.getByRole('list', { name: 'Timeline' })).toContainText('📸 You added a memory');
});
