import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { extname, join, normalize } from 'node:path';

const here = import.meta.dirname;
const repo = join(here, '../..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.epub': 'application/epub+zip' };

export function serve(port = 0) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
      if (path === '/locator.js') {
        const ts = await readFile(join(repo, 'src/features/reader/locator.ts'), 'utf8');
        res.writeHead(200, { 'content-type': 'text/javascript' }).end(stripTypeScriptTypes(ts));
      } else if (path === '/alice.epub') {
        res.writeHead(200, { 'content-type': types['.epub'] }).end(await readFile(join(repo, 'fixtures/alice.epub')));
      } else {
        const file = path === '/' ? '/index.html' : path;
        const body = await readFile(join(here, file));
        res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
      }
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === import.meta.filename) {
  const server = await serve(5178);
  console.log(`http://localhost:${server.address().port}/?engine=foliate`);
}
