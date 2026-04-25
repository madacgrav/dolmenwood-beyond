interface HPBarProps {
  current: number;
  max: number;
  showNumbers?: boolean;
}

export function HPBar({ current, max, showNumbers = true }: HPBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const color = pct > 0.66 ? 'var(--color-primary)' : pct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {showNumbers && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', color }}>
            {current} / {max} HP
          </span>
        </div>
      )}
      <div style={{
        height: '6px', borderRadius: '3px',
        backgroundColor: 'var(--color-border)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct * 100}%`,
          backgroundColor: color,
          borderRadius: '3px',
          transition: 'width 0.3s ease, background-color 0.3s ease',
        }} />
      </div>
    </div>
  );
}
