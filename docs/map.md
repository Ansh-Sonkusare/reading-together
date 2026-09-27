# Map

How the idea (`docs/idea.md`) turns into a small set of primitives, and where each one lives. Status: **draft until the open questions in `PLAN.md` are answered.**

## Four primitives

Every feature comes from four things. If a new feature needs a fifth, record why in `docs/decisions.md`.

| Primitive | Table | What it is |
|---|---|---|
| **Position** | `progress` | Where each reader is in a book (a locator) |
| **Mark** | `mark` | Anything left at a spot in the text: highlight, reaction, note, reply, bookmark, send |
| **Event** | `event` | An append-only record of what happened and when |
| **Reveal** | `answer` | A hidden answer that's revealed once both partners have answered |

On top of these sits one rule, the **spoiler gate**: a mark is visible to me if I wrote it, or its position is at or before my position.

## Feature → primitive

| Idea feature | Built from | Notes |
|---|---|---|
| Shared library | `book` | Both partners read **the same uploaded file** (`sha256`). That removes StoryGraph's edition-mismatch bug. |
| "Alex p.42, you p.38" | Position | Pages are derived from the locator for display, never stored |
| Sync reading mode | Position + Realtime presence | Last phase; nothing new in the schema |
| Chapter completion | Event `chapter_finished` | Derived from position crossing a spine boundary |
| Streak, goals | Events (+ `goal` row) | Computed, not stored |
| Highlight + 7 reactions | Mark `highlight` / `reaction` | Reaction set is a fixed enum |
| Note, reply thread | Mark `note` / `reply` (`parent_id`) | |
| "Reminded me of you" | Mark `send` + Event → push | |
| Private bookmarks | Mark `bookmark` + `label` | |
| Couple memories | Mark `memory` + `media_url` | |
| Per-person colors, themes | `member.color`, local reader prefs | Reader prefs are device-local |
| Notifications | Event → push | Personal wording comes from the event plus the mark text |
| Spoiler protection | Spoiler gate (RLS) | Locked marks show as `🔒 Sarah left a reaction` |
| Discussion questions | Reveal (`kind = question`) | Questions are a static list per chapter in v1 |
| Guess their reaction | Reveal (`kind = guess`) | Same mechanism, different prompt |
| Stats dashboard | SQL views over Mark and Event | |
| "Our Book" timeline | Event, grouped by day | |

## System

```
 ┌──────────── Next.js PWA (apps/web) ─────────────┐
 │ reader/   epub renderer + locator + highlight   │
 │ marks/    selection menu, thread, lock chip     │
 │ couple/   invite, library, progress bar         │
 │ together/ timeline, stats, streak, discussion   │
 └───────┬───────────────────────▲─────────────────┘
         │ supabase-js (RLS)     │ Realtime (mark, progress, presence)
 ┌───────▼───────────────────────┴─────────────────┐
 │ Supabase: Postgres + Auth + Storage (epubs)     │
 │  tables → RLS spoiler gate → triggers → event   │
 │  edge fn: event → web push                      │
 └─────────────────────────────────────────────────┘
```

## Locator (load-bearing)

```ts
type Locator = {
  spine: number        // spine item index
  offset: number       // char offset in that spine item's text, layout-independent
  cfi: string          // for the renderer to jump to
  quote?: { exact: string; prefix: string; suffix: string } // re-anchor after reflow
}
// pos = spine + offset / spineLength  → one sortable numeric column, computed in the reader
```

`pos` is what the spoiler gate compares. It doesn't depend on layout, so font size and screen width can't change it. Both partners have the same file, so the same passage always gets the same `pos`.

## Source layout

```
reading-together/
├── AGENTS.md  CLAUDE.md  PLAN.md
├── docs/  idea.md map.md interfaces.md decisions.md research/ prompts/
├── notes/status.md
├── supabase/migrations/        ← WS-A owns
└── src/
    ├── app/                    ← routes (thin)
    ├── features/reader/        ← WS-B owns
    ├── features/marks/         ← WS-C owns
    ├── features/couple/        ← WS-D owns
    ├── features/together/      ← WS-E owns (phase 3+)
    └── lib/  supabase.ts, types.ts (generated from DB)
```

This is a single Next.js app, not a monorepo. Split it only when a native app actually exists.
