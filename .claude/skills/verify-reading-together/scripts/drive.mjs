// Playwright driving helpers for verify-reading-together. Two partners =
// two isolated BrowserContexts (own cookies/storage) in one Chromium
// instance, not two OS processes. Import from a one-off Node ESM script or
// `node --input-type=module -e "import { partner, openReader, selectText }
// from './.claude/skills/verify-reading-together/scripts/drive.mjs'; ..."`.
// Resolves '@playwright/test' from the repo's own node_modules (Node walks
// up from this file's directory), so no extra dependency is needed here.

import { chromium, expect } from '@playwright/test';

let browser;

export async function getBrowser() {
  if (!browser) browser = await chromium.launch();
  return browser;
}

/** New isolated BrowserContext + Page, playing the role of one partner. */
export async function partner(name, { baseURL } = {}) {
  const b = await getBrowser();
  const context = await b.newContext({ baseURL });
  const page = await context.newPage();
  page.__partnerName = name;
  return { context, page };
}

export async function closeAll() {
  if (browser) await browser.close();
  browser = undefined;
}

// --- auth / couple / library -----------------------------------------------
// Selectors and flow copied from tests/e2e/couple.spec.ts and
// tests/e2e/book.spec.ts, which already drive this real markup
// (src/features/couple/forms.tsx, src/app/library/page.tsx). P11/P12 are
// built in this worktree today.

const PASSWORD = 'correct-horse-42';
// src/features/couple/palette.ts COLORS[0] and COLORS[4] — the two colours
// the passing e2e specs pick for Alex and Sam/Bea.
const COLOR_ALEX = '#e11d48';
const COLOR_SAM = '#2563eb';

