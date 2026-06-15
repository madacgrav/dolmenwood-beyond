'use client';

interface Props {
  inviteCode: string;
  copied: boolean;
  onCopy: () => void;
}

export function InviteCodePanel({ inviteCode, copied, onCopy }: Props) {
  return (
    <div style={{
      marginTop: '0.75rem',
      padding: '0.625rem 0.75rem',
      backgroundColor: 'var(--color-bg)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
    }}>
      <div>
        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.125rem' }}>
          Invite Code
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-gold)', letterSpacing: '0.1em' }}>
          {inviteCode}
        </div>
      </div>
      <button
        onClick={onCopy}
        style={{
          padding: '0.5rem 0.875rem', borderRadius: '6px',
          border: '1px solid var(--color-border)',
          backgroundColor: copied ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
          color: copied ? 'var(--color-primary)' : 'var(--color-text-muted)',
          fontSize: '0.8rem', cursor: 'pointer', minHeight: '44px',
        }}
      >
        {copied ? '✓ Copied!' : '📋 Copy'}
      </button>
    </div>
  );
}
