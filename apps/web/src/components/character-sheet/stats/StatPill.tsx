'use client';

export function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: '8px', padding: '0.5rem 0.875rem',
      display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px',
    }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: '700', color }}>{value}</span>
    </div>
  );
}
