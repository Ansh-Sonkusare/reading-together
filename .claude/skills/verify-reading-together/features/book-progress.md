# Book progress (P13b/P15)

**Status: built.** `/book/[id]` (`src/app/book/[id]/page.tsx`,
`book-reader.tsx`) is live in this worktree. Selectors and the turn-page
retry logic below are copied from `tests/e2e/book.spec.ts`, which already
drives this exact markup. Depends on a shared book
(`features/library-upload.md`, or just call `twoPartners()` +
`openBook()`).

Opens a book from Storage, saves reading progress debounced
(`pos`/`max_pos`/`locator`), restores position on reload, and shows both
partners' pages live in the header ("Alex p.42 · you p.38",
`src/features/couple/progress.ts`'s Realtime subscription).

## Sub-features

- `open-and-restore` — opening a book for the first time starts at `pos` 0;
  reopening later restores the saved position exactly.
- `debounced-save` — turning pages updates the visible `pos` immediately;
  the saved `pos`/`max_pos` catches up shortly after (`data-testid="saved-pos"`).
- `high-water-mark` — `max_pos` only ever increases; paging backward moves
  `pos` down but leaves `max_pos` where it was.
- `live-pair-bar` — the partner's page number in the header updates without
  a reload, within a few seconds of the partner turning a page.

## How to get to it (user POV)

- Click a book's title link on `/library`, or navigate to `/book/[id]`
  directly.
- `‹`/`›` buttons (`aria-label="Previous page"`/`"Next page"`), and the
  `ArrowLeft`/`ArrowRight` keys.
- The header's `data-testid="progress-pair"` text: "\<Partner\> p.N · you
  p.M" (or "\<Partner\> hasn't started" before they've saved any progress).

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and an uploaded book — `twoPartners({
  baseURL })` gives you both, already on `/library` with `fixtures/alice.epub`
  uploaded.
- `import { openBook, nextPage, prevPage, myPos, progressPair, myPage, waitForSaved } from '../scripts/drive.mjs'`.

- **Open the book.** `await openBook(alex.page, "Alice's Adventures in
  Wonderland")` — clicks the title link on `/library`, waits for
  `/book/*`. `myPos(alex.page)` reads `0.125000` on a first open (chapter 1
  start), and `progressPair(alex.page)` reads "Sam hasn't started · you p.1"
  before Sam has opened anything.
- **Turn pages as Alex.** `for (let i = 0; i < 3; i++) await
  nextPage(alex.page)` — clicks "Next page" and waits for `my-pos` to
  change and the button to re-enable (a turn across a section boundary
  relocates through the section start first). `await
  waitForSaved(alex.page)` waits for `data-testid="saved-pos"` to catch up
  with the debounced save.
- **Sam sees Alex's page live.** `await openBook(sam.page, "Alice's
  Adventures in Wonderland")`. `const alexPage = await myPage(alex.page)`;
  assert `await progressPair(sam.page).textContent()` reads
  `` `Alex p.${alexPage} · you p.1` `` **within 3 seconds**
  (`expect(...).toHaveText(..., { timeout: 3000 })`) — a real timing
  assertion, not "assert it eventually appears."
- **Restore on reload.** `await alex.page.reload()`; assert `myPos(alex.page)`
  still reads the saved pos from before the reload.
- **Proof.** Screenshot both partners' book views right after the
  3-second assertion passes (`a-alex-bar.png`, `b-sam-bar.png`).

## Gotchas

- `nextPage`/`prevPage` (not a bare button click) are the proven way to
  drive page turns reliably — they wait for the Next/Previous buttons to
  re-enable, which a bare click skips, causing a dropped turn mid-relocate.
- `progressPair`'s page numbers are 1-based display pages
  (`displayPage(pos, spineLengths)`), not raw `pos` — compare against
  `myPage()`'s parsed value, not `myPos()`'s raw float.
- The header shows "\<Partner\> hasn't started" until the partner's first
  debounced save lands — don't assert a page number there until after
  `waitForSaved` on their page.
