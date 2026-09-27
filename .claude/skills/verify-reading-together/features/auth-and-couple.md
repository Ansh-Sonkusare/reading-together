# Auth and couple (P11)

**Status: built.** `/login`, `/onboarding` and `/join/[code]` are live in
this worktree (`src/app/(auth)/login`, `src/app/onboarding`,
`src/app/join/[code]`). Selectors below are copied from
`tests/e2e/couple.spec.ts`, which already drives this exact markup.

Sign-up (`src/features/couple/actions.ts` `signUp`), couple creation
(`createCoupleAction`), invite-link join (`joinCoupleAction`), and the
two-member cap enforced server-side (`docs/interfaces.md`: "at most 2
members per couple").

## Sub-features

- `sign-up` — a new user can create an account.
- `create-couple` — a signed-up user with no couple names it, picks a
  colour, and gets an invite link.
- `join` — a second signed-up user joins via the invite link and picks a
  different colour.
- `third-refused` — a third account visiting the same invite link is
  refused with "This couple already has two readers." (`FULL` in
  `src/features/couple/couple.ts`).

## How to get to it (user POV)

- `/login` — a `role=tablist` with "Sign in"/"Sign up" tabs, `Email` and
  `Password` fields, and a "Create account" (sign-up) or "Sign in" button.
- `/onboarding` — shown right after sign-up with no couple yet: "Your name",
  a colour `fieldset` (one radio per swatch, `aria-label` = the hex value),
  and "Start our library".
- `/join/[code]` — the invite link. Same name/colour fields and a "Join"
  button, unless the couple's full or the code's bad, in which case the
  form is replaced by `role=alert`.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- `import { partner, signUp, createCouple, join, closeAll } from '../scripts/drive.mjs'`.

- **Sign up as Alex.** `const alex = await partner('alex', { baseURL })`;
  `await alex.page.goto('/login')`; `await signUp(alex.page,
  'alex+<run-id>@example.test')` — clicks the "Sign up" tab, fills
  `Email`/`Password`, clicks "Create account". A fresh sign-up with no
  invite in the URL lands on `/onboarding`:
  `await alex.page.waitForURL('**/onboarding')`.
- **Create a couple.** `const invite = await createCouple(alex.page, {
  name: 'Alex', color: '#e11d48' })` — fills "Your name", checks the colour
  radio by its hex `aria-label`, clicks "Start our library", waits for
  `/library`, and returns the full invite URL read from the "Invite link"
  input's value (not a clipboard read — simpler and matches
  `tests/e2e/book.spec.ts`).
- **Sign up and join as Sam.** `const sam = await partner('sam', {
  baseURL })`; `await sam.page.goto(invite)` (redirects through
  `/login?next=/join/<code>` since Sam has no session); `await
  signUp(sam.page, 'sam+<run-id>@example.test')` lands back on the invite
  page; `await join(sam.page, invite, { name: 'Sam', color: '#2563eb' })`.
  Assert `page.getByRole('list', { name: 'Readers' })` on `/library` shows
  both names.
- **Third refused.** `const cameron = await partner('cameron', {
  baseURL })`; sign up as Cameron the same way; `const result = await
  join(cameron.page, invite)`. Assert `result.refused === true` and
  `result.message === 'This couple already has two readers.'`.
- **Proof.** Screenshot each partner's post-join `/library` state; record
  the invite URL and the refusal message in the run's transcript.

Or skip the four calls above entirely and call `twoPartners({ baseURL })`
for the common "two partners already joined" starting state — see
`SKILL.md`.

## Gotchas

- Use disposable emails per run (e.g. `alex-<run-id>@example.test`) — this
  skill has no DB write access to clean auth users up afterward.
- `signUp` assumes the page is already on `/login`; it doesn't navigate
  there itself, because Sam's flow needs to land on `/login?next=...` via
  the invite redirect rather than a plain `/login` visit.
- The colour radio's accessible name is the hex string itself
  (`aria-label={c}` in `ProfileFields`), not a colour word — `getByLabel`
  needs the exact hex, e.g. `'#2563eb'`.
