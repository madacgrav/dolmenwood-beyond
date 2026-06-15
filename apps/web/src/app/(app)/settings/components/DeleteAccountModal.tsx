'use client';

interface DeleteAccountModalProps {
  deleteConfirmText: string;
  setDeleteConfirmText: (value: string) => void;
  deleting: boolean;
  deleteError: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAccountModal({
  deleteConfirmText,
  setDeleteConfirmText,
  deleting,
  deleteError,
  onCancel,
  onConfirm,
}: DeleteAccountModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-danger)', borderRadius: '14px', padding: '1.5rem', maxWidth: '360px', width: '100%' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-danger)', fontSize: '1.1rem' }}>⚠ Delete Account?</h3>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
          This will permanently delete:
        </p>
        <ul style={{ margin: '0 0 1rem 1.25rem', padding: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          <li>Your account and login</li>
          <li>All your characters</li>
          <li>All inventory, spells, and notes</li>
          <li>All retainers and mounts</li>
        </ul>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-danger)' }}>This cannot be undone.</p>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Type <strong style={{ color: 'var(--color-danger)' }}>DELETE</strong> to confirm:</p>
        <input
          value={deleteConfirmText}
          onChange={e => setDeleteConfirmText(e.target.value)}
          placeholder="DELETE"
          disabled={deleting}
          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-danger)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', marginBottom: '1rem', boxSizing: 'border-box', outline: 'none' }}
        />
        {deleteError && <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-danger)' }}>⚠ {deleteError}</p>}
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
            disabled={deleting || deleteConfirmText !== 'DELETE'}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-danger)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '700', minHeight: '44px', opacity: (deleting || deleteConfirmText !== 'DELETE') ? 0.5 : 1 }}
          >
            {deleting ? 'Deleting…' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </div>
  );
}
