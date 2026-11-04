// Dialogs for the OTA page: send a build to ticked devices, send one build to chosen devices, upload, roll back.
// Any version may go anywhere it fits (newer, older, tagged); downgrades are named, never blocked.
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { apiService } from '../../../services/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../shared/ui/dialog';
import { Input } from '../../../shared/ui/input';
import { Textarea } from '../../../shared/ui/textarea';
import { inspectFirmwareBin, type FirmwareInfo } from '../firmwareImage';
import { type Build, type OtaDevice, compareVersions, direction, fits, runningCount } from './otaModel';

export const TYPE_LABEL: Record<string, string> = { gateway: 'Gateway', energy_meter: 'Energy meter', energymeter: 'Energy meter' };
export const mb = (bytes: number) => `${(bytes / 1048576).toFixed(2)} MB`;
export const ago = (iso: string | null) => {
  if (!iso) return 'Never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
};
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const DIR_STYLE = { up: 'bg-primary/10 text-primary', down: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', same: 'bg-muted text-muted-foreground' };
const DIR_WORD = { up: 'newer', down: 'older', same: 'same' };
export function DirTag({ from, to }: { from: string | null; to: string }) {
  if (!from) return null;
  const d = direction(from, to);
  return <span className={`ml-1.5 rounded-md px-1.5 py-px text-xs font-medium ${DIR_STYLE[d]}`}>{DIR_WORD[d]}</span>;
}

function Shell({ open, onClose, title, description, children, footer }: {
  open: boolean; onClose: () => void; title: string; description?: React.ReactNode; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[22px] bg-card sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description && <DialogDescription className="text-sm">{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Deploy one build to the given devices, skipping those already on it, and report what the backend skipped. */
async function deploy(build: Build, devices: OtaDevice[]): Promise<boolean> {
  const serials = devices.filter(d => direction(d.run, build.version) !== 'same').map(d => d.serial);
  if (!serials.length) return false;
  try {
    const res = await apiService.deployFirmware(build.id, serials, `${build.version} to ${plural(serials.length, 'device')} from the OTA page`);
    toast.success(`Sent ${build.version} to ${plural(res.devices_total ?? serials.length, 'device')}. Each one downloads it at its next check-in.`);
    if (res.warning) toast.warning(`Some devices were skipped: ${res.warning}.`);
    return true;
  } catch (e) {
    toast.error(errText(e, 'Could not send the build. Try again.'));
    return false;
  }
}

function Counts({ build, devices }: { build: Build; devices: OtaDevice[] }) {
  const n = { up: 0, down: 0, same: 0 };
  devices.forEach(d => { n[direction(d.run, build.version)]++; });
  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span><b className="font-mono">{n.up}</b> move up</span>
        <span><b className="font-mono">{n.down}</b> go back to an older version</span>
        <span><b className="font-mono">{n.same}</b> already on it, skipped</span>
      </div>
      {n.down > 0 && (
        <p className="m-0 rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm">
          {plural(n.down, 'device')} will be downgraded to {build.version}. Settings added in newer builds may be lost.
        </p>
      )}
    </>
  );
}

/** Ticked devices → pick any build that fits all of them. */
export function SendToDevicesDialog({ devices, builds, onClose, onDone }: {
  devices: OtaDevice[]; builds: Build[]; onClose: () => void; onDone: () => void;
}) {
  const options = useMemo(
    () => builds.filter(b => devices.every(d => fits(b, d))).sort((a, b) => compareVersions(b.version, a.version)),
    [builds, devices],
  );
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const build = options.find(b => b.id === pick) ?? null;
  const moving = build ? devices.filter(d => direction(d.run, build.version) !== 'same').length : 0;
  const mixed = new Set(devices.map(d => d.type)).size > 1;

  async function send() {
    if (!build) return;
    setBusy(true);
    if (await deploy(build, devices)) onDone();
    setBusy(false);
  }

  return (
    <Shell open onClose={onClose} title={`Send a build to ${plural(devices.length, 'device')}`}
      description="Any build that fits these devices: newer, older or a test build."
      footer={<>
        <button type="button" className="ui-btn ui-btn--link" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn ui-btn--main" disabled={!build || !moving || busy} onClick={send}>
          {busy ? 'Sending…' : build ? `Send ${build.version}` : 'Send'}
        </button>
      </>}>
      {options.length === 0 ? (
        <p className="m-0 rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm">
          {mixed ? 'Gateways and energy meters take different builds.' : 'No uploaded build fits all of these devices (their chips differ, or none is uploaded for them).'}
          {' '}Filter to one type and chip, then tick again.
        </p>
      ) : (
        <div role="radiogroup" aria-label="Build" className="[display:grid] max-h-[300px] gap-1.5 overflow-y-auto">
          {options.map(b => (
            <label key={b.id} className={`[display:grid] cursor-pointer grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-xl border px-3 py-2.5 ${pick === b.id ? 'border-primary bg-primary/10' : 'border-border'}`}>
              <input type="radio" name="ota-build" className="accent-primary" checked={pick === b.id} onChange={() => setPick(b.id)} />
              <span className="min-w-0">
                <span className="font-mono">{b.version}</span>
                {b.on && <span className="ml-1.5 rounded-md bg-primary/10 px-1.5 py-px text-xs font-medium text-primary">on</span>}
                <span className="block truncate text-sm text-muted-foreground">{b.notes || 'No notes'} · {ago(b.uploadedAt)}</span>
              </span>
              <span className="font-mono text-sm text-muted-foreground">{runningCount(b, devices)} on it</span>
            </label>
          ))}
        </div>
      )}
      {build && <Counts build={build} devices={devices} />}
    </Shell>
  );
}

type Dir = 'older' | 'newer' | 'all';
/** One build → choose which fitting devices get it. Starts on "older version" (the usual roll-out). */
export function SendBuildDialog({ build, devices, onClose, onDone }: {
  build: Build; devices: OtaDevice[]; onClose: () => void; onDone: () => void;
}) {
  const fitting = useMemo(() => devices.filter(d => fits(build, d)), [build, devices]);
  const [dir, setDir] = useState<Dir>('older');
  const shown = fitting.filter(d => {
    const m = direction(d.run, build.version);
    return dir === 'all' ? m !== 'same' : dir === 'older' ? m === 'up' : m === 'down';
  });
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(fitting.filter(d => direction(d.run, build.version) === 'up').map(d => d.serial)));
  const chosen = shown.filter(d => ticked.has(d.serial));
  const [busy, setBusy] = useState(false);

  function changeDir(next: Dir) {
    setDir(next);
    setTicked(new Set(fitting.filter(d => {
      const m = direction(d.run, build.version);
      return next === 'all' ? m !== 'same' : next === 'older' ? m === 'up' : m === 'down';
    }).map(d => d.serial)));
  }
  async function send() {
    setBusy(true);
    if (await deploy(build, chosen)) onDone();
    setBusy(false);
  }

  return (
    <Shell open onClose={onClose} title={`Send ${build.version} to devices`}
      description={`${TYPE_LABEL[build.type ?? ''] ?? 'Device'}s${build.chip ? ` with an ${build.chip} chip` : ''}. ${runningCount(build, devices)} already run it.`}
      footer={<>
        <button type="button" className="ui-btn ui-btn--link" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn ui-btn--main" disabled={!chosen.length || busy} onClick={send}>
          {busy ? 'Sending…' : `Send to ${chosen.length}`}
        </button>
      </>}>
      <div className="inline-flex justify-self-start rounded-full bg-muted p-[3px]" role="group" aria-label="Which devices">
        {([['older', 'On an older version'], ['newer', 'On a newer version'], ['all', 'Everyone not on it']] as [Dir, string][]).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={dir === k} onClick={() => changeDir(k)}
            className={`rounded-full px-3 py-1 text-sm ${dir === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{l}</button>
        ))}
      </div>
      <div className="[display:grid] max-h-[300px] gap-1.5 overflow-y-auto">
        {shown.length === 0 ? <p className="m-0 text-sm text-muted-foreground">No devices here.</p> : shown.map(d => (
          <label key={d.serial} className={`[display:grid] cursor-pointer grid-cols-[18px_1fr_auto] items-center gap-2.5 rounded-xl border px-3 py-2 ${ticked.has(d.serial) ? 'border-primary bg-primary/10' : 'border-border'}`}>
            <input type="checkbox" className="size-4 accent-primary" checked={ticked.has(d.serial)}
              onChange={e => setTicked(s => { const n = new Set(s); if (e.target.checked) n.add(d.serial); else n.delete(d.serial); return n; })} />
            <span className="min-w-0">
              <span className="font-mono">{d.serial}</span>
              <span className="block text-sm text-muted-foreground">{d.site ?? 'No site'} · last check {ago(d.checkedAt).toLowerCase()}</span>
            </span>
            <span className="font-mono text-sm">{d.run ?? '?'}<DirTag from={d.run} to={build.version} /></span>
          </label>
        ))}
      </div>
      {dir !== 'older' && chosen.some(d => direction(d.run, build.version) === 'down') && (
        <p className="m-0 rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm">Ticked devices on a newer version will be downgraded to {build.version}.</p>
      )}
    </Shell>
  );
}

/** Upload any version: older than the newest, tagged (1.0.8-rc1), anything not already uploaded for that type and chip. */
export function UploadDialog({ builds, onClose, onDone }: { builds: Build[]; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<FirmwareInfo | null>(null);
  const [version, setVersion] = useState('');
  const [type, setType] = useState<'gateway' | 'energymeter'>('gateway');
  const [notes, setNotes] = useState('');
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  async function choose(f: File) {
    setFile(f); setInfo(null);
    try {
      const i = inspectFirmwareBin(await f.arrayBuffer(), f.name);
      setInfo(i);
      if (i?.version) setVersion(v => v || i.version);
      if (i?.usageType) setType(i.usageType);
    } catch { /* not an ESP-IDF image: the user types the details */ }
  }

  const v = version.trim();
  const chip = info?.chip ?? null;
  const sameKind = builds.filter(b => b.type === type && (b.chip ?? null) === chip);
  const dup = v ? sameKind.find(b => b.version === v) : undefined;
  const newest = [...sameKind].sort((a, b) => compareVersions(b.version, a.version))[0];
  const typeWord = type === 'gateway' ? 'gateway' : 'energy meter';

  async function upload() {
    if (!file || !v || dup) return;
    const form = new FormData();
    form.append('file', file);
    form.append('version', v);
    form.append('device_type', type);
    form.append('description', info?.name ?? file.name.replace(/\.bin$/i, ''));
    form.append('release_notes', notes.trim());
    form.append('is_active', 'false');
    setProgress(0);
    try {
      const res = await apiService.uploadFirmwareVersion(form, setProgress);
      toast.success(`Build ${res.version} uploaded. It stays off until you switch it on or send it.`);
      if (res.storage_warning) toast.warning(res.storage_warning);
      onDone();
    } catch (e) {
      // uploadFirmwareVersion throws "Upload failed: <status> - <body>"; show the backend's own sentence.
      const raw = errText(e, '');
      const body = raw.slice(raw.indexOf('{'));
      let msg = 'Upload failed. Try again.';
      try { msg = JSON.parse(body).error || msg; } catch { if (raw) msg = raw; }
      toast.error(msg);
      setProgress(null);
    }
  }

  return (
    <Shell open onClose={() => progress === null && onClose()} title="Upload build"
      footer={<>
        <button type="button" className="ui-btn ui-btn--link" disabled={progress !== null} onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn ui-btn--main" disabled={!file || !v || !!dup || progress !== null} onClick={upload}>
          {progress === null ? 'Upload' : progress < 100 ? `Uploading ${progress}%` : 'Saving…'}
        </button>
      </>}>
      <div role="button" tabIndex={0} aria-label="Choose a .bin file"
        onClick={() => fileRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) choose(f); }}
        className={`cursor-pointer rounded-xl border-2 px-4 py-6 text-center ${file ? 'border-solid border-primary' : 'border-dashed border-border'} ${drag ? 'bg-primary/10' : 'bg-muted/50'}`}>
        <input ref={fileRef} type="file" accept=".bin" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) choose(f); }} />
        {file ? (<>
          <div className="font-mono font-medium">{file.name}</div>
          <div className="text-sm text-muted-foreground">{mb(file.size)}{chip ? ` · chip ${chip} read from the file` : ' · chip not readable from this file'}</div>
        </>) : (<>
          <div className="font-medium">Drop the .bin file here</div>
          <div className="text-sm text-muted-foreground">or click to choose it</div>
        </>)}
      </div>

      {file && (<>
        <div className="[display:grid] gap-2.5 sm:grid-cols-2">
          <label className="[display:grid] gap-1 text-sm text-muted-foreground">Version
            <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.4, 1.0.8-rc1, 2.2.3-3P" className="font-mono text-foreground" />
          </label>
          <label className="[display:grid] gap-1 text-sm text-muted-foreground">For
            <select value={type} onChange={e => setType(e.target.value as 'gateway' | 'energymeter')}
              className="h-9 rounded-md border border-border bg-input-background px-3 text-foreground">
              <option value="gateway">Gateways</option>
              <option value="energymeter">Energy meters</option>
            </select>
          </label>
        </div>
        {!v ? <p className="m-0 text-sm text-muted-foreground">The version could not be read from the file. Type it in.</p>
          : dup ? <p className="m-0 rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm">{v} for {chip ?? 'these'} {typeWord}s is already uploaded. Give this one a different version, for example {v}-2.</p>
          : newest && compareVersions(v, newest.version) < 0 ? <p className="m-0 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">Older than the newest {typeWord} build ({newest.version}). That is fine: it starts off, and you choose who gets it.</p>
          : <p className="m-0 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">It starts off until you switch it on or send it to devices.</p>}
        {v.includes('-') && !dup && (
          <p className="m-0 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">Devices only compare the part before the dash, so a device on {v.split('-')[0]} counts as already on {v}.</p>
        )}
        <label className="[display:grid] gap-1 text-sm text-muted-foreground">What changed
          <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="For example: fixes the Wi-Fi reconnect loop" className="text-foreground" />
        </label>
        {progress !== null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
        )}
      </>)}
    </Shell>
  );
}

/** Roll back: the gateway switches to the version it ran before. Meters have none. */
export function RollbackDialog({ devices, onClose, onDone }: { devices: OtaDevice[]; onClose: () => void; onDone: () => void }) {
  const gateways = devices.filter(d => d.type === 'gateway');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const results = await Promise.allSettled(gateways.map(d => apiService.triggerRollback(d.serial, why.trim())));
    const failed = gateways.filter((_, i) => results[i].status === 'rejected');
    if (failed.length < gateways.length) toast.success(`Roll back sent to ${plural(gateways.length - failed.length, 'gateway')}. Each goes back at its next check-in.`);
    if (failed.length) toast.error(`Could not send roll back to ${failed.map(d => d.serial).join(', ')}.`);
    setBusy(false);
    onDone();
  }

  return (
    <Shell open onClose={onClose} title={`Roll back ${plural(gateways.length, 'gateway')}?`}
      description={<>Each goes back to the version it ran before, at its next check-in.{devices.length > gateways.length && ` ${plural(devices.length - gateways.length, 'energy meter')} left out: meters cannot roll back, send them an older build instead.`}</>}
      footer={<>
        <button type="button" className="ui-btn ui-btn--link" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn ui-btn--danger" disabled={!why.trim() || !gateways.length || busy} onClick={go}>{busy ? 'Sending…' : 'Roll back'}</button>
      </>}>
      <label className="[display:grid] gap-1 text-sm text-muted-foreground">Why?
        <Textarea rows={2} value={why} onChange={e => setWhy(e.target.value)} placeholder="For example: 1.0.7 drops the RS-485 link" className="text-foreground" />
      </label>
    </Shell>
  );
}
