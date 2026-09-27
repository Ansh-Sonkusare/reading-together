# Interfaces (the contract parallel workers build against)

Only WS-A edits the schema. Any other workstream that needs a change posts a request in `notes/status.md` under **Contract requests**. The generated `src/lib/types.ts` is the TypeScript form of this file.

## Tables (draft)

```sql
couple   (id uuid pk, invite_code text unique, created_at)
member   (user_id uuid pk → auth.users, couple_id → couple, name, color text, avatar_url)
         -- at most 2 members per couple (trigger)
book     (id, couple_id, title, author, sha256 text, storage_path, spine_lengths int[], added_by, created_at)
progress (user_id, book_id, pos numeric, locator jsonb, updated_at, pk(user_id, book_id))
mark     (id, book_id, author_id, kind mark_kind, pos numeric, locator jsonb,
          emoji reaction?, body text?, label text?, media_url text?, parent_id → mark?, created_at)
answer   (id, book_id, spine int, kind ('question'|'guess'), prompt_key text, user_id, value text, created_at,
          unique(book_id, spine, prompt_key, user_id))
event    (id, couple_id, book_id?, actor_id, type event_type, ref_id uuid?, data jsonb, created_at)
push_sub (user_id, endpoint, keys jsonb)
```

`mark_kind`: `highlight | reaction | note | reply | bookmark | send | memory`
`reaction`: `love | funny | emotional | surprised | interesting | favorite | think`
`event_type`: `book_added | book_started | mark_created | chapter_finished | book_finished | answer_revealed | goal_met`

## Rules enforced in the database (RLS and triggers)

1. **Couple scope**: every row is visible only to members of its couple.
2. **Spoiler gate** on `mark` select: `author_id = auth.uid() OR pos <= my_pos(book_id)`. Marks ahead of you are hidden entirely, including the fact that they exist (D9). There is no locked view. Realtime inserts that fail RLS are never delivered, so nothing leaks.
3. **Reveal gate** on `answer` select: you see your own answer, and your partner's only once you've answered the same prompt.
4. **Events are written by triggers only**, never by the client. Clients can't insert into `event`.
5. `mark.pos` must be ≤ the author's own `progress.pos` + ε. You can't annotate text you haven't reached.

## Realtime channels

- `book:{id}`: postgres_changes on `mark` and `progress`. RLS still applies, and the client re-fetches locked marks on progress change.
- `presence:book:{id}`: current locator, used by sync mode.

## Client module surfaces (signatures only)

```ts
// features/reader
openBook(bookId): Promise<ReaderHandle>
ReaderHandle.onRelocate(cb: (loc: Locator, pos: number) => void)
ReaderHandle.onSelect(cb: (sel: { locator: Locator; pos: number; text: string }) => void)
ReaderHandle.paint(marks: Mark[])
ReaderHandle.goTo(locator: Locator)

// features/marks
createMark(input: NewMark): Promise<Mark>
useMarks(bookId): Mark[]   // re-fetches when my progress passes new marks

// features/couple
useProgressPair(bookId): { me: Progress; partner: Progress | null }
```
