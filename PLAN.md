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
- **SQL tests for the gates** (pgTAP or vitest against local Supabase): A at pos 0.5, B at 0.2, B can't select A's mark at 0.4 or even count it, then B moves to 0.5 and can select it.
- Stub `features/*/index.ts` with the signatures from `interfaces.md`, throwing `not implemented`.
- ✅ Demo: `pnpm test` is green, including the gate tests.

### 1. Core loop (parallel: A, B, C, D)
- **D** Sign-up, create couple, invite link, join. Upload EPUB → Storage; compute `sha256` and `spine_lengths` on upload.
- **B** Reader: open from Storage, paginate, compute `Locator`/`pos` on relocate, save progress (debounced), emit selections, paint marks.
- **C** Selection menu (highlight, 7 reactions, note), thread panel with replies, per-person colours, Realtime subscription.
- **D** Progress pair bar: "Alex p.42 · you p.38".
- ✅ Demo: A highlights and reacts, and B sees it within 2 seconds. B replies, and A sees the reply.

### 2. Spoiler lock and bookmarks (parallel: B, C)
- **C** Marks ahead appear live as your progress reaches them (with a small "✨ new from Alex" reveal). Bookmarks with labels. "Reminded me of you" send.
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

## Problems (worked one at a time; each ends in a check)

`docs/idea.md` broken into problems. Each problem is one worktree, one merge, and fits the PR budget (≤20 files, ≤800 added lines). Status values: `todo`, `wip`, `done`, `parked`. Decision trail: `notes/trail.tsv`.

| # | Problem | WS | Check that proves it | Status |
|---|---|---|---|---|
| P01 | Scaffold: Next.js, pnpm, Tailwind + shadcn, vitest, Supabase CLI as a dev dependency, scripts from AGENTS.md | orch | `pnpm build && pnpm typecheck && pnpm test` | done |
| P02 | Schema, RLS spoiler and reveal gates, event triggers, generated types | A | `pnpm test:db` runs the gate scenarios against local Supabase | done |
| P03 | Reader engine spike: foliate-js vs epub.js; compute `pos`, CFI and quote | B | A script shows one passage gets the same `pos` at two font sizes; the loser is written up in decisions | done |
| P04 | `verify-reading-together` skill: launch, doctor, two browser contexts as two partners | orch | The skill's own run passes and its evidence survives cleanup | done |
| P11 | Auth, couple, invite link, join (max 2) | D | verify: A invites, B joins, a third account is refused | done |
| P12 | Upload EPUB → Storage, `sha256` + `spine_lengths`, shared library | D | verify: A uploads, B sees the book | done |
| P13a | Reader engine behind `ReaderHandle` (foliate): render, paginate, relocate → Locator/pos, select, paint, goTo, font size, per-chapter length check; `/dev/reader` page; Playwright e2e | B | `pnpm test:e2e` reader spec: pos stable across font sizes in the real app | done |
| P13b | Reader page wired to data: open a book from Storage, save progress (debounced, max_pos = page end), restore position | B | verify: reopening restores the position | done |
| P14a | Marks data + components: createMark/useMarks with Realtime, same-range merge for painting, SelectionMenu (highlight, 7 reactions, note), ThreadPanel (replies), per-person colours | C | unit + DB tests; component test renders the 7 reactions | done |
| P14b | Wire marks into /book/[id]: select → menu → mark painted; markClick → thread; live for the partner | C | verify: A reacts and B sees it within 2 seconds; B replies and A sees it | done |
| P15 | Progress pair bar "Alex p.42 · you p.38" | D | verify: both positions shown and updated live | done |
| P21 | Reveal-on-reach: marks ahead are invisible, then appear with "✨ new from Alex" | C | verify: gate scenario done by hand in the UI | done |
| P22 | Re-anchor a mark by text quote when its CFI misses | B | verify: a highlight lands on the same text at font sizes S and L | done |
| P23 | Bookmarks with labels, "Reminded me of you" send | C | verify: the send appears in the partner's inbox | done |
| P31 | Chapter-finished events, streaks, goals | E | unit tests on the streak calculation + verify: the streak shows | done |
| P32 | Chapter discussion and guess-the-reaction with blind reveal | E | `pnpm test:db` reveal gate + verify: reveal after both answer | done |
| P33 | Web push: service worker, subscriptions, edge function wording | D | the edge function test renders the personal wording; subscription stored | done |
| P41 | "Our Book" timeline | E | verify: timeline lists the day's events | done |
| P42 | Couple stats dashboard | E | SQL view test with literal counts | done |
| P43 | Couple memories (photo on a mark) | C | verify: a photo attached to a highlight shows for both | done |
| P44 | Themes, dark mode, font size, background | D | verify: prefs persist across reload | done |
| P51 | Sync reading mode (presence, follow the leader) | B | verify: B's page follows A's page turn | done |

Test book: a public-domain EPUB in `fixtures/` (test data only; D1 still holds for the product).

## Follow-up problems

| # | Problem | WS | Check that proves it | Status |
|---|---|---|---|---|
| F1 | Private Realtime channels: `sync:{bookId}` and the other broadcast/presence channels require couple membership (RLS on `realtime.messages`) | A | DB test: another couple's user can't join or send on the channel (positive control: partner can) | done |
| F2 | Entry points to chapter discussion: "Discuss Chapter N" on the book page after a chapter is finished, and from the timeline's "discussed" lines; e2e specs for discussion and streaks | E | e2e: finishing a chapter shows the link, it opens /discuss and the reveal works; /together shows the streak after both read | done |
| F3 | Chapter labels from the book's TOC (front matter isn't "Chapter 1"); foliate errors on leaving the reader and on chapter load | B | e2e: finishing Chapter I says "Chapter I"; no uncaught browser errors during book.spec | wip |
