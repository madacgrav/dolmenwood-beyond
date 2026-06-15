'use client';

interface Props {
  name: string;
  error: string;
  loading: boolean;
  onNameChange: (name: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export function CampaignCreateForm({ name, error, loading, onNameChange, onCreate, onCancel }: Props) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '1rem',
    }}>
      <h3 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-text)', margin: '0 0 0.875rem', fontSize: '1rem' }}>
        New Campaign
      </h3>
      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
        Campaign Name
      </label>
      <input
        type="text"
        value={name}
        onChange={e => onNameChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onCreate()}
        placeholder="e.g. The Dolmenwood Delve"
        autoFocus
        style={{
          width: '100%', padding: '0.5rem 0.625rem', borderRadius: '6px',
          border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)', fontSize: '0.95rem', minHeight: '44px',
          boxSizing: 'border-box', marginBottom: '0.75rem',
        }}
      />
      {error && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginBottom: '0.625rem' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onCreate}
          disabled={loading}
          style={{
            flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white',
            fontWeight: '600', fontSize: '0.875rem', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, minHeight: '44px',
          }}
        >
          {loading ? 'Creating…' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '0.625rem 1rem', borderRadius: '8px',
            border: '1px solid var(--color-border)', backgroundColor: 'transparent',
            color: 'var(--color-text-muted)', fontSize: '0.875rem', cursor: 'pointer', minHeight: '44px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
