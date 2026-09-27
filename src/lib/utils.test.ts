import { expect, it } from 'vitest';
import { cn } from './utils';

it('merges class names correctly', () => {
  expect(cn('a', false && 'b', 'c')).toBe('a c');
});
