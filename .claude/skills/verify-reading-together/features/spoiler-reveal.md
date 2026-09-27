# Spoiler reveal (P21)

**Status: in progress.** The gate itself is enforced in RLS today (P02,
`pnpm test:db`) — that part is done and not this skill's job to re-prove
per run. The UI reveal animation ("✨ new from Alex", `PLAN.md` phase 2)
doesn't exist, and marks aren't rendered on `/book/[id]` at all yet
(`marks-realtime.md`: P14b hasn't wired `SelectionMenu`/`ThreadPanel` in),
so there's no mark list to assert "hidden" or "visible" against in the real
UI yet. This file specifies the exact two-partner UI scenario from
`docs/interfaces.md` rule 2 so the first run after both P14b and P21 land
only has to point at real selectors.

Rule 2 (`docs/interfaces.md`): gate on `mark` select is `author_id =
auth.uid() OR pos <= my_max_pos(book_id)` — a high-water mark, so rereading
earlier chapters never re-hides a mark you've reached. Marks ahead of you
are hidden entirely, including the fact that they exist (D9); no locked
view; failed-RLS realtime inserts are never delivered.

PLAN.md's Phase-0 scenario, which this feature's "done by hand in the UI"
check re-runs: **A at pos 0.5, B at 0.2 — B can't select A's mark at pos
0.4, or even count it. B moves to pos 0.5 — B can now select it, and (once
P21 ships) sees the "✨ new from Alex" reveal.**

## Sub-features

- `hidden-ahead` — a mark ahead of your `max_pos` is absent from your mark
  list (not greyed out, not counted).
- `reveal-on-reach` — the moment `progress.max_pos` reaches the mark's
  `pos`, it appears with a "✨ new from Alex"-style indicator.
- `reread-stays-visible` — rereading earlier text never re-hides a mark
  already reached (the gate is the high-water mark, not current `pos`).

## How to get to it (user POV)

- Passive: triggered by `progress.pos`/`max_pos` advancing past a mark's
  `pos` as you read forward on `/book/[id]`.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners (A, B) share a couple and book; A has read ahead of B
  (`twoPartners({ baseURL })` + `openBook()` — `book-progress.md`).

- **Set positions.** `/book/[id]` has no direct `goTo` — unlike
  `/dev/reader`'s `window.__reader`, the real page only exposes
  `nextPage`/`prevPage`. Reach a target `pos` by paging forward and
  checking `myPos(page)` after each turn (`book-progress.md`), or open the
  book with A ahead of B simply by giving A more `nextPage()` calls than B
  before either checks marks.
- **A marks a passage B hasn't reached.** Once P14b lands: select text on
  `alex.page` and add a highlight via the `SelectionMenu`
  (`marks-realtime.md`'s selectors) at a `pos` beyond B's current position.
- **B can't see it.** Reload B's mark list (selector TBD — wherever P14b
  renders marks on `/book/[id]`). Assert the mark is absent from the
  rendered list *and* any count/badge — rule 2's "hidden entirely."
- **B reaches it.** `nextPage(bailey.page)` in a loop until `myPos(bailey.page)`
  passes the mark's `pos`, `await waitForSaved(bailey.page)`. Reload B's
  mark list: the mark now appears (with the reveal indicator once P21's
  animation ships).
- **Reread stays visible.** `prevPage(bailey.page)` back past the mark's
  `pos`, then `nextPage` forward again — the mark must stay visible
  throughout.
- **Proof.** Screenshot B's mark list at all three states (hidden,
  revealed, still-revealed-after-reread). Assert the visible count changes
  0→1 at the reveal step, not just that one mark toggles — the count must
  not leak either.

## Gotchas

- Security-relevant: a false pass here is dangerous. "Greyed out" doesn't
  count as hidden — assert absence from the DOM/response entirely.
- P02's `pnpm test:db` gate test covers the same scenario in SQL. If that's
  green but this fails once P14b/P21 ship, the bug is in client re-fetch
  logic, not RLS.
- `mark.pos` must be `<=` the author's own `max_pos` + epsilon (rule 5) —
  don't try to author a mark ahead of your own position in test setup; a
  rejection there is correct behavior, not a bug in this recipe.
- Blocked on `marks-realtime.md`'s same precondition: there's no mark list
  in the real UI to assert against until P14b wires it in.
