# Standing orders (pasted into every worker brief)

1. AGENTS.md is the law. Read it, `docs/interfaces.md` and your problem's row in PLAN.md before writing code.
2. Write only inside your brief's SCOPE. Need something outside it? Stop and report it.
3. One local Supabase instance exists on this machine (project_id `reading-together`, default ports). Only a worker whose brief says `DB: yes` may run `supabase start`, `db reset` or the DB tests. Never run `supabase stop --no-backup` and never delete Docker volumes.
4. Proof over claims. Paste the real tail of every acceptance command. Test fixtures must be real (the fixture EPUB is `fixtures/alice.epub`, the Gutenberg edition). Never hand-write a stand-in for real data.
5. Tests call code the way users do and assert literal expected values.
6. No comments that narrate steps. A comment only for a non-obvious why.
7. No new dependency when the platform or an installed library covers it. Justify each one you add in the REPORT.
8. Commit on your worktree branch with plain messages, no Co-Authored-By trailer. Don't merge, rebase or push.
9. Report: PASS / ISSUES / BLOCKED, branch, head SHA, the acceptance outputs, deviations, follow-ups.
