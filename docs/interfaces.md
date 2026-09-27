# Interfaces (the contract parallel workers build against)

Only WS-A edits the schema. Any other workstream that needs a change posts a request in `notes/status.md` under **Contract requests**. The generated `src/lib/types.ts` is the TypeScript form of this file.

## Tables (draft)

```sql
couple   (id uuid pk, invite_code text unique, created_at)
member   (user_id uuid pk → auth.users, couple_id → couple, name, color text, avatar_url,
          timezone text not null default 'UTC' check is a pg_timezone_names name)
         -- at most 2 members per couple (trigger)
book     (id, couple_id, title, author, sha256 text, storage_path, spine_lengths int[], added_by, created_at,
          unique(couple_id, sha256))
         -- no client insert policy: only the uploadBook server action inserts, with the service role (D13)
progress (user_id, book_id, pos numeric, max_pos numeric, locator jsonb, updated_at, pk(user_id, book_id))
         -- pos = start of the visible page (where to reopen); max_pos = greatest(max_pos, end of visible page), never decreases
mark     (id, book_id, author_id, kind mark_kind, pos numeric, locator jsonb,
          emoji reaction?, body text?, label text?, media_url text?, parent_id → mark?, created_at)
answer   (id, book_id, spine int, kind answer_kind, prompt_key text, user_id, value text, created_at,
          unique(book_id, spine, prompt_key, user_id))
event    (id, couple_id, book_id?, actor_id, type event_type, ref_id uuid?, pos numeric?, data jsonb, created_at)
         -- pos is set for events about a place in the text (mark_created) so the spoiler gate can hide them
push_sub (user_id, endpoint, keys jsonb)
reading_day (user_id, book_id, day date, from_max_pos numeric, to_max_pos numeric, pk(user_id, book_id, day),
          check to_max_pos > from_max_pos)
         -- written only by the progress trigger when max_pos rises; day = the reader's local day (member.timezone);
         -- from = max_pos before the day's first rise, to = latest max_pos. Couple members select.
goal     (couple_id pk → couple, kind goal_kind, target int check > 0, updated_by, updated_at)
         -- one per couple; written only through set_goal(); couple members select
```

