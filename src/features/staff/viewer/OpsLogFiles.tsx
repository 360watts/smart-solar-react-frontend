import { Clock, FileText } from 'lucide-react';
import { EmptyState, Notice } from '../../../shared/components/Feedback';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { apiService } from '../../../services/api';
import { viewRows } from './LogsCard';
import { ListSkeleton } from './Skeleton';
import './opsLogs.css';

// Operations > Logs: a compact toolbar and a master-detail file list / viewer. Scenarios: docs/test-scenarios/viewer-operations-flex.md (LG1-LG13).
// Not LogsCard: that one still serves the older device page.

const PAGE = 20;
const VIEW_LINES = 300;
type LogFile = { id: number; filename?: string; name?: string; file_size?: number; created_at?: string; uploaded_at?: string };
type Range = { from: string; to: string };

const at = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const toIST = (v: string) => (v ? new Date(`${v}:00+05:30`).toISOString() : undefined);
// Quick ranges end now and use India time, the same clock the date boxes use.
const ist = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T');
const fname = (f: LogFile) => f.filename || f.name || `Log ${f.id}`;

type Chip = '24h' | '7d' | 'custom' | 'all';

export default function OpsLogFiles({ deviceId }: { deviceId: number; isDark?: boolean }) {
  const [params] = useSearchParams();
  const settingsHref = (() => { const n = new URLSearchParams(params); n.set('ops', 'settings'); return `?${n}`; })();
  const [chip, setChip] = useState<Chip>('all');
  const [custom, setCustom] = useState<Range>({ from: '', to: '' });
  const [applied, setApplied] = useState<Range>({ from: '', to: '' }); // the range last fetched; Download all uses it so it matches the list
  const [files, setFiles] = useState<LogFile[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<{ file: LogFile; text: string | null } | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [work, setWork] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const req = useRef(0); // drops list answers that arrive after a newer request
  const viewingId = useRef<number | null>(null); // drops file answers that arrive after another row was clicked

  const load = useCallback((p: number, range: Range) => {
    const id = ++req.current;
    setFailed(false);
    apiService.getDeviceLogFiles(deviceId, PAGE, p * PAGE, toIST(range.from), toIST(range.to))
      .then(r => { if (id !== req.current) return; setFiles(Array.isArray(r?.files) ? r.files : []); setTotal(r?.total ?? 0); setPage(p); })
      .catch(() => { if (id === req.current) setFailed(true); });
  }, [deviceId]);
  useEffect(() => { load(0, { from: '', to: '' }); }, [load]);

  const close = () => { viewingId.current = null; setSel(null); };
  const apply = (range: Range, c: Chip) => { setChip(c); setApplied(range); setMsg(null); close(); load(0, range); };
  const lastHours = (h: number, c: Chip) => apply({ from: ist(new Date(Date.now() - h * 3_600_000)), to: '' }, c);
  const go = (p: number) => { close(); load(p, applied); };

  const open = (f: LogFile) => {
    if (viewingId.current === f.id) return;
    viewingId.current = f.id; setSel({ file: f, text: null }); setShowAll(false); setMsg(null);
    apiService.getDeviceLogFileContent(deviceId, f.id)
      .then(text => { if (viewingId.current === f.id) setSel({ file: f, text }); })
      .catch(() => { if (viewingId.current === f.id) { viewingId.current = null; setSel(null); } setMsg("Couldn't open that log file."); });
  };
  const download = (f: LogFile) => { apiService.downloadDeviceLogFile(deviceId, f.id).catch(() => setMsg("Couldn't download that log file.")); };

  const task = async (call: () => Promise<void>, fail: (e: Error) => string) => {
    setWork(true); setMsg(null);
    try { await call(); } catch (e) { setMsg(fail(e as Error)); } finally { setWork(false); }
  };
  const downloadAll = () => task(
    () => apiService.bulkDownloadLogFiles(deviceId, toIST(applied.from), toIST(applied.to)),
    e => (e.message && e.message.length < 200 ? e.message : "Couldn't download the log files. Narrow the date range and try again."));

  const rows = sel?.text != null ? viewRows(sel.text, problemsOnly) : [];
  const shown = showAll ? rows : rows.slice(0, VIEW_LINES);
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);
  const chipBtn = (c: Chip, label: string, onClick: () => void) =>
    <button type="button" className="ops-pill" aria-pressed={chip === c} onClick={onClick}>{label}</button>;
  const sw = (label: string, on: boolean, set: (v: boolean) => void) =>
    <button type="button" role="switch" aria-checked={on} className="ofw-tg" onClick={() => set(!on)}><span className="ofw-sw" aria-hidden="true" />{label}</button>;

  return (
    <section aria-label="Log files" className="olg">
      <div className="olg-bar">
        <div className="ops-btns">
          {chipBtn('24h', 'Last 24 hours', () => lastHours(24, '24h'))}
          {chipBtn('7d', 'Last 7 days', () => lastHours(168, '7d'))}
          {chipBtn('custom', 'Custom', () => setChip('custom'))}
          <button type="button" className="ops-btn" disabled={work || !total} onClick={downloadAll}>Download all ({total})</button>
        </div>
      </div>
      {chip === 'custom' && (
        <div className="ops-btns">
          <input type="datetime-local" className="ofw-in olg-in" aria-label="From" value={custom.from} onChange={e => setCustom({ ...custom, from: e.target.value })} />
          <input type="datetime-local" className="ofw-in olg-in" aria-label="To" value={custom.to} onChange={e => setCustom({ ...custom, to: e.target.value })} />
          <button type="button" className="ops-btn pri" onClick={() => apply(custom, 'custom')}>Apply</button>
        </div>
      )}
      {msg && <Notice role="status" tone="bad">{msg}</Notice>}

      {failed ? (
        <EmptyState title="Couldn't load the log files" description="The server didn't answer. The device is not affected." onRetry={() => load(page, applied)} />
      ) : files === null ? <ListSkeleton />
        : files.length === 0 ? (
          <EmptyState icon={FileText} title="No log files in this range"
            description={<>Turn on Send logs in <Link to={settingsHref} replace>Settings</Link> so the gateway uploads its files after each restart.</>} />
        ) : (
          <div className="olg-split">
            <div className="olg-listcol">
              <ul className="ops-list olg-list">
                {files.map(f => {
                  const when = f.uploaded_at || f.created_at;
                  return (
                    <li key={f.id} className={`olg-file${sel?.file.id === f.id ? ' sel' : ''}`}>
                      <button type="button" className="olg-open" aria-label={`Open ${fname(f)}`} aria-current={sel?.file.id === f.id ? 'true' : undefined} onClick={() => open(f)}>
                        <span className="olg-name">{fname(f)}</span>
                        <span className="ops-hint">{[when && at(when), f.file_size != null && `${(f.file_size / 1024).toFixed(0)} KB`].filter(Boolean).join(' · ')}</span>
                      </button>
                      <button type="button" className="olg-ico" aria-label={`Download ${fname(f)}`} title="Download" onClick={() => download(f)}><Download size={18} aria-hidden="true" /></button>
                    </li>
                  );
                })}
              </ul>
              {total > PAGE && (
                <div className="ops-btns">
                  <button type="button" className="ops-btn sm" disabled={page === 0} onClick={() => go(page - 1)}>Newer</button>
                  <span className="ops-meta">Page {page + 1} of {lastPage + 1}</span>
                  <button type="button" className="ops-btn sm" disabled={page >= lastPage} onClick={() => go(page + 1)}>Older</button>
                </div>
              )}
            </div>
            <div className="olg-view">
              {!sel ? <p className="ops-meta olg-pick">Pick a log file to read it.</p> : (
                <>
                  <div className="olg-vhead">
                    <h3>{fname(sel.file)}</h3>
                    {sw('Errors and warnings only', problemsOnly, setProblemsOnly)}
                    {sw('Wrap lines', wrap, setWrap)}
                    <button type="button" className="ops-btn sm" onClick={() => download(sel.file)}>Download</button>
                  </div>
                  {sel.text == null ? <ListSkeleton rows={4} /> : (
                    <pre className={`olg-body${wrap ? ' wrap' : ''}`}>
                      {shown.length ? shown.map((r, i) => <span key={i} className={r.lvl === 'E' ? 'lvl-e' : r.lvl === 'W' ? 'lvl-w' : undefined}>{r.text + '\n'}</span>) : 'Nothing to show.'}
                    </pre>
                  )}
                  {!showAll && rows.length > VIEW_LINES && <button type="button" className="ops-btn sm" onClick={() => setShowAll(true)}>Show all {rows.length} lines</button>}
                </>
              )}
            </div>
          </div>
        )}
      <Notice icon={Clock} more="All times are India time.">Log files are kept for 90 days.</Notice>
    </section>
  );
}
