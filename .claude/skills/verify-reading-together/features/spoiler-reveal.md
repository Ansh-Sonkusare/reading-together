# Spoiler reveal (P21)

**Not built yet.** The UI reveal animation ("✨ new from Alex") described in
`PLAN.md` phase 2 doesn't exist in this worktree. The *gate itself* is a
Phase-0 DB concern (P02) enforced in RLS — this file specifies the exact
two-partner UI scenario from `docs/interfaces.md` rule 2 so the first run
after P21 lands only has to point at real selectors.

> Spoiler gate on `mark` select: `author_id = auth.uid() OR pos <=
> my_max_pos(book_id)`. The gate uses the high-water mark, so rereading
> earlier chapters never hides marks you've already reached. The same gate
> applies to `event` rows whose `pos` is set... Marks ahead of you are
> hidden entirely, including the fact that they exist (D9). There is no
> locked view. Realtime inserts that fail RLS are never delivered, so
> nothing leaks. — `docs/interfaces.md`, rule 2

PLAN.md's Phase-0 gate scenario, which this feature's "done by hand in the
UI" check re-runs: **A at pos 0.5, B at 0.2 — B can't select A's mark at
pos 0.4, or even count it. B moves to pos 0.5 — B can now select it, and
(once P21 ships) sees the "✨ new from Alex" reveal.**

## Sub-features

- `hidden-ahead` — a mark authored ahead of your `max_pos` does not appear
  in your mark list at all (not greyed out, not counted — absent).
- `reveal-on-reach` — the moment your `progress.max_pos` reaches the mark's
  `pos`, it appears with a "✨ new from Alex"-style indicator.
- `reread-stays-visible` — going back to re-read earlier text never hides a
  mark you've already reached (the gate is a high-water mark, not your
  current `pos`).

## How to get to it (user POV)

- Just reading: the reveal is passive, triggered by `progress.pos`/`max_pos`
  advancing past a mark's `pos` as you read forward.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners (A, B) share a couple and book.
- A has read ahead of B (A's `max_pos` > B's `max_pos`).

- **Set positions.** As partner A: `await goTo(alex.page, 0.5)` and read to
  page-end so `progress.max_pos` records `>= 0.5`. As partner B: `await
  goTo(bailey.page, 0.2)`, `max_pos` `>= 0.2` only.
- **A creates a mark at pos 0.4.** `await selectText(alex.page, '<passage
  at ~pos 0.4>')`, add a highlight (depends on P14 — see
  `marks-realtime.md`).
- **B can't see it.** Reload B's mark list. Assert the mark is absent from
  both the rendered list and any count/badge — not present-but-locked.
  This is rule 2's "hidden entirely, including the fact that it exists."
- **B moves to pos 0.5.** `await goTo(bailey.page, 0.5)`, read to page-end
  so B's `max_pos` reaches `0.5`. Reload B's mark list. Assert the mark
  from pos 0.4 now appears, with the reveal indicator if P21's animation is
  live.
- **Reread stays visible.** As B, `await goTo(bailey.page, 0.1)` (back to
  earlier text) then forward again. The mark from pos 0.4 must still be
  visible throughout — the gate never re-hides something once reached.
- **Proof.** Screenshot B's mark list at each of the three states (before,
  hidden; after reaching 0.5, revealed; after rereading, still revealed).
  Also assert the count of marks visible to B changes from 0 to 1 at the
  0.4-mark step, not just that the specific mark toggles — rule 2 says the
  count itself must not leak either.

## Gotchas

- This is the one feature where a false pass is actively dangerous: it's
  security-relevant (spoiler leakage), so don't accept "the mark looks
  greyed out" as hidden — assert it is absent from the DOM/response
  entirely.
- The SQL-level version of this exact scenario is P02's `pnpm test:db` gate
  test (`PLAN.md`: "A at pos 0.5, B at 0.2, B can't select A's mark at 0.4
  or even count it, then B moves to 0.5 and can select it"). This UI recipe
  is the same scenario one layer up — if the DB test is green but this
  fails, the bug is in the client re-fetch logic, not RLS.
- `mark.pos` must be `<=` the author's own `max_pos` + epsilon (rule 5) —
  don't try to author a mark ahead of your own position as part of test
  setup; it will be rejected, which is correct behavior, not a bug in this
  recipe.
