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
- foliate logs harmless console errors (getComputedStyle / destructure 'style'); nothing observed broken.
- Chapter titles use spine index + 1; TOC labels are a follow-up.

## Contract requests
_none_

## Blockers
_none_
