# Interfaces (the contract parallel workers build against)

Only WS-A edits the schema. Any other workstream that needs a change posts a request in `notes/status.md` under **Contract requests**. The generated `src/lib/types.ts` is the TypeScript form of this file.

## Tables (draft)

```sql
couple   (id uuid pk, invite_code text unique, created_at)
member   (user_id uuid pk → auth.users, couple_id → couple, name, color text not null, avatar_url,
          timezone text not null default 'UTC' check is a pg_timezone_names name)
         -- at most 2 members per couple (trigger)
         -- color is one of the six inks (check color = any(inks())), unique(couple_id, color): partners never share an ink (U0)
book     (id, couple_id, title, author, sha256 text, storage_path, spine_lengths int[], toc jsonb null, cover_path text null, added_by, created_at,
          unique(couple_id, sha256))
         -- toc: [{ spine, label }] from the EPUB nav (else NCX), first entry per spine; null before F3 or when no entry hits the spine (D18)
         -- cover_path: covers/{couple_id}/{book_id}.{jpg|png|webp|gif}, null when the EPUB has no usable cover (U2)
         -- no client insert policy: only the uploadBook server action inserts, with the service role (D13)
progress (user_id, book_id, pos numeric, max_pos numeric, locator jsonb, updated_at, pk(user_id, book_id))
         -- pos = start of the visible page (where to reopen); max_pos = greatest(max_pos, end of visible page), never decreases
mark     (id, book_id, author_id, kind mark_kind, pos numeric, locator jsonb,
          emoji reaction?, body text?, label text?, media_url text?, parent_id → mark?, color text?, created_at)
         -- color (U1): null = the author's member ink; else one of inks(), only on highlight|note|bookmark,
         -- and never the ink of another member of the book's couple (trigger mark_color_not_partners, 23514)
answer   (id, book_id, spine int, kind answer_kind, prompt_key text, user_id, value text, created_at,
          unique(book_id, spine, prompt_key, user_id))
event    (id, couple_id, book_id?, actor_id, type event_type, ref_id uuid?, pos numeric?, data jsonb, created_at)
         -- pos is set for events about a place in the text (mark_created) so the spoiler gate can hide them
push_sub (user_id, endpoint, keys jsonb, pk(user_id, endpoint))
         -- own rows only (RLS); the browser upserts it from <EnableNotifications/>; the sender deletes it on a 404/410
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

- `create_couple(name text, color text) → invite_code text` (color snapped to the nearest ink; null → Rose)
- `join_couple(invite_code text, name text = null, color text = null) → couple_id uuid` (raises `couple is full` for a third member; color snapped to the nearest ink, raises `ink taken` if that is the partner's; null → first ink the partner doesn't have)
- `inks() → text[]` (the six lowercase hexes, palette.ts order), `nearest_ink(want text, taken text[] = '{}') → text`: internal helpers, not granted to clients.

- `set_goal(kind goal_kind, target int)`: upserts the caller's couple goal; either partner may call it.

Members may update only their own `name`, `color`, `avatar_url`, `timezone`.

## Storage

Private bucket `books`, object path `{couple_id}/{book_id}.epub`, readable and writable only by that couple's members. `uploadBook` writes the object with the member's own session, then inserts the `book` row with the service role.

Private bucket `covers` (U2), object path `{couple_id}/{book_id}.{jpg|png|webp|gif}`: couple members select and insert (same folder rule as `books`); images only, up to 10 MB. `addBook` extracts the cover at upload (`epubCover`: EPUB3 `properties="cover-image"`, else EPUB2 `<meta name="cover">`) and stores it with the member's session; `scripts/backfill-covers.mjs` (service role, idempotent) fills older books. Pages show covers through 600 s signed URLs.

Private bucket `memories` (P43), object path `{couple_id}/{mark_id}.{jpg|png|webp|heic|heif}`: couple members select and insert, only the uploader deletes. The bucket allows `image/jpeg|png|webp|heic|heif` up to 10 MB. A `memory` mark's `media_url` is that storage path (never a public URL), and `mark_insert` / `mark_update` require it (`memory_media_ok`); every other kind has `media_url` null. Clients show it through a 60 s signed URL.

## Rules enforced in the database (RLS and triggers)

1. **Couple scope**: every row is visible only to members of its couple.
2. **Spoiler gate** on `mark` select: `author_id = auth.uid() OR pos <= my_max_pos(book_id)`. The gate uses the high-water mark, so rereading earlier chapters never hides marks you've already reached. The same gate applies to `event` rows whose `pos` is set, so the timeline and notifications can't leak a hidden mark. Marks ahead of you are hidden entirely, including the fact that they exist (D9). There is no locked view. Realtime inserts that fail RLS are never delivered, so nothing leaks.
3. **Reveal gate** on `answer` select: you see your own answer, and your partner's only once you've answered the same prompt.
4. **Events are written by triggers only**, never by the client. Clients can't insert into `event`.
5. `mark.pos` must be ≤ the author's own `progress.max_pos` + ε. You can't annotate text you haven't reached.
6. `chapter` = spine item. `chapter_finished` fires when `floor(max_pos)` increases; `book_finished` fires when `max_pos` reaches the spine count.
7. A `max_pos` rise writes `reading_day`, then `goal_met` once the member's `day_totals` reach the couple goal (the trigger fires after `progress_event`, so a chapter finished in the same update counts). Streak = consecutive local days, ending today or yesterday, on which both partners have a `reading_day` row; computed by `streak()` in `features/together/streak.ts`.
8. **Push** (P33): `event_push` (after insert on `event`) posts `{event_id}` with pg_net to the vault secret `push_dispatch_url`, header `x-push-secret` = vault `push_dispatch_secret` (generated by the migration; readable only by the service role via `push_dispatch_secret()`). It posts only `mark_created | chapter_finished | book_finished | answer_revealed`, only when the actor's partner has a `push_sub`, and never a mark whose `pos` is past the partner's `max_pos` (rule 2 applied before anything leaves the DB). Point it elsewhere with `set_push_dispatch_url(url) → previous` (service role only). `goal_met` isn't pushed in v1.

## Routes

- `/together`: stats tiles, then the streak row (`data-testid="streak"`: `🔥 {n}-day reading streak` or `Start a streak: read today together`; `"goal-progress"`: `Today: You 7/10 pages · Sam 10/10 ✓`) and the goal form. Loading it syncs `member.timezone` from the browser.
- `/book/[id]`: server checks membership, signs a 60 s Storage URL; the client restores `progress.locator` (else pos 0), saves on relocate. Font scale is per device in `localStorage['reader:fontScale']`. Test hooks: `data-testid="my-pos"` and `"saved-pos"` (pos, 6 decimals), `"progress-pair"` (screen-reader text for the DuetRibbon: `{partner} p.{n} · you p.{m}`, `{partner} hasn't started`, partner part hidden when solo). Discussion entry points (F2): a header link `Discuss {chapterTitle(toc, spine - 1)}` once `pos >= 1` and that title is non-null, and a floating `complementary "Chapter finished"`: Toast `You finished {chapterTitle(toc, n)}.` + `Discuss it together` + Dismiss, shown only for a non-null title when a relocate enters a spine beyond the furthest reached (n = that spine − 1). Both go to `discussHref(bookId, n)`.
- `/discuss/[bookId]/[spine]`: the chapter's questions and guess card (P32); 404 for front matter (`chapterTitle` null).
- `/together/book/[bookId]`: the timeline; the `💬 You discussed {labels, joined by Intl.ListFormat}` line (front matter left out) links each chapter to its `/discuss` page.
- `POST /api/push/dispatch`: called only by `event_push`; 401 without the secret. Loads the event with the service role, words it with `notificationFor`, sends Web Push (VAPID) to each of the partner's `push_sub` rows. `src/proxy.ts` must let it, `/sw.js` and `/manifest.webmanifest` through without a session (open follow-up from P33).
- `/library` mounts `<EnableNotifications/>`: permission is requested only on its button click. `/sw.js` (public/) shows the push and opens or focuses its `url` on click.

