/**
 * Test accounts: made through the same invite links a real admin would hand
 * out, and removed again with SQL when the run ends.
 *
 * Why the Docker CLI: sign-up is invite-only, and only an admin can invite, so
 * the very first account needs another way in. The backend ships a CLI for
 * exactly that (`src.local_auth.create_invite`), and the tests use it too.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  API_URL,
  BACKEND_CONTAINER,
  POSTGRES_CONTAINER,
  POSTGRES_DB,
  POSTGRES_USER,
  TEST_EMAIL_DOMAIN,
} from './env';

export type Role = 'student' | 'ta' | 'admin';

export interface TestAccount {
  email: string;
  password: string;
  name: string;
  role: Role;
}

/** What /auth/login and invite acceptance return. */
export interface SessionResponse {
  token: string;
  expires_at: string;
  user: { id: number; email: string; name: string | null; role: string };
}

/** A unique, obviously-fake email on the test domain. */
export function testEmail(label: string): string {
  const unique = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  return `${label}-${unique}@${TEST_EMAIL_DOMAIN}`;
}

/** A random password that passes the server's rules (12+ chars, not common). It is never printed. */
export function testPassword(): string {
  return `e2e-${randomBytes(12).toString('base64url')}`;
}

/** Ask the backend CLI for a single-use invite link and return just its token. */
export function createInviteToken(email: string, role: Role): string {
  const output = execFileSync(
    'docker',
    ['exec', BACKEND_CONTAINER, 'python', '-m', 'src.local_auth.create_invite', email, '--role', role],
    { encoding: 'utf8' }
  );
  const match = output.match(/\/join\/([A-Za-z0-9_-]+)/);
  if (!match) {
    // Don't echo the output: if it ever held a token, it shouldn't land in a CI log.
    throw new Error(`create_invite did not print an invite link for ${email}`);
  }
  return match[1];
}

/** POST JSON to the backend and return the parsed body; throws with the status on failure. */
export async function apiJson<T>(path: string, init: { method?: string; body?: unknown; token?: string }): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token) {
    headers.authorization = `Bearer ${init.token}`;
  }
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'POST',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? 'POST'} ${path} failed with HTTP ${response.status}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Make a ready-to-use account: invite it, then accept the invite with a password. */
export async function createAccount(role: Role, label: string = role): Promise<TestAccount> {
  const account: TestAccount = { email: testEmail(label), password: testPassword(), name: `E2E ${label}`, role };
  const token = createInviteToken(account.email, role);
  await apiJson<SessionResponse>(`/auth/invites/${token}/accept`, {
    body: { name: account.name, password: account.password },
  });
  return account;
}

/** Sign in through the API (not the UI) and return the session. */
export function apiLogin(account: TestAccount): Promise<SessionResponse> {
  return apiJson<SessionResponse>('/auth/login', { body: { email: account.email, password: account.password } });
}

/** Run SQL in the Postgres container. Only ever called with the fixed statements below. */
function psql(sql: string): void {
  execFileSync(
    'docker',
    ['exec', '-i', POSTGRES_CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-q', '-U', POSTGRES_USER, '-d', POSTGRES_DB],
    { input: sql, encoding: 'utf8' }
  );
}

/**
 * Delete every test account and everything it created: quiz sessions, mastery,
 * review cards, lesson progress and unused links. Only rows tied to
 * @e2e.cora.local emails are touched.
 *
 * `learner_id` in the learning tables is the account's `auth0_sub` column
 * (it held Auth0 ids before; now it's `cora|<id>`), hence the sub-select.
 */
export function deleteTestAccounts(): void {
  const pattern = `%@${TEST_EMAIL_DOMAIN}`;
  const learners = `(SELECT auth0_sub FROM app_users WHERE email LIKE '${pattern}')`;
  psql(`
    BEGIN;
    DELETE FROM quiz_sessions WHERE learner_id IN ${learners};
    DELETE FROM learner_mastery WHERE learner_id IN ${learners};
    DELETE FROM review_cards WHERE learner_id IN ${learners};
    DELETE FROM lesson_progress WHERE learner_id IN ${learners};
    DELETE FROM auth_links WHERE email LIKE '${pattern}';
    DELETE FROM app_users WHERE email LIKE '${pattern}';
    COMMIT;
  `);
}
