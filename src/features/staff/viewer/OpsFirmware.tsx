import { Download, Upload } from 'lucide-react';
import { EmptyState, Notice } from '../../../shared/components/Feedback';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import { useAccess } from '../../../shared/access/useAccess';
import { useAuth } from '../../../contexts/AuthContext';
import { ConfirmDialog } from '../siteHardware/ui';
import { firmwareKind } from '../firmwareImage';
import { clearDeviceCache } from './deviceCache';
import { TableSkeleton } from './Skeleton';
import type { Dev, Firmware } from './DevicePage';
import './opsFirmware.css';

// Firmware library: the shared builds, and upload. The backend decides who may do what (create/update need device operations, delete is admin only) and audits it; this page only hides what the role cannot use.
// Left out on purpose: "Devices on it" and "uploaded by" (the list does not return them; the fleet aggregate is employee-only).

const MAX = 8 * 1048576;
const KINDS: [string, string][] = [['gateway', 'Gateway'], ['energymeter', 'Meter']];
const kindName = (k?: string | null) => KINDS.find(([v]) => v === k)?.[1] ?? k ?? 'Any';
type Ask = { b: Firmware; kind: 'on' | 'off' | 'del' } | null;
type Msg = { ok: boolean; text: string } | null;

/** api.ts wraps the upload answer as "Upload failed: 400 - {...}". */
function uploadError(e: unknown) {
  const raw = e instanceof Error ? e.message : '';
  if (raw.includes(' 403')) return 'You are not allowed to upload builds. Ask an admin to turn on device operations for you.';
  try { return JSON.parse(raw.slice(raw.indexOf('{'))).error as string; } catch { return "Couldn't upload that build. Check the file and build number, then try again."; }
}

