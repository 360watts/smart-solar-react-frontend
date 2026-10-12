import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAccess } from '../../../shared/access/useAccess';
import { useTokens, EmptyState } from '../siteHardware/ui';
import DevicePage, { type Dev, type Firmware } from './DevicePage';
import { getFirmware, getSiteDevices } from './deviceCache';

/** /my-sites/:siteId/devices/:deviceId. Loads the device from the shared cache, so tile to page costs no extra gateway-status call
 *  and a refresh or pasted link works. A device that is not in this site's list shows the "not available" message. */
const DeviceRoute: React.FC = () => {
  const { siteId = '', deviceId = '' } = useParams<{ siteId: string; deviceId: string }>();
  const { isDark } = useTheme();
  const t = useTokens(isDark);
  const access = useAccess();
  const can = access.can('device_control');
  // Viewers go back to their site; admins and employees (who open this page from the Devices page) go back there.
  const backTo = access.can('my_sites') ? `/my-sites/${siteId}` : '/devices';
  const [state, setState] = useState<{ dev: Dev | null; firmware: Firmware[] | null } | 'loading' | 'failed'>('loading');

  useEffect(() => {
    let live = true;
    setState('loading');
    Promise.all([getSiteDevices(siteId), getFirmware()])
      .then(([devices, firmware]) => { if (live) setState({ dev: devices.find(d => String(d.device_id) === deviceId) ?? null, firmware }); })
      .catch(() => { if (live) setState('failed'); });
    return () => { live = false; };
  }, [siteId, deviceId]);

  const back = <Link to={backTo} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: t.ink2, textDecoration: 'none', fontSize: '0.9rem' }}>‹ Devices</Link>;
  return (
    <div style={{ fontFamily: t.body, color: t.ink }}>
      {back}
      {!can || (typeof state === 'object' && !state.dev) ? <EmptyState isDark={isDark} headline="This device isn't available to you" />
        : state === 'loading' ? <p style={{ color: t.ink2 }}>Loading…</p>
        : state === 'failed' ? <EmptyState isDark={isDark} headline="Couldn't load this device. Try again." />
        : <DevicePage key={state.dev!.device_id} isDark={isDark} dev={state.dev!} firmware={state.firmware} />}
    </div>
  );
};

export default DeviceRoute;
