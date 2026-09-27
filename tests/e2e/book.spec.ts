import { createClient } from '@supabase/supabase-js';
import { expect, test, type Page } from '@playwright/test';

process.loadEnvFile('.env.local');

const PASSWORD = 'correct-horse-42';
const SHOTS = '.verify/p13b-p15';
const TITLE = "Alice's Adventures in Wonderland";

async function signUp(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
}

const myPos = (page: Page) => page.getByTestId('my-pos');
const pair = (page: Page) => page.getByTestId('progress-pair');

// A turn across a section boundary relocates through the section start first; the buttons re-enable once it settles.
async function turn(page: Page, how: () => Promise<void>) {
  const next = page.getByRole('button', { name: 'Next page' });
  await expect(next).toBeEnabled();
  const before = await myPos(page).textContent();
  await how();
  await expect(myPos(page)).not.toHaveText(before!);
  await expect(next).toBeEnabled();
}

async function waitForSave(page: Page): Promise<string> {
  const pos = (await myPos(page).textContent())!;
  await expect(page.getByTestId('saved-pos')).toHaveText(pos, { timeout: 5000 });
  return pos;
}

async function myPage(page: Page): Promise<number> {
  return Number(/you p\.(\d+)$/.exec((await pair(page).textContent())!)![1]);
}

test('partners open a shared book; progress is saved, restored and shown live to the other', async ({ browser }) => {
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `alex-${run}@example.com`;
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  await signUp(a, emailA);
  await a.getByLabel('Your name').fill('Alex');
  await a.getByRole('button', { name: 'Start our library' }).click();
  await a.waitForURL('**/library');
  const invite = await a.getByLabel('Invite link').inputValue();

  await signUp(b, `sam-${run}@example.com`);
  await b.goto(invite);
  await b.getByLabel('Your name').fill('Sam');
  await b.getByLabel('#2563eb').check({ force: true });
  await b.getByRole('button', { name: 'Join' }).click();
  await b.waitForURL('**/library');

  await a.reload();
  await a.getByLabel('EPUB file').setInputFiles('fixtures/alice.epub');
  await a.getByRole('button', { name: 'Upload' }).click();
  await expect(a.getByRole('status')).toHaveText(`Added "${TITLE}".`, { timeout: 15_000 });
  await a.getByRole('link', { name: TITLE }).click();
  await a.waitForURL('**/book/*');
  await expect(myPos(a)).toHaveText('0.125000');
  await expect(pair(a)).toHaveText("Sam hasn't started · you p.1");

  const nextA = a.getByRole('button', { name: 'Next page' });
  for (let i = 0; i < 3; i++) await turn(a, () => nextA.click());
  for (let i = 0; i < 2; i++) await turn(a, () => a.keyboard.press('ArrowRight'));
  const reached = await waitForSave(a);
  expect(Number(reached)).toBeGreaterThan(1);

  await a.reload();
  await expect(myPos(a)).toHaveText(reached);

  const bookPath = new URL(a.url()).pathname;
  await b.goto(bookPath);
  await expect(myPos(b)).toHaveText('0.125000');
  const x = await myPage(a);
  await expect(pair(b)).toHaveText(`Alex p.${x} · you p.1`);

  for (let i = 0; i < 3; i++) await turn(a, () => nextA.click());
  await waitForSave(a);
  const x2 = await myPage(a);
  expect(x2).toBeGreaterThan(x);
  await expect(pair(b)).toHaveText(`Alex p.${x2} · you p.1`, { timeout: 3000 });
  await expect(pair(a)).toHaveText(`Sam p.1 · you p.${x2}`);
  await a.screenshot({ path: `${SHOTS}/a-alex-bar.png` });
  await b.screenshot({ path: `${SHOTS}/b-sam-bar.png` });

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: auth } = await db.auth.signInWithPassword({ email: emailA, password: PASSWORD });
  const bookId = bookPath.split('/').pop()!;
  const read = async () => (await db.from('progress').select('pos, max_pos').eq('book_id', bookId).eq('user_id', auth.user!.id).single()).data!;
  const high = await read();
  expect(high.max_pos).toBeGreaterThan(high.pos);

  const prevA = a.getByRole('button', { name: 'Previous page' });
  await turn(a, () => prevA.click());
  await turn(a, () => a.keyboard.press('ArrowLeft'));
  const back = await waitForSave(a);
  await a.reload();
  await expect(myPos(a)).toHaveText(back);
  const after = await read();
  expect(after.pos.toFixed(6)).toBe(back);
  expect(after.pos).toBeLessThan(high.pos);
  expect(after.max_pos).toBe(high.max_pos);
});
