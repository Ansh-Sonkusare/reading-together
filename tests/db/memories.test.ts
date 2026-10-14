import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, expect, it } from 'vitest';
import type { Pos } from '@/features/reader';
import type { Database } from '@/lib/types';
import { addMemory } from '../../src/features/marks/data';

type Client = SupabaseClient<Database>;
type User = { id: string; db: Client };

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);
const JPEG = readFileSync('fixtures/memory.jpg');
const photo = () => new Blob([JPEG], { type: 'image/jpeg' });
// A refused upload leaves its body undrained in local Storage and can hang the next request (docs/research/storage-refused-upload-repro.mjs).
const tiny = (type = 'image/jpeg') => new Blob(['x'], { type });

async function user(label: string): Promise<User> {
  const email = `memories-${label}-${run}@test.local`;
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

const setPos = async (u: User, bookId: string, pos: number) => {
  const { error } = await u.db.from('progress').upsert({ user_id: u.id, book_id: bookId, pos, max_pos: pos });
  if (error) throw error;
};

const locator = { spine: 0, offset: 120, cfi: 'epubcfi(/6/2!/4/2,/1:120,/1:131)', quote: { exact: 'rabbit-hole', prefix: 'down the ', suffix: ' went' } };
const bucket = (u: User) => u.db.storage.from('memories');

let A: User;
let B: User;
let C: User;
let coupleId: string;
let otherCoupleId: string;
let bookId: string;

beforeAll(async () => {
  [A, B, C] = await Promise.all(['a', 'b', 'c'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#2563eb' }));
  await ok(C.db.rpc('create_couple', { name: 'Casey', color: '#16a34a' }));
  otherCoupleId = await ok(C.db.rpc('my_couple_id'));
  ({ id: bookId } = await ok(admin.from('book').insert({ couple_id: coupleId, title: 'Alice', added_by: A.id, spine_lengths: [1000, 1000] }).select('id').single()));
  await Promise.all([setPos(A, bookId, 0.5), setPos(B, bookId, 0.1)]);
});

it('only the couple can read a memory photo; another couple can neither read nor write into its folder', async () => {
  const path = `${coupleId}/${crypto.randomUUID()}.jpg`;
  await ok(bucket(A).upload(path, photo(), { contentType: 'image/jpeg' }));
  expect((await ok(bucket(B).download(path))).size).toBe(JPEG.length);

  expect((await bucket(C).download(path)).error).not.toBeNull();
  expect((await bucket(C).createSignedUrl(path, 60)).error).not.toBeNull();
  expect(await ok(bucket(C).list(coupleId))).toEqual([]);

  await ok(bucket(C).upload(`${otherCoupleId}/${crypto.randomUUID()}.jpg`, tiny()));
  expect((await bucket(C).upload(`${coupleId}/${crypto.randomUUID()}.jpg`, tiny())).error).not.toBeNull();
});

it('the bucket takes JPEG, PNG and WebP only; not HEIC, which only Safari displays', async () => {
  await ok(bucket(A).upload(`${coupleId}/${crypto.randomUUID()}.png`, tiny('image/png')));
  await ok(bucket(A).upload(`${coupleId}/${crypto.randomUUID()}.webp`, tiny('image/webp')));
  expect((await bucket(A).upload(`${coupleId}/${crypto.randomUUID()}.txt`, tiny('text/plain'))).error).not.toBeNull();
  expect((await bucket(A).upload(`${coupleId}/${crypto.randomUUID()}.heic`, tiny('image/heic'))).error).not.toBeNull();
  expect((await bucket(A).upload(`${coupleId}/${crypto.randomUUID()}.heif`, tiny('image/heif'))).error).not.toBeNull();
});

it('only the uploader can delete a photo', async () => {
  const path = `${coupleId}/${crypto.randomUUID()}.jpg`;
  await ok(bucket(A).upload(path, tiny()));
  expect(await ok(bucket(B).remove([path]))).toEqual([]);
  expect((await ok(bucket(A).remove([path]))).map((o) => o.name)).toEqual([path]);
});

it('a memory round-trips: caption, photo path and the photo itself', async () => {
  const memory = await addMemory(A.db, { bookId, locator, pos: 0.05 as Pos, photo: photo(), caption: 'Dinner at our favorite restaurant ❤️' });
  expect(memory.media_url).toBe(`${coupleId}/${memory.id}.jpg`);

  const seen = await ok(B.db.from('mark').select('author_id, kind, pos, locator, body, media_url').eq('id', memory.id).single());
  expect(seen).toEqual({ author_id: A.id, kind: 'memory', pos: 0.05, locator, body: 'Dinner at our favorite restaurant ❤️', media_url: `${coupleId}/${memory.id}.jpg` });
  expect((await ok(bucket(B).download(seen.media_url!))).size).toBe(JPEG.length);
});

it('a memory must point at its own photo path', async () => {
  const id = crypto.randomUUID();
  const row = { id, kind: 'memory' as const, book_id: bookId, locator, pos: 0.05, body: 'x' };
  expect((await A.db.from('mark').insert({ ...row, media_url: `${otherCoupleId}/${id}.jpg` })).error).toMatchObject({ code: '42501' });
  expect((await A.db.from('mark').insert({ ...row, media_url: `${coupleId}/${crypto.randomUUID()}.jpg` })).error).toMatchObject({ code: '42501' });
  expect((await A.db.from('mark').insert({ ...row, kind: 'note', media_url: `${coupleId}/${id}.jpg` })).error).toMatchObject({ code: '42501' });
  await ok(A.db.from('mark').insert({ ...row, media_url: `${coupleId}/${id}.jpg` }).select('id').single());
});

it('a refused memory leaves no photo behind', async () => {
  const count = async () => (await ok(admin.storage.from('memories').list(coupleId, { limit: 1000 }))).length;
  const before = await count();
  await expect(addMemory(A.db, { bookId, locator, pos: 0.9 as Pos, photo: photo(), caption: 'ahead of me' })).rejects.toMatchObject({ code: '42501' });
  expect(await count()).toBe(before);
  await addMemory(A.db, { bookId, locator, pos: 0.4 as Pos, photo: photo(), caption: 'reached' });
  expect(await count()).toBe(before + 1);
});

it("a memory ahead of the partner is hidden until they reach it", async () => {
  const memory = await addMemory(A.db, { bookId, locator, pos: 0.3 as Pos, photo: photo(), caption: 'Our first date' });
  const theirs = () => ok(B.db.from('mark').select('id, body').eq('id', memory.id));
  const events = () => ok(B.db.from('event').select('ref_id').eq('ref_id', memory.id));
  expect(await theirs()).toEqual([]);
  expect(await events()).toEqual([]);
  await setPos(B, bookId, 0.3);
  expect(await theirs()).toEqual([{ id: memory.id, body: 'Our first date' }]);
  expect(await events()).toEqual([{ ref_id: memory.id }]);
});
