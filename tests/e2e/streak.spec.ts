import { expect, test } from '@playwright/test';
import { pageUntil, pairUp, uploadAndOpen, waitForSave } from './helpers';

const SHOTS = '.verify/f2';
// Past Chapter I is over 2 goal pages (1500 chars each) for anyone.
const pastChapter1 = (pos: string | null) => pos?.startsWith('3.') ?? false;

test('reading together today starts a streak, and a met goal shows a check for both', async ({ browser }) => {
  const { a, b } = await pairUp(browser);
  const bookPath = await uploadAndOpen(a);
  await b.goto(bookPath);

  await a.goto('/together');
  await expect(a.getByTestId('streak')).toHaveText('Start a streak: read today together');
  await a.goto(bookPath);

  for (const page of [a, b]) {
    await pageUntil(page, pastChapter1);
    await waitForSave(page);
  }
  for (const page of [a, b]) {
    await page.goto('/together');
    await expect(page.getByTestId('streak')).toHaveText('🔥 1-day reading streak');
  }

  await a.getByText('Set a daily goal').click();
  const form = a.getByRole('form', { name: 'Reading goal' });
  await form.getByLabel('Daily goal').fill('2');
  await form.getByLabel('Unit').selectOption('pages_per_day');
  await form.getByRole('button', { name: 'Set goal' }).click();

  await expect(a.getByTestId('goal-progress')).toHaveText(/^Today: You \d+\/2 pages ✓ · Sam \d+\/2 ✓$/);
  await b.reload();
  await expect(b.getByTestId('goal-progress')).toHaveText(/^Today: You \d+\/2 pages ✓ · Alex \d+\/2 ✓$/);
  await expect(b.getByTestId('streak')).toHaveText('🔥 1-day reading streak');
  await a.screenshot({ path: `${SHOTS}/s1-together-a-alex.png` });
  await b.screenshot({ path: `${SHOTS}/s2-together-b-sam.png` });
});
