'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Could not send reset email.');
    } else {
      setSent(true);
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backgroundColor: 'var(--color-bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'var(--font-cinzel), Georgia, serif', fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-primary)', letterSpacing: '0.05em', margin: 0 }}>
            Dolmenwood Beyond
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Reset your password
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1.5rem' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Check your email for a password reset link. It may take a minute to arrive.
              </p>
              <Link href="/sign-in" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.9rem' }}>
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ backgroundColor: 'color-mix(in srgb, var(--color-danger) 15%, transparent)', border: '1px solid var(--color-danger)', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', color: 'var(--color-danger)', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)', marginBottom: '0.375rem' }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoComplete="email"
                    style={{ width: '100%', padding: '0.625rem 0.75rem', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          <Link href="/sign-in" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
