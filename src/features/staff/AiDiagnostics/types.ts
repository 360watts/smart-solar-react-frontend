// TypeScript mirrors of solar-grid-diagnostic-ai's Pydantic schemas
// (src/diag_ai/agents/reporter.py::DiagnosticReport/Citation, src/diag_ai/api/schemas.py).
// Keep in sync manually - this is a separate prototype backend, not a shared codegen pipeline.

export interface Citation {
  index: number;      // 1-based, matches [1][2] markers in root_cause_text
  source: string;      // e.g. "deye_manual_fault_codes" | "fault_log_history"
  ref: string;          // e.g. "F07"
  text: string;          // chunk text, for the citation-expand popover
}

export type LikelyComponent = 'pv_string' | 'inverter' | 'battery' | 'grid' | null;
export type Severity = 'low' | 'medium' | 'high';

export interface DiagnosticReport {
  headline: string;
  likely_component: LikelyComponent;
  site_id: string;
  ts_start: string;
  ts_end: string;
  severity: Severity;
  metric_summary: string;
  root_cause_text: string;
  citations: Citation[];
  recommended_action: string;
  confidence: number; // 0-1
}

// The Data Analyst's direct answer to a plain data question (e.g. "what is h_0011's PSH?") that
// wasn't an anomaly question at all - graph.py::no_anomaly_node sends this shape instead of a
// DiagnosticReport when there's nothing to diagnose but the agent still has a real answer.
export interface PlainAnswer {
  plain_answer: string;
}

export type DiagnoseResult = DiagnosticReport | PlainAnswer | null;

export function isPlainAnswer(result: DiagnoseResult): result is PlainAnswer {
  return result != null && 'plain_answer' in result;
}

export interface UnderperformanceEvent {
  site_id: string;
  ts_start: string;
  ts_end: string;
  avg_deficit_pct: number;
}

export interface DiagnoseRequest {
  question?: string | null;
  site_id?: string | null;
  ts_start?: string | null;
  ts_end?: string | null;
  avg_deficit_pct?: number | null;
}
