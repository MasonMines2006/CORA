import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getReviewQueue, gradeReviewCard, ReviewCard } from '../../API/Index';
import ReviewSession from './ReviewSession';

vi.mock('../../API/Index', () => ({
  getReviewQueue: vi.fn(),
  gradeReviewCard: vi.fn(),
}));

const card = (id: string, prompt: string): ReviewCard => ({
  card_id: id,
  concept_id: 'Reactivity',
  concept_name: 'Reactivity',
  prompt,
  answer: 'Zero. A critical reactor has a reactivity of zero.',
  source: 'Theory Manual - NE235.pdf',
  state: 'review',
  last_reviewed_at: null,
  due_at: null,
  intervals: { again: 60, hard: 2 * 86400, good: 5 * 86400, easy: 12 * 86400 },
});

describe('ReviewSession', () => {
  beforeEach(() => {
    vi.mocked(getReviewQueue)
      .mockReset()
      .mockResolvedValue({
        due_count: 2,
        new_count: 0,
        cards: [card('a', 'What is the reactivity of a critical reactor?'), card('b', 'What is Keff?')],
      });
    vi.mocked(gradeReviewCard)
      .mockReset()
      .mockResolvedValue({ card_id: 'a', due_at: '2026-09-24T00:00:00Z', interval_seconds: 432000, state: 'review' });
  });

  it('hides the answer until asked, then shows every grade with the interval it schedules', async () => {
    render(<ReviewSession showRail onFindCards={vi.fn()} />);

    expect(
      await screen.findByRole('heading', { name: 'What is the reactivity of a critical reactor?' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/A critical reactor has a reactivity of zero/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByText(/A critical reactor has a reactivity of zero/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Again\s*< 1 min/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Good\s*5 days/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy\s*12 days/ })).toBeInTheDocument();
  });

  it('saves the grade, then moves on and counts the card as known', async () => {
    render(<ReviewSession showRail onFindCards={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /Good/ }));

    expect(await screen.findByRole('heading', { name: 'What is Keff?' })).toBeInTheDocument();
    expect(vi.mocked(gradeReviewCard)).toHaveBeenCalledWith('a', 'good');
    expect(screen.getByText('known').previousSibling).toHaveTextContent('1');
  });

  it('keeps the card on screen when the grade fails to save', async () => {
    vi.mocked(gradeReviewCard).mockReset().mockRejectedValue(new Error('offline'));
    render(<ReviewSession onFindCards={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /show answer/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hard/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not saved/i);
    expect(screen.getByRole('heading', { name: 'What is the reactivity of a critical reactor?' })).toBeInTheDocument();
  });

  it('points a student with no cards at the lesson that makes them', async () => {
    vi.mocked(getReviewQueue).mockReset().mockResolvedValue({ due_count: 0, new_count: 0, cards: [] });
    const onFindCards = vi.fn();
    render(<ReviewSession conceptId='Reactivity' conceptName='Reactivity' onFindCards={onFindCards} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open the lesson' }));
    expect(onFindCards).toHaveBeenCalled();
    await waitFor(() => expect(vi.mocked(getReviewQueue)).toHaveBeenCalledWith('Reactivity', expect.anything()));
  });
});
