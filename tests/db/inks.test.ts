import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';
import type { Database } from '@/lib/types';

type Client = SupabaseClient<Database>;

const env: Record<string, string> = JSON.parse(
  execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const run = Date.now().toString(36);
let n = 0;

async function user(label: string): Promise<{ id: string; db: Client }> {
  const email = `ink-${label}-${run}@test.local`;
  const password = 'password-123';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const db = createClient<Database>(env.API_URL, env.ANON_KEY, opts);
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return { id: created.data.user.id, db };
}

async function coupleWith(color: string) {
  const A = await user(`a${n++}`);
  const { data: invite, error } = await A.db.rpc('create_couple', { name: 'Alex', color });
  if (error) throw error;
  return invite!;
}

async function colorOf(id: string) {
  const { data } = await admin.from('member').select('color').eq('user_id', id).single();
  return data!.color;
}

it("B can't join with A's ink; a different ink works", async () => {
  const invite = await coupleWith('#d6336c');

  const B = await user('b1');
  const refused = await B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#d6336c' });
  expect(refused.error?.message).toBe('ink taken');

  const joined = await B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#3b5bdb' });
  expect(joined.error).toBeNull();
  expect(await colorOf(B.id)).toBe('#3b5bdb');
});

it('joining without a colour picks the first ink A does not have', async () => {
  const invite = await coupleWith('#d6336c');
  const B = await user('b2');
  const { error } = await B.db.rpc('join_couple', { invite_code: invite, name: 'Sam' });
  expect(error).toBeNull();
  expect(await colorOf(B.id)).toBe('#3b5bdb');
});

it('old palette colours snap to the nearest ink', async () => {
  const invite = await coupleWith('#e11d48');
  const B = await user('b3');
  await B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#ca8a04' });
  expect(await colorOf(B.id)).toBe('#e8890c');
});

it("a member can't switch to the partner's ink, no ink or a non-ink, but can switch to a free ink", async () => {
  const invite = await coupleWith('#0ca678');
  const B = await user('b4');
  await B.db.rpc('join_couple', { invite_code: invite, name: 'Sam', color: '#7048e8' });

  const clash = await B.db.from('member').update({ color: '#0ca678' }).eq('user_id', B.id);
  expect(clash.error?.code).toBe('23505');
  const none = await B.db.from('member').update({ color: null }).eq('user_id', B.id);
  expect(none.error?.code).toBe('23514');
  const offPalette = await B.db.from('member').update({ color: '#000000' }).eq('user_id', B.id);
  expect(offPalette.error?.code).toBe('23514');
  const free = await B.db.from('member').update({ color: '#1098ad' }).eq('user_id', B.id);
  expect(free.error).toBeNull();
  expect(await colorOf(B.id)).toBe('#1098ad');
});
