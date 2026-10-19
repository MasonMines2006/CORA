import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './returnTo';

describe('safeReturnTo', () => {
  it('keeps a path inside CORA', () => {
    expect(safeReturnTo('/student?view=ask')).toBe('/student?view=ask');
  });

  it.each([
    ['https://evil.example/phish'],
    ['//evil.example/phish'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    [''],
    [null],
  ])('refuses %s and falls back to the home path', (value) => {
    // Otherwise a link like /signin?returnTo=https://evil... would send
    // someone to a fake site right after they sign in for real.
    expect(safeReturnTo(value)).toBe('/student');
  });
});
