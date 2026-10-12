import React, { memo, useCallback, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import { useTokens, Btn } from '../siteHardware/ui';

// Device log files: date range, server paging, inline view with an errors-and-warnings filter, scan a day, download the range.
// Owns its own state so a control-panel action never redraws the list. Scenarios: docs/test-scenarios/viewer-devices.md (LG-*).

const PAGE = 20;
const VIEW_LINES = 300;
type LogFile = { id: number; filename?: string; name?: string; file_size?: number; created_at?: string; uploaded_at?: string };
type Scan = { files_scanned: number; total_errors: number; total_warnings: number };

const at = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const toIST = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : undefined);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// Firmware lines look like "<epoch><sep>E (<ms>) tag: text". Level letter after the separator; time shown for reading only.
const LINE = /^(\d{9,})[^A-Za-z0-9]?([EWI]) \(/;
export function viewLines(text: string, problemsOnly: boolean): string[] {
  const out: string[] = [];
  for (const raw of text.split('\n')) {
    const m = LINE.exec(raw);
    if (problemsOnly && !(m && m[2] !== 'I')) continue;
    out.push(m ? `${new Date(Number(m[1]) * 1000).toLocaleTimeString('en-IN')}  ${raw.slice(m[0].length - 3)}` : raw);
  }
  return out;
}

const Row = memo(function Row({ f, isDark, open, onView, onDownload }: {
  f: LogFile; isDark: boolean; open: boolean; onView: (f: LogFile) => void; onDownload: (f: LogFile) => void;
}) {
  const t = useTokens(isDark);
  const name = f.filename || f.name || `Log ${f.id}`;
  const when = f.uploaded_at || f.created_at;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
      <span style={{ fontSize: '0.88rem', minWidth: 0, overflowWrap: 'anywhere' }}>
        {name}
        <span style={{ display: 'block', fontSize: '0.78rem', color: t.ink2 }}>{[when && at(when), f.file_size != null && `${(f.file_size / 1024).toFixed(0)} KB`].filter(Boolean).join(' · ')}</span>
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        <Btn isDark={isDark} size="sm" variant="plain" aria-label={`View ${name}`} onClick={() => onView(f)}>{open ? 'Hide' : 'View'}</Btn>
        <Btn isDark={isDark} size="sm" variant="plain" aria-label={`Download ${name}`} onClick={() => onDownload(f)}>Download</Btn>
      </span>
    </div>
  );
});

