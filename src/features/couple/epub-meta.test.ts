import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { epubMeta } from './epub-meta';

it('reads title and author from the Gutenberg Alice OPF', async () => {
  expect(await epubMeta(readFileSync('fixtures/alice.epub'))).toEqual({
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
  });
});

it('reads title and author from the Gutenberg Pride and Prejudice OPF', async () => {
  expect(await epubMeta(readFileSync('fixtures/pride-and-prejudice.epub'))).toEqual({
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
  });
});

it('rejects bytes that are not a zip', async () => {
  await expect(epubMeta(new TextEncoder().encode('{"name":"x"}'))).rejects.toThrow('not a zip file');
});
