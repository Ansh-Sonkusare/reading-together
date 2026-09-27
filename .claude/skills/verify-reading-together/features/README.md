# Reading Together verification map

This directory is the maintained source for verifying the user-facing behavior
of Reading Together (a couples' shared EPUB reader). Read this index, then use
the matching feature file as the recipe. It is the "Check that proves it"
column of `PLAN.md` made runnable.

## Baseline preconditions

- Launch with `scripts/launch.sh` — never `pnpm dev` by hand — so port
  choice and evidence recording stay consistent.
- The local Supabase stack must already be running (`pnpm supabase
  status`); this skill never starts, stops or resets it.
- `fixtures/alice.epub` (the Gutenberg edition) is the only book fixture —
  never hand-write a stand-in.
- Run `scripts/doctor.sh <run-id>` before driving anything that looks off.

## Driving conventions

- Prefer ARIA roles, accessible labels and `data-testid` over CSS selectors
  or DOM position.
- Drive through `scripts/drive.mjs` (Playwright). Two partners = two
  `BrowserContext`s from `partner(name)`, not two OS processes.
- Start every recipe from a fresh `scripts/launch.sh` run unless a feature
  file's preconditions say otherwise.

## Proof and skip reporting

- Exercise the real user path — the actual page/RPC/button — never an
  internal setter or test-only endpoint.
- Capture the action and the resulting state (a screenshot plus the
  `data-testid`/ARIA value it proves), not just the final screen.
- Verify side effects invisible in the DOM (a row inserted, a realtime
  event delivered) from a second, independent view — a second partner's
  page, not the same page re-rendered.
- Record the feature ID (from `PLAN.md`) and entry point with every
  artifact under `.verify/<run-id>/`.
- Report an unreachable path with the attempted command/URL and unmet
  precondition (e.g. "/login is 404 — P11 not here yet"). Never report a
  feature verified through an easier path than a user would actually take.

## Feature entry contract

Each feature file starts with an H1 and one paragraph on the user-visible
behavior, then exactly four H2 sections: `Sub-features` (short IDs, one
line each); `How to get to it (user POV)` (every entry point); `Driving it
with drive.mjs` (starts with `Preconditions:`, then labeled bullets pairing
each action with an exact call and its observable result); `Gotchas`
(traps that waste or invalidate a run).

## Features

| Feature | PLAN.md | Status | File |
|---|---|---|---|
| Reader | P13a | built, verified below | [reader.md](./reader.md) |
| Auth and couple | P11 | wip in another worktree, not here yet | [auth-and-couple.md](./auth-and-couple.md) |
| Library upload | P12 | wip in another worktree, not here yet | [library-upload.md](./library-upload.md) |
| Marks and realtime | P14 | not built yet | [marks-realtime.md](./marks-realtime.md) |
| Spoiler reveal | P21 | not built yet | [spoiler-reveal.md](./spoiler-reveal.md) |