const LogsCard: React.FC<{ deviceId: number; isDark: boolean }> = ({ deviceId, isDark }) => {
  const t = useTokens(isDark);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ from: '', to: '' }); // the range last fetched; Download all uses it so it matches the list
  const [files, setFiles] = useState<LogFile[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState<{ id: number; text: string } | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [scanDate, setScanDate] = useState(today);
  const [scan, setScan] = useState<Scan | null>(null);
  const [work, setWork] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const req = useRef(0); // drops answers that arrive after a newer request

  const load = useCallback((p: number, range: { from: string; to: string }) => {
    const id = ++req.current;
    setFailed(false);
    apiService.getDeviceLogFiles(deviceId, PAGE, p * PAGE, toIST(range.from), toIST(range.to))
      .then(r => { if (id !== req.current) return; setFiles(Array.isArray(r?.files) ? r.files : []); setTotal(r?.total ?? 0); setPage(p); })
      .catch(() => { if (id === req.current) setFailed(true); });
  }, [deviceId]);
  React.useEffect(() => { load(0, { from: '', to: '' }); }, [load]);

  const apply = (range: { from: string; to: string }) => { setFrom(range.from); setTo(range.to); setApplied(range); setViewing(null); viewingId.current = null; load(0, range); };
  const fetchRange = () => apply({ from, to });
  // Quick ranges end now (India time, the same clock the date boxes use).
  const ist = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T');
  const lastHours = (h: number) => apply({ from: ist(new Date(Date.now() - h * 3_600_000)), to: '' });
  const go = (p: number) => { setViewing(null); viewingId.current = null; load(p, applied); };

  const viewingId = useRef<number | null>(null);
  const view = useCallback((f: LogFile) => {
    if (viewingId.current === f.id) { viewingId.current = null; setViewing(null); return; }
    viewingId.current = f.id; setShowAll(false);
    apiService.getDeviceLogFileContent(deviceId, f.id)
      .then(text => { if (viewingId.current === f.id) setViewing({ id: f.id, text }); })
      .catch(() => { viewingId.current = null; setMsg("Couldn't open that log file."); });
  }, [deviceId]);
  const download = useCallback((f: LogFile) => {
    apiService.downloadDeviceLogFile(deviceId, f.id).catch(() => setMsg("Couldn't download that log file."));
  }, [deviceId]);

  const task = async (call: () => Promise<void>, fail: (e: Error) => string) => {
    setWork(true); setMsg(null);
    try { await call(); } catch (e) { setMsg(fail(e as Error)); } finally { setWork(false); }
  };
  const runScan = () => task(async () => setScan(await apiService.scanDeviceLogFiles(deviceId, scanDate)), () => "Couldn't scan those logs. Try again.");
  const downloadAll = () => task(
    () => apiService.bulkDownloadLogFiles(deviceId, toIST(applied.from), toIST(applied.to)),
    e => (e.message && e.message.length < 200 ? e.message : "Couldn't download the log files. Narrow the date range and try again."));

  const lines = viewing ? viewLines(viewing.text, problemsOnly) : [];
  const shown = showAll ? lines : lines.slice(0, VIEW_LINES);
  const input: React.CSSProperties = { minHeight: 44, padding: '0 10px', borderRadius: 10, border: `1px solid ${t.line}`, background: t.card2, color: t.ink, font: 'inherit' };
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);

  return (
    <section aria-label="Log files" style={{ background: t.card, border: `1px solid ${t.line}`, borderRadius: 18, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', minHeight: 40, fontFamily: t.head, fontSize: '1.02rem' }}>Logs</h3>
      <span style={{ fontSize: '0.78rem', color: t.ink2 }}>Log files are kept for 90 days. Times are India time.</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="datetime-local" aria-label="From" value={from} onChange={e => setFrom(e.target.value)} style={input} />
        <input type="datetime-local" aria-label="To" value={to} onChange={e => setTo(e.target.value)} style={input} />
        <Btn isDark={isDark} size="sm" variant="soft" onClick={fetchRange}>Fetch</Btn>
        <Btn isDark={isDark} size="sm" variant="plain" onClick={() => lastHours(24)}>Last 24 hours</Btn>
        <Btn isDark={isDark} size="sm" variant="plain" onClick={() => lastHours(168)}>Last 7 days</Btn>
        {(applied.from || applied.to) && <Btn isDark={isDark} size="sm" variant="plain" onClick={() => apply({ from: '', to: '' })}>Reset</Btn>}
        <Btn isDark={isDark} size="sm" variant="plain" disabled={work || !total} onClick={downloadAll}>Download all</Btn>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" aria-label="Scan day" value={scanDate} max={today()} onChange={e => setScanDate(e.target.value)} style={input} />
        <Btn isDark={isDark} size="sm" variant="plain" disabled={work || !scanDate} onClick={runScan}>Scan this day</Btn>
      </div>
      {scan && <p style={{ margin: 0, fontSize: '0.88rem', color: t.ink2 }}>{scan.files_scanned === 0 ? 'No log files from that day to check.'
        : `Checked ${plural(scan.files_scanned, 'log file')}: ${plural(scan.total_errors, 'error')}, ${plural(scan.total_warnings, 'warning')}.`}</p>}
      {msg && <p role="status" style={{ margin: 0, fontSize: '0.86rem', color: t.waitInk }}>{msg}</p>}

      {failed ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.88rem', color: t.ink2 }}>
          Couldn't load the log files. <Btn isDark={isDark} size="sm" variant="soft" onClick={() => load(page, applied)}>Try again</Btn>
        </div>
      ) : files === null ? <span style={{ fontSize: '0.88rem', color: t.ink2 }}>Loading log files…</span>
        : files.length === 0 ? <span style={{ fontSize: '0.88rem', color: t.ink2 }}>No log files in this range.</span>
        : <>
          <span style={{ fontSize: '0.8rem', color: t.ink2 }}>{plural(total, 'file')}</span>
          {files.map(f => <Row key={f.id} f={f} isDark={isDark} open={viewing?.id === f.id} onView={view} onDownload={download} />)}
          {viewing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: '0.88rem' }}>
                <input type="checkbox" checked={problemsOnly} onChange={e => setProblemsOnly(e.target.checked)} style={{ width: 20, height: 20 }} />
                Errors and warnings only
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 44, fontSize: '0.88rem' }}>
                <input type="checkbox" checked={wrap} onChange={e => setWrap(e.target.checked)} style={{ width: 20, height: 20 }} />
                Wrap long lines
              </label>
              <pre style={{ margin: 0, maxHeight: 320, overflow: 'auto', fontSize: '0.78rem', fontFamily: "'Fira Code', monospace", whiteSpace: wrap ? 'pre-wrap' : 'pre', background: t.card2, borderRadius: 8, padding: 8 }}>{shown.join('\n') || 'Nothing to show.'}</pre>
              {!showAll && lines.length > VIEW_LINES && <Btn isDark={isDark} size="sm" variant="plain" onClick={() => setShowAll(true)}>Show all {lines.length} lines</Btn>}
            </div>
          )}
          {total > PAGE && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Btn isDark={isDark} size="sm" variant="plain" disabled={page === 0} onClick={() => go(page - 1)}>Newer</Btn>
              <span style={{ fontSize: '0.8rem', color: t.ink2 }}>Page {page + 1} of {lastPage + 1}</span>
              <Btn isDark={isDark} size="sm" variant="plain" disabled={page >= lastPage} onClick={() => go(page + 1)}>Older</Btn>
            </div>
          )}
        </>}
    </section>
  );
};

export default LogsCard;
