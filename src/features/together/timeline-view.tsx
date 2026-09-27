'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useSyncExternalStore } from 'react';
import type { Toc } from '../reader';
import { discussHref } from './discussion';
import { DISCUSSED, chapterList, describeDay, discussedChapters, groupByDay, memoriesLine, type TimelineEvent, type TimelineMember } from './timeline';

const noop = () => () => {};
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

type Member = TimelineMember & { color: string };

// Days are the reader's local days, so the server renders UTC and the browser regroups after hydration.
export function Timeline(props: { events: TimelineEvent[]; members: Member[]; meId: string; title: string; toc: Toc | null }) {
  const timeZone = useSyncExternalStore(noop, browserZone, () => 'UTC');
  const { bookId } = useParams<{ bookId: string }>();
  const days = groupByDay(props.events, timeZone)
    .map((d) => ({ ...d, lines: describeDay(d.events, props.members, props.meId, props.title, props.toc) }))
    .filter((d) => d.lines.length);
  const colorsOf = (actors: string[]) => props.members.filter((m) => actors.includes(m.userId)).map((m) => m.color);
  return (
    <>
      {days.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing yet.{' '}
          <Link href={`/book/${bookId}`} className="text-foreground underline underline-offset-4">
            Open the book
          </Link>{' '}
          and your story starts here.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-9" aria-label="Timeline">
          <span aria-hidden className="absolute top-2 bottom-2 left-[5px] w-0.5 rounded-full bg-rule" />
          {days.map((d) => (
            <li key={d.key} className="relative flex flex-col gap-3 pl-8">
              <h2 className="font-sans text-sm font-medium text-muted-foreground">{d.label}</h2>
              <ul className="flex flex-col gap-4">
                {d.lines.map((line) => (
                  <li key={line.text} className="relative flex flex-col gap-1.5">
                    <Dot colors={colorsOf(line.actors)} />
                    <p>{line.text.startsWith(DISCUSSED) ? <Discussed bookId={bookId} chapters={discussedChapters(d.events, props.toc)} /> : line.text}</p>
                    {line.quote && <blockquote className="line-clamp-3 text-lg leading-relaxed text-muted-foreground">&ldquo;{line.quote}&rdquo;</blockquote>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <p className="border-t pt-6 font-serif text-lg">{memoriesLine(props.events)}</p>
    </>
  );
}

// On the timeline's line; half and half when it was both of you.
function Dot({ colors }: { colors: string[] }) {
  const [a = 'var(--pencil)', b = a] = colors;
  return (
    <span
      aria-hidden
      className="absolute top-[6px] -left-8 size-3 rounded-full ring-4 ring-background"
      style={{ background: `linear-gradient(90deg, ${a} 50%, ${b} 50%)` }}
    />
  );
}

// Same wording as describeDay's line, with each chapter linking to its discussion.
function Discussed({ bookId, chapters }: { bookId: string; chapters: { spine: number; label: string }[] }) {
  let next = 0;
  return (
    <>
      {DISCUSSED}{' '}
      {chapterList.formatToParts(chapters.map((c) => c.label)).map((part, k) => {
        if (part.type === 'literal') return <Fragment key={k}>{part.value}</Fragment>;
        const { spine, label } = chapters[next++];
        return (
          <Link key={k} href={discussHref(bookId, spine)} className="underline underline-offset-4">
            {label}
          </Link>
        );
      })}
    </>
  );
}
