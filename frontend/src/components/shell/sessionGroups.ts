import { SessionSummary } from './types';

export interface SessionGroup {
  label: 'Today' | 'Yesterday' | 'This week' | 'Earlier';
  items: SessionSummary[];
}

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const labelFor = (updatedAt: number, today: number): SessionGroup['label'] => {
  if (updatedAt >= today) {
    return 'Today';
  }
  if (updatedAt >= today - DAY) {
    return 'Yesterday';
  }
  return updatedAt >= today - 6 * DAY ? 'This week' : 'Earlier';
};

/** ChatGPT-style history: newest first, grouped by how long ago, empty groups left out. */
export const groupSessions = (sessions: SessionSummary[], now = Date.now()): SessionGroup[] => {
  const today = startOfDay(now);
  const order: SessionGroup['label'][] = ['Today', 'Yesterday', 'This week', 'Earlier'];
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  return order
    .map((label) => ({ label, items: sorted.filter((item) => labelFor(item.updatedAt, today) === label) }))
    .filter((group) => group.items.length > 0);
};
