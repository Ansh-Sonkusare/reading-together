---
name: verify-reading-together
description: "Launch the real Reading Together app (Next.js dev server + the existing local Supabase stack), check it's healthy, drive it in a real browser like one or two partners (two isolated Playwright browser contexts), capture screenshots and a JSON transcript, and clean up. Use when asked to verify, demo, or prove a Reading Together feature works end to end in the real app — not just that unit/DB tests pass."
---

# Verify Reading Together

Reading Together is a Next.js app backed by a local Supabase stack. Its one
user-facing surface today is the web UI; `/dev/reader` is a dev-only route
that renders `fixtures/alice.epub` through the reader engine
(`src/features/reader`, P13a) without needing auth or a couple. Auth,
couple, library and marks land on top of it as P11/P12/P14 merge.

This skill never starts, stops or resets the Supabase stack — it only reads
`pnpm supabase status`. Another worker may be using the same local instance.

## Launch

```bash
.claude/skills/verify-reading-together/scripts/launch.sh [run-id]
```

- `run-id` defaults to a timestamp (`YYYYMMDD-HHMMSS`); pass one explicitly
  to correlate with a specific verification task.
- **Port:** `3100 + hash(worktree path) mod 800`, then scanned forward until
  a free port is found — so two worktrees running this skill at once don't
  collide even if their hashes land close together. The chosen port is
  printed and recorded.
- **Env:** if `.env.local` doesn't already exist, it's created from the
  running Supabase stack's own status (`pnpm supabase status -o env`):
  `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` →
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY` →
  `SUPABASE_SERVICE_ROLE_KEY` (matching `src/lib/supabase.ts`). An existing
  `.env.local` is left untouched.
- **Readiness:** polls `GET /dev/reader` until it answers `200` (up to 60s).
  `/dev/reader` 404s when `NODE_ENV=production`, so a 404 here means you're
  not running the dev server.
- **State:** writes `.verify/<run-id>/server.env` (`RUN_ID`, `PORT`, `PID`,
  `LOG`) and streams the dev server's own output to
  `.verify/<run-id>/dev-server.log`. Every other script reads this file —
  nothing here is guessed or re-derived.

## Doctor

```bash
.claude/skills/verify-reading-together/scripts/doctor.sh <run-id>
```

Read-only. One `PASS`/`FAIL` line per check, non-zero exit on any failure:

1. our dev server's PID (from `server.env`) is alive.
2. the port it claims to own is actually listening, and the listener's
   process ancestry traces back to that PID (pnpm forks `next dev`, which
   forks the real `next-server` listener — a direct PID match would always
   fail).
3. `GET /dev/reader` answers `200`.
4. `pnpm supabase status` reports the API up (never starts/stops/resets it).
5. `docker info` succeeds (Supabase runs in Docker).

Run this first whenever a drive step looks wrong, before assuming the app
itself is broken.

## Drive

```
.claude/skills/verify-reading-together/scripts/drive.mjs
```

A Node ESM module (import it, don't execute it directly) built on
Playwright (`@playwright/test`, already a dev dependency — resolved from
the repo's own `node_modules` regardless of this file's nesting depth).
Exports:

- `partner(name, { baseURL })` → `{ context, page }` — a fresh, isolated
  `BrowserContext` (own storage/cookies). **Two partners = two `partner()`
  calls sharing one Chromium instance**, not two processes.
- `signUp`, `createCouple`, `join` — depend on P11's `/login`,
  `/onboarding`, `/join/[code]`. They call `requirePage` first, which
  throws a clear error (naming the missing route and the blocking problem
  ID) if the page 404s, instead of silently doing nothing.
- `openReader`, `goTo`, `next`, `prev`, `setFontScale`, `selectText`,
  `paint`, `readPos`, `readPageEndPos` — built on `window.__reader`
  (`docs/interfaces.md`'s `ReaderHandle`), live today.
- `closeAll()` — closes the shared browser.

Per-feature driving recipes with exact calls and expected values live in
[`features/`](./features/README.md) — start there, not here, for "how do I
prove feature X."

## Evidence

Everything a run produces goes under `.verify/<run-id>/` at the repo root
(gitignored — see Gotchas below):

- `server.env` — the launched PID/port/log, written by `launch.sh`.
- `dev-server.log` — the dev server's stdout/stderr for this run.
- `*.png` — screenshots (`page.screenshot({ path: '.verify/<run-id>/<name>.png' })`).
- `transcript.json` — a JSON array of `{ step, action, observed }` entries
  a drive script appends as it goes; a single ad hoc script writing to a
  fixed path is enough, no separate library is needed for this.

**Proof standards** (see also `features/README.md`):

- Drive the real user path — the actual page/RPC/button — never an
  internal setter or a test-only endpoint.
- Capture the action and the resulting state, not just the final screen.
- Verify side effects invisible in one DOM by re-reading them from a
  second, independent view (a second partner's page, or a direct read-only
  query as that partner) — never trust the same page re-rendering itself.
- No mocks for anything Playwright can drive for real; the local Supabase
  stack is the real boundary already, so there's nothing to fake here.

## Cleanup

```bash
.claude/skills/verify-reading-together/scripts/cleanup.sh <run-id>
```

Reads `.verify/<run-id>/server.env` and kills **only** the process tree
rooted at the PID `launch.sh` recorded (`pnpm dev` → `next dev` → the real
listener — killed leaves-first, `TERM` then `KILL` after 1s if needed).
Never kills by process name, never touches Supabase or Docker, and never
deletes anything under `.verify/` — evidence survives cleanup by
construction (cleanup only ever touches `server.env`'s own directory, and
only to read it).

If `server.env` is already gone, cleanup is a no-op (exit 0) — safe to run
twice, or after a launch that never fully succeeded.

## Gotchas

- `.verify/` is not yet in `.gitignore` (this skill's scope is
  `.claude/skills/verify-reading-together/**` only, so it can't add the
  entry itself) — flag this to whoever owns `.gitignore` next; until then,
  don't `git add -A` after a run.
- Only run `pnpm supabase status` against the shared local stack — never
  `start`/`stop`/`reset`. Another worker may depend on it staying up with
  its current data.
- `pnpm dev --port N` backgrounds fine from a non-interactive shell (no
  `nohup`/`disown` needed) — confirmed empirically: a backgrounded dev
  server here survives its launching shell exiting.
