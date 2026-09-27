import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/lib/types';

type Client = SupabaseClient<Database>;

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const url = env.API_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(url, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);

async function user(label: string): Promise<{ id: string; db: Client }> {
  const email = `${label}-${run}@test.local`;
  const password = 'password-123';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(url, env.ANON_KEY, opts);
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

async function write(p: PromiseLike<{ error: unknown }>) {
  const { error } = await p;
  if (error) throw error;
}

const setPos = (u: { id: string; db: Client }, bookId: string, pos: number) =>
  write(u.db.from('progress').upsert({ user_id: u.id, book_id: bookId, pos, max_pos: pos }));

let A: { id: string; db: Client };
let B: { id: string; db: Client };
let C: { id: string; db: Client };
let D: { id: string; db: Client };
let inviteAB: string;
let coupleAB: string;
let bookId: string;

beforeAll(async () => {
  [A, B, C, D] = await Promise.all(['a', 'b', 'c', 'd'].map(user));
  inviteAB = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  coupleAB = await ok(B.db.rpc('join_couple', { invite_code: inviteAB }));
  await ok(C.db.rpc('create_couple', { name: 'Cam', color: '#2563eb' }));
  const book = await ok(
    A.db
      .from('book')
      .insert({ couple_id: coupleAB, title: 'Alice', added_by: A.id, spine_lengths: [1000, 1000, 1000, 1000] })
      .select()
      .single(),
  );
  bookId = book.id;
  await setPos(A, bookId, 0.5);
  await setPos(B, bookId, 0.2);
});

describe('couple scope', () => {
  it('another couple sees none of our books, progress or marks', async () => {
    await write(A.db.from('mark').insert({ book_id: bookId, author_id: A.id, kind: 'highlight', pos: 0.05 }));
    expect(await ok(C.db.from('book').select('id').eq('id', bookId))).toEqual([]);
    expect(await ok(C.db.from('progress').select('user_id').eq('book_id', bookId))).toEqual([]);
    expect(await ok(C.db.from('mark').select('id').eq('book_id', bookId))).toEqual([]);
    expect((await ok(A.db.from('progress').select('user_id').eq('book_id', bookId))).length).toBe(2);
  });

  it('refuses a third member via join_couple', async () => {
    const { error } = await D.db.rpc('join_couple', { invite_code: inviteAB });
    expect(error?.message).toBe('couple is full');
    expect(await ok(D.db.from('member').select('user_id'))).toEqual([]);
  });

  it('clients cannot insert couple or member rows directly', async () => {
    expect((await D.db.from('couple').insert({})).error?.code).toBe('42501');
    expect((await D.db.from('member').insert({ user_id: D.id, couple_id: coupleAB })).error?.code).toBe('42501');
  });
});

describe('spoiler gate', () => {
  let aheadId: string;
  let behindId: string;

  it('hides a mark ahead of the reader, including from count', async () => {
    aheadId = (await ok(A.db.from('mark').insert({ book_id: bookId, author_id: A.id, kind: 'reaction', emoji: 'emotional', pos: 0.4 }).select().single())).id;
    behindId = (await ok(B.db.from('mark').insert({ book_id: bookId, author_id: B.id, kind: 'note', body: 'hi', pos: 0.1 }).select().single())).id;

    expect(await ok(B.db.from('mark').select('id').eq('id', aheadId))).toEqual([]);
    const { count } = await B.db.from('mark').select('*', { count: 'exact', head: true }).eq('book_id', bookId);
    expect(count).toBe(2);
    expect((await ok(A.db.from('mark').select('id').eq('id', behindId))).map((m) => m.id)).toEqual([behindId]);
  });

  it('reveals the mark once the reader reaches it', async () => {
    await setPos(B, bookId, 0.5);
    expect((await ok(B.db.from('mark').select('id').eq('id', aheadId))).map((m) => m.id)).toEqual([aheadId]);
  });

  it('keeps the high-water mark when the reader goes back', async () => {
    await setPos(B, bookId, 0.1);
    const row = await ok(B.db.from('progress').select('pos, max_pos').eq('user_id', B.id).eq('book_id', bookId).single());
    expect(row).toEqual({ pos: 0.1, max_pos: 0.5 });
    expect((await ok(B.db.from('mark').select('id').eq('id', aheadId))).map((m) => m.id)).toEqual([aheadId]);
  });

  it('refuses a mark beyond the author max_pos (rule 5)', async () => {
    const { error } = await A.db.from('mark').insert({ book_id: bookId, author_id: A.id, kind: 'highlight', pos: 0.9 });
    expect(error?.code).toBe('42501');
  });

  it('refuses a reply whose parent is in another book', async () => {
    const other = await ok(A.db.from('book').insert({ couple_id: coupleAB, title: 'Other', added_by: A.id, spine_lengths: [10] }).select().single());
    await setPos(A, other.id, 0.5);
    const { error } = await A.db.from('mark').insert({ book_id: other.id, author_id: A.id, kind: 'reply', pos: 0.1, parent_id: behindId });
    expect(error?.code).toBe('42501');
  });
});

describe('events', () => {
  it('clients cannot insert events', async () => {
    const { error } = await A.db.from('event').insert({ couple_id: coupleAB, actor_id: A.id, type: 'goal_met' });
    expect(error?.code).toBe('42501');
  });

  it('hides mark_created events ahead of the reader', async () => {
    const book = await ok(A.db.from('book').insert({ couple_id: coupleAB, title: 'Gate', added_by: A.id, spine_lengths: [10, 10] }).select().single());
    await setPos(A, book.id, 0.5);
    await setPos(B, book.id, 0.2);
    const mark = await ok(A.db.from('mark').insert({ book_id: book.id, author_id: A.id, kind: 'highlight', pos: 0.4 }).select().single());

    const q = (u: { db: Client }) => u.db.from('event').select('type, pos, ref_id').eq('ref_id', mark.id);
    expect(await ok(q(B))).toEqual([]);
    expect(await ok(q(A))).toEqual([{ type: 'mark_created', pos: 0.4, ref_id: mark.id }]);
    expect((await ok(B.db.from('event').select('type').eq('book_id', book.id).order('created_at'))).map((e) => e.type)).toEqual([
      'book_added',
      'book_started',
      'book_started',
    ]);
  });

  it('writes one chapter_finished per newly finished spine', async () => {
    await setPos(A, bookId, 2.1);
    const rows = await ok(B.db.from('event').select('data').eq('book_id', bookId).eq('actor_id', A.id).eq('type', 'chapter_finished'));
    expect(rows.map((r) => (r.data as { spine: number }).spine).sort()).toEqual([0, 1]);
  });

  it('writes book_finished once', async () => {
    await setPos(A, bookId, 4);
    await setPos(A, bookId, 4);
    const rows = await ok(A.db.from('event').select('type, data').eq('book_id', bookId).eq('actor_id', A.id).in('type', ['chapter_finished', 'book_finished']));
    expect(rows.filter((r) => r.type === 'book_finished').length).toBe(1);
    expect(rows.filter((r) => r.type === 'chapter_finished').map((r) => (r.data as { spine: number }).spine).sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('reveal gate', () => {
  it("shows a partner's answer only after answering the same prompt", async () => {
    const prompt = { book_id: bookId, spine: 1, kind: 'guess' as const, prompt_key: 'p' };
    await write(A.db.from('answer').insert({ ...prompt, user_id: A.id, value: 'the cat did it' }));
    expect(await ok(B.db.from('answer').select('value').eq('book_id', bookId))).toEqual([]);

    await write(B.db.from('answer').insert({ ...prompt, user_id: B.id, value: 'the queen did it' }));
    for (const u of [A, B]) {
      const values = (await ok(u.db.from('answer').select('value').eq('book_id', bookId))).map((r) => r.value).sort();
      expect(values).toEqual(['the cat did it', 'the queen did it']);
    }
    const revealed = await ok(A.db.from('event').select('actor_id, data').eq('book_id', bookId).eq('type', 'answer_revealed'));
    expect(revealed).toEqual([{ actor_id: B.id, data: { spine: 1, prompt_key: 'p', kind: 'guess' } }]);
  });
});

describe('storage', () => {
  it("another couple cannot download our book file", async () => {
    const path = `${coupleAB}/${bookId}.epub`;
    const epub = readFileSync('fixtures/alice.epub');
    await write(A.db.storage.from('books').upload(path, epub, { contentType: 'application/epub+zip' }));

    const mine = await ok(B.db.storage.from('books').download(path));
    expect(mine.size).toBe(epub.length);
    const theirs = await C.db.storage.from('books').download(path);
    expect(theirs.data).toBeNull();
    expect(theirs.error).not.toBeNull();
    const wrongFolder = await C.db.storage.from('books').upload(`${coupleAB}/x.epub`, epub);
    expect(wrongFolder.error).not.toBeNull();
  });
});
