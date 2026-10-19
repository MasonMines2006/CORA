import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearningMastery, LearningQuiz } from '../../API/Index';
import { initialQuizState } from './quizModel';
import QuizResults from './QuizResults';

const mastery = (attempts: number, correct: number, score: number): LearningMastery => ({
  concept_id: 'period',
  attempts,
  correct,
  score,
  difficulty: 'medium',
});

const quiz = (before: LearningMastery): LearningQuiz => ({
  quiz_id: 'q',
  concept: { id: 'period', name: 'Reactor period', chunk_count: 1, document_count: 1, connectivity: 1, sources: [] },
  difficulty: 'medium',
  mastery: before,
  questions: [{ id: '0', question: 'Q?', options: ['a', 'b'] }],
  sources: [],
  cached: false,
});

const renderResults = (before: LearningMastery, after: LearningMastery, isCorrect: boolean) => {
  const state = {
    ...initialQuizState(1),
    phase: 'results' as const,
    answers: [0],
    grade: {
      quiz_id: 'q',
      correct: isCorrect ? 1 : 0,
      total: 1,
      results: [
        {
          id: '0',
          selected_index: 0,
          correct_index: isCorrect ? 0 : 1,
          is_correct: isCorrect,
          explanation: 'Because.',
        },
      ],
      mastery: after,
    },
  };
  return render(
    <QuizResults
      outcome={{ quiz: quiz(before), state, seconds: 220 }}
      onClose={vi.fn()}
      onProgress={vi.fn()}
      onAsk={vi.fn()}
      onGuide={vi.fn()}
    />
  );
};

describe('QuizResults', () => {
  it('celebrates a real gain with the true delta', () => {
    const { container } = renderResults(mastery(5, 3, 60), mastery(6, 4, 66.7), true);
    expect(screen.getByRole('heading', { name: 'Reactor period: up 7 points.' })).toBeInTheDocument();
    expect(container.querySelector('.burst')).not.toBeNull();
    expect(screen.getByText('3:40')).toBeInTheDocument();
    expect(screen.getByText('You got every question right.')).toBeInTheDocument();
  });

  it('does not celebrate a falling session, and shows what was missed', () => {
    const { container } = renderResults(mastery(5, 3, 60), mastery(6, 3, 50), false);
    expect(screen.getByRole('heading', { name: 'Reactor period: down 10 points.' })).toBeInTheDocument();
    expect(container.querySelector('.burst')).toBeNull();
    expect(screen.getByRole('heading', { name: 'The one you missed' })).toBeInTheDocument();
    expect(screen.getByText('Because.')).toBeInTheDocument();
  });
});
