# Reader (P13a)

The reader renders `fixtures/alice.epub` at `/dev/reader`, a dev-only route
(`src/app/dev/reader/page.tsx` calls `notFound()` when `NODE_ENV === 'production'`).
It computes a layout-independent `pos` for the visible page, paginates,
lets the user select text, and paints marks (highlights) that are clickable.
This is the one feature this skill can drive fully today.

## Sub-features

- `pos-stability` — the same passage resolves to the same `pos` (and the
  same `selection-pos` when selected) regardless of font size or viewport.
- `paging` — `next()`/`prev()` move `pos` monotonically; `page-end-pos`
  (the value written to `progress.max_pos`) always covers `pos`.
- `highlight-paint` — `paint()` renders a clickable overlay; clicking it
  fires `markClick`.

## How to get to it (user POV)

- Navigate to `/dev/reader` (dev server only; 404s in production).
- `‹ prev` / `next ›` buttons (`aria-label="Previous page"` / `"Next page"`).
- `Font size` select (`aria-label="Font size"`), options 80/100/120/160/200%
  (values `0.8`, `1`, `1.2`, `1.6`, `2`).
- Selecting text in the rendered page (the reader listens for the browser's
  native `selectionchange`).

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- `import { partner, openReader, goTo, next, setFontScale, selectText, paint, readPos, readPageEndPos } from '../scripts/drive.mjs'`.

- **Open the reader.** `const { page } = await partner('reader')` then
  `await openReader(page, { baseURL })` — waits for `window.__reader`; the
  page auto-loads `fixtures/alice.epub` and calls `goTo(0)`.
- **Go to a passage.** `await goTo(page, 4.5)`. `pos` reads `≤ 4.5`,
  `page-end-pos` reads `≥ 4.5`.
- **Select text.** `await selectText(page, 'the Dodo replied very gravely')`
  returns `selection-pos` — the spike recorded this exact passage as
  `4.504220` at every layout (`docs/research/reader-spike.md`).
- **Change font size and re-select.** `await setFontScale(page, 1.6)`, then
  `selectText` the same passage again. The returned `selection-pos` must be
  **identical** to the 100% run — that identity is the proof of
  `pos-stability`.
- **Page forward.** `await next(page)` three times; `readPos` must strictly
  increase each time, `readPageEndPos` must stay `>=` the new `pos`.
- **Paint and click a highlight.** Capture a selection's `locator` (from
  `window.__selected`, or reuse `selectText`'s), then `await paint(page,
  [{ id: 'm1', locator, color: '#e11d48', kind: 'highlight' }])`. Click the
  resulting `[data-mark-id="m1"]` inside the `foliate-view` overlayer;
  `mark-clicked` reads `m1`.
- **Proof.** Screenshot after each font-size selection (`reader-100.png`,
  `reader-160.png`), record both `selection-pos` values in the transcript.

## Gotchas

- The book renders inside an iframe (`foliate-view`'s shadow/child
  document). Search `page.frames()`, not just the top page, when locating
  text — `drive.mjs`'s `selectText` already does this.
- `pos`/`page-end-pos`/`selection-pos` are formatted with `.toFixed(6)`;
  compare the exact strings, not parsed floats, when proving stability.
- `/dev/reader` 404s when `NODE_ENV=production`; always launch with `pnpm
  dev`, never `pnpm build && pnpm start`.
- `window.__lengthMismatches` should stay `[]` across the whole run — a
  non-empty array means the fixture's `spine_lengths` don't match what the
  reader actually rendered (a real regression, not a flaky check).
- The font-size select's values are numeric strings (`"1.6"`), not labels
  (`"160%"`) — `setFontScale` passes the value, matching the `<option
  value={s}>` in `dev-reader.tsx`.
