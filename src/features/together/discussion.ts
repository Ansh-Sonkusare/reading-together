import type { Toc } from '../reader';
import { REACTIONS } from '../marks/model';

export const discussHref = (bookId: string, spine: number) => `/discuss/${bookId}/${spine}`;

// The TOC entry at or before `spine` names it; null is front matter, which gets no prompt, discussion or push.
// A book uploaded before TOCs were stored (toc null) keeps the old numbering.
export function chapterTitle(toc: Toc | null, spine: number): string | null {
  if (!toc) return `Chapter ${spine + 1}`;
  return toc.findLast((e) => e.spine <= spine)?.label ?? null;
}

export const guessKey = (spine: number) => `guess:${spine}`;

const fromMarks = (key: 'love' | 'funny' | 'emotional') => {
  const r = REACTIONS.find((x) => x.key === key)!;
  return { key, emoji: r.emoji, label: r.label };
};

// The four from docs/idea.md: three mark reactions plus a shrug that only exists in this game.
export const GUESS_OPTIONS = [
  fromMarks('love'),
  fromMarks('funny'),
  fromMarks('emotional'),
  { key: 'meh', emoji: '😐', label: "Didn't care" },
] as const;

export type GuessReaction = (typeof GUESS_OPTIONS)[number]['key'];
export type Guess = { mine: GuessReaction; guessPartner: GuessReaction };
export type GuessReveal = { same: boolean; iGuessedRight: boolean; theyGuessedRight: boolean };

export const emojiOf = (r: GuessReaction) => GUESS_OPTIONS.find((o) => o.key === r)!.emoji;

const isReaction = (v: unknown): v is GuessReaction => GUESS_OPTIONS.some((o) => o.key === v);

export function parseGuess(value: string): Guess | null {
  try {
    const v = JSON.parse(value);
    return isReaction(v?.mine) && isReaction(v?.guessPartner) ? { mine: v.mine, guessPartner: v.guessPartner } : null;
  } catch {
    return null;
  }
}

export function revealGuess(me: Guess, partner: Guess): GuessReveal {
  return {
    same: me.mine === partner.mine,
    iGuessedRight: me.guessPartner === partner.mine,
    theyGuessedRight: partner.guessPartner === me.mine,
  };
}
