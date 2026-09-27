import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { guessKey, parseGuess, revealGuess } from '../../src/features/together/discussion';
import { questionsFor } from '../../src/features/together/questions';
import type { Database } from '@/lib/types';

type Client = SupabaseClient<Database>;
type User = { id: string; db: Client };

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);

async function user(label: string): Promise<User> {
  const email = `discuss-${label}-${run}@test.local`;
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

let A: User, B: User, C: User;
let bookId: string;
const spine = 2;
const [q1, q2] = questionsFor(spine).map((q) => q.key);

const answer = (u: User, kind: 'question' | 'guess', prompt_key: string, value: string) =>
  ok(u.db.from('answer').insert({ book_id: bookId, spine, kind, prompt_key, value }).select().single());

const visible = async (u: User, prompt_key: string) =>
  (await ok(u.db.from('answer').select('user_id, value').eq('book_id', bookId).eq('spine', spine).eq('prompt_key', prompt_key))).sort(
    (a, b) => a.value.localeCompare(b.value),
  );

const revealEvents = async (u: User, prompt_key: string) =>
  ok(u.db.from('event').select('data').eq('book_id', bookId).eq('type', 'answer_revealed').eq('data->>prompt_key', prompt_key));

beforeAll(async () => {
  [A, B, C] = await Promise.all(['a', 'b', 'c'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  const coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite }));
  await ok(C.db.rpc('create_couple', { name: 'Cam', color: '#2563eb' }));
  const book = await ok(
    admin.from('book').insert({ couple_id: coupleId, title: 'Alice', added_by: A.id, spine_lengths: [1000, 1000, 1000] }).select().single(),
  );
  bookId = book.id;
});

describe('discussion reveal gate', () => {
  it('hides A’s answer from B until B answers the same question, then shows both to both', async () => {
    await answer(A, 'question', q1, 'A: she should have stayed');
    expect(await visible(A, q1)).toEqual([{ user_id: A.id, value: 'A: she should have stayed' }]);
    expect(await visible(B, q1)).toEqual([]);
    expect(await revealEvents(A, q1)).toEqual([]);

    await answer(B, 'question', q1, 'B: running was right');
    const both = [
      { user_id: A.id, value: 'A: she should have stayed' },
      { user_id: B.id, value: 'B: running was right' },
    ];
    expect(await visible(B, q1)).toEqual(both);
    expect(await visible(A, q1)).toEqual(both);
  });

  it('answering a different question does not reveal this one', async () => {
    await answer(A, 'question', q2, 'A on q2');
    await answer(B, 'question', 'unrelated', 'B elsewhere');
    expect(await visible(B, q2)).toEqual([]);
    expect(await visible(A, q2)).toEqual([{ user_id: A.id, value: 'A on q2' }]);
  });

  it('writes exactly one answer_revealed event per prompt once both answered, visible to both', async () => {
    const expected = [{ data: { spine, prompt_key: q1, kind: 'question' } }];
    expect(await revealEvents(A, q1)).toEqual(expected);
    expect(await revealEvents(B, q1)).toEqual(expected);
    expect(await revealEvents(A, q2)).toEqual([]);
  });

  it('another couple sees no answers or reveal events', async () => {
    expect(await ok(C.db.from('answer').select('id').eq('book_id', bookId))).toEqual([]);
    expect(await ok(C.db.from('event').select('id').eq('book_id', bookId))).toEqual([]);
    expect((await ok(A.db.from('answer').select('id').eq('book_id', bookId))).length).toBe(3);
  });
});

describe('guess their reaction', () => {
  it('round-trips both guesses through the reveal gate', async () => {
    const key = guessKey(spine);
    const a = { mine: 'emotional', guessPartner: 'emotional' } as const;
    const b = { mine: 'emotional', guessPartner: 'funny' } as const;
    await answer(A, 'guess', key, JSON.stringify(a));
    expect(await visible(B, key)).toEqual([]);

    await answer(B, 'guess', key, JSON.stringify(b));
    const rows = await ok(A.db.from('answer').select('user_id, value').eq('book_id', bookId).eq('prompt_key', key));
    const mine = parseGuess(rows.find((r) => r.user_id === A.id)!.value)!;
    const theirs = parseGuess(rows.find((r) => r.user_id === B.id)!.value)!;
    expect(mine).toEqual(a);
    expect(theirs).toEqual(b);
    expect(revealGuess(mine, theirs)).toEqual({ same: true, iGuessedRight: true, theyGuessedRight: false });
    expect(await revealEvents(B, key)).toEqual([{ data: { spine, prompt_key: key, kind: 'guess' } }]);
  });
});

describe('simultaneous answers', () => {
  it('still writes exactly one answer_revealed when both partners answer at the same moment', async () => {
    const keys = Array.from({ length: 10 }, (_, i) => `race-${i}`);
    for (const key of keys) {
      await Promise.all([answer(A, 'question', key, 'A'), answer(B, 'question', key, 'B')]);
    }
    const counts = await Promise.all(keys.map(async (key) => (await revealEvents(A, key)).length));
    expect(counts).toEqual(keys.map(() => 1));
  });
});
