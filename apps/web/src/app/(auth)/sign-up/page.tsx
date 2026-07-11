'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

type Role = 'player' | 'referee';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'role'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('player');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 'details') {
      setStep('role');
      return;
    }

    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role, displayName: displayName || email.split('@')[0] }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Sign up failed.');
      setLoading(false);
      return;
    }

    // Account created — establish the session immediately.
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      router.push('/sign-in');
    } else {
      router.push('/characters');
      router.refresh();
    }
  }

  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'var(--color-bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-cinzel), Georgia, serif',
            fontSize: '1.75rem',
            fontWeight: '700',
            color: 'var(--color-primary)',
            letterSpacing: '0.05em',
            margin: 0,
          }}>
            Dolmenwood Beyond
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {step === 'details' ? 'Create your account' : 'How will you use Dolmenwood Beyond?'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
          {(['details', 'role'] as const).map((s) => (
            <div key={s} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: step === s ? 'var(--color-primary)' : 'var(--color-border)',
              opacity: step === 'details' && s === 'role' ? 0.3 : 1,
            }} />
          ))}
        </div>

        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          {error && (
            <div style={{
              backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
              border: '1px solid var(--color-danger)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: 'var(--color-danger)',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {step === 'details' ? (
              <>
                <div>
                  <label style={labelStyle}>Display Name</label>
                  <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} style={inputStyle} placeholder="Adventurer's name" autoComplete="name" />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="you@example.com" autoComplete="email" />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={inputStyle} placeholder="At least 8 characters" autoComplete="new-password" />
                </div>
                <button type="submit" style={primaryButtonStyle}>Continue</button>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <RoleCard
                    selected={role === 'player'}
                    onClick={() => setRole('player')}
                    title="Player"
                    description="Manage your characters, track HP, inventory, and spells during play."
                    icon="⚔️"
                  />
                  <RoleCard
                    selected={role === 'referee'}
                    onClick={() => setRole('referee')}
                    title="Dungeon Master"
                    description="Run campaigns, generate invite codes, and monitor your party's character sheets."
                    icon="📖"
                  />
                </div>
                <button type="submit" disabled={loading} style={primaryButtonStyle}>
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
                <button type="button" onClick={() => setStep('details')} style={ghostButtonStyle}>
                  Back
                </button>
              </>
            )}
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link href="/sign-in" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: '600' }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function RoleCard({ selected, onClick, title, description, icon }: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', gap: '1rem', alignItems: 'flex-start',
      padding: '1rem', borderRadius: '8px', textAlign: 'left',
      backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-bg)',
      border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
      cursor: 'pointer', width: '100%', minHeight: '44px',
      transition: 'border-color 0.15s, background-color 0.15s',
    }}>
      <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: '600', color: 'var(--color-text)', fontSize: '0.95rem' }}>{title}</div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.825rem', marginTop: '0.25rem', lineHeight: 1.4 }}>{description}</div>
      </div>
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.875rem', fontWeight: '500',
  color: 'var(--color-text)', marginBottom: '0.375rem',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.75rem',
  backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
  borderRadius: '8px', color: 'var(--color-text)', fontSize: '1rem',
  outline: 'none', boxSizing: 'border-box', minHeight: '44px',
};
const primaryButtonStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem',
  backgroundColor: 'var(--color-primary)', color: 'white',
  border: 'none', borderRadius: '8px', fontSize: '1rem',
  fontWeight: '600', cursor: 'pointer', minHeight: '44px',
};
const ghostButtonStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem',
  backgroundColor: 'transparent', color: 'var(--color-text-muted)',
  border: 'none', borderRadius: '8px', fontSize: '0.9rem',
  cursor: 'pointer', minHeight: '44px',
};
