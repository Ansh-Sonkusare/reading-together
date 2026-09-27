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

const ROSE = '#d6336c';
const COBALT = '#3b5bdb';
const JADE = '#0ca678';
const VIOLET = '#7048e8';

async function user(label: string): Promise<User> {
  const email = `mark-color-${label}-${run}@test.local`;
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

const locator = { spine: 0, offset: 120, cfi: 'epubcfi(/6/2!/4/2,/1:120,/1:131)', quote: { exact: 'rabbit-hole', prefix: 'down the ', suffix: ' went' } };
const pos = 0.12 as Pos;

let A: User;
let B: User;
let bookId: string;

beforeAll(async () => {
  [A, B] = await Promise.all(['a', 'b'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: ROSE }));
  const coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: COBALT }));
  ({ id: bookId } = await ok(admin.from('book').insert({ couple_id: coupleId, title: 'Alice', added_by: A.id, spine_lengths: [1000] }).select('id').single()));
  for (const u of [A, B]) await ok(u.db.from('progress').upsert({ user_id: u.id, book_id: bookId, pos: 0.5, max_pos: 0.5 }).select());
});

it('a highlight, note and bookmark keep the ink they were made in, and B reads it back', async () => {
  const hl = await createMark(A.db, { kind: 'highlight', bookId, locator, pos, color: VIOLET });
  const note = await createMark(A.db, { kind: 'note', bookId, locator, pos, body: 'Jade note', color: JADE });
  const bm = await createMark(A.db, { kind: 'bookmark', bookId, locator, pos, label: 'Funny part', color: VIOLET });
  const plain = await createMark(A.db, { kind: 'highlight', bookId, locator, pos });
  const seen = await ok(B.db.from('mark').select('id, color').in('id', [hl.id, note.id, bm.id, plain.id]).order('created_at'));
  expect(seen).toEqual([
    { id: hl.id, color: VIOLET },
    { id: note.id, color: JADE },
    { id: bm.id, color: VIOLET },
    { id: plain.id, color: null },
  ]);
});

it("A can't mark in B's ink, and B can't mark in A's; each can in their own and a free ink", async () => {
  await expect(createMark(A.db, { kind: 'note', bookId, locator, pos, body: 'x', color: COBALT })).rejects.toMatchObject({ code: '23514' });
  await expect(createMark(A.db, { kind: 'note', bookId, locator, pos, body: 'x', color: ROSE })).resolves.toMatchObject({ color: ROSE });
  await expect(createMark(B.db, { kind: 'bookmark', bookId, locator, pos, label: 'x', color: ROSE })).rejects.toMatchObject({ code: '23514' });
  await expect(createMark(B.db, { kind: 'bookmark', bookId, locator, pos, label: 'x', color: JADE })).resolves.toMatchObject({ color: JADE });
});

it("an update can't move a mark into the partner's ink but can move it to a free one", async () => {
  const hl = await createMark(A.db, { kind: 'highlight', bookId, locator, pos, color: JADE });
  const clash = await A.db.from('mark').update({ color: COBALT }).eq('id', hl.id);
  expect(clash.error?.code).toBe('23514');
  const free = await A.db.from('mark').update({ color: VIOLET }).eq('id', hl.id).select('color').single();
  expect(free.error).toBeNull();
  expect(free.data).toEqual({ color: VIOLET });
});

it('only inks, and only on highlights, notes and bookmarks', async () => {
  const row = { kind: 'highlight' as const, book_id: bookId, locator, pos };
  const offPalette = await A.db.from('mark').insert({ ...row, color: '#000000' });
  expect(offPalette.error?.code).toBe('23514');
  const reaction = await A.db.from('mark').insert({ ...row, kind: 'reaction', emoji: 'love', color: JADE });
  expect(reaction.error?.code).toBe('23514');
  const control = await A.db.from('mark').insert({ ...row, kind: 'reaction', emoji: 'love' }).select('color').single();
  expect(control.error).toBeNull();
  expect(control.data).toEqual({ color: null });
});
