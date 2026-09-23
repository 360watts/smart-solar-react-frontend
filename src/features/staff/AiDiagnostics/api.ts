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

/**
 * Streams /diagnose's SSE response. Reader-loop structure copied from AiChat.tsx's sendMessage
 * (same getReader()/TextDecoder/buffer-split-on-'\n'/'data: '-prefix/[DONE]/[KEEPALIVE]/[ERROR]
 * handling) - two differences: no auth-refresh-retry branch (nothing to refresh, no auth here),
 * and the final non-sentinel payload is JSON (the DiagnosticReport), not plain text - JSON.parse
 * on each line is itself the discriminator (a trace label is plain text and fails to parse; the
 * final report is valid JSON), no extra protocol needed.
 */
export async function streamDiagnosis(req: DiagnoseRequest, callbacks: StreamDiagnosisCallbacks): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/diagnose`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch {
    callbacks.onError('Connection failed.');
    return;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    callbacks.onError(`diag-ai API ${res.status}: ${text}`);
    return;
  }
  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError('No response body.');
    return;
  }
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
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
}
