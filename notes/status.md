# Status: what's true right now

_Update before ending every session._

## Now
- Every problem in PLAN.md is done and merged on master: P01-P51 plus follow-ups F1 (private realtime), F2 (discussion entry points), F3 (TOC chapter labels, foliate errors).
- Checks on master: unit 90, db 60, e2e 17 (two of three full runs clean; the third failed two tests while the machine's load average was about 20, and both passed 3/3 on repeat), build green.
- Verify skill: `.claude/skills/verify-reading-together/` covers every shipped feature.
- Decision trail: `notes/trail.tsv` (reviewed by a second model).

## Needs the owner
- D10 (partner position and chapter-finished pushes visible while ahead) is a product call made autonomously; confirm or override.
- Web push delivery to a real device is unverified; test on a phone. For a hosted deploy, call `set_push_dispatch_url` and turn off Realtime "Allow public access".
- Upstream storage-api bug (refused upload leaves the Kong socket undrained): reproducer in `docs/research/`; filing it is your call.
- Title pages that have a TOC entry get a "You finished <book title>" prompt; decide whether entries matching the book title count as front matter.

## Known gaps
- Front matter still counts toward chapter stats and chapter goals (`day_totals`).
- The e2e suite is timing-sensitive under heavy machine load; use `--workers 2` when the machine is busy.
- The discussion page joins its channel by hand instead of through `joinChannel`.
- HEIC memory photos display only in Safari.
