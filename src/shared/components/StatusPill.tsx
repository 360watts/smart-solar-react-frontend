export function StatusPill({ cfg }: { cfg: { color: string; bg: string; label: string } }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      borderRadius: 999, fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}
