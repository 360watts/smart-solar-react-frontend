// Pure helpers for the staff AI chat (AiChat.tsx): SSE parsing, request history and error copy.
// No React / fetch imports so they can be unit-tested without a DOM or a real stream.
//
// Wire protocol (shared with the backend's sse_token_stream and the customer portal's
// useAssistantStream.ts): `data: <token>` (newlines escaped as a literal \n), `data: [KEEPALIVE]`,
// `data: [DONE]`, `data: [ERROR] <message>`. Anything not starting with `data: ` (the 2 KB `: ` padding
// frame, blank separators) is ignored.

export type SSEEvent =
  | { type: 'token'; text: string }
  | { type: 'error'; message: string }
  | { type: 'suggest'; items: string[] }
  | { type: 'done' };

/** Backend keeps the last 10 turns; sending more is dead payload. */
export const MAX_TURNS = 10;

export function normalizeStreamFragment(fragment: string): string | null {
  // U+00A0 (non-breaking space) -> normal space. The previous copy of this regex held a literal ASCII
  // space, so it replaced spaces with spaces and never did what its comment claimed.
  const cleaned = fragment.replace(/ /g, ' ');
  if (cleaned === '' || cleaned.trim() === '[KEEPALIVE]') return null;
  return cleaned;
}

/**
 * Parses whatever text has accumulated so far (including a possibly incomplete trailing line) and
 * returns the events in the complete lines plus the leftover partial line.
 * `unescapeNewlines` is for chat text; the /diagnose JSON frames must keep their `\n` escapes intact.
 */
export function parseSSEBuffer(
  buf: string,
  opts: { unescapeNewlines?: boolean } = {},
): { events: SSEEvent[]; remainder: string } {
  const lines = buf.split('\n');
  const remainder = lines.pop() ?? '';
  const events: SSEEvent[] = [];

  for (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    // `: suggest ["a","b"]` is an SSE comment frame carrying tappable follow-ups (older clients ignore it).
    if (line.startsWith(': suggest ')) {
      try {
        const items = (JSON.parse(line.slice(10)) as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 3);
        if (items.length) events.push({ type: 'suggest', items });
      } catch { /* malformed chip frame: show the answer without chips */ }
      continue;
    }
    if (!line.startsWith('data: ')) continue;
    const token = line.slice(6);
    if (token === '[DONE]') {
      events.push({ type: 'done' });
    } else if (token === '[KEEPALIVE]') {
      continue;
    } else if (token.startsWith('[ERROR]')) {
      events.push({ type: 'error', message: token.slice(8).trim() || 'Something went wrong.' });
    } else {
      const text = normalizeStreamFragment(opts.unescapeNewlines === false ? token : token.replace(/\\n/g, '\n'));
      if (text !== null) events.push({ type: 'token', text });
    }
  }
  return { events, remainder };
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  diagnosticResult?: unknown;
}

/** Conversation payload for the backend: error bubbles, diagnose cards and empty placeholders are
 *  UI-only and must never be sent back to the model as if it had said them. */
export function buildHistory(messages: HistoryMessage[]): { role: string; content: string }[] {
  return messages
    .filter(m => !m.isError && !m.diagnosticResult && m.content.trim() !== '')
    .slice(-(MAX_TURNS * 2))
    .map(m => ({ role: m.role, content: m.content }));
}

const STATUS_COPY: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have access to this assistant.",
  429: "You're sending messages a bit fast. Please wait a moment and try again.",
  503: 'The assistant is temporarily unavailable.',
};

/** Message for a non-OK response body: the API envelope `{error}` when present, else status copy. */
export function httpErrorMessage(status: number, bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText);
    if (typeof parsed?.error === 'string' && parsed.error) return parsed.error;
    if (typeof parsed?.detail === 'string' && parsed.detail) return parsed.detail;
  } catch {
    // not JSON
  }
  return STATUS_COPY[status] ?? 'Something went wrong. Please try again.';
}
