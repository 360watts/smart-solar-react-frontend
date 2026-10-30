import React from 'react';
import type { AccessDevice } from '../../../services/api';
import './viewerHome.css';

/** One device's last-24-hours reporting strip (48 half-hour cells). Shared by Home and the site page. */
const DeviceStrip: React.FC<{ d: AccessDevice }> = ({ d }) => (
  <div className="vh-strip" role="img" aria-label={`${d.serial}, last 24 hours, one cell per half hour`}>
    {d.coverage.map((c, i) => <i key={i} className={c} />)}
  </div>
);

export default DeviceStrip;
