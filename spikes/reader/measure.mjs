import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { execSync } from 'node:child_process';
import { canonicalTextFromXhtml, spineLengthsFromEpub, toPos } from '../../src/features/reader/locator.ts';

const here = import.meta.dirname;
const nodeLengths = await spineLengthsFromEpub(new Uint8Array(await readFile(join(here, '../../fixtures/alice.epub'))));

const passages = [
  { name: 'ch1 start', spine: 2, needle: 'Alice was beginning to get very tired' },
  { name: 'ch3 mid', spine: 4, needle: 'the Dodo replied very gravely' },
  { name: 'ch12 end', spine: 13, needle: 'remembering her own child-life' },
  { name: 'ch3 end (after <pre>)', spine: 4, needle: 'coming back to finish his story' },
];
const nodeText = (spine) => canonicalTextFromXhtml(execSync(`unzip -p ../../fixtures/alice.epub OEBPS/8761230412384829988_11-h-${spine - 1}.htm.xhtml`, { cwd: here }).toString());
for (const p of passages) p.nodeOffset = nodeText(p.spine).indexOf(p.needle);
const layouts = [
  { font: '100', width: 390, height: 844 },
  { font: '160', width: 390, height: 844 },
  { font: '100', width: 1280, height: 800 },
  { font: '160', width: 1280, height: 800 },
];

const server = await serve();
const base = `http://localhost:${server.address().port}`;
const browser = await chromium.launch();
const results = {};

for (const engine of ['foliate', 'epubjs', 'epubjs&method=blobUrl']) {
  const refCfi = {};
  results[engine] = { rows: [], lengths: [], bytes: 0, gz: 0, errors: [] };
  for (const layout of layouts) {
    const page = await browser.newPage({ viewport: { width: layout.width, height: layout.height } });
    page.on('pageerror', (e) => results[engine].errors.push(String(e)));
    const js = new Map();
    page.on('response', async (r) => {
      if (r.url().includes('/node_modules/') && r.url().endsWith('.js')) js.set(r.url(), await r.body().catch(() => Buffer.alloc(0)));
    });
    await page.goto(`${base}/?engine=${engine}&font=${layout.font}`);
    await page.waitForFunction(() => window.spikeReady, null, { timeout: 30000 });
    const label = `${layout.font}% ${layout.width}x${layout.height}`;
    results[engine].lengths.push({ label, lengths: await page.evaluate(() => window.spike.spineLengths()) });
    for (const p of passages) {
      const m = await page.evaluate(([s, n, c]) => window.spike.measure(s, n, c), [p.spine, p.needle, refCfi[p.name] ?? null]);
      refCfi[p.name] ??= m.locator.cfi;
      results[engine].contentType = await page.evaluate(() => window.contentType());
      results[engine].rows.push({ passage: p.name, label, ...m, pos: toPos(p.spine, m.locator.offset, nodeLengths) });
    }
    if (layout === layouts[0]) {
      results[engine].bytes = [...js.values()].reduce((a, b) => a + b.length, 0);
      results[engine].gz = [...js.values()].reduce((a, b) => a + gzipSync(b).length, 0);
      results[engine].files = [...js.keys()].map((u) => u.replace(/.*node_modules\//, ''));
    }
    await page.close();
  }
}
await browser.close();
server.close();

for (const [engine, r] of Object.entries(results)) {
  console.log(`\n## ${engine} (iframe document: ${r.contentType})`);
  console.log('| passage | layout | spine idx | offset | node offset | pos | offset via layout-1 CFI | page-start offset | cfi | painted |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const row of r.rows)
    console.log(`| ${row.passage} | ${row.label} | ${row.index} | ${row.locator.offset} | ${passages.find((p) => p.name === row.passage).nodeOffset} | ${row.pos.toFixed(6)} | ${row.offsetViaRefCfi} | ${row.pageStartOffset} | \`${row.locator.cfi}\` | ${row.painted.join(' ')} |`);
  for (const p of passages) {
    const rows = r.rows.filter((x) => x.passage === p.name);
    const same = rows.every((x) => x.pos === rows[0].pos && x.offsetViaRefCfi === rows[0].locator.offset);
    const node = rows.every((x) => x.locator.offset === p.nodeOffset);
    console.log(`${p.name}: pos equal across 4 layouts and via CFI round-trip: ${same ? 'YES' : 'NO'}; browser offset == Node offset: ${node ? 'YES' : 'NO'}  quote=${JSON.stringify(rows[0].locator.quote)}`);
  }
  console.log(`\nspineLength node vs browser (${engine}):`);
  console.log('| spine | node | ' + r.lengths.map((l) => l.label).join(' | ') + ' | equal |');
  console.log('|---|---|' + r.lengths.map(() => '---|').join('') + '---|');
  nodeLengths.forEach((n, i) => {
    const b = r.lengths.map((l) => l.lengths[i]);
    console.log(`| ${i} | ${n} | ${b.join(' | ')} | ${b.every((x) => x === n) ? 'YES' : 'NO'} |`);
  });
  console.log(`\nJS loaded: ${r.files?.join(', ')}\nraw ${r.bytes} B, gzip ${r.gz} B`);
  if (r.errors.length) console.log('page errors:', [...new Set(r.errors)].join('\n'));
}
