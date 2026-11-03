import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, X } from 'lucide-react';

type Reg = { id: number | string; label: string; address: number | string; category?: string; unit?: string; value?: number | string | null; received: boolean };
export type Slave = { slave_id: number | string; device_name: string; enabled: boolean; received: number; configured: number; registers: Reg[] };

/** One Modbus slave: a row with received/configured, opening to its registers. */
const SlaveRegisterSection: React.FC<{ slave: Slave }> = ({ slave }) => {
  const [open, setOpen] = useState(false);
  const mono = { fontFamily: 'Fira Code, monospace' };
  return (
    <div className="border-b border-border">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between border-0 bg-transparent px-5 py-3 text-left text-foreground hover:bg-muted/50">
        <span className="flex items-center gap-2 text-sm font-medium">
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          Slave {slave.slave_id}, {slave.device_name}
          {!slave.enabled && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">disabled</span>}
        </span>
        <span className="text-[13px]" style={{ ...mono, color: slave.received === slave.configured ? 'var(--brand-green)' : 'var(--gap, #e8930c)' }}>{slave.received}/{slave.configured}</span>
      </button>
      {open && (
        <div className="overflow-x-auto px-5 pb-3">
          <table className="w-full border-collapse text-[13px]">
            <thead><tr className="text-left text-muted-foreground">{['Label', 'Address', 'Category', 'Unit', 'Value', 'Received'].map(h => <th key={h} className="px-2 pb-1.5 pt-1 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {slave.registers.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="whitespace-nowrap px-2 py-1.5" style={mono}>{r.label}</td>
                  <td className="px-2 py-1.5 text-muted-foreground" style={mono}>{r.address}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.category || '–'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground" style={mono}>{r.unit || '–'}</td>
                  <td className="px-2 py-1.5 font-medium" style={mono}>{r.value != null ? r.value : '–'}</td>
                  <td className="px-2 py-1.5">
                    {r.received ? <CheckCircle2 size={14} aria-label="Received" style={{ color: 'var(--brand-green)' }} /> : <X size={14} aria-label="Missing" className="text-muted-foreground" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SlaveRegisterSection;
