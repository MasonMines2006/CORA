/**
 * The admin screens: Users (invite, reset link, deactivate, open enrollment)
 * and Materials (publish a document so students can learn from it).
 */
import { expect, Page, test } from '@playwright/test';
import { apiJson, apiLogin, createAccount, TestAccount, testEmail, testPassword } from './support/accounts';
import { API_URL } from './support/env';
import { signInAs } from './support/session';

let admin: TestAccount;

test.beforeAll(async () => {
  admin = await createAccount('admin', 'admin-flow');
});

/** The table row for one person on /admin/users. */
const userRow = (page: Page, email: string) => page.getByRole('row').filter({ hasText: email });

test.describe('Users', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, admin);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Users', level: 1 })).toBeVisible();
  });

  test('invite a student: the link appears, and it signs them up', async ({ page, browser }) => {
    const email = testEmail('invited-by-ui');

    await page.getByLabel('Emails to invite').fill(email);
    await page.getByLabel('Invite as').selectOption('student');
    await page.getByRole('button', { name: 'Create invite links' }).click();

    const link = page.getByLabel(`Invite link for ${email}`);
    await expect(link).toHaveValue(/\/join\/[A-Za-z0-9_-]+$/);
    await expect(page.getByRole('region', { name: 'Waiting to join' })).toContainText(email);

    // The invitee opens the link in their own browser.
    const inviteUrl = new URL(await link.inputValue());
    const invitee = await browser.newContext();
    const inviteePage = await invitee.newPage();
    await inviteePage.goto(inviteUrl.pathname);
    await expect(inviteePage.getByLabel('Email')).toHaveValue(email);
    await inviteePage.getByLabel('Your name').fill('Una Invited');
    await inviteePage.getByLabel('Choose a password', { exact: true }).fill(testPassword());
    await inviteePage.getByRole('button', { name: 'Create account' }).click();
    await expect(inviteePage).toHaveURL(/\/student$/);
    await invitee.close();
  });

  test('issue a reset link: it sets a new password and the old one stops working', async ({ page, browser }) => {
    const student = await createAccount('student', 'needs-reset');
    await page.reload();

    await userRow(page, student.email).getByRole('button', { name: 'Reset link' }).click();
    const link = page.getByLabel(`Reset link for ${student.email}`);
    await expect(link).toHaveValue(/\/reset\/[A-Za-z0-9_-]+$/);

    const resetPage = await (await browser.newContext()).newPage();
    await resetPage.goto(new URL(await link.inputValue()).pathname);
    await expect(resetPage.getByRole('heading', { name: 'Choose a new password.' })).toBeVisible();
    const newPassword = testPassword();
    await resetPage.getByLabel('New password', { exact: true }).fill(newPassword);
    await resetPage.getByRole('button', { name: 'Set new password' }).click();
    await expect(resetPage.getByRole('heading', { name: 'Your new password is set.' })).toBeVisible();
    await resetPage.context().close();

    const session = await apiLogin({ ...student, password: newPassword });
    expect(session.user.email).toBe(student.email);
    await expect(apiLogin(student)).rejects.toThrow(/HTTP 401/);
  });

  test('deactivate someone: they can no longer sign in, until reactivated', async ({ page }) => {
    const student = await createAccount('student', 'to-deactivate');
    await page.reload();
    const row = userRow(page, student.email);

    await row.getByRole('button', { name: 'Deactivate' }).click();
    await expect(row).toContainText('Deactivated');
    await expect(apiLogin(student)).rejects.toThrow(/HTTP 401/);

    await row.getByRole('button', { name: 'Reactivate' }).click();
    await expect(row).toContainText('Active');
    await expect(apiLogin(student)).resolves.toMatchObject({ user: { email: student.email } });
  });

  test("you can't deactivate yourself", async ({ page }) => {
    const myRow = userRow(page, admin.email);
    await expect(myRow).toContainText('(you)');
    await expect(myRow.getByRole('button', { name: 'Deactivate' })).toHaveCount(0);
    await expect(page.getByLabel(`Role for ${admin.email}`)).toBeDisabled();
  });

  test('the open-enrollment switch turns self sign-up on and off', async ({ page, request }) => {
    const enrollment = page.getByRole('switch', { name: 'Open enrollment' });
    const before = (await enrollment.getAttribute('aria-checked')) === 'true';
    try {
      if (before) {
        await enrollment.click();
        await expect(enrollment).toHaveAttribute('aria-checked', 'false');
      }
      await enrollment.click();
      await expect(enrollment).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByText('Anyone can register as a student.')).toBeVisible();
      const config = await (await request.get(`${API_URL}/auth/config`)).json();
      expect(config.open_enrollment).toBe(true);

      await enrollment.click();
      await expect(enrollment).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText('Only invited people can join.')).toBeVisible();
    } finally {
      // Leave the global switch the way we found it, even if an assertion failed.
      const { token } = await apiLogin(admin);
      await apiJson('/admin/settings/enrollment', { method: 'PUT', token, body: { open_enrollment: before } });
    }
  });

  test('a student is refused by the admin API', async ({ request }) => {
    const student = await createAccount('student', 'not-admin');
    const { token } = await apiLogin(student);
    const response = await request.get(`${API_URL}/admin/users`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status()).toBe(403);
  });
});

interface Material {
  file_name: string;
  processing_status: string;
  publication_status: 'draft' | 'published';
  passage_count: number;
}

test.describe('Materials', () => {
  test('publish a draft document, then unpublish it again', async ({ page }) => {
    const { token } = await apiLogin(admin);
    const materials = await apiJson<Material[]>('/admin/materials', { method: 'GET', token });
    // Only a finished draft with extracted text can be published.
    const draft = materials.find(
      (material) =>
        material.publication_status === 'draft' &&
        material.processing_status === 'Completed' &&
        material.passage_count > 0
    );
    test.skip(!draft, 'Every finished document is already published, so there is nothing to publish.');
    const fileName = draft!.file_name;

    try {
      await signInAs(page, admin);
      await page.goto('/admin');
      await expect(page.getByRole('heading', { name: 'Materials', level: 1 })).toBeVisible();
      const listItem = page.getByRole('region', { name: 'Uploaded materials' }).getByRole('button', { name: fileName });
      await expect(listItem).toContainText('Draft');

      await listItem.click();
      const review = page.getByRole('region', { name: 'Material review' });
      await expect(review.getByRole('heading', { name: fileName })).toBeVisible();
      await review.getByRole('button', { name: 'Publish' }).click();

      await expect(listItem).toContainText('Published');
      await expect(review.getByText(/^Published /)).toBeVisible();
      const afterPublish = await apiJson<Material[]>('/admin/materials', { method: 'GET', token });
      expect(afterPublish.find((material) => material.file_name === fileName)?.publication_status).toBe('published');

      await review.getByRole('button', { name: 'Unpublish' }).click();
      await expect(listItem).toContainText('Draft');
    } finally {
      // Never leave a draft (often an answer key) published for students.
      const now = await apiJson<Material[]>('/admin/materials', { method: 'GET', token });
      if (now.find((material) => material.file_name === fileName)?.publication_status === 'published') {
        await apiJson('/admin/materials/unpublish', { token, body: { file_name: fileName } });
      }
    }
  });
});

test('signing in through the UI as admin and opening Users works end to end', async ({ page }) => {
  // The other tests seed the token directly; this one goes through /signin once.
  await page.goto('/signin');
  await page.getByLabel('School email').fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/users');
  await expect(userRow(page, admin.email)).toContainText('(you)');
});
