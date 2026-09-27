import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const WT = '/Users/anshsonkusare/code/reading-together/.claude/worktrees/agent-aca33d5d47fdf1206/';
const require = createRequire(WT + 'package.json');
const { createClient } = require('@supabase/supabase-js');
const env = JSON.parse(execSync('pnpm exec supabase status -o json', { cwd: WT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const mode = process.argv[2] ?? 'rejectFirst'; // rejectFirst | control
const N = Number(process.argv[3] ?? 10);
const epub = readFileSync(WT + 'fixtures/alice.epub');
const url = env.API_URL;
const opts = { auth: { persistSession: false } };
const admin = createClient(url, env.SERVICE_ROLE_KEY, opts);
const anon = createClient(url, env.ANON_KEY, opts);
let hangs = 0;
for (let i = 0; i < N; i++) {
  const tag = `repro2-${Date.now().toString(36)}-${i}`;
  if (mode.startsWith('reject')) {
    const r = await anon.storage.from('books').upload(`${tag}/denied.epub`, mode === 'rejectSmall' ? Buffer.from('x') : epub);
    if (!r.error) throw new Error('expected RLS refusal');
  } else {
    const r = await admin.storage.from('books').upload(`${tag}/allowed.epub`, epub);
    if (r.error) throw r.error;
  }
  const t0 = Date.now();
  const sig = AbortSignal.timeout(5000);
  const a = createClient(url, env.SERVICE_ROLE_KEY, { ...opts, global: { fetch: (u, init) => fetch(u, { ...init, signal: sig }) } });
  const r = await a.storage.from('books').upload(`${tag}/x.epub`, epub);
  const hung = r.error && /abort|timeout/i.test(String(r.error.message) + String(r.error.originalError?.name));
  if (hung) hangs++;
  console.log(i, hung ? 'HANG' : r.error ? 'ERR ' + r.error.message : 'ok', Date.now() - t0, 'ms');
  await admin.storage.from('books').remove([`${tag}/x.epub`, `${tag}/allowed.epub`]);
}
console.log(`mode=${mode} hangs=${hangs}/${N}`);
