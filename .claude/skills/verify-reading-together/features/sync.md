# Sync reading mode (P51)

**Status: built.** A presence/broadcast channel `sync:{bookId}`
(`src/lib/realtime.ts`, `src/features/sync/`) where the follower's page
mirrors the leader's `goTo` live. Selectors and the exact scenario below
are copied from `tests/e2e/sync.spec.ts`, which already drives this
markup.

**Don't touch `src/lib/realtime.ts` or `src/features/sync/**` while
another worker's brief has them as `DB: owner` for F1 (private Realtime
channels) — this feature file only reads/drives, never edits app code.**

## Sub-features

- `presence-pill` — a `data-testid="sync-pill"` in the header shows
  "\<Partner\> is here" once both partners are on the same book, with a
  "Read together now" button.
- `invite-accept` — inviting opens a `role="dialog" name="Read together"`
  on the partner's page ("\<Inviter\> wants to read together. You'll
  follow \<Inviter\>'s pages."); Accept switches both pills to "Reading
  together with \<Partner\> ❤️Leave".
- `follow-live` — while synced, the leader's page turns are mirrored on
  the follower's page (`myPos` matches) within ~2 seconds, without the
  follower touching any controls.
- `leave-either-side` — either partner clicking "Leave" ends sync for
  both; the leaver keeps their own `pos`; the other side's pill shows "…
  left reading together." and their `pos` freezes at the last-followed
  page (their own turns don't move it until they leave/rejoin normally).
- `solo-on-disconnect` — if the partner's tab closes, the pill returns to
  a `data-state="solo"` empty state.

## How to get to it (user POV)

- Open the same book as your partner on `/book/[id]`; the header's
  `data-testid="sync-pill"` appears once presence detects them.
- "Read together now" → partner sees a modal dialog to Accept/decline.
- "Leave" (on either side) while synced.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book, both on `/book/[id]`
  (`twoPartners({ baseURL })` + `openBook()` for each — `book-progress.md`).
- `import { syncPill, myPos, nextPage } from '../scripts/drive.mjs'`.

- **Presence appears.** `await expect(syncPill(alex.page)).toHaveText('Sam
  is hereRead together now')`; same for B with "Alex is here…".
- **A invites, B accepts.** `syncPill(alex.page).getByRole('button', {
  name: 'Read together now' }).click()`; `await
  expect(syncPill(alex.page)).toHaveText('Waiting for Sam…Cancel')`; on
  B, `const invite = sam.page.getByRole('dialog', { name: 'Read together'
  })`; assert its text names Alex; `invite.getByRole('button', { name:
  'Accept' }).click()`. Both pills become "Reading together with
  \<Partner\> ❤️Leave".
- **A leads, B follows.** Loop `await nextPage(alex.page)` three times;
  after each, `await expect(myPos(sam.page)).toHaveText((await
  myPos(alex.page).textContent()), { timeout: 2000 })` — B's page never
  clicked anything.
- **B leaves.** Capture `const leaderPos = await myPos(alex.page).textContent()`
  first. `await nextPage(sam.page)` — a follower's own page turn is what
  ends sync (self-navigation while following = leaving). `await
  expect(syncPill(sam.page)).toHaveText('Alex is hereRead together nowYou
  left reading together.')`; `await
  expect(syncPill(alex.page)).toHaveText('Sam is hereRead together
  nowSam left reading together.', { timeout: 2000 })`; `await
  expect(myPos(alex.page)).toHaveText(leaderPos)` — A (the leader) never
  moved, proving B's turn didn't leak into A's own position.
- **A pages on alone; B stays put.** Two more `nextPage(alex.page)` calls
  don't move `myPos(sam.page)` at all — confirms sync fully released, not
  just paused.
- **Partner disconnects → solo.** `await alex.context.close()`; `await
  expect(syncPill(sam.page)).toHaveAttribute('data-state', 'solo', {
  timeout: 10000 })`; the pill goes empty.
- **Proof.** Screenshot at "Sam is here", the invite dialog, leading vs.
  following mid-sync, "Sam left reading together", and the final solo
  state.

## Gotchas

- The pill's full text is asserted as one string (label + button text
  concatenated) because Playwright's `toHaveText` reads the element's
  full text content — don't split it into a label check and a separate
  button-name check, the two will race differently than the real DOM.
- `alex.context.close()` (not just navigating away) is what proves the
  solo-on-disconnect path — a same-page navigation doesn't necessarily
  drop presence the same way a closed tab does.
- F1 (private Realtime channels, RLS on `realtime.messages`) is being
  built on top of this same channel by another worker as of this run —
  if this recipe starts failing with a join/subscribe error instead of a
  live-mirroring failure, check whether F1 landed and the fixture's
  couple membership still satisfies its new RLS policy before assuming
  this feature regressed.
