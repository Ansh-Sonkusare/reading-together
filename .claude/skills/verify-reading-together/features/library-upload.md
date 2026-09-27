# Library upload (P12)

**Status: wip in another worktree, not yet merged into this one.** `/library`
doesn't exist here yet. This file specifies the recipe so it's ready to run
the moment P12 lands; it depends on `auth-and-couple.md`'s couple already
existing (two partners, same couple).

Upload an EPUB to the private `books` Storage bucket
(`{couple_id}/{book_id}.epub`), compute `sha256` and `spine_lengths` on
upload, and share it with the couple's other member (`docs/interfaces.md`).

## Sub-features

- `upload-epub` — partner A uploads `fixtures/alice.epub`; a `book` row is
  created with the correct `sha256` and `spine_lengths`.
- `shared-library` — partner B, same couple, sees the book without
  uploading it themselves.

## How to get to it (user POV)

- `/library` — the couple's shared book list, with an upload control.

## Driving it with drive.mjs

Preconditions:

- `scripts/launch.sh` is running and `scripts/doctor.sh` passes.
- P12's pages are merged into this worktree.
- Partners A and B already share a couple (`features/auth-and-couple.md`).

- **Upload as partner A.** Navigate `alex.page` to `/library`, use the file
  input to upload `fixtures/alice.epub` (the real fixture — never a
  hand-written stand-in). Assert the new book appears in A's list with a
  title.
- **Confirm sha256/spine_lengths.** These aren't visible in the UI; verify
  them by re-reading the `book` row through the same client the app uses
  (a read-only query as one of the two partners, not the service role) and
  compare `sha256` against `shasum -a 256 fixtures/alice.epub`.
- **Shared library.** Reload `bailey.page` at `/library` (no upload from B).
  The same book appears without B doing anything.
- **Proof.** Screenshot both partners' `/library` views side by side;
  record the computed sha256 and the DB-read sha256 in the transcript to
  show they match.

## Gotchas

- The bucket is private and scoped per couple
  (`docs/interfaces.md` Storage section) — verifying "shared" means reading
  as partner B's own session, not the service role key, or the check proves
  nothing about RLS.
- This skill has no DB write access; it can only verify a book already
  uploaded through the real UI, never seed one directly.
- Update the file-input selector from P12's actual markup once it ships.
