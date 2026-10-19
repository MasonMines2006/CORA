/*
 * Pure helpers for Ask (DESIGN.md 5.4): reading the chat endpoint's reply,
 * naming errors, and spotting which published concept a question is about.
 * No React here, so every rule is easy to test.
 */

/** What one CORA reply turned out to be. */
export type ChatResult =
  | { kind: 'answer'; text: string; sources: string[]; passageCount: number }
  | { kind: 'notInMaterial'; text: string }
  | { kind: 'error'; message: string };

export type ChatFailure = 'error' | 'rateLimited' | 'guestUnavailable';

interface ChatInfo {
  sources?: unknown;
  error?: unknown;
  nodedetails?: { chunkdetails?: unknown };
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const uniqueStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))];
};

/**
 * The /chat_bot body is `{status, message, data: {message, info: {sources, nodedetails, error}}}`.
 * It is external data, so every field is checked before use.
 */
export const parseChatResponse = (body: unknown): ChatResult => {
  if (!isObject(body) || body.status !== 'Success' || !isObject(body.data)) {
    const message = isObject(body) && typeof body.message === 'string' ? body.message : "Couldn't get an answer.";
    return { kind: 'error', message };
  }
  const { message, info } = body.data as { message?: unknown; info?: ChatInfo };
  // The server reports some failures inside a "Success" envelope, with info.error set.
  if (typeof message !== 'string' || !isObject(info) || info.error) {
    return { kind: 'error', message: "Couldn't get an answer." };
  }
  const sources = uniqueStrings(info.sources);
  if (sources.length === 0) {
    return { kind: 'notInMaterial', text: message };
  }
  const chunks = isObject(info.nodedetails) ? info.nodedetails.chunkdetails : undefined;
  return { kind: 'answer', text: message, sources, passageCount: Array.isArray(chunks) ? chunks.length : 0 };
};

/** Turns an axios failure into the state the screen should show. */
export const classifyChatError = (error: unknown): { reason: ChatFailure; message: string } => {
  const response = isObject(error) && isObject(error.response) ? error.response : undefined;
  const data = response && isObject(response.data) ? response.data : {};
  const serverText = [data.detail, data.message].find((text): text is string => typeof text === 'string');
  if (response?.status === 429) {
    return { reason: 'rateLimited', message: serverText ?? "You've reached this hour's question limit." };
  }
  if (response?.status === 503) {
    return { reason: 'guestUnavailable', message: serverText ?? 'Ask is not available for guests right now.' };
  }
  return { reason: 'error', message: "Couldn't reach CORA before the answer finished." };
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Which published concept does this text name? Whole-word, case-insensitive,
 * and the longest name wins ("Reactor period" beats "Reactor").
 */
export const matchConcept = <T extends { id: string; name: string }>(text: string, concepts: T[]): T | undefined =>
  [...concepts]
    .filter((concept) => concept.name.trim().length > 1)
    .sort((a, b) => b.name.length - a.name.length)
    .find((concept) => new RegExp(`(^|[^\\w])${escapeRegExp(concept.name.trim())}($|[^\\w])`, 'i').test(text));

const MAX_TITLE = 60;

/** A session's title is its first question, shortened for the sidebar. */
export const titleFrom = (question: string): string => {
  const text = question.trim().replace(/\s+/g, ' ');
  return text.length <= MAX_TITLE ? text : `${text.slice(0, MAX_TITLE - 1)}…`;
};
