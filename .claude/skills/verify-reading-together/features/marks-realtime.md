# Marks and realtime (P14)

**Not built yet.** `src/features/marks/` doesn't exist in this worktree.
This recipe is specified ahead of time so the first run after P14 lands
only has to fill in real selectors. PLAN.md's check: "A reacts and B sees
it within 2 seconds; B replies and A sees it."

Selection menu (highlight, 7 reactions, note), reply threads, per-person
colours, delivered over the `book:{id}` Realtime channel (`docs/interfaces.md`).

## Sub-features

- `highlight` — select text, choose "highlight"; a `mark` row of kind
  `highlight` appears, coloured by the author.
- `reaction` — one of 7 reactions (`love | funny | emotional | surprised |
  interesting | favorite | think`).
- `note` — select text, attach a text note.
- `reply-thread` — reply to an existing mark; replies nest under it.
- `realtime-delivery` — the partner sees a new mark/reply within 2 seconds,
  without reloading.

## How to get to it (user POV)

- Selecting text opens a selection menu, layered on the `select` event
  already shipped in `features/reader`.
- Clicking an existing mark opens its thread panel for replies.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book (`auth-and-couple.md` +
  `library-upload.md`), both reading the same book.

- **A creates a mark.** `await selectText(alex.page, '<a shared passage>')`,
  then drive the (not-yet-built) selection menu to add a reaction.
- **B sees it within 2 seconds.** Time from A's action to B's page
  rendering the new mark; assert `< 2000`ms — a real timing assertion,
  matching PLAN.md's explicit budget, not "assert it eventually appears."
- **B replies.** Click the mark on B's page, open its thread, submit a reply.
- **A sees the reply.** Same timing assertion, on A's page.
- **Proof.** Screenshot both partners' views right after the 2-second
  assertion passes; record the measured latency in the transcript.

## Gotchas

- Marks re-fetch "when progress moves past new ones" (`docs/interfaces.md`)
  — set B's `pos` past the mark first, or the spoiler gate hides it and
  this looks like a realtime failure that isn't one.
- Failed-RLS realtime inserts are never delivered — a false negative here
  can mean a gate bug, not a realtime bug; cross-check `spoiler-reveal.md`.
- Once P14 ships, replace the selection-menu placeholder above with real
  ARIA names/testids and delete this note.
