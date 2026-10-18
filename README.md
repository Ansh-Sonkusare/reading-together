# Reading Together

A shared e-book reader. Two people read the same EPUB, see where the other one is, and leave highlights, reactions, notes and replies for each other in the margins. Each reader writes in their own ink.

## What it does

- **Shared library.** Either reader uploads an EPUB, and both read the same copy.
- **Progress for two.** A duet ribbon shows both places in the book: "Alex p.42 · you p.38".
- **Margins.** Highlight a passage, react (❤️ 😂 😭 😮 🤔 🔥 💭), leave a note, reply in a thread. Everything arrives live, in the author's chosen ink.
- **Spoiler lock.** Anything the other reader left further ahead is invisible, including the fact that it exists, until you reach that page. The database enforces this.
- **Bookmarks and passage sharing.** Label pages to revisit, or send a passage to the other reader's inbox.
- **Chapter discussions.** Answer questions separately, then see each other's answers. Guess the other reader's reaction before it's revealed.
- **Habits.** A streak for days you both read, a daily goal, and shared reading stats.
- **Reading timeline.** A dated record of reading a book together, with photos and notes attached to passages.
- **Sync mode.** Read together live: the follower's pages turn with the leader's.
- **Personal touches.** Reading themes, font size, dark mode, push notifications written in the other reader's name.

## Stack

Next.js 16 (App Router) PWA · Supabase (Postgres, Auth, Storage, Realtime, pg_net) · foliate-js reader · Tailwind 4 · Playwright + vitest.

## Run it locally

Needs Node 24, pnpm and Docker.

```bash
pnpm install
pnpm db:start                 # local Supabase in Docker
pnpm supabase status -o env   # copy API_URL, ANON_KEY, SERVICE_ROLE_KEY into .env.local (see .env.example)
pnpm dev
```

Tests:

```bash
pnpm test          # unit
pnpm test:db       # RLS gates, triggers, storage (needs the local stack)
pnpm test:e2e      # two-browser Playwright specs
```

## How it's built

- `docs/idea.md` is the original brief. `docs/map.md` maps every feature onto four primitives: position, mark, event, reveal.
- `docs/interfaces.md` is the contract between parts; `docs/decisions.md` records design decisions.
- `docs/design.md` is the visual system: two inks, the duet ribbon, Literata and Onest.
- `supabase/migrations/` holds the schema. The spoiler gate, reveal gate and shared-library scope live in row-level security, each with a DB test.
- `.claude/skills/verify-reading-together/` drives the real app as two readers for verification.

## Deploying

1. Create a Supabase project and apply `supabase/migrations/` in order.
2. Set the Vercel env vars from `.env.example` (Supabase URL and keys, VAPID keys for push).
3. After the first deploy, run `select set_push_dispatch_url('https://<your-domain>/api/push/dispatch');` as the service role, and turn off "Allow public access" in the project's Realtime settings.
