import React, { useCallback, useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { SetupCard, EmptyState, Btn, useTokens } from '../siteHardware/ui';
import './viewerDevices.css';
import { ago, devName, updateFor, type Dev, type Firmware } from './DevicePage';
import { getFirmware, getSiteDevices, peekSiteDevices } from './deviceCache';

/** The site panel's Devices tab: this site's monitors and meters; a row opens the device drawer.
 *  The tab is only listed for people with device control. The backend scopes every call. */
const ViewerDevices: React.FC<{ siteId: string }> = ({ siteId }) => {
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const [devices, setDevices] = useState<Dev[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // null = the firmware list is not available to this role (employee-only route); rows just skip the hint.
  const [firmware, setFirmware] = useState<Firmware[] | null>(null);

  // Cached for 60 s (shared with the device page): coming back to this tab paints at once, then refreshes.
  const load = useCallback((force = false) => {
    setLoadFailed(false);
    getSiteDevices(siteId, force).then(setDevices).catch(() => setLoadFailed(true));
  }, [siteId]);
  useEffect(() => {
    peekSiteDevices(siteId)?.then(setDevices).catch(() => {});
    load();
  }, [siteId, load]);
  useEffect(() => { getFirmware().then(setFirmware); }, []);

  return (
    <div>
      {devices !== null && !loadFailed && devices.length > 0 ? null : <SetupCard isDark={isDark} icon={<Server size={20} />} title="Devices" purpose="The monitors and meters at this site. Tap one for details.">
        {loadFailed ? (
          <EmptyState isDark={isDark} headline="Couldn't load the devices. Try again."
            action={<Btn isDark={isDark} variant="soft" size="sm" onClick={() => load(true)}>Try again</Btn>} />
        ) : devices === null ? (
          <span style={{ color: t.ink2, fontSize: '0.88rem' }}>Loading devices…</span>
        ) : devices.length === 0 ? (
          <EmptyState isDark={isDark} headline="No devices at this site yet" />
        ) : null}
      </SetupCard>}
      {devices !== null && !loadFailed && devices.length > 0 && (
        <div className="dv-block">
          <div className="dv-intro">The monitors and meters at this site. Tap one for details.</div>
          <div className="dv-tiles">
            {devices.map(d => (
              <Link key={d.device_id} to={`/devices/${d.device_id}/dashboard`} className="dv-tile" style={{ textDecoration: 'none' }}>
                <div className="dv-top">
                  <div>
                    <div className="dv-name">{devName(d)}</div>
                    <div className="dv-sub">{d.device_type === 'energy_meter' ? 'Whole-home meter' : 'Inverter monitor'}</div>
                  </div>
                  <span className={`dv-state${d.is_online ? ' on' : ''}`}><i />{d.is_online ? 'Live' : 'Not reporting'}</span>
                </div>
                <div className="dv-meta">
                  {d.last_heartbeat && <span>{ago(d.last_heartbeat)}</span>}
                  {d.firmware_version && <span>firmware {d.firmware_version}</span>}
                </div>
                {updateFor(firmware, d) && <span className="dv-update">Update available</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewerDevices;
