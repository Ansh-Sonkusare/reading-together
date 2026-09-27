# House conventions (surveyed from the owner's other repos, 2026-09-27)

- `AGENTS.md` is canonical; `CLAUDE.md` contains only `@AGENTS.md`. Model: `~/code/csgofly/AGENTS.md` (session protocol, file routing table, role/ownership table).
- Coordination lives in files: `notes/status.md` (what's true now), `docs/decisions.md` (why), `docs/interfaces.md` (contracts between parts).
- Stack defaults: pnpm, TypeScript, Next.js (App Router), Tailwind 4 + shadcn, vitest, Vercel. Drizzle/Prisma where there's an ORM.
- No `Co-Authored-By` trailers in commits.
