# Library upload (P12)

**Status: built.** `/library` (`src/app/library/page.tsx`) is live in this
worktree. Selectors below are copied from `tests/e2e/couple.spec.ts`, which
already drives this exact markup. Depends on `auth-and-couple.md`'s couple
already existing (two partners, same couple) — or just call `twoPartners()`.

Upload an EPUB to the private `books` Storage bucket
(`{couple_id}/{book_id}.epub`), compute `sha256` and `spine_lengths` on
upload (`src/features/couple/books.ts`), and share it with the couple's
other member.

## Sub-features

- `upload-epub` — partner A uploads `fixtures/alice.epub`; a `book` row is
  created with the correct `sha256` and `spine_lengths`, and a
  `role=status` message "Added \"<title>\"." confirms it.
- `shared-library` — partner B, same couple, sees the book without
  uploading it themselves.
- `dedupe` — re-uploading the same bytes doesn't create a second row; a
  `role=status` message containing "already" is shown instead.
- `rejects-non-epub` / `rejects-over-50mb` — a non-EPUB file, or a file over
  50 MB, is refused with `role=alert` and the "Upload" button stays
  disabled for an oversized file.

## How to get to it (user POV)

- `/library` — the couple's shared book list (a `table` once there's at
  least one book), with an `aria-label="EPUB file"` file input and an
  "Upload" button.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- Partners A and B already share a couple (`features/auth-and-couple.md`,
  or `twoPartners({ baseURL })`).
- `import { uploadBook, openBook } from '../scripts/drive.mjs'`.

- **Upload as partner A.** From `/library`, `const status =
  await uploadBook(alex.page, 'fixtures/alice.epub')` — sets the file
  input, clicks "Upload", waits for the `role=status`/`role=alert` line.
  Assert `status === 'Added "Alice\'s Adventures in Wonderland".'` and that
  `alex.page.getByRole('cell', { name: "Alice's Adventures in Wonderland" })`
  is visible.
- **Confirm sha256/spine_lengths.** Not visible in the UI; read the `book`
  row through the same client the app uses (a signed-in user query, not the
  service role):
  ```js
  import { createClient } from '@supabase/supabase-js';
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await db.auth.signInWithPassword({ email: alexEmail, password });
  const { data } = await db.from('book').select('sha256, spine_lengths').eq('id', bookId).single();
  ```
  Compare `data.sha256` against `shasum -a 256 fixtures/alice.epub`.
- **Shared library.** Reload `bailey.page` (or `sam.page`) at `/library`
  (no upload from B). The same book appears without B doing anything —
  assert the row's text matches `/Alice's Adventures in Wonderland\s+Lewis Carroll\s+Alex/`.
- **Dedupe.** `await uploadBook(sam.page, 'fixtures/alice.epub')` again;
  assert the returned text contains "already" and the row count for that
  title is still 1.
- **Proof.** Screenshot both partners' `/library` views side by side;
  record the computed sha256 and the DB-read sha256 in the transcript to
  show they match.

## Gotchas

- The bucket is private, scoped per couple — verify "shared" by reading as
  partner B's own session, never the service role key, or it proves
  nothing about RLS.
- No DB write access here; only verify a book uploaded through the real UI.
- `uploadBook` waits for either `role=status` (success/dedupe) or
  `role=alert` (rejection) — check the returned text to tell them apart,
  it doesn't throw on a rejection.
