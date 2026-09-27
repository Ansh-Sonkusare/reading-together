import 'server-only';
import type { Couple } from '@/features/couple/couple';
import { createUserClient } from '@/lib/supabase-server';
import { goalProgressText, streak, streakText, type Goal } from './streak';

export type StreakRowData = { streak: string; goal: Goal | null; goalProgress: string | null; timezone: string };

export async function getStreakRow(couple: Couple, me: string): Promise<StreakRowData> {
  const db = await createUserClient();
  const ids = couple.members.map((m) => m.userId);
  const [today, days, goal, member] = await Promise.all([
    db.from('reading_today').select('user_id, day, pages, chapters').eq('couple_id', couple.id),
    db.from('reading_day').select('user_id, day').in('user_id', ids),
    db.from('goal').select('kind, target').eq('couple_id', couple.id).maybeSingle(),
    db.from('member').select('timezone').eq('user_id', me).single(),
  ]);
  if (today.error) throw today.error;
  if (days.error) throw days.error;
  if (goal.error) throw goal.error;
  if (member.error) throw member.error;

  const partner = couple.members.find((m) => m.userId !== me);
  const daysOf = (id: string) => days.data.filter((d) => d.user_id === id).map((d) => d.day);
  const todayOf = (id: string) => today.data.find((t) => t.user_id === id);
  const myDay = todayOf(me)?.day;
  const n = partner && myDay ? streak(daysOf(me), daysOf(partner.userId), myDay) : 0;

  const g = goal.data;
  const done = (id: string) => (g?.kind === 'chapters_per_day' ? todayOf(id)?.chapters : todayOf(id)?.pages) ?? 0;
  const readers = [{ name: 'You', done: done(me) }, ...(partner ? [{ name: partner.name, done: done(partner.userId) }] : [])];

  return {
    streak: streakText(n),
    goal: g,
    goalProgress: g ? goalProgressText(g, readers) : null,
    timezone: member.data.timezone,
  };
}
