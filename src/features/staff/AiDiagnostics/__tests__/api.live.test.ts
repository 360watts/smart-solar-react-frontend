/**
 * @jest-environment node
 *
 * Real end-to-end test of api.ts (the actual shipped module, not a reimplementation) against
 * the live solar-grid-diagnostic-ai FastAPI service. Requires the backend running locally:
 *   cd ../solar-grid-diagnostic-ai/src && python -m uvicorn diag_ai.api.main:app --port 8000
 *
 * Uses `@jest-environment node` (not the repo's default jsdom) specifically because jsdom's
 * environment doesn't expose Node's native fetch/TextDecoder - this test needs real network I/O,
 * not DOM rendering, so plain Node is the right environment for it, not a workaround.
 *
 * Matches the plan's step 13 requirement ("frontend wired live... verified against the known
 * dip end-to-end") at the data/logic layer - see ReportCard.test.tsx (jsdom) for the
 * component-rendering layer, tested separately against a static fixture.
 */
import { getEvents, streamDiagnosis } from '../api';

describe('api.ts against the live backend', () => {
  test('getEvents returns real underperformance events', async () => {
    const events = await getEvents('h_0011', '400d');
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('site_id', 'h_0011');
    expect(typeof events[0].avg_deficit_pct).toBe('number');
  });

  test('streamDiagnosis on the known demo dip streams 3 traces then a matching report', async () => {
    const traces: string[] = [];
    let result: any = null;
    let error: string | null = null;

    await streamDiagnosis(
      { site_id: 'h_0011', ts_start: '2024-11-12T07:00:00', ts_end: '2024-11-12T08:00:00', avg_deficit_pct: 86.7 },
      { onTrace: t => traces.push(t), onResult: r => { result = r; }, onError: e => { error = e; } },
    );

    expect(error).toBeNull();
    expect(traces).toEqual(['Querying telemetry...', 'Checking fault manual...', 'Drafting explanation...']);
    expect(result).not.toBeNull();
    expect(result.site_id).toBe('h_0011');
    expect(result.ts_start).toBe('2024-11-12T07:00:00');
    expect(result.metric_summary).toContain('86.7');
    expect(Array.isArray(result.citations)).toBe(true);
  }, 30000); // real LLM calls - longer timeout than Jest's 5s default

  test('streamDiagnosis on a known-clean question answers directly instead of a dead end', async () => {
    // The backend no longer hard-stops with a canned "no anomaly" message once it confirms
    // there isn't one - it surfaces the Data Analyst's own answer instead (plain_answer), which
    // is real Gemini-generated prose, not a fixed string, so assert on shape/trace, not exact text.
    const traces: string[] = [];
    let result: any = null;

    await streamDiagnosis(
      { question: 'Did site h_0011 have any underperformance on 2024-01-08?' },
      { onTrace: t => traces.push(t), onResult: r => { result = r; }, onError: () => {} },
    );

    expect(traces).toContain('Answered directly.');
    expect(result).not.toBeNull();
    expect(typeof result.plain_answer).toBe('string');
    expect(result.plain_answer.length).toBeGreaterThan(0);
  }, 30000);
});
