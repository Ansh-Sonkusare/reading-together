# AGENTS.md: Reading Together

Every agent reads this file first, and it's the law. If anything else in the repo contradicts it, this file wins.

A couples' shared EPUB reader with per-person highlights, reactions, threads and a spoiler lock. Idea: `docs/idea.md`.

## Session protocol (every agent, every time)

```
0. Invoke the task-observer skill
1. Read AGENTS.md → notes/status.md → PLAN.md (your phase)
2. Read docs/interfaces.md before touching anything that crosses a workstream
3. Work only in the directories your workstream owns
4. New decision → docs/decisions.md. Schema change needed → "Contract requests" in notes/status.md
5. Run: pnpm typecheck && pnpm test
6. Update notes/status.md before ending
```

## File routing

| Need | Read |
|---|---|
| What's true now | `notes/status.md` |
| What we're building, in order | `PLAN.md` |
| How features map to primitives | `docs/map.md` |
| Contract between parts | `docs/interfaces.md` |
| Why | `docs/decisions.md` |
| Competitors and reader tech | `docs/research/` |

## Workstream ownership

| WS | Owns | Must not edit |
|---|---|---|
| A schema/RLS | `supabase/`, `src/lib/types.ts`, `src/lib/supabase.ts` | `src/features/*` |
| B reader | `src/features/reader/` | `supabase/` |
| C marks | `src/features/marks/` | `supabase/` |
| D couple/library/push | `src/features/couple/`, `public/sw.js` | `supabase/` |
| E together | `src/features/together/` | `supabase/` |
| Orchestrator | `src/app/`, `AGENTS.md`, `PLAN.md`, merges | none |

Each workstream runs in its own git worktree on the branch `ws-<letter>/<phase>-<slug>`.

## Rules

- **The spoiler and reveal gates live in RLS.** Never filter spoilers only in the client. Every gate change ships with a SQL test.
- **Never store page numbers.** Compare positions with `pos`; a page number is derived when displayed.
- **The client never inserts `event` rows.** Triggers write them.
- **Four primitives (Position, Mark, Event, Reveal).** A new table needs a decision in `docs/decisions.md`.
- Use pnpm and TypeScript strict mode. No `any` across a module boundary.
- Proof over claims: a phase is done when its two-browser demo in `PLAN.md` passes.
- Commits: no `Co-Authored-By` trailers.

## Commands (after Phase 0)

```
pnpm dev            # Next.js
pnpm db:start       # supabase start
pnpm db:reset       # re-run migrations + seed
pnpm db:types       # regenerate src/lib/types.ts
pnpm typecheck && pnpm test
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
