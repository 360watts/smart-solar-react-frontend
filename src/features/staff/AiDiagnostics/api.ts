// New, separate API client for the AI Diagnostics prototype backend - not an extension of
// src/services/api.ts. That service's auth (JWT via httpOnly cookie + CSRF double-submit) and
// single base URL are Django-specific and don't apply here: this is a different origin
// (localhost:8000 in dev), a separate lightweight FastAPI service, no cookies/CSRF.
//
// Design + prototype pass only - synthetic data via solar-grid-diagnostic-ai's own agents, no
// real production data, no Bedrock swap. See that project's CLAUDE.md/plan for the full picture.

import type { DiagnoseRequest, DiagnoseResult, UnderperformanceEvent } from './types';

const BASE_URL = (import.meta as any).env?.VITE_DIAG_AI_BASE_URL || 'http://localhost:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'omit', // no Django auth/CSRF relationship with this separate service
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`diag-ai API ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export function getEvents(siteId?: string, window: string = '30d'): Promise<UnderperformanceEvent[]> {
  const params = new URLSearchParams({ window });
  if (siteId) params.set('site_id', siteId);
  return request<UnderperformanceEvent[]>(`/events?${params.toString()}`);
}

export interface StreamDiagnosisCallbacks {
  onTrace: (label: string) => void;
  onResult: (result: DiagnoseResult) => void;
  onError: (message: string) => void;
}

// No byte for this long => treat the connection as hung, not just "the current LLM call is
// slow" - an *idle* timeout reset on every chunk, not a flat overall one. Caught by code review:
// this stream previously had no timeout at all, so a stalled backend left the UI spinning
// forever. 60s, not something tighter: LangGraph only streams a node's output once it finishes
// (see main.py), so a single free-text question can run one Data Analyst agent loop with many
// sequential tool calls and zero intermediate bytes - measured live at ~10 LLM round-trips for
// one question, comfortably over 30s with no chunk in between. A tighter timeout was tried first
// and false-positived on exactly this case.
const IDLE_TIMEOUT_MS = 60_000;

/**
 * Streams /diagnose's SSE response. Reader-loop structure copied from AiChat.tsx's sendMessage
 * (same getReader()/TextDecoder/buffer-split-on-'\n'/'data: '-prefix/[DONE]/[KEEPALIVE]/[ERROR]
 * handling) - two differences: no auth-refresh-retry branch (nothing to refresh, no auth here),
 * and the final non-sentinel payload is JSON (the DiagnosticReport), not plain text - JSON.parse
 * on each line is itself the discriminator (a trace label is plain text and fails to parse; the
 * final report is valid JSON), no extra protocol needed.
 */
export async function streamDiagnosis(req: DiagnoseRequest, callbacks: StreamDiagnosisCallbacks): Promise<void> {
  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const bumpIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  };

  let res: Response;
  try {
    bumpIdleTimer();
    res = await fetch(`${BASE_URL}/diagnose`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(idleTimer);
    callbacks.onError('Connection failed.');
    return;
  }
  if (!res.ok) {
    clearTimeout(idleTimer);
    const text = await res.text().catch(() => res.statusText);
    callbacks.onError(`diag-ai API ${res.status}: ${text}`);
    return;
  }
  const reader = res.body?.getReader();
  if (!reader) {
    clearTimeout(idleTimer);
    callbacks.onError('No response body.');
    return;
  }
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      bumpIdleTimer();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const token = line.slice(6);
        if (token === '[DONE]') return;
        if (token === '[KEEPALIVE]') continue;
        if (token.startsWith('[ERROR]')) {
          callbacks.onError(token.slice(8));
          return;
        }
        try {
          const result = JSON.parse(token) as DiagnoseResult;
          callbacks.onResult(result);
        } catch {
          callbacks.onTrace(token); // not JSON - a plain-text node_trace label
        }
      }
    }
  } catch {
    callbacks.onError('Connection timed out.');
  } finally {
    clearTimeout(idleTimer);
  }
}
