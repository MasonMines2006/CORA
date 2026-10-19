/**
 * Where to go after signing in.
 *
 * The sign-in page accepts ?returnTo=/somewhere so people land back where they
 * started. Only paths inside CORA are allowed. Otherwise a crafted link like
 * /signin?returnTo=https://evil.example would bounce someone to a fake site
 * right after a real sign-in (an "open redirect").
 */
export const DEFAULT_RETURN_TO = '/student';

export function safeReturnTo(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_RETURN_TO;
  }
  // Must be a single-slash path: "//host" and "/\host" are treated as other sites by browsers.
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_RETURN_TO;
  }
  return value;
}

/** Students go to their path; staff go to the admin area. */
export function homeFor(role: string | undefined): string {
  return role === 'student' || !role ? '/student' : '/admin';
}
