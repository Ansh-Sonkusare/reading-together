import { execSync } from 'node:child_process';
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

async function user(label: string): Promise<User> {
  const email = `marks-${label}-${run}@test.local`;
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

async function book(coupleId: string, by: User, title: string): Promise<string> {
  const { id } = await ok(admin.from('book').insert({ couple_id: coupleId, title, added_by: by.id, spine_lengths: [1000, 1000] }).select('id').single());
  return id;
}

const setPos = async (u: User, bookId: string, pos: number) => {
  const { error } = await u.db.from('progress').upsert({ user_id: u.id, book_id: bookId, pos, max_pos: pos });
  if (error) throw error;
};

const locator = { spine: 0, offset: 120, cfi: 'epubcfi(/6/2!/4/2,/1:120,/1:131)', quote: { exact: 'rabbit-hole', prefix: 'down the ', suffix: ' went' } };
const pos = 0.12 as Pos;

let A: User;
let B: User;
let bookId: string;
let otherBookId: string;

beforeAll(async () => {
  [A, B] = await Promise.all(['a', 'b'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  const coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#2563eb' }));
  [bookId, otherBookId] = await Promise.all([book(coupleId, A, 'Alice'), book(coupleId, A, 'Other')]);
  await Promise.all([setPos(A, bookId, 0.5), setPos(B, bookId, 0.5), setPos(A, otherBookId, 0.5), setPos(B, otherBookId, 0.5)]);
});

let noteId: string;

it('B reads back every kind A created', async () => {
  const highlight = await createMark(A.db, { kind: 'highlight', bookId, locator, pos });
  const reaction = await createMark(A.db, { kind: 'reaction', bookId, locator, pos, emoji: 'surprised' });
  const note = await createMark(A.db, { kind: 'note', bookId, locator, pos, body: 'This reminds me of you.' });
  noteId = note.id;

  const seen = await ok(B.db.from('mark').select('id, author_id, kind, pos, locator, emoji, body, parent_id').eq('book_id', bookId).order('created_at'));
  const base = { author_id: A.id, pos: 0.12, locator, emoji: null, body: null, parent_id: null };
  expect(seen).toEqual([
    { ...base, id: highlight.id, kind: 'highlight' },
    { ...base, id: reaction.id, kind: 'reaction', emoji: 'surprised' },
    { ...base, id: note.id, kind: 'note', body: 'This reminds me of you.' },
  ]);
});

it("B's reply inherits the parent's locator and pos", async () => {
  const reply = await createMark(B.db, { kind: 'reply', bookId, parentId: noteId, body: 'Me too!' });
  expect(reply).toMatchObject({ author_id: B.id, kind: 'reply', parent_id: noteId, body: 'Me too!', pos: 0.12, locator });
});

it('refuses a reply to a mark in another book', async () => {
  const other = await createMark(A.db, { kind: 'highlight', bookId: otherBookId, locator, pos });
  await expect(createMark(B.db, { kind: 'reply', bookId, parentId: other.id, body: 'wrong book' })).rejects.toMatchObject({ code: '42501' });
});
