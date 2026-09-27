import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (process.env.NODE_ENV === 'production' || !/^[\w-]+\.epub$/.test(name)) return new Response('Not found', { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), 'fixtures', name));
    return new Response(bytes, { headers: { 'content-type': 'application/epub+zip' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
