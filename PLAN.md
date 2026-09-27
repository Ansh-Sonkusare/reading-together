# Plan

Architecture: `docs/map.md`. Contract: `docs/interfaces.md`. Rationale: `docs/decisions.md`.

Each phase ends in a **demo you can check in two browsers** (two accounts, one couple). A phase is done only after that check passes and is recorded in `notes/status.md`.

## How the work runs in parallel

- **Serial gates, parallel middles.** Phase 0 builds the scaffold and the contract (schema, generated types, stub module surfaces) in one pass. After that, workstreams fan out in separate git worktrees, each owning its own directory (see the ownership table in `AGENTS.md`).
- **Contract first.** WS-A lands migrations and `src/lib/types.ts` before B, C and D start. Other workstreams never edit `supabase/` or `types.ts`; they post requests in `notes/status.md`.
- **Merge order within a phase:** A → D → B → C. Each merge runs `pnpm typecheck && pnpm test` and the phase's demo check.
- **Workers: one subagent per workstream per phase.** An orchestrator reviews and merges. If one subagent runs out of context, split its workstream rather than adding more workers.

## Phases

### 0. Scaffold and contract (serial, one agent)
- `pnpm create next-app`, Tailwind + shadcn, vitest, Supabase CLI and local stack.
- Migrations for every table in `interfaces.md`, including the RLS spoiler gate and reveal gate, and triggers that write `event`.
- **SQL tests for the gates** (pgTAP or vitest against local Supabase): A at pos 0.5, B at 0.2, B can't select A's mark at 0.4 but can see it in `mark_locked`, then B moves to 0.5 and can select it.
- Stub `features/*/index.ts` with the signatures from `interfaces.md`, throwing `not implemented`.
- ✅ Demo: `pnpm test` is green, including the gate tests.

### 1. Core loop (parallel: A, B, C, D)
- **D** Sign-up, create couple, invite link, join. Upload EPUB → Storage; compute `sha256` and `spine_lengths` on upload.
- **B** Reader: open from Storage, paginate, compute `Locator`/`pos` on relocate, save progress (debounced), emit selections, paint marks.
- **C** Selection menu (highlight, 7 reactions, note), thread panel with replies, per-person colours, Realtime subscription.
- **D** Progress pair bar: "Alex p.42 · you p.38".
- ✅ Demo: A highlights and reacts, and B sees it within 2 seconds. B replies, and A sees the reply.

### 2. Spoiler lock and bookmarks (parallel: B, C)
- **C** 🔒 chips from `mark_locked` that unlock live as progress moves. Bookmarks with labels. "Reminded me of you" send.
- **B** Re-anchor a mark by text quote when its CFI misses. Test at font sizes S, M and L.
- ✅ Demo: the gate test from Phase 0, done by hand in the UI.

### 3. Habit (parallel: C, D, E)
- **E** Chapter-finished events, streaks and goals (computed), chapter discussion and guess-the-reaction with reveal.
- **D** Web push: service worker, `push_sub`, and an edge function that sends events as personal messages.
- ✅ Demo: B finishes chapter 5 → A's phone gets "📖 B finished Chapter 5".

### 4. Memories (parallel: E, C, D)
- **E** "Our Book" timeline, stats dashboard (SQL views).
- **C** Couple memories (photo on a mark).
- **D** Themes, dark mode, reading background, font size.

### 5. Sync reading mode (one agent)
- Presence channel; the follower mirrors the leader's `goTo`. Either partner can leave sync.

## Out of scope (for now)
Public-domain catalogue (D1), native apps, groups of more than two, PDFs, DRM books, AI-generated discussion questions.

## Open questions (the grill)
These are answered in chat, and the answers are recorded as decisions in `docs/decisions.md`.
