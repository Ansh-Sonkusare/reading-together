// Canonical text of a spine item: the data of every Text node (CDATA included)
// under <body>, concatenated in document order, with no whitespace
// normalisation. Browser (DOM) and upload-time (string) paths must agree on it
// byte for byte, because `pos` is compared across both.

export type Pos = number & { readonly __brand: 'Pos' };
export type Quote = { exact: string; prefix: string; suffix: string };
export type Locator = { spine: number; offset: number; cfi: string; quote?: Quote };

export const QUOTE_CONTEXT = 32;

export function canonicalText(doc: Document): string {
  return doc.body?.textContent ?? '';
}

export function spineLength(doc: Document): number {
  return canonicalText(doc).length;
}

export function offsetOf(node: Node, offset: number): number {
  const doc = node.ownerDocument ?? (node as Document);
  if (!doc.body) return 0;
  const range = doc.createRange();
  range.setStart(doc.body, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

export function toPos(spine: number, offset: number, spineLengths: readonly number[]): Pos {
  const length = spineLengths[spine];
  if (length === undefined) throw new RangeError(`spine ${spine} out of range`);
  if (offset < 0 || offset > length) throw new RangeError(`offset ${offset} outside spine ${spine} (length ${length})`);
  return (length === 0 ? spine : spine + offset / length) as Pos;
}

export function fromPos(pos: Pos | number, spineLengths: readonly number[]): { spine: number; offset: number } {
  if (!(pos >= 0 && pos <= spineLengths.length)) throw new RangeError(`pos ${pos} outside book of ${spineLengths.length} spine items`);
  const spine = Math.min(Math.floor(pos), spineLengths.length - 1);
  return { spine, offset: Math.min(spineLengths[spine], Math.round((pos - spine) * spineLengths[spine])) };
}

// Inverse of offsetOf: a collapsed Range at canonical offset `offset` of `doc`.
export function rangeAt(doc: Document, offset: number): Range {
  const range = doc.createRange();
  if (!doc.body) return range;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let left = offset;
  let last: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (left <= n.data.length) {
      range.setStart(n, left);
      return range;
    }
    left -= n.data.length;
    last = n;
  }
  if (last) range.setStart(last, last.data.length);
  return range;
}

export function quoteAt(text: string, offset: number, length: number): Quote {
  return {
    exact: text.slice(offset, offset + length),
    prefix: text.slice(Math.max(0, offset - QUOTE_CONTEXT), offset),
    suffix: text.slice(offset + length, offset + length + QUOTE_CONTEXT),
  };
}

function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

// Offset of `quote.exact` in `text`, picking the occurrence whose surroundings
// best match prefix/suffix; `near` (the stored offset) breaks remaining ties.
// Returns null when the exact text is absent or still ambiguous.
export function findByQuote(text: string, quote: Quote, near?: number): number | null {
  if (!quote.exact) return null;
  let best: number | null = null;
  let bestScore = -1;
  let tied = false;
  for (let i = text.indexOf(quote.exact); i !== -1; i = text.indexOf(quote.exact, i + 1)) {
    const before = text.slice(Math.max(0, i - quote.prefix.length), i);
    const after = text.slice(i + quote.exact.length, i + quote.exact.length + quote.suffix.length);
    const score = commonSuffix(before, quote.prefix) + commonPrefix(after, quote.suffix);
    if (score > bestScore) {
      best = i;
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      if (near !== undefined && best !== null && Math.abs(i - near) !== Math.abs(best - near)) {
        if (Math.abs(i - near) < Math.abs(best - near)) best = i;
      } else {
        tied = true;
      }
    }
  }
  return tied ? null : best;
}

const XML_ENTITIES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][\w.-]*);/g, (_, ref: string) => {
    if (ref[0] === '#') return String.fromCodePoint(ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10));
    const ch = XML_ENTITIES[ref];
    // ponytail: XML's five named entities only; add the XHTML DTD table if a real upload trips this.
    if (ch === undefined) throw new Error(`unsupported entity &${ref};`);
    return ch;
  });
}

