# Reader prefs: theme, text size, dark mode (P44)

**Status: built.** `ReaderPrefs` (`src/features/reader/prefs.tsx`) is a
disclosure (`<details><summary aria-label="Reading settings">`) on
`/book/[id]`'s header, and rendered inline (no disclosure) on `/dev/reader`.
Prefs persist in `localStorage`, not the DB — they're a device setting,
not something the couple shares. Selectors and the exact values below are
copied from `tests/e2e/book-prefs.spec.ts` and `tests/e2e/prefs.spec.ts`,
which already drive this markup.

Four independent controls: reading theme (a named palette applied inside
the book iframe), text size, a free colour override for the reading
background, and a separate app-wide light/dark/system theme (outside the
book, e.g. buttons).

## Sub-features

- `reading-theme` — `aria-label="Reading theme"` select: light / sepia /
  dark / night, each a fixed `{ background, color }` pair from `THEMES` in
  `src/features/reader/prefs.tsx`, applied to the book iframe's `<body>`.
- `text-size` — `aria-label="Text size"` select, `FONT_SCALES` = 80/90/100/
  110/120/140/160%; changes the book iframe's root font size and, per
  `pos-stability` (`reader.md`), never changes the selection's `pos`.
- `reading-background` — `aria-label="Reading background"` colour input;
  overrides just the theme's background (keeps its text colour), and
  choosing a named theme afterward clears the override.
- `app-theme` — `aria-label="App theme"` select: system / light / dark;
  toggles `html.dark` and restyles UI chrome outside the book (e.g.
  `Button`'s background), independent of the reading theme.
- `persists-across-reload` — all four survive a reload, read back from
  `localStorage` before first paint (no flash of the old theme).

## How to get to it (user POV)

- `/book/[id]`: click the "Aa" `aria-label="Reading settings"` disclosure
  in the header to reveal the four controls.
- `/dev/reader`: the same four controls, always visible (dev-only route,
  no disclosure).

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- On `/book/[id]`: a partner with a shared book, past the disclosure
  (`twoPartners({ baseURL })` + `openBook()` + `page.getByLabel('Reading
  settings').click()` — `book-progress.md`). On `/dev/reader`: just
  `openReader(page, { baseURL })` — no disclosure to open.
- A helper to read the book iframe's live computed style isn't in
  drive.mjs (it's a one-off `page.frames()` walk over non-main frames
  reading `getComputedStyle`, three lines per `prefs.spec.ts`) — write it
  inline in the driving script rather than adding a new export for a
  single read.

- **Reading theme recolours the book.** `await
  page.getByLabel('Reading theme').selectOption('night')`; poll the book
  iframe's `getComputedStyle(document.body).backgroundColor` until it's
  `'rgb(0, 0, 0)'`.
- **Text size changes font, not pos.** `await page.getByLabel('Text
  size').selectOption('1.4')`; the iframe's root `font-size` becomes
  `'22.4px'` (`16 * 1.4`); re-select the same passage
  (`marks-realtime.md`'s `select`/`locate`) and confirm its position
  string is unchanged from before the resize.
- **Background overrides just the background.** `await
  page.getByLabel('Reading background').fill('#203040')`; body background
  becomes `'rgb(32, 48, 64)'`, text colour stays the current theme's.
  Picking a named theme afterward (`selectOption('sepia')`) clears the
  override back to that theme's own background.
- **Reload restores every value.** `await page.reload()`; before
  re-opening the disclosure, the book already renders in the saved theme
  (poll background again); then `await
  expect(page.getByLabel('Reading theme')).toHaveValue('night')` (or
  whichever was last set) confirms the control itself reads back too.
- **App theme is independent of reading theme.** `await
  page.getByLabel('App theme').selectOption('dark')`; `await
  expect(page.locator('html')).toHaveClass(/\bdark\b/)`; a `Button`
  outside the book recolours; the book iframe's own background is
  untouched by this control. `selectOption('system')` then
  `page.emulateMedia({ colorScheme: 'dark' })` confirms the system branch
  actually watches the OS preference.
- **Proof.** Screenshot each of the four reading themes and one app-theme
  state; record the exact `rgb(...)`/`px` values asserted, not just "looks
  different."

## Gotchas

- These are two *different* colour systems reading two different
  `localStorage` keys (`reader:prefs` for the book, `app:theme` for the
  app chrome) — don't assert one implies the other; `book-prefs.spec.ts`
  and `prefs.spec.ts` cover them separately on purpose.
- The book's computed style must be read from the iframe document, not
  the top page — `getComputedStyle` on the top page's `<body>` will read
  Tailwind's own light/dark classes, not the reading theme.
- Colours are compared as browser-computed `rgb(...)` strings, not the
  hex values from `THEMES`/the colour input — Chromium normalizes on
  read; compare against the `rgb(...)` form, not the hex you set.
- Prefs are per-browser-profile (`localStorage`), never synced between
  partners — don't expect A's theme choice to show up on B's page.
