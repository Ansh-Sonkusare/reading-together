# Chapter discussion and guess-the-reaction (P32)

**Status: built**, at `/discuss/[bookId]/[spine]`
(`src/app/discuss/[bookId]/[spine]/page.tsx`, `Discussion` in
`src/features/together/discussion-ui.tsx`). Unlike the other new feature
files here, no Playwright e2e spec exists for this page yet — only unit
tests (`src/features/together/discussion.test.ts`) and a DB-level reveal
test (`tests/db/discussion.test.ts`, `pnpm test:db`). This recipe is
written from that source plus the DB test's scenario; its selectors are
real component markup, not a spec's proven copy, so re-confirm them on the
first live run and fix this note once they're spec-backed.

A blind-answer reveal gate, same shape as `spoiler-reveal.md` but on a
different table (`answer`, not `mark`): three rotating discussion
questions per chapter, plus a "guess their reaction" game, each answer
hidden from your partner until you've both answered the same prompt.

## Sub-features

- `blind-questions` — `questionsFor(spine)` picks 3 of 5 rotating
  questions (`src/features/together/questions.ts`); each is its own
  `aria-label`-per-question-text `<section>` with a textarea, hidden from
  the partner until both have answered that exact prompt.
- `guess-reaction` — a 4th "Guess their reaction" card: pick your own
  reaction and a guess at your partner's, from the same 4 options
  (`GUESS_OPTIONS` in `discussion.ts`: ❤️ Love this, 😂 Funny, 😭
  Emotional, 😐 Didn't care); once both have guessed, both guesses and a
  scored reveal (`revealGuess()`) show for both.
- `answer-revealed-event` — the moment the second partner answers a given
  prompt, one `answer_revealed` event is written (`tests/db/discussion.test.ts`
  proves exactly one even under simultaneous answers) and, if push is
  enabled (`push.md`), a notification fires.

## How to get to it (user POV)

- Direct navigation to `/discuss/[bookId]/[spine]` — **there is no link to
  it anywhere in the app UI yet** (not on `/book/[id]`, not on
  `/together`); the only production path that ever produces this URL is
  an `answer_revealed` push notification once you've already answered
  (`wording.ts`'s `discussHref`), which by definition can't be the *first*
  visit. Report this as-is: it's a real gap, not a broken recipe — note it
  in the run rather than routing around it with an internal call.
- `spine` is the chapter index (0-based; `chapterTitle(spine)` displays
  "Chapter N" = `spine + 1`).

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book (`twoPartners({ baseURL })` — no
  need to open the reader first, since the only entry point today is the
  direct URL).
- Pick a `spine` both can navigate to directly, e.g. `2` (matches the DB
  test's fixture and gives a stable set of 3 questions via
  `questionsFor(2)`).

- **Both navigate directly.** `await alex.page.goto(`/discuss/<bookId>/2`)`;
  same for `sam.page`. Each question renders as a `getByRole('heading', {
  name: q.text })` inside a `section[aria-label="<question text>"]`.
- **A answers, B can't see it yet.** `await
  alex.page.getByLabel(q1Text).getByLabel('Your answer').fill('...')`
  (scope to the section, since every question card has its own "Your
  answer" textarea) then click that section's "Answer" button. A's own
  section now shows "You" and a `role="status"` "Waiting for
  \<Partner\>…" in place of B's side; reload B's page — B's card for that
  same question still shows the blank form, not A's text anywhere in the
  DOM (this is the same "hidden entirely" bar as `spoiler-reveal.md`).
- **B answers the same prompt; both reveal.** B fills and submits the same
  section; both partners' cards now render both answers side by side
  (`Said` components, labelled "You" / the partner's name).
- **The guess game.** Both partners pick from the 4 `ReactionPicker`
  buttons (own reaction, then guess at the partner's) in the "Guess their
  reaction" `section[aria-label="Guess their reaction"]` and submit
  "Lock it in"; once both have, `[data-testid="guess-result"]` renders
  the scored reveal text for both.
- **Proof.** Screenshot A's pre-reveal "Waiting for Sam…" state, then both
  partners' post-reveal question card and the guess result.

## Gotchas

- **No in-app entry point yet** — see "How to get to it" above; treat a
  missing link from `/book/[id]`/`/together` to a just-finished chapter's
  discussion as the actual, documented state, not something this recipe
  should work around.
- Every question card has its own "Your answer" textarea with the same
  accessible name — scope every query to that card's `section` (by its
  `aria-label`, which is the question's own text), never a bare
  `page.getByLabel('Your answer')`.
- `answer.prompt_key` is per-question (`q.key`) or `guessKey(spine)` for
  the guess game — answering a *different* question never reveals this
  one (confirmed in `tests/db/discussion.test.ts`); if a reveal leaks
  across prompts, that's the bug this recipe exists to catch.
- Not yet live-verified end to end in a browser as of this run (no e2e
  spec exists to copy from) — the next `maintain-verification-skill` pass
  should do a live drive of this file specifically and tighten it into a
  spec-backed recipe the way `marks-realtime.md`/`spoiler-reveal.md` are.