// The upload-time twin of canonicalText, for raw XHTML without a DOM. It
// mirrors what an XML parser hands the DOM: line endings normalised to \n,
// comments and processing instructions dropped, CDATA kept verbatim.
export function canonicalTextFromXhtml(xml: string): string {
  const src = xml.replace(/\r\n?/g, '\n');
  const until = (end: string, from: number) => {
    const k = src.indexOf(end, from);
    if (k === -1) throw new Error(`unterminated markup in XHTML at ${from}`);
    return k;
  };
  let out = '';
  let inBody = false;
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const textEnd = lt === -1 ? src.length : lt;
    if (inBody && textEnd > i) out += decodeEntities(src.slice(i, textEnd));
    if (lt === -1) break;
    if (src.startsWith('<!--', lt)) {
      i = until('-->', lt + 4) + 3;
    } else if (src.startsWith('<![CDATA[', lt)) {
      const end = until(']]>', lt + 9);
      if (inBody) out += src.slice(lt + 9, end);
      i = end + 3;
    } else if (src.startsWith('<?', lt)) {
      i = until('?>', lt + 2) + 2;
    } else if (src.startsWith('<!', lt)) {
      let depth = 0;
      let j = lt + 2;
      for (; j < src.length; j++) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth === 0) break;
      }
      i = j + 1;
    } else {
      let j = lt + 1;
      let quote = '';
      for (; j < src.length; j++) {
        const c = src[j];
        if (quote) {
          if (c === quote) quote = '';
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '>') break;
      }
      const tag = src.slice(lt + 1, j);
      const name = /^\/?\s*([^\s/>]+)/.exec(tag)?.[1].replace(/^.*:/, '');
      if (name === 'body') {
        if (tag[0] === '/') break;
        if (!tag.endsWith('/')) inBody = true;
      }
      i = j + 1;
    }
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ponytail: no zip64 and no encrypted entries; EPUBs from Gutenberg-class sources never use them.
async function unzip(bytes: Uint8Array): Promise<Map<string, () => Promise<string>>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map<string, () => Promise<string>>();
  const utf8 = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    files.set(name, async () => {
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const raw = bytes.subarray(start, start + size);
      if (method !== 0 && method !== 8) throw new Error(`unsupported zip method ${method} for ${name}`);
      return utf8.decode(method === 0 ? raw : await inflateRaw(raw));
    });
  }
  return files;
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeEntities(m[3] ?? m[4]);
  return out;
}

function resolveHref(base: string, href: string): string {
  const parts = (base + decodeURIComponent(href.split('#')[0])).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
}

export async function spineLengthsFromEpub(bytes: Uint8Array): Promise<number[]> {
  const files = await unzip(bytes);
  const read = (path: string) => {
    const get = files.get(path);
    if (!get) throw new Error(`missing ${path} in EPUB`);
    return get();
  };
  const container = await read('META-INF/container.xml');
  const opfPath = attrs(/<rootfile\b[^>]*>/.exec(container)?.[0] ?? '')['full-path'];
  if (!opfPath) throw new Error('container.xml has no rootfile');
  const opf = await read(opfPath);
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const hrefById = new Map<string, string>();
  for (const m of opf.matchAll(/<(?:\w+:)?item\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.id && a.href) hrefById.set(a.id, a.href);
  }
  const lengths: number[] = [];
  for (const m of opf.matchAll(/<(?:\w+:)?itemref\b[^>]*>/g)) {
    const href = hrefById.get(attrs(m[0]).idref);
    if (!href) throw new Error(`spine itemref ${attrs(m[0]).idref} not in manifest`);
    lengths.push(canonicalTextFromXhtml(await read(resolveHref(base, href))).length);
  }
  return lengths;
}
