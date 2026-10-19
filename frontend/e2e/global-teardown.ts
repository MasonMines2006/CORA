/** Runs once after the suite, pass or fail: remove every @e2e.cora.local account. */
import { deleteTestAccounts } from './support/accounts';

export default async function globalTeardown(): Promise<void> {
  deleteTestAccounts();
}
