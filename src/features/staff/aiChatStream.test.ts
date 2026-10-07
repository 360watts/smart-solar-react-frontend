import { buildHistory, httpErrorMessage, normalizeStreamFragment, parseSSEBuffer } from './aiChatStream';

describe('parseSSEBuffer', () => {
  it('returns complete lines as events and keeps the partial tail', () => {
    const { events, remainder } = parseSSEBuffer('data: Hello\ndata: wor');
    expect(events).toEqual([{ type: 'token', text: 'Hello' }]);
    expect(remainder).toBe('data: wor');
  });

  it('ignores keepalive, padding and blank lines; emits done and error', () => {
    const { events } = parseSSEBuffer(`: ${' '.repeat(20)}\n\ndata: [KEEPALIVE]\n\ndata: [DONE]\n\ndata: [ERROR] boom\n\n`);
    expect(events).toEqual([{ type: 'done' }, { type: 'error', message: 'boom' }]);
  });

  it('turns escaped newlines into real ones for chat text only', () => {
    expect(parseSSEBuffer('data: a\\nb\n').events).toEqual([{ type: 'token', text: 'a\nb' }]);
    expect(parseSSEBuffer('data: {"x":"a\\nb"}\n', { unescapeNewlines: false }).events)
      .toEqual([{ type: 'token', text: '{"x":"a\\nb"}' }]);
  });

  it('keeps spaces inside tokens and tolerates CRLF', () => {
    expect(parseSSEBuffer('data:  and\r\n').events).toEqual([{ type: 'token', text: ' and' }]);
  });
});

describe('normalizeStreamFragment', () => {
  it('collapses non-breaking spaces (the old regex was a no-op)', () => {
    expect(normalizeStreamFragment('a b')).toBe('a b');
  });
  it('drops empty and bare keepalive fragments', () => {
    expect(normalizeStreamFragment('')).toBeNull();
    expect(normalizeStreamFragment(' [KEEPALIVE] ')).toBeNull();
  });
});

describe('buildHistory', () => {
  const m = (role: 'user' | 'assistant', content: string, extra: object = {}) => ({ role, content, ...extra });

  it('drops error bubbles, diagnose cards and empty placeholders', () => {
    expect(buildHistory([
      m('user', 'hi'),
      m('assistant', 'The AI assistant is temporarily unavailable.', { isError: true }),
      m('assistant', '', {}),
      m('assistant', '', { diagnosticResult: { headline: 'x' } }),
    ])).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('keeps only the last 20 messages', () => {
    const many = Array.from({ length: 30 }, (_, i) => m('user', `m${i}`));
    const out = buildHistory(many);
    expect(out).toHaveLength(20);
    expect(out[0].content).toBe('m10');
  });
});

describe('httpErrorMessage', () => {
  it('prefers the API envelope message', () => {
    expect(httpErrorMessage(503, '{"error":"The AI assistant is temporarily unavailable.","code":"x"}'))
      .toBe('The AI assistant is temporarily unavailable.');
  });
  it('falls back to status copy for non-JSON bodies', () => {
    expect(httpErrorMessage(429, '<html>')).toContain('a bit fast');
    expect(httpErrorMessage(500, '')).toContain('Something went wrong');
  });
});

describe('parseSSEBuffer follow-up chips', () => {
  it('emits suggest events and ignores bad JSON', () => {
    expect(parseSSEBuffer(': suggest ["A","B"]\n').events).toEqual([{ type: 'suggest', items: ['A', 'B'] }]);
    expect(parseSSEBuffer(': suggest {x\n').events).toEqual([]);
  });
});
