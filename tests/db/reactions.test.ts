import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, expect, it } from 'vitest';
import type { Pos } from '@/features/reader';
import type { Database } from '@/lib/types';
import { createMark } from '../../src/features/marks/data';

type Client = SupabaseClient<Database>;
type User = { id: string; db: Client };

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);
const MIGRATION = 'supabase/migrations/20260927001800_any_emoji_reactions.sql';

async function user(label: string): Promise<User> {
  const email = `reactions-${label}-${run}@test.local`;
  const password = 'password-123';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(env.API_URL, env.ANON_KEY, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: created.data.user.id, db };
}

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data == null) throw new Error('no data');
  return data;
}

const psql = (sql: string) =>
  execSync('docker exec -i supabase_db_reading-together psql -U postgres -v ON_ERROR_STOP=1 -At -q', { input: sql, encoding: 'utf8' });

const locator = (cfi: string) => ({ spine: 0, offset: 120, cfi, quote: { exact: 'rabbit-hole', prefix: 'down the ', suffix: ' went' } });
const pos = 0.12 as Pos;

let A: User;
let B: User;
let bookId: string;

beforeAll(async () => {
  [A, B] = await Promise.all(['a', 'b'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#d6336c' }));
  const coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#3b5bdb' }));
  bookId = (await ok(admin.from('book').insert({ couple_id: coupleId, title: 'Alice', added_by: A.id, spine_lengths: [1000, 1000] }).select('id').single())).id;
  await Promise.all([A, B].map((u) => u.db.from('progress').upsert({ user_id: u.id, book_id: bookId, pos: 0.5, max_pos: 0.5 })));
});

// Puts `mark.emoji` back to the old enum inside a transaction, writes rows the old way, runs the real migration, then rolls back.
it('the migration maps the 7 old reactions to their emoji and folds duplicates into the oldest, replies and all', () => {
  const words = ['love', 'funny', 'emotional', 'surprised', 'interesting', 'favorite', 'think'];
  const row = (id: number, emoji: string, cfi: string, at: string) =>
    `('00000000-0000-4000-8000-00000000000${id}', '${bookId}', '${A.id}', 'reaction', 0.1, '{"cfi":"${cfi}"}', '${emoji}', '${at}')`;
  const out = psql(`
    begin;
    drop view couple_stats;
    drop index mark_one_reaction_per_emoji;
    alter table mark drop constraint mark_emoji_is_reaction;
    delete from mark where emoji not in ('❤️','😂','😭','😮','🤔','🔥','💭');
    create type reaction as enum ('love', 'funny', 'emotional', 'surprised', 'interesting', 'favorite', 'think');
    alter table mark alter column emoji type reaction using case emoji
      when '❤️' then 'love' when '😂' then 'funny' when '😭' then 'emotional' when '😮' then 'surprised'
      when '🤔' then 'interesting' when '🔥' then 'favorite' when '💭' then 'think' end::reaction;
    insert into mark (id, book_id, author_id, kind, pos, locator, emoji, created_at) values
      ${words.map((w, i) => row(i + 1, w, `cfi-${i}`, '2026-09-27T10:00:00Z')).join(',\n')},
      ${row(8, 'emotional', 'cfi-2', '2026-09-27T11:00:00Z')};
    insert into mark (id, book_id, author_id, kind, pos, locator, body, parent_id) values
      ('00000000-0000-4000-8000-000000000009', '${bookId}', '${B.id}', 'reply', 0.1, '{"cfi":"cfi-2"}', 'Same', '00000000-0000-4000-8000-000000000008');
    ${readFileSync(MIGRATION, 'utf8')}
    select string_agg(emoji, ' ' order by id) from mark where book_id = '${bookId}' and kind = 'reaction';
    select parent_id from mark where id = '00000000-0000-4000-8000-000000000009';
    rollback;
  `);
  expect(out.trim().split('\n').filter((l) => !l.startsWith('NOTICE'))).toEqual(['❤️ 😂 😭 😮 🤔 🔥 💭', '00000000-0000-4000-8000-000000000003']);
});

it('one reaction per person per emoji per passage; another emoji or the partner can still react', async () => {
  const at = { kind: 'reaction' as const, bookId, locator: locator('epubcfi(/6/2!/4/2,/1:1,/1:9)'), pos };
  await createMark(A.db, { ...at, emoji: '😭' });
  await expect(createMark(A.db, { ...at, emoji: '😭' })).rejects.toMatchObject({ code: '23505' });
  await createMark(A.db, { ...at, emoji: '🦄' });
  await createMark(B.db, { ...at, emoji: '😭' });
  await createMark(A.db, { ...at, locator: locator('epubcfi(/6/2!/4/2,/1:20,/1:29)'), emoji: '😭' });
  const rows = await ok(B.db.from('mark').select('author_id, emoji').eq('book_id', bookId).eq('kind', 'reaction').order('created_at'));
  expect(rows).toEqual([
    { author_id: A.id, emoji: '😭' },
    { author_id: A.id, emoji: '🦄' },
    { author_id: B.id, emoji: '😭' },
    { author_id: A.id, emoji: '😭' },
  ]);
});

it('only a reaction carries an emoji, and it is a short non-empty one', async () => {
  const at = { book_id: bookId, pos: 0.2, locator: locator('epubcfi(/6/2!/4/2,/1:40,/1:49)') };
  for (const kind of ['highlight', 'note', 'bookmark'] as const) {
    const bad = await A.db.from('mark').insert({ ...at, kind, emoji: '😭', body: 'b', label: 'l' });
    expect(bad.error?.code, kind).toBe('23514');
  }
  for (const emoji of [null, '', '  ', 'x'.repeat(17)]) {
    const bad = await A.db.from('mark').insert({ ...at, kind: 'reaction', emoji });
    expect(bad.error?.code, JSON.stringify(emoji)).toBe('23514');
  }
  const highlight = await A.db.from('mark').insert({ ...at, kind: 'highlight' }).select('emoji').single();
  expect(highlight.error).toBeNull();
  const family = await A.db.from('mark').insert({ ...at, kind: 'reaction', emoji: '👨‍👩‍👧‍👦' }).select('emoji').single();
  expect(family.data).toEqual({ emoji: '👨‍👩‍👧‍👦' });
});
