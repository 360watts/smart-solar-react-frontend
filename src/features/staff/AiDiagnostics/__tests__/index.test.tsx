import '@testing-library/jest-dom';
// jsdom's test environment doesn't expose ReadableStream/TextEncoder/TextDecoder globally (same
// gap category as fetch, which is why api.live.test.ts uses a plain node environment instead) -
// this test needs both DOM (for RTL rendering) and these web-stream APIs (to build a fake SSE
// response body), so polyfill just the missing pieces rather than switching environments.
// (TextEncoder-missing was found the hard way: it surfaced as a generic "Connection failed."
// from api.ts's catch block, not an obvious error - traced by reproducing the exact fetch call
// outside the module to see the real thrown error.)
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'node:util';
(global as any).ReadableStream = (global as any).ReadableStream || NodeReadableStream;
(global as any).TextEncoder = (global as any).TextEncoder || NodeTextEncoder;
(global as any).TextDecoder = (global as any).TextDecoder || NodeTextDecoder;
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AiDiagnostics from '../index';

jest.mock('../../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}));

// Verifies the container's actual state wiring (event list load -> click -> streaming ->
// report render), not the network layer itself (covered live in api.live.test.ts) - so fetch
// is mocked here with realistic response shapes rather than hitting a real server.
const MOCK_EVENT = { site_id: 'h_0011', ts_start: '2024-11-12T07:00:00', ts_end: '2024-11-12T08:00:00', avg_deficit_pct: 86.7 };
const MOCK_REPORT = {
  headline: 'Site h_0011 — underperformance detected', likely_component: null,
  site_id: 'h_0011', ts_start: '2024-11-12T07:00:00', ts_end: '2024-11-12T08:00:00',
  severity: 'high', metric_summary: '86.7% deficit', root_cause_text: 'No matching evidence found.',
  citations: [], recommended_action: 'Inspect the site.', confidence: 0.0,
};

function sseBody(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= lines.length) { controller.close(); return; }
      controller.enqueue(enc.encode(`data: ${lines[i]}\n\n`));
      i += 1;
    },
  });
}

describe('AiDiagnostics container', () => {
  beforeEach(() => {
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes('/events')) {
        return Promise.resolve({ ok: true, json: async () => [MOCK_EVENT] } as Response);
      }
      if (url.includes('/diagnose')) {
        const body = sseBody(['Querying telemetry...', 'Checking fault manual...', 'Drafting explanation...', JSON.stringify(MOCK_REPORT), '[DONE]']);
        return Promise.resolve({ ok: true, body } as unknown as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as any;
  });

  test('loads events, then clicking one streams traces and renders the report card', async () => {
    render(<AiDiagnostics />);

    // getByText('h_0011') is ambiguous now that the site filter <select> also lists it as an
    // <option> - the event row itself is a <button>, so target it by role instead.
    await waitFor(() => expect(screen.getByRole('button', { name: /h_0011/ })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /h_0011/ }));

    await waitFor(() => expect(screen.getByText(MOCK_REPORT.headline)).toBeInTheDocument());
    expect(screen.getByText('PROTOTYPE · SYNTHETIC DATA')).toBeInTheDocument();
  });
});
