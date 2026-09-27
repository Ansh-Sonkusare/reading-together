# Auth and couple (P11)

**Status: wip in another worktree, not yet merged into this one.** As of this
writing `src/app/login`, `src/app/onboarding` and `src/app/join/[code]` don't
exist here, so `drive.mjs`'s `signUp`/`join` throw a clear error instead of
silently no-op-ing (`requirePage` checks for a 404 first). Re-run this recipe
once P11 lands — the calls below are ready to use as-is; only the selectors
inside `drive.mjs` may need a tweak to match the shipped markup.

Sign-up, couple creation (`create_couple` RPC), invite-link join
(`join_couple` RPC), and the two-member cap enforced by a DB trigger
(`docs/interfaces.md`: "at most 2 members per couple").

## Sub-features

- `sign-up` — a new user can create an account.
- `create-couple` — a signed-in user with no couple creates one and gets an
  invite code.
- `join` — a second signed-in user joins via the invite code.
- `third-refused` — a third account attempting to join the same invite code
  is refused (`join_couple` raises `couple is full`).

## How to get to it (user POV)

- `/login` — sign in or sign up.
- `/onboarding` (or equivalent post-signup step) — create a couple, named
  and coloured.
- `/join/[code]` — accept an invite link.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- P11's pages are merged into this worktree (`GET /login` is not 404).
- `import { partner, signUp, createCouple, join, closeAll } from '../scripts/drive.mjs'`.

- **Sign up as partner A.** `const alex = await partner('alex', {
  baseURL })`; `await signUp(alex.page, 'alex+verify@example.test',
  '<test password>', { baseURL })`. Fails loudly with "`/login is 404`" if
  P11 hasn't landed yet — that is the expected, correct failure today.
- **Create a couple.** `const inviteCode = await createCouple(alex.page, {
  name: 'Alex', color: '#e11d48' })`. Returns the code from
  `data-testid="invite-code"` (confirm this testid exists once P11 ships —
  add it if it doesn't, in P11's own PR, not this skill's scope).
- **Sign up and join as partner B.** `const bailey = await partner('bailey',
  { baseURL })`; `await signUp(bailey.page, 'bailey+verify@example.test',
  '<test password>', { baseURL })`; `await join(bailey.page, inviteCode, {
  baseURL })`. Assert the couple UI shows both members.
- **Third account refused.** `const cameron = await partner('cameron', {
  baseURL })`; sign up, then `await join(cameron.page, inviteCode, {
  baseURL })` and assert it surfaces the `couple is full` error from
  `join_couple` (an alert/toast — exact selector TBD until P11 ships one).
- **Proof.** Screenshot each partner's post-join state; record the invite
  code and the refusal message in the run's JSON transcript.

## Gotchas

- Clients never insert `couple`/`member` rows directly — only the
  `create_couple`/`join_couple` RPCs (`docs/interfaces.md`). If a recipe
  step is tempted to call Supabase directly to set up state faster, that's
  the internal-setter trap the proof standards forbid — go through the UI.
- Use disposable emails per run (e.g. `+verify-<run-id>@`) so a run doesn't
  collide with data a previous run or another worker left behind — this
  skill has no DB write access to clean auth users up afterward.
- Update this file's selectors from the actual P11 markup once it lands;
  don't guess ARIA names further than `docs/interfaces.md` already implies.
