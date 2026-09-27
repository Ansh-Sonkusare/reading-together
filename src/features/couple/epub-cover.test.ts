import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { epubCover } from './epub-cover';

it('takes the EPUB3 cover-image item from Alice', async () => {
  const cover = await epubCover(readFileSync('fixtures/alice.epub'));
  expect(cover && { type: cover.type, ext: cover.ext, size: cover.bytes.length }).toEqual({ type: 'image/jpeg', ext: 'jpg', size: 104775 });
  const inZip = execFileSync('unzip', ['-p', 'fixtures/alice.epub', 'OEBPS/3809243430796983855_cover.jpg'], { maxBuffer: 1 << 24 });
  expect(Buffer.from(cover!.bytes).equals(inZip)).toBe(true);
});

it('falls back to the EPUB2 <meta name="cover"> in Pride and Prejudice', async () => {
  const cover = await epubCover(readFileSync('fixtures/pride-and-prejudice.epub'));
  expect(cover && { type: cover.type, size: cover.bytes.length }).toEqual({ type: 'image/jpeg', size: 225286 });
});

it('rejects bytes that are not a zip', async () => {
  await expect(epubCover(new TextEncoder().encode('{"name":"x"}'))).rejects.toThrow('not a zip file');
});
