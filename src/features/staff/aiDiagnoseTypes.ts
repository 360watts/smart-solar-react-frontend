// TypeScript mirrors of solar-grid-diagnostic-ai's Pydantic schemas
// (src/diag_ai/agents/reporter.py::DiagnosticReport/Citation). Keep in sync manually.

export interface Citation {
  index: number;   // 1-based, matches [1][2] markers in root_cause_text
  source: string;  // e.g. "deye_manual_fault_codes" | "fault_log_history"
  ref: string;     // e.g. "F07"
  text: string;    // chunk text
}

export interface DiagnosticReport {
  headline: string;
  likely_component: 'pv_string' | 'inverter' | 'battery' | 'grid' | null;
  site_id: string;
  ts_start: string;
  ts_end: string;
  severity: 'low' | 'medium' | 'high';
  metric_summary: string;
  root_cause_text: string;
  citations: Citation[];
  recommended_action: string;
  confidence: number; // 0-1
}

// The Data Analyst's direct answer to a plain data question (e.g. "what is h_0011's PSH?"):
// graph.py::no_anomaly_node sends this instead of a DiagnosticReport when there's nothing to diagnose.
export interface PlainAnswer {
  plain_answer: string;
}

export type DiagnoseResult = DiagnosticReport | PlainAnswer | null;

export function isPlainAnswer(result: DiagnoseResult): result is PlainAnswer {
  return result != null && 'plain_answer' in result;
}
