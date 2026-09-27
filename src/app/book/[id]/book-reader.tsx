'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Member } from '@/features/couple/couple';
import { usePartnerProgress, useProgressSaver, type Progress } from '@/features/couple/progress';
import { createReader, displayPage, type Locator, type Pos, type ReaderHandle } from '@/features/reader';

const FONT_KEY = 'reader:fontScale';
const FONT_SCALES = [0.8, 1, 1.2, 1.6, 2];

function storedScale(): number {
  try {
    const n = Number(localStorage.getItem(FONT_KEY));
    return FONT_SCALES.includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

type Props = {
  bookId: string;
  title: string;
  userId: string;
  fileUrl: string;
  spineLengths: number[];
  mine: Progress | null;
  me: Member;
  partner: Member | null;
  partnerProgress: Progress | null;
};

export function BookReader({ bookId, title, userId, fileUrl, spineLengths, mine, me, partner, partnerProgress }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [reader, setReader] = useState<ReaderHandle | null>(null);
  const [pos, setPos] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [mismatch, setMismatch] = useState(false);
  const [failed, setFailed] = useState(false);
  const [turning, setTurning] = useState(false);
  const { save, savedPos } = useProgressSaver(bookId, userId, mine);
  const theirs = usePartnerProgress(bookId, partner?.userId ?? null, partnerProgress);

  useEffect(() => {
    let handle: ReaderHandle | undefined;
    let cancelled = false;
    (async () => {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`book download failed: ${res.status}`);
      const r = await createReader(container.current!, await res.blob(), { spineLengths });
      if (cancelled) return r.destroy();
      handle = r;
      let warned = false;
      r.on('lengthMismatch', (e) => {
        if (warned) return;
        warned = true;
        console.warn('spine length differs from the upload-time length; positions may drift', e);
        setMismatch(true);
      });
      r.on('relocate', (e) => {
        setPos(e.pos);
        save(e.pos, e.pageEndPos, e.locator);
      });
      const s = storedScale();
      setScale(s);
      if (s !== 1) r.setFontScale(s);
      await (mine?.locator ? r.goTo(mine.locator as Locator) : r.goTo((mine?.pos ?? 0) as Pos));
      setReader(r);
    })().catch((e) => {
      console.error(e);
      setFailed(true);
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
    // The reader is created once per page load; later prop changes don't re-open the book.
  }, []);

  // foliate drops a turn requested while the previous one is still animating.
  const turn = async (dir: 'prev' | 'next') => {
    if (!reader || turning) return;
    setTurning(true);
    try {
      await reader[dir]();
    } finally {
      setTurning(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') turn('prev');
      else if (e.key === 'ArrowRight') turn('next');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const changeScale = (s: number) => {
    setScale(s);
    reader?.setFontScale(s);
    try {
      localStorage.setItem(FONT_KEY, String(s));
    } catch {}
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-2 text-sm">
        <Link href="/library" className="underline">
          Library
        </Link>
        <h1 className="truncate font-semibold">{title}</h1>
        <p data-testid="progress-pair" className="ml-auto shrink-0 font-medium">
          {partner && (
            <>
              <span style={{ color: partner.color }}>
                {theirs ? `${partner.name} p.${displayPage(theirs.pos, spineLengths)}` : `${partner.name} hasn't started`}
              </span>
              {' · '}
            </>
          )}
          <span style={{ color: me.color }}>you p.{displayPage(pos ?? mine?.pos ?? 0, spineLengths)}</span>
        </p>
      </header>
      {mismatch && (
        <p role="status" className="bg-amber-50 px-3 py-1 text-xs text-amber-800">
          This book renders slightly differently here, so page numbers may be a little off.
        </p>
      )}
      {failed && (
        <p role="alert" className="px-3 py-1 text-sm text-red-600">
          Could not open this book. Reload to try again.
        </p>
      )}
      <div ref={container} className="min-h-0 flex-1" />
      <footer className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm">
        <button aria-label="Previous page" disabled={!reader || turning} onClick={() => turn('prev')} className="px-2 disabled:opacity-40">
          ‹
        </button>
        <span className="flex items-center gap-3">
          <span>{pos === null ? '' : `p.${displayPage(pos, spineLengths)}`}</span>
          <output data-testid="my-pos" className="sr-only">
            {pos?.toFixed(6)}
          </output>
          <output data-testid="saved-pos" className="sr-only">
            {savedPos?.toFixed(6)}
          </output>
          <select aria-label="Font size" value={scale} disabled={!reader} onChange={(e) => changeScale(Number(e.target.value))}>
            {FONT_SCALES.map((s) => (
              <option key={s} value={s}>
                {Math.round(s * 100)}%
              </option>
            ))}
          </select>
        </span>
        <button aria-label="Next page" disabled={!reader || turning} onClick={() => turn('next')} className="px-2 disabled:opacity-40">
          ›
        </button>
      </footer>
    </div>
  );
}
