import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateLearningQuiz, gradeLearningQuiz, LearningQuiz, QuizGrade } from '../../API/Index';
import QuizPlayer from './QuizPlayer';

vi.mock('../../API/Index', () => ({ generateLearningQuiz: vi.fn(), gradeLearningQuiz: vi.fn() }));

const quiz: LearningQuiz = {
  quiz_id: 'q-1',
  concept: { id: 'period', name: 'Reactor period', chunk_count: 9, document_count: 2, connectivity: 3, sources: [] },
  difficulty: 'medium',
  mastery: { concept_id: 'period', attempts: 5, correct: 3, score: 60, difficulty: 'medium' },
  questions: [
    { id: '0', question: 'After a scram the stable period is about?', options: ['−8 s', '−80 s', '−180 s', '−800 s'] },
    { id: '1', question: 'What sets the period for a small insertion?', options: ['ℓ*', 'λeff', 'β', 'k∞'] },
  ],
  sources: ['RTM.pdf', 'NE235_L07.pdf'],
  cached: false,
};

const grade: QuizGrade = {
  quiz_id: 'q-1',
  correct: 1,
  total: 2,
  results: [
    { id: '0', selected_index: 1, correct_index: 1, is_correct: true, explanation: 'The longest-lived group sets it.' },
    { id: '1', selected_index: 0, correct_index: 1, is_correct: false, explanation: 'Delayed neutrons dominate.' },
  ],
  mastery: { concept_id: 'period', attempts: 7, correct: 4, score: 57.1, difficulty: 'medium' },
};

const renderPlayer = () => {
  const props = {
    conceptId: 'period',
    onClose: vi.fn(),
    onAsk: vi.fn(),
    onGuide: vi.fn(),
    onLoaded: vi.fn(),
    onFinished: vi.fn(),
    onSignIn: vi.fn(),
  };
  render(<QuizPlayer {...props} />);
  return props;
};

const nextButton = () => screen.getByRole('button', { name: /next question|check answers/i });

describe('QuizPlayer', () => {
  beforeEach(() => {
    vi.mocked(generateLearningQuiz).mockReset().mockResolvedValue(quiz);
    vi.mocked(gradeLearningQuiz).mockReset().mockResolvedValue(grade);
  });

  it('shows skeleton options while writing, then the question with a difficulty that explains itself', async () => {
    const props = renderPlayer();
    expect(screen.getByLabelText('Writing your questions')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: quiz.questions[0].question })).toBeInTheDocument();
    expect(screen.getByText('· picked from your 60% mastery')).toBeInTheDocument();
    await waitFor(() => expect(props.onLoaded).toHaveBeenCalledWith('Reactor period'));
  });

  it('chooses with 1–4 and moves on with Enter, only once something is chosen', async () => {
    renderPlayer();
    await screen.findByRole('radiogroup');
    expect(nextButton()).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: '2' });
    expect(screen.getByRole('radio', { name: /−80 s/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('grades every answer at once, walks through feedback, then hands over the outcome', async () => {
    const props = renderPlayer();
    await screen.findByRole('radiogroup');
    fireEvent.click(screen.getByRole('radio', { name: /−80 s/ }));
    fireEvent.click(nextButton());
    fireEvent.click(screen.getByRole('radio', { name: /ℓ\*/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(await screen.findByText('Correct.')).toBeInTheDocument();
    expect(gradeLearningQuiz).toHaveBeenCalledWith('q-1', [1, 0]);
    expect(screen.getByRole('radio', { name: /−80 s.*correct answer/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Not quite. It is “λeff”.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /ℓ\*.*your answer, incorrect/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(props.onFinished).toHaveBeenCalled());
    expect(props.onFinished.mock.calls[0][0].state.grade).toEqual(grade);
  });

  it('keeps the answers when grading fails and retries with the same ones', async () => {
    vi.mocked(gradeLearningQuiz).mockRejectedValueOnce(new Error('Network Error'));
    renderPlayer();
    await screen.findByRole('radiogroup');
    fireEvent.keyDown(document, { key: '1' });
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: '3' });
    fireEvent.keyDown(document, { key: 'Enter' });

    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    await screen.findByText('Correct.');
    expect(gradeLearningQuiz).toHaveBeenNthCalledWith(2, 'q-1', [0, 2]);
  });

  it('offers the other two ways in when there is not enough material', async () => {
    vi.mocked(generateLearningQuiz).mockRejectedValue({ response: { status: 409 } });
    const props = renderPlayer();
    fireEvent.click(await screen.findByRole('button', { name: 'Guide me instead' }));
    expect(props.onGuide).toHaveBeenCalledWith('period');
  });

  it('leaves Enter to a focused button instead of checking the quiz', async () => {
    renderPlayer();
    await screen.findByRole('radiogroup');
    fireEvent.keyDown(document, { key: '1' });
    const close = screen.getByRole('button', { name: 'End quiz and return to your path' });
    fireEvent.keyDown(close, { key: 'Enter' });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('routes "I don’t know yet" to Ask about the question', async () => {
    const props = renderPlayer();
    await screen.findByRole('radiogroup');
    fireEvent.click(screen.getByRole('button', { name: /i don.t know yet/i }));
    expect(props.onAsk).toHaveBeenCalledWith(expect.stringContaining(quiz.questions[0].question), 'period');
  });
});
