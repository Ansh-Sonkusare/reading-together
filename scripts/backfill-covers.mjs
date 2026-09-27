// Gives books uploaded before covers existed their cover. Idempotent: only books with no cover_path are looked at.
// Usage: node scripts/backfill-covers.mjs   (reads .env.local; never prints its values)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { epubCover } from '../src/features/couple/epub-cover.ts';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: books, error } = await admin.from('book').select('id, couple_id, title, storage_path').is('cover_path', null).not('storage_path', 'is', null);
if (error) throw error;
let added = 0;
for (const b of books) {
  const file = await admin.storage.from('books').download(b.storage_path);
  if (file.error) {
    console.log(`skip ${b.id}: epub not downloadable`);
    continue;
  }
  const cover = await epubCover(new Uint8Array(await file.data.arrayBuffer())).catch(() => null);
  if (!cover) continue;
  const path = `${b.couple_id}/${b.id}.${cover.ext}`;
  const up = await admin.storage.from('covers').upload(path, cover.bytes, { contentType: cover.type, upsert: true });
  if (up.error) throw up.error;
  const { error: uErr } = await admin.from('book').update({ cover_path: path }).eq('id', b.id);
  if (uErr) throw uErr;
  added++;
}
console.log(`checked ${books.length} books without a cover, added ${added} covers`);
