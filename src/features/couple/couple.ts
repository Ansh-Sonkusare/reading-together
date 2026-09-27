import 'server-only';
import { createAdminClient, createUserClient } from '@/lib/supabase-server';
import { COLORS, type Color } from './palette';

export type Member = { userId: string; name: string; color: string };
export type Couple = { id: string; inviteCode: string; members: Member[] };
export type Result = { error: string } | undefined;

export const FULL = 'This couple already has two readers.';
export const INVALID = "That invite link isn't valid.";

const RPC_ERRORS: Record<string, string> = {
  'couple is full': FULL,
  'invalid invite code': INVALID,
};

export async function getUserId(): Promise<string | null> {
  const db = await createUserClient();
  const { data } = await db.auth.getUser();
  return data.user?.id ?? null;
}

export async function getMyCouple(): Promise<Couple | null> {
  const db = await createUserClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return null;
  const { data: me } = await db.from('member').select('couple_id').eq('user_id', user.user.id).maybeSingle();
  if (!me) return null;
  const [{ data: couple, error }, { data: members, error: mErr }] = await Promise.all([
    db.from('couple').select('id, invite_code').eq('id', me.couple_id).single(),
    db.from('member').select('user_id, name, color').eq('couple_id', me.couple_id),
  ]);
  if (error) throw error;
  if (mErr) throw mErr;
  return {
    id: couple.id,
    inviteCode: couple.invite_code,
    members: members.map((m) => ({ userId: m.user_id, name: m.name ?? 'Reader', color: m.color ?? COLORS[0] })),
  };
}

export function parseProfile(form: FormData): { name: string; color: Color } | { error: string } {
  const name = String(form.get('name') ?? '').trim();
  const color = String(form.get('color') ?? '');
  if (!name || name.length > 40) return { error: 'Enter a name up to 40 characters.' };
  if (!(COLORS as readonly string[]).includes(color)) return { error: 'Pick a colour.' };
  return { name, color: color as Color };
}

export async function createCouple(name: string, color: Color): Promise<Result> {
  const db = await createUserClient();
  const { error } = await db.rpc('create_couple', { name, color });
  if (error) return { error: error.code === '23505' ? "You're already in a couple." : 'Could not create your couple.' };
}

export async function joinCouple(code: string, name: string, color: Color): Promise<Result> {
  const db = await createUserClient();
  const { error } = await db.rpc('join_couple', { invite_code: code, name, color });
  if (!error) return;
  if (error.code === '23505') return { error: "You're already in a couple." };
  return { error: RPC_ERRORS[error.message] ?? 'Could not join this couple.' };
}

// Non-members can't read the couple through RLS, so peek with the admin client
// to tell a third reader up front instead of after they fill in the form.
export async function inviteStatus(code: string): Promise<'open' | 'full' | 'invalid'> {
  const admin = createAdminClient();
  const { data } = await admin.from('couple').select('member(count)').eq('invite_code', code).maybeSingle();
  if (!data) return 'invalid';
  return (data.member[0]?.count ?? 0) >= 2 ? 'full' : 'open';
}
