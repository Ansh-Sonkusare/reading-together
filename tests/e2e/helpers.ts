import { expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

export const PASSWORD = 'correct-horse-42';
export const TITLE = "Alice's Adventures in Wonderland";

export async function signUp(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/onboarding');
}

// Alex starts the library (first colour, #e11d48) and Sam joins it in #2563eb.
export async function pairUp(browser: Browser, b: BrowserContextOptions = {}) {
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `alex-${run}@example.com`;
  const pageA = await (await browser.newContext()).newPage();
  const pageB = await (await browser.newContext(b)).newPage();

  await signUp(pageA, emailA);
  await pageA.getByLabel('Your name').fill('Alex');
  await pageA.getByRole('button', { name: 'Start our library' }).click();
  await pageA.waitForURL('**/library');
  const invite = await pageA.getByLabel('Invite link').inputValue();

  await signUp(pageB, `sam-${run}@example.com`);
  await pageB.goto(invite);
  await pageB.getByLabel('Your name').fill('Sam');
  await pageB.getByLabel('#2563eb').check({ force: true });
  await pageB.getByRole('button', { name: 'Join' }).click();
  await pageB.waitForURL('**/library');
  return { a: pageA, b: pageB, emailA };
}

export async function uploadAndOpen(page: Page): Promise<string> {
  await page.reload();
  await page.getByLabel('EPUB file').setInputFiles('fixtures/alice.epub');
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(page.getByRole('status')).toHaveText(`Added "${TITLE}".`, { timeout: 15_000 });
  await page.getByRole('link', { name: TITLE }).click();
  await page.waitForURL('**/book/*');
  return new URL(page.url()).pathname;
}

export const myPos = (page: Page) => page.getByTestId('my-pos');
export const pair = (page: Page) => page.getByTestId('progress-pair');

// A turn across a section boundary relocates through the section start first; the buttons re-enable once it settles.
export async function turn(page: Page, how: () => Promise<void>) {
  const next = page.getByRole('button', { name: 'Next page' });
  await expect(next).toBeEnabled();
  const before = await myPos(page).textContent();
  await how();
  await expect(myPos(page)).not.toHaveText(before!);
  await expect(next).toBeEnabled();
}

export async function waitForSave(page: Page): Promise<string> {
  const pos = (await myPos(page).textContent())!;
  await expect(page.getByTestId('saved-pos')).toHaveText(pos, { timeout: 5000 });
  return pos;
}

export async function myPage(page: Page): Promise<number> {
  return Number(/you p\.(\d+)$/.exec((await pair(page).textContent())!)![1]);
}
