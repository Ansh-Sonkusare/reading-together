# Decisions

Newest last. Format: **D#: decision.** Why. Status (`decided` by the owner, `provisional` until the grill confirms it).

- **D1: Books come from user-uploaded EPUBs only.** DRM rules out store books, and the owner chose upload (2026-09-27). A public-domain catalogue is out of scope for now. `decided`
- **D2: One shared file per book.** Both partners read the same uploaded bytes (`book.sha256`), so positions match exactly. This fixes StoryGraph's edition mismatch. `provisional`
- **D3: Positions are a layout-independent `pos` (spine + char offset / spine length), with anchors stored as CFI + text quote.** Page numbers are display-only. `provisional`
- **D4: Four primitives: Position, Mark, Event, Reveal.** All annotation kinds share one `mark` table; timeline, stats and notifications are derived from `event`. `provisional`
- **D5: The spoiler gate and reveal gate are enforced in Postgres RLS, not in the client.** A client bug must not be able to leak content from ahead. `provisional`
- **D6: Stack: Next.js PWA + Supabase (Auth, Postgres, Storage, Realtime) + pnpm + Tailwind/shadcn + vitest, deployed on Vercel.** Matches the house stack; Supabase covers RLS and realtime in one place. `decided` (2026-09-27)
- **D7: Sync reading mode is last.** It only needs presence, so nothing in the schema depends on it. `provisional`
- **D8: Web PWA first; native comes later on the same Supabase backend.** Reader engine: foliate-js (annotation and progress modules built in) with epub.js as the fallback, picked by a Phase 0 spike. `decided` (platform) / `provisional` (engine)
- **D9: The spoiler lock hides a mark's content and its existence.** No 🔒 chip, because a chip's page and kind (😭 on p.200) is itself a spoiler. Marks appear once your progress reaches them. `decided`
