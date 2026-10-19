import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLearningLesson, LearningLesson, saveLessonProgress } from '../../API/Index';
import LessonPlayer from './LessonPlayer';

vi.mock('../../API/Index', () => ({ getLearningLesson: vi.fn(), saveLessonProgress: vi.fn() }));

const lesson: LearningLesson = {
  concept: { id: 'period', name: 'Reactor period', chunk_count: 9, document_count: 2, connectivity: 3, sources: [] },
  beats: [
    {
      key: 'core_idea',
      title: 'What is the reactor period?',
      content: 'The time for power to change by a factor of **e**.',
    },
    { key: 'how_it_works', title: 'Where does it come from?', content: 'Delayed neutrons set it.' },
    { key: 'application', title: 'Use it', content: '```\nτ ≈ (β − ρ) / (λ ρ)\n```' },
    { key: 'quick_check', title: 'Check yourself', content: '' },
  ],
  quick_check: {
    question: 'Which neutrons set the period?',
    options: ['Prompt', 'Delayed'],
    answer_index: 1,
    explanation: 'Delayed ones.',
  },
  sources: ['RTM.pdf'],
  cached: true,
};

const renderLesson = (initialBeat?: number) => {
  const props = {
    conceptId: 'period',
    initialBeat,
    onClose: vi.fn(),
    onAsk: vi.fn(),
    onQuiz: vi.fn(),
    onLoaded: vi.fn(),
    onSignIn: vi.fn(),
  };
  render(<LessonPlayer {...props} />);
  return props;
};

describe('LessonPlayer', () => {
  beforeEach(() => {
    vi.mocked(getLearningLesson).mockReset().mockResolvedValue(lesson);
    vi.mocked(saveLessonProgress).mockReset().mockResolvedValue(undefined);
  });

  it('shows a skeleton, then the step, and saves where the learner is', async () => {
    const props = renderLesson();
    expect(screen.getByLabelText('Writing this lesson')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'What is the reactor period?' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute('aria-valuenow', '1');
    await waitFor(() => expect(saveLessonProgress).toHaveBeenCalledWith('period', 0, 4));
    expect(props.onLoaded).toHaveBeenCalledWith('Reactor period');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Where does it come from?' })).toBeInTheDocument();
    await waitFor(() => expect(saveLessonProgress).toHaveBeenCalledWith('period', 1, 4));
  });

  it('resumes at the saved step and ends with Quiz me on the same concept', async () => {
    const props = renderLesson(3);
    expect(await screen.findByRole('heading', { name: 'Check yourself' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quiz me on it' }));
    expect(props.onQuiz).toHaveBeenCalledWith('period');
  });

  it('lets the quick check be answered before revealing, with words not just colour', async () => {
    renderLesson(3);
    const check = await screen.findByRole('button', { name: 'Check' });
    expect(check).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Prompt/ }));
    fireEvent.click(check);
    expect(screen.getByText('Not quite.')).toBeInTheDocument();
    expect(screen.getByText('Delayed ones.', { exact: false })).toBeInTheDocument();
  });

  it('says so when a concept has too few passages, and offers Ask', async () => {
    vi.mocked(getLearningLesson).mockRejectedValue({ response: { status: 409 } });
    const props = renderLesson();
    fireEvent.click(await screen.findByRole('button', { name: 'Ask instead' }));
    expect(props.onAsk).toHaveBeenCalledWith(expect.any(String), 'period');
  });

  it('asks about the step in the concept’s scope', async () => {
    const props = renderLesson();
    await screen.findByRole('heading', { name: 'What is the reactor period?' });
    fireEvent.click(screen.getByRole('button', { name: /most common mistake about Reactor period/ }));
    expect(props.onAsk).toHaveBeenCalledWith('What is the most common mistake about Reactor period?', 'period');
  });
});
