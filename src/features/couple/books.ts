import 'server-only';
import { spineLengthsFromEpub } from '@/features/reader/locator';
import { createAdminClient, createUserClient } from '@/lib/supabase-server';
import type { Member } from './couple';
import { MAX_EPUB_BYTES, epubMeta } from './epub-meta';

export type Book = { id: string; title: string; author: string | null; addedBy: string; createdAt: string };
export type UploadResult = { error: string } | { ok: string } | undefined;

export async function listBooks(coupleId: string, members: Member[]): Promise<Book[]> {
  const db = await createUserClient();
  const { data, error } = await db
    .from('book')
    .select('id, title, author, added_by, created_at')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const names = new Map(members.map((m) => [m.userId, m.name]));
  return data.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    addedBy: names.get(b.added_by) ?? 'Former reader',
    createdAt: b.created_at,
  }));
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function uploadBook(file: File): Promise<UploadResult> {
  const db = await createUserClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: 'Sign in first.' };
  const { data: me } = await db.from('member').select('couple_id').eq('user_id', auth.user.id).maybeSingle();
  if (!me) return { error: 'Create or join a couple first.' };
  if (file.size === 0) return { error: 'Choose an EPUB file.' };
  if (file.size > MAX_EPUB_BYTES) return { error: 'That file is over 50 MB.' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  let meta: Awaited<ReturnType<typeof epubMeta>>;
  try {
    meta = await epubMeta(bytes);
  } catch {
    return { error: "That file isn't an EPUB." };
  }
  let spineLengths: number[];
  try {
    spineLengths = await spineLengthsFromEpub(bytes);
  } catch (e) {
    return { error: `This EPUB can't be read: ${(e as Error).message}` };
  }
  const hash = await sha256(bytes);
  const title = meta.title ?? file.name.replace(/\.epub$/i, '');

  const existing = await findBySha(me.couple_id, hash);
  if (existing) return { ok: `"${existing}" is already in your library.` };

  const id = crypto.randomUUID();
  const path = `${me.couple_id}/${id}.epub`;
  const up = await db.storage.from('books').upload(path, bytes, { contentType: 'application/epub+zip' });
  if (up.error) return { error: 'Could not store the file. Try again.' };

  const admin = createAdminClient();
  const { error } = await admin.from('book').insert({
    id,
    couple_id: me.couple_id,
    title,
    author: meta.author,
    sha256: hash,
    storage_path: path,
    spine_lengths: spineLengths,
    added_by: auth.user.id,
  });
  if (error) {
    await admin.storage.from('books').remove([path]);
    const raced = error.code === '23505' ? await findBySha(me.couple_id, hash) : null;
    return raced ? { ok: `"${raced}" is already in your library.` } : { error: 'Could not add the book. Try again.' };
  }
  return { ok: `Added "${title}".` };
}

async function findBySha(coupleId: string, hash: string): Promise<string | null> {
  const db = await createUserClient();
  const { data } = await db.from('book').select('title').eq('couple_id', coupleId).eq('sha256', hash).maybeSingle();
  return data?.title ?? null;
}
