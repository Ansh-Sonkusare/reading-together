// No imports, so scripts/backfill-covers.mjs can load this file with Node's type stripping.

export type Cover = { bytes: Uint8Array; type: string; ext: string };

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// ponytail: no zip64 or encryption, same ceiling as reader/locator.ts zipReader (which decodes to text, so can't carry an image).
function zipEntries(bytes: Uint8Array): { name: string; read: () => Promise<Uint8Array> }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const out = [];
  let p = view.getUint32(eocd + 16, true);
  for (let n = view.getUint16(eocd + 10, true); n > 0; n--) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    out.push({
      name,
      read: async () => {
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const raw = bytes.subarray(start, start + size);
        if (method === 0) return raw;
        if (method !== 8) throw new Error(`unsupported zip method ${method}`);
        const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      },
    });
  }
  return out;
}

const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => [m[1], m[2] ?? m[3]]));

function resolve(base: string, href: string): string {
  const out: string[] = [];
  for (const part of (base + decodeURIComponent(href.split('#')[0])).split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
}

/** The EPUB's cover image: EPUB3 manifest item with properties="cover-image", else EPUB2 <meta name="cover">, else null. */
export async function epubCover(bytes: Uint8Array): Promise<Cover | null> {
  const entries = new Map(zipEntries(bytes).map((e) => [e.name, e.read]));
  const text = async (path: string) => new TextDecoder().decode(await entries.get(path)!());
  if (!entries.has('META-INF/container.xml')) return null;
  const opfPath = attrs(/<rootfile\b[^>]*>/.exec(await text('META-INF/container.xml'))?.[0] ?? '')['full-path'];
  if (!opfPath || !entries.has(opfPath)) return null;
  const opf = await text(opfPath);
  const items = [...opf.matchAll(/<(?:\w+:)?item\b[^>]*>/g)].map((m) => attrs(m[0]));
  const metaId = [...opf.matchAll(/<(?:\w+:)?meta\b[^>]*>/g)].map((m) => attrs(m[0])).find((a) => a.name === 'cover')?.content;
  const item = items.find((a) => a.properties?.split(/\s+/).includes('cover-image')) ?? items.find((a) => metaId && a.id === metaId);
  const ext = item && TYPES[item['media-type']];
  if (!item?.href || !ext) return null;
  const read = entries.get(resolve(opfPath.slice(0, opfPath.lastIndexOf('/') + 1), item.href));
  return read ? { bytes: await read(), type: item['media-type'], ext } : null;
}
