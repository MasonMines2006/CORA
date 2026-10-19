/** Runs once after the suite, pass or fail: remove every @e2e.cora.local account. */
import { deleteTestAccounts } from './support/accounts';

// Playwright accepts a plain function here; the SQL runs synchronously.
export default function globalTeardown(): void {
  deleteTestAccounts();
}
