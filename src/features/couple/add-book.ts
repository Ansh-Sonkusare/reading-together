import type { SupabaseClient } from '@supabase/supabase-js';
import { spineLengthsFromEpub, tocFromEpub, type Toc } from '../reader/locator';
import type { Database } from '../../lib/types';
import { epubCover } from './epub-cover';
import { MAX_EPUB_BYTES, epubMeta } from './epub-meta';

export type UploadResult = { error: string } | { ok: string } | undefined;
type Db = SupabaseClient<Database>;

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function findBySha(db: Db, coupleId: string, hash: string): Promise<string | null> {
  const { data } = await db.from('book').select('title').eq('couple_id', coupleId).eq('sha256', hash).maybeSingle();
  return data?.title ?? null;
}

const UPLOAD_PATH = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.epub$/;

/**
 * D13/D24: the browser puts the EPUB in Storage under `{couple}/{id}.epub` with the member's session (Vercel caps a
 * function body at 4.5 MB); the server reads it back through that session and writes the book row with the service
 * role. Any refusal removes the stored file. Free of server-only so tests/db/cover.test.ts can drive it.
 */
export async function addBook(db: Db, admin: Db, path: string, fileName: string): Promise<UploadResult> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: 'Sign in first.' };
  const { data: me } = await db.from('member').select('couple_id').eq('user_id', auth.user.id).maybeSingle();
  if (!me) return { error: 'Create or join a couple first.' };
  const [, coupleId, id] = UPLOAD_PATH.exec(path) ?? [];
  if (coupleId !== me.couple_id) return { error: 'Choose an EPUB file.' };
  // The path of a book already on the shelf must never reach drop() below, which would delete that book's file.
  const { data: taken } = await db.from('book').select('id').eq('id', id).maybeSingle();
  if (taken) return { error: 'Choose an EPUB file.' };
  const drop = async (result: UploadResult) => (await admin.storage.from('books').remove([path]), result);

  const { data: blob } = await db.storage.from('books').download(path);
  if (!blob) return { error: 'Could not store the file. Try again.' };
  if (blob.size === 0) return drop({ error: 'Choose an EPUB file.' });
  if (blob.size > MAX_EPUB_BYTES) return drop({ error: 'That file is over 50 MB.' });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let meta: Awaited<ReturnType<typeof epubMeta>>;
  try {
    meta = await epubMeta(bytes);
  } catch {
    return drop({ error: "That file isn't an EPUB." });
  }
  let spineLengths: number[];
  try {
    spineLengths = await spineLengthsFromEpub(bytes);
  } catch (e) {
    return drop({ error: `This EPUB can't be read: ${(e as Error).message}` });
  }
  // A missing or unreadable TOC only costs chapter names, a missing cover only the picture: the book still goes in.
  const toc: Toc | null = await tocFromEpub(bytes).catch(() => null);
  const cover = await epubCover(bytes).catch(() => null);
  const hash = await sha256(bytes);
  const title = meta.title ?? fileName.replace(/\.epub$/i, '');

  const existing = await findBySha(db, me.couple_id, hash);
  if (existing) return drop({ ok: `"${existing}" is already in your library.` });

  const coverPath = cover && `${me.couple_id}/${id}.${cover.ext}`;
  const stored = coverPath && !(await db.storage.from('covers').upload(coverPath, cover.bytes, { contentType: cover.type })).error;

  const { error } = await admin.from('book').insert({
    id,
    couple_id: me.couple_id,
    title,
    author: meta.author,
    sha256: hash,
    storage_path: path,
    cover_path: stored ? coverPath : null,
    spine_lengths: spineLengths,
    toc,
    added_by: auth.user.id,
  });
  if (error) {
    await admin.storage.from('books').remove([path]);
    if (stored) await admin.storage.from('covers').remove([coverPath]);
    const raced = error.code === '23505' ? await findBySha(db, me.couple_id, hash) : null;
    return raced ? { ok: `"${raced}" is already in your library.` } : { error: 'Could not add the book. Try again.' };
  }
  return { ok: `Added "${title}".` };
}
