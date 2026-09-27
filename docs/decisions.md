# Decisions

Newest last. Format: **D#: decision.** Why. Status (`decided` by the owner, `provisional` until the grill confirms it).

- **D1: Books come from user-uploaded EPUBs only.** DRM rules out store books, and the owner chose upload (2026-09-27). A public-domain catalogue is out of scope for now. `decided`
- **D2: One shared file per book.** Both partners read the same uploaded bytes (`book.sha256`), so positions match exactly. This fixes StoryGraph's edition mismatch. `provisional`
- **D3: Positions are a layout-independent `pos` (spine + char offset / spine length), with anchors stored as CFI + text quote.** Page numbers are display-only. `provisional`
- **D4: Four primitives: Position, Mark, Event, Reveal.** All annotation kinds share one `mark` table; timeline, stats and notifications are derived from `event`. `provisional`
- **D5: The spoiler gate and reveal gate are enforced in Postgres RLS, not in the client.** A client bug must not be able to leak content from ahead. `provisional`
- **D6: Stack: Next.js PWA + Supabase (Auth, Postgres, Storage, Realtime) + pnpm + Tailwind/shadcn + vitest, deployed on Vercel.** Matches the house stack; Supabase covers RLS and realtime in one place. `decided` (2026-09-27)
- **D7: Sync reading mode is last.** It only needs presence, so nothing in the schema depends on it. `provisional`
- **D8: Web PWA first; native comes later on the same Supabase backend. Reader engine: foliate-js**, pinned to upstream commit `78914ae` and installed from git (the npm `foliate-js` package is a third-party republish). The P03 spike (`docs/research/reader-spike.md`) measured that `pos` is identical across font sizes and viewports, and that browser spine lengths equal the upload-time lengths for all 15 spine items. epub.js was rejected: by default it parses XHTML as HTML, which shifts 4 of 15 spine lengths and every offset after a `<pre>` by one. It has also had no release since 2022-02 and is 1.8× the size. `decided`
- **D9: The spoiler lock hides a mark's content and its existence.** No 🔒 chip, because a chip's page and kind (😭 on p.200) is itself a spoiler. Marks appear once your progress reaches them. `decided`
- **D10: Partner position and chapter-finished pushes stay visible while they're ahead.** They show pace, not story content, and "Alex is on p.212" encourages reading together. Marks ahead stay fully hidden (D9). Decided autonomously on 2026-09-27; the owner can override. `provisional`
- **D11: Work lands as small verified commits on `master`.** The repo has no remote. Each problem runs in its own worktree and is merged after verification. `decided`
