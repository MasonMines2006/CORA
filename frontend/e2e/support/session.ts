/**
 * Start a page already signed in, without clicking through /signin.
 *
 * The app keeps its session token in sessionStorage under `cora.session`
 * (src/components/Auth/tokenStore.ts) and checks it with GET /auth/me on load.
 * So we sign in through the API and put the same token where the app looks.
 * The sign-in screen itself is tested on its own in auth-signin.e2e.ts.
 */
import type { Page } from '@playwright/test';
import { apiLogin, SessionResponse, TestAccount } from './accounts';

const SESSION_KEY = 'cora.session';

export async function signInAs(page: Page, account: TestAccount): Promise<SessionResponse> {
  const session = await apiLogin(account);
  // addInitScript runs before the app's own scripts on every page load, so the
  // token is in place before SessionProvider reads it. The flag makes it run
  // once per tab, so a test can still sign out and stay signed out.
  await page.addInitScript(
    ([key, value]) => {
      if (!window.sessionStorage.getItem('cora.e2e.seeded')) {
        window.sessionStorage.setItem('cora.e2e.seeded', '1');
        window.sessionStorage.setItem(key, value);
      }
    },
    [SESSION_KEY, JSON.stringify({ token: session.token, expires_at: session.expires_at })]
  );
  return session;
}
