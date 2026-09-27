import { expect, test } from '@playwright/test';
import { myPos, pageUntil, signUp, uploadAndOpen } from './helpers';

test('reading across chapter boundaries and leaving the reader throws no uncaught errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await signUp(page, `solo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Start our library' }).click();
  await page.waitForURL('**/library');
  await uploadAndOpen(page);

  await pageUntil(page, (pos) => pos?.startsWith('3.') ?? false);
  await expect(myPos(page)).toHaveText(/^3\./);
  await page.getByRole('link', { name: 'Library' }).click();
  await page.waitForURL('**/library');
  // Give any late foliate callback (animation frames, resize observers, timers) time to fire after unmount.
  await page.waitForTimeout(1500);

  expect(errors).toEqual([]);
});
