import { FileText } from 'lucide-react';
import { EmptyState } from '../../../shared/components/Feedback';
import { useEffect, useState } from 'react';
import { apiService } from '../../../services/api';
import OpsHealth from './OpsHealth';
import OpsLogFiles from './OpsLogFiles';
import './opsLogs.css';
import type { Dev } from './DevicePage';

// The Logs sub-tab: log files for gateways (plus gateway health), a note for meters. Scenarios: docs/test-scenarios/viewer-operations-flex.md (S4-S7).
export default function OpsLogs({ dev }: { dev: Dev; isDark?: boolean }) {
  const isMeter = dev.device_type === 'energy_meter';
  const [detail, setDetail] = useState<any>(undefined);
  useEffect(() => { setDetail(undefined); if (!isMeter) apiService.getDevice(dev.device_id).then(setDetail).catch(() => setDetail(null)); }, [dev.device_id, isMeter]);
  if (isMeter) return <EmptyState icon={FileText} title="Energy meters have no remote logs" />;
  return (
    <>
      <OpsLogFiles deviceId={dev.device_id} />
      {detail !== undefined && (
        <OpsHealth deviceId={dev.device_id} device={detail ?? undefined} />
      )}
    </>
  );
}
