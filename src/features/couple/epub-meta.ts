export const MAX_EPUB_BYTES = 50 * 1024 * 1024;

// ponytail: a second, read-by-name zip reader because locator.ts keeps its unzip private;
// delete this once the reader workstream exports one (contract request filed with P12).
async function readEntry(bytes: Uint8Array, want: string): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const utf8 = new TextDecoder();
  let p = view.getUint32(eocd + 16, true);
  for (let n = view.getUint16(eocd + 10, true); n > 0; n--) {
    const nameLen = view.getUint16(p + 28, true);
    if (utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen)) === want) {
      const method = view.getUint16(p + 10, true);
      const size = view.getUint32(p + 20, true);
      const local = view.getUint32(p + 42, true);
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const raw = bytes.subarray(start, start + size);
      if (method === 0) return utf8.decode(raw);
      const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  throw new Error(`missing ${want} in EPUB`);
}

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
  const container = await readEntry(bytes, 'META-INF/container.xml');
  const opfPath = /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/.exec(container)?.[1];
  if (!opfPath) throw new Error('container.xml has no rootfile');
  const opf = await readEntry(bytes, opfPath);
  return { title: text(opf, 'title'), author: text(opf, 'creator') };
}
