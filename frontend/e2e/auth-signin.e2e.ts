/** Signing in: the happy path, wrong passwords, and the five-strike lockout. */
import { expect, Page, test } from '@playwright/test';
import { createAccount, TestAccount, testEmail, testPassword } from './support/accounts';
import { API_URL } from './support/env';

const GENERIC_ERROR = 'Email or password is incorrect.';

async function submitSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('School email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test.describe('sign in', () => {
  let student: TestAccount;

  test.beforeAll(async () => {
    student = await createAccount('student', 'signin');
  });

  test('the right password opens the student path, and a reload keeps you signed in', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();

    await submitSignIn(page, student.email, student.password);

    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole('heading', { level: 1, name: /E2E\./ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('an admin lands on the admin area', async ({ page }) => {
    const admin = await createAccount('admin', 'signin-admin');
    await page.goto('/signin');

    await submitSignIn(page, admin.email, admin.password);

    await expect(page).toHaveURL(/\/admin$/);
  });

  test('a wrong password shows the generic error and warns about the lockout', async ({ page }) => {
    await page.goto('/signin');

    await submitSignIn(page, student.email, 'not-the-right-password');

    const alert = page.getByText(GENERIC_ERROR);
    await expect(alert).toBeVisible();
    await expect(page.getByText('After 5 tries, sign-in pauses for 15 minutes.')).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });

  test("an unknown email gets the same message, so it doesn't reveal who has an account", async ({ page }) => {
    await page.goto('/signin');

    await submitSignIn(page, testEmail('nobody'), testPassword());

    await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  });
});

test('five wrong passwords lock the account, even against the right password', async ({ page, request }) => {
  // A fresh account, because this test deliberately locks it for 15 minutes.
  const victim = await createAccount('student', 'lockout');
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request.post(`${API_URL}/auth/login`, {
      data: { email: victim.email, password: `wrong-password-${attempt}` },
    });
    expect(response.status()).toBe(401);
  }

  await page.goto('/signin');
  await submitSignIn(page, victim.email, victim.password);

  // Same wording as a wrong password: a locked account isn't announced either.
  await expect(page.getByText(GENERIC_ERROR)).toBeVisible();
  await expect(page.getByText('After 5 tries, sign-in pauses for 15 minutes.')).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);
});
