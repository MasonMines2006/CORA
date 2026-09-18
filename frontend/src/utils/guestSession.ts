const GUEST_ID_KEY = 'coraGuestId';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getOrCreateGuestId = (): string | undefined => {
  if (typeof window === 'undefined' || typeof crypto.randomUUID !== 'function') {
    return undefined;
  }

  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing && UUID_PATTERN.test(existing)) {
    return existing.toLowerCase();
  }

  const guestId = crypto.randomUUID();
  window.localStorage.setItem(GUEST_ID_KEY, guestId);
  return guestId;
};
