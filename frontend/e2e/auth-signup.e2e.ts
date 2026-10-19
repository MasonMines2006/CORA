/**
 * Getting an account: through an admin's invite link, or (only while an admin
 * has open enrollment on) by registering yourself.
 */
import { expect, test } from '@playwright/test';
import {
  apiJson,
  apiLogin,
  createAccount,
  createInviteToken,
  SessionResponse,
  testEmail,
  testPassword,
} from './support/accounts';
import { API_URL } from './support/env';

test.describe('sign-up with an invite link', () => {
  test('creates a student account and lands on the path', async ({ page }) => {
    // Arrange: an admin-style invite, made by the backend CLI.
    const email = testEmail('invitee');
    const token = createInviteToken(email, 'student');

    // Act
    await page.goto(`/join/${token}`);
    await expect(page.getByRole('heading', { name: 'Join CORA.' })).toBeVisible();
    // The email comes from the invite and can't be changed.
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await expect(page.getByLabel('Email')).not.toBeEditable();
    await page.getByLabel('Your name').fill('Ada Invitee');
    await page.getByLabel('Choose a password', { exact: true }).fill(testPassword());
    await page.getByRole('button', { name: 'Create account' }).click();

    // Assert: signed in, as a student, on the path.
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole('heading', { level: 1, name: /Ada\./ })).toBeVisible();
  });

  test('an invite link works only once', async ({ page }) => {
    const email = testEmail('once');
    const token = createInviteToken(email, 'student');
    await apiJson(`/auth/invites/${token}/accept`, { body: { name: 'First Use', password: testPassword() } });

    await page.goto(`/join/${token}`);

    await expect(page.getByRole('heading', { name: "This invite doesn't work." })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('open enrollment', () => {
  let adminToken = '';
  let enrollmentBefore = false;

  const setEnrollment = (open: boolean) =>
    apiJson('/admin/settings/enrollment', { method: 'PUT', token: adminToken, body: { open_enrollment: open } });

  test.beforeAll(async () => {
    const admin = await createAccount('admin', 'enrollment-admin');
    adminToken = (await apiLogin(admin)).token;
    const current = await apiJson<{ open_enrollment: boolean }>('/admin/settings/enrollment', {
      method: 'GET',
      token: adminToken,
    });
    enrollmentBefore = current.open_enrollment;
  });

  // The switch is global, so put it back however the run ends.
  test.afterAll(async () => {
    await setEnrollment(enrollmentBefore);
  });

  test('off: /join says CORA is invite-only and the server refuses sign-ups', async ({ page, request }) => {
    await setEnrollment(false);

    await page.goto('/join');
    await expect(page.getByRole('heading', { name: 'CORA is invite-only.' })).toBeVisible();
    await expect(page.getByLabel('School email')).toHaveCount(0);

    await page.goto('/signin');
    await expect(page.getByRole('link', { name: 'Join with your invite' })).toBeVisible();

    // The page hiding the form isn't the protection; the server is.
    const response = await request.post(`${API_URL}/auth/register`, {
      data: { email: testEmail('blocked'), name: 'Blocked', password: testPassword() },
    });
    expect(response.status()).toBe(403);
  });

  test('on: anyone can register as a student, and the account survives turning it off', async ({ page }) => {
    await setEnrollment(true);
    const email = testEmail('self-signup');
    const password = testPassword();

    await page.goto('/signin');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page.getByRole('heading', { name: 'Create your account.' })).toBeVisible();
    await page.getByLabel('School email').fill(email);
    await page.getByLabel('Your name').fill('Sam Selfserve');
    await page.getByLabel('Choose a password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/student$/);

    // Turning enrollment off doesn't remove accounts made while it was on.
    await setEnrollment(false);
    const session = await apiJson<SessionResponse>('/auth/login', { body: { email, password } });
    expect(session.user.role).toBe('student');
  });
});
