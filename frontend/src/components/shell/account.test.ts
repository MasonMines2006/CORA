import { describe, expect, it } from 'vitest';
import { initialsFor } from './account';

describe('initialsFor', () => {
  it('uses first and last name', () => {
    expect(initialsFor('Jordan Lee Reyes')).toBe('JR');
    expect(initialsFor('mason')).toBe('M');
  });

  it('falls back to the email, then to a question mark', () => {
    expect(initialsFor(undefined, 'jr@university.edu')).toBe('J');
    expect(initialsFor('  ', '')).toBe('?');
  });
});