## Realtime channels

- `inbox:{userId}` (mark INSERT, kind send): the /library inbox.
- `marks:{bookId}` (mark) and `progress:{bookId}` (progress): postgres_changes, one channel per feature so names never collide in one client. RLS still applies, and the client re-fetches marks when its own progress moves past new ones.
  Two client gotchas (P15): call `realtime.setAuth(session.access_token)` before joining, or the join can go out as anon and RLS delivers nothing; and don't join an identical channel before the previous leave resolves (StrictMode remount), because Realtime keys the subscription by its params and the late leave kills the new one.
- `discussion:{bookId}:{spine}` (event, answer_revealed): the discussion page's reveal.
- `sync:{bookId}` (P51, replaces the drafted `presence:book:{id}`): presence `{ userId }` says who's in the book; broadcast `signal` `{ type: invite|accept|decline|leave, by }` and `locator` `{ by, locator }` (leader only, 150 ms after its last relocate). Ephemeral, nothing stored. **Private** (F1): joined with `joinChannel(..., { private: true })`; the realtime.messages policies `book_topic_receive`/`book_topic_send` allow broadcast and presence only when `can_use_book_topic(realtime.topic())`, i.e. the topic is `sync:<uuid>` and you are a member of that book's couple. Anything else, a malformed topic included, is refused (CHANNEL_ERROR, ~5 s). A public channel of the same name is a separate topic and never sees private traffic. A new `<feature>:<bookId>` broadcast/presence channel extends the prefix list in `can_use_book_topic`.

