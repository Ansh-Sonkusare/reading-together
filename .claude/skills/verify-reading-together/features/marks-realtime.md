# Marks and realtime (P14)

**Status: in progress.** `src/features/marks/` exists (`components.tsx`,
`model.ts`, `data.ts`) with real markup below, but `book-reader.tsx` (P14b)
doesn't import or render it yet — selecting text on `/book/[id]` today only
updates the reader's own `select` event, no menu appears. This recipe is
correct against the shipped `SelectionMenu`/`ThreadPanel` components; it
can't be driven end to end on `/book/[id]` until P14b wires them in.
PLAN.md's check: "A reacts and B sees it within 2 seconds; B replies and A
sees it."

Selection menu (highlight, 7 reactions, note), reply threads, per-person
colours, delivered over the `book:{id}` Realtime channel
(`docs/interfaces.md`).

## Sub-features

- `highlight` — select text, choose "highlight"; a `mark` row of kind
  `highlight` appears, coloured by the author.
- `reaction` — one of 7 reactions: love, funny, emotional, surprised,
  interesting, favorite, think (`REACTIONS` in `src/features/marks/model.ts`).
- `note` — select text, attach a text note.
- `reply-thread` — reply to an existing mark; replies nest under it.
- `realtime-delivery` — the partner sees a new mark/reply within 2 seconds,
  without reloading.

## How to get to it (user POV)

- Selecting text is meant to open a `role="group"` menu labelled "Mark this
  passage" (`SelectionMenu` in `components.tsx`): one icon button per
  reaction (`aria-label`/`title` = the reaction's label, e.g. "Love this"),
  plus "Highlight" and "Note" buttons. "Note" expands a
  `aria-label="Write a note"` textarea and a "Save" button.
- Clicking an existing mark is meant to open a `aria-label="Thread"` panel
  (`ThreadPanel`): the anchor quote, one line per mark/reply, and an
  `aria-label="Reply"` textarea with a "Reply" button.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book, both reading the same book
  (`twoPartners({ baseURL })` + `openBook()` for each — see
  `book-progress.md`).
- **Blocked today:** `book-reader.tsx` renders no `SelectionMenu`/
  `ThreadPanel`, so the calls below 404-equivalent (nothing appears) until
  P14b lands. Re-check this file's status once it does.

- **A creates a mark.** Select a shared passage on `alex.page` (reuse
  `book-progress.md`'s page as a starting point, or the reader-level
  `selectText` from `features/reader.md` if `/book/[id]` exposes the same
  `window.__reader`), then `alex.page.getByRole('group', { name: 'Mark this
  passage' }).getByRole('button', { name: 'Love this' }).click()`.
- **B sees it within 2 seconds.** Time from A's action to B's page
  rendering the new mark; assert `< 2000`ms — a real timing assertion,
  matching PLAN.md's explicit budget, not "assert it eventually appears."
- **B replies.** Click the mark on B's page, then in the
  `aria-label="Thread"` panel, `sam.page.getByRole('region', { name:
  'Thread' }).getByLabel('Reply').fill('...')` and click "Reply".
- **A sees the reply.** Same timing assertion, on A's page.
- **Proof.** Screenshot both partners' views right after the 2-second
  assertion passes; record the measured latency in the transcript.

## Gotchas

- Marks re-fetch "when progress moves past new ones" (`docs/interfaces.md`)
  — set B's `pos` past the mark first (`nextPage`/`goTo` from
  `book-progress.md`/`reader.md`), or the spoiler gate hides it and this
  looks like a realtime failure that isn't one.
- Failed-RLS realtime inserts are never delivered — a false negative here
  can mean a gate bug, not a realtime bug; cross-check `spoiler-reveal.md`.
- Once P14b wires `SelectionMenu`/`ThreadPanel` into `/book/[id]`, remove
  the "Blocked today" line above and confirm the selectors still match —
  they're copied from the component source, not from a live run.
