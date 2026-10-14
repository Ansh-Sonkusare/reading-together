# Status: what's true right now

_Update before ending every session._

## Now
- Every problem in PLAN.md is done and merged on master: P01-P51 plus follow-ups F1 (private realtime), F2 (discussion entry points), F3 (TOC chapter labels, foliate errors).
- Checks on master (2026-10-14): unit 112, db 74, e2e 22 specs + 1 warm-up setup (23 passed with `--workers 2`), typecheck green. Under synthetic load (18 CPU burners, load average 24 to 33) the full suite at `--workers 6 --repeat-each 3` passed 67/67 from a cold dev server.
- Known gaps closed 2026-10-14: front matter out of `day_totals` (D18), discussion page through `joinChannel`, e2e cold-compile flake (warm-up project), HEIC memory photos refused (D23).
- Verify skill: `.claude/skills/verify-reading-together/` covers every shipped feature.
- Decision trail: `notes/trail.tsv` (reviewed by a second model).

## Needs the owner
- Web push delivery to a real device is unverified; test on a phone. For a hosted deploy, call `set_push_dispatch_url` and turn off Realtime "Allow public access".
- Upstream storage-api bug (refused upload leaves the Kong socket undrained): reproducer in `docs/research/`; filing it is your call.
- Whether iOS hands over a JPEG when the memory picker doesn't accept HEIC (D23) is unverified on a device.
- Title pages that have a TOC entry get a "You finished <book title>" prompt; decide whether entries matching the book title count as front matter.

## Known gaps
- Rare e2e tail failures remain under extreme load (load average 30 to 48, 6 workers): 3 in 132 warm-server executions, each a different assertion (inbox within 3 s, own paint within 5 s, `waitForSave` within 5 s). Probes measured those paths at 0.1 to 0.9 s, so the deadlines have 2 to 4 s of headroom. With `--workers 2` the suite passed 22/22 at load average 52.
- A progress save that fails is retried only on the next page turn or on leaving the page (`useProgressSaver` sets `pending` but schedules no retry). See F4.
