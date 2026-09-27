import 'server-only';
import { createUserClient } from '@/lib/supabase-server';
import { REACTIONS, type Reaction } from '../marks/model';

export type CoupleStats = {
  booksTogether: number;
  pages: number;
  highlights: number;
  discussions: number;
  favoriteReactions: { key: Reaction; emoji: string; label: string; count: number }[];
};

export async function getCoupleStats(coupleId: string): Promise<CoupleStats> {
  const db = await createUserClient();
  const { data, error } = await db.from('couple_stats').select('*').eq('couple_id', coupleId).single();
  if (error) throw error;
  const counts = (data.reactions ?? {}) as Partial<Record<Reaction, number>>;
  return {
    booksTogether: data.books_together ?? 0,
    pages: data.pages ?? 0,
    highlights: data.highlights ?? 0,
    discussions: data.discussions ?? 0,
    favoriteReactions: REACTIONS.map((r) => ({ ...r, count: counts[r.key] ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count),
  };
}
