import React, { useCallback, useEffect, useState } from 'react';
import { Server, Gauge } from 'lucide-react';
import { apiService } from '../../../services/api';
import { useTheme } from '../../../contexts/ThemeContext';
import { SetupCard, Item, StatusChip, EmptyState, Btn, useTokens } from '../siteHardware/ui';
import DeviceDrawer, { ago, devName, updateFor, type Dev, type Firmware } from './DeviceDrawer';

/** The site panel's Devices tab: this site's monitors and meters; a row opens the device drawer.
 *  The tab is only listed for people with device control. The backend scopes every call. */
const ViewerDevices: React.FC<{ siteId: string }> = ({ siteId }) => {
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const [devices, setDevices] = useState<Dev[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // null = the firmware list is not available to this role (employee-only route); rows just skip the hint.
  const [firmware, setFirmware] = useState<Firmware[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoadFailed(false);
    apiService.getSiteGatewayStatus(siteId)
      .then(r => setDevices(Array.isArray(r?.devices) ? r.devices : []))
      .catch(() => setLoadFailed(true));
  }, [siteId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiService.getFirmwareVersions(true).then(r => setFirmware(Array.isArray(r) ? r : null)).catch(() => setFirmware(null));
  }, []);

  const open = devices?.find(d => d.device_id === openId);

  return (
    <div>
      <SetupCard isDark={isDark} icon={<Server size={20} />} title="Devices" purpose="The monitors and meters at this site. Tap one for details.">
        {loadFailed ? (
          <EmptyState isDark={isDark} headline="Couldn't load the devices. Try again."
            action={<Btn isDark={isDark} variant="soft" size="sm" onClick={load}>Try again</Btn>} />
        ) : devices === null ? (
          <span style={{ color: t.ink2, fontSize: '0.88rem' }}>Loading devices…</span>
        ) : devices.length === 0 ? (
          <EmptyState isDark={isDark} headline="No devices at this site yet" />
        ) : devices.map(d => (
          <button
            key={d.device_id}
            type="button"
            onClick={() => setOpenId(d.device_id)}
            style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'transparent', textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
          >
            <Item
              isDark={isDark}
              icon={d.device_type === 'energy_meter' ? <Gauge size={19} /> : <Server size={19} />}
              iconTone={d.is_online ? 'good' : 'plain'}
              title={devName(d)}
              status={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <StatusChip isDark={isDark} state={d.is_online ? 'good' : 'wait'}>{d.is_online ? 'Live' : 'Not reporting'}</StatusChip>
                  {ago(d.last_heartbeat)}
                  {d.firmware_version && <span>{`· firmware ${d.firmware_version}`}</span>}
                  {updateFor(firmware, d) && <StatusChip isDark={isDark} state="wait">Update available</StatusChip>}
                </span>
              }
              actions={[]}
            />
          </button>
        ))}
      </SetupCard>

      {open && <DeviceDrawer isDark={isDark} dev={open} firmware={firmware} onClose={() => setOpenId(null)} />}
    </div>
  );
};

export default ViewerDevices;
