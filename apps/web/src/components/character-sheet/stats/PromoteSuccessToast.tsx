'use client';

interface Props {
  promoteSuccess: { name: string; charId: string } | null;
  onDismiss: () => void;
}

export function PromoteSuccessToast({ promoteSuccess, onDismiss }: Props) {
  if (!promoteSuccess) return null;
  return (
    <div style={{ position: 'fixed', bottom: '5.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 200, backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-gold)', borderRadius: '10px', padding: '0.75rem 1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: 'calc(100vw - 2rem)' }}>
      <span style={{ fontSize: '1.25rem' }}>⭐</span>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-gold)' }}>{promoteSuccess.name} promoted!</div>
        <a href={`/characters/${promoteSuccess.charId}`} style={{ fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'underline' }}>Open character sheet →</a>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.25rem', padding: 0, lineHeight: 1, minHeight: '44px', minWidth: '44px' }}>×</button>
    </div>
  );
}