## Client module surfaces (signatures only)

```ts
// features/reader (shipped in P13a; foliate is imported only by reader.ts)
createReader(container: HTMLElement, file: Blob, opts: { spineLengths: number[] }): Promise<ReaderHandle>
ReaderHandle.on('relocate', e => { locator, pos, pageEndPos, spine })   // pageEndPos = pos of last visible char → progress.max_pos
ReaderHandle.on('select',   e => { locator, pos, text, rect })          // locator.cfi spans the range
ReaderHandle.on('markClick', e => { id, rect })
ReaderHandle.on('lengthMismatch', e => { spine, expected, actual })
ReaderHandle.on('anchorLost', e => { id, spine })   // mark couldn't be placed by CFI, offset or quote (P22)
ReaderHandle.paint(marks: PaintMark[])     // full set, idempotent; PaintMark = { id, locator, color, kind: 'highlight'|'underline'|'note', fresh? }
    // highlight fill = ink at 22%; note = that fill + a 2px underline in the same ink; fresh inks in once (0.7 s wipe, skipped under reduced motion)
ReaderHandle.goTo(target: Locator | Pos)   // nothing renders until the first goTo
ReaderHandle.next() / prev() / setFontScale(n) / clearSelection() / destroy()   // clearSelection: after a mark is made
ReaderHandle.setTheme({ background, color })   // colours inside the book iframe; shares foliate's styles slot with setFontScale, both survive section loads (P44)
// prefs.tsx (P44): device-local, localStorage['reader:prefs'] = { theme: 'light'|'sepia'|'dark'|'night', fontScale: 0.8..1.6, background?: '#rrggbb' }; parsePrefs defaults each bad field
usePrefs(): [Prefs, (patch: Partial<Prefs>) => void]
<ReaderPrefs handle={ReaderHandle | null} />   // theme / text size / background / app theme controls; applies prefs to the handle on mount and change
// app dark mode: <html class="dark">, localStorage['app:theme'] = 'light'|'dark'|'system' (default system), set before paint by the inline script in app/layout.tsx
// paint places each mark by: CFI if its text equals quote.exact → stored offset → findByQuote near offset (resolveAnchor)
// locator.ts: resolveAnchor, toPos, fromPos, quoteAt, findByQuote, spineLengthsFromEpub, tocFromEpub, zipReader, canonicalText, offsetOf, rangeAt
// together/discussion.ts: chapterTitle(toc: Toc | null, spine) → the TOC label at or before spine; null = front matter; toc null → `Chapter {spine+1}`
displayPage(pos, spineLengths): number     // floor(chars before pos / 1500) + 1; display only, never stored
pageCount(spineLengths): number   // ceil(all chars / 1500), at least 1; the DuetRibbon's total
// goTo anchors on the first non-whitespace char at or after the target offset (inter-block whitespace has no box to scroll to)

// features/marks
createMark(db, input: NewMark): Promise<Mark>   // a reply copies its parent's locator and pos
addMemory(db, { bookId, locator, pos, photo: Blob, caption | null }): Promise<Mark>   // P43: memoryExt checks type and size, uploads to
    // memories/{couple}/{uuid}.{ext}, then inserts the kind 'memory' mark with that id at the anchor's locator/pos; a failed insert removes the photo
memoryPhotoUrl(db, path): Promise<string>   // 60 s signed URL
useMarks(bookId, { myMaxPos }): { marks: Mark[]; anchors: Anchor[]; revealed: Mark[] }   // live over marks:{id} via joinChannel;
    // re-fetches when myMaxPos (useProgressSaver's savedMaxPos) changes, so a partner's earlier marks appear once reached;
    // revealed = the latest batch a re-fetch newly returned past the previous fetch's max_pos (revealedBy), for the toast
revealedBy({ ids, maxPos }, marks): Mark[]    // unseen, top-level, in-text marks with pos > maxPos
<RevealToast mark partner onShow onClose />   // role=status "✨ New from {partner}: {emoji | 'a note' | 'a memory' | 'a highlight'}" + Show (opens
    // the thread); 8 s. Never a count or hint of marks still ahead (D9): it only describes marks RLS already returned
// bookmark and send marks carry a locator but aren't anchors: groupByAnchor skips them, so they're never painted or threaded
<BookmarksPanel bookmarks members onGo(mark) onClose />   // Sheet (dialog) "Bookmarks" from the /book top bar; ribbon in inkOf + label + quote, click → goTo
// /book/[id]: a bookmark whose pos is within the visible page [pos, pageEndPos] hangs as a ribbon in its ink from the top edge of the page
//   (<li role=img aria-label="Bookmark: {label}">); it never paints on the text
BOOKMARK_LABELS   // First quote we both loved · Favorite chapter · Funny part · Important conversation (+ custom text)
useInbox(meId): Mark[]   // the partner's sends, newest first, live over inbox:{meId} (client-side kind check)
<Inbox meId partner books />   // marks' original; /library now renders features/couple/inbox.tsx's Inbox (same contract, quote cards in the partner's ink)
// /book/[id]?mark={id}: the server reads that mark's locator (RLS) and the reader opens there instead of progress.locator
toPaintMarks(anchors, members): PaintMark[]   // one per CFI in each author's latest coloured mark there (else their ink); a note → 'note';
    // both partners → 'underline' in the blend of their two inks
inkOf(mark, members): string   // mark.color, unless null or now the partner's ink → the author's member ink
<SelectionMenu rect myColor partnerColor? onHighlight(color?) onReact(r) onNote(body, color?) onBookmark(label, color?) partnerName? onSend(message|null) onDismiss />
    // InkSwatches radios "Ink" (every ink but the partner's; default my ink, then the last one picked on this device, localStorage['marks:ink'])
    // apply to Highlight, Note and Bookmark; reactions and sends stay in the author's ink
    // 7 reactions by aria-label + Highlight + Note + Bookmark (label picker) + "Send to {partner}" (optional message; solo: hidden);
    // kept inside the viewport; dismisses on Escape, a click outside it, or a click into the book (window blur)
<ThreadPanel anchor members meId onReply(body) onClose />   // Sheet (dialog) titled "In the margin": bottom sheet below md, side panel at md+; Escape or Close closes; each line's dot in inkOf
    // memories render in time order with the anchor's marks as <li aria-label="Memory"> (img alt "Memory photo", "📸 {You|name}: caption");
    // "Add a memory 📸" opens form "Add a memory" (Photo, Caption, Save memory) and calls addMemory itself; the mark arrives over marks:{bookId}
// /book/[id]: select → SelectionMenu; markClick(id) → ThreadPanel for anchors.find(a => a.cfi === id);
//   replies parent to the anchor's first mark. Overlay test hook: foliate overlay <g data-mark-id={cfi} fill={color}>
// lib/realtime.ts
joinChannel(db, name, listen, onSubscribed, { private? }): leave   // waits for the previous leave, setAuth, then subscribes; private for broadcast/presence

// features/sync (P51)
reduce(s: SyncState, e: SyncEvent, me): SyncState   // pure; SyncState solo | partnerHere | inviting | invited{from} | leading | following{leader}
    // e.by === me is my own action, else the partner's; unexpected events leave s unchanged; simultaneous invites: the smaller user id leads
useSync(bookId, me, reader): { sync, notice, signal(type), relocated(locator) }   // follower chases the leader's locator with serialised goTo;
    // the follower's own relocates still save progress (max_pos rises: consented by Accept) but are never broadcast
<SyncPill sync notice partnerName partnerColor onSignal className? />   // /book header, data-testid="sync-pill" data-state={kind}: "{partner} is here" + Read together now,
    // "Waiting for {partner}…" + Cancel, "Reading together with {partner} ❤️" + Leave, then the last notice (You left… / {partner} left…)
<SyncInvite partnerName partnerColor onSignal />   // role=dialog "Read together": "{partner} wants to read together. You'll follow {partner}'s pages." Accept / Not now
// /book/[id]: a Prev/Next/arrow turn or a bookmark jump while following leaves sync; the partner leaving the book (presence) ends it for both
// /book/[id] layout (U1, docs/design.md "Book"): one top bar (Library, title, DuetRibbon, SyncPill, Bookmarks, Discuss, Aa) that drops to 35%
//   opacity after the first turn (data-reading="true") and returns on hover or focus; the "Previous page" / "Next page" buttons are the
//   full-height transparent tap zones at the left and right edges (max(2.75rem, 7%) wide); arrow keys turn too. No footer.

// features/couple
useProgressSaver(bookId, userId, initial: Progress | null): { save(pos, pageEndPos, locator); savedPos; savedMaxPos }   // client; 1 s debounce,
    // max_pos = max(initial.max_pos, every pageEndPos seen); flushes on pagehide / visibilitychange hidden via keepalive fetch
usePartnerProgress(bookId, partnerId | null, initial: Progress | null): Progress | null   // client; live via book:{id}
    // (replaces the drafted useProgressPair: "me" is the reader's own relocate pos, so only the partner needs a hook)
getMyCouple(): Promise<{ id; inviteCode; members: { userId; name; color }[] } | null>   // server only
listBooks(coupleId): Promise<{ id; title; author; coverUrl | null; spineLengths; places: { userId; pos; updatedAt }[] }[]>   // server only
ribbonOf(book, members, meId) → { total, marks: RibbonMark[] }; lastRead(books, meId) → Book | null   // DuetRibbon props; the continue-reading book
addBook(db, admin, file) → UploadResult   // features/couple/add-book.ts: uploadBook's body, free of server-only (tests/db/cover.test.ts)
epubCover(bytes) → { bytes, type, ext } | null   // features/couple/epub-cover.ts, no imports (Node runs it in the backfill script)
uploadBookAction(prev, formData{file}) → { ok: string } | { error: string }              // server action

// features/notify
notificationFor(event, mark | null, parent | null, members: { userId; name; maxPos }[], recipientId, book: { title; toc })
    → { title; body; url } | null   // pure; null for chapter_finished/answer_revealed on front matter; parent = the replied-to mark, or for a reaction the recipient's own mark at the same cfi
dispatch(db /* service role */, eventId, send: (target: { endpoint; keys }, payload: string) => Promise<unknown>)
    → { sent; removed }             // send rejecting with statusCode 404/410 deletes that push_sub
<EnableNotifications/>             // client; registers /sw.js, subscribes with NEXT_PUBLIC_VAPID_PUBLIC_KEY, upserts push_sub
```
