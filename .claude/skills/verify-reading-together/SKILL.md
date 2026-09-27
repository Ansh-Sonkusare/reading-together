---
name: verify-reading-together
description: "Launch the real Reading Together app (Next.js dev server + the existing local Supabase stack), check it's healthy, drive it in a real browser like one or two partners (two isolated Playwright browser contexts), capture screenshots and a JSON transcript, and clean up. Use when asked to verify, demo, or prove a Reading Together feature works end to end in the real app — not just that unit/DB tests pass."
---

# Verify Reading Together

Reading Together is a Next.js app backed by a local Supabase stack. Its one
user-facing surface is the web UI: sign up, form a couple, upload and share
a book, read it with progress synced live between partners, mark and
discuss it together. `/dev/reader` is a separate dev-only route that
renders `fixtures/alice.epub` through the reader engine (`src/features/reader`,
P13a) without needing auth or a couple — useful for reader-engine-only
checks. See `features/README.md` for what's built today.

This skill never starts, stops or resets the Supabase stack — it only reads
`pnpm supabase status`. Another worker may be using the same local instance.

## Launch

```bash
.claude/skills/verify-reading-together/scripts/launch.sh [run-id]
```

- `run-id` defaults to a timestamp (`YYYYMMDD-HHMMSS`).
- **Port:** `3100 + hash(worktree path) mod 800`, scanned forward until a
  free port is found — so two worktrees running this skill at once don't
  collide. The chosen port is printed and recorded.
- **Env:** if `.env.local` doesn't exist, it's created from `pnpm supabase
  status -o env`: `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` →
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY` →
  `SUPABASE_SERVICE_ROLE_KEY` (matches `src/lib/supabase.ts`). An existing
  `.env.local` is left untouched.
- **Readiness:** polls `GET /login` until `200` (up to 60s). `/login` is a
  public route with no auth/couple/book preconditions, so it stays up across
  changes elsewhere in the app; `doctor.sh` checks `/dev/reader` separately.
- **State:** writes `.verify/<run-id>/server.env` (`RUN_ID`, `PORT`, `PID`,
  `LOG`) and the dev server's own output to `.verify/<run-id>/dev-server.log`.
  Every other script reads this file — nothing is re-derived or guessed.

## Doctor

```bash
.claude/skills/verify-reading-together/scripts/doctor.sh <run-id>
```

Read-only. One `PASS`/`FAIL` line per check, non-zero exit on any failure:

1. our dev server's PID (from `server.env`) is alive.
2. the port it claims to own is listening, and the listener's process
   ancestry traces back to that PID (pnpm forks `next dev`, which forks the
   real `next-server` listener, so a direct PID match would always fail).
3. `GET /login` answers `200` — the same public route `launch.sh` polls for
   readiness, so it can't be broken by an auth/couple/book change elsewhere.
4. `GET /dev/reader` answers `200` — a separate, dev-only check (404s in
   production); worth knowing about before driving the reader, but not the
   readiness signal.
5. `pnpm supabase status` reports the API up (never starts/stops/resets it).
6. `docker info` succeeds (Supabase runs in Docker).

Run this first whenever a drive step looks wrong, before assuming the app
itself is broken.

## Drive

```
.claude/skills/verify-reading-together/scripts/drive.mjs
```

A Node ESM module (import, don't execute) built on Playwright
(`@playwright/test`, already a dev dependency — resolved from the repo's own
`node_modules` regardless of this file's nesting depth). Exports:

- `partner(name, { baseURL })` → `{ context, page }` — an isolated
  `BrowserContext`. **Two partners = two `partner()` calls sharing one
  Chromium instance**, not two processes.
- `signUp`, `fillProfile`, `createCouple`, `join`, `uploadBook`, `openBook` —
  drive P11's `/login`/`/onboarding`/`/join/[code]` and P12's `/library`,
  selectors copied from `tests/e2e/couple.spec.ts` and `tests/e2e/book.spec.ts`.
- `twoPartners({ baseURL })` → `{ alex, sam, run, invite }` — Alex and Sam,
  signed up, joined in one couple, with `fixtures/alice.epub` uploaded and
  shared; the standard starting state for anything past P11/P12.
- `myPos`, `progressPair`, `myPage`, `nextPage`, `prevPage`, `waitForSaved` —
  drive the real `/book/[id]` reading page (P13b/P15), also copied from
  `book.spec.ts`.
- `openReader`, `goTo`, `next`, `prev`, `setFontScale`, `selectText`,
  `paint`, `readPos`, `readPageEndPos` — built on `window.__reader`
  (`docs/interfaces.md`'s `ReaderHandle`), live today via `/dev/reader` only.
- `toChapter1`, `pageUntil`, `locate`, `select`, `tap`, `thread`,
  `overlays`, `paintAt`, `revealToast`, `syncPill` — drive marks, bookmarks,
  spoiler reveal and sync on the real `/book/[id]` page (P14b/P21/P23/P51),
  selectors and logic copied from `tests/e2e/helpers.ts` and
  `marks.spec.ts`/`reveal.spec.ts`/`sync.spec.ts`, which already drive this
  markup. `locate`/`select`/`tap` find text inside the book's real section
  iframe (a `blob:` URL) — distinct from `/dev/reader`'s `selectText` above.
- `closeAll()` — closes the shared browser.

Per-feature recipes with exact calls and expected values live in
[`features/`](./features/README.md) — start there for "how do I prove
feature X."

## Evidence

Everything a run produces goes under `.verify/<run-id>/` at the repo root
(gitignored — see Gotchas): `server.env` (PID/port/log, from `launch.sh`),
`dev-server.log`, `*.png` screenshots
(`page.screenshot({ path: '.verify/<run-id>/<name>.png' })`), and
`transcript.json` — a JSON array of `{ step, action, observed }` a drive
script appends as it goes (one ad hoc script writing to a fixed path is
enough, no separate library needed).

**Proof standards** (see also `features/README.md`): drive the real user
path, never an internal setter or test-only endpoint; capture the action
and the resulting state, not just the final screen; verify side effects
invisible in one DOM from a second, independent view; no mocks for anything
Playwright can drive for real — the local Supabase stack is already the
real boundary.

## Cleanup

```bash
.claude/skills/verify-reading-together/scripts/cleanup.sh <run-id>
```

Reads `.verify/<run-id>/server.env` and kills **only** the process tree
rooted at the PID `launch.sh` recorded (`pnpm dev` → `next dev` → the real
listener, killed leaves-first, `TERM` then `KILL` after 1s). Never kills by
process name, never touches Supabase/Docker, and never deletes anything
under `.verify/` — it only ever reads `server.env`, so evidence survives by
construction. If `server.env` is already gone, cleanup is a no-op (exit 0).

## Gotchas

- `.verify/` and `.env.local` are both in `.gitignore` — evidence and the
  generated env file never need manual exclusion, but still avoid
  `git add -A` out of habit (standing order 3).
- Only run `pnpm supabase status` against the shared local stack — never
  `start`/`stop`/`reset`; another worker may depend on it staying up.
- `pnpm dev --port N &` backgrounds fine from a non-interactive shell (no
  `nohup`/`disown` needed) — confirmed empirically: it survives its
  launching shell exiting.
