# Reading Together verification map

This directory is the maintained source for verifying the user-facing behavior
of Reading Together (a couples' shared EPUB reader). Read this index, then use
the matching feature file as the recipe. It is the "Check that proves it"
column of `PLAN.md` made runnable.

## Baseline preconditions

- Launch with `scripts/launch.sh` — never `pnpm dev` by hand, so port choice
  and evidence recording stay consistent across runs.
- The local Supabase stack must already be running (`pnpm supabase status`).
  This skill never starts, stops or resets it — another worker may be using
  the same DB instance.
- `fixtures/alice.epub` (the Gutenberg edition) is the only book fixture.
  Never hand-write a stand-in EPUB.
- Run `scripts/doctor.sh <run-id>` before driving anything that looks off.

## Driving conventions

- Prefer ARIA roles, accessible labels and `data-testid` over CSS selectors
  or DOM position (`AGENTS.md` / `docs/interfaces.md` conventions).
- Drive the browser through `scripts/drive.mjs` (Playwright). Two partners =
  two `BrowserContext`s from `partner(name)`, not two OS processes.
- Start every recipe from a fresh `scripts/launch.sh` run unless a feature
  file's preconditions say otherwise.

## Proof and skip reporting

- Exercise the real user path — the actual page, the actual RPC/button —
  never an internal setter or test-only endpoint.
- Capture the action and the resulting state, not just the final screen: a
  screenshot plus the observed `data-testid`/ARIA value it proves.
- Verify side effects that aren't visible in the DOM (a row inserted, a
  realtime event delivered) by re-reading them from a second, independent
  view — e.g. a second partner's page, not the same page re-rendered.
- Record the feature ID (from `PLAN.md`) and the entry point used with every
  artifact under `.verify/<run-id>/`.
- Report an unreachable path with the attempted command/URL and the unmet
  precondition (e.g. "/login is 404 — P11 not in this worktree yet"). Never
  report a feature as verified through a different, easier path than the one
  a user would actually take.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the
user-visible behavior, then exactly four H2 sections in this order:

1. `Sub-features` — short IDs, one line each.
2. `How to get to it (user POV)` — every user entry point.
3. `Driving it with drive.mjs` — starts with `Preconditions:`, then labeled
   bullets pairing each user action with an exact `drive.mjs` call (or Bash
   command) and its observable result.
4. `Gotchas` — traps that waste or invalidate a run.

## Features

| Feature | PLAN.md | Status | File |
|---|---|---|---|
| Reader | P13a | built, verified below | [reader.md](./reader.md) |
| Auth and couple | P11 | wip in another worktree, not here yet | [auth-and-couple.md](./auth-and-couple.md) |
| Library upload | P12 | wip in another worktree, not here yet | [library-upload.md](./library-upload.md) |
| Marks and realtime | P14 | not built yet | [marks-realtime.md](./marks-realtime.md) |
| Spoiler reveal | P21 | not built yet | [spoiler-reveal.md](./spoiler-reveal.md) |
