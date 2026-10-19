/*
 * What went wrong loading a lesson or quiz, in the words the screen needs.
 * The learning API answers 409 when a concept has too little published
 * material, 404 when the concept is gone, and 401 when the sign-in expired.
 */

export type LoadFailure = 'notEnoughMaterial' | 'notFound' | 'signedOut' | 'error';

export const httpStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

/** True when a request was cancelled on purpose (we navigated away), which is not an error. */
export const isCanceled = (error: unknown): boolean => (error as { name?: string })?.name === 'CanceledError';

export const classifyLoadError = (error: unknown): LoadFailure => {
  switch (httpStatus(error)) {
    case 409:
      return 'notEnoughMaterial';
    case 404:
      return 'notFound';
    case 401:
      return 'signedOut';
    default:
      return 'error';
  }
};
