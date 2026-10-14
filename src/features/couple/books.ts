import 'server-only';
import { createAdminClient, createUserClient } from '@/lib/supabase-server';
import { addBook, type UploadResult } from './add-book';
import type { RibbonMark } from '@/components/ui/duet-ribbon-layout';
import { displayPage } from '@/features/reader/locator';
import type { Member } from './couple';

export type { UploadResult };
export type Place = { userId: string; pos: number; updatedAt: string };
export type Book = {
  id: string;
  title: string;
  author: string | null;
  /** Short-lived signed URL, null when the EPUB had no usable cover. */
  coverUrl: string | null;
  spineLengths: number[];
  places: Place[];
};

const COVER_URL_SECONDS = 600;

export async function listBooks(coupleId: string): Promise<Book[]> {
  const db = await createUserClient();
  const [{ data, error }, { data: progress, error: pErr }] = await Promise.all([
    db
      .from('book')
      .select('id, title, author, cover_path, spine_lengths')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false }),
    db.from('progress').select('user_id, book_id, pos, updated_at'),
  ]);
  if (error) throw error;
  if (pErr) throw pErr;
  const paths = data.flatMap((b) => b.cover_path ?? []);
  const { data: signed } = paths.length ? await db.storage.from('covers').createSignedUrls(paths, COVER_URL_SECONDS) : { data: [] };
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return data.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    coverUrl: (b.cover_path && urls.get(b.cover_path)) || null,
    spineLengths: b.spine_lengths,
    places: progress
      .filter((p) => p.book_id === b.id)
      .map((p) => ({ userId: p.user_id, pos: Number(p.pos), updatedAt: p.updated_at })),
  }));
}

export async function uploadBook(path: string, fileName: string): Promise<UploadResult> {
  return addBook(await createUserClient(), createAdminClient(), path, fileName);
}

/** The book's duet ribbon: both partners' places, me last so my label reads second. */
export function ribbonOf(book: Book, members: Member[], meId: string): { total: number; marks: RibbonMark[] } {
  const marks = members.flatMap((m) => {
    const place = book.places.find((p) => p.userId === m.userId);
    if (!place) return [];
    return [{ name: m.name, color: m.color, pos: place.pos, page: displayPage(place.pos, book.spineLengths), isMe: m.userId === meId }];
  });
  return { total: book.spineLengths.length, marks: marks.sort((a, b) => Number(a.isMe) - Number(b.isMe)) };
}

/** The book I opened most recently, if any. */
export function lastRead(books: Book[], meId: string): Book | null {
  const at = (b: Book) => b.places.find((p) => p.userId === meId)?.updatedAt ?? '';
  return books.filter(at).sort((a, b) => at(b).localeCompare(at(a)))[0] ?? null;
}
