'use client';

interface Props {
  inviteCode: string;
  error: string;
  success: string;
  loading: boolean;
  hasCampaigns: boolean;
  onCodeChange: (code: string) => void;
  onJoin: () => void;
  /** Enrollment is per character: the invite enrolls exactly one. */
  characters: { id: string; name: string }[];
  characterId: string;
  onCharacterChange: (id: string) => void;
}

export function JoinCampaignForm({ inviteCode, error, success, loading, hasCampaigns, onCodeChange, onJoin, characters, characterId, onCharacterChange }: Props) {
  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '10px',
      padding: '1rem',
    }}>
      <h3 style={{ fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.95rem', color: 'var(--color-text)', margin: '0 0 0.75rem' }}>
        {hasCampaigns ? '＋ Join Another Campaign' : 'Enter Invite Code'}
      </h3>
      <select
        value={characterId}
        onChange={e => onCharacterChange(e.target.value)}
        aria-label="Character to join with"
        style={{
          width: '100%', marginBottom: '0.5rem',
          padding: '0.5rem 0.625rem', borderRadius: '6px',
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
          fontSize: '0.875rem', minHeight: '44px', boxSizing: 'border-box',
        }}
      >
        <option value="">Which character is joining?</option>
        {characters.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={inviteCode}
          onChange={e => onCodeChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onJoin()}
          placeholder="XXXXXX"
          maxLength={6}
          style={{
            flex: 1, padding: '0.5rem 0.625rem', borderRadius: '6px',
            border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
            backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
            fontSize: '1rem', fontFamily: 'monospace', letterSpacing: '0.1em',
            textTransform: 'uppercase', minHeight: '44px',
          }}
        />
        <button
          onClick={onJoin}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white',
            fontWeight: '600', fontSize: '0.875rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, minHeight: '44px', whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Joining…' : 'Join'}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginTop: '0.5rem' }}>{error}</div>
      )}
      {success && (
        <div style={{ fontSize: '0.78rem', color: 'var(--color-primary)', marginTop: '0.5rem' }}>✓ {success}</div>
      )}
    </div>
  );
}