/** Assumes the page is already on /login (a fresh visit, or a redirect chain that landed there). */
export async function signUp(page, email, password = PASSWORD) {
  await page.getByRole('tab', { name: 'Sign up' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

/** Fills the name/colour fields shared by /onboarding and /join/[code] (ProfileFields in forms.tsx). */
export async function fillProfile(page, name, color) {
  if (name) await page.getByLabel('Your name').fill(name);
  if (color) await page.getByLabel(color, { exact: true }).check({ force: true });
}

/** Assumes the page is already on /onboarding (post-signup, no couple yet). Returns the invite URL. */
export async function createCouple(page, { name, color = COLOR_ALEX } = {}) {
  await fillProfile(page, name, color);
  await page.getByRole('button', { name: 'Start our library' }).click();
  await page.waitForURL('**/library');
  return page.getByLabel('Invite link').inputValue();
}

/**
 * Goes to the invite URL and joins. If the couple is already full or the
 * code is invalid, src/app/join/[code]/page.tsx renders `main [role=alert]`
 * instead of the form — returned as `{ refused: true, message }` instead of
 * throwing, so a "third partner refused" recipe can assert on it.
 */
export async function join(page, inviteUrl, { name, color = COLOR_SAM } = {}) {
  await page.goto(inviteUrl);
  const alert = page.locator('main [role=alert]');
  if (await alert.count()) return { refused: true, message: (await alert.innerText()).trim() };
  await fillProfile(page, name, color);
  await page.getByRole('button', { name: 'Join' }).click();
  await page.waitForURL('**/library');
  return { refused: false };
}

/** Assumes the page is already on /library. Returns the resulting status/alert text (e.g. `Added "Alice's Adventures in Wonderland".`). */
export async function uploadBook(page, filePath) {
  await page.getByLabel('EPUB file').setInputFiles(filePath);
  await page.getByRole('button', { name: 'Upload' }).click();
  const result = page.locator('main [role=status], main [role=alert]').first();
  await result.waitFor({ timeout: 15_000 });
  return (await result.innerText()).trim();
}

/** Navigates to /library (always fresh, so a just-uploaded/shared book is visible) and opens a book by its title link. Returns its book id. */
export async function openBook(page, title) {
  await page.goto('/library');
  await page.getByRole('link', { name: title }).click();
  await page.waitForURL('**/book/*');
  return new URL(page.url()).pathname.split('/').pop();
}

/**
 * Two signed-up partners (Alex, Sam), already joined in one couple, with
 * fixtures/alice.epub uploaded and shared. Ready for openBook(page, title).
 */
export async function twoPartners({ baseURL } = {}) {
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const alex = await partner('alex', { baseURL });
  const sam = await partner('sam', { baseURL });

  await alex.page.goto('/login');
  await signUp(alex.page, `alex-${run}@example.test`);
  await alex.page.waitForURL('**/onboarding');
  const invite = await createCouple(alex.page, { name: 'Alex', color: COLOR_ALEX });

  await sam.page.goto(invite);
  await signUp(sam.page, `sam-${run}@example.test`);
  await sam.page.waitForURL(invite);
  await fillProfile(sam.page, 'Sam', COLOR_SAM);
  await sam.page.getByRole('button', { name: 'Join' }).click();
  await sam.page.waitForURL('**/library');

  await alex.page.reload();
  await uploadBook(alex.page, 'fixtures/alice.epub');

  return { alex, sam, run, invite };
}

// --- book progress (P13b/P15) -----------------------------------------------
// Selectors and the turn-page retry logic copied from tests/e2e/book.spec.ts,
// which already drives this real markup (src/app/book/[id]/book-reader.tsx).
// Distinct from the /dev/reader helpers below: these drive the real
// signed-in reading page, through its Next/Previous page buttons, not
// window.__reader directly.

export const myPos = (page) => page.getByTestId('my-pos');
export const progressPair = (page) => page.getByTestId('progress-pair');

/** Reads the partner-progress line's "you p.N" page number. */
export async function myPage(page) {
  const text = await progressPair(page).textContent();
  return Number(/you p\.(\d+)$/.exec(text ?? '')?.[1]);
}

// A turn across a section boundary relocates through the section start
// first; the Next/Previous buttons re-enable once it settles.
async function settle(page, how) {
  const nextBtn = page.getByRole('button', { name: 'Next page' }); // shares the `turning` disabled state with Previous page
  await expect(nextBtn).toBeEnabled();
  const before = await myPos(page).textContent();
  await how();
  await expect(myPos(page)).not.toHaveText(before ?? '');
  await expect(nextBtn).toBeEnabled();
}

export const nextPage = (page) => settle(page, () => page.getByRole('button', { name: 'Next page' }).click());
export const prevPage = (page) => settle(page, () => page.getByRole('button', { name: 'Previous page' }).click());

/** Waits for the debounced progress save to catch up with the visible pos. Returns the saved pos string. */
export async function waitForSaved(page) {
  const pos = await myPos(page).textContent();
  await expect(page.getByTestId('saved-pos')).toHaveText(pos ?? '', { timeout: 5000 });
  return pos;
}

// --- reader ----------------------------------------------------------------
// Built on window.__reader (features/reader, shipped in P13a). Live today
// via /dev/reader, which serves fixtures/alice.epub and 404s outside
// development (src/app/dev/reader/page.tsx).

export async function openReader(page, { baseURL = '' } = {}) {
  await page.goto(`${baseURL}/dev/reader`);
  await page.waitForFunction(() => window.__reader);
}

export const goTo = (page, target) => page.evaluate((t) => window.__reader.goTo(t), target);
export const next = (page) => page.evaluate(() => window.__reader.next());
export const prev = (page) => page.evaluate(() => window.__reader.prev());
export const setFontScale = (page, scale) => page.getByLabel('Font size').selectOption(String(scale));
export const paint = (page, marks) => page.evaluate((m) => window.__reader.paint(m), marks);
export const readPos = async (page) => Number(await page.getByTestId('pos').textContent());
export const readPageEndPos = async (page) => Number(await page.getByTestId('page-end-pos').textContent());

// --- marks / bookmarks / discussion / reveal / sync (P14b, P21, P23, P31, P43, P51) ---------
// Selectors copied from tests/e2e/helpers.ts and marks.spec.ts/reveal.spec.ts/sync.spec.ts,
// which already drive this real markup (src/features/marks/components.tsx,
// src/app/book/[id]/book-reader.tsx). Distinct from the /dev/reader `selectText` above: these
// find text inside the real signed-in book page's iframe (a blob: URL, not /dev/reader's).

// A first open lands mid front-matter; every one-partner-book fixture (fixtures/alice.epub)
// reaches this exact pos at chapter 1's first line ("Alice was beginning to get very tired...").
export const CHAPTER_1 = '2.000087';

/** Pages forward (up to 8 turns) until `myPos` reads CHAPTER_1; asserts it got there. */
export async function toChapter1(page) {
  for (let i = 0; i < 8 && (await myPos(page).textContent()) !== CHAPTER_1; i++) await nextPage(page);
  await expect(myPos(page)).toHaveText(CHAPTER_1);
  await waitForSaved(page);
}

/** Pages forward (up to 40 turns) until `done(pos)` is true; asserts it got there. `beforeEachTurn` runs before every turn (e.g. to assert an invariant along the way). */
export async function pageUntil(page, done, beforeEachTurn = async () => {}) {
  for (let i = 0; i < 40 && !done(await myPos(page).textContent()); i++) {
    await beforeEachTurn();
    await nextPage(page);
  }
  expect(done(await myPos(page).textContent())).toBe(true);
}

export const thread = (page) => page.getByRole('region', { name: 'Thread' });
export const revealToast = (page) => page.getByRole('status').filter({ hasText: 'New from' });
export const syncPill = (page) => page.getByTestId('sync-pill');

/** Finds `needle` in the book's rendered section iframe (a blob: URL), optionally selects it, and returns its first line's centre in page coordinates (for a click) plus its top/bottom (for paintAt's overlap test). */
export async function locate(page, needle, selectIt = false) {
  let found = null;
  await expect
    .poll(async () => {
      for (const f of page.frames()) {
        if (!f.url().startsWith('blob:')) continue;
        found = await f
          .evaluate(
            ([n, sel]) => {
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              for (let t = walker.nextNode(); t; t = walker.nextNode()) {
                const at = t.data.indexOf(n);
                if (at === -1) continue;
                const range = document.createRange();
                range.setStart(t, at);
                range.setEnd(t, at + n.length);
                if (sel) {
                  document.getSelection().removeAllRanges();
                  document.getSelection().addRange(range);
                }
                const r = range.getClientRects()[0];
                const frame = window.frameElement.getBoundingClientRect();
                return { x: frame.x + r.x + r.width / 2, y: frame.y + r.y + r.height / 2, top: frame.y + r.top, bottom: frame.y + r.bottom };
              }
              return null;
            },
            [needle, selectIt],
          )
          .catch(() => null);
        if (found) return true;
      }
      return false;
    })
    .toBe(true);
  return found;
}

/** Selects `needle` on the real book page and waits for the "Mark this passage" menu; returns its locator. */
export async function select(page, needle) {
  await locate(page, needle, true);
  const menu = page.getByRole('group', { name: 'Mark this passage' });
  await expect(menu).toBeVisible();
  return menu;
}

/** Clicks `needle` (no selection) — opens an existing mark's thread. */
export async function tap(page, needle) {
  const { x, y } = await locate(page, needle);
  await page.mouse.click(x, y);
}

/** Reads every painted mark overlay from the foliate-view (id, fill colour, opacity, bounding box). */
export async function overlays(page) {
  return page.evaluate(() => {
    const view = document.querySelector('foliate-view');
    return view.renderer.getContents().flatMap((c) =>
      [...(c.overlayer?.element.querySelectorAll('[data-mark-id]') ?? [])].map((g) => {
        const r = g.getBoundingClientRect();
        return { id: g.dataset.markId, fill: g.getAttribute('fill'), opacity: g.style.opacity, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
      }),
    );
  });
}

/** overlays() filtered to the ones painted at `needle`'s line (an underline sits under the line box, so match on overlap, not centre). */
export async function paintAt(page, needle) {
  const { x, top, bottom } = await locate(page, needle);
  const all = await overlays(page);
  const here = all.filter(({ box: b }) => x >= b.x && x <= b.x + b.width && b.y <= bottom + 4 && b.y + b.height >= top - 4);
  return here.map(({ id, fill, opacity }) => ({ id, fill, opacity, count: all.filter((o) => o.id === id).length }));
}

async function trySelectOnce(page, needle, len) {
  for (const f of page.frames()) {
    const ok = await f
      .evaluate(
        ({ needle, len }) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const at = n.data.indexOf(needle);
            if (at === -1) continue;
            const range = document.createRange();
            range.setStart(n, at);
            range.setEnd(n, Math.min(n.data.length, at + len));
            document.getSelection().removeAllRanges();
            document.getSelection().addRange(range);
            return true;
          }
          return false;
        },
        { needle, len },
      )
      .catch(() => false);
    if (ok) return true;
  }
  return false;
}

// Selects the first `len` chars at `needle`, in whichever frame renders it
// (foliate renders into an iframe — same technique as reader.spec.ts).
// Returns data-testid="selection-pos" once the select handler updates it.
export async function selectText(page, needle, len = 20) {
  const deadline = Date.now() + 10_000;
  let found = false;
  while (!found) {
    found = await trySelectOnce(page, needle, len);
    if (!found) {
      if (Date.now() > deadline) throw new Error(`selectText: "${needle}" not found in any frame within 10s`);
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(300); // let the reader's debounced select handler update the DOM
  return (await page.getByTestId('selection-pos').textContent())?.trim();
}
