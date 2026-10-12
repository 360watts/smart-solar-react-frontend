import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../../../services/api';
import { useTokens, Btn, ConfirmDialog } from '../siteHardware/ui';
import { clearDeviceCache } from './deviceCache';
import { firmwareKind, inspectFirmwareBin, type FirmwareInfo } from '../firmwareImage';

// Firmware library for one device type: upload, activate, deactivate. Shown with device control (admins, and viewers with device operations on); the backend blocks it when that switch is off and audits every change.
// Activating a build lets every device of that type receive it, so each change asks first. Deploying to many devices stays on the OTA page.

type Build = { id: number; version: string; device_type?: string | null; is_active?: boolean; created_at?: string; size?: number };
type Ask = { build: Build; activate: boolean } | null;

/** The upload route answers {"error": "..."}; api.ts wraps it as "Upload failed: 400 - {...}". Keep the sentence. */
const uploadError = (e: unknown) => {
  const raw = e instanceof Error ? e.message : '';
  try { return JSON.parse(raw.slice(raw.indexOf('{'))).error as string; } catch { return "Couldn't upload that build. Check the file and version, then try again."; }
};

const BuildsCard: React.FC<{ isDark: boolean; deviceType: string; kindLabel: string; onChanged?: () => void }> = ({ isDark, deviceType, kindLabel, onChanged }) => {
  const t = useTokens(isDark);
  const kind = firmwareKind(deviceType);
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState(false);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [seen, setSeen] = useState<FirmwareInfo | null>(null); // what the file itself says: chip, version, device kind
  const [pct, setPct] = useState<number | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    apiService.getFirmwareVersions(false)
      .then((r: Build[]) => setBuilds((Array.isArray(r) ? r : []).filter(b => !b.device_type || b.device_type === kind)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))))
      .catch(() => setFailed(true));
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  // Same as the OTA page: read the image header and fill blanks only, so anything already typed is kept.
  const pick = async (f?: File) => {
    setSeen(null);
    if (!f) return;
    try {
      const info = inspectFirmwareBin(await f.arrayBuffer(), f.name);
      if (!info) return;
      setSeen(info);
      setVersion(v => v || info.version);
      setName(n => n || info.name);
    } catch { /* best effort */ }
  };
  const wrongKind = !!seen?.usageType && seen.usageType !== kind;
  const changed = () => { clearDeviceCache(); load(); onChanged?.(); };
  const confirm = async () => {
    if (!ask) return;
    setBusy(true); setMsg(null);
    try {
      await apiService.updateFirmwareVersion(ask.build.id, { is_active: ask.activate });
      setMsg({ ok: true, text: `${ask.build.version} ${ask.activate ? 'activated' : 'deactivated'}.` });
      changed();
    } catch { setMsg({ ok: false, text: "Couldn't change that build. Try again." }); }
    finally { setBusy(false); setAsk(null); }
  };
  const upload = async () => {
    const f = file.current?.files?.[0];
    if (!f || !version.trim()) { setMsg({ ok: false, text: 'Choose a file and enter its version.' }); return; }
    if (wrongKind) { setMsg({ ok: false, text: `This file is for a different kind of device than ${kindLabel.toLowerCase()}.` }); return; }
    const fd = new FormData();
    fd.append('file', f); fd.append('version', version.trim()); fd.append('device_type', kind); fd.append('description', name);
    fd.append('release_notes', notes); fd.append('is_active', 'false'); // uploaded inactive: activating is a separate, confirmed step
    setBusy(true); setMsg(null); setPct(0);
    try {
      const res = await apiService.uploadFirmwareVersion(fd, setPct);
      const warn = res?.storage_warning ? ` Warning: ${res.storage_warning}` : '';
      setMsg({ ok: !warn, text: `${version.trim()} uploaded${res?.size ? ` (${(res.size / 1048576).toFixed(1)} MB)` : ''}. Activate it when it is ready.${warn}` });
      setForm(false); setVersion(''); setNotes(''); setName(''); setSeen(null);
      changed();
    } catch (e) { setMsg({ ok: false, text: uploadError(e) }); }
    finally { setBusy(false); setPct(null); }
  };

  const input: React.CSSProperties = { minHeight: 44, padding: '0 10px', borderRadius: 10, border: `1px solid ${t.line}`, background: t.card2, color: t.ink, font: 'inherit', boxSizing: 'border-box' };
  return (
    <section aria-label="Builds" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 22, border: `1px solid ${t.line}`, borderRadius: 18, background: t.card }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 40 }}>
        <h3 style={{ margin: 0, fontFamily: t.head, fontSize: '1.02rem' }}>Builds <span style={{ fontSize: '0.8rem', fontWeight: 400, color: t.ink2 }}>· {kindLabel}</span></h3>
        <Btn isDark={isDark} size="sm" variant="primary" onClick={() => setForm(f => !f)}>{form ? 'Cancel' : 'Upload build'}</Btn>
      </div>
      {msg && <p role="status" style={{ margin: 0, fontSize: '0.86rem', color: msg.ok ? t.goodInk : t.waitInk }}>{msg.text}</p>}
      {form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input ref={file} type="file" accept=".bin" aria-label="Firmware file" style={input} onChange={e => pick(e.target.files?.[0])} />
          {seen && <span style={{ fontSize: '0.8rem', color: wrongKind ? t.waitInk : t.ink2 }}>
            Read from file: {seen.chip ?? 'unknown chip'}{seen.usageType && ` · ${seen.usageType === 'energymeter' ? 'Whole-home meter' : 'Inverter monitor'}`}{wrongKind && '. This is not the right kind for this device.'}
          </span>}
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" aria-label="Name" style={input} />
          <input value={version} onChange={e => setVersion(e.target.value)} placeholder="Version, for example 1.1.0" aria-label="Version" style={input} />
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Release notes (optional)" aria-label="Release notes" style={input} />
          <div><Btn isDark={isDark} size="sm" variant="soft" disabled={busy || wrongKind} onClick={upload}>{pct != null ? `Uploading ${pct}%` : 'Upload'}</Btn></div>
        </div>
      )}
      {failed ? <span style={{ fontSize: '0.88rem', color: t.ink2 }}>Couldn't load the builds. <Btn isDark={isDark} size="sm" variant="soft" onClick={load}>Try again</Btn></span>
        : builds === null ? <span style={{ fontSize: '0.88rem', color: t.ink2 }}>Loading builds…</span>
        : builds.length === 0 ? <span style={{ fontSize: '0.88rem', color: t.ink2 }}>No builds uploaded for this device type yet.</span>
        : builds.map(b => (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 56, borderTop: `1px solid ${t.line2}` }}>
            <span style={{ fontSize: '0.92rem' }}>
              {b.version}
              <span style={{ display: 'block', fontSize: '0.78rem', color: t.ink2 }}>
                {[b.size && `${(b.size / 1048576).toFixed(1)} MB`, b.created_at && new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: b.is_active ? t.goodInk : t.ink2 }}>{b.is_active ? 'Active' : 'Inactive'}</span>
              <Btn isDark={isDark} size="sm" variant="plain" aria-label={`${b.is_active ? 'Deactivate' : 'Activate'} ${b.version}`} onClick={() => setAsk({ build: b, activate: !b.is_active })}>
                {b.is_active ? 'Deactivate' : 'Activate'}
              </Btn>
            </span>
          </div>
        ))}
      <span style={{ fontSize: '0.78rem', color: t.ink2 }}>Activating a build lets any device of this type receive it. Updating many devices at once stays on the OTA page.</span>
      <ConfirmDialog
        isDark={isDark}
        open={!!ask}
        tone={ask?.activate ? 'danger' : 'primary'}
        title={ask ? `${ask.activate ? 'Activate' : 'Deactivate'} ${ask.build.version}?` : ''}
        body={ask?.activate ? `Every ${kindLabel.toLowerCase()} will be able to receive this build.` : `${kindLabel}s will no longer be offered this build.`}
        confirmLabel={ask?.activate ? 'Activate' : 'Deactivate'}
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setAsk(null)}
      />
    </section>
  );
};

export default BuildsCard;
