import { describe, expect, it } from 'vitest';
import { groupSessions } from './sessionGroups';
import { SessionSummary } from './types';

const NOW = new Date('2026-10-21T15:00:00').getTime();
const HOUR = 60 * 60 * 1000;

const session = (id: string, hoursAgo: number): SessionSummary => ({
  id,
  mode: 'ask',
  title: id,
  updatedAt: NOW - hoursAgo * HOUR,
});

describe('groupSessions', () => {
  it('groups by calendar day, newest first, and skips empty groups', () => {
    const groups = groupSessions(
      [session('old', 24 * 30), session('a', 1), session('y', 20), session('w', 24 * 3)],
      NOW
    );
    expect(groups.map((group) => [group.label, group.items.map((item) => item.id)])).toEqual([
      ['Today', ['a']],
      ['Yesterday', ['y']],
      ['This week', ['w']],
      ['Earlier', ['old']],
    ]);
  });

  it('returns nothing for no sessions, so the sidebar can say so', () => {
    expect(groupSessions([], NOW)).toEqual([]);
  });
});
