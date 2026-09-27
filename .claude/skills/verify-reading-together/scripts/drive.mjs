// Playwright driving helpers for verify-reading-together. Two partners =
// two isolated BrowserContexts (own cookies/storage) in one Chromium
// instance, not two OS processes. Import from a one-off Node ESM script or
// `node --input-type=module -e "import { partner, openReader, selectText }
// from './.claude/skills/verify-reading-together/scripts/drive.mjs'; ..."`.
// Resolves '@playwright/test' from the repo's own node_modules (Node walks
// up from this file's directory), so no extra dependency is needed here.

import { chromium } from '@playwright/test';

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

// --- auth / couple / library ---------------------------------------------
// These depend on the P11 (/login, /onboarding, /join/[code]) and P12
// (/library) pages, which are being built in another worktree and are not
// in this one yet. Rather than silently no-op, they fail loudly so a run
// against this worktree reports "not built yet" instead of a false pass.
// Update the selectors below once those pages land — see
// features/auth-and-couple.md and features/library-upload.md.

async function requirePage(page, path, label) {
  const res = await page.goto(path);
  if (!res || res.status() === 404) {
    throw new Error(
      `${path} is 404 — ${label} depends on P11/P12 pages not yet in this worktree. ` +
        'See features/auth-and-couple.md and features/library-upload.md.',
    );
  }
  return res;
}

export async function signUp(page, email, password, { baseURL = '' } = {}) {
  await requirePage(page, `${baseURL}/login`, 'signUp');
  await page.getByRole('link', { name: /sign up/i }).click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();
}

/** Calls the create_couple RPC via the UI. Returns the invite code. */
export async function createCouple(page, { name, color } = {}) {
  await page.getByRole('button', { name: /create couple/i }).click();
  if (name) await page.getByLabel(/^name$/i).fill(name);
  if (color) await page.getByLabel(/color/i).fill(color);
  await page.getByRole('button', { name: /^create$/i }).click();
  return (await page.getByTestId('invite-code').textContent())?.trim();
}

/** Calls the join_couple RPC via the UI. join_couple raises "couple is full" for a third member (docs/interfaces.md). */
export async function join(page, inviteCode, { baseURL = '' } = {}) {
  await requirePage(page, `${baseURL}/join/${inviteCode}`, 'join');
  await page.getByRole('button', { name: /^join$/i }).click();
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
