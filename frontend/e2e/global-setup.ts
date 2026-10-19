/**
 * Runs once before the suite: check the stack is up, and clear out test
 * accounts left behind by a run that crashed before its teardown.
 */
import { API_URL } from './support/env';
import { deleteTestAccounts } from './support/accounts';

export default async function globalSetup(): Promise<void> {
  let healthy = false;
  try {
    const response = await fetch(`${API_URL}/health`);
    healthy = response.ok;
  } catch {
    healthy = false;
  }
  if (!healthy) {
    throw new Error(
      `The backend isn't answering at ${API_URL}/health. Start the Docker stack first (docs/DEMO.md), ` +
        'or set E2E_BASE_URL / E2E_API_URL.'
    );
  }
  deleteTestAccounts();
}
