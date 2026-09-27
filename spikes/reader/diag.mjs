import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { canonicalTextFromXhtml } from '../../src/features/reader/locator.ts';

const files = { 0: 'wrap0000.xhtml', 3: '8761230412384829988_11-h-2.htm.xhtml', 4: '8761230412384829988_11-h-3.htm.xhtml', 14: '8761230412384829988_11-h-13.htm.xhtml' };
const server = await serve();
const browser = await chromium.launch();
for (const engine of ['epubjs', 'foliate']) {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/?engine=${engine}`);
  await page.waitForFunction(() => window.spikeReady);
  for (const [i, f] of Object.entries(files)) {
    const node = canonicalTextFromXhtml(execSync(`unzip -p ../../fixtures/alice.epub OEBPS/${f}`, { cwd: import.meta.dirname }).toString());
    const [text, contentType] = await page.evaluate(async (i) => {
      await window.spike.show(+i);
      const d = window.spike.doc();
      return [d.body.textContent, d.contentType];
    }, i);
    let k = 0;
    while (k < node.length && node[k] === text[k]) k++;
    console.log(`${engine} spine ${i} (${contentType}): ${k === node.length && k === text.length ? 'identical' : `first diff at ${k}: node ${JSON.stringify(node.slice(k - 25, k + 15))} | browser ${JSON.stringify(text.slice(k - 25, k + 15))}`}`);
  }
}
await browser.close();
server.close();
