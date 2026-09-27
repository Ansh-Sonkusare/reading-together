'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useSyncExternalStore } from 'react';
import { chapterTitle, discussHref } from './discussion';
import { DISCUSSED, describeDay, discussedSpines, groupByDay, memoriesLine, type TimelineEvent, type TimelineMember } from './timeline';

const noop = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Days are the reader's local days, so the server renders UTC and the browser regroups after hydration.
export function Timeline(props: { events: TimelineEvent[]; members: TimelineMember[]; meId: string; title: string }) {
  const timeZone = useSyncExternalStore(noop, browserZone, () => 'UTC');
  const { bookId } = useParams<{ bookId: string }>();
  const days = groupByDay(props.events, timeZone)
    .map((d) => ({ ...d, lines: describeDay(d.events, props.members, props.meId, props.title) }))
    .filter((d) => d.lines.length);
  return (
    <>
      {days.length === 0 ? (
        <p className="text-gray-600">Nothing yet. Open the book together to start your story.</p>
      ) : (
        <ol className="relative flex flex-col gap-6 border-l-2 pl-6" aria-label="Timeline">
          {days.map((d) => (
            <li key={d.key} className="relative">
              <span className="absolute top-1.5 -left-[31px] size-3 rounded-full bg-rose-500" aria-hidden />
              <h2 className="font-semibold">{d.label}</h2>
              <ul className="mt-1 flex flex-col gap-1">
                {d.lines.map((line) => (
                  <li key={line}>{line.startsWith(DISCUSSED) ? <Discussed bookId={bookId} spines={discussedSpines(d.events)} /> : line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <p className="text-lg font-semibold">{memoriesLine(props.events)}</p>
    </>
  );
}

// Same wording as describeDay's line, with each chapter linking to its discussion.
function Discussed({ bookId, spines }: { bookId: string; spines: number[] }) {
  const link = (s: number, text: string) => (
    <Link key={s} href={discussHref(bookId, s)} className="underline">
      {text}
    </Link>
  );
  if (spines.length === 1) return <>{DISCUSSED} {link(spines[0], chapterTitle(spines[0]))}</>;
  return (
    <>
      {DISCUSSED} Chapters{' '}
      {spines.map((s, i) => (
        <Fragment key={s}>
          {i === 0 ? '' : i === spines.length - 1 ? ' and ' : ', '}
          {link(s, String(s + 1))}
        </Fragment>
      ))}
    </>
  );
}
