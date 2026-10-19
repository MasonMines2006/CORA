/**
 * Natural-language Q&A ("Ask"), with its source citations.
 *
 * Chat answers are revealed by an animation that pauses in background tabs
 * (repo CLAUDE.md, "rAF typing gotcha"), so these tests check what the server
 * sent (the network response) and the parts of the answer that render without
 * the animation (badge, source cards), never the typed-out answer text.
 */
import { expect, test } from '@playwright/test';
import { createAccount, TestAccount } from './support/accounts';
import { MOCK_CHAT_ANSWER, MOCK_SOURCE, mockChat } from './support/llmMocks';
import { signInAs } from './support/session';

const QUESTION = 'What does a neutron reflector do?';

let student: TestAccount;

test.beforeAll(async () => {
  student = await createAccount('student', 'ask');
});

test('Ask a question and get a grounded answer with its sources', async ({ page }) => {
  await mockChat(page);
  await signInAs(page, student);
  await page.goto('/student');

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Ask' }).click();
  await expect(page).toHaveURL(/view=ask/);
  await expect(page.getByRole('button', { name: 'Ask', pressed: true })).toBeVisible();

  const composer = page.getByRole('textbox', { name: 'Message CORA' });
  await composer.fill(QUESTION);
  const chatResponse = page.waitForResponse((response) => response.url().endsWith('/chat_bot'));
  await page.getByRole('button', { name: 'Send' }).click();

  // What the server sent back.
  const response = await chatResponse;
  const body = await response.json();
  expect(body.status).toBe('Success');
  expect(body.data.message).toBe(MOCK_CHAT_ANSWER);
  // The question went out in the request (it is form data).
  expect(response.request().postData()).toContain(QUESTION);

  // What the learner sees: the session, a grounded badge, and a source card.
  await expect(page).toHaveURL(/session=/);
  await expect(page.getByRole('heading', { level: 1, name: QUESTION })).toBeVisible();
  const answer = page.getByRole('article', { name: "CORA's answer" });
  await expect(answer.getByText('Grounded in 2 published passages')).toBeVisible();
  const sources = answer.getByRole('list', { name: 'Sources for this answer' });
  await expect(sources.getByRole('button')).toHaveCount(1);
  await expect(sources).toContainText(MOCK_SOURCE);

  // The session is listed in the sidebar under Today.
  await expect(page.getByRole('complementary').getByRole('button', { name: `Ask ${QUESTION}` })).toBeVisible();

  // A source card opens the source panel, which names the file and the retrieval.
  await sources.getByRole('button').first().click();
  const panel = page.getByRole('complementary', { name: MOCK_SOURCE.replace('.pdf', '') });
  await expect(panel).toContainText(MOCK_SOURCE);
  await expect(panel).toContainText('2 passages across 1 document');
  await panel.getByRole('button', { name: 'Close sources' }).click();
  await expect(panel).toHaveCount(0);
});

test('an answer with no sources says it is not in the material', async ({ page }) => {
  await page.route('**/api/chat_bot', (route) =>
    route.fulfill({
      json: {
        status: 'Success',
        data: { message: 'I could not find that in the course material.', info: { sources: [], error: '' } },
      },
    })
  );
  await signInAs(page, student);
  await page.goto('/student?view=ask');

  await page.getByRole('textbox', { name: 'Message CORA' }).fill('What is the boiling point of tungsten?');
  await page.getByRole('button', { name: 'Send' }).click();

  const answer = page.getByRole('article', { name: "CORA's answer" });
  await expect(answer.getByRole('list', { name: 'Sources for this answer' })).toHaveCount(0);
  await expect(answer.getByText('No published source')).toBeVisible();
  await expect(answer.getByText('Grounded in', { exact: false })).toHaveCount(0);
});
