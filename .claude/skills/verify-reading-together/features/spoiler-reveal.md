# Spoiler reveal (P21)

**Status: built.** The gate itself is enforced in RLS (P02, `pnpm
test:db`) and the UI reveal now exists: a partner's mark ahead of you is
absent everywhere (no thread, no paint, not even in page text), then the
moment you reach it a toast announces it and the mark paints in. Selectors
and the exact scenario below are copied from `tests/e2e/reveal.spec.ts`,
which already drives this markup.

Rule 2 (`docs/interfaces.md`): gate on `mark` select is `author_id =
auth.uid() OR pos <= my_max_pos(book_id)` — a high-water mark, so rereading
earlier chapters never re-hides a mark you've reached. Marks ahead of you
are hidden entirely, including the fact that they exist (D9); no locked
view; failed-RLS realtime inserts are never delivered.

PLAN.md's Phase-0 scenario, which this feature's "done by hand in the UI"
check re-runs: **A at pos 0.5, B at 0.2 — B can't select A's mark at pos
0.4, or even count it. B moves to pos 0.5 — B can now select it and sees
"✨ New from Alex: 😭"-style toast.**

## Sub-features

- `hidden-ahead` — a mark ahead of your `max_pos` is absent from the DOM:
  no overlay paint, no thread, no toast, and the reacted-to text itself
  isn't mentioned anywhere on your page.
- `reveal-on-reach` — the moment `progress.pos`/`max_pos` reaches the
  mark's `pos`, a `role="status"` toast reading "✨ New from \<Partner\>:
  \<emoji\>" appears (has a "Show" button that opens the thread and
  dismisses the toast), and the mark paints in.
- `reread-stays-visible` — rereading earlier text never re-hides a mark
  already reached (the gate is the high-water mark, not current `pos`).

## How to get to it (user POV)

- Passive: triggered by `progress.pos`/`max_pos` advancing past a mark's
  `pos` as you read forward on `/book/[id]`.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Two partners share a couple and book, both on `/book/[id]`
  (`twoPartners({ baseURL })` + `openBook()` — `book-progress.md`).
- `import { pageUntil, toChapter1, select, tap, thread, overlays, paintAt, revealToast, myPos, waitForSaved } from '../scripts/drive.mjs'`.

- **A reads ahead and marks a passage.** `await pageUntil(alex.page, (pos)
  => pos?.startsWith('4.'))` (chapter 3 in `fixtures/alice.epub`), `await
  waitForSaved(alex.page)`, then `(await select(alex.page, 'They were
  indeed a queer-looking party')).getByRole('button', { name: 'Emotional'
  }).click()`. `await expect.poll(() => paintAt(alex.page, 'They were
  indeed a queer-looking party')).toEqual([expect.objectContaining({ fill:
  '#e11d48', count: 1 })])` confirms A's own mark landed.
- **B, still behind, sees no trace.** `await toChapter1(sam.page)` (well
  before chapter 3). Wrap the check in one closure to reuse it: `const
  noTrace = async () => { await waitForSaved(sam.page); await
  expect(revealToast(sam.page)).toHaveCount(0);
  expect((await overlays(sam.page)).filter(o => o.fill ===
  '#e11d48')).toEqual([]); await expect(thread(sam.page)).toHaveCount(0);
  await expect(sam.page.locator('body')).not.toContainText('Emotional');
  }`. Call it once here.
- **B reaches it.** `await pageUntil(sam.page, (pos) =>
  pos?.startsWith('4.'), noTrace)` — `pageUntil`'s third argument re-runs
  `noTrace` before every turn along the way, so the reveal is proven to
  happen exactly at the boundary, not slightly before it.
- **The reveal.** `await expect(revealToast(sam.page)).toHaveText(/✨ New
  from Alex: 😭/, { timeout: 3000 })`; `await expect.poll(() =>
  paintAt(sam.page, 'They were indeed a queer-looking party'), { timeout:
  3000 }).toEqual([expect.objectContaining({ fill: '#e11d48', count: 1
  })])`.
- **Open from the toast.** `revealToast(sam.page).getByRole('button', {
  name: 'Show' }).click()`; the toast disappears
  (`await expect(revealToast(sam.page)).toHaveCount(0)`) and `await
  expect(thread(sam.page)).toContainText('Alex: 😭 Emotional')`.
- **Proof.** Screenshot B at all three states (hidden, revealed, thread
  open). The overlays-filter step in "no trace" is the one that proves
  absence, not just "one mark toggles" — screenshots alone can't show a
  negative.

## Gotchas

- Security-relevant: a false pass here is dangerous. "Greyed out" doesn't
  count as hidden — assert absence from the DOM entirely, which is why the
  recipe checks `overlays()`, `thread()` count and `body` text, not just
  one signal.
- P02's `pnpm test:db` gate test covers the same scenario in SQL. If that's
  green but this fails, the bug is in client re-fetch/realtime logic, not
  RLS.
- `pageUntil`'s default 40-turn cap assumes `fixtures/alice.epub`'s
  pagination; a different fixture may need more turns or a different
  target predicate.
- `mark.pos` must be `<=` the author's own `max_pos` + epsilon (rule 5) —
  A must page to chapter 3 (and save) *before* marking it, or the insert
  is correctly rejected; that's not a bug in this recipe.
