/**
 * Guided Learning and Adaptive Assessment, end to end:
 * Path → Lesson (4 steps + quick check) → Quiz → Results.
 *
 * The path, concepts and lesson-progress saves are real; only the model-written
 * lesson and quiz are mocked (see support/llmMocks.ts).
 */
import { expect, test } from '@playwright/test';
import { createAccount, TestAccount } from './support/accounts';
import { MOCK_QUIZ, mockLesson, mockQuiz } from './support/llmMocks';
import { signInAs } from './support/session';

let student: TestAccount;

test.beforeAll(async () => {
  student = await createAccount('student', 'guided');
});

test('Path → Lesson → Quiz → Results', async ({ page }) => {
  await mockLesson(page);
  const quiz = await mockQuiz(page);
  await signInAs(page, student);

  // Path: the real dashboard suggests where to start.
  await page.goto('/student');
  const suggested = page.getByRole('region').filter({ hasText: 'Suggested next' });
  const conceptName = (await suggested.getByRole('heading', { level: 2 }).textContent())?.trim() ?? '';
  expect(conceptName).not.toBe('');

  // Lesson: four steps. Each step is saved to the real backend.
  const progressSaved = page.waitForResponse(
    (response) => response.request().method() === 'PUT' && /\/learning\/lesson\/.+\/progress$/.test(response.url())
  );
  await suggested.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page).toHaveURL(/view=lesson/);
  await expect(page.getByText(`${conceptName} · Guided`)).toBeVisible();
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Core idea' })).toBeVisible();
  expect((await progressSaved).status()).toBe(204);

  for (const step of ['How it works', 'In the material', 'Quick check']) {
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: step })).toBeVisible();
  }
  await expect(page.getByText('Step 4 of 4')).toBeVisible();

  // Quick check: instant feedback, in words (not only colour).
  await page.getByRole('radio', { name: 'Negative' }).click();
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('Correct.')).toBeVisible();

  // Quiz: two questions, graded together after the last one.
  await page.getByRole('button', { name: 'Quiz me on it' }).click();
  await expect(page).toHaveURL(/view=quiz/);
  await expect(page.getByRole('heading', { level: 1, name: MOCK_QUIZ[0].question })).toBeVisible();
  await expect(page.getByText("You'll see how you did after the last question.")).toBeVisible();

  await page.getByRole('radio', { name: MOCK_QUIZ[0].options[0] }).click(); // right
  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByRole('heading', { level: 1, name: MOCK_QUIZ[1].question })).toBeVisible();
  await page.getByRole('radio', { name: MOCK_QUIZ[1].options[0] }).click(); // wrong
  await page.getByRole('button', { name: 'Check answers' }).click();

  // The app sends the learner's choices, in order.
  await expect.poll(() => quiz.gradedAnswers()).toEqual([0, 0]);

  // Feedback for each question in turn, then Results.
  await expect(page.getByText('Correct.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('radio', { name: `${MOCK_QUIZ[1].options[1]} (correct answer)` })).toBeVisible();
  await page.getByRole('button', { name: /^(Continue|See results)/ }).click();

  await expect(page).toHaveURL(/view=results/);
  // Mastery went from 0% to 50% (1 of 2 right), and the headline says so.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${conceptName}: up 50 points.`);
  await expect(page.getByText(MOCK_QUIZ[1].question)).toBeVisible();
});

test('leaving a lesson saves your place, and the path offers to pick it up', async ({ page }) => {
  // A fresh learner, so the path starts at "Suggested next" whatever ran before.
  const learner = await createAccount('student', 'resume');
  await mockLesson(page);
  await signInAs(page, learner);
  await page.goto('/student');

  await page.getByRole('button', { name: 'Start lesson' }).click();
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  // Listen before clicking, so a fast save can't finish before we start waiting.
  const stepTwoSaved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith('/progress') &&
      response.request().postDataJSON()?.beat_index === 1
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  // The real backend stored step 2 (index 1).
  expect((await stepTwoSaved).status()).toBe(204);
  await page.getByRole('button', { name: 'Leave lesson and return to your path' }).click();

  // Back on the path, after a fresh dashboard load from the server.
  await page.reload();
  const resume = page.getByRole('region').filter({ hasText: 'Pick up where you left off' });
  await expect(resume).toContainText('Step 2 of 4');
  await resume.getByRole('button', { name: 'Continue lesson' }).click();
  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'How it works' })).toBeVisible();
});