Views (security_invoker, so RLS applies): `couple_stats`; `reading_today (user_id, couple_id, day, pages, chapters)`, each member's own local today with `day_totals` for it.
`day_totals(uid, day) → (pages, chapters)`: pages = floor(chars between from and to, summed over the day's books / 1500), chapters = that member's `chapter_finished` events in the day. `pos_chars(pos, spine_lengths)` is displayPage's numerator; `display_page` uses it.

`mark_kind`: `highlight | reaction | note | reply | bookmark | send | memory`
`reaction`: `love | funny | emotional | surprised | interesting | favorite | think`
`event_type`: `book_added | book_started | mark_created | chapter_finished | book_finished | answer_revealed | goal_met`
`answer_kind`: `question | guess`
`goal_kind`: `pages_per_day | chapters_per_day`

`chapter_finished.data = {spine: n}`, one row per newly finished spine. `answer_revealed.data = {spine, prompt_key, kind}`. `goal_met.data = {day, kind, target}` (book_id null), at most one per member per day (unique index).

## RPCs

Clients never insert `couple` or `member` rows; they call:

- `create_couple(name text, color text) → invite_code text`
- `join_couple(invite_code text, name text = null, color text = null) → couple_id uuid` (raises `couple is full` for a third member)

- `set_goal(kind goal_kind, target int)`: upserts the caller's couple goal; either partner may call it.

Members may update only their own `name`, `color`, `avatar_url`, `timezone`.

## Storage

Private bucket `books`, object path `{couple_id}/{book_id}.epub`, readable and writable only by that couple's members. `uploadBook` writes the object with the member's own session, then inserts the `book` row with the service role.

## Rules enforced in the database (RLS and triggers)

1. **Couple scope**: every row is visible only to members of its couple.
2. **Spoiler gate** on `mark` select: `author_id = auth.uid() OR pos <= my_max_pos(book_id)`. The gate uses the high-water mark, so rereading earlier chapters never hides marks you've already reached. The same gate applies to `event` rows whose `pos` is set, so the timeline and notifications can't leak a hidden mark. Marks ahead of you are hidden entirely, including the fact that they exist (D9). There is no locked view. Realtime inserts that fail RLS are never delivered, so nothing leaks.
3. **Reveal gate** on `answer` select: you see your own answer, and your partner's only once you've answered the same prompt.
4. **Events are written by triggers only**, never by the client. Clients can't insert into `event`.
5. `mark.pos` must be ≤ the author's own `progress.max_pos` + ε. You can't annotate text you haven't reached.
6. `chapter` = spine item. `chapter_finished` fires when `floor(max_pos)` increases; `book_finished` fires when `max_pos` reaches the spine count.
7. A `max_pos` rise writes `reading_day`, then `goal_met` once the member's `day_totals` reach the couple goal (the trigger fires after `progress_event`, so a chapter finished in the same update counts). Streak = consecutive local days, ending today or yesterday, on which both partners have a `reading_day` row; computed by `streak()` in `features/together/streak.ts`.

## Routes

- `/together`: stats tiles, then the streak row (`data-testid="streak"`: `🔥 {n}-day reading streak` or `Start a streak: read today together`; `"goal-progress"`: `Today: You 7/10 pages · Sam 10/10 ✓`) and the goal form. Loading it syncs `member.timezone` from the browser.
- `/book/[id]`: server checks membership, signs a 60 s Storage URL; the client restores `progress.locator` (else pos 0), saves on relocate. Font scale is per device in `localStorage['reader:fontScale']`. Test hooks: `data-testid="my-pos"` and `"saved-pos"` (pos, 6 decimals), `"progress-pair"` (the bar: `{partner} p.{n} · you p.{m}`, `{partner} hasn't started`, partner part hidden when solo; colours from `member.color`).

## Realtime channels

- `marks:{bookId}` (mark) and `progress:{bookId}` (progress): postgres_changes, one channel per feature so names never collide in one client. RLS still applies, and the client re-fetches marks when its own progress moves past new ones.
  Two client gotchas (P15): call `realtime.setAuth(session.access_token)` before joining, or the join can go out as anon and RLS delivers nothing; and don't join an identical channel before the previous leave resolves (StrictMode remount), because Realtime keys the subscription by its params and the late leave kills the new one.
- `presence:book:{id}`: current locator, used by sync mode.

## Client module surfaces (signatures only)

```ts
// features/reader (shipped in P13a; foliate is imported only by reader.ts)
createReader(container: HTMLElement, file: Blob, opts: { spineLengths: number[] }): Promise<ReaderHandle>
ReaderHandle.on('relocate', e => { locator, pos, pageEndPos, spine })   // pageEndPos = pos of last visible char → progress.max_pos
ReaderHandle.on('select',   e => { locator, pos, text, rect })          // locator.cfi spans the range
ReaderHandle.on('markClick', e => { id, rect })
ReaderHandle.on('lengthMismatch', e => { spine, expected, actual })
ReaderHandle.paint(marks: PaintMark[])     // full set, idempotent; PaintMark = { id, locator, color, kind: 'highlight'|'underline' }
ReaderHandle.goTo(target: Locator | Pos)   // nothing renders until the first goTo
ReaderHandle.next() / prev() / setFontScale(n) / destroy()
// locator.ts: toPos, fromPos, quoteAt, findByQuote, spineLengthsFromEpub, zipReader, canonicalText, offsetOf, rangeAt
displayPage(pos, spineLengths): number     // floor(chars before pos / 1500) + 1; display only, never stored
// goTo anchors on the first non-whitespace char at or after the target offset (inter-block whitespace has no box to scroll to)

// features/marks
createMark(input: NewMark): Promise<Mark>
useMarks(bookId): Mark[]   // re-fetches when my progress passes new marks

// features/couple
useProgressSaver(bookId, userId, initial: Progress | null): { save(pos, pageEndPos, locator); savedPos }   // client; 1 s debounce,
    // max_pos = max(initial.max_pos, every pageEndPos seen); flushes on pagehide / visibilitychange hidden via keepalive fetch
usePartnerProgress(bookId, partnerId | null, initial: Progress | null): Progress | null   // client; live via book:{id}
    // (replaces the drafted useProgressPair: "me" is the reader's own relocate pos, so only the partner needs a hook)
getMyCouple(): Promise<{ id; inviteCode; members: { userId; name; color }[] } | null>   // server only
listBooks(coupleId, members): Promise<{ id; title; author; addedBy; createdAt }[]>       // server only
uploadBookAction(prev, formData{file}) → { ok: string } | { error: string }              // server action
```
