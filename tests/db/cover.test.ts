import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, expect, it } from 'vitest';
import type { Database } from '@/lib/types';
import { addBook } from '../../src/features/couple/add-book';

type Client = SupabaseClient<Database>;
type User = { id: string; db: Client };

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);
const ALICE = readFileSync('fixtures/alice.epub');
// A refused upload leaves its body undrained in local Storage and can hang the next request (docs/research/storage-refused-upload-repro.mjs).
const tiny = () => new Blob(['x'], { type: 'image/jpeg' });

async function user(label: string): Promise<User> {
  const email = `cover-${label}-${run}@test.local`;
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

let A: User;
let B: User;
let C: User;
let coupleId: string;
let otherCoupleId: string;

beforeAll(async () => {
  [A, B, C] = await Promise.all(['a', 'b', 'c'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#d6336c' }));
  coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#3b5bdb' }));
  await ok(C.db.rpc('create_couple', { name: 'Casey', color: '#0ca678' }));
  otherCoupleId = await ok(C.db.rpc('my_couple_id'));
});

it('uploading alice.epub stores its cover for the couple only', async () => {
  expect(await addBook(A.db, admin, new File([ALICE], 'alice.epub'))).toEqual({ ok: `Added "Alice's Adventures in Wonderland".` });
  const book = await ok(A.db.from('book').select('id, cover_path').eq('couple_id', coupleId).single());
  expect(book.cover_path).toBe(`${coupleId}/${book.id}.jpg`);
  const covers = (u: User) => u.db.storage.from('covers');

  expect((await ok(covers(B).download(book.cover_path!))).size).toBe(104775);
  expect(await ok(covers(B).createSignedUrl(book.cover_path!, 60))).toHaveProperty('signedUrl');

  expect((await covers(C).download(book.cover_path!)).error).not.toBeNull();
  expect((await covers(C).createSignedUrl(book.cover_path!, 60)).error).not.toBeNull();
  expect(await ok(covers(C).list(coupleId))).toEqual([]);

  await ok(covers(C).upload(`${otherCoupleId}/${crypto.randomUUID()}.jpg`, tiny()));
  expect((await covers(C).upload(`${coupleId}/${crypto.randomUUID()}.jpg`, tiny())).error).not.toBeNull();
});