export default function OpsFirmware({ dev, isDark }: { dev: Dev; firmware?: Firmware[] | null; isDark: boolean }) {
  const ctl = useAccess().can('device_control');
  const { isAdmin } = useAuth();
  const mine = firmwareKind(dev.device_type);
  const [builds, setBuilds] = useState<Firmware[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [tab, setTab] = useState<'lib' | 'up'>('lib');
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [kind, setKind] = useState(mine);
  const [notes, setNotes] = useState('');
  const [live, setLive] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    return apiService.getFirmwareVersions(false)
      .then((r: Firmware[]) => setBuilds((Array.isArray(r) ? r : []).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))))
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = (builds ?? []).filter(b => all || !b.device_type || b.device_type === mine);
  const changed = () => { clearDeviceCache(); return load(); };

  const take = (f?: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.bin')) { setFile(null); setMsg({ ok: false, text: 'That is not a .bin file. Choose the firmware file ending in .bin.' }); return; }
    if (f.size > MAX) { setFile(null); setMsg({ ok: false, text: 'That file is bigger than 8 MB. Check that it is the right firmware file.' }); return; }
    setMsg(null); setFile(f);
  };
  const reset = () => { setFile(null); setVersion(''); setNotes(''); setLive(false); setKind(mine); setPct(null); if (pick.current) pick.current.value = ''; };

  const confirm = async () => {
    if (!ask) return;
    const { b, kind: k } = ask;
    setBusy(true); setMsg(null);
    try {
      if (k === 'del') await apiService.deleteFirmwareVersion(b.id);
      else await apiService.updateFirmwareVersion(b.id, { is_active: k === 'on' });
      setMsg({ ok: true, text: `${b.version} ${k === 'del' ? 'deleted' : k === 'on' ? 'activated' : 'deactivated'}.` });
      await changed();
    } catch {
      setMsg({ ok: false, text: k === 'del' ? `${b.version} can't be deleted. Devices may be running it, or you may not be allowed. Deactivate it instead.` : "Couldn't change that build. Try again, or ask an admin." });
    } finally { setBusy(false); setAsk(null); }
  };

  const upload = async () => {
    const v = version.trim();
    if (!file || !v) { setMsg({ ok: false, text: 'Choose a file and enter a build number.' }); return; }
    const fd = new FormData();
    fd.append('file', file); fd.append('version', v); fd.append('device_type', kind);
    fd.append('description', ''); fd.append('release_notes', notes); fd.append('is_active', String(live));
    setBusy(true); setMsg(null); setPct(0);
    try {
      await apiService.uploadFirmwareVersion(fd, setPct);
      setMsg({ ok: true, text: `${v} uploaded. ${live ? 'It is available now.' : 'Activate it from Builds when it is ready.'}` });
      reset(); setTab('lib'); await changed();
    } catch (e) { setMsg({ ok: false, text: uploadError(e) }); }
    finally { setBusy(false); setPct(null); }
  };

  const Switch = ({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) =>
    <button type="button" role="switch" aria-checked={on} className="ofw-tg" onClick={() => set(!on)}><span className="ofw-sw" aria-hidden="true" />{label}</button>;
  const goUp = () => { setMsg(null); setTab('up'); };

  return (
    <>
      <div role="tablist" aria-label="Firmware" className="ofw-tabs">
        <button type="button" role="tab" aria-selected={tab === 'lib'} className="ofw-gt" onClick={() => setTab('lib')}>Builds {builds && <span className="ops-cnt">{shown.length}</span>}</button>
        {ctl && <button type="button" role="tab" aria-selected={tab === 'up'} className="ofw-gt" onClick={goUp}>Upload a build</button>}
      </div>
      {msg && <Notice role={msg.ok ? 'status' : 'alert'} tone={msg.ok ? 'ok' : 'bad'}>{msg.text}</Notice>}

      {tab === 'lib' && (
        <section className="ofw-card" aria-label="Firmware builds">
          <div className="ofw-top"><Switch on={all} set={setAll} label="Show all builds" /></div>
          {failed ? <EmptyState title="Couldn't load the builds" description="The server didn't answer. The device is not affected." onRetry={load} />
            : builds === null ? <TableSkeleton rows={4} cols={5} />
            : shown.length === 0 ? <EmptyState icon={Download} title="No builds yet" description="Uploaded builds for this device type show up here." action={ctl ? { label: 'Upload a build', icon: Upload, onClick: goUp } : undefined} />
            : (
              <div className="ofw-scroll"><table>
                <thead><tr><th scope="col">Build</th><th scope="col">Device</th><th scope="col">Uploaded</th><th scope="col">Size</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{shown.map(b => (
                  <tr key={b.id}>
                    <td><div className="ofw-num">{b.version}</div>{b.release_notes && <div className="ops-meta">{b.release_notes}</div>}</td>
                    <td>{kindName(b.device_type)}</td>
                    <td className="ops-meta">{b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</td>
                    <td className="ofw-num ops-meta">{b.size ? `${(b.size / 1048576).toFixed(1)} MB` : ''}</td>
                    <td><span className={`ops-st ${b.is_active ? 'ok' : 'none'}`}>{b.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="ofw-act">{ctl && <>
                      <button type="button" className={`ops-btn sm${b.is_active ? '' : ' pri'}`} aria-label={`${b.is_active ? 'Deactivate' : 'Activate'} ${b.version}`} onClick={() => setAsk({ b, kind: b.is_active ? 'off' : 'on' })}>{b.is_active ? 'Deactivate' : 'Activate'}</button>
                      {isAdmin && <button type="button" className="ops-btn sm" aria-label={`Delete ${b.version}`} onClick={() => setAsk({ b, kind: 'del' })}>Delete</button>}
                    </>}</td>
                  </tr>))}
                </tbody>
              </table></div>
            )}
          <div className="ofw-foot"><span className="ops-meta">{isAdmin
            ? "A build that devices are running cannot be deleted. Deactivate it so no one can pick it."
            : 'Delete is for admins and is not shown to you. A build that devices are running cannot be deleted. Deactivate it so no one can pick it, then ask an admin.'}</span></div>
        </section>
      )}

      {tab === 'up' && ctl && (
        <section className="ofw-card ofw-form" aria-label="Upload a firmware build">
          <div className="ofw-drop" data-testid="dropzone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); take(e.dataTransfer.files?.[0]); }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
            <div style={{ fontWeight: 600 }}>{file ? file.name : 'Drop the .bin file here, or choose it'}</div>
            <div className="ops-meta">{file ? `${(file.size / 1048576).toFixed(1)} MB` : 'We read the size and a checksum for you. Up to 8 MB.'}</div>
            <input ref={pick} type="file" accept=".bin" aria-label="Firmware file" hidden onChange={e => take(e.target.files?.[0])} />
            <button type="button" className="ops-btn sm" onClick={() => pick.current?.click()}>Choose file</button>
          </div>
          <div className="ofw-grid">
            <label className="ofw-lbl">Build number<input className="ofw-in ofw-num" value={version} onChange={e => setVersion(e.target.value)} placeholder="2.2.6-rc1" /></label>
            <label className="ofw-lbl">For which device<select className="ofw-in" value={kind} onChange={e => setKind(e.target.value)}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="ofw-lbl" style={{ gridColumn: '1/-1' }}>What changed<textarea className="ofw-in" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="One or two lines. Testers read this before they install." /></label>
          </div>
          {pct !== null && <div role="progressbar" aria-label="Upload progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="ofw-bar"><span style={{ width: `${pct}%` }} /></div>}
          <div className="ofw-row">
            <Switch on={live} set={setLive} label="Make it available right away" />
            <span style={{ flex: 1 }} />
            <button type="button" className="ops-btn" disabled={busy} onClick={() => { reset(); setMsg(null); setTab('lib'); }}>Cancel</button>
            <button type="button" className="ops-btn pri" disabled={busy} onClick={upload}>Upload build</button>
          </div>
          <Notice more="You can activate or deactivate it later from Builds.">Nothing is installed on a device until someone runs Update firmware on it.</Notice>
        </section>
      )}

      <ConfirmDialog isDark={isDark} open={!!ask} tone={ask?.kind === 'on' ? 'primary' : 'danger'}
        title={ask ? `${ask.kind === 'del' ? 'Delete' : ask.kind === 'on' ? 'Activate' : 'Deactivate'} ${ask.b.version}?` : ''}
        body={ask?.kind === 'del' ? 'The build is removed for everyone. This cannot be undone.' : ask?.kind === 'on' ? `Everyone testing ${kindName(ask.b.device_type).toLowerCase()}s will be able to pick this build.` : `No one will be able to pick this build until it is activated again.`}
        confirmLabel={ask?.kind === 'del' ? 'Delete' : ask?.kind === 'on' ? 'Activate' : 'Deactivate'} cancelLabel="Keep it"
        busy={busy} onConfirm={confirm} onCancel={() => setAsk(null)} />
    </>
  );
}
