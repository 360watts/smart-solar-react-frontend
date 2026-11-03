import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../shared/ui/dialog';
import { Input } from '../../shared/ui/input';
import { cn } from '../../shared/ui/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';
import { Switch } from '../../shared/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../shared/ui/table';
import type { RegisterMapping, SlaveFormData } from './SlaveConfigModal';
import {
  ACCESS_MODES, BYTE_ORDERS, CATEGORIES, DATA_TYPES, FUNCTION_CODES, REGISTER_TYPES, WORD_ORDERS,
  blankRegister, hex, parseRegisterCsv, registersToCsv, validateSlave,
} from './slaveForm';

interface Props {
  open: boolean;
  /** null = new slave */
  editingSlave: { id: number; slaveId: number; deviceName: string } | null;
  existingSlaveIds: number[];
  initialForm?: SlaveFormData;
  onSave: (data: SlaveFormData) => void;
  onCancel: () => void;
  error?: string | null;
  onClearError?: () => void;
}

const CInput = (p: React.ComponentProps<typeof Input>) => <Input {...p} className={cn('h-8 px-2.5 text-[0.85rem]', p.className)} />;

const BLANK: SlaveFormData = { slave_id: '', device_name: '', polling_interval_ms: 5000, timeout_ms: 1000, priority: 1, enabled: true, registers: [] };

function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label title={hint} className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[0.78rem] font-medium text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-[0.75rem] leading-tight text-destructive" role="alert">{error}</span>}
    </label>
  );
}

