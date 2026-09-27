import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalTextFromXhtml, findByQuote, fromPos, quoteAt, spineLengthsFromEpub, toPos } from './locator';

const alice = new Uint8Array(readFileSync(new URL('../../../fixtures/alice.epub', import.meta.url)));

describe('spineLengthsFromEpub', () => {
  it('matches the lengths Chromium measures inside the reader iframe for alice.epub', async () => {
    expect(await spineLengthsFromEpub(alice)).toEqual([
      24, 1424, 11549, 10968, 9597, 13883, 12025, 13881, 12765, 13716, 12688, 11446, 10432, 11672, 18466,
    ]);
  });

  it('rejects bytes that are not a zip', async () => {
    await expect(spineLengthsFromEpub(new TextEncoder().encode('not an epub at all, just text'))).rejects.toThrow('not a zip file');
  });
});

describe('canonicalTextFromXhtml', () => {
  it('keeps body text nodes and whitespace verbatim, drops markup, comments and head', () => {
    const xhtml =
      '<?xml version="1.0" encoding="utf-8"?>\r\n<!DOCTYPE html>\r\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>T</title></head>' +
      '<body class="x">\r\n<p a=">">Tom &amp; <i>Jerry</i>&#8217;s &#x2014;</p><!-- note --><pre>\n  a\n</pre><![CDATA[<raw>]]><br/></body></html>';
    expect(canonicalTextFromXhtml(xhtml)).toBe('\nTom & Jerry’s —\n  a\n<raw>');
  });

  it('refuses named entities an XML parser would not resolve the same way', () => {
    expect(() => canonicalTextFromXhtml('<html><body>a&nbsp;b</body></html>')).toThrow('unsupported entity &nbsp;');
  });
});

describe('toPos', () => {
  it('is spine plus the fraction of the spine item', () => {
    expect(toPos(4, 4839, [24, 1424, 11549, 10968, 9597])).toBe(4.504220068771491);
    expect(toPos(2, 0, [24, 1424, 11549])).toBe(2);
  });

  it('refuses an offset past the end of its spine item', () => {
    expect(() => toPos(0, 25, [24])).toThrow('offset 25 outside spine 0 (length 24)');
    expect(() => toPos(3, 0, [24])).toThrow('spine 3 out of range');
  });
});

describe('quoteAt / findByQuote', () => {
  const text = 'the cat sat. the dog sat. the cat ran.';

  it('takes 32 characters of context either side, clipped at the edges', () => {
    expect(quoteAt(text, 4, 3)).toEqual({ exact: 'cat', prefix: 'the ', suffix: ' sat. the dog sat. the cat ran.' });
    expect(quoteAt('x'.repeat(40) + 'HIT' + 'y'.repeat(40), 40, 3)).toEqual({
      exact: 'HIT',
      prefix: 'x'.repeat(32),
      suffix: 'y'.repeat(32),
    });
  });

  it('round-trips a quote to its offset, using prefix and suffix to pick the right occurrence', () => {
    expect(findByQuote(text, quoteAt(text, 30, 3))).toBe(30);
    expect(findByQuote(text, quoteAt(text, 4, 3))).toBe(4);
  });

  it('still finds the passage after nearby text changed', () => {
    const edited = 'THE cat sat. the dog sat. the cat ran!';
    expect(findByQuote(edited, { exact: 'cat', prefix: 'dog sat. the ', suffix: ' ran.' })).toBe(30);
  });

  it('returns null when absent or genuinely ambiguous, unless near breaks the tie', () => {
    expect(findByQuote(text, { exact: 'bird', prefix: '', suffix: '' })).toBeNull();
    expect(findByQuote(text, { exact: 'sat', prefix: '', suffix: '' })).toBeNull();
    expect(findByQuote(text, { exact: 'sat', prefix: '', suffix: '' }, 20)).toBe(21);
  });
});

describe('fromPos', () => {
  const lengths = [24, 1424, 11549, 10968, 9597];

  it('inverts toPos for the spike passage in chapter 3', () => {
    expect(fromPos(toPos(4, 4839, lengths), lengths)).toEqual({ spine: 4, offset: 4839 });
    expect(fromPos(4.5, lengths)).toEqual({ spine: 4, offset: 4799 });
  });

  it('maps the end of the book to the end of the last spine item and rejects positions outside it', () => {
    expect(fromPos(5, lengths)).toEqual({ spine: 4, offset: 9597 });
    expect(() => fromPos(5.1, lengths)).toThrow('pos 5.1 outside book of 5 spine items');
  });
});
