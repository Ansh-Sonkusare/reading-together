import { describe, expect, it } from 'vitest';
import { discussHref, parseGuess, revealGuess } from './discussion';
import { questionsFor } from './questions';

describe('questionsFor', () => {
  it('gives each chapter three stable questions, rotating across chapters', () => {
    expect(questionsFor(0).map((q) => q.key)).toEqual(['decision', 'moment', 'next']);
    expect(questionsFor(3).map((q) => q.key)).toEqual(['us', 'rewrite', 'decision']);
    expect(questionsFor(5).map((q) => q.key)).toEqual(['decision', 'moment', 'next']);
    expect(questionsFor(3)).toEqual(questionsFor(3));
  });
});

describe('revealGuess', () => {
  it('same reaction, both guessed right', () => {
    expect(revealGuess({ mine: 'emotional', guessPartner: 'emotional' }, { mine: 'emotional', guessPartner: 'emotional' })).toEqual({
      same: true,
      iGuessedRight: true,
      theyGuessedRight: true,
    });
  });

  it('different reactions, only I guessed right', () => {
    expect(revealGuess({ mine: 'love', guessPartner: 'funny' }, { mine: 'funny', guessPartner: 'emotional' })).toEqual({
      same: false,
      iGuessedRight: true,
      theyGuessedRight: false,
    });
  });

  it('same reaction but both guessed wrong', () => {
    expect(revealGuess({ mine: 'meh', guessPartner: 'love' }, { mine: 'meh', guessPartner: 'funny' })).toEqual({
      same: true,
      iGuessedRight: false,
      theyGuessedRight: false,
    });
  });
});

describe('parseGuess', () => {
  it('accepts a stored guess and rejects anything else', () => {
    expect(parseGuess('{"mine":"love","guessPartner":"meh"}')).toEqual({ mine: 'love', guessPartner: 'meh' });
    expect(parseGuess('{"mine":"surprised","guessPartner":"meh"}')).toBe(null);
    expect(parseGuess('not json')).toBe(null);
  });
});

it('discussHref', () => {
  expect(discussHref('b1', 2)).toBe('/discuss/b1/2');
});
