import { useEffect, useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import FoundPlugs, { TuyaCloudDevice } from './FoundPlugs';
import {
  Flow, FlowStep, ChoiceGrid, RadioCards, Field, controlStyle, Btn, DetailsToggle,
  applianceIcon, APPLIANCE_OPTIONS, useTokens,
} from './ui';

export interface SmartDeviceDraft {
  device_type: string;
  provider_device_id: string;
  appliance_label: string;
  circuit: string;
  display_name: string;
  is_active: boolean;
  ingest_mode: string;
}

// Friendly wording for the electrical bus. Defaults to "Inverter"; Grid and EV
// are there to pick when the plug isn't on the inverter's backup output.
const WHERE_OPTIONS = [
  { value: 'inverter_backup', label: 'Inverter', detail: 'runs through the inverter / battery' },
  { value: 'grid_direct', label: 'Grid', detail: 'wired straight to the mains' },
  { value: 'ev_line', label: 'EV', detail: 'a dedicated EV charger circuit' },
];
const SWITCH_LIKE = new Set(['kg', 'tdq', 'qt', 'wkcz']);

interface Props {
  isDark: boolean;
  open: boolean;
  editing: boolean;
  saving: boolean;
  draft: SmartDeviceDraft;
  setDraft: (d: SmartDeviceDraft) => void;
  onClose: () => void;
  onSave: () => void;
  scanDevices: TuyaCloudDevice[];
  scanLoading: boolean;
  scanError: string | null;
  onScan: () => void;
}

export default function SmartDeviceComposer({
  isDark, open, editing, saving, draft, setDraft, onClose, onSave,
  scanDevices, scanLoading, scanError, onScan,
}: Props) {
  const t = useTokens(isDark);
  const [manual, setManual] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) { setManual(editing); setShowAdvanced(false); }
  }, [open, editing]);

  const set = (patch: Partial<SmartDeviceDraft>) => setDraft({ ...draft, ...patch });
  const pick = (d: TuyaCloudDevice) => set({
    provider_device_id: d.id,
    display_name: draft.display_name || d.name || '',
    device_type: SWITCH_LIKE.has(d.category || '') ? 'tuya_switch' : 'tuya_plug',
    ingest_mode: 'local',
  });

  const hasPlug = !!draft.provider_device_id.trim();
  const canSave = hasPlug && !saving;

  return (
    <Flow
      isDark={isDark}
      open={open}
      title={editing ? 'Edit this plug' : 'Add a smart plug'}
      subtitle={editing ? 'Change what it powers or where it sits.' : 'Two quick steps.'}
      onClose={onClose}
      footer={
        <>
          <Btn isDark={isDark} variant="plain" onClick={onClose} disabled={saving}>Cancel</Btn>
          <Btn isDark={isDark} onClick={onSave} disabled={!canSave}>
            {saving
              ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Check size={14} strokeWidth={3} />}
            {editing ? 'Save' : 'Add plug'}
          </Btn>
        </>
      }
    >
      {/* ── Step 1 · which plug ──────────────────────────────────────── */}
      {!editing && (
        <FlowStep
          isDark={isDark} n={1} title="Which plug?"
          question={manual ? undefined : "We'll look for smart plugs already on this site's Wi-Fi."}
        >
          {manual ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <Field isDark={isDark} label="Plug code" hint="printed in the Smart Life app under the plug's settings">
                <input
                  value={draft.provider_device_id}
                  onChange={e => set({ provider_device_id: e.target.value })}
                  placeholder="e.g. bf1a2b3c4d5e6f"
                  style={controlStyle(isDark)}
                />
              </Field>
              <button
                type="button" onClick={() => setManual(false)}
                style={{ justifySelf: 'start', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: t.body, fontSize: '0.82rem', color: t.ink2, textDecoration: 'underline' }}
              >
                Look for plugs automatically instead
              </button>
            </div>
          ) : (
            <>
              <FoundPlugs
                isDark={isDark}
                devices={scanDevices}
                loading={scanLoading}
                error={scanError}
                selectedId={draft.provider_device_id}
                onScan={onScan}
                onPick={pick}
              />
              {hasPlug && (
                <div style={{
                  marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '9px 12px', borderRadius: 11, border: `1px solid ${t.good}`, background: t.goodBg,
                }}>
                  <Check size={14} strokeWidth={3} style={{ color: t.goodInk, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{draft.display_name || 'This plug'}</span>
                  <span style={{ fontSize: '0.8rem', color: t.goodInk }}>selected</span>
                  <button
                    type="button" onClick={() => set({ provider_device_id: '' })}
                    style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', fontFamily: t.body, fontSize: '0.8rem', color: t.ink2, textDecoration: 'underline' }}
                  >
                    change
                  </button>
                </div>
              )}
              <button
                type="button" onClick={() => setManual(true)}
                style={{ marginTop: 10, alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: t.body, fontSize: '0.82rem', color: t.ink2, textDecoration: 'underline' }}
              >
                Can&apos;t see your plug? Enter its code by hand
              </button>
            </>
          )}
        </FlowStep>
      )}

      {editing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 13px', borderRadius: 12, border: `1px solid ${t.line}`, background: t.card2,
        }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: t.goodBg, color: t.goodInk, flexShrink: 0 }}>
            {applianceIcon(draft.appliance_label, 17)}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{draft.display_name || 'This plug'}</div>
            <div style={{ fontSize: '0.78rem', color: t.ink2 }}>Plug can&apos;t be changed after setup</div>
          </div>
        </div>
      )}

      {/* ── Step 2 · what does it power ──────────────────────────────── */}
      <FlowStep
        isDark={isDark} n={editing ? 1 : 2} title="What does it power?"
        question="Pick the appliance this plug is connected to."
      >
        <ChoiceGrid
          isDark={isDark}
          value={draft.appliance_label}
          onChange={v => set({
            appliance_label: v,
            display_name: draft.display_name || APPLIANCE_OPTIONS.find(o => o.value === v)?.label || '',
          })}
          options={APPLIANCE_OPTIONS.map(o => ({ ...o, icon: applianceIcon(o.value, 16) }))}
        />

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.85rem', color: t.ink2, marginBottom: 8 }}>What’s it wired to?</div>
          <RadioCards
            isDark={isDark}
            value={WHERE_OPTIONS.some(o => o.value === draft.circuit) ? draft.circuit : 'inverter_backup'}
            onChange={v => set({ circuit: v })}
            options={WHERE_OPTIONS}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <DetailsToggle isDark={isDark} open={showAdvanced} onToggle={() => setShowAdvanced(v => !v)} />
          {showAdvanced && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field isDark={isDark} label="Name shown on screen">
                <input value={draft.display_name} onChange={e => set({ display_name: e.target.value })}
                  placeholder="e.g. Kitchen fridge" style={controlStyle(isDark)} />
              </Field>
              <Field isDark={isDark} label="How often we check it">
                <select value={draft.ingest_mode} onChange={e => set({ ingest_mode: e.target.value })} style={controlStyle(isDark)}>
                  <option value="poll">Standard — every few minutes</option>
                  <option value="pulsar">Live — pushed from the cloud</option>
                  <option value="local">Fast — read by the on-site device</option>
                </select>
              </Field>
              <Field isDark={isDark} label="Plug code">
                <input value={draft.provider_device_id} onChange={e => set({ provider_device_id: e.target.value })}
                  style={{ ...controlStyle(isDark), fontFamily: "'Fira Code', monospace", fontSize: '0.82rem' }} />
              </Field>
              <Field isDark={isDark} label="Device kind">
                <select value={draft.device_type} onChange={e => set({ device_type: e.target.value })} style={controlStyle(isDark)}>
                  <option value="tuya_plug">Smart plug</option>
                  <option value="tuya_switch">Smart switch</option>
                  <option value="ct_clamp">Clamp meter</option>
                  <option value="modbus_meter">Wired meter</option>
                </select>
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: t.ink2 }}>
                <input type="checkbox" checked={draft.is_active} onChange={e => set({ is_active: e.target.checked })} style={{ accentColor: t.good }} />
                Recording readings
              </label>
            </div>
          )}
        </div>
      </FlowStep>
    </Flow>
  );
}
