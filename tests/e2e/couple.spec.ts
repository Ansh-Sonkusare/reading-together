import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const run = Date.now().toString(36);
const testResultsDir = join(process.cwd(), 'test-results');
mkdirSync(testResultsDir, { recursive: true });

async function signUp(page: Page, label: string) {
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(`${label}-${run}@test.local`);
  await page.getByLabel('Password').fill('password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
}

async function profile(page: Page, name: string, colorIndex: number) {
  await page.getByLabel('Your name').fill(name);
  await page.locator('input[name=color]').nth(colorIndex).check({ force: true });
}

const shelf = (page: Page) => page.getByRole('list', { name: 'Our shelf' });

async function shot(page: Page, name: string) {
  const path = join(testResultsDir, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
}

test('couple flow: sign up, join, upload books, exceed 50MB limit', async ({ baseURL, browser }) => {
  const contextA = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const A = await contextA.newPage();
  const B = await browser.newContext().then((ctx) => ctx.newPage());
  const C = await browser.newContext().then((ctx) => ctx.newPage());

  try {
    // A signs up and creates couple
    await A.goto(baseURL!);
    expect(new URL(A.url()).pathname).toBe('/login');
    await signUp(A, 'a');
    await A.waitForURL('**/onboarding');
    await profile(A, 'Alex', 0);
    await A.getByRole('button', { name: 'Start our library' }).click();
    await A.waitForURL('**/library');
    await A.getByRole('heading', { name: 'Invite your partner' }).waitFor();
    await A.getByRole('button', { name: 'Copy' }).click();
    const invite = await A.evaluate(() => navigator.clipboard.readText());
    expect(invite).toMatch(new RegExp(`^${baseURL!.replace(/[/.]/g, '\\$&')}/join/[0-9a-f]{10}$`));
    await shot(A, '1-a-library-invite');

    // B joins via invite
    await B.goto(invite);
    expect(new URL(B.url()).pathname + new URL(B.url()).search).toBe(
      `/login?next=${encodeURIComponent(new URL(invite).pathname)}`
    );
    await signUp(B, 'b');
    await B.waitForURL(invite);
    await profile(B, 'Bea', 4);
    await shot(B, '2-b-join-form');
    await B.getByRole('button', { name: 'Join' }).click();
    await B.waitForURL('**/library');
    const readersB = await B.getByRole('heading', { level: 1 }).innerText();
    expect(readersB.split('&').map((s) => s.trim()).sort()).toEqual(['Alex', 'Bea']);
    expect(await B.getByRole('heading', { name: 'Invite your partner' }).count()).toBe(0);
    await shot(B, '3-b-library-joined');

    // A reloads, invite is gone
    await A.reload();
    expect(await A.getByRole('heading', { name: 'Invite your partner' }).count()).toBe(0);

    // C tries to join but couple is full
    await C.goto(invite);
    await signUp(C, 'c');
    await C.waitForURL(invite);
    const alert = await C.locator('main [role=alert]').innerText();
    expect(alert).toBe('This couple already has two readers.');
    await shot(C, '4-c-couple-full');

    // Upload alice.epub
    await A.locator('input[type=file]').setInputFiles('./fixtures/alice.epub');
    await A.getByRole('button', { name: 'Upload' }).click();
    await shelf(A).getByRole('link', { name: "Alice's Adventures in Wonderland" }).waitFor();
    await shot(A, '5-a-uploaded');

    // B sees the book
    await B.reload();
    const row = await shelf(B).getByRole('listitem').filter({ hasText: "Alice's Adventures in Wonderland" }).innerText();
    expect(row).toMatch(/Alice's Adventures in Wonderland\s+Lewis Carroll/);
    await shot(B, '6-b-sees-book');

    // B re-uploads alice.epub (same bytes)
    await B.locator('input[type=file]').setInputFiles('./fixtures/alice.epub');
    await B.getByRole('button', { name: 'Upload' }).click();
    await B.locator('main [role=status]').filter({ hasText: 'already' }).waitFor();
    expect(await shelf(B).getByRole('listitem').filter({ hasText: "Alice's Adventures" }).count()).toBe(1);

    // B uploads package.json (not an EPUB)
    await B.locator('input[type=file]').setInputFiles('./package.json');
    await B.getByRole('button', { name: 'Upload' }).click();
    await B.locator('main [role=alert]').waitFor();

    // B uploads pride-and-prejudice.epub
    await B.locator('input[type=file]').setInputFiles('./fixtures/pride-and-prejudice.epub');
    await B.getByRole('button', { name: 'Upload' }).click();
    await B.locator('main [role=status]').filter({ hasText: 'Pride and Prejudice' }).waitFor({ timeout: 60_000 });
    await A.reload();
    const table = await shelf(A).innerText();
    expect(table).toMatch(/Pride and Prejudice\s+Jane Austen/);
    await shot(A, '8-a-library-two-books');

    // Create and upload a 50 MB + 1 byte file
    const hugeEpubPath = join(testResultsDir, 'huge.epub');
    const hugeBuffer = Buffer.alloc(50 * 1024 * 1024 + 1);
    writeFileSync(hugeEpubPath, hugeBuffer);

    await A.locator('input[type=file]').setInputFiles(hugeEpubPath);
    expect(await A.locator('main [role=alert]').innerText()).toBe('That file is over 50 MB.');
    expect(await A.getByRole('button', { name: 'Upload' }).isDisabled()).toBe(true);
  } finally {
    await A.close();
    await B.close();
    await C.close();
  }
});
