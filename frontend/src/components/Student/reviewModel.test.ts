import { describe, expect, it } from 'vitest';
import { ReviewCard } from '../../API/Index';
import { afterGrade, lastSeenLabel, timeLeftLabel } from './reviewModel';

const card = (id: string): ReviewCard => ({
  card_id: id,
  concept_id: 'Reactivity',
  concept_name: 'Reactivity',
  prompt: `Prompt ${id}`,
  answer: 'Answer',
  source: 'Theory Manual - NE235.pdf',
  state: 'review',
  last_reviewed_at: null,
  due_at: null,
  intervals: { again: 60, hard: 86400, good: 432000, easy: 1036800 },
});

describe('afterGrade', () => {
  const start = { queue: [card('a'), card('b'), card('c')], known: 0, shaky: 0 };

  it('moves to the next card and counts good or easy as known', () => {
    const next = afterGrade(start, 'good');
    expect(next.queue.map((item) => item.card_id)).toEqual(['b', 'c']);
    expect(next.known).toBe(1);
    expect(next.shaky).toBe(0);
  });

  it('counts hard as shaky but still lets the card go', () => {
    const next = afterGrade(start, 'hard');
    expect(next.queue.map((item) => item.card_id)).toEqual(['b', 'c']);
    expect(next.shaky).toBe(1);
  });

  it('sends a card graded again to the back of this session, so it comes round once more', () => {
    const next = afterGrade(start, 'again');
    expect(next.queue.map((item) => item.card_id)).toEqual(['b', 'c', 'a']);
    expect(next.shaky).toBe(1);
  });

  it('does not mutate the session it was given', () => {
    afterGrade(start, 'again');
    expect(start.queue.map((item) => item.card_id)).toEqual(['a', 'b', 'c']);
  });
});

describe('timeLeftLabel', () => {
  it('estimates from the cards left, in words a student can plan around', () => {
    expect(timeLeftLabel(0)).toBe('done');
    expect(timeLeftLabel(1)).toBe('under a minute left');
    expect(timeLeftLabel(7)).toBe('about 3 min left');
  });
});

describe('lastSeenLabel', () => {
  const now = new Date('2026-09-19T12:00:00Z');

  it('calls a never-reviewed card new', () => {
    expect(lastSeenLabel(null, now)).toBe('new card');
  });

  it('says how long ago a card was last reviewed', () => {
    expect(lastSeenLabel('2026-09-19T11:58:00Z', now)).toBe('last seen just now');
    expect(lastSeenLabel('2026-09-19T09:00:00Z', now)).toBe('last seen 3 hours ago');
    expect(lastSeenLabel('2026-09-16T12:00:00Z', now)).toBe('last seen 3 days ago');
  });
});
