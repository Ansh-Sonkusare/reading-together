'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReaderPrefs, createReader, spineLengthsFromEpub, type Pos, type ReaderEvents, type ReaderHandle } from '@/features/reader';

declare global {
  interface Window {
    __reader?: ReaderHandle;
    __lengthMismatches?: Parameters<ReaderEvents['lengthMismatch']>[0][];
    __anchorLost?: Parameters<ReaderEvents['anchorLost']>[0][];
    __paintedText?: (id: string) => string | null;
  }
}

type Overlayer = { element: SVGElement; hitTest(p: { x: number; y: number }): [string, Range] | [] };

// The text under a painted mark, read back through foliate's own hit test on the mark's first rect.
function paintedText(id: string): string | null {
  const view = document.querySelector('foliate-view') as unknown as { renderer: { getContents(): { overlayer?: Overlayer }[] } } | null;
  const overlayer = view?.renderer.getContents()[0]?.overlayer;
  const rect = overlayer?.element.querySelector(`[data-mark-id="${id}"] rect`);
  if (!overlayer || !rect) return null;
  const n = (a: string) => Number(rect.getAttribute(a));
  const [, range] = overlayer.hitTest({ x: n('x') + n('width') / 2, y: n('y') + n('height') / 2 });
  return range?.toString() ?? null;
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
      const lost: Parameters<ReaderEvents['anchorLost']>[0][] = [];
      window.__anchorLost = lost;
      r.on('anchorLost', (e) => lost.push(e));
      window.__paintedText = paintedText;
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
        <ReaderPrefs handle={reader} />
        <Button size="xs">Sample</Button>
        <span>pos <output data-testid="pos">{pos}</output></span>
        <span>end <output data-testid="page-end-pos">{pageEndPos}</output></span>
        <span>sel <output data-testid="selection-pos">{selectionPos}</output></span>
        <span>mark <output data-testid="mark-clicked">{markClicked}</output></span>
      </div>
      <div ref={container} className="min-h-0 flex-1" />
    </div>
  );
}
