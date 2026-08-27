import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('px-2', 'text-sm')).toBe('px-2 text-sm');
  });

  it('drops falsy values and flattens arrays and objects', () => {
    expect(cn('px-2', false, null, undefined, ['gap-1', 'flex'], { hidden: false, 'py-1': true }))
      .toBe('px-2 gap-1 flex py-1');
  });

  it('keeps the last of conflicting tailwind utilities', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('returns an empty string with no usable input', () => {
    expect(cn()).toBe('');
    expect(cn(undefined, false)).toBe('');
  });
});
