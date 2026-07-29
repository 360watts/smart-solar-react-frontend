import React, { useEffect, useState } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';

export function CountUp({ to, delay = 0, style }: { to: number; delay?: number; style?: React.CSSProperties }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, v => Math.round(v));
  const [d, setD] = useState(0);
  useEffect(() => {
    const u = rounded.on('change', v => setD(v));
    const c = animate(mv, to, { duration: 1.3, ease: [0.25, 0.46, 0.45, 0.94], delay });
    return () => { c.stop(); u(); };
  }, [to]);
  return <span style={style}>{d}</span>;
}
