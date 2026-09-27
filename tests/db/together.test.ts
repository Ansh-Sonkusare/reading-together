import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/lib/types';

type Client = SupabaseClient<Database>;
type User = { id: string; db: Client };

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const url = env.API_URL;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(url, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);

async function user(label: string): Promise<User> {
  const email = `together-${label}-${run}@test.local`;
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

const setPos = (u: User, bookId: string, pos: number) =>
  write(u.db.from('progress').upsert({ user_id: u.id, book_id: bookId, pos, max_pos: pos }));

const stats = (u: User, coupleId: string) =>
  ok(u.db.from('couple_stats').select('books_together, pages, highlights, discussions, reactions').eq('couple_id', coupleId));

let A: User;
let B: User;
let C: User;
let coupleAB: string;
let coupleC: string;
let bookId: string;

beforeAll(async () => {
  [A, B, C] = await Promise.all(['a', 'b', 'c'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  coupleAB = await ok(B.db.rpc('join_couple', { invite_code: invite }));
  await ok(C.db.rpc('create_couple', { name: 'Cam', color: '#2563eb' }));
  coupleC = (await ok(C.db.from('member').select('couple_id').single())).couple_id;
  const [book, solo] = await ok(
    admin
      .from('book')
      .insert([
        { couple_id: coupleAB, title: 'Together', added_by: A.id, spine_lengths: [1000, 2000, 3000] },
        { couple_id: coupleAB, title: 'Solo', added_by: A.id, spine_lengths: [3000] },
      ])
      .select('id, title')
      .order('title', { ascending: false }),
  );
  bookId = book.id;
  await setPos(A, bookId, 1.5);
  await setPos(B, bookId, 0.5);
  await setPos(A, solo.id, 1);

  const mark = (u: User, pos: number, kind: 'highlight' | 'reaction' | 'note', emoji?: 'love' | 'funny') =>
    write(u.db.from('mark').insert({ book_id: bookId, author_id: u.id, kind, pos, emoji, body: kind === 'note' ? 'hm' : undefined }));
  await mark(A, 0.2, 'highlight');
  await mark(A, 1.2, 'highlight');
  await mark(B, 0.3, 'highlight');
  await mark(A, 0.1, 'reaction', 'love');
  await mark(B, 0.1, 'reaction', 'love');
  await mark(B, 0.4, 'reaction', 'funny');
  await mark(A, 1.4, 'reaction', 'funny');
  await mark(A, 0.25, 'note');

  const prompt = { book_id: bookId, spine: 0, kind: 'question' as const, prompt_key: 'q1' };
  await write(A.db.from('answer').insert({ ...prompt, user_id: A.id, value: 'yes' }));
  await write(B.db.from('answer').insert({ ...prompt, user_id: B.id, value: 'no' }));
});

describe('display_page (SQL mirror of displayPage)', () => {
  // Same rows as src/features/together/pages.test.ts.
  it.each([
    [0, [1000, 2000], 1],
    [0.5, [1000, 2000], 1],
    [1.25, [1000, 2000], 2],
    [1.5, [1000, 2000], 2],
    [2, [1000, 2000], 3],
    [0.9999, [3000], 3],
  ])('pos %d in %j is page %d', async (pos, spine_lengths, page) => {
    expect(await ok(admin.rpc('display_page', { pos, spine_lengths }))).toBe(page);
  });
});

describe('couple_stats', () => {
  it('returns literal totals for the caller, counting only marks the caller has reached', async () => {
    // pages: A 2 (pos 1.5 = char 2000) + B 1 (char 500) on Together, A 3 (char 3000) on Solo.
    expect(await stats(A, coupleAB)).toEqual([
      { books_together: 1, pages: 6, highlights: 3, discussions: 1, reactions: { love: 2, funny: 2 } },
    ]);
    // A's highlight at 1.2 and funny reaction at 1.4 are ahead of B (0.5).
    expect(await stats(B, coupleAB)).toEqual([
      { books_together: 1, pages: 6, highlights: 2, discussions: 1, reactions: { love: 2, funny: 1 } },
    ]);
  });

  it("counts a partner's mark once the caller reaches it", async () => {
    await setPos(B, bookId, 1.5);
    expect(await stats(B, coupleAB)).toEqual([
      { books_together: 1, pages: 7, highlights: 3, discussions: 1, reactions: { love: 2, funny: 2 } },
    ]);
  });

  it('another couple sees no row for us, only its own zeros', async () => {
    expect(await stats(C, coupleAB)).toEqual([]);
    expect(await stats(A, coupleAB)).toHaveLength(1);
    expect(await stats(C, coupleC)).toEqual([
      { books_together: 0, pages: 0, highlights: 0, discussions: 0, reactions: {} },
    ]);
  });
});
