# Marks and realtime (P14)

**Status: built.** `book-reader.tsx` renders `SelectionMenu`/`ThreadPanel`
(`src/features/marks/components.tsx`) on the real `/book/[id]` page.
Selectors and the exact scenario below are copied from
`tests/e2e/marks.spec.ts`, which already drives this markup.
PLAN.md's check: "A reacts and B sees it within 2 seconds; B replies and A
sees it."

Selection menu (highlight, 7 reactions, note), reply threads, per-person
colours, delivered over the `book:{id}` Realtime channel
(`docs/interfaces.md`). Bookmarks and "send to partner" live on the same
menu but are their own feature: `bookmarks-and-send.md` (P23).

## Sub-features

- `highlight` — select text, choose "Highlight"; a `mark` row of kind
  `highlight` appears, coloured by the author (a shared highlight painted
  by both partners on the same passage recolours to `#83409a`, the shared
  colour, not either author's).
- `reaction` — one of 7 reactions: Love this ❤️, Funny 😂, Emotional 😭,
  Surprised 😮, Interesting 🤔, Favorite 🔥, Made me think 💭
  (`REACTIONS` in `src/features/marks/model.ts`).
- `note` — select text, attach a text note via a `aria-label="Write a
  note"` textarea.
- `reply-thread` — reply to an existing mark; replies nest under it,
  labelled "You: …" / "\<Partner\>: …".
- `realtime-delivery` — the partner sees a new mark/reply within 2 seconds,
  without reloading.
- `menu-dismiss` — the menu closes on Escape, on clicking outside it, or on
  tapping a different passage, without leaving a mark behind.

## How to get to it (user POV)

- Selecting text on `/book/[id]` opens a `role="group"` menu labelled
  "Mark this passage": one icon button per reaction (`aria-label`/`title`
  = the label, e.g. "Emotional"), plus "Highlight", "Note", "Bookmark" and
  "Send to \<Partner\>" (11 buttons total; the last two are `bookmarks-and-send.md`).
  "Note" expands a `aria-label="Write a note"` textarea and a "Save"
  button.
- Clicking an existing mark opens a `aria-label="Thread"` panel: the
  anchor quote, one line per mark/reply, and an `aria-label="Reply"`
  textarea with a "Reply" button.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book, both on `/book/[id]`
  (`twoPartners({ baseURL })` + `openBook()` for each — see
  `book-progress.md`), both at `CHAPTER_1` (`await toChapter1(page)` —
  chapter 1's opening text is where the spec's passages live).
- `import { toChapter1, select, tap, thread, paintAt } from '../scripts/drive.mjs'`.

- **A reacts.** `const menu = await select(alex.page, 'Alice was beginning
  to get very tired')`, then `menu.getByRole('button', { name: 'Emotional'
  }).click()`. The menu closes itself (`await expect(menu).toBeHidden()`).
- **B sees it within 2 seconds.** `await expect.poll(() => paintAt(sam.page,
  'Alice was beginning to get very tired'), { timeout: 2000 }).toEqual([
  expect.objectContaining({ fill: '#e11d48', count: 1 })])` — a real timing
  assertion, matching PLAN.md's budget, not "assert it eventually appears."
- **B opens the thread and replies.** `await tap(sam.page, 'Alice was
  beginning to get very tired')`; `await expect(thread(sam.page)).toContainText('Alex:
  😭 Emotional')`; `thread(sam.page).getByLabel('Reply').fill('I knowww
  😭')` then click "Reply".
- **A sees the reply.** `await expect(thread(alex.page)).toContainText('Sam:
  I knowww 😭', { timeout: 2000 })` (A must already have the thread open on
  the same mark via `tap`).
- **Proof.** Screenshot both partners right after each 2-second assertion
  passes; record the measured latency in the transcript.

## Gotchas

- Marks re-fetch "when progress moves past new ones" (`docs/interfaces.md`)
  — a partner behind the mark's `pos` won't see it at all; cross-check
  `spoiler-reveal.md` before assuming a realtime bug.
- `select`/`tap`/`paintAt` only find text inside the book's real section
  iframe (a `blob:` URL) — `page.frames()` includes other frames too;
  these helpers already filter for it.
- `paintAt` matches by line overlap, not centre point — an underline sits
  under the line box, not across its middle.
- The menu has 11 buttons (7 reactions + Highlight/Note/Bookmark/Send) —
  asserting a reaction button by name needs `{ exact: true }` or "Love
  this" also matches inside "I'd love this note" style text elsewhere.
