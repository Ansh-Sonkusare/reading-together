# Marks and realtime (P14)

**Not built yet.** `src/features/marks/` doesn't exist in this worktree.
This file specifies the recipe ahead of time so the first run after P14
lands only has to fill in real selectors, not design the check. PLAN.md's
check for this problem: "A reacts and B sees it within 2 seconds; B
replies and A sees it."

Selection menu (highlight, 7 reactions, note), reply threads, per-person
colours, delivered to the partner over the `book:{id}` Realtime channel
(`docs/interfaces.md`).

## Sub-features

- `highlight` — select text, choose "highlight"; a `mark` row of kind
  `highlight` appears, coloured by the author.
- `reaction` — select text, choose one of the 7 reactions (`love | funny |
  emotional | surprised | interesting | favorite | think`).
- `note` — select text, attach a private/shared text note.
- `reply-thread` — reply to an existing mark; replies nest under it.
- `realtime-delivery` — the partner sees a new mark/reply within 2 seconds,
  without reloading.

## How to get to it (user POV)

- Selecting text in the reader opens a selection menu (highlight, reactions,
  note) — layered on top of the `select` event already shipped in
  `features/reader`.
- Clicking an existing mark opens its thread panel for replies.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and a book (`auth-and-couple.md` +
  `library-upload.md`), both with the reader open on the same book.

- **A creates a mark.** As partner A, `await selectText(alex.page, '<a
  passage in the shared book>')`, then drive the (not-yet-built) selection
  menu to add a reaction.
- **B sees it within 2 seconds.** Starting a timer right after A's action
  completes, poll partner B's page for the new mark to render; assert the
  elapsed time is `< 2000`ms. This is a real timing assertion, not "assert
  it eventually appears" — PLAN.md's check names the 2-second budget
  explicitly.
- **B replies.** Click the mark on B's page, open its thread, submit a
  reply.
- **A sees the reply.** Same timing assertion as above, on A's page.
- **Proof.** Screenshot both partners' views right after the 2-second
  assertion passes; record the measured delivery latency in the transcript.

## Gotchas

- The realtime channel is `book:{id}` and re-fetches marks "when its own
  progress moves past new ones" (`docs/interfaces.md`) — B's `progress.pos`
  must already be `>=` the mark's `pos`, or the spoiler gate hides it and
  this check will wrongly look like a realtime failure. Set B's position
  past the mark first.
- Realtime inserts that fail RLS are never delivered — a false negative
  here (B never receives it) can mean a gate bug, not a realtime bug. Cross-
  check against `spoiler-reveal.md` before concluding realtime is broken.
- Once P14 ships, replace the "drive the (not-yet-built) selection menu"
  line above with the actual ARIA names/testids and delete this note.
