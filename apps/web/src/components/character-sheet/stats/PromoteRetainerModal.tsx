'use client';
import type { DBRetainer } from '@/lib/api/retainers';

interface Props {
  retainers: DBRetainer[];
  promotingRetainer: string | null;
  promoteLoading: boolean;
  promoteError: string;
  onCancel: () => void;
  promoteRetainer: (r: DBRetainer) => Promise<void>;
}

export function PromoteRetainerModal({
  retainers,
  promotingRetainer,
  promoteLoading,
  promoteError,
  onCancel,
  promoteRetainer,
}: Props) {
  if (!promotingRetainer) return null;
  const r = retainers.find(x => x.id === promotingRetainer);
  if (!r) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-gold)', fontSize: '1.1rem' }}>⭐ Promote to Character</h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
          Promote <strong>{r.name}</strong> to a full player character? A new character sheet will be created with their current stats.
        </p>
        {promoteError && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-danger)', lineHeight: 1.4 }}>
            ⚠ {promoteError}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onCancel} disabled={promoteLoading}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}>
            Cancel
          </button>
          <button onClick={() => promoteRetainer(r)} disabled={promoteLoading}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-gold)', color: '#1a1a00', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700', minHeight: '44px', opacity: promoteLoading ? 0.7 : 1 }}>
            {promoteLoading ? 'Promoting…' : 'Promote!'}
          </button>
        </div>
      </div>
    </div>
  );
}
