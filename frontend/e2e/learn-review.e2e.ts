/** Spaced review: reveal a card, grade it, and finish the session. */
import { expect, test } from '@playwright/test';
import { createAccount, TestAccount } from './support/accounts';
import { mockReview } from './support/llmMocks';
import { signInAs } from './support/session';

let student: TestAccount;

test.beforeAll(async () => {
  student = await createAccount('student', 'review');
});

test('Review: show each answer, grade it, and finish the session', async ({ page }) => {
  const review = await mockReview(page, 2);
  await signInAs(page, student);
  await page.goto('/student');

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Review' }).click();
  await expect(page).toHaveURL(/view=review/);
  await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible();
  await expect(page.getByText('1 / 2')).toBeVisible();

  // Card 1: the answer is hidden until asked for, then graded "Good".
  await expect(page.getByRole('heading', { name: /^Review prompt 1/ })).toBeVisible();
  await expect(page.getByText(/^Answer 1:/)).toHaveCount(0);
  await page.getByRole('button', { name: /^Show answer/ }).click();
  await expect(page.getByText(/^Answer 1:/)).toBeVisible();
  await page.getByRole('button', { name: /^Good/ }).click();

  // Card 2: graded "Again" with the keyboard shortcut (1–4). "Again" means
  // "I didn't know it", so the card comes back later in the same session.
  await expect(page.getByRole('heading', { name: /^Review prompt 2/ })).toBeVisible();
  await page.getByRole('button', { name: /^Show answer/ }).click();
  await page.keyboard.press('1');
  await expect(page.getByText('3 / 3')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Review prompt 2/ })).toBeVisible();

  // Second try at card 2: "Good" (key 3) ends the session.
  await page.getByRole('button', { name: /^Show answer/ }).click();
  await page.keyboard.press('3');

  await expect(page.getByText(/known, \d+ shaky/)).toBeVisible();
  expect(review.grades).toEqual([
    { card_id: 'e2e-card-1', grade: 'good' },
    { card_id: 'e2e-card-2', grade: 'again' },
    { card_id: 'e2e-card-2', grade: 'good' },
  ]);
});

test('Review with nothing due says so', async ({ page }) => {
  await mockReview(page, 0);
  await signInAs(page, student);

  await page.goto('/student?view=review');

  await expect(page.getByRole('heading', { name: 'All caught up' })).toBeVisible();
});
