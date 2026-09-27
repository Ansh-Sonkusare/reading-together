import { execSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dispatch, type PushTarget } from '../../src/features/notify/dispatch';
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
  const email = `push-${label}-${run}@test.local`;
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

const sub = (tag: string) => ({ endpoint: `https://push.example.test/${run}/${tag}`, keys: { p256dh: `p256dh-${tag}`, auth: `auth-${tag}` } });
const locator = (cfi: string, exact: string) => ({ spine: 0, offset: 5, cfi, quote: { exact, prefix: '', suffix: '' } });

let A: User, B: User;
let bookId: string;

// What pg_net posted from the event_push trigger, captured by a listener the DB container reaches.
const received: { eventId: string; secret: string | undefined }[] = [];
let server: Server;
let previousUrl: string;

async function markEvent(u: User, fields: Partial<Database['public']['Tables']['mark']['Insert']> & { kind: Database['public']['Enums']['mark_kind']; pos: number }) {
  const mark = await ok(u.db.from('mark').insert({ book_id: bookId, ...fields }).select('id').single());
  const event = await ok(admin.from('event').select('id').eq('ref_id', mark.id).single());
  return event.id;
}

async function arrived(eventId: string) {
  for (let i = 0; i < 50 && !received.some((r) => r.eventId === eventId); i++) await new Promise((r) => setTimeout(r, 100));
  return received.some((r) => r.eventId === eventId);
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ eventId: JSON.parse(body).event_id, secret: req.headers['x-push-secret'] as string | undefined });
      res.end('{}');
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  previousUrl = await ok(admin.rpc('set_push_dispatch_url', { url: `http://host.docker.internal:${port}/api/push/dispatch` }));

  [A, B] = await Promise.all(['a', 'b'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  const coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite, name: 'Bea' }));
  const book = await ok(
    admin.from('book').insert({ couple_id: coupleId, title: 'Alice', added_by: A.id, spine_lengths: [1000, 1000, 1000] }).select().single(),
  );
  bookId = book.id;
  await ok(A.db.from('progress').insert({ book_id: bookId, pos: 2.5, max_pos: 2.5 }).select());
  await ok(B.db.from('progress').insert({ book_id: bookId, pos: 0.5, max_pos: 0.5 }).select());
});

afterAll(async () => {
  if (previousUrl) await admin.rpc('set_push_dispatch_url', { url: previousUrl });
  server?.close();
});

describe('push_sub RLS', () => {
  it('a user reads and writes only their own subscriptions', async () => {
    await ok(A.db.from('push_sub').insert(sub('a1')).select());
    expect(await ok(A.db.from('push_sub').select('endpoint, keys'))).toEqual([sub('a1')]);
    expect(await ok(B.db.from('push_sub').select('endpoint'))).toEqual([]);

    const forged = await B.db.from('push_sub').insert({ user_id: A.id, ...sub('forged') });
    expect(forged.error?.code).toBe('42501');
    await B.db.from('push_sub').delete().eq('endpoint', sub('a1').endpoint);
    expect(await ok(A.db.from('push_sub').select('endpoint'))).toEqual([{ endpoint: sub('a1').endpoint }]);

    await ok(A.db.from('push_sub').delete().eq('endpoint', sub('a1').endpoint).select());
    expect(await ok(A.db.from('push_sub').select('endpoint'))).toEqual([]);
  });

  it('the dispatch secret and URL are not callable by users, only the service role', async () => {
    expect((await A.db.rpc('push_dispatch_secret')).error?.code).toBe('42501');
    expect((await A.db.rpc('set_push_dispatch_url', { url: 'http://evil.test' })).error?.code).toBe('42501');
    expect(await ok(admin.rpc('push_dispatch_secret'))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('event_push trigger', () => {
  it('posts a partner’s event with the secret, never a mark ahead of the recipient, and sends it once reached', async () => {
    await ok(B.db.from('push_sub').insert(sub('b1')).select());
    const secret = await ok(admin.rpc('push_dispatch_secret'));

    const ahead = await markEvent(A, { kind: 'note', pos: 1.5, body: 'The Queen of Hearts!' });
    const reached = await markEvent(A, { kind: 'note', pos: 0.4, body: 'This reminds me of our trip' });
    expect(await arrived(reached)).toBe(true);
    expect(received.find((r) => r.eventId === reached)?.secret).toBe(secret);
    await new Promise((r) => setTimeout(r, 500));
    expect(received.map((r) => r.eventId)).not.toContain(ahead);

    await ok(B.db.from('progress').update({ pos: 1.6, max_pos: 1.6 }).eq('book_id', bookId).select());
    const afterReach = await markEvent(A, { kind: 'note', pos: 1.5, body: 'Now you can see it' });
    expect(await arrived(afterReach)).toBe(true);
    expect(received.map((r) => r.eventId)).not.toContain(ahead);
  });

  it('does not post events for a recipient without a subscription (A has none)', async () => {
    const own = await markEvent(B, { kind: 'note', pos: 0.2, body: 'For Alex' });
    const control = await markEvent(A, { kind: 'note', pos: 0.2, body: 'For Bea' });
    expect(await arrived(control)).toBe(true);
    expect(received.map((r) => r.eventId)).not.toContain(own);
  });
});

describe('dispatch', () => {
  it('words the event for the partner and sends it to each stored subscription, deleting gone ones', async () => {
    await ok(B.db.from('push_sub').insert(sub('b2')).select());
    const cfi = `epubcfi(/6/2!/4/2,/1:5,/1:30)-${run}`;
    await markEvent(B, { kind: 'highlight', pos: 0.3, locator: locator(cfi, 'Curiouser and curiouser!') });
    const reaction = await markEvent(A, { kind: 'reaction', emoji: 'love', pos: 0.3, locator: locator(cfi, 'Curiouser and curiouser!') });

    const calls: [PushTarget, string][] = [];
    const result = await dispatch(admin, reaction, async (target, payload) => {
      calls.push([target, payload]);
      if (target.endpoint === sub('b2').endpoint) throw Object.assign(new Error('Gone'), { statusCode: 410 });
    });

    const payload = JSON.stringify({ title: '❤️ Alex reacted to your highlight', body: '“Curiouser and curiouser!”', url: `/book/${bookId}` });
    expect(calls.sort((x, y) => x[0].endpoint.localeCompare(y[0].endpoint))).toEqual([
      [sub('b1'), payload],
      [sub('b2'), payload],
    ]);
    expect(result).toEqual({ sent: 1, removed: 1 });
    expect(await ok(B.db.from('push_sub').select('endpoint'))).toEqual([{ endpoint: sub('b1').endpoint }]);
  });

  it('a reply to the partner’s note, and nothing for an event the recipient has not reached', async () => {
    const note = await ok(B.db.from('mark').insert({ book_id: bookId, kind: 'note', pos: 0.1, body: 'So funny' }).select('id').single());
    const reply = await markEvent(A, { kind: 'reply', pos: 0.1, parent_id: note.id, body: 'Same, I laughed out loud' });
    const ahead = await markEvent(A, { kind: 'note', pos: 2.2, body: 'Off with their heads' });

    const payloads: string[] = [];
    const send = async (_: PushTarget, p: string) => void payloads.push(p);
    expect(await dispatch(admin, reply, send)).toEqual({ sent: 1, removed: 0 });
    expect(await dispatch(admin, ahead, send)).toEqual({ sent: 0, removed: 0 });
    expect(payloads.map((p) => JSON.parse(p))).toEqual([
      { title: '💬 Alex replied to your note', body: 'Same, I laughed out loud', url: `/book/${bookId}` },
    ]);
  });
});
