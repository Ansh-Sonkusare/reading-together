export type Question = { key: string; text: string };

export const QUESTIONS: readonly Question[] = [
  { key: 'decision', text: "What did you think about the main character's decision?" },
  { key: 'moment', text: 'Which moment from this chapter will stay with you?' },
  { key: 'next', text: 'What do you think happens next?' },
  { key: 'us', text: 'Did anything here remind you of us?' },
  { key: 'rewrite', text: 'If you could change one thing in this chapter, what would it be?' },
];

export const QUESTIONS_PER_CHAPTER = 3;

// Rotates through the list so consecutive chapters don't ask the same three; a spine always gets the same three.
export function questionsFor(spine: number): Question[] {
  return Array.from({ length: QUESTIONS_PER_CHAPTER }, (_, i) => QUESTIONS[(spine + i) % QUESTIONS.length]);
}
