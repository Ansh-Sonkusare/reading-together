# Status: what's true right now

_Update before ending every session._

## Now
- Done and merged on master: P01, P02, P03, P04, P11, P12, P13a, P13b, P14a, P15, theme fix.
- Running: P14b (marks wired into the book page, the Phase 1 demo), P32 (discussion + guess reveal), P41 + P42 (timeline + stats; this worker owns migrations right now).
- Checks on master: unit 21, db 19, e2e 3/3 (reader, couple, book).
- Verify skill: `.claude/skills/verify-reading-together/` (launch, doctor, drive, cleanup).

## Next
P21 reveal-on-reach, P22 re-anchor by quote, P23 bookmarks + send, P31 streaks + goals, P33 web push, P43 memories, P44 themes, P51 sync mode.

## Open items
- Local Supabase storage (1.77.0) doesn't drain the body of an upload it refuses on RLS, which can hang the next upload through the same Kong connection. Tests avoid it; the app checks membership before uploading. Reproducer: `docs/research/storage-refused-upload-repro.mjs`. Filing upstream is left to the owner.
- F3 (branch worktree-agent-abe1f496d3b937945): chapter names come from `book.toc` (D18), and foliate's uncaught errors on chapter loads and after leaving the reader are fixed by a pnpm patch (D19), guarded by `tests/e2e/reader-errors.spec.ts`. Books uploaded before F3 keep `Chapter {spine+1}`.
- The first TOC entry names a spine item, so a title page listed in the TOC is labelled with the book title (alice spine 1 "Alice’s Adventures in Wonderland", pride spine 1 "PRIDE. and PREJUDICE") and gets a "You finished …" prompt.
- `streak.spec.ts` races partner B's 1 s debounced save: the "Start a streak" check fails when both opening saves land first (seen under heavy machine load).

## Contract requests
_none_

## Blockers
_none_
