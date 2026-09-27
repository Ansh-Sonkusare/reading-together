import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

process.loadEnvFile('.env.local');

const PASSWORD = 'correct-horse-42';
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signUp(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
}

const myPos = (page: Page) => page.getByTestId('my-pos');

async function turn(page: Page, how: () => Promise<void>) {
  await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();
  const before = await myPos(page).textContent();
  await how();
  await expect(myPos(page)).not.toHaveText(before!);
}

async function waitForSave(page: Page): Promise<string> {
  const pos = (await myPos(page).textContent())!;
  await expect(page.getByTestId('saved-pos')).toHaveText(pos, { timeout: 5000 });
  return pos;
}

test('a book opens from the library, saves progress and restores it', async ({ page }) => {
  const email = `alex-${run}@example.com`;
  await signUp(page, email);
  await page.getByLabel('Your name').fill('Alex');
  await page.getByRole('button', { name: 'Start our library' }).click();
  await page.waitForURL('**/library');

  await page.getByLabel('EPUB file').setInputFiles('fixtures/alice.epub');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('status')).toHaveText(`Added "Alice's Adventures in Wonderland".`);
  await page.getByRole('link', { name: "Alice's Adventures in Wonderland" }).click();
  await page.waitForURL('**/book/*');
  await expect(myPos(page)).toHaveText('0.125000');

  const next = page.getByRole('button', { name: 'Next page' });
  for (let i = 0; i < 3; i++) await turn(page, () => next.click());
  for (let i = 0; i < 2; i++) await turn(page, () => page.keyboard.press('ArrowRight'));
  const reached = await waitForSave(page);
  expect(Number(reached)).toBeGreaterThan(1);

  await page.reload();
  await expect(myPos(page)).toHaveText(reached);

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await db.auth.signInWithPassword({ email, password: PASSWORD });
  const bookId = page.url().split('/').pop()!;
  const read = async () => (await db.from('progress').select('pos, max_pos').eq('book_id', bookId).single()).data!;
  const high = await read();
  expect(high.pos.toFixed(6)).toBe(reached);
  expect(high.max_pos).toBeGreaterThan(high.pos);

  const prev = page.getByRole('button', { name: 'Previous page' });
  await turn(page, () => prev.click());
  await turn(page, () => page.keyboard.press('ArrowLeft'));
  const back = await waitForSave(page);
  expect(Number(back)).toBeLessThan(Number(reached));
  await page.reload();
  await expect(myPos(page)).toHaveText(back);
  const after = await read();
  expect(after.pos.toFixed(6)).toBe(back);
  expect(after.max_pos).toBe(high.max_pos);
});
