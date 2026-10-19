/**
 * The one test that talks to the real model, to prove the whole chain works:
 * browser → backend → vector search over published material → OpenAI → answer.
 *
 * Off by default because it costs money. Run it with:
 *   E2E_REAL_LLM=1 yarn e2e real-llm-smoke
 * It asks one short question as a signed-in student (one embedding plus one
 * chat completion: well under one US cent).
 */
import { expect, test } from '@playwright/test';
import { createAccount } from './support/accounts';
import { REAL_LLM } from './support/env';
import { signInAs } from './support/session';

test.skip(!REAL_LLM, 'Calls the real model. Set E2E_REAL_LLM=1 to run it.');

test('a real question gets a grounded answer from published material', async ({ page }) => {
  // The model can take a while; this is the only test that waits on it.
  test.setTimeout(120_000);
  const student = await createAccount('student', 'real-llm');
  await signInAs(page, student);
  await page.goto('/student?view=ask');

  await page.getByRole('textbox', { name: 'Message CORA' }).fill('What does a scram do?');
  const chatResponse = page.waitForResponse((response) => response.url().endsWith('/chat_bot'), {
    timeout: 90_000,
  });
  await page.getByRole('button', { name: 'Send' }).click();

  // Check the server's reply, not the animated text (see learn-ask.e2e.ts).
  const response = await chatResponse;
  expect(response.status(), 'chat_bot HTTP status').toBe(200);
  const body = await response.json();
  expect(body.status).toBe('Success');
  // Compare a boolean, not the text: the server's error string can quote
  // provider details (even part of an API key), and a failed expect prints it.
  // Read `docker logs backend-dev` for the cause instead.
  expect(Boolean(body.data.info?.error), 'the model call failed on the server; see docker logs backend-dev').toBe(
    false
  );
  expect(typeof body.data.message).toBe('string');
  expect(body.data.message.length).toBeGreaterThan(20);
  expect(body.data.info.sources.length, 'the answer cites published material').toBeGreaterThan(0);

  await expect(page.getByRole('article', { name: "CORA's answer" }).getByText(/Grounded in \d+/)).toBeVisible({
    timeout: 30_000,
  });
});
