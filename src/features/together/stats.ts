import 'server-only';
import { createUserClient } from '@/lib/supabase-server';
import { REACTIONS } from '../marks/model';

export type CoupleStats = {
  booksTogether: number;
  pages: number;
  highlights: number;
  discussions: number;
  favoriteReactions: { key: string; emoji: string; label: string; count: number }[];
};

export async function getCoupleStats(coupleId: string): Promise<CoupleStats> {
  const db = await createUserClient();
  const { data, error } = await db.from('couple_stats').select('*').eq('couple_id', coupleId).single();
  if (error) throw error;
  const counts = (data.reactions ?? {}) as Record<string, number>;
  return {
    booksTogether: data.books_together ?? 0,
    pages: data.pages ?? 0,
    highlights: data.highlights ?? 0,
    discussions: data.discussions ?? 0,
    // Keyed by the emoji itself (D22); a quick pick keeps its label, any other emoji shows alone.
    favoriteReactions: Object.entries(counts)
      .map(([emoji, count]) => ({ key: emoji, emoji, label: REACTIONS.find((r) => r.emoji === emoji)?.label ?? '', count }))
      .sort((a, b) => b.count - a.count),
  };
}
