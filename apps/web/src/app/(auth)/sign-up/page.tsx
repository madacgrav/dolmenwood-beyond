'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName: displayName || email.split('@')[0] }),
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
            Create your account
          </p>
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
            <button type="submit" disabled={loading} style={primaryButtonStyle}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
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
