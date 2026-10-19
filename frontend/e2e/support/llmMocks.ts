/**
 * Stand-ins for the endpoints that call a language model.
 *
 * Why mock: these endpoints cost money per call, and their answers change from
 * run to run, so a test that used them would be slow, flaky and billed. Every
 * other request (sign-in, the dashboard, lesson progress, sources) still goes
 * to the real backend, so the tests still prove the app and server work
 * together. One opt-in test (real-llm-smoke.e2e.ts) calls the real model.
 *
 * The response shapes copy the backend's Pydantic models in
 * backend/src/learning/models.py and review_models.py. If those change, these
 * mocks must change too, or the tests will pass against a shape the server no
 * longer sends.
 */
import type { Page, Request } from '@playwright/test';

export const MOCK_SOURCE = 'Theory Manual - NE235.pdf';

/** The answer text the mocked chat returns, so a test can find it in the response. */
export const MOCK_CHAT_ANSWER =
  'A neutron reflector surrounds the core and scatters escaping neutrons back into it, which lowers leakage.';

const mockConcept = (id: string) => ({
  id,
  name: id,
  chunk_count: 3,
  document_count: 1,
  connectivity: 4,
  sources: [MOCK_SOURCE],
});

/** The concept id at the end of a URL like /api/learning/lesson/Decay%20heat. */
const conceptIdFrom = (request: Request, marker: string): string =>
  decodeURIComponent(new URL(request.url()).pathname.split(marker)[1] ?? '');

/** GET /learning/lesson/{concept}: a four-beat lesson ending in a quick check. */
export async function mockLesson(page: Page): Promise<void> {
  await page.route('**/api/learning/lesson/**', async (route) => {
    // PUT /learning/lesson/{concept}/progress has no model in it: let it reach the real server.
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }
    const conceptId = conceptIdFrom(route.request(), '/learning/lesson/');
    await route.fulfill({
      json: {
        concept: mockConcept(conceptId),
        beats: [
          { key: 'core_idea', title: 'Core idea', content: 'Reactivity measures how far the core is from critical.' },
          { key: 'how_it_works', title: 'How it works', content: 'Rods add negative reactivity as they insert.' },
          { key: 'application', title: 'In the material', content: 'PULSTAR scrams by dropping all four rods.' },
          { key: 'quick_check', title: 'Quick check', content: 'Check your understanding.' },
        ],
        quick_check: {
          question: 'Inserting a control rod adds which kind of reactivity?',
          options: ['Negative', 'Positive'],
          answer_index: 0,
          explanation: 'The rod absorbs neutrons, so keff falls.',
        },
        sources: [MOCK_SOURCE],
        cached: false,
      },
    });
  });
}

/** Questions for the mocked quiz. The first option is right for Q1, the second for Q2. */
export const MOCK_QUIZ = [
  {
    question: 'What happens to keff when a control rod is inserted?',
    options: ['It falls', 'It rises', 'It stays at 1', 'It doubles'],
    correctIndex: 0,
  },
  {
    question: 'Which heat source remains after a scram?',
    options: ['Fission heat', 'Decay heat', 'Pump heat', 'None'],
    correctIndex: 1,
  },
];

/**
 * POST /learning/quiz/generate and /learning/quiz/grade.
 *
 * Both are mocked together: the real grader looks the quiz up by id in
 * Postgres, and a mocked quiz was never saved there. The grade mock marks the
 * learner's answers against MOCK_QUIZ, so it behaves like the real grader.
 */
export async function mockQuiz(page: Page): Promise<{ gradedAnswers: () => number[] | null }> {
  let gradedAnswers: number[] | null = null;
  let conceptId = '';

  await page.route('**/api/learning/quiz/generate', async (route) => {
    conceptId = (route.request().postDataJSON() as { concept_id: string }).concept_id;
    await route.fulfill({
      json: {
        quiz_id: 'e2e-quiz',
        concept: mockConcept(conceptId),
        difficulty: 'easy',
        mastery: { concept_id: conceptId, attempts: 0, correct: 0, score: 0, difficulty: 'easy' },
        questions: MOCK_QUIZ.map((question, index) => ({
          id: String(index),
          question: question.question,
          options: question.options,
        })),
        sources: [MOCK_SOURCE],
        cached: false,
      },
    });
  });

  await page.route('**/api/learning/quiz/grade', async (route) => {
    const answers = (route.request().postDataJSON() as { answers: number[] }).answers;
    gradedAnswers = answers;
    const results = MOCK_QUIZ.map((question, index) => ({
      id: String(index),
      selected_index: answers[index],
      correct_index: question.correctIndex,
      is_correct: answers[index] === question.correctIndex,
      explanation: `Explanation for question ${index + 1}.`,
    }));
    const correct = results.filter((result) => result.is_correct).length;
    await route.fulfill({
      json: {
        quiz_id: 'e2e-quiz',
        correct,
        total: results.length,
        results,
        mastery: {
          concept_id: conceptId,
          attempts: results.length,
          correct,
          // Mastery scores are percentages (0-100), like service.mastery_from_row.
          score: Math.round((correct / results.length) * 1000) / 10,
          difficulty: 'medium',
        },
      },
    });
  });

  return { gradedAnswers: () => gradedAnswers };
}

/**
 * POST /chat_bot: a grounded answer with one source document and two passages,
 * in the `{status, data: {message, info}}` envelope the real endpoint uses.
 */
export async function mockChat(page: Page): Promise<void> {
  await page.route('**/api/chat_bot', (route) =>
    route.fulfill({
      json: {
        status: 'Success',
        message: 'Chat response',
        data: {
          session_id: 'e2e-session',
          message: MOCK_CHAT_ANSWER,
          info: {
            sources: [MOCK_SOURCE],
            model: 'e2e-mock',
            nodedetails: { chunkdetails: [{ id: 'chunk-1', score: 0.91 }, { id: 'chunk-2', score: 0.84 }] },
            error: '',
          },
        },
      },
    })
  );
}

const reviewCard = (n: number) => ({
  card_id: `e2e-card-${n}`,
  concept_id: 'Decay heat',
  concept_name: 'Decay heat',
  prompt: `Review prompt ${n}: why must cooling continue after a scram?`,
  answer: `Answer ${n}: fission products keep releasing decay heat.`,
  source: MOCK_SOURCE,
  state: 'new',
  last_reviewed_at: null,
  due_at: null,
  intervals: { again: 60, hard: 600, good: 86_400, easy: 345_600 },
});

/**
 * GET /learning/review/queue and POST /learning/review/grade.
 *
 * The real queue writes flashcards with the model the first time a lesson's
 * cards are needed, so it is mocked. Grades are recorded so the test can check
 * what the app sent.
 */
export async function mockReview(page: Page, cardCount = 2): Promise<{ grades: { card_id: string; grade: string }[] }> {
  const grades: { card_id: string; grade: string }[] = [];
  await page.route('**/api/learning/review/queue**', (route) =>
    route.fulfill({
      json: {
        due_count: 0,
        new_count: cardCount,
        cards: Array.from({ length: cardCount }, (_, index) => reviewCard(index + 1)),
      },
    })
  );
  await page.route('**/api/learning/review/grade', async (route) => {
    const body = route.request().postDataJSON() as { card_id: string; grade: string };
    grades.push(body);
    await route.fulfill({
      json: {
        card_id: body.card_id,
        due_at: new Date(Date.now() + 86_400_000).toISOString(),
        interval_seconds: 86_400,
        state: 'review',
      },
    });
  });
  return { grades };
}
