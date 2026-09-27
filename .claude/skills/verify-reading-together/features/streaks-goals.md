# Streaks and goals (P31)

**Status: built**, on `/together` (`StreakRow` in
`src/app/together/page.tsx`, backed by `src/features/together/streak.ts`,
`streak-data.ts`, `goal-form.tsx`, `goal-actions.ts`). No Playwright e2e
spec exists for this yet — only unit tests on the pure streak/goal-text
functions (`streak.ts` is imported directly by `tests/db/streak.test.ts`
and has its own unit coverage) and the DB-level test
(`tests/db/streak.test.ts`, `pnpm test:db`) that proves `reading_day`
rows and the `member.timezone` RLS. This recipe is written from that
source; re-confirm selectors on the first live run.

A day only counts as "read" once `progress.max_pos` advances (a trigger,
`reading_day_on_progress` in `supabase/migrations/20260927000500_streaks_goals.sql`,
writes/extends a `reading_day` row per member per local day on every
progress upsert) — so this is provable by just paging forward and saving,
the same real action `book-progress.md` already drives.

## Sub-features

- `streak-count` — `data-testid="streak"`: "Start a streak: read today
  together" at 0, or "🔥 N-day reading streak" for consecutive days both
  partners have a `reading_day` row, ending today (or yesterday, if
  neither has read yet today) — `streak()`/`streakText()` in `streak.ts`.
- `goal-set` — `aria-label="Reading goal"` form: a numeric "Daily goal"
  input (1–1000) and a "pages a day"/"chapters a day" `Unit` select;
  "Set goal" calls `set_goal` (couple-scoped, upserts one row per couple —
  either partner can change it).
- `goal-progress` — once a goal exists, `data-testid="goal-progress"`
  shows "Today: You D/T \<unit\> ✓ · \<Partner\> D/T" (a trailing ✓ once
  that reader has hit the target today).
- `timezone-sync` — a member's own browser timezone is written to
  `member.timezone` on first render if it differs (`TimezoneSync`,
  invisible, no UI) — which local day a `reading_day`/streak counts
  against follows *that* member's zone, not UTC or the partner's.

## How to get to it (user POV)

- `/together` (via `/library`'s "Our reading" link, or directly) — the
  `aria-label="Streak"` section sits between the stats tiles and
  "Favorite reactions" (`together-stats-timeline.md`).

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book, both able to read
  (`twoPartners({ baseURL })` + `openBook()` — `book-progress.md`).
- `import { nextPage, waitForSaved } from '../scripts/drive.mjs'`.

- **Both read today.** Turn several pages each, the same way
  `book-progress.md` does (`for (let i = 0; i < 5; i++) { await
  nextPage(page); }`, `await waitForSaved(page)`) — a couple of physical
  page turns advance `progress.max_pos`, which is what the trigger needs
  to write today's `reading_day` row (a save with no actual `pos`
  increase writes nothing new). The "pages" a goal counts is a distinct
  1500-character virtual unit (`pos_chars(...) / 1500` in the migration),
  not the same as one physical `nextPage()` turn — don't assume one turn
  = one page toward a goal; turn several before checking, or set the
  goal's `target` low enough (see next step) to be safely cleared.
- **The streak shows 1.** `await alex.page.goto('/together')`; `await
  expect(alex.page.getByTestId('streak')).toHaveText('🔥 1-day reading
  streak')`. Same for B (the streak is couple-scoped, symmetric).
- **Set a goal.** `await
  alex.page.getByLabel('Reading goal').getByLabel('Daily goal').fill('1')`;
  select `Unit` = "pages a day"; click "Set goal". A target of 1 *page*
  (the 1500-char unit above) needs enough turns first to be confident
  it's cleared — if `goal-progress` isn't showing ✓ yet, that's most
  likely under-reading rather than a bug; page forward more before
  concluding the goal math is wrong.
- **Goal progress shows for both.** Reload (the form is a server action;
  `revalidatePath('/together')` already refreshes it, but a reload proves
  it survived). `data-testid="goal-progress"` reads `Today: You D/1 page
  [✓] · Sam D/1 [✓]` — each side's own ✓ depends on how far that
  partner's own turns actually advanced.
- **Proof.** Screenshot `/together` for both partners with the streak and
  goal-progress lines visible; record the exact `reading_day`/streak text
  in the transcript, not just "a streak appeared."

## Gotchas

- **Not yet live-verified end to end in a browser as of this run** (no
  e2e spec exists to copy from) — the next `maintain-verification-skill`
  pass should do a live drive of this file specifically.
- A `reading_day` row needs `max_pos` to actually increase past its prior
  value — reloading or re-saving the same position writes nothing; the
  recipe's `nextPage()` (not just opening the book) is what advances it.
- The streak's "today" is evaluated per-member local day
  (`TimezoneSync`) — two browser contexts on the same machine share the
  OS timezone by default, so this is a non-issue for a same-machine run,
  but don't compare against a hardcoded UTC day if driving from a CI
  runner in a different zone.
- `goal-progress`'s unit noun only appears on the *first* reader's number
  ("You 1/1 page · Sam 1/1", not "page" repeated) — `goalProgressText()`
  in `streak.ts` renders it that way on purpose; don't treat a missing
  second "page"/"pages" as a bug.
- A goal is couple-scoped, not per-person — setting it from either
  partner's browser changes it for both; there's no separate "my goal" vs
  "their goal."
