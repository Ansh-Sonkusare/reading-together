'use client';

import { useEffect, useRef, useState } from 'react';
import { createReader, spineLengthsFromEpub, type Pos, type ReaderEvents, type ReaderHandle } from '@/features/reader';

declare global {
  interface Window {
    __reader?: ReaderHandle;
    __lengthMismatches?: Parameters<ReaderEvents['lengthMismatch']>[0][];
  }
}

export function DevReader() {
  const container = useRef<HTMLDivElement>(null);
  const [reader, setReader] = useState<ReaderHandle | null>(null);
  const [pos, setPos] = useState('');
  const [pageEndPos, setPageEndPos] = useState('');
  const [selectionPos, setSelectionPos] = useState('');
  const [markClicked, setMarkClicked] = useState('');

  useEffect(() => {
    let handle: ReaderHandle | undefined;
    let cancelled = false;
    (async () => {
      const bytes = new Uint8Array(await (await fetch('/dev/fixtures/alice.epub')).arrayBuffer());
      const spineLengths = await spineLengthsFromEpub(bytes);
      const r = await createReader(container.current!, new File([bytes], 'alice.epub'), { spineLengths });
      if (cancelled) return r.destroy();
      handle = r;
      const mismatches: Parameters<ReaderEvents['lengthMismatch']>[0][] = [];
      window.__lengthMismatches = mismatches;
      r.on('lengthMismatch', (e) => mismatches.push(e));
      r.on('relocate', (e) => {
        setPos(e.pos.toFixed(6));
        setPageEndPos(e.pageEndPos.toFixed(6));
      });
      r.on('select', (e) => setSelectionPos(e.pos.toFixed(6)));
      r.on('markClick', (e) => setMarkClicked(e.id));
      await r.goTo(0 as Pos);
      window.__reader = r;
      setReader(r);
    })();
    return () => {
      cancelled = true;
      handle?.destroy();
      delete window.__reader;
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex flex-wrap items-center gap-3 p-2 font-mono text-xs">
        <button aria-label="Previous page" disabled={!reader} onClick={() => reader?.prev()}>‹ prev</button>
        <button aria-label="Next page" disabled={!reader} onClick={() => reader?.next()}>next ›</button>
        <select aria-label="Font size" defaultValue="1" disabled={!reader} onChange={(e) => reader?.setFontScale(Number(e.target.value))}>
          {[0.8, 1, 1.2, 1.6, 2].map((s) => <option key={s} value={s}>{Math.round(s * 100)}%</option>)}
        </select>
        <span>pos <output data-testid="pos">{pos}</output></span>
        <span>end <output data-testid="page-end-pos">{pageEndPos}</output></span>
        <span>sel <output data-testid="selection-pos">{selectionPos}</output></span>
        <span>mark <output data-testid="mark-clicked">{markClicked}</output></span>
      </div>
      <div ref={container} className="min-h-0 flex-1" />
    </div>
  );
}
