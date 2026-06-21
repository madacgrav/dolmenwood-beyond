'use client';

interface Props {
  sessionTitle: string;
  deleting: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSessionModal({ sessionTitle, deleting, error, onCancel, onConfirm }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-danger)', borderRadius: '14px', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-danger)', fontSize: '1.1rem' }}>⚠ Delete Session?</h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
          Delete <strong style={{ color: 'var(--color-text)' }}>{sessionTitle}</strong>? Its RSVPs will be removed too. This cannot be undone.
        </p>
        {error && <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-danger)' }}>⚠ {error}</p>}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-danger)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700', minHeight: '44px', opacity: deleting ? 0.5 : 1 }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
