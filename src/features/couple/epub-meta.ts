import { zipReader } from '../reader/locator';

export const MAX_EPUB_BYTES = 50 * 1024 * 1024;

function text(xml: string, tag: string): string | null {
  const inner = new RegExp(`<dc:${tag}\\b[^>]*>([\\s\\S]*?)</dc:${tag}>`).exec(xml)?.[1];
  if (inner === undefined) return null;
  const value = inner
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, r: string) =>
      r[0] === '#' ? String.fromCodePoint(r[1] === 'x' || r[1] === 'X' ? parseInt(r.slice(2), 16) : Number(r.slice(1))) : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[r.toLowerCase()],
    )
    .replace(/\s+/g, ' ')
    .trim();
  return value || null;
}

export async function epubMeta(bytes: Uint8Array): Promise<{ title: string | null; author: string | null }> {
  const read = zipReader(bytes);
  const container = await read('META-INF/container.xml');
  const opfPath = /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/.exec(container)?.[1];
  if (!opfPath) throw new Error('container.xml has no rootfile');
  const opf = await read(opfPath);
  return { title: text(opf, 'title'), author: text(opf, 'creator') };
}
