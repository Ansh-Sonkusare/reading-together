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

// Alex starts the library (first ink, Rose #d6336c) and Sam joins it in Cobalt #3b5bdb.
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
  await pageB.getByLabel('Cobalt').check({ force: true });
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

export async function pageUntil(page: Page, done: (pos: string | null) => boolean) {
  for (let i = 0; i < 40 && !done(await myPos(page).textContent()); i++) {
    await turn(page, () => page.getByRole('button', { name: 'Next page' }).click());
  }
  expect(done(await myPos(page).textContent())).toBe(true);
}

export const CHAPTER_1 = '2.000087';
export const thread = (page: Page) => page.getByRole('region', { name: 'Thread' });

export type Box = { x: number; y: number; width: number; height: number };
export type Overlay = { id: string; fill: string | null; opacity: string; box: Box };

export async function toChapter1(page: Page) {
  for (let i = 0; i < 8 && (await myPos(page).textContent()) !== CHAPTER_1; i++) {
    await turn(page, () => page.getByRole('button', { name: 'Next page' }).click());
  }
  await expect(myPos(page)).toHaveText(CHAPTER_1);
  await waitForSave(page);
}

// Finds the passage in the book's section iframe, optionally selects it, and returns its first line's centre in page coordinates.
export type Spot = { x: number; y: number; top: number; bottom: number };

export async function locate(page: Page, needle: string, selectIt = false): Promise<Spot> {
  let found: Spot | null = null;
  await expect
    .poll(async () => {
      for (const f of page.frames()) {
        if (!f.url().startsWith('blob:')) continue;
        found = await f
          .evaluate(
            ([n, sel]) => {
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
                const at = t.data.indexOf(n);
                if (at === -1) continue;
                const range = document.createRange();
                range.setStart(t, at);
                range.setEnd(t, at + n.length);
                if (sel) {
                  document.getSelection()!.removeAllRanges();
                  document.getSelection()!.addRange(range);
                }
                const r = range.getClientRects()[0];
                const frame = window.frameElement!.getBoundingClientRect();
                return { x: frame.x + r.x + r.width / 2, y: frame.y + r.y + r.height / 2, top: frame.y + r.top, bottom: frame.y + r.bottom };
              }
              return null;
            },
            [needle, selectIt] as const,
          )
          .catch(() => null);
        if (found) return true;
      }
      return false;
    })
    .toBe(true);
  return found!;
}

export async function select(page: Page, needle: string) {
  await locate(page, needle, true);
  const menu = page.getByRole('group', { name: 'Mark this passage' });
  await expect(menu).toBeVisible();
  return menu;
}

export async function tap(page: Page, needle: string) {
  const { x, y } = await locate(page, needle);
  await page.mouse.click(x, y);
}

export async function overlays(page: Page): Promise<Overlay[]> {
  return page.evaluate(() => {
    type Contents = { overlayer?: { element: SVGElement } }[];
    const view = document.querySelector('foliate-view') as unknown as { renderer: { getContents(): Contents } };
    return view.renderer.getContents().flatMap((c) =>
      [...(c.overlayer?.element.querySelectorAll<SVGGElement>('[data-mark-id]') ?? [])].map((g) => {
        const r = g.getBoundingClientRect();
        return { id: g.dataset.markId!, fill: g.getAttribute('fill'), opacity: g.style.opacity, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
      }),
    );
  });
}

export async function paintAt(page: Page, needle: string): Promise<Omit<Overlay, 'box'>[]> {
  const { x, top, bottom } = await locate(page, needle);
  const all = await overlays(page);
  // An underline sits under the line box rather than across its middle, so match on overlap with the line.
  const here = all.filter(({ box: b }) => x >= b.x && x <= b.x + b.width && b.y <= bottom + 4 && b.y + b.height >= top - 4);
  return here.map(({ id, fill, opacity }) => ({ id, fill, opacity, count: all.filter((o) => o.id === id).length }));
}
