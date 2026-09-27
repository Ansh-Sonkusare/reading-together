import type { Enums } from '@/lib/types';
import type { Toc } from '../reader';
import { chapterTitle } from './discussion';

export type TimelineEvent = {
  type: Enums<'event_type'>;
  actorId: string;
  createdAt: string;
  data: { spine?: number; kind?: string };
  // The event's mark, when RLS lets the viewer read it.
  mark?: { kind: Enums<'mark_kind'>; emoji: string | null; cfi: string | null; quote?: string | null } | null;
};
/** One timeline entry: its sentence, who it's about (for their ink dots), and a passage it points at, if any. */
export type TimelineLine = { text: string; actors: string[]; quote?: string };
export type TimelineMember = { userId: string; name: string };
export type TimelineDay = { key: string; label: string; events: TimelineEvent[] };

const MARK_LINES: Partial<Record<Enums<'mark_kind'>, [emoji: string, verb: string, one: string, many: string]>> = {
  highlight: ['❤️', 'highlighted', 'passage', 'passages'],
  note: ['📝', 'left', 'note', 'notes'],
  reply: ['💬', 'wrote', 'reply', 'replies'],
  bookmark: ['🔖', 'bookmarked', 'passage', 'passages'],
  send: ['💌', 'shared', 'passage', 'passages'],
  memory: ['📸', 'added', 'memory', 'memories'],
};

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

const qty = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`);
const emojiOf = (emoji: string | null) => emoji ?? '💭';

export const DISCUSSED = '💬 You discussed';

export const chapterList = new Intl.ListFormat('en', { type: 'conjunction' });

// Chapters discussed that day, by TOC label; a spine without one (front matter) is left out.
export function discussedChapters(events: TimelineEvent[], toc: Toc | null): { spine: number; label: string }[] {
  const spines = events.filter((e) => e.type === 'answer_revealed' && e.data.kind === 'question' && e.data.spine !== undefined).map((e) => e.data.spine!);
  return [...new Set(spines)]
    .sort((a, b) => a - b)
    .map((spine) => ({ spine, label: chapterTitle(toc, spine) }))
    .filter((c): c is { spine: number; label: string } => c.label !== null);
}

export function describeDay(events: TimelineEvent[], members: TimelineMember[], meId: string, title: string, toc: Toc | null): TimelineLine[] {
  const subject = (group: TimelineEvent[]) => {
    const actors = new Set(group.map((e) => e.actorId));
    if (actors.size > 1) return 'You both';
    const [id] = actors;
    return id === meId ? 'You' : (members.find((m) => m.userId === id)?.name ?? 'Your partner');
  };
  const ofType = (t: TimelineEvent['type']) => events.filter((e) => e.type === t);
  const lines: TimelineLine[] = [];
  const push = (text: string, group: TimelineEvent[] | 'both', quoted = false) => {
    const quote = quoted && group !== 'both' ? group.find((e) => e.mark?.quote)?.mark?.quote : null;
    const actors = group === 'both' ? members.map((m) => m.userId) : [...new Set(group.map((e) => e.actorId))];
    lines.push({ text, actors, ...(quote && { quote }) });
  };

  const started = ofType('book_started');
  if (started.length) {
    const s = subject(started);
    push(s === 'You both' ? `📖 Started ${title}` : `📖 ${s} started ${title}`, started);
  }

  const marks = ofType('mark_created').filter((e) => e.mark);
  for (const [kind, [emoji, verb, one, many]] of Object.entries(MARK_LINES)) {
    const group = marks.filter((e) => e.mark!.kind === kind);
    if (group.length) push(`${emoji} ${subject(group)} ${verb} ${qty(group.length, one, many)}`, group, kind !== 'reply');
  }

  const reactions = marks.filter((e) => e.mark!.kind === 'reaction');
  const byPassage = Map.groupBy(reactions, (e) => e.mark!.cfi ?? e);
  const shared = [...byPassage.values()].filter((g) => subject(g) === 'You both');
  if (shared.length) {
    const passage = shared.length === 1 ? 'the same passage' : `the same ${shared.length} passages`;
    push(`${emojiOf(shared[0][0].mark!.emoji)} You both reacted to ${passage}`, shared.flat(), true);
  }
  const solo = reactions.filter((e) => !shared.some((g) => g.includes(e)));
  if (solo.length) {
    push(`${emojiOf(solo[0].mark!.emoji)} ${subject(solo)} reacted to ${qty(solo.length, 'passage', 'passages')}`, solo, true);
  }

  const revealed = ofType('answer_revealed');
  const discussed = discussedChapters(events, toc);
  if (discussed.length) push(`${DISCUSSED} ${chapterList.format(discussed.map((c) => c.label))}`, 'both');
  const guesses = revealed.filter((e) => e.data.kind === 'guess').length;
  if (guesses) push(`🎯 You guessed each other's reaction${guesses === 1 ? '' : ` ${guesses} times`}`, 'both');

  const finished = ofType('book_finished');
  if (finished.length) {
    const s = subject(finished);
    push(s === 'You both' ? '📚 Finished the book together' : `📚 ${s} finished the book`, finished);
  }
  return lines;
}

export function groupByDay(events: TimelineEvent[], timeZone: string): TimelineDay[] {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const days = Map.groupBy(events, (e) => format.format(new Date(e.createdAt)));
  return [...days].map(([key, dayEvents]) => {
    const [, month, day] = key.split('-').map(Number);
    return { key, label: `${MONTHS[month - 1]} ${day}`, events: dayEvents };
  });
}

export function memoriesLine(events: TimelineEvent[]): string {
  const n = events.filter((e) => e.type === 'mark_created' || e.type === 'answer_revealed').length;
  return `❤️ ${n} ${n === 1 ? 'memory' : 'memories'} created`;
}
