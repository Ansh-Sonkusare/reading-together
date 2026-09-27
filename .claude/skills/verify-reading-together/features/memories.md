# Memories (P43)

**Status: built.** A photo + caption attached to an existing mark, added
from its `ThreadPanel` (`src/features/marks/components.tsx`), delivered
live over the same `book:{id}` channel as `marks-realtime.md`, and listed
on the couple's timeline (`together-stats-timeline.md`). Selectors and the
exact scenario below are copied from `tests/e2e/memories.spec.ts`, which
already drives this markup.

A memory is its own `mark` row of kind `memory`, a reply-shaped child of
the highlight/reaction it's attached to — not a field on the parent mark.

## Sub-features

- `add-memory` — from an open thread, "Add a memory 📸" expands a
  `role="form" name="Add a memory"`: a `aria-label="Photo"` file input and
  a `aria-label="Caption"` field, saved with "Save memory".
- `memory-in-thread` — the memory appears as its own
  `role="listitem" name="Memory"` in the thread, "📸 You: \<caption\>" (or
  "📸 \<Author\>: \<caption\>" for the partner), ordered after the mark it's
  attached to.
- `photo-delivery` — the photo itself (not just the caption) loads for the
  partner, live, without reload.
- `memory-on-timeline` — `/together/book/[bookId]`'s timeline gets a
  "📸 \<Author\> added a memory" line, and the couple's stats tile counts
  it ("❤️ N memories created" — see `together-stats-timeline.md` for the
  tile itself; the exact label lives here since it's memory-specific).

## How to get to it (user POV)

- Click an existing mark on `/book/[id]` to open its `aria-label="Thread"`
  panel, then "Add a memory 📸".
- The saved memory renders inline in that same thread for both partners.
- `/together/book/[bookId]`'s `aria-label="Timeline"` list.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book, both on `/book/[id]`, both at
  `CHAPTER_1`, and A has already highlighted a passage B can see
  (`toChapter1()` + `select()`+"Highlight" — `marks-realtime.md`).
- A real photo fixture, not a stand-in — `fixtures/memory.jpg` (per
  standing order 4).
- `import { toChapter1, select, tap, thread, paintAt } from '../scripts/drive.mjs'`.

- **A highlights, B sees it painted.** `(await select(alex.page, 'Alice
  was beginning to get very tired')).getByRole('button', { name:
  'Highlight' }).click()`; `await expect.poll(() => paintAt(sam.page,
  'Alice was beginning to get very tired'), { timeout: 3000
  }).toHaveLength(1)`.
- **A opens the thread and adds a memory.** `await tap(alex.page, 'Alice
  was beginning to get very tired')`;
  `thread(alex.page).getByRole('button', { name: 'Add a memory 📸'
  }).click()`; `const form = thread(alex.page).getByRole('form', { name:
  'Add a memory' })`; `form.getByLabel('Photo').setInputFiles('fixtures/memory.jpg')`;
  `form.getByLabel('Caption').fill('Dinner at our favorite restaurant')`;
  `form.getByRole('button', { name: 'Save memory' }).click()`.
- **It appears in A's own thread.** `await
  expect(thread(alex.page).getByRole('listitem', { name: 'Memory'
  })).toContainText('📸 You: Dinner at our favorite restaurant')`; the
  photo `<img aria-label="Memory photo">` finishes loading (`naturalWidth`
  becomes the fixture's real width, `500`, once `img.complete`).
- **B sees it live, with the photo.** `await tap(sam.page, 'Alice was
  beginning to get very tired')`; `const card =
  thread(sam.page).getByRole('listitem', { name: 'Memory' })`; `await
  expect(card).toContainText('📸 Alex: Dinner at our favorite restaurant',
  { timeout: 3000 })`; poll the image's `naturalWidth` to `500` the same
  way — this is the independent-view proof that the photo itself (not
  just its caption row) reached B's browser.
- **It's on the timeline for both.** `await b.page.goto('/together/book/<bookId>')`;
  `page.getByRole('list', { name: 'Timeline' })` contains "📸 Alex added a
  memory" for B and "📸 You added a memory" for A.
- **Proof.** Screenshot the add-memory form, A's thread with the memory,
  B's thread with the memory, and the timeline.

## Gotchas

- The memory's thread row and the timeline line use different pronouns
  for the same actor ("You" vs the partner's name) — don't assert one
  wording on both partners' views.
- The photo-loaded check must poll `naturalWidth`, not just presence of
  the `<img>` — `src` can resolve to a broken/loading image that's present
  in the DOM before the bytes arrive; `naturalWidth` only becomes nonzero
  once it actually decodes.
- A memory is a reply-shaped mark under the highlight/reaction it's
  attached to, not a property of the parent — `thread()`'s ordered list
  reflects that: the parent mark's own line comes first, the memory after.
