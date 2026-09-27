import { execSync } from 'node:child_process';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/lib/types';

type Client = SupabaseClient<Database>;
type User = { id: string; db: Client; email: string };
type Joined = { channel: RealtimeChannel; status: string; got: unknown[] };

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function user(label: string): Promise<User> {
  const email = `rt-${label}-${run}@test.local`;
  const password = 'password-123';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  return { id: created.data.user.id, db: await signIn(email), email };
}

// A fresh signed-in client per channel, as each browser tab is: one client dedupes channels by topic.
// Like joinChannel, hand Realtime the session before joining.
async function signIn(email: string): Promise<Client> {
  const db = createClient<Database>(env.API_URL, env.ANON_KEY, opts);
  const signed = await db.auth.signInWithPassword({ email, password: 'password-123' });
  if (signed.error) throw signed.error;
  await db.realtime.setAuth(signed.data.session.access_token);
  return db;
}

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  if (data == null) throw new Error('no data');
  return data;
}

// Resolves with the first terminal status; Realtime answers a refused private join with CHANNEL_ERROR after ~5 s.
async function join(u: User, topic: string, isPrivate: boolean): Promise<Joined> {
  const got: unknown[] = [];
  const channel = (await signIn(u.email))
    .channel(topic, { config: { private: isPrivate } })
    .on('broadcast', { event: 'signal' }, ({ payload }) => void got.push(payload))
    .on('presence', { event: 'sync' }, () => {});
  return new Promise((resolve) => {
    const done = (status: string) => resolve({ channel, status, got });
    const timer = setTimeout(() => done('NO_REPLY'), 20000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        done(status);
      }
    });
  });
}

async function until(check: () => boolean, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (check()) return;
}

const present = (j: Joined) => Object.values(j.channel.presenceState<{ userId: string }>()).flatMap((ps) => ps.map((p) => p.userId));

let A: User, B: User, C: User;
let topic: string;
const joined: Joined[] = [];
const track = async (p: Promise<Joined>) => {
  const j = await p;
  joined.push(j);
  return j;
};

beforeAll(async () => {
  [A, B, C] = await Promise.all(['a', 'b', 'c'].map(user));
  const invite = await ok(A.db.rpc('create_couple', { name: 'Alex', color: '#e11d48' }));
  const coupleId = await ok(B.db.rpc('join_couple', { invite_code: invite }));
  await ok(C.db.rpc('create_couple', { name: 'Cam', color: '#2563eb' }));
  const book = await ok(
    admin.from('book').insert({ couple_id: coupleId, title: 'Alice', added_by: A.id, spine_lengths: [1000] }).select().single(),
  );
  topic = `sync:${book.id}`;
});

afterEach(async () => {
  await Promise.all(joined.splice(0).map((j) => j.channel.unsubscribe()));
});

describe('private sync:{bookId} channel', () => {
  it('lets the partner join and hear broadcasts; another couple’s user is refused and hears nothing', async () => {
    const [a, b, c, cPublic] = await Promise.all([join(A, topic, true), join(B, topic, true), join(C, topic, true), join(C, topic, false)].map(track));
    expect([a.status, b.status, c.status]).toEqual(['SUBSCRIBED', 'SUBSCRIBED', 'CHANNEL_ERROR']);
    expect(cPublic.status).toBe('SUBSCRIBED');

    await a.channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'invite', by: A.id } });
    await until(() => b.got.length > 0);
    await sleep(500);
    expect(b.got).toEqual([{ type: 'invite', by: A.id }]);
    expect(c.got).toEqual([]);
    expect(cPublic.got).toEqual([]);
  });

  it('drops C’s sends to the private topic while B’s arrive', async () => {
    const [a, b, cPublic] = await Promise.all([join(A, topic, true), join(B, topic, true), join(C, topic, false)].map(track));
    const cHttp = (await signIn(C.email)).channel(topic, { config: { private: true } });
    const bHttp = (await signIn(B.email)).channel(topic, { config: { private: true } });
    expect([a.status, b.status]).toEqual(['SUBSCRIBED', 'SUBSCRIBED']);

    await cPublic.channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'leave', by: C.id, via: 'ws' } });
    await expect(cHttp.httpSend('signal', { type: 'leave', by: C.id, via: 'http' })).rejects.toThrow('Unauthorized');
    expect(await b.channel.send({ type: 'broadcast', event: 'signal', payload: { type: 'accept', by: B.id, via: 'ws' } })).toBe('ok');
    expect(await bHttp.httpSend('signal', { type: 'accept', by: B.id, via: 'http' })).toEqual({ success: true });

    await until(() => a.got.length >= 2);
    await sleep(500);
    expect(a.got).toEqual([
      { type: 'accept', by: B.id, via: 'ws' },
      { type: 'accept', by: B.id, via: 'http' },
    ]);
  });

  it('shows A’s presence to B, not to C', async () => {
    const [a, b, c, cPublic] = await Promise.all([join(A, topic, true), join(B, topic, true), join(C, topic, true), join(C, topic, false)].map(track));
    expect([a.status, b.status, c.status, cPublic.status]).toEqual(['SUBSCRIBED', 'SUBSCRIBED', 'CHANNEL_ERROR', 'SUBSCRIBED']);

    await a.channel.track({ userId: A.id });
    await until(() => present(b).includes(A.id));
    await sleep(500);
    expect(present(b)).toContain(A.id);
    expect(present(c)).toEqual([]);
    expect(present(cPublic)).toEqual([]);
  });

  it('refuses a malformed or unknown-prefix topic even for a member', async () => {
    const [good, bad, other] = await Promise.all(
      [join(A, topic, true), join(A, `${topic}'`, true), join(A, topic.replace('sync:', 'nope:'), true)].map(track),
    );
    expect([good.status, bad.status, other.status]).toEqual(['SUBSCRIBED', 'CHANNEL_ERROR', 'CHANNEL_ERROR']);
  });
});
