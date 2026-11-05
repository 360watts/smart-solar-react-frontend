import React from 'react';
import { useTokens } from '../siteHardware/ui';
import { Modal } from './formParts';
import { ROLE_MATRIX } from './roles';

/** What each role can do, side by side (rows live in roles.ts ROLE_MATRIX). */
export function CompareRoles({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const t = useTokens(isDark);
  const cell: React.CSSProperties = { padding: '9px 12px', borderTop: `1px solid ${t.line2}`, fontSize: '0.86rem', textAlign: 'left' };
  const dim = (v: string) => (v === 'No' ? { color: t.ink2 } : {});
  return (
    <Modal isDark={isDark} label="Compare roles" width={640} onClose={onClose}
      header={<h2 style={{ margin: 0, fontFamily: t.head, fontSize: '1.1rem' }}>Compare roles</h2>}>
      <div style={{ padding: '8px 22px 20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...cell, borderTop: 0 }}><span className="sr-only">What</span></th>
              {['Admin', 'Employee', 'Viewer'].map((h) => <th key={h} scope="col" style={{ ...cell, borderTop: 0, color: t.ink2, fontWeight: 500 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROLE_MATRIX.map((r) => (
              <tr key={r.what}>
                <th scope="row" style={{ ...cell, fontWeight: 500 }}>{r.what}</th>
                <td style={{ ...cell, ...dim(r.admin) }}>{r.admin}</td>
                <td style={{ ...cell, ...dim(r.employee) }}>{r.employee}</td>
                <td style={{ ...cell, ...dim(r.viewer) }}>{r.viewer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
