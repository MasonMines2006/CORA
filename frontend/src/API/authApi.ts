/**
 * Calls to CORA's own sign-in API (backend/src/local_auth/router.py).
 *
 * Every call goes through the shared axios client in ./Index.ts, so the session
 * token is attached automatically once someone is signed in. Failures are turned
 * into an AuthApiError carrying the HTTP status and the server's plain-language
 * message, so screens can show exactly what the server said.
 */
import axios from 'axios';
import api from './Index';

export type Role = 'student' | 'ta' | 'admin' | 'test_full';

export interface SessionUser {
  id: number;
  email: string;
  name: string | null;
  role: Role;
}

export interface SessionResponse {
  token: string;
  expires_at: string;
  user: SessionUser;
}

export interface AuthConfig {
  open_enrollment: boolean;
  sso_enabled: boolean;
}

export interface InvitePreview {
  email: string;
  role: Role;
  invited_by: string;
  expires_at: string;
}

export interface ResetPreview {
  email: string;
  issued_by: string;
  expires_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  status: 'active' | 'deactivated';
  sign_in_method: string;
  last_login: string | null;
  created_at: string | null;
}

export interface PendingInvite {
  email: string;
  role: Role;
  invited_by: string;
  expires_at: string;
}

export interface CreatedLink {
  email: string;
  role?: Role;
  token: string;
  expires_at: string;
}

export class AuthApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public problems: string[] = []
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

const FALLBACK_MESSAGE = "Couldn't reach CORA. Check your connection and try again.";

/** Turn an axios failure into an AuthApiError with the server's own message. */
function toAuthError(error: unknown): AuthApiError {
  if (axios.isAxiosError(error) && error.response) {
    const detail = error.response.data?.detail;
    if (typeof detail === 'string') {
      return new AuthApiError(error.response.status, detail);
    }
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return new AuthApiError(error.response.status, String(detail.message), detail.problems ?? []);
    }
    return new AuthApiError(error.response.status, FALLBACK_MESSAGE);
  }
  return new AuthApiError(0, FALLBACK_MESSAGE);
}

async function call<T>(request: Promise<{ data: T }>): Promise<T> {
  try {
    return (await request).data;
  } catch (error) {
    throw toAuthError(error);
  }
}

// --- signing in -------------------------------------------------------------------

export const getAuthConfig = () => call<AuthConfig>(api.get('/auth/config'));

export const login = (email: string, password: string, keepSignedIn: boolean) =>
  call<SessionResponse>(api.post('/auth/login', { email, password, keep_signed_in: keepSignedIn }));

export const logout = () => call<void>(api.post('/auth/logout'));

export const getMe = () => call<SessionUser>(api.get('/auth/me'));

export const register = (email: string, name: string, password: string) =>
  call<SessionResponse>(api.post('/auth/register', { email, name, password }));

// Link tokens go in the URL path, so encode them in case they contain anything odd.
const linkPath = (kind: 'invites' | 'reset', token: string) => `/auth/${kind}/${encodeURIComponent(token)}`;

export const getInvite = (token: string) => call<InvitePreview>(api.get(linkPath('invites', token)));

export const acceptInvite = (token: string, name: string, password: string) =>
  call<SessionResponse>(api.post(`${linkPath('invites', token)}/accept`, { name, password }));

export const getReset = (token: string) => call<ResetPreview>(api.get(linkPath('reset', token)));

export const completeReset = (token: string, password: string) =>
  call<void>(api.post(linkPath('reset', token), { password }));

export const changePassword = (currentPassword: string, newPassword: string) =>
  call<SessionResponse>(api.post('/auth/password', { current_password: currentPassword, new_password: newPassword }));

// --- admin ------------------------------------------------------------------------

export const listUsers = async () => (await call<{ users: AdminUser[] }>(api.get('/admin/users'))).users;

export const listInvites = async () => (await call<{ invites: PendingInvite[] }>(api.get('/admin/invites'))).invites;

export const createInvites = (emails: string[], role: Role) =>
  call<{ invites: CreatedLink[]; skipped: string[] }>(api.post('/admin/invites', { emails, role }));

export const updateUser = (userId: number, changes: { role?: Role; is_active?: boolean }) =>
  call<AdminUser>(api.patch(`/admin/users/${userId}`, changes));

export const issueResetLink = (userId: number) => call<CreatedLink>(api.post(`/admin/users/${userId}/reset-link`));

export const getEnrollment = async () =>
  (await call<{ open_enrollment: boolean }>(api.get('/admin/settings/enrollment'))).open_enrollment;

export const setEnrollment = async (isOpen: boolean) =>
  (await call<{ open_enrollment: boolean }>(api.put('/admin/settings/enrollment', { open_enrollment: isOpen })))
    .open_enrollment;

/** The full link an admin copies and sends, e.g. https://cora.example/join/<token>. */
export const linkUrl = (kind: 'join' | 'reset', token: string) =>
  `${window.location.origin}/${kind}/${encodeURIComponent(token)}`;