function Pick({ label, value, options, onChange, offset = 0 }: { label: string; value: number | undefined; options: (string | number)[]; onChange: (v: number) => void; offset?: number }) {
  return (
    <Select value={String(value ?? 0)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" aria-label={label} className="w-full text-[0.85rem]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o, i) => <SelectItem key={i} value={String(typeof o === 'number' ? o : i + offset)}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const SlaveEditDialog: React.FC<Props> = ({ open, editingSlave, existingSlaveIds, initialForm, onSave, onCancel, error, onClearError }) => {
  const [form, setForm] = useState<SlaveFormData>(BLANK);
  const [tried, setTried] = useState(false);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm ? { ...initialForm, registers: [...initialForm.registers] } : BLANK);
    setTried(false); setQuery(''); setOpenId(null); setImportNote(null);
  }, [open, initialForm]);

  const errors = useMemo(() => validateSlave(form, existingSlaveIds, !!editingSlave), [form, existingSlaveIds, editingSlave]);
  const set = <K extends keyof SlaveFormData>(k: K, v: SlaveFormData[K]) => { setForm((f) => ({ ...f, [k]: v })); onClearError?.(); };
  const setReg = (id: number, patch: Partial<RegisterMapping>) =>
    setForm((f) => ({ ...f, registers: f.registers.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const num = (v: string) => (v === '' ? NaN : Number(v));
  const show = (k: string) => (tried ? errors[k] : undefined);

  const q = query.trim().toLowerCase();
  const rows = form.registers.filter((r) => !q || r.label.toLowerCase().includes(q) || String(r.address).includes(q) || hex(r.address).toLowerCase().includes(q));
  const activeCount = form.registers.filter((r) => r.enabled).length;

  const save = () => {
    setTried(true);
    if (Object.keys(errors).length === 0) onSave(form);
  };

  const addRegister = () => {
    const r = { ...blankRegister(), address: Math.max(-1, ...form.registers.map((x) => x.address)) + 1 };
    setForm((f) => ({ ...f, registers: [...f.registers, r] }));
    setOpenId(r.id); setQuery('');
  };

  const importCsv = async (file: File) => {
    const { valid, errors: bad } = parseRegisterCsv(await file.text());
    const have = new Set(form.registers.map((r) => r.address));
    const fresh = valid.filter((r) => !have.has(r.address));
    setForm((f) => ({ ...f, registers: [...f.registers, ...fresh] }));
    setImportNote(`Added ${fresh.length}. Skipped ${valid.length - fresh.length} with an address already in use.${bad.length ? ' ' + bad.slice(0, 3).join('; ') : ''}`);
  };

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([registersToCsv(form.registers)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `registers_${form.device_name || 'slave'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 10 } as const;
  const regError = Object.entries(errors).filter(([k]) => k.startsWith('reg:'))[0]?.[1];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-[20px] bg-popover p-0 sm:max-w-5xl">
        <div className="border-b border-border px-4 py-2.5 pr-12">
          <DialogTitle className="m-0 text-base">{editingSlave ? 'Edit slave' : 'Add slave'}</DialogTitle>
          <DialogDescription className="m-0 font-mono text-[0.78rem]">
            {editingSlave ? `${editingSlave.deviceName} · slave #${editingSlave.slaveId}` : 'New Modbus slave'}
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-3">
          {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm text-destructive" role="alert">{error}</div>}

          <section aria-label="Slave">
            <div style={grid}>
              <Field label="Slave ID" error={show('slave_id')} hint="1 to 247, unique">
                <CInput value={form.slave_id} inputMode="numeric" className="font-mono" onChange={(e) => set('slave_id', e.target.value)} aria-invalid={!!show('slave_id')} />
              </Field>
              <Field label="Name" error={show('device_name')}>
                <CInput value={form.device_name} onChange={(e) => set('device_name', e.target.value)} aria-invalid={!!show('device_name')} />
              </Field>
              <div className="flex flex-col gap-1">
                <span className="text-[0.78rem] font-medium text-muted-foreground">Status</span>
                <div className="flex min-h-8 items-center gap-2">
                  <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} aria-label="Slave enabled" />
                  <span className="text-sm">{form.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              <Field label="Poll every (ms)" error={show('polling_interval_ms')} hint="100 to 600000">
                <CInput type="number" value={form.polling_interval_ms} className="font-mono" onChange={(e) => set('polling_interval_ms', num(e.target.value))} aria-invalid={!!show('polling_interval_ms')} />
              </Field>
              <Field label="Reply timeout (ms)" error={show('timeout_ms')} hint="Shorter than the poll interval">
                <CInput type="number" value={form.timeout_ms} className="font-mono" onChange={(e) => set('timeout_ms', num(e.target.value))} aria-invalid={!!show('timeout_ms')} />
              </Field>
              <Field label="Priority" error={show('priority')} hint="1 is polled first, 10 last">
                <CInput type="number" value={form.priority ?? 1} className="font-mono" onChange={(e) => set('priority', num(e.target.value))} aria-invalid={!!show('priority')} />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-2" aria-label="Registers">
            <h3 className="m-0 text-[0.9rem] font-semibold text-muted-foreground">
              Registers <span className="font-mono font-normal text-text-dim">({activeCount} on of {form.registers.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <CInput type="search" aria-label="Search registers" placeholder="Search label or address" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-64" />
              <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={addRegister}>Add register</button>
              <button type="button" className="ui-btn ui-btn--support ui-btn--sm" onClick={() => fileRef.current?.click()}>Import CSV</button>
              <button type="button" className="ui-btn ui-btn--link ui-btn--sm" onClick={downloadCsv}>{form.registers.length ? 'Download CSV' : 'Download template'}</button>
              <input ref={fileRef} type="file" accept=".csv" hidden aria-label="Import CSV file" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
            </div>
            {importNote && <p className="m-0 text-sm text-muted-foreground">{importNote}</p>}
            {tried && regError && <p className="m-0 text-sm text-destructive" role="alert">{regError}</p>}
            {rows.length === 0 ? (
              <p className="m-0 rounded-xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {form.registers.length ? 'No registers match.' : 'No registers yet. Use Add register or Import CSV.'}
              </p>
            ) : (
              <Table containerClassName="max-h-[340px] overflow-y-auto [&_td]:px-2 [&_td]:py-1 [&_th]:h-8 [&_th]:px-2">
                <TableHeader>
                  <TableRow>
                    {['Label', 'Address', 'Function', 'Type', 'Scale', 'Unit', 'On'].map((h) => <TableHead key={h} className="sticky top-0 z-10 bg-card">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const isOpen = openId === r.id;
                    const bad = tried && errors[`reg:${r.id}`];
                    return (
                      <React.Fragment key={r.id}>
                        <TableRow className={isOpen ? 'bg-primary/10' : ''} data-testid={`reg-${r.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button type="button" aria-label={`${isOpen ? 'Hide' : 'Show'} advanced fields for ${r.label || 'register'}`} aria-expanded={isOpen}
                                className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => setOpenId(isOpen ? null : r.id)}>
                                <ChevronRight size={14} className={isOpen ? 'rotate-90 transition-transform' : 'transition-transform'} />
                              </button>
                              <CInput aria-label="Label" value={r.label} className="min-w-36" aria-invalid={!!bad} onChange={(e) => setReg(r.id, { label: e.target.value })} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CInput aria-label="Address" type="number" value={Number.isNaN(r.address) ? '' : r.address} className="w-24 font-mono" aria-invalid={!!bad}
                                onChange={(e) => setReg(r.id, { address: num(e.target.value) })} />
                              <span className="font-mono text-[0.75rem] text-text-dim">{Number.isNaN(r.address) ? '' : hex(r.address)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="w-28"><Pick label="Function code" value={r.functionCode} options={FUNCTION_CODES} onChange={(v) => setReg(r.id, { functionCode: v })} /></TableCell>
                          <TableCell className="w-28"><Pick label="Data type" value={r.dataType} options={DATA_TYPES} onChange={(v) => setReg(r.id, { dataType: v })} /></TableCell>
                          <TableCell><CInput aria-label="Scale" type="number" step="any" value={r.scaleFactor} className="w-24 font-mono" onChange={(e) => setReg(r.id, { scaleFactor: num(e.target.value) })} /></TableCell>
                          <TableCell><CInput aria-label="Unit" value={r.unit ?? ''} className="w-20" maxLength={16} onChange={(e) => setReg(r.id, { unit: e.target.value })} /></TableCell>
                          <TableCell><Switch checked={r.enabled} aria-label={`${r.label || 'Register'} on`} onCheckedChange={(v) => setReg(r.id, { enabled: v })} /></TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow>
                            <TableCell colSpan={7} className="whitespace-normal bg-muted/30 !p-2.5">
                              <div style={grid}>
                                <Field label="Register count"><CInput type="number" value={r.numRegisters} className="font-mono" onChange={(e) => setReg(r.id, { numRegisters: num(e.target.value) })} /></Field>
                                <Field label="Register type"><Pick label="Register type" value={r.registerType} options={REGISTER_TYPES} onChange={(v) => setReg(r.id, { registerType: v })} /></Field>
                                <Field label="Byte order"><Pick label="Byte order" value={r.byteOrder} options={BYTE_ORDERS} onChange={(v) => setReg(r.id, { byteOrder: v })} /></Field>
                                <Field label="Word order"><Pick label="Word order" value={r.wordOrder} options={WORD_ORDERS} onChange={(v) => setReg(r.id, { wordOrder: v })} /></Field>
                                <Field label="Access"><Pick label="Access" value={r.accessMode} options={ACCESS_MODES} onChange={(v) => setReg(r.id, { accessMode: v })} /></Field>
                                <Field label="Offset"><CInput type="number" step="any" value={r.offset} className="font-mono" onChange={(e) => setReg(r.id, { offset: num(e.target.value) })} /></Field>
                                <Field label="Decimals"><CInput type="number" value={r.decimalPlaces ?? 2} className="font-mono" onChange={(e) => setReg(r.id, { decimalPlaces: num(e.target.value) })} /></Field>
                                <Field label="Category">
                                  <Select value={r.category || 'Electrical'} onValueChange={(v) => setReg(r.id, { category: v })}>
                                    <SelectTrigger size="sm" aria-label="Category" className="w-full text-[0.85rem]"><SelectValue /></SelectTrigger>
                                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                  </Select>
                                </Field>
                                <Field label="High alarm"><CInput type="number" step="any" placeholder="None" value={r.highAlarmThreshold ?? ''} className="font-mono" onChange={(e) => setReg(r.id, { highAlarmThreshold: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                                <Field label="Low alarm"><CInput type="number" step="any" placeholder="None" value={r.lowAlarmThreshold ?? ''} className="font-mono" onChange={(e) => setReg(r.id, { lowAlarmThreshold: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
                                <Field label="Description" className="sm:col-span-full"><CInput placeholder="For example 0 off, 1 on" value={r.description ?? ''} onChange={(e) => setReg(r.id, { description: e.target.value })} /></Field>
                              </div>
                              <div className="mt-2 flex justify-end">
                                <button type="button" className="ui-btn ui-btn--danger ui-btn--sm"
                                  onClick={() => { setForm((f) => ({ ...f, registers: f.registers.filter((x) => x.id !== r.id) })); setOpenId(null); }}>
                                  Remove register
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-4 py-2.5">
          <span className="mr-auto text-[0.85rem] text-text-dim">Gateways pick up changes on their next config check.</span>
          <button type="button" className="ui-btn ui-btn--link" onClick={onCancel}>Cancel</button>
          <button type="button" className="ui-btn ui-btn--main" onClick={save}>Save slave</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SlaveEditDialog;
