# Bookmarks and send (P23)

**Status: built.** Lives on the same `SelectionMenu`
(`src/features/marks/components.tsx`) as `marks-realtime.md`, plus a
`BookmarksPanel` on `/book/[id]` and a "From \<Partner\>" inbox region on
`/library`. Selectors and the exact scenario below are copied from
`tests/e2e/marks.spec.ts`'s second test, which already drives this markup.
PLAN.md's check: "the send appears in the partner's inbox."

Bookmarks with labels (shared between both partners, not private), and
"Reminded me of you" — send a passage straight to the partner's library
inbox with an optional note.

## Sub-features

- `bookmark-label` — select text, choose "Bookmark", pick one of four
  preset labels or type a custom one; a `mark` row of kind `bookmark`
  appears in both partners' `role="region" name="Bookmarks"` panel.
- `bookmark-open` — clicking a bookmark in the panel navigates to that
  passage (`myPos` becomes the bookmark's `pos`) and closes the panel.
- `send-to-partner` — select text, choose "Send to \<Partner\>", add an
  optional message, send; a `mark` row of kind `send` appears once, in
  the partner's `role="region" name="From \<Sender\>"` inbox on
  `/library`, not painted on the book page.
- `send-open` — the inbox item's "Open in \<title\>" link navigates the
  recipient straight to that passage (`/book/[id]?mark=<id>`).

## How to get to it (user POV)

- Select text on `/book/[id]` → the "Mark this passage" menu → "Bookmark"
  (expands a `role="group" name="Bookmark label"`: four preset buttons
  plus a `aria-label="Custom label"` input) or "Send to \<Partner\>"
  (expands a message textarea `aria-label="Add a message (optional)"` and
  a second "Send to \<Partner\>" button to confirm).
- The "Bookmarks" toggle button in the book page's header opens/closes the
  panel (`aria-expanded`).
- `/library`'s "From \<Partner\>" region lists received sends, oldest
  first; empty state reads "When \<Partner\> sends you a passage, it lands
  here."

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book, both on `/book/[id]`, both at
  `CHAPTER_1` (`twoPartners({ baseURL })` + `openBook()` +
  `toChapter1()` — see `marks-realtime.md`).
- `import { toChapter1, select, nextPage, waitForSaved, paintAt } from '../scripts/drive.mjs'`.

- **A bookmarks a passage.** `const menu = await select(alex.page,
  'Alice was beginning to get very tired')`, `menu.getByRole('button', {
  name: 'Bookmark' }).click()`, then `menu.getByRole('group', { name:
  'Bookmark label' }).getByRole('button', { name: 'Funny part' }).click()`.
  The menu closes and the selection clears.
- **Both partners see it in their Bookmarks panel.** For each page:
  `page.getByRole('button', { name: 'Bookmarks' }).click()`; `const panel
  = page.getByRole('region', { name: 'Bookmarks' })`; `await
  expect(panel.getByRole('button', { name: /^Funny part/
  })).toContainText('Alice was beginning to get very tired', { timeout:
  2000 })`. Note `paintAt(sam.page, ...)` stays `[]` — a bookmark isn't
  painted on the page, only listed.
- **B opens the bookmark.** `panel.getByRole('button', { name: /^Funny
  part/ }).click()` closes the panel and `myPos(sam.page)` reads back
  `CHAPTER_1`.
- **B navigates away, then checks the inbox is empty.** `await
  nextPage(sam.page)`, `await waitForSaved(sam.page)`, `await
  sam.page.goto('/library')`; `const inbox =
  sam.page.getByRole('region', { name: 'From Alex' })`; assert it contains
  "When Alex sends you a passage, it lands here."
- **A sends a different passage.** `const sendMenu = await
  select(alex.page, 'So she was considering in her own mind')`;
  `sendMenu.getByRole('button', { name: 'Send to Sam' }).click()`; fill
  `sendMenu.getByLabel('Add a message (optional)')` with a note; click the
  **second** "Send to Sam" button (`.last()`) to confirm.
- **It lands in B's inbox, once.** `const item =
  inbox.getByRole('listitem')`; `await expect(item).toHaveCount(1, {
  timeout: 3000 })`; `item.locator('blockquote')` has the sent passage's
  exact text; `item` also contains the message.
- **B opens it.** `item.getByRole('link', { name: "Open in Alice's
  Adventures in Wonderland" }).click()`; B lands on
  `/book/[id]?mark=<id>` at `myPos` = `CHAPTER_1` again (the sent
  passage's pos).
- **Proof.** Screenshot the bookmark-labels menu, both partners' bookmark
  panels, the compose form and the inbox with the item visible.

## Gotchas

- The "Bookmark" and "Send" sub-forms live inside the same
  `SelectionMenu` as reactions/highlight/note (`marks-realtime.md`) — the
  menu has 11 buttons total; scope queries to the right sub-`group`/form
  when both are open in a test.
- A bookmark never appears in `paintAt()` — don't assert paint for it; the
  panel listing is the only signal.
- The inbox's confirm button shares its accessible name ("Send to \<Partner\>")
  with the button that opens the compose form — use `.last()` (as the
  spec does) to hit the confirm one, or scope to the expanded sub-form.
- `From \<Partner\>`'s region name is the *sender's* display name, not a
  fixed string — don't hardcode "From Alex" if the run's partner names
  differ from the standard `twoPartners()` fixture.
