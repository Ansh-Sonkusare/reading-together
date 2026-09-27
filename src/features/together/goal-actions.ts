'use server';

import { revalidatePath } from 'next/cache';
import { createUserClient } from '@/lib/supabase-server';
import type { GoalKind } from './streak';

export type GoalResult = { error: string } | { ok: true } | undefined;

const KINDS: readonly string[] = ['pages_per_day', 'chapters_per_day'] satisfies GoalKind[];

export async function setGoalAction(_: GoalResult, form: FormData): Promise<GoalResult> {
  const kind = String(form.get('kind'));
  const target = Number(form.get('target'));
  if (!KINDS.includes(kind)) return { error: 'Pick pages or chapters.' };
  if (!Number.isInteger(target) || target < 1 || target > 1000) return { error: 'Enter a whole number from 1 to 1000.' };
  const db = await createUserClient();
  const { error } = await db.rpc('set_goal', { kind: kind as GoalKind, target });
  if (error) return { error: 'Could not save the goal.' };
  revalidatePath('/together');
  return { ok: true };
}

export async function syncTimezone(timezone: string): Promise<void> {
  const db = await createUserClient();
  const { data } = await db.auth.getUser();
  if (!data.user) return;
  // member.timezone's check rejects names Postgres doesn't know; days then stay UTC.
  await db.from('member').update({ timezone }).eq('user_id', data.user.id);
  revalidatePath('/together');
}
