# Together stats and timeline (P41/P42)

**Status: built.** `/together` (`src/app/together/page.tsx`) and
`/together/book/[bookId]` (`src/app/together/book/[bookId]/page.tsx`) are
live in this worktree, reading `src/features/together/stats.ts` (the
`couple_stats` SQL view) and `timeline-data.ts`/`timeline.ts`. Recipe below
is written from source (`src/features/together/*`); this run's live pass
covered `book-progress.md` only — see the run notes for what's unproven.

"Our Book" timeline (a day-by-day feed of chapter, highlight, note, reply,
bookmark, send and memory events, in the reader's local time zone) and a
couple stats dashboard (books together, pages, highlights, discussions,
favourite reactions), both scoped to the couple via RLS.

## Sub-features

- `stats-tiles` — four tiles (📚 books together, 📖 pages, ❤️ highlights, 💬
  discussions) with literal counts from the `couple_stats` view.
- `favorite-reactions` — reactions ranked by count, each a `<name>: count`
  line; "No reactions yet." when the couple has none.
- `book-list` — every shared book links to its own timeline.
- `timeline-empty` — "Nothing yet. Open the book together to start your
  story." before any events exist.
- `timeline-days` — events grouped into the reader's local calendar days,
  each day one or more human-readable lines (e.g. "Alex highlighted a
  passage"), oldest first.
- `memories-line` — a closing summary line below the timeline
  (`memoriesLine()` in `timeline.ts`).

## How to get to it (user POV)

- `/library` → "Our reading" link → `/together`.
- `/together`'s `aria-label="Stats"` list (four `<li>` tiles), a "Favorite
  reactions" `<ol>`, and an "Our books" `<ul>` of links.
- Each book link → `/together/book/[bookId]`'s `aria-label="Timeline"`
  ordered list, one `<li>` per day.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and at least one uploaded book
  (`twoPartners({ baseURL })`); events accumulate as marks/discussions ship
  (P14b, P31, P32) and progress is saved (`book-progress.md`).

- **Open Together.** `await page.goto('/together')` (or click "Our
  reading" from `/library`). Read each tile: `page.getByRole('list', {
  name: 'Stats' }).getByRole('listitem')`, in order books/pages/highlights/discussions;
  each tile's count is its `<span class="text-2xl font-bold">` text, parsed
  as a number.
- **Cross-check a literal count.** Compare the "pages" tile against the sum
  of pages actually turned in this run (from `book-progress.md`'s
  `myPage()`), or read `couple_stats` directly as a signed-in partner
  (same pattern as `library-upload.md`'s sha256 check) for an exact
  comparison.
- **Open a book's timeline.** `await page.getByRole('link', { name: title
  }).click()`, then `page.getByRole('list', { name: 'Timeline' })`. With no
  events yet, assert the empty-state paragraph instead
  ("Nothing yet. Open the book together to start your story.").
- **Proof.** Screenshot `/together` and one book's timeline; record the
  parsed tile counts and (if cross-checked) the matching `couple_stats` row
  in the transcript.

## Gotchas

- Timeline days group by the *reader's local* time zone
  (`groupByDay(events, timeZone)` re-runs client-side after hydration) —
  comparing two partners' timelines across a day boundary needs the same
  system clock/timezone on both browser contexts, or the grouping can
  legitimately differ.
- `pages`/`highlights`/`discussions` depend on features still landing
  elsewhere (P14b marks, P31 chapter events, P32 discussions) — a 0 tile
  isn't necessarily a bug in this page; check the source feature first.
- `favoriteReactions` only lists reactions with `count > 0` — an empty
  couple correctly shows "No reactions yet.", not a zeroed list.
