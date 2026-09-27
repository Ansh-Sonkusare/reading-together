# Auth and couple (P11)

**Status: wip in another worktree, not yet merged into this one.**
`src/app/login`, `src/app/onboarding` and `src/app/join/[code]` don't exist
here, so `drive.mjs`'s `signUp`/`join` throw a clear error instead of
silently no-op-ing (`requirePage` checks for a 404 first). The calls below
are ready to use once P11 lands; only their selectors inside `drive.mjs`
may need a tweak to match the shipped markup.

Sign-up, couple creation (`create_couple` RPC), invite-link join
(`join_couple` RPC), and the two-member cap enforced by a DB trigger
(`docs/interfaces.md`: "at most 2 members per couple").

## Sub-features

- `sign-up` — a new user can create an account.
- `create-couple` — a signed-in user with no couple creates one and gets an
  invite code.
- `join` — a second signed-in user joins via the invite code.
- `third-refused` — a third account joining the same code is refused
  (`join_couple` raises `couple is full`).

## How to get to it (user POV)

- `/login` — sign in or sign up.
- `/onboarding` (or equivalent) — create a couple, named and coloured.
- `/join/[code]` — accept an invite link.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- P11's pages are merged into this worktree (`GET /login` is not 404).
- `import { partner, signUp, createCouple, join, closeAll } from '../scripts/drive.mjs'`.

- **Sign up as A.** `const alex = await partner('alex', { baseURL })`;
  `await signUp(alex.page, 'alex+verify@example.test', '<pw>', {
  baseURL })`. Fails with "`/login is 404`" if P11 hasn't landed — the
  expected, correct failure today.
- **Create a couple.** `const inviteCode = await createCouple(alex.page, {
  name: 'Alex', color: '#e11d48' })`, read from `data-testid="invite-code"`
  (add that testid in P11's own PR if it's missing, not this skill's scope).
- **Sign up and join as B.** `const bailey = await partner('bailey', {
  baseURL })`; `signUp` then `await join(bailey.page, inviteCode, {
  baseURL })`. Assert the couple UI shows both members.
- **Third refused.** `partner('cameron')`, sign up, `join(cameron.page,
  inviteCode)`; assert it surfaces `join_couple`'s `couple is full` error
  (selector TBD until P11 ships one).
- **Proof.** Screenshot each partner's post-join state; record the invite
  code and the refusal message in the run's transcript.

## Gotchas

- Clients never insert `couple`/`member` rows directly — only the RPCs
  (`docs/interfaces.md`). Don't call Supabase directly to set up state
  faster; that's the internal-setter trap the proof standards forbid.
- Use disposable emails per run (`+verify-<run-id>@`) — this skill has no
  DB write access to clean auth users up afterward.
- Update selectors from the actual P11 markup once it lands.
