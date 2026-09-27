import { expect, test, type Page } from '@playwright/test';
import { pageUntil, pairUp, uploadAndOpen, waitForSave } from './helpers';

const SHOTS = '.verify/f2';
const QUESTION = 'What do you think happens next?';
const pastChapter1 = (pos: string | null) => pos?.startsWith('3.') ?? false;

// Chapter I of alice.epub is spine 2; chapterTitle() numbers spines from 1, so it's "Chapter 3" in the app.
async function finishChapter1AndFollowPrompt(page: Page, bookId: string, shot: string) {
  await pageUntil(page, pastChapter1);
  await waitForSave(page);
  const prompt = page.getByRole('complementary', { name: 'Chapter finished' });
  await expect(prompt).toContainText('You finished Chapter 3.');
  await expect(page.getByRole('link', { name: 'Discuss Chapter 3' })).toHaveAttribute('href', `/discuss/${bookId}/2`);
  await page.screenshot({ path: `${SHOTS}/${shot}` });
  await prompt.getByRole('link', { name: 'Discuss it together →' }).click();
  await page.waitForURL(`**/discuss/${bookId}/2`);
  await expect(page.getByRole('heading', { name: 'Discuss Chapter 3' })).toBeVisible();
}

async function answer(page: Page, text: string) {
  const card = page.getByRole('region', { name: QUESTION });
  await card.getByLabel('Your answer').fill(text);
  await card.getByRole('button', { name: 'Answer' }).click();
  return card;
}

async function guess(page: Page, partner: string, mine: string, theirs: string) {
  const card = page.getByRole('region', { name: 'Guess their reaction' });
  await card.getByRole('group', { name: 'How did this chapter make you feel?' }).getByRole('button', { name: mine }).click();
  await card.getByRole('group', { name: `How do you think ${partner} felt?` }).getByRole('button', { name: theirs }).click();
  await card.getByRole('button', { name: 'Lock it in' }).click();
  return card;
}

test('finishing a chapter links to its discussion, and answers and guesses reveal live for both', async ({ browser }) => {
  const { a, b } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  const bookId = bookPath.split('/').at(-1)!;
  await b.goto(bookPath);

  await finishChapter1AndFollowPrompt(a, bookId, 'd0-prompt-a-alex.png');
  const cardA = await answer(a, 'She follows the rabbit further down.');
  await expect(cardA.getByRole('status')).toHaveText('Waiting for Sam…');
  await a.screenshot({ path: `${SHOTS}/d1-waiting-a-alex.png` });

  await finishChapter1AndFollowPrompt(b, bookId, 'd0-prompt-b-sam.png');
  const cardB = b.getByRole('region', { name: QUESTION });
  await expect(cardB.getByLabel('Your answer')).toBeVisible();
  await expect(cardB).not.toContainText('She follows the rabbit');
  await answer(b, 'A tea party, surely.');

  for (const [card, partner] of [
    [cardA, 'Sam'],
    [cardB, 'Alex'],
  ] as const) {
    await expect(card.getByText(partner, { exact: true })).toBeVisible({ timeout: 3000 });
    await expect(card).toContainText('She follows the rabbit further down.', { timeout: 3000 });
    await expect(card).toContainText('A tea party, surely.', { timeout: 3000 });
    await expect(card.getByRole('status')).toHaveCount(0);
  }
  await a.screenshot({ path: `${SHOTS}/d2-revealed-a-alex.png` });
  await b.screenshot({ path: `${SHOTS}/d3-revealed-b-sam.png` });

  const guessA = await guess(a, 'Sam', '❤️ Love this', '❤️ Love this');
  await expect(guessA.getByRole('status')).toHaveText('Waiting for Sam…');
  await guess(b, 'Alex', '❤️ Love this', '😂 Funny');
  await expect(a.getByTestId('guess-result').locator('p')).toHaveText(
    ['You: ❤️ Sam: ❤️', '🎉 Same reaction!', 'You guessed Sam right.', 'Sam guessed 😂 for you.'],
    { timeout: 3000 },
  );
  await expect(b.getByTestId('guess-result').locator('p')).toHaveText(
    ['You: ❤️ Alex: ❤️', '🎉 Same reaction!', 'You guessed 😂 for Alex.', 'Alex guessed you right.'],
    { timeout: 3000 },
  );
  await a.screenshot({ path: `${SHOTS}/d4-guess-a-alex.png` });
  await b.screenshot({ path: `${SHOTS}/d5-guess-b-sam.png` });

  await a.goto(`/together/book/${bookId}`);
  const timeline = a.getByRole('list', { name: 'Timeline' });
  await expect(timeline).toContainText('💬 You discussed Chapter 3');
  await a.screenshot({ path: `${SHOTS}/d6-timeline-a-alex.png` });
  await timeline.getByRole('link', { name: 'Chapter 3' }).click();
  await a.waitForURL(`**/discuss/${bookId}/2`);
  await expect(a.getByRole('region', { name: QUESTION })).toContainText('A tea party, surely.');
});
